/**
 * The sheep puzzle (chapter 2, `c2.puzzle.sheep`, `PuzzleKind` 'sheepGates').
 * docs/chapters/02, beat 5: "Three gates each swing between two positions.
 * Sheep move away from Andrew and settle in whichever pen is open. Get the
 * flock into the far pen to clear the shed door." Plain TypeScript.
 *
 * The flock is a handful of live sheep on a tile area. A sheep within
 * `TUNING.overhaul.sheep.fleeRadius` of Andrew walks directly away from him
 * (sliding along walls) and stands still otherwise, so Andrew herds by where
 * he stands. Gates are sets of blocked tiles with two positions; E on a
 * gate's examinable swings it (`toggleGate`). The puzzle is solved when every
 * sheep has stood inside `targetPen` for `settleMs`.
 *
 * Unlike the keg puzzle, nothing resets it: a return to the bar leaves the
 * flock and the gates as Andrew left them (docs/chapters/README.md).
 */

import { TUNING } from '../content/tuning';
import { GameEvents } from '../core/types';
import { seededRandom } from '../core/random';
import type { Random } from '../core/random';
import type { GameEventBus, PuzzleDef, Reward, SheepTuning, SheepWanderTuning, TileCoord, TileGrid, Vec2 } from '../core/types';
import { distance, normalize, scale, sub } from './geometry';
import { moveBox, rectBlocked, tileCentre, TILE } from './grid';
import { PuzzleBase } from './investigation';
import type { SectionHost } from './sections';

/** A rectangle of whole tiles. */
export interface TileRect {
  readonly col: number;
  readonly row: number;
  readonly width: number;
  readonly height: number;
}

export interface SheepGateDef {
  readonly id: string;
  /** The tiles the gate blocks in position 0 and in position 1 (it swings between the two). */
  readonly positions: readonly [readonly TileCoord[], readonly TileCoord[]];
  /** Where it starts (default 0). */
  readonly start?: 0 | 1;
  /** Pressing E at this examinable swings the gate (`ChapterRun` wires it). */
  readonly examinableId?: string;
}

/** A pen the flock can settle in. */
export interface SheepPenDef extends TileRect {
  /** Named in `sheep:flockSettled`; default `pen<index>`. */
  readonly id?: string;
}

export interface SheepPuzzleLayout {
  /** Sheep stay inside this area (tiles). */
  readonly area: TileRect;
  readonly sheep: readonly { readonly id: string; readonly col: number; readonly row: number }[];
  readonly gates: readonly SheepGateDef[];
  /** The far pen: the flock must be inside it. */
  readonly targetPen: TileRect;
  /**
   * Every pen except the far one, for `sheep:flockSettled`. Absent: that event is never emitted.
   * The far pen does not need listing; settling in it solves the puzzle.
   */
  readonly pens?: readonly SheepPenDef[];
  /** Where `completeNow()` puts the sheep and the gates. */
  readonly solution: {
    readonly sheep: readonly { readonly id: string; readonly col: number; readonly row: number }[];
    readonly gates: Readonly<Record<string, 0 | 1>>;
  };
}

export interface LiveSheep {
  readonly id: string;
  pos: Vec2;
  /** Degrees; the way it last walked. */
  facingDeg: number;
  /** Walking this tick. */
  moving: boolean;
}

/** A sheep's wander: the wait until its next walk, and the walk under way. */
interface Wander {
  waitMs: number;
  walkMs: number;
  dir: Vec2;
}

export interface GateState {
  readonly id: string;
  readonly position: 0 | 1;
}

const rectOf = (r: TileRect): { x: number; y: number; width: number; height: number } => ({ x: r.col * TILE, y: r.row * TILE, width: r.width * TILE, height: r.height * TILE });

export class SheepPuzzle extends PuzzleBase {
  private flock: LiveSheep[];
  private wander = new Map<string, Wander>();
  private readonly gatePos = new Map<string, 0 | 1>();
  private penMs = 0;
  /** The pen the whole flock is standing in now, and for how long. */
  private settlingPen: string | null = null;
  private settlingMs = 0;
  /** The last pen announced, so the same pen is not announced twice running. */
  private lastSettled: string | null = null;
  /** Gate swings so far, for the player's own counting and tests. */
  gateChanges = 0;
  /** Called when a gate swings (sound). */
  onGate: ((id: string) => void) | null = null;
  /** Called whenever Andrew swings a gate or herds a sheep, so the run can make this the current section (also after a return to the bar). */
  onUse: (() => void) | null = null;

