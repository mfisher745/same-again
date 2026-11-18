/**
 * Chapter 9 screens as tile layouts and dressing. Level data only (docs/chapters/09-level-minus-four.md): the offices
 * with the staff social area, the labs with the three gravity rooms, and the containment hall with its five bays, all in
 * the `base` region, plus every constant the script and the systems need.
 *
 * The gravity rooms and the bays are PLAIN DATA (`GRAVITY_ROOMS`, `HALL_BAYS`): the tiles of each screen are painted
 * from them, so the data and the walls cannot drift. The shapes are described on `GravityRoomDef` and `HallBayDef`.
 *
 * Art: `base` tiles (gravity switch panel, pressure plate, glass, blast frame, panel, cooler, dais) and the existing
 * props. STAND-INS still in use (each should become its own frame):
 *   - `PROP.cardboardBox` for the lost-property box (a box with a sticky note and a humming glove sticking out);
 *   - `PROP.flask` for the leaving-do tequila bottle on the kitchenette counter;
 *   - `PROP.controlBox` for the bay 3 wall recorder (a wall box with a red light and a tape slot);
 *   - `PROP.serviceGate.shut` for the blast door leaves (hall.door*.*) and the bay 2 and 4 barrier leaves (a 2 x 2 steel
 *     door leaf; the barrier should be a violet grille);
 *   - `PROP.crate` for the gravity rooms' crates (fine as it is, but they should look loose: a lighter crate);
 *   - `base` tile `consoleDais` for the ledge cells in the gravity rooms (a raised step, "H" in the room rows);
 *   - the hangar beyond the viewing window is empty floor and marking lines: the craft with its panel missing is not drawn.
 */

import { PROP } from '../../art/props';
import type { AreaRect, ExitDef, PropPlacement, ScreenLayout } from '../../core/chapter';
import type { EnemyId, Facing, HidingPropDef, PatrolRoute, StealthSectionDef, TileCoord, Vec2 } from '../../core/types';
import { Canvas, T, tilesArea } from '../canvas';

export { T, tilesArea };

const wait = (position: Vec2, waitMs: number, facing?: Facing) => (facing ? { position, waitMs, facing } : { position, waitMs });
const lane = (a: Vec2, b: Vec2, waitMs: number): PatrolRoute => ({ mode: 'pingPong', waypoints: [wait(a, waitMs), wait(b, waitMs)] });

// ---------------------------------------------------------------------------
// c9.offices: the lift lobby, the staff social area and the open plan, 40 x 25
// ---------------------------------------------------------------------------

/** The staff social area (the bar): Andrew arrives here at the start and after every return. In front of the kettle's counter, clear of it. */
export const BAR_ARRIVAL = T(32, 7);
/** In front of the kettle: where E offers the hot drink. */
export const TEA_SPOT = T(36, 3);
export const KETTLE_TILE = { col: 36, row: 2 } as const;
/** Myko's place in the social area. */
export const MYKO_BAR = T(30, 7);

/** Where Andrew steps in from the labs (the west door). */
export const OFFICES_FROM_LABS = T(3, 12);
export const OFFICES_TO_LABS = tilesArea(1, 11, 1, 3);

/** The lost-property box by the lift, and where E opens it (the Glove). */
export const LOST_PROPERTY_TILE = { col: 36, row: 17 } as const;
export const LOST_PROPERTY_SPOT = T(35, 17);
/** The filing cabinet by the plant, and where E opens it (`c9.proof.contract`). */
export const CABINET_TILE = { col: 3, row: 1 } as const;
export const CABINET_SPOT = T(3, 3);
/** The staff noticeboard, and where E reads it (`c9.proof.directory`). */
export const NOTICEBOARD_TILE = { col: 14, row: 1 } as const;
export const NOTICEBOARD_SPOT = T(14, 3);
/** The water cooler. */
export const COOLER_TILE = { col: 24, row: 1 } as const;
export const COOLER_SPOT = T(24, 3);
/** The kitchenette: the queue (stand in it to Act Natural), and the clean-run tequila on the counter (taken from `TEQUILA_SPOT`). */
export const KITCHENETTE_QUEUE = T(5, 20);
export const TEQUILA_TILE = { col: 8, row: 21 } as const;
export const TEQUILA_SPOT = T(8, 20);

