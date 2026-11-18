/**
 * Generic enemy AI driven by `EnemyDef` / `AttackDef`, also used for boss
 * bodies. DESIGN.md section 7.2, docs/chapters/README.md "Enemy roster".
 * Plain TypeScript.
 *
 * Loop: approach (or keep distance for ranged enemies) -> telegraph (always
 * visible, `telegraphMs`) -> attack (melee instantly, charges travel,
 * projectiles fire, bursts repeat) -> recover (open to hits) -> cooldown.
 * Frontal shields, flying, disguise, grabs and bursts come from the def.
 */

import { TUNING } from '../content/tuning';
import type {
  AttackDef,
  DamageSource,
  EnemyDef,
  EnemyId,
  EnemyStatus,
  GameEventBus,
  HitInfo,
  ScreenId,
  TileGrid,
  Vec2,
} from '../core/types';
import { GameEvents } from '../core/types';
import type { Random } from '../core/random';
import { decayVelocity, knockbackVector, shapeHits, shapeReach, shieldBlocks } from './combat';
import { add, angleTo, distance, fromAngle, normalize, scale, sub, turnToward } from './geometry';
import { findPath, isBlocked, moveBox, tileOf, walkableLine } from './grid';
import type { ProjectileSpawn } from './projectiles';

/** What an enemy needs from the world. Implemented by `World`. */
export interface CombatWorld {
  readonly grid: TileGrid;
  readonly bus: GameEventBus;
  readonly rng: Random;
  readonly screenId: ScreenId;
  playerPosition(): Vec2;
  /** False while Andrew is dead, in a scene, or Myko is mid call-in. */
  playerTargetable(): boolean;
  /** Returns true if the hit landed (not dodged or invulnerable). */
  hitPlayer(hit: Omit<HitInfo, 'targetInstanceId'>, from: Vec2): boolean;
  spawnProjectile(spawn: ProjectileSpawn): void;
  /** Extra blocked tiles (pushables, closed doors). */
  extraBlocked(col: number, row: number): boolean;
  /** Tiles only enemies cannot enter (the cattle grid the ram will not cross). Absent: none. */
  enemyBlocked?(col: number, row: number): boolean;
  actors(): readonly EnemyActor[];
}

/** Per-roster behaviour flags that are not numbers. docs/chapters/README.md roster. */
const BEHAVIOUR: Readonly<Partial<Record<EnemyId, { backOffAfterHit?: boolean; flank?: boolean; lineUp?: boolean }>>> = {
  lad: { backOffAfterHit: true },
  cousin: { backOffAfterHit: true },
  agent: { flank: true },
  // Chapter 7: clerks stand in a line toward Andrew and fire down it, so a Stumble or an umbrella catches the lot.
  clerk: { lineUp: true },
};

/**
 * Where each of a group of ranged enemies stands to form a line pointing at the player: the nearest keeps its bearing
 * from the player at `preferred` px, the next stands `spacing` px behind it on the same bearing, and so on. Pure.
 */
export function lineUpGoals(members: readonly { readonly id: string; readonly pos: Vec2 }[], player: Vec2, preferred: number, spacing: number): Map<string, Vec2> {
  const out = new Map<string, Vec2>();
  if (members.length === 0) return out;
  const sorted = [...members].sort((a, b) => distance(a.pos, player) - distance(b.pos, player) || (a.id < b.id ? -1 : 1));
  const front = sorted[0] as { id: string; pos: Vec2 };
  const dir = normalize(sub(front.pos, player));
  const axis = dir.x === 0 && dir.y === 0 ? { x: 1, y: 0 } : dir;
  sorted.forEach((m, i) => out.set(m.id, add(player, scale(axis, preferred + i * spacing))));
  return out;
}

export interface ActorStats {
  readonly maxHealth: number;
  readonly moveSpeed: number;
  readonly knockbackResistance: number;
  readonly flies: boolean;
  readonly attacks: readonly AttackDef[];
  readonly frontalShieldDeg?: number;
  readonly disguisedUntilAttack?: boolean;
  /** A bottle landing within its noise radius stops the body and makes it look for this long (the ram). */
  readonly noiseStopMs?: number;
  /** Hovers out of melee reach except while telegraphing, firing, recovering or stunned (the drone). */
  readonly dropsToFire?: boolean;
  readonly spriteKey: string;
}

