/** A fake `UiStateSource` for the dev harness. All state is public and mutable. */

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
  GameEventName,
  GameEventPayloads,
  DrunkLevelTable,
  Health,
  MeterSnapshot,
  MoveSlotView,
  TextId,
  ThrowAim,
  WeaponId,
  ObjectiveId,
  Kit,
  OverhaulSaveState,
} from '../../core/types';
import { levelFor, overhaulTuning, stateFor } from '../../systems/meter';
import type { UiStateSource } from '../contract';

export class FakeBus implements GameEventBus {
  private readonly handlers = new Map<string, Array<(payload: never) => void>>();

  emit<K extends GameEventName>(event: K, payload: GameEventPayloads[K]): void {
    for (const h of this.handlers.get(event) ?? []) (h as (p: GameEventPayloads[K]) => void)(payload);
  }

  on<K extends GameEventName>(event: K, handler: (payload: GameEventPayloads[K]) => void): () => void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler as (payload: never) => void);
    this.handlers.set(event, list);
    return () => {
      const i = list.indexOf(handler as (payload: never) => void);
      if (i >= 0) list.splice(i, 1);
    };
  }
}


export class FakeSource implements UiStateSource {
  readonly bus = new FakeBus();
  /** The meter value; the level, state and floor follow from the chapter 1 table. */
  buzzValue = 45;
  spiritActive = false;
  teaHoldActive = false;
  inSun = false;
  kitState: Kit = {
    drinks: { stout: 3, whiskey: 1 },
    carryLimit: 6,
    hotDrink: null,
    bottles: 4,
    weapons: ['fists'],
    moves: [],
    slots: { drink: 'stout', specials: [null, null, null, null], melee: 'fists' },
  };
  slots: MoveSlotView[] = [
    { slot: 1, moveId: 'shoulder', lit: true, cooldownLeftMs: 0, cooldownMs: 5000 },
    { slot: 2, moveId: 'stoutSlam', lit: true, cooldownLeftMs: 3000, cooldownMs: 12000 },
    { slot: 3, moveId: null, lit: false, cooldownLeftMs: 0, cooldownMs: 0 },
    { slot: 4, moveId: null, lit: false, cooldownLeftMs: 0, cooldownMs: 0 },
  ];
  weaponId: WeaponId = 'fists';
  lastRefusal: { textId: TextId; seq: number } | null = null;
  callsLeft = 2;
  holdProgress = 0;
  entries: CasebookEntry[] = [];
  bossState: { bossId: BossId; health: Health } | null = null;
  board: DeductionBoardDef | null = null;
  saveState: OverhaulSaveState | null = null;
  settings: AudioSettings = { musicVolume: 0.7, effectsVolume: 0.8 };
  paused = false;
  log: string[] = [];

  levelTable = (): DrunkLevelTable => overhaulTuning().levels[1];
  meter = (): MeterSnapshot => {
    const table = this.levelTable();
    const level = levelFor(this.buzzValue, table);
    return {
      value: this.buzzValue,
      level,
      state: stateFor(level),
      floor: table.floor,
      spiritActive: this.spiritActive,
      teaHoldActive: this.teaHoldActive,
      inSun: this.inSun,
    };
  };
  kit = (): Kit => this.kitState;
  moveSlots = (): readonly MoveSlotView[] => this.slots;
  weapon = (): WeaponId => this.weaponId;
  throwPreview = (): ThrowAim | null => null;
  refusal = (): { textId: TextId; seq: number } | null => this.lastRefusal;
  mykoCallsLeft = (): number => this.callsLeft;
  mykoCallHoldProgress = (): number => this.holdProgress;
  casebook = (): readonly CasebookEntry[] => this.entries;
  currentObjective = (): ObjectiveId | null => null;
  boss = (): { bossId: BossId; health: Health } | null => this.bossState;
  activeDeduction = (): DeductionBoardDef | null => this.board;
  submitDeduction(id: DeductionSectionId, evidence: readonly EvidenceId[]): boolean {
    const board = this.board;
    const ok = board !== null && board.solution.every((s) => evidence.includes(s));
    this.log.push(`submit ${id} ${evidence.join(',')} -> ${String(ok)}`);
    if (ok) this.board = null;
    return ok;
  }
  dialogueFinished(id: DialogueId): void {
    this.log.push(`finished ${id}`);
    this.bus.emit('dialogue:finished', { sequenceId: id });
  }
  save = (): OverhaulSaveState | null => this.saveState;
  audioSettings = (): AudioSettings => this.settings;
  setAudioSettings(s: AudioSettings): void {
    this.settings = s;
  }
  newGame(): void {
    this.log.push('newGame');
  }
  continueGame(): void {
    this.log.push('continueGame');
  }
  startChapter(c: ChapterNumber): void {
    this.log.push(`startChapter ${c}`);
  }
  pause(): void {
    this.paused = true;
    this.log.push('pause');
  }
  resume(): void {
    this.paused = false;
    this.log.push('resume');
  }
  quitToTitle(): void {
    this.log.push('quitToTitle');
  }
}