/** The stealth section: walking out of the lobby into the open plan starts it; the west end of the aisle ends it. */
export const OFFICES_START = tilesArea(28, 10, 2, 5);
export const OFFICES_EXIT = tilesArea(2, 10, 2, 5);
/** Myko's phone place for the section, and where the `.alarm` fight's reinforcements come in. */
export const OFFICES_ENTRANCE = T(30, 12);
export const OFFICES_REINFORCEMENTS: readonly Vec2[] = [T(31, 12), T(31, 16)];

/** Hiding places to Act Natural beside (stand within `radius`, keep still): the cooler, the noticeboard, the kitchenette queue. */
export const OFFICES_HIDING: readonly HidingPropDef[] = [
  { id: 'c9.hide.cooler', kind: 'waterCooler', position: COOLER_SPOT, radius: 32 },
  { id: 'c9.hide.board', kind: 'noticeboard', position: NOTICEBOARD_SPOT, radius: 32 },
  { id: 'c9.hide.queue', kind: 'queue', position: KITCHENETTE_QUEUE, radius: 32 },
];

/**
 * The six seated clerks: stationary guards (`seated`, so their cones are the short seated ones) at desks in two banks, each
 * facing the way its chair is turned. The desk is the solid prop on the tile row beside it (`DESK_TILES`).
 */
export const SEATED_CLERKS: readonly { readonly tile: TileCoord; readonly facing: Facing }[] = [
  { tile: { col: 6, row: 5 }, facing: 'down' },
  { tile: { col: 12, row: 5 }, facing: 'left' },
  { tile: { col: 18, row: 5 }, facing: 'down' },
  { tile: { col: 6, row: 15 }, facing: 'up' },
  { tile: { col: 12, row: 15 }, facing: 'right' },
  { tile: { col: 18, row: 15 }, facing: 'up' },
];
/** The desks, 2 tiles wide, one beside each seated clerk (top-left tiles). */
export const DESK_TILES: readonly TileCoord[] = [
  { col: 6, row: 6 },
  { col: 12, row: 6 },
  { col: 18, row: 6 },
  { col: 6, row: 14 },
  { col: 12, row: 14 },
  { col: 18, row: 14 },
];

/** The two walking clerks: one paces the main aisle, one the south cross aisle. */
export const WALKING_CLERKS: readonly PatrolRoute[] = [lane(T(24, 10), T(9, 10), 1500), lane(T(25, 20), T(11, 20), 2000)];

export const OFFICES_STEALTH: StealthSectionDef = {
  id: 'c9.stealth.offices',
  checkpointId: 'c9.cp.offices',
  guards: [
    ...SEATED_CLERKS.map((s) => ({
      enemyId: 'clerk' as EnemyId,
      seated: true,
      route: { mode: 'stationary', waypoints: [wait(T(s.tile.col, s.tile.row), 0, s.facing)] } as PatrolRoute,
    })),
    ...WALKING_CLERKS.map((route) => ({ enemyId: 'clerk' as EnemyId, route })),
  ],
  hazards: [],
  hidingProps: OFFICES_HIDING,
  // The clean-run reward is the tequila on the kitchenette counter: the script reveals the `offices.tequila` prop.
};

/** The six overheard lines: one trigger area each along the route, `c9.offices.overheard.N`. */
export const OFFICES_OVERHEARD: readonly { readonly dialogueId: string; readonly area: AreaRect }[] = [
  { dialogueId: 'c9.offices.overheard.1', area: tilesArea(22, 8, 4, 4) },
  { dialogueId: 'c9.offices.overheard.2', area: tilesArea(16, 2, 4, 3) },
  { dialogueId: 'c9.offices.overheard.3', area: tilesArea(10, 2, 4, 3) },
  { dialogueId: 'c9.offices.overheard.4', area: tilesArea(4, 8, 4, 4) },
  { dialogueId: 'c9.offices.overheard.5', area: tilesArea(14, 17, 5, 3) },
  { dialogueId: 'c9.offices.overheard.6', area: tilesArea(3, 18, 4, 3) },
];

/** Walking into the lobby starts the Glove's hint (the box by the lift). */
export const LOBBY_AREA = tilesArea(30, 14, 8, 8);

