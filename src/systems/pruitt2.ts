/**
 * Chapter 8 boss: Agent Pruitt, round two (`c8.boss.pruitt2`). Pruitt's body keeps the paired taser darts (`darts`,
 * burst 2) through the normal enemy AI. This director plays the rest of his attacks:
 *
 * - Flashbang: a ground marker lands on Andrew's spot for the attack's telegraph (1 s), then bursts. If Andrew is inside
 *   it the screen whites out for `pruitt2.whiteoutMs` (`whiteoutAlpha()`; no meter hit). Event `pruitt:changed`.
 * - Barrier arm: the nearest marked line (`Pruitt2Placement.barrierLines`) is lit for the telegraph, then the arm drops on
 *   it: a heavy hit if Andrew is on the line. It stays down `pruitt2.barrierDownMs`, then lifts.
 * - Phase `truck` (60% health): every `truckPass` cooldown (12 s) the lit path (`Pruitt2Placement.truckPath`) is marked,
 *   then a patrol truck drives it in `pruitt2.truckTravelMs`: a worst hit on contact.
 * - The end (40% health, or a Myko call): `BossDef.letThrough`: he stops, he is not knocked down. `end()` clears every
 *   marker and emits `pruitt:changed` `letThrough`; the chapter script plays the watch, the barrier and the lanyard.
 *
 * Numbers: attacks and phases in `TUNING.bosses['c8.boss.pruitt2']`, the rest in `TUNING.overhaul.pruitt2`.
 * Pure TypeScript; nothing is saved, a started boss starts again.
 */

import { TUNING } from '../content/tuning';
import { GameEvents } from '../core/types';
import type { AttackDef, BossId, CompletionSource, GameEventBus, HitInfo, Vec2 } from '../core/types';
import type { BossRunner } from './boss';
import { add, angleTo, distance, distanceToSegment, normalize, scale, sub } from './geometry';

export interface BarrierLine {
  readonly id: string;
  /** The two ends of the marked line the arm drops along, px. */
  readonly from: Vec2;
  readonly to: Vec2;
}

export interface TruckPath {
  /** Where the truck enters and leaves, px (may be off the screen edge). */
  readonly from: Vec2;
  readonly to: Vec2;
  /** Width of the lit path, px. */
  readonly width: number;
}

export interface Pruitt2Placement {
  /** Tag of Pruitt's body (default 'pruitt'). */
  readonly tag?: string;
  readonly barrierLines: readonly BarrierLine[];
  readonly truckPath: TruckPath;
}

export interface Pruitt2Host {
  readonly bus: GameEventBus;
  playerPosition(): Vec2;
  playerTargetable(): boolean;
  hitPlayer(hit: Omit<HitInfo, 'targetInstanceId'>): boolean;
}

export interface Pruitt2View {
  readonly flash: { readonly spot: Vec2; readonly radius: number; readonly state: 'lit' | 'burst' } | null;
  readonly barrier: { readonly line: BarrierLine; readonly width: number; readonly state: 'lit' | 'down' } | null;
  readonly truck: { readonly path: TruckPath; readonly state: 'lit' | 'passing'; readonly pos: Vec2; readonly angleDeg: number } | null;
  /** 0..1 for the white overlay; 1 for the first part then fading out. */
  readonly whiteout: number;
  /** He has stopped. */
  readonly stopped: boolean;
}

/** The truck is this long, px: contact is the band plus this half-length along the path. */
const TRUCK_HALF_LENGTH = 24;
const BURST_SHOWN_MS = 250;

export class Pruitt2Director {
  private flash = { state: 'idle' as 'idle' | 'lit' | 'burst', ms: 0, cd: 0, spot: { x: 0, y: 0 } };
  private barrier = { state: 'idle' as 'idle' | 'lit' | 'down', ms: 0, cd: 0, line: undefined as BarrierLine | undefined };
  private truck = { state: 'idle' as 'idle' | 'lit' | 'passing', ms: 0, cd: 0, hit: false, armed: false };
  private armed = false;
  private whiteLeft = 0;
  private stopped = false;

  constructor(
    readonly bossId: BossId,
    readonly placement: Pruitt2Placement,
    private readonly host: Pruitt2Host,
  ) {}

  reset(): void {
    this.flash = { state: 'idle', ms: 0, cd: 0, spot: { x: 0, y: 0 } };
    this.barrier = { state: 'idle', ms: 0, cd: 0, line: undefined };
    this.truck = { state: 'idle', ms: 0, cd: 0, hit: false, armed: false };
    this.armed = false;
    this.whiteLeft = 0;
    this.stopped = false;
  }

