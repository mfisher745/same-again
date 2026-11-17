/**
 * The chapter-module contract and registry. DESIGN.md section 10: "Chapters
 * are data plus small scripts. A chapter never reaches into a system's
 * internals." Level-builder writes one `ChapterModule` per chapter in
 * `src/chapters/<nn>/` and registers it from `src/chapters/index.ts` with
 * `registerChapter(module)`.
 *
 * ## How a chapter is put together
 *
 * Data (`ChapterModule`):
 * - `def`: the `ChapterDef` from types.ts (screens, checkpoints, sections in
 *   beat order, stealth defs, puzzle, deduction board, evidence, objectives,
 *   new abilities, Myko call lines, finale).
 * - `screens`: one `ScreenLayout` per `def.screens` entry: a `TileGrid` for
 *   collision / sight / shade, optional tile frames for drawing, exits to
 *   other screens and a start position.
 * - `pickups`, `examinables`: placed by screen (types.ts `PickupDef`,
 *   `ExaminableDef`). Examining adds evidence, gives an item and/or plays a
 *   line; the script can take over with `onExamine`.
 * - `fights`, `bosses`, `stealth`, `pushPuzzles`: where each section lives,
 *   what starts it (an area Andrew walks into, or 'script'), spawn points,
 *   and the `entrance` Myko waits at and strolls in from. The numbers
 *   (waves, health, attacks) come from `TUNING` by section ID, never from
 *   here.
 * - `screens[i].dressing`: props (frames in the props atlas, optionally
 *   animated, solid or sight-blocking) and standing NPCs (optionally
 *   talkable through an examinable ID), depth-sorted with the characters by
 *   their feet. `screens[i].ambient`: a palette tint for night scenes with
 *   light sources cut out of it.
 * - `triggers`: named areas; walking in calls `script.onTrigger(id)`. A
 *   spawn or respawn inside a trigger fires it on the next tick.
 * - There are no checkpoints. The chapter's bar is `def.bar` (or, while a
 *   chapter has none, its start screen's `playerStart`); Andrew starts there
 *   and comes back there when the meter reaches 0 or the floor. A save is
 *   written when a section finishes.
 *
 * Script (`createScript(ctx)` returns a `ChapterScript`): small event hooks.
 * Everything a script does goes through `ChapterContext`: dialogue by ID
 * (`say` resolves when the line is finished; box lines never block play,
 * scene lines pause it), objectives, flags (saved), starting and finishing
 * sections, scripted completables, boss hooks, moves, weapons, items, evidence,
 * exits, the bar's hot drink, props, NPCs and ambience (`setProp*`, `setNpc*`,
 * `setAmbient`: run-time only, restore from flags), melee hits on world
 * objects (`onMeleeHit`), and `completeChapter()` at the end.
 *
 * Every fight, boss, set piece, puzzle and deduction is a `Completable`:
 * fights, bosses, push puzzles and the deduction board are built by the
 * systems from the placements; any other puzzle kind or custom set piece is
 * registered by the script with `ctx.registerCompletable` (a callback that
 * jumps to the solved state) or `ctx.registerPuzzle` (a `PuzzleBase`
 * subclass from `src/systems`). Either way `completeNow()` works for the
 * Myko call and for QA.
 *
 * State after Continue: the chapter is rebuilt from the save, in the bar.
 * Completed sections stay complete, collected pickups stay collected, and
 * `onStart({ resumed })` tells the script where it is; the script restores
 * anything else from `ctx.flag()`. After a return to the bar the run keeps
 * going: flags go back to the last save, the unfinished section starts over,
 * and `onBarReturn` tells the script.
 *
 * QA: `window.__game.completeCurrent()` calls `completeNow('debug')` on the
 * current section; `window.__game.walkChapter()` completes every section in
 * `def.sections` order (stealth and explore are marked done, evidence and
 * the chapter's moves and weapons are granted, `script.debugWalk?.()` runs) and then completes
 * the chapter.
 */

