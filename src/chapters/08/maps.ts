/**
 * Chapter 8 screens as tile layouts and dressing. Level data only (docs/chapters/08-the-long-road.md): the roadhouse
 * and the road, the perimeter and Gate C, all in the `nevada` region, plus every constant the script and the systems
 * need (shade, sensor lines, masts, truck tracks, junction boxes, the fence fight and the gate arena).
 *
 * Art: `nevada` tiles (shade, sensor posts and wire, thermal masts, junction boxes, rock `cover`) and existing props.
 * STAND-INS, to be replaced when there is art (frame: what it should be):
 * - `van.right` (Pruitt's car): a plain grey government sedan, 48 x 32.
 * - `van.left` (the parked truck on the road, the patrol truck at the fence): a pickup with a spotter's rail.
 * - `noticeboard` (the road sign): a highway sign with the distances to everything.
 * - `bollard` (the barrier arm's posts): a barrier post with a light.
 * - `fieldGate.along3` (the barrier arm): a striped arm across the service road.
 * - `fieldGate.across3` (the fence's gates): a chain-link gate. The fence itself is the `fence` mesh tile.
 * - `weapon.clipboard` (the dropped clipboard): a clipboard on the ground.
 * - `flask` (Pruitt's thermos) and the `seat` tile (his folding chair).
 */

import { PROP } from '../../art/props';
import type { ExitDef, PropPlacement, ScreenDressing, ScreenLayout } from '../../core/chapter';
import type { PatrolRoute, StealthSectionDef, Vec2 } from '../../core/types';
import { Canvas, T, tilesArea } from '../canvas';

export { T, tilesArea };

/** A rectangle of whole tiles. */
export interface TileRect {
  readonly col: number;
  readonly row: number;
  readonly width: number;
  readonly height: number;
}
const rectArea = (r: TileRect) => tilesArea(r.col, r.row, r.width, r.height);

/** Scatters rough ground over the open sand so it is not a flat sheet. Deterministic. */
function scatter(c: Canvas): void {
  for (let row = 1; row < c.height - 1; row++) {
    for (let col = 1; col < c.width - 1; col++) {
      const h = (col * 7 + row * 13 + col * row) % 23;
      if (h === 0) c.set(col, row, 'r');
      else if (h === 1 || h === 2) c.set(col, row, ',');
    }
  }
}

/** Paints a rock outcrop (`o`) with its shade (`S`) on the sun-away (west) side. */
function outcrop(c: Canvas, o: Outcrop): void {
  c.rect(o.shade.col, o.shade.row, o.shade.width, o.shade.height, 'S');
  c.rect(o.col, o.row, o.width, o.height, 'o');
}

/** A rock outcrop: blocks movement and sight; its shade is the strip on its west side. */
export interface Outcrop extends TileRect {
  readonly id: string;
  readonly shade: TileRect;
}
const rock = (id: string, col: number, row: number, width: number, height: number): Outcrop => ({
  id,
  col,
  row,
  width,
  height,
  shade: { col: col - 2, row, width: 2, height },
});

// ---------------------------------------------------------------------------
// c8.road: Highway and roadhouse, 60 x 20
// ---------------------------------------------------------------------------

/** Inside the roadhouse, clear of the counter: where Andrew arrives, at the start and after every return. */
export const BAR_ARRIVAL = T(18, 7);
/** In front of the counter, where E asks for the coffee or tea (the hot drink is offered here). */
export const TEA_SPOT = T(9, 5);
/** In front of the attendant: the dollar and the one beer. */
export const BAR_BEER_SPOT = T(12, 5);
/** The fuel log on the counter (`c8.clue.schedule`). */
export const SCHEDULE_SPOT = T(14, 5);
export const ATTENDANT_TILE = { col: 12, row: 3 } as const;
/** Myko's place at the start, by the table. */
export const MYKO_BAR = T(19, 7);
/** The awning over the roadhouse's front and the fuel apron: shade. */
export const AWNING_SHADE: TileRect = { col: 11, row: 10, width: 8, height: 2 };
/** Stepping out from under the awning here starts the sun lesson. */
export const SUN_AREA = tilesArea(11, 12, 8, 1);
export const ROAD_DOOR = tilesArea(14, 9, 2, 1);

