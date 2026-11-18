/**
 * Chapter 7 screens as tile layouts and dressing. Level data only (docs/chapters/07-gift-shop.md): the strip with
 * its bar, Little Green Gifts, and the stockroom with its yard, all in the `roswell` region, plus every constant
 * the script needs (the six figures, Gary, the stockroom stealth, the yard fight, the van, the mascot arena).
 *
 * STAND-IN ART (no chapter 7 art exists yet; each is marked `STAND-IN` below and listed in the hand-off):
 * - the six costumed figures use `touristA`, `touristB`, `americanA` (tourists) and `alienClerk` (aliens) NPC looks;
 *   they should be six different people in alien costumes;
 * - the abduction photo booth is `PROP.vendingMachine`;
 * - the street lamps with eyes are `PROP.floodlightMast`;
 * - the rack of inflatable aliens is `PROP.weapon.inflatableAlien` four times (it wants a rail and a price tag);
 * - the bartender is the `attendant` NPC look (it wants antennae and a sunburn);
 * - the green tea is `PROP.kettle` beside `PROP.coffeePot`;
 * - the saucer diner is wall tiles, neon and `PROP.dinerSign` (it wants a saucer-shaped sprite);
 * - the tourist leaflet is `PROP.brochure`; the staff fridge is `PROP.clubFridge`; the stout can is `PROP.stoutPint`;
 * - the bus stop is `PROP.busTicketMachine` and seat tiles (it wants a sign and a shelter);
 * - the till is the counter tile (no till sprite for this region).
 */

import type { NpcId } from '../../art/cast';
import { PROP } from '../../art/props';
import type { AreaRect, ExitDef, NpcPlacement, PropPlacement, ScreenDressing, ScreenLayout } from '../../core/chapter';
import type { DialogueId, HidingPropDef, PatrolRoute, StealthSectionDef, TileCoord, Vec2 } from '../../core/types';
import { Canvas, T, tilesArea } from '../canvas';

export { T, tilesArea };

// ---------------------------------------------------------------------------
// c7.strip: the strip, 60 x 20
// ---------------------------------------------------------------------------

/** In front of the bar's counter, clear of it: where Andrew arrives, at the start and after every return. */
export const BAR_ARRIVAL = T(8, 6);
/** In front of the counter: where E asks the bartender for the hot drink. */
export const TEA_SPOT = T(5, 5);
/** In front of the counter: where E talks to the bartender (the first tequila). */
export const BARTENDER_SPOT = T(7, 5);
export const BARTENDER_TILE = { col: 7, row: 3 } as const;
/** Myko's place on the forecourt, apart from the tables. */
export const MYKO_BAR = T(10, 6);
/** The hot drink props: coffee (the pot) and the green tea (the kettle). */
export const BAR_COFFEE_TILE = { col: 4, row: 3 } as const;
export const BAR_TEA_TILE = { col: 10, row: 3 } as const;
/** The leaflet on a forecourt table, with Andrew's bog ring on it. */
export const LEAFLET_SPOT = T(11, 7);
/** Two tourists to talk to. */
export const TOURIST1_TILE = { col: 16, row: 6 } as const;
export const TOURIST2_TILE = { col: 55, row: 12 } as const;

/** Where Andrew steps out of the shop: the strip, outside its door. */
export const STRIP_FROM_SHOP = T(53, 5);
/** Where Andrew steps in from the back gate: the strip, inside the gate. */
export const STRIP_FROM_GATE = T(40, 16);
export const STRIP_TO_SHOP = tilesArea(53, 3, 2, 1);
/** The shop's door. */
export const SHOP_DOOR = STRIP_TO_SHOP;
/** The back gate onto the strip, in its south wall. Opens once the stockroom is passed (the yard fight). */
export const STRIP_BACK_GATE = tilesArea(40, 18, 2, 1);
/** Walking up to the shop's door starts `c7.explore.strip`'s last line (the hint's far end). */
export const STRIP_SHOP_AREA = tilesArea(50, 4, 8, 3);

