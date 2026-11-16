/**
 * Props for chapter 3 (Regional Office) and chapter 4 (Southie). Owner: creative-director.
 *
 * The keys and sizes are the build contract in docs/build/c3c4.md: level-builder places these names, so a key or a
 * size changes only through that file.
 *
 * Style (docs/style-guide.md): palette colours only, light from the top left, three tones a surface, an ink outline
 * on anything Andrew can use or bump into, and no lettering: writing is suggested with blocks and rules.
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

export const PROP_C34 = {
  // --- Chapter 3: the depot (region kilnamoe) ---
  /** The staff social club from outside: a portacabin, door on its short end (48 x 32). */
  portacabin: 'c34.portacabin',
  /** The social club's fridge (16 x 24). Chapter 4 reuses it for the bar's light-beer fridge with `beerFridge`. */
  clubFridge: 'c34.clubFridge',
  /** The Christmas party sign-up sheet, no names on it (16 x 16, wall). */
  signUpSheet: 'c34.signUpSheet',
  /** A wooden pallet, flat (16 x 16). Dressing; may be breakable. */
  pallet: 'c34.pallet',
  /** Reception's dead plant (16 x 24). */
  deadPlant: 'c34.deadPlant',
  /** An office desk (32 x 16). */
  officeDesk: 'c34.officeDesk',
  /** Halloran's filing cabinet: shut, dented by one hit, open (16 x 24 each). */
  filingCabinet: { shut: 'c34.filingCabinet.shut', dented: 'c34.filingCabinet.dented', open: 'c34.filingCabinet.open' },
  /** The wall map with a pin in Leitrim, a pin in Boston and string between (32 x 16, wall). Clue c3.clue.map. */
  wallMap: 'c34.wallMap',
  /** Halloran's framed certificate (16 x 16, wall). Clue c3.clue.certificate. */
  certificate: 'c34.certificate',
  /** A visitors' book open on the reception desk (16 x 16). Clue c3.clue.visitors. */
  visitorsBook: 'c34.visitorsBook',
  /** A glossy brochure (16 x 16). Clue c3.clue.brochure. */
  brochure: 'c34.brochure',
  /** A run of warehouse shelving full of identical unlabelled drums, seen from above (32 x 16). Solid. */
  drumShelf: 'c34.drumShelf',
  /** A roller door, shut and open (48 x 32). */
  rollerDoor: { shut: 'c34.rollerDoor.shut', open: 'c34.rollerDoor.open' },
  /** A stack of crates that takes two hits to break: whole, then cracked (16 x 24 each). The boss arena's stacks. */
  crateStack: { whole: 'c34.crateStack.whole', cracked: 'c34.crateStack.cracked' },
  /** A wall lever, up and down (16 x 16 each). The crate puzzle's reset lever and chapter 4's container levers. */
  lever: { up: 'c34.lever.up', down: 'c34.lever.down' },
  /** The gantry walkway's rail, one tile, repeating along a row (16 x 16). */
  gantryRail: 'c34.gantryRail',
  /** The manifest on a clipboard in the bay office (16 x 16). Clue c3.clue.manifest. */
  manifest: 'c34.manifest',
  /** The watchman's logbook (16 x 16). Clean-run reward clue c3.clue.logbook. */
  logbook: 'c34.logbook',

  // --- Chapter 4: Southie (region cities) ---
  /** The till, with a plastic shillelagh mounted over it (32 x 32, behind the bar). */
  tillShillelagh: 'c34.tillShillelagh',
  /** "Days to March" countdown sign (32 x 16, wall). */
  marchCountdown: 'c34.marchCountdown',
  /** The fridge of American light beer by the door (16 x 24). */
  beerFridge: 'c34.beerFridge',
  /** The Pier Nine shift roster pinned by the dartboard (16 x 16, wall). Clue c4.clue.roster. */
  roster: 'c34.roster',
  /** A pint of stout settling on the bar (16 x 16). Colour clue c4.clue.stout. */
  stoutPint: 'c34.stoutPint',
  /** A craft IPA in a tall glass (16 x 16). */
  craftIpa: 'c34.craftIpa',
  /** The rail-mounted crane: its gantry frame, seen from above (48 x 32). Moves along the crane rail. */
  crane: 'c34.crane',
  /** The swinging container the crane carries, with its shadow drawn separately (32 x 16 each). */
  craneContainer: { box: 'c34.craneContainer.box', shadow: 'c34.craneContainer.shadow' },
  /** The foreman's control box (16 x 24). */
  controlBox: 'c34.controlBox',
  /** A floodlight mast (16 x 32). Stand it where a stealth floodlight is. */
  floodlightMast: 'c34.floodlightMast',
  /** A mooring bollard (16 x 16). Solid. */
  bollard: 'c34.bollard',
  /** A lunchbox on the bollard (16 x 16). The docks clean-run reward sits in it. */
  lunchbox: 'c34.lunchbox',
  /** A puzzle container, two tiles long, seen from above: plain, and MAS-4471 with the fragment's mark (32 x 16 each). */
  container: { plain: 'c34.container.plain', mas4471: 'c34.container.mas4471' },
  /** Packing foam with a round hollow in it (16 x 16). Colour clue c4.clue.foam. */
  packingFoam: 'c34.packingFoam',
  /** The federal seizure notice taped to the container wall (16 x 16). Clue c4.clue.seizure. */
  seizureNotice: 'c34.seizureNotice',
} as const;

