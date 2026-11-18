/**
 * Props for chapter 7 (Gift Shop, the Roswell strip at midday, region roswell) and chapter 8 (The Long Road, the
 * Nevada roadhouse, the perimeter and Gate C, region nevada). Owner: creative-director.
 *
 * Chapters 7 and 8 place these keys at these sizes, so change a key or a size only together with the maps that use
 * them. Frames are drawn from their top-left corner, like every other prop.
 *
 * Style (docs/style-guide.md): palette colours only, light from the top left, three tones a surface, an ink outline
 * on anything Andrew can use or bump into, and no lettering: writing is suggested with blocks and rules. No real
 * brands, logos, flags or agency seals (DESIGN.md section 2).
 *
 * Night (chapter 7's closing scene, chapter 8 from beat 6) is the dressing view's ambient tint with lights cut out of
 * it, not separate frames. The few things that change when the lights come on have a `night` or `on` frame.
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

/** Mirror a right-facing drawing. */
const mirrored =
  (draw: Draw): Draw =>
  (b) => {
    const right = new PixelBuffer(b.width, b.height);
    draw(right);
    b.blit(right, 0, 0, true);
  };

/** The ten pairs of the five sensor lines, numbered 1 to 5 from north to south (the diagram's rows, top to bottom). */
const LINE_PAIRS = ['1-2', '1-3', '1-4', '1-5', '2-3', '2-4', '2-5', '3-4', '3-5', '4-5'] as const;
export type LinePair = (typeof LINE_PAIRS)[number];
const pairFrames = (prefix: string): Readonly<Record<LinePair, string>> =>
  Object.fromEntries(LINE_PAIRS.map((p) => [p, `${prefix}.${p}`])) as Record<LinePair, string>;

export const PROP_C78 = {
  // --- Chapter 7: the Roswell strip, Little Green Gifts, the stockroom (region roswell) ---
  /** The shop's "abduction" photo booth: curtained doorway, a saucer-and-beam panel, a photo strip in the slot (32 x 32). Solid: bottom 2 x 1 tiles. */
  photoBooth: 'c78.photoBooth',
  /** A street lamp whose head is an alien's, two big eyes (16 x 32). `night`: the eyes and the pool under it lit. Solid at its foot. */
  eyeLamp: { day: 'c78.eyeLamp.day', night: 'c78.eyeLamp.night' },
  /**
   * The rack of inflatable aliens on a rail, a price tag on the end post (64 x 32, four tiles wide). `full` has four;
   * `taken` has the third gone (the prize). Replaces the four separate `weapon.inflatableAlien` frames. Solid: bottom 4 x 1.
   */
  inflatableRack: { full: 'c78.inflatableRack.full', taken: 'c78.inflatableRack.taken' },
  /** A green tea box and a cup of it, the tag over the rim (16 x 16). The one green thing that is green on purpose. */
  greenTea: 'c78.greenTea',
  /**
   * The diner shaped like a saucer, front on: a dome, a chrome disc with a band of windows, rim lights, two legs and
   * the doors underneath (256 x 48). Sized to cover the strip's diner frontage exactly: cols 16 to 31, rows 1 to 3,
   * doors at cols 23 and 24 on row 3. Collision stays with the wall tiles under it.
   */
  saucerDiner: 'c78.saucerDiner',
  /** The bus stop: a pole with a round plate and a timetable (16 x 32), and a shelter with a bench and an ad panel (48 x 32). */
  busStop: { sign: 'c78.busStop.sign', shelter: 'c78.busStop.shelter' },
  /** Gary's till: drawer, keys, a lime display and a small bobblehead alien on top (16 x 16). Sits on a counter tile. */
  till: 'c78.till',
  /** A wall shelf of snow globes, a little saucer in each, two shelves of four (32 x 24). Solid: bottom 2 x 1. */
  snowGlobeShelf: 'c78.snowGlobeShelf',
  /** The staff fridge, white, a rota and a note on it (16 x 24). `open`: lit inside, milk and a takeaway box. Solid at its foot. */
  staffFridge: { shut: 'c78.staffFridge.shut', open: 'c78.staffFridge.open' },
  /** A can of stout, a strip of masking tape round it with a name scribbled on (16 x 16). Gary's. */
  stoutCan: 'c78.stoutCan',
  /** The delivery van, a box van with a lime stripe and a saucer on the side (48 x 32), facing right and left. */
  deliveryVan: { right: 'c78.deliveryVan.right', left: 'c78.deliveryVan.left' },
  /**
   * Zorp's novelty sign: a foam board on a stick, two rows of magenta blocks and a saucer doodle. `upright` (16 x 24)
   * for set dressing; `dropped` (24 x 16) lying on the road for the 3 s after The Stumble knocks it away. Zorp carries
   * the same sign in his boss frames (item `sign`).
   */
  zorpSign: { upright: 'c78.zorpSign.upright', dropped: 'c78.zorpSign.dropped' },

  // --- Chapter 8: the roadhouse, the perimeter and Gate C (region nevada) ---
  /** The roadhouse awning: rust-and-sand striped canvas with a scalloped edge on two posts (64 x 32). Draw it above Andrew; the posts are the only solid parts. */
  awning: 'c78.awning',
  /** An old fuel pump: dial head, price window, rust body, the hose hung on the side (16 x 32). Solid at its foot. */
  fuelPump: 'c78.fuelPump',
  /** The sign with the distance to everything: three rows of place-and-number blocks, the last number long, bullet holes (32 x 32). Solid at its feet. */
  distanceSign: 'c78.distanceSign',
  /** Pruitt's plain grey government car: no markings, tinted windows, one aerial (48 x 24), facing right and left. */
  govCar: { right: 'c78.govCar.right', left: 'c78.govCar.left' },
  /**
   * Rock outcrops with the shade they throw drawn in to the south-east (no outline on the shade). `large` 48 x 32,
   * `small` 32 x 24. The rock is solid; the shade is the walkable `shade` tile under it.
   */
  rockOutcrop: { large: 'c78.rockOutcrop.large', small: 'c78.rockOutcrop.small' },
  /** A ground sensor: a dome on a stake. `on` has a red lens, `off` a dark one (16 x 16). */
  groundSensor: { on: 'c78.groundSensor.on', off: 'c78.groundSensor.off' },
  /** A thermal mast: a lattice pole, a camera head with an amber lens, a red light on top (16 x 48). Two frames: the head turned west, then east. Solid at its foot. */
  thermalMast: ['c78.thermalMast.0', 'c78.thermalMast.1'],
  /**
   * Junction boxes (16 x 24). Each has a five-row diagram on its door: row 1 is the northmost sensor line, row 5 the
   * southmost, and the two rows the box toggles are amber with a wire to the box symbol. `lines[pair]` has the lever
   * up, `thrown[pair]` has it down; pair keys are '1-2' .. '4-5'. `plain` has no diagram, lever up.
   */
  junctionBox: { plain: 'c78.junctionBox.plain', lines: pairFrames('c78.junctionBox.lines'), thrown: pairFrames('c78.junctionBox.thrown') },
  /** One sensor line's indicator lamp on a short post: `lit` red while the line is live, `dark` once it is off (16 x 16). */
  lineIndicator: { lit: 'c78.lineIndicator.lit', dark: 'c78.lineIndicator.dark' },
  /**
   * One segment of the perimeter fence, side on: chain link with barbed wire on top, a post at the left (16 x 32, no
   * outline: it is mesh). Seamless left to right. Collision is the `fence` tile.
   */
  perimeterFence: 'c78.perimeterFence',
  /** The service gate in the fence, two chain-link leaves between posts, a plain warning plate (32 x 32). `open`: leaves swung back to the posts. */
  serviceGate: { shut: 'c78.serviceGate.shut', open: 'c78.serviceGate.open' },
  /**
   * Gate C's barrier: the housing at the bottom left, the striped arm pivoting at (8, 34) (48 x 48). `down`: the arm
   * runs east across the cell at rows 33 to 35. `up`: it points straight up the left side.
   */
  barrierArm: { up: 'c78.barrierArm.up', down: 'c78.barrierArm.down' },
  /** Where Pruitt will drop the arm: a hatched red-and-amber band across the middle of the tile (16 x 16, no outline). Tiles east-west. */
  barrierDropLine: 'c78.barrierDropLine',
  /** The guard hut: flat roof, a big window, a door (32 x 32). `night`: the window lit amber. Solid: bottom 2 x 1. */
  guardHut: { day: 'c78.guardHut.day', night: 'c78.guardHut.night' },
  /** A floodlight on a pole, one big angled lamp (16 x 32). `on` lit, `off` dark glass. Solid at its foot. */
  gateFloodlight: { on: 'c78.gateFloodlight.on', off: 'c78.gateFloodlight.off' },
  /** Pruitt's folding chair, navy canvas on a steel frame (16 x 16). */
  foldingChair: 'c78.foldingChair',
  /** Pruitt's thermos, the lid-cup upturned on top (16 x 16). */
  thermos: 'c78.thermos',
  /** Where the flashbang lands: frame 0 a dashed white ring with the canister, frame 1 the ring solid amber just before (32 x 32, no outline). */
  flashbangMarker: ['c78.flashbangMarker.0', 'c78.flashbangMarker.1'],
  /**
   * The lit path the phase-2 truck will drive (16 x 16 a tile, no outline): amber edges and chevrons pointing the way
   * it is coming. `across` runs east (mirror for west), `along` runs south (flip for north); two frames each, the
   * chevrons stepping along.
   */
  truckPath: { across: ['c78.truckPath.across.0', 'c78.truckPath.across.1'], along: ['c78.truckPath.along.0', 'c78.truckPath.along.1'] },
} as const;

