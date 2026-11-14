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
  ScreenAmbient,
  ScreenLayout,
  ScriptedCompletableHandle,
  StealthControl,
  StealthPlacement,
} from '../core/chapter';
import { BusScope } from '../core/events';
import type { Random } from '../core/random';
import { GameEvents } from '../core/types';
import type {
  AbilityId,
  AlarmFightId,
  AttackShape,
  BossId,
  DrunkState,
  ChapterFlagValue,
  ChapterNumber,
  Completable,
  CompletableKind,
  CompletableSectionId,
  CompletionSource,
  DialogueId,
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
  ScreenId,
  SpecialSlotIndex,
  SectionId,
  SectionKind,
  StealthSectionDef,
  StealthSectionId,
  TileGrid,
  Vec2,
  BarReturnReason,
  WeaponId,
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
import type { ActorStats, CombatWorld } from './enemies';
import { FightRunner } from './fight';
import { add, distance, normalize, rectContains, scale } from './geometry';
import { TILE, isShade, tileOf } from './grid';
import { Casebook, DeductionBoard, PuzzleBase } from './investigation';
import { assignDrink, assignMove, assignWeapon, cycleDrink, drinkFromInventory, drinkSelected, gainWeapon, learnMove, topUpBottles } from './kit';
import { takeItem } from './pickups';
import { dropRngFor, regionBeer, rollBreakableDrop, rollEnemyDrop } from './drops';
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
import { CompletableSection, ScriptedCompletable } from './sections';
import type { SectionHost } from './sections';
import { StealthRunner, actingNatural } from './stealth';
import type { Guard, StealthHost } from './stealth';

/** Short-lived things for the view to draw (swings, slams, impacts). */
export interface FxEvent {
  readonly kind: 'swing' | 'slam' | 'breath' | 'glove' | 'impact' | 'blocked' | 'hit';
  readonly pos: Vec2;
  readonly angleDeg: number;
  readonly radius: number;
  readonly arcDeg: number;
  ttlMs: number;
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
  private currentSection: CompletableSectionId | null = null;

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
    this.finished = save.finishedChapters;
    this.savedFlags = { ...save.flags };
    this.settings = save.settings;
    this.openedShortcuts = [...save.openedShortcuts];

    // Loading a save puts Andrew in the bar exactly as a return does, bottles topped up (DESIGN.md 7.6). Chapter 1 keeps its own start.
    this.player = new Player(this.bus, opts.resumed && this.chapter >= 2 ? topUpBottles(save.kit).kit : save.kit, this.chapter);
    this.combat = new PlayerCombat(this.combatHost());
    this.mykoVoice = new MykoMeterVoice({ rng: this.rng, pool: (id) => this.opts.pool(id), say: (id) => void this.say(id, { repeat: true }) });
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

    const bar = this.barLocation();
    const screen = this.layout(bar.screenId) ?? this.module.screens[0];
    if (!screen) throw new Error(`Chapter ${this.chapter} has no screens`);
    this.screen = screen;
    this.barFlow = new BarFlow(this.barFlowHost());

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
    };
  }

  dispose(): void {
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
    if (this.dialogue.blocking) return;

    const live = this.controlsLocked || this.myko.callInProgress || this.deduction?.isOpen === true ? lockedInput(input) : input;
    const p = this.player;

    // Player: move, then the meter (sun first, so this tick's drain is right).
    p.move(dtMs, live, this.grid, (c, r) => this.extraBlocked(c, r), this.groundSpeed());
    p.setInSun(this.screenInSun && !isShade(this.grid, p.pos));
    p.tickMeter(dtMs);
    this.mykoVoice.step(dtMs);
    if (p.meter.returnReason) this.handleReturn();
    else this.mykoVoice.trigger({ kind: 'meterValue' }, p.meter.value);

    this.handleKitInput(live);
    this.combat.tick(dtMs);
    this.combat.handleInput(live, dtMs);
    if (live.pressed.has('interact')) this.interact();

    // Footsteps.
    this.footstepMs -= dtMs;
    if (p.moving && this.footstepMs <= 0) {
      this.footstepMs = TUNING.stealth.footstepIntervalMs;
      const radius = p.footstepNoiseRadius();
      if (radius > 0) this.emitNoise({ kind: p.sneaking ? 'sneakFootstep' : 'footstep', position: p.pos, radius });
    }

    // Puzzles.
    for (const { puzzle } of this.pushPuzzlesHere()) puzzle.update(dtMs, p.pos, live.move);
    for (const { puzzle } of this.sheepPuzzlesHere()) puzzle.update(dtMs, p.pos);

    // Actors, projectiles.
    for (const a of this.actorList) a.tick(dtMs, this);
    this.tickProjectiles(dtMs);

    // Sections.
    for (const f of this.fights.values()) f.tick(dtMs);
    for (const b of this.bosses.values()) b.tick(dtMs);
    // Act Natural is a move now (`moves.ts`); tall corn hides him without it.
    const hidden = this.combat.hidden || actingNatural(this.hidingPropsHere(), p.pos, p.stillMs, false);
    for (const { runner, placement } of this.stealthHere()) {
      if (!placement) continue;
      if (!runner.isFinished && !runner.alarmRaised && placement.startArea !== undefined && rectContains(placement.startArea, p.pos)) this.startStealth(runner);
      // Thermal masts (chapter 8) see him at Bit much or worse while he is out in the sun.
      runner.tick(dtMs, { pos: p.pos, hidden, running: p.moving && !p.sneaking, thermalVisible: p.level >= 3 && p.meter.inSun });
      if (runner.active && rectContains(placement.exitArea, p.pos)) runner.finish();
    }

    this.checkAreas();
    this.checkPickups();
    this.script.onUpdate?.(dtMs);

    // Myko.
    const combat = this.anyCombatOrStealthActive();
    this.myko.standPoint = combat ? this.activeEntrance() : this.myko.standPoint;
    const inputActive = live.move.x !== 0 || live.move.y !== 0 || live.pressed.size > 0;
    this.myko.update(dtMs, this.deduction?.isOpen === true ? lockedInput(input) : input, { combatOrStealth: combat, inputActive });
    if (p.meter.returnReason) this.handleReturn();
  }

  /** The meter reached 0 or the floor: back to the bar (`barFlow.ts`). */
  private handleReturn(): void {
    const reason = this.player.meter.returnReason;
    if (!reason) return;
    this.returnWaitMs = 0;
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
        this.projectileList = [];
        this.defeatedEmitted.clear();
        this.refusedNear.clear();
        this.fx.length = 0;
        this.combat.reset();
      },
      barLocation: () => this.barLocation(),
      placeAt: (where) => this.loadScreen(where.screenId, where.position),
      restoreSaved: () => {
        for (const k of Object.keys(this.flags)) delete this.flags[k];
        Object.assign(this.flags, this.savedFlags);
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
      return;
    }
    this.fights.get(id as FightSectionId)?.reset();
    this.bosses.get(id as BossId)?.reset();
    this.stealthRunners.get(id as StealthSectionId)?.runner.reset();
    const c = this.sections.get(id as CompletableSectionId)?.completable;
    if (c instanceof PushPuzzle) c.reset();
  }

  /** A way back that Andrew opened from the far side (a clean-run reward). */
  shortcutOpened(id: string): boolean {
    return this.openedShortcuts.includes(id);
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
    this.deduction.openBoard();
  }

  closeDeduction(): void {
    this.deduction?.closeBoard();
  }

  /** Learn a move; it goes into its slot if that slot is empty (DESIGN.md 7.7). */
  learnMove(id: MoveId): void {
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

  /** Put a held drink in the drink slot (the Tab screen). */
  assignDrink(id: OverhaulDrinkId | null): boolean {
    const r = assignDrink(this.player.kit, id);
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

  /** The heat meter is gone (DESIGN.md 7.1: the sun doubles the drain instead). Kept so scripts compile. */
  setHeatActive(): void {}

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
  }

  private addFight(f: FightPlacement): void {
    const def: FightDef = TUNING.fights[f.sectionId] ?? { id: f.sectionId, waves: [] };
    const runner = new FightRunner(def, f.spawnPoints, this, this, this.sectionReward(f.sectionId), this.lazyFightHooks(f.sectionId));
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
    const runner = new BossRunner(def, b.bodies, this, this, b.exitArea ?? null, this.sectionReward(b.bossId), this.lazyBossHooks(b.bossId));
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
      callsThisChapter: () => this.calls.filter((c) => c.chapter === this.chapter).length,
      spendCall: (sectionId, kind) => {
        this.callsLeft = Math.max(0, this.callsLeft - 1);
        this.calls.push({ chapter: this.chapter, sectionId, kind });
        this.casebook.addMykoCall(sectionId, kind, this.chapter);
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
    const drop = rollBreakableDrop(dropRngFor(this.lootSeed, prop.key), regionBeer(region));
    return drop === null ? null : { kind: 'drink', drinkId: drop, count: 1 };
  }

  /** A defeated enemy leaves a drink or nothing: its region's beer, rarely a whiskey, from chapter 7 a tequila. */
  private dropEnemyLoot(actor: EnemyActor): void {
    const region = this.module.def.screens.find((s) => s.id === this.screen.id)?.region ?? 'kilnamoe';
    const drop = rollEnemyDrop(dropRngFor(this.lootSeed, actor.instanceId), regionBeer(region), this.chapter);
    if (drop === null) return;
    this.spawnPickup({ id: `drop.${actor.instanceId}`, item: { kind: 'drink', drinkId: drop, count: 1 }, screenId: this.screen.id, position: actor.pos });
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
    this.screen = layout;
    this.actorList = [];
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
    // Areas Andrew spawns inside fire on the next tick (insideTriggers was cleared above).
    const def = this.module.def.screens.find((s) => s.id === id);
    this.screenInSun = def?.sun === true;
    const region = def?.region;
    if (region) this.bus.emit(GameEvents.ScreenEntered, { screenId: id, region });
    this.script?.onScreenEntered?.(id);
  }

  /** Drink (Q), cycle the drink slot (wheel). DESIGN.md 6 and 7.1. */
  private handleKitInput(input: InputFrame): void {
    const p = this.player;
    if (input.pressed.has('cycleDrink') && p.canAct) p.setKit(cycleDrink(p.kit, input.wheelDir ?? 1).kit);
    if (input.pressed.has('drink') && p.canAct) this.drinkResult(drinkSelected(p.kit));
  }

  /** Drink something held, straight from the Tab screen. False if he does not hold it. */
  drinkFromInventory(id: OverhaulDrinkId): boolean {
    if (!this.player.canAct) return false;
    return this.drinkResult(drinkFromInventory(this.player.kit, id));
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
    for (const h of [...this.moveHooks]) {
      if (h.screenId === this.screen.id && shapeHitsRect(lane, p.pos, p.aimDeg, h.area)) h.callback({ moveId });
    }
    if (breakAll) {
      for (const prop of this.dressing.breakablesOn(this.screen.id)) {
        if (!shapeHitsRect(lane, p.pos, p.aimDeg, propHitRect(prop))) continue;
        thud = true;
        // Through it, whatever it takes: every hit it has left.
        for (let i = 0; i < 16 && this.hitBreakable(prop) === 'hit'; i++);
      }
    }
    if (thud) this.opts.playEffect?.('thud');
  }

  /** What `PlayerCombat` needs from this chapter. */
  private combatHost(): PlayerCombatHost {
    return {
      bus: this.bus,
      player: this.player,
      screenId: () => this.screen.id,
      grid: () => this.grid,
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
      addFx: (kind, pos, angleDeg, radius, arcDeg, ttlMs) => this.fx.push({ kind, pos, angleDeg, radius, arcDeg, ttlMs }),
    };
  }

  private alarmGuardsHit(shape: AttackShape, angle: number): void {
    for (const { runner } of this.stealthHere()) {
      if (!runner.active) continue;
      if (runner.guards.some((g) => shapeHits(shape, this.player.pos, angle, g.pos, TUNING.combat.characterHitRadius))) runner.alarm();
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
    if (actor.enemyId && by !== 'debug') this.dropEnemyLoot(actor);
  }

  private tickProjectiles(dtMs: number): void {
    const r = TUNING.combat.characterHitRadius;
    const p = this.player;
    for (const proj of this.projectileList) {
      if (proj.done) continue;
      const before = proj.pos;
      const landedNow = stepProjectile(proj, this.grid, dtMs);
      const checkHits = !proj.shape.lobbed || landedNow;
      if (checkHits && proj.owner === 'player') this.projectileBreaks(proj, before, dtMs);
      if (checkHits && proj.owner === 'player') {
        for (const actor of this.actorList) {
          if (actor.down || proj.hit.has(actor.instanceId) || !projectileTouches(proj, actor.pos, r)) continue;
          proj.hit.add(actor.instanceId);
          const kb = knockbackVector(proj.origin, actor.pos, proj.knockback, 0);
          this.damageActor(actor, proj.damage, kb, proj.stunMs, proj.source, proj.pos, false);
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
    if (best.item) this.give(best.item);
    if (this.module.deduction?.examinableId === best.id) this.openDeduction();
    for (const pp of this.pushPuzzlesHere()) if (pp.placement.resetExaminableId === best.id) pp.puzzle.reset();
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
    this.bus.emit(GameEvents.PickupRefused, { pickupId: id, reason, max: this.player.kit.carryLimit });
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
    this.scope.on(GameEvents.BuzzLevelChanged, ({ from, to, value }) => this.mykoVoice.trigger({ kind: 'levelChanged', from, to }, value));
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
