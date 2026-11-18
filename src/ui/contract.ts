/**
 * What the UI needs from the game. Systems-dev implements this at merge; the
 * dev harness in `src/ui/dev/` implements it with fake data.
 */

import type {
  AudioSettings,
  BarReturnReason,
  BossId,
  CasebookEntry,
  ChapterNumber,
  DeductionBoardDef,
  DeductionSectionId,
  DialogueId,
  EvidenceId,
  GameEventBus,
  HotDrinkId,
  Kit,
  SpecialSlotIndex,
  TabMode,
  DrunkLevelTable,
  Health,
  MeterSnapshot,
  MoveId,
  ObjectiveId,
  PuzzleSectionId,
  OverhaulSaveState,
  MoveSlotView,
  ThrowAim,
  TextId,
  Vec2,
  WeaponId,
} from '../core/types';
import type { HeatState } from '../systems/heat';
import type { RedactionTry, RedactionView } from '../systems/redaction';
import type { TellsTry, TellsView } from '../systems/tells';

export interface UiStateSource {
  readonly bus: GameEventBus;
  /** The one Buzz meter: value, level, floor, spirit window, tea hold, sun. There is no health. */
  meter(): MeterSnapshot;
  /** Where each level sits on the meter in this chapter (grows by chapter). */
  levelTable(): DrunkLevelTable;
  /** What he carries: drinks, hot drink, bottles, weapons, moves and the six slots. */
  kit(): Kit;
  /** The four special slots: the move in each, whether Andrew is at its level (lit) or it is dark, and its cooldown. */
  moveSlots(): readonly MoveSlotView[];
  /** The melee weapon in use. */
  weapon(): WeaponId;
  /** The dotted path of the throw while the button is held (hold right mouse), or null. */
  throwPreview(): ThrowAim | null;
  /** The latest refusal of a move (`ui.move.*`); `seq` rises with each. Null before the first. */
  refusal(): { readonly textId: TextId; readonly seq: number } | null;
  /** Tab screen: click an entry. A beer or the hot drink becomes Q's pick, a spirit goes in the spirit slot, a weapon or move is equipped. False if nothing changed. */
  selectItem(id: string | null): boolean;
  /** Tab screen: put a learned move of the slot's own level in a special slot, or clear it. False if refused. */
  assignMove(slot: SpecialSlotIndex, id: MoveId | null): boolean;
  /** Tab screen: equip an owned weapon. */
  assignWeapon(id: WeaponId): boolean;
  /** The bar's free hot drink is on offer (once per visit) and Andrew carries none. */
  hotDrinkOffered(): boolean;
  /** Take the free hot drink. False if refused. */
  takeHotDrink(id: HotDrinkId): boolean;
  /** Tab as toggle (default) or hold; kept with the save's settings. */
  tabMode(): TabMode;
  setTabMode(mode: TabMode): void;
  /**
   * A return to the bar is waiting for the scene: the world is frozen where Andrew was (`bar:returning`).
   * Call once, when the screen is black; it moves him to the bar, resets, and emits `bar:returned`.
   * The run also completes it by itself after a failsafe delay if the UI never does.
   */
  completeBarReturn(): void;
  /** The waiting return (reason and where Andrew fell), or null when none is waiting. */
  barReturning(): { readonly reason: BarReturnReason; readonly andrew: Vec2 } | null;
  mykoCallsLeft(): number;
  /** 0..1 progress of the M hold; 0 when not held. */
  mykoCallHoldProgress(): number;
  casebook(): readonly CasebookEntry[];
  currentObjective(): ObjectiveId | null;
  /** Current boss or set piece with a health bar, if one is running. */
  boss(): { readonly bossId: BossId; readonly health: Health } | null;
  /** Deduction board waiting for an answer, if one is open. */
  activeDeduction(): DeductionBoardDef | null;
  /** Returns whether the three links were correct. */
  submitDeduction(id: DeductionSectionId, evidence: readonly EvidenceId[]): boolean;
  /** Steps back from the open board without answering (to read the casebook). */
  closeDeduction(): void;
  /** A board Andrew stepped back from, still unanswered. */
  pendingDeduction(): boolean;
  /** Opens the board he stepped back from. */
  reopenDeduction(): void;
  /** Chapter 5 lightbox: the pick-three screen waiting for an answer, or null while it should be shut. */
  activeRedaction(): RedactionView | null;
  /** Chapter 5 lightbox: overlay three sheets (ids from the view). A right set solves the puzzle; a wrong one costs nothing; `refused` is not three held sheets. */
  submitRedaction(puzzleId: PuzzleSectionId, sheetIds: readonly string[]): RedactionTry;
  /** Chapter 5 lightbox: step back without answering. */
  closeRedaction(): void;
  /** Chapter 7 accuse screen: waiting for three names, or null while it should be shut. */
  activeTells(): TellsView | null;
  /** Chapter 7 accuse screen: the figures ticked so far (at most two; the third accuses). */
  tellsSelection(): readonly string[];
  /** Chapter 7 accuse screen: tick or untick a figure; the third tick accuses and returns the try, else null. */
  selectTells(puzzleId: PuzzleSectionId, figureId: string): TellsTry | null;
  /** Chapter 7 accuse screen: accuse three at once. `refused` is not three distinct examined figures. */
  submitTells(puzzleId: PuzzleSectionId, figureIds: readonly string[]): TellsTry;
  /** Chapter 7 accuse screen: step back without accusing. */
  closeTells(): void;
  /** Chapter 8: heat (`active`, `sunnyScreen`, `inSun`) for the HUD's sun mark. */
  heat(): HeatState;
  /** Chapter 8: Pruitt's flashbang, 0..1 white over the whole screen. */
  whiteoutAlpha(): number;
  /** The UI calls this when it has finished showing a sequence. */
  dialogueFinished(sequenceId: DialogueId): void;
  /** Stored save, for Continue and Chapter Select; null if none. */
  save(): OverhaulSaveState | null;
  audioSettings(): AudioSettings;
  setAudioSettings(settings: AudioSettings): void;
  newGame(): void;
  continueGame(): void;
  startChapter(chapter: ChapterNumber): void;
  pause(): void;
  resume(): void;
  quitToTitle(): void;
}
