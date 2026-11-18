/**
 * Props for chapter 9 (Level Minus Four: the base's offices, labs and containment hall, region base) and chapter 10
 * (Disclosure: the anteroom and control room, region base, then Feeney's in daylight, region kilnamoe).
 * Owner: creative-director.
 *
 * Chapters 9 and 10 place these keys at these sizes, so change a key or a size only together with the maps that use
 * them. Frames are drawn from their top-left corner, like every other prop.
 *
 * Style (docs/style-guide.md): palette colours only, light from the top left, three tones a surface, an ink outline
 * on anything Andrew can use or bump into, and no lettering: writing is suggested with blocks and rules. The one
 * exception is ticket 848, whose number is the joke. No real brands, logos, flags or agency seals (DESIGN.md
 * section 2). The base is tidy: things line up, nothing is chipped, every lid is on.
 *
 * Already drawn elsewhere, so not here: the base tiles (tiles.ts: floor, carpet, wall, glass, gravitySwitch,
 * pressurePlate, blastFrame, waterCooler, consoleDais, plus `carpetTile` and `glassAlong`), the alien `clerk` and
 * `security` enemies and the Administrator's boss sheets (cast.ts), the blast door (machines.ts,
 * `boss.c9.setpiece.lockdown`: `idle` open, `walk` closing, `telegraph` about to drop, `down` shut), the Glove's
 * stun ring (`fx.stunRing`), the security wand (`PROP.weapon.securityWand`), the tea trolley (`PROP.teaTrolley`) and
 * the steam (`PROP.steam`).
 */

import type { Facing } from '../core/types';
import type { ColourName } from './palette';
import { AtlasBuilder, PixelBuffer } from './pixels';

type Draw = (b: PixelBuffer) => void;

const outlined =
  (draw: Draw): Draw =>
  (b) => {
    const layer = new PixelBuffer(b.width, b.height);
    draw(layer);
    layer.outline('ink');
    b.blit(layer, 0, 0);
  };

/** Turn a square, right-pointing drawing to point `facing`. */
const turned =
  (draw: Draw, facing: Facing): Draw =>
  (b) => {
    const src = new PixelBuffer(b.width, b.height);
    draw(src);
    const n = b.width - 1;
    for (let y = 0; y < b.height; y++) {
      for (let x = 0; x < b.width; x++) {
        const p = src.get(x, y);
        if (p === null) continue;
        if (facing === 'right') b.set(x, y, p);
        else if (facing === 'down') b.set(n - y, x, p);
        else if (facing === 'left') b.set(n - x, n - y, p);
        else b.set(y, n - x, p);
      }
    }
  };

const FACINGS = ['up', 'down', 'left', 'right'] as const satisfies readonly Facing[];
const byFacing = (prefix: string): Readonly<Record<Facing, string>> =>
  Object.fromEntries(FACINGS.map((f) => [f, `${prefix}.${f}`])) as Record<Facing, string>;
const byFacingFrames = (prefix: string): Readonly<Record<Facing, readonly [string, string]>> =>
  Object.fromEntries(FACINGS.map((f) => [f, [`${prefix}.${f}.0`, `${prefix}.${f}.1`] as const])) as Record<Facing, readonly [string, string]>;

/** The five proofs, in the order chapter 9 lists them. Ids match `c9.proof.<id>`. */
export const PROOFS = ['craft', 'contract', 'directory', 'log', 'footage'] as const;
export type ProofId = (typeof PROOFS)[number];
const byProof = (prefix: string): Readonly<Record<ProofId, string>> =>
  Object.fromEntries(PROOFS.map((p) => [p, `${prefix}.${p}`])) as Record<ProofId, string>;

/**
 * The broadcast console's socket shapes. `square` and `notched` are the pair that look alike until examined: the
 * notched one has its top-right corner clipped, which shows plainly only in the 32 x 32 close-up.
 */
export const SOCKET_SHAPES = ['circle', 'square', 'notched', 'triangle', 'twinHole'] as const;
export type SocketShape = (typeof SOCKET_SHAPES)[number];

/** Which socket each proof's plug fits. */
export const PROOF_SOCKET: Readonly<Record<ProofId, SocketShape>> = {
  craft: 'circle',
  contract: 'square',
  directory: 'notched',
  log: 'triangle',
  footage: 'twinHole',
};

/**
 * The console's five channels, left to right, and where each socket's 16 x 16 frame sits inside the 80 x 32 console
 * frame. Draw `socket[shape]`, `plugSeated[proof]` or a highlight at the console's x + x, y + y. The two lookalikes
 * are not side by side.
 */
export const CONSOLE_SOCKETS: readonly { readonly shape: SocketShape; readonly x: number; readonly y: number }[] = [
  { shape: 'triangle', x: 2, y: 9 },
  { shape: 'square', x: 17, y: 9 },
  { shape: 'circle', x: 32, y: 9 },
  { shape: 'notched', x: 47, y: 9 },
  { shape: 'twinHole', x: 62, y: 9 },
];

/**
 * Feeney's in daylight (`c10.pub`), the chapter 1 screen with the morning in it. A plan for level-builder:
 * - Ambient: none. The pub is already its warm self; daylight is added, not night taken away.
 * - Every `window` tile becomes kilnamoe `windowDay` (pale sky in the glass, no amber glow).
 * - Under each window, on the floor layer, a `sunShaft` with its top-left at the window's tile, drawn at
 *   `sunShaftAlpha` with an ADD blend. Shafts fall down and to the right, the same way as every highlight.
 * - The telly (`PROP.telly`'s spot) shows `tellyOn` frames in this order, `tellyFrameMs` each, looping:
 *   weather, bins, aliens, proofs. The fruit machine is unchanged: it still has his euro.
 */
export const FEENEYS_DAYLIGHT = {
  windowTile: 'windowDay',
  sunShaftAlpha: 0.35,
  tellyOrder: ['weather', 'bins', 'aliens', 'proofs'],
  tellyFrameMs: 2000,
} as const;