/** The mascot arena: 30 x 14 of the strip, rows 4 to 17, between the diner's end and the rack. Matches `TUNING.bosses`. */
export const MASCOT_ARENA = { col: 22, row: 4, width: 30, height: 14 } as const;
export const MASCOT_ARENA_AREA = tilesArea(MASCOT_ARENA.col, MASCOT_ARENA.row, MASCOT_ARENA.width, MASCOT_ARENA.height);
/** Walking into the arena from the west or the gate starts `c7.boss.mascots` (the script decides when it is allowed). */
export const MASCOT_TRIGGER = tilesArea(23, 7, 2, 7);
/** The formation, facing west: Zorp (the sign) in front, Zap and Zip behind. */
export const MASCOT_FORMATION = {
  zorp: T(34, 10),
  zap: T(38, 8),
  zip: T(38, 12),
} as const;
/** Zip's marked tumble line, painted on the road in `m` tiles: row 12, from the east end of the arena to the west. */
export const ZIP_TUMBLE_LINE = { row: 12, fromCol: 50, toCol: 23, from: T(50, 12), to: T(23, 12) } as const;
/** Where Myko waits on the phone, and strolls in from. */
export const MASCOT_ENTRANCE = T(24, 16);
/** Four bottle crates (breakable, loot: the region's table) at the arena's corners. */
export const MASCOT_BOTTLE_TILES: readonly TileCoord[] = [
  { col: 23, row: 5 },
  { col: 50, row: 5 },
  { col: 23, row: 16 },
  { col: 50, row: 16 },
];
export const MASCOT_BOTTLE_SPOTS: readonly Vec2[] = MASCOT_BOTTLE_TILES.map((t) => T(t.col, t.row));
/** Where the filming tourists stand, just outside the arena, and the one who tips Andrew and hands over the prize. */
export const STRIP_CROWD_SPOTS: readonly Vec2[] = [T(20, 9), T(20, 12), T(53, 8), T(53, 14)];
export const TIPPING_TOURIST = { col: 53, row: 11 } as const;
/** The rack of inflatable aliens: the prize is taken from here. Frame positions of the four on the rack. */
export const RACK_TILES: readonly TileCoord[] = [
  { col: 54, row: 16 },
  { col: 55, row: 16 },
  { col: 56, row: 16 },
  { col: 57, row: 16 },
];
export const RACK_SPOT = T(55, 15);
/** The closing scene: outside the shop at night. Andrew and Gary stand here (Gary is moved by the script). */
export const CLOSING_SPOT = T(53, 5);
export const CLOSING_GARY_SPOT = T(54, 5);