// --- Chapter 7 -----------------------------------------------------------------

/** Curtained doorway on the left, a saucer abducting a small figure on the side panel, a lime sign along the top. */
const photoBooth: Draw = (b) => {
  b.rect(1, 4, 30, 27, 'magenta').hline(1, 4, 30, 'motelPink').vline(30, 5, 26, 'magentaShade').hline(1, 30, 30, 'magentaShade');
  // The sign: blocks for the name.
  b.rect(1, 0, 30, 4, 'lime').hline(1, 0, 30, 'white').hline(1, 3, 30, 'limeShade');
  for (let x = 4; x < 28; x += 3) b.rect(x, 1, 2, 2, 'magentaShade');
  // The doorway, the curtain two-thirds drawn, a stool inside.
  b.rect(3, 7, 12, 22, 'ink').hline(3, 6, 12, 'steel');
  b.rect(3, 7, 7, 22, 'lime').vline(5, 7, 22, 'limeShade').vline(8, 7, 22, 'limeShade').vline(3, 7, 22, 'white');
  b.rect(11, 24, 3, 2, 'steel').vline(12, 26, 3, 'slate');
  // The side panel: a night sky, a saucer, its beam and someone going up it.
  b.rect(17, 7, 12, 16, 'violetDark').hline(17, 22, 12, 'violet');
  b.set(18, 8, 'white').set(27, 10, 'white').set(19, 19, 'fog');
  b.ellipse(18, 8, 10, 4, 'fog').hline(19, 10, 8, 'steel').rect(22, 7, 2, 2, 'skyPale');
  for (let y = 12; y < 22; y++) {
    const half = Math.floor((y - 12) / 2) + 1;
    for (let x = 23 - half; x < 23 + half; x++) if ((x + y) % 2 === 0) b.set(x, y, 'amberLight');
  }
  b.vline(22, 15, 3, 'ink').set(21, 16, 'ink').set(23, 16, 'ink').set(22, 14, 'ink');
  // Coin slot and the strip of photos hanging out.
  b.rect(18, 25, 4, 3, 'steel').set(19, 26, 'ink').set(20, 26, 'ink');
  b.rect(24, 25, 4, 1, 'ink').rect(24, 26, 4, 3, 'white').hline(24, 27, 4, 'fog');
};

/** A steel lamp post whose head is an alien's: lime, two almond eyes, the light underneath. */
const eyeLamp =
  (night: boolean): Draw =>
  (b) => {
    b.ellipse(3, 1, 10, 8, 'lime').ellipse(4, 1, 6, 4, 'lime').set(4, 2, 'white').set(5, 1, 'white');
    b.vline(12, 3, 4, 'limeShade').hline(5, 8, 6, 'limeShade');
    // The eyes: dark by day with a glint; lit at night.
    b.rect(4, 4, 3, 2, night ? 'amberLight' : 'ink').set(4, 5, null);
    b.rect(9, 4, 3, 2, night ? 'amberLight' : 'ink').set(11, 5, null);
    if (!night) b.set(5, 4, 'white').set(10, 4, 'white');
    else b.set(5, 4, 'white').set(10, 4, 'white').set(6, 5, 'amber').set(9, 5, 'amber');
    b.hline(6, 9, 4, night ? 'white' : 'amberLight');
    b.rect(7, 10, 2, 2, 'slate');
    b.rect(7, 12, 2, 17, 'steel').vline(8, 12, 17, 'slate');
    b.rect(4, 29, 8, 2, 'coal').hline(4, 29, 8, 'slate');
  };