export function statsFromDef(def: EnemyDef): ActorStats {
  return {
    maxHealth: def.maxHealth,
    moveSpeed: def.moveSpeed,
    knockbackResistance: def.knockbackResistance,
    flies: def.flies,
    attacks: def.attacks,
    ...(def.frontalShieldDeg === undefined ? {} : { frontalShieldDeg: def.frontalShieldDeg }),
    ...(def.disguisedUntilAttack === undefined ? {} : { disguisedUntilAttack: def.disguisedUntilAttack }),
    ...(def.dropsToFire === undefined ? {} : { dropsToFire: def.dropsToFire }),
    spriteKey: def.spriteKey,
  };
}

export type HitOutcome = 'hit' | 'blocked' | 'ignored';

let nextActor = 1;

export class EnemyActor {
  readonly instanceId: string;
  pos: Vec2;
  facingDeg = 90;
  health: number;
  status: EnemyStatus = 'normal';
  disguised: boolean;
  /** Boss-phase speed-up on telegraphs and cooldowns. */
  attackSpeedMultiplier = 1;
  attacks: readonly AttackDef[];
  /** Never takes damage (the ram). */
  invulnerable = false;
  /** Never moves (control boxes, cab lights). */
  stationary = false;
  /**
   * A director forces this body in or out of melee reach (`true` = out of reach: the combine's cab lights while it is
   * parked). `null`: `aloft` follows the def (`ActorStats.dropsToFire`).
   */
  aloftOverride: boolean | null = null;

  /** Never leaves this area (pixels): walking, knockback and charges are all clamped into it (`FightPlacement.zones`). */
  leash: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null = null;
  /**
   * While 'front', a player hit from within 90 degrees either side of `facingDeg` does no damage (`BossRunner.guard`).
   * Unlike `frontalShieldDeg` it is switched at run time. A stunned body is not guarded.
   */
  guardSide: 'front' | null = null;
  /** Called when a guarded hit is turned away. */
  onGuarded: ((actor: EnemyActor) => void) | null = null;
  /** Pinned in place by `BossRunner.pin`: faces Andrew, neither moves nor attacks; can still be hit. */
  pinned: Vec2 | null = null;
  /** Frozen by a Myko call-in or a scene. */
  frozen = false;
  /** Extra damage taken while dazed (Big Tom after hitting the tractor). */
  damageTakenMultiplier = 1;
  /** Called when Andrew's Stumble passes through this body, before the hit lands (Zorp's sign). */
  onStumbled: ((actor: EnemyActor) => void) | null = null;
  /** Called when a charge stops against a blocked tile. */
  onChargeBlocked: ((actor: EnemyActor, col: number, row: number) => void) | null = null;
  /** Called after an attack lands on Andrew. */
  onAttackLanded: ((actor: EnemyActor, attack: AttackDef) => void) | null = null;
  /** Optional tag for chapter scripts (e.g. 'zip', 'light1'). */
  tag = '';
  /** Walking pace; starts at `stats.moveSpeed`, bosses change it per phase. */
  moveSpeed: number;
  /** Texture key the view draws; starts at `stats.spriteKey` (`BossRunner.setSprite` swaps it). */
  spriteKey: string;

  private statusMs = 0;
  /** Time left looking at a noise: no movement, no attacks, facing `lookAt`. */
  private lookMs = 0;
  private lookAt: Vec2 | null = null;
  private kb: Vec2 = { x: 0, y: 0 };
  private readonly cooldowns = new Map<string, number>();
  private current: AttackDef | null = null;
  private attackDir = 0;
  private burstLeft = 0;
  private burstTimer = 0;
  private chargeTravelled = 0;
  private landedThisAttack = false;
  private backOffMs = 0;
  private readonly flankSign: number;
  private path: Vec2[] = [];
  private repathMs = 0;

  constructor(
    readonly enemyId: EnemyId | null,
    readonly stats: ActorStats,
    pos: Vec2,
    private readonly sourceOf: (attackId: string) => DamageSource,
    rng: Random,
  ) {
    this.instanceId = `${enemyId ?? 'boss'}#${nextActor++}`;
    this.pos = pos;
    this.health = stats.maxHealth;
    this.attacks = stats.attacks;
    this.moveSpeed = stats.moveSpeed;
    this.spriteKey = stats.spriteKey;
    this.disguised = stats.disguisedUntilAttack === true;
    this.flankSign = rng.next() < 0.5 ? -1 : 1;
  }

