/**
 * Chapter 5 screens as tile layouts, dressing and the constants the script will need. Level data only
 * (docs/chapters/05-the-paper-trail.md): the hotel bar, the public lobby, the records floor and the archive
 * stacks, all in the `cities` region.
 *
 * Stand-in art: the atlas has no photocopier, lightbox, water cooler, ticket machine, security desk, umbrella
 * stand, loose sheet or rolling shelf, so existing frames stand in for them (noted at each prop). Swap the frame
 * names here when the art lands; nothing else depends on them.
 */

import { PROP } from '../../art/props';
import type { ExitDef, NpcPlacement, PropPlacement, ScreenAmbient, ScreenDressing, ScreenLayout } from '../../core/chapter';
import type { HidingPropDef, PatrolRoute, StealthSectionDef, Vec2 } from '../../core/types';
import { Canvas, T, tilesArea } from '../canvas';

export { T, tilesArea };

const px = (col: number, row: number): Vec2 => T(col, row);

// ---------------------------------------------------------------------------
// c5.bar: the hotel bar, 30 x 17
// ---------------------------------------------------------------------------

/** The marked spot: where Andrew arrives, at the start and after every return. */
export const BAR_ARRIVAL = T(9, 8);
/** Where E asks the barman for the hot drink, on the customer side of the counter. */
export const TEA_SPOT = T(8, 6);
/** Myko's seat in the bottom left corner, apart from the man in the lanyard. */
export const MYKO_CHAIR = T(4, 13);
/** Where Andrew steps back in from the street. */
export const BAR_FROM_LOBBY = T(14, 13);
export const BARMAN_TILE = { col: 12, row: 4 } as const;
export const LANYARD_TILE = { col: 22, row: 10 } as const;

export function barScreen(): ScreenLayout {
  const c = new Canvas(30, 17, 'a', 'cities');
  c.rect(0, 0, 30, 1, '#').rect(0, 16, 30, 1, '#').rect(0, 0, 1, 17, '#').rect(29, 0, 1, 17, '#');
  c.rect(1, 1, 28, 1, 'W').rect(1, 15, 28, 1, 'W').rect(1, 1, 1, 15, 'W').rect(28, 1, 1, 15, 'W');
  // The door across the street to the lobby, south wall.
  c.rect(14, 15, 2, 1, 'd');
  // The back bar and the counter, closed off at both ends, with a stool at four seats.
  c.rect(4, 2, 19, 1, 'S').rect(3, 2, 1, 4, 'W').rect(23, 2, 1, 4, 'W').rect(4, 5, 19, 1, 'c');
  for (const col of [6, 10, 16, 20]) c.set(col, 6, 's');
  // The lanyard man's table, Myko's table in the bottom left, and one empty one between.
  c.rect(22, 9, 2, 1, 't').set(21, 9, 's').set(24, 9, 's');
  c.rect(4, 12, 2, 1, 't').set(3, 12, 's').set(6, 12, 's');
  c.rect(12, 10, 2, 1, 't').set(11, 10, 's').set(14, 10, 's');
  const exits: ExitDef[] = [{ id: 'c5.bar.door', area: tilesArea(14, 15, 2, 1), toScreen: 'c5.lobby', spawn: LOBBY_FROM_BAR }];
  const props: PropPlacement[] = [
    // The coffee that has been on since six, with steam while the hot drink can be taken (the script shows and hides it).
    { id: 'bar.coffee', frame: PROP.coffeePot, col: 8, row: 4 },
    { id: 'bar.steam', frame: PROP.steam[0], frames: PROP.steam, frameRate: 4, col: 8, row: 3, hidden: true },
    { frame: PROP.beerTaps, col: 17, row: 4 },
    { frame: PROP.deadPlant, col: 26, row: 3, solid: { width: 1, height: 1 } },
    { frame: PROP.bins, col: 26, row: 13, solid: { width: 1, height: 1 } },
    { id: 'bar.p1', frame: PROP.bottleCrate, col: 25, row: 13, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'bar.p2', frame: PROP.cardboardBox, col: 3, row: 14, solid: { width: 1, height: 1 }, breakable: {} },
  ];
  const npcs: NpcPlacement[] = [
    // The barman, polishing one glass. Talking to him is the hot drink.
    { id: 'barman', npc: 'localB', col: BARMAN_TILE.col, row: BARMAN_TILE.row, facing: 'down', examinableId: 'c5.tea' },
    // The other customer, in a lanyard.
    { id: 'lanyard', npc: 'americanB', col: LANYARD_TILE.col, row: LANYARD_TILE.row, facing: 'left' },
  ];
  const ambient: ScreenAmbient = {
    tint: 'navyDark',
    strength: 0.28,
    lights: [
      { x: 8 * 16, y: 4 * 16, radius: 72, colour: 'amberLight', glow: 0.2 },
      { x: 22 * 16 + 16, y: 8 * 16, radius: 56, colour: 'amberLight', glow: 0.15 },
      { x: 15 * 16, y: 15 * 16, radius: 40, colour: 'amber', glow: 0.1 },
    ],
  };
  const dressing: ScreenDressing = { props, npcs };
  return c.build('c5.bar', exits, BAR_ARRIVAL, { mykoStart: MYKO_CHAIR, dressing, ambient });
}

