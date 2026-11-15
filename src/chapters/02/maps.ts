/**
 * Chapter 2 screens as tile layouts, dressing and pre-dawn ambience. Level data
 * only (docs/chapters/02-the-bog.md): the bog, Brennan's farm and the lane.
 * Painted on the shared character canvas, so the walls and the sight lines come
 * from the tile art.
 */

import { PROP } from '../../art/props';
import type { ExitDef, PropPlacement, ScreenAmbient, ScreenDressing, ScreenLayout } from '../../core/chapter';
import type { StealthSectionDef } from '../../core/types';
import type { SheepPuzzleLayout } from '../../systems/sheep';
import { Canvas, T, tilesArea } from '../canvas';

export { T, tilesArea };

const MIST: ScreenAmbient = { tint: 'navyDark', strength: 0.35 };

// ---------------------------------------------------------------------------
// Shared level data
// ---------------------------------------------------------------------------

/** Where Andrew arrives at the lean-to, at the start and after every return. */
export const BAR_ARRIVAL = T(6, 28);
/** The flask on the crate beside him: where E offers the hot drink. */
export const FLASK_SPOT = T(6, 26);
/** Myko's chair at the lean-to. */
export const MYKO_CHAIR = T(8, 28);
export const FARM_ARRIVAL = T(2, 11);
export const BOG_FROM_FARM = T(56, 11);
export const LANE_ARRIVAL = T(6, 6);
/** The first gate on the lane: Myko sits on it for the whole run. */
export const LANE_GATE_SEAT = T(2, 3);

/** The scorched ring: centre tile and radius in tiles (9 metres across). */
export const RING = { col: 29, row: 13, radius: 4.5 } as const;
export const CLUE_SPOTS = {
  ring: T(25, 13),
  fragment: T(29, 13),
  tracks: T(34, 14),
  frog: T(28, 10),
  welly: T(32, 16),
} as const;
/** The three clues the van waits for. */
export const KEY_CLUES = ['ring', 'fragment', 'tracks'] as const;

/** The van comes to the north end of the bog. */
export const VAN_TILE = { col: 45, row: 2 } as const;
/** The stealth section's area and where it is passed. */
export const BOG_EXIT_AREA = tilesArea(56, 10, 2, 3);
export const RING_AREA = tilesArea(22, 8, 15, 11);

/** Farm: the sheep field, four pens round a cross of fences. Pens are 9 x 7 tiles. */
export const FIELD = { col: 10, row: 7, width: 19, height: 15 } as const;
export const FAR_PEN = { col: 10, row: 15, width: 9, height: 7 } as const;
const col = (c: number, r0: number, n: number) => Array.from({ length: n }, (_, i) => ({ col: c, row: r0 + i }));
const row = (r: number, c0: number, n: number) => Array.from({ length: n }, (_, i) => ({ col: c0 + i, row: r }));
/** The three doors of the cross. d1: pen 1 to pen 2. d2: pen 2 to pen 3. d3: pen 3 to the far pen. */
const D1 = col(19, 11, 3);
const D2 = row(14, 20, 3);
const D3 = col(19, 15, 3);

/**
 * Each gate hangs at the middle of the cross and swings between two doors, so it is always shutting one
 * and opening another. Gate A: d1 or d2. Gate B: d2 or d3. Gate C: d3 or nothing. Everything is shut to
 * begin with. Getting a sheep through d1, then d2, then d3 takes A, then A and B, then B and C: five swings.
 */
export const SHEEP_LAYOUT: SheepPuzzleLayout = {
  area: FIELD,
  sheep: [
    { id: 'sheep1', col: 13, row: 8 },
    { id: 'sheep2', col: 15, row: 9 },
    { id: 'sheep3', col: 12, row: 10 },
  ],
  gates: [
    { id: 'gateA', positions: [D1, D2], examinableId: 'c2.gateA' },
    { id: 'gateB', positions: [D2, D3], examinableId: 'c2.gateB' },
    { id: 'gateC', positions: [D3, []], examinableId: 'c2.gateC' },
  ],
  targetPen: FAR_PEN,
  solution: {
    sheep: [
      { id: 'sheep1', col: 12, row: 17 },
      { id: 'sheep2', col: 14, row: 19 },
      { id: 'sheep3', col: 16, row: 17 },
    ],
    gates: { gateA: 0, gateB: 0, gateC: 1 },
  },
};

