/**
 * Props and furniture that are sprites rather than tiles: things Andrew can
 * push, examine or hide beside, and large set dressing. Interactable props are
 * outlined in ink (docs/style-guide.md section 1). Frames live in one atlas,
 * `PROPS_KEY`; use the names in `PROP`.
 *
 * Chapter-specific props are added here as each chapter is built.
 */

import type { WeaponId } from '../core/types';
import { K, WEAPONS } from './icons';
import { PROPS_KEY } from './keys';
import { PROP_C34, addChapters3And4 } from './propsC34';
import { PROP_C56, addChapters5And6 } from './propsC56';
import { PROP_C78, addChapters7And8 } from './propsC78';
import { AtlasBuilder, PixelBuffer } from './pixels';
import type { Sheet } from './pixels';

export const PROP = {
  // Chapters 3 and 4: keys, sizes and drawings in propsC34.ts.
  ...PROP_C34,
  // Chapters 5 and 6: keys, sizes and drawings in propsC56.ts.
  ...PROP_C56,
  // Chapters 7 and 8: keys, sizes and drawings in propsC78.ts.
  ...PROP_C78,
  // Shared
  keg: 'keg',
  crate: 'crate',
  noticeboard: 'noticeboard',
  vendingMachine: 'vendingMachine',
  bins: 'bins',
  // Breakables (DESIGN.md 7.1). Each breaks into `debris`.
  barrel: 'barrel',
  bottleCrate: 'bottleCrate',
  cardboardBox: 'cardboardBox',
  flowerPot: 'flowerPot',
  sack: 'sack',
  debris: ['debris.0', 'debris.1'],
  // Chapter 1
  fruitMachine: 'fruitMachine',
  dartboard: 'dartboard',
  trophyShelf: 'trophyShelf',
  teamPhoto: 'teamPhoto',
  beerTaps: 'beerTaps',
  telly: 'telly',
  tractor: 'tractor',
  churchGate: 'churchGate',
  /** A builder's skip on Main Street, full of somebody's old kitchen. Big Tom's charge stops at it. */
  skip: 'skip',
  /** Playtest 6: the keg yard's stuck gate, a boarded wooden gate filling the one-tile gateway. */
  yardGate: 'yardGate',
  chipperSign: 'chipperSign',
  bookiesSign: 'bookiesSign',
  pubSign: 'pubSign',
  foldedJacket: 'foldedJacket',
  bogLights: ['bogLights.0', 'bogLights.1', 'bogLights.2'],
  // Chapter 2 (docs/chapters/02-the-bog.md). Sizes are in the "Art" table of that spec.
  // A steel field gate. `across` and `along` are one tile each and repeat along a row or a column, for a gate of
  // any length; `across3` and `along3` are whole three-tile gates with their posts.
  fieldGate: { across: 'fieldGate.across', along: 'fieldGate.along', across3: 'fieldGate.across3', along3: 'fieldGate.along3' },
  // Ground, drawn on the 'floor' layer: no outline.
  puddle: 'puddle',
  puddleLarge: 'puddleLarge',
  cattleGrid: 'cattleGrid',
  tyreTracks: { across: 'tyreTracks.across', along: 'tyreTracks.along' },
  scorchRing: 'scorchRing',
  // Obstacles and set dressing.
  wheelbarrow: 'wheelbarrow',
  sleepingDog: ['sleepingDog.0', 'sleepingDog.1'],
  van: { right: 'van.right', left: 'van.left' },
  leanTo: 'leanTo',
  /** A timber sheep hurdle tied across the hay shed's doorway (32 x 16). Taken away when the flock is penned. */
  shedHurdle: 'shedHurdle',
  /** Brennan's yard gate: red-painted tubular steel, swung open flat against the hedge (48 x 16). */
  farmGateOpen: 'farmGateOpen',
  honestyBox: 'honestyBox',
  coffeeJar: 'coffeeJar',
  hayBale: 'hayBale',
  feedBuckets: 'feedBuckets',
  // Clues, drawn as themselves (DESIGN.md section 8).
  metalFragment: 'metalFragment',
  boiledFrog: 'boiledFrog',
  burntWelly: 'burntWelly',
  lanyard: 'lanyard',
  docket: 'docket',
  // Overhaul: the bar's hot drinks (DESIGN.md 7.1).
  hotDrinkUrn: 'hotDrinkUrn',
  /** Playtest 6: steam over a bar's urn or flask while its free hot drink can be taken. Three frames, looping. */
  steam: ['steam.0', 'steam.1', 'steam.2'],
  flask: 'flask',
  kettle: 'kettle',
  coffeePot: 'coffeePot',
  teaTrolley: 'teaTrolley',
  // Overhaul: weapons as world objects, for a boss to drop or hand over (DESIGN.md 7.2). 16 x 16 each.
  weapon: {
    hurley: 'weapon.hurley',
    clipboard: 'weapon.clipboard',
    shillelagh: 'weapon.shillelagh',
    umbrella: 'weapon.umbrella',
    inflatableAlien: 'weapon.inflatableAlien',
    securityWand: 'weapon.securityWand',
  } satisfies Readonly<Record<Exclude<WeaponId, 'fists'>, string>>,
} as const;