  constructor(
    def: PuzzleDef,
    readonly layout: SheepPuzzleLayout,
    private readonly grid: TileGrid,
    host: SectionHost,
    private readonly events: GameEventBus,
    reward?: Reward,
    private readonly tuning: SheepTuning | undefined = TUNING.overhaul?.sheep,
    private readonly wanderTuning: SheepWanderTuning | undefined = TUNING.overhaul?.sheepWander,
    private readonly rng: Random = seededRandom(0x5eed5),
  ) {
    super(def, host, events, reward);
    if (!this.tuning) throw new Error('TUNING.overhaul.sheep is missing');
    this.flock = layout.sheep.map((s) => ({ id: s.id, pos: tileCentre(s), facingDeg: 0, moving: false }));
    for (const g of layout.gates) this.gatePos.set(g.id, g.start ?? 0);
    for (const s of this.flock) this.wander.set(s.id, { waitMs: this.nextWait(), walkMs: 0, dir: { x: 0, y: 0 } });
  }

  private between(lo: number, hi: number): number {
    return lo + this.rng.next() * Math.max(0, hi - lo);
  }

  private nextWait(): number {
    const w = this.wanderTuning;
    return w ? this.between(w.intervalMsMin, w.intervalMsMax) : Infinity;
  }

  /** The pen (a listed pen or the far pen) a point is in, or null on open ground. */
  private penAt(p: Vec2): { x: number; y: number; width: number; height: number } | null {
    for (const r of [...(this.layout.pens ?? []), this.layout.targetPen].map(rectOf)) {
      if (p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height) return r;
    }
    return null;
  }

  /**
   * One sheep's wander, when Andrew is out of flee range: after a random wait it walks a short way at a random
   * angle, then stands again. It never leaves the pen it is in (a step that would is dropped and the walk ends).
   */
  private wanderStep(s: LiveSheep, dtMs: number, t: SheepTuning): void {
    const w = this.wanderTuning;
    const st = this.wander.get(s.id);
    if (!w || !st) return;
    if (st.walkMs <= 0) {
      st.waitMs -= dtMs;
      if (st.waitMs > 0) return;
      const a = this.rng.next() * Math.PI * 2;
      st.dir = { x: Math.cos(a), y: Math.sin(a) };
      st.walkMs = this.between(w.walkMsMin, w.walkMsMax);
    }
    st.walkMs -= dtMs;
    if (st.walkMs <= 0) st.waitMs = this.nextWait();
    const pen = this.penAt(s.pos);
    const before = s.pos;
    const to = moveBox(this.grid, s.pos, t.bodySize, t.bodySize, scale(st.dir, (w.speed * dtMs) / 1000), this.tileBlocked).position;
    const inside = (p: Vec2): boolean => pen === null || (p.x >= pen.x && p.x < pen.x + pen.width && p.y >= pen.y && p.y < pen.y + pen.height);
    if (!inside(to) || distance(before, to) <= 0.01) {
      // Hit the pen wall or a gate: the walk ends here.
      st.walkMs = 0;
      st.waitMs = this.nextWait();
      return;
    }
    s.pos = to;
    s.moving = true;
    s.facingDeg = (Math.atan2(st.dir.y, st.dir.x) * 180) / Math.PI;
  }

  /** Every tile any gate blocks in either position: the gateways. A sheep does not rest on one. */
  private gatewayTiles(): Set<number> {
    const set = new Set<number>();
    for (const g of this.layout.gates) for (const pos of g.positions) for (const c of pos) set.add(c.row * 4096 + c.col);
    return set;
  }

  private bodyRect(p: Vec2): { x: number; y: number; width: number; height: number } {
    const b = (this.tuning as SheepTuning).bodySize;
    return { x: p.x - b / 2, y: p.y - b / 2, width: b, height: b };
  }