import type { NpcId } from '../art/cast';
import type { ColourName } from '../art/palette';
import type { BossBodyPlacement, BossHooks, BossRunner } from '../systems/boss';
import type { FightHooks, FightRunner } from '../systems/fight';
import type { PuzzleBase } from '../systems/investigation';
import type { CombinePlacement } from '../systems/combine';
import type { ShelfArenaPlacement } from '../systems/shelves';
import type { MazePuzzlePlacement } from '../systems/maze';
import type { RedactionLayout, RedactionPuzzle } from '../systems/redaction';
import type { PushPuzzleLayout } from '../systems/puzzles';
import type { SheepPuzzleLayout } from '../systems/sheep';
import type { SectionHost } from '../systems/sections';
import type {
  AbilityId,
  BossId,
  ChapterDef,
  ChapterFlagValue,
  ChapterNumber,
  BarReturnReason,
  HotDrinkId,
  MoveId,
  WeaponId,
  CompletableKind,
  CompletableSectionId,
  CompletionSource,
  DialogueId,
  EnemyId,
  EvidenceId,
  ExaminableDef,
  Facing,
  FightSectionId,
  GameEventBus,
  Kit,
  ObjectiveId,
  PickupDef,
  PickupItem,
  PuzzleSectionId,
  Reward,
  ScreenId,
  SectionId,
  StealthSectionId,
  TextId,
  TileCoord,
  TileGrid,
  Vec2,
} from './types';

/** An axis-aligned area in screen pixels. */
export interface AreaRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** One thing worth finding. */
export interface ObjectiveMark {
  readonly id: string;
  readonly screenId: ScreenId;
  /** Pixels, where the sparkle sits. */
  readonly position: Vec2;
  /** Names the area of this mark for the H hint. */
  readonly areaTextId?: TextId;
  /** Hard to see (the chapter 2 ring clues): glints from further off and more often (`glint.faint`). */
  readonly faint?: true;
}

/** A way off a screen. */
export interface ExitDef {
  readonly id: string;
  readonly area: AreaRect;
  readonly toScreen: ScreenId;
  /** Where Andrew appears on the target screen. */
  readonly spawn: Vec2;
  /** Closed until all of these sections are complete. */
  readonly lockedUntil?: readonly SectionId[];
}

/** A rectangle of whole tiles, relative to whatever it belongs to. */
export interface TileFootprint {
  /** Offset in tiles from the owner's top-left tile (default 0). */
  readonly dx?: number;
  readonly dy?: number;
  readonly width: number;
  readonly height: number;
}

/**
 * A sprite prop from the props atlas (`PROPS_KEY`, frame names in `PROP`).
 * Drawn with its top-left corner at the top-left of tile (`col`, `row`) and
 * depth-sorted with the characters by its bottom edge (its "feet"), so Andrew
 * walks behind and in front of it.
 */
export interface PropPlacement {
  /** Name a script uses with `ctx.setPropVisible` / `setPropFrame` / `setPropTile`. Unique in the chapter. */
  readonly id?: string;
  /** Frame name in the props atlas. */
  readonly frame: string;
  /** Tile of the sprite's top-left corner. */
  readonly col: number;
  readonly row: number;
  /** Frame cycle for animated props (the bog lights); loops. */
  readonly frames?: readonly string[];
  /** Frames per second for `frames` (default 4). */
  readonly frameRate?: number;
  /** Tiles that block movement while the prop is visible, relative to `col`/`row`. */
  readonly solid?: TileFootprint;
  /** Tiles that block vision cones and headlights while visible (default: none). `true` uses `solid`. */
  readonly blocksSight?: TileFootprint | true;
  /**
   * Slow ground while visible (puddles): Andrew walks at `TUNING.overhaul.slowGroundMultiplier` of his speed
   * on these tiles. Enemies are not slowed.
   */
  readonly slows?: TileFootprint;
  /**
   * Tiles that enemies and bosses cannot enter while the prop is visible, though Andrew can (the cattle grid the
   * ram will not cross). Guards on a patrol ignore it.
   */
  readonly blocksEnemies?: TileFootprint;
  /**
   * A boss body that stands against this prop (within a tile of its `solid` footprint) for this many ms batters
   * through it: the prop is hidden, as when a script opens it with E, and `prop:brokenByBoss` is emitted. The pause
   * is the prop slowing the boss; use `TUNING.overhaul.ramGatePauseMs`. Nothing happens if the prop is already hidden.
   * Needs `id` and `solid`.
   */
  readonly bossBreaksAfterMs?: number;
  /** Starts hidden (shown later with `ctx.setPropVisible`). */
  readonly hidden?: boolean;
  /** An objective: it glints softly while Andrew is near, until the prop is hidden or broken. Names the mark `prop.<id>`. */
  readonly objective?: true;
  /** Names the area of this objective for the H hint. */
  readonly areaTextId?: TextId;
  /** Hard to see: glints from further off and more often. */
  readonly faint?: true;
  /** 'floor' draws under every character (rugs, puddles, markings); default 'sorted'. */
  readonly layer?: 'sorted' | 'floor';
  /**
   * Breaks to melee hits and thrown bottles (DESIGN.md 7.1 "Breakables"). The
   * hit area is `solid`, or the top-left tile. On breaking it shows
   * `debrisFrame` (default `PROP.debris[0]`), stops being solid, drops its
   * loot as a pickup, makes a `breakable` noise and emits `prop:broken`.
   * Broken props stay broken for the rest of the save.
   */
  readonly breakable?: {
    /** Hits to break (default `TUNING.breakables.defaultHits`). */
    readonly hits?: number;
    /** A fixed item, the region's loot table ('table', the default), or 'none'. */
    readonly loot?: PickupItem | 'table' | 'none';
    readonly debrisFrame?: string;
  };
}