type Draw = (b: PixelBuffer) => void;

const outlined =
  (draw: Draw): Draw =>
  (b) => {
    const layer = new PixelBuffer(b.width, b.height);
    draw(layer);
    layer.outline('ink');
    b.blit(layer, 0, 0);
  };

/** A picture from rows of letters (the icon letters, `K` in icons.ts), ink-outlined. */
const pic = (rows: readonly string[]): Draw => outlined((b) => void b.stamp(0, 0, rows, K));

/** A 12 x 12 icon drawing centred in a 16 x 16 cell. */
const fromIcon =
  (draw: Draw): Draw =>
  (b) => {
    const icon = new PixelBuffer(12, 12);
    draw(icon);
    b.blit(icon, 2, 2);
  };

const HOT_DRINKS: readonly [string, number, number, readonly string[]][] = [
  // The urn on the bar: steel, a white highlight, the amber light that says it is on, a black tap.
  [
    PROP.hotDrinkUrn,
    16,
    24,
    [
      '................',
      '.......ss.......',
      '.....SSSSSS.....',
      '...ffffffffff...',
      '...fwffffffffS..',
      '...fwffffffffS..',
      '...fwfffAffffS..',
      '...fwffffffffS..',
      '...fwffffffffS..',
      '...fwffffffffS..',
      '...fwffffffffS..',
      '...fwffffffffS..',
      '...fwffffffffS..',
      '...fwffffffffS..',
      '...SSSSSSSSSSS..',
      '......ccc.......',
      '.......c........',
      '...SSSSSSSSSSS..',
      '....s.......s...',
      '....s.......s...',
      '...cccccccccc...',
      '................',
      '................',
      '................',
    ],
  ],
  // A tartan flask with the cup on top.
  [
    PROP.flask,
    16,
    16,
    [
      '................',
      '......SSSS......',
      '......SfSS......',
      '.....SSSSSS.....',
      '.....BRBBRB.....',
      '.....BRBBRB.....',
      '.....AAAAAA.....',
      '.....BRBBRB.....',
      '.....BRBBRB.....',
      '.....AAAAAA.....',
      '.....BRBBRB.....',
      '.....BRBBRB.....',
      '.....SSSSSS.....',
      '................',
      '................',
      '................',
    ],
  ],
  // The staff kettle: white plastic, a blue window, scaled to the line.
  [
    PROP.kettle,
    16,
    16,
    [
      '................',
      '................',
      '.......sss......',
      '.....wwwwwww....',
      '..ww.wwwwwwwbbb.',
      '...wwwwwwwwwb.b.',
      '....wwwwwwufb.b.',
      '....wwwwwwufb.b.',
      '....wwwwwwufbbb.',
      '....wwwwwwuf....',
      '....wwwwwwwf....',
      '....fffffffff...',
      '...sssssssssss..',
      '................',
      '................',
      '................',
    ],
  ],
  // A filter-coffee pot on its hotplate, a third full, as it always is.
  [
    PROP.coffeePot,
    16,
    16,
    [
      '................',
      '......cccc......',
      '.....cccccc.....',
      '......UUUU......',
      '......U..U.ccc..',
      '.....U....Uc.c..',
      '....U......Uc.c.',
      '....U......Ucc..',
      '....TTTTTTTTc...',
      '....TTTTTTTT....',
      '.....TTTTTT.....',
      '...ssssssssss...',
      '...ssssssrsss...',
      '................',
      '................',
      '................',
    ],
  ],
  // The tea trolley: a brown teapot and cups on top, saucers and the biscuits below.
  [
    PROP.teaTrolley,
    32,
    24,
    [
      '................................',
      '.........tt.....................',
      '........pppp....................',
      '......pppppppp..................',
      '..p..pxpppppppp.ppp.ww..ww..ww..',
      '...p.pxpppppppp.p.pwwww.www.www.',
      '....ppppppppppppp.p.ww..ww..ww..',
      '......pppppppppp.p..............',
      '.ffffffffffffffffffffffffffffff.',
      '.SSSSSSSSSSSSSSSSSSSSSSSSSSSSSS.',
      '.S............................S.',
      '.S............................S.',
      '.S...bbbb..bbbb....xxXxxXxxX..S.',
      '.S...wwww..wwww....xxXxxXxxX..S.',
      '.S............................S.',
      '.ffffffffffffffffffffffffffffff.',
      '.SSSSSSSSSSSSSSSSSSSSSSSSSSSSSS.',
      '.S............................S.',
      '.S............................S.',
      '.S............................S.',
      'ccc..........................ccc',
      '.c............................c.',
      '................................',
      '................................',
    ],
  ],
];

