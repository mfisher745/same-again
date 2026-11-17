/**
 * Chapter 6 screens as tile layouts and dressing. Level data only
 * (docs/chapters/06-flyover-country.md): the Starlite Motel, Main Street and the
 * cornfields, all in the `ohio` region, plus every constant the script needs
 * (corn, drone routes, the crop-circle maze, the combine arena, bottle spots).
 *
 * Art: `src/art/propsC56.ts` (ice machine, ticket machine, water tower, signs, cooler on
 * a post, mailbox, flag, marker stones) and the `ohio` corn tiles (`C` standing, `u`
 * stubble, `X` the maze's thicket wall). The world view draws the sensor lights, the
 * plume, the bales and the lit stones; the drones and the combine are enemy bodies.
 */

import { PROP } from '../../art/props';
import type { ExitDef, PropPlacement, ScreenDressing, ScreenLayout } from '../../core/chapter';
import type { StealthSectionDef, TileCoord, Vec2 } from '../../core/types';
import { Canvas, T, tilesArea } from '../canvas';

export { T, tilesArea };

// ---------------------------------------------------------------------------
// c6.motel: The Starlite Motel, 30 x 17
// ---------------------------------------------------------------------------

/** Inside the lounge, clear of the counter: where Andrew arrives, at the start and after every return. */
export const BAR_ARRIVAL = T(7, 7);
/** In front of the counter: where E asks for the coffee (the hot drink is offered here). */
export const TEA_SPOT = T(5, 5);
/** Myko's place, beside the ice machine in the corridor, apart from the desk. */
export const MYKO_ICE = T(27, 4);
/** Where Andrew steps in from Main Street: inside the south door. */
export const MOTEL_FROM_TOWN = T(25, 14);
/** The clerk, behind the counter. */
export const CLERK_TILE = { col: 7, row: 3 } as const;
/** In front of the counter: the ledger, the postcards, the clerk. */
export const LEDGER_SPOT = T(9, 5);
export const POSTCARD_SPOT = T(10, 5);
export const CLERK_SPOT = T(7, 5);
/** Things Myko admires in the motel. */
export const MOTEL_ADMIRE = {
  iceMachine: T(25, 4),
  pool: T(16, 10),
  motelSign: T(14, 2),
  sky: T(21, 2),
  carPark: T(16, 2),
} as const;

export const MOTEL_DOOR = tilesArea(25, 15, 2, 1);