/** Feed buckets for The Stumble. */
export const BUCKETS_AREA = tilesArea(3, 19, 4, 3);
/** The yard the cousins come into (west strip of the farm). */
export const COUSIN_TRIGGER = tilesArea(2, 8, 6, 6);

// ---------------------------------------------------------------------------
// The stealth section: three Department men
// ---------------------------------------------------------------------------

export const BOG_STEALTH: StealthSectionDef = {
  id: 'c2.stealth.bog',
  checkpointId: 'c2.cp.bog',
  guards: [
    {
      // North sweep.
      enemyId: 'suit',
      route: {
        mode: 'pingPong',
        waypoints: [
          { position: T(43, 5), waitMs: 1500, facing: 'right' },
          { position: T(55, 5), waitMs: 1500, facing: 'left' },
        ],
      },
    },
    {
      // South sweep.
      enemyId: 'suit',
      route: {
        mode: 'pingPong',
        waypoints: [
          { position: T(43, 19), waitMs: 1500, facing: 'right' },
          { position: T(55, 19), waitMs: 1500, facing: 'left' },
        ],
      },
    },
    {
      // Walks the gap in the turf where the tracks cross.
      enemyId: 'suit',
      route: {
        mode: 'pingPong',
        waypoints: [
          { position: T(48, 4), waitMs: 1200, facing: 'down' },
          { position: T(48, 20), waitMs: 1200, facing: 'up' },
        ],
      },
    },
  ],
  hazards: [],
  hidingProps: [],
  reward: { kind: 'clue', clueId: 'c2.clue.lanyard' },
};

// ---------------------------------------------------------------------------
// c2.bog 60 x 34
// ---------------------------------------------------------------------------

export function bogScreen(): ScreenLayout {
  const c = new Canvas(60, 34, 'b');
  c.rect(0, 0, 60, 1, '#').rect(0, 33, 60, 1, '#').rect(0, 0, 1, 34, '#').rect(59, 0, 1, 34, '#');
  c.rect(1, 1, 58, 1, 'H').rect(1, 32, 58, 1, 'H').rect(1, 2, 1, 30, 'H').rect(58, 2, 1, 30, 'H');
  // The gate off the road, west side, with a strip of path inside it.
  c.rect(0, 28, 1, 2, 'G').rect(1, 28, 3, 2, 'p');
  // Turf banks: rough ground in long bands.
  for (const [r, c0, n] of [[4, 5, 12], [8, 4, 8], [20, 8, 10], [23, 30, 6], [30, 24, 14], [6, 42, 6]] as const) c.rect(c0, r, n, 1, 'r');
  // Drains: not walkable, but a man can see over them. One long cut with a gap, between the ring and the field.
  c.rect(38, 2, 1, 8, 'q').rect(38, 21, 1, 11, 'q').rect(12, 24, 9, 1, 'q').rect(24, 3, 1, 5, 'q').rect(8, 14, 1, 6, 'q');
  // The scorched ring.
  for (let r = 0; r < 34; r++) {
    for (let cc = 0; cc < 60; cc++) {
      const dx = cc + 0.5 - (RING.col + 0.5);
      const dy = r + 0.5 - (RING.row + 0.5);
      if (dx * dx + dy * dy <= RING.radius * RING.radius) c.set(cc, r, 'r');
    }
  }
  // The tyre tracks: a path from the ring, east past the turf, to the farm.
  c.rect(34, 14, 6, 1, 'p').rect(39, 11, 1, 4, 'p').rect(40, 11, 19, 1, 'p');
  // The way out to Brennan's, at the east end of the tracks.
  c.rect(58, 10, 2, 3, 'p');
  // Stacked turf: the cover. Two long walls with a gap between them (col 48), and the corridor between.
  c.rect(41, 8, 7, 2, 'o').rect(49, 8, 8, 2, 'o').rect(41, 13, 7, 2, 'o').rect(49, 13, 8, 2, 'o');
  c.rect(41, 23, 3, 2, 'o').rect(52, 23, 3, 2, 'o').rect(41, 2, 2, 2, 'o').rect(55, 28, 2, 2, 'o');
  // The lean-to: a back wall and a roof line, a floor of boards, a post at each end.
  c.rect(3, 24, 7, 1, '#').rect(3, 25, 7, 1, 'W').rect(3, 26, 7, 5, '.');
  c.set(3, 26, 'f').set(9, 26, 'f');
  c.rect(6, 26, 2, 1, 't').set(5, 28, 's').set(7, 28, 's');
  const exits: ExitDef[] = [
    { id: 'c2.bog.east', area: tilesArea(58, 10, 2, 3), toScreen: 'c2.farm', spawn: FARM_ARRIVAL, lockedUntil: ['c2.stealth.bog'] },
  ];
  const props: PropPlacement[] = [
    // The crate of stout, the honesty box and the flask.
    { id: 'bar.crate', frame: PROP.bottleCrate, col: 4, row: 26, solid: { width: 1, height: 1 } },
    { id: 'bar.box', frame: PROP.cardboardBox, col: 8, row: 26, solid: { width: 1, height: 1 } },
    { id: 'bar.flask', frame: PROP.flask, col: 6, row: 26 },
    { id: 'bar.jar', frame: PROP.coffeePot, col: 7, row: 26 },
    // The ring's contents.
    { id: 'ring.fragment', frame: PROP.debris[0], col: 29, row: 13 },
    { id: 'ring.frog', frame: PROP.debris[1], col: 28, row: 10 },
    { id: 'ring.welly', frame: PROP.sack, col: 32, row: 16 },
    // The van is not here until it arrives.
    { id: 'van', frame: PROP.tractor, col: VAN_TILE.col, row: VAN_TILE.row, solid: { width: 3, height: 2 }, hidden: true },
  ];
  const dressing: ScreenDressing = { props };
  const ambient: ScreenAmbient = {
    ...MIST,
    lights: [
      { x: 6 * 16 + 8, y: 27 * 16, radius: 56, colour: 'amber' },
      { x: 29 * 16 + 8, y: 13 * 16 + 8, radius: 60, colour: 'fog', glow: 0.12 },
    ],
  };
  return c.build('c2.bog', exits, BAR_ARRIVAL, { mykoStart: MYKO_CHAIR, dressing, ambient });
}