export const PROP_C910 = {
  // --- Chapter 9: offices (c9.offices) ---
  /**
   * An open-plan desk seen from the front: monitor, keyboard, in-tray, one mug (32 x 24). `tidy` has no chair;
   * `seated` has the chair's back showing behind the desk, so a clerk placed with its feet at y + 12 reads as sat
   * there with the desk hiding its legs (draw the desk over the clerk); `empty` is a cleared desk with a box of
   * someone's things and a leaving card, the monitor off. Solid: bottom 2 x 1.
   */
  baseDesk: { tidy: 'c910.desk.tidy', seated: 'c910.desk.seated', empty: 'c910.desk.empty' },
  /** A violet office chair on a five-star base (16 x 16). Loose: it slides when gravity changes. */
  officeChair: 'c910.officeChair',
  /** The water cooler with a big bottle; a bubble rises through it, two frames (16 x 24). An Act Natural spot. Solid at its foot. */
  baseWaterCooler: ['c910.waterCooler.0', 'c910.waterCooler.1'],
  /** The kitchenette: counter, sink, a microwave, a mug tree and cupboards (48 x 24). The kettle goes on it. Solid: bottom 3 x 1. */
  kitchenette: 'c910.kitchenette',
  /** A three-drawer filing cabinet, every label filled in (16 x 24). `open`: the top drawer out, the folders showing. Solid at its foot. */
  baseFilingCabinet: { shut: 'c910.filingCabinet.shut', open: 'c910.filingCabinet.open' },
  /**
   * The noticeboard (32 x 24): a rota, a party poster, and the staff directory, a grid of small grey photographs with
   * one lime face among them (Gary). `taken`: the directory gone, a pin and a cleaner patch where it was.
   */
  staffNoticeboard: { full: 'c910.staffNoticeboard.full', taken: 'c910.staffNoticeboard.taken' },
  /**
   * A meeting-room plate on the wall beside a door, a moon on it and the name as a block (16 x 16, the plate in the
   * middle rows). The rooms are named after moons: `[0]` a crescent, `[1]` a half moon, `[2]` a full moon with
   * craters, `[3]` a small moon in front of a ringed planet.
   */
  doorPlate: ['c910.doorPlate.0', 'c910.doorPlate.1', 'c910.doorPlate.2', 'c910.doorPlate.3'],
  /** The staff social area's dartboard on its backboard, the three darts put away in a row on a little shelf (16 x 24). */
  baseDartboard: 'c910.baseDartboard',
  /** The party sign-up sheet on a clipboard: full to the bottom in two columns, and a second sheet taped on below (16 x 24). */
  partySignUp: 'c910.partySignUp',
  /** The base's staff fridge, grey, a rota on the door (16 x 24). `open`: matching boxes, every one labelled, and a milk. Solid at its foot. */
  baseFridge: { shut: 'c910.baseFridge.shut', open: 'c910.baseFridge.open' },
  /** A sleek violet kettle on a tray, two mugs upside down and a tea jar (16 x 16). Sits on the kitchenette. Use `PROP.steam` over it. */
  baseKettle: 'c910.baseKettle',
  /**
   * The lost-property box: a cardboard box with a sticky note on the front (16 x 16). `withGlove` has the Borrowed
   * Glove's fingers over the edge, an umbrella handle and a sock; `empty` still has the umbrella and the sock.
   */
  lostPropertyBox: { withGlove: 'c910.lostPropertyBox.withGlove', empty: 'c910.lostPropertyBox.empty' },
  /** The Borrowed Glove as a thing on the ground: a big teal gauntlet, a violet knuckle light (16 x 16). Matches its move icon. */
  borrowedGlove: 'c910.borrowedGlove',

  // --- Chapter 9: labs and gravity rooms (c9.labs) ---
  /**
   * A wall switch worked with the Glove (16 x 16): a steel plate with a big Glove-teal arrow pointing at the wall it
   * makes "down". Keyed by that direction. Reads the same on any wall. `thrown`: the arrow amber and the face lit, for
   * the switch that is currently in charge.
   */
  gravitySwitch: { ...byFacing('c910.gravitySwitch'), thrown: byFacing('c910.gravitySwitch.thrown') },
  /** A pressure plate on the floor layer, no outline (16 x 16). `up` raised and violet; `down` flush, with a lit teal ring. */
  pressurePlate: { up: 'c910.pressurePlate.up', down: 'c910.pressurePlate.down' },
  /** A grey storage crate with teal corners and a label (16 x 16). Loose: it slides. Solid. */
  slidingCrate: 'c910.slidingCrate',
  /** A raised ledge, one tile, no outline: a lit top and a hazard-striped lip on its south side (16 x 16). */
  ledge: 'c910.ledge',
  /**
   * The hangar viewing window (64 x 32): a framed pane in the wall looking down on the craft, which has a panel out
   * of its rim shaped like the bog fragment, wires showing. Sits on a wall row; collision is the wall.
   */
  hangarWindow: 'c910.hangarWindow',
  /** Records-room shelving: four shelves of identical archive boxes (32 x 32). `taken`: one box gone (the flight log). Solid: bottom 2 x 1. */
  recordsShelves: { full: 'c910.recordsShelves.full', taken: 'c910.recordsShelves.taken' },

  // --- Chapter 9: containment hall (c9.hall) ---
  /** A sealed bay in the hall's side wall: a rounded hatch with a porthole and a violet glow, a hazard frame (32 x 32). Wall dressing. */
  sealedBay: 'c910.sealedBay',
  /**
   * The timer over a blast door (16 x 16, the display in the middle rows): a row of six segments draining right to
   * left. Frame index = segments left: `[6]` full, `[0]` empty. Four and up are teal; two and fewer are red and
   * the lamp on top lights. Draw it on the wall tile above the blast door.
   */
  doorTimer: ['c910.doorTimer.0', 'c910.doorTimer.1', 'c910.doorTimer.2', 'c910.doorTimer.3', 'c910.doorTimer.4', 'c910.doorTimer.5', 'c910.doorTimer.6'],
  /** The barrier the bay 2 and bay 4 switches move: two queue posts with a violet belt between them (32 x 16). Loose: it slides. */
  queueBarrier: 'c910.queueBarrier',
  /**
   * The wall recorder in bay 3 (16 x 24): a grey unit with a window. `tape` has the tape in, reels turning (two
   * frames) and the red lamp on; `empty` has the door open and the lamp off.
   */
  wallRecorder: { tape: ['c910.wallRecorder.tape.0', 'c910.wallRecorder.tape.1'], empty: 'c910.wallRecorder.empty' },
  /** The lift at the end of the hall (32 x 32): steel doors, a call panel, a floor lamp above. `open`: the leaves back, a lit car. */
  liftDoors: { shut: 'c910.liftDoors.shut', open: 'c910.liftDoors.open' },
  /**
   * The lift guard's chair, teal (16 x 16). `chair` is the chair alone (the guard sprite stands in it); `onBreak` has
   * a card on the seat with a cup drawn on it. The wand he leaves is `PROP.weapon.securityWand`.
   */
  liftGuardChair: { chair: 'c910.liftGuardChair.chair', onBreak: 'c910.liftGuardChair.onBreak' },

  // --- Chapter 9: the five proofs ---
  /**
   * The proofs drawn as themselves, for pickups, the casebook and the carrier bag (16 x 16). `craft` a glossy photo
   * of the craft, the panel missing; `contract` a stapled document, two signatures; `directory` the staff directory
   * open at a page of photos, one lime; `log` a flight log page, one line marked amber; `footage` a tape with a label.
   */
  proof: byProof('c910.proof'),

  // --- Chapter 10: anteroom (c10.anteroom) ---
  /**
   * The drinks cabinet (32 x 32): an old wooden cabinet that has never belonged here, glass doors, three decanters
   * with stoppers, a tray, dust along the top. The bar. Solid: bottom 2 x 1.
   */
  drinksCabinet: 'c910.drinksCabinet',
  /** A row of three joined waiting chairs, violet seats on a steel beam (48 x 16). Solid. */
  waitingChairs: 'c910.waitingChairs',
  /** The ticket machine on its post, a "now serving" display and a ticket in the slot (16 x 24). Solid at its foot. */
  baseTicketMachine: 'c910.ticketMachine',
  /** Andrew's ticket, number 848, the only digits in the art (16 x 16). For a pickup, the casebook or a close-up. */
  ticket848: 'c910.ticket848',
  /** A potted plant, perfectly symmetrical, possibly plastic, a violet pot (16 x 24). Loose in the control room: it slides. */
  pottedPlant: 'c910.pottedPlant',
  /** The receptionist's desk, empty: a bell, a monitor seen from behind, the chair pushed out (48 x 24). Solid: bottom 3 x 1. */
  receptionDesk: 'c910.receptionDesk',

  // --- Chapter 10: control room (c10.control) ---
  /**
   * The Administrator's desk (48 x 32): a wide dark desk, a lamp, a rack of rubber stamps, one form squared to the
   * edge and a name block. He stands behind it, so draw it over him. Solid: bottom 3 x 1.
   */
  adminDesk: 'c910.adminDesk',
  /**
   * The desk shield, no outline (64 x 48): a dome of teal lines over the desk, two frames shimmering. Its top-left is
   * the desk's top-left minus (8, 12). Hide it for the 4 s it is down.
   */
  deskShield: ['c910.deskShield.0', 'c910.deskShield.1'],
  /** The wall of screens, two rows of four: charts, a map, a field with a ring on it, a camera view (64 x 32). Two frames. Wall dressing. */
  screenWall: ['c910.screenWall.0', 'c910.screenWall.1'],
  /**
   * The broadcast console (80 x 32) on the `consoleDais` tiles: a sloped panel with five empty sockets at
   * `CONSOLE_SOCKETS`. Solid: bottom 5 x 1.
   */
  broadcastConsole: 'c910.broadcastConsole',
  /** One socket as drawn on the console, its lamp off (16 x 16). Use for a hover highlight or the examine prompt. */
  socket: Object.fromEntries(SOCKET_SHAPES.map((s) => [s, `c910.socket.${s}`])) as Readonly<Record<SocketShape, string>>,
  /** A socket close up, for examining (32 x 32). The square and the notched socket are plainly different here. */
  socketCloseup: Object.fromEntries(SOCKET_SHAPES.map((s) => [s, `c910.socketCloseup.${s}`])) as Readonly<Record<SocketShape, string>>,
  /** A proof's plug, loose with its cord (16 x 16): a cap in the proof's colour with its shape raised on it. */
  plug: byProof('c910.plug'),
  /** A proof's plug pushed home, drawn over its socket at the socket's offset: the cap in the hole, the lamp lit teal (16 x 16). */
  plugSeated: byProof('c910.plugSeated'),
  /** The big button on a post (16 x 24): `covered` under its clear flip cover, `ready` with the cover up, `pressed` pushed in and lit. */
  bigButton: { covered: 'c910.bigButton.covered', ready: 'c910.bigButton.ready', pressed: 'c910.bigButton.pressed' },
  /**
   * Phase 2's warning, on the floor layer, no outline (16 x 16): a chevron pointing the way gravity is about to go.
   * Two frames: `[0]` violet outline, `[1]` solid amber for the last half second. Lay a row of them across the room.
   */
  gravityArrow: byFacingFrames('c910.gravityArrow'),
  /** The row a stamp's shockwave will run along, floor layer, no outline (16 x 16): `[0]` dashed violet edges and stamp marks, `[1]` solid amber. Tiles east-west. */
  stampRow: ['c910.stampRow.0', 'c910.stampRow.1'],
  /** Speed lines behind sliding furniture, no outline (16 x 16). `right` trails off to the left of something moving right; use the facing it moves. */
  slideStreak: byFacing('c910.slideStreak'),
  /** A wall hook with a wooden hanger (16 x 24). `jacket`: his suit jacket on it, shoulders square, hung properly, for phase 3. */
  coatHook: { empty: 'c910.coatHook.empty', jacket: 'c910.coatHook.jacket' },

  // --- Chapter 10: Feeney's in daylight (c10.pub) ---
  /**
   * The pub telly switched on: the same set as `PROP.telly`, with a picture (16 x 16). `weather` a cloud and rain,
   * `bins` a bin lorry, `aliens` a grey face, `proofs` the five proofs in a grid. Order in `FEENEYS_DAYLIGHT`.
   */
  tellyOn: { weather: 'c910.tellyOn.weather', bins: 'c910.tellyOn.bins', aliens: 'c910.tellyOn.aliens', proofs: 'c910.tellyOn.proofs' },
  /** Morning light through a window across the floor, no outline (32 x 32): a slanted band, dithered. Draw ADD at `FEENEYS_DAYLIGHT.sunShaftAlpha`. */
  sunShaft: 'c910.sunShaft',

  // --- Chapter 10: the world's reaction ---
  /**
   * One small picture per reaction card (64 x 40), for the UI to frame. `governments` a lectern with a bank of
   * microphones before a plain curtain and a clock; `news` a bin lorry and an overflowing bin; `video` a video
   * player with a short view bar and one comment with a lime face; `colleenAnn` her bar, her behind it, finger up;
   * `lake` a lake, a folding chair, Pruitt from behind and a radio on the grass.
   */
  reactionCard: {
    governments: 'c910.reactionCard.governments',
    news: 'c910.reactionCard.news',
    video: 'c910.reactionCard.video',
    colleenAnn: 'c910.reactionCard.colleenAnn',
    lake: 'c910.reactionCard.lake',
  },
} as const;

// --- Chapter 9: offices ---------------------------------------------------------

/** The desk all three variants share. */
const deskBody = (b: PixelBuffer): void => {
  b.rect(0, 9, 32, 5, 'alienGrey').hline(0, 9, 32, 'fluoro').hline(0, 13, 32, 'fog');
  b.rect(1, 14, 30, 8, 'steel').hline(1, 14, 30, 'fog');
  b.rect(22, 15, 8, 7, 'alienGrey').hline(23, 17, 6, 'steel').hline(23, 20, 6, 'steel').rect(25, 16, 2, 1, 'fluoro').rect(25, 19, 2, 1, 'fluoro');
  b.rect(1, 22, 2, 2, 'slate').rect(29, 22, 2, 2, 'slate');
};