/** Pruitt's plain grey car, parked beside the roadhouse, and where E examines it (`c8.clue.car`). */
export const CAR_PROP = { col: 29, row: 3 } as const;
export const CAR_SPOT = T(30, 5);
/** The sign with the distance to everything. */
export const SIGN_SPOT = T(28, 12);
/** A parked truck on the verge, and the strip of shade it throws. */
export const TRUCK_PROP = { col: 38, row: 10 } as const;
export const TRUCK_SHADE: TileRect = { col: 37, row: 12, width: 5, height: 1 };

/** The dry wash: a bed running north from the road to the perimeter. */
export const WASH = { col: 44, row: 1, width: 4, height: 12 } as const;
export const ROAD_TO_PERIMETER = tilesArea(45, 0, 2, 1);
/** Where Andrew steps out of the wash from the perimeter. */
export const ROAD_FROM_PERIMETER = T(45, 2);
/** Where the service gate lets him out: on the apron beside the roadhouse. */
export const ROAD_FROM_SERVICE = T(21, 12);
/** The lone agent at the end of the wash, checking a sensor (the Barred lesson), and the walk-in that wakes him. */
export const BARRED_AGENT_SPOT = T(45, 4);
export const BARRED_TRIGGER = tilesArea(44, 9, 4, 2);

/** Outcrops on the road screen: two along the wash (shade down its west side), two on the south verge. */
export const ROAD_OUTCROPS: readonly Outcrop[] = [
  rock('road.rockA', 48, 2, 2, 3),
  rock('road.rockB', 48, 8, 2, 3),
  rock('road.rockC', 10, 17, 3, 2),
  rock('road.rockD', 50, 17, 3, 2),
];
/** Every shade area on the road screen, in pixels. */
export const ROAD_SHADE = [
  rectArea(AWNING_SHADE),
  rectArea(TRUCK_SHADE),
  ...ROAD_OUTCROPS.map((o) => rectArea(o.shade)),
];

/** Beer crates to throw. */
export const ROAD_BOTTLE_SPOTS: readonly Vec2[] = [T(31, 12), T(52, 12)];