export function stripScreen(): ScreenLayout {
  const c = new Canvas(60, 20, 'p', 'roswell');
  // The road across the middle, the verge at the edges, then the frontage.
  c.rect(1, 8, 58, 6, 'R');
  c.rect(0, 0, 60, 1, '#').rect(0, 19, 60, 1, '#').rect(0, 0, 1, 20, '#').rect(59, 0, 1, 20, '#');
  c.rect(1, 1, 58, 3, 'W').rect(1, 18, 58, 1, 'W');
  c.rect(1, 1, 1, 17, 'W').rect(58, 1, 1, 17, 'W');
  // The bar: open-fronted. A floor two rows deep behind a counter, a back wall of bottle shelves, a neon sign over it.
  c.rect(2, 2, 12, 2, '.').rect(2, 2, 12, 1, 'S').rect(2, 4, 12, 1, 'c').rect(3, 1, 10, 1, 'N');
  // The diner's saucer: windows along the frontage with the dome in neon.
  c.rect(16, 1, 16, 3, 'W').rect(19, 1, 10, 1, 'N').rect(17, 2, 3, 1, 'w').rect(27, 2, 3, 1, 'w').rect(19, 3, 2, 1, 'w').rect(27, 3, 2, 1, 'w');
  // The shop: neon over its door, windows either side.
  c.rect(48, 2, 10, 1, 'N').rect(49, 3, 2, 1, 'w').rect(56, 3, 2, 1, 'w').rect(53, 3, 2, 1, 'd');
  // The back gate in the south wall.
  c.rect(40, 18, 2, 1, 'd');
  // Zip's marked line.
  c.rect(ZIP_TUMBLE_LINE.toCol, ZIP_TUMBLE_LINE.row, ZIP_TUMBLE_LINE.fromCol - ZIP_TUMBLE_LINE.toCol + 1, 1, 'm');
  // The bar's forecourt tables, each with seats either side; the bus stop's bench.
  c.set(5, 7, 't').set(4, 7, 's').set(6, 7, 's').set(11, 7, 't').set(10, 7, 's').set(12, 7, 's');
  c.rect(2, 16, 3, 1, 's');
  // Cactus in the verge, and a bit of rough.
  c.set(14, 17, 'x').set(57, 17, 'x').rect(15, 15, 3, 2, 'r').rect(42, 16, 3, 1, 'r');

  const exits: ExitDef[] = [
    { id: 'c7.strip.shop', area: STRIP_TO_SHOP, toScreen: 'c7.shop', spawn: SHOP_FROM_STRIP },
    { id: 'c7.strip.gate', area: STRIP_BACK_GATE, toScreen: 'c7.stock', spawn: STOCK_FROM_GATE, lockedUntil: ['c7.fight.yard'] },
  ];
  const props: PropPlacement[] = [
    // Behind the counter: the coffee, its steam while it is on offer, and the green tea.
    { id: 'bar.coffee', frame: PROP.coffeePot, col: BAR_COFFEE_TILE.col, row: BAR_COFFEE_TILE.row },
    { id: 'bar.steam', frame: PROP.steam[0], frames: PROP.steam, frameRate: 4, col: BAR_COFFEE_TILE.col, row: BAR_COFFEE_TILE.row - 1, hidden: true },
    { id: 'bar.tea', frame: PROP.kettle, col: BAR_TEA_TILE.col, row: BAR_TEA_TILE.row },
    // The bus stop: the ticket machine at the west end of the forecourt.
    { id: 'strip.busStop', frame: PROP.busTicketMachine, col: 2, row: 14, solid: { dy: 1, width: 1, height: 1 } },
    // The leaflet on the table.
    { id: 'strip.leaflet', frame: PROP.brochure, col: 11, row: 7 },
    // The diner's sign over the saucer.
    { id: 'strip.dinerSign', frame: PROP.dinerSign, col: 22, row: 3 },
    // Street lamps with eyes, two each side of the arena.
    { id: 'strip.lamp1', frame: PROP.floodlightMast, col: 14, row: 5, solid: { dy: 1, width: 1, height: 1 } },
    { id: 'strip.lamp2', frame: PROP.floodlightMast, col: 19, row: 15, solid: { dy: 1, width: 1, height: 1 } },
    { id: 'strip.lamp3', frame: PROP.floodlightMast, col: 52, row: 5, solid: { dy: 1, width: 1, height: 1 } },
    { id: 'strip.lamp4', frame: PROP.floodlightMast, col: 57, row: 14, solid: { dy: 1, width: 1, height: 1 } },
    // The rack of inflatable aliens by the shop.
    ...RACK_TILES.map((t, i) => ({ id: `strip.rack${i + 1}`, frame: PROP.weapon.inflatableAlien, col: t.col, row: t.row, solid: { width: 1, height: 1 } })),
    // Bottle crates at the arena's corners.
    ...MASCOT_BOTTLE_TILES.map((t, i) => ({ id: `strip.arenaCrate${i + 1}`, frame: PROP.bottleCrate, col: t.col, row: t.row, solid: { width: 1, height: 1 }, breakable: {} })),
  ];
  const npcs: NpcPlacement[] = [
    // STAND-IN: the attendant look for the antennae'd, sunburnt bartender.
    { id: 'bartender', npc: 'attendant', col: BARTENDER_TILE.col, row: BARTENDER_TILE.row, facing: 'down', examinableId: 'c7.bar.tequila' },
    { id: 'tourist1', npc: 'touristA', col: TOURIST1_TILE.col, row: TOURIST1_TILE.row, facing: 'down', examinableId: 'c7.strip.tourist1' },
    { id: 'tourist2', npc: 'americanA', col: TOURIST2_TILE.col, row: TOURIST2_TILE.row, facing: 'left', examinableId: 'c7.strip.tourist2' },
  ];
  const dressing: ScreenDressing = { props, npcs };
  return c.build('c7.strip', exits, BAR_ARRIVAL, { mykoStart: MYKO_BAR, dressing });
}

