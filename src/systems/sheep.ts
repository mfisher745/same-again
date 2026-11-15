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
import type { GameEventBus, PuzzleDef, Reward, SheepTuning, TileCoord, TileGrid, Vec2 } from '../core/types';
import { distance, normalize, scale, sub } from './geometry';
import { moveBox, tileCentre, TILE } from './grid';
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

export interface GateState {
  readonly id: string;
  readonly position: 0 | 1;
}

const rectOf = (r: TileRect): { x: number; y: number; width: number; height: number } => ({ x: r.col * TILE, y: r.row * TILE, width: r.width * TILE, height: r.height * TILE });

export class SheepPuzzle extends PuzzleBase {
  private flock: LiveSheep[];
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
  ) {
    super(def, host, events, reward);
    if (!this.tuning) throw new Error('TUNING.overhaul.sheep is missing');
    this.flock = layout.sheep.map((s) => ({ id: s.id, pos: tileCentre(s), facingDeg: 0, moving: false }));
    for (const g of layout.gates) this.gatePos.set(g.id, g.start ?? 0);
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
   * Swing a gate to its other position. Refused (false) if a sheep, or Andrew at `playerPos`, is standing on a
   * tile the gate would close, or the puzzle is finished.
   */
  toggleGate(id: string, playerPos?: Vec2): boolean {
    const g = this.layout.gates.find((x) => x.id === id);
    if (!g || this.isComplete()) return false;
    const to: 0 | 1 = (this.gatePos.get(id) ?? 0) === 0 ? 1 : 0;
    const closing = g.positions[to];
    const occupied = (p: Vec2): boolean => closing.some((t) => Math.floor(p.x / TILE) === t.col && Math.floor(p.y / TILE) === t.row);
    if (this.flock.some((s) => occupied(s.pos)) || (playerPos !== undefined && occupied(playerPos))) return false;
    this.markUsed();
    this.gatePos.set(id, to);
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
      const away = sub(s.pos, playerPos);
      if (distance(s.pos, playerPos) >= t.fleeRadius) continue;
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