  get down(): boolean {
    return this.status === 'down';
  }

  /**
   * Out of melee reach: swings, the Shoulder and the Stumble pass it by. Bottles and thrown things still hit it.
   * A drone is aloft except while it telegraphs, fires, recovers or is stunned.
   */
  get aloft(): boolean {
    if (this.aloftOverride !== null) return this.aloftOverride;
    if (!this.stats.dropsToFire) return false;
    return !(this.status === 'telegraphing' || this.status === 'attacking' || this.status === 'recovering' || this.status === 'stunned');
  }

  get currentAttack(): AttackDef | null {
    return this.current;
  }

  /** Direction the current attack is locked to, for telegraph drawing. */
  get currentAttackDir(): number {
    return this.attackDir;
  }

  get statusMsLeft(): number {
    return this.statusMs;
  }

  /** Stun (the Glove) or daze. */
  stun(ms: number): void {
    if (this.down) return;
    this.current = null;
    this.status = 'stunned';
    this.statusMs = Math.max(this.statusMs, ms);
  }

  /** Whether it is stopped and looking at a noise (the ram after a bottle). */
  get looking(): boolean {
    return this.lookMs > 0;
  }

  /**
   * A thrown bottle landed at `at`: if this body is distractible (`ActorStats.noiseStopMs`) it drops what it was
   * about to do, stands still and faces the landing. Returns whether it was distracted.
   */
  distractBy(at: Vec2): boolean {
    const ms = this.stats.noiseStopMs;
    if (ms === undefined || ms <= 0 || this.down || this.frozen) return false;
    // A charge already under way is not stopped by a noise; it finishes and the body looks afterwards.
    if (this.status === 'attacking') return false;
    this.interrupt();
    this.lookMs = ms;
    this.lookAt = at;
    return true;
  }

  /** Cancels whatever it was about to do (the clipboard): a telegraphed or running attack is dropped. */
  interrupt(): void {
    if (this.status !== 'telegraphing' && this.status !== 'attacking') return;
    this.current = null;
    this.burstLeft = 0;
    this.status = 'normal';
  }

  /** Puts the actor down without damage numbers (Myko, completeNow). */
  knockDown(): void {
    this.health = 0;
    this.status = 'down';
    this.current = null;
  }

  /** Applies a hit. Shields block from the front unless `pierce` or the actor is stunned. */
  takeHit(hit: HitInfo, from: Vec2, opts: { pierceShield?: boolean } = {}): HitOutcome {
    if (this.down || this.invulnerable) return 'ignored';
    if (this.guardSide === 'front' && this.status !== 'stunned' && shieldBlocks(180, this.pos, this.facingDeg, from)) {
      this.onGuarded?.(this);
      return 'blocked';
    }
    if (!opts.pierceShield && this.status !== 'stunned' && shieldBlocks(this.stats.frontalShieldDeg, this.pos, this.facingDeg, from)) {
      return 'blocked';
    }
    if (this.disguised) this.disguised = false;
    const amount = Math.round(hit.amount * this.damageTakenMultiplier);
    this.health = Math.max(0, this.health - amount);
    const kb = scale(hit.knockback, 1 - this.stats.knockbackResistance);
    if (Math.hypot(kb.x, kb.y) > 0) this.kb = add(this.kb, kb);
    if (this.health <= 0) {
      this.status = 'down';
      this.current = null;
      return 'hit';
    }
    if (hit.stunMs > 0) this.stun(hit.stunMs);
    else if (this.status !== 'stunned' && Math.hypot(kb.x, kb.y) > 0 && this.status !== 'attacking') {
      this.status = 'knockedBack';
      this.current = null;
    }
    return 'hit';
  }