// ---------------------------------------------------------------------------
// c7.shop: Little Green Gifts, 40 x 25
// ---------------------------------------------------------------------------

/** Just inside the shop's front door. */
export const SHOP_FROM_STRIP = T(19, 21);
/** Just inside the shop's back door (to the stockroom). */
export const SHOP_FROM_STOCK = T(3, 3);
export const SHOP_TO_STRIP = tilesArea(19, 23, 2, 1);
export const SHOP_TO_STOCK = tilesArea(3, 1, 2, 1);
export const SHOP_MYKO = T(22, 21);
/** Walking in starts `c7.tells.intro`. */
export const SHOP_ENTRY_AREA = tilesArea(16, 18, 8, 3);
/** Gary at the till, and where Andrew stands to talk to him. */
export const GARY_TILE = { col: 31, row: 3 } as const;
export const GARY_SPOT = T(31, 5);
/** The till counter (the tourists leave through the front door when Gary says they are closing). */
export const TILL_COUNTER = { col: 27, row: 4, width: 10, height: 1 } as const;
/** Where the tourists go when Gary says "Folks, we're closing": out of the front door. */
export const SHOP_CLOSING_EXIT = T(19, 22);

/**
 * The six figures. Three are tourists (a, c, e) and three are aliens (b, d and Gary). The aliens are fixed, so the
 * dialogue is written to them. `tells` is the line for examining the figure; Gary has none (he is `c7.tells.right`).
 */
export interface FigureDef {
  readonly key: 'a' | 'b' | 'c' | 'd' | 'e' | 'gary';
  readonly npcId: string;
  readonly npc: NpcId;
  /** Absent for Gary, who speaks as himself. */
  readonly nameTextId?: string;
  readonly col: number;
  readonly row: number;
  readonly facing: 'up' | 'down' | 'left' | 'right';
  readonly alien: boolean;
  /** The examine line (the tells). */
  readonly tellsDialogueId: DialogueId;
  /** Where Andrew stands to examine the figure. */
  readonly spot: Vec2;
}

export const FIGURES: readonly FigureDef[] = [
  // STAND-IN looks: touristA / touristB / americanA / alienClerk for the six, no costumes yet.
  { key: 'a', npcId: 'figure.a', npc: 'touristA', nameTextId: 'name.costumeA', col: 17, row: 19, facing: 'down', alien: false, tellsDialogueId: 'c7.tells.a', spot: T(17, 20) },
  { key: 'b', npcId: 'figure.b', npc: 'alienClerk', nameTextId: 'name.costumeB', col: 8, row: 8, facing: 'up', alien: true, tellsDialogueId: 'c7.tells.b', spot: T(8, 9) },
  { key: 'c', npcId: 'figure.c', npc: 'touristB', nameTextId: 'name.costumeC', col: 33, row: 13, facing: 'right', alien: false, tellsDialogueId: 'c7.tells.c', spot: T(33, 14) },
  { key: 'd', npcId: 'figure.d', npc: 'alienClerk', nameTextId: 'name.costumeD', col: 31, row: 7, facing: 'up', alien: true, tellsDialogueId: 'c7.tells.d', spot: T(31, 8) },
  { key: 'e', npcId: 'figure.e', npc: 'americanA', nameTextId: 'name.costumeE', col: 22, row: 10, facing: 'up', alien: false, tellsDialogueId: 'c7.tells.e', spot: T(22, 11) },
  { key: 'gary', npcId: 'gary', npc: 'gary', col: GARY_TILE.col, row: GARY_TILE.row, facing: 'down', alien: true, tellsDialogueId: 'c7.tells.right', spot: GARY_SPOT },
];
/** Which three are the aliens, fixed. */
export const ALIEN_FIGURES: readonly FigureDef['key'][] = ['b', 'd', 'gary'];
/** The tourists, who leave when Gary closes. */
export const TOURIST_FIGURES: readonly FigureDef['key'][] = ['a', 'c', 'e'];