export function roadScreen(): ScreenLayout {
  const c = new Canvas(60, 20, '.', 'nevada');
  scatter(c);
  c.rect(0, 0, 60, 1, '#').rect(0, 19, 60, 1, '#').rect(0, 0, 1, 20, '#').rect(59, 0, 1, 20, '#');
  // The road, with its dashed line.
  c.rect(1, 13, 58, 4, 'p').rect(1, 14, 58, 1, 'm');
  // The wash, and the opening in the border where it leaves.
  c.rect(WASH.col, WASH.row, WASH.width, WASH.height, ',');
  c.rect(45, 0, 2, 1, 'r');
  // The roadhouse: back wall, side walls, front wall with a door, windows.
  c.rect(6, 1, 20, 9, 'W').rect(6, 1, 20, 1, '#').rect(7, 3, 18, 6, '.');
  c.rect(14, 9, 2, 1, 'd').rect(9, 9, 2, 1, 'w').rect(19, 9, 2, 1, 'w').rect(11, 2, 2, 1, 'w').rect(19, 2, 2, 1, 'w');
  // The bar, a table by the door.
  c.rect(9, 4, 8, 1, 'c');
  c.rect(20, 6, 2, 1, 't').set(19, 6, 's').set(22, 6, 's');
  // Shade: the awning and the truck's shadow.
  c.rect(AWNING_SHADE.col, AWNING_SHADE.row, AWNING_SHADE.width, AWNING_SHADE.height, 'S');
  c.rect(TRUCK_SHADE.col, TRUCK_SHADE.row, TRUCK_SHADE.width, TRUCK_SHADE.height, 'S');
  for (const o of ROAD_OUTCROPS) outcrop(c, o);
  const exits: ExitDef[] = [{ id: 'c8.road.wash', area: ROAD_TO_PERIMETER, toScreen: 'c8.perimeter', spawn: PERIMETER_FROM_ROAD }];
  const props: PropPlacement[] = [
    // Behind the counter: the pot, the tea bag box, the taps. On it: the fuel log.
    { id: 'bar.coffee', frame: PROP.coffeePot, col: 9, row: 3 },
    { id: 'bar.steam', frame: PROP.steam[0], frames: PROP.steam, frameRate: 4, col: 9, row: 2, hidden: true },
    { id: 'bar.tea', frame: PROP.cardboardBox, col: 10, row: 3 },
    { id: 'bar.taps', frame: PROP.beerTaps, col: 14, row: 3 },
    { id: 'bar.fuelLog', frame: PROP.logbook, col: 14, row: 4 },
    // Pruitt's car (stand-in), with its foot solid.
    { id: 'road.car', frame: PROP.van.right, col: CAR_PROP.col, row: CAR_PROP.row, solid: { dy: 1, width: 3, height: 1 } },
    // The sign (stand-in).
    { id: 'road.sign', frame: PROP.noticeboard, col: 28, row: 10, solid: { dy: 1, width: 1, height: 1 } },
    // The parked truck (stand-in).
    { id: 'road.truck', frame: PROP.van.left, col: TRUCK_PROP.col, row: TRUCK_PROP.row, solid: { dy: 1, width: 3, height: 1 } },
  ];
  const dressing: ScreenDressing = {
    props,
    npcs: [{ id: 'attendant', npc: 'attendant', col: ATTENDANT_TILE.col, row: ATTENDANT_TILE.row, facing: 'down', examinableId: 'c8.attendant' }],
  };
  return c.build('c8.road', exits, BAR_ARRIVAL, { mykoStart: MYKO_BAR, dressing });
}

// ---------------------------------------------------------------------------
// c8.perimeter: The perimeter, 100 x 40
// ---------------------------------------------------------------------------

/** Where Andrew steps out of the wash, at the south edge. */
export const PERIMETER_FROM_ROAD = T(21, 37);
export const PERIMETER_TO_ROAD = tilesArea(20, 39, 3, 1);
/** Where he arrives from Gate C: in the pocket behind the fence. */
export const PERIMETER_FROM_GATE = T(50, 3);
/** The way through the fence to Gate C, and the pocket behind it. */
export const FENCE_GATE_TILES = { col: 49, row: 4, width: 3, height: 1 } as const;
export const PERIMETER_TO_GATE = tilesArea(49, 1, 3, 1);
/** The service gate: the clean-run reward, west end of the fence. It opens onto the road beside the roadhouse. */
export const SERVICE_GATE_TILES = { col: 5, row: 4, width: 3, height: 1 } as const;
export const SERVICE_GATE_EXIT = tilesArea(5, 4, 3, 1);
/** Where Andrew stands to open it, on the fence's south side. */
export const SERVICE_GATE_SPOT = T(6, 5);

/** Stealth: the section starts at the wash's mouth and ends when Andrew reaches the fence zone. */
export const STEALTH_START = tilesArea(16, 37, 12, 2);
export const STEALTH_EXIT = tilesArea(36, 11, 28, 2);
export const STEALTH_ENTRANCE = T(19, 38);
export const STEALTH_REINFORCEMENTS: readonly Vec2[] = [T(36, 8), T(64, 8)];
/** No agent patrols on foot; the hazards are the sensors, the masts and the trucks. */
export const PERIMETER_GUARDS: StealthSectionDef['guards'] = [];