export function officesScreen(): ScreenLayout {
  const c = new Canvas(40, 25, ',', 'base');
  c.room();
  // The east block (the social area at the top, the lift lobby at the bottom): hard floor, divided from the open plan by a wall.
  c.rect(28, 2, 10, 21, '.');
  c.rect(27, 2, 1, 21, 'W').rect(27, 10, 1, 5, '.');
  // The lift's doors, in the east wall.
  c.rect(38, 16, 1, 3, 'N');
  // The kitchenette: hard floor in the south-west, a counter along its south side.
  c.rect(2, 17, 8, 6, '.').rect(3, 21, 6, 1, 'c');
  // The west door to the labs.
  c.rect(1, 11, 1, 3, 'd');
  // The social area: the counter with the kettle, two tables with seats.
  c.rect(35, 2, 3, 1, 'c');
  c.set(30, 6, 't').set(29, 6, 's').set(31, 6, 's').set(32, 9, 't').set(31, 9, 's').set(33, 9, 's');

  const exits: ExitDef[] = [{ id: 'c9.offices.labs', area: OFFICES_TO_LABS, toScreen: 'c9.labs', spawn: LABS_FROM_OFFICES }];
  const props: PropPlacement[] = [
    // The staff social area: dartboard and the sign-up sheet on the wall, the fridge, the kettle and its steam.
    { id: 'bar.dartboard', frame: PROP.dartboard, col: 30, row: 1 },
    { id: 'bar.sheet', frame: PROP.signUpSheet, col: 32, row: 1 },
    { id: 'bar.fridge', frame: PROP.clubFridge, col: 34, row: 1, solid: { dy: 1, width: 1, height: 1 } },
    { id: 'bar.kettle', frame: PROP.kettle, col: KETTLE_TILE.col, row: KETTLE_TILE.row },
    { id: 'bar.steam', frame: PROP.steam[0], frames: PROP.steam, frameRate: 4, col: KETTLE_TILE.col, row: KETTLE_TILE.row - 1, hidden: true },
    // Lost property by the lift: the box (STAND-IN), an umbrella stand beside it.
    { id: 'offices.lostProperty', frame: PROP.cardboardBox, col: LOST_PROPERTY_TILE.col, row: LOST_PROPERTY_TILE.row, solid: { width: 1, height: 1 } },
    { id: 'offices.umbrellas', frame: PROP.umbrellaStand.full, col: 36, row: 19, solid: { width: 1, height: 1 } },
    // The open plan: the cabinet by the plant, the noticeboard, the cooler.
    { id: 'offices.cabinet', frame: PROP.filingCabinet.shut, col: CABINET_TILE.col, row: CABINET_TILE.row, solid: { dy: 1, width: 1, height: 1 } },
    { id: 'offices.plant', frame: PROP.flowerPot, col: 5, row: 2, solid: { width: 1, height: 1 } },
    { id: 'offices.board', frame: PROP.noticeboard, col: NOTICEBOARD_TILE.col, row: NOTICEBOARD_TILE.row, solid: { dy: 1, width: 1, height: 1 } },
    { id: 'offices.cooler', frame: PROP.waterCooler, col: COOLER_TILE.col, row: COOLER_TILE.row, solid: { dy: 1, width: 1, height: 1 } },
    // The desks, in two banks; the clerks sit at them (`SEATED_CLERKS`).
    ...DESK_TILES.map((d, i) => ({ id: `offices.desk${i + 1}`, frame: PROP.officeDesk, col: d.col, row: d.row, solid: { width: 2, height: 1 } })),
    // The kitchenette: the fridge and the leaving-do tequila (STAND-IN), shown by the script after a clean run.
    { id: 'offices.fridge', frame: PROP.clubFridge, col: 2, row: 17, solid: { dy: 1, width: 1, height: 1 } },
    { id: 'offices.tequila', frame: PROP.flask, col: TEQUILA_TILE.col, row: TEQUILA_TILE.row, hidden: true },
  ];
  return c.build('c9.offices', exits, BAR_ARRIVAL, { mykoStart: MYKO_BAR, dressing: { props } });
}

// ---------------------------------------------------------------------------
// c9.labs: the labs, 60 x 40
// ---------------------------------------------------------------------------

/** Just inside the labs' west door (from the offices) and east door (from the hall). */
export const LABS_FROM_OFFICES = T(3, 18);
export const LABS_FROM_HALL = T(56, 18);
export const LABS_TO_OFFICES = tilesArea(1, 17, 1, 3);
export const LABS_TO_HALL = tilesArea(58, 17, 1, 3);