// --- Chapter 3: the depot ---------------------------------------------------

/** The long side of the portacabin, as the yard sees it. The door is round the right-hand end: a step and a jamb. */
const portacabin: Draw = (b) => {
  // Flat ribbed roof.
  b.rect(1, 1, 46, 8, 'slate').hline(1, 1, 46, 'steel').hline(1, 8, 46, 'coal');
  for (let x = 6; x < 46; x += 6) b.vline(x, 2, 6, 'coal');
  // Wall panels.
  b.rect(2, 9, 44, 19, 'fog').hline(2, 9, 44, 'steel').hline(2, 27, 44, 'steel').vline(2, 10, 17, 'bone');
  for (const x of [12, 23, 34]) b.vline(x, 10, 17, 'steel');
  // Two windows behind mesh, dark: nobody has ever used the room.
  for (const x of [4, 25]) {
    b.rect(x, 13, 7, 7, 'slate').rect(x + 1, 14, 5, 5, 'navyDark');
    b.vline(x + 3, 14, 5, 'slate').hline(x + 1, 16, 5, 'slate').set(x + 1, 14, 'steel');
  }
  // A plaque with nothing much on it, and the rust under a roof bolt.
  b.rect(15, 14, 6, 4, 'bone').hline(16, 15, 4, 'steel').hline(16, 16, 3, 'steel');
  b.vline(36, 10, 4, 'rust').set(37, 10, 'rust').set(36, 14, 'rustDark');
  // The short end: door jamb, a handle, a concrete step.
  b.rect(41, 11, 5, 17, 'steel').vline(41, 11, 17, 'slate').set(43, 19, 'amberLight');
  b.rect(41, 28, 6, 3, 'steel').hline(41, 28, 6, 'fog').hline(41, 30, 6, 'slate');
  // Blocks it stands on.
  for (const x of [4, 20, 34]) b.rect(x, 28, 5, 3, 'coal').hline(x, 28, 5, 'slate');
};

/** A white fridge. One reminder note on it, about the milk, presumably. */
const clubFridge: Draw = (b) => {
  b.rect(2, 1, 12, 21, 'bone').hline(2, 1, 12, 'white').vline(2, 2, 20, 'white').vline(13, 2, 20, 'fog');
  b.hline(2, 8, 12, 'steel').vline(11, 4, 3, 'steel').vline(11, 10, 5, 'steel');
  b.rect(4, 11, 3, 3, 'amberLight').hline(4, 13, 3, 'amber');
  b.hline(4, 19, 8, 'fog').hline(2, 21, 12, 'fog');
  b.rect(3, 22, 2, 1, 'coal').rect(11, 22, 2, 1, 'coal');
};

/** A glass-doored fridge of light beer: three shelves of the same pale can. */
const beerFridge: Draw = (b) => {
  b.rect(2, 1, 12, 21, 'white').vline(13, 2, 20, 'fog');
  b.rect(2, 1, 12, 4, 'navy').hline(2, 1, 12, 'dustyBlue').hline(4, 3, 3, 'white').hline(8, 3, 4, 'alarm');
  b.rect(3, 5, 10, 15, 'navyDark');
  for (const y of [6, 11, 16]) {
    for (const x of [4, 7, 10]) b.rect(x, y, 2, 3, 'fog').hline(x, y + 1, 2, 'dustyBlue').set(x, y, 'white');
    b.hline(3, y + 3, 10, 'steel');
  }
  b.hline(3, 5, 10, 'fluoro');
  b.rect(2, 20, 12, 2, 'fog').hline(4, 21, 8, 'steel');
  b.rect(3, 22, 2, 1, 'coal').rect(11, 22, 2, 1, 'coal');
};

/** The Christmas party sheet: a festive heading, numbered lines, and nothing on any of them. */
const signUpSheet: Draw = (b) => {
  b.rect(3, 2, 10, 13, 'white').vline(12, 3, 12, 'bone').hline(3, 14, 10, 'bone');
  b.rect(7, 1, 2, 2, 'alarm');
  b.hline(5, 4, 6, 'moss').set(4, 4, 'alarm').set(11, 4, 'alarm').hline(6, 5, 4, 'grass');
  for (const y of [7, 9, 11, 13]) b.set(4, y, 'fog').hline(6, y, 5, 'bone');
};

const pallet: Draw = (b) => {
  b.rect(1, 2, 14, 13, 'turfDark');
  for (const y of [2, 5, 8, 11]) b.rect(1, y, 14, 2, 'peat').hline(1, y, 14, 'tan');
  b.hline(1, 13, 14, 'turf');
  for (const x of [1, 7, 13]) b.rect(x, 14, 2, 1, 'turf');
};