// ---------------------------------------------------------------------------
// c2.farm 40 x 30
// ---------------------------------------------------------------------------

export function farmScreen(): ScreenLayout {
  const c = new Canvas(40, 30, 'g');
  c.rect(0, 0, 40, 1, '#').rect(0, 29, 40, 1, '#').rect(0, 0, 1, 30, '#').rect(39, 0, 1, 30, '#');
  // The yard: concrete down the west side, to the gate at the bottom.
  c.rect(1, 1, 8, 28, 'y');
  // The way in from the bog.
  c.rect(0, 10, 1, 3, 'p');
  // The hay shed: walls, a floor, and the door in the front wall.
  c.rect(10, 1, 9, 5, 'W').rect(11, 2, 7, 3, '.').rect(13, 5, 2, 1, '.');
  // The field: a fence round it, a cross of fences inside, and the three doors (left open in the tiles; the gates close them).
  c.rect(9, 6, 21, 1, 'f').rect(9, 22, 21, 1, 'f').rect(9, 6, 1, 17, 'f').rect(29, 6, 1, 17, 'f');
  c.rect(13, 6, 2, 1, 'g');
  c.rect(9, 10, 1, 3, 'g');
  c.rect(19, 7, 1, 15, 'f').rect(10, 14, 19, 1, 'f');
  for (const t of [...D1, ...D2, ...D3]) c.set(t.col, t.row, 'g');
  // The gate out of the yard, at the bottom.
  c.rect(3, 29, 3, 1, 'G');
  const exits: ExitDef[] = [
    { id: 'c2.farm.west', area: tilesArea(0, 10, 1, 3), toScreen: 'c2.bog', spawn: BOG_FROM_FARM },
    { id: 'c2.farm.gate', area: tilesArea(3, 27, 3, 2), toScreen: 'c2.lane', spawn: LANE_ARRIVAL },
  ];
  const props: PropPlacement[] = [
    // The shed door: a gate across it until the flock is out of the way.
    { id: 'shed.door', frame: PROP.churchGate, col: 13, row: 4, solid: { dy: 1, width: 2, height: 1 } },
    // Hay (behind it, the whiskey) and the bench with the docket.
    { id: 'shed.hay1', frame: PROP.sack, col: 16, row: 3, solid: { width: 1, height: 1 } },
    { id: 'shed.hay2', frame: PROP.sack, col: 17, row: 3, solid: { width: 1, height: 1 } },
    { id: 'shed.bench', frame: PROP.crate, col: 11, row: 3, solid: { width: 1, height: 1 } },
    // Feed buckets: a stack that breaks to a lurch.
    { id: 'yard.bucket1', frame: PROP.barrel, col: 4, row: 19, solid: { width: 1, height: 1 }, breakable: { hits: 2, loot: 'none' } },
    { id: 'yard.bucket2', frame: PROP.barrel, col: 5, row: 19, solid: { width: 1, height: 1 }, breakable: { hits: 2, loot: 'none' } },
    { id: 'yard.bucket3', frame: PROP.barrel, col: 4, row: 20, solid: { width: 1, height: 1 }, breakable: { hits: 2, loot: 'none' } },
    { id: 'yard.bucket4', frame: PROP.barrel, col: 5, row: 20, solid: { width: 1, height: 1 }, breakable: { hits: 2, loot: 'none' } },
    // The dog, asleep throughout.
    { id: 'farm.dog', frame: PROP.sack, col: 7, row: 24, solid: { width: 1, height: 1 } },
  ];
  const dressing: ScreenDressing = { props };
  const ambient: ScreenAmbient = { ...MIST, strength: 0.3 };
  return c.build('c2.farm', exits, FARM_ARRIVAL, { dressing, ambient });
}

