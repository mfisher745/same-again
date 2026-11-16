/**
 * HUD and world icons (12 x 12), effects (16 x 16) and the 1 x 1 pixel.
 * Frame names are in keys.ts.
 */

import type { AbilityId, DrinkId, FoodId, MoveId, OverhaulDrinkId, WeaponId } from '../core/types';
import { TEX, fx, icon } from './keys';
import type { ColourName } from './palette';
import { PixelBuffer, SheetBuilder } from './pixels';
import type { Sheet } from './pixels';

type Draw = (b: PixelBuffer) => void;

const outlined = (draw: Draw): Draw => (b) => {
  const layer = new PixelBuffer(b.width, b.height);
  draw(layer);
  layer.outline('ink');
  b.blit(layer, 0, 0);
};

/**
 * A pint glass filled to `level` of 3. Drawn with a light rim and no ink
 * outline, because it sits on the dark HUD strip where an ink outline vanishes.
 */
const pint =
  (level: 0 | 1 | 2 | 3): Draw =>
  (b) => {
    const rim = level === 0 ? 'steel' : 'bone';
    b.rect(2, 1, 8, 10, rim);
    b.rect(3, 1, 6, 9, 'coal');
    if (level > 0) {
      const h = level === 3 ? 9 : level === 2 ? 5 : 3;
      b.rect(3, 10 - h, 6, h, 'turf');
      b.rect(3, 10 - h, 6, level === 3 ? 3 : 1, 'white');
    }
  };

/** A five-fingered cannabis leaf, symmetrical about the cell's centre line, with a short stem. */
const leaf =
  (blade: ColourName, stem: ColourName): Draw =>
  (b) => {
    b.rect(5, 0, 2, 8, blade);
    b.line(4, 7, 1, 2, blade).line(4, 6, 2, 3, blade);
    b.line(7, 7, 10, 2, blade).line(7, 6, 9, 3, blade);
    b.line(4, 8, 0, 6, blade).line(7, 8, 11, 6, blade);
    b.line(4, 9, 2, 10, blade).line(7, 9, 9, 10, blade);
    b.rect(5, 8, 2, 4, stem);
  };

/** A bottle: body colour, label colour, and how tall. */
const bottle = (body: ColourName, label: ColourName, tall = true): Draw =>
  outlined((b) => {
    const top = tall ? 1 : 3;
    b.rect(5, top, 2, 3, body);
    b.rect(4, top + 3, 4, 10 - top - 3, body);
    b.rect(4, 6, 4, 2, label);
    b.set(5, top, 'bone');
  });

const can = (body: ColourName, band: ColourName): Draw =>
  outlined((b) => {
    b.rect(4, 3, 4, 7, body);
    b.hline(4, 3, 4, 'fog').hline(4, 6, 4, band).vline(7, 4, 6, 'steel');
  });

/** One letter per palette colour, for `stamp`-drawn icons. '.' is transparent. */
export const K: Readonly<Record<string, ColourName>> = {
  k: 'ink', c: 'coal', s: 'slate', S: 'steel', f: 'fog', b: 'bone', w: 'white',
  n: 'skin', N: 'skinShade', a: 'anorak', m: 'moss', M: 'mossDark', g: 'grass',
  t: 'turf', T: 'turfDark', p: 'peat', A: 'amber', Y: 'amberLight', r: 'alarm',
  B: 'brick', R: 'brickDark', v: 'navy', u: 'dustyBlue', U: 'skyPale', l: 'lime', L: 'limeShade',
  x: 'tan', X: 'tanShade', e: 'teal', E: 'tealDark', i: 'violet', G: 'alienGrey', o: 'corn', O: 'cornShade',
};

/** A 12 x 12 picture from rows of letters (see `K`), ink-outlined unless `bare`. */
const pic = (rows: readonly string[], bare = false): Draw => {
  const draw: Draw = (b) => void b.stamp(0, 0, rows, K);
  return bare ? draw : outlined(draw);
};

const DRINKS: Readonly<Record<DrinkId, Draw>> = {
  stout: pint(3),
  whiskey: bottle('amber', 'bone', false),
  poitin: bottle('skyPale', 'fog'),
  lightBeer: can('fog', 'navy'),
  bourbon: bottle('peat', 'amberLight', false),
  craftIpa: can('magenta', 'lime'),
  tequila: bottle('amberLight', 'alarm'),
  water: bottle('dustyBlue', 'white'),
};

