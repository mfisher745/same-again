/**
 * Push puzzle (chapter 1 kegs, chapter 3 crates). docs/chapters/01 beat 5,
 * docs/chapters/03 beat 4. Plain TypeScript.
 *
 * Pieces sit on tiles and are pushed one tile at a time by walking into
 * them. A piece cannot leave the play area or move into a blocked tile,
 * a fixed tile or another piece. The goal is "these cells are clear",
 * "these cells are covered", or "Andrew can walk from here to there" (the
 * chapter 1 kegs: a way through to the yard gate).
 */

import { TUNING } from '../content/tuning';
import type { GameEventBus, PuzzleDef, Reward, TileCoord, TileGrid, Vec2 } from '../core/types';
import { PuzzleBase } from './investigation';
import { isBlocked, tileCentre, tileOf } from './grid';
import type { SectionHost } from './sections';

export interface PushPiece {
  readonly id: string;
  readonly col: number;
  readonly row: number;
}

export interface PushPuzzleLayout {
  /** Play area in screen tiles. */
  readonly area: { readonly col: number; readonly row: number; readonly width: number; readonly height: number };
  readonly pieces: readonly PushPiece[];
  /** Immovable tiles inside the area (the fixed crate, pillars). */
  readonly fixed: readonly TileCoord[];
  readonly goal: PushGoal;
  /** Piece positions used by `completeNow()`. */
  readonly solution: readonly PushPiece[];
}

/**
 * When the puzzle is solved. `reach`: a walk from `from` to `to` exists through open tiles (not blocked, not a
 * piece or a fixed tile). Use it when the pieces plug a passage and any way of unplugging it will do.
 */
export type PushGoal =
  | { readonly kind: 'clear' | 'cover'; readonly cells: readonly TileCoord[] }
  | { readonly kind: 'reach'; readonly from: TileCoord; readonly to: TileCoord };

interface LivePiece {
  readonly id: string;
  col: number;
  row: number;
  /** Pixel position for drawing while sliding. */
  drawFrom: Vec2;
  slideMs: number;
}

export type Cardinal = 'up' | 'down' | 'left' | 'right';
const DELTA: Readonly<Record<Cardinal, TileCoord>> = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
};

export class PushPuzzle extends PuzzleBase {
  private pieces: LivePiece[];
  private holdMs = 0;
  private holdDir: Cardinal | null = null;
  pushes = 0;
  /** Called after each successful push (sound). */
  onPush: (() => void) | null = null;

  constructor(
    def: PuzzleDef,
    readonly layout: PushPuzzleLayout,
    private readonly grid: TileGrid,
    host: SectionHost,
    bus: GameEventBus,
    reward?: Reward,
  ) {
    super(def, host, bus, reward);
    this.pieces = layout.pieces.map((p) => live(p));
  }

  piecePositions(): readonly PushPiece[] {
    return this.pieces.map((p) => ({ id: p.id, col: p.col, row: p.row }));
  }

  /** Pixel centre of each piece for drawing (interpolated while sliding). */
  pieceDrawPositions(): readonly { id: string; pos: Vec2 }[] {
    return this.pieces.map((p) => {
      const to = tileCentre(p);
      if (p.slideMs <= 0) return { id: p.id, pos: to };
      const t = 1 - p.slideMs / TUNING.world.pushSlideMs;
      return { id: p.id, pos: { x: p.drawFrom.x + (to.x - p.drawFrom.x) * t, y: p.drawFrom.y + (to.y - p.drawFrom.y) * t } };
    });
  }

  /** Whether a tile is occupied by a piece or a fixed tile (for collision). */
  occupies(col: number, row: number): boolean {
    return this.pieces.some((p) => p.col === col && p.row === row) || this.layout.fixed.some((f) => f.col === col && f.row === row);
  }

  inArea(col: number, row: number): boolean {
    const a = this.layout.area;
    return col >= a.col && row >= a.row && col < a.col + a.width && row < a.row + a.height;
  }