/** Reception's plant. It has been dead for some time and watered throughout. */
const deadPlant: Draw = (b) => {
  b.line(8, 15, 8, 7, 'turf').line(8, 10, 5, 6, 'turf').line(8, 8, 11, 4, 'turf');
  b.line(5, 6, 3, 9, 'peat').line(3, 9, 3, 11, 'tanShade');
  b.line(11, 4, 13, 6, 'peat').line(13, 6, 13, 9, 'tanShade');
  b.line(8, 7, 9, 3, 'peat').line(9, 3, 7, 2, 'tanShade');
  b.rect(4, 15, 8, 2, 'brick').hline(5, 15, 6, 'turfDark');
  b.rect(5, 17, 6, 5, 'brick').vline(10, 17, 5, 'brickDark').hline(5, 21, 6, 'brickDark').vline(5, 17, 4, 'tan');
  b.hline(12, 22, 2, 'tanShade');
};

const officeDesk: Draw = (b) => {
  b.rect(1, 2, 30, 8, 'peat').hline(1, 2, 30, 'tan');
  b.rect(1, 10, 30, 5, 'turf').hline(1, 14, 30, 'turfDark').vline(30, 3, 12, 'turfDark');
  for (const x of [3, 21]) b.rect(x, 11, 8, 3, 'peat').hline(x + 3, 12, 2, 'amberLight');
  b.rect(13, 11, 6, 4, 'turfDark');
  // A monitor's back, a keyboard, one sheet of paper and a mug.
  b.rect(11, 3, 10, 2, 'coal').hline(11, 3, 10, 'slate');
  b.rect(12, 6, 8, 2, 'bone').hline(12, 7, 8, 'fog');
  b.rect(3, 4, 5, 4, 'white').hline(4, 5, 3, 'fog').hline(4, 7, 2, 'fog');
  b.rect(24, 5, 3, 3, 'white').set(25, 5, 'turf').set(27, 6, 'bone');
};

/** Three drawers. `dent` is the one hit; `open` is the bottom drawer out, where W is. */
const filingCabinet =
  (dent: boolean, open: boolean): Draw =>
  (b) => {
    b.rect(2, 1, 12, 3, 'fog').hline(2, 1, 12, 'bone');
    b.rect(2, 4, 12, 19, 'steel').vline(13, 4, 19, 'slate').hline(2, 22, 12, 'slate');
    for (const y of [5, 11, 17]) {
      b.hline(3, y + 5, 10, 'slate').vline(2, y, 5, 'fog');
      b.rect(6, y + 1, 4, 1, 'white').hline(6, y + 3, 4, 'coal');
    }
    b.set(11, 5, 'coal');
    if (dent) {
      // The middle drawer, pushed in and creased, its label knocked crooked.
      b.rect(3, 11, 10, 5, 'slate').hline(4, 12, 7, 'coal').line(5, 13, 9, 14, 'coal').set(11, 14, 'fog').set(10, 15, 'fog');
      b.hline(6, 11, 2, 'white').set(8, 12, 'white');
    }
    if (open) {
      b.rect(3, 16, 10, 3, 'ink');
      for (let x = 4; x < 12; x += 2) b.vline(x, 16, 3, x % 4 === 0 ? 'bone' : 'tan');
      b.rect(1, 19, 14, 4, 'fog').hline(1, 19, 14, 'bone').vline(14, 20, 3, 'steel');
      b.rect(6, 20, 4, 1, 'white').hline(6, 21, 4, 'coal');
    }
  };

/** A paper map in a frame: America's coast on the left, Ireland on the right, two pins and red string between. */
const wallMap: Draw = (b) => {
  b.rect(1, 1, 30, 14, 'peat').hline(1, 1, 30, 'tan').hline(1, 14, 30, 'turf').vline(30, 2, 13, 'turf');
  b.rect(2, 2, 28, 12, 'bone');
  [9, 8, 8, 8, 6, 6, 5, 5, 4, 4, 5, 3].forEach((w, j) => void b.hline(2, 2 + j, w, 'anorak'));
  b.set(10, 5, 'anorak');
  b.ellipse(22, 4, 4, 6, 'anorak').set(22, 5, 'bone');
  b.rect(27, 3, 3, 8, 'anorak').set(27, 3, 'bone').set(27, 7, 'bone').set(29, 10, 'bone').rect(28, 11, 2, 2, 'anorak');
  for (const x of [12, 20]) b.vline(x, 2, 12, 'fog');
  b.line(9, 6, 23, 7, 'alarm');
  b.rect(8, 5, 2, 2, 'ink').set(8, 5, 'fog').rect(23, 6, 2, 2, 'ink').set(23, 6, 'fog');
};