export function motelScreen(): ScreenLayout {
  const c = new Canvas(30, 17, '.', 'ohio');
  c.room();
  // The wall between the lounge and the rest: openings into the corridor and onto the pool courtyard.
  c.rect(13, 2, 1, 13, 'W').rect(13, 3, 1, 2, '.').rect(13, 9, 1, 2, '.');
  // The corridor (rows 2 to 5) and the courtyard below it (rows 7 to 14), with a gap in the wall between them.
  c.rect(14, 6, 14, 1, 'W').rect(20, 6, 2, 1, '.');
  c.rect(14, 7, 14, 8, 'k');
  // The pool, with no water in it.
  c.rect(17, 9, 8, 4, 'P');
  // Windows onto the car park and the sky.
  c.rect(4, 1, 2, 1, 'w').rect(16, 1, 2, 1, 'w').rect(20, 1, 2, 1, 'w');
  // The desk: a counter along the lounge's top, cols 3 to 11.
  c.rect(3, 4, 9, 1, 'c');
  // Two tables in the lounge, each with a seat at either end.
  c.rect(4, 9, 2, 1, 't').set(3, 9, 's').set(6, 9, 's');
  c.rect(8, 12, 2, 1, 't').set(7, 12, 's').set(10, 12, 's');
  // The south door, onto Main Street.
  c.rect(25, 15, 2, 1, 'd');
  const exits: ExitDef[] = [{ id: 'c6.motel.door', area: MOTEL_DOOR, toScreen: 'c6.town', spawn: TOWN_FROM_MOTEL }];
  const props: PropPlacement[] = [
    // On and behind the counter: the pot that refills, its steam, the unopened box of tea, the ledger, the postcards.
    { id: 'bar.coffee', frame: PROP.coffeePot, col: 4, row: 3 },
    { id: 'bar.steam', frame: PROP.steam[0], frames: PROP.steam, frameRate: 4, col: 4, row: 2, hidden: true },
    { id: 'bar.tea', frame: PROP.cardboardBox, col: 10, row: 3 },
    { id: 'desk.ledger', frame: PROP.visitorsBook, col: 9, row: 4 },
    { id: 'desk.postcards', frame: PROP.brochure, col: 10, row: 4 },
    // The sign, over the corridor.
    { id: 'motel.sign', frame: PROP.motelSign, col: 14, row: 1 },
    // The ice machine in the corridor.
    { id: 'ice.machine', frame: PROP.iceMachine, col: 26, row: 2, solid: { dy: 1, width: 1, height: 1 } },
    { id: 'motel.p1', frame: PROP.flowerPot, col: 2, row: 13, solid: { width: 1, height: 1 } },
    { id: 'motel.p2', frame: PROP.flowerPot, col: 12, row: 14, solid: { width: 1, height: 1 } },
    { id: 'motel.p3', frame: PROP.flowerPot, col: 27, row: 7, solid: { width: 1, height: 1 } },
  ];
  const dressing: ScreenDressing = {
    props,
    npcs: [{ id: 'clerk', npc: 'americanC', col: CLERK_TILE.col, row: CLERK_TILE.row, facing: 'down', examinableId: 'c6.motel.desk' }],
  };
  return c.build('c6.motel', exits, BAR_ARRIVAL, { mykoStart: MYKO_ICE, dressing });
}

// ---------------------------------------------------------------------------
// c6.town: Bus station and Main Street, 50 x 20
// ---------------------------------------------------------------------------

/** On the sidewalk in front of the motel's door. */
export const TOWN_FROM_MOTEL = T(44, 6);
/** On the road, just inside the east end: where Andrew comes back from the farm track. */
export const TOWN_FROM_FIELDS = T(47, 10);
export const TOWN_TO_FIELDS = tilesArea(49, 9, 1, 3);
export const TOWN_MOTEL_DOOR = tilesArea(44, 5, 2, 1);

/** Inside Dale's: where Dale stands behind the shop's counter, and the bin of bats. */
export const DALE_TILE = { col: 20, row: 3 } as const;
export const DALE_BIN_SPOT = T(23, 4);
/** Walking in here (just inside the shop door) starts the Second Opinion scene. */
export const DALE_AREA = tilesArea(18, 3, 5, 2);
export const HELLO_MAN_TILE = { col: 34, row: 7 } as const;
export const NOTICEBOARD_SPOT = T(5, 6);

/** Things Myko admires, each where the player will walk past. */
export const TOWN_ADMIRE = {
  busStation: T(9, 6),
  shop: T(18, 6),
  diner: T(34, 6),
  sidewalk: T(30, 7),
  road: T(25, 10),
  carPark: T(22, 16),
  waterTower: T(45, 15),
  flag: T(47, 13),
} as const;