/** Rock outcrops: block sight (and movement) and throw shade on the west. Between sensor lines and track rows. */
export const PERIMETER_OUTCROPS: readonly Outcrop[] = [
  rock('perim.rock1', 30, 31, 3, 2),
  rock('perim.rock2', 70, 31, 3, 2),
  rock('perim.rock3', 14, 26, 3, 2),
  rock('perim.rock4', 80, 26, 3, 2),
  rock('perim.rock5', 48, 26, 3, 2),
  rock('perim.rock6', 24, 19, 3, 2),
  rock('perim.rock7', 58, 19, 3, 2),
  rock('perim.rock8', 20, 14, 3, 2),
  rock('perim.rock9', 52, 14, 3, 2),
  rock('perim.rock10', 84, 14, 3, 2),
  rock('perim.rock11', 36, 37, 3, 2),
];
/** The shadow of the truck parked at the fence. */
export const FIGHT_TRUCK_SHADE: TileRect = { col: 50, row: 9, width: 3, height: 1 };
export const PERIMETER_SHADE = [...PERIMETER_OUTCROPS.map((o) => rectArea(o.shade)), rectArea(FIGHT_TRUCK_SHADE)];

/**
 * Five sensor lines, numbered 1 to 5 from the south edge to the fence. Each is a row of ground sensors every four
 * tiles with wire between them. Lines 2, 3 and 4 run the full width; line 1 stops west of the centre and line 5 starts
 * east of it, so the corridor down the middle crosses only lines 2, 3 and 4.
 */
export interface SensorLine {
  /** 1 to 5. */
  readonly line: number;
  readonly row: number;
  /** First and last column of the line (a sensor on each, then every fourth tile). */
  readonly fromCol: number;
  readonly toCol: number;
  readonly sensors: readonly Vec2[];
}
const sensorLine = (line: number, row: number, fromCol: number, toCol: number): SensorLine => {
  const sensors: Vec2[] = [];
  for (let col = fromCol; col <= toCol; col += 4) sensors.push(T(col, row));
  return { line, row, fromCol, toCol, sensors };
};
export const SENSOR_LINES: readonly SensorLine[] = [
  sensorLine(1, 36, 3, 39),
  sensorLine(2, 30, 3, 95),
  sensorLine(3, 24, 3, 95),
  sensorLine(4, 18, 3, 95),
  sensorLine(5, 12, 71, 95),
];
/** The lines between Andrew and the fence on the straight way up the middle: the three to switch off. */
export const CORRIDOR_LINES: readonly number[] = [2, 3, 4];
/** The corridor itself: the middle strip the junction puzzle opens, from the stealth start to the fence zone. */
export const CORRIDOR = tilesArea(42, 5, 25, 31);

/** Thermal masts (a tile each, solid). */
export const THERMAL_MASTS: readonly Vec2[] = [T(44, 27), T(62, 20), T(30, 19), T(76, 31), T(8, 27)];

/** The patrol tracks (two tiles wide) and the two trucks' routes along them. */
export const TRACKS: readonly TileRect[] = [
  { col: 2, row: 33, width: 96, height: 2 },
  { col: 2, row: 21, width: 96, height: 2 },
];
const truckRoute = (from: Vec2, to: Vec2, facing: 'left' | 'right'): PatrolRoute => ({
  mode: 'pingPong',
  waypoints: [
    { position: from, waitMs: 2000, facing },
    { position: to, waitMs: 2000, facing: facing === 'right' ? 'left' : 'right' },
  ],
});
export const PATROL_TRUCKS = [
  { id: 'truck1', route: truckRoute(T(3, 33), T(96, 33), 'right') },
  { id: 'truck2', route: truckRoute(T(96, 21), T(3, 21), 'left') },
] as const;

/**
 * The three junction boxes and the two lines each toggles. All five lines start on. The way is open when lines 2, 3 and
 * 4 are off (lines 1 and 5 do not matter). See `junctionSolved`.
 */
