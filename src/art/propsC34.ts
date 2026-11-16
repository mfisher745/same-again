/**
 * Props for chapter 3 (Regional Office) and chapter 4 (Southie). Owner: creative-director.
 *
 * The keys and sizes are the build contract in docs/build/c3c4.md: level-builder places these names, so a key or a
 * size changes only through that file. Every drawing below starts as a STUB (a plain outlined block in roughly the
 * right colours) so the chapters compile and can be laid out before the art lands. The creative director replaces
 * each stub with the real drawing; delete the STUB marker when you do.
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

/** STUB: an outlined block with a lighter top edge, so placement and scale can be judged before the art lands. */
const stub = (body: ColourName, top: ColourName, inset = 1): Draw =>
  outlined((b) => {
    b.rect(inset, inset, b.width - inset * 2, b.height - inset * 2, body);
    b.hline(inset, inset, b.width - inset * 2, top);
  });

/** [name, width, height, drawing]. */
const DRAWINGS: readonly (readonly [string, number, number, Draw])[] = [
  [PROP_C34.portacabin, 48, 32, stub('slate', 'fog')], // STUB
  [PROP_C34.clubFridge, 16, 24, stub('bone', 'white', 2)], // STUB
  [PROP_C34.signUpSheet, 16, 16, stub('white', 'bone', 3)], // STUB
  [PROP_C34.pallet, 16, 16, stub('peat', 'tan', 1)], // STUB
  [PROP_C34.deadPlant, 16, 24, stub('turf', 'peat', 4)], // STUB
  [PROP_C34.officeDesk, 32, 16, stub('peat', 'tan', 1)], // STUB
  [PROP_C34.filingCabinet.shut, 16, 24, stub('steel', 'fog', 2)], // STUB
  [PROP_C34.filingCabinet.dented, 16, 24, stub('steel', 'slate', 2)], // STUB
  [PROP_C34.filingCabinet.open, 16, 24, stub('slate', 'fog', 2)], // STUB
  [PROP_C34.wallMap, 32, 16, stub('bone', 'alarm', 1)], // STUB
  [PROP_C34.certificate, 16, 16, stub('amberLight', 'white', 3)], // STUB
  [PROP_C34.visitorsBook, 16, 16, stub('brick', 'white', 4)], // STUB
  [PROP_C34.brochure, 16, 16, stub('white', 'moss', 4)], // STUB
  [PROP_C34.drumShelf, 32, 16, stub('steel', 'fog', 0)], // STUB
  [PROP_C34.rollerDoor.shut, 48, 32, stub('steel', 'fog', 0)], // STUB
  [PROP_C34.rollerDoor.open, 48, 32, stub('coal', 'steel', 0)], // STUB
  [PROP_C34.crateStack.whole, 16, 24, stub('peat', 'tan', 1)], // STUB
  [PROP_C34.crateStack.cracked, 16, 24, stub('turf', 'peat', 1)], // STUB
  [PROP_C34.lever.up, 16, 16, stub('alarm', 'amberLight', 5)], // STUB
  [PROP_C34.lever.down, 16, 16, stub('brickDark', 'alarm', 5)], // STUB
  [PROP_C34.gantryRail, 16, 16, stub('amber', 'amberLight', 6)], // STUB
  [PROP_C34.manifest, 16, 16, stub('white', 'peat', 4)], // STUB
  [PROP_C34.logbook, 16, 16, stub('navy', 'white', 4)], // STUB
  [PROP_C34.tillShillelagh, 32, 32, stub('coal', 'grass', 2)], // STUB
  [PROP_C34.marchCountdown, 32, 16, stub('grass', 'amberLight', 1)], // STUB
  [PROP_C34.beerFridge, 16, 24, stub('white', 'dustyBlue', 2)], // STUB
  [PROP_C34.roster, 16, 16, stub('white', 'navy', 3)], // STUB
  [PROP_C34.stoutPint, 16, 16, stub('ink', 'bone', 5)], // STUB
  [PROP_C34.craftIpa, 16, 16, stub('amber', 'white', 5)], // STUB
  [PROP_C34.crane, 48, 32, stub('amber', 'amberLight', 0)], // STUB
  [PROP_C34.craneContainer.box, 32, 16, stub('brick', 'tan', 0)], // STUB
  [PROP_C34.craneContainer.shadow, 32, 16, (b) => void b.rect(1, 2, 30, 12, 'ink')], // STUB
  [PROP_C34.controlBox, 16, 24, stub('amber', 'amberLight', 2)], // STUB
  [PROP_C34.floodlightMast, 16, 32, stub('slate', 'white', 5)], // STUB
  [PROP_C34.bollard, 16, 16, stub('coal', 'steel', 3)], // STUB
  [PROP_C34.lunchbox, 16, 16, stub('alarm', 'fog', 4)], // STUB
  [PROP_C34.container.plain, 32, 16, stub('navy', 'dustyBlue', 0)], // STUB
  [PROP_C34.container.mas4471, 32, 16, stub('brick', 'amberLight', 0)], // STUB
  [PROP_C34.packingFoam, 16, 16, stub('bone', 'white', 2)], // STUB
  [PROP_C34.seizureNotice, 16, 16, stub('white', 'navy', 3)], // STUB
];

export function addChapters3And4(atlas: AtlasBuilder): void {
  for (const [name, w, h, draw] of DRAWINGS) atlas.add(name, w, h, draw);
}
