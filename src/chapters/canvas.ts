/**
 * The tile canvas the chapters paint their screens on: a grid of characters
 * turned into tile frames and a collision and sight grid derived from
 * `tileFlags`, so the art and the walls cannot drift. Chapters 1 and 2 are in
 * the `kilnamoe` region; chapters 4 and 5 paint in `cities`, chapter 6 in `ohio`, chapter 7 in `roswell`, chapter 8 in `nevada` and chapters 9 and 10 in `base`, each with its own legend.
 */

import { tileFlags, tileIndex } from '../art/tiles';
import type { ExitDef, ScreenAmbient, ScreenDressing, ScreenLayout } from '../core/chapter';
import type { RegionId, ScreenId, TileGrid, Vec2 } from '../core/types';
import { tileCentre } from '../systems';

const REGION: RegionId = 'kilnamoe';

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

/** Canvas character to `cities` tile name (chapter 4). */
const CITIES_LEGEND: Readonly<Record<string, string>> = {
  '#': 'wallTop',
  W: 'wallFace',
  g: 'greenWall',
  b: 'barWood',
  '.': 'floor',
  a: 'floorAlt',
  p: 'path',
  c: 'barCounter',
  t: 'barTable',
  s: 'barStool',
  S: 'barShelf',
  d: 'barDoorStrip',
  D: 'doorStrip',
  w: 'window',
  f: 'fence',
  o: 'cover',
  R: 'containerRed',
  U: 'containerBlue',
  r: 'rail',
  L: 'floodlit',
  e: 'dockEdge',
  q: 'water',
  m: 'marking',
  x: 'rough',
  // Chapter 5: the records office.
  C: 'cubicleWall',
  A: 'archiveShelf',
  Q: 'queueRope',
};

/** Canvas character to `ohio` tile name (chapter 6). */
const OHIO_LEGEND: Readonly<Record<string, string>> = {
  '#': 'wallTop',
  W: 'wallFace',
  w: 'window',
  '.': 'floor',
  g: 'floorAlt',
  p: 'path',
  r: 'rough',
  o: 'cover',
  c: 'counter',
  t: 'table',
  s: 'seat',
  d: 'doorStrip',
  f: 'fence',
  m: 'marking',
  a: 'road',
  l: 'roadLine',
  F: 'cornFlat',
  M: 'markerStone',
  D: 'ditch',
  P: 'poolEmpty',
  k: 'sidewalk',
  h: 'hatch',
  q: 'water',
  // Chapter 6 corn: standing (walkable, open to sight), cut stubble, and the maze's thicket wall (solid, blocks sight).
  C: 'cornStanding',
  u: 'cornStubble',
  X: 'cornWall',
};

/** Canvas character to `roswell` tile name (chapter 7). */
const ROSWELL_LEGEND: Readonly<Record<string, string>> = {
  '#': 'wallTop',
  W: 'wallFace',
  '.': 'floor',
  a: 'floorAlt',
  p: 'path',
  r: 'rough',
  o: 'cover',
  t: 'table',
  s: 'seat',
  c: 'counter',
  f: 'fence',
  w: 'window',
  m: 'marking',
  d: 'doorStrip',
  R: 'road',
  q: 'water',
  // Chapter 7: snow-globe shelves (solid, block sight), a neon sign in a wall, a cactus, stacked stock boxes (solid, block sight), the stockroom floor.
  S: 'shopShelf',
  N: 'neon',
  x: 'cactus',
  B: 'boxStack',
  F: 'stockFloor',
};

/** Canvas character to `nevada` tile name (chapter 8). */
const NEVADA_LEGEND: Readonly<Record<string, string>> = {
  '#': 'wallTop',
  W: 'wallFace',
  w: 'window',
  '.': 'floor',
  ',': 'floorAlt',
  p: 'path',
  r: 'rough',
  o: 'cover',
  c: 'counter',
  t: 'table',
  s: 'seat',
  d: 'doorStrip',
  f: 'fence',
  m: 'marking',
  q: 'water',
  a: 'asphalt',
  // Chapter 8: shade (walkable), ground sensor posts and the wire between them (the wire is walkable), thermal masts,
  // junction boxes.
  S: 'shade',
  P: 'sensorPost',
  l: 'sensorLine',
  M: 'thermalMast',
  J: 'junctionBox',
};

/** Canvas character to `base` tile name (chapters 9 and 10: cold, teal and violet, very tidy). */
const BASE_LEGEND: Readonly<Record<string, string>> = {
  '#': 'wallTop',
  W: 'wallFace',
  w: 'window',
  '.': 'floor',
  ',': 'floorAlt',
  a: 'floorAlt',
  p: 'path',
  r: 'rough',
  o: 'cover',
  c: 'counter',
  t: 'table',
  s: 'seat',
  f: 'fence',
  m: 'marking',
  d: 'doorStrip',
  q: 'water',
  // The gravity switch (a wall panel, solid), the pressure plate, glass (solid, see-through), the blast door frame (B or
  // F), a wall panel or the wall of screens (solid), the water cooler and the raised console dais (walkable).
  G: 'gravitySwitch',
  P: 'pressurePlate',
  g: 'glass',
  B: 'blastFrame',
  F: 'blastFrame',
  N: 'panel',
  C: 'waterCooler',
  D: 'consoleDais',
};

const LEGENDS: Readonly<Partial<Record<RegionId, Readonly<Record<string, string>>>>> = { cities: CITIES_LEGEND, ohio: OHIO_LEGEND, roswell: ROSWELL_LEGEND, nevada: NEVADA_LEGEND, base: BASE_LEGEND };

export interface Extras {
  readonly mykoStart?: Vec2;
  readonly dressing?: ScreenDressing;
  readonly ambient?: ScreenAmbient;
  /** Chapter 8: pixel areas that are shade on a sunny screen. */
  readonly shadeAreas?: ScreenLayout['shadeAreas'];
  /** Chapter 8: what `ctx.sunset()` puts on the screen. */
  readonly nightAmbient?: ScreenAmbient;
}

export class Canvas {
  private readonly cells: string[][];
  constructor(
    readonly width: number,
    readonly height: number,
    fill: string,
    private readonly region: RegionId = REGION,
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
    const legend = LEGENDS[this.region] ?? LEGEND;
    const tiles: number[] = [];
    const blocked: boolean[] = [];
    const blocksSight: boolean[] = [];
    for (let row = 0; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        const name = legend[this.char(col, row)];
        if (name === undefined) throw new Error(`Unknown tile character "${this.char(col, row)}" at ${id} ${col},${row}`);
        const index = tileIndex(this.region, name);
        const flags = tileFlags(this.region, index);
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