export interface JunctionBox {
  readonly id: 'near' | 'middle' | 'far';
  readonly col: number;
  readonly row: number;
  readonly lines: readonly [number, number];
  /** Where E works the box: a tile in front of it. */
  readonly spot: Vec2;
}
export const JUNCTION_BOXES: readonly JunctionBox[] = [
  { id: 'near', col: 30, row: 37, lines: [1, 2], spot: T(30, 36) },
  { id: 'middle', col: 66, row: 27, lines: [3, 5], spot: T(66, 28) },
  { id: 'far', col: 40, row: 15, lines: [4, 5], spot: T(40, 16) },
];
export const LINES_ON_AT_START: readonly boolean[] = [true, true, true, true, true];
/** One toggle of box `i`: flips its two lines. Returns the new state of the five lines (index 0 is line 1). */
export function pressJunction(state: readonly boolean[], box: JunctionBox): boolean[] {
  return state.map((on, i) => (box.lines.includes(i + 1) ? !on : on));
}
/** True when every line in `CORRIDOR_LINES` is off. */
export function junctionSolved(state: readonly boolean[]): boolean {
  return CORRIDOR_LINES.every((l) => state[l - 1] === false);
}
export const JUNCTION_TRIGGER = tilesArea(26, 34, 8, 4);

/** The fence fight: the zone at the fence, the four agents, the truck that parks and adds its headlights, the clipboard. */
export const FENCE_FIGHT_AREA = tilesArea(34, 5, 32, 5);
export const FENCE_AGENT_SPAWNS: readonly Vec2[] = [T(38, 6), T(46, 6), T(56, 6), T(62, 6)];
export const FIGHT_ENTRANCE = T(46, 11);
/** The truck comes in along row 8 from the west and parks here; its prop is shown when it stops. */
export const FIGHT_TRUCK_ENTRY = T(3, 8);
export const FIGHT_TRUCK_PARK = T(51, 8);
export const FIGHT_TRUCK_PROP = { col: 50, row: 7 } as const;
export const CLIPBOARD_SPOT = T(42, 8);

/** Walking in at the wash's mouth: the perimeter's opening scene. */
export const PERIMETER_OPEN_AREA = tilesArea(18, 36, 8, 3);

export const PERIMETER_BOTTLE_SPOTS: readonly Vec2[] = [T(24, 38), T(56, 34), T(74, 26), T(42, 16), T(60, 7)];

/** The stealth section's definition. Hazards (sensors, masts, trucks) are built from the constants above by the script. */
export const PERIMETER_STEALTH: StealthSectionDef = {
  id: 'c8.stealth.perimeter',
  checkpointId: 'c8.cp.perimeter',
  guards: PERIMETER_GUARDS,
  hazards: [],
  hidingProps: [],
};