/** A standing NPC. Texture `npcKey(npc)`; feet at the centre of tile (`col`, `row`). */
export interface NpcPlacement {
  /** Name a script uses with `ctx.setNpcPosition` / `setNpcFacing` / `setNpcVisible`. Unique in the chapter. */
  readonly id?: string;
  readonly npc: NpcId;
  readonly col: number;
  readonly row: number;
  readonly facing: Facing;
  /** Animation name (default 'idle'). */
  readonly anim?: string;
  /**
   * Pressing E beside the NPC examines this, shown as "talk" (`ui.prompt.talk`).
   * If `examinables` has an entry with this ID, its position is the talk spot
   * (it moves with the NPC); otherwise the NPC's feet are.
   */
  readonly examinableId?: string;
  /** Blocks the feet tile (default false). */
  readonly solid?: boolean;
  /** Starts hidden. */
  readonly hidden?: boolean;
}

/** Props and NPCs on a screen. */
export interface ScreenDressing {
  readonly props?: readonly PropPlacement[];
  readonly npcs?: readonly NpcPlacement[];
}

/** A light that cuts through the ambient darkness. */
export interface LightSource {
  /** Centre in screen pixels. */
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** Palette colour of the glow. */
  readonly colour: ColourName;
  /** Glow strength 0..1 on top of the cut-out (default 0.25). */
  readonly glow?: number;
}

/** Night and mood: a palette tint over the whole screen with lights cut out of it. */
export interface ScreenAmbient {
  /** Palette colour of the darkness (e.g. 'navyDark', 'ink'). */
  readonly tint: ColourName;
  /** 0 (none) .. 1 (solid tint). */
  readonly strength: number;
  readonly lights?: readonly LightSource[];
}

export interface ScreenLayout {
  readonly id: ScreenId;
  readonly grid: TileGrid;
  /** Optional frame index in the region tileset per tile (row-major); -1 or absent draws nothing. */
  readonly tiles?: readonly number[];
  readonly exits: readonly ExitDef[];
  /** Where Andrew starts if the chapter starts on this screen. */
  readonly playerStart: Vec2;
  /** Where Myko starts (default: beside Andrew). */
  readonly mykoStart?: Vec2;
  /** Props and NPCs, depth-sorted with the characters. */
  readonly dressing?: ScreenDressing;
  /** Night tint and lights. A script can change it with `ctx.setAmbient`. */
  readonly ambient?: ScreenAmbient;
  /**
   * Standing corn (chapter 6): areas of whole tiles. Standing still in a standing corn tile hides Andrew from guards
   * like Act Natural (no move needed); moving through one makes a `rustle` noise. Corn does not block sight or
   * movement; draw it with tile frames or props yourself and redraw on `corn:cut`. The combine cuts it.
   */
  readonly corn?: readonly { readonly col: number; readonly row: number; readonly width: number; readonly height: number }[];
}

/** What a melee swing that touched an `onMeleeHit` area was. */
export interface MeleeHitInfo {
  /** The weapon that swung. */
  readonly weaponId: WeaponId;
  /** The legacy ability id of the weapon (fists are `punchCombo`). */
  readonly abilityId: AbilityId;
  /** 0-based index in the combo. */
  readonly comboIndex: number;
  readonly comboLength: number;
  /** The last hit of a combo of two or more (the fists' third swing). */
  readonly haymaker: boolean;
}

