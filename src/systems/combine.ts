/**
 * Chapter 6 set piece: the unmanned combine harvester. It crosses the arena in straight passes along marked lanes.
 * A dust plume shows the next lane for the `pass` attack's telegraph (1.5 s); being in the lane as it comes is a
 * worst hit that throws Andrew clear; it cuts standing corn (cover) as it goes. It throws bales in an arc onto
 * shadow markers (the `bale` attack). Three sensor lights ride on the cab and are the targets: melee reaches them
 * only while it passes, bottles at any time. Two escort drones. With all three out it drives in a slow, dignified
 * curve into the irrigation ditch.
 *
 * The numbers come from the boss's phase attacks (`pass`, `bale`) and `TUNING.combat.chargeSpeed` (pass speed) and
 * `BossDef.moveSpeed` (the end curve). A phase's `attackSpeedMultiplier` divides telegraphs and cooldowns, as for any
 * other attack. Pure TypeScript; the run feeds it Andrew and the world.
 */

import { TUNING } from '../content/tuning';
import { GameEvents } from '../core/types';
import type { AttackDef, AttackShape, BossId, EnemyId, GameEventBus, HitInfo, ScreenId, Vec2 } from '../core/types';
import type { Random } from '../core/random';
import type { BossRunner } from './boss';
import type { PixelRect } from './corn';
import type { EnemyActor } from './enemies';
import { angleTo, distance } from './geometry';
import type { ProjectileSpawn } from './projectiles';

export interface CombineLane {
  readonly id: string;
  /** 'horizontal' passes run along x; the centre line is y = `at`. 'vertical' run along y; the centre line is x = `at`. */
  readonly axis: 'horizontal' | 'vertical';
  readonly at: number;
  /** Where the harvester starts and stops along the axis, px (may be off the arena edge). */
  readonly from: number;
  readonly to: number;
}

/** `BossPlacement.combine`. */
export interface CombinePlacement {
  /** Tag of the invulnerable harvester body (default 'harvester'). */
  readonly harvesterTag?: string;
  /** The cab lights: body tags and where each sits relative to the harvester's centre, px. */
  readonly lights: readonly { readonly tag: string; readonly offset: Vec2 }[];
  readonly lanes: readonly CombineLane[];
  /** Two escort drones start here. */
  readonly escortPoints: readonly Vec2[];
  readonly escortEnemy?: EnemyId;
  /** The slow end curve into the irrigation ditch: the harvester follows these points in order. */
  readonly ditchPath: readonly Vec2[];
}

export interface CombineHost {
  readonly bus: GameEventBus;
  readonly rng: Random;
  screenId(): ScreenId;
  playerPosition(): Vec2;
  playerTargetable(): boolean;
  hitPlayer(hit: Omit<HitInfo, 'targetInstanceId'>): boolean;
  pushPlayer(distancePx: number, angleDeg: number): void;
  spawnProjectile(spawn: ProjectileSpawn): void;
  cutCorn(area: PixelRect): void;
}

type Mode = 'idle' | 'plume' | 'passing' | 'ditching' | 'done';

const HARVESTER_HALF_LENGTH_FALLBACK = 24;

export class CombineDirector {
  private mode: Mode = 'idle';
  private ms = 0;
  private laneIdx = 0;
  private along = 0;
  private passHit = false;
  private passCooldownMs = 0;
  private baleCooldownMs = 0;
  private baleMarker: Vec2 | null = null;
  private baleMs = 0;
  private armed = false;
  private seenActive = false;
  private ditchIdx = 0;
  private readonly lightsOut = new Set<string>();

  constructor(
    readonly bossId: BossId,
    readonly placement: CombinePlacement,
    private readonly host: CombineHost,
  ) {}

  /** Lane being announced or driven, or null. For drawing the dust plume. */
  plumeLane(): CombineLane | null {
    return this.mode === 'plume' || this.mode === 'passing' ? (this.placement.lanes[this.laneIdx] ?? null) : null;
  }

  /** The next bale's shadow marker, if one is showing. */
  baleShadow(): Vec2 | null {
    return this.baleMarker;
  }

  get state(): Mode {
    return this.mode;
  }

  reset(): void {
    this.mode = 'idle';
    this.ms = 0;
    this.passHit = false;
    this.passCooldownMs = 0;
    this.baleCooldownMs = 0;
    this.baleMarker = null;
    this.armed = false;
    this.seenActive = false;
    this.ditchIdx = 0;
    this.lightsOut.clear();
  }

  /** Called once when the set piece starts: the lights ride the cab, the escort arrives. */
  start(boss: BossRunner): void {
    const h = this.harvester(boss);
    const first = this.placement.lanes[0];
    if (h && first) h.pos = this.pointOn(first, first.from);
    for (const l of this.placement.lights) {
      const a = boss.body(l.tag);
      if (a) a.aloftOverride = true;
    }
    this.syncLights(boss);
    const escort = this.placement.escortEnemy ?? 'drone';
    for (const pt of this.placement.escortPoints) boss.spawnAdd(escort, pt);
    this.seenActive = true;
  }