export function perimeterScreen(): ScreenLayout {
  const c = new Canvas(100, 40, '.', 'nevada');
  scatter(c);
  c.rect(0, 0, 100, 1, '#').rect(0, 39, 100, 1, '#').rect(0, 0, 1, 40, '#').rect(99, 0, 1, 40, '#');
  // The patrol tracks.
  for (const t of TRACKS) c.rect(t.col, t.row, t.width, t.height, 'p');
  // The fence, with its two gaps, and the openings in the border.
  c.rect(1, 4, 98, 1, 'f');
  c.rect(FENCE_GATE_TILES.col, FENCE_GATE_TILES.row, FENCE_GATE_TILES.width, 1, 'p');
  c.rect(SERVICE_GATE_TILES.col, SERVICE_GATE_TILES.row, SERVICE_GATE_TILES.width, 1, 'p');
  c.rect(20, 39, 3, 1, 'r');
  c.rect(49, 1, 3, 3, 'p');
  // Sensor lines: wire, then posts.
  for (const l of SENSOR_LINES) {
    c.rect(l.fromCol, l.row, l.toCol - l.fromCol + 1, 1, 'l');
    for (const s of l.sensors) c.set(Math.floor(s.x / 16), l.row, 'P');
  }
  for (const m of THERMAL_MASTS) c.set(Math.floor(m.x / 16), Math.floor(m.y / 16), 'M');
  for (const b of JUNCTION_BOXES) c.set(b.col, b.row, 'J');
  for (const o of PERIMETER_OUTCROPS) outcrop(c, o);
  c.rect(FIGHT_TRUCK_SHADE.col, FIGHT_TRUCK_SHADE.row, FIGHT_TRUCK_SHADE.width, FIGHT_TRUCK_SHADE.height, 'S');
  const exits: ExitDef[] = [
    { id: 'c8.perimeter.wash', area: PERIMETER_TO_ROAD, toScreen: 'c8.road', spawn: ROAD_FROM_PERIMETER },
    { id: 'c8.perimeter.service', area: SERVICE_GATE_EXIT, toScreen: 'c8.road', spawn: ROAD_FROM_SERVICE },
    { id: 'c8.perimeter.gate', area: PERIMETER_TO_GATE, toScreen: 'c8.gate', spawn: GATE_FROM_PERIMETER },
  ];
  const props: PropPlacement[] = [
    // The fence's gates, shut until the script opens them (STAND-IN art).
    { id: 'fence.gate', frame: PROP.fieldGate.across3, col: FENCE_GATE_TILES.col, row: FENCE_GATE_TILES.row, solid: { width: 3, height: 1 } },
    { id: 'fence.service', frame: PROP.fieldGate.across3, col: SERVICE_GATE_TILES.col, row: SERVICE_GATE_TILES.row, solid: { width: 3, height: 1 } },
    // The truck that parks at the fence, hidden until it does.
    { id: 'fight.truck', frame: PROP.van.right, col: FIGHT_TRUCK_PROP.col, row: FIGHT_TRUCK_PROP.row, solid: { dy: 1, width: 3, height: 1 }, hidden: true },
    // The dropped clipboard, hidden until the fight is over.
    { id: 'fence.clipboard', frame: PROP.weapon.clipboard, col: 42, row: 8, hidden: true },
  ];
  return c.build('c8.perimeter', exits, PERIMETER_FROM_ROAD, { mykoStart: STEALTH_ENTRANCE, dressing: { props } });
}

// ---------------------------------------------------------------------------
// c8.gate: Gate C, 40 x 20
// ---------------------------------------------------------------------------

export const GATE_FROM_PERIMETER = T(3, 10);
export const GATE_TO_PERIMETER = tilesArea(0, 8, 1, 4);
export const GATE_MYKO_START = T(2, 9);
/** The arena, 30 x 14, and where Myko comes in for his call. */
export const GATE_ARENA = { col: 5, row: 3, width: 30, height: 14 } as const;
export const GATE_MYKO_ENTRANCE = T(4, 11);
/** Pruitt's folding chair, the thermos beside it, and where he stands when he gets up. */
export const PRUITT_CHAIR_TILE = { col: 20, row: 5 } as const;
export const PRUITT_CHAIR = T(PRUITT_CHAIR_TILE.col, PRUITT_CHAIR_TILE.row);
export const PRUITT_START = T(20, 6);
export const PRUITT_TRIGGER = tilesArea(8, 8, 4, 4);
/** The guard hut. */
export const GUARD_HUT: TileRect = { col: 14, row: 3, width: 5, height: 4 };
/** The barrier arm and the marked line it drops on (a column of marking across the service road). */
export const BARRIER_ARM_LINE: TileRect = { col: 22, row: 6, width: 1, height: 8 };
export const BARRIER_PROP = { col: 22, row: 8 } as const;
/** Floodlight masts at the arena's corners (foot tile of each, and the light's centre in pixels). */
export const FLOODLIGHT_TILES: readonly { readonly col: number; readonly row: number }[] = [
  { col: 8, row: 3 },
  { col: 30, row: 3 },
  { col: 8, row: 15 },
  { col: 30, row: 15 },
];
export const FLOODLIGHT_SPOTS: readonly Vec2[] = FLOODLIGHT_TILES.map((t) => T(t.col, t.row + 1));
/** Phase 2: the patrol truck's lit path, two tiles wide across the arena, west to east. */
export const GATE_LIT_PATH: TileRect = { col: 1, row: 13, width: 34, height: 2 };
export const GATE_TRUCK_ROUTE: readonly Vec2[] = [T(1, 14), T(34, 14)];
/** The service road into the hill, and the end of the walk in the closing scene. */
export const GATE_CLOSING_AREA = tilesArea(35, 9, 3, 2);
export const GATE_BOTTLE_SPOTS: readonly Vec2[] = [T(6, 4), T(33, 4), T(6, 15), T(33, 15)];
export const GATE_ARRIVE_AREA = tilesArea(1, 8, 4, 4);