/** Gilt frame, a seal and a ribbon. Awarded by Halloran. */
const certificate: Draw = (b) => {
  b.rect(2, 2, 12, 12, 'amber').hline(2, 2, 12, 'amberLight').vline(2, 2, 12, 'amberLight').hline(2, 13, 12, 'peat').vline(13, 2, 12, 'peat');
  b.rect(4, 4, 8, 8, 'white');
  b.hline(6, 5, 4, 'coal').hline(5, 7, 6, 'fog').hline(5, 9, 3, 'fog');
  b.rect(9, 9, 2, 2, 'alarm').set(9, 11, 'brick').set(10, 11, 'brick');
};

/** Open at today. Column headings, ruled lines, no visitors. A pen, ready. */
const visitorsBook: Draw = (b) => {
  b.rect(1, 3, 14, 10, 'brick').hline(1, 12, 14, 'brickDark');
  b.rect(2, 3, 6, 9, 'white').rect(8, 3, 6, 9, 'white').vline(7, 3, 9, 'fog').vline(8, 3, 9, 'bone');
  b.hline(3, 4, 4, 'coal').hline(9, 4, 4, 'coal');
  for (const y of [6, 8, 10]) b.hline(3, y, 4, 'bone').hline(9, y, 4, 'bone');
  b.hline(8, 14, 5, 'navy').set(13, 14, 'fog');
};

/** Glossy, green-banded, pictures of products in neat squares. No prices and no words. */
const brochure: Draw = (b) => {
  b.rect(6, 2, 8, 11, 'bone').vline(13, 3, 10, 'fog');
  b.rect(3, 3, 8, 11, 'white').vline(10, 6, 8, 'bone');
  b.rect(3, 3, 8, 3, 'moss').hline(3, 3, 8, 'grass').hline(5, 4, 4, 'amberLight');
  for (const y of [7, 10]) for (const x of [4, 7]) b.rect(x, y, 2, 2, 'fog').set(x, y, 'steel');
};

/** Racking from above. Eight drums, all the same, none labelled. Edge to edge so a run of them joins up. */
const drumShelf: Draw = (b) => {
  b.rect(0, 0, 32, 16, 'coal').hline(0, 0, 32, 'slate').hline(0, 15, 32, 'ink');
  for (const x of [0, 15, 16, 31]) b.vline(x, 0, 16, 'steel');
  for (const y of [1, 8]) {
    for (const x of [1, 8, 17, 24]) {
      b.ellipse(x, y, 7, 7, 'mossDark').ellipse(x, y, 6, 6, 'anorak').set(x + 2, y + 2, 'fog').set(x + 4, y + 4, 'mossDark');
    }
  }
};

const rollerFrame = (b: PixelBuffer): void => {
  b.rect(0, 0, 48, 5, 'slate').hline(0, 0, 48, 'fog').hline(0, 4, 48, 'coal');
  for (const x of [0, 45]) b.rect(x, 5, 3, 27, 'slate');
  b.vline(0, 5, 27, 'steel').vline(2, 5, 27, 'coal').vline(45, 5, 27, 'steel').vline(47, 5, 27, 'coal');
};
const hazardBar = (b: PixelBuffer, x: number, y: number, w: number, h: number): void => {
  b.rect(x, y, w, h, 'amber');
  for (let i = 0; i < w; i += 6) b.rect(x + i, y, 3, h, 'coal');
};
const rollerDoorShut: Draw = (b) => {
  b.rect(3, 5, 42, 24, 'steel');
  for (let y = 5; y < 29; y += 3) b.hline(3, y, 42, 'fog').hline(3, y + 2, 42, 'slate');
  hazardBar(b, 3, 29, 42, 3);
  b.rect(22, 25, 4, 1, 'coal');
  rollerFrame(b);
};
const rollerDoorOpen: Draw = (b) => {
  b.rect(3, 5, 42, 27, 'ink');
  b.rect(3, 5, 42, 4, 'steel').hline(3, 5, 42, 'fog').hline(3, 8, 42, 'slate');
  hazardBar(b, 3, 9, 42, 2);
  b.hline(3, 11, 42, 'coal');
  // A little of the floor inside catching the yard light.
  b.hline(6, 30, 9, 'coal').hline(22, 31, 12, 'coal').hline(36, 29, 6, 'coal');
  rollerFrame(b);
};

const crateAt = (b: PixelBuffer, x: number, y: number, w: number, h: number): void => {
  b.rect(x, y, w, h, 'peat').rect(x, y + h - 5, w, 5, 'turf').hline(x, y, w, 'tan');
  b.line(x + 1, y + 1, x + w - 2, y + h - 6, 'turf').line(x + w - 2, y + 1, x + 1, y + h - 6, 'turf');
  b.vline(x + Math.floor(w / 2), y + h - 5, 5, 'turfDark');
};
const crateStack =
  (cracked: boolean): Draw =>
  (b) => {
    crateAt(b, 1, 9, 14, 14);
    // After one hit the top crate has been shunted along and both have split.
    crateAt(b, cracked ? 3 : 2, 1, 12, 11);
    b.hline(cracked ? 3 : 2, 12, 12, 'turfDark');
    if (!cracked) return;
    b.line(5, 2, 8, 6, 'ink').line(8, 6, 7, 10, 'ink').set(9, 5, 'ink');
    b.rect(9, 15, 4, 2, 'ink').line(3, 14, 6, 18, 'ink').line(6, 18, 5, 21, 'ink');
    b.set(10, 14, 'tan').set(13, 16, 'tan').set(4, 12, 'tan').set(2, 22, 'tan');
  };

