/**
 * One play of a chapter from a save point: the simulation behind the Game
 * scene. Plain TypeScript (no Phaser), so it can be stepped headless in
 * tests and by QA. The Phaser view in `src/systems/view/` only reads it.
 *
 * Owns the player, Myko, the dialogue runner, the casebook, every section
 * of the chapter (fights, bosses, stealth, puzzles, deduction, scripted
 * completables), the current screen's actors, projectiles, pickups and
 * examinables, and the chapter script. Implements `ChapterContext` for the
 * script and the host interfaces the systems need.
 */

import { TUNING } from '../content/tuning';
import type {
  AreaRect,
  BossPlacement,
  ChapterContext,
  ChapterModule,
  ChapterScript,
  FightPlacement,
  MeleeHitInfo,
  MoveHitInfo,
  PushPuzzlePlacement,
  SheepPuzzlePlacement,
  SlidePuzzlePlacement,
  SweepHazardOptions,
  ScreenAmbient,
  ScreenLayout,
  ScriptedCompletableHandle,
  StealthControl,
  StealthPlacement,
} from '../core/chapter';
import { BusScope } from '../core/events';
import { seededRandom } from '../core/random';
import type { Random } from '../core/random';
import { GameEvents } from '../core/types';
import type {
  AbilityId,
  AlarmFightId,
  AttackShape,
  BossId,
  CarriedDrinkId,
  DrunkState,
  ChapterFlagValue,
  ChapterNumber,
  Completable,
  CompletableKind,
  CompletableSectionId,
  CompletionSource,
  DialogueId,
  DrunkLevel,
  EnemyId,
  EvidenceId,
  ExaminableDef,
  Facing,
  FightDef,
  FightSectionId,
  GameEventBus,
  HotDrinkId,
  Kit,
  HitInfo,
  InputFrame,
  MykoCallKind,
  MykoCallLineSet,
  MykoCallRecord,
  NoiseEvent,
  ObjectiveDef,
  ObjectiveId,
  PuzzleSectionId,
  MoveId,
  OverhaulDrinkId,
  PickupDef,
  PickupItem,
  PickupId,
  PickupRefusal,
  Reward,
  SaveReason,
  GameSettings,
  OverhaulSaveState,
  OwedMove,
  ScreenId,
  SpecialSlotIndex,
  SectionId,
  SectionKind,
  StealthSectionDef,
  StealthSectionId,
  TextId,
  TileGrid,
  Vec2,
  BarReturnReason,
  WeaponId,
  ProofId,
} from '../core/types';
import { SAVE_VERSION_OVERHAUL } from '../core/types';
import { BarFlow } from './barFlow';
import type { BarFlowHost, BarLocation, BarReturnRecord } from './barFlow';
import { BossRunner } from './boss';
import { knockbackVector, shapeHits, shapeHitsRect } from './combat';
import { DialogueRunner } from './dialogue';
import { Dressing, propHitRect } from './dressing';
import type { InteractPoint, LiveProp } from './dressing';
import type { DialogueLookup } from './dialogue';
import { EnemyActor, statsFromDef } from './enemies';
import { LoneEnemies } from './loneEnemy';
import type { LoneEnemyHandle, LoneEnemyOptions } from './loneEnemy';
import type { ActorStats, CombatWorld } from './enemies';
import { FightRunner } from './fight';
import { add, angleDiff, angleFromFacing, angleTo, distance, fromAngle, normalize, rectContains, scale } from './geometry';
import { TILE, bandClear, isBlocked, isShade, moveBox, tileCentre, tileOf } from './grid';
import { Casebook, DeductionBoard, PuzzleBase } from './investigation';
import { assignMove, assignWeapon, clampBottles, cycleDrink, gainWeapon, learnMove, selectItem, spiritLimit, topUpForLeaving, useSelected, useSpirit } from './kit';
import { GlintTracker } from './glint';
import type { ObjectiveMark } from './glint';
import { takeItem } from './pickups';
import { barBeerOf, dropRngFor, regionBeer, rollBreakableDrop, rollEnemyDrop } from './drops';
import { MykoMeterVoice } from './mykoMeter';
import { applyDrinkReward, claimReward, createRewardState, openShortcut } from './rewards';
import { Myko } from './myko';
import type { CallTarget, MykoHost } from './myko';
import { Player } from './player';
import { PlayerCombat } from './playerCombat';
import { legacyAbilityOf } from './playerCombat';
import type { PlayerCombatHost } from './playerCombat';
import type { SwingResult } from './weapons';
import { projectileTouches, spawnProjectile, stepProjectile } from './projectiles';
import type { Projectile, ProjectileSpawn } from './projectiles';
import { PushPuzzle } from './puzzles';
import { SheepPuzzle } from './sheep';
import { SlidePuzzle } from './slide';
import { CombineDirector } from './combine';
import { CornField } from './corn';
import type { PixelRect } from './corn';
import { MazePuzzle } from './maze';
import { RedactionPuzzle } from './redaction';
import { JunctionPuzzle } from './junctions';
import { MascotDirector } from './mascots';
import { Pruitt2Director } from './pruitt2';
import { GravityPuzzle } from './gravity';
import { LockdownDirector } from './lockdown';
import { AdministratorDirector } from './administrator';
import { BroadcastPuzzle } from './broadcast';
import { CardSequence } from './epilogue';
import type { EpilogueCard } from './epilogue';
import { ShadeField } from './heat';
import type { HeatState, ShadeRect } from './heat';
import { TellsPuzzle } from './tells';
import { ShelfDirector } from './shelves';
import { PROP } from '../art/props';
import { CompletableSection, ScriptedCompletable } from './sections';
import type { SectionHost } from './sections';
import { StealthRunner, actingNatural, canSee } from './stealth';
import type { Guard, StealthHost } from './stealth';

/** Short-lived things for the view to draw (swings, slams, impacts). */
export interface FxEvent {
  readonly kind: 'swing' | 'slam' | 'breath' | 'glove' | 'impact' | 'blocked' | 'hit' | 'throw' | 'wipe';
  readonly pos: Vec2;
  readonly angleDeg: number;
  readonly radius: number;
  readonly arcDeg: number;
  ttlMs: number;
  /** `throw` (Barred): where he was lifted from (Andrew's hands); `pos` is where he comes down. */
  readonly from?: Vec2;
}

export interface LivePickup {
  readonly def: PickupDef;
  item: PickupItem;
}

/** Effects the run triggers directly, because they have no bus event. */
export type RunEffect = 'door' | 'push' | 'deflect' | 'thud';

export interface RunOptions {
  readonly module: ChapterModule;
  readonly save: OverhaulSaveState;
  readonly bus: GameEventBus;
  readonly rng: Random;
  readonly dialogue: DialogueLookup;
  /** Sequence IDs of a dialogue pool, [] if unknown. */
  readonly pool: (poolId: string) => readonly DialogueId[];
  /** True after Continue. */
  readonly resumed: boolean;
  readonly writeSave: (state: OverhaulSaveState, reason: SaveReason) => void;
  readonly onChapterComplete: (endState: DrunkState, snapshot: OverhaulSaveState) => void;
  /** Sound effects with no bus event (door, push, deflect). */
  readonly playEffect?: (id: RunEffect) => void;
  /**
   * Changes the stored save in place without a full save (no player
   * snapshot): used for things that must survive a return to the bar before
   * the next finished section, namely played dialogue and broken props.
   */
  readonly patchSave?: (patch: (state: OverhaulSaveState) => OverhaulSaveState) => void;
}

interface SectionEntry {
  readonly completable: CompletableSection;
  readonly kind: CompletableKind;
  readonly screenId: ScreenId | null;
  readonly entrance: Vec2 | null;
  start(): void;
  aliveActors?(): EnemyActor[];
  setSuspended?(on: boolean): void;
}

/** How far past where a blocked lurch ends it still touches (px): the blocker itself, not what lies behind it. */
const HOOK_TOUCH = 4;

/** `pub.step` value of chapter 1 once Dympna has handed over the first pint (STEP.talked in the chapter script). */
const FIRST_PINT_STEP = 2;
/** Buzz level 3 is Bit much (DESIGN.md 7.1). */
const BIT_MUCH_LEVEL = 3;

interface MarkEntry {
  readonly mark: ObjectiveMark;
  /** Finished once this evidence is in the casebook. */
  readonly evidenceId?: EvidenceId;
  /** Finished once this prop is hidden or broken. */
  readonly propKey?: string;
}

interface LiveSweep {
  readonly opts: SweepHazardOptions;
  readonly screenId: ScreenId;
  elapsedMs: number;
  hit: boolean;
  moving: boolean;
  readonly resolve: () => void;
}

/** Where a sweep's moving thing is: at `from` while the shadow telegraphs, then along the path. */
function sweepPos(h: LiveSweep): Vec2 {
  const o = h.opts;
  const t = h.moving ? Math.min(1, (h.elapsedMs - o.telegraphMs) / Math.max(1, o.travelMs)) : 0;
  return { x: o.from.x + (o.to.x - o.from.x) * t, y: o.from.y + (o.to.y - o.from.y) * t };
}

/** A boss's directors: Pruitt's shelves, the combine, the mascots, Pruitt round two. */
interface Directors {
  shelves?: ShelfDirector;
  combine?: CombineDirector;
  mascots?: MascotDirector;
  pruitt2?: Pruitt2Director;
  lockdown?: LockdownDirector;
  administrator?: AdministratorDirector;
}

/** The flags the systems keep (saved with the chapter's flags, put back on a return to the bar). */
const FLAG_HEAT_OFF = 'sys.heatOff';
const FLAG_NIGHT = 'sys.night';
const flagTells = (id: string): string => `tells.${id}`;
const flagJunctions = (id: string): string => `junctions.${id}`;
const flagGravity = (id: string): string => `gravity.${id}`;
const flagBroadcast = (id: string): string => `broadcast.${id}`;
const flagBroadcastPressed = (id: string): string => `broadcast.${id}.pressed`;

export class ChapterRun implements ChapterContext, SectionHost, CombatWorld {
  readonly bus: GameEventBus;
  readonly rng: Random;
  readonly module: ChapterModule;
  readonly chapter: ChapterNumber;
  readonly player: Player;
  readonly combat: PlayerCombat;
  readonly myko: Myko;
  readonly dialogue: DialogueRunner;
  readonly casebook: Casebook;
  readonly sectionHost: SectionHost = this;
  /** Props, NPCs and ambience of every screen (run-time state, not saved). */
  readonly dressing: Dressing;

  // Progress (persisted)
  private readonly completed: Set<SectionId>;
  private readonly cleanRuns: Set<StealthSectionId>;
  private readonly collected: Set<PickupId>;
  private readonly hints: Record<ObjectiveId, number>;
  private readonly flags: Record<string, ChapterFlagValue>;
  private callsLeft: number;
  private readonly calls: MykoCallRecord[];
  /** Move lessons a script has promised (`oweMove`); saved. */
  private owedMoves: OwedMove[];
  /** A lesson scene is playing now (the fallback runs once at a time). */
  private owedPlaying = false;
  /** Andrew has reached Bit much with a lesson owed; it plays as soon as nothing else is going on. */
  private owedDue = false;
  /** A scripted involuntary lurch under way (`forceLurch`). */
  private forced: { from: Vec2; to: Vec2; elapsedMs: number; durationMs: number; resolve: () => void; promise: Promise<void> } | null = null;
  /** Sweep hazards under way (`sweepHazard`). */
  private hazards: LiveSweep[] = [];
  /** Time each `bossBreaksAfterMs` prop has had a boss body against it, by prop key. */
  private readonly bossBreakMs = new Map<string, number>();
  private readonly finished: readonly ChapterNumber[];
  /** The script flags as the last save held them; a return to the bar puts them back. */
  private savedFlags: Record<string, ChapterFlagValue>;
  private settings: GameSettings;
  private openedShortcuts: readonly string[];

  // Sections
  private readonly sections = new Map<CompletableSectionId, SectionEntry>();
  private readonly fights = new Map<FightSectionId | AlarmFightId, FightRunner>();
  private readonly bosses = new Map<BossId, BossRunner>();
  private readonly stealthRunners = new Map<StealthSectionId, { runner: StealthRunner; placement: StealthPlacement | null }>();
  private deduction: DeductionBoard | null = null;
  /** Standing corn by screen (chapter 6). */
  readonly corn = new CornField();
  /** Boss directors: Pruitt's shelves, the combine. */
  private readonly directors = new Map<BossId, Directors>();
  /** Shade areas (static and moving) for the heat. */
  private readonly shade = new ShadeField();
  /** The board has been opened this run: stepping back from it leaves it waiting to be reopened. */
  private deductionStarted = false;
  private currentSection: CompletableSectionId | null = null;
  /** Weapons left on the floor (`spawnWeaponPickup`). Run-time only. */
  private weaponPickups: { readonly id: string; readonly weaponId: WeaponId; readonly screenId: ScreenId; readonly position: Vec2 }[] = [];
  /** A scripted card sequence under way (`playCards`). */
  private cardSeq: CardSequence | null = null;
  /** Andrew is sitting (`sitDown`). */
  private seatedAt: { readonly pos: Vec2; readonly facing: Facing } | null = null;

  // Screen
  private screen: ScreenLayout;
  private actorList: EnemyActor[] = [];
  private projectileList: Projectile[] = [];
  private readonly pickupsLive = new Map<PickupId, LivePickup>();
  private readonly refusedNear = new Set<PickupId>();
  private readonly exitLocks = new Map<string, boolean>();
  private readonly firedTriggers = new Set<string>();
  private readonly insideTriggers = new Set<string>();
  readonly fx: FxEvent[] = [];
  private clock = 0;
  private footstepMs = 0;
  private defeatedEmitted = new Set<string>();
  /** Standalone enemies spawned by the script (`spawnLoneEnemy`); run-time only, cleared with the world. */
  private readonly loneEnemies = new LoneEnemies();
  private meleeHooks: { readonly area: AreaRect; readonly screenId: ScreenId; readonly callback: (hit: MeleeHitInfo) => void }[] = [];
  private moveHooks: { readonly area: AreaRect; readonly screenId: ScreenId; readonly callback: (hit: MoveHitInfo) => void }[] = [];
  private timers: { at: number; readonly everyMs: number | null; readonly fn: () => void }[] = [];
  private readonly lootSeed: number;

  // State
  private objectiveId: ObjectiveId | null = null;
  private controlsLocked = false;
  private leadDirection: Facing | null = null;
  private ended = false;
  private readonly script: ChapterScript;
  private readonly scope: BusScope;
  private begun = false;
  /** The current screen is out in the sun (`ScreenDef.sun`). */
  private screenInSun = false;
  private readonly barFlow: BarFlow;
  /** Time waiting for `completeBarReturn`, for the failsafe. */
  private returnWaitMs = 0;
  private readonly mykoVoice: MykoMeterVoice;
  /** Objectives and clues that glint while unfinished (`glint.ts`). By mark id. */
  private readonly marks = new Map<string, MarkEntry>();
  private readonly glint: GlintTracker;
  /** The screen Andrew was on before this one, to tell when he walks out of the bar. */
  private lastScreenId: ScreenId | null = null;
  /** Areas entered so far this run: Myko lights up the first time Andrew walks into each one (not the bar). */
  private readonly arrivedScreens = new Set<ScreenId>();

