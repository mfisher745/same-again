/**
 * Props for chapter 5 (The Paper Trail, a federal records office in DC, region cities) and chapter 6 (Flyover
 * Country, a motel, a small town and cornfields in Ohio). Owner: creative-director.
 *
 * Chapters 5 and 6 place these keys at these sizes, so change a key or a size only together with the maps that use
 * them. Frames are drawn from their top-left corner, like every other prop.
 *
 * Style (docs/style-guide.md): palette colours only, light from the top left, three tones a surface, an ink outline
 * on anything Andrew can use or bump into, and no lettering: writing is suggested with blocks and rules. No real
 * brands, logos or flags (DESIGN.md section 2).
 */

import { AtlasBuilder, PixelBuffer } from './pixels';
import type { ColourName } from './palette';

type Draw = (b: PixelBuffer) => void;

const outlined =
  (draw: Draw): Draw =>
  (b) => {
    const layer = new PixelBuffer(b.width, b.height);
    draw(layer);
    layer.outline('ink');
    b.blit(layer, 0, 0);
  };

export const PROP_C56 = {
  // --- Chapter 5: the records office (region cities) ---
  /** The floor's photocopier: shut, and jammed with the side panel hanging open and a sheet caught in it (16 x 24). */
  photocopier: { shut: 'c56.photocopier.shut', jammed: 'c56.photocopier.jammed' },
  /** The light table for the redaction puzzle, unlit and lit (32 x 16). */
  lightbox: { unlit: 'c56.lightbox.unlit', lit: 'c56.lightbox.lit' },
  /** The lobby's take-a-number ticket machine on its stand (16 x 24). */
  ticketMachine: 'c56.ticketMachine',
  /** The lobby security desk: a counter with a monitor, a sign-in clipboard and a bowl for keys (32 x 16). */
  securityDesk: 'c56.securityDesk',
  /** A water cooler, blue bottle upside down on a white stand (16 x 24). */
  waterCooler: 'c56.waterCooler',
  /** Pruitt's umbrella stand, with the one umbrella in it and empty (16 x 16 each). The umbrella's crook pokes up. */
  umbrellaStand: { full: 'c56.umbrellaStand.full', empty: 'c56.umbrellaStand.empty' },
  /** A loose page with black redaction bars, one corner turned (16 x 16). The five floor sheets and the memo. */
  redactedSheet: 'c56.redactedSheet',
  /**
   * One tile-row of a rolling archive shelf unit, seen from above (32 x 16). `top` is the north end with the hand
   * wheel, `mid` repeats, `bottom` is the south end on its rail. Stacked top, mid x N, bottom down a column it reads
   * as one unit; `mid` alone also stacks seamlessly.
   */
  rollingShelf: { top: 'c56.rollingShelf.top', mid: 'c56.rollingShelf.mid', bottom: 'c56.rollingShelf.bottom' },
  /**
   * The floor rails a shelf runs on, one tile, rails running east-west (16 x 16, transparent between the rails, no
   * outline). `unlit` matches the cities `rail` tile; `lit` is the 1 s warning before a shelf slides. The same pair
   * exists as tiles: `rail` and `railLit` in the cities tileset.
   */
  floorRail: { unlit: 'c56.floorRail.unlit', lit: 'c56.floorRail.lit' },

  // --- Chapter 6: Ohio (region ohio) ---
  /** The motel's ice machine: white cabinet, steel bin door, a blue panel (16 x 24). */
  iceMachine: 'c56.iceMachine',
  /** The town's bus ticket machine on a post, with a little canopy (16 x 24). */
  busTicketMachine: 'c56.busTicketMachine',
  /** The town water tower: a round tank on four legs with a ladder (32 x 48). Solid at its feet: the bottom 2 x 1 tiles. */
  waterTower: 'c56.waterTower',
  /** The diner's sign: a rounded chrome-edged panel, a coffee cup at one end (32 x 16, wall). */
  dinerSign: 'c56.dinerSign',
  /** The motel's sign: pink panel, a row of bulbs and an arrow pointing in (32 x 16, wall). */
  motelSign: 'c56.motelSign',
  /** A cooler box sitting on a fence post, lid on, in a field (16 x 16). */
  coolerOnPost: 'c56.coolerOnPost',
  /** A rural mailbox on a post, flag up (16 x 16). */
  mailbox: 'c56.mailbox',
  /** A flag on a pole, plain stripes (16 x 32, two frames of it moving). Not any real flag. Solid at its foot. */
  flag: ['c56.flag.0', 'c56.flag.1'],
  /** A round hay bale, end on, for the combine to throw (16 x 16). Chapter 2's square `hayBale` stays for chapter 2. */
  roundBale: 'c56.roundBale',
  /** The shadow where a thrown bale will land: `0` as it is thrown, `1` just before it lands (16 x 16, no outline). */
  baleShadow: ['c56.baleShadow.0', 'c56.baleShadow.1'],
  /** A dust plume rising off the corn, three frames looping (32 x 32, no outline). Marks the combine's next lane. */
  dustPlume: ['c56.dustPlume.0', 'c56.dustPlume.1', 'c56.dustPlume.2'],
  /** A crop-circle marker stone, dark and lit (16 x 16). */
  markerStone: { dark: 'c56.markerStone.dark', lit: 'c56.markerStone.lit' },
  /** One sensor light on the combine's cab, lit and broken (8 x 8). Centre it on `SENSOR_LIGHT_OFFSETS`. */
  sensorLight: { lit: 'c56.sensorLight.lit', broken: 'c56.sensorLight.broken' },
} as const;