const baseDesk =
  (variant: 'tidy' | 'seated' | 'empty'): Draw =>
  (b) => {
    if (variant === 'seated') {
      // The chair's back behind the desk, left of the monitor.
      b.rect(3, 2, 8, 7, 'violet').hline(3, 2, 8, 'fluoro').vline(10, 3, 6, 'violetDark');
    }
    if (variant === 'empty') {
      // The chair pushed out to the right, half off the desk.
      b.rect(26, 4, 6, 5, 'violet').hline(26, 4, 6, 'fluoro');
    }
    deskBody(b);
    // The monitor.
    b.rect(13, 1, 12, 8, 'coal').rect(18, 9, 2, 1, 'slate');
    if (variant === 'empty') {
      b.rect(14, 2, 10, 6, 'ink').line(15, 6, 18, 3, 'slate');
      // A box of someone's things and the leaving card, stood up.
      b.rect(2, 6, 8, 6, 'tan').hline(2, 6, 8, 'sand').hline(2, 11, 8, 'tanShade').rect(3, 4, 2, 3, 'violet').set(7, 5, 'grass').rect(6, 5, 1, 2, 'moss');
      b.rect(11, 8, 3, 4, 'white').set(12, 9, 'amber');
    } else {
      b.rect(14, 2, 10, 6, 'teal').hline(15, 3, 8, 'fluoro').hline(15, 5, 6, 'fluoro').hline(15, 6, 7, 'tealDark');
      b.rect(14, 10, 10, 2, 'fog').hline(14, 10, 10, 'white');
      // The in-tray (not over the chair) and one mug, handle out.
      if (variant === 'tidy') b.rect(3, 9, 6, 3, 'violet').rect(4, 8, 4, 2, 'white');
      else b.rect(3, 10, 5, 2, 'violet').hline(4, 10, 3, 'white');
      b.rect(27, 8, 3, 3, 'white').set(30, 9, 'white').set(28, 8, 'violetDark');
    }
  };

const officeChair: Draw = (b) => {
  b.rect(4, 1, 8, 6, 'violet').hline(4, 1, 8, 'fluoro').vline(11, 2, 5, 'violetDark');
  b.rect(7, 7, 2, 1, 'steel');
  b.rect(3, 8, 10, 3, 'violet').hline(3, 10, 10, 'violetDark');
  b.rect(7, 11, 2, 2, 'steel');
  b.line(7, 13, 3, 14, 'slate').line(8, 13, 12, 14, 'slate').vline(8, 13, 2, 'slate');
  b.set(3, 15, 'ink').set(12, 15, 'ink').set(8, 15, 'ink');
};

const baseWaterCooler =
  (frame: number): Draw =>
  (b) => {
    b.ellipse(4, 0, 8, 10, 'skyPale').vline(5, 2, 6, 'fluoro').vline(10, 2, 6, 'dustyBlue');
    b.rect(6, 9, 4, 1, 'dustyBlue');
    b.set(7, 6 - frame * 3, 'white').set(8, 7 - frame * 3, 'white').set(9, 3 + frame * 2, 'fluoro');
    b.rect(3, 10, 10, 13, 'alienGrey').hline(3, 10, 10, 'fluoro').vline(12, 11, 12, 'steel');
    b.rect(5, 13, 2, 2, 'teal').rect(9, 13, 2, 2, 'violet');
    b.rect(5, 18, 6, 2, 'steel').hline(5, 18, 6, 'slate');
    b.rect(13, 12, 2, 5, 'bone').hline(13, 12, 2, 'white');
  };

const kitchenette: Draw = (b) => {
  b.rect(0, 8, 48, 4, 'bone').hline(0, 8, 48, 'white').hline(0, 11, 48, 'fog');
  b.rect(0, 12, 48, 11, 'alienGrey');
  for (const x of [0, 12, 24, 36]) b.vline(x + 11, 12, 11, 'steel').rect(x + 9, 16, 1, 3, 'fluoro');
  b.hline(0, 22, 48, 'steel');
  // The microwave, its display teal.
  b.rect(2, 1, 13, 8, 'coal').rect(3, 2, 8, 5, 'slate').rect(12, 2, 2, 1, 'teal').rect(12, 4, 2, 3, 'steel');
  // The sink and its tap.
  b.rect(20, 9, 10, 2, 'steel').hline(20, 9, 10, 'slate').rect(24, 4, 1, 5, 'fog').hline(24, 4, 3, 'fog').set(26, 5, 'fog');
  // A mug tree with four mugs, all the same.
  b.vline(38, 1, 7, 'steel').hline(35, 7, 7, 'steel');
  for (const [x, y] of [[35, 2], [39, 2], [35, 5], [39, 5]] as const) b.rect(x, y, 2, 2, 'white');
  b.rect(43, 4, 3, 4, 'violet').hline(43, 4, 3, 'fluoro');
};

const baseFilingCabinet =
  (open: boolean): Draw =>
  (b) => {
    b.rect(2, 1, 12, 22, 'alienGrey').hline(2, 1, 12, 'fluoro').vline(13, 2, 21, 'steel');
    for (const y of [2, 9, 16]) {
      b.hline(3, y + 6, 10, 'steel');
      b.rect(5, y + 1, 6, 2, 'bone').rect(6, y + 4, 4, 1, 'slate');
    }
    if (open) {
      // The top drawer pulled out toward us: its sides, the folders and their tabs.
      b.rect(1, 0, 14, 10, 'steel').rect(2, 1, 12, 6, 'coal');
      for (let x = 3; x < 13; x += 2) b.rect(x, 2, 1, 5, x % 4 === 1 ? 'violet' : 'violetDark').set(x, 1, 'amberLight');
      b.rect(1, 7, 14, 3, 'alienGrey').hline(1, 7, 14, 'fluoro').rect(6, 8, 4, 1, 'slate');
    }
    b.rect(3, 23, 2, 1, 'slate').rect(11, 23, 2, 1, 'slate');
  };

const staffNoticeboard =
  (taken: boolean): Draw =>
  (b) => {
    b.rect(0, 1, 32, 20, 'steel').rect(1, 2, 30, 18, 'violetDark');
    for (let y = 3; y < 19; y += 3) for (let x = 2 + (y % 2); x < 30; x += 4) b.set(x, y, 'violet');
    // The rota: a grid.
    b.rect(2, 3, 7, 7, 'white');
    for (let y = 4; y < 10; y += 2) b.hline(3, y, 5, 'fog');
    b.vline(5, 4, 5, 'fog').set(3, 4, 'teal').set(6, 6, 'teal').set(4, 8, 'teal');
    // The party poster.
    b.rect(3, 12, 6, 7, 'amberLight').rect(4, 13, 4, 2, 'violet').hline(4, 16, 4, 'amber').hline(4, 17, 3, 'amber').set(5, 12, 'alarm');
    if (!taken) {
      // The staff directory: four rows of five photographs, grey faces, one lime.
      b.rect(11, 3, 18, 16, 'bone').hline(11, 3, 18, 'white').rect(12, 4, 10, 1, 'violet');
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 5; c++) {
          const x = 12 + c * 3;
          const y = 6 + r * 4;
          const lime = r === 1 && c === 3;
          b.rect(x, y, 2, 2, lime ? 'lime' : 'alienGrey').set(x, y + 1, 'ink');
          b.hline(x, y + 3, 2, 'fog');
        }
      }
      b.set(20, 3, 'alarm');
    } else {
      // A cleaner patch, the pin left behind, a torn corner.
      b.rect(11, 3, 18, 16, 'violet');
      for (let y = 4; y < 19; y += 3) for (let x = 12 + (y % 2); x < 29; x += 4) b.set(x, y, 'violetDark');
      b.set(20, 3, 'alarm').set(20, 4, 'white').set(21, 4, 'white');
    }
    b.rect(3, 21, 2, 3, 'steel').rect(27, 21, 2, 3, 'steel');
  };

/** The four moons, drawn in a 6 x 6 box at x, y. */
const moon = (b: PixelBuffer, which: number, x: number, y: number): void => {
  if (which === 0) {
    b.ellipse(x, y, 6, 6, 'bone').ellipse(x + 2, y - 1, 6, 6, null);
  } else if (which === 1) {
    b.ellipse(x, y, 6, 6, 'bone');
    b.rect(x + 3, y, 3, 6, null);
  } else if (which === 2) {
    b.ellipse(x, y, 6, 6, 'bone').set(x + 2, y + 2, 'fog').set(x + 4, y + 3, 'fog').set(x + 2, y + 4, 'fog');
  } else {
    b.ellipse(x + 1, y + 1, 4, 4, 'violet').hline(x - 1, y + 3, 8, 'fluoro').set(x + 5, y, 'bone').set(x + 5, y + 1, 'bone').set(x + 4, y, 'bone');
  }
};

const doorPlate =
  (which: number): Draw =>
  (b) => {
    b.rect(1, 4, 14, 8, 'steel').hline(1, 4, 14, 'fog').hline(1, 11, 14, 'slate');
    b.rect(2, 5, 7, 6, 'violetDark');
    moon(b, which, 3, 5);
    b.rect(10, 6, 4, 1, 'fluoro').rect(10, 8, 3, 1, 'fluoro');
  };

const baseDartboard: Draw = (b) => {
  b.rect(1, 0, 14, 16, 'violetDark').hline(1, 0, 14, 'violet');
  b.ellipse(2, 1, 12, 12, 'coal').ellipse(3, 2, 10, 10, 'bone');
  for (let a = 0; a < 20; a += 2) {
    const ang = (a / 20) * Math.PI * 2;
    b.line(8, 7, Math.round(8 + Math.cos(ang) * 4.4), Math.round(7 + Math.sin(ang) * 4.4), 'teal');
  }
  b.ellipse(5, 4, 6, 6, 'violet').ellipse(6, 5, 4, 4, 'bone').rect(7, 6, 2, 2, 'alarm');
  // The shelf under it, three darts lying in a neat row.
  b.rect(2, 18, 12, 2, 'steel').hline(2, 18, 12, 'fog');
  for (const x of [4, 7, 10]) b.vline(x, 14, 4, 'fog').set(x, 13, 'teal').set(x, 14, 'teal');
  b.rect(3, 20, 2, 3, 'slate').rect(11, 20, 2, 3, 'slate');
};