export function townScreen(): ScreenLayout {
  const c = new Canvas(50, 20, 'a', 'ohio');
  // The lawns along the back, the sidewalks, the road with its line, the car park below.
  c.rect(1, 1, 48, 5, 'g').rect(1, 6, 48, 2, 'k').rect(1, 10, 48, 1, 'l').rect(1, 13, 48, 2, 'k');
  // Parking lines in the car park.
  for (let col = 4; col < 46; col += 4) c.rect(col, 16, 1, 2, 'm');
  c.rect(0, 0, 50, 1, '#').rect(0, 19, 50, 1, '#').rect(0, 0, 1, 20, '#').rect(49, 0, 1, 20, '#');
  // The farm track leaves the road at the east end.
  c.rect(49, 9, 1, 3, 'p');
  // The bus station, solid with windows.
  c.rect(2, 1, 10, 5, 'W').rect(2, 1, 10, 1, '#').rect(4, 3, 2, 1, 'w').rect(8, 3, 2, 1, 'w');
  // Dale's Sporting Goods: a shop with an open door in the front wall, the counter along the back.
  c.rect(14, 1, 13, 5, 'W').rect(14, 1, 13, 1, '#').rect(15, 2, 11, 3, '.').rect(16, 2, 9, 1, 'c');
  c.rect(16, 5, 2, 1, 'w').rect(23, 5, 2, 1, 'w').rect(20, 5, 2, 1, 'd');
  // The diner.
  c.rect(29, 1, 11, 5, 'W').rect(29, 1, 11, 1, '#').rect(31, 3, 2, 1, 'w').rect(36, 3, 2, 1, 'w');
  // The Starlite, with its door in the front wall.
  c.rect(41, 1, 8, 5, 'W').rect(41, 1, 8, 1, '#').rect(42, 3, 2, 1, 'w').rect(46, 3, 2, 1, 'w').rect(44, 5, 2, 1, 'd');
  const exits: ExitDef[] = [
    { id: 'c6.town.motel', area: TOWN_MOTEL_DOOR, toScreen: 'c6.motel', spawn: MOTEL_FROM_TOWN },
    { id: 'c6.town.track', area: TOWN_TO_FIELDS, toScreen: 'c6.fields', spawn: FIELDS_ARRIVAL },
  ];
  const props: PropPlacement[] = [
    // The bus station: the notice and the ticket machine.
    { id: 'town.notice', frame: PROP.noticeboard, col: 5, row: 5 },
    { id: 'town.tickets', frame: PROP.busTicketMachine, col: 9, row: 5 },
    // Dale's: the sign over the window, the bin of bats with the hurley in it.
    { id: 'dale.sign', frame: PROP.bookiesSign, col: 18, row: 5 },
    { id: 'dale.bin', frame: PROP.bins, col: 23, row: 4, solid: { width: 1, height: 1 } },
    { id: 'dale.hurley', frame: PROP.weapon.hurley, col: 23, row: 3 },
    // The diner's sign, and the water tower (32 x 48, standing on its bottom row of tiles) at the car park's east end.
    { id: 'diner.sign', frame: PROP.dinerSign, col: 34, row: 5 },
    { id: 'town.waterTower', frame: PROP.waterTower, col: 45, row: 14, solid: { dy: 2, width: 2, height: 1 } },
    // The flag (16 x 32, two frames of it moving), solid at its foot.
    { id: 'town.flag', frame: PROP.flag[0], frames: PROP.flag, frameRate: 2, col: 47, row: 13, solid: { dy: 1, width: 1, height: 1 } },
    // The motel's sign above its door.
    { id: 'town.motelSign', frame: PROP.motelSign, col: 43, row: 4 },
  ];
  const dressing: ScreenDressing = {
    props,
    npcs: [
      { id: 'dale', npc: 'americanA', col: DALE_TILE.col, row: DALE_TILE.row, facing: 'down', examinableId: 'c6.dale.shoulder' },
      { id: 'helloMan', npc: 'americanD', col: HELLO_MAN_TILE.col, row: HELLO_MAN_TILE.row, facing: 'down', examinableId: 'c6.town.hello' },
    ],
  };
  return c.build('c6.town', exits, TOWN_FROM_MOTEL, { dressing });
}

// ---------------------------------------------------------------------------
// c6.fields: Cornfields, 80 x 40
// ---------------------------------------------------------------------------

