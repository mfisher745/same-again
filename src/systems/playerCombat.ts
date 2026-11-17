/**
 * What Andrew does with his hands: melee through the equipped weapon, the four
 * level-gated special slots, cycling weapons and (step 5) the hold-to-aim
 * throw. DESIGN.md 6 and 7.2. The rules are the pure modules (`weapons.ts`,
 * `moves.ts`, `throwAim.ts`, `kit.ts`); this class reads input, finds who is
 * hit, applies it to the world through a host, and emits the events. Kept out
 * of `run.ts` so that file does not grow.
 */

import { TUNING } from '../content/tuning';
import { GameEvents } from '../core/types';
import type {
  AbilityId,
  AttackShape,
  CompletionSource,
  DamageSource,
  GameEventBus,
  HidingPropDef,
  InputFrame,
  MoveId,
  MoveEffect,
  MoveSlotView,
  NoiseEvent,
  OverhaulTuning,
  ScreenId,
  SpecialSlotIndex,
  ThrowAim,
  TextId,
  TileGrid,
  Vec2,
  WeaponId,
} from '../core/types';
import type { EnemyActor } from './enemies';
import { angleTo, distance } from './geometry';
import { knockbackVector, shapeHits } from './combat';
import { cycleWeapon } from './kit';
import { breakHide, consumeMark, consumeRepeat, cooldownLeft, createMovesState, moveDef, moveUsedPayload, resolveOnTarget, selectTargets, slotWorks, tickMoves, useSlot } from './moves';
import type { MoveContext, MoveRefusal, MovesState } from './moves';
import type { Player } from './player';
import { createWeaponState, swing, switchWeapon, tickWeapon } from './weapons';
import type { SwingResult, WeaponState } from './weapons';
import type { Guard } from './stealth';
import type { ProjectileSpawn } from './projectiles';
import { beginAim, cancelAim, createThrowAimState, currentPreview, release, tickAim } from './throwAim';
import type { ThrowAimState } from './throwAim';
import { spendBottle } from './kit';

/** What the combat needs from the running chapter. */
export interface PlayerCombatHost {
  readonly bus: GameEventBus;
  readonly player: Player;
  screenId(): ScreenId;
  grid(): TileGrid;
  /** Cells that stop walking but are not in `grid()` (push-puzzle pieces, closed gates). */
  extraBlocked(col: number, row: number): boolean;
  actors(): readonly EnemyActor[];
  guardsHere(): readonly Guard[];
  hidingPropsHere(): readonly HidingPropDef[];
  /** Apply a hit to an enemy; handles shields, fx, `enemy:damaged` and defeat. */
  damageActor(actor: EnemyActor, amount: number, knockback: Vec2, stunMs: number, source: DamageSource, from: Vec2, pierceShield: boolean): void;
  /** Put an actor down. */
  defeat(actor: EnemyActor, by: CompletionSource): void;
  /** A swing touched a section hook or a breakable. */
  meleeWorldHits(shape: AttackShape, swingResult: SwingResult): void;
  /**
   * A charge or lurch is about to carry Andrew along `lane`: `breakAll` smashes every breakable in it (the Stumble
   * goes through the feed buckets) and chapter hooks (`ctx.onMoveHit`) are told. Called before he moves, so what
   * broke no longer blocks him.
   */
  moveWorldHits(moveId: MoveId, lane: AttackShape, breakAll: boolean): void;
  /** A swing near a stealth guard raises the alarm. */
  alarmGuardsHit(shape: AttackShape, angleDeg: number): void;
  emitNoise(n: NoiseEvent): void;
  spawnProjectile(spawn: ProjectileSpawn): void;
  addFx(kind: 'swing' | 'slam' | 'glove' | 'hit', pos: Vec2, angleDeg: number, radius: number, arcDeg: number, ttlMs: number): void;
}

/** The legacy ability id a weapon or move sounds like, for events the audio and chapter 1 still read. */
export function legacyAbilityOf(id: WeaponId | MoveId): AbilityId {
  switch (id) {
    case 'hurley':
      return 'hurley';
    case 'stoutSlam':
    case 'borrowedGlove':
    case 'actNatural':
    case 'stumble':
      return id;
    default:
      return 'punchCombo';
  }
}

