/**
 * Shared contracts for every system, chapter, UI and test.
 *
 * Implements DESIGN.md section 10, "Rules that keep parallel work compatible",
 * and the section, ID and roster conventions in `docs/chapters/README.md`.
 * Only systems-dev changes this file, and only with the creative director's
 * approval.
 *
 * Rules for this file:
 * - Types, interfaces, string-literal unions and `as const` constants only.
 * - No balance numbers (those live in `src/content/tuning.ts`).
 * - No player-visible text (that lives in `src/content/dialogue/`). Types here
 *   refer to text by `TextId`.
 * - No Phaser import, so everything here is plain data and unit-testable.
 */

// ---------------------------------------------------------------------------
// Primitives and identifiers
// ---------------------------------------------------------------------------

/** A point or vector in world pixels. DESIGN.md section 8 (480 x 270 internal resolution). */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** A tile coordinate on the 16 x 16 tile grid. DESIGN.md section 8. */
export interface TileCoord {
  readonly col: number;
  readonly row: number;
}

/** Four-direction facing used by walk cycles and melee. DESIGN.md section 8. */
export type Facing = 'up' | 'down' | 'left' | 'right';

/** Chapter numbers 1 to 10. DESIGN.md section 5. */
export type ChapterNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** ID prefix for a chapter, e.g. `c3`. docs/chapters/README.md. */
export type ChapterPrefix = `c${ChapterNumber}`;

/**
 * Key into `src/content/dialogue/`. Every player-visible string is looked up by
 * one of these. DESIGN.md section 10.
 */
export type TextId = string;

/** Identifier of a dialogue line or sequence. DESIGN.md section 10. */
export type DialogueId = string;

/** Screen ID, e.g. `c1.pub`. docs/chapters/README.md and each chapter's Screens table. */
export type ScreenId = `${ChapterPrefix}.${string}`;

/**
 * Identifier of a checkpoint. DESIGN.md section 7.2.
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export type CheckpointId = `${ChapterPrefix}.${string}`;

/** Identifier of an objective that Myko can hint about. DESIGN.md section 7.5. */
export type ObjectiveId = string;

/** Identifier of a pickup placed in a level. DESIGN.md section 7.1. */
export type PickupId = string;

/**
 * Region, used for both palette and music. This is the single definition;
 * `src/art/palette.ts` imports it. DESIGN.md sections 8 and 9.
 */
export type RegionId = 'kilnamoe' | 'cities' | 'ohio' | 'roswell' | 'nevada' | 'base';

/** Regions in chapter order. DESIGN.md section 8. */
export const REGIONS = ['kilnamoe', 'cities', 'ohio', 'roswell', 'nevada', 'base'] as const satisfies readonly RegionId[];

// ---------------------------------------------------------------------------
// Sections (docs/chapters/README.md, DESIGN.md sections 5, 7.3, 7.4, 7.5)
// ---------------------------------------------------------------------------

/** Section kinds from docs/chapters/README.md. */
export type SectionKind = 'fight' | 'boss' | 'setpiece' | 'puzzle' | 'deduction' | 'stealth' | 'explore';

/** Section kinds that implement `completeNow()`. docs/chapters/README.md. */
export type CompletableKind = 'fight' | 'boss' | 'setpiece' | 'puzzle' | 'deduction';

/** Completable kinds in README order. docs/chapters/README.md. */
export const COMPLETABLE_KINDS = ['fight', 'boss', 'setpiece', 'puzzle', 'deduction'] as const satisfies readonly CompletableKind[];

/** Section ID of a given kind, e.g. `c1.fight.chipper`. docs/chapters/README.md. */
export type SectionIdOf<K extends SectionKind> = `${ChapterPrefix}.${K}.${string}`;

export type FightSectionId = SectionIdOf<'fight'>;
export type PuzzleSectionId = SectionIdOf<'puzzle'>;
export type DeductionSectionId = SectionIdOf<'deduction'>;
export type StealthSectionId = SectionIdOf<'stealth'>;
export type ExploreSectionId = SectionIdOf<'explore'>;

/**
 * The fight a stealth section becomes when Andrew is caught: the stealth ID
 * plus `.alarm`, kind `fight`. docs/chapters/README.md.
 */
export type AlarmFightId = `${StealthSectionId}.alarm`;

/**
 * Every boss and set piece. Each has its own definition rather than an
 * `EnemyId`. docs/chapters/01 to 10, "Boss" sections.
 */
export type BossId =
  | 'c1.boss.bigtom'
  | 'c2.setpiece.ram'
  | 'c3.boss.halloran'
  | 'c4.boss.foreman'
  | 'c5.boss.pruitt1'
  | 'c6.setpiece.combine'
  | 'c7.boss.mascots'
  | 'c8.boss.pruitt2'
  | 'c9.setpiece.lockdown'
  | 'c10.boss.administrator';

/** The one section Myko cannot finish. DESIGN.md section 7.5, docs/chapters/10-disclosure.md. */
export const NON_CALLABLE_BOSS = 'c10.boss.administrator' as const satisfies BossId;

/** Any section ID. docs/chapters/README.md. */
export type SectionId =
  | FightSectionId
  | AlarmFightId
  | BossId
  | PuzzleSectionId
  | DeductionSectionId
  | StealthSectionId
  | ExploreSectionId;

/** IDs of sections that implement `completeNow()`. docs/chapters/README.md. */
export type CompletableSectionId = FightSectionId | AlarmFightId | BossId | PuzzleSectionId | DeductionSectionId;

// ---------------------------------------------------------------------------
// Input (DESIGN.md section 6)
// ---------------------------------------------------------------------------

/**
 * Every discrete input action. DESIGN.md section 6.
 * Movement (WASD) and aim (mouse) are continuous and live on `InputFrame`.
 */
export type InputAction =
  | 'melee'
  | 'ranged'
  /** @deprecated overhaul phase 2/5 removes this. */
  | 'dodge'
  | 'drink'
  /** @deprecated overhaul phase 2/5 removes this. */
  | 'selectDrink1'
  /** @deprecated overhaul phase 2/5 removes this. */
  | 'selectDrink2'
  /** @deprecated overhaul phase 2/5 removes this. */
  | 'selectDrink3'
  | 'selectDrinkNext'
  | 'selectDrinkPrev'
  /** @deprecated overhaul phase 2/5 removes this. */
  | 'special'
  /** @deprecated overhaul phase 2/5 removes this. */
  | 'cycleSpecial'
  | 'sneak'
  | 'interact'
  | 'hint'
  | 'callMyko'
  | 'casebook'
  | 'pause'
  // --- Overhaul actions (DESIGN.md section 6) ---
  | 'special1'
  | 'special2'
  | 'special3'
  | 'special4'
  | 'cycleWeapon'
  | 'cycleDrink'
  | 'openTab'
  | 'aimHold';

/** Physical input a binding refers to. Key names follow `KeyboardEvent.code`. DESIGN.md section 6. */
export type InputBinding =
  | { readonly device: 'keyboard'; readonly code: string }
  | { readonly device: 'mouse'; readonly button: 'left' | 'right' }
  | { readonly device: 'wheel'; readonly direction: 'up' | 'down' };

/** Default bindings from DESIGN.md section 6. Not balance, not player-visible text. */
export const DEFAULT_BINDINGS = {
  moveUp: [{ device: 'keyboard', code: 'KeyW' }],
  moveLeft: [{ device: 'keyboard', code: 'KeyA' }],
  moveDown: [{ device: 'keyboard', code: 'KeyS' }],
  moveRight: [{ device: 'keyboard', code: 'KeyD' }],
  melee: [{ device: 'mouse', button: 'left' }],
  ranged: [{ device: 'mouse', button: 'right' }],
  /** @deprecated overhaul phase 2/5 removes this. */
  dodge: [{ device: 'keyboard', code: 'Space' }],
  drink: [{ device: 'keyboard', code: 'KeyQ' }],
  /** @deprecated overhaul phase 2/5 removes this. */
  selectDrink1: [{ device: 'keyboard', code: 'Digit1' }],
  /** @deprecated overhaul phase 2/5 removes this. */
  selectDrink2: [{ device: 'keyboard', code: 'Digit2' }],
  /** @deprecated overhaul phase 2/5 removes this. */
  selectDrink3: [{ device: 'keyboard', code: 'Digit3' }],
  selectDrinkNext: [{ device: 'wheel', direction: 'down' }],
  selectDrinkPrev: [{ device: 'wheel', direction: 'up' }],
  /** @deprecated overhaul phase 2/5 removes this. */
  special: [{ device: 'keyboard', code: 'KeyF' }],
  /** @deprecated overhaul phase 2/5 removes this. */
  cycleSpecial: [{ device: 'keyboard', code: 'KeyR' }],
  sneak: [
    { device: 'keyboard', code: 'ShiftLeft' },
    { device: 'keyboard', code: 'ShiftRight' },
  ],
  interact: [{ device: 'keyboard', code: 'KeyE' }],
  hint: [{ device: 'keyboard', code: 'KeyH' }],
  callMyko: [{ device: 'keyboard', code: 'KeyM' }],
  casebook: [{ device: 'keyboard', code: 'Tab' }],
  pause: [{ device: 'keyboard', code: 'Escape' }],
  // --- Overhaul actions (DESIGN.md section 6) ---
  // Most collide with a binding that still does something, so they stay
  // unbound until phase 2 removes the old action:
  //  - special1..3 collide with selectDrink1..3 (Digit1..3).
  //  - cycleWeapon is KeyR, which is cycleSpecial.
  //  - cycleDrink is the wheel, which is selectDrinkNext/Prev.
  //  - openTab is Tab, which is casebook.
  //  - aimHold is right click, which is ranged (hold = `held`, release = `released`).
  special1: [],
  special2: [],
  special3: [],
  special4: [{ device: 'keyboard', code: 'Digit4' }],
  cycleWeapon: [],
  cycleDrink: [],
  openTab: [],
  aimHold: [],
} as const satisfies Readonly<
  Record<InputAction | 'moveUp' | 'moveLeft' | 'moveDown' | 'moveRight', readonly InputBinding[]>
>;

/**
 * One frame of resolved input, independent of Phaser. DESIGN.md section 6.
 * `pressed` and `released` hold edges for this frame; `held` holds current state.
 * `holdMs` reports how long a held action has been down (used by "hold M for
 * 1 second" and Sliotar Strike charging).
 */
export interface InputFrame {
  /** Movement vector from WASD, each axis in -1..1. */
  readonly move: Vec2;
  /** Mouse position in world pixels. */
  readonly aim: Vec2;
  readonly held: ReadonlySet<InputAction>;
  readonly pressed: ReadonlySet<InputAction>;
  readonly released: ReadonlySet<InputAction>;
  readonly holdMs: Readonly<Partial<Record<InputAction, number>>>;
}

// ---------------------------------------------------------------------------
// Buzz and hangover (DESIGN.md section 7.1)
// ---------------------------------------------------------------------------

