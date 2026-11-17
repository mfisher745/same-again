/**
 * Standing corn (chapter 6). A chapter marks areas of tiles on a screen (`ScreenLayout.corn`); while a tile is
 * standing, Andrew standing still in it is hidden from guards (as Act Natural, without the move) and moving through
 * it makes a `rustle` noise. The combine cuts it (`cut`). Pure; no Phaser.
 */

import type { ScreenId, TileCoord } from '../core/types';
import { TILE } from './grid';

/** A rectangle of whole tiles. */
export interface TileRect {
  readonly col: number;
  readonly row: number;
  readonly width: number;
  readonly height: number;
}

/** Pixel rectangle. */
export interface PixelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const key = (col: number, row: number): string => `${col},${row}`;

export class CornField {
  private readonly standing = new Map<ScreenId, Set<string>>();
  private readonly original = new Map<ScreenId, readonly TileCoord[]>();

  /** Declares the corn on a screen. Replaces any earlier declaration for it. */
  mark(screenId: ScreenId, areas: readonly TileRect[]): void {
    const tiles: TileCoord[] = [];
    for (const a of areas) for (let r = a.row; r < a.row + a.height; r++) for (let c = a.col; c < a.col + a.width; c++) tiles.push({ col: c, row: r });
    this.original.set(screenId, tiles);
    this.standing.set(screenId, new Set(tiles.map((t) => key(t.col, t.row))));
  }

  isStanding(screenId: ScreenId, col: number, row: number): boolean {
    return this.standing.get(screenId)?.has(key(col, row)) === true;
  }

  /** Every tile still standing on a screen, for drawing. */
  standingTiles(screenId: ScreenId): TileCoord[] {
    return [...(this.standing.get(screenId) ?? [])].map((k) => {
      const [c, r] = k.split(',').map(Number);
      return { col: c ?? 0, row: r ?? 0 };
    });
  }

  /** Cuts every standing tile touched by `area`. Returns the tiles cut (empty: nothing to do). */
  cut(screenId: ScreenId, area: PixelRect): TileCoord[] {
    const set = this.standing.get(screenId);
    if (!set) return [];
    const out: TileCoord[] = [];
    const c0 = Math.floor(area.x / TILE);
    const c1 = Math.floor((area.x + area.width - 1e-6) / TILE);
    const r0 = Math.floor(area.y / TILE);
    const r1 = Math.floor((area.y + area.height - 1e-6) / TILE);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (set.delete(key(c, r))) out.push({ col: c, row: r });
      }
    }
    return out;
  }

  /** Puts a screen's corn back as declared (a set piece starting over). Returns the tiles regrown. */
  regrow(screenId: ScreenId): TileCoord[] {
    const orig = this.original.get(screenId);
    const set = this.standing.get(screenId);
    if (!orig || !set) return [];
    const back = orig.filter((t) => !set.has(key(t.col, t.row)));
    for (const t of back) set.add(key(t.col, t.row));
    return back;
  }
}