export function shopScreen(): ScreenLayout {
  const c = new Canvas(40, 25, '.', 'roswell');
  c.room();
  // Neon on the back wall, windows beside the front door.
  c.rect(10, 1, 10, 1, 'N').rect(8, 23, 2, 1, 'w').rect(30, 23, 2, 1, 'w');
  // Doors: the front onto the strip, the back to the stockroom.
  c.rect(19, 23, 2, 1, 'd').rect(3, 1, 2, 1, 'd');
  // Shelves of snow globes.
  c.rect(4, 7, 8, 1, 'S').rect(4, 12, 8, 1, 'S').rect(4, 17, 8, 1, 'S').rect(24, 12, 8, 1, 'S');
  // The till counter, with Gary behind it.
  c.rect(TILL_COUNTER.col, TILL_COUNTER.row, TILL_COUNTER.width, TILL_COUNTER.height, 'c');
  // The fridge-magnet table.
  c.rect(22, 8, 2, 1, 't');

  const exits: ExitDef[] = [
    { id: 'c7.shop.strip', area: SHOP_TO_STRIP, toScreen: 'c7.strip', spawn: STRIP_FROM_SHOP },
    { id: 'c7.shop.stock', area: SHOP_TO_STOCK, toScreen: 'c7.stock', spawn: STOCK_FROM_SHOP },
  ];
  const props: PropPlacement[] = [
    // STAND-IN: the abduction photo booth is a vending machine.
    { id: 'shop.booth', frame: PROP.vendingMachine, col: 34, row: 12, solid: { dy: 1, width: 1, height: 1 } },
    { id: 'shop.bins', frame: PROP.bins, col: 36, row: 20, solid: { width: 1, height: 1 } },
    { id: 'shop.crate', frame: PROP.cardboardBox, col: 3, row: 21, solid: { width: 1, height: 1 } },
    { id: 'shop.crate2', frame: PROP.cardboardBox, col: 4, row: 21, solid: { width: 1, height: 1 } },
    { id: 'shop.plant', frame: PROP.flowerPot, col: 36, row: 3, solid: { width: 1, height: 1 } },
    // Inflatable aliens, by the front door.
    { id: 'shop.inflatable1', frame: PROP.weapon.inflatableAlien, col: 23, row: 21, solid: { width: 1, height: 1 } },
    { id: 'shop.inflatable2', frame: PROP.weapon.inflatableAlien, col: 24, row: 21, solid: { width: 1, height: 1 } },
  ];
  const npcs: NpcPlacement[] = FIGURES.map((f) => ({
    id: f.npcId,
    npc: f.npc,
    col: f.col,
    row: f.row,
    facing: f.facing,
    solid: true,
    examinableId: f.key === 'gary' ? 'c7.gary' : `c7.tells.${f.key}`,
  }));
  return c.build('c7.shop', exits, SHOP_FROM_STRIP, { mykoStart: SHOP_MYKO, dressing: { props, npcs } });
}

// ---------------------------------------------------------------------------
// c7.stock: stockroom and yard, 30 x 20
// ---------------------------------------------------------------------------

/** Just inside the stockroom's door from the shop. */
export const STOCK_FROM_SHOP = T(3, 16);
/** Just inside the yard's back gate, from the strip. */
export const STOCK_FROM_GATE = T(22, 3);
export const STOCK_TO_SHOP = tilesArea(3, 18, 2, 1);
export const STOCK_BACK_GATE = tilesArea(22, 1, 2, 1);