/**
 * The four Buzz states. DESIGN.md section 7.1.
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export type BuzzState = 'sober' | 'grand' | 'locked' | 'banjaxed';

/**
 * Buzz states in ascending order. DESIGN.md section 7.1.
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export const BUZZ_STATES = ['sober', 'grand', 'locked', 'banjaxed'] as const satisfies readonly BuzzState[];

/**
 * Banjaxed has a timed sequence: boosted for a while, then Andrew falls over,
 * then Buzz drops. DESIGN.md section 7.1.
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export type BanjaxedPhase = 'none' | 'peak' | 'fallen';

/**
 * Effects applied while in a Buzz state. Values come from tuning. DESIGN.md section 7.1.
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export interface BuzzStateEffects {
  readonly damageMultiplier: number;
  readonly attackSpeedMultiplier: number;
  /** 0 = full knockback, 1 = immune. */
  readonly knockbackResistance: number;
  readonly specialsUnlocked: boolean;
  /** Aim sway amplitude in degrees. Also used at full heat ("sways as if Locked"). */
  readonly aimSwayDeg: number;
  /** Movement drift strength, 0 = none. */
  readonly movementDrift: number;
  /** Multiplier on footstep noise radius in stealth. */
  readonly footstepNoiseMultiplier: number;
  /** Screen wobble strength, 0 = none. */
  readonly screenWobble: number;
}

/**
 * Runtime Buzz state, owned by the Buzz system. DESIGN.md section 7.1.
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export interface BuzzSnapshot {
  /** 0..max (max is 100 in DESIGN.md, set in tuning). */
  readonly value: number;
  readonly state: BuzzState;
  readonly banjaxedPhase: BanjaxedPhase;
  /** Milliseconds left in the current Banjaxed phase, 0 when phase is 'none'. */
  readonly banjaxedPhaseMsLeft: number;
}

/**
 * Hangover carried into a chapter. DESIGN.md section 7.1, docs/chapters/README.md "Carry-over rules".
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export interface HangoverState {
  readonly active: boolean;
}

/**
 * A timed buff or debuff on the player. DESIGN.md section 7.1 (bourbon, tequila, tea).
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export type TimedEffectKind = 'speedBoost' | 'extraSway' | 'steadyAim';

/**
 * An active timed effect. DESIGN.md section 7.1.
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export interface ActiveTimedEffect {
  readonly kind: TimedEffectKind;
  readonly msLeft: number;
  /** Strength; a multiplier for speedBoost and extraSway, unused for steadyAim. */
  readonly magnitude: number;
}

// ---------------------------------------------------------------------------
// Heat (docs/chapters/08-the-long-road.md)
// ---------------------------------------------------------------------------

/**
 * Heat meter (chapter 8, daylight only). Rises in sun, faster when running,
 * falls in shade, reset by water. At full heat Andrew loses health slowly and
 * sways as if Locked. Thermal masts see him above a threshold.
 * docs/chapters/08-the-long-road.md "Heat".
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export interface HeatSnapshot {
  /** False after sunset, when the meter goes away. */
  readonly active: boolean;
  /** 0..max, max set in tuning. */
  readonly value: number;
}

// ---------------------------------------------------------------------------
// Drinks and food (DESIGN.md section 7.1)
// ---------------------------------------------------------------------------

/**
 * Everything carried in a drink slot and used with Q. Water is a drink here
 * (Buzz 0, resets heat). DESIGN.md section 7.1.
 */
export type DrinkId =
  | 'stout'
  | 'whiskey'
  | 'poitin'
  | 'lightBeer'
  | 'bourbon'
  | 'craftIpa'
  | 'tequila'
  | 'water';

/**
 * Food, consumed on pickup or interaction and never carried. DESIGN.md section 7.1.
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export type FoodId = 'crisps' | 'chickenFilletRoll' | 'breakfastRoll' | 'spiceBag' | 'tea';

/**
 * One effect of consuming a drink or food. Magnitudes come from tuning.
 * DESIGN.md section 7.1.
 */
export type ConsumableEffect =
  | { readonly kind: 'buzz'; readonly amount: number }
  | { readonly kind: 'heal'; readonly amount: number }
  | { readonly kind: 'healFull' }
  | { readonly kind: 'cureHangover' }
  | { readonly kind: 'resetHeat' }
  | { readonly kind: 'timed'; readonly effect: TimedEffectKind; readonly durationMs: number; readonly magnitude: number };

/** A drink. Defined in `src/content/tuning.ts`. DESIGN.md section 7.1. */
export interface DrinkDef {
  readonly id: DrinkId;
  /** Display name in `src/content/dialogue/`. */
  readonly nameTextId: TextId;
  /** Pickup text in `src/content/dialogue/`. */
  readonly pickupTextId: TextId;
  readonly effects: readonly ConsumableEffect[];
  /** Empties left after drinking (DESIGN.md: "Every drink leaves an empty"). */
  readonly emptiesLeft: number;
}

/**
 * A food. Defined in `src/content/tuning.ts`. A food pickup that would do
 * nothing (full health, no hangover) stays where it is. DESIGN.md section 7.1.
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export interface FoodDef {
  readonly id: FoodId;
  readonly nameTextId: TextId;
  readonly pickupTextId: TextId;
  readonly effects: readonly ConsumableEffect[];
}

/**
 * One filled drink slot: one drink type with a count. DESIGN.md sections 6 and 7.1.
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export interface DrinkSlot {
  readonly drinkId: DrinkId;
  /** 1..tuning.player.drinkSlotCap. */
  readonly count: number;
}

/**
 * Andrew's three fixed drink slots, selected with 1/2/3 or the wheel. A new
 * drink type with no free slot stays on the ground. DESIGN.md sections 6 and 7.1.
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export type DrinkSlots = readonly [DrinkSlot | null, DrinkSlot | null, DrinkSlot | null];

/**
 * Index into `DrinkSlots`. DESIGN.md section 6.
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export type DrinkSlotIndex = 0 | 1 | 2;

/** Something Andrew can pick up or be given. DESIGN.md section 7.1. */
export type PickupItem =
  | { readonly kind: 'drink'; readonly drinkId: DrinkId; readonly count: number }
  | { readonly kind: 'food'; readonly foodId: FoodId }
  | { readonly kind: 'empties'; readonly count: number };

/** Why a pickup stayed on the ground. DESIGN.md section 7.1. */
export type PickupRefusal = 'noFreeSlot' | 'slotFull' | 'emptiesFull' | 'noEffect';

/** A pickup placed in a level. DESIGN.md section 7.1. */
export interface PickupDef {
  readonly id: PickupId;
  readonly item: PickupItem;
  readonly screenId: ScreenId;
  readonly position: Vec2;
  /** Optional Myko comment on pickup (e.g. one per craft IPA). DESIGN.md sections 7.1 and 7.5. */
  readonly commentDialogueId?: DialogueId;
}

// ---------------------------------------------------------------------------
// Abilities and combat (DESIGN.md section 7.2)
// ---------------------------------------------------------------------------

/** Every player ability. DESIGN.md section 7.2. */
export type AbilityId =
  | 'punchCombo'
  | 'bottleThrow'
  | 'stumble'
  | 'stoutSlam'
  | 'actNatural'
  | 'hurley'
  | 'sliotarStrike'
  | 'poitinBreath'
  | 'borrowedGlove';

/**
 * Abilities bound to F and cycled with R. DESIGN.md section 6.
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export type SpecialAbilityId = 'stoutSlam' | 'poitinBreath' | 'borrowedGlove';

/**
 * Specials in cycle order. DESIGN.md section 6.
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export const SPECIAL_ABILITIES = ['stoutSlam', 'poitinBreath', 'borrowedGlove'] as const satisfies readonly SpecialAbilityId[];

/**
 * Which input an ability is driven by. DESIGN.md sections 6 and 7.2.
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export type AbilitySlot = 'melee' | 'ranged' | 'dodge' | 'special' | 'passive';

/** What an ability costs to use. DESIGN.md section 7.2. */
export type AbilityCost =
  | { readonly kind: 'none' }
  | { readonly kind: 'buzz'; readonly amount: number }
  | { readonly kind: 'empties'; readonly amount: number }
  /** Recharges on its own (the Borrowed Glove). */
  | { readonly kind: 'recharge'; readonly rechargeMs: number };

/** Geometry of a hit. Shared by player abilities and enemy attacks. DESIGN.md sections 7.2 and 7.3. */
export type AttackShape =
  | { readonly kind: 'none' }
  | { readonly kind: 'arc'; readonly range: number; readonly arcDeg: number }
  | { readonly kind: 'circle'; readonly radius: number }
  | { readonly kind: 'cone'; readonly range: number; readonly angleDeg: number }
  | { readonly kind: 'charge'; readonly distance: number; readonly width: number }
  | {
      readonly kind: 'projectile';
      readonly speed: number;
      readonly range: number;
      /** Number of enemies it passes through; 0 stops at the first. */
      readonly pierce: number;
      /** Thrown in an arc over obstacles rather than straight. */
      readonly lobbed: boolean;
      /** Can be knocked back by a timed hurley swing. */
      readonly deflectable: boolean;
      /** Noise radius where it lands, 0 for silent. Bottle Throw distracts guards. */
      readonly impactNoiseRadius: number;
    };

/** A player ability. Defined in `src/content/tuning.ts`. DESIGN.md section 7.2. */
export interface AbilityDef {
  readonly id: AbilityId;
  readonly slot: AbilitySlot;
  /** Chapter in which it is unlocked. */
  readonly unlockChapter: ChapterNumber;
  /** Ability this one replaces when unlocked (Hurley replaces punchCombo). */
  readonly replaces?: AbilityId;
  /** Requires another ability to be unlocked (Sliotar Strike requires Hurley). */
  readonly requires?: AbilityId;
  readonly cost: AbilityCost;
  readonly cooldownMs: number;
  readonly shape: AttackShape;
  /** Base damage per hit before Buzz multipliers. */
  readonly damage: number;
  readonly knockback: number;
  /** Per-hit tuning for a melee combo (punch: three hits, the third a haymaker). */
  readonly combo?: readonly ComboHitDef[];
  /** Hold time for a charged use (Sliotar Strike). */
  readonly chargeMs?: number;
  /** Invulnerability window (The Stumble). */
  readonly invulnerableMs?: number;
  /** Stun duration applied to targets (The Borrowed Glove). */
  readonly stunMs?: number;
  /** Timed-deflect window for projectiles (Hurley). */
  readonly deflectWindowMs?: number;
  /** Dash distance (The Stumble). */
  readonly dashDistance?: number;
  /** Name and description in `src/content/dialogue/`. */
  readonly nameTextId: TextId;
}

/** One hit of a melee combo. DESIGN.md section 7.2. */
export interface ComboHitDef {
  readonly damage: number;
  readonly knockback: number;
  readonly windowMs: number;
}

/**
 * Health of any combatant. DESIGN.md section 7.2.
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export interface Health {
  readonly current: number;
  readonly max: number;
}

/** Enemy roster IDs. docs/chapters/README.md "Enemy roster". */
export type EnemyId =
  | 'lad'
  | 'cousin'
  | 'suit'
  | 'worker'
  | 'brawler'
  | 'docker'
  | 'agent'
  | 'drone'
  | 'mascot'
  | 'clerk'
  | 'security';

/** Who dealt a hit. DESIGN.md sections 7.2 and 7.5. */
export type DamageSource =
  | { readonly kind: 'player'; readonly abilityId: AbilityId }
  | { readonly kind: 'enemy'; readonly enemyId: EnemyId; readonly attackId: string }
  | { readonly kind: 'boss'; readonly bossId: BossId; readonly attackId: string }
  | { readonly kind: 'myko' }
  /** Environmental damage, including full heat. */
  | { readonly kind: 'hazard'; readonly hazardId: string };

/** A resolved hit. DESIGN.md section 7.2. */
export interface HitInfo {
  readonly source: DamageSource;
  /** Runtime instance id of the target. */
  readonly targetInstanceId: string;
  readonly amount: number;
  readonly knockback: Vec2;
  readonly stunMs: number;
  /** Hold the target in place (the brawler's grab), 0 for none. */
  readonly holdMs: number;
}