// ---------------------------------------------------------------------------
// c5.lobby: the public lobby, 40 x 20
// ---------------------------------------------------------------------------

/** Just inside the street door. */
export const LOBBY_FROM_BAR = T(19, 16);
/** Just inside the Staff door, when Andrew comes back from the floor. */
export const LOBBY_FROM_FLOOR = T(33, 3);
/** The ticket machine, and where to stand to take a number. Andrew's is 847; they are serving 12. */
export const TICKET_MACHINE = { col: 16, row: 15 } as const;
export const TICKET_SPOT = T(17, 16);
/** The noticeboard with the retirement sign-up sheet, and where Andrew stands to read it. */
export const NOTICEBOARD = { col: 26, row: 1 } as const;
export const RETIREMENT_SPOT = T(26, 3);
/** The Staff door, north wall. */
export const STAFF_DOOR = tilesArea(33, 1, 2, 1);
/** The security desk, beside the Staff door. */
export const SECURITY_DESK = { col: 30, row: 4 } as const;
/** The queue: ropes on rows 8 and 11, the line of people on row 9, row 10 free to stand in. */
export const LOBBY_QUEUE_AREA = tilesArea(8, 8, 10, 4);

/**
 * The lobby guard (Act Natural is taught on him). Not a stealth section in the spec, so this is data for the
 * script to build the guard from: a route and the props to hide beside (the queue and the noticeboard), which
 * lie between the street door and the Staff door.
 */
export const LOBBY_GUARD_ROUTE: PatrolRoute = {
  mode: 'pingPong',
  waypoints: [
    { position: px(25, 6), waitMs: 2500, facing: 'right' },
    { position: px(36, 6), waitMs: 2500, facing: 'left' },
  ],
};
export const LOBBY_HIDING: readonly HidingPropDef[] = [
  { id: 'c5.hide.lobbyQueue', kind: 'queue', position: T(15, 10), radius: 36 },
  { id: 'c5.hide.lobbyBoard', kind: 'noticeboard', position: RETIREMENT_SPOT, radius: 32 },
];