// --- Chapter 5: the records office ------------------------------------------

/** A beige office copier: lid on top, a control strip, two paper drawers. Jammed: side panel open, a sheet stuck. */
const photocopier =
  (jammed: boolean): Draw =>
  (b) => {
    // Lid and glass.
    b.rect(1, 2, 14, 5, 'fog').hline(1, 2, 14, 'white').hline(1, 6, 14, 'steel');
    b.rect(3, 3, 9, 2, 'slate').set(3, 3, 'steel');
    // Control strip: a green go button, a little grey screen, and the light that is never green for long.
    b.rect(1, 7, 14, 3, 'bone').hline(1, 9, 14, 'steel');
    b.rect(3, 8, 4, 1, 'dustyBlue').set(10, 8, 'grass').set(12, 8, jammed ? 'alarm' : 'amber');
    // Body and drawers.
    b.rect(1, 10, 14, 12, 'bone').vline(14, 10, 12, 'fog').vline(1, 10, 12, 'white');
    for (const y of [12, 17]) b.hline(2, y + 3, 12, 'fog').rect(6, y + 1, 4, 1, 'steel');
    b.rect(2, 22, 2, 1, 'coal').rect(12, 22, 2, 1, 'coal');
    // Output tray on the right.
    b.rect(13, 7, 3, 1, 'fog');
    if (!jammed) {
      b.rect(13, 6, 3, 1, 'white');
      return;
    }
    // The side panel swung out, dark inside, rollers showing, a sheet crumpled in the rollers.
    b.rect(3, 11, 9, 10, 'coal').hline(3, 11, 9, 'ink');
    b.hline(4, 13, 7, 'steel').hline(4, 16, 7, 'steel').hline(4, 19, 7, 'steel');
    b.rect(5, 14, 5, 4, 'white').set(6, 15, 'fog').set(8, 16, 'fog').set(9, 14, 'fog').set(5, 17, null).set(10, 13, 'white');
    b.rect(0, 12, 1, 9, 'fog').vline(0, 11, 1, 'steel');
  };