  private harvester(boss: BossRunner): EnemyActor | undefined {
    return boss.body(this.placement.harvesterTag ?? 'harvester');
  }

  private pointOn(lane: CombineLane, along: number): Vec2 {
    return lane.axis === 'horizontal' ? { x: along, y: lane.at } : { x: lane.at, y: along };
  }

  private syncLights(boss: BossRunner): void {
    const h = this.harvester(boss);
    if (!h) return;
    for (const l of this.placement.lights) {
      const a = boss.body(l.tag);
      if (a) a.pos = { x: h.pos.x + l.offset.x, y: h.pos.y + l.offset.y };
    }
  }

  private setLightsReachable(boss: BossRunner, reachable: boolean): void {
    for (const l of this.placement.lights) {
      const a = boss.body(l.tag);
      if (a) a.aloftOverride = !reachable;
    }
  }

  private emit(phase: 'plume' | 'pass' | 'passEnded' | 'baleMarker' | 'baleLanded' | 'lightOut' | 'ditching' | 'ditched' | 'caught', extra: { laneId?: string; tag?: string; position?: Vec2 } = {}): void {
    this.host.bus.emit(GameEvents.CombineChanged, { bossId: this.bossId, phase, ...extra });
  }

  tick(dtMs: number, boss: BossRunner): void {
    if (boss.active) this.seenActive = true;
    const h = this.harvester(boss);
    if (!h) return;
    // Lights going out.
    for (const l of this.placement.lights) {
      const a = boss.body(l.tag);
      if (a?.down && !this.lightsOut.has(l.tag)) {
        this.lightsOut.add(l.tag);
        this.emit('lightOut', { tag: l.tag, position: a.pos });
      }
    }
    if (boss.isComplete() && this.mode !== 'ditching' && this.mode !== 'done') {
      this.beginDitch(boss, h);
    }
    if (this.mode === 'ditching') {
      this.tickDitch(dtMs, boss, h);
      return;
    }
    if (this.mode === 'done' || !boss.active || boss.suspended) return;
    const phase = boss.phase;
    const pass = phase?.attacks.find((a) => a.id === 'pass');
    const bale = phase?.attacks.find((a) => a.id === 'bale');
    const mult = phase?.attackSpeedMultiplier ?? 1;
    if (!this.armed && pass) {
      this.armed = true;
      this.passCooldownMs = pass.cooldownMs / mult;
      this.baleCooldownMs = (bale?.cooldownMs ?? 0) / mult;
    }
    if (pass) this.tickPass(dtMs, boss, h, pass, mult);
    if (bale) this.tickBale(dtMs, h, bale, mult);
    this.syncLights(boss);
  }