/** Status conditions an enemy can be in. DESIGN.md sections 7.2 and 7.3. */
export type EnemyStatus = 'normal' | 'telegraphing' | 'attacking' | 'recovering' | 'stunned' | 'knockedBack' | 'down';

/** Enemy groups from the story. DESIGN.md section 4. */
export type EnemyFaction = 'local' | 'federal' | 'alien' | 'machine' | 'animal';

/** One attack. Every attack is telegraphed. DESIGN.md section 7.2. */
export interface AttackDef {
  readonly id: string;
  readonly shape: AttackShape;
  /** @deprecated overhaul phase 2/5 removes this; Andrew has no health. Use `weight`. */
  readonly damage: number;
  /**
   * How far this hit pushes the Buzz meter. DESIGN.md 7.1 "Being hit". Optional
   * until phase 2; `src/content/tuning.ts` fills it in for every attack.
   */
  readonly weight?: HitWeight;
  readonly knockback: number;
  /** Visible warning before the hit lands. Must be > 0. */
  readonly telegraphMs: number;
  readonly cooldownMs: number;
  /** Recovery after the attack, during which the attacker is open. */
  readonly recoveryMs: number;
  /** Shots fired per use (the clerk's three-shot burst), default 1. */
  readonly burst?: number;
  /** Holds Andrew in place unless he Stumbles (the brawler's grab). */
  readonly holdMs?: number;
}

/** A roster enemy. Defined in `src/content/tuning.ts`. docs/chapters/README.md, DESIGN.md section 7.2. */
export interface EnemyDef {
  readonly id: EnemyId;
  readonly faction: EnemyFaction;
  readonly nameTextId: TextId;
  /** Key of a sprite generator in `src/art/`. */
  readonly spriteKey: string;
  readonly maxHealth: number;
  readonly moveSpeed: number;
  readonly knockbackResistance: number;
  readonly flies: boolean;
  readonly attacks: readonly AttackDef[];
  /** Present for enemies that can act as stealth guards. */
  readonly senses?: GuardSensesDef;
  /** Frontal shield arc in degrees (security); 0 or absent for none. */
  readonly frontalShieldDeg?: number;
  /** Looks like a tourist until it first attacks (mascot). */
  readonly disguisedUntilAttack?: boolean;
}

/** What starts a boss phase. docs/chapters, "Boss" sections. */
export type BossPhaseTrigger =
  | { readonly kind: 'start' }
  | { readonly kind: 'healthBelow'; readonly fraction: number }
  | { readonly kind: 'targetsLeft'; readonly count: number }
  | { readonly kind: 'elapsedMs'; readonly ms: number };

/** How a boss or set piece ends. docs/chapters, "Boss" sections. */
export type BossEndCondition =
  | { readonly kind: 'healthBelow'; readonly fraction: number }
  | { readonly kind: 'targetsDestroyed'; readonly count: number }
  | { readonly kind: 'reachExit' }
  | { readonly kind: 'scripted' };

/** One boss phase. docs/chapters, "Boss" sections. */
export interface BossPhaseDef {
  readonly id: string;
  readonly trigger: BossPhaseTrigger;
  readonly attacks: readonly AttackDef[];
  readonly attackSpeedMultiplier: number;
  /** Walking pace in this phase; absent keeps `BossDef.moveSpeed`. */
  readonly moveSpeed?: number;
}

/** A boss or set piece. Defined in `src/content/tuning.ts` under its section ID. docs/chapters, "Boss" sections. */
export interface BossDef {
  readonly id: BossId;
  readonly kind: 'boss' | 'setpiece';
  readonly nameTextId: TextId;
  readonly spriteKey: string;
  /** Absent for set pieces with no health bar. */
  readonly maxHealth?: number;
  readonly phases: readonly BossPhaseDef[];
  readonly end: BossEndCondition;
  /** Arena size in tiles. */
  readonly arenaTiles: { readonly width: number; readonly height: number };
  /**
   * Walking pace of the bodies (pixels per second). A phase's `moveSpeed`
   * overrides it, and a body placement's `moveSpeed` overrides both. 0 stands still.
   */
  readonly moveSpeed: number;
  /** How long `BossRunner.daze()` stuns a body, for bosses that can be dazed (Big Tom into the tractor). */
  readonly dazedMs?: number;
  /** Damage-taken multiplier while dazed. */
  readonly dazedDamageMultiplier?: number;
}

/** One wave of a fight. docs/chapters, "Beats". */
export interface WaveDef {
  readonly enemies: readonly { readonly enemyId: EnemyId; readonly count: number }[];
}

/** A fight's waves. Defined in `src/content/tuning.ts` under its section ID. docs/chapters/README.md. */
export interface FightDef {
  readonly id: FightSectionId | AlarmFightId;
  readonly waves: readonly WaveDef[];
}

// ---------------------------------------------------------------------------
// Stealth (DESIGN.md section 7.3, docs/chapters/08-the-long-road.md)
// ---------------------------------------------------------------------------

/** A guard's vision cone and hearing. DESIGN.md section 7.3. */
export interface GuardSensesDef {
  readonly visionRange: number;
  readonly visionAngleDeg: number;
  readonly hearingRadius: number;
}

/**
 * Guard alert states. DESIGN.md section 7.3.
 * - patrol: following its route.
 * - investigating: heard a noise and is going to look.
 * - detecting: sees Andrew; the detection marker is filling.
 * - alarm: marker filled; the section is now its `.alarm` fight.
 */
export type AlertState = 'patrol' | 'investigating' | 'detecting' | 'alarm';

/** How a patrol route repeats. DESIGN.md section 7.3. */
export type PatrolMode = 'loop' | 'pingPong' | 'stationary';

/** One patrol stop. DESIGN.md section 7.3. */
export interface PatrolWaypoint {
  readonly position: Vec2;
  readonly waitMs: number;
  /** Direction to face while waiting. */
  readonly facing?: Facing;
}

/** A patrol route. DESIGN.md section 7.3. */
export interface PatrolRoute {
  readonly mode: PatrolMode;
  readonly waypoints: readonly PatrolWaypoint[];
}

/** Sources of noise guards react to. DESIGN.md section 7.3, docs/chapters/06 (corn rustle). */
export type NoiseKind = 'footstep' | 'sneakFootstep' | 'rustle' | 'bottle' | 'combat' | 'breakable' | 'other';

/** A noise emitted into the world. DESIGN.md section 7.3. */
export interface NoiseEvent {
  readonly kind: NoiseKind;
  readonly position: Vec2;
  readonly radius: number;
}

/** Runtime state of one guard. DESIGN.md section 7.3. */
export interface GuardSnapshot {
  readonly instanceId: string;
  readonly enemyId: EnemyId;
  readonly position: Vec2;
  /** Facing angle in degrees, 0 = right, clockwise. */
  readonly facingDeg: number;
  readonly alert: AlertState;
  /** Detection marker fill, 0..1. Fills over about one second while Andrew is seen. */
  readonly detection: number;
  /** Where the guard is investigating, when alert is 'investigating'. */
  readonly investigateTarget?: Vec2;
}

/** Places Andrew can Act Natural. DESIGN.md section 7.2, docs/chapters/05, 06, 09. */
export type HidingPropKind = 'queue' | 'noticeboard' | 'vendingMachine' | 'waterCooler' | 'tallCorn';

/** A prop or area that enables Act Natural. DESIGN.md section 7.2. */
export interface HidingPropDef {
  readonly id: string;
  readonly kind: HidingPropKind;
  readonly position: Vec2;
  readonly radius: number;
}

/** A vision cone. DESIGN.md section 7.3. */
export interface ConeDef {
  readonly range: number;
  readonly angleDeg: number;
}

/**
 * Non-guard stealth hazards. docs/chapters/04 (floodlights) and
 * docs/chapters/08-the-long-road.md (ground sensors, thermal masts, patrol trucks).
 * Only trucks move.
 */
export type StealthHazardDef =
  | {
      /** Detects running within its radius. Sneaking or walking is safe. */
      readonly kind: 'groundSensor';
      readonly id: string;
      readonly position: Vec2;
      readonly radius: number;
    }
  | {
      /** Detects Andrew within range while his heat is above `tuning.heat.thermalDetectFraction`. */
      readonly kind: 'thermalMast';
      readonly id: string;
      readonly position: Vec2;
      readonly range: number;
    }
  | {
      /** Drives a route with a headlight cone. Blocked by sight-blocking tiles. */
      readonly kind: 'patrolTruck';
      readonly id: string;
      readonly route: PatrolRoute;
      readonly speed: number;
      readonly headlights: ConeDef;
    }
  | {
      /** Fixed position, cone sweeps back and forth. */
      readonly kind: 'floodlight';
      readonly id: string;
      readonly position: Vec2;
      readonly cone: ConeDef;
      readonly sweepFromDeg: number;
      readonly sweepToDeg: number;
      readonly sweepPeriodMs: number;
    };

/** A guard placed in a stealth section. DESIGN.md section 7.3. */
export interface GuardPlacement {
  readonly enemyId: EnemyId;
  readonly route: PatrolRoute;
  /** Seated guards (chapter 9 clerks) have short cones and look up on noise. */
  readonly seated?: boolean;
}

/**
 * Bonus for finishing a stealth section without the alarm: a drink, food or
 * colour clue. Never a key clue and never proof. DESIGN.md section 7.3.
 */
export type CleanRunReward =
  | { readonly kind: 'pickup'; readonly item: PickupItem }
  | { readonly kind: 'clue'; readonly clueId: ClueId };

/**
 * A stealth section. A checkpoint sits before each one. Being caught converts
 * it to the fight `<id>.alarm`. DESIGN.md sections 7.2 and 7.3.
 */
export interface StealthSectionDef {
  readonly id: StealthSectionId;
  /** @deprecated overhaul phase 2/5 removes this (checkpoints go; DESIGN.md 7.1 "Back to the bar"). */
  readonly checkpointId: CheckpointId;
  readonly guards: readonly GuardPlacement[];
  readonly hazards: readonly StealthHazardDef[];
  readonly hidingProps: readonly HidingPropDef[];
  readonly cleanRunReward?: CleanRunReward;
  /** Overhaul reward (DESIGN.md 7.3). Replaces `cleanRunReward` in phase 2. */
  readonly reward?: CleanRunRewardDef;
}

// ---------------------------------------------------------------------------
// Investigation, casebook, deduction, puzzles (DESIGN.md section 7.4)
// ---------------------------------------------------------------------------

/** Clue ID, e.g. `c2.clue.fragment`. docs/chapters/README.md. */
export type ClueId = `${ChapterPrefix}.clue.${string}`;

/** The five proofs shown in the broadcast. docs/chapters/09-level-minus-four.md "The five proofs". */
export type ProofId = 'c9.proof.craft' | 'c9.proof.contract' | 'c9.proof.directory' | 'c9.proof.log' | 'c9.proof.footage';

/** All five proofs. docs/chapters/09-level-minus-four.md. */
export const PROOFS = [
  'c9.proof.craft',
  'c9.proof.contract',
  'c9.proof.directory',
  'c9.proof.log',
  'c9.proof.footage',
] as const satisfies readonly ProofId[];

/** Anything that goes in the casebook as evidence and can be linked on a deduction board. docs/chapters/09 (proofs used on a board). */
export type EvidenceId = ClueId | ProofId;

/**
 * How a piece of evidence matters. Key clues are needed for a deduction board;
 * colour clues are not; proofs are the broadcast items. docs/chapters/README.md.
 */
export type EvidenceKind = 'key' | 'colour' | 'proof';