const lever =
  (down: boolean): Draw =>
  (b) => {
    b.rect(4, 3, 8, 11, 'slate').hline(4, 3, 8, 'steel').vline(11, 4, 10, 'coal').hline(4, 13, 8, 'coal');
    b.rect(7, 5, 2, 7, 'ink').set(5, 5, 'grass').set(5, 11, 'alarm');
    const arm = down ? 8 : 3;
    b.rect(7, arm, 2, 5, 'fog').vline(8, arm, 5, 'steel');
    const knob = down ? 12 : 1;
    b.rect(6, knob, 4, 3, 'alarm').set(6, knob, 'motelPink').hline(7, knob + 2, 3, 'brickDark');
  };

/** One tile of the gantry's handrail, open at both ends so a row of them is one rail. */
const gantryRail: Draw = (b) => {
  b.hline(0, 8, 16, 'amber');
  b.rect(7, 2, 2, 12, 'amber').vline(8, 4, 9, 'peat');
  b.rect(0, 2, 16, 2, 'amber').hline(0, 2, 16, 'amberLight');
  b.rect(0, 13, 16, 3, 'steel').hline(0, 13, 16, 'fog').hline(0, 15, 16, 'slate');
};

/** A thick clipboard of shipping lines, one of them gone over in highlighter. */
const manifest: Draw = (b) => {
  b.rect(3, 2, 10, 13, 'peat').hline(3, 14, 10, 'turf').vline(12, 3, 12, 'turf');
  b.rect(5, 4, 7, 10, 'bone').rect(4, 3, 7, 10, 'white');
  b.rect(6, 1, 4, 3, 'steel').hline(6, 1, 4, 'fog');
  b.hline(5, 5, 5, 'fog').hline(5, 7, 5, 'fog').hline(5, 9, 5, 'amberLight').hline(5, 11, 3, 'fog');
  b.set(9, 5, 'coal').set(9, 7, 'coal').set(9, 9, 'coal');
};

/** A hardback log with a ribbon. Nine years of it. */
const logbook: Draw = (b) => {
  b.rect(3, 3, 10, 11, 'navy').hline(3, 3, 10, 'dustyBlue').rect(3, 4, 2, 10, 'navyDark');
  b.vline(13, 4, 10, 'bone').hline(5, 13, 8, 'navyDark');
  b.rect(7, 5, 4, 3, 'white').hline(8, 6, 2, 'fog');
  b.vline(9, 14, 2, 'alarm');
};

// --- Chapter 4: Southie -----------------------------------------------------

/** A dark green plaque with a green plastic shillelagh on brackets and a bow, over a till with a green screen. */
const tillShillelagh: Draw = (b) => {
  b.rect(3, 2, 26, 9, 'mossDark').hline(3, 2, 26, 'moss').hline(3, 10, 26, 'ink').vline(28, 3, 8, 'ink');
  for (const x of [4, 27]) b.set(x, 3, 'amberLight').set(x, 9, 'amberLight');
  b.rect(9, 6, 17, 2, 'grass').hline(9, 6, 17, 'lime').hline(9, 7, 17, 'limeShade');
  b.ellipse(5, 4, 6, 5, 'grass').hline(6, 5, 3, 'lime').hline(7, 8, 3, 'limeShade').set(6, 5, 'white');
  b.set(14, 5, 'grass').set(20, 8, 'limeShade').hline(11, 6, 2, 'white');
  for (const x of [12, 23]) b.vline(x, 5, 4, 'fog');
  b.rect(16, 5, 3, 3, 'amberLight').set(17, 6, 'amber').set(16, 8, 'amber').set(18, 8, 'amber').set(15, 4, 'amberLight').set(19, 4, 'amberLight');
  // The till.
  b.rect(9, 13, 14, 5, 'coal').hline(9, 13, 14, 'slate').rect(11, 14, 10, 3, 'mossDark').hline(15, 15, 5, 'grass');
  b.rect(5, 18, 22, 12, 'coal').hline(5, 18, 22, 'slate').vline(26, 19, 11, 'ink');
  for (const y of [20, 22, 24]) for (let x = 7; x < 18; x += 2) b.set(x, y, 'bone');
  b.rect(20, 20, 5, 2, 'grass').rect(20, 23, 5, 2, 'alarm');
  b.rect(6, 26, 20, 3, 'slate').hline(6, 26, 20, 'steel').hline(14, 27, 4, 'fog');
};