const partySignUp: Draw = (b) => {
  // The clipboard and its sheet, a violet heading.
  b.rect(2, 1, 12, 16, 'tealDark').rect(6, 0, 4, 2, 'steel');
  b.rect(3, 2, 10, 14, 'white').rect(4, 3, 8, 2, 'violet');
  for (let y = 6; y < 16; y++) {
    if (y % 2 === 1) continue;
    b.hline(4, y, 3 + (y % 3 === 0 ? 1 : 0), 'slate').hline(9, y, 3 - (y % 4 === 0 ? 1 : 0), 'slate');
  }
  // The overflow sheet, taped on below.
  b.rect(3, 16, 10, 7, 'white').rect(5, 15, 2, 2, 'skyPale').rect(9, 15, 2, 2, 'skyPale');
  for (const y of [18, 20, 22]) b.hline(4, y, 3, 'slate').hline(9, y, 3, 'slate');
};

const baseFridge =
  (open: boolean): Draw =>
  (b) => {
    b.rect(2, 1, 12, 22, 'alienGrey').vline(13, 2, 21, 'steel').hline(2, 1, 12, 'fluoro').hline(2, 22, 12, 'steel');
    if (!open) {
      b.hline(2, 8, 12, 'steel').vline(12, 3, 4, 'slate').vline(12, 10, 6, 'slate');
      // The rota, a grid with ticks in every box.
      b.rect(4, 10, 6, 7, 'white');
      for (let y = 11; y < 17; y += 2) for (let x = 5; x < 10; x += 2) b.set(x, y, 'teal');
      b.set(6, 10, 'violet');
    } else {
      b.rect(3, 9, 10, 13, 'fluoro').hline(3, 14, 10, 'fog').hline(3, 19, 10, 'fog');
      // Identical boxes, labelled, and one milk.
      for (const [x, y] of [[4, 11], [8, 11], [4, 16], [8, 16]] as const) b.rect(x, y, 3, 3, 'skyPale').hline(x, y + 1, 3, 'bone');
      b.rect(11, 10, 2, 4, 'white').set(11, 10, 'teal');
      b.hline(2, 8, 12, 'steel').vline(12, 3, 4, 'slate');
      b.rect(0, 9, 2, 13, 'alienGrey').vline(0, 9, 13, 'steel');
    }
    b.rect(3, 23, 2, 1, 'slate').rect(11, 23, 2, 1, 'slate');
  };

const baseKettle: Draw = (b) => {
  b.rect(1, 12, 14, 2, 'steel').hline(1, 12, 14, 'fog');
  b.rect(3, 4, 6, 8, 'violet').hline(3, 4, 6, 'fluoro').vline(8, 5, 7, 'violetDark').rect(4, 3, 4, 1, 'violetDark');
  b.rect(1, 5, 2, 4, 'violetDark').rect(9, 6, 1, 2, 'violet').set(5, 7, 'teal');
  b.rect(10, 9, 2, 3, 'white').rect(13, 9, 2, 3, 'white').hline(10, 9, 2, 'fog').hline(13, 9, 2, 'fog');
  b.rect(11, 5, 3, 3, 'skyPale').hline(11, 5, 3, 'steel').set(12, 6, 'peat');
};

const lostPropertyBox =
  (glove: boolean): Draw =>
  (b) => {
    // The umbrella handle and a sock, over the back edge.
    b.vline(12, 1, 6, 'coal').set(11, 1, 'coal').set(10, 2, 'coal');
    b.rect(3, 3, 2, 4, 'motelPink').set(2, 6, 'motelPink');
    if (glove) {
      b.rect(5, 4, 6, 4, 'teal').hline(5, 7, 6, 'tealDark');
      for (const x of [5, 7, 9]) b.vline(x, 1, 3, 'teal').set(x, 1, 'fluoro');
      b.set(11, 3, 'teal').set(11, 4, 'teal').set(7, 5, 'violet');
    }
    b.rect(1, 7, 14, 8, 'tan').hline(1, 7, 14, 'sand').hline(1, 14, 14, 'tanShade').vline(14, 8, 7, 'tanShade');
    b.line(0, 7, 2, 5, 'tanShade').line(15, 7, 13, 5, 'tanShade');
    // The sticky note.
    b.rect(5, 9, 5, 4, 'amberLight').hline(6, 10, 3, 'peat').hline(6, 11, 2, 'peat').set(9, 12, 'amber');
  };

const borrowedGlove: Draw = (b) => {
  b.rect(3, 6, 9, 7, 'teal').hline(3, 6, 9, 'fluoro').hline(3, 12, 9, 'tealDark');
  for (const x of [3, 5, 7, 9]) b.rect(x, 2, 2, 4, 'teal').set(x, 2, 'fluoro');
  b.rect(12, 7, 2, 4, 'teal').rect(2, 13, 11, 2, 'violetDark');
  b.rect(6, 8, 3, 2, 'violet').set(7, 8, 'fluoro');
};

// --- Chapter 9: labs and gravity rooms ------------------------------------------

/**
 * The switch plate, its arrow pointing right: a steel plate, four screws, a violet face and a big arrow. Teal like
 * the Glove when idle; amber once thrown. It is turned whole for the other directions, so it reads on any wall.
 */
const gravitySwitchRight =
  (thrown: boolean): Draw =>
  (b) => {
    const c: ColourName = thrown ? 'amber' : 'teal';
    const hi: ColourName = thrown ? 'amberLight' : 'fluoro';
    b.rect(1, 1, 14, 14, 'steel');
    for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]] as const) b.set(x, y, thrown ? 'amberLight' : 'slate');
    b.rect(3, 3, 10, 10, thrown ? 'violet' : 'violetDark');
    b.rect(4, 7, 5, 2, c);
    for (let i = 0; i < 4; i++) b.vline(8 + i, 4 + i, 8 - i * 2, c);
    b.set(8, 4, hi).set(9, 5, hi).set(10, 6, hi);
  };

/** The plate's light comes from the top left whichever way the arrow points, so the bevel goes on after turning. */
const gravitySwitch =
  (facing: Facing, thrown: boolean): Draw =>
  (b) => {
    turned(gravitySwitchRight(thrown), facing)(b);
    b.hline(1, 1, 14, 'fog').vline(1, 2, 13, 'fog').vline(14, 2, 13, 'slate').hline(2, 14, 13, 'slate');
  };

const pressurePlate =
  (down: boolean): Draw =>
  (b) => {
    if (down) {
      b.rect(2, 2, 12, 12, 'teal').rect(3, 3, 10, 10, 'violetDark').rect(4, 4, 8, 8, 'violet');
    } else {
      b.rect(2, 2, 12, 10, 'violet').hline(2, 2, 12, 'fluoro').rect(2, 12, 12, 2, 'violetDark');
      b.rect(5, 5, 6, 4, 'violetDark');
    }
  };

const slidingCrate: Draw = (b) => {
  b.rect(1, 2, 14, 13, 'alienGrey').hline(1, 2, 14, 'fluoro').rect(1, 11, 14, 4, 'steel');
  for (const [x, y] of [[1, 2], [13, 2], [1, 13], [13, 13]] as const) b.rect(x, y, 2, 2, 'teal');
  b.rect(5, 5, 6, 3, 'bone').hline(6, 6, 4, 'violet');
};

const ledge: Draw = (b) => {
  b.rect(0, 0, 16, 11, 'teal').hline(0, 0, 16, 'fluoro');
  for (let y = 2; y < 10; y += 3) for (let x = (y * 2) % 5; x < 16; x += 5) b.set(x, y, 'tealDark');
  for (let x = 0; x < 16; x++) b.set(x, 11, Math.floor(x / 2) % 2 === 0 ? 'amber' : 'ink').set(x, 12, Math.floor((x + 1) / 2) % 2 === 0 ? 'amber' : 'ink');
  b.rect(0, 13, 16, 3, 'tealDark');
};

const hangarWindow: Draw = (b) => {
  b.rect(0, 0, 64, 32, 'steel').hline(0, 0, 64, 'fog').hline(0, 31, 64, 'slate');
  b.rect(3, 3, 58, 25, 'violetDark');
  // The hangar below: floor, markings, a light rig.
  b.rect(3, 20, 58, 8, 'tealDark');
  for (let x = 6; x < 60; x += 8) b.hline(x, 24, 4, 'amber');
  b.hline(3, 5, 58, 'coal');
  for (let x = 10; x < 60; x += 12) b.rect(x, 5, 3, 2, 'fluoro');
  // The craft: dome, disc, a band of rim lights, and the panel that is missing.
  b.ellipse(24, 9, 16, 9, 'fog').ellipse(27, 10, 6, 3, 'white');
  b.ellipse(12, 14, 40, 10, 'alienGrey').hline(14, 18, 36, 'steel').hline(16, 20, 32, 'steel');
  for (let x = 15; x < 50; x += 4) b.set(x, 18, 'violet');
  b.line(37, 16, 41, 13, 'ink').line(38, 16, 42, 13, 'ink').line(39, 16, 43, 13, 'ink').line(40, 16, 43, 14, 'ink');
  b.set(39, 15, 'amber').set(41, 14, 'alarm').set(40, 13, 'amberLight');
  b.ellipse(20, 22, 6, 2, 'ink').ellipse(38, 22, 6, 2, 'ink');
  // The glass: two reflections.
  b.line(6, 26, 14, 4, 'teal').line(8, 26, 16, 4, 'teal').line(48, 26, 55, 6, 'teal');
  b.vline(32, 3, 25, 'slate');
};

const recordsShelves =
  (taken: boolean): Draw =>
  (b) => {
    b.rect(0, 0, 32, 31, 'steel').vline(0, 0, 31, 'fog').vline(31, 0, 31, 'slate');
    for (let s = 0; s < 4; s++) {
      const y = 1 + s * 7;
      b.rect(1, y, 30, 6, 'coal').hline(1, y + 6, 30, 'fog');
      for (let k = 0; k < 6; k++) {
        if (taken && s === 2 && k === 4) continue;
        const x = 2 + k * 5;
        b.rect(x, y + 1, 4, 5, 'bone').hline(x, y + 1, 4, 'white').rect(x + 1, y + 3, 2, 1, s === 2 && k === 4 ? 'amber' : 'violet');
      }
    }
    b.rect(1, 29, 2, 2, 'slate').rect(29, 29, 2, 2, 'slate');
  };

// --- Chapter 9: containment hall ------------------------------------------------