  /** The boss ended (health at 40%, or a Myko call): everything stops. */
  end(_by: CompletionSource): void {
    if (this.stopped) return;
    this.reset();
    this.stopped = true;
    this.host.bus.emit(GameEvents.PruittChanged, { bossId: this.bossId, phase: 'letThrough' });
  }

  /** 0..1: the white overlay over the screen. */
  whiteoutAlpha(): number {
    const total = TUNING.overhaul?.pruitt2?.whiteoutMs ?? 0;
    if (this.whiteLeft <= 0 || total <= 0) return 0;
    const f = this.whiteLeft / total;
    return f > 0.3 ? 1 : f / 0.3;
  }

  view(boss: BossRunner | null): Pruitt2View {
    const t = TUNING.overhaul?.pruitt2;
    const flashAtk = this.attack(boss, 'flashbang');
    const flash =
      this.flash.state !== 'idle' && flashAtk && flashAtk.shape.kind === 'circle'
        ? { spot: this.flash.spot, radius: flashAtk.shape.radius, state: this.flash.state }
        : null;
    const barrier = this.barrier.state !== 'idle' && this.barrier.line && t ? { line: this.barrier.line, width: t.barrierWidthPx, state: this.barrier.state } : null;
    let truck: Pruitt2View['truck'] = null;
    if (this.truck.state !== 'idle' && t) {
      const p = this.placement.truckPath;
      const f = this.truck.state === 'passing' ? Math.min(1, this.truck.ms / t.truckTravelMs) : 0;
      truck = { path: p, state: this.truck.state, pos: add(p.from, scale(sub(p.to, p.from), f)), angleDeg: angleTo(p.from, p.to) };
    }
    return { flash, barrier, truck, whiteout: this.whiteoutAlpha(), stopped: this.stopped };
  }

  tick(dtMs: number, boss: BossRunner | null, active: boolean): void {
    if (this.whiteLeft > 0) this.whiteLeft = Math.max(0, this.whiteLeft - dtMs);
    const t = TUNING.overhaul?.pruitt2;
    if (!boss || !active || !t || this.stopped) return;
    const body = boss.body(this.placement.tag ?? 'pruitt');
    if (!body || body.down) return;
    const phase = boss.phase;
    const mult = phase?.attackSpeedMultiplier ?? 1;
    const flashAtk = this.attack(boss, 'flashbang');
    const barrierAtk = this.attack(boss, 'barrier');
    const truckAtk = phase?.attacks.find((a) => a.id === 'truckPass');
    if (!this.armed) {
      this.armed = true;
      this.flash.cd = (flashAtk?.cooldownMs ?? 0) / mult;
      this.barrier.cd = (barrierAtk?.cooldownMs ?? 0) / mult;
    }
    if (truckAtk && !this.truck.armed) {
      this.truck.armed = true;
      this.truck.cd = truckAtk.cooldownMs / mult;
    }
    const stunned = body.status === 'stunned';
    const player = this.host.playerPosition();
    const targetable = this.host.playerTargetable();
    // The marker phases of an attack already begun run on even if he is stunned; only starting a new one waits.
    if (flashAtk) this.tickFlash(dtMs, flashAtk, mult, player, targetable, !stunned && this.barrier.state === 'idle');
    if (barrierAtk) this.tickBarrier(dtMs, barrierAtk, t, mult, player, targetable, !stunned && this.flash.state === 'idle');
    if (truckAtk) this.tickTruck(dtMs, truckAtk, t, mult, player, targetable);
  }

  // -------------------------------------------------------------------------

  private attack(boss: BossRunner | null, id: string): AttackDef | undefined {
    return boss?.phase?.attacks.find((a) => a.id === id) ?? boss?.def.phases.flatMap((p) => p.attacks).find((a) => a.id === id);
  }

  private tickFlash(dtMs: number, atk: AttackDef, mult: number, player: Vec2, targetable: boolean, canStart: boolean): void {
    const f = this.flash;
    const radius = atk.shape.kind === 'circle' ? atk.shape.radius : 0;
    switch (f.state) {
      case 'idle':
        f.cd -= dtMs;
        if (f.cd <= 0 && targetable && canStart) {
          f.state = 'lit';
          f.ms = atk.telegraphMs / mult;
          f.spot = { ...player };
          this.host.bus.emit(GameEvents.PruittChanged, { bossId: this.bossId, phase: 'flashLit' });
        }
        break;
      case 'lit':
        f.ms -= dtMs;
        if (f.ms <= 0) {
          f.state = 'burst';
          f.ms = BURST_SHOWN_MS;
          this.host.bus.emit(GameEvents.PruittChanged, { bossId: this.bossId, phase: 'flash' });
          if (targetable && distance(player, f.spot) <= radius) {
            this.whiteLeft = TUNING.overhaul?.pruitt2?.whiteoutMs ?? 0;
            this.host.bus.emit(GameEvents.PruittChanged, { bossId: this.bossId, phase: 'whiteout' });
          }
        }
        break;
      case 'burst':
        f.ms -= dtMs;
        if (f.ms <= 0) {
          f.state = 'idle';
          f.cd = atk.cooldownMs / mult;
        }
        break;
    }
  }