/** One inflatable alien hanging from a hook on the rail at x, the top of its head at y. Lean -1, 0 or 1. */
const hangingAlien = (b: PixelBuffer, x: number, y: number, lean: number): void => {
  b.vline(x + 5, y - 2, 2, 'steel');
  b.ellipse(x + 1, y, 10, 9, 'lime').set(x + 3, y + 1, 'white').set(x + 2, y + 2, 'white');
  b.vline(x + 10, y + 3, 4, 'limeShade');
  b.rect(x + 3, y + 4, 2, 2, 'ink').rect(x + 7, y + 4, 2, 2, 'ink').set(x + 3, y + 4, 'white').set(x + 7, y + 4, 'white');
  // Body tapering, arms out, legs dangling, all a little crooked.
  b.rect(x + 3 + lean, y + 9, 6, 8, 'lime').vline(x + 8 + lean, y + 9, 8, 'limeShade');
  b.line(x + 3 + lean, y + 10, x + lean, y + 14, 'lime').line(x + 8 + lean, y + 10, x + 11 + lean, y + 14, 'lime');
  b.rect(x + 3 + lean * 2, y + 17, 2, 4, 'limeShade').rect(x + 7 + lean * 2, y + 17, 2, 4, 'limeShade');
};

/** The rack: two posts and a rail, aliens hanging, a white price tag on a string at the right post. */
const inflatableRack =
  (taken: boolean): Draw =>
  (b) => {
    b.rect(1, 2, 2, 28, 'steel').rect(61, 2, 2, 28, 'steel').vline(2, 2, 28, 'slate').vline(62, 2, 28, 'slate');
    b.hline(1, 2, 62, 'fog').hline(1, 3, 62, 'steel');
    b.rect(0, 29, 5, 2, 'coal').rect(59, 29, 5, 2, 'coal');
    const xs = [4, 18, 32, 46];
    xs.forEach((x, i) => {
      if (taken && i === 2) {
        b.vline(x + 5, 4, 3, 'steel').set(x + 4, 6, 'steel');
        return;
      }
      hangingAlien(b, x, 6, i % 2 === 0 ? 0 : i === 1 ? -1 : 1);
    });
    // The price tag, turned to show its blocks.
    b.line(60, 6, 57, 10, 'bone');
    b.rect(53, 10, 7, 5, 'white').hline(53, 14, 7, 'fog').rect(54, 11, 2, 2, 'alarm').rect(57, 11, 2, 2, 'ink');
  };

/** A lime box of tea bags, lid open, and a white cup of green tea with its tag hung over the front. */
const greenTea: Draw = (b) => {
  b.rect(1, 5, 7, 9, 'lime').vline(7, 6, 8, 'limeShade').hline(1, 13, 7, 'limeShade');
  b.rect(1, 3, 7, 2, 'white').hline(1, 4, 7, 'bone');
  b.set(3, 8, 'white').set(4, 7, 'white').set(4, 9, 'grass').set(5, 8, 'grass');
  b.rect(8, 8, 6, 6, 'white').vline(13, 9, 5, 'fog').hline(8, 13, 6, 'fog');
  b.hline(8, 8, 6, 'grass').set(9, 8, 'lime');
  b.rect(14, 9, 1, 3, 'white').set(14, 12, 'fog');
  b.vline(10, 9, 2, 'bone').rect(9, 11, 3, 2, 'lime');
};

/** The saucer diner, front on: dome, chrome disc, a band of windows, rim lights, two legs, doors in the middle. */
const saucerDiner: Draw = (b) => {
  // Legs first, so the disc sits on them.
  b.line(44, 32, 34, 46, 'steel').line(45, 32, 35, 46, 'slate').line(211, 32, 221, 46, 'steel').line(212, 32, 222, 46, 'slate');
  b.rect(31, 46, 8, 2, 'slate').rect(218, 46, 8, 2, 'slate');
  // The dome.
  b.ellipse(92, 0, 72, 26, 'skyPale');
  b.ellipse(98, 2, 30, 10, 'white');
  for (const x of [108, 128, 148]) b.vline(x, 2, 12, 'dustyBlue');
  b.hline(96, 12, 64, 'dustyBlue');
  // The disc: chrome top, the name in magenta blocks, the windows, the underside.
  b.ellipse(0, 10, 256, 30, 'fog');
  b.ellipse(10, 11, 236, 14, 'bone').ellipse(40, 11, 120, 6, 'white');
  for (let x = 100; x < 156; x += 7) b.rect(x, 14, 5, 5, 'magenta').hline(x, 18, 5, 'magentaShade');
  b.rect(6, 22, 244, 6, 'steel').hline(6, 22, 244, 'slate');
  for (let x = 14; x < 240; x += 14) {
    b.rect(x, 23, 9, 4, 'skyPale').set(x, 23, 'white').set(x + 1, 23, 'white');
    if (x % 28 === 0) b.rect(x + 5, 25, 3, 2, 'amberLight');
  }
  b.ellipse(14, 26, 228, 14, 'steel').ellipse(30, 30, 196, 8, 'slate');
  // Rim lights, lime and magenta, round the edge.
  for (let x = 12; x < 246; x += 8) b.rect(x, 28, 2, 2, (x / 8) % 2 === 0 ? 'lime' : 'magenta');
  // The doors under the middle, and the step.
  b.rect(114, 32, 28, 14, 'slate').hline(114, 32, 28, 'steel');
  b.rect(117, 34, 10, 11, 'skyPale').rect(129, 34, 10, 11, 'skyPale').vline(128, 34, 11, 'slate');
  b.set(117, 34, 'white').set(118, 35, 'white').set(129, 34, 'white').set(130, 35, 'white');
  b.set(125, 40, 'steel').set(131, 40, 'steel');
  b.rect(110, 46, 36, 2, 'tanShade').hline(110, 46, 36, 'tan');
};

/** The bus stop's pole: a round plate with a bus in silhouette and a white timetable panel. */
const busStopSign: Draw = (b) => {
  b.ellipse(2, 0, 12, 12, 'lime').ellipse(3, 1, 10, 10, 'white');
  b.rect(5, 3, 6, 4, 'navy').hline(5, 3, 6, 'dustyBlue').rect(6, 4, 1, 1, 'skyPale').rect(8, 4, 2, 1, 'skyPale');
  b.set(6, 7, 'ink').set(9, 7, 'ink');
  b.rect(7, 12, 2, 18, 'steel').vline(8, 12, 18, 'slate');
  b.rect(4, 15, 8, 7, 'white').hline(4, 21, 8, 'fog');
  for (const y of [16, 18, 20]) b.hline(5, y, y === 16 ? 6 : 4, 'slate');
  b.rect(5, 30, 6, 2, 'coal');
};