/** A refusal for the HUD to show: `ui.move.<reason>`. */
export interface ActionRefusal {
  readonly textId: TextId;
  /** Counts up so the HUD can tell a new refusal from the last. */
  readonly seq: number;
}

export class PlayerCombat {
  moves: MovesState = createMovesState();
  weapon: WeaponState;
  /** Time until the next swing is allowed. */
  private swingLeftMs = 0;
  /** Hold right mouse to aim a bottle, release to throw (`throwAim.ts`). */
  private aim: ThrowAimState = createThrowAimState();
  private pointer: Vec2 = { x: 0, y: 0 };
  private seq = 0;
  lastRefusal: ActionRefusal | null = null;
  /** The latest melee swing, for the view's animation. `seq` counts up with each swing. */
  lastSwing: { readonly seq: number; readonly weaponId: WeaponId; readonly comboIndex: number; readonly swingMs: number } | null = null;
  /** Counts up with each bottle thrown, for the view's throw animation. */
  throwSeq = 0;

  constructor(private readonly host: PlayerCombatHost) {
    this.weapon = createWeaponState(host.player.kit.slots.melee);
  }

  private get tuning(): OverhaulTuning {
    const o = TUNING.overhaul;
    if (!o) throw new Error('TUNING.overhaul is missing');
    return o;
  }

  /** The state of the four slots for the HUD and the Tab screen. */
  slotViews(): readonly MoveSlotView[] {
    const p = this.host.player;
    return ([1, 2, 3, 4] as const).map((slot): MoveSlotView => {
      const id = p.kit.slots.specials[slot - 1] ?? null;
      return {
        slot,
        moveId: id,
        lit: slotWorks(slot, p.level),
        cooldownLeftMs: cooldownLeft(this.moves, slot),
        cooldownMs: id === null ? 0 : moveDef(id).cooldownMs,
      };
    });
  }

  /** Cooldowns run all the time (also while a slot is dark); Act Natural ends on a step. */
  tick(dtMs: number): void {
    const p = this.host.player;
    this.moves = tickMoves(this.moves, dtMs);
    this.weapon = tickWeapon(this.weapon, dtMs);
    this.swingLeftMs = Math.max(0, this.swingLeftMs - dtMs);
    if (p.kit.slots.melee !== this.weapon.weapon) this.weapon = switchWeapon(this.weapon, p.kit.slots.melee);
    if (this.moves.hidden && (p.moving || this.seenByGuard())) this.moves = breakHide(this.moves);
    // Second Opinion: the mark goes when its target is gone.
    const markId = this.moves.mark?.targetId;
    if (markId && !this.host.actors().some((a) => a.instanceId === markId && !a.down)) this.moves = { ...this.moves, mark: null };
  }

  /** Second Opinion: who is marked, or null. For the view's marker. */
  get markedTargetId(): string | null {
    return this.moves.mark?.targetId ?? null;
  }

  /** A thrown bottle (or any non-melee player hit) lands on `actorId`: spends the Second Opinion mark and returns the damage multiplier. */
  consumeMarkFor(actorId: string): number {
    const r = consumeMark(this.moves, actorId);
    this.moves = r.state;
    return r.multiplier;
  }

  /** Back in the bar: cooldowns clear, nothing half done. */
  reset(): void {
    this.moves = createMovesState();
    this.swingLeftMs = 0;
    this.aim = cancelAim();
    this.weapon = createWeaponState(this.host.player.kit.slots.melee);
  }

  /** Act Natural is holding him unseen. */
  get hidden(): boolean {
    return this.moves.hidden;
  }

  /** The throw is being aimed (right mouse held with a bottle). */
  get aiming(): boolean {
    return this.aim.aiming;
  }

  /** The dotted path the view draws while the throw is being aimed, or null. DESIGN.md 7.2 "Thrown bottles". */
  throwPreview(): ThrowAim | null {
    const p = this.host.player;
    return currentPreview(this.aim, p.pos, this.pointer, p.level);
  }

