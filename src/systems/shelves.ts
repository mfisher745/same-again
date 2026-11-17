/**
 * Chapter 5, Agent Pruitt round one: the rolling shelves. Pruitt works a hand crank; the floor rails of the lane (or
 * lanes) light for the `shelf` attack's telegraph (1 s), then a shelf slides shut across it. Anyone still in the lane
 * is caught between shelves: a heavy hit (`shelf` weight) and a push out along the lane. Phase 2 cranks two shelves
 * at once, each closing a pair of adjacent lanes, so one of the five lanes stays safe.
 *
 * The numbers: telegraph, cooldown, burst and weight come from the boss's `shelf` attack; the slide, the closed time,
 * the push and the lanes per shelf come from `TUNING.overhaul.shelves`. Pure TypeScript; the run feeds it Andrew.
 */

import { TUNING } from '../content/tuning';
import { GameEvents } from '../core/types';
import type { AttackDef, BossId, BossPhaseDef, GameEventBus, HitInfo, HitWeight, Vec2 } from '../core/types';
import type { Random } from '../core/random';

export interface ShelfLane {
  readonly id: string;
  /** The aisle, in screen pixels: the area a closing shelf sweeps and that catches Andrew. */
  readonly area: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** Which way the shelf slides across the aisle. */
  readonly travel: 'left' | 'right' | 'up' | 'down';
}

/** `BossPlacement.shelves`. Lanes are listed in order, neighbours adjacent (five in chapter 5). */
export interface ShelfArenaPlacement {
  readonly lanes: readonly ShelfLane[];
  /** The chapter draws the units and rails itself (as props it slides); the world view then draws nothing for them. */
  readonly drawnByChapter?: boolean;
}

export interface ShelfHost {
  readonly bus: GameEventBus;
  readonly rng: Random;
  playerPosition(): Vec2;
  playerTargetable(): boolean;
  /** Returns true if the hit landed. */
  hitPlayer(hit: Omit<HitInfo, 'targetInstanceId'>): boolean;
  /** Moves Andrew up to `distancePx` along `angleDeg`, stopping at walls. */
  pushPlayer(distancePx: number, angleDeg: number): void;
}

type LaneState = 'open' | 'lit' | 'closing' | 'closed';

interface LaneRun {
  state: LaneState;
  ms: number;
  caught: boolean;
}

/** Windows of `size` adjacent lanes, `count` of them, no two sharing a lane. */
export function shelfGroupings(lanes: number, size: number, count: number): number[][][] {
  const out: number[][][] = [];
  const rec = (from: number, acc: number[][]): void => {
    if (acc.length === count) {
      out.push(acc);
      return;
    }
    for (let s = from; s + size <= lanes; s++) rec(s + size, [...acc, Array.from({ length: size }, (_, i) => s + i)]);
  };
  rec(0, []);
  return out;
}

export class ShelfDirector {
  private readonly runs: LaneRun[];
  private cooldownMs = 0;
  private armed = false;

  constructor(
    readonly bossId: BossId,
    readonly placement: ShelfArenaPlacement,
    private readonly host: ShelfHost,
  ) {
    this.runs = placement.lanes.map(() => ({ state: 'open' as LaneState, ms: 0, caught: false }));
  }

  /** The state of each lane, for drawing: lit rails, a sliding shelf (`progress` 0..1) or a shut lane. */
  laneStates(): readonly { readonly lane: ShelfLane; readonly state: LaneState; readonly progress: number }[] {
    const slide = TUNING.overhaul?.shelves?.slideMs ?? 1;
    return this.placement.lanes.map((lane, i) => {
      const r = this.runs[i] as LaneRun;
      return { lane, state: r.state, progress: r.state === 'closing' ? Math.min(1, r.ms / slide) : r.state === 'closed' ? 1 : 0 };
    });
  }