/** The hangar viewing window (glass in the wall) and where E photographs the craft (`c9.proof.craft`, after the gravity puzzle). */
export const HANGAR_WINDOW = { col: 10, row: 9, width: 17, height: 1 } as const;
export const HANGAR_SPOT = T(18, 10);
/** The records room in the north-east, its door, and where E reads the flight log (`c9.proof.log`). */
export const RECORDS_ROOM = { col: 33, row: 2, width: 24, height: 7 } as const;
export const RECORDS_DOOR = tilesArea(45, 9, 2, 1);
export const LOG_TILE = { col: 52, row: 3 } as const;
export const LOG_SPOT = T(52, 4);
/** Walking up to the window, and into the records room, starts the labs' hints. */
export const HANGAR_AREA = tilesArea(12, 10, 13, 3);
export const RECORDS_AREA = tilesArea(40, 3, 14, 5);

/** The labs fight: the whole hall, two waves of two `security` and two `clerk`s. */
export const LABS_FIGHT_AREA = tilesArea(5, 11, 50, 15);
export const LABS_FIGHT_TRIGGER = tilesArea(9, 11, 1, 15);
/** Four spawns down the east side (the first two for `security`, the others for `clerk`s) and Myko's phone place. */
export const LABS_SPAWNS: readonly Vec2[] = [T(52, 13), T(52, 23), T(48, 16), T(48, 20)];
export const LABS_ENTRANCE = T(4, 22);
/** Low cover in the hall, for flanking the shields. */
export const LABS_COVER: readonly { readonly col: number; readonly row: number; readonly width: number; readonly height: number }[] = [
  { col: 16, row: 14, width: 2, height: 2 },
  { col: 16, row: 21, width: 2, height: 2 },
  { col: 28, row: 17, width: 3, height: 2 },
  { col: 39, row: 13, width: 2, height: 2 },
  { col: 39, row: 22, width: 2, height: 2 },
];

export type GravityDirection = 'up' | 'down' | 'left' | 'right';

/**
 * One gravity switch: a wall panel (`G` tile) worked with the Glove from `standAt` (an open cell). Pressing it sets which
 * way is down for the room: every loose thing, Andrew included, slides that way until something stops it.
 * `direction` is explicit and is NOT always the wall the panel is on: Andrew stands next to the panel, so a switch that
 * pulled him toward its own wall would never move him. Cells are room-local (col, row from the room's top-left corner).
 */
export interface GravitySwitchDef {
  readonly id: string;
  /** The wall cell the panel is in. */
  readonly wall: TileCoord;
  /** The open cell Andrew stands in to press it. */
  readonly standAt: TileCoord;
  readonly direction: GravityDirection;
}

/**
 * A gravity room as plain data. `rows` is the terrain, room-local, walls included:
 *   `#` wall (also the pillars and the wall cells holding switches and the door), `.` open floor, `H` a ledge:
 *   open to a slide (a slide runs over it and can stop on it) but not to walking.
 * Everything else is listed by cell. Rules the systems follow: Andrew walks freely on open floor (not onto crates or
 * ledges); a switch press makes everything loose slide toward `direction`, the ones nearest that wall first, until
 * blocked by a wall or by another loose thing; the door is a wall while the room is under gravity and opens once the
 * room is solved. Solved: Andrew rests on `goal`, and if there is a `plate` a crate rests on it. A reset puts Andrew
 * back on `start` and the crates on `crates`.
 */
export interface GravityRoomDef {
  readonly id: string;
  /** Screen tile of the room's top-left corner. */
  readonly origin: TileCoord;
  readonly rows: readonly string[];
  /** The doorway (a wall cell on the screen's side) and the open cell just inside it. */
  readonly door: TileCoord;
  readonly entry: TileCoord;
  /** Where Andrew starts (after a reset too). Reached by walking from `entry`. */
  readonly start: TileCoord;
  readonly crates: readonly TileCoord[];
  readonly switches: readonly GravitySwitchDef[];
  readonly plate?: TileCoord;
  readonly goal: TileCoord;
  /** The Myko line that introduces the room. */
  readonly promptDialogueId: string;
}

