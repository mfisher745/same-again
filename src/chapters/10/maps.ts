/**
 * Chapter 10 screens as tile layouts and dressing. Level data only (docs/chapters/10-disclosure.md): the anteroom with
 * its drinks cabinet and tea trolley, the Administrator's control room, both in the `base` region, and Feeney's (the
 * chapter 1 screen, reused from `../01/maps`, in daylight) in `kilnamoe`. Every constant the script needs is exported.
 *
 * Stand-in art (no frame of its own yet; each is marked at its prop):
 * - the drinks cabinet and its decanters: `PROP.trophyShelf` (should be a glass-fronted cabinet of dusty decanters);
 * - the receptionist's and the Administrator's desks: `PROP.officeDesk` (should be tidy violet/teal desks);
 * - the broadcast console: `PROP.securityDesk` x3 (should be one long console with five sockets and a large button);
 * - the telly "on": `PROP.telly` (should have a lit weather-map frame);
 * - loose furniture in the control room: chapter 3 to 8 frames (should be base-palette furniture);
 * - the plant: `PROP.flowerPot` (should be a tidy office plant).
 * The gravity arrows, the stamp's shockwave, the desk shield and the stun-pulse marker are drawn by the script.
 */

import { PROP } from '../../art/props';
import type { AreaRect, ExitDef, NpcPlacement, PropPlacement, ScreenDressing, ScreenLayout } from '../../core/chapter';
import type { TileCoord, Vec2 } from '../../core/types';
import { Canvas, T, tilesArea } from '../canvas';
import { MYKO_SEAT as C1_MYKO_SEAT, PUB_ARRIVAL as C1_PUB_STOOL, PUB_BACK_ARRIVAL, pubScreen as c1PubScreen } from '../01/maps';

export { T, tilesArea };

// ---------------------------------------------------------------------------
// c10.anteroom: 30 x 17
// ---------------------------------------------------------------------------

/** Just inside the entrance, clear of the trolley: where Andrew arrives, at the start and after every return. */
export const BAR_ARRIVAL = T(7, 13);
/** In front of the tea trolley: E asks for the hot drink. The trolley is the hot-drink prop. */
export const TEA_SPOT = T(5, 13);
export const TROLLEY_TILE = { col: 4, row: 11 } as const;
/** The drinks cabinet: three shelves of decanters on a counter along the west wall (decor; nothing is taken from it). */
export const CABINET_TILES: readonly TileCoord[] = [
  { col: 2, row: 6 },
  { col: 2, row: 8 },
  { col: 2, row: 10 },
];
export const CABINET_SPOT = T(4, 8);
/** Myko's place by the entrance, apart from the waiting area. */
export const MYKO_BAR = T(10, 13);
/** The entrance (no exit: Andrew came up in the lift) and the side door the second wave comes through. */
export const ANTE_ENTRANCE_AREA = tilesArea(6, 15, 2, 2);
export const ANTE_SIDE_DOOR_AREA = tilesArea(28, 6, 2, 2);
/** The ticket machine's sprite tile, and where E takes number 848. Taking the ticket starts `c10.fight.anteroom`. */
export const TICKET_TILE = { col: 18, row: 3 } as const;
export const TICKET_MACHINE = T(18, 5);
/** The receptionist's desk (empty): two desks side by side. Top-left tile, 4 wide. */
export const RECEPTION_DESK = { col: 10, row: 5, width: 4, height: 1 } as const;
export const PLANT_TILE = { col: 26, row: 3 } as const;
/** The waiting area's carpet and seats. */
export const WAITING_AREA = tilesArea(17, 8, 10, 5);
/** Anteroom to control: the Administrator's door in the north wall. */
export const ANTE_TO_CONTROL = tilesArea(14, 0, 2, 2);
export const ANTE_FROM_CONTROL = T(14, 3);

/**
 * The three waves of `c10.fight.anteroom` (TUNING: wave 1 two security and two clerks, waves 2 and 3 two security and
 * one clerk each). Spawns are listed in the order the fight system takes them: for each wave the security first, then the
 * clerks. Wave 1 comes from the east of the waiting area, wave 2 through the side door, wave 3 from the north-west.
 */
export const ANTEROOM_WAVE_SPAWNS: readonly (readonly Vec2[])[] = [
  [T(22, 4), T(25, 4), T(21, 6), T(24, 6)],
  [T(26, 6), T(26, 7), T(26, 9)],
  [T(4, 3), T(7, 3), T(9, 3)],
];
export const ANTEROOM_SPAWNS: readonly Vec2[] = ANTEROOM_WAVE_SPAWNS.flat();
/** Where Myko waits on the phone for the fight. */
export const ANTEROOM_ENTRANCE = T(10, 13);

// ---------------------------------------------------------------------------
// c10.control: the Administrator's office, 40 x 25 (constants first; the screens follow)
// ---------------------------------------------------------------------------