/** A green board: blocks where the words would be, and three flip cards counting down. */
const marchCountdown: Draw = (b) => {
  b.rect(1, 2, 30, 12, 'grass').hline(1, 2, 30, 'amberLight').hline(1, 13, 30, 'moss').vline(30, 3, 11, 'moss');
  for (const x of [3, 6, 9, 12]) b.rect(x, 5, 2, 3, 'white');
  for (const x of [3, 6]) b.rect(x, 10, 2, 2, 'white');
  b.rect(10, 10, 4, 2, 'amberLight');
  const cards: readonly (readonly (readonly [number, number, number, number])[])[] = [
    [[1, 1, 2, 2], [2, 4, 1, 3]],
    [[1, 1, 2, 3], [1, 5, 2, 2]],
    [[1, 1, 1, 3], [1, 5, 2, 2]],
  ];
  cards.forEach((marks, i) => {
    const x = 16 + i * 5;
    b.rect(x, 4, 4, 8, 'ink');
    for (const [dx, dy, w, h] of marks) b.rect(x + dx, 4 + dy, w, h, 'amberLight');
    b.hline(x, 8, 4, 'coal');
  });
};

/** A printed grid on a pin. One column has the same red box every second row. */
const roster: Draw = (b) => {
  b.rect(2, 2, 12, 13, 'white').vline(13, 3, 12, 'bone').hline(2, 14, 12, 'bone');
  b.rect(2, 2, 12, 2, 'navy').rect(7, 1, 2, 2, 'alarm');
  [5, 7, 9, 11, 13].forEach((y, row) => {
    b.hline(3, y, 2, 'slate');
    for (const x of [6, 8, 10, 12]) b.set(x, y, (x + row) % 3 === 0 ? 'dustyBlue' : 'fog');
    if (row % 2 === 1) b.set(8, y, 'alarm');
  });
};

/** A pint that was poured in one go and is doing its best: brown and churning where it should be black. */
const stoutPint: Draw = (b) => {
  b.rect(4, 2, 8, 9, 'coal').rect(5, 11, 6, 2, 'coal');
  b.rect(4, 2, 8, 2, 'white').hline(4, 3, 8, 'bone');
  b.rect(4, 4, 8, 3, 'peat').rect(4, 7, 8, 2, 'turfDark');
  b.set(5, 4, 'tan').set(8, 4, 'tan').set(10, 5, 'tan').set(6, 5, 'tan').set(9, 6, 'tan').set(7, 7, 'peat').set(10, 8, 'peat').set(5, 8, 'peat');
  b.vline(4, 4, 7, 'slate').set(5, 11, 'slate');
  b.hline(2, 13, 12, 'grass').hline(3, 14, 10, 'moss');
};

/** A tulip glass on a stem, cloudy, with fruit on the rim. */
const craftIpa: Draw = (b) => {
  b.rect(5, 2, 6, 7, 'amberLight').hline(5, 2, 6, 'white').vline(10, 3, 6, 'amber').vline(5, 3, 5, 'sand');
  b.rect(6, 9, 4, 1, 'amber').vline(8, 10, 3, 'fog').vline(7, 10, 3, 'fog').hline(5, 13, 6, 'fog');
  b.rect(10, 1, 3, 2, 'rust').hline(10, 1, 3, 'amber');
  b.hline(3, 14, 10, 'magenta');
};

/** The gantry from above: two girders, a truck at each end on the rails, the trolley and its cab in the middle. */
const crane: Draw = (b) => {
  for (const y of [5, 21]) {
    b.rect(2, y, 44, 6, 'amber').hline(2, y, 44, 'amberLight').hline(2, y + 5, 44, 'peat');
    for (let x = 9; x < 42; x += 5) b.line(x, y + 1, x + 3, y + 4, 'peat');
  }
  for (const x of [0, 41]) {
    b.rect(x, 2, 7, 28, 'amber').vline(x, 2, 28, 'amberLight').vline(x + 6, 2, 28, 'peat');
    for (let y = 4; y < 28; y += 5) b.rect(x + 1, y, 5, 2, 'coal');
    b.rect(x + 1, 0, 5, 2, 'coal').rect(x + 1, 30, 5, 2, 'coal');
  }
  b.rect(18, 3, 12, 26, 'slate').hline(18, 3, 12, 'steel').vline(18, 4, 24, 'steel').vline(29, 4, 25, 'coal').hline(18, 28, 12, 'coal');
  b.rect(20, 5, 8, 5, 'dustyBlue').hline(20, 5, 8, 'skyPale').vline(24, 5, 5, 'slate');
  b.rect(20, 13, 8, 7, 'coal');
  for (let x = 21; x < 28; x += 2) b.vline(x, 13, 7, 'fog');
  b.rect(23, 23, 2, 2, 'alarm').set(23, 23, 'motelPink');
};

/** A container on the hook, from above: ribbed roof, corner castings, the yellow spreader across it. */
const craneContainerBox: Draw = (b) => {
  b.rect(1, 1, 30, 14, 'brick').hline(1, 1, 30, 'tan').hline(1, 14, 30, 'brickDark').vline(30, 2, 13, 'brickDark');
  for (let x = 4; x < 30; x += 3) b.vline(x, 2, 12, 'brickDark');
  for (const x of [1, 29]) for (const y of [1, 13]) b.rect(x, y, 2, 2, 'steel');
  b.rect(5, 7, 22, 2, 'amber').hline(5, 7, 22, 'amberLight');
  b.rect(15, 3, 2, 10, 'amber').vline(15, 3, 10, 'amberLight').rect(15, 7, 2, 2, 'coal');
  for (const x of [5, 25]) b.rect(x, 6, 2, 4, 'coal');
};