/** What a charge or lurch that touched an `onMoveHit` area was. */
export interface MoveHitInfo {
  /** `shoulder` (the charge) or `stumble` (the lurch). */
  readonly moveId: MoveId;
}

/** What starts a section: Andrew walking into an area, or the script. */
export type SectionTrigger = { readonly kind: 'area'; readonly area: AreaRect } | { readonly kind: 'script' };

export interface FightPlacement {
  readonly sectionId: FightSectionId;
  readonly screenId: ScreenId;
  readonly trigger: SectionTrigger;
  readonly spawnPoints: readonly Vec2[];
  /** Where Myko waits on the phone and strolls in from. */
  readonly entrance: Vec2;
  /**
   * Leashed enemies: enemies of `enemyId` spawn inside `area` (at the spawn point nearest it, clamped into it) and never
   * leave it, so they fight at range from there (chapter 3's box-throwing workers on the gantry). Others roam as usual.
   */
  readonly zones?: readonly { readonly enemyId: EnemyId; readonly area: AreaRect }[];
}

export interface BossPlacement {
  readonly bossId: BossId;
  readonly screenId: ScreenId;
  readonly trigger: SectionTrigger;
  readonly bodies: readonly BossBodyPlacement[];
  /** Chapter 5 boss: the rolling shelves Pruitt cranks (`shelves.ts`). */
  readonly shelves?: ShelfArenaPlacement;
  /** Chapter 6 set piece: the combine's lanes, lights and escort (`combine.ts`). */
  readonly combine?: CombinePlacement;
  readonly entrance: Vec2;
  /**
   * What Myko's call lines for this boss or set piece are called: the chapter's `mykoCallLines.setpiece` set is
   * used, and its casebook entry records this name (`cN.call.<callId>.casebook`). Chapter 2's ram: 'ram'.
   */
  readonly callId?: string;
  /** For `reachExit` set pieces. */
  readonly exitArea?: AreaRect;
}

export interface StealthPlacement {
  readonly sectionId: StealthSectionId;
  readonly screenId: ScreenId;
  /**
   * Walking in starts the section. Absent: only the script starts it (`ctx.startSection(id)`), for guards that
   * arrive in a scene (the "Department" van in chapter 2). Until it starts the guards are not in the world.
   */
  readonly startArea?: AreaRect;
  /** Walking in without the alarm is a clean run. */
  readonly exitArea: AreaRect;
  readonly entrance: Vec2;
  /** Where the `.alarm` fight's reinforcements arrive. */
  readonly reinforcementPoints: readonly Vec2[];
}

export interface PushPuzzlePlacement {
  readonly sectionId: PuzzleSectionId;
  readonly screenId: ScreenId;
  readonly layout: PushPuzzleLayout;
  /** Examinable that resets the puzzle (the chapter 3 lever). */
  readonly resetExaminableId?: string;
  /** Art frame name / texture key hint for the pieces ('keg', 'crate'). */
  readonly pieceKind: string;
}

/** One rail of the slide puzzle: a piece that sits in one of `slots` positions along a line. */
export interface SlideRail {
  readonly id: string;
  /** Top-left tile of slot 0. */
  readonly origin: TileCoord;
  /** Which way the slots run: 'across' steps right a piece-length per slot, 'along' steps down. */
  readonly axis: 'across' | 'along';
  readonly slots: number;
  /** The piece's size in tiles: `length` along the axis, `breadth` across it. */
  readonly length: number;
  readonly breadth: number;
  /** The slot the piece starts in. */
  readonly start: number;
  /** PROP frame for the piece. */
  readonly frame: string;
}

/** The slide puzzle (chapter 4 containers). Built by the systems (`slide.ts`). */
export interface SlidePuzzlePlacement {
  readonly sectionId: PuzzleSectionId;
  readonly screenId: ScreenId;
  readonly rails: readonly SlideRail[];
  /**
   * E on the examinable pulls the lever: its rail's piece moves one slot on, wrapping from the last slot to 0. The
   * examinable's own dialogue and evidence still play. `propId` is a prop whose frame flips between `PROP.lever.up`
   * (start) and `.down` on each pull.
   */
  readonly levers: readonly { readonly examinableId: string; readonly railId: string; readonly propId?: string }[];
  /** The slot each rail's piece must be in. Met, the section completes. `completeNow()` moves them there. */
  readonly goal: Readonly<Record<string, number>>;
}