/** The boss arena: the whole room inside the walls and under the wall of screens, 36 x 20 of open floor. */
export const CONTROL_ARENA = { col: 2, row: 3, width: 36, height: 20 } as const;
export const CONTROL_ARENA_AREA: AreaRect = tilesArea(CONTROL_ARENA.col, CONTROL_ARENA.row, CONTROL_ARENA.width, CONTROL_ARENA.height);
/** The control room's door to the anteroom, in the south wall. */
export const CONTROL_TO_ANTE = tilesArea(19, 23, 2, 2);
export const CONTROL_FROM_ANTE = T(20, 21);
export const MYKO_CONTROL = T(22, 21);
/** Walking in, in front of the south door, starts `c10.boss.administrator` (the script decides when it is allowed). */
export const CONTROL_ENTRY_AREA = tilesArea(16, 18, 8, 4);

/** The Administrator's desk: three desks side by side, 6 wide, solid. His start is behind it. */
export const ADMIN_DESK = { col: 16, row: 5, width: 6, height: 1 } as const;
export const ADMIN_START = T(19, 4);
/** The area the desk shield covers: the desk, the ground behind it and the row in front. Bottles break on its edge. */
export const DESK_SHIELD_AREA: AreaRect = tilesArea(15, 3, 8, 4);
/** Where he sits down on the floor at the end, in front of his desk. */
export const ADMIN_SIT_SPOT = T(19, 7);
/** The boss's phone place. Myko is not in this fight (`c10.boss.administrator` cannot be called); the spot is for the data shape. */
export const ADMIN_ENTRANCE = T(22, 21);

/** The three guard pairs he calls in turn (each pair two `security`), clear of the desk and the stamp rows. */
export const GUARD_PAIR_SPAWNS: readonly (readonly [Vec2, Vec2])[] = [
  [T(10, 6), T(12, 6)],
  [T(25, 6), T(27, 6)],
  [T(14, 7), T(23, 7)],
];

/**
 * The stamp's marked rows, painted `marking` across the arena. The shockwave runs the whole 36 tiles of a row (TUNING
 * `stamp` charge 576 px) from the west end to the east end, or the reverse; the script picks the end.
 */
export const STAMP_ROWS: readonly { readonly row: number; readonly west: Vec2; readonly east: Vec2 }[] = [9, 13, 17].map((row) => ({
  row,
  west: T(CONTROL_ARENA.col, row),
  east: T(CONTROL_ARENA.col + CONTROL_ARENA.width - 1, row),
}));

export type GravityWall = 'north' | 'south' | 'west' | 'east';
/**
 * The four gravity switches, one per wall. `tile` is the switch in the wall (a solid `gravitySwitch` tile); `spot` is
 * where Andrew stands to press E. Pressing one throws the Administrator against the far wall.
 */
export const GRAVITY_SWITCHES: readonly { readonly id: string; readonly wall: GravityWall; readonly tile: TileCoord; readonly spot: Vec2 }[] = [
  { id: 'c10.switch.north', wall: 'north', tile: { col: 30, row: 2 }, spot: T(30, 3) },
  { id: 'c10.switch.south', wall: 'south', tile: { col: 9, row: 23 }, spot: T(9, 22) },
  { id: 'c10.switch.west', wall: 'west', tile: { col: 1, row: 12 }, spot: T(2, 12) },
  { id: 'c10.switch.east', wall: 'east', tile: { col: 38, row: 13 }, spot: T(37, 13) },
];

/**
 * The loose furniture that slides when gravity turns, and hits (heavy). Each is a solid prop the script moves with
 * `setPropTile`. Clear of the stamp rows (9, 13, 17), the desk and the dais.
 * Stand-ins: base-palette furniture does not exist; these are the chapter 3 to 8 frames.
 */
export interface FurnitureDef {
  readonly id: string;
  readonly frame: string;
  readonly col: number;
  readonly row: number;
  readonly solid: { readonly dy?: number; readonly width: number; readonly height: number };
}
export const LOOSE_FURNITURE: readonly FurnitureDef[] = [
  { id: 'control.cabinet1', frame: PROP.filingCabinet.shut, col: 6, row: 11, solid: { dy: 1, width: 1, height: 1 } },
  { id: 'control.cabinet2', frame: PROP.filingCabinet.shut, col: 33, row: 11, solid: { dy: 1, width: 1, height: 1 } },
  { id: 'control.chair1', frame: PROP.foldingChair, col: 11, row: 15, solid: { width: 1, height: 1 } },
  { id: 'control.chair2', frame: PROP.foldingChair, col: 26, row: 15, solid: { width: 1, height: 1 } },
  { id: 'control.cooler', frame: PROP.waterCooler, col: 4, row: 19, solid: { dy: 1, width: 1, height: 1 } },
  { id: 'control.sidetable', frame: PROP.officeDesk, col: 13, row: 20, solid: { width: 2, height: 1 } },
];