export function lobbyScreen(): ScreenLayout {
  const c = new Canvas(40, 20, '.', 'cities');
  c.rect(0, 0, 40, 1, '#').rect(0, 19, 40, 1, '#').rect(0, 0, 1, 20, '#').rect(39, 0, 1, 20, '#');
  c.rect(1, 1, 38, 1, 'W').rect(1, 18, 38, 1, 'W').rect(1, 1, 1, 18, 'W').rect(38, 1, 1, 18, 'W');
  // The street door (south) and the Staff door (north).
  c.rect(19, 18, 2, 1, 'D').rect(33, 1, 2, 1, 'D');
  // The queue: a rope each side of a two-row lane.
  c.rect(8, 8, 10, 1, 'Q').rect(8, 11, 10, 1, 'Q');
  const exits: ExitDef[] = [
    { id: 'c5.lobby.street', area: tilesArea(19, 18, 2, 1), toScreen: 'c5.bar', spawn: BAR_FROM_LOBBY },
    { id: 'c5.lobby.staff', area: STAFF_DOOR, toScreen: 'c5.floor', spawn: FLOOR_ARRIVAL },
  ];
  const props: PropPlacement[] = [
    // Stand-in: a filing cabinet for the ticket machine.
    { id: 'ticketMachine', frame: PROP.filingCabinet.shut, col: TICKET_MACHINE.col, row: TICKET_MACHINE.row, solid: { dy: 1, width: 1, height: 1 } },
    { id: 'lobby.board', frame: PROP.noticeboard, col: NOTICEBOARD.col, row: NOTICEBOARD.row, solid: { dy: 1, width: 1, height: 1 } },
    { id: 'lobby.sheet', frame: PROP.signUpSheet, col: NOTICEBOARD.col + 1, row: NOTICEBOARD.row + 1 },
    // Stand-in: an office desk for the security desk.
    { id: 'securityDesk', frame: PROP.officeDesk, col: SECURITY_DESK.col, row: SECURITY_DESK.row, solid: { width: 2, height: 1 } },
    { frame: PROP.deadPlant, col: 3, row: 3, solid: { width: 1, height: 1 } },
    { frame: PROP.deadPlant, col: 36, row: 16, solid: { width: 1, height: 1 } },
    { frame: PROP.bins, col: 3, row: 16, solid: { width: 1, height: 1 } },
    { frame: PROP.wallMap, col: 12, row: 1 },
    { frame: PROP.certificate, col: 20, row: 1 },
  ];
  const queue: Array<[NpcPlacement['npc'], number]> = [
    ['touristA', 10],
    ['localA', 11],
    ['americanB', 13],
    ['touristB', 14],
  ];
  const npcs: NpcPlacement[] = queue.map(([npc, col], i) => ({ id: `queue.${i}`, npc, col, row: 9, facing: 'right' as const }));
  const dressing: ScreenDressing = { props, npcs };
  return c.build('c5.lobby', exits, LOBBY_FROM_BAR, { dressing });
}

// ---------------------------------------------------------------------------
// c5.floor: the records floor, 60 x 30
// ---------------------------------------------------------------------------

/** Just inside the Staff door, south wall, west end. */
export const FLOOR_ARRIVAL = T(4, 26);
/** Where Andrew steps back in from the stacks. */
export const FLOOR_FROM_STACKS = T(56, 13);

/** Cubicle pods: 6 x 5, an open 4 x 3 inside and a two-tile gap on one side. Band A opens south, band B north. */
export const POD_COLS = [8, 20, 32, 44] as const;
export const POD_BAND_A_ROW = 5;
export const POD_BAND_B_ROW = 16;

/** The stealth section: in from the Staff door, out at the lightbox end of the south aisle. */
export const STEALTH_START = tilesArea(2, 22, 8, 6);
export const STEALTH_EXIT = tilesArea(35, 21, 4, 7);
/** Where Myko waits on the phone while Andrew is on the floor. */
export const FLOOR_MYKO_SPOT = T(3, 27);

/** The hiding props Act Natural works beside (stand within `radius`, keep still). */
export const FLOOR_HIDING: readonly HidingPropDef[] = [
  { id: 'c5.hide.vendingA', kind: 'vendingMachine', position: T(8, 3), radius: 32 },
  { id: 'c5.hide.cooler', kind: 'waterCooler', position: T(18, 3), radius: 32 },
  { id: 'c5.hide.board', kind: 'noticeboard', position: T(30, 3), radius: 32 },
  { id: 'c5.hide.vendingB', kind: 'vendingMachine', position: T(16, 24), radius: 32 },
  { id: 'c5.hide.copierQueue', kind: 'queue', position: T(43, 25), radius: 40 },
];

const wait = (position: Vec2, waitMs: number) => ({ position, waitMs });

