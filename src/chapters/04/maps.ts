/**
 * Chapter 4 screens as tile layouts, dressing and night ambience. Level data only
 * (docs/chapters/04-southie.md): Paddy O'Shamrock's and Pier Nine, both in the
 * `cities` region. The airport is a caption, not a screen.
 */

import { PROP } from '../../art/props';
import type { ExitDef, PropPlacement, ScreenAmbient, ScreenDressing, ScreenLayout } from '../../core/chapter';
import type { StealthSectionDef } from '../../core/types';
import { Canvas, T, tilesArea } from '../canvas';

export { T, tilesArea };

// ---------------------------------------------------------------------------
// c4.bar: Paddy O'Shamrock's, 40 x 22
// ---------------------------------------------------------------------------

/** The stool nearest the front door: where Andrew arrives, at the start and after every return. */
export const BAR_ARRIVAL = T(5, 6);
/** Where E asks Colleen-Ann for the tea (the hot drink is offered here), in front of the counter. */
export const TEA_SPOT = T(8, 6);
/** Myko's seat in the bottom left corner, apart from the regulars. */
export const MYKO_CHAIR = T(4, 17);
/** Where Andrew steps back in from the pier. */
export const BAR_FROM_DOCKS = T(36, 14);

/** Where each regular stands (feet tile); the talk spot is the same tile, or the counter in front of Colleen-Ann. */
export const PATRON_TILES = {
  doug: { col: 19, row: 12 },
  kev: { col: 20, row: 12 },
  barb: { col: 10, row: 9 },
  sully: { col: 31, row: 7 },
  colleen: { col: 11, row: 4 },
} as const;

/** Walking into this once the regulars have all been spoken to starts the lesson: the table where Kev and Doug are. */
export const MANNER_AREA = tilesArea(16, 12, 8, 3);

/** The dartboard wall, where the roster is pinned. */
export const ROSTER_SPOT = T(2, 11);
export const STOUT_SPOT = T(14, 5);
export const BREWERY_SPOT = T(23, 6);
export const LIGHT_BEER_SPOT = T(2, 9);

export const BRAWL_SPAWNS = [T(31, 11), T(30, 15), T(24, 16), T(34, 12)] as const;
export const BRAWL_ENTRANCE = T(36, 18);

