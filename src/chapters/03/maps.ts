/**
 * Chapter 3 screens as tile layouts, dressing and sodium-light ambience. Level data only
 * (docs/chapters/03-regional-office.md): the yard, the office and warehouse, and the loading bay.
 * Painted on the shared character canvas, so the walls and the sight lines come from the tile art.
 */

import { PROP } from '../../art/props';
import type { ExitDef, PropPlacement, ScreenAmbient, ScreenDressing, ScreenLayout } from '../../core/chapter';
import type { StealthSectionDef } from '../../core/types';
import { Canvas, T, tilesArea } from '../canvas';
import { PEN, PILLARS, PEN_ENTRANCE_COLS, DOOR_COL, NOOK_WALL } from './puzzle';

export { T, tilesArea };

// ---------------------------------------------------------------------------
// Shared level data
// ---------------------------------------------------------------------------

/** The social club: Andrew arrives inside the door, the kettle is on the counter beside him. */
export const BAR_ARRIVAL = T(5, 20);
export const KETTLE_SPOT = T(5, 19);
export const MYKO_CHAIR = T(7, 20);
/** The yard door to the office, and where Andrew steps out when he comes back. */
export const OFFICE_ARRIVAL = T(8, 3);
export const YARD_FROM_OFFICE = T(33, 3);
export const BAY_ARRIVAL = T(3, 17);
export const OFFICE_FROM_BAY = T(46, 21);

/** Yard: where the stealth section starts (stepping out of the gap) and where it is passed (the office door). */
export const YARD_START_AREA = tilesArea(13, 16, 8, 8);
export const YARD_EXIT_AREA = tilesArea(31, 2, 6, 3);

/** Office: the filing cabinet, and the area a swing at it touches. */
export const CABINET_TILE = { col: 28, row: 2 } as const;
export const CABINET_HIT_AREA = tilesArea(27, 2, 3, 3);
export const WHISKEY_SPOT = T(28, 4);
export const CLUE_SPOTS = {
  map: T(22, 2),
  certificate: T(27, 2),
  brochure: T(13, 5),
  visitors: T(10, 8),
} as const;

/** Bay: the manifest, the reset lever, the stouts and where each beat starts. */
export const MANIFEST_SPOT = T(6, 3);
export const LEVER_SPOT = T(2, 15);
/** The noticeboard in the bay office where the string goes: E opens the deduction board once the night shift is down. */
export const BOARD_SPOT = T(9, 3);
export const STOUT_SPOTS = [T(35, 20), T(36, 20)] as const;
export const DOORS_AREA = tilesArea(24, 19, 12, 3);
export const BOSS_AREA = tilesArea(18, 10, 12, 6);
export const GANTRY_ZONE = tilesArea(13, 2, 24, 2);
export const HALLORAN_START_TILE = { col: 25, row: 12 } as const;
export const HALLORAN_START = T(HALLORAN_START_TILE.col, HALLORAN_START_TILE.row);
/** The four crate stacks in the arena, as [col, row] of the sprite's top-left; the solid tile is the row below. */
/** Playtest 7: empties on the bay floor for the gantry fight, in throwing range of the gantry, clear of the stacks and the forklift. */
export const BAY_BOTTLE_SPOTS = [T(13, 7), T(19, 7), T(29, 7), T(21, 14), T(13, 13)] as const;
export const STACKS = [
  { id: 'bay.stack1', col: 15, row: 9 },
  { id: 'bay.stack2', col: 15, row: 16 },
  { id: 'bay.stack3', col: 34, row: 9 },
  { id: 'bay.stack4', col: 34, row: 16 },
] as const;
/** The tile of each stack that the forks stick in. */
export const stackTile = (s: (typeof STACKS)[number]): { col: number; row: number } => ({ col: s.col, row: s.row + 1 });

const SODIUM: ScreenAmbient = { tint: 'navyDark', strength: 0.5 };
export const BAY_DARK: ScreenAmbient = {
  tint: 'navyDark',
  strength: 0.7,
  lights: [
    { x: 7 * 16, y: 3 * 16, radius: 40, colour: 'amberLight' },
    { x: 24 * 16, y: 3 * 16, radius: 40, colour: 'fog', glow: 0.1 },
  ],
};
/** The lights come on once the manifest is found. */
export const BAY_LIT: ScreenAmbient = {
  tint: 'navyDark',
  strength: 0.15,
  lights: [
    { x: 7 * 16, y: 3 * 16, radius: 60, colour: 'amberLight' },
    { x: 14 * 16, y: 10 * 16, radius: 120, colour: 'fluoro', glow: 0.12 },
    { x: 30 * 16, y: 12 * 16, radius: 140, colour: 'fluoro', glow: 0.12 },
  ],
};