/** The bus stop shelter: a magenta roof, a glass back, a bench, an ad panel with a saucer on it. */
const busStopShelter: Draw = (b) => {
  b.rect(0, 2, 48, 5, 'magenta').hline(0, 2, 48, 'motelPink').hline(0, 6, 48, 'magentaShade');
  b.rect(2, 7, 44, 15, 'skyPale');
  for (let i = 0; i < 3; i++) b.line(6 + i * 9, 20, 13 + i * 9, 9, 'white');
  // The ad: a saucer on lime, some blocks.
  b.rect(31, 8, 13, 13, 'lime').hline(31, 20, 13, 'limeShade');
  b.ellipse(33, 10, 9, 4, 'fog').rect(36, 9, 3, 1, 'skyPale').hline(34, 12, 7, 'steel');
  b.rect(33, 15, 9, 2, 'magentaShade').rect(33, 18, 5, 1, 'magentaShade');
  // Frame and posts.
  b.rect(1, 7, 2, 24, 'steel').rect(45, 7, 2, 24, 'steel').vline(2, 7, 24, 'slate').vline(46, 7, 24, 'slate');
  b.hline(3, 21, 42, 'steel');
  // The bench.
  b.rect(5, 22, 24, 3, 'tan').hline(5, 22, 24, 'sand').hline(5, 24, 24, 'tanShade');
  b.rect(7, 25, 2, 5, 'slate').rect(25, 25, 2, 5, 'slate');
};

/** A till: grey drawer, a keyboard, a lime display, a bobblehead alien beside it. */
const till: Draw = (b) => {
  b.rect(2, 10, 12, 5, 'slate').hline(2, 10, 12, 'steel').rect(6, 12, 4, 1, 'coal');
  b.rect(2, 6, 12, 4, 'fog').hline(2, 6, 12, 'white').hline(2, 9, 12, 'steel');
  for (let x = 3; x < 12; x += 2) b.set(x, 7, 'slate').set(x + 1, 8, 'slate');
  b.set(12, 7, 'alarm').set(12, 8, 'grass');
  b.rect(8, 1, 6, 5, 'coal').rect(9, 2, 4, 2, 'ink').hline(9, 3, 3, 'lime');
  // The bobblehead: a lime head on a spring.
  b.ellipse(2, 0, 5, 4, 'lime').set(3, 1, 'ink').set(5, 1, 'ink').vline(4, 4, 1, 'steel').rect(3, 5, 3, 1, 'limeShade');
};

/** A tan wooden wall shelf, two shelves of snow globes with a saucer in each, coloured bases. */
const snowGlobeShelf: Draw = (b) => {
  b.rect(1, 0, 30, 24, 'tanShade').vline(1, 0, 24, 'tan').vline(30, 0, 24, 'rustDark');
  for (const shelf of [11, 22]) {
    b.rect(1, shelf, 30, 2, 'tan').hline(1, shelf, 30, 'sand');
    for (let i = 0; i < 4; i++) {
      const x = 3 + i * 7;
      const base: ColourName = (i + shelf) % 2 === 0 ? 'magenta' : 'lime';
      b.ellipse(x, shelf - 8, 6, 7, 'skyPale').set(x + 1, shelf - 7, 'white');
      b.hline(x + 1, shelf - 4, 4, 'fog').set(x + 2, shelf - 5, 'steel').set(x + 3, shelf - 5, 'steel');
      b.set(x + 4, shelf - 6, 'white').set(x + 2, shelf - 3, 'white');
      b.rect(x, shelf - 2, 6, 2, base).hline(x, shelf - 1, 6, base === 'lime' ? 'limeShade' : 'magentaShade');
    }
  }
};

/** The staff fridge: white, freezer door on top, steel handles, the rota and a pink note under magnets. */
const staffFridge =
  (open: boolean): Draw =>
  (b) => {
    b.rect(2, 1, 12, 22, 'white').vline(13, 2, 21, 'fog').hline(2, 1, 12, 'fluoro').hline(2, 22, 12, 'fog');
    if (!open) {
      b.hline(2, 8, 12, 'fog').vline(12, 3, 4, 'steel').vline(12, 10, 6, 'steel');
      b.rect(4, 10, 5, 6, 'amberLight').hline(5, 11, 3, 'peat').hline(5, 13, 3, 'peat').hline(5, 15, 2, 'peat').set(6, 10, 'alarm');
      b.rect(5, 3, 4, 3, 'motelPink').set(7, 3, 'lime').hline(5, 5, 3, 'motelPinkShade');
    } else {
      // Inside: the light, the shelves, milk and a takeaway box. The door is swung off to the left edge.
      b.rect(3, 9, 10, 13, 'fluoro').hline(3, 13, 10, 'fog').hline(3, 18, 10, 'fog');
      b.rect(4, 10, 3, 3, 'white').set(4, 10, 'dustyBlue').set(5, 10, 'dustyBlue');
      b.rect(8, 15, 4, 3, 'bone').hline(8, 15, 4, 'tan');
      b.hline(2, 8, 12, 'fog').vline(12, 3, 4, 'steel');
      b.rect(0, 9, 2, 13, 'fog').vline(0, 9, 13, 'steel');
    }
    b.rect(3, 23, 2, 1, 'coal').rect(11, 23, 2, 1, 'coal');
  };

/** A dark can of stout, a cream band, and masking tape with a name scribbled on it. */
const stoutCan: Draw = (b) => {
  b.rect(5, 3, 6, 11, 'coal').vline(10, 4, 10, 'ink').vline(5, 4, 10, 'slate');
  b.hline(5, 2, 6, 'fog').hline(6, 1, 4, 'steel').set(8, 1, 'fog');
  b.rect(5, 5, 6, 2, 'bone').hline(5, 6, 6, 'tan');
  b.rect(4, 9, 8, 3, 'white').hline(4, 11, 8, 'bone');
  b.set(5, 10, 'slate').set(6, 9, 'slate').set(7, 10, 'slate').set(8, 10, 'slate').set(9, 9, 'slate').set(10, 10, 'slate');
  b.hline(5, 14, 6, 'slate');
};