export interface SheepPuzzlePlacement {
  readonly sectionId: PuzzleSectionId;
  readonly screenId: ScreenId;
  readonly layout: SheepPuzzleLayout;
}

export interface RedactionPlacement {
  readonly sectionId: PuzzleSectionId;
  readonly layout: RedactionLayout;
  /** Examining this at the lightbox opens the pick-three screen (or the script calls `ctx.openRedaction()`). */
  readonly examinableId?: string;
}

export interface DeductionPlacement {
  /** Examining this opens the board (or the script calls `ctx.openDeduction()`). */
  readonly examinableId?: string;
}

export interface TriggerDef {
  readonly id: string;
  readonly screenId: ScreenId;
  readonly area: AreaRect;
  /** Fires once per chapter run (default true). */
  readonly once?: boolean;
}

export interface ChapterModule {
  readonly def: ChapterDef;
  readonly screens: readonly ScreenLayout[];
  readonly pickups: readonly PickupDef[];
  readonly examinables: readonly ExaminableDef[];
  readonly fights: readonly FightPlacement[];
  readonly bosses: readonly BossPlacement[];
  readonly stealth: readonly StealthPlacement[];
  readonly pushPuzzles?: readonly PushPuzzlePlacement[];
  /** The chapter 2 sheep puzzle: gates that swing, a flock that shies from Andrew. Built by the systems (`sheep.ts`). */
  readonly sheepPuzzles?: readonly SheepPuzzlePlacement[];
  /** The chapter 4 container puzzle: levers slide pieces along rails. Built by the systems (`slide.ts`). */
  readonly slidePuzzles?: readonly SlidePuzzlePlacement[];
  /** The chapter 6 marker-stone maze (`maze.ts`). */
  readonly mazePuzzles?: readonly MazePuzzlePlacement[];
  /** The chapter 5 lightbox puzzle (`redaction.ts`). */
  readonly redactionPuzzles?: readonly RedactionPlacement[];
  readonly deduction?: DeductionPlacement;
  readonly triggers: readonly TriggerDef[];
  /** Pools for Myko's tangents (DESIGN.md 7.5: Ohio from chapter 6). */
  readonly mykoTangentPools?: { readonly ohio?: string; readonly other?: string };
  /** Pool Myko draws from when a clue is found, if any. */
  readonly clueCommentPool?: string;
  createScript?(ctx: ChapterContext): ChapterScript;
}

export interface ChapterStartInfo {
  /** True after Continue; false on a fresh chapter start. */
  readonly resumed: boolean;
}

/** Andrew went back to the bar. The chapter puts its own run-time state right. DESIGN.md 7.1. */
export interface BarReturnInfo {
  readonly reason: BarReturnReason;
  /** The section that started over, or null if none was under way. Finished sections are not reset. */
  readonly resetSectionId: SectionId | null;
}

/** Hooks a chapter script may implement. All optional. */
export interface ChapterScript {
  onStart?(info: ChapterStartInfo): void;
  /** After a return to the bar: flags are back to the last save and the unfinished section starts over. */
  onBarReturn?(info: BarReturnInfo): void;
  onScreenEntered?(screenId: ScreenId): void;
  onTrigger?(triggerId: string): void;
  /** Return true to replace the default examine behaviour. */
  onExamine?(examinableId: string): boolean | void;
  onSectionStarted?(sectionId: SectionId): void;
  onSectionCompleted?(sectionId: SectionId, by: CompletionSource): void;
  onUpdate?(dtMs: number): void;
  bossHooks?: Partial<Record<BossId, BossHooks>>;
  fightHooks?: Partial<Record<FightSectionId, FightHooks>>;
  /** Extra work when QA walks the chapter (set flags, give items). */
  debugWalk?(): void;
  dispose?(): void;
}

/** Handle for a completable registered by a script. */
export interface ScriptedCompletableHandle {
  readonly sectionId: CompletableSectionId;
  isComplete(): boolean;
  /** The player finished it. */
  complete(by?: CompletionSource): void;
  /** Make it the current section (for the Myko call and the HUD). */
  start(): void;
}