/** A white-topped light table on two legs. Lit: the top glows and the grid shows through. */
const lightbox =
  (lit: boolean): Draw =>
  (b) => {
    b.rect(1, 2, 30, 8, lit ? 'white' : 'fog').hline(1, 2, 30, lit ? 'fluoro' : 'bone');
    if (lit) {
      for (let x = 5; x < 30; x += 6) b.vline(x, 3, 6, 'fluoro');
      b.hline(2, 6, 28, 'fluoro');
      // A sheet laid on it, its bars gone thin and readable from underneath.
      b.rect(10, 3, 10, 6, 'bone').hline(11, 4, 7, 'slate').hline(11, 6, 5, 'slate').hline(11, 7, 7, 'steel');
    } else {
      b.hline(2, 6, 28, 'steel');
    }
    // Frame and a front face with the switch.
    b.rect(1, 10, 30, 3, 'steel').hline(1, 12, 30, 'slate').set(27, 11, lit ? 'grass' : 'coal');
    b.rect(3, 13, 2, 3, 'slate').rect(27, 13, 2, 3, 'slate');
  };

/** Take-a-number on a stand: red dispenser, a white paper tongue, a navy pole. */
const ticketMachine: Draw = (b) => {
  b.rect(3, 2, 10, 9, 'alarm').hline(3, 2, 10, 'motelPink').vline(12, 3, 8, 'brickDark').hline(3, 10, 10, 'brickDark');
  b.rect(5, 4, 6, 3, 'ink').rect(6, 5, 4, 1, 'amberLight');
  b.rect(6, 11, 4, 3, 'white').set(9, 13, 'fog');
  b.rect(7, 14, 2, 7, 'navy').vline(8, 14, 7, 'navyDark');
  b.rect(4, 21, 8, 2, 'navyDark').hline(4, 21, 8, 'navy');
};

/** The security desk: navy counter, a tan worktop, a monitor, the sign-in clipboard and a bowl for your keys. */
const securityDesk: Draw = (b) => {
  b.rect(0, 5, 32, 4, 'tan').hline(0, 5, 32, 'sand').hline(0, 8, 32, 'tanShade');
  b.rect(0, 9, 32, 6, 'navy').hline(0, 14, 32, 'navyDark').vline(31, 9, 6, 'navyDark');
  for (const x of [8, 16, 24]) b.vline(x, 10, 4, 'navyDark');
  // Monitor, back to us, glow on the worktop.
  b.rect(19, 0, 9, 6, 'coal').hline(19, 0, 9, 'slate').rect(22, 6, 3, 1, 'slate').set(20, 7, 'fluoro').set(26, 7, 'fluoro');
  // The clipboard with its pen on a string.
  b.rect(3, 4, 6, 5, 'white').hline(4, 3, 4, 'steel').hline(4, 6, 4, 'fog').hline(4, 7, 3, 'fog');
  b.line(9, 6, 12, 8, 'steel').set(12, 7, 'navy');
  // The tray for keys and coins.
  b.rect(13, 6, 4, 2, 'fog').hline(13, 7, 4, 'steel');
};

/** Water cooler: the big bottle upside down, the white cabinet, two taps (one red, one blue), a cup holder. */
const waterCooler: Draw = (b) => {
  b.ellipse(3, 0, 10, 9, 'dustyBlue').vline(5, 2, 5, 'skyPale').set(6, 2, 'skyPale').hline(4, 4, 8, 'navy');
  b.rect(6, 8, 4, 2, 'dustyBlue');
  b.rect(3, 10, 10, 13, 'white').vline(12, 10, 13, 'fog').hline(3, 10, 10, 'bone');
  b.set(5, 13, 'alarm').set(10, 13, 'navy').hline(5, 15, 6, 'steel');
  b.rect(1, 12, 2, 6, 'fog').set(1, 12, 'white');
  b.hline(3, 22, 10, 'steel');
};