const box = (id: string, frame: string, col: number, row: number): PropPlacement => ({ id, frame, col, row, solid: { width: 1, height: 1 }, breakable: {} });

// ---------------------------------------------------------------------------
// The stealth section: a watchman and two suits by the vans
// ---------------------------------------------------------------------------

export const YARD_STEALTH: StealthSectionDef = {
  id: 'c3.stealth.yard',
  checkpointId: 'c3.cp.yard',
  guards: [
    {
      // The watchman: a fixed loop round the pallet stack, stopping at two corners to look at his phone.
      enemyId: 'suit',
      route: {
        mode: 'loop',
        waypoints: [
          { position: T(15, 6), waitMs: 1000, facing: 'right' },
          { position: T(24, 6), waitMs: 3500, facing: 'down' },
          { position: T(24, 15), waitMs: 1000, facing: 'left' },
          { position: T(15, 15), waitMs: 3500, facing: 'up' },
        ],
      },
    },
    {
      enemyId: 'suit',
      route: {
        mode: 'pingPong',
        waypoints: [
          { position: T(28, 9), waitMs: 2000, facing: 'down' },
          { position: T(28, 14), waitMs: 2000, facing: 'up' },
        ],
      },
    },
    {
      enemyId: 'suit',
      route: {
        mode: 'pingPong',
        waypoints: [
          { position: T(28, 17), waitMs: 2000, facing: 'down' },
          { position: T(28, 21), waitMs: 2000, facing: 'up' },
        ],
      },
    },
  ],
  hazards: [],
  hidingProps: [],
  reward: { kind: 'clue', clueId: 'c3.clue.logbook' },
};

// ---------------------------------------------------------------------------
// c3.yard 40 x 25
// ---------------------------------------------------------------------------