// ---------------------------------------------------------------------------
// c2.lane 90 x 12
// ---------------------------------------------------------------------------

const LANE_ROWS = { top: 2, bottom: 9 } as const;
export const LANE_GATE_COL = 52;
export const GRID_COL = 82;
export const LANE_EXIT_AREA = tilesArea(85, 2, 4, 8);

/** One logical floor prop with a footprint, drawn over its whole area with plain frames. */
function floorPatch(id: string, frame: string, c0: number, r0: number, w: number, h: number, extra: Partial<PropPlacement>): PropPlacement[] {
  const out: PropPlacement[] = [{ id, frame, col: c0, row: r0, layer: 'floor', ...extra }];
  for (let r = 0; r < h; r++) for (let cc = 0; cc < w; cc++) if (r !== 0 || cc !== 0) out.push({ id: `${id}.${cc}.${r}`, frame, col: c0 + cc, row: r0 + r, layer: 'floor' });
  return out;
}

export function laneScreen(): ScreenLayout {
  const c = new Canvas(90, 12, 'p');
  c.rect(0, 0, 90, 1, '#').rect(0, 11, 90, 1, '#').rect(0, 0, 1, 12, '#').rect(89, 0, 1, 12, '#');
  c.rect(1, 1, 88, 1, 'H').rect(1, 10, 88, 1, 'H');
  c.rect(1, 2, 88, 1, 'g').rect(1, 9, 88, 1, 'g');
  for (let cc = 4; cc < 86; cc += 6) c.set(cc, 5, 'r');
  const props: PropPlacement[] = [
    // The yard gate, behind Andrew where the lane starts.
    { id: 'lane.yardgate', frame: PROP.churchGate, col: 1, row: 2 },
    // Puddles slow Andrew and nobody else.
    ...floorPatch('lane.puddle1', PROP.debris[1], 14, 3, 3, 2, { slows: { width: 3, height: 2 } }),
    ...floorPatch('lane.puddle2', PROP.debris[1], 26, 6, 3, 2, { slows: { width: 3, height: 2 } }),
    ...floorPatch('lane.puddle3', PROP.debris[1], 36, 3, 3, 3, { slows: { width: 3, height: 3 } }),
    { id: 'lane.wheelbarrow', frame: PROP.crate, col: 44, row: 5, solid: { width: 1, height: 1 } },
    // The gate across the lane. E opens it.
    ...[2, 4, 6, 8].map((r) => ({ id: `lane.gate.${r}`, frame: PROP.churchGate, col: LANE_GATE_COL - 1, row: r, solid: { dx: 1, width: 1, height: 2 } })),
    // The dog is asleep. Go round.
    { id: 'lane.dog', frame: PROP.sack, col: 66, row: 5, solid: { width: 1, height: 1 } },
    // The cattle grid: Andrew crosses it; the ram will not.
    ...floorPatch('lane.grid', PROP.debris[0], GRID_COL, LANE_ROWS.top, 2, 8, { blocksEnemies: { width: 2, height: 8 } }),
  ];
  return c.build('c2.lane', [], LANE_ARRIVAL, { dressing: { props }, ambient: { ...MIST, strength: 0.25 } });
}