/** Six agents on overlapping loops: both long aisles, the east and west side aisles, the vertical aisle and the south aisle. */
export const FLOOR_STEALTH: StealthSectionDef = {
  id: 'c5.stealth.floor',
  checkpointId: 'c5.cp.floor',
  guards: [
    // The north aisle, end to end.
    { enemyId: 'agent', route: { mode: 'pingPong', waypoints: [wait(T(4, 3), 1500), wait(T(54, 3), 1500)] } },
    // A rectangle round the top band of cubicles.
    { enemyId: 'agent', route: { mode: 'loop', waypoints: [wait(T(6, 4), 800), wait(T(52, 4), 800), wait(T(52, 13), 800), wait(T(6, 13), 800)] } },
    // The central aisle, end to end.
    { enemyId: 'agent', route: { mode: 'pingPong', waypoints: [wait(T(4, 11), 2000), wait(T(54, 11), 2000)] } },
    // A rectangle round the bottom band, as far as the copier queue.
    { enemyId: 'agent', route: { mode: 'loop', waypoints: [wait(T(6, 15), 800), wait(T(43, 15), 800), wait(T(43, 22), 800), wait(T(6, 22), 800)] } },
    // The south aisle, from the door to the lightbox.
    { enemyId: 'agent', route: { mode: 'pingPong', waypoints: [wait(T(6, 25), 2500), wait(T(30, 25), 2500)] } },
    // Up and down the aisle between the middle cubicles.
    { enemyId: 'agent', route: { mode: 'pingPong', waypoints: [wait(T(31, 4), 1200), wait(T(31, 24), 1200)] } },
  ],
  hazards: [],
  hidingProps: FLOOR_HIDING,
  // The clean-run reward is the memo (a clue): the script reveals the `memo` prop.
};

/** The memo of the clean run, on the desk in the third top cubicle. */
export const MEMO_SPOT = T(35, 7);
/** The requisition, on the big desk in the aisle between the middle cubicles. */
export const REQUISITION_SPOT = T(28, 13);
/** The expenses claim (the bus ticket), in the second bottom cubicle. */
export const BUSTICKET_SPOT = T(23, 18);

/** The five loose sheets: two by the cooler, one at the copier, two in the west corner cubicles. */
export const SHEETS = [
  { n: 1, prop: { col: 16, row: 3 }, spot: T(16, 4) },
  { n: 2, prop: { col: 20, row: 3 }, spot: T(20, 4) },
  { n: 3, prop: { col: 45, row: 23 }, spot: T(45, 24) },
  { n: 4, prop: { col: 11, row: 6 }, spot: T(11, 7) },
  { n: 5, prop: { col: 12, row: 18 }, spot: T(11, 18) },
] as const;

/** The lightbox table: a desk, with Andrew standing on its south side. */
export const LIGHTBOX = { col: 33, row: 24 } as const;
export const LIGHTBOX_SPOT = T(34, 25);

/** The photocopier, its front, and the queue lane in front of it. */
export const COPIER = { col: 44, row: 22 } as const;
export const COPIER_SPOT = T(44, 24);
export const COPIER_QUEUE_AREA = tilesArea(39, 24, 5, 3);

/** The break room (the kitchen side): its door, and the fridge with the birthday whiskey. */
export const BREAK_ROOM = tilesArea(51, 22, 7, 6);
export const FRIDGE = { col: 55, row: 22 } as const;
export const FRIDGE_SPOT = T(55, 24);

/** The cubicle fight: the central aisle and the cubicles round it. Three waves of three through different lanes. */
export const FIGHT_AREA = tilesArea(2, 2, 56, 26);
export const FIGHT_ENTRANCE = T(4, 27);
/** Wave 1 (3) comes down the north aisle, wave 2 (3) out of the break room, wave 3 (3) up the east aisle. */
export const FIGHT_SPAWNS = [T(36, 3), T(40, 3), T(44, 3), T(52, 23), T(54, 23), T(53, 26), T(55, 9), T(55, 12), T(55, 16)] as const;
export const FIGHT_WAVE_SIZE = 3;
/** Where the `.alarm` version's reinforcements come in. */
export const ALARM_REINFORCEMENTS = [T(54, 3), T(56, 17)] as const;
/** Empties to throw (bottle spots) on the floor: by the cooler, the central aisle, and the copier. */
export const FLOOR_BOTTLE_SPOTS = [T(22, 4), T(40, 13), T(46, 25)] as const;
/** The double doors to the stacks, east wall. */
export const STACKS_DOOR = tilesArea(58, 13, 1, 2);