/**
 * A clue or proof. Text is in Andrew's words, with Myko's margin note.
 * DESIGN.md section 7.4.
 */
export interface Clue {
  readonly id: EvidenceId;
  readonly kind: EvidenceKind;
  readonly chapter: ChapterNumber;
  /** Short name shown on the deduction board. */
  readonly titleTextId: TextId;
  /** Andrew's casebook entry. */
  readonly bodyTextId: TextId;
  /** Myko's note in the margin. */
  readonly marginTextId: TextId;
}

/** Something examinable or usable with E. DESIGN.md section 7.4. */
export interface ExaminableDef {
  readonly id: string;
  readonly screenId: ScreenId;
  readonly position: Vec2;
  /** Evidence added on examine, if any. */
  readonly evidenceId?: EvidenceId;
  /** Item given on interaction (the kiosk tea, the diner coffee). */
  readonly item?: PickupItem;
  /** Line shown on examine. */
  readonly dialogueId?: DialogueId;
}

/** A casebook entry. DESIGN.md sections 7.4 and 7.5. */
export type CasebookEntry =
  | { readonly kind: 'evidence'; readonly evidenceId: EvidenceId; readonly chapter: ChapterNumber }
  | {
      /** Written when a deduction board is solved. */
      readonly kind: 'lead';
      readonly deductionId: DeductionSectionId;
      readonly chapter: ChapterNumber;
    }
  | {
      /** Andrew's brief, inaccurate record of a Myko call, with Myko's correction. One per call. */
      readonly kind: 'mykoCall';
      readonly sectionId: CompletableSectionId;
      readonly callKind: MykoCallKind;
      readonly chapter: ChapterNumber;
    };

/**
 * A deduction board: link three clues to name a fixed lead. A wrong answer
 * costs nothing except a remark from Myko. DESIGN.md section 7.4.
 */
export interface DeductionBoardDef {
  readonly id: DeductionSectionId;
  readonly chapter: ChapterNumber;
  /** Evidence offered on the board (the player's casebook, filtered). */
  readonly candidateIds: readonly EvidenceId[];
  /** The three items that must be linked. Order does not matter. */
  readonly solution: readonly [EvidenceId, EvidenceId, EvidenceId];
  /** The lead named when solved, and its casebook entry. */
  readonly leadTextId: TextId;
  readonly leadMarginTextId: TextId;
  /** Myko's remarks on wrong answers, cycled. */
  readonly wrongAnswerDialogueIds: readonly DialogueId[];
}

/** Physical puzzle kinds. docs/chapters/01 to 10, "puzzle" beats. */
export type PuzzleKind =
  | 'push'
  | 'sheepGates'
  | 'containers'
  | 'redacted'
  | 'maze'
  | 'spotTheAlien'
  | 'junctions'
  | 'gravity'
  | 'broadcast';

/** A chapter's one physical puzzle. Puzzle-specific layout lives in the chapter. DESIGN.md section 7.4. */
export interface PuzzleDef {
  readonly id: PuzzleSectionId;
  readonly chapter: ChapterNumber;
  readonly kind: PuzzleKind;
}

// ---------------------------------------------------------------------------
// Sections and completeNow (DESIGN.md sections 7.5 and 10)
// ---------------------------------------------------------------------------

/** Which set of Myko call lines applies. DESIGN.md section 7.5. */
export type MykoCallKind = 'fight' | 'puzzle';

/** Call line set used for each completable kind. docs/chapters/README.md, DESIGN.md section 7.5. */
export const MYKO_CALL_KIND_BY_SECTION = {
  fight: 'fight',
  boss: 'fight',
  setpiece: 'fight',
  puzzle: 'puzzle',
  deduction: 'puzzle',
} as const satisfies Readonly<Record<CompletableKind, MykoCallKind>>;

/** Who finished a section. DESIGN.md sections 7.5 and 10. */
export type CompletionSource = 'player' | 'myko' | 'debug';

/** What finishing a section grants. DESIGN.md sections 7.3 and 7.5. */
export interface Reward {
  readonly pickups?: readonly PickupItem[];
  readonly evidenceIds?: readonly EvidenceId[];
  readonly abilityIds?: readonly AbilityId[];
}

/** Static definition of a section. docs/chapters/README.md. */
export interface SectionDef {
  readonly id: SectionId;
  readonly kind: SectionKind;
  /** False for stealth, explore and `c10.boss.administrator`. */
  readonly mykoCallable: boolean;
  /** Checkpoint before this section (every stealth, boss and setpiece has one). */
  readonly checkpointId?: CheckpointId;
  readonly reward?: Reward;
}

/**
 * The single entry point every fight, boss, setpiece, puzzle and deduction
 * exposes. The Myko call-in and the QA playthrough both use it. It is
 * synchronous: the Myko system plays the call-in, then calls it. It must leave
 * the game in the same state as the player finishing normally, including
 * rewards, then emit `section:completed`. On a finished section it does
 * nothing. DESIGN.md sections 7.5 and 10.
 */
export interface Completable {
  readonly sectionId: CompletableSectionId;
  readonly kind: CompletableKind;
  isComplete(): boolean;
  completeNow(source: CompletionSource): void;
}

/**
 * The scripted way to complete a whole chapter, for QA. DESIGN.md section 10.
 */
export interface ChapterCompletable {
  readonly chapter: ChapterNumber;
  completeNow(source: CompletionSource): void;
}

// ---------------------------------------------------------------------------
// Myko (DESIGN.md section 7.5)
// ---------------------------------------------------------------------------

/** Where Myko is and what he is doing. DESIGN.md section 7.5. */
export type MykoMode = 'following' | 'onPhone' | 'calledIn' | 'scripted';

/** Things Myko comments on unprompted. DESIGN.md section 7.5, docs/chapters/08 (drinking in heat). */
export type MykoCommentTrigger = 'clue' | 'drink' | 'death' | 'hangover' | 'idle' | 'heat' | 'tangent';

/** Hint pair for one objective: a nudge, then the answer. DESIGN.md section 7.5. */
export interface HintDef {
  readonly objectiveId: ObjectiveId;
  readonly nudgeDialogueId: DialogueId;
  readonly answerDialogueId: DialogueId;
}

/** A current objective. DESIGN.md section 7.5. */
export interface ObjectiveDef {
  readonly id: ObjectiveId;
  readonly textId: TextId;
  readonly hint: HintDef;
}

/** Record of one spent Myko call, stored in the save. DESIGN.md sections 7.5 and 7.6. */
export interface MykoCallRecord {
  readonly chapter: ChapterNumber;
  readonly sectionId: CompletableSectionId;
  readonly kind: MykoCallKind;
}

/** One set of call lines: Myko's sequence plus the casebook entry. DESIGN.md section 7.5. */
export interface MykoCallLineSet {
  readonly sequenceId: DialogueId;
  readonly casebookBodyTextId: TextId;
  readonly casebookMarginTextId: TextId;
}

/** Myko's per-chapter call lines, one set per kind. DESIGN.md section 7.5. */
export type MykoCallLines = Readonly<Record<MykoCallKind, MykoCallLineSet>>;

// ---------------------------------------------------------------------------
// Dialogue (DESIGN.md sections 2, 3, 7.5)
// ---------------------------------------------------------------------------

/** Named speakers plus a generic NPC and the narrator caption. DESIGN.md section 3. */
export type SpeakerId =
  | 'andrew'
  | 'myko'
  | 'dympna'
  | 'halloran'
  | 'colleenAnn'
  | 'pruitt'
  | 'gary'
  | 'administrator'
  | 'npc'
  | 'narrator';

/**
 * One line of dialogue. Instances live only in `src/content/dialogue/`.
 * DESIGN.md sections 2, 3 and 10.
 */
export interface DialogueLine {
  readonly id: DialogueId;
  readonly speaker: SpeakerId;
  /** Display name for generic NPCs (speaker 'npc'). */
  readonly speakerName?: string;
  /** Stage direction shown with the line, e.g. "quietly". */
  readonly direction?: string;
  readonly text: string;
}

/**
 * How a sequence is presented. Commentary never blocks play; only scripted
 * scenes do. DESIGN.md section 7.5.
 */
export type DialogueDelivery = 'box' | 'scene' | 'caption';

/** An ordered set of lines. DESIGN.md section 7.5. */
export interface DialogueSequence {
  readonly id: DialogueId;
  readonly delivery: DialogueDelivery;
  readonly lines: readonly DialogueLine[];
}

// ---------------------------------------------------------------------------
// Chapters and checkpoints (DESIGN.md sections 5, 7.2, 10)
// ---------------------------------------------------------------------------

/**
 * Why a checkpoint exists. DESIGN.md section 7.2, docs/chapters/README.md.
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export type CheckpointKind = 'chapterStart' | 'stealth' | 'boss' | 'setpiece' | 'other';

/**
 * A checkpoint. DESIGN.md sections 7.2 and 7.6.
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export interface CheckpointDef {
  readonly id: CheckpointId;
  readonly kind: CheckpointKind;
  readonly screenId: ScreenId;
  readonly position: Vec2;
}

/** Per-tile flags, row-major, one entry per tile. DESIGN.md section 8 (16 x 16 tiles). */
export interface TileGrid {
  readonly widthTiles: number;
  readonly heightTiles: number;
  /** true = impassable. Length is widthTiles * heightTiles. */
  readonly blocked: readonly boolean[];
  /** true = blocks vision cones and headlights (turf stacks, containers, outcrops). */
  readonly blocksSight: readonly boolean[];
  /** true = shade, where heat falls (chapter 8). Absent where heat does not apply. */
  readonly shade?: readonly boolean[];
}

/** One connected screen. docs/chapters, "Screens" tables. */
export interface ScreenDef {
  readonly id: ScreenId;
  readonly region: RegionId;
  /**
   * Out in the sun: drain doubles and beer goes half as far again (DESIGN.md
   * 7.1 "Heat"). Replaces the heat meter and `TileGrid.shade`. Absent = false.
   */
  readonly sun?: boolean;
  readonly widthTiles: number;
  readonly heightTiles: number;
  /**
   * @deprecated Ignored: no system shows location cards. Chapters play their
   * `cN.caption.*` caption sequences with `ctx.say` instead. To be removed once
   * chapter 1 stops setting it.
   */
  readonly locationCardTextId?: TextId;
}

/**
 * A chapter: data plus small scripts. A chapter never reaches into a system's
 * internals; it uses `src/systems/index.ts`. DESIGN.md sections 5 and 10.
 */
export interface ChapterDef {
  readonly number: ChapterNumber;
  readonly titleTextId: TextId;
  readonly screens: readonly ScreenDef[];
  readonly startScreenId: ScreenId;
  /** @deprecated overhaul phase 2/5 removes this. */
  readonly checkpoints: readonly CheckpointDef[];
  /** Every section in beat order. */
  readonly sections: readonly SectionDef[];
  readonly stealthSections: readonly StealthSectionDef[];
  /** Every chapter has exactly one physical puzzle. */
  readonly puzzle: PuzzleDef;
  readonly deductionBoard?: DeductionBoardDef;
  readonly evidence: readonly EvidenceId[];
  readonly objectives: readonly ObjectiveDef[];
  /** Abilities unlocked during this chapter. */
  readonly newAbilities: readonly AbilityId[];
  readonly mykoCallLines: MykoCallLines;
  /** Section whose completion leads into the closing scene. */
  readonly finaleSectionId: BossId;
  /** The chapter's bar, where Andrew starts and returns. DESIGN.md 7.1. Required from phase 2. */
  readonly bar?: BarDef;
}

// ---------------------------------------------------------------------------
// Save state (DESIGN.md sections 7.1, 7.5, 7.6)
// ---------------------------------------------------------------------------