/** A brass-rimmed steel tube. With the one umbrella in it, the black crook sticks up out of the top. */
const umbrellaStand =
  (full: boolean): Draw =>
  (b) => {
    if (full) {
      // Furled black canopy down into the stand, the crook handle curling over the top.
      b.vline(9, 2, 6, 'coal').vline(8, 4, 4, 'coal').set(10, 6, 'slate');
      b.set(9, 1, 'tanShade').set(8, 0, 'tanShade').set(7, 0, 'tanShade').set(6, 1, 'tanShade').set(6, 2, 'tanShade');
    }
    b.rect(4, 7, 8, 8, 'steel').vline(4, 7, 8, 'fog').vline(11, 7, 8, 'slate');
    b.hline(4, 7, 8, 'amber').hline(4, 8, 8, 'amberLight').hline(4, 14, 8, 'amber');
    b.rect(5, 8, 6, 1, full ? 'coal' : 'ink');
  };

/** A page of typing with most of it blacked out. One corner turned up. */
const redactedSheet: Draw = (b) => {
  b.rect(3, 1, 10, 14, 'white').vline(12, 2, 13, 'bone').hline(3, 14, 10, 'bone');
  b.set(12, 14, null).set(12, 13, 'fog').set(11, 14, 'fog');
  // Text lines in fog, the redactions in ink, more bar than text.
  b.hline(4, 3, 6, 'steel');
  b.hline(4, 5, 7, 'fog').rect(6, 5, 5, 1, 'ink');
  b.rect(4, 7, 8, 1, 'ink');
  b.hline(4, 9, 3, 'fog').rect(7, 9, 4, 1, 'ink');
  b.rect(4, 11, 7, 1, 'ink');
  b.hline(4, 12, 2, 'fog');
};

/**
 * A rolling archive unit seen from above: a steel top running north-south down the middle, box-file spines showing
 * along both long sides. Every piece fills the full cell, so the outline drawn by hand down the sides is the only ink
 * and the pieces join without a seam.
 */
const rollingShelf =
  (end: 'top' | 'mid' | 'bottom'): Draw =>
  (b) => {
    b.rect(0, 0, 32, 16, 'steel');
    // Box spines along each side, in two colours of archive box, a label patch on every other one.
    for (const [x0, w] of [[1, 8], [23, 8]] as const) {
      for (let y = 0; y < 16; y += 4) {
        const colour: ColourName = (y / 4 + x0) % 2 === 0 ? 'bone' : 'tan';
        b.rect(x0, y, w, 3, colour).hline(x0, y + 3, w, 'slate');
        if (y % 8 === 0) b.rect(x0 + 2, y + 1, 3, 1, 'white');
        else b.rect(x0 + 3, y + 1, 2, 1, 'tanShade');
      }
    }
    // The steel top: a lighter strip with a rib down it.
    b.rect(9, 0, 14, 16, 'steel').vline(9, 0, 16, 'fog').vline(22, 0, 16, 'slate').vline(15, 0, 16, 'fog');
    // Hand outline down the long sides.
    b.vline(0, 0, 16, 'ink').vline(31, 0, 16, 'ink');
    if (end === 'top') {
      // North end panel with the hand wheel.
      b.hline(0, 0, 32, 'ink').rect(1, 1, 30, 4, 'navy').hline(1, 1, 30, 'dustyBlue').hline(1, 4, 30, 'navyDark');
      b.ellipse(12, 0, 8, 6, 'fog').ellipse(14, 1, 4, 4, 'navyDark').set(15, 2, 'steel').set(16, 2, 'steel');
    }
    if (end === 'bottom') {
      // South end panel and the wheels on the rail.
      b.rect(1, 10, 30, 4, 'navy').hline(1, 10, 30, 'dustyBlue').hline(1, 13, 30, 'navyDark');
      b.rect(0, 14, 32, 2, 'ink').rect(3, 14, 3, 2, 'slate').rect(26, 14, 3, 2, 'slate');
    }
  };