/** A white box van facing right: rear doors at the left end, a lime stripe, a saucer on the side, the cab. */
const deliveryVan: Draw = (b) => {
  b.rect(2, 3, 32, 20, 'white').hline(2, 3, 32, 'fluoro').hline(2, 22, 32, 'fog').vline(33, 4, 19, 'fog');
  b.vline(5, 4, 18, 'fog').set(4, 13, 'steel');
  b.rect(2, 16, 32, 3, 'lime').hline(2, 18, 32, 'limeShade');
  b.ellipse(12, 6, 16, 6, 'fog').rect(17, 5, 6, 2, 'skyPale').hline(13, 10, 14, 'steel');
  for (let y = 12; y < 16; y++) for (let x = 18 - (y - 12); x < 22 + (y - 12); x++) if ((x + y) % 2 === 0) b.set(x, y, 'amberLight');
  b.rect(34, 9, 10, 14, 'bone').rect(44, 14, 2, 9, 'bone').hline(34, 9, 10, 'white').hline(34, 22, 12, 'fog');
  b.rect(36, 11, 7, 5, 'dustyBlue').set(36, 11, 'skyPale').set(37, 11, 'skyPale').set(36, 12, 'skyPale');
  b.rect(45, 16, 1, 2, 'amberLight').rect(2, 15, 1, 2, 'alarm');
  b.ellipse(6, 19, 9, 9, 'ink').ellipse(34, 19, 9, 9, 'ink');
  for (const x of [9, 37]) b.rect(x, 22, 3, 3, 'steel');
};

/** The novelty sign's board at (x, y), 14 x 11: white foam, a lime border, two rows of magenta blocks, a saucer doodle. */
const signBoard = (b: PixelBuffer, x: number, y: number): void => {
  b.rect(x, y, 14, 11, 'lime').rect(x + 1, y + 1, 12, 9, 'white').hline(x + 1, y + 9, 12, 'bone');
  for (let i = 0; i < 4; i++) b.rect(x + 2 + i * 3, y + 2, 2, 2, 'magenta');
  for (let i = 0; i < 3; i++) b.rect(x + 2 + i * 3, y + 5, 2, 2, 'magenta');
  b.hline(x + 10, y + 6, 3, 'steel').set(x + 11, y + 5, 'skyPale');
};

const zorpSignUpright: Draw = (b) => {
  signBoard(b, 1, 1);
  b.rect(7, 12, 2, 11, 'tan').vline(8, 12, 11, 'tanShade');
};

const zorpSignDropped: Draw = (b) => {
  // Lying flat on the road, foreshortened, the stick out to the right.
  b.rect(1, 4, 14, 9, 'lime').rect(2, 5, 12, 7, 'white').hline(2, 11, 12, 'bone');
  for (let i = 0; i < 4; i++) b.rect(3 + i * 3, 6, 2, 1, 'magenta');
  for (let i = 0; i < 3; i++) b.rect(3 + i * 3, 8, 2, 1, 'magenta');
  b.rect(15, 8, 8, 2, 'tan').hline(15, 9, 8, 'tanShade');
};

// --- Chapter 8 -----------------------------------------------------------------

/** Rust-and-sand striped canvas, a scalloped hem, on two steel posts. */
const awning: Draw = (b) => {
  b.hline(0, 0, 64, 'rustDark');
  for (let x = 0; x < 64; x++) {
    const stripe: ColourName = Math.floor(x / 4) % 2 === 0 ? 'rust' : 'sand';
    b.vline(x, 1, 9, stripe);
  }
  for (let x = 0; x < 64; x += 8) {
    b.ellipse(x, 7, 8, 6, Math.floor(x / 4) % 2 === 0 ? 'rust' : 'sand');
    b.ellipse(x + 4, 7, 4, 6, 'sand').ellipse(x, 7, 4, 6, 'rust');
  }
  b.hline(0, 1, 64, 'rustDark');
  for (let x = 0; x < 64; x += 8) b.set(x + 1, 12, 'rustDark').set(x + 5, 12, 'tanShade');
  b.rect(3, 13, 2, 17, 'steel').rect(59, 13, 2, 17, 'steel').vline(4, 13, 17, 'slate').vline(60, 13, 17, 'slate');
  b.rect(2, 30, 4, 2, 'slate').rect(58, 30, 4, 2, 'slate');
};

/** An old fuel pump: a sand head with a dial, a price window, a rust body, the hose on its hook. */
const fuelPump: Draw = (b) => {
  b.rect(3, 1, 10, 8, 'sand').hline(3, 1, 10, 'white').vline(12, 2, 7, 'tanShade');
  b.rect(5, 3, 6, 4, 'white').hline(5, 6, 6, 'fog');
  for (const x of [6, 8, 10]) b.set(x, 4, 'ink');
  b.line(8, 5, 9, 3, 'alarm');
  b.rect(3, 9, 10, 19, 'rust').vline(3, 9, 19, 'sand').vline(12, 9, 19, 'rustDark').hline(3, 27, 10, 'rustDark');
  b.rect(5, 11, 6, 3, 'ink').hline(6, 12, 4, 'amber');
  b.rect(5, 16, 6, 1, 'rustDark').rect(5, 18, 6, 1, 'rustDark');
  b.rect(13, 11, 2, 4, 'coal').set(13, 11, 'steel');
  b.line(14, 15, 15, 20, 'coal').line(15, 20, 13, 26, 'coal');
  b.rect(2, 28, 12, 3, 'slate').hline(2, 28, 12, 'steel');
};

/** A white board on two posts, three rows of place and distance, the last distance very long, three bullet holes. */
const distanceSign: Draw = (b) => {
  b.rect(6, 19, 2, 12, 'steel').rect(24, 19, 2, 12, 'steel').vline(7, 19, 12, 'slate').vline(25, 19, 12, 'slate');
  b.rect(1, 1, 30, 18, 'bone').rect(2, 2, 28, 16, 'white').hline(1, 18, 30, 'fog');
  const rows: readonly (readonly [number, number, number])[] = [
    [4, 9, 2],
    [9, 7, 3],
    [14, 5, 6],
  ];
  for (const [y, name, digits] of rows) {
    b.rect(4, y, name, 2, 'ink');
    for (let i = 0; i < digits; i++) b.rect(27 - i * 3, y, 2, 2, 'ink');
  }
  for (const [x, y] of [[8, 7], [21, 4], [16, 13]] as const) b.set(x, y, 'coal').set(x + 1, y, 'steel');
};

/** A plain grey four-door, facing right: no markings, dark windows, one thin aerial. */
const govCar: Draw = (b) => {
  b.rect(12, 5, 22, 7, 'fog').hline(13, 4, 20, 'white').hline(12, 5, 22, 'bone');
  b.rect(14, 6, 8, 5, 'slate').rect(23, 6, 9, 5, 'slate').set(14, 6, 'steel').set(23, 6, 'steel');
  b.rect(2, 11, 44, 8, 'fog').hline(2, 11, 44, 'bone').hline(2, 18, 44, 'steel');
  b.vline(22, 11, 7, 'steel').hline(17, 13, 3, 'steel').hline(26, 13, 3, 'steel');
  b.rect(44, 13, 2, 2, 'amberLight').rect(2, 13, 2, 2, 'alarm');
  b.hline(1, 18, 4, 'slate').hline(43, 18, 4, 'slate');
  b.vline(6, 1, 10, 'slate');
  b.ellipse(6, 15, 9, 9, 'ink').ellipse(34, 15, 9, 9, 'ink');
  b.rect(9, 18, 3, 3, 'steel').rect(37, 18, 3, 3, 'steel');
};

