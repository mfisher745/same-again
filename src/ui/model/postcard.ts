/**
 * The postcard on the Tab screen (chapter 6): the aerial photo of the crop formation, drawn as the maze with its three
 * marker stones. The stones are ringed 1, 2 and 3 pips and joined in the order they must be stepped on, so the card
 * is the pattern the puzzle asks for. No text: the picture is the clue. Pure geometry; the casebook view draws it.
 */

import { MAZE, MAZE_GRID } from '../../chapters/06/maps';

/** The casebook entry whose page carries the picture. */
export const POSTCARD_EVIDENCE = 'c6.clue.postcard';

export interface PictureRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface PostcardStone {
  /** 1, 2 or 3: the order to step on them. */
  readonly order: number;
  /** The stone's square. */
  readonly box: PictureRect;
  /** One small square per pip of its order, inside the box. */
  readonly pips: readonly PictureRect[];
}

export interface PostcardPicture {
  readonly width: number;
  readonly height: number;
  /** The staked walls, merged along rows. */
  readonly walls: readonly PictureRect[];
  /** The line from each stone to the next (thin rectangles, elbow-shaped). */
  readonly links: readonly PictureRect[];
  readonly stones: readonly PostcardStone[];
}

/** The picture at `cell` pixels to a maze tile. */
export function postcardPicture(cell = 5): PostcardPicture {
  const walls: PictureRect[] = [];
  for (let r = 0; r < MAZE.height; r++) {
    let start = -1;
    for (let c = 0; c <= MAZE.width; c++) {
      const wall = c < MAZE.width && MAZE_GRID.walls[r]?.[c] === true;
      if (wall && start < 0) start = c;
      if (!wall && start >= 0) {
        walls.push({ x: start * cell, y: r * cell, w: (c - start) * cell, h: cell });
        start = -1;
      }
    }
  }
  const half = Math.floor(cell / 2);
  const centres = MAZE_GRID.stones.map((s) => ({ x: s.col * cell + half, y: s.row * cell + half }));
  const links: PictureRect[] = [];
  for (let i = 0; i + 1 < centres.length; i++) {
    const a = centres[i];
    const b = centres[i + 1];
    if (!a || !b) continue;
    links.push({ x: Math.min(a.x, b.x), y: a.y, w: Math.abs(b.x - a.x) + 1, h: 1 });
    links.push({ x: b.x, y: Math.min(a.y, b.y), w: 1, h: Math.abs(b.y - a.y) + 1 });
  }
  const size = cell + 4;
  const stones: PostcardStone[] = centres.map((c, i) => {
    const box = { x: c.x - Math.floor(size / 2), y: c.y - Math.floor(size / 2), w: size, h: size };
    const pips: PictureRect[] = [];
    for (let p = 0; p <= i; p++) pips.push({ x: box.x + 1 + p * 3, y: box.y + Math.floor(size / 2), w: 2, h: 2 });
    return { order: i + 1, box, pips };
  });
  return { width: MAZE.width * cell, height: MAZE.height * cell, walls, links, stones };
}