export const GRAVITY_ROOMS: readonly GravityRoomDef[] = [
  // Room 1: one switch teaches the idea. Walk to the panel on the east wall, press: fall west onto the ledge.
  {
    id: 'c9.gravity.room1',
    origin: { col: 4, row: 31 },
    rows: ['#########', '#.......#', '#H......#', '#.......#', '#########'],
    door: { col: 4, row: 0 },
    entry: { col: 4, row: 1 },
    start: { col: 4, row: 3 },
    crates: [],
    switches: [{ id: 'c9.gravity.room1.a', wall: { col: 8, row: 2 }, standAt: { col: 7, row: 2 }, direction: 'left' }],
    goal: { col: 1, row: 2 },
    promptDialogueId: 'c9.gravity.intro',
  },
  // Room 2: two switches and a crate that has to end on the plate. Left (the crate to the west wall), then up (it stops
  // under the pillar, on the plate). Andrew then walks to the pad in the north-east.
  {
    id: 'c9.gravity.room2',
    origin: { col: 19, row: 30 },
    rows: ['###########', '##........#', '#.........#', '#.........#', '#.........#', '#.........#', '###########'],
    door: { col: 5, row: 0 },
    entry: { col: 5, row: 1 },
    start: { col: 5, row: 5 },
    crates: [{ col: 6, row: 3 }],
    switches: [
      { id: 'c9.gravity.room2.left', wall: { col: 10, row: 5 }, standAt: { col: 9, row: 5 }, direction: 'left' },
      { id: 'c9.gravity.room2.up', wall: { col: 1, row: 6 }, standAt: { col: 1, row: 5 }, direction: 'up' },
    ],
    plate: { col: 1, row: 2 },
    goal: { col: 9, row: 1 },
    promptDialogueId: 'c9.gravity.room2',
  },
  // Room 3: two switches, and Andrew has to land on the ledge by sliding into a crate he parked first. Up (the crate
  // stops under its pillar, Andrew under his), then one step east and left: Andrew stops on the ledge against the crate (which a pillar holds against the pull to the west).
  {
    id: 'c9.gravity.room3',
    origin: { col: 35, row: 30 },
    rows: ['###########', '#...#...#.#', '#..#.H....#', '#.........#', '#.........#', '#.........#', '###########'],
    door: { col: 5, row: 0 },
    entry: { col: 5, row: 1 },
    start: { col: 2, row: 5 },
    crates: [{ col: 4, row: 4 }],
    switches: [
      { id: 'c9.gravity.room3.up', wall: { col: 8, row: 6 }, standAt: { col: 8, row: 5 }, direction: 'up' },
      { id: 'c9.gravity.room3.left', wall: { col: 10, row: 2 }, standAt: { col: 9, row: 2 }, direction: 'left' },
    ],
    goal: { col: 5, row: 2 },
    promptDialogueId: 'c9.gravity.room3',
  },
];

/** Screen tile of a room-local cell. */
export const gravityTile = (room: GravityRoomDef, cell: TileCoord): TileCoord => ({ col: room.origin.col + cell.col, row: room.origin.row + cell.row });
/** Centre of a room-local cell, in pixels. */
export const gravityCentre = (room: GravityRoomDef, cell: TileCoord): Vec2 => {
  const t = gravityTile(room, cell);
  return T(t.col, t.row);
};
/** Walking up to a room's door starts its prompt line (`GravityRoomDef.promptDialogueId`). */
export const GRAVITY_ENTRY_AREAS: readonly AreaRect[] = GRAVITY_ROOMS.map((r) => tilesArea(r.origin.col + r.door.col - 1, r.origin.row - 3, 3, 3));
/** The prop id of a room's k-th crate (0-based): `gravity.roomN.crate<k+1>`. The systems move these. */
export const gravityCrateId = (room: GravityRoomDef, k: number): string => `${room.id.replace('c9.', '')}.crate${k + 1}`;