/** The stockroom stealth: in from the shop's door, out at the roller door into the yard. */
export const STOCK_START = tilesArea(2, 15, 5, 3);
export const STOCK_EXIT = tilesArea(16, 5, 2, 4);
/** Myko's phone place for the section, and where the `.alarm` fight's reinforcements come in. */
export const STOCK_ENTRANCE = T(2, 17);
export const STOCK_REINFORCEMENTS: readonly Vec2[] = [T(17, 4), T(17, 14)];

/** The four clerks of the stocktake and what they overhear: one line each, at the part of the route where it is said. */
export const STOCK_OVERHEARD: readonly { readonly dialogueId: DialogueId; readonly area: AreaRect }[] = [
  { dialogueId: 'c7.stock.overheard.1', area: tilesArea(6, 3, 3, 3) },
  { dialogueId: 'c7.stock.overheard.2', area: tilesArea(10, 7, 3, 4) },
  { dialogueId: 'c7.stock.overheard.3', area: tilesArea(8, 13, 3, 4) },
  { dialogueId: 'c7.stock.overheard.4', area: tilesArea(13, 13, 3, 4) },
];

/** The staff noticeboard on the back wall (the permit), the staff fridge in the north-east corner, and the van in the yard. */
export const NOTICEBOARD_TILE = { col: 9, row: 1 } as const;
export const NOTICEBOARD_SPOT = T(9, 3);
export const FRIDGE_TILE = { col: 16, row: 2 } as const;
export const FRIDGE_SPOT = T(16, 4);
/** The clean-run can of stout sits on top of the fridge (shown by the script). */
export const STOUT_TILE = { col: 15, row: 2 } as const;
export const VAN_TILE = { col: 21, row: 13 } as const;
export const VAN_SPOT = T(20, 14);

/** Hiding places to Act Natural beside (stand within `radius`, keep still). */
export const STOCK_HIDING: readonly HidingPropDef[] = [
  { id: 'c7.hide.board', kind: 'noticeboard', position: T(9, 2), radius: 32 },
  { id: 'c7.hide.vending', kind: 'vendingMachine', position: T(2, 10), radius: 32 },
  { id: 'c7.hide.cooler', kind: 'waterCooler', position: T(2, 5), radius: 32 },
];

const wait = (position: Vec2, waitMs: number, facing?: 'up' | 'down' | 'left' | 'right') => (facing ? { position, waitMs, facing } : { position, waitMs });
const lane = (a: Vec2, b: Vec2, waitMs: number): PatrolRoute => ({ mode: 'pingPong', waypoints: [wait(a, waitMs), wait(b, waitMs)] });

/**
 * Four clerks doing a stocktake: each walks one aisle, end to end and back, pausing at each end, and never varies.
 * North aisle, middle aisle, south aisle and the cross aisle by the roller door.
 */
export const STOCK_STEALTH: StealthSectionDef = {
  id: 'c7.stealth.stock',
  checkpointId: 'c7.cp.stock',
  guards: [
    { enemyId: 'clerk', route: lane(T(3, 4), T(15, 4), 2000) },
    { enemyId: 'clerk', route: lane(T(3, 9), T(14, 9), 1500) },
    { enemyId: 'clerk', route: lane(T(7, 15), T(15, 15), 1500) },
    { enemyId: 'clerk', route: lane(T(16, 4), T(16, 14), 1000) },
  ],
  hazards: [],
  hidingProps: STOCK_HIDING,
  // The clean-run reward is the stout in the staff fridge: the script reveals the `stock.stout` prop.
};