  /** Index of the lane Andrew is in, or the nearest by centre. */
  laneOf(pos: Vec2): number {
    let best = 0;
    let bestD = Infinity;
    this.placement.lanes.forEach((l, i) => {
      const a = l.area;
      if (pos.x >= a.x && pos.x <= a.x + a.width && pos.y >= a.y && pos.y <= a.y + a.height) {
        best = i;
        bestD = -1;
      } else if (bestD >= 0) {
        const d = Math.hypot(pos.x - (a.x + a.width / 2), pos.y - (a.y + a.height / 2));
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    });
    return best;
  }

  /** Everything open again (a return to the bar, or the boss over). */
  reset(): void {
    for (const r of this.runs) {
      r.state = 'open';
      r.ms = 0;
      r.caught = false;
    }
    this.cooldownMs = 0;
    this.armed = false;
  }

  /** Cranks now: `groups` are lane indices that close together. Normally the director picks them itself. */
  crank(groups: readonly (readonly number[])[], phaseMult = 1, telegraphMs?: number): void {
    const tel = (telegraphMs ?? 1000) / phaseMult;
    const ids: string[] = [];
    for (const g of groups) {
      for (const i of g) {
        const r = this.runs[i];
        if (!r || r.state !== 'open') continue;
        r.state = 'lit';
        r.ms = -tel;
        r.caught = false;
        ids.push((this.placement.lanes[i] as ShelfLane).id);
      }
    }
    if (ids.length > 0) this.host.bus.emit(GameEvents.ShelvesChanged, { bossId: this.bossId, phase: 'lit', laneIds: ids });
  }

  /** Picks which lanes the next crank closes for this phase. */
  chooseGroups(phase: BossPhaseDef, attack: AttackDef): number[][] {
    const n = this.placement.lanes.length;
    const size = Math.max(1, TUNING.overhaul?.shelves?.lanesPerShelfByPhase[phase.id] ?? 1);
    const count = Math.max(1, attack.burst ?? 1);
    const mine = this.laneOf(this.host.playerPosition());
    const all = shelfGroupings(n, size, count);
    const covering = all.filter((g) => g.some((w) => w.includes(mine)));
    const pool = covering.length > 0 ? covering : all;
    if (pool.length === 0) return [[mine]];
    return pool[Math.floor(this.host.rng.next() * pool.length)] as number[][];
  }

  /** Advance. `phase` is the boss's current phase; `active` is false when the boss is not running. */
  tick(dtMs: number, phase: BossPhaseDef | null, active: boolean): void {
    const t = TUNING.overhaul?.shelves;
    if (!t) return;
    if (!active || !phase) {
      if (this.runs.some((r) => r.state !== 'open')) this.reset();
      return;
    }
    const attack = phase.attacks.find((a) => a.id === 'shelf');
    if (!attack) return;
    const mult = phase.attackSpeedMultiplier;
    if (!this.armed) {
      this.armed = true;
      this.cooldownMs = attack.cooldownMs / mult;
    }
    // Lanes.
    const opened: string[] = [];
    const closing: string[] = [];
    const closed: string[] = [];
    this.runs.forEach((r, i) => {
      const lane = this.placement.lanes[i] as ShelfLane;
      if (r.state === 'open') return;
      r.ms += dtMs;
      if (r.state === 'lit' && r.ms >= 0) {
        r.state = 'closing';
        r.ms = 0;
        closing.push(lane.id);
      }
      if (r.state === 'closing' && r.ms >= t.slideMs) {
        r.state = 'closed';
        r.ms = 0;
        closed.push(lane.id);
      }
      if (r.state === 'closing' || r.state === 'closed') this.checkCaught(lane, r, attack, t.slideMs, t.pushOutPx);
      if (r.state === 'closed' && r.ms >= t.closedMs) {
        r.state = 'open';
        r.ms = 0;
        opened.push(lane.id);
      }
    });
    const emit = (p: 'closing' | 'closed' | 'open', ids: string[]): void => {
      if (ids.length > 0) this.host.bus.emit(GameEvents.ShelvesChanged, { bossId: this.bossId, phase: p, laneIds: ids });
    };
    emit('closing', closing);
    emit('closed', closed);
    emit('open', opened);
    // Next crank once everything is open and the cooldown has run.
    this.cooldownMs -= dtMs;
    if (this.cooldownMs <= 0 && this.runs.every((r) => r.state === 'open')) {
      this.crank(this.chooseGroups(phase, attack), mult, attack.telegraphMs);
      this.cooldownMs = attack.cooldownMs / mult;
    }
  }

  private checkCaught(lane: ShelfLane, r: LaneRun, attack: AttackDef, slideMs: number, pushOutPx: number): void {
    if (!this.host.playerTargetable()) return;
    const p = this.host.playerPosition();
    const a = lane.area;
    if (p.x < a.x || p.x > a.x + a.width || p.y < a.y || p.y > a.y + a.height) return;
    const f = r.state === 'closed' ? 1 : Math.min(1, r.ms / slideMs);
    // Has the shelf's front passed him along its travel?
    let passed: boolean;
    switch (lane.travel) {
      case 'right':
        passed = p.x <= a.x + f * a.width;
        break;
      case 'left':
        passed = p.x >= a.x + a.width - f * a.width;
        break;
      case 'down':
        passed = p.y <= a.y + f * a.height;
        break;
      case 'up':
        passed = p.y >= a.y + a.height - f * a.height;
        break;
    }
    if (!passed) return;
    if (!r.caught) {
      r.caught = true;
      const weight: HitWeight = attack.weight ?? 'heavy';
      this.host.hitPlayer({ source: { kind: 'boss', bossId: this.bossId, attackId: attack.id }, amount: attack.damage, knockback: { x: 0, y: 0 }, stunMs: 0, holdMs: 0, weight });
      this.host.bus.emit(GameEvents.ShelvesChanged, { bossId: this.bossId, phase: 'caught', laneIds: [lane.id] });
    }
    // Out along the lane's long axis, to the nearer end.
    if (a.height >= a.width) {
      const up = p.y - a.y < a.y + a.height - p.y;
      this.host.pushPlayer((up ? p.y - a.y : a.y + a.height - p.y) + pushOutPx, up ? 270 : 90);
    } else {
      const left = p.x - a.x < a.x + a.width - p.x;
      this.host.pushPlayer((left ? p.x - a.x : a.x + a.width - p.x) + pushOutPx, left ? 180 : 0);
    }
  }
}