/** Its shadow on the ground: flat ink with the corners off. The scene sets how see-through it is. */
const craneContainerShadow: Draw = (b) => {
  b.rect(3, 1, 26, 14, 'ink').rect(1, 3, 30, 10, 'ink').rect(2, 2, 28, 12, 'ink');
};

/** The foreman's box: a cab on a plinth, a window, two levers and a button he is not supposed to need. */
const controlBox: Draw = (b) => {
  b.rect(1, 1, 14, 3, 'fog').hline(1, 1, 14, 'white').hline(1, 3, 14, 'steel');
  b.rect(2, 4, 12, 18, 'amber').vline(2, 4, 18, 'amberLight').vline(13, 4, 18, 'peat');
  b.rect(4, 5, 8, 6, 'dustyBlue').hline(4, 5, 8, 'skyPale').set(5, 6, 'skyPale').vline(8, 5, 6, 'peat').hline(4, 10, 8, 'navy');
  b.rect(3, 12, 10, 6, 'coal').hline(3, 12, 10, 'slate');
  for (const x of [5, 8]) b.rect(x, 13, 1, 1, 'alarm').vline(x, 14, 3, 'fog');
  b.rect(10, 14, 2, 2, 'grass').set(10, 14, 'lime');
  hazardBar(b, 2, 19, 12, 3);
  b.hline(1, 22, 14, 'steel');
};

/** A lamp bank on a pole with rungs. */
const floodlightMast: Draw = (b) => {
  b.rect(2, 1, 12, 7, 'coal').hline(2, 1, 12, 'slate');
  for (const x of [3, 9]) for (const y of [2, 5]) b.rect(x, y, 4, 2, 'fluoro').hline(x, y + 1, 4, 'skyPale');
  b.rect(6, 8, 4, 2, 'slate');
  b.rect(7, 10, 2, 19, 'steel').vline(8, 10, 19, 'slate');
  for (let y = 13; y < 28; y += 4) b.hline(6, y, 4, 'fog');
  b.rect(4, 29, 8, 2, 'coal').hline(4, 29, 8, 'slate');
};

/** Cast iron, mushroom-headed, a ring of rust where the rope goes. */
const bollard: Draw = (b) => {
  b.ellipse(2, 10, 12, 5, 'coal').hline(4, 10, 6, 'slate');
  b.rect(5, 5, 6, 7, 'coal').vline(6, 6, 6, 'slate');
  b.hline(5, 9, 6, 'rustDark').set(6, 9, 'rust');
  b.ellipse(3, 2, 10, 5, 'slate').hline(5, 2, 5, 'steel').hline(5, 3, 3, 'fog').hline(4, 6, 8, 'coal');
};

/** A red steel lunchbox with a domed lid. Stand it on the bollard. */
const lunchbox: Draw = (b) => {
  b.hline(6, 2, 4, 'fog').set(5, 3, 'fog').set(10, 3, 'fog');
  b.hline(4, 4, 8, 'motelPink').rect(3, 5, 10, 8, 'alarm').vline(3, 5, 3, 'motelPink');
  b.hline(3, 8, 10, 'brickDark').hline(3, 12, 10, 'brickDark').vline(12, 6, 6, 'brickDark');
  b.rect(7, 7, 2, 3, 'fog').set(8, 9, 'steel');
};

/**
 * A puzzle container, two tiles long, drawn like the `containerRed` and `containerBlue` tiles (roof above, ribbed side
 * below) but ringed in ink because it moves. `marked` is MAS-4471: a longer number plate, and the fragment's mark,
 * three dots climbing to the right (see PROP.metalFragment).
 */
const container =
  (top: ColourName, shade: ColourName, light: ColourName, marked: boolean): Draw =>
  (b) => {
    b.rect(0, 0, 32, 16, 'ink');
    b.rect(1, 1, 30, 5, top).hline(1, 1, 30, light);
    b.rect(1, 6, 30, 9, shade);
    for (let x = 3; x < 30; x += 3) b.vline(x, 7, 7, top);
    b.vline(1, 6, 9, top).vline(30, 6, 9, top).hline(1, 6, 30, 'ink');
    for (const x of [1, 29]) b.rect(x, 1, 2, 1, 'steel');
    // The plate: blocks for the letters, a dash, blocks for the digits.
    const plate = marked ? 17 : 9;
    b.rect(3, 8, plate, 5, 'bone');
    const blocks = marked ? [4, 6, 8, 12, 14, 16, 18] : [4, 6, 9];
    for (const x of blocks) b.vline(x, 9, 3, 'ink');
    if (!marked) return;
    b.set(10, 10, 'ink');
    b.rect(22, 7, 8, 7, shade).rect(23, 8, 6, 5, 'ink');
    b.set(24, 12, 'amberLight').set(26, 10, 'amberLight').set(28, 8, 'amberLight');
  };