/** At the west end of the track, by the mailbox. */
export const FIELDS_ARRIVAL = T(3, 15);
export const FIELDS_TO_TOWN = tilesArea(0, 14, 1, 3);
/** Myko waits at the end of the lane, by the mailbox. */
export const MYKO_LANE_END = T(3, 18);
export const MAILBOX_SPOT = T(5, 18);

/** The track runs along rows 14 to 16 from the town to the maze. */
export const TRACK = { col: 1, row: 14, width: 55, height: 3 } as const;
/** The first sight of the fields: walking in at the lane's end starts `c6.fields.open`. */
export const FIELDS_OPEN_AREA = tilesArea(1, 13, 4, 5);

/** Stealth: the corn from the lane's end to the cleared yard. */
export const STEALTH_START = tilesArea(5, 13, 3, 5);
export const STEALTH_EXIT = tilesArea(44, 13, 3, 5);
export const STEALTH_ENTRANCE = MYKO_LANE_END;
export const STEALTH_REINFORCEMENTS: readonly Vec2[] = [T(20, 10), T(36, 20)];

/** The farm stand by the track's far end: an honesty box and the tile where the clean-run jar is left. */
export const FARM_STAND = { col: 42, row: 17 } as const;
export const FARM_STAND_PICKUP = T(43, 17);

/** Bottles: a cooler of light beer on every other fence post along the track. */
export const COOLER_COLS = [30, 32, 34, 36, 38, 40, 42, 44, 46] as const;
export const COOLER_ROW = 14;
export const COOLER_SPOTS: readonly Vec2[] = COOLER_COLS.map((col) => T(col, COOLER_ROW));
/** Extra breakable bottle crates at the corners of the combine arena. */
export const ARENA_BOTTLE_TILES: readonly TileCoord[] = [
  { col: 14, row: 8 },
  { col: 45, row: 8 },
  { col: 14, row: 23 },
  { col: 45, row: 23 },
];
export const ARENA_BOTTLE_SPOTS: readonly Vec2[] = ARENA_BOTTLE_TILES.map((t) => T(t.col, t.row));

/** Walking onto the track here, the drone sees Andrew regardless (the bottles lesson). */
export const TRACK_SPOTTED_AREA = tilesArea(28, 14, 3, 3);
/** The drone that spots him hovers in from here, above the track. */
export const LESSON_DRONE_SPAWN = T(36, 9);

/** The cleared yard in front of the formation: the drone fight. */
export const YARD = { col: 48, row: 8, width: 8, height: 17 } as const;
export const YARD_TRIGGER = tilesArea(46, 14, 2, 3);
/** Six drones (two waves of three) and two agents on foot. */
export const DRONE_SPAWNS: readonly Vec2[] = [T(50, 6), T(54, 6), T(52, 26), T(49, 26), T(55, 26), T(52, 4)];
export const AGENT_SPAWNS: readonly Vec2[] = [T(55, 9), T(55, 23)];
export const DRONE_FIGHT_ENTRANCE = T(44, 18);

/** The crop formation: a 21 x 17 maze of flattened paths, marked off with stakes and string. */
export const MAZE = { col: 56, row: 8, width: 21, height: 17 } as const;
/** Local (inside the maze) tile of its west opening and of the gate to the centre. */
export const MAZE_OPENING = { col: 0, row: 7 } as const;
export const MAZE_GATE = { col: 8, row: 7 } as const;
/** The centre room, 3 x 3, and the tile of the hatch in it. */
export const MAZE_CENTRE = { col: 9, row: 7, width: 3, height: 3 } as const;
export const MAZE_HATCH = { col: 10, row: 8 } as const;
/** Walking in at the maze's west opening starts `c6.maze.intro`. */
export const MAZE_INTRO_AREA = tilesArea(54, 14, 2, 3);

