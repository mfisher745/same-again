/**
 * The game session: save, scene flow and chapter transitions, plus the
 * `uiState` object the UI reads. Plain TypeScript; Phaser scenes are driven
 * through the injected `SceneDriver`.
 *
 * Flow (DESIGN.md 7.6, docs/chapters/README.md "Carry-over rules"):
 * - New Game: clears the save and starts chapter 1.
 * - Continue: loads the save and resumes at its respawn point.
 * - Chapter Select: the chapter with the abilities it expects (everything
 *   unlocked in earlier chapters), three stout, no hangover, the save's Myko
 *   calls and casebook, full health.
 * - Back to the bar (meter at 0 or at the floor) happens inside the run; there is no death and no game over.
 * - Chapter complete: hangover rule, Buzz back to 0, health to max, save,
 *   next chapter (or the title after chapter 10).
 */

import { TUNING } from '../content/tuning';
import { hasSequence, pool as dialoguePool, sequence } from '../content/dialogue';
import type { ChapterModule } from '../core/chapter';
import { getChapter } from '../core/chapter';
import { EventBus } from '../core/events';
import type { Random } from '../core/random';
import { seededRandom } from '../core/random';
import { MemoryStorage, SaveStore } from '../core/save';
import { GameEvents, SAVE_VERSION_OVERHAUL } from '../core/types';
import type {
  BarReturnReason,
  Vec2,
  AudioSettings,
  CasebookEntry,
  ChapterNumber,
  DeductionBoardDef,
  DeductionSectionId,
  DialogueId,
  EvidenceId,
  GameEventBus,
  DrunkLevelTable,
  DrunkState,
  Health,
  MeterSnapshot,
  ObjectiveId,
  Kit,
  OverhaulSaveState,
  MoveSlotView,
  ThrowAim,
  WeaponId,
  BossId,
  TextId,
  HotDrinkId,
  MoveId,
  OverhaulDrinkId,
  SpecialSlotIndex,
  TabMode,
} from '../core/types';
import { gainWeapon, createKit, learnMove, pickUpDrink, topUpBottles } from './kit';
import { createMeter, levelTable, snapshot } from './meter';
import type { ActionRefusal } from './playerCombat';
import type { DialogueLookup } from './dialogue';
import { ChapterRun } from './run';
import type { RunEffect } from './run';

/** What the session asks of Phaser. Implemented in `src/main.ts`. */
export interface SceneDriver {
  showTitle(): void;
  /** (Re)starts the Game scene, which calls `session.createRun()`. */
  startGame(): void;
  pauseGame(): void;
  resumeGame(): void;
}

/** Dialogue lookup backed by `src/content/dialogue/`. */
export const contentDialogue: DialogueLookup = {
  delivery: (id) => (hasSequence(id) ? sequence(id).delivery : null),
};

/** Pool lookup that returns [] for unknown pools instead of throwing. */
export function poolOrEmpty(id: string): readonly DialogueId[] {
  try {
    return dialoguePool(id);
  } catch {
    return [];
  }
}

interface PendingRun {
  readonly module: ChapterModule;
  readonly save: OverhaulSaveState;
  readonly resumed: boolean;
  /** Sandbox and missing-chapter runs never touch the real save. */
  readonly store: SaveStore;
}

/** A save positioned at the start of a chapter: loading it puts Andrew in the chapter's bar at the bottom of Grand. */
export function saveAtChapterStart(module: ChapterModule, base: Omit<OverhaulSaveState, 'chapter'>): OverhaulSaveState {
  return { ...base, chapter: module.def.number };
}

export function emptyProgress(): Omit<OverhaulSaveState, 'chapter'> {
  return {
    version: SAVE_VERSION_OVERHAUL,
    kit: createKit(),
    mykoCallsLeft: TUNING.myko.callsPerGame,
    mykoCalls: [],
    finishedChapters: [],
    completedSectionIds: [],
    cleanStealthRunIds: [],
    collectedPickupIds: [],
    casebook: [],
    openedShortcuts: [],
    settings: { tabMode: 'toggle' },
    hintsGiven: {},
    flags: {},
    playedDialogue: [],
    brokenProps: [],
    lootSeed: 0,
  };
}

/**
 * The kit a chapter expects at its start (Chapter Select): the moves learned
 * and the weapons gained in earlier chapters, a few stout, and Andrew still in
 * the bar with nothing hot (the bar offers it). docs/chapters/README.md "Carry-over rules".
 */