export function floorScreen(): ScreenLayout {
  const c = new Canvas(60, 30, 'a', 'cities');
  c.rect(0, 0, 60, 1, '#').rect(0, 29, 60, 1, '#').rect(0, 0, 1, 30, '#').rect(59, 0, 1, 30, '#');
  c.rect(1, 1, 58, 1, 'W').rect(1, 28, 58, 1, 'W').rect(1, 1, 1, 28, 'W').rect(58, 1, 1, 28, 'W');
  // The Staff door (south, west end) and the double doors to the stacks (east).
  c.rect(4, 28, 2, 1, 'D').rect(58, 13, 1, 2, 'D');
  // Cubicle pods.
  for (const col of POD_COLS) {
    c.rect(col, POD_BAND_A_ROW, 6, 5, 'C').rect(col + 1, POD_BAND_A_ROW + 1, 4, 3, 'a').rect(col + 2, POD_BAND_A_ROW + 4, 2, 1, 'a');
    c.rect(col, POD_BAND_B_ROW, 6, 5, 'C').rect(col + 1, POD_BAND_B_ROW + 1, 4, 3, 'a').rect(col + 2, POD_BAND_B_ROW, 2, 1, 'a');
  }
  // The break room, lino, with its door on the west side.
  c.rect(50, 21, 8, 7, 'C').rect(51, 22, 7, 6, '.').rect(50, 24, 1, 2, '.');
  // The copier queue: a rope each side of a one-row lane.
  c.rect(39, 24, 5, 1, 'Q').rect(39, 26, 5, 1, 'Q');
  const exits: ExitDef[] = [
    { id: 'c5.floor.staff', area: tilesArea(4, 28, 2, 1), toScreen: 'c5.lobby', spawn: LOBBY_FROM_FLOOR },
    { id: 'c5.floor.doors', area: tilesArea(58, 13, 1, 2), toScreen: 'c5.stacks', spawn: STACKS_ARRIVAL },
  ];
  const desk = (id: string, col: number, row: number): PropPlacement => ({ id, frame: PROP.officeDesk, col, row, solid: { width: 2, height: 1 } });
  const props: PropPlacement[] = [
    // North wall: a vending machine, the water cooler (stand-in: the urn), the noticeboard, a second vending machine.
    { id: 'vendingA', frame: PROP.vendingMachine, col: 8, row: 1, solid: { dy: 1, width: 1, height: 1 } },
    { id: 'cooler', frame: PROP.hotDrinkUrn, col: 18, row: 1, solid: { dy: 1, width: 1, height: 1 } },
    { id: 'floor.board', frame: PROP.noticeboard, col: 30, row: 1, solid: { dy: 1, width: 1, height: 1 } },
    { id: 'vendingB', frame: PROP.vendingMachine, col: 16, row: 22, solid: { dy: 1, width: 1, height: 1 } },
    // Desks in the cubicles (a desk fills the back of each pod; the opening stays clear).
    desk('desk.a1', 9, 6),
    desk('desk.a2', 21, 6),
    desk('desk.a3', 33, 6),
    desk('desk.a4', 45, 6),
    desk('desk.b1', 9, 19),
    desk('desk.b2', 21, 19),
    desk('desk.b3', 33, 19),
    desk('desk.b4', 45, 19),
    // The big desk in the aisle between the middle cubicles, with the requisition on it (stand-in: a logbook).
    desk('bigDesk', 27, 12),
    { id: 'requisition', frame: PROP.logbook, col: 28, row: 12 },
    // The expenses claim (stand-in: a brochure) and the memo (stand-in: a docket), hidden until the clean run.
    { id: 'busticket', frame: PROP.brochure, col: 24, row: 18 },
    { id: 'memo', frame: PROP.docket, col: 35, row: 6, hidden: true },
    // The five loose sheets (stand-in: the manifest frame).
    ...SHEETS.map((s) => ({ id: `sheet.${s.n}`, frame: PROP.manifest, col: s.prop.col, row: s.prop.row })),
    // The lightbox (stand-in: a desk, lit from below).
    { id: 'lightbox', frame: PROP.officeDesk, col: LIGHTBOX.col, row: LIGHTBOX.row, solid: { width: 2, height: 1 } },
    // The photocopier (stand-in: a filing cabinet). The jam swaps it for the open frame.
    { id: 'copier', frame: PROP.filingCabinet.shut, col: COPIER.col, row: COPIER.row, solid: { dy: 1, width: 1, height: 1 } },
    // The break-room fridge with the birthday whiskey.
    { id: 'fridge', frame: PROP.clubFridge, col: FRIDGE.col, row: FRIDGE.row, solid: { dy: 1, width: 1, height: 1 } },
    // Bottles and boxes, clear of the aisles' middles.
    { id: 'floor.p1', frame: PROP.bottleCrate, col: 3, row: 8, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'floor.p2', frame: PROP.cardboardBox, col: 4, row: 8, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'floor.p3', frame: PROP.cardboardBox, col: 38, row: 14, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'floor.p4', frame: PROP.bottleCrate, col: 53, row: 8, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'floor.p5', frame: PROP.cardboardBox, col: 12, row: 23, solid: { width: 1, height: 1 }, breakable: {} },
    { frame: PROP.deadPlant, col: 2, row: 12, solid: { width: 1, height: 1 } },
    { frame: PROP.bins, col: 56, row: 3, solid: { width: 1, height: 1 } },
  ];
  const queue: Array<[NpcPlacement['npc'], number]> = [
    ['localB', 40],
    ['americanA', 41],
    ['localA', 42],
  ];
  const npcs: NpcPlacement[] = queue.map(([npc, col], i) => ({ id: `copier.${i}`, npc, col, row: 25, facing: 'right' as const }));
  const dressing: ScreenDressing = { props, npcs };
  return c.build('c5.floor', exits, FLOOR_ARRIVAL, { mykoStart: FLOOR_MYKO_SPOT, dressing });
}

