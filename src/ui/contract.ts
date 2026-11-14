/**
 * What the UI needs from the game. Systems-dev implements this at merge; the
 * dev harness in `src/ui/dev/` implements it with fake data.
 */

import type {
  AudioSettings,
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
  OverhaulDrinkId,
  SpecialSlotIndex,
  TabMode,
  DrunkLevelTable,
  Health,
  MeterSnapshot,
  MoveId,
  ObjectiveId,
  OverhaulSaveState,
  MoveSlotView,
  ThrowAim,
  TextId,
  WeaponId,
} from '../core/types';

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
  /** Tab screen: put a held drink in the drink slot, or clear it. False if refused. */
  assignDrink(id: OverhaulDrinkId | null): boolean;
  /** Tab screen: put a learned move of the slot's own level in a special slot, or clear it. False if refused. */
  assignMove(slot: SpecialSlotIndex, id: MoveId | null): boolean;
  /** Tab screen: equip an owned weapon. */
  assignWeapon(id: WeaponId): boolean;
  /** Tab screen: drink any held drink straight from the inventory. */
  drinkFromInventory(id: OverhaulDrinkId): boolean;
  /** The bar's free hot drink is on offer (once per visit) and Andrew carries none. */
  hotDrinkOffered(): boolean;
  /** Take the free hot drink. False if refused. */
  takeHotDrink(id: HotDrinkId): boolean;
  /** Tab as toggle (default) or hold; kept with the save's settings. */
  tabMode(): TabMode;
  setTabMode(mode: TabMode): void;
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