/** Two rails across the tile at the cities `rail` tile's rows. Lit: the strips in them glow red and amber. */
const floorRail =
  (lit: boolean): Draw =>
  (b) => {
    for (const y of [5, 10]) {
      b.hline(0, y, 16, lit ? 'alarm' : 'coal');
      if (lit) for (let x = 1; x < 16; x += 4) b.set(x, y, 'amberLight');
      b.hline(0, y + 1, 16, lit ? 'brickDark' : 'slate');
    }
  };

// --- Chapter 6: Ohio --------------------------------------------------------

/** The motel ice machine: white cabinet, a steel bin with a flip door, the blue panel with a snowflake-ish star. */
const iceMachine: Draw = (b) => {
  b.rect(1, 1, 14, 21, 'white').vline(14, 2, 20, 'fog').hline(1, 1, 14, 'skyPale');
  b.rect(3, 3, 10, 6, 'dustyBlue').hline(3, 3, 10, 'skyPale');
  b.vline(8, 4, 4, 'white').hline(6, 6, 5, 'white').set(7, 5, 'white').set(9, 5, 'white').set(7, 7, 'white').set(9, 7, 'white');
  b.rect(3, 11, 10, 7, 'steel').hline(3, 11, 10, 'fog').hline(3, 17, 10, 'slate').rect(6, 13, 4, 1, 'coal');
  b.hline(2, 20, 12, 'fog').set(4, 19, 'skyPale').set(11, 19, 'skyPale');
  b.rect(2, 22, 2, 1, 'coal').rect(12, 22, 2, 1, 'coal');
};

/** A bus ticket machine: a dusty-blue box with a small screen and a slot, under a pink canopy, on a post. */
const busTicketMachine: Draw = (b) => {
  b.rect(2, 1, 12, 2, 'motelPink').hline(2, 1, 12, 'white').hline(2, 2, 12, 'motelPinkShade');
  b.rect(3, 3, 10, 11, 'dustyBlue').vline(12, 4, 10, 'navy').hline(3, 13, 10, 'navy').vline(3, 3, 10, 'skyPale');
  b.rect(5, 5, 6, 3, 'ink').hline(6, 6, 3, 'grass');
  for (const x of [5, 7, 9]) b.set(x, 9, 'white');
  b.rect(5, 11, 3, 1, 'coal').rect(9, 10, 2, 2, 'corn');
  b.rect(7, 14, 2, 8, 'steel').vline(8, 14, 8, 'slate');
  b.rect(5, 22, 6, 1, 'slate');
};

/** The water tower: a round tank with a cap, a walkway round it, four legs with cross-bracing and a ladder. */
const waterTower: Draw = (b) => {
  // Cap.
  b.rect(10, 1, 12, 2, 'dustyBlue').rect(7, 3, 18, 2, 'dustyBlue').hline(10, 1, 12, 'skyPale').set(15, 0, 'steel');
  // Tank, a plain band round it in place of a town name.
  b.rect(4, 5, 24, 14, 'skyPale').vline(4, 5, 14, 'white').vline(27, 5, 14, 'dustyBlue').vline(26, 6, 12, 'dustyBlue');
  b.rect(4, 10, 24, 3, 'white').hline(4, 10, 24, 'bone').set(4, 11, 'white');
  b.rect(6, 19, 20, 2, 'dustyBlue').hline(6, 20, 20, 'navy');
  // Walkway rail.
  b.hline(2, 21, 28, 'steel').hline(2, 23, 28, 'slate');
  for (let x = 2; x < 30; x += 4) b.vline(x, 21, 3, 'steel');
  // Legs and bracing.
  for (const x of [5, 12, 19, 26]) b.rect(x, 24, 2, 23, 'steel').vline(x + 1, 24, 23, 'slate');
  b.line(7, 26, 18, 35, 'slate').line(18, 26, 7, 35, 'slate').line(21, 26, 26, 31, 'slate');
  b.line(7, 37, 18, 45, 'slate').line(18, 37, 7, 45, 'slate').hline(7, 36, 19, 'steel');
  // The ladder up the middle.
  b.vline(14, 21, 26, 'fog').vline(17, 21, 26, 'fog');
  for (let y = 24; y < 47; y += 3) b.hline(15, y, 2, 'fog');
  // Feet.
  for (const x of [4, 11, 18, 25]) b.rect(x, 46, 4, 2, 'fog');
};

