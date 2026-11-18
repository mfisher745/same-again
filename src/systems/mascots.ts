/**
 * Chapter 7 boss: Zip, Zap and Zorp, three aliens in seven-foot foam costumes (`c7.boss.mascots`). The boss's three
 * bodies are held in place by this director (`EnemyActor.pinned`), which moves them, so their own AI does nothing:
 *
 * - Formation: Zorp stands in front, toward Andrew; Zip and Zap stand a little behind him to either side. The line
 *   keeps `mascots.standOffPx` from Andrew and follows him round the arena.
 * - Zip tumbles: the `zipTumble` attack. A line is marked on the ground for the telegraph, then he rolls along it (a
 *   heavy hit), then lies on his back for the attack's `recoveryMs` (2 s), stunned and open to hits.
 * - Zap shoots fans: the `zapFan` attack. The ray gun's three bolts leave together `mascots.fanSpreadDeg` apart, with
 *   gaps between them to stand in; the three lines are marked for the telegraph.
 * - Zorp's sign blocks every hit from the front (`BossRunner.guard`). Andrew's Stumble through him knocks the sign
 *   away for `mascots.signKnockedMs`. Going round the side works too (slowly).
 * - Every fall speeds the others up through the phases of `c7.boss.mascots` (`attackSpeedMultiplier`), which also
 *   scales how fast the formation moves.
 * - When the last falls the tourists applaud (`mascots:changed` `applause`; the chapter handles the crowd).
 *
 * Numbers: the attacks and phases are in `TUNING.bosses['c7.boss.mascots']`, the rest in `TUNING.overhaul.mascots`.
 * Pure TypeScript; the run feeds it Andrew and the world. Nothing here is saved: a started boss starts again.
 */

import { TUNING } from '../content/tuning';
import { GameEvents } from '../core/types';
import type { AttackDef, BossId, CompletionSource, GameEventBus, HitInfo, ScreenId, TileGrid, Vec2 } from '../core/types';
import type { BossRunner } from './boss';
import type { EnemyActor } from './enemies';
import { add, angleTo, distance, fromAngle, normalize, scale, sub } from './geometry';
import { moveBox } from './grid';
import type { ProjectileSpawn } from './projectiles';

export interface MascotPlacement {
  /** The arena the bodies stay inside, px. */
  readonly arena: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** Body tags (defaults 'zip', 'zap', 'zorp'). */
  readonly tags?: { readonly zip: string; readonly zap: string; readonly zorp: string };
}

export interface MascotHost {
  readonly bus: GameEventBus;
  screenId(): ScreenId;
  grid(): TileGrid;
  extraBlocked(col: number, row: number): boolean;
  playerPosition(): Vec2;
  playerTargetable(): boolean;
  hitPlayer(hit: Omit<HitInfo, 'targetInstanceId'>): boolean;
  spawnProjectile(spawn: ProjectileSpawn): void;
}

/** What the view draws. */
export interface MascotView {
  /** Zip's marked line while he is lit or rolling. */
  readonly tumble: { readonly from: Vec2; readonly to: Vec2; readonly width: number; readonly state: 'lit' | 'rolling' } | null;
  /** Zap's three marked lines while lit. */
  readonly fan: { readonly origin: Vec2; readonly anglesDeg: readonly number[]; readonly range: number } | null;
  /** Zorp's sign is up (blocking). */
  readonly signUp: boolean;
  /** Zip is on his back. */
  readonly zipProne: boolean;
  /** The tourists are applauding (for `applauseMs` after the end). */
  readonly applauding: boolean;
}

/** Where each mascot stands for a formation facing Andrew: Zorp ahead, Zip and Zap behind him either side. Pure. */
export function formationSpots(
  player: Vec2,
  toward: Vec2,
  alive: { readonly zip: boolean; readonly zap: boolean; readonly zorp: boolean },
  t: { readonly standOffPx: number; readonly frontOffsetPx: number; readonly sideOffsetPx: number },
): { zip: Vec2; zap: Vec2; zorp: Vec2 } {
  const raw = normalize(sub(toward, player));
  const u = raw.x === 0 && raw.y === 0 ? { x: 1, y: 0 } : raw;
  const perp = { x: -u.y, y: u.x };
  const base = add(player, scale(u, alive.zorp ? t.standOffPx + t.frontOffsetPx : t.standOffPx));
  return {
    zorp: add(player, scale(u, t.standOffPx)),
    zip: add(base, scale(perp, t.sideOffsetPx)),
    zap: add(base, scale(perp, -t.sideOffsetPx)),
  };
}