// ---------------------------------------------------------------------------
// c5.stacks: the archive stacks, 50 x 30
// ---------------------------------------------------------------------------

/** Just inside the door from the floor. */
export const STACKS_ARRIVAL = T(3, 15);

/**
 * The arena: 30 x 16 of the stacks. Six rolling shelf units (2 wide, 12 tall, rows 10 to 21) stand on rails with
 * a two-wide aisle (a lane) between each pair: five lanes. The two cross aisles (rows 8-9 and 22-23) and the
 * margins (cols 10-13 west, 36-39 east) are open. A unit closes the lane to its west by sliding two tiles west
 * to sit against the unit beside it.
 */
export const ARENA = { col: 10, row: 8, width: 30, height: 16 } as const;
export const SHELF_UNIT_COLS = [14, 18, 22, 26, 30, 34] as const;
export const SHELF_ROWS = { from: 10, count: 12 } as const;
/** Lane k is `LANES[k]`: its columns, and the shelf unit that slides west to close it (unit k + 1). */
export const LANES = [0, 1, 2, 3, 4].map((k) => ({
  index: k,
  col: SHELF_UNIT_COLS[k]! + 2,
  width: 2,
  area: tilesArea(SHELF_UNIT_COLS[k]! + 2, SHELF_ROWS.from, 2, SHELF_ROWS.count),
  closingUnit: k + 1,
  slideTiles: -2,
}));
/** The prop id of one tile-row of a shelf unit: `shelf.<unit>.<row 0..11>`. The script moves all twelve together. */
export const shelfPropId = (unit: number, row: number): string => `shelf.${unit}.${row}`;
export const SHELF_ROW_COUNT = SHELF_ROWS.count;