  constructor(private readonly opts: RunOptions) {
    const save = opts.save;
    this.bus = opts.bus;
    this.rng = opts.rng;
    this.module = opts.module;
    this.chapter = opts.module.def.number;
    this.scope = new BusScope(this.bus);
    this.completed = new Set(save.completedSectionIds);
    this.cleanRuns = new Set(save.cleanStealthRunIds);
    this.collected = new Set(save.collectedPickupIds);
    this.hints = { ...save.hintsGiven };
    this.flags = { ...save.flags };
    this.callsLeft = save.mykoCallsLeft;
    this.calls = [...save.mykoCalls];
    this.owedMoves = [...(save.owedMoves ?? [])];
    this.finished = save.finishedChapters;
    this.savedFlags = { ...save.flags };
    this.settings = save.settings;
    this.openedShortcuts = [...save.openedShortcuts];

    // Loading a save puts Andrew in the bar exactly as a return does, bottles topped up (DESIGN.md 7.6). Chapter 1 keeps its own start.
    this.player = new Player(this.bus, opts.resumed && this.chapter >= 2 ? topUpForLeaving(save.kit, barBeerOf(opts.module.def)) : clampBottles(save.kit), this.chapter);
    if (save.meterHidden) this.player.setMeterHidden(true);
    if (save.drainHeld) this.player.holdDrain(true);
    this.combat = new PlayerCombat(this.combatHost());
    this.mykoVoice = new MykoMeterVoice({ rng: this.rng, pool: (id) => this.opts.pool(id), say: (id) => void this.say(id, { repeat: true }), meterHidden: () => this.player.meterHidden || this.player.calm });
    this.dialogue = new DialogueRunner(this.bus, opts.dialogue, {
      played: save.playedDialogue,
      context: {
        clock: () => this.clock,
        screenId: () => this.screen.id,
        sectionId: () => this.currentSection,
        isComplete: (id) => this.completed.has(id as SectionId),
        staleMs: TUNING.myko.commentStaleMs,
      },
    });
    this.lootSeed = save.lootSeed;
    this.casebook = new Casebook(this.bus, save.casebook);
    this.myko = new Myko(this.mykoHost());
    this.dressing = new Dressing(this.module.screens, save.brokenProps, TUNING.breakables.defaultHits);
    // The glint has its own seeded source so it never shifts the drops and the sheep.
    this.glint = new GlintTracker(seededRandom((save.lootSeed ^ 0x51ed270b) >>> 0));
    this.collectMarks();

    const bar = this.barLocation();
    const screen = this.layout(bar.screenId) ?? this.module.screens[0];
    if (!screen) throw new Error(`Chapter ${this.chapter} has no screens`);
    this.screen = screen;
    this.barFlow = new BarFlow(this.barFlowHost());

    for (const sc of this.module.screens) if (sc.shadeAreas) this.shade.mark(sc.id, sc.shadeAreas);
    this.buildSections();
    this.script = this.module.createScript?.(this) ?? {};
    this.wireBus();

    this.loadScreen(screen.id, bar.position);
  }

  /**
   * Runs once, on the first tick, so the HUD and audio (started with the
   * scene) see the opening lines and events.
   */
  private begin(): void {
    this.script.onStart?.({ resumed: this.opts.resumed });
    this.mykoVoice.trigger({ kind: 'chapterStart', chapter: this.chapter }, this.player.meter.value);
    const region = this.module.def.screens.find((x) => x.id === this.screen.id)?.region;
    if (region) this.bus.emit(GameEvents.ScreenEntered, { screenId: this.screen.id, region });
  }

  // -------------------------------------------------------------------------
  // Read access for the view, UI and tests
  // -------------------------------------------------------------------------

  get screenLayout(): ScreenLayout {
    return this.screen;
  }

  /** The current screen's grid with solid props and NPCs merged in. */
  get grid(): TileGrid {
    return this.dressing.gridFor(this.screen);
  }

  get screenId(): ScreenId {
    return this.screen.id;
  }

  get isEnded(): boolean {
    return this.ended;
  }

  /** Gameplay is paused by a scripted scene. */
  get sceneBlocking(): boolean {
    return this.dialogue.blocking || this.myko.callInProgress;
  }

  enemies(): readonly EnemyActor[] {
    return this.actorList;
  }

  projectiles(): readonly Projectile[] {
    return this.projectileList;
  }

  pickups(): readonly LivePickup[] {
    return [...this.pickupsLive.values()];
  }

  /** Examinables drawn as markers: those not owned by an NPC. */
  examinablesHere(): readonly ExaminableDef[] {
    const owned = this.dressing.npcExaminableIds();
    return this.module.examinables.filter((e) => e.screenId === this.screen.id && !owned.has(e.id));
  }