/** A block of white foam with a round hollow where something sat. */
const packingFoam: Draw = (b) => {
  b.rect(2, 3, 12, 11, 'white').hline(2, 13, 12, 'bone').vline(13, 4, 10, 'bone');
  b.ellipse(4, 4, 8, 8, 'steel').ellipse(5, 5, 7, 7, 'fog').ellipse(6, 6, 5, 5, 'bone');
  b.set(3, 4, 'bone').set(12, 5, 'bone').set(3, 12, 'fog');
};

/** Taped up at the corners: a navy heading, a seal, two lines and a red stamp across them. */
const seizureNotice: Draw = (b) => {
  b.rect(3, 1, 10, 14, 'white').vline(12, 2, 13, 'bone');
  b.rect(2, 1, 3, 2, 'tan').rect(11, 1, 3, 2, 'tan');
  b.rect(5, 3, 6, 2, 'navy');
  b.ellipse(6, 6, 4, 4, 'navy').set(7, 7, 'amberLight').set(8, 8, 'amberLight');
  b.hline(4, 11, 7, 'fog').hline(4, 13, 5, 'fog');
  b.line(4, 13, 11, 10, 'alarm');
};

/** [name, width, height, drawing]. Sizes are the contract; do not change one here alone. */
const DRAWINGS: readonly (readonly [string, number, number, Draw])[] = [
  [PROP_C34.portacabin, 48, 32, outlined(portacabin)],
  [PROP_C34.clubFridge, 16, 24, outlined(clubFridge)],
  [PROP_C34.signUpSheet, 16, 16, outlined(signUpSheet)],
  [PROP_C34.pallet, 16, 16, outlined(pallet)],
  [PROP_C34.deadPlant, 16, 24, outlined(deadPlant)],
  [PROP_C34.officeDesk, 32, 16, outlined(officeDesk)],
  [PROP_C34.filingCabinet.shut, 16, 24, outlined(filingCabinet(false, false))],
  [PROP_C34.filingCabinet.dented, 16, 24, outlined(filingCabinet(true, false))],
  [PROP_C34.filingCabinet.open, 16, 24, outlined(filingCabinet(true, true))],
  [PROP_C34.wallMap, 32, 16, outlined(wallMap)],
  [PROP_C34.certificate, 16, 16, outlined(certificate)],
  [PROP_C34.visitorsBook, 16, 16, outlined(visitorsBook)],
  [PROP_C34.brochure, 16, 16, outlined(brochure)],
  [PROP_C34.drumShelf, 32, 16, drumShelf],
  [PROP_C34.rollerDoor.shut, 48, 32, rollerDoorShut],
  [PROP_C34.rollerDoor.open, 48, 32, rollerDoorOpen],
  [PROP_C34.crateStack.whole, 16, 24, outlined(crateStack(false))],
  [PROP_C34.crateStack.cracked, 16, 24, outlined(crateStack(true))],
  [PROP_C34.lever.up, 16, 16, outlined(lever(false))],
  [PROP_C34.lever.down, 16, 16, outlined(lever(true))],
  [PROP_C34.gantryRail, 16, 16, outlined(gantryRail)],
  [PROP_C34.manifest, 16, 16, outlined(manifest)],
  [PROP_C34.logbook, 16, 16, outlined(logbook)],
  [PROP_C34.tillShillelagh, 32, 32, outlined(tillShillelagh)],
  [PROP_C34.marchCountdown, 32, 16, outlined(marchCountdown)],
  [PROP_C34.beerFridge, 16, 24, outlined(beerFridge)],
  [PROP_C34.roster, 16, 16, outlined(roster)],
  [PROP_C34.stoutPint, 16, 16, outlined(stoutPint)],
  [PROP_C34.craftIpa, 16, 16, outlined(craftIpa)],
  [PROP_C34.crane, 48, 32, outlined(crane)],
  [PROP_C34.craneContainer.box, 32, 16, outlined(craneContainerBox)],
  [PROP_C34.craneContainer.shadow, 32, 16, craneContainerShadow],
  [PROP_C34.controlBox, 16, 24, outlined(controlBox)],
  [PROP_C34.floodlightMast, 16, 32, outlined(floodlightMast)],
  [PROP_C34.bollard, 16, 16, outlined(bollard)],
  [PROP_C34.lunchbox, 16, 16, outlined(lunchbox)],
  [PROP_C34.container.plain, 32, 16, container('navy', 'navyDark', 'dustyBlue', false)],
  [PROP_C34.container.mas4471, 32, 16, container('brick', 'brickDark', 'tan', true)],
  [PROP_C34.packingFoam, 16, 16, outlined(packingFoam)],
  [PROP_C34.seizureNotice, 16, 16, outlined(seizureNotice)],
];

export function addChapters3And4(atlas: AtlasBuilder): void {
  for (const [name, w, h, draw] of DRAWINGS) atlas.add(name, w, h, draw);
}