  private tickPass(dtMs: number, boss: BossRunner, h: EnemyActor, pass: AttackDef, mult: number): void {
    const lanes = this.placement.lanes;
    if (lanes.length === 0) return;
    if (this.mode === 'idle') {
      this.passCooldownMs -= dtMs;
      if (this.passCooldownMs > 0) return;
      // The lane nearest Andrew: the plume is aimed at him, and a second and a half is the warning.
      const p = this.host.playerPosition();
      let best = 0;
      let bestD = Infinity;
      lanes.forEach((l, i) => {
        const d = Math.abs((l.axis === 'horizontal' ? p.y : p.x) - l.at);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      this.laneIdx = best;
      const lane = lanes[best] as CombineLane;
      h.pos = this.pointOn(lane, lane.from);
      this.mode = 'plume';
      this.ms = pass.telegraphMs / mult;
      this.emit('plume', { laneId: lane.id, position: h.pos });
      return;
    }
    const lane = lanes[this.laneIdx] as CombineLane;
    if (this.mode === 'plume') {
      this.ms -= dtMs;
      if (this.ms > 0) return;
      this.mode = 'passing';
      this.along = lane.from;
      this.passHit = false;
      this.setLightsReachable(boss, true);
      this.emit('pass', { laneId: lane.id });
      return;
    }
    if (this.mode === 'passing') {
      const dir = lane.to >= lane.from ? 1 : -1;
      const step = (TUNING.combat.chargeSpeed * dtMs) / 1000;
      const before = this.along;
      this.along = dir > 0 ? Math.min(lane.to, this.along + step) : Math.max(lane.to, this.along - step);
      h.pos = this.pointOn(lane, this.along);
      const width = pass.shape.kind === 'charge' ? pass.shape.width : 48;
      const a = Math.min(before, this.along) - HARVESTER_HALF_LENGTH_FALLBACK;
      const b = Math.max(before, this.along) + HARVESTER_HALF_LENGTH_FALLBACK;
      this.host.cutCorn(lane.axis === 'horizontal' ? { x: a, y: lane.at - width / 2, width: b - a, height: width } : { x: lane.at - width / 2, y: a, width, height: b - a });
      this.checkCaught(lane, h, pass, width);
      if (this.along === lane.to) {
        this.mode = 'idle';
        this.passCooldownMs = pass.cooldownMs / mult;
        this.setLightsReachable(boss, false);
        this.emit('passEnded', { laneId: lane.id });
      }
    }
  }

  private checkCaught(lane: CombineLane, h: EnemyActor, pass: AttackDef, width: number): void {
    if (this.passHit || !this.host.playerTargetable()) return;
    const p = this.host.playerPosition();
    const along = lane.axis === 'horizontal' ? p.x - h.pos.x : p.y - h.pos.y;
    const across = lane.axis === 'horizontal' ? p.y - h.pos.y : p.x - h.pos.x;
    const half = width / 2 + TUNING.player.bodyWidth / 2;
    if (Math.abs(across) > half || Math.abs(along) > HARVESTER_HALF_LENGTH_FALLBACK + TUNING.player.bodyWidth / 2) return;
    this.passHit = true;
    this.host.hitPlayer({ source: { kind: 'boss', bossId: this.bossId, attackId: pass.id }, amount: pass.damage, knockback: { x: 0, y: 0 }, stunMs: 0, holdMs: 0, weight: pass.weight ?? 'worst' });
    const neg = across < 0;
    const dist = half - Math.abs(across) + TUNING.player.bodyWidth;
    this.host.pushPlayer(dist, lane.axis === 'horizontal' ? (neg ? 270 : 90) : neg ? 180 : 0);
    this.emit('caught', { laneId: lane.id });
  }

  private tickBale(dtMs: number, h: EnemyActor, bale: AttackDef, mult: number): void {
    if (this.mode === 'passing') return;
    if (this.baleMarker) {
      this.baleMs -= dtMs;
      if (this.baleMs > 0) return;
      const target = this.baleMarker;
      this.baleMarker = null;
      this.baleCooldownMs = bale.cooldownMs / mult;
      const shape = bale.shape as Extract<AttackShape, { kind: 'projectile' }>;
      this.host.spawnProjectile({
        owner: 'enemy',
        source: { kind: 'boss', bossId: this.bossId, attackId: bale.id },
        screenId: this.host.screenId(),
        from: h.pos,
        angleDeg: angleTo(h.pos, target),
        aimPoint: target,
        shape,
        damage: bale.damage,
        knockback: bale.knockback,
        holdMs: bale.holdMs ?? 0,
        weight: bale.weight ?? 'ordinary',
        frame: 'bale',
      });
      this.emit('baleLanded', { position: target });
      return;
    }
    this.baleCooldownMs -= dtMs;
    if (this.baleCooldownMs > 0 || bale.shape.kind !== 'projectile') return;
    const p = this.host.playerPosition();
    // Inside the bale's range of the cab, else as far as it reaches toward him.
    const reach = bale.shape.range;
    const d = distance(h.pos, p);
    const t = d <= reach ? p : { x: h.pos.x + ((p.x - h.pos.x) * reach) / d, y: h.pos.y + ((p.y - h.pos.y) * reach) / d };
    this.baleMarker = { ...t };
    this.baleMs = bale.telegraphMs / mult;
    this.emit('baleMarker', { position: this.baleMarker });
  }

  private beginDitch(boss: BossRunner, h: EnemyActor): void {
    this.mode = this.seenActive ? 'ditching' : 'done';
    this.baleMarker = null;
    this.setLightsReachable(boss, false);
    const end = this.placement.ditchPath[this.placement.ditchPath.length - 1];
    if (!this.seenActive) {
      if (end) h.pos = { ...end };
      this.syncLights(boss);
      this.emit('ditched', end ? { position: end } : {});
      return;
    }
    this.ditchIdx = 0;
    this.emit('ditching', { position: h.pos });
  }

  private tickDitch(dtMs: number, boss: BossRunner, h: EnemyActor): void {
    const next = this.placement.ditchPath[this.ditchIdx];
    if (!next) {
      this.mode = 'done';
      this.emit('ditched', { position: h.pos });
      return;
    }
    const speed = TUNING.bosses[this.bossId].moveSpeed;
    const d = distance(h.pos, next);
    const step = (speed * dtMs) / 1000;
    if (d <= step) {
      h.pos = { ...next };
      this.ditchIdx += 1;
    } else {
      h.pos = { x: h.pos.x + ((next.x - h.pos.x) * step) / d, y: h.pos.y + ((next.y - h.pos.y) * step) / d };
    }
    this.syncLights(boss);
  }
}