/** Angles of one fan's bolts: the centre aimed at Andrew and one `spreadDeg` either side. Pure. */
export function fanAngles(aimDeg: number, spreadDeg: number, bolts: number): number[] {
  return Array.from({ length: bolts }, (_, i) => aimDeg + (i - (bolts - 1) / 2) * spreadDeg);
}

type ZipState = 'idle' | 'lit' | 'rolling' | 'prone';

export class MascotDirector {
  private zip: { state: ZipState; ms: number; from: Vec2; dir: number; travelled: number; hit: boolean; cd: number } = freshZip();
  private zap: { state: 'idle' | 'lit'; ms: number; aim: number; cd: number } = { state: 'idle', ms: 0, aim: 0, cd: 0 };
  private signMs = 0;
  private armed = false;
  private fell = new Set<string>();
  private applauseLeft = 0;
  private ended = false;

  constructor(
    readonly bossId: BossId,
    readonly placement: MascotPlacement,
    private readonly host: MascotHost,
  ) {}

  private get tags(): { zip: string; zap: string; zorp: string } {
    return this.placement.tags ?? { zip: 'zip', zap: 'zap', zorp: 'zorp' };
  }

  /** Back to the start (a return to the bar). */
  reset(): void {
    this.zip = freshZip();
    this.zap = { state: 'idle', ms: 0, aim: 0, cd: 0 };
    this.signMs = 0;
    this.armed = false;
    this.fell.clear();
    this.applauseLeft = 0;
    this.ended = false;
  }

  /** The boss started: hold every body and raise Zorp's sign. */
  start(boss: BossRunner): void {
    this.reset();
    const zorp = boss.body(this.tags.zorp);
    if (zorp) {
      boss.guard(this.tags.zorp, 'front');
      zorp.onStumbled = () => this.knockSign(boss);
    }
    for (const b of boss.allBodies()) b.pinned = { ...b.pos };
  }

  /** Called when the boss ends. By a player win or a Myko call the tourists applaud. */
  end(_by: CompletionSource): void {
    if (this.ended) return;
    this.ended = true;
    this.zip.state = 'idle';
    this.zap.state = 'idle';
    this.applauseLeft = TUNING.overhaul?.mascots?.applauseMs ?? 0;
    this.host.bus.emit(GameEvents.MascotsChanged, { bossId: this.bossId, phase: 'applause' });
  }

  view(boss: BossRunner | null): MascotView {
    const t = this.currentAttack(boss, 'zipTumble');
    const z = this.zip;
    const zipBody = boss?.body(this.tags.zip);
    const tumble =
      (z.state === 'lit' || z.state === 'rolling') && t && t.shape.kind === 'charge'
        ? { from: z.from, to: add(z.from, fromAngle(z.dir, t.shape.distance)), width: t.shape.width, state: z.state }
        : null;
    const f = this.currentAttack(boss, 'zapFan');
    const zapBody = boss?.body(this.tags.zap);
    const fan =
      this.zap.state === 'lit' && f && zapBody && f.shape.kind === 'projectile'
        ? { origin: zapBody.pos, anglesDeg: fanAngles(this.zap.aim, TUNING.overhaul?.mascots?.fanSpreadDeg ?? 0, Math.max(1, f.burst ?? 3)), range: f.shape.range }
        : null;
    return { tumble, fan, signUp: this.signMs <= 0 && boss?.body(this.tags.zorp)?.guardSide === 'front', zipProne: z.state === 'prone' && zipBody?.status === 'stunned', applauding: this.applauseLeft > 0 };
  }