export function barScreen(): ScreenLayout {
  const c = new Canvas(40, 22, 'b', 'cities');
  c.rect(0, 0, 40, 1, '#').rect(0, 21, 40, 1, '#').rect(0, 0, 1, 22, '#').rect(39, 0, 1, 22, '#');
  // Green everything: the inner ring is green brick.
  c.rect(1, 1, 38, 1, 'g').rect(1, 20, 38, 1, 'g').rect(1, 1, 1, 20, 'g').rect(38, 1, 1, 20, 'g');
  // The front door, west wall; the back door onto the pier, east wall.
  c.rect(1, 6, 1, 2, 'd').rect(38, 14, 1, 2, 'd');
  // The bar: the counter along the top with the staff side shut off at both ends, and a stool at each seat.
  c.rect(3, 2, 1, 4, 'g').rect(33, 2, 1, 4, 'g').rect(4, 5, 29, 1, 'c');
  for (const col of [4, 12, 16, 20, 24, 28]) c.set(col, 6, 's');
  // Tables, each with a seat at either end. The bottom left one is Myko's.
  c.rect(10, 10, 2, 1, 't').set(9, 10, 's').set(12, 10, 's');
  c.rect(19, 11, 2, 1, 't').set(18, 11, 's').set(21, 11, 's');
  c.rect(27, 14, 2, 1, 't').set(26, 14, 's').set(29, 14, 's');
  c.rect(4, 16, 2, 1, 't').set(3, 16, 's').set(6, 16, 's');
  const exits: ExitDef[] = [
    // The back door opens onto the pier's side gate. Shut until the bar is done with.
    { id: 'c4.bar.backdoor', area: tilesArea(38, 14, 1, 2), toScreen: 'c4.docks', spawn: DOCKS_ARRIVAL },
  ];
  const props: PropPlacement[] = [
    // Behind the bar: the till with the plastic shillelagh over it, the countdown to March, the taps, the kettle.
    { frame: PROP.marchCountdown, col: 14, row: 1 },
    { frame: PROP.tillShillelagh, col: 22, row: 2 },
    { frame: PROP.beerTaps, col: 17, row: 4 },
    { frame: PROP.beerTaps, col: 27, row: 4 },
    { id: 'bar.kettle', frame: PROP.kettle, col: 8, row: 4 },
    // Steam while the free tea can be taken (the script shows and hides it).
    { id: 'bar.steam', frame: PROP.steam[0], frames: PROP.steam, frameRate: 4, col: 8, row: 3, hidden: true },
    // On the counter: the pint she did not let settle, and the craft IPA.
    { id: 'bar.stout', frame: PROP.stoutPint, col: 14, row: 5 },
    { id: 'bar.ipa', frame: PROP.craftIpa, col: 23, row: 5 },
    // The west wall: the front door's fridge of light beer, the dartboard, and the roster pinned beside it.
    { id: 'bar.fridge', frame: PROP.beerFridge, col: 1, row: 8 },
    { id: 'bar.roster', frame: PROP.roster, col: 1, row: 11 },
    { frame: PROP.dartboard, col: 1, row: 12 },
    // The east wall.
    { frame: PROP.noticeboard, col: 38, row: 8 },
    // Odds and ends: singles, pairs and a small heap, clear of the door routes and the counter.
    { id: 'bar.p1', frame: PROP.barrel, col: 35, row: 3, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'bar.p2', frame: PROP.sack, col: 36, row: 3, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'bar.p3', frame: PROP.cardboardBox, col: 3, row: 13, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'bar.p4', frame: PROP.bottleCrate, col: 36, row: 9, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'bar.p5', frame: PROP.barrel, col: 30, row: 18, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'bar.p6', frame: PROP.bottleCrate, col: 31, row: 18, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'bar.p7', frame: PROP.sack, col: 30, row: 19, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'bar.p8', frame: PROP.cardboardBox, col: 23, row: 17, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'bar.p9', frame: PROP.sack, col: 13, row: 17, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'bar.p10', frame: PROP.barrel, col: 14, row: 17, solid: { width: 1, height: 1 }, breakable: {} },
  ];
  const dressing: ScreenDressing = {
    props,
    npcs: [
      { id: 'colleen', npc: 'colleenAnn', col: PATRON_TILES.colleen.col, row: PATRON_TILES.colleen.row, facing: 'down', examinableId: 'c4.colleen' },
      { id: 'doug', npc: 'americanA', col: PATRON_TILES.doug.col, row: PATRON_TILES.doug.row, facing: 'down', examinableId: 'c4.doug' },
      { id: 'kev', npc: 'americanB', col: PATRON_TILES.kev.col, row: PATRON_TILES.kev.row, facing: 'down', examinableId: 'c4.kev' },
      { id: 'barb', npc: 'touristB', col: PATRON_TILES.barb.col, row: PATRON_TILES.barb.row, facing: 'down', examinableId: 'c4.barb' },
      { id: 'sully', npc: 'localA', col: PATRON_TILES.sully.col, row: PATRON_TILES.sully.row, facing: 'left', examinableId: 'c4.sully' },
    ],
  };
  return c.build('c4.bar', exits, BAR_ARRIVAL, { mykoStart: MYKO_CHAIR, dressing });
}

// ---------------------------------------------------------------------------
// c4.docks: Pier Nine, 70 x 34
// ---------------------------------------------------------------------------

/** Outside the back door, in the alley beside the shut side gate. */
export const DOCKS_ARRIVAL = T(2, 21);
/** Myko waits at the gate while Andrew is on the stealth route. */
export const GATE_SEAT = T(6, 22);
/** The side gate: a three-tile gap in the alley's fence, shut until the stealth section is passed. */
export const GATE = { col: 8, row: 20, height: 3 } as const;

/** Stealth: the gap in the fence at the top of the alley where Andrew goes in, and where he comes out. */
export const STEALTH_START = tilesArea(9, 3, 2, 3);
export const STEALTH_EXIT = tilesArea(39, 12, 2, 3);

/** The lunchbox on the bollard, and the tile in front of it where the clean-run whiskey is left. */
export const BOLLARD = { col: 40, row: 6 } as const;
export const LUNCHBOX_PICKUP = T(41, 6);