const FOODS: Readonly<Record<FoodId, Draw>> = {
  crisps: outlined((b) => {
    b.rect(3, 2, 6, 8, 'grass').hline(3, 2, 6, 'moss').hline(3, 9, 6, 'moss').rect(5, 5, 2, 2, 'amberLight');
  }),
  chickenFilletRoll: outlined((b) => {
    b.rect(1, 5, 10, 4, 'tan').hline(1, 8, 10, 'tanShade').hline(2, 6, 8, 'amberLight').set(3, 6, 'grass').set(7, 6, 'grass');
  }),
  breakfastRoll: outlined((b) => {
    b.rect(1, 5, 10, 4, 'tan').hline(1, 8, 10, 'tanShade').hline(2, 6, 8, 'brick').set(4, 6, 'amberLight').set(8, 6, 'white');
  }),
  spiceBag: outlined((b) => {
    b.rect(3, 3, 6, 7, 'tan').hline(3, 9, 6, 'tanShade').hline(4, 2, 4, 'amber').set(5, 1, 'alarm').set(7, 1, 'amberLight').rect(5, 5, 2, 2, 'alarm');
  }),
  tea: outlined((b) => {
    b.rect(3, 5, 5, 5, 'white').hline(3, 9, 5, 'fog').hline(4, 5, 3, 'peat').set(8, 6, 'white').set(9, 7, 'white').set(8, 8, 'white');
    b.set(5, 2, 'fog').set(6, 3, 'fog');
  }),
};

const ABILITIES: Readonly<Record<AbilityId, Draw>> = {
  punchCombo: outlined((b) => {
    b.rect(3, 4, 6, 5, 'skin').hline(3, 8, 6, 'skinShade').vline(5, 4, 2, 'skinShade').vline(7, 4, 2, 'skinShade').rect(1, 6, 2, 3, 'anorak');
  }),
  bottleThrow: outlined((b) => {
    b.line(3, 8, 7, 4, 'moss').line(4, 9, 8, 5, 'moss').set(8, 3, 'mossDark').set(2, 3, 'fog').set(1, 5, 'fog');
  }),
  stumble: outlined((b) => {
    b.rect(6, 2, 3, 3, 'skin').line(6, 5, 3, 8, 'anorak').line(4, 8, 2, 10, 'denim').line(5, 8, 7, 10, 'denim');
  }),
  stoutSlam: (b) => {
    b.rect(3, 1, 6, 8, 'bone').rect(4, 1, 4, 7, 'turf').rect(4, 1, 4, 2, 'white');
    b.hline(0, 10, 12, 'amberLight').set(1, 8, 'amber').set(10, 8, 'amber').set(0, 6, 'amber').set(11, 6, 'amber');
  },
  actNatural: outlined((b) => {
    b.rect(4, 2, 4, 3, 'skin').rect(3, 5, 6, 5, 'anorak').set(5, 3, 'ink').set(7, 3, 'ink').set(9, 1, 'fog').set(10, 2, 'fog');
  }),
  hurley: outlined((b) => {
    b.line(2, 2, 7, 7, 'peat').rect(7, 7, 3, 3, 'tan');
  }),
  sliotarStrike: outlined((b) => {
    b.ellipse(5, 2, 5, 5, 'white').line(5, 4, 9, 4, 'alarm').set(2, 8, 'fog').set(3, 7, 'fog').set(1, 9, 'fog');
  }),
  poitinBreath: outlined((b) => {
    b.rect(1, 5, 2, 2, 'skin').rect(3, 4, 3, 4, 'amber').rect(6, 3, 3, 6, 'amberLight').rect(9, 4, 2, 4, 'alarm');
  }),
  borrowedGlove: outlined((b) => {
    b.rect(3, 4, 6, 6, 'teal').hline(3, 9, 6, 'tealDark').vline(3, 2, 2, 'teal').vline(5, 1, 3, 'teal').vline(7, 2, 2, 'teal').rect(5, 6, 2, 2, 'violet');
  }),
};

/** Hot drinks: a mug with steam. Coffee is a brick-red pub mug; tea is white, with the bag's tag over the side. */
const COFFEE = pic([
  '....f.f.....',
  '...f.f......',
  '....f.f.....',
  '............',
  '..BBBBBBB...',
  '..BTTTTTR...',
  '..BBBBBBRBB.',
  '..BBBBBBR.B.',
  '..BBBBBBRBB.',
  '..BBBBBBR...',
  '...RRRRRR...',
  '............',
]);
const TEA = pic([
  '......f.....',
  '.....f......',
  '......f.....',
  '............',
  '.bwwwwwww...',
  '.bwpppppf...',
  '.bwwwwwwfww.',
  'YYwwwwwwf.w.',
  'YYwwwwwwfww.',
  '..wwwwwwf...',
  '...ffffff...',
  '............',
]);