/** Bumped whenever `SaveState` changes shape. DESIGN.md section 7.6. */
export const SAVE_VERSION = 1 as const;

/**
 * Player state captured at each save. Death restores exactly this.
 * DESIGN.md sections 7.1 and 7.6.
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export interface PlayerSnapshot {
  readonly health: number;
  readonly buzz: number;
  readonly empties: number;
  readonly drinkSlots: DrinkSlots;
  readonly selectedDrink: DrinkSlotIndex;
  readonly selectedSpecial: SpecialAbilityId | null;
  readonly unlockedAbilities: readonly AbilityId[];
  readonly hangover: HangoverState;
}

/**
 * Where Andrew reappears after death. DESIGN.md sections 7.2 and 7.6.
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export interface RespawnPoint {
  readonly screenId: ScreenId;
  readonly position: Vec2;
}

/**
 * Everything persisted for a game in local storage. Written at each
 * checkpoint and immediately whenever a Myko call is used (that save acts as
 * a checkpoint). Death reloads it. DESIGN.md sections 7.5 and 7.6.
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export interface SaveState {
  readonly version: typeof SAVE_VERSION;
  readonly chapter: ChapterNumber;
  /** Last checkpoint reached. */
  readonly checkpointId: CheckpointId;
  readonly respawn: RespawnPoint;
  readonly player: PlayerSnapshot;
  /** Calls left for the whole game. Starts at `tuning.myko.callsPerGame`, never refills. */
  readonly mykoCallsLeft: number;
  readonly mykoCalls: readonly MykoCallRecord[];
  /** Chapters finished, for Chapter Select. */
  readonly finishedChapters: readonly ChapterNumber[];
  readonly completedSectionIds: readonly SectionId[];
  readonly cleanStealthRunIds: readonly StealthSectionId[];
  readonly collectedPickupIds: readonly PickupId[];
  readonly casebook: readonly CasebookEntry[];
  /** Hints already given, per objective (0, 1 or 2). */
  readonly hintsGiven: Readonly<Record<ObjectiveId, number>>;
  /**
   * Chapter script flags (talked to Dympna, lesson shown and so on), so a
   * script can rebuild its state after death or Continue. Keys are prefixed
   * with the chapter, e.g. `c1.dympnaTalked`.
   */
  readonly flags: Readonly<Record<string, ChapterFlagValue>>;
  /**
   * Dialogue sequences already played in this save (DESIGN.md 7.5 "Nothing
   * is said twice"). Absent in older saves (treated as empty).
   */
  readonly playedDialogue?: readonly DialogueId[];
  /** Breakable props already broken, by prop key (`PropPlacement.id` or `<screen>#prop<i>`). */
  readonly brokenProps?: readonly string[];
  /** Seed for breakable loot, fixed for the life of the save. Absent = 0. */
  readonly lootSeed?: number;
}

/** Value of a chapter script flag stored in the save. */
export type ChapterFlagValue = boolean | number | string;

/**
 * Audio settings, stored under their own key, separate from `SaveState`.
 * New Game keeps them. DESIGN.md section 9.
 */
export interface AudioSettings {
  /** 0..1 */
  readonly musicVolume: number;
  /** 0..1 */
  readonly effectsVolume: number;
}

// ---------------------------------------------------------------------------
// Tuning shape (filled in by src/content/tuning.ts)
// ---------------------------------------------------------------------------

/**
 * Buzz thresholds and drain. DESIGN.md section 7.1.
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export interface BuzzTuning {
  readonly max: number;
  /** Lowest Buzz value of each state above sober. */
  readonly thresholds: { readonly grand: number; readonly locked: number; readonly banjaxed: number };
  readonly drainPerSecond: number;
  /** No drain for this long after a drink adds Buzz (DESIGN.md 7.1). */
  readonly drainDelayAfterDrinkMs: number;
  readonly effects: Readonly<Record<BuzzState, BuzzStateEffects>>;
  readonly banjaxedPeakMs: number;
  readonly banjaxedFallenMs: number;
  /** Buzz value after Andrew gets up. */
  readonly banjaxedResetTo: number;
}

/**
 * Hangover tuning. DESIGN.md section 7.1, docs/chapters/README.md "Carry-over rules".
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export interface HangoverTuning {
  /** Lowest Buzz state at chapter end that causes a hangover. */
  readonly triggerState: BuzzState;
  /** Earliest chapter whose end can cause a hangover (3). */
  readonly carryOverFromChapterEnd: ChapterNumber;
  /** Chapters that always start with a hangover regardless of Buzz ([4]). */
  readonly forcedAtChapterStart: readonly ChapterNumber[];
  /** Multiplier on max health while hungover (0.75 for "reduced by 25%"). */
  readonly maxHealthMultiplier: number;
  /** Over-brightness strength of the screen effect. */
  readonly brightness: number;
}

/** Player movement, noise and carrying. DESIGN.md sections 7.1, 7.2 and 7.3. */
export interface PlayerTuning {
  readonly maxHealth: number;
  /** WASD moves at this speed; Shift sneaks. There is no separate walk. */
  readonly runSpeed: number;
  readonly sneakSpeedMultiplier: number;
  readonly footstepNoiseRadius: number;
  readonly sneakNoiseRadius: number;
  /** Max count of one drink type in one slot. */
  readonly drinkSlotCap: number;
  readonly maxEmpties: number;
  /** Collision box at Andrew's feet (sprite is 16 x 24). Enemies use bodyWidth square. */
  readonly bodyWidth: number;
  readonly bodyHeight: number;
  /** Invulnerability after taking a hit, so one swing cannot hit twice. */
  readonly hurtInvulnerableMs: number;
  /** Time The Stumble's dash takes to cover `dashDistance`. */
  readonly stumbleDashMs: number;
  /** Aim sway cycle at full `aimSwayDeg`. */
  readonly swayPeriodMs: number;
  /** Movement drift cycle (Locked and above). */
  readonly driftPeriodMs: number;
  /** Delay between falling and the save being restored. */
  readonly deathRespawnDelayMs: number;
  /** The Sober remark only plays after at least this long at Grand or above. */
  readonly soberRemarkMinMsAbove: number;
}

/** Enemy AI and hit resolution. DESIGN.md section 7.2. */
export interface CombatTuning {
  /** Knockback is an initial speed; this is how fast it bleeds off, per second. */
  readonly knockbackDecayPerSecond: number;
  /** Speed of a `charge` attack once it is released. */
  readonly chargeSpeed: number;
  /** Gap between shots of a burst. */
  readonly burstIntervalMs: number;
  /** Radius used for hit tests against a character. */
  readonly characterHitRadius: number;
  /** Radius of a lobbed projectile's hit where it lands. */
  readonly lobSplashRadius: number;
  /** Peak height of a lobbed projectile's arc, for drawing. */
  readonly lobPeakHeight: number;
  /** Radius of a straight projectile. */
  readonly projectileRadius: number;
  /** An enemy starts its approach when Andrew is this close (fights wake everyone). */
  readonly aggroRange: number;
  /** A disguised enemy reveals itself when Andrew is this close. */
  readonly disguiseRevealRange: number;
  /** How long a `lad` backs off after landing a hit. */
  readonly backOffMs: number;
  /** Enemies keep this much space between each other. */
  readonly separationRadius: number;
  /** Sideways offset an agent aims for when flanking. */
  readonly flankOffset: number;
  /** Ranged enemies try to hold this fraction of their projectile range. */
  readonly rangedPreferredFraction: number;
  /** Pause between a fight's waves. */
  readonly betweenWavesMs: number;
  /** Re-plan a path to Andrew at this interval. */
  readonly repathMs: number;
  /** Stun applied by a bottle to an enemy it hits (none = 0). */
  readonly bottleStunMs: number;
}

/** World interaction tuning. */
export interface WorldTuning {
  /** Andrew reaches a checkpoint within this distance of it. */
  readonly checkpointRadius: number;
  /** Hold time walking into a pushable before it moves. */
  readonly pushHoldMs: number;
  /** Time a pushed keg or crate takes to slide one tile. */
  readonly pushSlideMs: number;
}

/** Stealth tuning. DESIGN.md section 7.3. */
export interface StealthTuning {
  /** Time to fill the detection marker ("about one second"). */
  readonly detectionFillMs: number;
  readonly detectionDrainPerSecond: number;
  readonly investigateGiveUpMs: number;
  /** Stillness required before Act Natural takes effect. */
  readonly actNaturalStillMs: number;
  /** Vision range multiplier for seated guards. */
  readonly seatedVisionMultiplier: number;
  /** Guard turn speed, degrees per second. */
  readonly turnDegPerSecond: number;
  /** How long a guard looks around at the spot it investigates. */
  readonly lookAroundMs: number;
  /**
   * Sneaking at Locked or above is audible at short range (DESIGN.md 7.3).
   * Noise radius = footstepNoiseRadius x (footstepNoiseMultiplier - 1) x this.
   */
  readonly lockedSneakNoiseFactor: number;
  /** Footstep noise is emitted at this interval while moving. */
  readonly footstepIntervalMs: number;
  /** Guard walking speed as a fraction of its moveSpeed. */
  readonly patrolSpeedFraction: number;
}

/**
 * Heat tuning. docs/chapters/08-the-long-road.md "Heat".
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export interface HeatTuning {
  readonly max: number;
  readonly risePerSecondInSun: number;
  readonly runningRiseMultiplier: number;
  readonly fallPerSecondInShade: number;
  readonly fullHeatDamagePerSecond: number;
  /** Fraction of max above which thermal masts see Andrew (0.5). */
  readonly thermalDetectFraction: number;
}

/** Myko tuning. DESIGN.md section 7.5. */
export interface MykoTuning {
  /** Calls for the whole game (3). */
  readonly callsPerGame: number;
  /** Hold time on M (1000). */
  readonly callHoldMs: number;
  /**
   * @deprecated Unused since the call-in became a blackout. Kept only until
   * tests/unit/myko.test.ts stops reading it (typecheck covers tests); then delete.
   */
  readonly fightClearMs: number;
  /** Inactivity before an idle comment. */
  readonly idleCommentMs: number;
  /** Share of tangents about Ohio from chapter 7 on ("about two in three"). */
  readonly ohioTangentShare: number;
  readonly followDistance: number;
  readonly walkSpeed: number;
  /** Called-in stroll speed. */
  readonly strollSpeed: number;
  /** Minimum gap between unprompted comments. */
  readonly commentCooldownMs: number;
  /** Chance Myko comments on a drink. */
  readonly drinkCommentChance: number;
  /** Heat fraction at which he warns. */
  readonly heatWarnFraction: number;
  /** Chance of a tangent each time the idle timer fires instead of an idle line. */
  readonly tangentChance: number;
  /** A queued box line not yet shown after this long is dropped (DESIGN.md 7.5 "Nothing is said twice"). */
  readonly commentStaleMs: number;
  /** The call-in blackout carries on by itself if the UI has not reported it finished after this long. */
  readonly blackoutTimeoutMs: number;
  /** Standing still this long, Myko has a smoke (DESIGN.md 3). */
  readonly smokeIntervalMs: number;
  /** Up to this much is added to or taken from each smoke interval (seeded). */
  readonly smokeJitterMs: number;
}

/** One entry of a breakable's loot table; `item: null` drops nothing. */
export interface LootEntry {
  readonly item: PickupItem | null;
  readonly weight: number;
}