export function labsScreen(): ScreenLayout {
  const c = new Canvas(60, 40, '.', 'base');
  c.room();
  // Doors: west to the offices, east to the hall.
  c.rect(1, 17, 1, 3, 'd').rect(58, 17, 1, 3, 'd');
  // The hangar behind the viewing window: a sealed floor with marking lines, a wall of its own, glass in the wall.
  c.rect(4, 2, 27, 7, '.').rect(5, 3, 25, 1, 'm').rect(5, 7, 25, 1, 'm');
  c.rect(4, 9, 27, 1, 'W').rect(HANGAR_WINDOW.col, HANGAR_WINDOW.row, HANGAR_WINDOW.width, 1, 'g');
  c.rect(31, 2, 2, 8, 'W');
  // The records room: carpet, a wall along its south side with a door, two rows of archive racks (cover tiles), a table for the log.
  c.rect(RECORDS_ROOM.col, RECORDS_ROOM.row, RECORDS_ROOM.width, RECORDS_ROOM.height, ',');
  c.rect(33, 9, 25, 1, 'W').rect(RECORDS_DOOR.x / 16, RECORDS_DOOR.y / 16, 2, 1, 'd');
  c.rect(35, 3, 8, 1, 'o').rect(35, 6, 8, 1, 'o');
  c.set(LOG_TILE.col, LOG_TILE.row, 't');
  // The hall's cover, and marking lines for the fight.
  for (const b of LABS_COVER) c.rect(b.col, b.row, b.width, b.height, 'o');
  c.rect(6, 18, 6, 1, 'm').rect(46, 18, 8, 1, 'm');
  // The gravity rooms, painted from their data.
  for (const room of GRAVITY_ROOMS) {
    room.rows.forEach((line, r) => {
      [...line].forEach((ch, col) => {
        const at = gravityTile(room, { col, row: r });
        c.set(at.col, at.row, ch === '#' ? 'W' : ch === 'H' ? 'D' : '.');
      });
    });
    for (const sw of room.switches) {
      const at = gravityTile(room, sw.wall);
      c.set(at.col, at.row, 'G');
    }
    const door = gravityTile(room, room.door);
    c.set(door.col, door.row, 'd');
    if (room.plate) {
      const at = gravityTile(room, room.plate);
      c.set(at.col, at.row, 'P');
    }
  }

  const exits: ExitDef[] = [
    { id: 'c9.labs.offices', area: LABS_TO_OFFICES, toScreen: 'c9.offices', spawn: OFFICES_FROM_LABS },
    { id: 'c9.labs.hall', area: LABS_TO_HALL, toScreen: 'c9.hall', spawn: HALL_FROM_LABS },
  ];
  const props: PropPlacement[] = [
    // The crates in the gravity rooms: the systems move these.
    ...GRAVITY_ROOMS.flatMap((room) =>
      room.crates.map((cell, k) => {
        const at = gravityTile(room, cell);
        return { id: gravityCrateId(room, k), frame: PROP.crate, col: at.col, row: at.row };
      }),
    ),
    { id: 'labs.plant', frame: PROP.flowerPot, col: 4, row: 12, solid: { width: 1, height: 1 } },
    { id: 'labs.cooler', frame: PROP.waterCooler, col: 55, row: 11, solid: { dy: 1, width: 1, height: 1 } },
  ];
  return c.build('c9.labs', exits, LABS_FROM_OFFICES, { mykoStart: T(4, 19), dressing: { props } });
}

// ---------------------------------------------------------------------------
// c9.hall: the containment hall, 50 x 30
// ---------------------------------------------------------------------------

/** Just inside the hall's west door (from the labs). */
export const HALL_FROM_LABS = T(3, 15);
export const HALL_TO_LABS = tilesArea(1, 14, 1, 3);

/** The bays occupy rows 6 to 23; a door line is 2 columns of blast frame with a 4-row opening (rows 13 to 16). */
export const BAY_ROWS = { from: 6, to: 23 } as const;
export const DOOR_OPENING_ROWS = { from: 13, to: 16 } as const;
export const DOOR_COLS: readonly number[] = [11, 19, 27, 35, 43];

/** A guard in a bay: stands where he is put (`facing`), does not need to be beaten, only passed. */
export interface BayGuardDef {
  readonly enemyId: Extract<EnemyId, 'security' | 'clerk'>;
  readonly tile: TileCoord;
  readonly facing: Facing;
}

/** The gravity switch of bay 2 or 4: a `G` panel in the bay's north or south wall, and the barrier it drops. */
export interface BayGravityDef {
  /** Screen tiles. Pressing it slides the bay's guards `direction` and hides the barrier. */
  readonly switch: { readonly id: string; readonly wall: TileCoord; readonly standAt: TileCoord; readonly direction: GravityDirection };
  /** The barrier across the whole bay (columns `col` and `col + 1`, rows `BAY_ROWS`): shown until the switch is pressed. Leaf prop ids, top to bottom, each 2 x 2 and solid. */
  readonly barrier: { readonly col: number; readonly propIds: readonly string[] };
}