/**
 * The container puzzle: three rails in a staircase, each carrying one two-tile container over four slots. Each lever
 * pulls its rail's container one slot on, wrapping from slot 3 to slot 0. Minimum pulls: 2 + 3 + 1 = 6.
 *   rail A  row 10  cols 41..48  start slot 3, goal slot 1 (2 pulls)
 *   rail B  row  8  cols 44..51  start slot 3, goal slot 2 (3 pulls)
 *   rail C  row  6  cols 47..54  start slot 2, goal slot 3 (1 pull)
 * At the goal the three boxes stand as steps up to the hatch of MAS-4471 at (54..55, 4).
 */
export const RAILS = [
  { id: 'railA', origin: { col: 41, row: 10 }, slots: 4, start: 3, goal: 1, leverTile: { col: 40, row: 10 }, examinableId: 'c4.leverA' },
  { id: 'railB', origin: { col: 44, row: 8 }, slots: 4, start: 3, goal: 2, leverTile: { col: 43, row: 8 }, examinableId: 'c4.leverB' },
  { id: 'railC', origin: { col: 47, row: 6 }, slots: 4, start: 2, goal: 3, leverTile: { col: 46, row: 6 }, examinableId: 'c4.leverC' },
] as const;
/** Pulls needed on a rail: the box moves one slot on and wraps. */
export const pullsNeeded = (r: { readonly slots: number; readonly start: number; readonly goal: number }): number => (r.goal - r.start + r.slots) % r.slots;
export const MIN_PULLS = RAILS.reduce((n, r) => n + pullsNeeded(r), 0);

/** The two-tile hatch of MAS-4471, shut until the staircase is built. */
export const HATCH = [
  { col: 54, row: 4 },
  { col: 55, row: 4 },
] as const;
/** The inside of MAS-4471: walking in plays the scene. */
export const CONTAINER_INSIDE = tilesArea(53, 2, 11, 2);
export const SEIZURE_SPOT = T(53, 2);
export const FOAM_SPOT = T(58, 3);

/** The arena: 28 x 16, with the crane rail along the top. */
export const ARENA = { col: 40, row: 13, width: 28, height: 16 } as const;
/** The foreman's control box. He stands in it, pinned, until the Slam or the Shoulder beside it knocks him off. */
export const CONTROL_BOX = { col: 64, row: 14 } as const;
export const FOREMAN_PIN = T(64, 15);
/** Where the shillelagh lies once he has clocked out: on the control box. */
export const SHILLELAGH_SPOT = T(63, 15);
/** Close enough to the box for a Stout Slam or The Shoulder to knock him off it (px). */
export const BOX_REACH_PX = 56;
/** The crane's hook, and the three lanes its container swings down across the arena (x tiles). */
export const CRANE = { col: 58, row: 12 } as const;
export const CRANE_LANES = [44, 52, 60] as const;
export const DOCKER_ADDS = [T(50, 22), T(57, 22)] as const;
export const FOREMAN_ENTRANCE = T(41, 25);
export const FOREMAN_TRIGGER = tilesArea(42, 17, 24, 8);