  /** What E would examine or talk to right now, if anything (for prompts). */
  interactTarget(): InteractPoint | null {
    const p = this.player.pos;
    let best: InteractPoint | null = null;
    let bestD = TUNING.investigation.interactRadius;
    for (const e of this.dressing.interactPoints(this.screen.id, this.module.examinables)) {
      const d = distance(e.position, p);
      if (d <= bestD) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  /** The current screen's ambience after script changes. */
  ambient(): ScreenAmbient | null {
    return this.dressing.ambient(this.screen.id);
  }

  guardsHere(): readonly Guard[] {
    return this.stealthHere().flatMap((s) => (s.runner.active ? s.runner.guards : []));
  }

  stealthHere(): { runner: StealthRunner; placement: StealthPlacement | null }[] {
    return [...this.stealthRunners.values()].filter((s) => s.placement?.screenId === this.screen.id);
  }

  pushPuzzlesHere(): { puzzle: PushPuzzle; placement: PushPuzzlePlacement }[] {
    const out: { puzzle: PushPuzzle; placement: PushPuzzlePlacement }[] = [];
    for (const p of this.module.pushPuzzles ?? []) {
      if (p.screenId !== this.screen.id) continue;
      const e = this.sections.get(p.sectionId);
      if (e && e.completable instanceof PushPuzzle) out.push({ puzzle: e.completable, placement: p });
    }
    return out;
  }

  callsRemaining(): number {
    return this.callsLeft;
  }

  currentCompletable(): Completable | null {
    const id = this.currentSection;
    if (!id) return null;
    const e = this.sections.get(id);
    return e && !e.completable.isComplete() ? e.completable : null;
  }

  activeBoss(): BossRunner | null {
    for (const b of this.bosses.values()) if (b.active) return b;
    return null;
  }

  activeDeduction(): DeductionBoard | null {
    return this.deduction?.isOpen ? this.deduction : null;
  }

  submitDeduction(id: string, evidence: readonly EvidenceId[]): boolean {
    if (!this.deduction || this.deduction.def.id !== id) return false;
    return this.deduction.submit(evidence, this.bus);
  }

  objectiveDef(): ObjectiveDef | null {
    return this.module.def.objectives.find((o) => o.id === this.objectiveId) ?? null;
  }

  /** Builds the save for the current progress. Loading it puts Andrew in the chapter's bar at the bottom of Grand. */
  snapshot(): OverhaulSaveState {
    return {
      version: SAVE_VERSION_OVERHAUL,
      chapter: this.chapter,
      completedSectionIds: [...this.completed],
      kit: this.player.kit,
      mykoCallsLeft: this.callsLeft,
      mykoCalls: [...this.calls],
      openedShortcuts: [...this.openedShortcuts],
      settings: this.settings,
      finishedChapters: [...this.finished],
      cleanStealthRunIds: [...this.cleanRuns],
      collectedPickupIds: [...this.collected],
      casebook: [...this.casebook.entries()],
      hintsGiven: { ...this.hints },
      flags: { ...this.flags },
      playedDialogue: this.dialogue.playedIds(),
      brokenProps: this.dressing.brokenKeys(),
      lootSeed: this.lootSeed,
      ...(this.player.meterHidden ? { meterHidden: true } : {}),
      ...(this.player.drainHeld ? { drainHeld: true } : {}),
      ...(this.owedMoves.length > 0 ? { owedMoves: [...this.owedMoves] } : {}),
    };
  }

  dispose(): void {
    this.endForcedLurch();
    this.cancelHazards();
    this.meleeHooks = [];
    this.moveHooks = [];
    this.timers = [];
    this.script.dispose?.();
    this.scope.dispose();
    this.dialogue.clear();
  }

  // -------------------------------------------------------------------------
  // Tick
  // -------------------------------------------------------------------------

  tick(dtMs: number, input: InputFrame): void {
    if (this.ended) return;
    if (!this.begun) {
      this.begun = true;
      this.begin();
    }
    // The run's clock (script timers, dialogue staleness) stands still while a return waits, so timers resume, not burst.
    if (!this.barFlow.pending) this.clock += dtMs;
    for (const f of this.fx) f.ttlMs -= dtMs;
    while (this.fx.length > 0 && (this.fx[0]?.ttlMs ?? 1) <= 0) this.fx.shift();
    this.dressing.tick(dtMs);
    this.dialogue.dropStale();
    // A return to the bar is waiting for the scene: the world is frozen where Andrew was.
    // Script timers do not fire. Only Myko's scripted walk (and the view) keep running;
    // the failsafe completes the return if the scene never does.
    if (this.barFlow.pending) {
      this.returnWaitMs += dtMs;
      this.myko.tickScripted(dtMs);
      const limit = TUNING.overhaul?.barReturnFailsafeMs;
      if (limit !== undefined && this.returnWaitMs >= limit) this.completeBarReturn();
      return;
    }

    // Script timers keep running through scenes and the blackout.
    this.tickTimers();
    if (this.ended) return;

    // The call-in blackout pauses gameplay until the UI reports it finished (or it times out).
    if (this.myko.callInProgress) {
      this.myko.tickCall(dtMs);
      return;
    }
    if (this.cardSeq) {
      this.cardSeq.tick(dtMs);
      if (this.cardSeq.finished) this.cardSeq = null;
    }
    if (this.dialogue.blocking) return;
    // The world waits while the cards are on.
    if (this.cardSeq) return;

    const live = this.controlsLocked || this.forced !== null || this.myko.callInProgress || this.deduction?.isOpen === true ? lockedInput(input) : input;
    const p = this.player;

    // Player: move, then the meter (sun first, so this tick's drain is right).
    p.move(dtMs, live, this.grid, (c, r) => this.extraBlocked(c, r), this.groundSpeed());
    this.tickForcedLurch(dtMs);
    p.setInSun(this.heatActive() && this.screenInSun && !isShade(this.grid, p.pos) && !this.shade.inShade(this.screen.id, p.pos));
    p.tickMeter(dtMs);
    this.mykoVoice.step(dtMs);
    if (p.meter.returnReason) this.handleReturn();
    else this.mykoVoice.trigger({ kind: 'meterValue' }, p.meter.value);

    this.handleKitInput(live);
    this.tickGlint(dtMs);
    this.combat.tick(dtMs);
    this.combat.handleInput(live, dtMs);
    if (live.pressed.has('interact')) this.interact();

    // Footsteps.
    this.footstepMs -= dtMs;
    if (p.moving && this.footstepMs <= 0) {
      this.footstepMs = TUNING.stealth.footstepIntervalMs;
      const radius = p.footstepNoiseRadius();
      if (radius > 0) this.emitNoise({ kind: p.sneaking ? 'sneakFootstep' : 'footstep', position: p.pos, radius });
      // Standing corn shakes where he goes.
      const pc = tileOf(p.pos);
      const corn = TUNING.overhaul?.corn;
      if (corn && this.corn.isStanding(this.screen.id, pc.col, pc.row)) {
        this.emitNoise({ kind: 'rustle', position: p.pos, radius: p.sneaking ? corn.sneakRustleRadius : corn.rustleRadius });
      }
    }

    // Puzzles.
    for (const { puzzle } of this.pushPuzzlesHere()) puzzle.update(dtMs, p.pos, live.move);
    for (const { puzzle } of this.sheepPuzzlesHere()) puzzle.update(dtMs, p.pos);
    for (const { puzzle } of this.slidePuzzlesHere()) puzzle.update(dtMs);
    for (const { puzzle } of this.gravityHere()) puzzle.update(dtMs, p.pos, live.move);
    this.tickHazards(dtMs);

    // Actors, projectiles.
    for (const a of this.actorList) a.tick(dtMs, this);
    this.tickBossBreaks(dtMs);
    this.tickProjectiles(dtMs);

    // Sections.
    for (const f of this.fights.values()) f.tick(dtMs);
    for (const b of this.bosses.values()) b.tick(dtMs);
    for (const [id, d] of this.directors) {
      const boss = this.bosses.get(id);
      if (!boss) continue;
      d.shelves?.tick(dtMs, boss.phase, boss.active && !boss.suspended);
      d.combine?.tick(dtMs, boss);
      d.mascots?.tick(dtMs, boss, boss.active && !boss.suspended);
      d.pruitt2?.tick(dtMs, boss, boss.active && !boss.suspended);
      d.lockdown?.tick(dtMs, boss, boss.active && !boss.suspended);
      d.administrator?.tick(dtMs, boss, boss.active && !boss.suspended);
    }
    for (const { puzzle } of this.mazePuzzlesHere()) puzzle.update(p.pos);
    // Act Natural is a move now (`moves.ts`); tall corn hides him without it.
    const pt = tileOf(p.pos);
    const inCorn = this.corn.isStanding(this.screen.id, pt.col, pt.row);
    const hidden = this.combat.hidden || actingNatural(this.hidingPropsHere(), p.pos, p.stillMs, false) || (inCorn && p.stillMs >= TUNING.stealth.actNaturalStillMs);
    for (const { runner, placement } of this.stealthHere()) {
      if (!placement) continue;
      if (!runner.isFinished && !runner.alarmRaised && placement.startArea !== undefined && rectContains(placement.startArea, p.pos)) this.startStealth(runner);
      // Thermal masts (chapter 8) see him at Bit much or worse while he is out in the sun.
      runner.tick(dtMs, { pos: p.pos, hidden, running: p.moving && !p.sneaking, thermalVisible: p.level >= 3 && p.meter.inSun });
      if (runner.active && rectContains(placement.exitArea, p.pos)) runner.finish();
    }

    this.checkAreas();
    this.checkPickups();
    this.checkWeaponPickups();
    this.script.onUpdate?.(dtMs);

    // Myko.
    const combat = this.anyCombatOrStealthActive();
    this.myko.standPoint = combat ? this.activeEntrance() : this.myko.standPoint;
    const inputActive = live.move.x !== 0 || live.move.y !== 0 || live.pressed.size > 0;
    this.myko.update(dtMs, this.deduction?.isOpen === true ? lockedInput(input) : input, { combatOrStealth: combat, inputActive });
    this.tryPayOwedMove();
    if (p.meter.returnReason) this.handleReturn();
  }

  /** The meter reached 0 or the floor: back to the bar (`barFlow.ts`). */
  private handleReturn(): void {
    const reason = this.player.meter.returnReason;
    if (!reason) return;
    this.returnWaitMs = 0;
    this.endForcedLurch();
    this.cancelHazards();
    this.barFlow.beginReturn(reason);
    const hurryMs = TUNING.ui?.floorReturn.hurryMs;
    if (reason === 'floor' && this.barFlow.pending && hurryMs !== undefined) {
      // Myko hurries to Andrew's side during the fall; he arrives within the UI's hurry stage.
      const a = this.barFlow.pending.andrew;
      const g = this.screen.grid;
      const bounds = { width: g.widthTiles * TILE, height: g.heightTiles * TILE };
      const target = {
        x: Math.min(Math.max(a.x - TUNING.myko.followDistance, 0), bounds.width),
        y: Math.min(Math.max(a.y, 0), bounds.height),
      };
      this.myko.hurryToWithin(target, hurryMs, bounds);
    }
  }

  /** A return is waiting for `completeBarReturn`: the reason and where Andrew fell, else null. The view plays `fall` for `floor`. */
  get barReturning(): { readonly reason: BarReturnReason; readonly andrew: Vec2 } | null {
    return this.barFlow.pending;
  }

  /**
   * The scene is at black: move Andrew to the bar, keep finished sections, reset the one under way, top up
   * bottles, offer the hot drink again, release Myko, and emit `bar:returned`. Does nothing if no return is waiting.
   */
  completeBarReturn(): void {
    if (!this.barFlow.pending) return;
    // Release Myko first, so a chapter script's `onBarReturn` can place him again.
    this.setMykoScripted(null);
    const reason = this.barFlow.completeReturn();
    if (!reason) return;
    // Myko says his piece once Andrew is back in the bar (silent at 0, and the meter is reset by now).
    this.mykoVoice.trigger({ kind: 'barReturn', reason }, this.player.meter.value);
    for (const fn of [...this.returnSettledListeners]) fn();
  }

  private readonly returnSettledListeners = new Set<() => void>();

  /**
   * Called at the end of `completeBarReturn`, after the bar script's `onBarReturn` has run, so the world is final.
   * The scene draws it at once (it may be paused). Returns an unsubscribe function.
   */
  onBarReturnSettled(fn: () => void): () => void {
    this.returnSettledListeners.add(fn);
    return () => this.returnSettledListeners.delete(fn);
  }

  /** The latest return to the bar, for the scene that plays the fade or the fall. Null before the first. */
  get lastBarReturn(): BarReturnRecord | null {
    return this.barFlow.last;
  }

  /** Where the chapter's bar is: its `bar`, or the chapter's start point while none is defined. */
  private barLocation(): BarLocation {
    const bar = this.module.def.bar;
    if (bar) return { screenId: bar.screenId, position: bar.arrival };
    const screen = this.layout(this.module.def.startScreenId) ?? this.module.screens[0];
    return { screenId: screen?.id ?? this.module.def.startScreenId, position: screen?.playerStart ?? { x: 0, y: 0 } };
  }

  private barFlowHost(): BarFlowHost {
    return {
      bus: this.bus,
      player: this.player,
      chapter: this.chapter,
      completedSectionIds: () => [...this.completed],
      underWaySectionId: () => this.underWaySectionId(),
      resetSection: (id) => this.resetSection(id),
      clearWorld: () => {
        this.actorList = [];
        this.loneEnemies.clear();
        this.projectileList = [];
        this.defeatedEmitted.clear();
        this.refusedNear.clear();
        this.fx.length = 0;
        this.combat.reset();
      },
      barLocation: () => this.barLocation(),
      barBeer: () => barBeerOf(this.module.def),
      placeAt: (where) => this.loadScreen(where.screenId, where.position),
      restoreSaved: () => {
        // The time of day is not undone by a return to the bar: sunset stays.
        const keep = { [FLAG_HEAT_OFF]: this.flags[FLAG_HEAT_OFF], [FLAG_NIGHT]: this.flags[FLAG_NIGHT] };
        for (const k of Object.keys(this.flags)) delete this.flags[k];
        Object.assign(this.flags, this.savedFlags);
        for (const [k, v] of Object.entries(keep)) if (v !== undefined) this.flags[k] = v;
      },
      scriptReturned: (reason, resetSectionId) => this.script.onBarReturn?.({ reason, resetSectionId }),
    };
  }

  /** The unfinished section Andrew is in the middle of, if any. */
  private underWaySectionId(): SectionId | null {
    for (const [id, f] of this.fights) if (f.active) return id;
    for (const [id, b] of this.bosses) if (b.active) return id;
    for (const [id, s] of this.stealthRunners) if (s.runner.active) return id;
    const cur = this.currentSection ? this.sections.get(this.currentSection) : undefined;
    return cur && !cur.completable.isComplete() ? cur.completable.sectionId : null;
  }

  /** Puts one unfinished section back at its start. */
  private resetSection(id: SectionId): void {
    if (this.currentSection === id) this.currentSection = null;
    if (id.endsWith('.alarm')) {
      // Caught: the alarm fight goes and its stealth section starts over.
      const stealthId = id.slice(0, -'.alarm'.length) as StealthSectionId;
      this.fights.delete(id as AlarmFightId);
      this.sections.delete(id as AlarmFightId);
      this.stealthRunners.get(stealthId)?.runner.reset();
      this.applyJunctions();
      return;
    }
    this.fights.get(id as FightSectionId)?.reset();
    this.bosses.get(id as BossId)?.reset();
    const dirs = this.directors.get(id as BossId);
    if (dirs) {
      dirs.shelves?.reset();
      dirs.combine?.reset();
      dirs.mascots?.reset();
      dirs.pruitt2?.reset();
      dirs.lockdown?.reset();
      dirs.administrator?.reset();
      if (dirs.combine) this.regrowCorn();
    }
    this.stealthRunners.get(id as StealthSectionId)?.runner.reset();
    this.applyJunctions();
    // An unsolved push or sheep puzzle keeps the state Andrew left it in (docs/chapters/README.md).
  }

  /** A way back that Andrew opened from the far side (a clean-run reward). */
  shortcutOpened(id: string): boolean {
    return this.openedShortcuts.includes(id);
  }

  kit(): Kit {
    return this.player.kit;
  }

  setMeterHidden(hidden: boolean): void {
    this.player.setMeterHidden(hidden);
  }

  holdDrain(held: boolean): void {
    this.player.holdDrain(held);
  }

  /** Take the free hot drink on offer in the bar. DESIGN.md 7.1 "The hot drink". */
  takeHotDrink(id: HotDrinkId): boolean {
    return this.barFlow.takeHotDrink(id);
  }

  /** The bar is offering a free hot drink and Andrew is carrying none. */
  hotDrinkOffered(): boolean {
    return this.barFlow.hotDrinkOffer.available && this.player.kit.hotDrink === null;
  }

  // -------------------------------------------------------------------------
  // Combat world
  // -------------------------------------------------------------------------

  playerPosition(): Vec2 {
    return this.player.pos;
  }

  playerTargetable(): boolean {
    return !this.player.returning && !this.player.protected_ && !this.dialogue.blocking;
  }

  hitPlayer(hit: Omit<HitInfo, 'targetInstanceId'>): boolean {
    return this.player.takeHit({ ...hit, targetInstanceId: this.player.instanceId });
  }

  spawnProjectile(spawn: ProjectileSpawn): void {
    this.projectileList.push(spawnProjectile(spawn));
  }

  extraBlocked(col: number, row: number): boolean {
    for (const { puzzle } of this.pushPuzzlesHere()) if (puzzle.occupies(col, row)) return true;
    for (const { puzzle } of this.sheepPuzzlesHere()) if (puzzle.blocks(col, row)) return true;
    for (const { puzzle } of this.slidePuzzlesHere()) if (puzzle.blocks(col, row)) return true;
    for (const { puzzle } of this.gravityHere()) if (puzzle.occupies(col, row)) return true;
    for (const d of this.directorsHere()) if (d.lockdown?.blocks(col, row)) return true;
    return false;
  }

  sheepPuzzlesHere(): { puzzle: SheepPuzzle; placement: SheepPuzzlePlacement }[] {
    const out: { puzzle: SheepPuzzle; placement: SheepPuzzlePlacement }[] = [];
    for (const p of this.module.sheepPuzzles ?? []) {
      if (p.screenId !== this.screen.id) continue;
      const e = this.sections.get(p.sectionId);
      if (e && e.completable instanceof SheepPuzzle) out.push({ puzzle: e.completable, placement: p });
    }
    return out;
  }

  /** Pruitt's shelf directors on the current screen, for drawing (`laneStates()`). */
  shelfDirectorsHere(): ShelfDirector[] {
    return this.directorsHere().flatMap((d) => (d.shelves ? [d.shelves] : []));
  }

  /** The combine directors on the current screen, for drawing (`plumeLane()`, `baleShadow()`, `state`). */
  combineDirectorsHere(): CombineDirector[] {
    return this.directorsHere().flatMap((d) => (d.combine ? [d.combine] : []));
  }

  /** The mascot boss on the current screen (director, runner), for drawing. */
  mascotsHere(): { director: MascotDirector; boss: BossRunner | null }[] {
    return this.directorsHere().flatMap((d) => (d.mascots ? [{ director: d.mascots, boss: this.bosses.get(d.mascots.bossId) ?? null }] : []));
  }

  /** Pruitt round two on the current screen (director, runner), for drawing. */
  pruittHere(): { director: Pruitt2Director; boss: BossRunner | null }[] {
    return this.directorsHere().flatMap((d) => (d.pruitt2 ? [{ director: d.pruitt2, boss: this.bosses.get(d.pruitt2.bossId) ?? null }] : []));
  }

  /** The lockdown on the current screen (director, runner), for drawing. */
  lockdownHere(): { director: LockdownDirector; boss: BossRunner | null }[] {
    return this.directorsHere().flatMap((d) => (d.lockdown ? [{ director: d.lockdown, boss: this.bosses.get(d.lockdown.bossId) ?? null }] : []));
  }

  /** The Administrator on the current screen (director, runner), for drawing. */
  administratorHere(): { director: AdministratorDirector; boss: BossRunner | null }[] {
    return this.directorsHere().flatMap((d) => (d.administrator ? [{ director: d.administrator, boss: this.bosses.get(d.administrator.bossId) ?? null }] : []));
  }

  /** The gravity puzzles with rooms on the current screen, for drawing and input. */
  gravityHere(): { puzzle: GravityPuzzle; placement: import('../core/chapter').GravityPlacement }[] {
    const out: { puzzle: GravityPuzzle; placement: import('../core/chapter').GravityPlacement }[] = [];
    for (const p of this.module.gravityPuzzles ?? []) {
      if (p.screenId !== this.screen.id) continue;
      const e = this.sections.get(p.sectionId);
      if (e && e.completable instanceof GravityPuzzle) out.push({ puzzle: e.completable, placement: p });
    }
    return out;
  }

  /** The broadcast console on the current screen, for drawing. */
  broadcastHere(): { puzzle: BroadcastPuzzle; placement: import('../core/chapter').BroadcastPlacement }[] {
    const out: { puzzle: BroadcastPuzzle; placement: import('../core/chapter').BroadcastPlacement }[] = [];
    for (const p of this.module.broadcastPuzzles ?? []) {
      if (p.screenId !== this.screen.id) continue;
      const e = this.sections.get(p.sectionId);
      if (e && e.completable instanceof BroadcastPuzzle) out.push({ puzzle: e.completable, placement: p });
    }
    return out;
  }

  /** Weapons lying on the current screen, for drawing. */
  weaponPickupsHere(): readonly { readonly id: string; readonly weaponId: WeaponId; readonly position: Vec2 }[] {
    return this.weaponPickups.filter((w) => w.screenId === this.screen.id);
  }

  /** The card on view of a scripted card sequence, or null. */
  activeCard(): { readonly index: number; readonly total: number; readonly card: EpilogueCard } | null {
    const c = this.cardSeq?.current();
    return this.cardSeq && c ? { index: this.cardSeq.index, total: this.cardSeq.cards.length, card: c } : null;
  }

  /** A key press during a card sequence: skips the card on view. */
  advanceCard(): void {
    this.cardSeq?.advance();
  }

  /** The screen-white overlay (0..1) while Pruitt's flashbang has caught Andrew. */
  whiteoutAlpha(): number {
    let a = 0;
    for (const d of this.directors.values()) a = Math.max(a, d.pruitt2?.whiteoutAlpha() ?? 0);
    return a;
  }

  /** Parked trucks whose headlights are on now (a fight with `headlights` under way on this screen), for drawing and the dart speed. */
  headlightsHere(): readonly import('../core/chapter').HeadlightPlacement[] {
    return this.module.fights.filter((f) => f.headlights !== undefined && f.screenId === this.screen.id && this.fights.get(f.sectionId)?.active === true).map((f) => f.headlights as import('../core/chapter').HeadlightPlacement);
  }

  /** Shade areas on the current screen (static and moving), for drawing. */
  shadeAreasHere(): readonly ShadeRect[] {
    return this.shade.areas(this.screen.id);
  }

  tellsHere(): readonly TellsPuzzle[] {
    return (this.module.tellsPuzzles ?? []).flatMap((p) => {
      const e = this.sections.get(p.sectionId);
      return e && e.completable instanceof TellsPuzzle ? [e.completable] : [];
    });
  }

  junctionsHere(): readonly JunctionPuzzle[] {
    return (this.module.junctionPuzzles ?? []).flatMap((p) => {
      const e = this.sections.get(p.sectionId);
      return e && e.completable instanceof JunctionPuzzle ? [e.completable] : [];
    });
  }

  private directorsHere(): Directors[] {
    const out: Directors[] = [];
    for (const [id, d] of this.directors) {
      if (this.module.bosses.find((b) => b.bossId === id)?.screenId === this.screen.id) out.push(d);
    }
    return out;
  }

  mazePuzzlesHere(): { puzzle: MazePuzzle; placement: import('./maze').MazePuzzlePlacement }[] {
    const out: { puzzle: MazePuzzle; placement: import('./maze').MazePuzzlePlacement }[] = [];
    for (const p of this.module.mazePuzzles ?? []) {
      if (p.screenId !== this.screen.id) continue;
      const e = this.sections.get(p.sectionId);
      if (e && e.completable instanceof MazePuzzle) out.push({ puzzle: e.completable, placement: p });
    }
    return out;
  }

  slidePuzzlesHere(): { puzzle: SlidePuzzle; placement: SlidePuzzlePlacement }[] {
    const out: { puzzle: SlidePuzzle; placement: SlidePuzzlePlacement }[] = [];
    for (const p of this.module.slidePuzzles ?? []) {
      if (p.screenId !== this.screen.id) continue;
      const e = this.sections.get(p.sectionId);
      if (e && e.completable instanceof SlidePuzzle) out.push({ puzzle: e.completable, placement: p });
    }
    return out;
  }

  /** Tiles only enemies cannot enter (`PropPlacement.blocksEnemies`). */
  enemyBlocked(col: number, row: number): boolean {
    return this.dressing.blocksEnemiesAt(this.screen.id, col, row);
  }

  /** Andrew's speed factor where he stands: slow ground (`PropPlacement.slows`) or normal. */
  private groundSpeed(): number {
    const t = tileOf(this.player.pos);
    return this.dressing.slowsAt(this.screen.id, t.col, t.row) ? (TUNING.overhaul?.slowGroundMultiplier ?? 1) : 1;
  }

  actors(): readonly EnemyActor[] {
    return this.actorList;
  }

  spawnEnemy(enemyId: EnemyId, pos: Vec2): EnemyActor {
    const actor = new EnemyActor(enemyId, statsFromDef(TUNING.enemies[enemyId]), pos, (attackId) => ({ kind: 'enemy', enemyId, attackId }), this.rng);
    this.actorList.push(actor);
    return actor;
  }

  spawnLoneEnemy(enemyId: EnemyId, position: Vec2, opts?: LoneEnemyOptions): LoneEnemyHandle {
    return this.loneEnemies.add(this.spawnEnemy(enemyId, position), opts);
  }

  spawnBossBody(bossId: BossId, stats: ActorStats, pos: Vec2): EnemyActor {
    const actor = new EnemyActor(null, stats, pos, (attackId) => ({ kind: 'boss', bossId, attackId }), this.rng);
    this.actorList.push(actor);
    return actor;
  }

  defeat(actor: EnemyActor, by: CompletionSource): void {
    if (!actor.down) actor.knockDown();
    this.emitDefeated(actor, by);
  }

  playerIn(area: AreaRect): boolean {
    return rectContains(area, this.player.pos);
  }

  // -------------------------------------------------------------------------
  // SectionHost
  // -------------------------------------------------------------------------

  grantReward(reward: Reward | undefined): void {
    if (!reward) return;
    for (const item of reward.pickups ?? []) this.give(item);
    for (const id of reward.evidenceIds ?? []) this.addEvidence(id);
    for (const id of reward.abilityIds ?? []) this.unlockAbility(id);
    for (const id of reward.moveIds ?? []) this.learnMove(id);
    for (const id of reward.weaponIds ?? []) this.gainWeapon(id);
  }

  markCompleted(sectionId: SectionId, kind: SectionKind, by: CompletionSource): void {
    if (this.completed.has(sectionId)) return;
    this.completed.add(sectionId);
    if (this.currentSection === sectionId) this.currentSection = null;
    this.bus.emit(GameEvents.SectionCompleted, { sectionId, kind, by });
    this.save('sectionDone');
    if (sectionId.endsWith('.alarm')) {
      const stealthId = sectionId.slice(0, -'.alarm'.length) as StealthSectionId;
      this.stealthRunners.get(stealthId)?.runner.resolve();
      this.markCompleted(stealthId, 'stealth', by);
    }
    this.script.onSectionCompleted?.(sectionId, by);
  }

  // -------------------------------------------------------------------------
  // ChapterContext
  // -------------------------------------------------------------------------

  say(id: DialogueId, opts?: { readonly repeat?: boolean }): Promise<void> {
    return this.dialogue.play(id, opts);
  }

  setObjective(id: ObjectiveId | null): void {
    this.objectiveId = id;
    if (id) this.bus.emit(GameEvents.ObjectiveChanged, { objectiveId: id });
  }

  objective(): ObjectiveId | null {
    return this.objectiveId;
  }

  markObjective(mark: ObjectiveMark): void {
    if (!this.marks.has(mark.id)) this.marks.set(mark.id, { mark });
  }

  completeMark(id: string): void {
    const entry = this.marks.get(id);
    if (!entry || this.markDone(entry)) return;
    this.flags[this.markKey(id)] = true;
    this.glint.forget(id);
  }

  /** The marks not yet finished, on every screen, in the order they were declared. */
  objectiveMarks(): readonly ObjectiveMark[] {
    return [...this.marks.values()].filter((e) => !this.markDone(e)).map((e) => e.mark);
  }

  /**
   * The area text for the H hint: the current objective's `areaTextId`, else the first unfinished mark that has
   * one. Null if the chapter names none.
   */
  hintArea(): TextId | null {
    return this.objectiveDef()?.areaTextId ?? this.objectiveMarks().find((m) => m.areaTextId !== undefined)?.areaTextId ?? null;
  }

  private markKey(id: string): string {
    return `c${this.chapter}.glintDone.${id}`;
  }

  private markDone(e: MarkEntry): boolean {
    if (this.flags[this.markKey(e.mark.id)] === true) return true;
    if (e.evidenceId !== undefined && this.casebook.hasEvidence(e.evidenceId)) return true;
    if (e.propKey !== undefined) {
      const prop = this.dressing.prop(e.propKey);
      if (prop && (!prop.visible || prop.broken)) return true;
    }
    return false;
  }

  /** Examinables and props the chapter flagged as objectives. */
  private collectMarks(): void {
    for (const e of this.module.examinables) {
      if (!e.objective) continue;
      this.marks.set(e.id, { mark: { id: e.id, screenId: e.screenId, position: e.position, ...(e.areaTextId ? { areaTextId: e.areaTextId } : {}), ...(e.faint ? { faint: true as const } : {}) }, ...(e.evidenceId ? { evidenceId: e.evidenceId } : {}) });
    }
    for (const screen of this.module.screens) {
      for (const prop of this.dressing.propsOn(screen.id)) {
        if (!prop.def.objective) continue;
        const id = `prop.${prop.key}`;
        const areaTextId = prop.def.areaTextId;
        this.marks.set(id, { mark: { id, screenId: screen.id, position: this.propCentre(prop), ...(areaTextId ? { areaTextId } : {}), ...(prop.def.faint ? { faint: true as const } : {}) }, propKey: prop.key });
      }
    }
  }

  private tickGlint(dtMs: number): void {
    const here: ObjectiveMark[] = [];
    for (const e of this.marks.values()) if (e.mark.screenId === this.screen.id && !this.markDone(e)) here.push(e.mark);
    for (const pulse of this.glint.tick(dtMs, here, this.player.pos)) this.bus.emit(GameEvents.ObjectiveGlint, pulse);
  }

  flag(key: string): ChapterFlagValue | undefined {
    return this.flags[key];
  }

  setFlag(key: string, value: ChapterFlagValue): void {
    this.flags[key] = value;
  }

  isComplete(sectionId: SectionId): boolean {
    return this.completed.has(sectionId);
  }

  startSection(sectionId: SectionId): void {
    if (this.completed.has(sectionId)) return;
    const stealth = this.stealthRunners.get(sectionId as StealthSectionId);
    if (stealth) {
      this.startStealth(stealth.runner);
      return;
    }
    const e = this.sections.get(sectionId as CompletableSectionId);
    if (!e) {
      const kind = this.module.def.sections.find((s) => s.id === sectionId)?.kind;
      if (kind) this.bus.emit(GameEvents.SectionStarted, { sectionId, kind });
      return;
    }
    this.currentSection = e.completable.sectionId;
    e.start();
    this.script.onSectionStarted?.(sectionId);
  }

  completeSection(sectionId: SectionId, by: CompletionSource = 'player'): void {
    const e = this.sections.get(sectionId as CompletableSectionId);
    if (e) {
      const c = e.completable;
      if (c instanceof ScriptedCompletable) c.complete(by);
      else if (c instanceof BossRunner) c.complete(by);
      else c.completeNow(by);
      return;
    }
    const stealth = this.stealthRunners.get(sectionId as StealthSectionId);
    if (stealth) {
      stealth.runner.resolve();
      this.markCompleted(sectionId, 'stealth', by);
      return;
    }
    const kind = this.module.def.sections.find((s) => s.id === sectionId)?.kind ?? 'explore';
    this.markCompleted(sectionId, kind, by);
  }

  registerCompletable(
    sectionId: CompletableSectionId,
    kind: CompletableKind,
    solve: (source: CompletionSource) => void,
    reward?: Reward,
  ): ScriptedCompletableHandle {
    const c = new ScriptedCompletable(sectionId, kind, this, solve, reward ?? this.sectionReward(sectionId));
    if (this.completed.has(sectionId)) c.restoreComplete();
    this.sections.set(sectionId, {
      completable: c,
      kind,
      screenId: null,
      entrance: null,
      start: () => this.bus.emit(GameEvents.SectionStarted, { sectionId, kind }),
    });
    return {
      sectionId,
      isComplete: () => c.isComplete(),
      complete: (by = 'player') => c.complete(by),
      start: () => this.startSection(sectionId),
    };
  }

  registerPuzzle(puzzle: PuzzleBase): void {
    if (this.completed.has(puzzle.sectionId)) puzzle.restoreComplete();
    this.sections.set(puzzle.sectionId, {
      completable: puzzle,
      kind: 'puzzle',
      screenId: null,
      entrance: null,
      start: () => puzzle.start(),
    });
  }

  boss(id: BossId): BossRunner | null {
    return this.bosses.get(id) ?? null;
  }

  fight(id: FightSectionId): FightRunner | null {
    return this.fights.get(id) ?? null;
  }

  stealth(id: StealthSectionId): StealthControl | null {
    const s = this.stealthRunners.get(id);
    if (!s) return null;
    const runner = s.runner;
    return {
      alarm: () => runner.alarm(),
      setHazardEnabled: (h, on) => runner.setHazardEnabled(h, on),
      finish: () => runner.finish(),
      get alarmRaised() {
        return runner.alarmRaised;
      },
    };
  }

  openDeduction(): void {
    if (!this.deduction || this.deduction.isComplete()) return;
    this.currentSection = this.deduction.sectionId;
    this.bus.emit(GameEvents.SectionStarted, { sectionId: this.deduction.sectionId, kind: 'deduction' });
    this.deductionStarted = true;
    this.deduction.openBoard();
  }

  redaction(id: PuzzleSectionId): RedactionPuzzle | null {
    const e = this.sections.get(id);
    return e && e.completable instanceof RedactionPuzzle ? e.completable : null;
  }

  collectSheet(id: PuzzleSectionId, sheetId: string): boolean {
    const r = this.redaction(id);
    if (!r || !r.collect(sheetId)) return false;
    this.setFlag(`redaction.${id}`, r.collected().join(','));
    return true;
  }

  openRedaction(id: PuzzleSectionId): void {
    const r = this.redaction(id);
    if (!r || r.isComplete() || !r.allCollected()) return;
    this.currentSection = id;
    r.openScreen();
  }

  /** The lightbox screen waiting for a pick, or null. For the UI. */
  activeRedaction(): RedactionPuzzle | null {
    for (const p of this.module.redactionPuzzles ?? []) {
      const r = this.redaction(p.sectionId);
      if (r?.isOpen) return r;
    }
    return null;
  }

  /** The player picked three sheets. Saves nothing; completion saves as any section. */
  submitRedaction(id: PuzzleSectionId, sheetIds: readonly string[]): import('./redaction').RedactionTry {
    const r = this.redaction(id);
    if (!r) return { correct: false, textId: 'c5.redacted.wrong', refused: true };
    return r.submit(sheetIds);
  }

  closeRedaction(): void {
    this.activeRedaction()?.closeScreen();
  }

  cutCorn(area: PixelRect, screenId: ScreenId = this.screen.id): number {
    const tiles = this.corn.cut(screenId, area);
    if (tiles.length > 0) this.bus.emit(GameEvents.CornCut, { screenId, tiles });
    return tiles.length;
  }

  regrowCorn(screenId: ScreenId = this.screen.id): void {
    const tiles = this.corn.regrow(screenId);
    if (tiles.length > 0) this.bus.emit(GameEvents.CornCut, { screenId, tiles: [] });
  }

  closeDeduction(): void {
    this.deduction?.closeBoard();
  }

  /** Andrew stepped back from an unfinished board (to read the casebook, say): it can be reopened. */
  pendingDeduction(): boolean {
    return this.deduction !== null && this.deductionStarted && !this.deduction.isComplete() && !this.deduction.isOpen;
  }

  /** Back to the board he stepped away from. Not while a scene is playing. */
  reopenDeduction(): void {
    if (this.pendingDeduction() && !this.sceneBlocking) this.openDeduction();
  }

  onFlockSettled(puzzleId: SectionId, fn: (pen: string) => void): () => void {
    return this.bus.on(GameEvents.SheepFlockSettled, (e) => {
      if (e.puzzleId === puzzleId) fn(e.pen);
    });
  }

  oweMove(moveId: MoveId, sceneId: DialogueId): void {
    if (this.player.kit.moves.includes(moveId) || this.owedMoves.some((o) => o.moveId === moveId)) return;
    this.owedMoves.push({ moveId, sceneId, chapter: this.chapter });
  }

  movesOwed(): readonly MoveId[] {
    return this.owedMoves.map((o) => o.moveId);
  }

  /**
   * Andrew has reached Bit much: a lesson owed from an earlier chapter is now due. It plays at once if nothing else
   * is going on, otherwise when the fight, stealth section, set piece, Myko call or dialogue scene ends (`tryPayOwedMove`),
   * whatever his level by then.
   */
  private payOwedMove(level: DrunkLevel): void {
    if (level < BIT_MUCH_LEVEL || this.ended) return;
    this.owedDue = true;
    this.tryPayOwedMove();
  }

  private tryPayOwedMove(): void {
    if (!this.owedDue || this.owedPlaying || this.ended) return;
    const owed = this.owedMoves.find((o) => o.chapter < this.chapter);
    if (!owed) {
      this.owedDue = false;
      return;
    }
    if (this.player.kit.moves.includes(owed.moveId)) {
      this.owedMoves = this.owedMoves.filter((o) => o !== owed);
      return;
    }
    const busy =
      this.anyCombatOrStealthActive() ||
      this.myko.callInProgress ||
      this.dialogue.blocking ||
      this.deduction?.isOpen === true ||
      this.forced !== null ||
      this.player.meter.returnReason !== null;
    if (busy) return;
    this.owedDue = false;
    this.owedPlaying = true;
    void this.say(owed.sceneId).then(() => {
      this.owedPlaying = false;
      if (this.ended || !this.owedMoves.includes(owed)) return;
      this.owedMoves = this.owedMoves.filter((o) => o !== owed);
      this.learnMove(owed.moveId);
      const slot = this.player.kit.slots.specials.indexOf(owed.moveId);
      this.bus.emit(GameEvents.MoveTaughtByFallback, { moveId: owed.moveId, slot: slot < 0 ? null : ((slot + 1) as SpecialSlotIndex) });
    });
  }

  forceLurch(dir: Facing | number, opts: { readonly distance?: number; readonly durationMs?: number } = {}): Promise<void> {
    if (this.forced) return this.forced.promise;
    const p = this.player;
    const effect = (TUNING.overhaul?.moves.stumble.effect ?? { kind: 'lurch', distance: 88, width: 20 }) as { distance?: number; width?: number };
    const distancepx = opts.distance ?? effect.distance ?? 88;
    p.aimDeg = typeof dir === 'number' ? dir : angleFromFacing(dir);
    p.faceAim();
    // Breakables in the lane go first (as with the move), so what broke no longer stops him.
    this.moveWorldHits('stumble', { kind: 'charge', distance: distancepx, width: effect.width ?? 20 }, true);
    const from = { ...p.pos };
    p.lurch(distancepx, p.aimDeg, this.grid, (c, r) => this.extraBlocked(c, r));
    const to = { ...p.pos };
    p.pos = from;
    let resolve: () => void = () => undefined;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    this.forced = { from, to, elapsedMs: 0, durationMs: Math.max(1, opts.durationMs ?? TUNING.overhaul?.forcedLurchMs ?? 220), resolve, promise };
    return promise;
  }

  lineClear(from: Vec2, to: Vec2, width: number, opts: { readonly ignoreBreakables?: boolean } = {}): boolean {
    const grid = opts.ignoreBreakables ? this.dressing.gridWithoutBreakables(this.screen) : this.grid;
    const npcTiles = new Set(this.dressing.npcsOn(this.screen.id).filter((n) => n.visible).map((n) => `${Math.floor(n.pos.x / TILE)},${Math.floor(n.pos.y / TILE)}`));
    return bandClear(from, to, width, (c, r) => isBlocked(grid, c, r) || this.extraBlocked(c, r) || npcTiles.has(`${c},${r}`));
  }

  sweepHazard(opts: SweepHazardOptions): Promise<void> {
    let resolve: () => void = () => undefined;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    this.hazards.push({ opts, screenId: this.screen.id, elapsedMs: 0, hit: false, moving: false, resolve });
    return promise;
  }

  /** The sweeps under way on the current screen, for drawing: where the shadow lies and where the thing is. */
  sweepsHere(): readonly { readonly opts: SweepHazardOptions; readonly moving: boolean; readonly pos: Vec2 }[] {
    return this.hazards
      .filter((h) => h.screenId === this.screen.id)
      .map((h) => ({ opts: h.opts, moving: h.moving, pos: sweepPos(h) }));
  }

  private cancelHazards(): void {
    const all = this.hazards;
    this.hazards = [];
    for (const h of all) h.resolve();
  }

  private tickHazards(dtMs: number): void {
    if (this.hazards.length === 0) return;
    for (const h of this.hazards) {
      h.elapsedMs += dtMs;
      const o = h.opts;
      if (!h.moving && h.elapsedMs >= o.telegraphMs) {
        h.moving = true;
        this.bus.emit(GameEvents.HazardSwept, { phase: 'moving', frame: o.frame });
      }
      if (!h.moving || h.hit || h.screenId !== this.screen.id || !this.playerTargetable()) continue;
      const head = sweepPos(h);
      const half = o.width / 2 + TUNING.player.bodyWidth / 2;
      const p = this.player.pos;
      if (Math.abs(p.x - head.x) > half || Math.abs(p.y - head.y) > half) continue;
      const away = normalize({ x: p.x - head.x, y: p.y - head.y });
      const dir = away.x === 0 && away.y === 0 ? normalize({ x: o.to.x - o.from.x, y: o.to.y - o.from.y }) : away;
      const landed = this.player.takeHit({
        source: { kind: 'hazard', hazardId: o.frame },
        targetInstanceId: this.player.instanceId,
        amount: 0,
        knockback: scale(dir, o.knockback),
        stunMs: 0,
        holdMs: 0,
        weight: o.weight,
      });
      if (landed) {
        h.hit = true;
        this.bus.emit(GameEvents.HazardSwept, { phase: 'hit', frame: o.frame });
      }
    }
    const done = this.hazards.filter((h) => h.elapsedMs >= h.opts.telegraphMs + h.opts.travelMs);
    if (done.length === 0) return;
    this.hazards = this.hazards.filter((h) => !done.includes(h));
    for (const h of done) h.resolve();
  }

  private tickForcedLurch(dtMs: number): void {
    const f = this.forced;
    if (!f) return;
    f.elapsedMs += dtMs;
    const t = Math.min(1, f.elapsedMs / f.durationMs);
    this.player.pos = { x: f.from.x + (f.to.x - f.from.x) * t, y: f.from.y + (f.to.y - f.from.y) * t };
    if (t >= 1) this.endForcedLurch();
  }

  private endForcedLurch(): void {
    const f = this.forced;
    if (!f) return;
    this.forced = null;
    f.resolve();
  }

  /** A boss body standing against a `bossBreaksAfterMs` prop long enough batters it open. */
  private tickBossBreaks(dtMs: number): void {
    for (const prop of this.dressing.propsOn(this.screen.id)) {
      const ms = prop.def.bossBreaksAfterMs;
      if (ms === undefined) continue;
      if (!prop.visible || prop.broken) {
        this.bossBreakMs.delete(prop.key);
        continue;
      }
      const fp = prop.def.solid ?? { width: 1, height: 1 };
      const rect = { x: (prop.col + (fp.dx ?? 0)) * TILE - TILE, y: (prop.row + (fp.dy ?? 0)) * TILE - TILE, width: (fp.width + 2) * TILE, height: (fp.height + 2) * TILE };
      let hitBy: BossId | null = null;
      for (const b of this.bosses.values()) {
        if (!b.active || b.suspended) continue;
        if (b.allBodies().some((a) => !a.down && !a.frozen && rectContains(rect, a.pos))) hitBy = b.bossId;
      }
      if (hitBy === null) {
        this.bossBreakMs.delete(prop.key);
        continue;
      }
      const total = (this.bossBreakMs.get(prop.key) ?? 0) + dtMs;
      if (total < ms) {
        this.bossBreakMs.set(prop.key, total);
        continue;
      }
      this.bossBreakMs.delete(prop.key);
      this.dressing.setPropVisible(prop.key, false);
      this.bus.emit(GameEvents.PropBrokenByBoss, { propId: prop.key, bossId: hitBy, screenId: this.screen.id });
    }
  }

  /** Learn a move; it goes into its slot if that slot is empty (DESIGN.md 7.7). */
  learnMove(id: MoveId): void {
    this.owedMoves = this.owedMoves.filter((o) => o.moveId !== id);
    const r = learnMove(this.player.kit, id, { autoAssign: true });
    if (!r.learned) return;
    this.player.setKit(r.kit);
    this.bus.emit(GameEvents.MoveLearned, { moveId: r.learned });
    // DESIGN.md 7.6: a move gained saves.
    this.save('move');
  }

  /** Gain a weapon. It is not equipped until Andrew picks it (R or the Tab screen). */
  gainWeapon(id: WeaponId): void {
    const r = gainWeapon(this.player.kit, id);
    if (!r.gained) return;
    this.player.setKit(r.kit);
    this.bus.emit(GameEvents.WeaponGained, { weaponId: r.gained });
    // DESIGN.md 7.6: a weapon gained saves.
    this.save('weapon');
  }

  /** Old chapter scripts name abilities; each is now a move, a weapon or nothing (the fists, the old throw and the old specials that were dropped). */
  unlockAbility(id: AbilityId): void {
    switch (id) {
      case 'hurley':
        this.gainWeapon('hurley');
        break;
      case 'stumble':
      case 'stoutSlam':
      case 'actNatural':
      case 'borrowedGlove':
        this.learnMove(id);
        break;
      default:
        break;
    }
  }

  tabMode(): GameSettings['tabMode'] {
    return this.settings.tabMode;
  }

  /** Tab as toggle or hold (Settings); written with the next save. */
  setTabMode(mode: GameSettings['tabMode']): void {
    this.settings = { ...this.settings, tabMode: mode };
  }

  /** Put a learned move in its slot (the Tab screen). */
  assignMove(slot: SpecialSlotIndex, id: MoveId | null): boolean {
    const r = assignMove(this.player.kit, slot, id);
    if (r.changed) this.player.setKit(r.kit);
    return r.changed;
  }

  /** Equip an owned weapon (the Tab screen). */
  assignWeapon(id: WeaponId): boolean {
    const r = assignWeapon(this.player.kit, id);
    if (r.changed) this.player.setKit(r.kit);
    return r.changed;
  }

  give(item: PickupItem): void {
    const res = takeItem(this.player.kit, item);
    if (res.inert) return;
    this.player.setKit(res.kit);
    // What does not fit is left on the ground, still counted as given (DESIGN.md 7.3).
    if (res.leftover) {
      this.spawnPickup({ id: `drop.${Math.floor(this.clock)}.${this.pickupsLive.size}`, item: res.leftover, screenId: this.screen.id, position: this.player.pos });
    }
  }

  addEvidence(id: EvidenceId): void {
    if (!this.casebook.addEvidence(id, this.chapter)) return;
    // DESIGN.md 7.6: a clue found saves, so a return to the bar (flags go back to the last save) and Continue keep it with the flags that went with it.
    this.save('clue');
    if (this.module.clueCommentPool) this.myko.comment('clue', this.module.clueCommentPool);
  }

  goToScreen(screenId: ScreenId, spawn: Vec2): void {
    this.loadScreen(screenId, spawn);
  }

  currentScreen(): ScreenId {
    return this.screen.id;
  }

  setExitLocked(exitId: string, locked: boolean): void {
    this.exitLocks.set(exitId, locked);
  }

  setHeatActive(active: boolean): void {
    if (this.heatActive() === active) return;
    this.setFlag(FLAG_HEAT_OFF, !active);
    this.bus.emit(GameEvents.HeatSwitched, { active });
  }

  heatActive(): boolean {
    return this.flags[FLAG_HEAT_OFF] !== true;
  }

  heat(): HeatState {
    return { active: this.heatActive(), sunnyScreen: this.screenInSun, inSun: this.player.meter.inSun };
  }

  setShadeArea(id: string, area: AreaRect | null, screenId: ScreenId = this.screen.id): void {
    this.shade.set(id, screenId, area);
  }

  sunset(): void {
    if (this.isNight()) return;
    this.setFlag(FLAG_NIGHT, true);
    this.setHeatActive(false);
    this.applyNight();
  }

  isNight(): boolean {
    return this.flags[FLAG_NIGHT] === true;
  }

  /** Every screen takes its `nightAmbient` (or the default tint). */
  private applyNight(): void {
    const d = TUNING.overhaul?.sunsetAmbient;
    for (const sc of this.module.screens) {
      const ambient: ScreenAmbient | null = sc.nightAmbient ?? (d ? { tint: d.tint, strength: d.strength } : null);
      this.dressing.setAmbient(sc.id, ambient);
    }
  }

  tells(id: PuzzleSectionId): TellsPuzzle | null {
    const e = this.sections.get(id);
    return e && e.completable instanceof TellsPuzzle ? e.completable : null;
  }

  examineFigure(id: PuzzleSectionId, figureId: string): boolean {
    const t = this.tells(id);
    if (!t || t.isComplete() || !t.examine(figureId)) return false;
    this.setFlag(flagTells(id), t.examined().join(','));
    return true;
  }

  openTells(id: PuzzleSectionId): boolean {
    const t = this.tells(id);
    if (!t || !t.openScreen()) return false;
    this.currentSection = id;
    return true;
  }

  /** The accuse screen waiting for three names, or null. For the UI. */
  activeTells(): TellsPuzzle | null {
    return this.tellsHere().find((t) => t.isOpen) ?? null;
  }

  submitTells(id: PuzzleSectionId, figureIds: readonly string[]): import('./tells').TellsTry {
    const t = this.tells(id);
    if (!t) return { correct: false, textId: '', refused: true };
    return t.submit(figureIds);
  }

  closeTells(): void {
    this.activeTells()?.closeScreen();
  }

  junctions(id: PuzzleSectionId): JunctionPuzzle | null {
    const e = this.sections.get(id);
    return e && e.completable instanceof JunctionPuzzle ? e.completable : null;
  }

  gravity(id: PuzzleSectionId): GravityPuzzle | null {
    const e = this.sections.get(id);
    return e && e.completable instanceof GravityPuzzle ? e.completable : null;
  }

  broadcast(id: PuzzleSectionId): BroadcastPuzzle | null {
    const e = this.sections.get(id);
    return e && e.completable instanceof BroadcastPuzzle ? e.completable : null;
  }

  lockdown(bossId: BossId): LockdownDirector | null {
    return this.directors.get(bossId)?.lockdown ?? null;
  }

  administrator(bossId: BossId): AdministratorDirector | null {
    return this.directors.get(bossId)?.administrator ?? null;
  }

  hasGlove(): boolean {
    return this.player.kit.moves.includes('borrowedGlove');
  }

  /** E or the Glove at a gravity switch: everything loose in the room slides; Andrew too, along `forced`. */
  private workGravitySwitch(puzzle: GravityPuzzle, examinableId: string, viaGlove: boolean): void {
    if (this.forced) return;
    const pull = puzzle.pull(examinableId, tileOf(this.player.pos), viaGlove);
    if (pull && pull.andrewMoved) this.slidePlayerTo(tileCentre(pull.andrewTo), pull.durationMs);
  }

  /** Andrew is carried to `to` over `durationMs` (his controls are held meanwhile). */
  private slidePlayerTo(to: Vec2, durationMs: number): void {
    if (this.forced) return;
    let resolve: () => void = () => undefined;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    this.forced = { from: { ...this.player.pos }, to, elapsedMs: 0, durationMs: Math.max(1, durationMs), resolve, promise };
  }

  spawnWeaponPickup(weaponId: WeaponId, position: Vec2, screenId: ScreenId = this.screen.id): void {
    if (this.player.kit.weapons.includes(weaponId)) return;
    const id = 'weapon.' + weaponId;
    this.weaponPickups = [...this.weaponPickups.filter((w) => w.id !== id), { id, weaponId, screenId, position }];
  }

  private checkWeaponPickups(): void {
    if (this.weaponPickups.length === 0) return;
    const radius = TUNING.investigation.interactRadius;
    for (const w of this.weaponPickups) {
      if (w.screenId !== this.screen.id || distance(w.position, this.player.pos) > radius) continue;
      this.weaponPickups = this.weaponPickups.filter((x) => x !== w);
      this.gainWeapon(w.weaponId);
    }
  }

  mykoCallsUsed(): number {
    return this.calls.length;
  }

  playCards(cards: readonly EpilogueCard[]): Promise<void> {
    if (this.cardSeq) return this.cardSeq.done;
    const seq = new CardSequence(cards, { bus: this.bus, say: (id) => this.say(id, { repeat: true }) });
    this.cardSeq = seq;
    seq.start();
    return seq.done;
  }

  sitDown(pos: Vec2, facing: Facing): void {
    this.seatedAt = { pos: { ...pos }, facing };
    this.player.pos = { ...pos };
    this.player.facing = facing;
    this.controlsLocked = true;
  }

  standUp(): void {
    if (!this.seatedAt) return;
    this.seatedAt = null;
    this.controlsLocked = false;
  }

  /** Where Andrew sits, or null. For the view. */
  get seated(): { readonly pos: Vec2; readonly facing: Facing } | null {
    return this.seatedAt;
  }

  /** Puts every junction puzzle's lines onto its stealth section's sensors again (after the hazards were rebuilt). */
  private applyJunctions(): void {
    for (const p of this.module.junctionPuzzles ?? []) {
      const e = this.sections.get(p.sectionId);
      if (e && e.completable instanceof JunctionPuzzle) e.completable.apply();
    }
  }

  /** Send Myko to `pos` (or release him with null). `hurry` makes the walk the `hurry` animation. */
  setMykoScripted(pos: Vec2 | null, hurry = false): void {
    if (pos) {
      if (hurry) this.myko.hurryTo(pos);
      else {
        this.myko.mode = 'scripted';
        this.myko.standPoint = pos;
        this.myko.hurrying = false;
      }
    } else {
      this.myko.hurrying = false;
      this.myko.mode = 'following';
      this.myko.standPoint = null;
    }
  }

  setPlayerPosition(pos: Vec2): void {
    this.player.pos = pos;
  }

  /** Where the camera sits relative to Andrew, pixels: the lead set by `setCameraLead`, or (0, 0). The scene eases to it. */
  cameraLead(): Vec2 {
    const d = this.leadDirection;
    const px = TUNING.overhaul?.cameraLeadPx ?? 0;
    if (!d) return { x: 0, y: 0 };
    return { x: d === 'right' ? px : d === 'left' ? -px : 0, y: d === 'down' ? px : d === 'up' ? -px : 0 };
  }

  setCameraLead(direction: Facing | null): void {
    this.leadDirection = direction;
  }

  setControlsLocked(locked: boolean): void {
    this.controlsLocked = locked;
  }

  spawnPickup(def: PickupDef): void {
    this.pickupsLive.set(def.id, { def, item: def.item });
  }

  removePickup(id: string): void {
    this.pickupsLive.delete(id);
  }

  setPropVisible(id: string, visible: boolean): void {
    this.dressing.setPropVisible(id, visible);
  }

  setPropFrame(id: string, frame: string, frames?: readonly string[]): void {
    this.dressing.setPropFrame(id, frame, frames);
  }

  setPropTile(id: string, col: number, row: number): void {
    this.dressing.setPropTile(id, col, row);
  }

  setNpcPosition(id: string, pos: Vec2): void {
    this.dressing.setNpcPosition(id, pos);
  }

  setNpcFacing(id: string, facing: Facing): void {
    this.dressing.setNpcFacing(id, facing);
  }

  setNpcVisible(id: string, visible: boolean): void {
    this.dressing.setNpcVisible(id, visible);
  }

  setAmbient(ambient: ScreenAmbient | null, screenId: ScreenId = this.screen.id): void {
    this.dressing.setAmbient(screenId, ambient);
  }

  after(ms: number, fn: () => void): () => void {
    return this.addTimer(ms, null, fn);
  }

  every(ms: number, fn: () => void): () => void {
    return this.addTimer(ms, Math.max(1, ms), fn);
  }

  /** The UI finished showing a sequence: the call-in blackout, or a dialogue sequence. */
  dialogueFinished(sequenceId: DialogueId): void {
    if (this.myko.blackoutFinished(sequenceId)) return;
    this.dialogue.finished(sequenceId);
  }

  private addTimer(ms: number, everyMs: number | null, fn: () => void): () => void {
    const t = { at: this.clock + Math.max(0, ms), everyMs, fn };
    this.timers.push(t);
    return () => {
      this.timers = this.timers.filter((x) => x !== t);
    };
  }

  private tickTimers(): void {
    for (const t of [...this.timers]) {
      if (this.ended) return;
      if (!this.timers.includes(t) || t.at > this.clock) continue;
      if (t.everyMs === null) this.timers = this.timers.filter((x) => x !== t);
      else t.at += t.everyMs;
      t.fn();
    }
  }

  onMoveHit(area: AreaRect, callback: (hit: MoveHitInfo) => void, screenId: ScreenId = this.screen.id): () => void {
    const hook = { area, screenId, callback };
    this.moveHooks.push(hook);
    return () => {
      this.moveHooks = this.moveHooks.filter((h) => h !== hook);
    };
  }

  onMeleeHit(area: AreaRect, callback: (hit: MeleeHitInfo) => void, screenId: ScreenId = this.screen.id): () => void {
    const hook = { area, screenId, callback };
    this.meleeHooks.push(hook);
    return () => {
      this.meleeHooks = this.meleeHooks.filter((h) => h !== hook);
    };
  }

  completeChapter(): void {
    if (this.ended) return;
    this.ended = true;
    this.dialogue.finishAll();
    this.opts.onChapterComplete(this.player.meterSnapshot().state, this.snapshot());
  }

  // -------------------------------------------------------------------------
  // Debug / QA
  // -------------------------------------------------------------------------

  /** completeNow('debug') on the current section (or resolves active stealth). */
  completeCurrent(): SectionId | null {
    const c = this.currentCompletable();
    if (c) {
      c.completeNow('debug');
      return c.sectionId;
    }
    for (const s of this.stealthRunners.values()) {
      if (s.runner.active) {
        this.completeSection(s.runner.sectionId, 'debug');
        return s.runner.sectionId;
      }
    }
    return null;
  }

  /** Completes every section in beat order, then the chapter. */
  walkChapter(): void {
    this.dialogue.finishAll();
    for (const s of this.module.def.sections) {
      if (this.completed.has(s.id)) continue;
      const e = this.sections.get(s.id as CompletableSectionId);
      if (e) e.completable.completeNow('debug');
      else this.completeSection(s.id, 'debug');
      this.dialogue.finishAll();
    }
    for (const id of this.module.def.evidence) this.casebook.addEvidence(id, this.chapter);
    for (const m of Object.values(TUNING.overhaul?.moves ?? {})) if (m.learnedInChapter === this.chapter) this.learnMove(m.id);
    for (const w of Object.values(TUNING.overhaul?.weapons ?? {})) if (w.gainedInChapter === this.chapter) this.gainWeapon(w.id);
    this.script.debugWalk?.();
    this.dialogue.finishAll();
    this.completeChapter();
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private save(reason: SaveReason): void {
    const state = this.snapshot();
    this.savedFlags = { ...state.flags };
    this.opts.writeSave(state, reason);
    this.bus.emit(GameEvents.SaveWritten, { reason });
  }

  private layout(id: ScreenId): ScreenLayout | undefined {
    return this.module.screens.find((s) => s.id === id);
  }

  private sectionReward(id: SectionId): Reward | undefined {
    return this.module.def.sections.find((s) => s.id === id)?.reward;
  }

  private buildSections(): void {
    const m = this.module;
    for (const f of m.fights) this.addFight(f);
    for (const b of m.bosses) this.addBoss(b);
    for (const p of m.pushPuzzles ?? []) {
      const layout = this.layout(p.screenId);
      if (!layout) continue;
      const grid = this.dressing.gridFor(layout);
      const puzzle = new PushPuzzle(m.def.puzzle.id === p.sectionId ? m.def.puzzle : { id: p.sectionId, chapter: this.chapter, kind: 'push' }, p.layout, grid, this, this.bus, this.sectionReward(p.sectionId));
      if (this.completed.has(p.sectionId)) puzzle.restoreComplete();
      puzzle.onPush = () => this.opts.playEffect?.('push');
      this.sections.set(p.sectionId, { completable: puzzle, kind: 'puzzle', screenId: p.screenId, entrance: null, start: () => puzzle.start() });
    }
    for (const p of m.slidePuzzles ?? []) {
      const def = m.def.puzzle.id === p.sectionId ? m.def.puzzle : { id: p.sectionId, chapter: this.chapter, kind: 'containers' as const };
      const puzzle = new SlidePuzzle(def, p, this, this.bus, this.sectionReward(p.sectionId));
      if (this.completed.has(p.sectionId)) puzzle.restoreComplete();
      this.sections.set(p.sectionId, { completable: puzzle, kind: 'puzzle', screenId: p.screenId, entrance: null, start: () => puzzle.start() });
    }
    for (const p of m.sheepPuzzles ?? []) {
      const layout = this.layout(p.screenId);
      if (!layout) continue;
      const grid = this.dressing.gridFor(layout);
      const def = m.def.puzzle.id === p.sectionId ? m.def.puzzle : { id: p.sectionId, chapter: this.chapter, kind: 'sheepGates' as const };
      const puzzle = new SheepPuzzle(def, p.layout, grid, this, this.bus, this.sectionReward(p.sectionId));
      if (this.completed.has(p.sectionId)) puzzle.restoreComplete();
      puzzle.onGate = () => this.opts.playEffect?.('door');
      // Herding or swinging a gate makes it the current section (so the Myko call finds it, also after a return to the bar).
      puzzle.onUse = () => {
        if (this.currentSection === null && !puzzle.isComplete()) {
          this.currentSection = p.sectionId;
          this.script.onSectionStarted?.(p.sectionId);
        }
      };
      this.sections.set(p.sectionId, { completable: puzzle, kind: 'puzzle', screenId: p.screenId, entrance: null, start: () => puzzle.start() });
    }
    for (const sc of m.screens) if (sc.corn) this.corn.mark(sc.id, sc.corn);
    for (const p of m.mazePuzzles ?? []) {
      const def = m.def.puzzle.id === p.sectionId ? m.def.puzzle : { id: p.sectionId, chapter: this.chapter, kind: 'maze' as const };
      const puzzle = new MazePuzzle(def, p, this, this.bus, this.sectionReward(p.sectionId));
      if (this.completed.has(p.sectionId)) puzzle.restoreComplete();
      this.sections.set(p.sectionId, { completable: puzzle, kind: 'puzzle', screenId: p.screenId, entrance: null, start: () => puzzle.start() });
    }
    for (const p of m.redactionPuzzles ?? []) {
      const def = m.def.puzzle.id === p.sectionId ? m.def.puzzle : { id: p.sectionId, chapter: this.chapter, kind: 'redacted' as const };
      const puzzle = new RedactionPuzzle(def, p.layout, this, this.bus, this.sectionReward(p.sectionId));
      if (this.completed.has(p.sectionId)) puzzle.restoreComplete();
      const flagged = this.flags[`redaction.${p.sectionId}`];
      if (typeof flagged === 'string') for (const id of flagged.split(',')) puzzle.collect(id);
      this.sections.set(p.sectionId, { completable: puzzle, kind: 'puzzle', screenId: null, entrance: null, start: () => puzzle.start() });
    }
    for (const p of m.tellsPuzzles ?? []) {
      const def = m.def.puzzle.id === p.sectionId ? m.def.puzzle : { id: p.sectionId, chapter: this.chapter, kind: 'spotTheAlien' as const };
      const puzzle = new TellsPuzzle(def, p.layout, this, this.bus, this.sectionReward(p.sectionId));
      if (this.completed.has(p.sectionId)) puzzle.restoreComplete();
      const seen = this.flags[flagTells(p.sectionId)];
      if (typeof seen === 'string') for (const id of seen.split(',')) puzzle.examine(id);
      this.sections.set(p.sectionId, { completable: puzzle, kind: 'puzzle', screenId: null, entrance: null, start: () => puzzle.start() });
    }
    for (const p of m.junctionPuzzles ?? []) {
      const def = m.def.puzzle.id === p.sectionId ? m.def.puzzle : { id: p.sectionId, chapter: this.chapter, kind: 'junctions' as const };
      const puzzle = new JunctionPuzzle(def, p.layout, this, this.bus, this.sectionReward(p.sectionId));
      puzzle.setLine = (line, on) => {
        const ctl = this.stealth(p.layout.stealthId as StealthSectionId);
        for (const sid of line.sensorIds) ctl?.setHazardEnabled(sid, on);
      };
      const off = this.flags[flagJunctions(p.sectionId)];
      if (typeof off === 'string' && off !== '') puzzle.restoreOff(off.split(','));
      if (this.completed.has(p.sectionId)) {
        puzzle.restoreComplete();
        // A solved puzzle keeps its target lines off even if the flag was lost.
        puzzle.restoreOff([...new Set([...puzzle.linesOff(), ...p.layout.targetOff])]);
      }
      this.sections.set(p.sectionId, { completable: puzzle, kind: 'puzzle', screenId: null, entrance: null, start: () => puzzle.start() });
    }
    for (const p of m.gravityPuzzles ?? []) {
      const layout = this.layout(p.screenId);
      if (!layout) continue;
      const def = m.def.puzzle.id === p.sectionId ? m.def.puzzle : { id: p.sectionId, chapter: this.chapter, kind: 'gravity' as const };
      const puzzle = new GravityPuzzle(def, p.layout, this.dressing.gridFor(layout), this, this.bus, this.sectionReward(p.sectionId));
      puzzle.hasGlove = () => this.hasGlove();
      puzzle.onPush = () => this.opts.playEffect?.('push');
      puzzle.onRoomSolved = (ids) => this.setFlag(flagGravity(p.sectionId), ids.join(','));
      const solvedFlag = this.flags[flagGravity(p.sectionId)];
      if (typeof solvedFlag === 'string' && solvedFlag !== '') puzzle.restoreSolved(solvedFlag.split(','));
      if (this.completed.has(p.sectionId)) {
        puzzle.restoreComplete();
        puzzle.restoreSolved(puzzle.roomIds());
      }
      this.sections.set(p.sectionId, { completable: puzzle, kind: 'puzzle', screenId: p.screenId, entrance: null, start: () => puzzle.start() });
    }
    for (const p of m.broadcastPuzzles ?? []) {
      const def = m.def.puzzle.id === p.sectionId ? m.def.puzzle : { id: p.sectionId, chapter: this.chapter, kind: 'broadcast' as const };
      const puzzle = new BroadcastPuzzle(def, p.layout, { hasProof: (id: ProofId) => this.casebook.hasEvidence(id) }, this, this.bus, this.sectionReward(p.sectionId));
      puzzle.onChanged = (pairs) => this.setFlag(flagBroadcast(p.sectionId), pairs.join(','));
      puzzle.onPressed = () => this.setFlag(flagBroadcastPressed(p.sectionId), true);
      const pairsFlag = this.flags[flagBroadcast(p.sectionId)];
      puzzle.restore(typeof pairsFlag === 'string' && pairsFlag !== '' ? pairsFlag.split(',') : [], this.flags[flagBroadcastPressed(p.sectionId)] === true);
      if (this.completed.has(p.sectionId)) {
        puzzle.restoreComplete();
        puzzle.restore(puzzle.solvedPairs(), this.flags[flagBroadcastPressed(p.sectionId)] === true);
      }
      this.sections.set(p.sectionId, { completable: puzzle, kind: 'puzzle', screenId: p.screenId, entrance: null, start: () => puzzle.start() });
    }
    const board = m.def.deductionBoard;
    if (board) {
      // Wrong-answer lines answer the player's own submission, so they may repeat.
      this.deduction = new DeductionBoard(board, this.casebook, this, { say: (id) => void this.say(id, { repeat: true }) }, this.sectionReward(board.id));
      if (this.completed.has(board.id)) this.deduction.restoreComplete();
      const d = this.deduction;
      this.sections.set(board.id, { completable: d, kind: 'deduction', screenId: null, entrance: null, start: () => d.openBoard() });
    }
    for (const def of m.def.stealthSections) {
      const placement = m.stealth.find((s) => s.sectionId === def.id) ?? null;
      const runner = new StealthRunner(def, this.stealthHost(placement));
      if (this.completed.has(def.id)) runner.resolve();
      this.stealthRunners.set(def.id, { runner, placement });
    }
    this.applyJunctions();
  }

  private addFight(f: FightPlacement): void {
    const def: FightDef = TUNING.fights[f.sectionId] ?? { id: f.sectionId, waves: [] };
    const runner = new FightRunner(def, f.spawnPoints, this, this, this.sectionReward(f.sectionId), this.lazyFightHooks(f.sectionId), f.zones ?? []);
    if (this.completed.has(f.sectionId)) runner.restoreComplete();
    this.fights.set(f.sectionId, runner);
    this.sections.set(f.sectionId, {
      completable: runner,
      kind: 'fight',
      screenId: f.screenId,
      entrance: f.entrance,
      start: () => runner.start(),
      aliveActors: () => runner.aliveActors(),
      setSuspended: (on) => {
        runner.suspended = on;
      },
    });
  }

  private addBoss(b: BossPlacement): void {
    const def = TUNING.bosses[b.bossId];
    const dirs: Directors = {};
    if (b.shelves) dirs.shelves = new ShelfDirector(b.bossId, b.shelves, this.directorHost());
    if (b.combine) dirs.combine = new CombineDirector(b.bossId, b.combine, this.directorHost(b.screenId));
    if (b.mascots) dirs.mascots = new MascotDirector(b.bossId, b.mascots, this.mascotHost());
    if (b.pruitt2) dirs.pruitt2 = new Pruitt2Director(b.bossId, b.pruitt2, this.directorHost());
    if (b.lockdown) dirs.lockdown = new LockdownDirector(b.bossId, b.lockdown, this.lockdownHost(b.lockdown));
    if (b.administrator) dirs.administrator = new AdministratorDirector(b.bossId, b.administrator, this.administratorHost());
    if (dirs.shelves || dirs.combine || dirs.mascots || dirs.pruitt2 || dirs.lockdown || dirs.administrator) this.directors.set(b.bossId, dirs);
    const lazy = this.lazyBossHooks(b.bossId);
    const hooks: import('./boss').BossHooks = {
      ...lazy,
      onStart: (bo) => {
        dirs.combine?.start(bo);
        dirs.mascots?.start(bo);
        lazy.onStart?.(bo);
      },
      onEnd: (bo, by) => {
        dirs.mascots?.end(by);
        dirs.pruitt2?.end(by);
        dirs.lockdown?.end(by);
        dirs.administrator?.end(by);
        lazy.onEnd?.(bo, by);
      },
    };
    const runner = new BossRunner(def, b.bodies, this, this, b.exitArea ?? null, this.sectionReward(b.bossId), hooks);
    if (dirs.shelves) runner.directedAttackIds = ['shelf'];
    if (dirs.mascots) runner.directedAttackIds = ['zipTumble', 'zapFan'];
    if (dirs.pruitt2) runner.directedAttackIds = ['flashbang', 'barrier', 'truckPass'];
    if (dirs.lockdown) runner.directedAttackIds = ['door'];
    if (dirs.administrator) runner.directedAttackIds = ['stamp', 'gravityFlip', 'stunPulse', 'teleportStrike', 'beamSweep'];
    if (this.completed.has(b.bossId)) runner.restoreComplete();
    this.bosses.set(b.bossId, runner);
    this.sections.set(b.bossId, {
      completable: runner,
      kind: def.kind,
      screenId: b.screenId,
      entrance: b.entrance,
      start: () => runner.start(),
      aliveActors: () => runner.aliveActors(),
      setSuspended: (on) => {
        runner.suspended = on;
      },
    });
  }

  private lockdownHost(placement: import('./lockdown').LockdownPlacement): import('./lockdown').LockdownHost {
    const lanyard = placement.lanyard;
    return {
      bus: this.bus,
      playerPosition: () => this.player.pos,
      playerTargetable: () => this.playerTargetable(),
      hitPlayer: (hit) => this.hitPlayer(hit),
      teleportPlayer: (pos) => {
        this.player.pos = { ...pos };
        this.endForcedLurch();
      },
      hasGlove: () => this.hasGlove(),
      hasProof: (id) => this.casebook.hasEvidence(id),
      hasLanyard: () => this.flags[lanyard?.flag ?? 'lanyard'] === true || this.casebook.hasEvidence((lanyard?.evidenceId ?? 'c8.clue.shift') as EvidenceId),
      giveProof: (id) => this.addEvidence(id),
      spawnWeaponPickup: (weaponId, pos) => this.spawnWeaponPickup(weaponId, pos),
    };
  }

  private administratorHost(): import('./administrator').AdministratorHost {
    return {
      bus: this.bus,
      rng: this.rng,
      playerPosition: () => this.player.pos,
      playerFacingDeg: () => angleFromFacing(this.player.facing),
      playerTargetable: () => this.playerTargetable(),
      hitPlayer: (hit) => this.hitPlayer(hit),
      tileBlocked: (c, r) => isBlocked(this.grid, c, r),
    };
  }

  private mascotHost(): import('./mascots').MascotHost {
    return {
      bus: this.bus,
      screenId: () => this.screen.id,
      grid: () => this.grid,
      extraBlocked: (c, r) => this.extraBlocked(c, r),
      playerPosition: () => this.player.pos,
      playerTargetable: () => this.playerTargetable(),
      hitPlayer: (hit) => this.hitPlayer(hit),
      spawnProjectile: (spawn) => this.spawnProjectile(spawn),
    };
  }

  private directorHost(screenId?: ScreenId): import('./shelves').ShelfHost & import('./combine').CombineHost {
    return {
      bus: this.bus,
      rng: this.rng,
      screenId: () => screenId ?? this.screen.id,
      playerPosition: () => this.player.pos,
      playerTargetable: () => this.playerTargetable(),
      hitPlayer: (hit) => this.hitPlayer(hit),
      pushPlayer: (distancePx, angleDeg) => this.player.lurch(distancePx, angleDeg, this.grid, (c, r) => this.extraBlocked(c, r)),
      spawnProjectile: (spawn) => this.spawnProjectile(spawn),
      cutCorn: (area) => void this.cutCorn(area, screenId),
    };
  }

  /** The script is created after sections, so hooks are looked up when called. */
  private lazyFightHooks(id: FightSectionId): import('./fight').FightHooks {
    return {
      onWaveCleared: (i) => this.script.fightHooks?.[id]?.onWaveCleared?.(i),
      onWaveSpawned: (i, a) => this.script.fightHooks?.[id]?.onWaveSpawned?.(i, a),
    };
  }

  private lazyBossHooks(id: BossId): import('./boss').BossHooks {
    const h = () => this.script.bossHooks?.[id];
    return {
      onStart: (b) => h()?.onStart?.(b),
      onPhaseChanged: (b, p) => {
        h()?.onPhaseChanged?.(b, p);
      },
      onTick: (b, dt) => h()?.onTick?.(b, dt),
      onChargeBlocked: (b, body, c, r) => h()?.onChargeBlocked?.(b, body, c, r),
      onAttackLanded: (b, body, a) => h()?.onAttackLanded?.(b, body, a),
      onEnd: (b, by) => h()?.onEnd?.(b, by),
    };
  }

  private stealthHost(placement: StealthPlacement | null): StealthHost {
    return {
      bus: this.bus,
      getGrid: () => this.grid,
      raiseAlarm: (_sectionId, fightId, guards) => this.raiseAlarm(fightId, guards, placement),
      cleanRun: (def) => this.cleanRun(def),
    };
  }

  private startStealth(runner: StealthRunner): void {
    if (runner.active || runner.isFinished || runner.alarmRaised) return;
    runner.start();
    this.script.onSectionStarted?.(runner.sectionId);
  }

  private raiseAlarm(fightId: AlarmFightId, guards: readonly Guard[], placement: StealthPlacement | null): void {
    const def: FightDef = TUNING.fights[fightId] ?? { id: fightId, waves: [] };
    const runner = new FightRunner(def, placement?.reinforcementPoints ?? [this.player.pos], this, this, this.sectionReward(fightId), {});
    this.fights.set(fightId, runner);
    this.sections.set(fightId, {
      completable: runner,
      kind: 'fight',
      screenId: placement?.screenId ?? this.screen.id,
      entrance: placement?.entrance ?? null,
      start: () => runner.start(),
      aliveActors: () => runner.aliveActors(),
      setSuspended: (on) => {
        runner.suspended = on;
      },
    });
    runner.adopt(guards.map((g) => this.spawnEnemy(g.enemyId, g.pos)));
    this.currentSection = fightId;
    runner.start();
    // Shared system lines for every stealth section (not tied to a place), so they may repeat.
    void this.say('myko.caught', { repeat: true });
    this.script.onSectionStarted?.(fightId);
  }

  /** Finished without the alarm: the section's reward, once (DESIGN.md 7.3; `rewards.ts`). */
  private cleanRun(def: StealthSectionDef): void {
    const claimed = claimReward(createRewardState([...this.cleanRuns]), def.id, def.reward, true);
    this.cleanRuns.add(def.id);
    const g = claimed.grant;
    if (g?.kind === 'clue') this.addEvidence(g.clueId);
    else if (g?.kind === 'shortcut') this.openedShortcuts = [...openShortcut(this.openedShortcuts, g.shortcutId)];
    else if (g) {
      // A drink from the section or from home. A full kit leaves it on the ground; it still counts as given.
      const r = applyDrinkReward(this.player.kit, g);
      if (r.changed) this.player.setKit(r.kit);
      else this.spawnPickup({ id: `reward.${def.id}`, item: { kind: 'drink', drinkId: g.drinkId, count: 1 }, screenId: this.screen.id, position: this.player.pos });
    }
    this.bus.emit(GameEvents.StealthCleanRun, { sectionId: def.id });
    void this.say('myko.cleanRun', { repeat: true });
    this.markCompleted(def.id, 'stealth', 'player');
  }

  private mykoHost(): MykoHost {
    return {
      bus: this.bus,
      rng: this.rng,
      play: (id, repeat) => void this.say(id, { repeat: repeat === true }),
      pool: (id) => this.opts.pool(id),
      chapter: () => this.chapter,
      callTarget: () => this.callTarget(),
      stealthUncaught: () => [...this.stealthRunners.values()].some((s) => s.runner.active),
      callsLeft: () => this.callsLeft,
      callLines: (kind: MykoCallKind): MykoCallLineSet | null => this.module.def.mykoCallLines[kind] ?? null,
      callId: (sectionId) => this.bossCallId(sectionId),
      callsThisChapter: () => this.calls.filter((c) => c.chapter === this.chapter).length,
      spendCall: (sectionId, kind) => {
        this.callsLeft = Math.max(0, this.callsLeft - 1);
        this.calls.push({ chapter: this.chapter, sectionId, kind });
        this.casebook.addMykoCall(sectionId, kind, this.chapter, kind === 'setpiece' ? this.bossCallId(sectionId) : undefined);
        this.saveHere();
      },
      saveAfterCall: () => this.saveHere(),
      defeat: (actor, by) => this.defeat(actor, by),
      setPlayerProtected: (on) => {
        this.player.protected_ = on;
      },
      objective: () => this.objectiveDef(),
      hintsGiven: (id) => this.hints[id] ?? 0,
      setHintsGiven: (id, n) => {
        this.hints[id] = n;
      },
      playerPos: () => this.player.pos,
      tangentPools: () => this.module.mykoTangentPools ?? {},
    };
  }

  private bossCallId(sectionId: CompletableSectionId): string | undefined {
    return this.module.bosses.find((b) => b.bossId === sectionId)?.callId;
  }

  /** A Myko call saves on the spot. */
  private saveHere(): void {
    this.save('mykoCall');
  }

  private callTarget(): CallTarget | null {
    const id = this.currentSection;
    if (!id) return null;
    const e = this.sections.get(id);
    if (!e || e.completable.isComplete()) return null;
    return {
      completable: e.completable,
      entrance: e.entrance,
      ...(e.aliveActors ? { aliveActors: e.aliveActors } : {}),
      ...(e.setSuspended ? { setSuspended: e.setSuspended } : {}),
    };
  }

  private anyCombatOrStealthActive(): boolean {
    for (const f of this.fights.values()) if (f.active) return true;
    for (const b of this.bosses.values()) if (b.active) return true;
    for (const s of this.stealthRunners.values()) if (s.runner.active) return true;
    return false;
  }

  private activeEntrance(): Vec2 | null {
    const cur = this.currentSection ? this.sections.get(this.currentSection) : undefined;
    if (cur?.entrance) return cur.entrance;
    for (const s of this.stealthRunners.values()) if (s.runner.active && s.placement) return s.placement.entrance;
    return null;
  }

  private hidingPropsHere() {
    return this.stealthHere().flatMap((s) => s.runner.def.hidingProps);
  }

  /** A player projectile touching a breakable breaks it (straight shots stop, as they do on a wall). */
  private projectileBreaks(proj: Projectile, before: Vec2, dtMs: number): void {
    const radius = proj.shape.lobbed ? TUNING.combat.lobSplashRadius : TUNING.combat.projectileRadius;
    // Where it was heading this tick: a solid breakable stops a straight shot one step short of it.
    const ahead = add(before, scale(normalize(proj.vel), (proj.shape.speed * dtMs) / 1000));
    for (const prop of this.dressing.breakablesOn(this.screen.id)) {
      if (proj.hit.has(prop.key)) continue;
      const r = propHitRect(prop);
      const grown = { x: r.x - radius, y: r.y - radius, width: r.width + radius * 2, height: r.height + radius * 2 };
      if (!rectContains(grown, proj.pos) && (proj.shape.lobbed || !rectContains(grown, ahead))) continue;
      proj.hit.add(prop.key);
      this.hitBreakable(prop);
      if (!proj.shape.lobbed) {
        if (proj.pierceLeft <= 0) proj.done = true;
        else proj.pierceLeft--;
      }
      if (proj.done) return;
    }
  }

  /** One hit on a breakable; on breaking: debris, loot, noise, `prop:broken`, and the save remembers it. */
  private hitBreakable(prop: LiveProp): ReturnType<Dressing['hitProp']> {
    const frame = prop.frame;
    const res = this.dressing.hitProp(prop.key, TUNING.breakables.hitFlashMs);
    if (res !== 'broken') return res;
    const centre = this.propCentre(prop);
    this.dropLoot(prop, centre);
    this.emitNoise({ kind: 'breakable', position: centre, radius: TUNING.breakables.noiseRadius });
    this.bus.emit(GameEvents.PropBroken, { screenId: prop.screenId, propId: prop.key, frame });
    const key = prop.key;
    this.opts.patchSave?.((s) => ((s.brokenProps ?? []).includes(key) ? s : { ...s, brokenProps: [...(s.brokenProps ?? []), key] }));
    return res;
  }

  private propCentre(prop: LiveProp): Vec2 {
    const r = propHitRect(prop);
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }

  /** The loot a breakable drops: fixed by the placement, or from the region's table with a seed from the save and the prop. */
  private lootOf(prop: LiveProp): PickupItem | null {
    const loot = prop.def.breakable?.loot ?? 'table';
    if (loot === 'none') return null;
    if (loot !== 'table') return loot;
    const region = this.module.def.screens.find((s) => s.id === prop.screenId)?.region ?? 'kilnamoe';
    // A drink or nothing: usually the region's beer, now and then a whiskey (drops.ts). Seeded by the save and the prop.
    const drop = rollBreakableDrop(dropRngFor(this.lootSeed, prop.key), regionBeer(region), this.chapter);
    return drop === null ? null : { kind: 'drink', drinkId: drop, count: 1 };
  }

  /** A defeated enemy leaves a drink or nothing: its region's beer, rarely a whiskey, from chapter 7 a tequila. */
  private dropEnemyLoot(actor: EnemyActor): void {
    // A wave with a guaranteed drop rolls nothing at random: the last of it to fall drops the declared drink.
    const guaranteed = this.guaranteedDropFor(actor);
    if (guaranteed) {
      if (guaranteed.drink) {
        this.spawnPickup({ id: `drop.${actor.instanceId}`, item: { kind: 'drink', drinkId: guaranteed.drink, count: 1 }, screenId: this.screen.id, position: actor.pos });
      }
      return;
    }
    const region = this.module.def.screens.find((s) => s.id === this.screen.id)?.region ?? 'kilnamoe';
    const drop = rollEnemyDrop(dropRngFor(this.lootSeed, actor.instanceId), regionBeer(region), this.chapter);
    if (drop === null) return;
    this.spawnPickup({ id: `drop.${actor.instanceId}`, item: { kind: 'drink', drinkId: drop, count: 1 }, screenId: this.screen.id, position: actor.pos });
  }

  /** The fight whose wave spawned this enemy and declares a guaranteed drop, if any (`WaveDef.guaranteedDrop`). */
  private guaranteedDropFor(actor: EnemyActor): { readonly drink: CarriedDrinkId | null } | null {
    for (const f of this.fights.values()) {
      const g = f.guaranteedDropFor(actor);
      if (g) return g;
    }
    return null;
  }

  private dropLoot(prop: LiveProp, at: Vec2): void {
    const id = lootPickupId(prop.key);
    if (this.collected.has(id)) return;
    const item = this.lootOf(prop);
    if (item) this.spawnPickup({ id, item, screenId: prop.screenId, position: at });
  }

  private loadScreen(id: ScreenId, spawn: Vec2): void {
    const layout = this.layout(id);
    if (!layout) return;
    // Walking out of the bar leaves Andrew with at least the minimum bottles (every chapter, every return).
    const barId = this.module.def.bar?.screenId;
    if (barId !== undefined && this.lastScreenId === barId && id !== barId) {
      this.player.setKit(topUpForLeaving(this.player.kit, barBeerOf(this.module.def)));
    }
    this.lastScreenId = id;
    this.screen = layout;
    this.actorList = [];
    this.loneEnemies.clear();
    this.projectileList = [];
    this.pickupsLive.clear();
    this.insideTriggers.clear();
    for (const p of this.module.pickups) {
      if (p.screenId === id && !this.collected.has(p.id) && !takeItem(this.player.kit, p.item).inert) this.pickupsLive.set(p.id, { def: p, item: p.item });
    }
    // Loot of props broken earlier that was never picked up.
    for (const prop of this.dressing.propsOn(id)) if (prop.broken) this.dropLoot(prop, this.propCentre(prop));
    this.player.pos = spawn;
    // Value comparison: a spawn read back from a save on Continue is a copy, not the layout's object.
    const atStart = spawn.x === layout.playerStart.x && spawn.y === layout.playerStart.y;
    this.myko.pos = layout.mykoStart && atStart ? layout.mykoStart : { x: spawn.x - TUNING.myko.followDistance, y: spawn.y };
    if (id !== barId && !this.arrivedScreens.has(id)) {
      this.arrivedScreens.add(id);
      this.myko.lightUp();
    }
    // Areas Andrew spawns inside fire on the next tick (insideTriggers was cleared above).
    const def = this.module.def.screens.find((s) => s.id === id);
    this.screenInSun = def?.sun === true;
    // Chapter 10: a screen with no meter (Feeney's in daylight).
    this.player.setCalm(layout.noMeter === true);
    if (this.isNight()) this.applyNight();
    const region = def?.region;
    if (region) this.bus.emit(GameEvents.ScreenEntered, { screenId: id, region });
    this.script?.onScreenEntered?.(id);
  }

  /** Use the selected item (Q), drink the spirit slot (G), cycle the beer slot (wheel). DESIGN.md 6 and 7.1. */
  private handleKitInput(input: InputFrame): void {
    const p = this.player;
    if (input.pressed.has('cycleDrink') && p.canAct) p.setKit(cycleDrink(p.kit, input.wheelDir ?? 1).kit);
    if (input.pressed.has('drink') && p.canAct) this.useSelected();
    if (input.pressed.has('useSpirit') && p.canAct) this.useSpirit();
  }

  /**
   * Click an inventory entry in the Tab screen: a beer or the hot drink becomes what Q uses, a spirit goes in the
   * spirit slot (G), a weapon is equipped, a move goes in its level's special slot. See `kit.selectItem`.
   */
  selectItem(id: string | null): boolean {
    const r = selectItem(this.player.kit, id);
    if (r.changed) this.player.setKit(r.kit);
    return r.changed;
  }

  /** The selected inventory entry, or null. */
  selectedItem(): string | null {
    return this.player.kit.selectedItem ?? null;
  }

  /** Use the selected beer or hot drink, as Q does. False (and `kit:useRefused`) if nothing is selected. */
  useSelected(): boolean {
    if (!this.player.canAct) return false;
    if (this.drinkingNotYet('drink')) return false;
    const r = useSelected(this.player.kit);
    if (r.refusal === 'notHeld') this.bus.emit(GameEvents.KitUseRefused, { action: 'drink', textId: 'ui.use.nothing' });
    else if (r.refusal === 'notConsumable') this.bus.emit(GameEvents.KitUseRefused, { action: 'drink', textId: 'ui.use.notADrink' });
    return this.drinkResult(r);
  }

  /** Drink the spirit in the spirit slot at once, as G does. False (and `kit:useRefused`) if the slot is empty. */
  useSpirit(): boolean {
    if (!this.player.canAct) return false;
    if (this.drinkingNotYet('useSpirit')) return false;
    const r = useSpirit(this.player.kit);
    if (r.refusal) this.bus.emit(GameEvents.KitUseRefused, { action: 'useSpirit', textId: 'ui.spirit.none' });
    return this.drinkResult(r);
  }

  /**
   * No drinking before the first pint: while the meter is hidden every player drink is refused (`kit:useRefused`,
   * reason `meterHidden`, text `ui.use.notYet`). The one exception is Dympna's pint, which the chapter 1 script hands
   * over at `pub.step` 2 ("talked") for Andrew to drink himself; blocking it would soft-lock the opening.
   */
  private drinkingNotYet(action: 'drink' | 'useSpirit'): boolean {
    if (!this.player.meterHidden && !this.player.calm) return false;
    if (this.chapter === 1 && Number(this.flags['pub.step'] ?? 0) === FIRST_PINT_STEP) return false;
    this.bus.emit(GameEvents.KitUseRefused, { action, textId: 'ui.use.notYet', reason: 'meterHidden' });
    return true;
  }

  private drinkResult(r: { readonly consumed: OverhaulDrinkId | null; readonly kit: Kit }): boolean {
    if (r.consumed === null) return false;
    this.player.setKit(r.kit);
    this.player.drinkDrink(r.consumed);
    this.bus.emit(GameEvents.DrinkConsumed, { drinkId: r.consumed });
    if (r.consumed === 'coffee' || r.consumed === 'tea') this.mykoVoice.trigger({ kind: 'hotDrink' }, this.player.meter.value);
    return true;
  }

  /** A swing touched a section hook (`onMeleeHit`) or a breakable. */
  private meleeWorldHits(shape: AttackShape, swing: SwingResult): void {
    const p = this.player;
    const info: MeleeHitInfo = {
      weaponId: swing.weaponId,
      abilityId: legacyAbilityOf(swing.weaponId),
      comboIndex: swing.comboIndex - 1,
      comboLength: this.combat.comboLength(swing.weaponId),
      haymaker: swing.haymaker,
    };
    let thud = false;
    for (const h of [...this.meleeHooks]) {
      if (h.screenId === this.screen.id && shapeHitsRect(shape, p.pos, p.aimDeg, h.area)) {
        thud = true;
        h.callback(info);
      }
    }
    for (const prop of this.dressing.breakablesOn(this.screen.id)) {
      if (shapeHitsRect(shape, p.pos, p.aimDeg, propHitRect(prop)) && this.hitBreakable(prop) !== 'broken') thud = true;
    }
    if (thud) this.opts.playEffect?.('thud');
  }

  /** A charge or lurch's lane touches hooks and breakables (`PlayerCombatHost.moveWorldHits`). */
  private moveWorldHits(moveId: MoveId, lane: AttackShape, breakAll: boolean): void {
    const p = this.player;
    let thud = false;
    // Only what he could reach: the lane stops where a wall or puzzle piece (not a breakable) stops him, plus a
    // fingertip (HOOK_TOUCH) so the thing that stops him, or what he stands against, still counts.
    const reach = this.reachableLane(lane);
    const hookLane: AttackShape =
      reach.kind === 'charge' && lane.kind === 'charge' && reach.distance < lane.distance
        ? { ...reach, distance: reach.distance + HOOK_TOUCH }
        : reach;
    for (const h of [...this.moveHooks]) {
      if (h.screenId === this.screen.id && shapeHitsRect(hookLane, p.pos, p.aimDeg, h.area)) h.callback({ moveId });
    }
    if (breakAll) {
      for (const prop of this.dressing.breakablesOn(this.screen.id)) {
        if (!shapeHitsRect(reach, p.pos, p.aimDeg, propHitRect(prop))) continue;
        thud = true;
        // Through it, whatever it takes: every hit it has left.
        for (let i = 0; i < 16 && this.hitBreakable(prop) === 'hit'; i++);
      }
    }
    if (thud) this.opts.playEffect?.('thud');
  }

  /** The lane cut short where a solid that is not a breakable would stop Andrew. */
  private reachableLane(lane: AttackShape): AttackShape {
    if (lane.kind !== 'charge') return lane;
    const p = this.player;
    const grid = this.dressing.gridWithoutBreakables(this.screen);
    const end = moveBox(grid, p.pos, TUNING.player.bodyWidth, TUNING.player.bodyHeight, fromAngle(p.aimDeg, lane.distance), (c, r) => this.extraBlocked(c, r)).position;
    return { ...lane, distance: Math.min(lane.distance, distance(p.pos, end)) };
  }

  /** What `PlayerCombat` needs from this chapter. */
  private combatHost(): PlayerCombatHost {
    return {
      bus: this.bus,
      player: this.player,
      screenId: () => this.screen.id,
      grid: () => this.grid,
      extraBlocked: (c, r) => this.extraBlocked(c, r),
      actors: () => this.actorList,
      guardsHere: () => this.guardsHere(),
      hidingPropsHere: () => this.hidingPropsHere(),
      damageActor: (a, amount, kb, stunMs, source, from, pierce) => this.damageActor(a, amount, kb, stunMs, source, from, pierce),
      defeat: (a, by) => this.defeat(a, by),
      meleeWorldHits: (shape, swing) => this.meleeWorldHits(shape, swing),
      moveWorldHits: (moveId, lane, breakAll) => this.moveWorldHits(moveId, lane, breakAll),
      alarmGuardsHit: (shape, angle) => this.alarmGuardsHit(shape, angle),
      emitNoise: (n) => this.emitNoise(n),
      spawnProjectile: (s) => this.spawnProjectile(s),
      addFx: (kind, pos, angleDeg, radius, arcDeg, ttlMs, from) => this.fx.push({ kind, pos, angleDeg, radius, arcDeg, ttlMs, ...(from ? { from } : {}) }),
    };
  }

  private alarmGuardsHit(shape: AttackShape, angle: number): void {
    for (const { runner } of this.stealthHere()) {
      if (!runner.active) continue;
      if (runner.guards.some((g) => !TUNING.enemies[g.enemyId].dropsToFire && shapeHits(shape, this.player.pos, angle, g.pos, TUNING.combat.characterHitRadius))) runner.alarm();
    }
  }

  private damageActor(actor: EnemyActor, amount: number, knockback: Vec2, stunMs: number, source: HitInfo['source'], from: Vec2, pierceShield: boolean): void {
    const hit: HitInfo = { source, targetInstanceId: actor.instanceId, amount, knockback, stunMs, holdMs: 0 };
    const outcome = actor.takeHit(hit, from, { pierceShield });
    if (outcome === 'blocked') {
      this.fx.push({ kind: 'blocked', pos: actor.pos, angleDeg: 0, radius: 6, arcDeg: 0, ttlMs: 150 });
      return;
    }
    if (outcome !== 'hit') return;
    this.fx.push({ kind: 'hit', pos: actor.pos, angleDeg: 0, radius: 6, arcDeg: 0, ttlMs: 120 });
    this.bus.emit(GameEvents.EnemyDamaged, { hit, health: { current: actor.health, max: actor.stats.maxHealth } });
    if (actor.down) this.emitDefeated(actor, 'player');
  }

  private emitDefeated(actor: EnemyActor, by: CompletionSource): void {
    if (this.defeatedEmitted.has(actor.instanceId)) return;
    this.defeatedEmitted.add(actor.instanceId);
    if (actor.enemyId) this.bus.emit(GameEvents.EnemyDefeated, { instanceId: actor.instanceId, enemyId: actor.enemyId, by });
    this.loneEnemies.defeated(actor.instanceId);
    if (actor.enemyId && by !== 'debug') this.dropEnemyLoot(actor);
  }

  private tickProjectiles(dtMs: number): void {
    const r = TUNING.combat.characterHitRadius;
    const p = this.player;
    for (const proj of this.projectileList) {
      if (proj.done) continue;
      // The fence fight's parked truck: a dart (agents' only projectile) flies faster inside its headlight cone.
      if (proj.owner === 'enemy' && proj.frame === 'dart') {
        const mult = TUNING.overhaul?.headlights?.dartSpeedMultiplier ?? 1;
        proj.speedScale = this.headlightsHere().some((h) => canSee(this.grid, h.position, h.facingDeg, h.cone, proj.pos)) ? mult : 1;
      }
      const before = proj.pos;
      const landedNow = stepProjectile(proj, this.grid, dtMs);
      const checkHits = !proj.shape.lobbed || landedNow;
      if (checkHits && proj.owner === 'player') this.projectileBreaks(proj, before, dtMs);
      if (checkHits && proj.owner === 'player') {
        for (const actor of this.actorList) {
          if (actor.down || proj.hit.has(actor.instanceId) || !projectileTouches(proj, actor.pos, r)) continue;
          proj.hit.add(actor.instanceId);
          const kb = knockbackVector(proj.origin, actor.pos, proj.knockback, 0);
          const mult = proj.source.kind === 'player' ? this.combat.consumeMarkFor(actor.instanceId) : 1;
          this.damageActor(actor, proj.damage * mult, kb, proj.stunMs, proj.source, proj.pos, false);
          if (!proj.shape.lobbed) {
            if (proj.pierceLeft <= 0) {
              proj.done = true;
              break;
            }
            proj.pierceLeft--;
          }
        }
      } else if (checkHits && proj.owner === 'enemy' && this.playerTargetable() && projectileTouches(proj, p.pos, r)) {
        if (!proj.hit.has(p.instanceId)) {
          proj.hit.add(p.instanceId);
          this.hitPlayer(
            { source: proj.source, amount: proj.damage, knockback: knockbackVector(proj.origin, p.pos, proj.knockback, 0), stunMs: 0, holdMs: proj.holdMs, weight: proj.weight },
          );
          if (!proj.shape.lobbed) proj.done = true;
        }
      }
      if (landedNow) {
        this.fx.push({ kind: 'impact', pos: proj.pos, angleDeg: 0, radius: TUNING.combat.lobSplashRadius, arcDeg: 0, ttlMs: 200 });
        if (proj.shape.impactNoiseRadius > 0) this.emitNoise({ kind: proj.frame === 'bottle' ? 'bottle' : 'other', position: proj.pos, radius: proj.shape.impactNoiseRadius });
      }
    }
    this.projectileList = this.projectileList.filter((x) => !x.done);
  }

  emitNoise(n: NoiseEvent): void {
    this.bus.emit(GameEvents.StealthNoise, n);
    for (const { runner } of this.stealthHere()) runner.noise(n);
    // A bottle landing near a distractible body (the ram) stops it and makes it look.
    if (n.kind === 'bottle') {
      for (const a of this.actorList) if (!a.down && distance(a.pos, n.position) <= n.radius) a.distractBy(n.position);
    }
  }

  private interact(): void {
    const target = this.interactTarget();
    if (!target) return;
    if (this.script.onExamine?.(target.examinableId) === true) return;
    const best = this.module.examinables.find((e) => e.id === target.examinableId);
    if (!best) return;
    // Examining again replays the object's line (DESIGN.md 7.5).
    if (best.dialogueId) void this.say(best.dialogueId, { repeat: true });
    if (best.evidenceId) this.addEvidence(best.evidenceId);
    this.completeMark(best.id);
    if (best.item) this.give(best.item);
    if (this.module.deduction?.examinableId === best.id) this.openDeduction();
    for (const rp of this.module.redactionPuzzles ?? []) if (rp.examinableId === best.id) this.openRedaction(rp.sectionId);
    for (const tp of this.module.tellsPuzzles ?? []) {
      const puzzle = this.tells(tp.sectionId);
      const fig = puzzle?.figureForExaminable(best.id);
      if (fig) this.examineFigure(tp.sectionId, fig.id);
      if (tp.accuseExaminableId === best.id) this.openTells(tp.sectionId);
    }
    for (const jp of this.module.junctionPuzzles ?? []) {
      const puzzle = this.junctions(jp.sectionId);
      const box = puzzle?.boxForExaminable(best.id);
      if (puzzle && box && puzzle.toggle(box.id)) this.setFlag(flagJunctions(jp.sectionId), puzzle.linesOff().join(','));
    }
    for (const pp of this.pushPuzzlesHere()) if (pp.placement.resetExaminableId === best.id) pp.puzzle.reset();
    // Chapter 9: a gravity switch (needs the Glove, which `puzzle.hasGlove` checks) and a room's reset panel.
    for (const gp of this.gravityHere()) {
      if (gp.puzzle.switchFor(best.id)) this.workGravitySwitch(gp.puzzle, best.id, false);
      const room = gp.puzzle.resetFor(best.id);
      if (room) {
        const where = gp.puzzle.resetRoom(room.id, tileOf(this.player.pos));
        if (where) this.player.pos = tileCentre(where);
      }
    }
    for (const ld of this.lockdownHere()) ld.director.interact(best.id, ld.boss);
    for (const ad of this.administratorHere()) ad.director.interact(best.id, ad.boss);
    // Chapter 10: looking at a socket, the button.
    for (const bp of this.broadcastHere()) {
      const socket = bp.puzzle.socketForExaminable(best.id);
      if (socket) bp.puzzle.examine(socket.id);
      if (bp.puzzle.isButton(best.id)) bp.puzzle.press();
    }
    // E at a container lever pulls it (Andrew in the piece's way refuses); the lever's prop flips.
    for (const sp of this.slidePuzzlesHere()) {
      const lever = sp.puzzle.leverFor(best.id);
      if (lever && sp.puzzle.pull(lever.railId, this.player.pos) && lever.propId) {
        this.dressing.setPropFrame(lever.propId, sp.puzzle.pullsOf(lever.railId) % 2 === 1 ? PROP.lever.down : PROP.lever.up);
      }
    }
    // E at a gate swings it (a sheep or Andrew in the way refuses).
    for (const sp of this.sheepPuzzlesHere()) if (sp.puzzle.gateFor(best.id)) sp.puzzle.toggleGate(sp.puzzle.gateFor(best.id)?.id ?? '', this.player.pos);
  }

  private checkPickups(): void {
    const p = this.player;
    const radius = TUNING.investigation.interactRadius;
    for (const live of [...this.pickupsLive.values()]) {
      const near = distance(live.def.position, p.pos) <= radius;
      if (!near) {
        this.refusedNear.delete(live.def.id);
        continue;
      }
      if (this.refusedNear.has(live.def.id)) continue;
      const res = takeItem(p.kit, live.item);
      if (res.inert) {
        // Food and water are not things in the game now: it just is not there.
        this.pickupsLive.delete(live.def.id);
        continue;
      }
      if (res.refusal && !res.taken) {
        this.refuse(live.def.id, res.refusal);
        continue;
      }
      p.setKit(res.kit);
      if (res.taken) this.collect(live, res.taken, res.leftover);
    }
  }

  private refuse(id: PickupId, reason: PickupRefusal): void {
    this.refusedNear.add(id);
    const max = reason === 'spiritsFull' ? spiritLimit() : this.player.kit.carryLimit;
    this.bus.emit(GameEvents.PickupRefused, { pickupId: id, reason, max });
  }

  private collect(live: LivePickup, taken: PickupItem, leftover: PickupItem | null): void {
    this.bus.emit(GameEvents.PickupCollected, { pickupId: live.def.id, item: taken });
    if (live.def.commentDialogueId) void this.say(live.def.commentDialogueId);
    if (leftover) {
      live.item = leftover;
      this.refusedNear.add(live.def.id);
    } else {
      this.pickupsLive.delete(live.def.id);
      // Dropped drinks and rewards are made on the spot; only placed pickups are remembered in the save.
      if (!live.def.id.startsWith('drop.') && !live.def.id.startsWith('reward.')) this.collected.add(live.def.id);
    }
  }

  private checkAreas(): void {
    const pos = this.player.pos;
    for (const t of this.module.triggers) {
      if (t.screenId !== this.screen.id) continue;
      const inside = rectContains(t.area, pos);
      if (!inside) {
        this.insideTriggers.delete(t.id);
        continue;
      }
      if (this.insideTriggers.has(t.id)) continue;
      this.insideTriggers.add(t.id);
      if ((t.once ?? true) && this.firedTriggers.has(t.id)) continue;
      this.firedTriggers.add(t.id);
      this.script.onTrigger?.(t.id);
    }
    for (const f of this.module.fights) {
      if (f.screenId === this.screen.id && f.trigger.kind === 'area' && !this.completed.has(f.sectionId) && rectContains(f.trigger.area, pos)) {
        const r = this.fights.get(f.sectionId);
        if (r && !r.active) this.startSection(f.sectionId);
      }
    }
    for (const b of this.module.bosses) {
      if (b.screenId === this.screen.id && b.trigger.kind === 'area' && !this.completed.has(b.bossId) && rectContains(b.trigger.area, pos)) {
        const r = this.bosses.get(b.bossId);
        if (r && !r.active) this.startSection(b.bossId);
      }
    }
    if (this.anyFightActive()) return;
    for (const ex of this.screen.exits) {
      if (!rectContains(ex.area, pos)) continue;
      if (this.exitLocks.get(ex.id) === true) continue;
      if (ex.lockedUntil?.some((s) => !this.completed.has(s)) && this.exitLocks.get(ex.id) !== false) continue;
      this.opts.playEffect?.('door');
      this.loadScreen(ex.toScreen, ex.spawn);
      return;
    }
  }

  private anyFightActive(): boolean {
    for (const f of this.fights.values()) if (f.active) return true;
    for (const b of this.bosses.values()) if (b.active) return true;
    return false;
  }

  private wireBus(): void {
    this.scope.on(GameEvents.BuzzLevelChanged, ({ from, to, value }) => {
      this.mykoVoice.trigger({ kind: 'levelChanged', from, to }, value);
      this.payOwedMove(to);
    });
    this.scope.on(GameEvents.AbilityGlovePulse, ({ screenId, position, radius, aimDeg, angleDeg }) => {
      if (screenId !== this.screen.id || aimDeg === undefined || angleDeg === undefined) return;
      // The Glove's cone works a switch it reaches: a gravity room's, a bay's, one of the Administrator's.
      for (const gp of this.gravityHere()) {
        for (const room of gp.placement.layout.rooms) {
          for (const sw of room.switches) {
            const ex = this.module.examinables.find((e) => e.id === sw.examinableId);
            if (!ex || distance(position, ex.position) > radius) continue;
            if (Math.abs(angleDiff(aimDeg, angleTo(position, ex.position))) <= angleDeg / 2) this.workGravitySwitch(gp.puzzle, sw.examinableId, true);
          }
        }
      }
      for (const ld of this.lockdownHere()) ld.director.glovePulse(position, radius, aimDeg, angleDeg);
      for (const ad of this.administratorHere()) ad.director.glovePulse(position, radius, aimDeg, angleDeg, ad.boss);
    });
    this.scope.on(GameEvents.SpiritStarted, ({ drinkId }) => this.mykoVoice.trigger({ kind: 'spiritStarted', drinkId }, this.player.meter.value));
    this.scope.on(GameEvents.DialogueShow, ({ sequenceId }) => {
      if (!this.dialogue.hasPlayed(sequenceId)) return;
      this.opts.patchSave?.((s) => ((s.playedDialogue ?? []).includes(sequenceId) ? s : { ...s, playedDialogue: [...(s.playedDialogue ?? []), sequenceId] }));
    });
  }
}

function lockedInput(input: InputFrame): InputFrame {
  const keep = new Set(['callMyko'] as const);
  const filter = (s: ReadonlySet<import('../core/types').InputAction>) =>
    new Set([...s].filter((a) => (keep as ReadonlySet<string>).has(a)));
  return { ...input, move: { x: 0, y: 0 }, held: filter(input.held), pressed: filter(input.pressed), released: filter(input.released) };
}

/** Pickup ID of a breakable's loot (collected like any other pickup). */
export function lootPickupId(propKey: string): PickupId {
  return `break.${propKey}`;
}