const sealedBay: Draw = (b) => {
  for (let x = 0; x < 32; x++) for (const y of [0, 1, 30, 31]) b.set(x, y, Math.floor((x + y) / 3) % 2 === 0 ? 'amber' : 'ink');
  for (let y = 2; y < 30; y++) for (const x of [0, 1, 30, 31]) b.set(x, y, Math.floor((x + y) / 3) % 2 === 0 ? 'amber' : 'ink');
  b.rect(2, 2, 28, 28, 'slate');
  b.ellipse(4, 3, 24, 26, 'steel').ellipse(5, 4, 22, 24, 'alienGrey').hline(8, 5, 16, 'fluoro');
  b.ellipse(11, 7, 10, 10, 'ink').ellipse(12, 8, 8, 8, 'violetDark').ellipse(14, 10, 4, 4, 'violet').set(14, 9, 'fluoro');
  b.rect(9, 20, 14, 3, 'steel').rect(12, 21, 8, 1, 'teal');
  for (const [x, y] of [[7, 8], [24, 8], [7, 22], [24, 22]] as const) b.set(x, y, 'slate');
};

const doorTimer =
  (left: number): Draw =>
  (b) => {
    const low = left <= 2;
    b.rect(1, 4, 14, 8, 'coal').hline(1, 4, 14, 'slate').hline(1, 11, 14, 'ink');
    b.rect(7, 2, 2, 2, low && left > 0 ? 'alarm' : 'slate');
    for (let i = 0; i < 6; i++) b.rect(2 + i * 2, 6, 1, 4, i < left ? (low ? 'alarm' : 'teal') : 'ink');
  };

const queueBarrier: Draw = (b) => {
  for (const x of [2, 26]) {
    b.rect(x + 1, 3, 2, 10, 'fog').vline(x + 1, 3, 10, 'white').rect(x, 1, 4, 2, 'steel').ellipse(x - 1, 12, 6, 3, 'coal');
  }
  b.rect(5, 4, 21, 2, 'violet').hline(5, 4, 21, 'fluoro');
};

const wallRecorder =
  (state: 'tape' | 'empty', frame: number): Draw =>
  (b) => {
    b.rect(1, 1, 14, 20, 'alienGrey').hline(1, 1, 14, 'fluoro').vline(14, 2, 19, 'steel');
    b.rect(3, 4, 10, 8, 'ink');
    if (state === 'tape') {
      b.rect(4, 5, 8, 6, 'coal').rect(5, 6, 6, 1, 'bone');
      for (const cx of [5, 9]) {
        b.ellipse(cx, 7, 3, 3, 'fog').set(cx + 1, 8, 'ink');
        b.set(cx + (frame === 0 ? 1 : 0), 7 + (frame === 0 ? 0 : 1), 'slate');
      }
      b.rect(11, 14, 2, 2, 'alarm');
    } else {
      // The door hung open to the right, the bay empty.
      b.rect(13, 4, 2, 8, 'steel').set(15, 6, 'fog');
      b.rect(11, 14, 2, 2, 'coal');
    }
    b.rect(3, 14, 6, 1, 'steel').rect(3, 16, 6, 1, 'steel').rect(3, 18, 3, 1, 'teal');
    b.rect(5, 21, 6, 2, 'steel');
  };

const liftDoors =
  (open: boolean): Draw =>
  (b) => {
    b.rect(0, 0, 32, 32, 'steel').hline(0, 0, 32, 'fog');
    b.rect(10, 1, 8, 3, 'violetDark').set(13, 2, 'amberLight').set(14, 2, 'amberLight');
    b.rect(2, 5, 24, 27, 'slate');
    if (open) {
      b.rect(5, 6, 18, 26, 'violetDark').hline(5, 6, 18, 'fluoro').rect(5, 26, 18, 6, 'violet');
      b.rect(3, 6, 2, 26, 'fog').rect(23, 6, 2, 26, 'fog');
      b.hline(6, 18, 16, 'steel');
    } else {
      b.rect(3, 6, 11, 26, 'fog').rect(14, 6, 11, 26, 'fog').vline(14, 6, 26, 'ink').vline(3, 6, 26, 'white').vline(15, 6, 26, 'white');
      b.vline(24, 6, 26, 'steel').vline(13, 6, 26, 'steel');
    }
    // The call panel.
    b.rect(27, 12, 4, 9, 'coal').rect(28, 13, 2, 2, 'teal').rect(28, 17, 2, 2, 'slate');
  };

const liftGuardChair =
  (onBreak: boolean): Draw =>
  (b) => {
    b.rect(4, 1, 8, 6, 'teal').hline(4, 1, 8, 'fluoro').vline(11, 2, 5, 'tealDark');
    b.rect(3, 8, 10, 3, 'teal').hline(3, 10, 10, 'tealDark');
    b.rect(7, 7, 2, 1, 'steel').rect(7, 11, 2, 2, 'steel');
    b.line(7, 13, 3, 14, 'slate').line(8, 13, 12, 14, 'slate').vline(8, 13, 2, 'slate');
    if (onBreak) b.rect(5, 5, 6, 5, 'white').hline(5, 9, 6, 'fog').rect(7, 6, 2, 2, 'peat').set(9, 6, 'peat');
  };

// --- Chapter 9: the proofs ------------------------------------------------------

const PROOF_DRAW: Readonly<Record<ProofId, Draw>> = {
  craft: (b) => {
    b.rect(2, 3, 12, 10, 'white').rect(3, 4, 10, 7, 'violetDark');
    b.ellipse(6, 5, 4, 3, 'fog').ellipse(3, 7, 10, 3, 'alienGrey').set(10, 7, 'ink').set(11, 8, 'ink');
    b.line(4, 10, 6, 4, 'violet');
    b.hline(3, 12, 6, 'fog');
  },
  contract: (b) => {
    b.rect(4, 2, 9, 12, 'fog').rect(3, 1, 9, 12, 'white');
    for (const y of [3, 5, 7]) b.hline(4, y, y === 7 ? 5 : 7, 'slate');
    b.line(4, 10, 6, 9, 'ink').set(7, 10, 'ink').line(8, 10, 10, 9, 'teal').set(10, 10, 'teal');
    b.rect(10, 1, 2, 1, 'steel').rect(4, 1, 2, 1, 'steel');
  },
  directory: (b) => {
    b.rect(1, 3, 14, 10, 'violetDark').rect(2, 3, 5, 9, 'white').rect(9, 3, 5, 9, 'white').vline(8, 3, 9, 'violet');
    for (const [x, y, c] of [[3, 4, 'alienGrey'], [5, 4, 'alienGrey'], [3, 8, 'alienGrey'], [5, 8, 'alienGrey'], [10, 4, 'alienGrey'], [12, 4, 'lime'], [10, 8, 'alienGrey'], [12, 8, 'alienGrey']] as const) {
      b.set(x, y, c).set(x, y + 1, 'ink').set(x, y + 2, 'fog');
    }
  },
  log: (b) => {
    b.rect(3, 2, 10, 12, 'bone').rect(6, 1, 4, 2, 'steel');
    for (let y = 4; y < 13; y += 2) b.hline(4, y, 8, y === 10 ? 'amber' : 'fog');
    b.vline(7, 4, 9, 'fog');
    b.ellipse(3, 9, 10, 3, null).hline(4, 10, 8, 'amber').set(3, 10, 'amberLight').set(12, 10, 'amberLight');
    b.vline(3, 2, 12, 'bone');
  },
  footage: (b) => {
    b.rect(1, 4, 14, 8, 'coal').hline(1, 4, 14, 'slate').hline(1, 11, 14, 'ink');
    b.rect(3, 5, 10, 2, 'bone').hline(4, 5, 5, 'violet');
    b.rect(4, 8, 2, 2, 'fog').rect(10, 8, 2, 2, 'fog').hline(6, 9, 4, 'slate');
  },
};

// --- Chapter 10: anteroom -------------------------------------------------------

const drinksCabinet: Draw = (b) => {
  b.rect(1, 1, 30, 29, 'peat').hline(1, 1, 30, 'tan').vline(30, 2, 28, 'turfDark');
  // Dust along the top.
  for (let x = 2; x < 30; x += 3) b.set(x, 2, 'fog');
  b.rect(3, 4, 26, 15, 'turfDark');
  // Three decanters on a tray.
  b.rect(4, 15, 24, 2, 'fog').hline(4, 15, 24, 'white');
  const decanter = (x: number, liquid: ColourName, top: number): void => {
    b.rect(x + 1, 6, 2, 2, 'fog').set(x + 1, 5, 'white');
    b.rect(x, 8, 4, 7, 'skyPale').rect(x, top, 4, 15 - top, liquid).vline(x, 8, 7, 'white');
  };
  decanter(7, 'amber', 10);
  decanter(14, 'amberLight', 11);
  decanter(21, 'peat', 9);
  // The glass doors, open a little, and the cupboard underneath.
  b.vline(3, 4, 15, 'tan').vline(16, 4, 15, 'tan').vline(28, 4, 15, 'tan');
  b.rect(3, 20, 26, 9, 'turf').vline(16, 20, 9, 'turfDark').set(14, 24, 'amberLight').set(18, 24, 'amberLight');
  b.rect(2, 30, 3, 2, 'turfDark').rect(27, 30, 3, 2, 'turfDark');
};

const waitingChairs: Draw = (b) => {
  b.rect(1, 12, 46, 2, 'steel').hline(1, 12, 46, 'fog');
  for (const x of [1, 17, 33]) {
    b.rect(x + 1, 1, 12, 6, 'violet').hline(x + 1, 1, 12, 'fluoro').vline(x + 12, 2, 5, 'violetDark');
    b.rect(x, 7, 14, 4, 'violet').hline(x, 10, 14, 'violetDark');
  }
  b.rect(3, 14, 2, 2, 'slate').rect(43, 14, 2, 2, 'slate').rect(23, 14, 2, 2, 'slate');
};

const baseTicketMachine: Draw = (b) => {
  b.rect(3, 0, 10, 4, 'coal').rect(4, 1, 8, 2, 'ink').rect(5, 1, 2, 2, 'amber').rect(8, 1, 2, 2, 'amber');
  b.rect(2, 5, 12, 9, 'teal').hline(2, 5, 12, 'fluoro').vline(13, 6, 8, 'tealDark');
  b.rect(5, 7, 6, 2, 'ink').rect(6, 9, 4, 3, 'white').hline(6, 11, 4, 'fog');
  b.rect(7, 14, 2, 8, 'steel').vline(7, 14, 8, 'fog');
  b.rect(4, 22, 8, 2, 'slate');
};