export function kitForChapterStart(n: ChapterNumber): Kit {
  const o = TUNING.overhaul;
  let kit = createKit();
  if (!o) return kit;
  const moves = Object.values(o.moves).filter((m) => m.learnedInChapter < n).sort((a, b) => a.level - b.level);
  for (const m of moves) kit = learnMove(kit, m.id, { autoAssign: true }).kit;
  const weapons = Object.values(o.weapons).filter((w) => w.gainedInChapter < n);
  for (const w of weapons) kit = gainWeapon(kit, w.id).kit;
  // Chapter 1 hands Andrew his first pint itself.
  if (n > 1) for (let i = 0; i < 3; i++) kit = pickUpDrink(kit, 'stout').kit;
  return topUpBottles(kit).kit;
}

/** Chapter Select start state. docs/chapters/README.md "Carry-over rules". */
export function chapterSelectSave(module: ChapterModule, existing: OverhaulSaveState | null, priorEvidence: readonly EvidenceId[]): OverhaulSaveState {
  const n = module.def.number;
  const base = existing ?? { ...emptyProgress(), chapter: n };
  const casebook: CasebookEntry[] = [...base.casebook];
  for (const id of priorEvidence) {
    // Filed under the chapter the clue came from (its ID prefix), not the one being started.
    const from = chapterOf(id);
    const chapter = (from >= 1 && from < n ? from : n) as ChapterNumber;
    if (!casebook.some((e) => e.kind === 'evidence' && e.evidenceId === id)) casebook.push({ kind: 'evidence', evidenceId: id, chapter });
  }
  return saveAtChapterStart(module, {
    ...base,
    kit: kitForChapterStart(n),
    casebook,
    // Sections of this and later chapters start fresh.
    completedSectionIds: base.completedSectionIds.filter((id) => chapterOf(id) < n),
    cleanStealthRunIds: base.cleanStealthRunIds.filter((id) => chapterOf(id) < n),
    collectedPickupIds: [],
    flags: Object.fromEntries(Object.entries(base.flags).filter(([k]) => chapterOf(k) < n)),
    // Lines of this and later chapters may play again; earlier chapters' and shared lines stay played.
    playedDialogue: base.playedDialogue.filter((id) => chapterOf(id) < n),
    brokenProps: base.brokenProps.filter((k) => chapterOf(k) < n),
  });
}

/** Chapter number from an ID prefix like `c3.`; 0 if none. */
export function chapterOf(id: string): number {
  const m = /^c(\d+)\./.exec(id);
  return m ? Number(m[1]) : 0;
}

/** Applies the end-of-chapter rules and positions the save at the next chapter. The kit carries over; Buzz does not. */
export function carryOver(snap: OverhaulSaveState, _endState: DrunkState, next: ChapterModule): OverhaulSaveState {
  const ended = snap.chapter;
  const finished = snap.finishedChapters.includes(ended) ? snap.finishedChapters : [...snap.finishedChapters, ended];
  // Buzz does not carry over: every chapter starts at the bottom of Grand in its bar (DESIGN.md 7.1).
  return saveAtChapterStart(next, { ...snap, finishedChapters: finished });
}

export interface SessionOptions {
  readonly store?: SaveStore;
  readonly rng?: Random;
  readonly bus?: EventBus;
  /** Fallback module when a chapter is not registered (the sandbox). */
  readonly fallbackModule?: (chapter: ChapterNumber) => ChapterModule;
}

export class GameSession {
  readonly bus: EventBus;
  readonly store: SaveStore;
  private readonly rng: Random;
  private driver: SceneDriver | null = null;
  private pending: PendingRun | null = null;
  private current: ChapterRun | null = null;
  private paused = false;
  private audio: AudioSettings;
  private tabModeChosen: TabMode = 'toggle';
  /** Sound for effects with no bus event; set by main from the audio module. */
  playEffect: ((id: RunEffect) => void) | null = null;

  constructor(private readonly opts: SessionOptions = {}) {
    this.bus = opts.bus ?? new EventBus();
    this.store = opts.store ?? new SaveStore();
    this.rng = opts.rng ?? seededRandom(1);
    this.audio = this.store.loadAudio();
  }

  setDriver(driver: SceneDriver): void {
    this.driver = driver;
  }