/**
 * One bay as plain data, in screen tiles. `cols` are inclusive. `door` is the line that closes (`hall.doorN.a` and `.b`
 * are its two leaf props, hidden until it closes, each 2 x 2 tiles and solid; `area` is the opening in pixels).
 * `start` is where Andrew is sent back to when a door closes on him. Bay 3 also has the wall recorder.
 */
export interface HallBayDef {
  readonly index: 1 | 2 | 3 | 4 | 5;
  readonly cols: { readonly from: number; readonly to: number };
  readonly door: { readonly col: number; readonly width: 2; readonly rowFrom: number; readonly rowTo: number; readonly propIds: readonly [string, string]; readonly area: AreaRect };
  readonly start: Vec2;
  readonly guards: readonly BayGuardDef[];
  readonly gravity?: BayGravityDef;
  readonly recorder?: { readonly tile: TileCoord; readonly spot: Vec2 };
}

const bayDoor = (n: number, col: number): HallBayDef['door'] => ({
  col,
  width: 2,
  rowFrom: DOOR_OPENING_ROWS.from,
  rowTo: DOOR_OPENING_ROWS.to,
  propIds: [`hall.door${n}.a`, `hall.door${n}.b`],
  area: tilesArea(col, DOOR_OPENING_ROWS.from, 2, DOOR_OPENING_ROWS.to - DOOR_OPENING_ROWS.from + 1),
});

/** The barrier across a bay is `(BAY_ROWS.to - BAY_ROWS.from + 1) / 2` leaves of 2 x 2, top to bottom. */
const barrierIds = (n: number): string[] => Array.from({ length: (BAY_ROWS.to - BAY_ROWS.from + 1) / 2 }, (_, k) => `hall.barrier${n}.${k + 1}`);

export const HALL_BAYS: readonly HallBayDef[] = [
  {
    index: 1,
    cols: { from: 2, to: 10 },
    door: bayDoor(1, 11),
    start: T(3, 15),
    guards: [
      { enemyId: 'security', tile: { col: 7, row: 9 }, facing: 'down' },
      { enemyId: 'clerk', tile: { col: 7, row: 21 }, facing: 'up' },
    ],
  },
  {
    index: 2,
    cols: { from: 13, to: 18 },
    door: bayDoor(2, 19),
    start: T(14, 15),
    guards: [
      { enemyId: 'security', tile: { col: 17, row: 9 }, facing: 'down' },
      { enemyId: 'clerk', tile: { col: 17, row: 20 }, facing: 'up' },
    ],
    // The switch is in the north wall, on Andrew's left as he walks east, before the barrier. It drops the barrier and tips the guards north.
    gravity: {
      switch: { id: 'c9.hall.bay2.switch', wall: { col: 14, row: 5 }, standAt: { col: 14, row: 6 }, direction: 'up' },
      barrier: { col: 15, propIds: barrierIds(2) },
    },
  },
  {
    index: 3,
    cols: { from: 21, to: 26 },
    door: bayDoor(3, 27),
    start: T(22, 15),
    guards: [
      { enemyId: 'security', tile: { col: 24, row: 19 }, facing: 'up' },
      { enemyId: 'clerk', tile: { col: 24, row: 10 }, facing: 'down' },
    ],
    // The wall recorder in the north wall, with the red light. Taking the tape is done standing at `spot`.
    recorder: { tile: { col: 23, row: 4 }, spot: T(23, 6) },
  },
  {
    index: 4,
    cols: { from: 29, to: 34 },
    door: bayDoor(4, 35),
    start: T(30, 15),
    guards: [
      { enemyId: 'security', tile: { col: 33, row: 20 }, facing: 'up' },
      { enemyId: 'clerk', tile: { col: 33, row: 9 }, facing: 'down' },
    ],
    // The switch is in the south wall, before the barrier. It drops the barrier and tips the guards south.
    gravity: {
      switch: { id: 'c9.hall.bay4.switch', wall: { col: 30, row: 24 }, standAt: { col: 30, row: 23 }, direction: 'down' },
      barrier: { col: 31, propIds: barrierIds(4) },
    },
  },
  {
    index: 5,
    cols: { from: 37, to: 42 },
    door: bayDoor(5, 43),
    start: T(38, 15),
    guards: [
      { enemyId: 'security', tile: { col: 40, row: 9 }, facing: 'down' },
      { enemyId: 'clerk', tile: { col: 40, row: 21 }, facing: 'up' },
      { enemyId: 'clerk', tile: { col: 41, row: 15 }, facing: 'left' },
    ],
  },
];