/** Overhaul drinks not already drawn under the old `DrinkId`s. */
const OVERHAUL_DRINKS: Readonly<Record<Exclude<OverhaulDrinkId, DrinkId> | 'bottle', Draw>> = {
  lager: can('amberLight', 'moss'),
  coffee: COFFEE,
  tea: TEA,
  bottle: bottle('moss', 'mossDark'),
};

/** The thirteen moves. DESIGN.md 7.2. Old ability pictures are reused where the move is the same idea. */
const MOVES: Readonly<Record<MoveId, Draw>> = {
  // Head down, shoulder first, and something about to be in the way.
  shoulder: pic([
    '............',
    '............',
    '..aaaa......',
    'f.aaaaaaa...',
    '..aaaaaaaaa.',
    'ff.aaaaaaaaY',
    '...aaaaTTn..',
    'f..aaaa.nn.Y',
    '...dd.dd....',
    '..dd...dd...',
    '.bb.....bb..',
    '............',
  ]),
  // A reflex hammer: red rubber head, steel handle, a spark where the knee was.
  reflexTest: pic([
    '............',
    '.rrrr.......',
    '.rrrrr......',
    '..rrrSS.....',
    '...rrSfS....',
    'Y.....fS....',
    '.Y.....fS...',
    '........fS..',
    '.........fS.',
    '..........S.',
    '............',
    '............',
  ]),
  actNatural: ABILITIES.actNatural,
  stoutSlam: ABILITIES.stoutSlam,
  // Two pints, the second exactly like the first. No outline: it sits on the dark strip like the pint.
  sameAgain: pic(
    [
      '............',
      '..bbbbb.....',
      '..bwwwb.....',
      '..btttbbbbb.',
      '..btttbwwwb.',
      '..btttbtttb.',
      '..btttbtttb.',
      '..btttbtttb.',
      '..bbbbbtttb.',
      '......btttb.',
      '......bbbbb.',
      '............',
    ],
    true,
  ),
  // A stethoscope.
  bedsideManner: pic([
    '.w......w...',
    '.e......e...',
    '.e......e...',
    '..e....e....',
    '...e..e.....',
    '....ee......',
    '....e...ff..',
    '....e..ffff.',
    '.....e.fSSf.',
    '......efSSf.',
    '........ff..',
    '............',
  ]),
  stumble: ABILITIES.stumble,
  // A padlock. Nobody leaves.
  lockIn: pic([
    '............',
    '....ffff....',
    '...fS..Sf...',
    '...f....f...',
    '...f....f...',
    '..YYYYYYYY..',
    '..AAAAAAAA..',
    '..AAAkkAAA..',
    '..AAAkkAAA..',
    '..AAAAAAAA..',
    '..pppppppp..',
    '............',
  ]),
  // An X-ray: one bone, and where it is going to go.
  secondOpinion: pic([
    '............',
    '............',
    '.uuuuuuuuuu.',
    '.uvvvvvvvvu.',
    '.uwwvvvvwwu.',
    '.uvwwrwwwvu.',
    '.uvwwwrwwvu.',
    '.uwwvvvvwwu.',
    '.uvvvvvvvvu.',
    '.uuuuuuuuuu.',
    '............',
    '............',
  ]),
  borrowedGlove: ABILITIES.borrowedGlove,
  // One punch, side on, and it lands.
  oneForTheRoad: pic([
    '............',
    '..........Y.',
    '.........Y..',
    '....nnnnn..Y',
    'aaaannnnnN..',
    'aaaannNnnNYY',
    'aaaannnnnN..',
    'aaaaNNnnnN.Y',
    '....nnnnN...',
    '.........Y..',
    '..........Y.',
    '............',
  ]),
  // The bell behind the bar.
  lastOrders: pic([
    '.....pp.....',
    '.....AA.....',
    '.f..YYAA..f.',
    'f..YYAAAA..f',
    '...YAAAAA...',
    '...YAAAAA...',
    '..YAAAAAAA..',
    '.YAAAAAAAAA.',
    '.OOOOOOOOOO.',
    '.....SS.....',
    '............',
    '............',
  ]),
  // A door with a bar across it.
  barred: pic([
    '............',
    '..pppppppp..',
    '..pttppttp..',
    '..pttppttp..',
    '..pttppttp..',
    'frrrrrrrrrrf',
    'RRRRRRRRRRRR',
    '..pttpptYp..',
    '..pttppttp..',
    '..pttppttp..',
    '..pppppppp..',
    '............',
  ]),
};