/** Breakable props. DESIGN.md 7.1 "Breakables". */
export interface BreakablesTuning {
  /** Hits a breakable takes when its placement gives no `hits`. */
  readonly defaultHits: number;
  /** Radius of the `breakable` noise for stealth. */
  readonly noiseRadius: number;
  /** How long a breakable flashes white when hit. */
  readonly hitFlashMs: number;
  /** Weighted loot per region, drawn with a seed from the save and the prop. */
  readonly loot: Readonly<Record<RegionId, readonly LootEntry[]>>;
}

/** Investigation tuning. DESIGN.md section 7.4. */
export interface InvestigationTuning {
  readonly interactRadius: number;
}

/**
 * Chapter Select start state. docs/chapters/README.md "Carry-over rules".
 *
 * @deprecated overhaul phase 2/5 removes this.
 */
export interface ChapterSelectTuning {
  /** Drinks given at a Chapter Select start (three stout). */
  readonly startingDrinks: DrinkSlots;
}

/**
 * Root shape of `src/content/tuning.ts`. Every balance number in the game.
 * Section-specific numbers are keyed by section ID. DESIGN.md section 10,
 * docs/chapters/README.md.
 */
export interface Tuning {
  /** Audio settings before the player touches the sliders. */
  readonly audioDefaults: AudioSettings;
  readonly buzz: BuzzTuning;
  readonly hangover: HangoverTuning;
  readonly player: PlayerTuning;
  readonly combat: CombatTuning;
  readonly world: WorldTuning;
  readonly stealth: StealthTuning;
  readonly heat: HeatTuning;
  readonly myko: MykoTuning;
  readonly investigation: InvestigationTuning;
  readonly chapterSelect: ChapterSelectTuning;
  readonly breakables: BreakablesTuning;
  readonly drinks: Readonly<Record<DrinkId, DrinkDef>>;
  readonly food: Readonly<Record<FoodId, FoodDef>>;
  readonly abilities: Readonly<Record<AbilityId, AbilityDef>>;
  readonly enemies: Readonly<Record<EnemyId, EnemyDef>>;
  readonly bosses: Readonly<Record<BossId, BossDef>>;
  readonly fights: Readonly<Partial<Record<FightSectionId | AlarmFightId, FightDef>>>;
  /** The overhaul numbers. Optional until phase 2 switches the systems over. */
  readonly overhaul?: OverhaulTuning;
}

// ---------------------------------------------------------------------------
// Events (DESIGN.md section 10)
// ---------------------------------------------------------------------------

/** Why a save was written. DESIGN.md section 7.6. */
export type SaveReason = 'checkpoint' | 'mykoCall' | 'chapterComplete';

/**
 * Payload for every game event, keyed by event name. Systems, UI, audio and
 * chapters communicate through these. DESIGN.md section 10.
 */
export interface GameEventPayloads {
  'buzz:changed': { readonly value: number; readonly delta: number };
  'buzz:stateChanged': { readonly from: BuzzState; readonly to: BuzzState };
  /** @deprecated overhaul phase 2/5 removes this. */
  'buzz:banjaxedPhase': { readonly phase: BanjaxedPhase };
  /** @deprecated overhaul phase 2/5 removes this. */
  'hangover:started': Record<string, never>;
  /** @deprecated overhaul phase 2/5 removes this. */
  'hangover:cured': Record<string, never>;
  /** @deprecated overhaul phase 2/5 removes this. */
  'heat:changed': HeatSnapshot;
  /** @deprecated overhaul phase 2/5 removes this. */
  'player:damaged': { readonly hit: HitInfo; readonly health: Health };
  /** @deprecated overhaul phase 2/5 removes this. */
  'player:healed': { readonly amount: number; readonly health: Health };
  /** @deprecated overhaul phase 2/5 removes this. */
  'player:died': { readonly checkpointId: CheckpointId };
  /** @deprecated overhaul phase 2/5 removes this. */
  'player:respawned': { readonly respawn: RespawnPoint };
  'enemy:damaged': { readonly hit: HitInfo; readonly health: Health };
  'enemy:defeated': { readonly instanceId: string; readonly enemyId: EnemyId; readonly by: CompletionSource };
  'enemy:telegraph': { readonly instanceId: string; readonly attackId: string; readonly durationMs: number };
  'enemy:revealed': { readonly instanceId: string; readonly enemyId: EnemyId };
  'boss:phaseChanged': { readonly bossId: BossId; readonly phaseId: string };
  'drink:consumed': { readonly drinkId: DrinkId };
  /** @deprecated overhaul phase 2/5 removes this. */
  'drink:selected': { readonly index: DrinkSlotIndex; readonly drinkId: DrinkId | null };
  /** @deprecated overhaul phase 2/5 removes this. */
  'food:consumed': { readonly foodId: FoodId };
  'pickup:collected': { readonly pickupId: PickupId; readonly item: PickupItem };
  'pickup:refused': { readonly pickupId: PickupId; readonly reason: PickupRefusal };
  'empties:changed': { readonly count: number };
  'ability:used': { readonly abilityId: AbilityId };
  'ability:unlocked': { readonly abilityId: AbilityId };
  /** @deprecated overhaul phase 2/5 removes this. */
  'ability:selectedSpecial': { readonly abilityId: SpecialAbilityId };
  'stealth:noise': NoiseEvent;
  'stealth:alertChanged': { readonly instanceId: string; readonly from: AlertState; readonly to: AlertState };
  'stealth:alarm': { readonly sectionId: StealthSectionId; readonly fightId: AlarmFightId };
  'stealth:cleanRun': { readonly sectionId: StealthSectionId };
  'evidence:found': { readonly evidenceId: EvidenceId };
  'casebook:entryAdded': { readonly entry: CasebookEntry };
  'deduction:submitted': {
    readonly deductionId: DeductionSectionId;
    readonly evidenceIds: readonly EvidenceId[];
    readonly correct: boolean;
  };
  'section:started': { readonly sectionId: SectionId; readonly kind: SectionKind };
  'section:completed': { readonly sectionId: SectionId; readonly kind: SectionKind; readonly by: CompletionSource };
  'myko:hintRequested': { readonly objectiveId: ObjectiveId; readonly level: 1 | 2 };
  'myko:callStarted': { readonly sectionId: CompletableSectionId; readonly kind: MykoCallKind; readonly callsLeft: number };
  'myko:callRefused': { readonly reason: 'noCallsLeft' | 'notCallable' | 'noSection' };
  'myko:comment': { readonly trigger: MykoCommentTrigger; readonly dialogueId: DialogueId };
  'dialogue:show': { readonly sequenceId: DialogueId };
  'dialogue:finished': { readonly sequenceId: DialogueId };
  'objective:changed': { readonly objectiveId: ObjectiveId };
  /** @deprecated overhaul phase 2/5 removes this. */
  'checkpoint:reached': { readonly checkpointId: CheckpointId };
  'save:written': { readonly reason: SaveReason };
  'chapter:started': { readonly chapter: ChapterNumber };
  'chapter:completed': { readonly chapter: ChapterNumber; readonly endBuzzState: BuzzState };
  'game:paused': Record<string, never>;
  'game:resumed': Record<string, never>;
  /** Andrew arrived on a screen; audio switches the regional theme. */
  'screen:entered': { readonly screenId: ScreenId; readonly region: RegionId };
  /** The Borrowed Glove fired; gravity-switch puzzles listen for this. */
  'ability:glovePulse': { readonly screenId: ScreenId; readonly position: Vec2; readonly radius: number };
  /** Myko finished a call-in and the section is complete. */
  'myko:callFinished': { readonly sectionId: CompletableSectionId; readonly kind: MykoCallKind };
  /**
   * A call was accepted: gameplay is paused. The UI covers the screen in black,
   * shows the caption `sequenceId` (`myko.call.<kind>.blackout.<n>`, n = 1..3: which Myko call of the save) and calls
   * `uiState.dialogueFinished(sequenceId)` when it is done.
   */
  'myko:blackout': { readonly sectionId: CompletableSectionId; readonly kind: MykoCallKind; readonly sequenceId: DialogueId };
  'prop:broken': { readonly screenId: ScreenId; readonly propId: string; readonly frame: string };
  // --- Overhaul events (DESIGN.md 7.1, 7.2, 7.7) ---
  /** Andrew crossed into another drunk level. */
  'buzz:levelChanged': {
    readonly from: DrunkLevel;
    readonly to: DrunkLevel;
    readonly state: DrunkState;
    readonly value: number;
  };
  /** An enemy or boss hit moved the meter. `direction` is the way it moved. */
  'player:hit': {
    readonly source: DamageSource;
    readonly weight: HitWeight;
    readonly direction: MeterDirection;
    /** Points moved, after spirit doubling. */
    readonly amount: number;
  };
  /** Andrew went back to the bar. */
  'bar:returned': { readonly reason: BarReturnReason };
  'move:used': { readonly moveId: MoveId; readonly slot: SpecialSlotIndex };
  'move:learned': { readonly moveId: MoveId };
  'weapon:gained': { readonly weaponId: WeaponId };
  'kit:changed': { readonly kit: Kit };
  'spirit:started': { readonly drinkId: SpiritId; readonly durationMs: number };
  'spirit:ended': { readonly drinkId: SpiritId };
}

/** Every event name. Use these constants rather than string literals. DESIGN.md section 10. */
export const GameEvents = {
  BuzzChanged: 'buzz:changed',
  BuzzStateChanged: 'buzz:stateChanged',
  /** @deprecated overhaul phase 2/5 removes this. */
  BuzzBanjaxedPhase: 'buzz:banjaxedPhase',
  /** @deprecated overhaul phase 2/5 removes this. */
  HangoverStarted: 'hangover:started',
  /** @deprecated overhaul phase 2/5 removes this. */
  HangoverCured: 'hangover:cured',
  /** @deprecated overhaul phase 2/5 removes this. */
  HeatChanged: 'heat:changed',
  /** @deprecated overhaul phase 2/5 removes this. */
  PlayerDamaged: 'player:damaged',
  /** @deprecated overhaul phase 2/5 removes this. */
  PlayerHealed: 'player:healed',
  /** @deprecated overhaul phase 2/5 removes this. */
  PlayerDied: 'player:died',
  /** @deprecated overhaul phase 2/5 removes this. */
  PlayerRespawned: 'player:respawned',
  EnemyDamaged: 'enemy:damaged',
  EnemyDefeated: 'enemy:defeated',
  EnemyTelegraph: 'enemy:telegraph',
  EnemyRevealed: 'enemy:revealed',
  BossPhaseChanged: 'boss:phaseChanged',
  DrinkConsumed: 'drink:consumed',
  /** @deprecated overhaul phase 2/5 removes this. */
  DrinkSelected: 'drink:selected',
  /** @deprecated overhaul phase 2/5 removes this. */
  FoodConsumed: 'food:consumed',
  PickupCollected: 'pickup:collected',
  PickupRefused: 'pickup:refused',
  EmptiesChanged: 'empties:changed',
  AbilityUsed: 'ability:used',
  AbilityUnlocked: 'ability:unlocked',
  /** @deprecated overhaul phase 2/5 removes this. */
  AbilitySelectedSpecial: 'ability:selectedSpecial',
  StealthNoise: 'stealth:noise',
  StealthAlertChanged: 'stealth:alertChanged',
  StealthAlarm: 'stealth:alarm',
  StealthCleanRun: 'stealth:cleanRun',
  EvidenceFound: 'evidence:found',
  CasebookEntryAdded: 'casebook:entryAdded',
  DeductionSubmitted: 'deduction:submitted',
  SectionStarted: 'section:started',
  SectionCompleted: 'section:completed',
  MykoHintRequested: 'myko:hintRequested',
  MykoCallStarted: 'myko:callStarted',
  MykoCallRefused: 'myko:callRefused',
  MykoComment: 'myko:comment',
  DialogueShow: 'dialogue:show',
  DialogueFinished: 'dialogue:finished',
  ObjectiveChanged: 'objective:changed',
  /** @deprecated overhaul phase 2/5 removes this. */
  CheckpointReached: 'checkpoint:reached',
  SaveWritten: 'save:written',
  ChapterStarted: 'chapter:started',
  ChapterCompleted: 'chapter:completed',
  GamePaused: 'game:paused',
  GameResumed: 'game:resumed',
  ScreenEntered: 'screen:entered',
  AbilityGlovePulse: 'ability:glovePulse',
  MykoCallFinished: 'myko:callFinished',
  MykoBlackout: 'myko:blackout',
  PropBroken: 'prop:broken',
  BuzzLevelChanged: 'buzz:levelChanged',
  PlayerHit: 'player:hit',
  BarReturned: 'bar:returned',
  MoveUsed: 'move:used',
  MoveLearned: 'move:learned',
  WeaponGained: 'weapon:gained',
  KitChanged: 'kit:changed',
  SpiritStarted: 'spirit:started',
  SpiritEnded: 'spirit:ended',
} as const satisfies Readonly<Record<string, keyof GameEventPayloads>>;