/** Weapons lying about. Long ones are redrawn to use the bigger cell; the rest are their icons. */
const WEAPON_PROPS: Readonly<Record<Exclude<WeaponId, 'fists'>, Draw>> = {
  hurley: pic([
    '................',
    '................',
    '.cc.............',
    '.ccc............',
    '..ccx...........',
    '...xxx..........',
    '....xxX.........',
    '.....xxX........',
    '......xxX.......',
    '.......xxX......',
    '........xxxX....',
    '.......xxxxxX...',
    '.......xxxxSX...',
    '........xxxX....',
    '................',
    '................',
  ]),
  clipboard: fromIcon(WEAPONS.clipboard),
  shillelagh: fromIcon(WEAPONS.shillelagh),
  // Furled, lying on the floor, the handle hooked.
  umbrella: pic([
    '................',
    '................',
    '................',
    '..pp............',
    '.p..p...........',
    '.p...v..........',
    '......vv........',
    '......vvv.......',
    '.......vuvv.....',
    '........vuvv....',
    '.........vvvv...',
    '...........vvv..',
    '............vS..',
    '.............S..',
    '................',
    '................',
  ]),
  inflatableAlien: fromIcon(WEAPONS.inflatableAlien),
  securityWand: fromIcon(WEAPONS.securityWand),
};