/** Stealth controls a script may need. */
export interface StealthControl {
  alarm(): void;
  setHazardEnabled(hazardId: string, enabled: boolean): void;
  finish(): void;
  readonly alarmRaised: boolean;
}

export interface SweepHazardOptions {
  readonly from: Vec2;
  readonly to: Vec2;
  /** Width of the swept band, px. */
  readonly width: number;
  /** The shadow shows along the whole path this long before anything moves, ms. */
  readonly telegraphMs: number;
  /** Time to travel from `from` to `to`, ms. */
  readonly travelMs: number;
  /** The meter hit on contact: a weight from `TUNING.overhaul.hitWeights`. */
  readonly weight: 'ordinary' | 'heavy' | 'worst';
  readonly knockback: number;
  /** What is drawn moving and its shadow. */
  readonly frame: string;
  readonly shadowFrame: string;
}

/** The public API a chapter script uses. Implemented in `src/systems/`. */
export interface ChapterContext {
  readonly bus: GameEventBus;
  readonly chapter: ChapterNumber;
  readonly sectionHost: SectionHost;

  // Dialogue and objectives
  /**
   * Plays a sequence once per save (DESIGN.md 7.5 "Nothing is said twice"):
   * if it has been played before it resolves at once and shows nothing, unless
   * `repeat` is set. A queued `box` line is dropped if Andrew leaves the screen,
   * the section it was queued in completes, or it waits `myko.commentStaleMs`.
   */
  say(id: DialogueId, opts?: { readonly repeat?: boolean }): Promise<void>;
  setObjective(id: ObjectiveId | null): void;
  objective(): ObjectiveId | null;
  /**
   * Marks an objective or clue that glints softly while Andrew is within `TUNING.overhaul.glint.radiusTiles` of
   * it, until `completeMark(id)`. Examinables and props flagged `objective` are marked for you. No-op if `id` exists.
   */
  markObjective(mark: ObjectiveMark): void;
  /** Stops a mark glinting (the objective is done). Saved with the flags. */
  completeMark(id: string): void;
  /** Marks not yet finished, on every screen. */
  objectiveMarks(): readonly ObjectiveMark[];
  /** The area text for the H hint (the current objective's `areaTextId`, else the first unfinished mark's), or null. */
  hintArea(): TextId | null;

  // Flags (saved when a section is finished; a return to the bar puts them back)
  flag(key: string): ChapterFlagValue | undefined;
  setFlag(key: string, value: ChapterFlagValue): void;

  // Sections
  isComplete(sectionId: SectionId): boolean;
  startSection(sectionId: SectionId): void;
  /** Finish an explore section, a scripted completable or a `scripted` boss. */
  completeSection(sectionId: SectionId, by?: CompletionSource): void;
  registerCompletable(
    sectionId: CompletableSectionId,
    kind: CompletableKind,
    solve: (source: CompletionSource) => void,
    reward?: Reward,
  ): ScriptedCompletableHandle;
  registerPuzzle(puzzle: PuzzleBase): void;
  boss(id: BossId): BossRunner | null;
  fight(id: FightSectionId): FightRunner | null;
  stealth(id: StealthSectionId): StealthControl | null;
  openDeduction(): void;
  /** Chapter 5: the redaction puzzle `id` (collect sheets, read its state), or null if the chapter has none by that id. */
  redaction(id: PuzzleSectionId): RedactionPuzzle | null;
  /** Chapter 5: Andrew picked up a loose sheet. Saved with the flags. False if unknown or already held. */
  collectSheet(id: PuzzleSectionId, sheetId: string): boolean;
  /** Chapter 5: opens the pick-three-of-five screen for the lightbox puzzle (needs all five sheets collected). */
  openRedaction(id: PuzzleSectionId): void;
  /**
   * Chapter 6: cuts standing corn (`ScreenLayout.corn`) touched by `area` on the current screen (or `screenId`).
   * Emits `corn:cut` with the tiles that were standing. Returns how many tiles were cut.
   */
  cutCorn(area: AreaRect, screenId?: ScreenId): number;
  /** Chapter 6: regrows all corn of a screen as declared (a set piece starting over). */
  regrowCorn(screenId?: ScreenId): void;