  handleInput(input: InputFrame, dtMs: number): void {
    const p = this.host.player;
    this.pointer = input.aim;
    if (!p.canAct) {
      this.aim = cancelAim();
      return;
    }
    this.handleThrow(input, dtMs);
    if (input.pressed.has('cycleWeapon')) {
      const r = cycleWeapon(p.kit, 1);
      if (r.changed) p.setKit(r.kit);
      this.weapon = switchWeapon(this.weapon, p.kit.slots.melee);
    }
    for (const slot of [1, 2, 3, 4] as const) {
      if (input.pressed.has(`special${slot}` as const)) this.useSlot(slot);
    }
    if (input.pressed.has('melee')) this.swingMelee();
  }

  // -------------------------------------------------------------------------
  // The throw
  // -------------------------------------------------------------------------

  private handleThrow(input: InputFrame, dtMs: number): void {
    const h = this.host;
    const p = h.player;
    if (input.pressed.has('aimHold')) {
      const r = beginAim(this.aim, p.kit.bottles);
      this.aim = r.state;
      if (r.refusal === 'noBottle') this.refuseText('ui.throw.noBottle');
    } else if (this.aim.aiming) {
      this.aim = tickAim(this.aim, dtMs);
    }
    if (!input.released.has('aimHold') || !this.aim.aiming) return;
    const r = release(this.aim, p.pos, this.pointer, p.level, p.kit.bottles);
    this.aim = r.state;
    const req = r.request;
    if (!req) return;
    const spent = spendBottle(p.kit);
    if (!spent.changed) return;
    p.setKit(spent.kit);
    p.faceAim();
    this.throwSeq += 1;
    const t = this.tuning.throw;
    if (!t) return;
    h.spawnProjectile({
      owner: 'player',
      source: { kind: 'player', abilityId: 'bottleThrow' },
      screenId: h.screenId(),
      from: req.origin,
      angleDeg: angleTo(req.origin, req.landing),
      aimPoint: req.landing,
      shape: { kind: 'projectile', speed: t.speed, range: t.range, pierce: 0, lobbed: true, deflectable: false, impactNoiseRadius: req.noiseRadius },
      damage: req.damage,
      knockback: req.knockback,
      frame: 'bottle',
    });
  }

  // -------------------------------------------------------------------------
  // Melee
  // -------------------------------------------------------------------------

  private swingMelee(): void {
    const h = this.host;
    const p = h.player;
    if (this.swingLeftMs > 0) return;
    const { state, result } = swing(this.weapon, p.level);
    this.weapon = state;
    this.swingLeftMs = result.swingMs;
    this.lastSwing = { seq: (this.lastSwing?.seq ?? 0) + 1, weaponId: result.weaponId, comboIndex: result.comboIndex, swingMs: result.swingMs };
    p.faceAim();
    const arcDeg = result.sweepArcDeg > 0 ? result.sweepArcDeg : this.tuning.meleeArcDeg;
    const r = TUNING.combat.characterHitRadius;
    // A poke is a lane, not a fan.
    const shape: AttackShape = result.pierceCount > 1 ? { kind: 'charge', distance: result.reach, width: r * 2 } : { kind: 'arc', range: result.reach, arcDeg };
    h.addFx('swing', p.pos, p.aimDeg, result.reach, shape.kind === 'arc' ? arcDeg : 0, 120);
    const source: DamageSource = { kind: 'player', abilityId: legacyAbilityOf(result.weaponId) };
    let targets = h.actors().filter((a) => !a.down && !a.aloft && shapeHits(shape, p.pos, p.aimDeg, a.pos, r));
    if (result.pierceCount > 1) targets = targets.sort((a, b) => distance(p.pos, a.pos) - distance(p.pos, b.pos)).slice(0, result.pierceCount);
    const repeat = consumeRepeat(this.moves);
    this.moves = repeat.state;
    for (const actor of targets) {
      const mark = consumeMark(this.moves, actor.instanceId);
      this.moves = mark.state;
      const amount = result.damage * mark.multiplier;
      if (result.interrupts) actor.interrupt();
      for (let i = 0; i < repeat.times; i++) {
        h.damageActor(actor, amount, knockbackVector(p.pos, actor.pos, result.knockback, 0), result.stunMs, source, p.pos, false);
      }
    }
    h.alarmGuardsHit(shape, p.aimDeg);
    h.meleeWorldHits(shape, result);
    h.bus.emit(GameEvents.AbilityUsed, { abilityId: legacyAbilityOf(result.weaponId) });
  }