  tick(dtMs: number, boss: BossRunner | null, active: boolean): void {
    if (this.applauseLeft > 0) this.applauseLeft = Math.max(0, this.applauseLeft - dtMs);
    const t = TUNING.overhaul?.mascots;
    if (!boss || !active || !t) return;
    const zip = boss.body(this.tags.zip);
    const zap = boss.body(this.tags.zap);
    const zorp = boss.body(this.tags.zorp);
    const phase = boss.phase;
    const mult = phase?.attackSpeedMultiplier ?? 1;
    this.noteFalls(boss, [zip, zap, zorp]);

    // Zorp's sign.
    if (this.signMs > 0) {
      this.signMs -= dtMs;
      if (this.signMs <= 0 && zorp && !zorp.down) {
        boss.guard(this.tags.zorp, 'front');
        this.host.bus.emit(GameEvents.MascotsChanged, { bossId: this.bossId, phase: 'signBack', tag: this.tags.zorp });
      }
    }

    const player = this.host.playerPosition();
    const targetable = this.host.playerTargetable();
    const zipAtk = phase?.attacks.find((a) => a.id === 'zipTumble');
    const fanAtk = phase?.attacks.find((a) => a.id === 'zapFan');
    if (!this.armed) {
      this.armed = true;
      this.zip.cd = (zipAtk?.cooldownMs ?? 0) / mult;
      this.zap.cd = (fanAtk?.cooldownMs ?? 0) / mult;
    }

    // Formation.
    const members = [zip, zap, zorp].filter((b): b is EnemyActor => b !== undefined && !b.down);
    if (members.length > 0) {
      const centroid = scale(members.reduce((s, b) => add(s, b.pos), { x: 0, y: 0 }), 1 / members.length);
      const spots = formationSpots(player, centroid, { zip: !!zip && !zip.down, zap: !!zap && !zap.down, zorp: !!zorp && !zorp.down }, t);
      const speed = boss.def.moveSpeed * mult;
      const hold = (b: EnemyActor | undefined, spot: Vec2, free: boolean): void => {
        if (!b || b.down) return;
        if (free && b.status !== 'stunned') this.walk(b, spot, speed * (dtMs / 1000));
        b.pinned = { ...b.pos };
      };
      hold(zorp, spots.zorp, true);
      hold(zap, spots.zap, this.zap.state === 'idle');
      hold(zip, spots.zip, this.zip.state === 'idle');
    }

    if (zip && !zip.down && zipAtk) this.tickZip(dtMs, zip, zipAtk, mult, player, targetable);
    if (zap && !zap.down && fanAtk) this.tickZap(dtMs, zap, fanAtk, mult, player, targetable, boss);
  }

  // -------------------------------------------------------------------------

  private currentAttack(boss: BossRunner | null, id: string): AttackDef | undefined {
    return boss?.phase?.attacks.find((a) => a.id === id) ?? boss?.def.phases.flatMap((p) => p.attacks).find((a) => a.id === id);
  }

  private knockSign(boss: BossRunner): void {
    const t = TUNING.overhaul?.mascots;
    if (!t) return;
    const zorp = boss.body(this.tags.zorp);
    if (!zorp || zorp.down) return;
    const wasUp = this.signMs <= 0;
    this.signMs = t.signKnockedMs;
    boss.guard(this.tags.zorp, null);
    if (wasUp) this.host.bus.emit(GameEvents.MascotsChanged, { bossId: this.bossId, phase: 'signKnocked', tag: this.tags.zorp });
  }

  private noteFalls(boss: BossRunner, bodies: readonly (EnemyActor | undefined)[]): void {
    for (const b of bodies) {
      if (b && b.down && !this.fell.has(b.tag)) {
        this.fell.add(b.tag);
        this.host.bus.emit(GameEvents.MascotsChanged, { bossId: this.bossId, phase: 'fell', tag: b.tag });
      }
    }
    void boss;
  }

  private walk(b: EnemyActor, to: Vec2, step: number): void {
    const d = distance(b.pos, to);
    if (d < 1) return;
    const delta = scale(normalize(sub(to, b.pos)), Math.min(step, d));
    this.moveBody(b, delta);
  }

  private moveBody(b: EnemyActor, delta: Vec2): boolean {
    const size = TUNING.player.bodyWidth;
    const res = moveBox(this.host.grid(), b.pos, size, size, delta, (c, r) => this.host.extraBlocked(c, r));
    const a = this.placement.arena;
    b.pos = { x: Math.min(a.x + a.width, Math.max(a.x, res.position.x)), y: Math.min(a.y + a.height, Math.max(a.y, res.position.y)) };
    return (res.blockedX && delta.x !== 0) || (res.blockedY && delta.y !== 0);
  }