/** The yard fight: the east half, past the roller door. Three mascots and three clerks. */
export const YARD_AREA = tilesArea(19, 2, 9, 16);
export const YARD_TRIGGER = tilesArea(19, 5, 1, 4);
/** Six spawns: the first three for the mascots (north, middle and south of the yard), the last three for the clerks, along the east fence. */
export const YARD_MASCOT_SPAWNS: readonly Vec2[] = [T(25, 4), T(25, 9), T(25, 16)];
export const YARD_CLERK_SPAWNS: readonly Vec2[] = [T(27, 5), T(27, 10), T(27, 15)];
export const YARD_SPAWNS: readonly Vec2[] = [...YARD_MASCOT_SPAWNS, ...YARD_CLERK_SPAWNS];
/** Where Myko waits on the phone for the fight, and the empties to throw. */
export const YARD_ENTRANCE = T(19, 16);
export const YARD_BOTTLE_TILES: readonly TileCoord[] = [
  { col: 20, row: 3 },
  { col: 27, row: 3 },
  { col: 20, row: 16 },
  { col: 27, row: 16 },
];
export const YARD_BOTTLE_SPOTS: readonly Vec2[] = YARD_BOTTLE_TILES.map((t) => T(t.col, t.row));

export function stockScreen(): ScreenLayout {
  const c = new Canvas(30, 20, 'F', 'roswell');
  c.room();
  // The divider between the stockroom and the yard, with the roller door's opening.
  c.rect(18, 2, 1, 16, 'W').rect(18, 8, 1, 4, 'F');
  // The yard is outdoors.
  c.rect(19, 2, 9, 16, 'p').rect(24, 15, 3, 2, 'r');
  // Doors: to the shop, and the back gate onto the strip.
  c.rect(3, 18, 2, 1, 'd').rect(22, 1, 2, 1, 'd');
  // Shelving runs of stacked stock, each 1 tile thick: they block movement and sight.
  c.rect(4, 6, 10, 1, 'B').rect(4, 12, 10, 1, 'B');

  const exits: ExitDef[] = [
    { id: 'c7.stock.shop', area: STOCK_TO_SHOP, toScreen: 'c7.shop', spawn: SHOP_FROM_STOCK },
    { id: 'c7.stock.gate', area: STOCK_BACK_GATE, toScreen: 'c7.strip', spawn: STRIP_FROM_GATE, lockedUntil: ['c7.fight.yard'] },
  ];
  const props: PropPlacement[] = [
    // The staff noticeboard on the back wall, and the staff fridge by the roller door.
    { id: 'stock.board', frame: PROP.noticeboard, col: NOTICEBOARD_TILE.col, row: NOTICEBOARD_TILE.row, solid: { dy: 1, width: 1, height: 1 } },
    { id: 'stock.fridge', frame: PROP.clubFridge, col: FRIDGE_TILE.col, row: FRIDGE_TILE.row, solid: { dy: 1, width: 1, height: 1 } },
    { id: 'stock.stout', frame: PROP.stoutPint, col: STOUT_TILE.col, row: STOUT_TILE.row, hidden: true },
    // Staff vending machine and water cooler, against the west wall.
    { id: 'stock.vending', frame: PROP.vendingMachine, col: 2, row: 9, solid: { dy: 1, width: 1, height: 1 } },
    { id: 'stock.cooler', frame: PROP.waterCooler, col: 2, row: 4, solid: { dy: 1, width: 1, height: 1 } },
    // Boxes in the corners of the aisles.
    { frame: PROP.cardboardBox, col: 14, row: 3, solid: { width: 1, height: 1 } },
    { frame: PROP.crate, col: 3, row: 13, solid: { width: 1, height: 1 } },
    { frame: PROP.cardboardBox, col: 13, row: 17, solid: { width: 1, height: 1 } },
    // The yard: the van, bottle crates and bins.
    { id: 'yard.van', frame: PROP.van.right, col: VAN_TILE.col, row: VAN_TILE.row, solid: { width: 3, height: 2 } },
    ...YARD_BOTTLE_TILES.map((t, i) => ({ id: `yard.crate${i + 1}`, frame: PROP.bottleCrate, col: t.col, row: t.row, solid: { width: 1, height: 1 }, breakable: {} })),
    { frame: PROP.bins, col: 27, row: 12, solid: { width: 1, height: 1 } },
  ];
  return c.build('c7.stock', exits, STOCK_FROM_SHOP, { mykoStart: STOCK_ENTRANCE, dressing: { props } });
}