  /** Combo length of the equipped weapon, for `MeleeHitInfo`. */
  comboLength(weapon: WeaponId): number {
    const q = this.tuning.weapons[weapon].quirk;
    return q.kind === 'combo' ? q.hits : q.kind === 'nthHitStuns' ? q.everyHits : 1;
  }

  // -------------------------------------------------------------------------
  // Specials
  // -------------------------------------------------------------------------

  /** Press special slot `slot`. A refusal shows `ui.move.*` and costs nothing. */
  useSlot(slot: SpecialSlotIndex): void {
    const h = this.host;
    const p = h.player;
    const id = p.kit.slots.specials[slot - 1] ?? null;
    const ctx = id === null ? {} : this.contextFor(id);
    const { state, outcome } = useSlot(this.moves, p.kit.slots.specials, slot, p.level, ctx);
    this.moves = state;
    if (!outcome.ok) {
      this.refuse(outcome.refusal);
      return;
    }
    this.apply(outcome.use.effect, outcome.use.moveId);
    h.bus.emit(GameEvents.MoveUsed, moveUsedPayload(outcome.use));
    if (outcome.use.moveId === 'stoutSlam' || outcome.use.moveId === 'borrowedGlove' || outcome.use.moveId === 'actNatural' || outcome.use.moveId === 'stumble') {
      h.bus.emit(GameEvents.AbilityUsed, { abilityId: legacyAbilityOf(outcome.use.moveId) });
    }
  }

  private refuse(reason: MoveRefusal): void {
    this.refuseText(`ui.move.${reason}`);
  }

  private refuseText(textId: TextId): void {
    this.seq += 1;
    this.lastRefusal = { textId, seq: this.seq };
  }

  /** The reach for "who is near enough" on single-target moves. */
  private targetRange(): number {
    return this.tuning.moveRange;
  }

  private nearestTarget(): EnemyActor | null {
    const p = this.host.player;
    let best: EnemyActor | null = null;
    let bestD = this.targetRange();
    for (const a of this.host.actors()) {
      if (a.down || a.invulnerable) continue;
      const d = distance(p.pos, a.pos);
      if (d <= bestD) {
        best = a;
        bestD = d;
      }
    }
    return best;
  }

  private seenByGuard(): boolean {
    return this.host.guardsHere().some((g) => g.alert === 'detecting' || g.alert === 'alarm');
  }

  private contextFor(id: MoveId): MoveContext {
    const e = moveDef(id).effect;
    const p = this.host.player;
    const target = this.nearestTarget();
    const ctx: { hasTarget?: boolean; targetId?: string; besideProp?: boolean; seenByGuard?: boolean } = {};
    if (target) {
      ctx.hasTarget = true;
      ctx.targetId = target.instanceId;
    }
    if (e.kind === 'hideBesideProp') {
      ctx.besideProp = this.host.hidingPropsHere().some((prop) => distance(prop.position, p.pos) <= e.propRadius);
      ctx.seenByGuard = this.seenByGuard();
    }
    return ctx;
  }