  /** Pushes the piece at `from` one tile in `dir`. Returns true if it moved. */
  push(from: TileCoord, dir: Cardinal): boolean {
    if (this.isComplete()) return false;
    const piece = this.pieces.find((p) => p.col === from.col && p.row === from.row);
    if (!piece) return false;
    const d = DELTA[dir];
    const nc = piece.col + d.col;
    const nr = piece.row + d.row;
    if (!this.inArea(nc, nr) || isBlocked(this.grid, nc, nr) || this.occupies(nc, nr)) return false;
    this.start();
    piece.drawFrom = tileCentre(piece);
    piece.col = nc;
    piece.row = nr;
    piece.slideMs = TUNING.world.pushSlideMs;
    this.pushes++;
    this.onPush?.();
    if (this.goalMet()) this.solved();
    return true;
  }

  /**
   * Called each tick with Andrew's position and move input. Walking into a
   * piece along one axis for `pushHoldMs` pushes it.
   */
  update(dtMs: number, playerPos: Vec2, move: Vec2): void {
    for (const p of this.pieces) p.slideMs = Math.max(0, p.slideMs - dtMs);
    const dir = cardinalOf(move);
    if (!dir || this.isComplete()) {
      this.holdMs = 0;
      this.holdDir = null;
      return;
    }
    const d = DELTA[dir];
    const reach = TUNING.player.bodyWidth / 2 + 2;
    const probe = { x: playerPos.x + d.col * reach, y: playerPos.y + d.row * reach };
    const t = tileOf(probe);
    const piece = this.pieces.find((p) => p.col === t.col && p.row === t.row && p.slideMs <= 0);
    if (!piece) {
      this.holdMs = 0;
      this.holdDir = null;
      return;
    }
    if (this.holdDir !== dir) {
      this.holdDir = dir;
      this.holdMs = 0;
    }
    this.holdMs += dtMs;
    if (this.holdMs >= TUNING.world.pushHoldMs) {
      this.holdMs = 0;
      this.push({ col: piece.col, row: piece.row }, dir);
    }
  }

  goalMet(): boolean {
    const g = this.layout.goal;
    if (g.kind === 'reach') return this.walkable(g.from, g.to);
    if (g.kind === 'clear') return g.cells.every((c) => !this.pieces.some((p) => p.col === c.col && p.row === c.row));
    return g.cells.every((c) => this.pieces.some((p) => p.col === c.col && p.row === c.row));
  }

  /** A walk from `from` to `to` through tiles that are not blocked and hold no piece or fixed tile. */
  private walkable(from: TileCoord, to: TileCoord): boolean {
    const open = (c: number, r: number): boolean => !isBlocked(this.grid, c, r) && !this.occupies(c, r);
    if (!open(from.col, from.row)) return false;
    const seen = new Set<number>([from.row * this.grid.widthTiles + from.col]);
    const stack: TileCoord[] = [from];
    for (let t = stack.pop(); t !== undefined; t = stack.pop()) {
      if (t.col === to.col && t.row === to.row) return true;
      for (const d of Object.values(DELTA)) {
        const c = t.col + d.col;
        const r = t.row + d.row;
        const k = r * this.grid.widthTiles + c;
        if (seen.has(k) || !open(c, r)) continue;
        seen.add(k);
        stack.push({ col: c, row: r });
      }
    }
    return false;
  }

  override reset(): void {
    if (this.isComplete()) return;
    this.pieces = this.layout.pieces.map((p) => live(p));
    this.pushes = 0;
  }

  protected applySolution(): void {
    this.pieces = this.layout.solution.map((p) => live(p));
  }
}

function live(p: PushPiece): LivePiece {
  return { id: p.id, col: p.col, row: p.row, drawFrom: tileCentre(p), slideMs: 0 };
}

/** Single-axis direction from a move vector, or null for diagonal / none. */
export function cardinalOf(move: Vec2): Cardinal | null {
  if (move.x !== 0 && move.y !== 0) return null;
  if (move.x > 0) return 'right';
  if (move.x < 0) return 'left';
  if (move.y > 0) return 'down';
  if (move.y < 0) return 'up';
  return null;
}