export function yardScreen(): ScreenLayout {
  const c = new Canvas(40, 25, 'y');
  c.rect(0, 0, 40, 1, '#').rect(0, 24, 40, 1, '#').rect(0, 0, 1, 25, '#').rect(39, 0, 1, 25, '#');
  // The office building along the north side, and its door.
  c.rect(1, 1, 38, 1, 'W').rect(33, 0, 2, 2, 'd');
  // The gap in the fence behind the skip, and the nook beyond it.
  c.rect(1, 15, 12, 1, 'f').rect(12, 15, 1, 6, 'f').set(12, 23, 'f');
  // The portacabin: back wall, side walls, a floor, a front wall with the door at its right-hand end.
  c.rect(2, 17, 8, 1, '#').rect(2, 18, 8, 1, 'W').rect(2, 19, 1, 3, 'W').rect(9, 19, 1, 3, 'W');
  c.rect(3, 19, 6, 3, '.').rect(2, 22, 8, 1, 'W').rect(7, 22, 2, 1, 'd').rect(4, 19, 3, 1, 'c');
  // Pallet stacks and crates: the cover.
  c.rect(18, 9, 4, 3, 'o').rect(8, 6, 3, 2, 'o').rect(26, 5, 2, 3, 'o').rect(14, 17, 2, 2, 'o');
  c.rect(24, 19, 3, 2, 'o').rect(35, 8, 2, 3, 'o').rect(5, 11, 2, 2, 'o').rect(20, 21, 2, 2, 'o');
  // Chain-link fence in short runs, away from every route.
  c.rect(3, 7, 4, 1, 'f').rect(34, 14, 1, 5, 'f').rect(10, 12, 1, 3, 'f');
  // Lit ground under the floodlights.
  c.rect(17, 3, 3, 2, 'L').rect(29, 14, 4, 1, 'L').rect(16, 13, 2, 2, 'L');
  const exits: ExitDef[] = [{ id: 'c3.yard.door', area: tilesArea(33, 0, 2, 2), toScreen: 'c3.office', spawn: OFFICE_ARRIVAL }];
  const props: PropPlacement[] = [
    // The social club from outside, a long side to the yard, and what is in it.
    { id: 'bar.cabin.1', frame: PROP.portacabin, col: 3, row: 17 },
    { id: 'bar.cabin.2', frame: PROP.portacabin, col: 6, row: 17 },
    { id: 'bar.sheet', frame: PROP.signUpSheet, col: 7, row: 18 },
    { id: 'bar.dartboard', frame: PROP.dartboard, col: 2, row: 20 },
    { id: 'bar.fridge', frame: PROP.clubFridge, col: 8, row: 19, solid: { width: 1, height: 1 } },
    { id: 'bar.kettle', frame: PROP.kettle, col: 5, row: 19 },
    // Steam while the free hot drink can be taken (the script shows and hides it).
    { id: 'bar.steam', frame: PROP.steam[0], frames: PROP.steam, frameRate: 4, col: 5, row: 18, hidden: true },
    // The gap's skip: it hides the way in from the yard.
    { id: 'yard.skip', frame: PROP.skip, col: 13, row: 19, solid: { width: 2, height: 2 }, blocksSight: true },
    // Two parked vans. The first has the twin wheels from the bog.
    { id: 'yard.van1', frame: PROP.van.left, col: 30, row: 11, solid: { dy: 1, width: 3, height: 1 }, blocksSight: true },
    { id: 'yard.van2', frame: PROP.van.right, col: 30, row: 17, solid: { dy: 1, width: 3, height: 1 }, blocksSight: true },
    // The watchman's logbook, left on his chair by the door; shown after a clean run.
    { id: 'yard.logbook', frame: PROP.logbook, col: 36, row: 3, hidden: true },
    // Pallets, flat on the ground.
    { frame: PROP.pallet, col: 17, row: 13, layer: 'floor' },
    { frame: PROP.pallet, col: 18, row: 13, layer: 'floor' },
    { frame: PROP.pallet, col: 22, row: 3, layer: 'floor' },
    { frame: PROP.pallet, col: 3, row: 3, layer: 'floor' },
    // Odds and ends: singles, pairs and small heaps, off every route.
    box('yard.p1', PROP.barrel, 3, 4),
    box('yard.p2', PROP.sack, 4, 4),
    box('yard.p3', PROP.bottleCrate, 12, 9),
    box('yard.p4', PROP.barrel, 37, 12),
    box('yard.p5', PROP.sack, 37, 13),
    box('yard.p6', PROP.bottleCrate, 35, 21),
    box('yard.p7', PROP.cardboardBox, 36, 21),
    box('yard.p8', PROP.barrel, 36, 22),
    box('yard.p9', PROP.cardboardBox, 29, 3),
    box('yard.p10', PROP.sack, 9, 13),
    box('yard.p11', PROP.barrel, 23, 22),
    box('yard.p12', PROP.bottleCrate, 3, 13),
  ];
  const dressing: ScreenDressing = { props };
  const ambient: ScreenAmbient = {
    ...SODIUM,
    lights: [
      { x: 5 * 16 + 8, y: 20 * 16, radius: 56, colour: 'amber' },
      { x: 18 * 16 + 8, y: 4 * 16, radius: 70, colour: 'amberLight', glow: 0.2 },
      { x: 30 * 16 + 8, y: 14 * 16, radius: 80, colour: 'amberLight', glow: 0.2 },
      { x: 17 * 16, y: 14 * 16, radius: 56, colour: 'amberLight', glow: 0.15 },
      { x: 34 * 16, y: 3 * 16, radius: 56, colour: 'amber' },
    ],
  };
  return c.build('c3.yard', exits, BAR_ARRIVAL, { mykoStart: MYKO_CHAIR, dressing, ambient });
}

// ---------------------------------------------------------------------------
// c3.office 50 x 30
// ---------------------------------------------------------------------------