/** The tile Pruitt starts on, at range in the east margin; his crank beside it. */
export const PRUITT_START = T(38, 15);
export const PRUITT_CRANK = T(39, 13);
/** Phase 2 brings two agents in from the east margin's corners. */
export const PRUITT_ADDS = [T(38, 9), T(38, 22)] as const;
/** Myko's entrance for the call, and the area that starts the boss. */
export const PRUITT_ENTRANCE = T(3, 19);
export const PRUITT_TRIGGER = tilesArea(10, 8, 4, 16);
/** Pruitt's desk and the umbrella stand at the end, east of the arena. */
export const PRUITT_DESK = { col: 42, row: 14 } as const;
export const UMBRELLA_STAND = { col: 45, row: 13 } as const;
export const UMBRELLA_SPOT = T(45, 14);
/** Empties to throw (bottle spots): the west vestibule, and both cross aisles. */
export const STACKS_BOTTLE_SPOTS = [T(5, 10), T(5, 20), T(12, 9), T(12, 22), T(37, 9)] as const;

export function stacksScreen(): ScreenLayout {
  const c = new Canvas(50, 30, 'p', 'cities');
  c.rect(0, 0, 50, 1, '#').rect(0, 29, 50, 1, '#').rect(0, 0, 1, 30, '#').rect(49, 0, 1, 30, '#');
  c.rect(1, 1, 48, 1, 'W').rect(1, 28, 48, 1, 'W').rect(1, 1, 1, 28, 'W').rect(48, 1, 1, 28, 'W');
  // The door from the floor, west wall.
  c.rect(1, 15, 1, 2, 'D');
  // Fixed shelving along the north and south walls.
  c.rect(3, 3, 44, 2, 'A').rect(3, 25, 44, 2, 'A');
  // The rails the units run on, under the units and the lanes between them.
  c.rect(SHELF_UNIT_COLS[0], SHELF_ROWS.from, SHELF_UNIT_COLS[5] + 2 - SHELF_UNIT_COLS[0], SHELF_ROWS.count, 'r');
  const exits: ExitDef[] = [{ id: 'c5.stacks.door', area: tilesArea(1, 15, 1, 2), toScreen: 'c5.floor', spawn: FLOOR_FROM_STACKS }];
  const props: PropPlacement[] = [];
  // Stand-in: the drum shelf frame, one 2 x 1 piece per row of each unit (no tall rolling-shelf frame exists).
  SHELF_UNIT_COLS.forEach((col, unit) => {
    for (let r = 0; r < SHELF_ROWS.count; r++) {
      props.push({ id: shelfPropId(unit, r), frame: PROP.drumShelf, col, row: SHELF_ROWS.from + r, solid: { width: 2, height: 1 }, blocksSight: true });
    }
  });
  props.push(
    // Pruitt's crank, his desk and the umbrella stand with the umbrella in it (stand-in: a bin).
    { id: 'crank', frame: PROP.lever.up, col: PRUITT_CRANK.x / 16 - 0.5, row: PRUITT_CRANK.y / 16 - 0.5 },
    { id: 'pruittDesk', frame: PROP.officeDesk, col: PRUITT_DESK.col, row: PRUITT_DESK.row, solid: { width: 2, height: 1 } },
    { id: 'umbrellaStand', frame: PROP.bins, col: UMBRELLA_STAND.col, row: UMBRELLA_STAND.row, solid: { width: 1, height: 1 } },
    { id: 'umbrella', frame: PROP.weapon.umbrella, col: UMBRELLA_STAND.col, row: UMBRELLA_STAND.row - 1 },
    { id: 'stacks.p1', frame: PROP.bottleCrate, col: 6, row: 12, solid: { width: 1, height: 1 }, breakable: {} },
    { id: 'stacks.p2', frame: PROP.cardboardBox, col: 6, row: 19, solid: { width: 1, height: 1 }, breakable: {} },
  );
  const dressing: ScreenDressing = { props };
  return c.build('c5.stacks', exits, STACKS_ARRIVAL, { mykoStart: PRUITT_ENTRANCE, dressing });
}