/** Rock in rust tones lit from the top left; the shade it casts in tan shade, south-east, no outline. */
const rockOutcrop =
  (large: boolean): Draw =>
  (b) => {
    const w = b.width;
    const h = b.height;
    b.ellipse(Math.floor(w * 0.25), Math.floor(h * 0.45), Math.floor(w * 0.75), Math.floor(h * 0.55), 'tanShade');
    const rock = new PixelBuffer(w, h);
    const lumps: readonly (readonly [number, number, number, number])[] = large
      ? [
          [2, 8, 22, 18],
          [14, 2, 20, 22],
          [28, 10, 16, 14],
        ]
      : [
          [2, 6, 16, 14],
          [11, 2, 16, 15],
        ];
    for (const [x, y, lw, lh] of lumps) rock.ellipse(x, y, lw, lh, 'rust');
    for (const [x, y, lw, lh] of lumps) rock.ellipse(x + Math.floor(lw / 3), y + Math.floor(lh / 2), Math.ceil((lw * 2) / 3), Math.ceil(lh / 2), 'rustDark');
    for (const [x, y, lw] of lumps) rock.hline(x + 3, y + 1, Math.floor(lw / 2), 'tan').set(x + 2, y + 2, 'tan');
    for (const [x, y, lw, lh] of lumps) rock.line(x + Math.floor(lw / 2), y + 3, x + Math.floor(lw / 2) + 2, y + lh - 3, 'rustDark');
    rock.outline('ink');
    b.blit(rock, 0, 0);
  };

/** A small steel dome on a stake, its lens red or dark, a stub of aerial. */
const groundSensor =
  (on: boolean): Draw =>
  (b) => {
    b.ellipse(4, 12, 8, 3, 'tanShade');
    b.rect(7, 9, 2, 5, 'slate');
    b.ellipse(4, 4, 8, 7, 'steel').hline(5, 4, 5, 'fog').vline(11, 6, 3, 'slate');
    b.rect(6, 6, 3, 2, on ? 'alarm' : 'coal');
    if (on) b.set(6, 6, 'motelPink');
    b.vline(10, 1, 3, 'slate').set(10, 1, on ? 'alarm' : 'steel');
  };

/** A lattice mast, a camera head with an amber lens turned west (frame 0) or east (frame 1), a red light on top. */
const thermalMast =
  (frame: number): Draw =>
  (b) => {
    b.set(8, 0, 'alarm').vline(8, 1, 2, 'slate');
    b.rect(3, 3, 10, 6, 'coal').hline(3, 3, 10, 'slate').hline(3, 8, 10, 'ink');
    if (frame === 0) b.rect(1, 4, 3, 4, 'slate').rect(1, 5, 2, 2, 'amber').set(1, 5, 'amberLight');
    else b.rect(12, 4, 3, 4, 'slate').rect(13, 5, 2, 2, 'amber').set(14, 5, 'amberLight');
    b.rect(6, 9, 4, 2, 'slate');
    b.vline(6, 11, 33, 'steel').vline(9, 11, 33, 'steel');
    for (let y = 11; y < 42; y += 6) b.line(6, y, 9, y + 3, 'slate').line(9, y + 3, 6, y + 6, 'slate');
    b.rect(3, 44, 10, 4, 'fog').hline(3, 44, 10, 'bone').hline(3, 47, 10, 'steel');
  };

/** A grey cabinet on legs with a diagram on the door and a lever on the right. */
const junctionBox =
  (pair: LinePair | null, thrown: boolean): Draw =>
  (b) => {
    b.rect(2, 2, 11, 16, 'steel').hline(2, 2, 11, 'fog').vline(12, 3, 15, 'slate').hline(2, 17, 11, 'slate');
    b.rect(4, 4, 7, 12, 'bone').hline(4, 15, 7, 'fog');
    if (pair !== null) {
      const [a, c] = pair.split('-').map(Number);
      for (let i = 1; i <= 5; i++) {
        const on = i === a || i === c;
        b.hline(7, 3 + i * 2, 4, on ? 'amber' : 'fog');
        if (on) b.hline(6, 3 + i * 2, 1, 'amber');
      }
      // The box symbol on the left and the wire down to its two lines.
      const ya = 3 + (a ?? 1) * 2;
      const yc = 3 + (c ?? 2) * 2;
      b.vline(6, ya, yc - ya + 1, 'amber');
      b.rect(4, Math.floor((ya + yc) / 2) - 1, 2, 2, 'slate');
    } else {
      b.hline(5, 6, 5, 'fog').hline(5, 9, 4, 'fog').hline(5, 12, 5, 'fog');
    }
    // The lever.
    b.rect(13, 8, 2, 3, 'slate');
    if (thrown) b.rect(13, 11, 1, 4, 'steel').rect(13, 14, 2, 2, 'alarm');
    else b.rect(13, 4, 1, 4, 'steel').rect(13, 3, 2, 2, 'alarm');
    b.rect(4, 18, 2, 5, 'slate').rect(9, 18, 2, 5, 'slate').hline(3, 22, 9, 'coal');
  };

/** A short post with a lamp: red while the line is live, dark glass once it is off. */
const lineIndicator =
  (lit: boolean): Draw =>
  (b) => {
    if (lit) b.ellipse(3, 0, 10, 10, 'rust');
    b.rect(5, 2, 6, 6, 'slate').rect(6, 3, 4, 4, lit ? 'alarm' : 'coal');
    if (lit) b.set(6, 3, 'white').set(7, 3, 'motelPink').set(6, 4, 'motelPink');
    else b.set(6, 3, 'slate');
    b.rect(7, 8, 2, 6, 'steel').vline(8, 8, 6, 'slate').rect(5, 14, 6, 2, 'coal');
  };

/** Chain link in fog on nothing, rails top and bottom, a post at the left, barbed wire along the top. */
const perimeterFence: Draw = (b) => {
  for (let y = 6; y < 28; y++) for (let x = 0; x < 16; x++) if ((x + y) % 4 === 0 || (x - y + 64) % 4 === 0) b.set(x, y, 'fog');
  b.hline(0, 5, 16, 'steel').hline(0, 28, 16, 'steel').hline(0, 29, 16, 'slate');
  b.hline(0, 2, 16, 'slate');
  for (let x = 1; x < 16; x += 4) b.set(x, 1, 'fog').set(x + 1, 3, 'fog');
  b.rect(0, 1, 2, 31, 'steel').vline(1, 1, 31, 'slate').set(0, 0, 'slate').set(1, 0, 'slate');
};