/** Union of every event name. DESIGN.md section 10. */
export type GameEventName = (typeof GameEvents)[keyof typeof GameEvents];

/**
 * Payload keys with no `GameEvents` constant. Must be `never`; the compile-time
 * assertion below fails the type check otherwise. DESIGN.md section 10.
 */
export type UnnamedGameEvents = Exclude<keyof GameEventPayloads, GameEventName>;
type AssertNever<T extends never> = T;
/** Compile-time check that every payload has an event-name constant. DESIGN.md section 10. */
export type AllGameEventsNamed = AssertNever<UnnamedGameEvents>;

/** Typed event bus contract, implemented in `src/core/`. DESIGN.md section 10. */
export interface GameEventBus {
  emit<K extends GameEventName>(event: K, payload: GameEventPayloads[K]): void;
  on<K extends GameEventName>(event: K, handler: (payload: GameEventPayloads[K]) => void): () => void;
}

// ===========================================================================
// OVERHAUL CONTRACTS (docs/overhaul-plan.md, DESIGN.md sections 5 to 7)
//
// Additive. These sit beside the old contracts until overhaul phase 2 and 5
// replace the systems and delete the items marked `@deprecated`. No behaviour.
// ===========================================================================

// ---------------------------------------------------------------------------
// Drunk levels (DESIGN.md 7.1)
// ---------------------------------------------------------------------------

/** The five drunk states, in meter order. DESIGN.md 7.1. Replaces the old `BuzzState`. */
export type DrunkState = 'sober' | 'buzzed' | 'grand' | 'bitMuch' | 'fecked';

/** Drunk states in ascending order; the index is the level. DESIGN.md 7.1. */
export const DRUNK_STATES = ['sober', 'buzzed', 'grand', 'bitMuch', 'fecked'] as const satisfies readonly DrunkState[];

/** Numeric drunk level: 0 sober, 1 Buzzed, 2 Grand, 3 Bit much, 4 Fecked. DESIGN.md 7.1. */
export type DrunkLevel = 0 | 1 | 2 | 3 | 4;

/** A level that owns a special slot and a melee multiplier (not sober). DESIGN.md 7.2. */
export type SpecialLevel = 1 | 2 | 3 | 4;

/** Special slot 1..4, keys 1 to 4. Slot n belongs to level n. DESIGN.md 7.2. */
export type SpecialSlotIndex = 1 | 2 | 3 | 4;

/** Inclusive bounds of one level on the meter. */
export interface LevelBounds {
  readonly min: number;
  readonly max: number;
}

/**
 * Where each level sits on the meter in one chapter. The meter grows by chapter
 * (Buzzed and Grand widen; Bit much stays 25 and Fecked 9). `floor` is the
 * value at which Andrew falls over. Sober is 0. DESIGN.md 7.1,
 * docs/overhaul-plan.md "Meter length by chapter".
 */
export interface DrunkLevelTable {
  readonly buzzed: LevelBounds;
  readonly grand: LevelBounds;
  readonly bitMuch: LevelBounds;
  readonly fecked: LevelBounds;
  readonly floor: number;
}

/** Why Andrew went back to the bar. DESIGN.md 7.1 "Back to the bar". */
export type BarReturnReason = 'sober' | 'floor';

/** Which way a hit moved the meter. DESIGN.md 7.1 "Being hit". */
export type MeterDirection = 'up' | 'down';

/** How hard a hit pushes the meter. DESIGN.md 7.1: about 5, 10 and 15. */
export type HitWeight = 'ordinary' | 'heavy' | 'worst';

/** Runtime state of the one Buzz meter. Replaces `BuzzSnapshot`. DESIGN.md 7.1. */
export interface MeterSnapshot {
  /** 0..floor of the current chapter. */
  readonly value: number;
  readonly level: DrunkLevel;
  readonly state: DrunkState;
  /** The value that puts Andrew on the floor in this chapter. */
  readonly floor: number;
  /** A whiskey or tequila window is running (no drain, hits doubled and lowering). */
  readonly spiritActive: boolean;
  /** A tea is holding the meter at its target (no drain). */
  readonly teaHoldActive: boolean;
  /** Andrew is out in the sun (drain doubles, beer goes further). */
  readonly inSun: boolean;
}

// ---------------------------------------------------------------------------
// Drinks (DESIGN.md 7.1)
// ---------------------------------------------------------------------------

/** Drinks that add points and leave a bottle. DESIGN.md 7.1. */
export type BeerId = 'stout' | 'lager' | 'lightBeer' | 'craftIpa';

/** Drinks that jump the meter and open a window; no bottle. DESIGN.md 7.1. */
export type SpiritId = 'whiskey' | 'tequila';

/** The bar-only hot drinks. DESIGN.md 7.1. */
export type HotDrinkId = 'coffee' | 'tea';

/** A drink that can be found and carried (counts toward the carry limit). */
export type CarriedDrinkId = BeerId | SpiritId;

/** Every drink in the overhaul. Text ids are `drink.<id>.name` and `drink.<id>.pickup`. */
export type OverhaulDrinkId = CarriedDrinkId | HotDrinkId;

/** Where a spirit puts the meter. DESIGN.md 7.1. */
export type SpiritJump =
  /** Top of the next level up; from Bit much or Fecked, the top of Fecked (whiskey). */
  | { readonly kind: 'topOfNextLevel' }
  /** The middle of a level, from anywhere (tequila: Fecked). */
  | { readonly kind: 'middleOfLevel'; readonly level: SpecialLevel };

/** A beer: adds points and leaves one bottle. Strength is a fixed number of points. */
export interface BeerDef {
  readonly kind: 'beer';
  readonly id: BeerId;
  readonly nameTextId: TextId;
  readonly pickupTextId: TextId;
  /** Points added. Multiplied in the sun. */
  readonly points: number;
  /** Bottles added to the count. Always 1 for a beer. */
  readonly bottlesLeft: number;
}

/** A spirit: the jump rule and a timed window. Leaves no bottle. */
export interface SpiritDef {
  readonly kind: 'spirit';
  readonly id: SpiritId;
  readonly nameTextId: TextId;
  readonly pickupTextId: TextId;
  readonly jump: SpiritJump;
  /** The window: no drain, and hits lower the meter at `hitMultiplier`. Lengthened in the sun. */
  readonly windowMs: number;
  /** Hits lower the meter at this multiple of the usual amount in the window (2). */
  readonly hitMultiplier: number;
  /** Points lost all at once when the window ends (tequila: 30). Absent = none. */
  readonly dropAfterWindow?: number;
}

/** How a hot drink brings the meter to the bottom of Grand. */
export type HotDrinkReset =
  | { readonly kind: 'instant' }
  /** Eases over `easeMs`, then holds with no drain for `holdMs`. */
  | { readonly kind: 'ease'; readonly easeMs: number; readonly holdMs: number };

/** A hot drink: bar only, never found. */
export interface HotDrinkDef {
  readonly kind: 'hot';
  readonly id: HotDrinkId;
  readonly nameTextId: TextId;
  readonly pickupTextId: TextId;
  readonly reset: HotDrinkReset;
}

/** A drink in the overhaul. Named separately so the old `DrinkDef` keeps working. */
export type OverhaulDrinkDef = BeerDef | SpiritDef | HotDrinkDef;

// ---------------------------------------------------------------------------
// Moves (DESIGN.md 7.2)
// ---------------------------------------------------------------------------

/** Every special move. Text ids are `ability.<id>.name` and `ability.<id>.desc`. */
export type MoveId =
  | 'shoulder'
  | 'reflexTest'
  | 'actNatural'
  | 'stoutSlam'
  | 'sameAgain'
  | 'bedsideManner'
  | 'stumble'
  | 'lockIn'
  | 'secondOpinion'
  | 'borrowedGlove'
  | 'oneForTheRoad'
  | 'lastOrders'
  | 'barred';

/** What a move does, as data. Magnitudes come from tuning. DESIGN.md 7.2 table. */
export type MoveEffect =
  /** The Shoulder: short charge, knocks one enemy back. */
  | { readonly kind: 'charge'; readonly distance: number; readonly knockback: number }
  /** Reflex Test: one enemy cannot attack for `durationMs`. */
  | { readonly kind: 'stagger'; readonly durationMs: number }
  /** Act Natural: unseen beside a prop until moving; useless once seen. */
  | { readonly kind: 'hideBesideProp'; readonly propRadius: number }
  /** Stout Slam: everyone within `radius` is knocked down. */
  | { readonly kind: 'knockdownAround'; readonly radius: number }
  /** Same Again: the next `hits` melee hits each land `times` times. */
  | { readonly kind: 'repeatHits'; readonly hits: number; readonly times: number }
  /** Bedside Manner: everyone within `radius` stops to listen. */
  | { readonly kind: 'calmAround'; readonly radius: number; readonly durationMs: number }
  /** The Stumble: a lurch in a line that hits everything; not invulnerable. */
  | { readonly kind: 'lurch'; readonly distance: number; readonly width: number }
  /** Lock-in: enemies within `radius` are held and take more melee damage. */
  | { readonly kind: 'holdAround'; readonly radius: number; readonly durationMs: number; readonly damageMultiplier: number }
  /** Second Opinion: the next hit on one enemy does `damageMultiplier` times. */
  | { readonly kind: 'markTarget'; readonly damageMultiplier: number }
  /** The Borrowed Glove: stuns everyone in a cone. */
  | { readonly kind: 'stunCone'; readonly range: number; readonly angleDeg: number; readonly durationMs: number }
  /** One for the Road: finishes an ordinary enemy; takes a fraction off a boss. */
  | { readonly kind: 'finisher'; readonly bossFraction: number }
  /** Last Orders: ordinary enemies left with a sliver, stunned; bosses lose a fraction. */
  | {
      readonly kind: 'screenWipe';
      readonly leaveHealthFraction: number;
      readonly stunMs: number;
      readonly bossFraction: number;
    }
  /** Barred: lift one enemy and throw him out; a boss cannot be lifted and takes damage. */
  | { readonly kind: 'throwOut'; readonly landingDamage: number; readonly bossDamage: number };

