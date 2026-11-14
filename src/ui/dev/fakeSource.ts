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
  HotDrinkId,
  MoveId,
  OverhaulDrinkId,
  OverhaulSaveState,
  SpecialLevel,
  SpecialSlotIndex,
  TabMode,
  BarReturnReason,
  Vec2,
} from '../../core/types';
import { GameEvents } from '../../core/types';
import { assignDrink, assignMove, assignWeapon, drinkFromInventory, gainWeapon, learnMove, takeHotDrink } from '../../systems/kit';
import type { KitChange } from '../../systems/kit';
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

  /** Apply a kit function's result: keep the kit and say so on the bus. */
  private apply(r: KitChange): boolean {
    if (!r.changed) return false;
    this.kitState = r.kit;
    this.bus.emit(GameEvents.KitChanged, { kit: r.kit });
    this.syncSlots();
    return true;
  }
  /** Rebuild the four slot views from the kit and the meter level (keeps running cooldowns). */
  syncSlots(): void {
    const level = this.meter().level;
    const t = overhaulTuning();
    this.slots = ([1, 2, 3, 4] as const).map((slot) => {
      const id = this.kitState.slots.specials[slot - 1] ?? null;
      const old = this.slots.find((o) => o.slot === slot && o.moveId === id);
      return { slot, moveId: id, lit: id !== null && level >= slot, cooldownLeftMs: old?.cooldownLeftMs ?? 0, cooldownMs: id === null ? 0 : (t.moves[id]?.cooldownMs ?? 0) };
    });
  }
  /** Run the cooldowns down; the harness calls this every frame. */
  advance(ms: number): void {
    this.slots = this.slots.map((s) => (s.cooldownLeftMs > 0 ? { ...s, cooldownLeftMs: Math.max(0, s.cooldownLeftMs - ms) } : s));
  }
  /** Put the meter in the middle of a level (1..4) and settle the slots. */
  setLevelMiddle(level: SpecialLevel): void {
    const t = this.levelTable();
    const b = [t.buzzed, t.grand, t.bitMuch, t.fecked][level - 1];
    if (!b) return;
    const before = this.meter().level;
    this.buzzValue = Math.round((b.min + b.max) / 2);
    this.syncSlots();
    const m = this.meter();
    if (m.level !== before) this.bus.emit(GameEvents.BuzzLevelChanged, { from: before, to: m.level, state: m.state, value: m.value });
  }
  learn(id: MoveId): void {
    const r = learnMove(this.kitState, id, { autoAssign: true });
    if (this.apply(r) && r.learned) this.bus.emit(GameEvents.MoveLearned, { moveId: r.learned });
  }
  /** Learn, light and fire a move: its slot goes on cooldown and `move:used` is emitted. */
  fire(id: MoveId): void {
    this.learn(id);
    const def = overhaulTuning().moves[id];
    if (!def) return;
    this.setLevelMiddle(def.level);
    this.slots = this.slots.map((s) => (s.moveId === id ? { ...s, cooldownLeftMs: s.cooldownMs } : s));
    this.bus.emit(GameEvents.MoveUsed, { moveId: id, slot: def.level });
  }
  gain(id: WeaponId, select = true): void {
    const r = gainWeapon(this.kitState, id);
    if (this.apply(r) && r.gained) this.bus.emit(GameEvents.WeaponGained, { weaponId: r.gained });
    if (select) this.assignWeapon(id);
  }
  /** Where the fake Andrew "fell" (a point off the middle, so the smoke is seen to start there). */
  andrewAt: Vec2 = { x: 300, y: 150 };
  private waitingReturn: { readonly reason: BarReturnReason; readonly andrew: Vec2 } | null = null;
  /** Fire the return to the bar the way the game does: `bar:returning` now, the reset and `bar:returned` at `completeBarReturn`. */
  returnToBar(reason: BarReturnReason): void {
    if (this.waitingReturn !== null) return;
    this.waitingReturn = { reason, andrew: this.andrewAt };
    this.bus.emit(GameEvents.BarReturning, this.waitingReturn);
  }
  completeBarReturn(): void {
    const r = this.waitingReturn;
    if (r === null) return;
    this.waitingReturn = null;
    this.buzzValue = r.reason === 'sober' ? 0 : 20;
    this.hotOffer = true;
    this.bus.emit(GameEvents.BarReturned, { reason: r.reason });
  }
  barReturning = (): { readonly reason: BarReturnReason; readonly andrew: Vec2 } | null => this.waitingReturn;
  assignDrink = (id: OverhaulDrinkId | null): boolean => this.apply(assignDrink(this.kitState, id));
  assignMove = (slot: SpecialSlotIndex, id: MoveId | null): boolean => this.apply(assignMove(this.kitState, slot, id));
  assignWeapon = (id: WeaponId): boolean => this.apply(assignWeapon(this.kitState, id));
  drinkFromInventory(id: OverhaulDrinkId): boolean {
    const r = drinkFromInventory(this.kitState, id);
    if (r.consumed === null) return false;
    this.apply(r);
    this.bus.emit(GameEvents.DrinkConsumed, { drinkId: r.consumed });
    return true;
  }
  hotDrinkOffered = (): boolean => this.hotOffer && this.kitState.hotDrink === null;
  takeHotDrink(id: HotDrinkId): boolean {
    if (!this.hotDrinkOffered()) return false;
    const ok = this.apply(takeHotDrink(this.kitState, id));
    if (ok) this.hotOffer = false;
    return ok;
  }
  tabMode = (): TabMode => this.tabModeValue;
  setTabMode(mode: TabMode): void {
    this.tabModeValue = mode;
  }
  moveSlots = (): readonly MoveSlotView[] => this.slots;
  weapon = (): WeaponId => this.weaponId;
  aim: ThrowAim | null = null;
  tabModeValue: TabMode = 'toggle';
  hotOffer = true;
  throwPreview = (): ThrowAim | null => this.aim;
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