export interface MazeGrid {
  /** `walls[row][col]` is true for a staked wall, false for flattened path. */
  readonly walls: readonly (readonly boolean[])[];
  /** Local tiles of the three marker stones, in solution order: near the opening on the left, the far one, the one by the hatch. */
  readonly stones: readonly TileCoord[];
  /** Steps from the opening to each stone, in the same order. */
  readonly stoneDistances: readonly number[];
}

/** A small seeded generator so the maze is the same on every load. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Depth-first maze with the centre room and the gate pre-carved, and stones on dead ends. */
export function buildMaze(seed = 6): MazeGrid {
  const { width: w, height: h } = MAZE;
  const walls = Array.from({ length: h }, () => Array.from({ length: w }, () => true));
  const open = (col: number, row: number): void => {
    const r = walls[row];
    if (r) r[col] = false;
  };
  const isWall = (col: number, row: number): boolean => walls[row]?.[col] ?? true;
  const inRoom = (col: number, row: number): boolean =>
    col >= MAZE_CENTRE.col && col < MAZE_CENTRE.col + MAZE_CENTRE.width && row >= MAZE_CENTRE.row && row < MAZE_CENTRE.row + MAZE_CENTRE.height;
  for (let r = MAZE_CENTRE.row; r < MAZE_CENTRE.row + MAZE_CENTRE.height; r++) {
    for (let col = MAZE_CENTRE.col; col < MAZE_CENTRE.col + MAZE_CENTRE.width; col++) open(col, r);
  }
  const rand = lcg(seed);
  const key = (col: number, row: number): string => `${col},${row}`;
  const start: TileCoord = { col: 1, row: MAZE_OPENING.row };
  open(start.col, start.row);
  const visited = new Set<string>([key(start.col, start.row)]);
  const stack: TileCoord[] = [start];
  while (stack.length > 0) {
    const cur = stack[stack.length - 1] as TileCoord;
    const options = DIRS.map(([dc, dr]) => ({ col: cur.col + dc * 2, row: cur.row + dr * 2, dc, dr })).filter(
      (n) => n.col > 0 && n.col < w - 1 && n.row > 0 && n.row < h - 1 && !inRoom(n.col, n.row) && !visited.has(key(n.col, n.row)),
    );
    const pick = options[Math.floor(rand() * options.length)];
    if (!pick) {
      stack.pop();
      continue;
    }
    open(cur.col + pick.dc, cur.row + pick.dr);
    open(pick.col, pick.row);
    visited.add(key(pick.col, pick.row));
    stack.push({ col: pick.col, row: pick.row });
  }
  open(MAZE_OPENING.col, MAZE_OPENING.row);
  open(MAZE_GATE.col, MAZE_GATE.row);
  // Steps from the opening through every open tile (the gate counts as open).
  const dist = new Map<string, number>([[key(MAZE_OPENING.col, MAZE_OPENING.row), 0]]);
  const queue: TileCoord[] = [MAZE_OPENING];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i] as TileCoord;
    const here = dist.get(key(cur.col, cur.row)) ?? 0;
    for (const [dc, dr] of DIRS) {
      const n = { col: cur.col + dc, row: cur.row + dr };
      if (n.col < 0 || n.col >= w || n.row < 0 || n.row >= h || isWall(n.col, n.row) || dist.has(key(n.col, n.row))) continue;
      dist.set(key(n.col, n.row), here + 1);
      queue.push(n);
    }
  }
  const neighbours = (col: number, row: number): number => DIRS.filter(([dc, dr]) => !isWall(col + dc, row + dr)).length;
  const deadEnds: TileCoord[] = [];
  for (let r = 1; r < h - 1; r += 2) {
    for (let col = 1; col < w - 1; col += 2) {
      if (inRoom(col, r) || isWall(col, r)) continue;
      if (neighbours(col, r) === 1 && !(col === start.col && r === start.row)) deadEnds.push({ col, row: r });
    }
  }
  const d = (t: TileCoord): number => dist.get(key(t.col, t.row)) ?? 0;
  // Far: the dead end furthest from the opening. Near: on the left, the nearest one worth walking to.
  // By the hatch: the dead end closest to the centre.
  const byFar = [...deadEnds].sort((a, b) => d(b) - d(a));
  const far = byFar[0] as TileCoord;
  const near = deadEnds.filter((t) => t !== far && t.col <= 9 && d(t) >= 8).sort((a, b) => d(a) - d(b))[0] ?? (deadEnds[0] as TileCoord);
  const byHatch = deadEnds
    .filter((t) => t !== far && t !== near)
    .sort((a, b) => Math.hypot(a.col - MAZE_HATCH.col, a.row - MAZE_HATCH.row) - Math.hypot(b.col - MAZE_HATCH.col, b.row - MAZE_HATCH.row))[0] as TileCoord;
  const stones = [near, far, byHatch];
  return { walls, stones, stoneDistances: stones.map(d) };
}

