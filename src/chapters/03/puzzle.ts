/**
 * The crate puzzle's layout (docs/chapters/03-regional-office.md beat 5). An 8 x 6 pen under the bay office, five crates
 * that can only be pushed, two pillars that never move, a way in along the south wall and the office door in the north wall.
 * Local coordinates are (x, y) in the pen, x 0 to 7 and y 0 to 5. It is solved when the marked road (the door's column and
 * a passing place either side of it, painted on the floor) is clear of crates.
 * `tests/unit/chapter3.test.ts` searches the layout: the fewest pushes, and every position the crates can be pushed into.
 */

import type { PushPuzzleLayout } from '../../systems/puzzles';

/** Top-left tile of the pen on c3.bay and its size in tiles. */
export const PEN = { col: 3, row: 5, width: 8, height: 6 } as const;
/** The pen's local columns that open onto the bay floor along its south wall. */
export const PEN_ENTRANCE_COLS: readonly number[] = [2, 3, 4];
/** The local column of the office door in the north wall. */
export const DOOR_COL = 3;

export const PILLARS: readonly { readonly x: number; readonly y: number }[] = [
  { x: 1, y: 0 },
  { x: 2, y: 1 },
];

const CRATES: readonly { readonly x: number; readonly y: number }[] = [
  { x: 3, y: 0 },
  { x: 3, y: 1 },
  { x: 3, y: 2 },
  { x: 3, y: 3 },
  { x: 3, y: 4 },
];

/** Where the crates stand when the door's column is clear. */
const SOLVED: readonly { readonly x: number; readonly y: number }[] = [
  { x: 4, y: 0 },
  { x: 4, y: 1 },
  { x: 2, y: 2 },
  { x: 4, y: 2 },
  { x: 5, y: 5 },
];

/** The marked road: the door's column and the four cells either side of it in rows 3 and 4. */
export const ROAD: readonly { readonly x: number; readonly y: number }[] = [
  ...Array.from({ length: 6 }, (_, y) => ({ x: DOOR_COL, y })),
  { x: 2, y: 3 },
  { x: 4, y: 3 },
  { x: 2, y: 4 },
  { x: 4, y: 4 },
];

export const penTile = (x: number, y: number): { col: number; row: number } => ({ col: PEN.col + x, row: PEN.row + y });
const piece = (p: { x: number; y: number }, i: number) => ({ id: `crate${i + 1}`, ...penTile(p.x, p.y) });

export const PUSH_LAYOUT: PushPuzzleLayout = {
  area: PEN,
  pieces: CRATES.map(piece),
  fixed: PILLARS.map((p) => penTile(p.x, p.y)),
  goal: { kind: 'clear', cells: ROAD.map((p) => penTile(p.x, p.y)) },
  solution: SOLVED.map(piece),
};
