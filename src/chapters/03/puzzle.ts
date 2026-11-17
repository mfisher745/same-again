/**
 * The crate puzzle's layout (docs/chapters/03-regional-office.md beat 5). An 8 x 6 pen under the bay office. Playtest 7:
 * the old layout could be walked round and solved with one push, and its painted road told the player nothing. Now:
 *
 *   x  0 1 2 3 4 5 6 7
 *   y0 # # # . # # # #   the office door is above (3, 0), in a nook in the north wall
 *   y1 . . . . K . . .
 *   y2 . . . . . C . K
 *   y3 . K K K K K C .   a wall of pillars across the pen, a way round at each end
 *   y4 . C . . . C . .
 *   y5 . C . . . C . .
 *         (way in: x 2 to 4)
 *
 * Solved when Andrew can walk from the way in to the door (a `reach` goal, as the chapter 1 kegs), so nothing counts
 * but getting through. Seven pushes at least (round the right: the bottom crate into the corner, the crate in the gap
 * up twice, the top crate left three times); about 6% of the positions the crates can be pushed into cannot be
 * finished, and the reset lever by the entrance puts every crate back.
 * Local coordinates are (x, y) in the pen. `tests/unit/chapter3.test.ts` searches the layout.
 */

import type { PushPuzzleLayout } from '../../systems/puzzles';

/** Top-left tile of the pen on c3.bay and its size in tiles. */
export const PEN = { col: 3, row: 5, width: 8, height: 6 } as const;
/** The pen's local columns that open onto the bay floor along its south wall. */
export const PEN_ENTRANCE_COLS: readonly number[] = [2, 3, 4];
/** The local column of the office door in the north wall. */
export const DOOR_COL = 3;

/** The pen's top row is wall but for the nook under the door. */
export const NOOK_WALL: readonly { readonly x: number; readonly y: number }[] = Array.from({ length: 8 }, (_, x) => ({ x, y: 0 })).filter((c) => c.x !== DOOR_COL);

export const PILLARS: readonly { readonly x: number; readonly y: number }[] = [
  { x: 1, y: 3 },
  { x: 2, y: 3 },
  { x: 3, y: 3 },
  { x: 4, y: 3 },
  { x: 5, y: 3 },
  { x: 7, y: 2 },
  { x: 4, y: 1 },
];

const CRATES: readonly { readonly x: number; readonly y: number }[] = [
  { x: 5, y: 2 },
  { x: 6, y: 3 },
  { x: 1, y: 4 },
  { x: 5, y: 4 },
  { x: 1, y: 5 },
  { x: 5, y: 5 },
];

/** Where the crates stand after the seven pushes (for `completeNow()`), in the same order as `CRATES`. */
const SOLVED: readonly { readonly x: number; readonly y: number }[] = [
  { x: 2, y: 2 },
  { x: 6, y: 1 },
  { x: 1, y: 4 },
  { x: 5, y: 4 },
  { x: 1, y: 5 },
  { x: 7, y: 5 },
];

export const penTile = (x: number, y: number): { col: number; row: number } => ({ col: PEN.col + x, row: PEN.row + y });
const piece = (p: { x: number; y: number }, i: number) => ({ id: `crate${i + 1}`, ...penTile(p.x, p.y) });

/** The puzzle's walk: from the middle of the way in (just outside the pen) to the nook under the door. */
export const PEN_WAY_IN = { col: PEN.col + 3, row: PEN.row + PEN.height } as const;
export const PEN_DOOR_NOOK = penTile(DOOR_COL, 0);

export const PUSH_LAYOUT: PushPuzzleLayout = {
  area: PEN,
  pieces: CRATES.map(piece),
  // The pillars are wall tiles on the map (maps.ts), which block pushes already. Listing them here would draw a crate on
  // each (the view draws fixed tiles as crates, for the chapter 1 yard), and they must not look like crates.
  fixed: [],
  goal: { kind: 'reach', from: PEN_WAY_IN, to: PEN_DOOR_NOOK },
  solution: SOLVED.map(piece),
};