/** The seven melee weapons. DESIGN.md 7.2. */
export const WEAPONS: Readonly<Record<WeaponId, Draw>> = {
  fists: ABILITIES.punchCombo,
  // Big Tom's hurley: black grip tape, pale ash, a steel band on the bas.
  hurley: pic([
    '............',
    '.cc.........',
    '.ccc........',
    '..cxx.......',
    '...xxX......',
    '....xxX.....',
    '.....xxX....',
    '......xxxX..',
    '.....xxxxxX.',
    '.....xxxxSX.',
    '......xxxX..',
    '............',
  ]),
  // Halloran's clipboard: a form, half filled in.
  clipboard: pic([
    '............',
    '....ffff....',
    '..ppSSSSpp..',
    '..pwwwwwwp..',
    '..pwsssswp..',
    '..pwwwwwwp..',
    '..pwssswwp..',
    '..pwwwwwwp..',
    '..pwsssswp..',
    '..pwwwwwwp..',
    '..pppppppp..',
    '............',
  ]),
  // The souvenir shillelagh: a knob, some knots and a green ribbon.
  shillelagh: pic([
    '..ppp.......',
    '.ppppp......',
    '.ppptt......',
    '..ttggg.....',
    '...gptg.....',
    '.....pt.....',
    '......ptp...',
    '.......pt...',
    '........pt..',
    '.........pt.',
    '..........p.',
    '............',
  ]),
  // Pruitt's umbrella, open: government navy.
  umbrella: pic([
    '............',
    '.....SS.....',
    '....vvvv....',
    '..vvvvvvvv..',
    '.vvuvvvvuvv.',
    '.vuvvvvvvuv.',
    '.vvvvvvvvvv.',
    '.v.vv.fvv.v.',
    '......f.....',
    '......f.....',
    '....p.p.....',
    '.....p......',
  ]),
  // The inflatable alien, arms out.
  inflatableAlien: pic([
    '...llllll...',
    '..lwlllllL..',
    '..llllllll..',
    '..lkkllkkL..',
    '..llkllklL..',
    '...llllLL...',
    '....lllL....',
    '.llllllllll.',
    '....llll....',
    '....l..l....',
    '...ll..ll...',
    '............',
  ]),
  // The security wand: a paddle, a light, and it beeps.
  securityWand: pic([
    '..........l.',
    '....ffff.l..',
    '...fSSSSf.l.',
    '...fSssSf...',
    '...fSssSf...',
    '...fSssSf...',
    '...fSSSSf...',
    '....flrf....',
    '.....ss.....',
    '.....ss.....',
    '.....ss.....',
    '............',
  ]),
};

/** Out in the sun (chapter 8). No outline: it is the brightest thing on the strip. */
const SUN = pic(
  [
    '.....YY.....',
    '.Y...YY...Y.',
    '..Y......Y..',
    '....YYYY....',
    '...YYYYYY...',
    'YY.YYYYYA.YY',
    'YY.YYYYYA.YY',
    '...YYYYAA...',
    '....AAAA....',
    '..Y......Y..',
    '.Y...YY...Y.',
    '.....YY.....',
  ],
  true,
);