/** A special move. Defined in `src/content/tuning.ts`. DESIGN.md 7.2. */
export interface MoveDef {
  readonly id: MoveId;
  /** The slot level it fits (1..4). */
  readonly level: SpecialLevel;
  /** Chapter in which it is learned. */
  readonly learnedInChapter: ChapterNumber;
  /** Milliseconds before reuse; grows with level. Costs no Buzz. */
  readonly cooldownMs: number;
  readonly effect: MoveEffect;
  /** `ability.<id>.name` */
  readonly nameTextId: TextId;
  /** `ability.<id>.desc` */
  readonly descTextId: TextId;
}

// ---------------------------------------------------------------------------
// Weapons (DESIGN.md 7.2)
// ---------------------------------------------------------------------------

/** Every melee weapon. Text ids are `weapon.<id>.name` and `weapon.<id>.desc`. */
export type WeaponId =
  | 'fists'
  | 'hurley'
  | 'clipboard'
  | 'shillelagh'
  | 'umbrella'
  | 'inflatableAlien'
  | 'securityWand';

/** What is special about a weapon, as data. */
export type WeaponQuirk =
  | { readonly kind: 'none' }
  /** Fists: `hits` in a row, the last a haymaker with extra knockback. */
  | { readonly kind: 'combo'; readonly hits: number; readonly finisherKnockbackMultiplier: number }
  /** Clipboard: each hit interrupts whatever the enemy was about to do. */
  | { readonly kind: 'interrupts' }
  /** Umbrella: a straight poke that goes through `count` enemies. */
  | { readonly kind: 'pierce'; readonly count: number }
  /** Inflatable alien: hits everything in front, wide. */
  | { readonly kind: 'sweep'; readonly arcDeg: number }
  /** Security wand: every `everyHits`th hit stuns for `stunMs`. */
  | { readonly kind: 'nthHitStuns'; readonly everyHits: number; readonly stunMs: number };

/** A melee weapon. Defined in `src/content/tuning.ts`. DESIGN.md 7.2. */
export interface WeaponDef {
  readonly id: WeaponId;
  /** Chapter in which Andrew gets it (fists: 1). */
  readonly gainedInChapter: ChapterNumber;
  readonly reach: number;
  /** Time per swing, milliseconds. */
  readonly swingMs: number;
  /** Base damage before the drunk-level multiplier. */
  readonly damage: number;
  readonly knockback: number;
  readonly quirk: WeaponQuirk;
  /** `weapon.<id>.name` */
  readonly nameTextId: TextId;
  /** `weapon.<id>.desc` */
  readonly descTextId: TextId;
}

// ---------------------------------------------------------------------------
// Kit (DESIGN.md 7.1 "The kit", 7.7)
// ---------------------------------------------------------------------------

/** The six slots: one drink, four specials (slot n takes level n), one melee. DESIGN.md 7.7. */
export interface KitSlots {
  readonly drink: OverhaulDrinkId | null;
  readonly specials: readonly [MoveId | null, MoveId | null, MoveId | null, MoveId | null];
  readonly melee: WeaponId;
}

/** What Andrew carries. Carries over between chapters; Buzz does not. DESIGN.md 7.1. */
export interface Kit {
  /** Count per carried drink. The sum may not exceed `carryLimit`. */
  readonly drinks: Readonly<Partial<Record<CarriedDrinkId, number>>>;
  /** Most drinks carried at once (starting number 6). Hot drink and bottles do not count. */
  readonly carryLimit: number;
  /** One hot drink or none. */
  readonly hotDrink: HotDrinkId | null;
  /** Unlimited, no cap. */
  readonly bottles: number;
  readonly weapons: readonly WeaponId[];
  readonly moves: readonly MoveId[];
  readonly slots: KitSlots;
}

// ---------------------------------------------------------------------------
// Throw aim (DESIGN.md 7.2 "Thrown bottles")
// ---------------------------------------------------------------------------

/**
 * The hold-and-release throw preview. The bottle goes where the preview points
 * at the moment of release; sway is timing, never a hidden miss chance.
 */
export interface ThrowAim {
  readonly origin: Vec2;
  /** Where the bottle lands if released now. */
  readonly landing: Vec2;
  /** Points of the dotted arc, origin to landing. */
  readonly path: readonly Vec2[];
  /** Current sway as an angle in degrees; 0 at levels 1 and 2. */
  readonly swayAmount: number;
}

// ---------------------------------------------------------------------------
// Bar, stealth rewards (DESIGN.md 7.1, 7.3)
// ---------------------------------------------------------------------------

/** The chapter's bar: where Andrew starts and returns. DESIGN.md 7.1. */
export interface BarDef {
  readonly screenId: ScreenId;
  /** Where Andrew stands on arrival. */
  readonly arrival: Vec2;
  /** Where the free hot drink is offered. */
  readonly hotDrinkProp: Vec2;
  /** Played on the first arrival of the chapter. */
  readonly openDialogueId: DialogueId;
  /** Played when the hot drink is offered. */
  readonly hotDrinkDialogueId: DialogueId;
  /** Played on a return. Myko's pool for sober or floor is chosen by the system. */
  readonly returnDialogueId: DialogueId;
}

/** The four rewards for a clean stealth run. DESIGN.md 7.3. */
export type CleanRunRewardKind = 'clue' | 'drink' | 'shortcut' | 'drinkFromHome';

/** Id of a way back that opens from the far side. */
export type ShortcutId = string;

/** The reward of one stealth section. Never a key clue or proof. DESIGN.md 7.3. */
export type CleanRunRewardDef =
  | { readonly kind: 'clue'; readonly clueId: ClueId }
  | { readonly kind: 'drink'; readonly drinkId: SpiritId }
  | { readonly kind: 'shortcut'; readonly shortcutId: ShortcutId }
  /** In America, a stout somebody brought over. */
  | { readonly kind: 'drinkFromHome'; readonly drinkId: 'stout' };

// ---------------------------------------------------------------------------
// Overhaul tuning shape (filled in by src/content/tuning.ts)
// ---------------------------------------------------------------------------

/** Sun modifiers. DESIGN.md 7.1 "Heat". */
export interface SunTuning {
  /** Drain multiplier (2). */
  readonly drainMultiplier: number;
  /** Multiplier on beer points (1.5). */
  readonly beerMultiplier: number;
  /** Multiplier on a spirit window (1.5). */
  readonly spiritWindowMultiplier: number;
}

/** Carry rules. DESIGN.md 7.1 "The kit". */
export interface CarryTuning {
  /** Drinks at most (6). */
  readonly limit: number;
  /** Hot drinks at most (1). */
  readonly hotDrinkLimit: number;
  /** Bottles Andrew has on leaving the bar, at least (2). */
  readonly minBottlesOnLeavingBar: number;
}

/** Aim sway for a level, degrees. 0 at levels 1 and 2. DESIGN.md 7.2. */
export type SwayByLevel = Readonly<Record<DrunkLevel, number>>;

/** Drop chances in 0..1. DESIGN.md 7.1 "Breakables" and "Enemies". */
export interface DropTuning {
  readonly breakable: { readonly beer: number; readonly whiskey: number };
  readonly enemy: {
    readonly beer: number;
    readonly whiskey: number;
    readonly tequila: number;
    /** Tequila drops only from this chapter on (7). */
    readonly tequilaFromChapter: ChapterNumber;
  };
}

/** The thrown bottle. DESIGN.md 7.2 "Thrown bottles". First guesses. */
export interface ThrowTuning {
  /** Longest throw, world pixels. */
  readonly range: number;
  /** Fixed damage; the drunk level does not change it. */
  readonly damage: number;
  readonly knockback: number;
  /** Radius of the noise where it lands; distracts guards. */
  readonly noiseRadius: number;
  /** Dots in the preview path, origin to landing inclusive. */
  readonly previewPoints: number;
  /** One full sway cycle, milliseconds. */
  readonly swayPeriodMs: number;
}

/** Every number the overhaul systems need. DESIGN.md 7.1, 7.2; docs/overhaul-plan.md. */
export interface OverhaulTuning {
  /** Meter points lost per second (1 per 3 s). */
  readonly drainPerSecond: number;
  readonly sun: SunTuning;
  /** The level Andrew starts and restarts at; hot drinks aim at its bottom (2, Grand). */
  readonly restLevel: SpecialLevel;
  /** Points a hit moves the meter, by weight (5, 10, 15). */
  readonly hitWeights: Readonly<Record<HitWeight, number>>;
  /** Melee damage multiplier by level (1, 1.5, 2, 3). */
  readonly meleeMultiplierByLevel: Readonly<Record<SpecialLevel, number>>;
  /** Below this the colours flatten and Andrew remarks on it (10). */
  readonly lowWarningBelow: number;
  /** Where each level sits, by chapter. */
  readonly levels: Readonly<Record<ChapterNumber, DrunkLevelTable>>;
  readonly drinks: Readonly<Record<OverhaulDrinkId, OverhaulDrinkDef>>;
  readonly carry: CarryTuning;
  /** Cooldown by move level (5 s, 12 s, 25 s, 60 s). */
  readonly moveCooldownMsByLevel: Readonly<Record<SpecialLevel, number>>;
  readonly moves: Readonly<Record<MoveId, MoveDef>>;
  readonly weapons: Readonly<Record<WeaponId, WeaponDef>>;
  readonly swayByLevel: SwayByLevel;
  readonly drops: DropTuning;
  /** The thrown bottle. Optional until phase 2 switches the systems over. */
  readonly throw?: ThrowTuning;
  /** Footstep noise radius by level while walking. DESIGN.md 7.3: louder from Bit much. */
  readonly footstepNoiseRadiusByLevel?: Readonly<Record<DrunkLevel, number>>;
  /** Footstep noise radius while sneaking: silent until Fecked, then short range. */
  readonly sneakNoiseRadiusByLevel?: Readonly<Record<DrunkLevel, number>>;
}

// ---------------------------------------------------------------------------
// Overhaul save shape (DESIGN.md 7.6). Not wired in; phase 2 switches over.
// ---------------------------------------------------------------------------

/** Version of the overhaul save. Old saves (version 1) are discarded, not migrated. */
export const SAVE_VERSION_OVERHAUL = 2 as const;

/** Whether Tab toggles the screen or shows it while held. DESIGN.md 6 and 7.7. */
export type TabMode = 'toggle' | 'hold';

/** Settings kept in the save. Audio keeps its own key (`AudioSettings`). */
export interface GameSettings {
  /** Default 'toggle'. */
  readonly tabMode: TabMode;
}

/**
 * The overhaul save. Written whenever something is finished; loading puts
 * Andrew in the chapter's bar at the bottom of Grand. DESIGN.md 7.6.
 */
export interface OverhaulSaveState {
  readonly version: typeof SAVE_VERSION_OVERHAUL;
  readonly chapter: ChapterNumber;
  /** Finished sections: clues, puzzles, stealth, encounters, bosses. */
  readonly completedSectionIds: readonly SectionId[];
  readonly kit: Kit;
  readonly mykoCallsLeft: number;
  readonly mykoCalls: readonly MykoCallRecord[];
  readonly casebook: readonly CasebookEntry[];
  /** Ways back opened from the far side. */
  readonly openedShortcuts: readonly ShortcutId[];
  readonly settings: GameSettings;
  /** For Chapter Select. */
  readonly finishedChapters: readonly ChapterNumber[];
  readonly cleanStealthRunIds: readonly StealthSectionId[];
  readonly collectedPickupIds: readonly PickupId[];
  readonly hintsGiven: Readonly<Record<ObjectiveId, number>>;
  readonly flags: Readonly<Record<string, ChapterFlagValue>>;
  readonly playedDialogue: readonly DialogueId[];
  readonly brokenProps: readonly string[];
  readonly lootSeed: number;
}
