/**
 * Texture, frame and animation keys for everything `src/art/` generates.
 * This file has no Phaser import, so systems, UI and tests can use the keys
 * without loading the generators. See docs/style-guide.md.
 *
 * Contract:
 * - `registerArt(scene)` in `src/art/index.ts` creates every texture and
 *   animation named here. Call it once, in the boot scene, before any other
 *   scene starts.
 * - Character textures have frames named `<anim>.<facing>.<index>` and
 *   animations registered as `<textureKey>.<anim>.<facing>`; use `animKey()`.
 * - Enemy and boss textures use the `spriteKey` from tuning
 *   (`enemy.<EnemyId>`, `boss.<BossId>`) as the texture key.
 * - Tilesets are 16 x 16 tiles on a 16-column grid, one texture per region.
 */

import type {
  AbilityId,
  DrinkId,
  Facing,
  FoodId,
  MoveId,
  OverhaulDrinkId,
  RegionId,
  SpeakerId,
  WeaponId,
} from '../core/types';

/** Bitmap font key for `scene.add.bitmapText`. Glyph cell is 6 x 9. */
export const FONT_KEY = 'font.main';
export const FONT_CELL = { width: 6, height: 9 } as const;

export const TEX = {
  andrew: 'char.andrew',
  myko: 'char.myko',
  /** Chapter 2: a Brennan sheep, 16 x 16. `idle` and `walk` in four directions; use `animKey(TEX.sheep, 'walk', facing)`. */
  sheep: 'animal.sheep',
  /** Small HUD and world icons; frames listed in `icon`. */
  icons: 'ui.icons',
  /** 32 x 32 dialogue portraits; frames are `SpeakerId`s. */
  portraits: 'ui.portraits',
  /** Projectiles, pickups on the ground, puffs and markers; frames in `fx`. */
  fx: 'fx.main',
  /** 1 x 1 white pixel for tinted rectangles, bars and fades. */
  pixel: 'ui.pixel',
} as const;

export const tilesetKey = (region: RegionId): string => `tiles.${region}`;

/** Animations every walking character has. */
export type CommonAnim = 'idle' | 'walk';

/** Andrew's extra animations. docs/style-guide.md section 2. */
export type AndrewAnim =
  | CommonAnim
  | 'punch1'
  | 'punch2'
  | 'punch3'
  | 'hurley'
  | 'throw'
  | 'drink'
  | 'hurt'
  | 'stumble'
  | 'fall'
  | 'getUp'
  | 'actNatural'
  /** Overhaul: one swing per melee weapon (fists keep punch1-3). */
  | 'swing.hurley'
  | 'swing.clipboard'
  | 'swing.shillelagh'
  | 'swing.umbrella'
  | 'swing.inflatable'
  | 'swing.wand'
  /** Overhaul: holding a bottle back while the throw preview is up. */
  | 'aim';

/** Myko's extra animations. He has no run cycle. */
export type MykoAnim = CommonAnim | 'blink' | 'smoke' | 'swat' | 'hurry';

/** Animations every enemy has. `telegraph` is held for the attack's telegraphMs. */
export type EnemyAnim = CommonAnim | 'telegraph' | 'attack' | 'hurt' | 'down';

export const animKey = (textureKey: string, anim: string, facing: Facing): string =>
  `${textureKey}.${anim}.${facing}`;

export const frameName = (anim: string, facing: Facing, index: number): string =>
  `${anim}.${facing}.${index}`;

/** Frame names in `TEX.icons`. All 12 x 12 unless noted. */
export const icon = {
  pintFull: 'pint.full',
  pintHalf: 'pint.half',
  pintEmpty: 'pint.empty',
  empty: 'empty',
  leaf: 'leaf',
  leafSpent: 'leaf.spent',
  detection: 'detection',
  interact: 'interact',
  mouseLeft: 'mouse.left',
  mouseRight: 'mouse.right',
  /** Overhaul: every drink in the kit, plus the empty bottle. */
  drink: (id: DrinkId | OverhaulDrinkId | 'bottle'): string => `drink.${id}`,
  /** Overhaul: the thirteen special moves. */
  move: (id: MoveId): string => `move.${id}`,
  /** Overhaul: the seven melee weapons. */
  weapon: (id: WeaponId): string => `weapon.${id}`,
  /** Overhaul: shown on the HUD while Andrew is out in the sun (chapter 8). */
  sun: 'sun',
  food: (id: FoodId): string => `food.${id}`,
  ability: (id: AbilityId): string => `ability.${id}`,
} as const;

/** Frame names in `TEX.portraits`. Generic NPCs share `npc`. */
export const portrait = (speaker: SpeakerId): string => speaker;

/** Frame names in `TEX.fx`. */
export const fx = {
  bottle: 'bottle',
  bottleSmash: ['smash.0', 'smash.1', 'smash.2'],
  sliotar: 'sliotar',
  dart: 'dart',
  bolt: 'bolt',
  ray: 'ray',
  box: 'box',
  bale: 'bale',
  fire: ['fire.0', 'fire.1', 'fire.2'],
  stunRing: ['stun.0', 'stun.1'],
  smokePuff: ['puff.0', 'puff.1', 'puff.2'],
  shadow: 'shadow',
  groundMarker: 'marker',
  pickupGlint: ['glint.0', 'glint.1'],
  /** Overhaul: one dot of the throw preview, 2 x 2 in the middle of its cell. */
  throwDot: 'throw.dot',
  /** Overhaul: a billowing smoke cloud filling its 16 x 16 cell; scale it up to fill the screen on a floor return. */
  smokeCloud: ['cloud.0', 'cloud.1', 'cloud.2'],
} as const;

/** Texture key for a named or generic NPC (see `NpcId` in cast.ts). NPCs have `idle` and `walk`. */
export const npcKey = (id: string): string => `npc.${id}`;

/** Texture key for props and furniture; frames are named in props.ts. */
export const PROPS_KEY = 'props.main';