  tick(dtMs: number, world: CombatWorld): void {
    if (this.down || this.frozen) return;
    for (const [id, left] of this.cooldowns) {
      const n = left - dtMs;
      if (n <= 0) this.cooldowns.delete(id);
      else this.cooldowns.set(id, n);
    }
    this.backOffMs = Math.max(0, this.backOffMs - dtMs);

    // Knockback slide.
    if (this.kb.x !== 0 || this.kb.y !== 0) {
      this.moveBy(scale(this.kb, dtMs / 1000), world);
      this.kb = decayVelocity(this.kb, TUNING.combat.knockbackDecayPerSecond, dtMs);
      if (this.status === 'knockedBack' && this.kb.x === 0 && this.kb.y === 0) this.status = 'normal';
    } else if (this.status === 'knockedBack') this.status = 'normal';

    const player = world.playerPosition();
    const dist = distance(this.pos, player);
    const targetable = world.playerTargetable();

    if (this.pinned && this.status !== 'stunned') {
      // Held at its post: no walking, no attacks; it still turns to face Andrew and can still be hit.
      this.pos = this.pinned;
      this.kb = { x: 0, y: 0 };
      if (this.status !== 'down') {
        this.current = null;
        this.status = 'normal';
      }
      this.facingDeg = turnToward(this.facingDeg, angleTo(this.pos, player), TUNING.stealth.turnDegPerSecond * (dtMs / 1000) * 2);
      return;
    }

    switch (this.status) {
      case 'stunned':
        this.statusMs -= dtMs;
        if (this.statusMs <= 0) {
          this.status = 'normal';
          this.damageTakenMultiplier = 1;
        }
        return;
      case 'knockedBack':
        return;
      case 'telegraphing':
        this.statusMs -= dtMs;
        if (this.statusMs <= 0) this.beginAttack(world);
        return;
      case 'attacking':
        this.tickAttack(dtMs, world);
        return;
      case 'recovering':
        this.statusMs -= dtMs;
        if (this.statusMs <= 0) this.status = 'normal';
        return;
      case 'normal':
        break;
      case 'down':
        return;
    }

    if (this.lookMs > 0) {
      this.lookMs = Math.max(0, this.lookMs - dtMs);
      if (this.lookAt) this.facingDeg = turnToward(this.facingDeg, angleTo(this.pos, this.lookAt), TUNING.stealth.turnDegPerSecond * (dtMs / 1000) * 2);
      return;
    }
    if (this.disguised) {
      if (targetable && dist <= TUNING.combat.disguiseRevealRange) this.reveal(world);
      else return;
    }
    if (!targetable || dist > TUNING.combat.aggroRange) return;

    this.facingDeg = turnToward(this.facingDeg, angleTo(this.pos, player), TUNING.stealth.turnDegPerSecond * (dtMs / 1000) * 2);

    const chosen = this.backOffMs > 0 ? null : this.chooseAttack(dist, world);
    if (chosen) {
      this.current = chosen;
      this.attackDir = angleTo(this.pos, player);
      this.facingDeg = this.attackDir;
      this.status = 'telegraphing';
      this.statusMs = chosen.telegraphMs / this.attackSpeedMultiplier;
      this.landedThisAttack = false;
      world.bus.emit(GameEvents.EnemyTelegraph, { instanceId: this.instanceId, attackId: chosen.id, durationMs: this.statusMs });
      return;
    }
    if (!this.stationary) this.moveTowardGoal(dtMs, dist, player, world);
  }

  private reveal(world: CombatWorld): void {
    this.disguised = false;
    if (this.enemyId) world.bus.emit(GameEvents.EnemyRevealed, { instanceId: this.instanceId, enemyId: this.enemyId });
  }

  private chooseAttack(dist: number, world: CombatWorld): AttackDef | null {
    const r = TUNING.combat.characterHitRadius;
    const player = world.playerPosition();
    const usable = this.attacks.filter((a) => {
      if (this.cooldowns.has(a.id)) return false;
      const reach = shapeReach(a.shape);
      if (a.shape.kind === 'projectile' || a.shape.kind === 'charge') {
        if (dist > reach) return false;
        return this.stats.flies || a.shape.kind === 'projectile' ? true : walkableLine(world.grid, this.pos, player);
      }
      return dist <= reach + r;
    });
    if (usable.length === 0) return null;
    // Prefer close attacks when close: melee first if in reach.
    const melee = usable.filter((a) => a.shape.kind === 'arc' || a.shape.kind === 'circle' || a.shape.kind === 'cone');
    const pool = melee.length > 0 ? melee : usable;
    return pool[Math.floor(world.rng.next() * pool.length)] ?? null;
  }

  private beginAttack(world: CombatWorld): void {
    const a = this.current;
    if (!a) {
      this.status = 'normal';
      return;
    }
    this.status = 'attacking';
    this.burstLeft = Math.max(1, a.burst ?? 1);
    this.burstTimer = 0;
    this.chargeTravelled = 0;
    if (this.disguised) this.reveal(world);
  }