const DIGITS: Readonly<Record<string, readonly string[]>> = {
  '8': ['###', '#.#', '###', '#.#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
};

const ticket848: Draw = (b) => {
  b.rect(2, 4, 12, 9, 'white').hline(2, 12, 12, 'fog');
  for (let x = 2; x < 14; x += 2) b.set(x, 4, null);
  ['8', '4', '8'].forEach((d, i) => b.stamp(3 + i * 4, 6, DIGITS[d] ?? [], { '#': 'ink' }));
  b.hline(3, 12, 4, 'teal');
};

const pottedPlant: Draw = (b) => {
  b.rect(5, 16, 6, 7, 'violet').hline(4, 16, 8, 'violetDark').vline(10, 17, 6, 'violetDark');
  b.vline(7, 6, 10, 'mossDark').vline(8, 6, 10, 'mossDark');
  // Leaves in mirrored pairs, exactly.
  const leaf = (x: number, y: number): void => void b.rect(x, y, 3, 2, 'grass').set(x + (x < 8 ? 0 : 2), y, 'moss');
  for (const [dx, y] of [[1, 3], [2, 7], [1, 11]] as const) {
    leaf(7 - dx - 3, y);
    leaf(8 + dx + 1, y);
  }
  b.rect(6, 1, 4, 3, 'grass').hline(7, 1, 2, 'fog');
};

const receptionDesk: Draw = (b) => {
  b.rect(30, 1, 10, 6, 'violet').hline(30, 1, 10, 'fluoro');
  b.rect(16, 2, 10, 7, 'coal').rect(20, 9, 2, 1, 'slate');
  b.rect(0, 9, 48, 4, 'alienGrey').hline(0, 9, 48, 'fluoro');
  b.rect(1, 13, 46, 9, 'violetDark');
  for (let x = 6; x < 46; x += 8) b.vline(x, 13, 9, 'violet');
  b.ellipse(5, 6, 5, 4, 'fog').rect(5, 9, 5, 1, 'steel').set(7, 5, 'white');
  b.rect(36, 10, 8, 2, 'bone').hline(37, 10, 5, 'violet');
  b.rect(1, 22, 2, 2, 'slate').rect(45, 22, 2, 2, 'slate');
};

// --- Chapter 10: control room ---------------------------------------------------

const adminDesk: Draw = (b) => {
  b.rect(0, 12, 48, 6, 'violetDark').hline(0, 12, 48, 'violet').hline(0, 17, 48, 'ink');
  b.rect(1, 18, 46, 12, 'violetDark');
  b.rect(3, 20, 12, 8, 'ink').rect(33, 20, 12, 8, 'ink').rect(4, 21, 10, 6, 'violetDark').rect(34, 21, 10, 6, 'violetDark');
  b.rect(8, 23, 2, 1, 'teal').rect(38, 23, 2, 1, 'teal');
  b.rect(1, 30, 3, 2, 'ink').rect(44, 30, 3, 2, 'ink');
  // The lamp.
  b.rect(2, 4, 6, 3, 'amberLight').hline(2, 4, 6, 'white').vline(4, 7, 5, 'steel').rect(3, 11, 4, 1, 'steel');
  // The stamp rack: three stamps, one out.
  b.rect(10, 9, 10, 3, 'steel').hline(10, 9, 10, 'fog');
  for (const x of [11, 14]) b.rect(x, 5, 2, 4, 'coal').rect(x - 0, 4, 2, 1, 'violet');
  b.rect(17, 7, 2, 2, 'coal');
  // One form, squared to the edge, and a pen beside it.
  b.rect(23, 9, 9, 3, 'white').hline(24, 10, 6, 'fog').line(33, 11, 36, 9, 'teal');
  // The name block.
  b.rect(38, 8, 8, 4, 'steel').hline(38, 8, 8, 'fog').rect(39, 10, 6, 1, 'bone');
};

const deskShield =
  (frame: number): Draw =>
  (b) => {
    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 64; x++) {
        const nx = (x - 31.5) / 32;
        const ny = (y - 44) / 44;
        const d = nx * nx + ny * ny;
        if (d > 1) continue;
        if (d > 0.9) b.set(x, y, (x + frame) % 2 === 0 ? 'fluoro' : 'teal');
        else if ((y + frame * 2) % 4 === 0 && (x + y) % 2 === 0) b.set(x, y, 'teal');
      }
    }
  };

/** One small screen of the wall, 15 x 11, at x, y. */
const screen = (b: PixelBuffer, x: number, y: number, kind: number, frame: number): void => {
  b.rect(x, y, 15, 11, 'coal').rect(x + 1, y + 1, 13, 9, 'ink');
  const ix = x + 2;
  const iy = y + 2;
  switch (kind) {
    case 0: // A bar chart, steady.
      [3, 5, 4, 6, 2].forEach((h, i) => b.rect(ix + i * 2 + 1, iy + 7 - h, 1, h, 'teal'));
      break;
    case 1: // A line chart that wobbles.
      for (let i = 0; i < 11; i++) b.set(ix + i, iy + 3 + Math.round(Math.sin(i + frame) * 2), 'violet');
      break;
    case 2: // A map with dots.
      b.rect(ix, iy, 11, 7, 'tealDark').rect(ix + 2, iy + 1, 4, 3, 'teal').rect(ix + 7, iy + 3, 3, 3, 'teal');
      b.set(ix + 3 + frame, iy + 2, 'amberLight');
      break;
    case 3: // A field, and a ring on it.
      b.rect(ix, iy, 11, 7, 'moss').hline(ix, iy + 3, 11, 'mossDark');
      b.ellipse(ix + 3, iy + 1, 5, 5, 'alarm').ellipse(ix + 4, iy + 2, 3, 3, frame === 0 ? 'moss' : 'mossDark');
      break;
    case 4: // A camera view of a corridor.
      b.rect(ix, iy, 11, 7, 'tealDark').line(ix, iy + 6, ix + 4, iy + 2, 'teal').line(ix + 10, iy + 6, ix + 6, iy + 2, 'teal');
      if (frame === 1) b.set(ix + 5, iy + 4, 'alienGrey').set(ix + 5, iy + 5, 'bone');
      b.set(ix + 10, iy, 'alarm');
      break;
    case 5: // Columns of figures.
      for (let r = 0; r < 4; r++) b.hline(ix + (r % 2), iy + r * 2, 7 + ((r + frame) % 3), 'fluoro');
      break;
    case 6: // A pie.
      b.ellipse(ix + 2, iy, 7, 7, 'violet').rect(ix + 5, iy, 4, 4, 'teal').set(ix + 5, iy + 3, 'violet');
      break;
    default: // A queue counter, two amber blocks.
      b.rect(ix + 2, iy + 2, 3, 3, 'amber').rect(ix + 6, iy + 2, 3, 3, frame === 0 ? 'amber' : 'amberLight');
  }
};

const screenWall =
  (frame: number): Draw =>
  (b) => {
    b.rect(0, 0, 64, 32, 'slate').hline(0, 0, 64, 'steel').hline(0, 31, 64, 'coal');
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) screen(b, 1 + c * 16 - (c === 0 ? 0 : 0), 3 + r * 14, r * 4 + c, frame);
  };

/** The 6 x 6 mask of a socket shape. */
const shapeMask = (shape: SocketShape): PixelBuffer => {
  const m = new PixelBuffer(6, 6);
  switch (shape) {
    case 'circle':
      m.ellipse(0, 0, 6, 6, 'ink');
      break;
    case 'square':
      m.rect(0, 0, 6, 6, 'ink');
      break;
    case 'notched':
      m.rect(0, 0, 6, 6, 'ink').set(5, 0, null).set(4, 0, null).set(5, 1, null);
      break;
    case 'triangle':
      for (let j = 0; j < 6; j++) {
        const half = Math.floor(j / 2) + 1;
        m.hline(3 - half, j, half * 2, 'ink');
      }
      break;
    case 'twinHole':
      m.rect(0, 1, 2, 4, 'ink').rect(4, 1, 2, 4, 'ink');
      break;
  }
  return m;
};

/** Draw a shape mask scaled by `s` at x, y in one colour. */
const drawShape = (b: PixelBuffer, shape: SocketShape, x: number, y: number, s: number, c: ColourName): void => {
  const m = shapeMask(shape);
  for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) if (m.get(i, j) !== null) b.rect(x + i * s, y + j * s, s, s, c);
};

const socket =
  (shape: SocketShape, lamp: ColourName = 'coal'): Draw =>
  (b) => {
    b.rect(2, 1, 12, 14, 'slate').hline(2, 1, 12, 'steel').hline(2, 14, 12, 'coal');
    b.rect(7, 2, 2, 2, lamp);
    b.rect(4, 5, 8, 8, 'coal');
    drawShape(b, shape, 5, 6, 1, 'ink');
  };

const socketCloseup =
  (shape: SocketShape): Draw =>
  (b) => {
    b.rect(0, 0, 32, 32, 'slate').hline(0, 0, 32, 'steel').vline(0, 0, 32, 'steel').hline(0, 31, 32, 'coal').vline(31, 0, 32, 'coal');
    b.rect(5, 5, 22, 22, 'coal').hline(5, 5, 22, 'ink');
    drawShape(b, shape, 7, 7, 3, 'ink');
    // The rim catches the light along the top and left of the hole.
    const m = new PixelBuffer(32, 32);
    drawShape(m, shape, 7, 7, 3, 'ink');
    for (let y = 1; y < 31; y++) for (let x = 1; x < 31; x++) if (m.get(x, y) !== null && (m.get(x - 1, y) === null || m.get(x, y - 1) === null)) b.set(x, y, 'steel');
    b.rect(14, 1, 4, 3, 'coal');
  };

const PLUG_CAP: Readonly<Record<ProofId, ColourName>> = { craft: 'fog', contract: 'bone', directory: 'violet', log: 'amber', footage: 'coal' };