/** Chapter 2: the bog, Brennan's farm and the lane. Kilnamoe colours; the van is the one thing that is not from here. */
function addChapter2(atlas: AtlasBuilder): void {
  // --- The field gate: galvanised steel, five bars. Open ends, so the one-tile pieces join up. ---
  atlas.add(PROP.fieldGate.across, 16, 16, outlined((b) => {
    b.hline(0, 3, 16, 'bone');
    for (const y of [6, 9, 12]) b.hline(0, y, 16, 'fog');
    b.vline(7, 3, 10, 'bone').vline(8, 3, 10, 'steel');
  }));
  atlas.add(PROP.fieldGate.along, 16, 16, outlined((b) => {
    b.vline(6, 0, 16, 'fog').rect(7, 0, 2, 16, 'steel').vline(9, 0, 16, 'slate');
    for (const y of [3, 11]) b.hline(6, y, 4, 'fog');
  }));
  atlas.add(PROP.fieldGate.across3, 48, 16, outlined((b) => {
    b.hline(3, 3, 42, 'bone');
    for (const y of [6, 9, 12]) b.hline(3, y, 42, 'fog');
    b.line(4, 12, 43, 4, 'steel');
    for (const x of [17, 31]) b.vline(x, 3, 10, 'bone');
    // Timber posts; the latch end is the right one.
    for (const x of [0, 45]) b.rect(x, 1, 3, 14, 'peat').vline(x + 2, 2, 13, 'turf').hline(x, 1, 3, 'tan');
    b.rect(43, 7, 2, 2, 'coal');
  }));
  // The shed's sheep hurdle: two posts, three rails, a brace and a middle upright, lashed with orange baler twine.
  atlas.add(PROP.shedHurdle, 32, 16, outlined((b) => {
    for (const x of [0, 29]) b.rect(x, 0, 3, 16, 'peat').vline(x + 2, 1, 15, 'turf').hline(x, 0, 3, 'tan');
    for (const y of [3, 7, 11]) b.rect(3, y, 26, 2, 'peat').hline(3, y, 26, 'tan');
    b.line(4, 13, 27, 2, 'turf').line(4, 12, 27, 1, 'peat');
    b.rect(15, 2, 2, 12, 'peat').vline(16, 2, 12, 'turf');
    for (const [x, y] of [[2, 4], [28, 4], [2, 11], [28, 11]] as const) b.rect(x, y, 2, 2, 'amber').set(x, y, 'amberLight');
  }));
  // Brennan's yard gate, open: red tubular bars, a stone hinge pillar on the left, a length of chain off the free end.
  atlas.add(PROP.farmGateOpen, 48, 16, outlined((b) => {
    b.rect(0, 0, 5, 16, 'slate').rect(1, 1, 3, 14, 'steel').hline(0, 0, 5, 'fog');
    b.rect(5, 3, 2, 2, 'coal').rect(5, 11, 2, 2, 'coal');
    b.hline(7, 3, 39, 'alarm').hline(7, 4, 39, 'brickDark');
    for (const y of [6, 8, 10]) b.hline(7, y, 39, 'brick');
    b.hline(7, 12, 39, 'alarm').hline(7, 13, 39, 'brickDark');
    b.vline(7, 3, 11, 'alarm').vline(45, 3, 11, 'alarm');
    b.line(8, 12, 44, 4, 'brick');
    for (const x of [19, 32]) b.vline(x, 3, 10, 'brick');
    b.set(46, 8, 'steel').set(47, 9, 'fog').set(46, 10, 'steel').set(47, 11, 'fog').set(46, 12, 'steel');
  }));
  atlas.add(PROP.fieldGate.along3, 16, 48, outlined((b) => {
    b.vline(6, 4, 40, 'fog').rect(7, 4, 2, 40, 'steel').vline(9, 4, 40, 'slate');
    for (let y = 9; y < 42; y += 8) b.hline(6, y, 4, 'fog');
    for (const y of [0, 43]) b.rect(5, y, 6, 5, 'peat').hline(5, y, 6, 'tan').hline(5, y + 4, 6, 'turf');
  }));

  // --- Ground. No outline: it is scenery underfoot. ---
  const puddle = (name: string, w: number, h: number, glints: readonly [number, number, number][]): void => {
    atlas.add(name, w, h, (b) => {
      b.ellipse(0, 1, w, h - 2, 'turfDark').ellipse(2, 2, w - 4, h - 5, 'navyDark');
      for (const [x, y, len] of glints) b.hline(x, y, len, 'slate');
      b.set(Math.floor(w / 3), Math.floor(h / 3), 'fog');
    });
  };
  puddle(PROP.puddle, 32, 16, [[8, 5, 6], [17, 9, 5]]);
  puddle(PROP.puddleLarge, 48, 32, [[10, 8, 8], [26, 13, 9], [14, 20, 6], [30, 23, 5]]);
  atlas.add(PROP.cattleGrid, 16, 16, (b) => {
    // Bars run across the lane (up and down the screen) over a dark pit. Repeats in both directions.
    b.rect(0, 0, 16, 16, 'ink');
    for (let x = 1; x < 16; x += 4) b.vline(x, 0, 16, 'fog').vline(x + 1, 0, 16, 'steel');
  });
  // Twin rear wheels: each side leaves a pair of ruts. Transparent between them, so they sit on any ground.
  atlas.add(PROP.tyreTracks.across, 16, 16, (b) => {
    for (const y of [2, 4, 11, 13]) for (let x = 0; x < 16; x++) if ((x + y) % 4 !== 0) b.set(x, y, 'turfDark');
  });
  atlas.add(PROP.tyreTracks.along, 16, 16, (b) => {
    for (const x of [2, 4, 11, 13]) for (let y = 0; y < 16; y++) if ((x + y) % 4 !== 0) b.set(x, y, 'turfDark');
  });
  atlas.add(PROP.scorchRing, 144, 144, (b) => {
    // Nine tiles across: a perfect circle, which is the point. Charred band, a singed edge either side, bog inside.
    b.ellipse(0, 0, 144, 144, 'turfDark').ellipse(2, 2, 140, 140, 'ink').ellipse(9, 9, 126, 126, 'turfDark').ellipse(11, 11, 122, 122, null);
    // A few embers still going.
    for (const [x, y] of [[71, 5], [20, 27], [138, 70], [116, 124], [40, 131], [5, 84]] as const) b.set(x, y, 'amber');
  });

  // --- Obstacles and set dressing ---
  atlas.add(PROP.wheelbarrow, 24, 16, outlined((b) => {
    // Handles to the right, wheel to the left, a load of turf nobody came back for.
    b.rect(8, 2, 9, 3, 'turf').hline(9, 2, 7, 'peat').set(11, 1, 'peat').set(14, 1, 'turf');
    b.rect(5, 5, 14, 5, 'steel').hline(5, 5, 14, 'fog').hline(6, 9, 12, 'slate').set(5, 9, null).set(18, 9, null);
    b.line(18, 8, 22, 6, 'peat').set(23, 6, 'turfDark');
    b.vline(15, 10, 4, 'slate').set(16, 13, 'slate');
    b.ellipse(2, 8, 6, 6, 'coal').set(4, 10, 'fog').set(5, 11, 'steel');
  }));
  PROP.sleepingDog.forEach((name, i) => {
    atlas.add(name, 16, 16, outlined((b) => {
      // A collie, curled up, chin on the ground, white ruff and tail tip. Frame 1 is the breath in. It does not wake.
      b.ellipse(4, 7 - i, 11, 7 + i, 'coal');
      b.ellipse(1, 8, 7, 5, 'coal').set(2, 7, 'coal').set(3, 7, 'coal').set(3, 6, 'coal').set(6, 7, 'coal');
      b.vline(8, 8, 5, 'white').set(7, 12, 'white').rect(1, 10, 2, 2, 'white').set(4, 9, 'fog');
      b.hline(5, 13, 2, 'white').set(14, 11, 'white').set(13, 12, 'white').set(11, 8 - i, 'slate');
    }));
  });
  const van = (b: PixelBuffer): void => {
    // Facing right. Plain white, no markings: a cleaner rectangle on the side where a sign used to be.
    b.rect(2, 5, 32, 19, 'bone').hline(2, 5, 32, 'white').hline(2, 23, 32, 'fog').vline(2, 6, 18, 'fog');
    b.rect(8, 9, 18, 8, 'white').vline(30, 7, 16, 'fog');
    b.rect(34, 9, 9, 15, 'bone').rect(43, 15, 3, 9, 'bone').hline(34, 9, 9, 'white').hline(34, 23, 12, 'fog');
    b.rect(36, 11, 6, 5, 'dustyBlue').set(36, 11, 'skyPale').set(37, 11, 'skyPale').set(36, 12, 'skyPale');
    b.rect(45, 17, 1, 2, 'amberLight').rect(2, 16, 1, 2, 'alarm').hline(38, 18, 2, 'steel');
    // Twin wheels at the back (see the tracks), one at the front.
    b.ellipse(4, 20, 8, 8, 'ink').ellipse(10, 20, 8, 8, 'ink').ellipse(35, 20, 8, 8, 'ink');
    for (const x of [7, 13, 38]) b.rect(x, 23, 2, 2, 'steel');
  };
  atlas.add(PROP.van.right, 48, 32, outlined(van));
  atlas.add(PROP.van.left, 48, 32, outlined((b) => {
    const right = new PixelBuffer(48, 32);
    van(right);
    b.blit(right, 0, 0, true);
  }));
  atlas.add(PROP.leanTo, 64, 32, outlined((b) => {
    // Back wall of old boards under a tin roof that slopes to the front. Stand the crate and the flask in front of it.
    b.rect(3, 12, 58, 18, 'turf');
    for (let x = 10; x < 60; x += 8) b.vline(x, 12, 18, 'turfDark');
    b.hline(3, 29, 58, 'turfDark');
    b.rect(0, 2, 64, 10, 'steel').hline(0, 2, 64, 'fog').hline(0, 11, 64, 'slate');
    for (let x = 3; x < 64; x += 4) b.vline(x, 3, 8, 'slate');
    b.rect(45, 4, 5, 4, 'rust').set(46, 8, 'rust');
    for (const x of [1, 60]) b.rect(x, 12, 3, 19, 'peat').vline(x + 2, 12, 19, 'turfDark');
  }));
  atlas.add(PROP.honestyBox, 16, 16, outlined((b) => {
    // A biscuit tin with a slot cut in the lid.
    b.rect(3, 6, 10, 8, 'brick').hline(3, 13, 10, 'brickDark').vline(12, 7, 7, 'brickDark');
    b.rect(2, 4, 12, 3, 'amber').hline(2, 4, 12, 'amberLight').hline(6, 5, 4, 'ink');
  }));
  atlas.add(PROP.coffeeJar, 16, 16, outlined((b) => {
    b.rect(5, 6, 6, 8, 'turfDark').rect(5, 6, 6, 2, 'fog').vline(5, 6, 8, 'bone').rect(6, 9, 4, 3, 'amberLight');
    b.rect(5, 3, 6, 3, 'alarm').hline(5, 3, 6, 'motelPink');
  }));
  atlas.add(PROP.hayBale, 16, 16, outlined((b) => {
    b.rect(1, 3, 14, 12, 'corn').rect(1, 11, 14, 4, 'cornShade').hline(1, 3, 14, 'amberLight');
    b.vline(5, 3, 12, 'tanShade').vline(10, 3, 12, 'tanShade');
    b.set(3, 6, 'cornShade').set(8, 8, 'cornShade').set(12, 5, 'cornShade').set(7, 5, 'amberLight').set(13, 9, 'amberLight');
  }));
  atlas.add(PROP.feedBuckets, 16, 24, outlined((b) => {
    // Three stacked, leaning a little. They break into `debris` like any breakable.
    const bucket = (x: number, y: number): void => {
      b.rect(x, y, 8, 6, 'coal').hline(x - 1, y, 10, 'slate').vline(x, y + 1, 5, 'slate').hline(x + 2, y + 3, 4, 'amber');
    };
    bucket(5, 17);
    bucket(4, 10);
    bucket(5, 3);
    b.line(4, 2, 9, 0, 'fog').line(9, 0, 14, 2, 'fog');
  }));

  // --- Clues ---
  atlas.add(PROP.metalFragment, 16, 16, outlined((b) => {
    // Still warm. The stamped part number is a row of marks, never letters.
    b.line(4, 12, 10, 5, 'steel').line(5, 12, 11, 5, 'steel').line(6, 12, 12, 6, 'fog').line(7, 12, 12, 7, 'steel').hline(4, 13, 5, 'slate');
    b.set(7, 10, 'coal').set(8, 9, 'coal').set(9, 8, 'coal');
    b.set(11, 5, 'amber').set(12, 6, 'amberLight');
  }));
  atlas.add(PROP.boiledFrog, 16, 16, outlined((b) => {
    // On its back, legs out. A wisp of steam.
    b.ellipse(5, 8, 6, 5, 'grass').rect(6, 10, 4, 2, 'bone');
    b.set(4, 8, 'moss').set(3, 7, 'moss').set(11, 8, 'moss').set(12, 7, 'moss').set(4, 13, 'moss').set(3, 14, 'moss').set(11, 13, 'moss').set(12, 14, 'moss');
    b.set(8, 5, 'fog').set(7, 3, 'fog').set(8, 2, 'fog');
  }));
  atlas.add(PROP.burntWelly, 16, 16, outlined((b) => {
    // One. Moss green at the top, burnt black from the ankle down.
    b.rect(5, 2, 5, 6, 'moss').hline(5, 2, 5, 'grass').rect(5, 8, 5, 6, 'coal').rect(10, 11, 4, 3, 'coal');
    b.hline(5, 8, 5, 'turfDark').set(6, 7, 'turfDark').set(8, 7, 'turfDark').hline(5, 14, 9, 'slate').set(12, 9, 'fog');
  }));
  atlas.add(PROP.lanyard, 16, 16, outlined((b) => {
    // A visitor pass on a navy strap.
    b.line(4, 2, 7, 7, 'navy').line(11, 2, 8, 7, 'navy').hline(5, 2, 6, 'navy');
    b.rect(5, 8, 7, 6, 'white').rect(5, 8, 7, 2, 'teal').hline(6, 11, 4, 'fog').hline(6, 12, 3, 'fog');
  }));
  atlas.add(PROP.docket, 16, 16, outlined((b) => {
    // A carbon-copy delivery docket, one corner turned up. The signature box is empty.
    b.rect(3, 2, 10, 12, 'motelPink').rect(3, 2, 10, 2, 'bone').set(12, 13, null).set(12, 12, 'bone').set(11, 13, 'bone');
    for (const y of [5, 7, 9]) b.hline(4, y, y === 7 ? 6 : 8, 'motelPinkShade');
    b.rect(8, 11, 3, 2, 'white');
  }));
}