/** The diner's sign: a cream panel with a chrome edge, blocks for its name, and a coffee cup at the left. */
const dinerSign: Draw = (b) => {
  b.rect(1, 2, 30, 12, 'fog').rect(2, 3, 28, 10, 'bone').hline(2, 2, 28, 'white').hline(2, 13, 28, 'steel');
  b.set(1, 2, null).set(30, 2, null).set(1, 13, null).set(30, 13, null);
  // The cup and a curl of steam.
  b.rect(4, 7, 5, 4, 'white').hline(4, 10, 5, 'fog').set(9, 8, 'white').set(9, 9, 'fog').hline(4, 7, 5, 'turf');
  b.set(6, 5, 'fog').set(7, 4, 'fog');
  // The name in red blocks and a turquoise rule under it.
  for (let x = 11; x < 28; x += 3) b.rect(x, 5, 2, 4, 'alarm');
  b.hline(11, 10, 17, 'teal');
};

/** The motel's sign: pink, a row of bulbs along the top, its name in white blocks and an arrow pointing in. */
const motelSign: Draw = (b) => {
  b.rect(1, 1, 30, 13, 'motelPink').hline(1, 13, 30, 'motelPinkShade').vline(30, 1, 13, 'motelPinkShade').hline(1, 1, 30, 'white');
  for (let x = 3; x < 30; x += 3) b.set(x, 3, 'amberLight');
  for (let x = 4; x < 19; x += 3) b.rect(x, 5, 2, 4, 'white');
  // The arrow, corn yellow, pointing down and left at the door.
  b.hline(20, 6, 8, 'corn').vline(27, 6, 5, 'corn').line(21, 5, 20, 6, 'corn').line(21, 7, 20, 6, 'corn');
  b.set(22, 5, 'corn').set(22, 7, 'corn');
  b.rect(4, 10, 14, 2, 'dustyBlue');
};

/** A red-and-white cooler box with the lid on, sitting on top of a fence post. */
const coolerOnPost: Draw = (b) => {
  b.rect(2, 2, 12, 3, 'white').hline(2, 2, 12, 'white').hline(2, 4, 12, 'fog');
  b.rect(2, 5, 12, 5, 'alarm').hline(2, 9, 12, 'brickDark').vline(13, 5, 5, 'brickDark').rect(6, 6, 4, 1, 'white');
  b.rect(6, 10, 4, 6, 'tanShade').vline(6, 10, 6, 'tan').vline(9, 10, 6, 'turf');
};

/** A rural mailbox: a rounded steel box on a post, the red flag up. */
const mailbox: Draw = (b) => {
  b.rect(2, 4, 10, 5, 'fog').hline(3, 3, 8, 'white').hline(2, 8, 10, 'steel').vline(11, 4, 5, 'steel');
  b.vline(2, 4, 5, 'bone').set(2, 3, null);
  b.vline(13, 1, 6, 'alarm').rect(13, 1, 2, 2, 'alarm').set(12, 6, 'slate');
  b.rect(6, 9, 2, 7, 'tanShade').vline(6, 9, 7, 'tan');
};

