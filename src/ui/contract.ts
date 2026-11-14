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
  Kit,
  DrunkLevelTable,
  Health,
  MeterSnapshot,
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