  private tickZip(dtMs: number, zip: EnemyActor, atk: AttackDef, mult: number, player: Vec2, targetable: boolean): void {
    const z = this.zip;
    const shape = atk.shape;
    if (shape.kind !== 'charge') return;
    if (zip.status === 'stunned' && z.state !== 'prone') {
      // Knocked about while marking or rolling: he lies down where he is.
      z.state = 'prone';
    }
    switch (z.state) {
      case 'idle':
        z.cd -= dtMs;
        if (z.cd <= 0 && targetable && distance(zip.pos, player) <= shape.distance + 40) {
          z.state = 'lit';
          z.ms = atk.telegraphMs / mult;
          z.from = { ...zip.pos };
          z.dir = angleTo(zip.pos, player);
          z.travelled = 0;
          z.hit = false;
          this.host.bus.emit(GameEvents.MascotsChanged, { bossId: this.bossId, phase: 'telegraph', tag: zip.tag });
        }
        break;
      case 'lit':
        z.ms -= dtMs;
        if (z.ms <= 0) z.state = 'rolling';
        break;
      case 'rolling': {
        const speed = TUNING.overhaul?.mascots?.tumbleSpeed ?? 0;
        const step = Math.min((speed * dtMs) / 1000, shape.distance - z.travelled);
        const blocked = this.moveBody(zip, scale(fromAngle(z.dir), step));
        z.travelled += step;
        zip.pinned = { ...zip.pos };
        if (!z.hit && targetable && distance(zip.pos, player) <= shape.width / 2 + TUNING.combat.characterHitRadius) {
          const landed = this.host.hitPlayer({
            source: { kind: 'boss', bossId: this.bossId, attackId: atk.id },
            amount: atk.damage,
            knockback: scale(normalize(sub(player, zip.pos)), atk.knockback),
            stunMs: 0,
            holdMs: 0,
            weight: atk.weight ?? 'heavy',
          });
          z.hit = landed;
        }
        if (blocked || z.travelled >= shape.distance - 0.001) {
          // On his back for the recovery time: stunned, open to hits.
          zip.stun(atk.recoveryMs);
          z.state = 'prone';
        }
        break;
      }
      case 'prone':
        if (zip.status !== 'stunned') {
          z.state = 'idle';
          z.cd = atk.cooldownMs / mult;
        }
        break;
    }
  }

  private tickZap(dtMs: number, zap: EnemyActor, atk: AttackDef, mult: number, player: Vec2, targetable: boolean, boss: BossRunner): void {
    const f = this.zap;
    const shape = atk.shape;
    if (shape.kind !== 'projectile') return;
    if (zap.status === 'stunned') {
      f.state = 'idle';
      return;
    }
    if (f.state === 'idle') {
      f.cd -= dtMs;
      if (f.cd <= 0 && targetable && distance(zap.pos, player) <= shape.range) {
        f.state = 'lit';
        f.ms = atk.telegraphMs / mult;
        f.aim = angleTo(zap.pos, player);
        this.host.bus.emit(GameEvents.MascotsChanged, { bossId: this.bossId, phase: 'telegraph', tag: zap.tag });
      }
      return;
    }
    f.ms -= dtMs;
    if (f.ms > 0) return;
    const spread = TUNING.overhaul?.mascots?.fanSpreadDeg ?? 0;
    for (const angleDeg of fanAngles(f.aim, spread, Math.max(1, atk.burst ?? 3))) {
      this.host.spawnProjectile({
        owner: 'enemy',
        source: { kind: 'boss', bossId: this.bossId, attackId: atk.id },
        screenId: this.host.screenId(),
        from: zap.pos,
        angleDeg,
        shape,
        damage: atk.damage,
        knockback: atk.knockback,
        weight: atk.weight ?? 'ordinary',
        frame: 'ray',
      });
    }
    f.state = 'idle';
    f.cd = atk.cooldownMs / mult;
    void boss;
  }
}

function freshZip(): { state: ZipState; ms: number; from: Vec2; dir: number; travelled: number; hit: boolean; cd: number } {
  return { state: 'idle', ms: 0, from: { x: 0, y: 0 }, dir: 0, travelled: 0, hit: false, cd: 0 };
}
