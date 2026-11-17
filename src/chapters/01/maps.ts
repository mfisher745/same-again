/**
 * Chapter 1 screens as tile layouts, dressing and night ambience. Level data
 * only: each screen is painted onto a character canvas, then turned into tile
 * frames and a collision and sight grid derived from `tileFlags`, so the art
 * and the walls cannot drift.
 */

import { PROP } from '../../art/props';
import type { ExitDef, ScreenAmbient, ScreenDressing, ScreenLayout } from '../../core/chapter';
import { Canvas, T, tilesArea } from '../canvas';

export { T, tilesArea };

// ---------------------------------------------------------------------------
// Shared level data
// ---------------------------------------------------------------------------

/** Andrew's stool at the west end of the bar: where he arrives, at the start and after every return. The urn is beside it. */
export const PUB_ARRIVAL = T(6, 4);
/** Where E works the urn (the hot drink is offered here). */
export const URN_SPOT = T(5, 4);
export const MYKO_SEAT = T(5, 13);
export const YARD_ARRIVAL = T(5, 3);
/** Where Andrew steps out of the yard when he comes back from Main Street. */
export const YARD_FROM_STREET = T(17, 7);
/** Close enough to the stuck yard gate for The Shoulder to count as a shove at it: the far end of the path, past the kegs. */
export const YARD_GATE_AREA = tilesArea(15, 6, 3, 3);
/** The stuck gate, in the gateway in the yard's east wall. */
export const YARD_GATE_TILE = { col: 18, row: 7 } as const;
/** Where Andrew stands to shove the gate: the end of the fenced path. The keg puzzle is solved once he can walk here. */
export const YARD_GATE_FRONT = { col: 17, row: 7 } as const;
/** Playtest 7: the hoist lever, on the end of the path's north wall by its mouth. E at it puts the kegs back where they started. */
export const KEG_LEVER_TILE = { col: 11, row: 5 } as const;
/** The open yard end of the fenced path: the keg puzzle's walk starts here. */
export const YARD_PATH_MOUTH = { col: 11, row: 7 } as const;
export const PUB_BACK_ARRIVAL = T(27, 14);
export const STREET_ARRIVAL = T(3, 8);
export const ROAD_ARRIVAL = T(2, 8);
export const STREET_WEST_ARRIVAL = T(2, 9);
/** Big Tom's hurley, left against the tractor; E takes it. */
export const HURLEY_TILE = { col: 64, row: 8 } as const;

/**
 * Keg puzzle: play area top-left tile and local-to-tile mapping. Playtest 6: the area is the fenced path to the
 * gate, three tiles wide (rows 6 to 8), cols 12 to 16. It opens onto the yard at col 11; col 17 is the gate's step.
 */
export const KEG_AREA = { col: 12, row: 6, width: 5, height: 3 } as const;
export const kegTile = (x: number, y: number) => ({ col: KEG_AREA.col + x, row: KEG_AREA.row + y });

/** Street landmarks (tiles) the boss hooks refer to; both are solid props Big Tom's charge stops at. */
export const TRACTOR = { col: 65, row: 7, width: 3, height: 2 } as const;
/** Playtest 6: a builder's skip at the west end of the arena (it replaces a church gate that stood in the road). */
export const SKIP = { col: 41, row: 7, width: 2, height: 2 } as const;
/** The fruit machine on the pub's west wall (the melee hook area). */
export const MACHINE_AREA = tilesArea(1, 6, 1, 2);
/** Where the bog lights start on the road (tile of the prop's top-left). */
export const BOG_LIGHTS_START = { col: 18, row: 11 } as const;
export const ROAD_DARK: ScreenAmbient = { tint: 'navyDark', strength: 0.75 };

// ---------------------------------------------------------------------------
// c1.pub 30 x 17
// ---------------------------------------------------------------------------