  get run(): ChapterRun | null {
    return this.current;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  // -------------------------------------------------------------------------
  // Flow
  // -------------------------------------------------------------------------

  newGame(): void {
    this.store.clear();
    const module = this.moduleFor(1);
    if (!module) return;
    // Fixed for the life of the save, so a breakable always drops the same thing in it.
    const lootSeed = Math.floor(this.rng.next() * 0x7fffffff);
    const save = saveAtChapterStart(module.module, { ...emptyProgress(), lootSeed });
    module.store.write(save);
    this.begin({ module: module.module, save, resumed: false, store: module.store });
  }

  continueGame(): void {
    const save = this.store.load();
    if (!save) {
      this.newGame();
      return;
    }
    const module = this.moduleFor(save.chapter);
    if (!module) return;
    this.begin({ module: module.module, save, resumed: true, store: module.store });
  }

  startChapter(chapter: ChapterNumber): void {
    const found = this.moduleFor(chapter);
    if (!found) return;
    const prior: EvidenceId[] = [];
    for (let n = 1; n < chapter; n++) {
      const m = getChapter(n as ChapterNumber);
      if (m) prior.push(...m.def.evidence);
    }
    const save = chapterSelectSave(found.module, found.store === this.store ? this.store.load() : null, prior);
    found.store.write(save);
    this.begin({ module: found.module, save, resumed: false, store: found.store });
  }

  /** Starts a module directly with an in-memory save (sandbox, tests). */
  startModule(module: ChapterModule, save?: OverhaulSaveState): void {
    const store = new SaveStore(new MemoryStorage());
    const s = save ?? saveAtChapterStart(module, emptyProgress());
    store.write(s);
    this.begin({ module, save: s, resumed: false, store });
  }

  /** Called by the Game scene when it starts. */
  createRun(): ChapterRun | null {
    const p = this.pending;
    if (!p) return null;
    this.current?.dispose();
    const run = new ChapterRun({
      module: p.module,
      save: p.save,
      bus: this.bus,
      rng: this.rng,
      dialogue: contentDialogue,
      pool: poolOrEmpty,
      resumed: p.resumed,
      writeSave: (state: OverhaulSaveState) => p.store.write(state),
      onChapterComplete: (endState, snap) => this.onChapterComplete(endState, snap),
      playEffect: (id) => this.playEffect?.(id),
      patchSave: (patch) => {
        const cur = p.store.load();
        if (cur) p.store.write(patch(cur));
      },
    });
    this.current = run;
    this.bus.emit(GameEvents.ChapterStarted, { chapter: p.module.def.number });
    return run;
  }

  pause(): void {
    if (this.paused || !this.current) return;
    this.paused = true;
    this.bus.emit(GameEvents.GamePaused, {});
    this.driver?.pauseGame();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.bus.emit(GameEvents.GameResumed, {});
    this.driver?.resumeGame();
  }

  quitToTitle(): void {
    this.current?.dispose();
    this.current = null;
    this.pending = null;
    this.paused = false;
    this.driver?.showTitle();
  }

  audioSettings(): AudioSettings {
    return this.audio;
  }

  setAudioSettings(settings: AudioSettings): void {
    this.audio = settings;
    this.store.writeAudio(settings);
  }

  /** Tab as toggle or hold: the running chapter's setting, else the save's, else toggle. */
  tabMode(): TabMode {
    return this.current?.tabMode() ?? this.store.load()?.settings.tabMode ?? this.tabModeChosen;
  }

  /** Keep the choice with the run and the stored save. */
  setTabMode(mode: TabMode): void {
    this.tabModeChosen = mode;
    this.current?.setTabMode(mode);
    const saved = this.store.load();
    if (saved) this.store.write({ ...saved, settings: { ...saved.settings, tabMode: mode } });
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private begin(p: PendingRun): void {
    this.pending = p;
    this.paused = false;
    this.driver?.startGame();
  }

  private moduleFor(chapter: ChapterNumber): { module: ChapterModule; store: SaveStore } | null {
    const m = getChapter(chapter);
    if (m) return { module: m, store: this.store };
    const fb = this.opts.fallbackModule?.(chapter);
    return fb ? { module: fb, store: new SaveStore(new MemoryStorage()) } : null;
  }

  private onChapterComplete(endState: DrunkState, snap: OverhaulSaveState): void {
    const p = this.pending;
    if (!p) return;
    const ended = snap.chapter;
    this.bus.emit(GameEvents.ChapterCompleted, { chapter: ended, endState });
    if (ended >= 10) {
      const finished = snap.finishedChapters.includes(ended) ? snap.finishedChapters : [...snap.finishedChapters, ended];
      p.store.write({ ...snap, finishedChapters: finished });
      this.bus.emit(GameEvents.SaveWritten, { reason: 'chapterComplete' });
      this.quitToTitle();
      return;
    }
    const nextN = (ended + 1) as ChapterNumber;
    const next = getChapter(nextN) ?? (p.store === this.store ? undefined : this.opts.fallbackModule?.(nextN));
    if (!next) {
      // Next chapter not built yet: record the finish and go to the title.
      const finished = snap.finishedChapters.includes(ended) ? snap.finishedChapters : [...snap.finishedChapters, ended];
      p.store.write({ ...snap, finishedChapters: finished });
      this.bus.emit(GameEvents.SaveWritten, { reason: 'chapterComplete' });
      this.quitToTitle();
      return;
    }
    const save = carryOver(snap, endState, next);
    p.store.write(save);
    this.bus.emit(GameEvents.SaveWritten, { reason: 'chapterComplete' });
    this.begin({ module: next, save, resumed: false, store: p.store });
  }
}

const emptySlotViews = (): readonly MoveSlotView[] =>
  ([1, 2, 3, 4] as const).map((slot) => ({ slot, moveId: null, lit: false, cooldownLeftMs: 0, cooldownMs: 0 }));

/**
 * The object the UI receives (`UiStateSource` in `src/ui/contract.ts`).
 * Satisfies it structurally without importing the UI.
 */
export function createUiState(session: GameSession) {
  const run = () => session.run;
  return {
    get bus(): GameEventBus {
      return session.bus;
    },
    meter(): MeterSnapshot {
      return run()?.player.meterSnapshot() ?? snapshot(createMeter(1));
    },
    levelTable(): DrunkLevelTable {
      return levelTable(run()?.chapter ?? 1);
    },
    kit(): Kit {
      return run()?.player.kit ?? session.store.load()?.kit ?? createKit();
    },
    /** The four special slots: the move in each, whether it is lit, and its cooldown. */
    moveSlots(): readonly MoveSlotView[] {
      return run()?.combat.slotViews() ?? emptySlotViews();
    },
    /** The melee weapon in use. */
    weapon(): WeaponId {
      return run()?.player.kit.slots.melee ?? 'fists';
    },
    /** The throw's preview while aiming. */
    throwPreview(): ThrowAim | null {
      return run()?.combat.throwPreview() ?? null;
    },
    /** The latest refusal of a move (`ui.move.*`), for the HUD to flash. */
    refusal(): ActionRefusal | null {
      return run()?.combat.lastRefusal ?? null;
    },
    assignDrink(id: OverhaulDrinkId | null): boolean {
      return run()?.assignDrink(id) ?? false;
    },
    assignMove(slot: SpecialSlotIndex, id: MoveId | null): boolean {
      return run()?.assignMove(slot, id) ?? false;
    },
    assignWeapon(id: WeaponId): boolean {
      return run()?.assignWeapon(id) ?? false;
    },
    drinkFromInventory(id: OverhaulDrinkId): boolean {
      return run()?.drinkFromInventory(id) ?? false;
    },
    hotDrinkOffered(): boolean {
      return run()?.hotDrinkOffered() ?? false;
    },
    takeHotDrink(id: HotDrinkId): boolean {
      return run()?.takeHotDrink(id) ?? false;
    },
    tabMode(): TabMode {
      return session.tabMode();
    },
    setTabMode(mode: TabMode): void {
      session.setTabMode(mode);
    },
    completeBarReturn(): void {
      run()?.completeBarReturn();
    },
    barReturning(): { readonly reason: BarReturnReason; readonly andrew: Vec2 } | null {
      return run()?.barReturning ?? null;
    },
    mykoCallsLeft(): number {
      return run()?.callsRemaining() ?? session.store.load()?.mykoCallsLeft ?? TUNING.myko.callsPerGame;
    },
    mykoCallHoldProgress(): number {
      return run()?.myko.callHoldProgress() ?? 0;
    },
    casebook(): readonly CasebookEntry[] {
      return run()?.casebook.entries() ?? session.store.load()?.casebook ?? [];
    },
    /** What E would do right now: 'talk' to an NPC or 'examine' something, with its prompt text ID. */
    interactPrompt(): { readonly kind: 'examine' | 'talk'; readonly textId: TextId } | null {
      const t = run()?.interactTarget();
      if (!t) return null;
      return { kind: t.kind, textId: t.kind === 'talk' ? 'ui.prompt.talk' : 'ui.prompt.examine' };
    },
    currentObjective(): ObjectiveId | null {
      return run()?.objective() ?? null;
    },
    boss(): { readonly bossId: BossId; readonly health: Health } | null {
      const b = run()?.activeBoss();
      const h = b?.health();
      return b && h ? { bossId: b.bossId, health: h } : null;
    },
    activeDeduction(): DeductionBoardDef | null {
      return run()?.activeDeduction()?.def ?? null;
    },
    submitDeduction(id: DeductionSectionId, evidence: readonly EvidenceId[]): boolean {
      return run()?.submitDeduction(id, evidence) ?? false;
    },
    dialogueFinished(sequenceId: DialogueId): void {
      run()?.dialogueFinished(sequenceId);
    },
    save(): OverhaulSaveState | null {
      return session.store.load();
    },
    audioSettings(): AudioSettings {
      return session.audioSettings();
    },
    setAudioSettings(settings: AudioSettings): void {
      session.setAudioSettings(settings);
    },
    newGame(): void {
      session.newGame();
    },
    continueGame(): void {
      session.continueGame();
    },
    startChapter(chapter: ChapterNumber): void {
      session.startChapter(chapter);
    },
    pause(): void {
      session.pause();
    },
    resume(): void {
      session.resume();
    },
    quitToTitle(): void {
      session.quitToTitle();
    },
  };
}

export type UiState = ReturnType<typeof createUiState>;