export const DOCKS_STEALTH: StealthSectionDef = {
  id: 'c4.stealth.docks',
  checkpointId: 'c4.cp.docks',
  guards: [
    {
      // Aisle A, the first row, under the first floodlight.
      enemyId: 'docker',
      route: {
        mode: 'pingPong',
        waypoints: [
          { position: T(11, 4), waitMs: 1200, facing: 'right' },
          { position: T(34, 4), waitMs: 1200, facing: 'left' },
        ],
      },
    },
    {
      // Aisle B, the second row: the one Myko says to follow the light down.
      enemyId: 'docker',
      route: {
        mode: 'pingPong',
        waypoints: [
          { position: T(34, 13), waitMs: 1500, facing: 'left' },
          { position: T(12, 13), waitMs: 1500, facing: 'right' },
        ],
      },
    },
    {
      // Walks the gap between the stacks, across both aisles.
      enemyId: 'docker',
      route: {
        mode: 'pingPong',
        waypoints: [
          { position: T(18, 5), waitMs: 1000, facing: 'down' },
          { position: T(18, 13), waitMs: 1000, facing: 'up' },
        ],
      },
    },
    {
      // The east lane, along the way out.
      enemyId: 'docker',
      route: {
        mode: 'pingPong',
        waypoints: [
          { position: T(37, 5), waitMs: 2000, facing: 'down' },
          { position: T(37, 17), waitMs: 2000, facing: 'up' },
        ],
      },
    },
  ],
  hazards: [
    // Over the first aisle, from the north wall: sweeps down the aisle and back.
    {
      kind: 'floodlight',
      id: 'c4.flood.1',
      position: T(22, 2),
      cone: { range: 112, angleDeg: 45 },
      sweepFromDeg: 20,
      sweepToDeg: 160,
      sweepPeriodMs: 6000,
    },
    // Down the second aisle from its west end, a narrow beam swinging across its width.
    {
      kind: 'floodlight',
      id: 'c4.flood.2',
      position: T(9, 12),
      cone: { range: 160, angleDeg: 24 },
      sweepFromDeg: 330,
      sweepToDeg: 30,
      sweepPeriodMs: 5000,
    },
  ],
  hidingProps: [],
  // The reward is a whiskey in a lunchbox on a bollard: the script puts it there (it is a thing to walk to and pick up).
};

const DUSK: ScreenAmbient = { tint: 'navyDark', strength: 0.45 };
export const DAWN: ScreenAmbient = { tint: 'amber', strength: 0.18 };