export function iconSheet(): Sheet {
  const sheet = new SheetBuilder(TEX.icons, 12, 12, 8);
  sheet.cell(icon.pintFull, pint(3));
  sheet.cell(icon.pintHalf, pint(2));
  sheet.cell(icon.pintEmpty, pint(0));
  sheet.cell(icon.empty, bottle('moss', 'mossDark'));
  // Myko calls: a cannabis leaf each. No ink outline on the dark strip.
  sheet.cell(icon.leaf, leaf('grass', 'moss'));
  sheet.cell(icon.leafSpent, leaf('slate', 'slate'));
  sheet.cell(
    icon.detection,
    outlined((b) => {
      b.rect(5, 1, 2, 6, 'amberLight').rect(5, 9, 2, 2, 'amberLight');
    }),
  );
  sheet.cell(
    icon.interact,
    outlined((b) => {
      b.rect(2, 2, 8, 8, 'bone').hline(2, 9, 8, 'fog').rect(4, 4, 1, 4, 'ink').hline(4, 4, 4, 'ink').hline(4, 5, 3, 'ink').hline(4, 7, 4, 'ink');
    }),
  );
  // Mouse buttons for the HUD: a light mouse with the button in question lit.
  const mouse = (right: boolean): Draw => (b) => {
    b.rect(3, 1, 6, 10, 'fog').rect(3, 1, 6, 4, 'steel').vline(6, 1, 4, 'coal');
    b.rect(right ? 7 : 3, 1, right ? 2 : 3, 4, 'amberLight');
    b.set(3, 1, null).set(8, 1, null).set(3, 10, null).set(8, 10, null);
  };
  sheet.cell(icon.mouseLeft, mouse(false));
  sheet.cell(icon.mouseRight, mouse(true));
  for (const [id, draw] of Object.entries(DRINKS)) sheet.cell(icon.drink(id as DrinkId), draw);
  for (const [id, draw] of Object.entries(FOODS)) sheet.cell(icon.food(id as FoodId), draw);
  for (const [id, draw] of Object.entries(ABILITIES)) sheet.cell(icon.ability(id as AbilityId), draw);
  for (const [id, draw] of Object.entries(OVERHAUL_DRINKS)) sheet.cell(icon.drink(id as OverhaulDrinkId | 'bottle'), draw);
  for (const [id, draw] of Object.entries(MOVES)) sheet.cell(icon.move(id as MoveId), draw);
  for (const [id, draw] of Object.entries(WEAPONS)) sheet.cell(icon.weapon(id as WeaponId), draw);
  sheet.cell(icon.sun, SUN);
  return sheet.build();
}

/** Lobes of Myko's smoke: centre and radius in a 16x16 cell, and how far each rolls round over the loop. */
const PUFF_LOBES: readonly (readonly [x: number, y: number, r: number, roll: number])[] = [
  [8, 10.5, 3.6, 0.6],
  [4.8, 9.5, 2.8, 0.9],
  [11.4, 9.2, 2.9, 0.8],
  [6.6, 6.6, 2.9, 1],
  [10, 6.2, 2.4, 1.1],
  [8.2, 4, 1.7, 0.8],
];

/** One frame of the standing-still smoke. Each lobe circles on its own phase, so the outline changes but the mass does not. */
export function drawSmokePuff(b: PixelBuffer, frame: number, frames: number): void {
  const phase = (frame / frames) * Math.PI * 2;
  const lobes = PUFF_LOBES.map(([x, y, r, roll], k) => {
    const a = phase + k * 1.7;
    return { x: x + Math.cos(a) * roll, y: y + Math.sin(a) * roll * 0.6, r: r + Math.sin(a * 2) * 0.25 };
  });
  const inLobe = (px: number, py: number, dy = 0): boolean => lobes.some((l) => (px + 0.5 - l.x) ** 2 + (py + 0.5 - l.y - dy) ** 2 <= l.r * l.r);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (!inLobe(x, y)) continue;
      // Underside: the pixel just above is outside a lobe shifted down, i.e. it is the bottom edge of the mass.
      const under = !inLobe(x, y + 1) || !inLobe(x, y, -1.2);
      // Top: open air above it, lit from the upper left.
      const top = !inLobe(x, y - 1);
      b.set(x, y, under ? 'steel' : top && x < 10 ? 'white' : 'fog');
    }
  }
  // Seams between the lobes: a darker fleck where two lobes overlap near their edges.
  for (const l of lobes.slice(1, 4)) {
    const sx = Math.round(l.x + l.r * 0.5);
    const sy = Math.round(l.y + l.r * 0.6);
    if (inLobe(sx, sy) && inLobe(sx, sy + 1)) b.set(sx, sy, 'steel');
  }
  // The wisp: three or four pixels curling up off the top, swaying with the loop.
  for (let k = 0; k < 4; k++) {
    const wy = 3 - k;
    const wx = Math.round(8 + Math.sin(phase + k * 0.9) * 1.5 + k * 0.4);
    if (wy >= 0 && !inLobe(wx, wy)) b.set(wx, wy, k === 3 ? 'steel' : 'fog');
  }
}