export function pubScreen(): ScreenLayout {
  const c = new Canvas(30, 17, '.').room();
  // Bar along the top wall: shelves, the staff side (closed off), the counter.
  c.rect(4, 1, 18, 1, 'S');
  c.rect(3, 2, 1, 2, 'W').rect(22, 2, 1, 2, 'W');
  c.rect(4, 3, 18, 1, 'c');
  // Four tables. The last one is Myko's, in the bottom left corner.
  c.rect(7, 7, 2, 1, 't').set(6, 7, 's').set(9, 7, 's');
  c.rect(13, 10, 2, 1, 't').set(12, 10, 's').set(15, 10, 's');
  c.rect(20, 8, 2, 1, 't').set(19, 8, 's').set(22, 8, 's');
  c.rect(3, 13, 2, 1, 't').set(2, 13, 's');
  // Back door to the keg yard, bottom right.
  c.rect(26, 15, 2, 2, 'd');
  const exits: ExitDef[] = [{ id: 'c1.pub.backdoor', area: tilesArea(26, 15, 2, 2), toScreen: 'c1.yard', spawn: YARD_ARRIVAL }];
  const dressing: ScreenDressing = {
    props: [
      // The urn on the staff side of the bar, beside Andrew's stool.
      { id: 'urn', frame: PROP.hotDrinkUrn, col: 5, row: 2 },
      // Steam while the free hot drink can be taken (the script shows and hides it).
      { id: 'urn.steam', frame: PROP.steam[0], frames: PROP.steam, frameRate: 4, col: 5, row: 1, hidden: true },
      { frame: PROP.beerTaps, col: 8, row: 2 },
      { frame: PROP.beerTaps, col: 14, row: 2 },
      { frame: PROP.trophyShelf, col: 24, row: 1 },
      { frame: PROP.telly, col: 27, row: 1 },
      { frame: PROP.fruitMachine, col: 1, row: 6 },
      { frame: PROP.teamPhoto, col: 1, row: 4 },
      { frame: PROP.dartboard, col: 1, row: 10 },
      // Things to break while waiting on the pint.
      { id: 'pub.p1', frame: PROP.barrel, col: 27, row: 6, solid: { width: 1, height: 1 }, breakable: {} },
      { id: 'pub.p3', frame: PROP.cardboardBox, col: 27, row: 12, solid: { width: 1, height: 1 }, breakable: {} },
      { id: 'pub.p5', frame: PROP.bottleCrate, col: 10, row: 14, solid: { width: 1, height: 1 }, breakable: {} },
      { id: 'pub.p6', frame: PROP.sack, col: 11, row: 14, solid: { width: 1, height: 1 }, breakable: {} },
      { id: 'pub.p7', frame: PROP.barrel, col: 2, row: 14, solid: { width: 1, height: 1 }, breakable: {} },
    ],
    npcs: [
      { id: 'dympna', npc: 'dympna', col: 21, row: 2, facing: 'down', examinableId: 'c1.dympna' },
      { id: 'local1', npc: 'localB', col: 8, row: 8, facing: 'up' },
      { id: 'local2', npc: 'localA', col: 14, row: 11, facing: 'up' },
    ],
  };
  return c.build('c1.pub', exits, PUB_ARRIVAL, { mykoStart: MYKO_SEAT, dressing });
}

// ---------------------------------------------------------------------------
// c1.yard 20 x 17
// ---------------------------------------------------------------------------