  // Player and world
  /** Learn a move: it goes into its slot if that slot is empty. Emits `move:learned`. */
  learnMove(id: MoveId): void;
  /** Gain a weapon (not equipped yet). Emits `weapon:gained`. */
  gainWeapon(id: WeaponId): void;
  /**
   * @deprecated Old scripts name abilities: `hurley` gains the hurley; `stumble`, `stoutSlam`,
   * `actNatural` and `borrowedGlove` learn the move of that name; the rest do nothing.
   */
  unlockAbility(id: AbilityId): void;
  give(item: PickupItem): void;
  addEvidence(id: EvidenceId): void;
  /** What Andrew carries right now: weapon, moves, bottles, drinks, slots. Read it at chapter start; `kit:changed` announces changes. */
  kit(): Kit;
  /**
   * Hide or show the drink meter. While hidden the HUD does not draw it (`MeterSnapshot.hidden`; `meter:hiddenChanged`
   * fires on a change). Saved, and kept across a return to the bar until the script shows it again.
   */
  setMeterHidden(hidden: boolean): void;
  /**
   * Hold or release the plain drain. While held the value does not fall and no sober return comes from drain.
   * Drinks, hits, sun and tea/spirit timers still apply. Saved, and kept across a return to the bar.
   */
  holdDrain(held: boolean): void;
  /**
   * Called at the end of a return to the bar, after `onBarReturn` has run, so the world is final. Returns an
   * unsubscribe function.
   */
  onBarReturnSettled(fn: () => void): () => void;
  /**
   * Calls `fn` when the sheep puzzle `puzzleId`'s whole flock has settled in a pen that is not the last one it
   * settled in (`sheep:flockSettled`). `pen` is the layout pen's `id`, or `pen<index>`. Returns an unsubscribe.
   */
  onFlockSettled(puzzleId: SectionId, fn: (pen: string) => void): () => void;
  /**
   * Promise a move lesson: the first time Andrew is at Bit much (level 3 or more) in a LATER chapter while it is
   * still owed, the run plays `sceneId`, learns the move into its slot, and stops owing it. Learning the move any
   * other way (`learnMove`) also clears it. Saved. Calling it again for the same move changes nothing.
   * If Andrew reaches Bit much during a fight, stealth section, set piece, Myko call or dialogue scene, the lesson
   * waits and plays when that ends, whatever his level by then. If the kit already has the move (a Chapter Select
   * replay) nothing is owed and nothing plays. After the lesson, `move:taughtByFallback` is emitted.
   */
  oweMove(moveId: MoveId, sceneId: DialogueId): void;
  /** Whether a move's lesson is still owed. */
  movesOwed(): readonly MoveId[];
  /** Take the bar's free hot drink into the kit. False if one is already carried or it was taken. */
  takeHotDrink(id: HotDrinkId): boolean;
  /** The bar is offering a free hot drink and Andrew carries none. */
  hotDrinkOffered(): boolean;
  /** A shortcut Andrew opened from the far side (a clean-run reward) is open. */
  shortcutOpened(id: string): boolean;
  goToScreen(screenId: ScreenId, spawn: Vec2): void;
  currentScreen(): ScreenId;
  setExitLocked(exitId: string, locked: boolean): void;
  setHeatActive(active: boolean): void;
  /** Park Myko at a spot (scripted), or null to let him follow again. */
  setMykoScripted(pos: Vec2 | null): void;
  playerPosition(): Vec2;
  setPlayerPosition(pos: Vec2): void;
  /**
   * The camera looks ahead of Andrew in `direction` (by `TUNING.overhaul.cameraLeadPx`), or follows him
   * centred again with null. For the ram's lane, where he runs left to right and the camera leads. Run-time only.
   */
  setCameraLead(direction: Facing | null): void;
  /** Freeze Andrew's controls (cutscene walk-ins). */
  setControlsLocked(locked: boolean): void;
  /**
   * An involuntary Stumble: Andrew lurches along `dir` (a `Facing` or an angle in degrees) with the Stumble's motion
   * and breakage (stops at walls, kegs and closed gates; smashes every breakable in the lane; `onMoveHit` hooks fire
   * as `stumble`), whether or not the move is learned. Costs nothing: no cooldown, no meter, no drink. Input is
   * blocked until it ends. Resolves when he has stopped, so the script can play the lesson next. `distance` and
   * `durationMs` default to the Stumble's own distance and `TUNING.overhaul.forcedLurchMs`. A second call while one
   * is under way returns the first's promise. Resolves early if the run ends or he returns to the bar.
   */
  forceLurch(dir: Facing | number, opts?: { readonly distance?: number; readonly durationMs?: number }): Promise<void>;
  /**
   * True when a band `width` px wide from `from` to `to` on the current screen touches no blocked tile, solid prop,
   * slide-puzzle piece, push piece, sheep gate or NPC. Use it to ask "could he see / reach that" in a script.
   * `ignoreBreakables` lets breakable props (which a lurch smashes) count as clear.
   */
  lineClear(from: Vec2, to: Vec2, width: number, opts?: { readonly ignoreBreakables?: boolean }): boolean;
  /**
   * A hazard sweeps across the screen: a shadow shows along the whole path for `telegraphMs`, then `frame` travels
   * `from` to `to` over `travelMs`. If its band touches Andrew it hits him once per pass (`weight` from
   * `TUNING.overhaul.hitWeights`, `knockback` px/s away from the path). Enemies are not hurt. Drawn in the world view.
   * Resolves when the pass ends; a return to the bar or dispose cancels it (resolves at once). Emits
   * `hazard:swept` `moving` as it starts to move and `hit` if it lands.
   */
  sweepHazard(opts: SweepHazardOptions): Promise<void>;
  spawnPickup(def: PickupDef): void;
  removePickup(id: string): void;
  /** Ends the chapter: hangover carry-over, save, next chapter. */
  completeChapter(): void;