  /** Put a move in the world. Magnitudes are the tuned `MoveEffect`; nothing here is a balance number. */
  private apply(effect: MoveEffect, id: MoveId): void {
    const h = this.host;
    const p = h.player;
    const source: DamageSource = { kind: 'player', abilityId: legacyAbilityOf(id) };
    const alive = h.actors().filter((a) => !a.down);
    const candidates = alive.map((a) => ({ id: a.instanceId, pos: a.pos }));
    const byId = (ids: readonly string[]): EnemyActor[] => alive.filter((a) => ids.includes(a.instanceId));
    const hit = (a: EnemyActor, amount: number, kb: number, stunMs = 0): void =>
      h.damageActor(a, amount, knockbackVector(p.pos, a.pos, kb, 0), stunMs, source, p.pos, true);
    p.faceAim();
    switch (effect.kind) {
      case 'charge': {
        const who = byId(selectTargets(effect, p.pos, p.aimDeg, candidates)).filter((a) => !a.aloft);
        h.moveWorldHits(id, { kind: 'charge', distance: effect.distance, width: TUNING.combat.characterHitRadius * 2 }, false);
        p.lurch(effect.distance, p.aimDeg, h.grid(), (c, r) => h.extraBlocked(c, r));
        for (const a of who) hit(a, 0, effect.knockback);
        break;
      }
      case 'stagger': {
        const t = this.nearestTarget();
        if (t) t.stun(effect.durationMs);
        break;
      }
      case 'hideBesideProp':
      case 'repeatHits':
      case 'markTarget':
        // State only (`moves.ts`); the next swing or the stealth tick reads it.
        break;
      case 'knockdownAround': {
        h.addFx('slam', p.pos, p.aimDeg, effect.radius, 360, 250);
        for (const a of byId(selectTargets(effect, p.pos, p.aimDeg, candidates))) hit(a, 0, effect.knockback);
        h.emitNoise({ kind: 'combat', position: p.pos, radius: effect.radius });
        break;
      }
      case 'calmAround':
        for (const a of byId(selectTargets(effect, p.pos, p.aimDeg, candidates))) a.stun(effect.durationMs);
        break;
      case 'lurch': {
        const who = byId(selectTargets(effect, p.pos, p.aimDeg, candidates)).filter((a) => !a.aloft);
        const damage = this.weaponDamage();
        const kb = this.tuning.weapons[p.kit.slots.melee].knockback;
        h.moveWorldHits(id, { kind: 'charge', distance: effect.distance, width: effect.width }, true);
        p.lurch(effect.distance, p.aimDeg, h.grid(), (c, r) => h.extraBlocked(c, r));
        for (const a of who) hit(a, damage, kb);
        break;
      }
      case 'holdAround':
        // An invulnerable body (the ram, the combine) is not held.
        for (const a of byId(selectTargets(effect, p.pos, p.aimDeg, candidates)).filter((x) => !x.invulnerable)) {
          a.stun(effect.durationMs);
          a.damageTakenMultiplier = effect.damageMultiplier;
        }
        break;
      case 'stunCone': {
        h.addFx('glove', p.pos, p.aimDeg, effect.range, effect.angleDeg, 250);
        for (const a of byId(selectTargets(effect, p.pos, p.aimDeg, candidates))) hit(a, 0, 0, effect.durationMs);
        h.bus.emit(GameEvents.AbilityGlovePulse, { screenId: h.screenId(), position: p.pos, radius: effect.range });
        h.emitNoise({ kind: 'combat', position: p.pos, radius: effect.range });
        break;
      }
      case 'finisher': {
        const t = this.moveTarget();
        if (t) this.applyOnTarget(effect, t, source);
        break;
      }
      case 'throwOut': {
        const t = this.moveTarget();
        if (t) this.applyOnTarget(effect, t, source);
        break;
      }
      case 'screenWipe':
        for (const a of alive) this.applyOnTarget(effect, a, source);
        break;
    }
  }

  /** The target stored by `useSlot` for single-target moves: the nearest one in range. */
  private moveTarget(): EnemyActor | null {
    return this.nearestTarget();
  }

  private weaponDamage(): number {
    const p = this.host.player;
    return this.tuning.weapons[p.kit.slots.melee].damage * this.tuning.meleeMultiplierByLevel[Math.max(1, p.level) as 1 | 2 | 3 | 4];
  }

  /** One for the Road, Last Orders and Barred against one actor (`moves.resolveOnTarget`). */
  private applyOnTarget(effect: MoveEffect, a: EnemyActor, source: DamageSource): void {
    const h = this.host;
    const p = h.player;
    const out = resolveOnTarget(effect, { boss: a.enemyId === null, health: a.health, maxHealth: a.stats.maxHealth });
    if (out.damage > 0) h.damageActor(a, out.damage, { x: 0, y: 0 }, out.stunMs, source, p.pos, true);
    else if (out.stunMs > 0) a.stun(out.stunMs);
    if (out.removed && !a.down) h.defeat(a, 'player');
    if (out.landingDamage > 0) {
      // Thrown out, he lands on everyone near where he comes down.
      const radius = effect.kind === 'throwOut' ? effect.landingRadius : 0;
      for (const other of h.actors()) {
        if (other.down || other === a || distance(a.pos, other.pos) > radius) continue;
        h.damageActor(other, out.landingDamage, { x: 0, y: 0 }, 0, source, a.pos, true);
      }
    }
  }
}