export function yardScreen(): ScreenLayout {
  const c = new Canvas(20, 17, 'y').room();
  // Door back into the pub, top left.
  c.rect(4, 0, 2, 2, 'd');
  // The way to Main Street: a gateway in the east wall between two stone posts, and a paved path to it, walled on
  // both sides from the yard (rows 5 and 9). The path is open at its west end (col 11); the kegs stand across it.
  c.rect(11, 6, 7, 3, ',').rect(18, 7, 2, 1, 'p');
  c.rect(11, 5, 7, 1, 'K').rect(11, 9, 7, 1, 'K').set(17, 6, 'K').set(17, 8, 'K');
  c.set(17, 7, 'p');
  c.set(18, 6, 'K').set(18, 8, 'K');
  // Stacked crates along the south and west, out of the way of the puzzle.
  c.rect(2, 12, 2, 2, 'o').rect(8, 13, 2, 1, 'o').rect(2, 4, 1, 2, 'o').rect(5, 14, 1, 1, 'o');
  const exits: ExitDef[] = [
    { id: 'c1.yard.door', area: tilesArea(4, 0, 2, 2), toScreen: 'c1.pub', spawn: PUB_BACK_ARRIVAL },
    { id: 'c1.yard.gate', area: tilesArea(18, 7, 2, 1), toScreen: 'c1.street', spawn: STREET_ARRIVAL, lockedUntil: ['c1.explore.yard'] },
  ];
  // The gate is stuck: solid in the gateway (18,7) until The Shoulder shifts it. It is not part of the keg puzzle.
  const dressing: ScreenDressing = {
    props: [
      { id: 'yardGate', frame: PROP.yardGate, col: YARD_GATE_TILE.col, row: YARD_GATE_TILE.row, solid: { width: 1, height: 1 } },
      // The hoist lever, on the wall (no footprint of its own): puts the kegs back (the keg puzzle's reset).
      { id: 'yard.lever', frame: PROP.lever.up, col: KEG_LEVER_TILE.col, row: KEG_LEVER_TILE.row },
      // Spare kit lying about the yard, clear of the kegs and the gate path.
      { id: 'yard.p1', frame: PROP.barrel, col: 2, row: 8, solid: { width: 1, height: 1 }, breakable: {} },
      { id: 'yard.p2', frame: PROP.bottleCrate, col: 3, row: 8, solid: { width: 1, height: 1 }, breakable: {} },
      { id: 'yard.p3', frame: PROP.sack, col: 6, row: 11, solid: { width: 1, height: 1 }, breakable: {} },
      { id: 'yard.p4', frame: PROP.cardboardBox, col: 7, row: 14, solid: { width: 1, height: 1 }, breakable: {} },
      { id: 'yard.p5', frame: PROP.barrel, col: 12, row: 14, solid: { width: 1, height: 1 }, breakable: {} },
      { id: 'yard.p10', frame: PROP.cardboardBox, col: 13, row: 2, solid: { width: 1, height: 1 }, breakable: {} },
      { id: 'yard.p11', frame: PROP.barrel, col: 9, row: 3, solid: { width: 1, height: 1 }, breakable: {} },
    ],
  };
  const ambient: ScreenAmbient = {
    tint: 'navyDark',
    strength: 0.45,
    lights: [{ x: 5 * 16, y: 2 * 16 + 8, radius: 60, colour: 'amber' }],
  };
  return c.build('c1.yard', exits, YARD_ARRIVAL, { dressing, ambient });
}

// ---------------------------------------------------------------------------
// c1.street 70 x 17
// ---------------------------------------------------------------------------