export function officeScreen(): ScreenLayout {
  const c = new Canvas(50, 30, '.').room();
  // The door from the yard, top left.
  c.rect(8, 0, 2, 2, 'd');
  // Halloran's office: walls, and a door in the south wall.
  c.rect(17, 2, 1, 9, '#').rect(31, 2, 1, 9, '#').rect(17, 10, 15, 1, '#').rect(18, 11, 13, 1, 'W').rect(23, 10, 2, 2, 'd');
  // A reception table for the brochure.
  c.set(13, 5, 't');
  // The wall between the office and the warehouse, with a wide door.
  c.rect(2, 14, 46, 1, '#').rect(2, 15, 46, 1, 'W').rect(24, 14, 3, 2, 'd');
  // The way to the bay, east end of the warehouse.
  c.rect(48, 20, 2, 3, 'd');
  const exits: ExitDef[] = [
    { id: 'c3.office.door', area: tilesArea(8, 0, 2, 2), toScreen: 'c3.yard', spawn: YARD_FROM_OFFICE },
    { id: 'c3.office.bay', area: tilesArea(48, 20, 2, 3), toScreen: 'c3.bay', spawn: BAY_ARRIVAL },
  ];
  const shelf = (id: string, col: number, row: number): PropPlacement => ({ id, frame: PROP.drumShelf, col, row, solid: { width: 2, height: 1 }, blocksSight: true });
  const runs: ReadonlyArray<readonly [number, readonly number[]]> = [
    [18, [4, 6, 8, 10, 30, 32, 34, 36]],
    [21, [8, 10, 12, 14, 34, 36, 38, 40]],
    [24, [4, 6, 8, 10, 12, 14, 28, 30, 32, 34]],
  ];
  const props: PropPlacement[] = [
    // Reception.
    { id: 'office.plant', frame: PROP.deadPlant, col: 6, row: 3, solid: { width: 1, height: 1 } },
    { id: 'office.recdesk', frame: PROP.officeDesk, col: 9, row: 8, solid: { width: 2, height: 1 } },
    { id: 'office.visitors', frame: PROP.visitorsBook, col: 10, row: 8 },
    { id: 'office.brochure', frame: PROP.brochure, col: 13, row: 5 },
    // Halloran's office.
    { id: 'office.map', frame: PROP.wallMap, col: 22, row: 1 },
    { id: 'office.certificate', frame: PROP.certificate, col: 27, row: 1 },
    { id: 'office.cabinet', frame: PROP.filingCabinet.shut, col: CABINET_TILE.col, row: CABINET_TILE.row, solid: { dy: 1, width: 1, height: 1 } },
    { id: 'office.deskH', frame: PROP.officeDesk, col: 22, row: 6, solid: { width: 2, height: 1 } },
    // The open-plan desks on the east side.
    { frame: PROP.officeDesk, col: 35, row: 4, solid: { width: 2, height: 1 } },
    { frame: PROP.officeDesk, col: 40, row: 4, solid: { width: 2, height: 1 } },
    { frame: PROP.officeDesk, col: 35, row: 8, solid: { width: 2, height: 1 } },
    { frame: PROP.officeDesk, col: 40, row: 8, solid: { width: 2, height: 1 } },
    // The warehouse: aisles of identical unlabelled drums.
    ...runs.flatMap(([row, cols]) => cols.map((col) => shelf(`wh.${row}.${col}`, col, row))),
    // Kit about the place: singles, pairs and heaps, never in the aisles' way.
    box('office.p1', PROP.cardboardBox, 3, 9),
    box('office.p2', PROP.cardboardBox, 38, 11),
    box('office.p3', PROP.sack, 44, 5),
    box('office.p4', PROP.barrel, 3, 17),
    box('office.p5', PROP.bottleCrate, 4, 17),
    box('office.p6', PROP.barrel, 20, 20),
    box('office.p7', PROP.sack, 21, 20),
    box('office.p8', PROP.cardboardBox, 21, 21),
    box('office.p9', PROP.bottleCrate, 26, 18),
    box('office.p10', PROP.sack, 45, 17),
    box('office.p11', PROP.barrel, 17, 26),
    box('office.p12', PROP.cardboardBox, 40, 26),
    box('office.p13', PROP.bottleCrate, 41, 26),
    { frame: PROP.pallet, col: 24, row: 18, layer: 'floor' },
    { frame: PROP.pallet, col: 25, row: 18, layer: 'floor' },
  ];
  const ambient: ScreenAmbient = {
    tint: 'navyDark',
    strength: 0.3,
    lights: [
      { x: 8 * 16, y: 5 * 16, radius: 90, colour: 'fluoro', glow: 0.1 },
      { x: 24 * 16, y: 5 * 16, radius: 90, colour: 'amberLight', glow: 0.15 },
      { x: 24 * 16, y: 20 * 16, radius: 130, colour: 'fluoro', glow: 0.08 },
    ],
  };
  return c.build('c3.office', exits, OFFICE_ARRIVAL, { dressing: { props }, ambient });
}