export function propsSheet(): Sheet {
  const atlas = new AtlasBuilder(PROPS_KEY, 256);

  atlas.add(PROP.keg, 16, 16, outlined((b) => {
    b.ellipse(2, 1, 12, 14, 'steel');
    b.ellipse(3, 2, 10, 8, 'fog');
    b.ellipse(6, 4, 4, 3, 'slate');
    b.hline(3, 11, 10, 'slate').hline(4, 13, 8, 'coal');
  }));
  atlas.add(PROP.crate, 16, 16, outlined((b) => {
    b.rect(1, 1, 14, 14, 'peat').rect(1, 10, 14, 5, 'turf');
    b.hline(1, 1, 14, 'tan').line(2, 2, 13, 9, 'turf').line(13, 2, 2, 9, 'turf').vline(8, 10, 5, 'turfDark');
  }));
  atlas.add(PROP.noticeboard, 16, 24, outlined((b) => {
    b.rect(1, 2, 14, 12, 'peat').rect(2, 3, 12, 10, 'tan');
    b.rect(3, 4, 4, 3, 'white').rect(8, 4, 5, 4, 'bone').rect(4, 8, 5, 4, 'amberLight').set(10, 10, 'alarm');
    b.rect(3, 14, 2, 9, 'turfDark').rect(11, 14, 2, 9, 'turfDark');
  }));
  atlas.add(PROP.vendingMachine, 16, 24, outlined((b) => {
    b.rect(1, 1, 14, 22, 'navy').vline(14, 2, 21, 'navyDark').hline(1, 1, 14, 'dustyBlue');
    b.rect(3, 3, 8, 12, 'fluoro');
    for (let y = 4; y < 14; y += 3) for (let x = 4; x < 10; x += 2) b.set(x, y, y % 2 === 0 ? 'alarm' : 'amber');
    b.rect(12, 5, 2, 4, 'coal').rect(3, 18, 8, 3, 'ink');
  }));
  atlas.add(PROP.bins, 16, 16, outlined((b) => {
    b.rect(1, 4, 6, 11, 'moss').hline(1, 4, 6, 'grass').rect(0, 3, 8, 1, 'mossDark');
    b.ellipse(8, 7, 7, 8, 'coal').set(11, 6, 'slate');
  }));

  atlas.add(PROP.barrel, 16, 16, outlined((b) => {
    b.ellipse(2, 1, 12, 14, 'peat').rect(3, 3, 10, 10, 'peat');
    b.hline(2, 4, 12, 'steel').hline(2, 11, 12, 'steel').vline(6, 2, 12, 'turf').vline(10, 2, 12, 'turf').hline(4, 1, 8, 'tan');
  }));
  atlas.add(PROP.bottleCrate, 16, 16, outlined((b) => {
    b.rect(1, 6, 14, 9, 'amber').hline(1, 14, 14, 'peat').vline(5, 7, 7, 'peat').vline(10, 7, 7, 'peat');
    for (const x of [3, 7, 12]) b.rect(x, 2, 2, 5, 'moss').set(x, 1, 'bone');
  }));
  atlas.add(PROP.cardboardBox, 16, 16, outlined((b) => {
    b.rect(2, 4, 12, 11, 'tan').hline(2, 14, 12, 'tanShade').vline(13, 5, 10, 'tanShade').hline(2, 4, 12, 'sand').vline(8, 4, 5, 'tanShade');
  }));
  atlas.add(PROP.flowerPot, 16, 16, outlined((b) => {
    b.rect(5, 9, 6, 6, 'brick').hline(4, 9, 8, 'brickDark').ellipse(3, 2, 10, 8, 'grass').set(5, 4, 'motelPink').set(9, 3, 'amberLight').set(8, 6, 'motelPink');
  }));
  atlas.add(PROP.sack, 16, 16, outlined((b) => {
    b.ellipse(3, 4, 10, 11, 'bone').hline(4, 14, 8, 'fog').rect(6, 2, 4, 3, 'bone').hline(6, 4, 4, 'peat');
  }));
  PROP.debris.forEach((name, i) => {
    atlas.add(name, 16, 16, (b) => {
      // Splinters and shards on the ground; not solid, no outline.
      const bits: [number, number, number, number][] = i === 0 ? [[3, 10, 4, 2], [9, 12, 3, 1], [6, 13, 2, 2], [11, 9, 2, 2]] : [[2, 12, 3, 1], [7, 13, 4, 1], [12, 11, 2, 2], [5, 10, 2, 1]];
      for (const [x, y, w, h] of bits) b.rect(x, y, w, h, 'turf');
      b.set(8, 11, 'fog').set(4, 13, 'tan').set(12, 13, 'fog');
    });
  });

  atlas.add(PROP.fruitMachine, 16, 24, outlined((b) => {
    b.rect(1, 1, 14, 22, 'brickDark').vline(14, 2, 21, 'ink').hline(1, 1, 14, 'brick');
    b.rect(3, 3, 10, 5, 'amberLight').rect(3, 9, 10, 5, 'coal');
    b.rect(4, 10, 2, 3, 'alarm').rect(7, 10, 2, 3, 'amber').rect(10, 10, 2, 3, 'grass');
    b.rect(4, 16, 3, 2, 'amber').rect(9, 16, 3, 2, 'alarm').rect(5, 20, 6, 2, 'ink');
  }));
  atlas.add(PROP.dartboard, 16, 16, outlined((b) => {
    b.ellipse(2, 2, 12, 12, 'coal').ellipse(4, 4, 8, 8, 'bone').ellipse(6, 6, 4, 4, 'moss').rect(7, 7, 2, 2, 'alarm');
    b.line(10, 3, 12, 1, 'fog');
  }));
  atlas.add(PROP.trophyShelf, 32, 16, outlined((b) => {
    b.rect(1, 12, 30, 3, 'peat').hline(1, 12, 30, 'tan');
    for (const x of [5, 14, 23]) {
      b.rect(x, 3, 5, 5, 'amberLight').rect(x + 1, 8, 3, 2, 'amber').rect(x, 10, 5, 2, 'turfDark');
      b.set(x - 1, 4, 'amber').set(x + 5, 4, 'amber');
    }
  }));
  atlas.add(PROP.teamPhoto, 16, 16, outlined((b) => {
    b.rect(1, 2, 14, 11, 'peat').rect(2, 3, 12, 9, 'bone');
    for (let x = 3; x < 13; x += 2) b.set(x, 5, 'skin').set(x, 6, 'grass').set(x, 9, 'skin').set(x, 10, 'grass');
  }));
  atlas.add(PROP.beerTaps, 16, 16, outlined((b) => {
    for (const x of [3, 7, 11]) b.rect(x, 3, 2, 9, 'fog').rect(x - 1, 2, 4, 3, x === 7 ? 'coal' : 'amber');
    b.rect(1, 12, 14, 2, 'steel');
  }));
  atlas.add(PROP.telly, 16, 16, outlined((b) => {
    b.rect(1, 2, 14, 10, 'coal').rect(2, 3, 12, 8, 'dustyBlue').rect(3, 4, 4, 2, 'skyPale').rect(6, 12, 4, 2, 'slate');
  }));
  atlas.add(PROP.tractor, 48, 32, outlined((b) => {
    b.rect(8, 10, 24, 12, 'alarm').hline(8, 21, 24, 'brickDark').vline(31, 11, 11, 'brickDark');
    b.rect(20, 2, 12, 10, 'coal').rect(22, 4, 8, 6, 'skyPale');
    b.rect(32, 14, 10, 8, 'alarm').hline(32, 21, 10, 'brickDark').rect(40, 8, 2, 6, 'coal');
    b.ellipse(8, 14, 18, 18, 'ink').ellipse(13, 19, 8, 8, 'slate').ellipse(15, 21, 4, 4, 'fog');
    b.ellipse(33, 21, 11, 11, 'ink').ellipse(36, 24, 5, 5, 'slate');
  }));
  atlas.add(PROP.churchGate, 32, 32, outlined((b) => {
    b.rect(1, 6, 5, 25, 'slate').rect(26, 6, 5, 25, 'slate').rect(0, 4, 7, 3, 'steel').rect(25, 4, 7, 3, 'steel');
    for (let x = 8; x < 25; x += 3) b.rect(x, 9, 1, 21, 'coal').set(x, 8, 'fog');
    b.hline(6, 12, 20, 'coal').hline(6, 26, 20, 'coal');
    b.rect(15, 1, 2, 6, 'fog').rect(13, 3, 6, 1, 'fog');
  }));
  // A builder's skip from above: yellow sides sloping in, a dark rim, rubble and a door off a kitchen press inside.
  atlas.add(PROP.skip, 32, 32, outlined((b) => {
    b.rect(1, 6, 30, 22, 'amber').rect(3, 4, 26, 2, 'amberLight').rect(1, 26, 30, 3, 'peat');
    b.rect(4, 7, 24, 17, 'coal');
    b.rect(5, 12, 6, 5, 'brick').rect(11, 9, 5, 4, 'tan').rect(17, 14, 8, 3, 'slate').rect(13, 17, 5, 5, 'brick');
    b.rect(19, 8, 7, 5, 'peat').hline(19, 10, 7, 'turfDark').set(24, 11, 'fog');
    b.set(8, 19, 'fog').set(23, 20, 'tan').set(6, 21, 'slate').rect(9, 21, 3, 2, 'tan');
    b.vline(1, 7, 19, 'amberLight').vline(30, 7, 19, 'peat');
    for (const x of [6, 15, 24]) b.rect(x, 26, 2, 3, 'coal');
  }));
  // Steam off the urn or the flask: two thin wisps rising and leaning, low in the cell so it sits on the lid.
  PROP.steam.forEach((name, i) => {
    atlas.add(name, 16, 16, (b) => {
      for (let k = 0; k < 2; k++) {
        const x0 = 6 + k * 4;
        for (let y = 15; y >= 5; y--) {
          const x = Math.round(x0 + Math.sin((y + i * 3 + k * 5) * 0.7) * 1.2);
          if ((y + i + k) % 5 === 0) continue;
          b.set(x, y, y < 9 ? 'fog' : 'white');
        }
      }
    });
  });
  // The keg yard gate: boards top to bottom, two rails and a brace, a steel bolt shot across. It fills the gateway.
  atlas.add(PROP.yardGate, 16, 16, outlined((b) => {
    b.rect(1, 0, 14, 16, 'peat');
    for (let x = 4; x < 15; x += 3) b.vline(x, 0, 16, 'turfDark');
    b.rect(1, 2, 14, 2, 'turf').rect(1, 12, 14, 2, 'turf').line(2, 11, 13, 4, 'turf');
    b.hline(1, 2, 14, 'tan').hline(1, 12, 14, 'tan');
    b.rect(5, 7, 8, 2, 'steel').rect(11, 6, 2, 4, 'fog').set(5, 7, 'fog');
    b.rect(1, 1, 2, 4, 'coal').rect(1, 11, 2, 4, 'coal');
  }));
  const sign = (name: string, base: 'amberLight' | 'grass' | 'brick', accent: 'alarm' | 'white' | 'amberLight'): void => {
    atlas.add(name, 32, 16, outlined((b) => {
      b.rect(1, 2, 30, 11, base).hline(1, 2, 30, 'white').hline(1, 12, 30, 'coal');
      // Shapes that suggest lettering without being text (text is never drawn into art).
      for (let x = 4; x < 28; x += 4) b.rect(x, 5, 3, 5, accent);
    }));
  };
  sign(PROP.chipperSign, 'amberLight', 'alarm');
  sign(PROP.bookiesSign, 'grass', 'white');
  sign(PROP.pubSign, 'brick', 'amberLight');
  atlas.add(PROP.foldedJacket, 16, 16, outlined((b) => {
    b.rect(3, 8, 10, 5, 'turfDark').hline(3, 8, 10, 'turf').vline(8, 9, 4, 'ink');
  }));
  PROP.bogLights.forEach((name, i) => {
    atlas.add(name, 48, 16, (b) => {
      // Three soft lights in a row; they pulse out of step. No outline: they are not solid.
      [6, 22, 38].forEach((x, n) => {
        const big = (n + i) % 3 === 0;
        b.ellipse(x - (big ? 1 : 0), 5 - (big ? 1 : 0), big ? 8 : 6, big ? 8 : 6, 'fluoro');
        b.ellipse(x + 1, 6, 4, 4, 'white');
        b.set(x + 3, 13, 'skyPale');
      });
    });
  });

  addChapter2(atlas);
  addChapters3And4(atlas);
  addChapters5And6(atlas);
  addChapters7And8(atlas);

  for (const [name, w, h, rows] of HOT_DRINKS) atlas.add(name, w, h, pic(rows));
  for (const [id, draw] of Object.entries(WEAPON_PROPS)) atlas.add(PROP.weapon[id as Exclude<WeaponId, 'fists'>], 16, 16, draw);

  return atlas.build();
}