function worldTile(t: TileCoord): TileCoord {
  return { col: MAZE.col + t.col, row: MAZE.row + t.row };
}

export const MAZE_GRID = buildMaze();
/** The stones in solution order (the pattern on the postcard), as world tiles. */
export const MAZE_STONES: readonly { readonly id: 'near' | 'far' | 'hatch'; readonly col: number; readonly row: number }[] = [
  { id: 'near', ...worldTile(MAZE_GRID.stones[0] as TileCoord) },
  { id: 'far', ...worldTile(MAZE_GRID.stones[1] as TileCoord) },
  { id: 'hatch', ...worldTile(MAZE_GRID.stones[2] as TileCoord) },
];
export const MAZE_ORDER: readonly string[] = MAZE_STONES.map((s) => s.id);
export const MAZE_GATE_TILE = worldTile(MAZE_GATE);
export const MAZE_HATCH_TILE = worldTile(MAZE_HATCH);
export const MAZE_OPENING_TILE = worldTile(MAZE_OPENING);
/** The receipt under the hatch: the key clue of the centre. */
export const CENTRE_RECEIPT_SPOT = T(MAZE_HATCH_TILE.col, MAZE_HATCH_TILE.row);

/** The combine arena: 36 x 20 of standing corn, the track crossing it. */
export const ARENA = { col: 12, row: 6, width: 36, height: 20 } as const;
/** Straight passes, north to south (and back), each four tiles wide, from the arena's top row to its bottom. */
export const COMBINE_LANES = [13, 20, 27, 34, 41].map((col, i) => ({ id: `lane${i + 1}`, col, width: 4, fromRow: ARENA.row, toRow: ARENA.row + ARENA.height - 1 }));
/** Where the combine comes in from, above the arena, and the two drones that escort it. */
export const COMBINE_ENTRY = T(30, 3);
export const COMBINE_ESCORT_SPAWNS: readonly Vec2[] = [T(22, 3), T(38, 3)];
/** The three sensor lights on its cab, in pixels from its centre. */
export const SENSOR_LIGHT_OFFSETS: readonly Vec2[] = [
  { x: -16, y: -20 },
  { x: 0, y: -24 },
  { x: 16, y: -20 },
];
/** Shadow markers the bales land on. */
export const BALE_SPOTS: readonly Vec2[] = [T(18, 9), T(25, 22), T(32, 10), T(39, 21), T(18, 22), T(25, 10), T(32, 22), T(39, 9)];
/** Where it ends: the irrigation ditch along the south edge, and the slow curve into it. */
export const DITCH = { col: 1, row: 37, width: 78, height: 2 } as const;
export const DITCH_CURVE: readonly Vec2[] = [T(30, 26), T(31, 31), T(34, 36), T(36, 37)];
/** Where Myko comes in from while the combine is on (the track's west bank). */
export const COMBINE_MYKO_ENTRANCE = T(10, 15);