const plug =
  (proof: ProofId): Draw =>
  (b) => {
    // Cap on top with the shape raised on its face, a neck, and the cord hanging straight down.
    b.vline(7, 12, 4, 'coal').vline(8, 12, 4, 'coal');
    b.rect(6, 10, 4, 2, 'steel').hline(6, 10, 4, 'fog');
    b.rect(3, 1, 10, 9, PLUG_CAP[proof]).hline(3, 1, 10, 'white').hline(3, 9, 10, 'steel').vline(12, 2, 7, 'steel');
    drawShape(b, PROOF_SOCKET[proof], 5, 2, 1, proof === 'footage' ? 'fog' : 'steel');
  };

const plugSeated =
  (proof: ProofId): Draw =>
  (b) => {
    socket(PROOF_SOCKET[proof], 'teal')(b);
    b.set(7, 2, 'fluoro');
    b.rect(4, 5, 8, 8, PLUG_CAP[proof]).hline(4, 5, 8, 'white').hline(4, 12, 8, 'steel');
    drawShape(b, PROOF_SOCKET[proof], 5, 6, 1, proof === 'footage' ? 'fog' : 'steel');
    b.line(8, 13, 10, 15, 'coal');
  };

const broadcastConsole: Draw = (b) => {
  b.rect(0, 4, 80, 26, 'violetDark').hline(0, 4, 80, 'violet');
  b.rect(1, 6, 78, 20, 'alienGrey').hline(1, 6, 78, 'fluoro').hline(1, 25, 78, 'steel');
  b.rect(30, 0, 20, 5, 'steel').hline(30, 0, 20, 'fog').rect(33, 1, 14, 3, 'ink').rect(34, 2, 12, 1, 'teal');
  for (const s of CONSOLE_SOCKETS) {
    const cell = new PixelBuffer(16, 16);
    socket(s.shape)(cell);
    b.blit(cell, s.x, s.y);
  }
  for (let x = 4; x < 78; x += 15) b.rect(x + 2, 27, 8, 1, 'teal');
  b.rect(2, 30, 4, 2, 'ink').rect(74, 30, 4, 2, 'ink');
};

const bigButton =
  (state: 'covered' | 'ready' | 'pressed'): Draw =>
  (b) => {
    b.rect(6, 12, 4, 10, 'steel').vline(6, 12, 10, 'fog').rect(3, 22, 10, 2, 'slate');
    b.rect(2, 8, 12, 5, 'coal').hline(2, 8, 12, 'slate');
    if (state === 'pressed') {
      b.ellipse(3, 6, 10, 4, 'amberLight').ellipse(4, 7, 8, 3, 'alarm');
    } else {
      b.ellipse(3, 3, 10, 7, 'alarm').ellipse(4, 3, 5, 3, 'white').hline(4, 8, 8, 'brickDark');
    }
    if (state === 'covered') {
      b.rect(2, 2, 12, 7, null);
      b.ellipse(3, 3, 10, 7, 'alarm').hline(4, 8, 8, 'brickDark');
      // A clear cover: just its edges and a glint.
      b.hline(2, 1, 12, 'fluoro').vline(1, 2, 7, 'fluoro').vline(14, 2, 7, 'fluoro').line(4, 3, 6, 2, 'white');
    } else if (state === 'ready') {
      b.rect(3, 0, 10, 1, 'fluoro').set(2, 1, 'fluoro').set(13, 1, 'fluoro');
    }
  };

/** A right-pointing floor chevron, 16 x 16. */
const gravityArrowRight =
  (frame: number): Draw =>
  (b) => {
    const pts: [number, number][] = [];
    for (let i = 0; i < 6; i++) {
      pts.push([4 + i, 2 + i], [4 + i, 13 - i]);
      pts.push([5 + i, 2 + i], [5 + i, 13 - i]);
    }
    for (const [x, y] of pts) b.set(x, y, frame === 0 ? 'violet' : 'amber');
    if (frame === 1) for (const [x, y] of pts) b.set(x + 2, y, 'amberLight');
    else b.set(10, 7, 'fluoro').set(10, 8, 'fluoro');
  };

const stampRow =
  (frame: number): Draw =>
  (b) => {
    if (frame === 0) {
      for (let x = 0; x < 16; x += 4) b.hline(x, 1, 2, 'violet').hline(x, 14, 2, 'violet');
      b.rect(5, 5, 6, 6, 'violetDark').rect(6, 6, 4, 4, null).set(7, 7, 'violetDark').set(8, 8, 'violetDark');
    } else {
      b.hline(0, 1, 16, 'amber').hline(0, 14, 16, 'amber');
      b.rect(5, 5, 6, 6, 'amberLight').rect(6, 6, 4, 4, null).set(7, 7, 'amberLight').set(8, 8, 'amberLight');
    }
  };

/** Speed lines trailing left, for something moving right. */
const slideStreakRight: Draw = (b) => {
  b.hline(0, 4, 9, 'fog').hline(3, 7, 10, 'white').hline(1, 10, 8, 'fog').hline(5, 12, 6, 'fog');
};

const coatHook =
  (jacket: boolean): Draw =>
  (b) => {
    b.rect(6, 0, 4, 3, 'steel').hline(6, 0, 4, 'fog').vline(8, 3, 2, 'steel').set(7, 5, 'steel');
    b.hline(3, 6, 10, 'peat').set(2, 7, 'peat').set(13, 7, 'peat').hline(3, 6, 10, 'tan');
    if (jacket) {
      b.rect(2, 7, 12, 15, 'violetDark').hline(2, 7, 12, 'violet').vline(2, 8, 14, 'violet');
      b.line(6, 7, 8, 13, 'ink').line(10, 7, 8, 13, 'ink').rect(7, 7, 3, 1, 'bone');
      b.set(8, 15, 'teal').set(8, 18, 'teal').hline(3, 21, 10, 'ink');
      b.rect(10, 11, 3, 1, 'white');
    }
  };

// --- Chapter 10: Feeney's in daylight -------------------------------------------

/** The telly's set, as `PROP.telly` draws it, with a picture inside the 12 x 8 screen at (2, 3). */
const tellyOn =
  (picture: (b: PixelBuffer) => void): Draw =>
  (b) => {
    b.rect(1, 2, 14, 10, 'coal').rect(2, 3, 12, 8, 'dustyBlue').rect(6, 12, 4, 2, 'slate');
    picture(b);
    b.set(13, 10, 'alarm');
  };

const TELLY: Readonly<Record<'weather' | 'bins' | 'aliens' | 'proofs', (b: PixelBuffer) => void>> = {
  weather: (b) => {
    b.rect(2, 3, 12, 8, 'skyPale').ellipse(3, 4, 7, 4, 'white').ellipse(6, 3, 6, 4, 'white').hline(4, 7, 6, 'fog');
    for (const [x, y] of [[4, 9], [7, 8], [9, 10], [11, 9]] as const) b.set(x, y, 'dustyBlue');
    b.ellipse(10, 3, 4, 4, 'amberLight');
  },
  bins: (b) => {
    b.rect(2, 3, 12, 8, 'skyPale').rect(2, 9, 12, 2, 'slate');
    b.rect(3, 5, 6, 4, 'moss').rect(9, 6, 4, 3, 'white').rect(10, 6, 2, 1, 'dustyBlue');
    b.set(4, 9, 'ink').set(11, 9, 'ink').rect(3, 4, 2, 1, 'mossDark');
  },
  aliens: (b) => {
    b.rect(2, 3, 12, 8, 'violetDark').ellipse(5, 3, 6, 6, 'alienGrey').set(6, 5, 'ink').set(9, 5, 'ink').rect(6, 9, 4, 2, 'bone').set(7, 9, 'violet');
    b.hline(2, 10, 3, 'alarm');
  },
  proofs: (b) => {
    b.rect(2, 3, 12, 8, 'ink');
    const tiles: ColourName[] = ['fog', 'white', 'lime', 'amber', 'slate'];
    tiles.forEach((c, i) => b.rect(3 + (i % 3) * 4, 4 + Math.floor(i / 3) * 4, 3, 3, c));
  },
};

const sunShaft: Draw = (b) => {
  for (let y = 0; y < 32; y++) {
    const x0 = Math.floor(y * 0.6);
    for (let x = x0; x < x0 + 12 && x < 32; x++) if ((x + y) % 2 === 0 || (y < 16 && x % 3 === 0)) b.set(x, y, y < 20 ? 'white' : 'amberLight');
  }
};

// --- Chapter 10: reaction cards -------------------------------------------------

/** A card picture: a background with no outline, then outlined things in front. */
const card =
  (bg: Draw, fg: Draw): Draw =>
  (b) => {
    bg(b);
    outlined(fg)(b);
  };