/** Chain-link leaf filling the box, steel frame. */
const gateLeaf = (frame: PixelBuffer, mesh: PixelBuffer, x: number, y: number, w: number, h: number): void => {
  for (let j = y + 1; j < y + h - 1; j++) for (let i = x + 1; i < x + w - 1; i++) if ((i + j) % 4 === 0 || (i - j + 64) % 4 === 0) mesh.set(i, j, 'fog');
  frame.hline(x, y, w, 'steel').hline(x, y + h - 1, w, 'steel').vline(x, y, h, 'steel').vline(x + w - 1, y, h, 'slate');
  if (w > 6) frame.line(x + 1, y + h - 2, x + w - 2, y + 1, 'steel');
};

/** The service gate: posts with caps, two leaves, a white warning plate with a red bar and blocks. Open: leaves edge-on at the posts. */
const serviceGate =
  (open: boolean): Draw =>
  (b) => {
    const frame = new PixelBuffer(b.width, b.height);
    const mesh = new PixelBuffer(b.width, b.height);
    frame.rect(0, 2, 3, 29, 'steel').vline(2, 2, 29, 'slate').rect(29, 2, 3, 29, 'steel').vline(31, 2, 29, 'slate');
    frame.rect(0, 1, 3, 1, 'fog').rect(29, 1, 3, 1, 'fog');
    if (open) {
      gateLeaf(frame, mesh, 3, 5, 4, 25);
      gateLeaf(frame, mesh, 25, 5, 4, 25);
    } else {
      gateLeaf(frame, mesh, 3, 5, 13, 25);
      gateLeaf(frame, mesh, 16, 5, 13, 25);
      // The plate, a chain and padlock at the middle.
      frame.rect(19, 9, 8, 6, 'white').hline(19, 9, 8, 'alarm').hline(20, 11, 6, 'ink').hline(20, 13, 4, 'slate');
      frame.vline(15, 16, 3, 'slate').vline(16, 16, 3, 'steel').rect(15, 19, 2, 2, 'amber');
    }
    frame.outline('ink');
    b.blit(mesh, 0, 0).blit(frame, 0, 0);
  };

/** The barrier: a fog housing with a lamp, a red-and-white arm pivoting at (8, 34), down across or straight up. */
const barrierArm =
  (up: boolean): Draw =>
  (b) => {
    if (up) {
      for (let y = 0; y < 33; y++) b.hline(7, y, 3, Math.floor(y / 6) % 2 === 0 ? 'white' : 'alarm');
      b.vline(9, 0, 33, 'fog');
    } else {
      for (let x = 10; x < 48; x++) b.vline(x, 33, 3, Math.floor((x - 10) / 6) % 2 === 0 ? 'alarm' : 'white');
      b.hline(10, 35, 38, 'brickDark');
    }
    b.rect(2, 32, 11, 14, 'fog').hline(2, 32, 11, 'white').vline(12, 33, 13, 'steel').hline(2, 45, 11, 'steel');
    b.rect(4, 36, 7, 2, 'alarm').rect(4, 40, 7, 2, 'white');
    b.ellipse(6, 32, 5, 5, 'slate').set(8, 34, 'steel');
    b.set(3, 31, 'amber').set(3, 30, 'amberLight');
    b.rect(1, 46, 13, 2, 'slate');
  };

/** A hatched red-and-amber band across the tile, four rows deep: the telegraph for the arm. */
const barrierDropLine: Draw = (b) => {
  for (let y = 6; y < 10; y++) for (let x = 0; x < 16; x++) b.set(x, y, Math.floor((x + y) / 2) % 2 === 0 ? 'alarm' : 'amberLight');
  b.hline(0, 5, 16, 'brickDark').hline(0, 10, 16, 'brickDark');
};

/** The guard hut: slate roof slab, bone walls, a big window (lit amber at night), a steel door. */
const guardHut =
  (night: boolean): Draw =>
  (b) => {
    b.rect(0, 2, 32, 4, 'slate').hline(0, 2, 32, 'steel').hline(0, 5, 32, 'coal');
    b.set(15, 0, 'amberLight').set(16, 0, 'amberLight').rect(15, 1, 2, 1, 'slate');
    b.rect(2, 6, 28, 24, 'bone').vline(2, 6, 24, 'white').vline(29, 6, 24, 'fog').hline(2, 29, 28, 'fog');
    b.rect(4, 9, 16, 10, 'steel').rect(5, 10, 14, 8, night ? 'amberLight' : 'skyPale');
    if (night) b.rect(7, 15, 4, 3, 'amber').set(13, 14, 'peat').set(14, 14, 'peat').rect(15, 11, 3, 2, 'white');
    else b.line(6, 17, 11, 11, 'white').line(9, 17, 14, 11, 'white');
    b.hline(4, 19, 16, 'fog');
    b.rect(22, 10, 6, 19, 'steel').hline(22, 10, 6, 'fog').vline(27, 11, 18, 'slate').set(23, 19, 'amber');
    b.rect(1, 30, 30, 2, 'slate');
  };

/** A floodlight: a big angled lamp on a pole, lit or dark. */
const gateFloodlight =
  (on: boolean): Draw =>
  (b) => {
    b.rect(2, 1, 12, 8, 'coal').hline(2, 1, 12, 'slate');
    b.rect(3, 2, 10, 6, on ? 'fluoro' : 'slate').hline(3, 7, 10, on ? 'skyPale' : 'coal');
    if (on) b.rect(4, 3, 3, 2, 'white');
    b.rect(6, 9, 4, 2, 'slate');
    b.rect(7, 11, 2, 18, 'steel').vline(8, 11, 18, 'slate');
    b.rect(4, 29, 8, 2, 'coal').hline(4, 29, 8, 'slate');
  };

/** A camp chair: navy canvas back and seat on a crossed steel frame. */
const foldingChair: Draw = (b) => {
  b.rect(4, 2, 8, 6, 'navy').hline(4, 2, 8, 'dustyBlue').vline(11, 3, 5, 'navyDark');
  b.rect(3, 8, 10, 3, 'navy').hline(3, 10, 10, 'navyDark');
  b.hline(2, 7, 2, 'steel').hline(12, 7, 2, 'steel');
  b.line(3, 11, 12, 15, 'steel').line(12, 11, 3, 15, 'steel');
};

/** A dusty-blue thermos, the lid-cup upturned on top. */
const thermos: Draw = (b) => {
  b.rect(5, 1, 6, 3, 'fog').hline(5, 1, 6, 'white').vline(10, 2, 2, 'steel');
  b.rect(6, 4, 4, 1, 'steel');
  b.rect(5, 5, 6, 9, 'dustyBlue').vline(5, 5, 9, 'skyPale').vline(10, 5, 9, 'navy').hline(5, 9, 6, 'navy');
  b.hline(5, 14, 6, 'navyDark');
};