export function fxSheet(): Sheet {
  const sheet = new SheetBuilder(TEX.fx, 16, 16, 8);
  sheet.cell(fx.bottle, outlined((b) => void b.rect(6, 4, 3, 7, 'moss').rect(7, 2, 1, 2, 'mossDark').vline(6, 5, 5, 'grass')));
  fx.bottleSmash.forEach((name, i) =>
    sheet.cell(name, (b) => {
      const r = 2 + i * 2;
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [1, 0]] as const) b.set(8 + dx * r, 8 + dy * r, i === 2 ? 'mossDark' : 'grass');
      if (i === 0) b.rect(7, 7, 2, 2, 'white');
    }),
  );
  sheet.cell(fx.sliotar, outlined((b) => void b.ellipse(5, 5, 5, 5, 'white').line(6, 7, 8, 7, 'alarm')));
  sheet.cell(fx.dart, (b) => void b.rect(5, 7, 5, 1, 'amberLight').set(10, 7, 'white').set(4, 7, 'amber'));
  sheet.cell(fx.bolt, (b) => void b.rect(5, 6, 6, 3, 'alarm').rect(6, 7, 4, 1, 'amberLight'));
  sheet.cell(fx.ray, (b) => void b.rect(4, 7, 8, 2, 'teal').rect(5, 7, 6, 1, 'fluoro'));
  sheet.cell(fx.box, outlined((b) => void b.rect(4, 4, 8, 8, 'peat').hline(4, 4, 8, 'tan').vline(11, 5, 7, 'turf').hline(4, 7, 8, 'turf')));
  sheet.cell(fx.bale, outlined((b) => void b.rect(3, 5, 10, 7, 'corn').hline(3, 11, 10, 'cornShade').vline(6, 5, 7, 'cornShade').vline(10, 5, 7, 'cornShade')));
  fx.fire.forEach((name, i) =>
    sheet.cell(name, (b) => {
      b.ellipse(3, 4 + i, 10, 9 - i, 'alarm').ellipse(5, 6 + i, 6, 6 - i, 'amber').ellipse(6, 8, 4, 3, 'amberLight');
      b.set(4 + i * 3, 2 + i, 'amber');
    }),
  );
  fx.stunRing.forEach((name, i) =>
    sheet.cell(name, (b) => {
      const c = i === 0 ? 'teal' : 'violet';
      b.ellipse(1 + i, 1 + i, 14 - i * 2, 14 - i * 2, c).ellipse(3 + i, 3 + i, 10 - i * 2, 10 - i * 2, null);
    }),
  );
  // Myko's smoke, a 16x16 loop: a lumpy cloud whose lobes roll round, a shaded underside, a lit top and a thin
  // wisp curling off it. The cloud keeps its size; it churns instead of pulsing.
  fx.smokePuff.forEach((name, i) => sheet.cell(name, (b) => drawSmokePuff(b, i, fx.smokePuff.length)));
  sheet.cell(fx.shadow, (b) => void b.ellipse(2, 10, 12, 5, 'ink'));
  sheet.cell(fx.groundMarker, (b) => {
    b.ellipse(0, 0, 16, 16, 'alarm').ellipse(1, 1, 14, 14, null);
    b.hline(6, 8, 4, 'alarm').vline(8, 6, 4, 'alarm');
  });
  fx.pickupGlint.forEach((name, i) =>
    sheet.cell(name, (b) => {
      b.set(8, 8, 'white');
      if (i === 1) b.set(8, 6, 'white').set(8, 10, 'white').set(6, 8, 'white').set(10, 8, 'white');
    }),
  );
  // Throw preview: one small dot, drawn many times along the path.
  sheet.cell(fx.throwDot, (b) => void b.rect(7, 7, 2, 2, 'white'));
  // Floor return: Myko's smoke, billowing until the cell is full. Scaled up, it fills the screen.
  fx.smokeCloud.forEach((name, i) =>
    sheet.cell(name, (b) => {
      if (i === 0) {
        b.ellipse(3, 6, 10, 8, 'fog').ellipse(5, 3, 7, 6, 'fog').ellipse(6, 8, 5, 4, 'steel');
      } else if (i === 1) {
        b.ellipse(0, 4, 12, 11, 'fog').ellipse(5, 1, 11, 10, 'fog').ellipse(3, 8, 9, 7, 'steel').ellipse(8, 6, 6, 5, 'steel');
      } else {
        b.rect(0, 0, 16, 16, 'fog').ellipse(1, 2, 9, 8, 'steel').ellipse(8, 7, 8, 8, 'steel').ellipse(3, 10, 6, 5, 'steel');
      }
    }),
  );
  return sheet.build();
}

export function pixelSheet(): Sheet {
  return new SheetBuilder(TEX.pixel, 1, 1, 1).cell('pixel', (b) => void b.set(0, 0, 'white')).build();
}