  private tickBarrier(dtMs: number, atk: AttackDef, t: NonNullable<NonNullable<typeof TUNING.overhaul>['pruitt2']>, mult: number, player: Vec2, targetable: boolean, canStart: boolean): void {
    const b = this.barrier;
    switch (b.state) {
      case 'idle': {
        b.cd -= dtMs;
        if (b.cd <= 0 && targetable && canStart && this.placement.barrierLines.length > 0) {
          b.line = [...this.placement.barrierLines].sort((x, y) => distanceToSegment(player, x.from, x.to) - distanceToSegment(player, y.from, y.to))[0];
          b.state = 'lit';
          b.ms = atk.telegraphMs / mult;
          this.host.bus.emit(GameEvents.PruittChanged, { bossId: this.bossId, phase: 'barrierLit' });
        }
        break;
      }
      case 'lit': {
        b.ms -= dtMs;
        if (b.ms > 0 || !b.line) break;
        b.state = 'down';
        b.ms = t.barrierDownMs;
        this.host.bus.emit(GameEvents.PruittChanged, { bossId: this.bossId, phase: 'barrierDown' });
        if (targetable && distanceToSegment(player, b.line.from, b.line.to) <= t.barrierWidthPx / 2 + TUNING.combat.characterHitRadius) {
          const across = normalize({ x: -(b.line.to.y - b.line.from.y), y: b.line.to.x - b.line.from.x });
          const side = (player.x - b.line.from.x) * across.x + (player.y - b.line.from.y) * across.y >= 0 ? 1 : -1;
          this.host.hitPlayer({
            source: { kind: 'boss', bossId: this.bossId, attackId: atk.id },
            amount: atk.damage,
            knockback: scale(across, side * atk.knockback),
            stunMs: 0,
            holdMs: 0,
            weight: atk.weight ?? 'heavy',
          });
        }
        break;
      }
      case 'down':
        b.ms -= dtMs;
        if (b.ms <= 0) {
          b.state = 'idle';
          b.cd = atk.cooldownMs / mult;
          this.host.bus.emit(GameEvents.PruittChanged, { bossId: this.bossId, phase: 'barrierUp' });
        }
        break;
    }
  }

  private tickTruck(dtMs: number, atk: AttackDef, t: NonNullable<NonNullable<typeof TUNING.overhaul>['pruitt2']>, mult: number, player: Vec2, targetable: boolean): void {
    const k = this.truck;
    const path = this.placement.truckPath;
    switch (k.state) {
      case 'idle':
        k.cd -= dtMs;
        if (k.cd <= 0) {
          k.state = 'lit';
          k.ms = atk.telegraphMs / mult;
          k.hit = false;
          this.host.bus.emit(GameEvents.PruittChanged, { bossId: this.bossId, phase: 'truckLit' });
        }
        break;
      case 'lit':
        k.ms -= dtMs;
        if (k.ms <= 0) {
          k.state = 'passing';
          k.ms = 0;
          this.host.bus.emit(GameEvents.PruittChanged, { bossId: this.bossId, phase: 'truckPass' });
        }
        break;
      case 'passing': {
        k.ms += dtMs;
        const f = Math.min(1, k.ms / t.truckTravelMs);
        const pos = add(path.from, scale(sub(path.to, path.from), f));
        if (!k.hit && targetable) {
          const dir = normalize(sub(path.to, path.from));
          const rel = sub(player, pos);
          const along = rel.x * dir.x + rel.y * dir.y;
          const across = Math.abs(-rel.x * dir.y + rel.y * dir.x);
          if (Math.abs(along) <= TRUCK_HALF_LENGTH + TUNING.combat.characterHitRadius && across <= path.width / 2 + TUNING.combat.characterHitRadius) {
            k.hit = this.host.hitPlayer({
              source: { kind: 'boss', bossId: this.bossId, attackId: atk.id },
              amount: atk.damage,
              knockback: scale(normalize({ x: -dir.y, y: dir.x }), atk.knockback * (rel.x * -dir.y + rel.y * dir.x >= 0 ? 1 : -1)),
              stunMs: 0,
              holdMs: 0,
              weight: atk.weight ?? 'worst',
            });
          }
        }
        if (f >= 1) {
          k.state = 'idle';
          k.cd = atk.cooldownMs / mult - atk.telegraphMs / mult - t.truckTravelMs;
          if (k.cd < 0) k.cd = 0;
        }
        break;
      }
    }
  }
}