export function gateScreen(): ScreenLayout {
  const c = new Canvas(40, 20, '.', 'nevada');
  scatter(c);
  c.rect(0, 0, 40, 1, '#').rect(0, 19, 40, 1, '#').rect(0, 0, 1, 20, '#').rect(39, 0, 1, 20, '#');
  // Fences along the arena's north and south.
  c.rect(1, 2, 34, 1, 'f').rect(1, 17, 34, 1, 'f');
  // The hill, and the service road cut into it.
  c.rect(35, 1, 4, 18, 'W');
  c.rect(1, 8, 38, 4, 'p').rect(0, 8, 1, 4, 'p');
  // The lit path for the patrol truck.
  c.rect(GATE_LIT_PATH.col, GATE_LIT_PATH.row, GATE_LIT_PATH.width, GATE_LIT_PATH.height, 'a');
  // The barrier's marked line.
  c.rect(BARRIER_ARM_LINE.col, BARRIER_ARM_LINE.row, BARRIER_ARM_LINE.width, BARRIER_ARM_LINE.height, 'm');
  // The guard hut, with windows, and Pruitt's chair.
  c.rect(GUARD_HUT.col, GUARD_HUT.row, GUARD_HUT.width, GUARD_HUT.height, 'W').rect(GUARD_HUT.col, GUARD_HUT.row, GUARD_HUT.width, 1, '#');
  c.set(15, 6, 'w').set(17, 6, 'w');
  c.set(PRUITT_CHAIR_TILE.col, PRUITT_CHAIR_TILE.row, 's');
  const exits: ExitDef[] = [{ id: 'c8.gate.fence', area: GATE_TO_PERIMETER, toScreen: 'c8.perimeter', spawn: PERIMETER_FROM_GATE }];
  const props: PropPlacement[] = [
    { id: 'gate.thermos', frame: PROP.flask, col: 19, row: 5 },
    // The barrier arm (stand-in), raised, with its posts (stand-ins).
    { id: 'gate.barrier', frame: PROP.fieldGate.along3, col: BARRIER_PROP.col, row: BARRIER_PROP.row },
    { id: 'gate.post1', frame: PROP.bollard, col: 22, row: 5, solid: { width: 1, height: 1 } },
    { id: 'gate.post2', frame: PROP.bollard, col: 22, row: 15, solid: { width: 1, height: 1 } },
    // Floodlights at the arena's corners.
    ...FLOODLIGHT_TILES.map((t, i) => ({ id: `gate.flood${i + 1}`, frame: PROP.floodlightMast, col: t.col, row: t.row, solid: { dy: 1, width: 1, height: 1 } })),
  ];
  return c.build('c8.gate', exits, GATE_FROM_PERIMETER, { mykoStart: GATE_MYKO_START, dressing: { props } });
}
