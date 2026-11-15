/**
 * The tile canvas the chapters paint their screens on: a grid of characters
 * turned into tile frames and a collision and sight grid derived from
 * `tileFlags`, so the art and the walls cannot drift. All chapters so far are
 * in the `kilnamoe` region.
 */

import { tileFlags, tileIndex } from '../art/tiles';
import type { ExitDef, ScreenAmbient, ScreenDressing, ScreenLayout } from '../core/chapter';
import type { ScreenId, TileGrid, Vec2 } from '../core/types';
import { tileCentre } from '../systems';

const REGION = 'kilnamoe';

/** Canvas character to kilnamoe tile name. */
const LEGEND: Readonly<Record<string, string>> = {
  '#': 'wallTop',
  W: 'wallFace',
  S: 'barShelf',
  w: 'window',
  '.': 'floor',
  c: 'counter',
  t: 'table',
  s: 'seat',
  d: 'doorStrip',
  m: 'marking',
  b: 'floorAlt',
  p: 'path',
  l: 'roadLine',
  g: 'grass',
  r: 'rough',
  ',': 'pavement',
  y: 'yardConcrete',
  L: 'litGround',
  G: 'gate',
  H: 'hedge',
  K: 'stoneWall',
  o: 'cover',
  P: 'bogPool',
  n: 'nightGrass',
  k: 'kerb',
  R: 'roofSlate',
  C: 'churchStone',
  X: 'shopfrontLit',
  Y: 'shopfrontDark',
  D: 'doorWood',
  E: 'doorLit',
  f: 'fence',
  q: 'water',
  B: 'turfBank',
  M: 'mud',
};

export interface Extras {
  readonly mykoStart?: Vec2;
  readonly dressing?: ScreenDressing;
  readonly ambient?: ScreenAmbient;
}

export class Canvas {
  private readonly cells: string[][];
  constructor(
    readonly width: number,
    readonly height: number,
    fill: string,
  ) {
    this.cells = Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
  }
  set(col: number, row: number, ch: string): this {
    const r = this.cells[row];
    if (r && col >= 0 && col < this.width) r[col] = ch;
    return this;
  }
  rect(col: number, row: number, w: number, h: number, ch: string): this {
    for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) this.set(c, r, ch);
    return this;
  }
  /** Outer ring of wall tops with an inner ring of wall faces. */
  room(): this {
    this.rect(0, 0, this.width, 1, '#').rect(0, this.height - 1, this.width, 1, '#');
    this.rect(0, 0, 1, this.height, '#').rect(this.width - 1, 0, 1, this.height, '#');
    this.rect(1, 1, this.width - 2, 1, 'W').rect(1, this.height - 2, this.width - 2, 1, 'W');
    this.rect(1, 1, 1, this.height - 2, 'W').rect(this.width - 2, 1, 1, this.height - 2, 'W');
    return this;
  }
  char(col: number, row: number): string {
    return this.cells[row]?.[col] ?? '#';
  }
  build(id: ScreenId, exits: readonly ExitDef[], playerStart: Vec2, extras: Extras = {}): ScreenLayout {
    const tiles: number[] = [];
    const blocked: boolean[] = [];
    const blocksSight: boolean[] = [];
    for (let row = 0; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        const name = LEGEND[this.char(col, row)];
        if (name === undefined) throw new Error(`Unknown tile character "${this.char(col, row)}" at ${id} ${col},${row}`);
        const index = tileIndex(REGION, name);
        const flags = tileFlags(REGION, index);
        tiles.push(index);
        blocked.push(flags.blocked);
        blocksSight.push(flags.blocksSight);
      }
    }
    const grid: TileGrid = { widthTiles: this.width, heightTiles: this.height, blocked, blocksSight };
    return { id, grid, tiles, exits, playerStart, ...extras };
  }
}

export const T = (col: number, row: number): Vec2 => tileCentre({ col, row });

/** A rectangle of whole tiles as an area in pixels. */
export const tilesArea = (col: number, row: number, w: number, h: number) => ({ x: col * 16, y: row * 16, width: w * 16, height: h * 16 });