/** Where the flashbang lands. Frame 0: a dashed white ring and the canister. Frame 1: a solid amber ring. */
const flashbangMarker =
  (frame: number): Draw =>
  (b) => {
    b.ellipse(1, 1, 30, 30, frame === 0 ? 'white' : 'amberLight');
    b.ellipse(3, 3, 26, 26, null);
    if (frame === 0) {
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (b.get(x, y) !== null && Math.floor(Math.atan2(y - 16, x - 16) * 4) % 2 === 0) b.set(x, y, null);
    } else {
      b.ellipse(9, 9, 14, 14, 'white').ellipse(10, 10, 12, 12, null);
    }
    b.rect(14, 15, 4, 3, 'coal').hline(14, 15, 4, 'steel').set(17, 14, 'amber');
  };

/** One tile of lit path, travel east: amber edges, chevrons stepping along. */
const truckPathAcross =
  (frame: number): Draw =>
  (b) => {
    b.hline(0, 1, 16, 'amber').hline(0, 14, 16, 'amber');
    for (let k = 0; k < 2; k++) {
      const x0 = (k * 8 + frame * 4) % 16;
      for (let i = 0; i < 4; i++) {
        for (const t of [0, 1]) {
          b.set((x0 + i + t) % 16, 4 + i, 'amberLight');
          b.set((x0 + i + t) % 16, 11 - i, 'amberLight');
        }
      }
    }
  };

/** The same tile turned to run south. */
const truckPathAlong =
  (frame: number): Draw =>
  (b) => {
    const across = new PixelBuffer(16, 16);
    truckPathAcross(frame)(across);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) b.set(y, x, across.get(x, y));
  };

/** [name, width, height, drawing]. Sizes are the contract; do not change one here alone. */
const DRAWINGS: readonly (readonly [string, number, number, Draw])[] = [
  [PROP_C78.photoBooth, 32, 32, outlined(photoBooth)],
  [PROP_C78.eyeLamp.day, 16, 32, outlined(eyeLamp(false))],
  [PROP_C78.eyeLamp.night, 16, 32, outlined(eyeLamp(true))],
  [PROP_C78.inflatableRack.full, 64, 32, outlined(inflatableRack(false))],
  [PROP_C78.inflatableRack.taken, 64, 32, outlined(inflatableRack(true))],
  [PROP_C78.greenTea, 16, 16, outlined(greenTea)],
  [PROP_C78.saucerDiner, 256, 48, outlined(saucerDiner)],
  [PROP_C78.busStop.sign, 16, 32, outlined(busStopSign)],
  [PROP_C78.busStop.shelter, 48, 32, outlined(busStopShelter)],
  [PROP_C78.till, 16, 16, outlined(till)],
  [PROP_C78.snowGlobeShelf, 32, 24, outlined(snowGlobeShelf)],
  [PROP_C78.staffFridge.shut, 16, 24, outlined(staffFridge(false))],
  [PROP_C78.staffFridge.open, 16, 24, outlined(staffFridge(true))],
  [PROP_C78.stoutCan, 16, 16, outlined(stoutCan)],
  [PROP_C78.deliveryVan.right, 48, 32, outlined(deliveryVan)],
  [PROP_C78.deliveryVan.left, 48, 32, outlined(mirrored(deliveryVan))],
  [PROP_C78.zorpSign.upright, 16, 24, outlined(zorpSignUpright)],
  [PROP_C78.zorpSign.dropped, 24, 16, outlined(zorpSignDropped)],
  [PROP_C78.awning, 64, 32, outlined(awning)],
  [PROP_C78.fuelPump, 16, 32, outlined(fuelPump)],
  [PROP_C78.distanceSign, 32, 32, outlined(distanceSign)],
  [PROP_C78.govCar.right, 48, 24, outlined(govCar)],
  [PROP_C78.govCar.left, 48, 24, outlined(mirrored(govCar))],
  [PROP_C78.rockOutcrop.large, 48, 32, rockOutcrop(true)],
  [PROP_C78.rockOutcrop.small, 32, 24, rockOutcrop(false)],
  [PROP_C78.groundSensor.on, 16, 16, outlined(groundSensor(true))],
  [PROP_C78.groundSensor.off, 16, 16, outlined(groundSensor(false))],
  ...PROP_C78.thermalMast.map((name, i) => [name, 16, 48, outlined(thermalMast(i))] as const),
  [PROP_C78.junctionBox.plain, 16, 24, outlined(junctionBox(null, false))],
  ...LINE_PAIRS.map((p) => [PROP_C78.junctionBox.lines[p], 16, 24, outlined(junctionBox(p, false))] as const),
  ...LINE_PAIRS.map((p) => [PROP_C78.junctionBox.thrown[p], 16, 24, outlined(junctionBox(p, true))] as const),
  [PROP_C78.lineIndicator.lit, 16, 16, outlined(lineIndicator(true))],
  [PROP_C78.lineIndicator.dark, 16, 16, outlined(lineIndicator(false))],
  [PROP_C78.perimeterFence, 16, 32, perimeterFence],
  [PROP_C78.serviceGate.shut, 32, 32, serviceGate(false)],
  [PROP_C78.serviceGate.open, 32, 32, serviceGate(true)],
  [PROP_C78.barrierArm.up, 48, 48, outlined(barrierArm(true))],
  [PROP_C78.barrierArm.down, 48, 48, outlined(barrierArm(false))],
  [PROP_C78.barrierDropLine, 16, 16, barrierDropLine],
  [PROP_C78.guardHut.day, 32, 32, outlined(guardHut(false))],
  [PROP_C78.guardHut.night, 32, 32, outlined(guardHut(true))],
  [PROP_C78.gateFloodlight.on, 16, 32, outlined(gateFloodlight(true))],
  [PROP_C78.gateFloodlight.off, 16, 32, outlined(gateFloodlight(false))],
  [PROP_C78.foldingChair, 16, 16, outlined(foldingChair)],
  [PROP_C78.thermos, 16, 16, outlined(thermos)],
  ...PROP_C78.flashbangMarker.map((name, i) => [name, 32, 32, flashbangMarker(i)] as const),
  ...PROP_C78.truckPath.across.map((name, i) => [name, 16, 16, truckPathAcross(i)] as const),
  ...PROP_C78.truckPath.along.map((name, i) => [name, 16, 16, truckPathAlong(i)] as const),
];

export function addChapters7And8(atlas: AtlasBuilder): void {
  for (const [name, w, h, draw] of DRAWINGS) atlas.add(name, w, h, draw);
}