/** Things Myko admires on the fields, along the track. */
export const FIELDS_ADMIRE = {
  mailbox: MAILBOX_SPOT,
  corn: T(8, 13),
  sky: T(20, 16),
  ditch: T(20, 36),
} as const;

/** Five drone patrols over the corn, west to east, the last over the way into the yard. */
export const FIELDS_STEALTH: StealthSectionDef = {
  id: 'c6.stealth.fields',
  checkpointId: 'c6.cp.fields',
  guards: [
    // Over the track's west half.
    { enemyId: 'drone', route: { mode: 'pingPong', waypoints: [{ position: T(8, 15), waitMs: 1500, facing: 'right' }, { position: T(26, 15), waitMs: 1500, facing: 'left' }] } },
    // North corn.
    { enemyId: 'drone', route: { mode: 'pingPong', waypoints: [{ position: T(10, 6), waitMs: 1200, facing: 'right' }, { position: T(40, 6), waitMs: 1200, facing: 'left' }] } },
    // South corn.
    { enemyId: 'drone', route: { mode: 'pingPong', waypoints: [{ position: T(10, 24), waitMs: 1200, facing: 'right' }, { position: T(40, 24), waitMs: 1200, facing: 'left' }] } },
    // Straight across the middle, over the track.
    { enemyId: 'drone', route: { mode: 'pingPong', waypoints: [{ position: T(30, 4), waitMs: 1800, facing: 'down' }, { position: T(30, 28), waitMs: 1800, facing: 'up' }] } },
    // The way into the yard.
    { enemyId: 'drone', route: { mode: 'pingPong', waypoints: [{ position: T(44, 9), waitMs: 2000, facing: 'down' }, { position: T(44, 22), waitMs: 2000, facing: 'up' }] } },
  ],
  hazards: [],
  hidingProps: [],
};

function fieldsCanvas(): Canvas {
  const c = new Canvas(80, 40, 'C', 'ohio');
  c.rect(0, 0, 80, 1, '#').rect(0, 39, 80, 1, '#').rect(0, 0, 1, 40, '#').rect(79, 0, 1, 40, '#');
  // Rows of corn with an aisle between every third row.
  for (let row = 3; row < 36; row += 4) c.rect(1, row, 78, 1, 'r');
  // The bank and the irrigation ditch along the south edge.
  c.rect(1, 36, 78, 1, 'p').rect(DITCH.col, DITCH.row, DITCH.width, DITCH.height, 'D');
  // The farm track, a clearing at the lane's end and the farm stand's lay-by.
  c.rect(TRACK.col, TRACK.row, TRACK.width, TRACK.height, 'p').rect(0, 14, 1, 3, 'p').rect(1, 17, 6, 3, 'p').rect(FARM_STAND.col - 1, FARM_STAND.row, 4, 1, 'p');
  // The cleared yard in front of the formation.
  c.rect(YARD.col, YARD.row, YARD.width, YARD.height, 'F');
  // The formation: flattened paths and staked walls, the maze's stones, the hatch.
  for (let r = 0; r < MAZE.height; r++) {
    for (let col = 0; col < MAZE.width; col++) c.set(MAZE.col + col, MAZE.row + r, MAZE_GRID.walls[r]?.[col] ? 'X' : 'F');
  }
  c.set(MAZE_HATCH_TILE.col, MAZE_HATCH_TILE.row, 'h');
  return c;
}

/** Every tile of standing corn in the fields: where Andrew hides if he stands still, and where moving rustles. */
export const FIELDS_CORN: readonly TileCoord[] = (() => {
  const c = fieldsCanvas();
  const tiles: TileCoord[] = [];
  for (let row = 0; row < c.height; row++) for (let col = 0; col < c.width; col++) if (c.char(col, row) === 'C') tiles.push({ col, row });
  return tiles;
})();
/** The part of it the combine will cut. */
export const ARENA_CORN: readonly TileCoord[] = FIELDS_CORN.filter(
  (t) => t.col >= ARENA.col && t.col < ARENA.col + ARENA.width && t.row >= ARENA.row && t.row < ARENA.row + ARENA.height,
);