/** The broadcast console on its dais in the south-east of the room (the dais is walkable; the console is solid). */
export const DAIS = { col: 30, row: 18, width: 7, height: 4 } as const;
/** The console: three stand-in desks in a row, 6 wide. */
export const CONSOLE = { col: 31, row: 18, width: 6, height: 1 } as const;
/** Where Andrew stands for each of the five channel sockets (left to right), and for the large button. All on the dais. */
export const CHANNEL_SPOTS: readonly Vec2[] = [0, 1, 2, 3, 4].map((i) => T(31 + i, 19));
export const BUTTON_SPOT = T(36, 19);
/** Walking onto the dais, south of the console, starts `c10.puzzle.broadcast` (the script decides when it is allowed). */
export const CONSOLE_AREA = tilesArea(30, 19, 7, 3);
/** Bottle crates at the arena's corners. */
export const CONTROL_BOTTLE_TILES: readonly TileCoord[] = [
  { col: 3, row: 4 },
  { col: 36, row: 4 },
  { col: 3, row: 21 },
  { col: 29, row: 21 },
];
export const CONTROL_BOTTLE_SPOTS: readonly Vec2[] = CONTROL_BOTTLE_TILES.map((t) => T(t.col, t.row));

// ---------------------------------------------------------------------------
// c10.pub: Feeney's, 30 x 17 (the chapter 1 screen in daylight)
// ---------------------------------------------------------------------------

/**
 * Where Andrew walks in: just inside the back door (chapter 1's arrival after the yard). The chapter does not reach
 * this screen through an exit: control to pub is a scripted cut (`CONTROL_TO_PUB`).
 */
export const PUB_ENTRY = PUB_BACK_ARRIVAL;
/** The bar stool Andrew sits at (the chapter 1 arrival): E here sits him down and plays `c10.pub.dympna`. */
export const PUB_STOOL = C1_PUB_STOOL;
export const MYKO_PUB = C1_MYKO_SEAT;
/** Dympna, behind the counter opposite the stool, and the telly and fruit machine (tile of the sprite). */
export const DYMPNA_TILE = { col: 6, row: 2 } as const;
export const TELLY_TILE = { col: 27, row: 1 } as const;
export const TELLY_SPOT = T(27, 2);
export const FRUIT_MACHINE_TILE = { col: 1, row: 6 } as const;
export const FRUIT_MACHINE_SPOT = T(2, 7);

/**
 * How the chapter gets from control to Feeney's: a scripted cut after the reaction cards, not an exit. The script plays
 * the broadcast and the cards, then `ctx.goToScreen(CONTROL_TO_PUB.screenId, CONTROL_TO_PUB.spawn)`. There is no door
 * between the two, and the anteroom has no way out.
 */
export const CONTROL_TO_PUB = { screenId: 'c10.pub', spawn: PUB_ENTRY } as const;

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

export function anteroomScreen(): ScreenLayout {
  const c = new Canvas(30, 17, '.', 'base').room();
  // The entrance in the south wall (no exit) and the side door in the east wall.
  c.rect(6, 15, 2, 2, 'd').rect(28, 6, 2, 2, 'd');
  // The Administrator's door in the north wall.
  c.rect(14, 0, 2, 2, 'd');
  // The drinks cabinet's counter, two deep along the west wall.
  c.rect(2, 6, 2, 6, 'c');
  // The waiting area: carpet, a row of seats at each end and a low table between.
  c.rect(17, 8, 10, 5, 'a');
  c.rect(18, 8, 3, 1, 's').rect(23, 8, 3, 1, 's').rect(18, 12, 3, 1, 's').rect(23, 12, 3, 1, 's');
  c.rect(21, 10, 2, 1, 't');

  const exits: ExitDef[] = [{ id: 'c10.ante.control', area: ANTE_TO_CONTROL, toScreen: 'c10.control', spawn: CONTROL_FROM_ANTE }];
  const props: PropPlacement[] = [
    // Stand-in: `PROP.trophyShelf` for the decanter cabinet (a glass-fronted cabinet of dusty decanters).
    ...CABINET_TILES.map((t, i) => ({ id: `bar.cabinet${i + 1}`, frame: PROP.trophyShelf, col: t.col, row: t.row })),
    // The tea trolley: the hot-drink prop. Steam while the free drink can be taken (the script shows and hides it).
    { id: 'bar.trolley', frame: PROP.teaTrolley, col: TROLLEY_TILE.col, row: TROLLEY_TILE.row, solid: { dy: 1, width: 2, height: 1 } },
    { id: 'bar.steam', frame: PROP.steam[0], frames: PROP.steam, frameRate: 4, col: TROLLEY_TILE.col, row: TROLLEY_TILE.row - 1, hidden: true },
    // Stand-in: `PROP.officeDesk` x2 for the receptionist's desk (empty: no chair, no one).
    { id: 'ante.desk1', frame: PROP.officeDesk, col: RECEPTION_DESK.col, row: RECEPTION_DESK.row, solid: { width: 2, height: 1 } },
    { id: 'ante.desk2', frame: PROP.officeDesk, col: RECEPTION_DESK.col + 2, row: RECEPTION_DESK.row, solid: { width: 2, height: 1 } },
    { id: 'ante.ticket', frame: PROP.ticketMachine, col: TICKET_TILE.col, row: TICKET_TILE.row, solid: { dy: 1, width: 1, height: 1 } },
    // Stand-in: `PROP.flowerPot` for a tidy office plant.
    { id: 'ante.plant', frame: PROP.flowerPot, col: PLANT_TILE.col, row: PLANT_TILE.row, solid: { width: 1, height: 1 } },
    { id: 'ante.cooler', frame: PROP.waterCooler, col: 20, row: 3, solid: { dy: 1, width: 1, height: 1 } },
  ];
  const dressing: ScreenDressing = { props };
  return c.build('c10.anteroom', exits, BAR_ARRIVAL, { mykoStart: MYKO_BAR, dressing });
}