  private tickAttack(dtMs: number, world: CombatWorld): void {
    const a = this.current;
    if (!a) {
      this.status = 'normal';
      return;
    }
    if (a.shape.kind === 'charge') {
      const step = (TUNING.combat.chargeSpeed * dtMs) / 1000;
      const dir = fromAngle(this.attackDir);
      const before = this.pos;
      const res = this.moveBy(scale(dir, step), world);
      this.chargeTravelled += step;
      if (!this.landedThisAttack && world.playerTargetable()) {
        const half = a.shape.width / 2 + TUNING.combat.characterHitRadius;
        if (distance(this.pos, world.playerPosition()) <= half) this.landOn(a, world, before);
      }
      if (res.blocked) {
        const ahead = add(this.pos, scale(dir, 8));
        const t = tileOf(ahead);
        this.onChargeBlocked?.(this, t.col, t.row);
      }
      if (res.blocked || this.chargeTravelled >= a.shape.distance) this.finishBurstShot(a);
      return;
    }
    this.burstTimer -= dtMs;
    if (this.burstTimer > 0) return;
    if (a.shape.kind === 'projectile') {
      world.spawnProjectile({
        owner: 'enemy',
        source: this.sourceOf(a.id),
        screenId: world.screenId,
        from: this.pos,
        angleDeg: this.burstLeft === Math.max(1, a.burst ?? 1) ? this.attackDir : angleTo(this.pos, world.playerPosition()),
        aimPoint: world.playerPosition(),
        shape: a.shape,
        damage: a.damage,
        knockback: a.knockback,
        holdMs: a.holdMs ?? 0,
        weight: a.weight ?? 'ordinary',
        frame: projectileFrame(a.id),
      });
    } else if (world.playerTargetable() && shapeHits(a.shape, this.pos, this.attackDir, world.playerPosition(), TUNING.combat.characterHitRadius)) {
      this.landOn(a, world, this.pos);
    }
    this.finishBurstShot(a);
  }

  private finishBurstShot(a: AttackDef): void {
    // A hook during the attack (onChargeBlocked -> BossRunner.daze, onAttackLanded) may have
    // stunned or downed the actor: the attack ends there and must not overwrite that status.
    if (this.status !== 'attacking') {
      this.cooldowns.set(a.id, a.cooldownMs / this.attackSpeedMultiplier);
      this.burstLeft = 0;
      this.current = null;
      return;
    }
    this.burstLeft -= 1;
    if (this.burstLeft > 0) {
      this.burstTimer = TUNING.combat.burstIntervalMs;
      this.chargeTravelled = 0;
      this.landedThisAttack = false;
      return;
    }
    this.cooldowns.set(a.id, a.cooldownMs / this.attackSpeedMultiplier);
    this.status = 'recovering';
    this.statusMs = a.recoveryMs;
    if (this.landedThisAttack && this.enemyId && BEHAVIOUR[this.enemyId]?.backOffAfterHit) this.backOffMs = TUNING.combat.backOffMs;
    this.current = null;
  }

  private landOn(a: AttackDef, world: CombatWorld, from: Vec2): void {
    const player = world.playerPosition();
    const landed = world.hitPlayer(
      {
        source: this.sourceOf(a.id),
        amount: a.damage,
        knockback: knockbackVector(from, player, a.knockback, 0),
        stunMs: 0,
        holdMs: a.holdMs ?? 0,
        weight: a.weight ?? 'ordinary',
      },
      from,
    );
    if (landed) {
      this.landedThisAttack = true;
      this.onAttackLanded?.(this, a);
    }
  }