// ---------------------------------------------------------------------------
// c3.bay 40 x 25
// ---------------------------------------------------------------------------

export function bayScreen(): ScreenLayout {
  const c = new Canvas(40, 25, '.').room();
  // The way in from the warehouse.
  c.rect(0, 16, 2, 3, 'd');
  // The bay office (rows 2 to 3) and the pen below it: walls all round, a door in the north wall, a way in at the south.
  c.rect(2, 2, 1, 10, '#').rect(11, 2, 1, 10, '#').rect(2, 4, 10, 1, '#').rect(2, 11, 10, 1, '#').rect(2, 12, 10, 1, 'W');
  const doorCol = PEN.col + DOOR_COL;
  c.set(doorCol, 4, 'd');
  for (const e of PEN_ENTRANCE_COLS) c.set(PEN.col + e, 11, '.').set(PEN.col + e, 12, '.');
  // The pen's top row is wall, but for a nook under the door.
  for (const w of NOOK_WALL) c.set(PEN.col + w.x, PEN.row + w.y, '#');
  // The pillars: a wall across the pen with a way round at each end, and two more. Drawn as wall (playtest 7): the
  // region's 'K' tile looks like a crate, and these must never be mistaken for ones that move.
  for (const p of PILLARS) c.set(PEN.col + p.x, PEN.row + p.y, '#');
  // The gantry: a walkway along the north wall behind a chain-link rail.
  c.rect(12, 2, 26, 2, 'b').rect(12, 4, 26, 1, 'f');
  const exits: ExitDef[] = [{ id: 'c3.bay.door', area: tilesArea(0, 16, 2, 3), toScreen: 'c3.office', spawn: OFFICE_FROM_BAY }];
  const props: PropPlacement[] = [
    // The forklift, parked where Halloran will get on it. Hidden when he does (the boss sprite takes over).
    { id: 'bay.forklift', frame: PROP.forkliftParked, col: HALLORAN_START_TILE.col - 1, row: HALLORAN_START_TILE.row - 1, solid: { dy: 1, width: 2, height: 1 } },
    // The bay office desk and the manifest on it.
    { id: 'bay.desk', frame: PROP.officeDesk, col: 5, row: 2, solid: { width: 2, height: 1 } },
    { id: 'bay.manifest', frame: PROP.manifest, col: 6, row: 3 },
    { id: 'bay.board', frame: PROP.noticeboard, col: 9, row: 2 },
    // The reset lever by the entrance.
    { id: 'bay.lever', frame: PROP.lever.up, col: 2, row: 15, solid: { width: 1, height: 1 } },
    // Gantry rail, repeating along the row.
    ...Array.from({ length: 26 }, (_, i) => ({ frame: PROP.gantryRail, col: 12 + i, row: 4 })),
    // The roller doors in the south wall, the crate of stouts beside them.
    { id: 'bay.door1', frame: PROP.rollerDoor.shut, col: 26, row: 22 },
    { id: 'bay.door2', frame: PROP.rollerDoor.shut, col: 31, row: 22 },
    { id: 'bay.stouts', frame: PROP.bottleCrate, col: 35, row: 20 },
    // The four stacks of crates in the arena: two hits each.
    ...STACKS.map(
      (s): PropPlacement => ({
        id: s.id,
        frame: PROP.crateStack.whole,
        col: s.col,
        row: s.row,
        solid: { dy: 1, width: 1, height: 1 },
        breakable: { hits: 2, loot: 'none' },
      }),
    ),
    // Odds and ends along the walls, clear of the arena and the way in.
    box('bay.p1', PROP.barrel, 4, 21),
    box('bay.p2', PROP.sack, 5, 21),
    box('bay.p3', PROP.cardboardBox, 13, 22),
    box('bay.p4', PROP.bottleCrate, 20, 21),
    box('bay.p5', PROP.barrel, 21, 21),
    box('bay.p6', PROP.sack, 37, 14),
    box('bay.p7', PROP.cardboardBox, 8, 15),
    box('bay.p8', PROP.barrel, 37, 6),
  ];
  return c.build('c3.bay', exits, BAY_ARRIVAL, { dressing: { props }, ambient: BAY_DARK });
}