export function streetScreen(): ScreenLayout {
  const c = new Canvas(70, 17, 'p');
  c.rect(0, 0, 70, 1, '#').rect(0, 15, 70, 2, '#').rect(0, 0, 1, 17, '#').rect(69, 0, 1, 17, '#');
  // Frontages along the top (roof, then two storeys of wall), pavement, kerb, road, kerb, pavement, hedge.
  c.rect(1, 1, 68, 2, 'R').rect(1, 3, 68, 2, 'W');
  c.rect(1, 5, 68, 1, ',').rect(1, 6, 68, 1, 'k').rect(1, 12, 68, 1, 'k').rect(1, 13, 68, 1, ',');
  c.rect(1, 14, 68, 1, 'H');
  for (let col = 4; col < 68; col += 4) c.set(col, 9, 'l');
  // Feeney's, cols 2 to 14: lit windows, a wooden double door under the sign.
  for (const col of [4, 5, 11, 12]) c.set(col, 3, 'w').set(col, 4, 'w');
  c.rect(8, 4, 2, 1, 'D');
  // The bookies, cols 16 to 24: dark shopfront, wooden door.
  c.rect(17, 3, 2, 2, 'Y').rect(22, 3, 2, 2, 'Y');
  c.set(20, 4, 'D');
  // The alley between the bookies and the chipper (the bins are props).
  c.rect(25, 1, 3, 4, 'p');
  // The chipper, cols 28 to 39: lit shopfront, lit double door, warm ground in front.
  c.rect(29, 3, 3, 2, 'X').rect(36, 3, 3, 2, 'X');
  c.rect(33, 4, 2, 1, 'E');
  c.rect(28, 5, 12, 1, 'L');
  // The church wall, cols 40 to 60, with a roof above, and a hedge past it.
  c.rect(40, 1, 21, 2, 'R').rect(40, 3, 21, 2, 'C').rect(61, 1, 8, 4, 'H');
  // The road out of town, east end.
  c.rect(69, 9, 1, 3, 'p');
  // The west end opens onto the yard gate.
  c.rect(0, 8, 1, 2, 'p');
  const exits: ExitDef[] = [
    { id: 'c1.street.west', area: tilesArea(0, 8, 1, 2), toScreen: 'c1.yard', spawn: YARD_FROM_STREET },
    { id: 'c1.street.east', area: tilesArea(68, 9, 2, 3), toScreen: 'c1.road', spawn: ROAD_ARRIVAL, lockedUntil: ['c1.boss.bigtom'] },
  ];
  const dressing: ScreenDressing = {
    props: [
      { frame: PROP.pubSign, col: 8, row: 3 },
      { frame: PROP.bookiesSign, col: 19, row: 3 },
      // The bins close the alley mouth over the whiskey. A thrown bottle breaks them; they hold nothing themselves.
      { id: 'bins1', frame: PROP.bins, col: 25, row: 4, solid: { width: 1, height: 1 }, breakable: { loot: 'none' } },
      { id: 'bins2', frame: PROP.bins, col: 26, row: 4, solid: { width: 1, height: 1 }, breakable: { loot: 'none' } },
      { id: 'bins3', frame: PROP.bins, col: 27, row: 4, solid: { width: 1, height: 1 }, breakable: { loot: 'none' } },
      // Other things along the street that break: the region's table decides (a stout, now and then, or nothing).
      // Playtest 6: scattered over both pavements and the kerbs, alone, in pairs and in small heaps, not in a row.
      // The road in Big Tom's arena (cols 41 to 67, rows 7 to 11) stays clear for his charge.
      { id: 'street.p1', frame: PROP.barrel, col: 4, row: 5, solid: { width: 1, height: 1 }, breakable: {} },
      { id: 'street.p2', frame: PROP.bottleCrate, col: 5, row: 5, solid: { width: 1, height: 1 }, breakable: {} },
      { id: 'street.barrel1', frame: PROP.barrel, col: 11, row: 12, solid: { width: 1, height: 1 }, breakable: {} },
      { id: 'street.p3', frame: PROP.sack, col: 17, row: 13, solid: { width: 1, height: 1 }, breakable: {} },
      { id: 'street.crate1', frame: PROP.bottleCrate, col: 18, row: 13, solid: { width: 1, height: 1 }, breakable: {} },
      { id: 'street.p4', frame: PROP.cardboardBox, col: 17, row: 12, solid: { width: 1, height: 1 }, breakable: {} },
      { id: 'street.p5', frame: PROP.barrel, col: 21, row: 5, solid: { width: 1, height: 1 }, breakable: {} },
      { id: 'street.box1', frame: PROP.cardboardBox, col: 36, row: 13, solid: { width: 1, height: 1 }, breakable: { loot: 'none' } },
      { id: 'street.p6', frame: PROP.bottleCrate, col: 37, row: 12, solid: { width: 1, height: 1 }, breakable: {} },
      { id: 'street.p7', frame: PROP.sack, col: 49, row: 13, solid: { width: 1, height: 1 }, breakable: {} },
      { id: 'street.p8', frame: PROP.barrel, col: 50, row: 13, solid: { width: 1, height: 1 }, breakable: {} },
      { id: 'street.sack1', frame: PROP.sack, col: 57, row: 5, solid: { width: 1, height: 1 }, breakable: {} },
      { id: 'street.p9', frame: PROP.bottleCrate, col: 61, row: 12, solid: { width: 1, height: 1 }, breakable: {} },
      { id: 'street.p11', frame: PROP.barrel, col: 62, row: 13, solid: { width: 1, height: 1 }, breakable: {} },
      // Tom leaves his hurley against the tractor when he sits down.
      { id: 'hurley', frame: PROP.weapon.hurley, col: HURLEY_TILE.col, row: HURLEY_TILE.row, hidden: true },
      { frame: PROP.chipperSign, col: 33, row: 3 },
      // The church gate, set in the church wall where it belongs. Scenery: the wall behind it is solid already.
      { frame: PROP.churchGate, col: 49, row: 3 },
      // A skip at the west end of the arena, the tractor at the east end: Big Tom's charge stops at either.
      { frame: PROP.skip, col: SKIP.col, row: SKIP.row, solid: { width: SKIP.width, height: SKIP.height } },
      { frame: PROP.tractor, col: TRACTOR.col, row: TRACTOR.row, solid: { width: TRACTOR.width, height: TRACTOR.height } },
      // Big Tom folds his jacket on the church wall in phase 2.
      { id: 'jacket', frame: PROP.foldedJacket, col: 56, row: 4, hidden: true },
    ],
    npcs: [
      { id: 'queue1', npc: 'localA', col: 31, row: 5, facing: 'up' },
      { id: 'queue2', npc: 'localB', col: 32, row: 5, facing: 'up' },
      // The one who takes the last spice bag; the first lad takes his place when the fight starts.
      { id: 'queue3', npc: 'localA', col: 33, row: 6, facing: 'up' },
    ],
  };
  const ambient: ScreenAmbient = {
    tint: 'navyDark',
    strength: 0.5,
    lights: [
      { x: 34 * 16, y: 6 * 16, radius: 80, colour: 'amberLight', glow: 0.3 },
      { x: 9 * 16, y: 5 * 16, radius: 36, colour: 'amber' },
      { x: 18 * 16, y: 4 * 16, radius: 30, colour: 'amber' },
      { x: 42 * 16, y: 8 * 16, radius: 56, colour: 'fog', glow: 0.12 },
    ],
  };
  return c.build('c1.street', exits, STREET_ARRIVAL, { dressing, ambient });
}