  private moveTowardGoal(dtMs: number, dist: number, player: Vec2, world: CombatWorld): void {
    const ranged = this.attacks.find((a) => a.shape.kind === 'projectile');
    const melee = this.attacks.find((a) => a.shape.kind !== 'projectile');
    let goal = player;
    let wantDist = melee ? shapeReach(melee.shape) * 0.8 : 0;
    if (this.backOffMs > 0) {
      goal = add(this.pos, scale(normalize(sub(this.pos, player)), 32));
      wantDist = 0;
    } else if (ranged) {
      const preferred = shapeReach(ranged.shape) * TUNING.combat.rangedPreferredFraction;
      const meleeReach = melee ? shapeReach(melee.shape) : 0;
      if (!melee || dist > meleeReach * 3) wantDist = preferred;
      if (dist < wantDist * 0.7) {
        goal = add(this.pos, scale(normalize(sub(this.pos, player)), 32));
        wantDist = 0;
      }
    }
    if (this.enemyId && BEHAVIOUR[this.enemyId]?.flank && dist > 48 && this.backOffMs === 0) {
      const toPlayer = normalize(sub(player, this.pos));
      goal = add(player, scale({ x: -toPlayer.y, y: toPlayer.x }, TUNING.combat.flankOffset * this.flankSign));
    }
    // Chapter 7: clerks form a line toward Andrew.
    let lineSlot: Vec2 | null = null;
    if (ranged && this.enemyId && BEHAVIOUR[this.enemyId]?.lineUp && this.backOffMs === 0) {
      const mates = world.actors().filter((o) => o.enemyId === this.enemyId && !o.down && !o.disguised);
      if (mates.length >= 2 && mates.includes(this)) {
        const spacing = TUNING.overhaul?.clerkLine?.spacingPx ?? 20;
        lineSlot = lineUpGoals(mates.map((m) => ({ id: m.instanceId, pos: m.pos })), player, shapeReach(ranged.shape) * TUNING.combat.rangedPreferredFraction, spacing).get(this.instanceId) ?? null;
      }
    }
    if (lineSlot) {
      if (distance(this.pos, lineSlot) < 3) return;
      goal = lineSlot;
      wantDist = 0;
    }
    if (wantDist > 0 && dist <= wantDist) return;

    let step: Vec2;
    if (this.stats.flies || walkableLine(world.grid, this.pos, goal)) {
      step = normalize(sub(goal, this.pos));
      this.path = [];
    } else {
      this.repathMs -= dtMs;
      if (this.repathMs <= 0 || this.path.length === 0) {
        this.path = findPath(world.grid, this.pos, goal, (c, r) => isBlocked(world.grid, c, r) || world.extraBlocked(c, r) || world.enemyBlocked?.(c, r) === true, 600) ?? [];
        this.repathMs = TUNING.combat.repathMs;
      }
      const next = this.path[0];
      if (next && distance(next, this.pos) < 4) this.path.shift();
      step = next ? normalize(sub(next, this.pos)) : { x: 0, y: 0 };
    }
    // Separation from other actors.
    const sep = TUNING.combat.separationRadius;
    let push: Vec2 = { x: 0, y: 0 };
    for (const other of world.actors()) {
      if (other === this || other.down) continue;
      const d = distance(this.pos, other.pos);
      if (d > 0 && d < sep) push = add(push, scale(normalize(sub(this.pos, other.pos)), (sep - d) / sep));
    }
    const dir = normalize(add(step, push));
    this.moveBy(scale(dir, (this.moveSpeed * dtMs) / 1000), world);
  }

  private moveBy(delta: Vec2, world: CombatWorld): { blocked: boolean } {
    const res = this.moveByUnleashed(delta, world);
    const l = this.leash;
    if (l) this.pos = { x: Math.min(l.x + l.width, Math.max(l.x, this.pos.x)), y: Math.min(l.y + l.height, Math.max(l.y, this.pos.y)) };
    return res;
  }

  private moveByUnleashed(delta: Vec2, world: CombatWorld): { blocked: boolean } {
    if (this.stats.flies) {
      const g = world.grid;
      const nx = Math.min(g.widthTiles * 16 - 4, Math.max(4, this.pos.x + delta.x));
      const ny = Math.min(g.heightTiles * 16 - 4, Math.max(4, this.pos.y + delta.y));
      this.pos = { x: nx, y: ny };
      return { blocked: false };
    }
    const size = TUNING.player.bodyWidth;
    const res = moveBox(world.grid, this.pos, size, size, delta, (c, r) => world.extraBlocked(c, r) || world.enemyBlocked?.(c, r) === true);
    this.pos = res.position;
    return { blocked: (res.blockedX && delta.x !== 0) || (res.blockedY && delta.y !== 0) };
  }
}

/** `fx` frame name for an enemy projectile by attack ID. */
export function projectileFrame(attackId: string): string {
  switch (attackId) {
    case 'box':
      return 'box';
    case 'bolt':
      return 'bolt';
    case 'ray':
    case 'zapFan':
    case 'pulse':
      return 'ray';
    case 'bale':
      return 'bale';
    default:
      return 'dart';
  }
}