/** The lift at the far end: the lift room behind bay 5's door, the guard who goes on his break, the lift's doors and where Andrew stands. */
export const LIFT_ROOM = { col: 45, row: 12, width: 3, height: 7 } as const;
export const LIFT_GUARD_SPOT = T(46, 13);
export const LIFT_GUARD_FACING: Facing = 'left';
/** In front of the lift's doors, and the doorway Andrew walks into to leave (the set piece's exit). */
export const LIFT_SPOT = T(46, 16);
export const LIFT_AREA = tilesArea(47, 14, 1, 4);
/** The wand is picked up from where the guard puts it down. */
export const WAND_TILE = { col: 46, row: 14 } as const;
/** Myko's phone place for the set piece. */
export const HALL_ENTRANCE = T(3, 14);
/** Walking into bay 1 starts the lockdown (the script decides whether it is allowed). */
export const LOCKDOWN_TRIGGER = tilesArea(5, 12, 1, 6);

export function hallScreen(): ScreenLayout {
  const c = new Canvas(50, 30, 'W', 'base');
  c.room();
  // The bays' floor, between the masses of wall above and below.
  const rows = BAY_ROWS.to - BAY_ROWS.from + 1;
  c.rect(2, BAY_ROWS.from, 46, rows, '.');
  // Blast door lines: two columns of frame, the 4-row opening left as floor.
  for (const col of DOOR_COLS) {
    c.rect(col, BAY_ROWS.from, 2, rows, 'B');
    c.rect(col, DOOR_OPENING_ROWS.from, 2, DOOR_OPENING_ROWS.to - DOOR_OPENING_ROWS.from + 1, '.');
  }
  // The lift room: a sealed room behind the last door, the lift's doors in the east wall.
  c.rect(LIFT_ROOM.col, BAY_ROWS.from, LIFT_ROOM.width, rows, 'W').rect(LIFT_ROOM.col, LIFT_ROOM.row, LIFT_ROOM.width, LIFT_ROOM.height, '.');
  c.rect(48, 14, 1, 4, 'N');
  // The west door to the labs.
  c.rect(1, 14, 1, 3, 'd');
  // The gravity switches in bays 2 and 4.
  for (const bay of HALL_BAYS) if (bay.gravity) c.set(bay.gravity.switch.wall.col, bay.gravity.switch.wall.row, 'G');
  // Cover: low blocks in bays 1, 3 and 5, clear of the lane.
  for (const [col, row] of [[4, 9], [4, 20], [22, 8], [25, 21], [38, 8], [41, 20]] as const) c.rect(col, row, 1, 2, 'o');

  const exits: ExitDef[] = [{ id: 'c9.hall.labs', area: HALL_TO_LABS, toScreen: 'c9.labs', spawn: LABS_FROM_HALL }];
  const props: PropPlacement[] = [
    // Blast doors: hidden until the lockdown closes them (each line is two 2 x 2 leaves).
    ...HALL_BAYS.flatMap((bay) =>
      bay.door.propIds.map((id, k) => ({
        id,
        frame: PROP.serviceGate.shut,
        col: bay.door.col,
        row: bay.door.rowFrom + k * 2,
        solid: { width: 2, height: 2 },
        blocksSight: true as const,
        hidden: true,
      })),
    ),
    // The barriers in bays 2 and 4: leaves from top to bottom, hidden by the script when the switch is pressed.
    ...HALL_BAYS.flatMap((bay) =>
      (bay.gravity?.barrier.propIds ?? []).map((id, k) => ({ id, frame: PROP.serviceGate.shut, col: bay.gravity?.barrier.col ?? 0, row: BAY_ROWS.from + k * 2, solid: { width: 2, height: 2 } })),
    ),
    // The wall recorder in bay 3.
    ...HALL_BAYS.flatMap((bay) => (bay.recorder ? [{ id: 'hall.recorder', frame: PROP.controlBox, col: bay.recorder.tile.col, row: bay.recorder.tile.row, solid: { dy: 1, width: 1, height: 1 } }] : [])),
    // The wand on the floor where the guard puts it down (shown by the script).
    { id: 'hall.wand', frame: PROP.weapon.securityWand, col: WAND_TILE.col, row: WAND_TILE.row, hidden: true },
  ];
  return c.build('c9.hall', exits, HALL_FROM_LABS, { mykoStart: HALL_ENTRANCE, dressing: { props } });
}