export function controlScreen(): ScreenLayout {
  const c = new Canvas(40, 25, '.', 'base').room();
  // The wall of screens along the top of the room, with the north gravity switch among them.
  c.rect(2, 2, 36, 1, 'N').set(30, 2, 'G');
  // The other three switches, set in the walls.
  c.set(9, 23, 'G').set(1, 12, 'G').set(38, 13, 'G');
  // The door to the anteroom in the south wall.
  c.rect(19, 23, 2, 2, 'd');
  // The stamp's marked rows.
  for (const r of STAMP_ROWS) c.rect(CONTROL_ARENA.col, r.row, CONTROL_ARENA.width, 1, 'm');
  // The dais.
  c.rect(DAIS.col, DAIS.row, DAIS.width, DAIS.height, 'D');

  const exits: ExitDef[] = [{ id: 'c10.control.ante', area: CONTROL_TO_ANTE, toScreen: 'c10.anteroom', spawn: ANTE_FROM_CONTROL }];
  const props: PropPlacement[] = [
    // Stand-in: `PROP.officeDesk` x3 for the Administrator's desk (a large tidy desk). Solid; the shield is the script's.
    ...[0, 2, 4].map((dx) => ({ id: `control.desk${dx / 2 + 1}`, frame: PROP.officeDesk, col: ADMIN_DESK.col + dx, row: ADMIN_DESK.row, solid: { width: 2, height: 1 } })),
    // Stand-in: `PROP.securityDesk` x3 for the broadcast console (five sockets and a large button).
    ...[0, 2, 4].map((dx) => ({ id: `control.console${dx / 2 + 1}`, frame: PROP.securityDesk, col: CONSOLE.col + dx, row: CONSOLE.row, solid: { width: 2, height: 1 } })),
    ...LOOSE_FURNITURE.map((f): PropPlacement => ({ id: f.id, frame: f.frame, col: f.col, row: f.row, solid: f.solid })),
    ...CONTROL_BOTTLE_TILES.map((t, i): PropPlacement => ({ id: `control.crate${i + 1}`, frame: PROP.bottleCrate, col: t.col, row: t.row, solid: { width: 1, height: 1 }, breakable: {} })),
  ];
  return c.build('c10.control', exits, CONTROL_FROM_ANTE, { mykoStart: MYKO_CONTROL, dressing: { props } });
}

export function feeneysScreen(): ScreenLayout {
  const pub = c1PubScreen();
  // Daylight: chapter 1's pub has no ambient tint. No fighting, so the breakables and the urn's steam go; the telly
  // and the fruit machine get ids so the script can use them. Stand-in: `PROP.telly` is the only telly frame (it should
  // show the weather map, lit).
  const props = (pub.dressing?.props ?? [])
    .filter((p) => !p.breakable && p.id !== 'urn.steam')
    .map((p): PropPlacement => (p.frame === PROP.telly ? { ...p, id: 'pub.telly' } : p.frame === PROP.fruitMachine ? { ...p, id: 'pub.machine' } : p));
  // Dympna is at the stool's end of the bar, so she is beside him when he sits. Nobody else is in: nothing to count.
  const npcs: NpcPlacement[] = [{ id: 'dympna', npc: 'dympna', col: DYMPNA_TILE.col, row: DYMPNA_TILE.row, facing: 'down' }];
  return { ...pub, id: 'c10.pub', exits: [], playerStart: PUB_ENTRY, mykoStart: MYKO_PUB, dressing: { props, npcs } };
}