const REACTION: Readonly<Record<keyof typeof PROP_C910.reactionCard, Draw>> = {
  governments: card(
    (b) => {
      b.rect(0, 0, 64, 40, 'navyDark');
      for (let x = 2; x < 64; x += 5) b.vline(x, 0, 32, 'navy');
      b.rect(0, 32, 64, 8, 'slate');
    },
    (b) => {
      b.ellipse(50, 3, 9, 9, 'white').vline(54, 5, 3, 'ink').hline(54, 7, 2, 'ink');
      b.rect(22, 18, 20, 16, 'steel').hline(22, 18, 20, 'fog').rect(26, 22, 12, 6, 'slate');
      for (const [x, y] of [[24, 12], [28, 10], [31, 9], [34, 10], [38, 12], [26, 14], [36, 14]] as const) {
        b.line(32, 18, x, y, 'coal').rect(x - 1, y - 1, 2, 2, 'coal');
      }
    },
  ),
  news: card(
    (b) => {
      b.rect(0, 0, 64, 40, 'skyPale').rect(0, 30, 64, 10, 'slate').hline(0, 30, 64, 'steel');
    },
    (b) => {
      b.rect(6, 12, 30, 16, 'moss').hline(6, 12, 30, 'grass').hline(6, 27, 30, 'mossDark');
      b.rect(36, 16, 12, 12, 'white').rect(38, 18, 7, 4, 'dustyBlue').hline(36, 27, 12, 'fog');
      b.ellipse(10, 25, 7, 7, 'ink').ellipse(26, 25, 7, 7, 'ink').ellipse(39, 25, 7, 7, 'ink');
      b.set(12, 27, 'steel').set(28, 27, 'steel').set(41, 27, 'steel');
      b.rect(52, 20, 7, 10, 'moss').hline(51, 19, 9, 'mossDark').rect(52, 14, 3, 5, 'bone').rect(55, 16, 3, 3, 'tan');
    },
  ),
  video: card(
    (b) => {
      b.rect(0, 0, 64, 40, 'coal');
    },
    (b) => {
      b.rect(4, 3, 56, 24, 'ink').rect(5, 4, 54, 20, 'moss').rect(5, 16, 54, 8, 'mossDark');
      for (let i = 0; i < 6; i++) b.vline(29 + i, 8 + i, 12 - i * 2, 'white');
      b.hline(5, 25, 54, 'slate').hline(5, 25, 3, 'alarm');
      b.rect(4, 29, 56, 9, 'white').rect(6, 31, 5, 5, 'lime').set(7, 33, 'ink').set(9, 33, 'ink');
      b.rect(13, 32, 6, 1, 'slate').rect(13, 34, 4, 1, 'slate');
    },
  ),
  colleenAnn: card(
    (b) => {
      b.rect(0, 0, 64, 40, 'turfDark');
      for (let x = 4; x < 64; x += 8) b.rect(x, 4, 3, 10, x % 16 === 4 ? 'amber' : 'moss');
      b.hline(0, 14, 64, 'peat');
    },
    (b) => {
      b.ellipse(27, 12, 10, 9, 'amber').ellipse(28, 15, 8, 8, 'skin').set(30, 18, 'ink').set(33, 18, 'ink').hline(31, 21, 2, 'skinShade');
      b.rect(26, 23, 12, 9, 'grass').hline(26, 23, 12, 'moss');
      b.rect(38, 14, 2, 9, 'skin').set(38, 13, 'skinLight');
      b.rect(0, 30, 64, 10, 'peat').hline(0, 30, 64, 'tan');
      b.rect(10, 25, 4, 5, 'amberLight').hline(10, 25, 4, 'white').rect(48, 25, 4, 5, 'amberLight').hline(48, 25, 4, 'white');
    },
  ),
  lake: card(
    (b) => {
      b.rect(0, 0, 64, 40, 'skyPale').rect(0, 12, 64, 4, 'mossDark').rect(0, 16, 64, 16, 'dustyBlue').rect(0, 32, 64, 8, 'grass');
      for (const [x, y, w] of [[6, 20, 6], [30, 24, 8], [48, 19, 5]] as const) b.hline(x, y, w, 'skyPale');
      b.ellipse(40, 2, 8, 8, 'white');
    },
    (b) => {
      // The folding chair from Gate C, him in it from behind: grey hair, a neck, slate shoulders over the navy back.
      b.rect(16, 18, 14, 9, 'navy').hline(16, 18, 14, 'dustyBlue').line(17, 27, 28, 34, 'steel').line(28, 27, 17, 34, 'steel');
      b.rect(15, 15, 16, 4, 'slate').hline(15, 15, 16, 'steel');
      b.rect(22, 15, 2, 2, 'skinShade').ellipse(18, 6, 10, 10, 'fog').hline(20, 7, 5, 'white');
      b.rect(34, 30, 7, 5, 'coal').rect(35, 31, 3, 3, 'slate').vline(40, 26, 4, 'steel');
      for (const x of [4, 7, 56, 59]) b.vline(x, 27, 6, 'moss');
    },
  ),
};

/** [name, width, height, drawing]. Sizes are the contract; do not change one here alone. */
const DRAWINGS: readonly (readonly [string, number, number, Draw])[] = [
  [PROP_C910.baseDesk.tidy, 32, 24, outlined(baseDesk('tidy'))],
  [PROP_C910.baseDesk.seated, 32, 24, outlined(baseDesk('seated'))],
  [PROP_C910.baseDesk.empty, 32, 24, outlined(baseDesk('empty'))],
  [PROP_C910.officeChair, 16, 16, outlined(officeChair)],
  ...PROP_C910.baseWaterCooler.map((name, i) => [name, 16, 24, outlined(baseWaterCooler(i))] as const),
  [PROP_C910.kitchenette, 48, 24, outlined(kitchenette)],
  [PROP_C910.baseFilingCabinet.shut, 16, 24, outlined(baseFilingCabinet(false))],
  [PROP_C910.baseFilingCabinet.open, 16, 24, outlined(baseFilingCabinet(true))],
  [PROP_C910.staffNoticeboard.full, 32, 24, outlined(staffNoticeboard(false))],
  [PROP_C910.staffNoticeboard.taken, 32, 24, outlined(staffNoticeboard(true))],
  ...PROP_C910.doorPlate.map((name, i) => [name, 16, 16, outlined(doorPlate(i))] as const),
  [PROP_C910.baseDartboard, 16, 24, outlined(baseDartboard)],
  [PROP_C910.partySignUp, 16, 24, outlined(partySignUp)],
  [PROP_C910.baseFridge.shut, 16, 24, outlined(baseFridge(false))],
  [PROP_C910.baseFridge.open, 16, 24, outlined(baseFridge(true))],
  [PROP_C910.baseKettle, 16, 16, outlined(baseKettle)],
  [PROP_C910.lostPropertyBox.withGlove, 16, 16, outlined(lostPropertyBox(true))],
  [PROP_C910.lostPropertyBox.empty, 16, 16, outlined(lostPropertyBox(false))],
  [PROP_C910.borrowedGlove, 16, 16, outlined(borrowedGlove)],
  ...FACINGS.map((f) => [PROP_C910.gravitySwitch[f], 16, 16, outlined(gravitySwitch(f, false))] as const),
  ...FACINGS.map((f) => [PROP_C910.gravitySwitch.thrown[f], 16, 16, outlined(gravitySwitch(f, true))] as const),
  [PROP_C910.pressurePlate.up, 16, 16, pressurePlate(false)],
  [PROP_C910.pressurePlate.down, 16, 16, pressurePlate(true)],
  [PROP_C910.slidingCrate, 16, 16, outlined(slidingCrate)],
  [PROP_C910.ledge, 16, 16, ledge],
  [PROP_C910.hangarWindow, 64, 32, outlined(hangarWindow)],
  [PROP_C910.recordsShelves.full, 32, 32, outlined(recordsShelves(false))],
  [PROP_C910.recordsShelves.taken, 32, 32, outlined(recordsShelves(true))],
  [PROP_C910.sealedBay, 32, 32, sealedBay],
  ...PROP_C910.doorTimer.map((name, i) => [name, 16, 16, outlined(doorTimer(i))] as const),
  [PROP_C910.queueBarrier, 32, 16, outlined(queueBarrier)],
  ...PROP_C910.wallRecorder.tape.map((name, i) => [name, 16, 24, outlined(wallRecorder('tape', i))] as const),
  [PROP_C910.wallRecorder.empty, 16, 24, outlined(wallRecorder('empty', 0))],
  [PROP_C910.liftDoors.shut, 32, 32, outlined(liftDoors(false))],
  [PROP_C910.liftDoors.open, 32, 32, outlined(liftDoors(true))],
  [PROP_C910.liftGuardChair.chair, 16, 16, outlined(liftGuardChair(false))],
  [PROP_C910.liftGuardChair.onBreak, 16, 16, outlined(liftGuardChair(true))],
  ...PROOFS.map((p) => [PROP_C910.proof[p], 16, 16, outlined(PROOF_DRAW[p])] as const),
  [PROP_C910.drinksCabinet, 32, 32, outlined(drinksCabinet)],
  [PROP_C910.waitingChairs, 48, 16, outlined(waitingChairs)],
  [PROP_C910.baseTicketMachine, 16, 24, outlined(baseTicketMachine)],
  [PROP_C910.ticket848, 16, 16, outlined(ticket848)],
  [PROP_C910.pottedPlant, 16, 24, outlined(pottedPlant)],
  [PROP_C910.receptionDesk, 48, 24, outlined(receptionDesk)],
  [PROP_C910.adminDesk, 48, 32, outlined(adminDesk)],
  ...PROP_C910.deskShield.map((name, i) => [name, 64, 48, deskShield(i)] as const),
  ...PROP_C910.screenWall.map((name, i) => [name, 64, 32, outlined(screenWall(i))] as const),
  [PROP_C910.broadcastConsole, 80, 32, outlined(broadcastConsole)],
  ...SOCKET_SHAPES.map((s) => [PROP_C910.socket[s], 16, 16, socket(s)] as const),
  ...SOCKET_SHAPES.map((s) => [PROP_C910.socketCloseup[s], 32, 32, socketCloseup(s)] as const),
  ...PROOFS.map((p) => [PROP_C910.plug[p], 16, 16, outlined(plug(p))] as const),
  ...PROOFS.map((p) => [PROP_C910.plugSeated[p], 16, 16, plugSeated(p)] as const),
  [PROP_C910.bigButton.covered, 16, 24, outlined(bigButton('covered'))],
  [PROP_C910.bigButton.ready, 16, 24, outlined(bigButton('ready'))],
  [PROP_C910.bigButton.pressed, 16, 24, outlined(bigButton('pressed'))],
  ...FACINGS.flatMap((f) => PROP_C910.gravityArrow[f].map((name, i) => [name, 16, 16, turned(gravityArrowRight(i), f)] as const)),
  ...PROP_C910.stampRow.map((name, i) => [name, 16, 16, stampRow(i)] as const),
  ...FACINGS.map((f) => [PROP_C910.slideStreak[f], 16, 16, turned(slideStreakRight, f)] as const),
  [PROP_C910.coatHook.empty, 16, 24, outlined(coatHook(false))],
  [PROP_C910.coatHook.jacket, 16, 24, outlined(coatHook(true))],
  ...(Object.keys(TELLY) as (keyof typeof TELLY)[]).map((k) => [PROP_C910.tellyOn[k], 16, 16, outlined(tellyOn(TELLY[k]))] as const),
  [PROP_C910.sunShaft, 32, 32, sunShaft],
  ...(Object.keys(REACTION) as (keyof typeof REACTION)[]).map((k) => [PROP_C910.reactionCard[k], 64, 40, REACTION[k]] as const),
];

export function addChapters9And10(atlas: AtlasBuilder): void {
  for (const [name, w, h, draw] of DRAWINGS) atlas.add(name, w, h, draw);
}