export function docksScreen(): ScreenLayout {
  const c = new Canvas(70, 34, 'p', 'cities');
  c.rect(0, 0, 70, 1, '#').rect(0, 33, 70, 1, '#').rect(0, 0, 1, 34, '#').rect(69, 0, 1, 34, '#');
  // The quay: the edge, then water.
  c.rect(1, 29, 68, 1, 'e').rect(1, 30, 68, 3, 'q');
  // The door back into the bar, west wall of the alley.
  c.rect(0, 21, 1, 2, 'd');
  // The alley's fence along col 8, with a gap at the top where Andrew goes in and the shut gate lower down.
  c.rect(8, 1, 1, 28, 'f').rect(8, 3, 1, 3, 'p').rect(GATE.col, GATE.row, 1, GATE.height, 'p');
  // The stacks in the yard: red and blue, each a block of containers four rows tall (three on the bottom row).
  const stack = (col: number, row: number, w: number, h: number, ch: 'R' | 'U') => void c.rect(col, row, w, h, ch);
  stack(9, 7, 9, 4, 'R');
  stack(20, 7, 8, 4, 'U');
  stack(30, 7, 7, 4, 'R');
  stack(9, 15, 8, 4, 'U');
  stack(19, 15, 8, 4, 'R');
  stack(29, 15, 8, 4, 'U');
  stack(9, 23, 12, 3, 'R');
  stack(23, 23, 14, 3, 'U');
  // The wall between the yard and the east yard, with the way through at rows 12 to 14.
  c.rect(38, 1, 1, 11, 'U').rect(38, 15, 1, 14, 'U');
  // Floodlit ground under the two lights.
  c.rect(19, 2, 7, 4, 'L').rect(9, 11, 6, 4, 'L');
  // The crane rail along the top of the arena.
  c.rect(ARENA.col, ARENA.row, ARENA.width, 1, 'r');
  // The container puzzle's rails.
  for (const r of RAILS) c.rect(r.origin.col, r.origin.row, r.slots * 2, 1, 'r');
  // MAS-4471: a container seen from above, the hatch in its south wall.
  c.rect(52, 1, 13, 4, 'R').rect(53, 2, 11, 2, 'p').rect(52, 4, 13, 1, 'U').rect(HATCH[0].col, 4, 2, 1, 'p');
  const exits: ExitDef[] = [
    { id: 'c4.docks.backdoor', area: tilesArea(0, 21, 1, 2), toScreen: 'c4.bar', spawn: BAR_FROM_DOCKS },
  ];
  const props: PropPlacement[] = [
    // The side gate, shut until the stealth is passed.
    { id: 'dockGate', frame: PROP.fieldGate.along3, col: GATE.col, row: GATE.row, solid: { width: 1, height: GATE.height } },
    // The floodlights' masts.
    { id: 'mast1', frame: PROP.floodlightMast, col: 22, row: 1, solid: { dy: 1, width: 1, height: 1 } },
    { id: 'mast2', frame: PROP.floodlightMast, col: 9, row: 11, solid: { dy: 1, width: 1, height: 1 } },
    // The clean-run reward: a lunchbox on a bollard (the whiskey is spawned on the tile in front when the run is clean).
    { id: 'bollard', frame: PROP.bollard, col: BOLLARD.col, row: BOLLARD.row, solid: { width: 1, height: 1 } },
    { id: 'lunchbox', frame: PROP.lunchbox, col: BOLLARD.col, row: BOLLARD.row },
    // Levers, one for each rail.
    ...RAILS.map((r) => ({ id: `lever.${r.id}`, frame: PROP.lever.up, col: r.leverTile.col, row: r.leverTile.row })),
    // The hatch, shut until the staircase is built: two sections of gate.
    ...HATCH.map((h, i) => ({ id: `hatch.${i}`, frame: PROP.fieldGate.across, col: h.col, row: h.row, solid: { width: 1, height: 1 } })),
    // Inside MAS-4471.
    { frame: PROP.container.mas4471, col: 58, row: 1 },
    { id: 'seizure', frame: PROP.seizureNotice, col: 52, row: 2 },
    { id: 'foam', frame: PROP.packingFoam, col: 58, row: 3 },
    // The crane on its rail, the control box, and the shillelagh he leaves on it.
    { id: 'crane', frame: PROP.crane, col: CRANE.col, row: CRANE.row, solid: { dy: 1, width: 3, height: 1 } },
    { id: 'controlBox', frame: PROP.controlBox, col: CONTROL_BOX.col, row: CONTROL_BOX.row, solid: { dy: 1, width: 1, height: 1 } },
    { id: 'shillelagh', frame: PROP.weapon.shillelagh, col: SHILLELAGH_SPOT.x / 16 - 0.5, row: SHILLELAGH_SPOT.y / 16 - 0.5, hidden: true },
    // Stacks of nothing in particular and dock furniture, in the alley and the east yard: singles, pairs, a small heap.
    { id: 'dock.p1', frame: PROP.barrel, col: 3, row: 5, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'dock.p2', frame: PROP.bottleCrate, col: 5, row: 12, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'dock.p3', frame: PROP.cardboardBox, col: 6, row: 12, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'dock.p4', frame: PROP.sack, col: 2, row: 16, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'dock.p5', frame: PROP.barrel, col: 5, row: 26, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'dock.p6', frame: PROP.cardboardBox, col: 22, row: 27, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'dock.p7', frame: PROP.sack, col: 23, row: 27, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'dock.p8', frame: PROP.barrel, col: 33, row: 1, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'dock.p9', frame: PROP.bottleCrate, col: 14, row: 5, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'dock.p10', frame: PROP.cardboardBox, col: 62, row: 8, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'dock.p11', frame: PROP.barrel, col: 66, row: 9, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'dock.p12', frame: PROP.sack, col: 66, row: 10, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'dock.p13', frame: PROP.bottleCrate, col: 43, row: 22, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'dock.p14', frame: PROP.barrel, col: 66, row: 25, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'dock.p15', frame: PROP.cardboardBox, col: 42, row: 27, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'dock.p16', frame: PROP.sack, col: 59, row: 27, solid: { width: 1, height: 1 }, breakable: {} },
  ];
  const dressing: ScreenDressing = { props };
  const ambient: ScreenAmbient = {
    ...DUSK,
    lights: [
      { x: 22 * 16 + 8, y: 3 * 16, radius: 80, colour: 'amberLight', glow: 0.2 },
      { x: 9 * 16 + 8, y: 12 * 16 + 8, radius: 56, colour: 'amberLight', glow: 0.15 },
      { x: 3 * 16, y: 21 * 16 + 8, radius: 48, colour: 'amber' },
      { x: 56 * 16, y: 6 * 16, radius: 72, colour: 'amberLight', glow: 0.15 },
      { x: 54 * 16, y: 21 * 16, radius: 120, colour: 'amberLight', glow: 0.12 },
    ],
  };
  return c.build('c4.docks', exits, DOCKS_ARRIVAL, { dressing, ambient });
}