  // Dressing and ambience. Run-time changes last for this run only (not
  // saved): restore them from flags in `onStart` after a death or Continue.
  /** Shows or hides a prop by `PropPlacement.id` (its `solid`/`blocksSight` tiles go with it). */
  setPropVisible(id: string, visible: boolean): void;
  /** Swaps a prop's frame; `frames` replaces (or, as [], stops) its animation. */
  setPropFrame(id: string, frame: string, frames?: readonly string[]): void;
  /** Moves a prop so its top-left is at tile (`col`, `row`). */
  setPropTile(id: string, col: number, row: number): void;
  /** Moves an NPC's feet to `pos` (pixels), e.g. `T(col, row)`. */
  setNpcPosition(id: string, pos: Vec2): void;
  setNpcFacing(id: string, facing: Facing): void;
  /** Hides (removes) or shows an NPC. A hidden NPC cannot be talked to. */
  setNpcVisible(id: string, visible: boolean): void;
  /** Replaces the current screen's ambience (`null` = none). `screenId` targets another screen. */
  setAmbient(ambient: ScreenAmbient | null, screenId?: ScreenId): void;
  /**
   * Calls `callback` when a melee swing's shape (aimed where Andrew aims) touches
   * `area` on `screenId` (default: the screen current when this is called).
   * Fires once per swing. Returns a function that removes the hook.
   */
  onMeleeHit(area: AreaRect, callback: (hit: MeleeHitInfo) => void, screenId?: ScreenId): () => void;
  /**
   * Calls `callback` when the lane of Andrew's Shoulder or Stumble touches `area` on `screenId` (default: the
   * screen current when this is called), before he moves. Fires once per use. Returns a function that removes the
   * hook. The Stumble also breaks every breakable prop in its lane, whatever hits it had left, so a stack of
   * feed buckets placed as breakables is gone before he arrives.
   */
  onMoveHit(area: AreaRect, callback: (hit: MoveHitInfo) => void, screenId?: ScreenId): () => void;

  // Timers in game time. They keep running while a scene or the call-in
  // blackout is showing (not while the game is paused) and are cancelled when
  // the chapter run is torn down (death, Continue, quitting).
  /** Calls `fn` once after `ms`. Returns a cancel function. */
  after(ms: number, fn: () => void): () => void;
  /** Calls `fn` every `ms` until cancelled. Returns a cancel function. */
  every(ms: number, fn: () => void): () => void;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const REGISTRY = new Map<ChapterNumber, ChapterModule>();

export function registerChapter(module: ChapterModule): void {
  REGISTRY.set(module.def.number, module);
}

export function getChapter(n: ChapterNumber): ChapterModule | undefined {
  return REGISTRY.get(n);
}

export function registeredChapters(): ChapterNumber[] {
  return [...REGISTRY.keys()].sort((a, b) => a - b);
}

/** Test helper. */
export function clearChapterRegistry(): void {
  REGISTRY.clear();
}