  /** Whether the sheep's body at `p` touches a wall, the area's edge or a closed gate. */
  private bodyBlocked(p: Vec2): boolean {
    return rectBlocked(this.grid, this.bodyRect(p), this.tileBlocked);
  }

  /** Whether the sheep's body at `p` touches a gateway tile (open or shut). */
  private inGateway(p: Vec2): boolean {
    const r = this.bodyRect(p);
    const gw = this.gatewayTiles();
    for (let row = Math.floor(r.y / TILE); row <= Math.floor((r.y + r.height - 0.001) / TILE); row++) {
      for (let col = Math.floor(r.x / TILE); col <= Math.floor((r.x + r.width - 0.001) / TILE); col++) {
        if (gw.has(row * 4096 + col)) return true;
      }
    }
    return false;
  }

  /** The nearest tile centre where a sheep body is clear of walls, gates and gateways, or null. */
  private nearestClear(from: Vec2): Vec2 | null {
    const c0 = Math.floor(from.x / TILE);
    const r0 = Math.floor(from.y / TILE);
    let best: Vec2 | null = null;
    let bestD = Infinity;
    for (let dr = -4; dr <= 4; dr++) {
      for (let dc = -4; dc <= 4; dc++) {
        const p = tileCentre({ col: c0 + dc, row: r0 + dr });
        if (this.bodyBlocked(p) || this.inGateway(p)) continue;
        const d = distance(from, p);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
    }
    return best;
  }

  /** Move a sheep to the nearest clear spot (the nearer side of the gate). */
  private nudgeOut(s: LiveSheep): void {
    const to = this.nearestClear(s.pos);
    if (to) s.pos = to;
  }

  /**
   * A sheep standing in a gateway walks out to the nearer side instead of resting there (so a gate can always
   * close). True while it is doing so.
   */
  private leaveGateway(s: LiveSheep, dtMs: number): boolean {
    if (!this.inGateway(s.pos)) return false;
    const to = this.nearestClear(s.pos);
    if (!to) return false;
    const t = this.tuning as SheepTuning;
    const dir = normalize(sub(to, s.pos));
    const step = Math.min(distance(to, s.pos), (t.speed * dtMs) / 1000);
    const next = moveBox(this.grid, s.pos, t.bodySize, t.bodySize, scale(dir, step), this.tileBlocked).position;
    if (distance(next, s.pos) <= 0.01) return false;
    s.pos = next;
    s.moving = true;
    s.facingDeg = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
    return true;
  }

  sheep(): readonly LiveSheep[] {
    return this.flock;
  }

  gates(): readonly GateState[] {
    return this.layout.gates.map((g) => ({ id: g.id, position: this.gatePos.get(g.id) ?? 0 }));
  }

  gatePosition(id: string): 0 | 1 | null {
    return this.gatePos.get(id) ?? null;
  }

  /** The gate bound to an examinable, if any. */
  gateFor(examinableId: string): SheepGateDef | undefined {
    return this.layout.gates.find((g) => g.examinableId === examinableId);
  }

  /** Whether a gate blocks tile (`col`, `row`) in its current position. */
  blocks(col: number, row: number): boolean {
    for (const g of this.layout.gates) {
      const pos = this.gatePos.get(g.id) ?? 0;
      if (g.positions[pos].some((t) => t.col === col && t.row === row)) return true;
    }
    return false;
  }

  /** The tiles a sheep or Andrew may not enter: gates, and everything outside the area. */
  private tileBlocked = (col: number, row: number): boolean => {
    const a = this.layout.area;
    if (col < a.col || row < a.row || col >= a.col + a.width || row >= a.row + a.height) return true;
    return this.blocks(col, row);
  };

  /**
   * Swing a gate to its other position. Refused (false) if Andrew at `playerPos` is standing on a tile the gate
   * would close. A sheep in the way is nudged out to the nearer side, never a reason to refuse.
   *
   * The gates still swing once the puzzle is finished (playtest 7): the flock is penned for good by then, and
   * Andrew has to open his own way back out of the far pens.
   */
  toggleGate(id: string, playerPos?: Vec2): boolean {
    const g = this.layout.gates.find((x) => x.id === id);
    if (!g) return false;
    const to: 0 | 1 = (this.gatePos.get(id) ?? 0) === 0 ? 1 : 0;
    const closing = g.positions[to];
    const occupied = (p: Vec2): boolean => closing.some((t) => Math.floor(p.x / TILE) === t.col && Math.floor(p.y / TILE) === t.row);
    if (playerPos !== undefined && occupied(playerPos)) return false;
    if (!this.isComplete()) this.markUsed();
    this.gatePos.set(id, to);
    for (const s of this.flock) if (this.bodyBlocked(s.pos)) this.nudgeOut(s);
    this.gateChanges++;
    this.onGate?.(id);
    return true;
  }

  private markUsed(): void {
    this.start();
    this.onUse?.();
  }

  /** Whether every sheep is inside the far pen right now. */
  flockPenned(): boolean {
    const pen = rectOf(this.layout.targetPen);
    return this.flock.every((s) => s.pos.x >= pen.x && s.pos.x < pen.x + pen.width && s.pos.y >= pen.y && s.pos.y < pen.y + pen.height);
  }

  /** The id of the listed pen that holds every sheep, or null if the flock is split or outside the listed pens. */
  penOfFlock(): string | null {
    const pens = this.layout.pens ?? [];
    for (let i = 0; i < pens.length; i++) {
      const pen = pens[i] as SheepPenDef;
      const r = rectOf(pen);
      if (this.flock.length > 0 && this.flock.every((s) => s.pos.x >= r.x && s.pos.x < r.x + r.width && s.pos.y >= r.y && s.pos.y < r.y + r.height)) return pen.id ?? `pen${i}`;
    }
    return null;
  }

  /** One tick. The flock shies from Andrew; the puzzle is solved once it has stayed in the far pen long enough. */
  update(dtMs: number, playerPos: Vec2): void {
    if (this.isComplete()) return;
    const t = this.tuning as SheepTuning;
    for (const s of this.flock) {
      s.moving = false;
      // Never stalled for good: a body wedged in a blocked tile (a gate swung onto it) is lifted out.
      if (this.bodyBlocked(s.pos)) this.nudgeOut(s);
      const away = sub(s.pos, playerPos);
      if (distance(s.pos, playerPos) >= t.fleeRadius) {
        if (!this.leaveGateway(s, dtMs)) this.wanderStep(s, dtMs, t);
        continue;
      }
      // Fleeing wins over a wander: drop the walk and wait afresh.
      const wd = this.wander.get(s.id);
      if (wd) {
        wd.walkMs = 0;
        wd.waitMs = this.nextWait();
      }
      const dir = normalize(away);
      if (dir.x === 0 && dir.y === 0) continue;
      const before = s.pos;
      s.pos = moveBox(this.grid, s.pos, t.bodySize, t.bodySize, scale(dir, (t.speed * dtMs) / 1000), this.tileBlocked).position;
      s.moving = distance(before, s.pos) > 0.01;
      if (s.moving) {
        s.facingDeg = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
        this.markUsed();
      }
    }
    if (this.flockPenned()) {
      this.penMs += dtMs;
      if (this.penMs >= t.settleMs) this.solved();
    } else this.penMs = 0;
    this.trackSettled(dtMs, t.settleMs);
  }

  private trackSettled(dtMs: number, settleMs: number): void {
    const pen = this.layout.pens ? this.penOfFlock() : null;
    if (pen !== this.settlingPen) {
      this.settlingPen = pen;
      this.settlingMs = 0;
    }
    if (pen === null) return;
    this.settlingMs += dtMs;
    if (this.settlingMs >= settleMs && pen !== this.lastSettled) {
      this.lastSettled = pen;
      this.events.emit(GameEvents.SheepFlockSettled, { puzzleId: this.def.id, pen });
    }
  }

  protected applySolution(): void {
    const byId = new Map(this.layout.solution.sheep.map((s) => [s.id, s]));
    this.flock = this.layout.sheep.map((s) => {
      const to = byId.get(s.id) ?? s;
      return { id: s.id, pos: tileCentre(to), facingDeg: 0, moving: false };
    });
    for (const g of this.layout.gates) this.gatePos.set(g.id, this.layout.solution.gates[g.id] ?? this.gatePos.get(g.id) ?? 0);
  }
}