/** Whole-tile rectangles covering exactly `tiles` (row runs, merged downwards when the next row has the same run). */
export function tileRects(tiles: readonly TileCoord[]): { col: number; row: number; width: number; height: number }[] {
  const byRow = new Map<number, number[]>();
  for (const t of tiles) byRow.set(t.row, [...(byRow.get(t.row) ?? []), t.col]);
  const open = new Map<string, { col: number; row: number; width: number; height: number }>();
  const out: { col: number; row: number; width: number; height: number }[] = [];
  for (const row of [...byRow.keys()].sort((a, b) => a - b)) {
    const cols = (byRow.get(row) ?? []).sort((a, b) => a - b);
    const runs: { col: number; width: number }[] = [];
    for (const col of cols) {
      const last = runs[runs.length - 1];
      if (last && last.col + last.width === col) last.width++;
      else runs.push({ col, width: 1 });
    }
    const next = new Map<string, { col: number; row: number; width: number; height: number }>();
    for (const r of runs) {
      const key = `${r.col},${r.width}`;
      const above = open.get(key);
      if (above && above.row + above.height === row) {
        above.height++;
        next.set(key, above);
      } else {
        const rect = { col: r.col, row, width: r.width, height: 1 };
        out.push(rect);
        next.set(key, rect);
      }
    }
    open.clear();
    for (const [k, v] of next) open.set(k, v);
  }
  return out;
}

export function fieldsScreen(): ScreenLayout {
  const c = fieldsCanvas();
  const exits: ExitDef[] = [{ id: 'c6.fields.town', area: FIELDS_TO_TOWN, toScreen: 'c6.town', spawn: TOWN_FROM_FIELDS }];
  const props: PropPlacement[] = [
    // The mailbox at the lane's end.
    { id: 'fields.mailbox', frame: PROP.mailbox, col: 5, row: 17, solid: { width: 1, height: 1 } },
    // The farm stand: its honesty box. The jar is spawned by the script when the run is clean.
    { id: 'fields.honestyBox', frame: PROP.honestyBox, col: FARM_STAND.col, row: FARM_STAND.row, solid: { width: 1, height: 1 } },
    { id: 'fields.hay', frame: PROP.hayBale, col: FARM_STAND.col + 1, row: FARM_STAND.row + 1, solid: { width: 1, height: 1 } },
    // The coolers of light beer, on the fence posts along the track.
    ...COOLER_COLS.map((col, i) => ({ id: `fields.cooler${i + 1}`, frame: PROP.coolerOnPost, col, row: COOLER_ROW })),
    // The marker stones (dark; the world view lights them as they are stepped on in order).
    ...MAZE_STONES.map((s) => ({ id: `maze.stone.${s.id}`, frame: PROP.markerStone.dark, col: s.col, row: s.row })),
    // The centre's gate, shut until the maze is solved, and the hatch that opens under it.
    { id: 'maze.gate', frame: PROP.fieldGate.across, col: MAZE_GATE_TILE.col, row: MAZE_GATE_TILE.row, solid: { width: 1, height: 1 } },
    { id: 'maze.hatch', frame: PROP.containerHatch, col: MAZE_HATCH_TILE.col, row: MAZE_HATCH_TILE.row, hidden: true },
    // Bottle crates at the arena's corners.
    ...ARENA_BOTTLE_TILES.map((t, i) => ({ id: `fields.arenaCrate${i + 1}`, frame: PROP.bottleCrate, col: t.col, row: t.row, solid: { width: 1, height: 1 }, breakable: {} })),
  ];
  return { ...c.build('c6.fields', exits, FIELDS_ARRIVAL, { mykoStart: MYKO_LANE_END, dressing: { props } }), corn: tileRects(FIELDS_CORN) };
}