/** A pole with a flag of three plain stripes (dusty blue, white, corn), not any real flag. Frame 1 is the ripple. */
const flag =
  (frame: number): Draw =>
  (b) => {
    b.set(2, 0, 'amberLight').vline(2, 1, 30, 'fog').vline(3, 1, 30, 'steel');
    b.rect(1, 30, 4, 2, 'slate');
    const stripes: readonly ColourName[] = ['dustyBlue', 'white', 'corn'];
    const folds: readonly ColourName[] = ['navy', 'fog', 'cornShade'];
    for (let x = 4; x < 15; x++) {
      const dip = frame === 0 ? (x > 9 ? 1 : 0) : x % 4 === 1 || x % 4 === 2 ? 1 : 0;
      // The column just before each dip is in shade: the fold.
      const fold = frame === 0 ? x === 9 : x % 4 === 0;
      stripes.forEach((colour, i) => b.rect(x, 2 + i * 3 + dip, 1, 3, fold ? (folds[i] ?? colour) : colour));
    }
  };

/** A round bale end on: a corn-gold coil, shaded under, with the twine round it. */
const roundBale: Draw = (b) => {
  b.ellipse(1, 1, 14, 14, 'corn').ellipse(2, 2, 12, 12, 'corn');
  b.ellipse(4, 4, 8, 8, 'cornShade').ellipse(5, 5, 6, 6, 'corn').ellipse(7, 7, 2, 2, 'cornShade');
  b.hline(4, 13, 8, 'cornShade').set(3, 12, 'cornShade').set(12, 12, 'cornShade');
  b.set(4, 3, 'amberLight').set(3, 5, 'amberLight').set(5, 2, 'amberLight');
  b.vline(1, 6, 4, 'tanShade').vline(14, 6, 4, 'tanShade');
};

/** Where a bale will land: a coal shadow, dashed red at the rim. Frame 1 is bigger and solid at the edge. */
const baleShadow =
  (frame: number): Draw =>
  (b) => {
    const inset = frame === 0 ? 3 : 1;
    b.ellipse(inset, inset + 2, 16 - inset * 2, 14 - inset * 2, 'alarm');
    b.ellipse(inset + 1, inset + 3, 14 - inset * 2, 12 - inset * 2, 'coal');
    if (frame === 0) for (let x = 0; x < 16; x += 3) for (let y = 0; y < 16; y++) if (b.get(x, y) === 'alarm') b.set(x, y, 'coal');
  };

/** A plume of dust and chaff off the corn, rising and leaning. No outline: it is weather. */
const dustPlume =
  (frame: number): Draw =>
  (b) => {
    const puffs: readonly (readonly [number, number, number])[] = [
      [6, 22, 10],
      [14, 20, 12],
      [10, 14 - frame * 2, 10 + frame],
      [16, 8 - frame * 2, 8 + frame],
      [8, 4 - frame, 6],
    ];
    for (const [x, y, d] of puffs) b.ellipse(x, y, d, d, 'tan');
    for (const [x, y, d] of puffs) b.ellipse(x + 1, y + 1, d - 3, d - 3, 'sand');
    b.hline(4, 30, 24, 'tanShade').hline(8, 31, 16, 'tanShade');
    // Chaff.
    for (const [x, y] of [[5, 12], [24, 6], [27, 16], [3, 19], [20, 2]] as const) b.set(x, (y + frame * 3) % 30, 'cornShade');
  };

/** A pale stone in flattened corn. Lit: a white glow round it and a cold blue light in the top. */
const markerStone =
  (lit: boolean): Draw =>
  (b) => {
    if (lit) b.ellipse(1, 3, 14, 13, 'skyPale');
    b.rect(5, 4, 6, 10, 'fog').hline(5, 4, 6, 'white').vline(10, 5, 9, 'steel').hline(5, 13, 6, 'slate');
    b.set(5, 4, null).set(10, 4, null);
    b.rect(7, 6, 2, 2, lit ? 'white' : 'steel');
    if (lit) b.set(7, 6, 'fluoro').set(6, 6, 'dustyBlue').set(9, 7, 'dustyBlue');
    else b.set(6, 10, 'slate').set(8, 11, 'slate');
  };