// ---------------------------------------------------------------------------
// c1.road 30 x 17
// ---------------------------------------------------------------------------

export function roadScreen(): ScreenLayout {
  const c = new Canvas(30, 17, 'b');
  c.rect(0, 0, 30, 1, '#').rect(0, 16, 30, 1, '#').rect(0, 0, 1, 17, '#').rect(29, 0, 1, 17, '#');
  // Hedge and night grass behind the north wall, the road, a low wall on the south side, then bog.
  c.rect(1, 1, 28, 1, 'H').rect(1, 2, 28, 4, 'n');
  c.rect(1, 6, 28, 1, 'K').rect(14, 6, 2, 1, 'G');
  c.rect(1, 7, 28, 3, 'p');
  c.rect(1, 10, 28, 1, 'K');
  for (const [col, row] of [[4, 12], [5, 12], [11, 14], [12, 14], [12, 13], [19, 12], [20, 12], [20, 13], [25, 14], [26, 14]] as const) c.set(col, row, 'P');
  for (const [col, row] of [[8, 12], [16, 13], [22, 15], [3, 15], [27, 12]] as const) c.set(col, row, 'r');
  const dressing: ScreenDressing = {
    props: [{ id: 'bogLights', frame: PROP.bogLights[0], frames: PROP.bogLights, frameRate: 3, col: BOG_LIGHTS_START.col, row: BOG_LIGHTS_START.row, hidden: true }],
  };
  return c.build('c1.road', [], ROAD_ARRIVAL, { dressing, ambient: ROAD_DARK });
}