/** One cab sensor light in a steel housing. Lit: red with a white hot spot. Broken: dark glass, cracked, a spark. */
const sensorLight =
  (lit: boolean): Draw =>
  (b) => {
    b.rect(1, 1, 6, 6, 'steel').hline(1, 1, 6, 'fog').vline(6, 2, 5, 'slate');
    if (lit) {
      b.rect(2, 2, 4, 4, 'alarm').set(2, 2, 'white').set(3, 2, 'motelPink').set(2, 3, 'motelPink');
    } else {
      b.rect(2, 2, 4, 4, 'coal').line(2, 2, 5, 5, 'slate').set(4, 3, 'slate').set(0, 0, 'amberLight').set(7, 1, 'amber');
    }
  };

/** [name, width, height, drawing]. Sizes are the contract; do not change one here alone. */
const DRAWINGS: readonly (readonly [string, number, number, Draw])[] = [
  [PROP_C56.photocopier.shut, 16, 24, outlined(photocopier(false))],
  [PROP_C56.photocopier.jammed, 16, 24, outlined(photocopier(true))],
  [PROP_C56.lightbox.unlit, 32, 16, outlined(lightbox(false))],
  [PROP_C56.lightbox.lit, 32, 16, outlined(lightbox(true))],
  [PROP_C56.ticketMachine, 16, 24, outlined(ticketMachine)],
  [PROP_C56.securityDesk, 32, 16, outlined(securityDesk)],
  [PROP_C56.waterCooler, 16, 24, outlined(waterCooler)],
  [PROP_C56.umbrellaStand.full, 16, 16, outlined(umbrellaStand(true))],
  [PROP_C56.umbrellaStand.empty, 16, 16, outlined(umbrellaStand(false))],
  [PROP_C56.redactedSheet, 16, 16, outlined(redactedSheet)],
  [PROP_C56.rollingShelf.top, 32, 16, rollingShelf('top')],
  [PROP_C56.rollingShelf.mid, 32, 16, rollingShelf('mid')],
  [PROP_C56.rollingShelf.bottom, 32, 16, rollingShelf('bottom')],
  [PROP_C56.floorRail.unlit, 16, 16, floorRail(false)],
  [PROP_C56.floorRail.lit, 16, 16, floorRail(true)],
  [PROP_C56.iceMachine, 16, 24, outlined(iceMachine)],
  [PROP_C56.busTicketMachine, 16, 24, outlined(busTicketMachine)],
  [PROP_C56.waterTower, 32, 48, outlined(waterTower)],
  [PROP_C56.dinerSign, 32, 16, outlined(dinerSign)],
  [PROP_C56.motelSign, 32, 16, outlined(motelSign)],
  [PROP_C56.coolerOnPost, 16, 16, outlined(coolerOnPost)],
  [PROP_C56.mailbox, 16, 16, outlined(mailbox)],
  ...PROP_C56.flag.map((name, i) => [name, 16, 32, outlined(flag(i))] as const),
  [PROP_C56.roundBale, 16, 16, outlined(roundBale)],
  ...PROP_C56.baleShadow.map((name, i) => [name, 16, 16, baleShadow(i)] as const),
  ...PROP_C56.dustPlume.map((name, i) => [name, 32, 32, dustPlume(i)] as const),
  [PROP_C56.markerStone.dark, 16, 16, outlined(markerStone(false))],
  [PROP_C56.markerStone.lit, 16, 16, outlined(markerStone(true))],
  [PROP_C56.sensorLight.lit, 8, 8, outlined(sensorLight(true))],
  [PROP_C56.sensorLight.broken, 8, 8, outlined(sensorLight(false))],
];

export function addChapters5And6(atlas: AtlasBuilder): void {
  for (const [name, w, h, draw] of DRAWINGS) atlas.add(name, w, h, draw);
}
