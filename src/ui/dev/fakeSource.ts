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
  PuzzleSectionId,
  ProofId,
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
import { assignMove, assignWeapon, gainWeapon, holds, learnMove, selectItem, takeHotDrink, useSelected, useSpirit } from '../../systems/kit';
import type { KitChange } from '../../systems/kit';
import { levelFor, overhaulTuning, stateFor } from '../../systems/meter';
import type { BroadcastView, PlugTry } from '../../systems/broadcast';
import type { EpilogueCard } from '../../systems/epilogue';
import type { HeatState } from '../../systems/heat';
import type { RedactionTry, RedactionView } from '../../systems/redaction';
import type { TellsTry, TellsView } from '../../systems/tells';
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
    slots: { drink: 'stout', spirit: null, specials: [null, null, null, null], melee: 'fists' },
    selectedItem: null,
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
  selectItem = (id: string | null): boolean => this.apply(selectItem(this.kitState, id));
  assignMove = (slot: SpecialSlotIndex, id: MoveId | null): boolean => this.apply(assignMove(this.kitState, slot, id));
  assignWeapon = (id: WeaponId): boolean => this.apply(assignWeapon(this.kitState, id));
  /** Dev and test helper: pick it, then use it (Q, or G for a spirit). */
  drinkFromInventory(id: OverhaulDrinkId): boolean {
    if (!holds(this.kitState, id)) return false;
    this.selectItem(id);
    const r = id === 'whiskey' || id === 'tequila' ? useSpirit(this.kitState) : useSelected(this.kitState);
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
  activeDeduction = (): DeductionBoardDef | null => (this.boardShut ? null : this.board);
  private boardShut = false;
  closeDeduction = (): void => {
    this.boardShut = true;
  };
  pendingDeduction = (): boolean => this.boardShut && this.board !== null;
  reopenDeduction = (): void => {
    this.boardShut = false;
  };
  submitDeduction(id: DeductionSectionId, evidence: readonly EvidenceId[]): boolean {
    const board = this.board;
    const ok = board !== null && board.solution.every((s) => evidence.includes(s));
    this.log.push(`submit ${id} ${evidence.join(',')} -> ${String(ok)}`);
    if (ok) this.board = null;
    return ok;
  }
  /** The lightbox view the harness shows; null keeps it shut. */
  redaction: RedactionView | null = null;
  /** The three sheets that make the full sentence. */
  redactionCorrect: readonly string[] = ['sheet1', 'sheet3', 'sheet4'];
  activeRedaction = (): RedactionView | null => this.redaction;
  closeRedaction = (): void => {
    this.redaction = null;
  };
  submitRedaction(puzzleId: PuzzleSectionId, sheetIds: readonly string[]): RedactionTry {
    const view = this.redaction;
    const held = view !== null && new Set(sheetIds).size === 3 && sheetIds.every((id) => view.sheets.some((s) => s.id === id && s.collected));
    const correct = held && this.redactionCorrect.every((id) => sheetIds.includes(id));
    this.log.push(`redact ${puzzleId} ${sheetIds.join(',')} -> ${String(correct)}`);
    if (correct) this.redaction = null;
    return { correct, textId: correct ? 'c5.redacted.right' : 'c5.redacted.wrong', refused: !held };
  }
  /** The accuse screen's view the harness shows; null keeps it shut. */
  tells: TellsView | null = null;
  /** The three that are aliens. */
  tellsCorrect: readonly string[] = ['b', 'd', 'gary'];
  private tellsPicked: string[] = [];
  activeTells = (): TellsView | null => this.tells;
  tellsSelection = (): readonly string[] => this.tellsPicked;
  closeTells = (): void => {
    this.tells = null;
    this.tellsPicked = [];
  };
  submitTells(puzzleId: PuzzleSectionId, figureIds: readonly string[]): TellsTry {
    const view = this.tells;
    const held = view !== null && new Set(figureIds).size === 3 && figureIds.length === 3 && figureIds.every((id) => view.figures.some((f) => f.id === id && f.examined));
    const correct = held && this.tellsCorrect.every((id) => figureIds.includes(id));
    this.log.push(`accuse ${puzzleId} ${figureIds.join(',')} -> ${String(correct)}`);
    this.tellsPicked = [];
    if (correct) this.tells = null;
    return { correct, textId: correct ? 'c7.tells.right' : 'c7.tells.wrong', refused: !held };
  }
  selectTells(puzzleId: PuzzleSectionId, figureId: string): TellsTry | null {
    const view = this.tells;
    if (view === null || !view.figures.some((f) => f.id === figureId && f.examined)) return null;
    const at = this.tellsPicked.indexOf(figureId);
    if (at >= 0) {
      this.tellsPicked.splice(at, 1);
      return null;
    }
    this.tellsPicked.push(figureId);
    if (this.tellsPicked.length < 3) return null;
    return this.submitTells(puzzleId, [...this.tellsPicked]);
  }
  /** The console view the harness shows; null keeps it shut. Sockets 4 and 5 look alike until examined (as in the chapter). */
  broadcast: BroadcastView | null = null;
  /** Which proof goes in which socket, for `plugProof`. */
  broadcastSolution: Readonly<Record<string, ProofId>> = { s1: 'c9.proof.log', s2: 'c9.proof.contract', s3: 'c9.proof.craft', s4: 'c9.proof.directory', s5: 'c9.proof.footage' };
  activeBroadcast = (): BroadcastView | null => this.broadcast;
  plugProof(puzzleId: PuzzleSectionId, proofId: ProofId, socketId: string): PlugTry {
    const view = this.broadcast;
    const socket = view?.sockets.find((s) => s.id === socketId);
    const plug = view?.plugs.find((p) => p.proofId === proofId);
    this.log.push(`plug ${puzzleId} ${proofId} ${socketId}`);
    if (!view || !socket || !plug) return { ok: false, refusal: 'unknown' };
    if (socket.plugged !== null) return { ok: false, refusal: 'occupied' };
    if (plug.placed) return { ok: false, refusal: 'alreadyPlugged' };
    if (this.broadcastSolution[socketId] !== proofId) return { ok: false, refusal: 'wrongShape', textId: 'c10.broadcast.wrong' };
    const sockets = view.sockets.map((s) => (s.id === socketId ? { ...s, plugged: proofId, shown: this.broadcastShapes[s.id] ?? s.shown } : s));
    const plugs = view.plugs.map((p) => (p.proofId === proofId ? { ...p, placed: true } : p));
    this.broadcast = { ...view, sockets, plugs, ready: sockets.every((s) => s.plugged !== null) };
    return { ok: true };
  }
  /** The real shape of each socket, revealed on examine or plug. */
  broadcastShapes: Readonly<Record<string, string>> = { s1: 'triangle', s2: 'square', s3: 'circle', s4: 'notched', s5: 'twinHole' };
  examineSocket(puzzleId: PuzzleSectionId, socketId: string): boolean {
    const view = this.broadcast;
    const socket = view?.sockets.find((s) => s.id === socketId);
    this.log.push(`examine ${puzzleId} ${socketId}`);
    if (!view || !socket || socket.examined) return false;
    this.broadcast = { ...view, sockets: view.sockets.map((s) => (s.id === socketId ? { ...s, examined: true, shown: this.broadcastShapes[s.id] ?? s.shown } : s)) };
    return true;
  }
  pressBroadcast(puzzleId: PuzzleSectionId): boolean {
    const view = this.broadcast;
    this.log.push(`press ${puzzleId}`);
    if (!view || !view.ready || view.pressed) return false;
    this.broadcast = { ...view, pressed: true };
    return true;
  }
  /** The card the harness shows; null keeps the card scene shut. */
  card: { index: number; total: number; card: EpilogueCard } | null = null;
  activeCard = (): { readonly index: number; readonly total: number; readonly card: EpilogueCard } | null => this.card;
  advanceCard(): void {
    this.log.push('advanceCard');
    this.card = null;
  }
  /** Chapter 8: what the HUD's sun mark reads, and the flashbang's white. */
  heatState: HeatState = { active: false, sunnyScreen: false, inSun: false };
  whiteout = 0;
  heat = (): HeatState => this.heatState;
  whiteoutAlpha = (): number => this.whiteout;
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

/** A fresh console as chapter 10 lays it out: five sockets (the square and the notched look alike) and five proofs held. */
export function sampleBroadcastView(): BroadcastView {
  const sockets = [
    { id: 's1', examinableId: 'c10.channel.1', shown: 'triangle', examined: false, ambiguous: false, plugged: null },
    { id: 's2', examinableId: 'c10.channel.2', shown: 'square', examined: false, ambiguous: true, plugged: null },
    { id: 's3', examinableId: 'c10.channel.3', shown: 'circle', examined: false, ambiguous: false, plugged: null },
    { id: 's4', examinableId: 'c10.channel.4', shown: 'square', examined: false, ambiguous: true, plugged: null },
    { id: 's5', examinableId: 'c10.channel.5', shown: 'twinHole', examined: false, ambiguous: false, plugged: null },
  ] as const;
  const plugs = [
    { proofId: 'c9.proof.craft', shape: 'circle' },
    { proofId: 'c9.proof.contract', shape: 'square' },
    { proofId: 'c9.proof.directory', shape: 'notched' },
    { proofId: 'c9.proof.log', shape: 'triangle' },
    { proofId: 'c9.proof.footage', shape: 'twinHole' },
  ] as const;
  return { sockets: [...sockets], plugs: plugs.map((p) => ({ ...p, owned: true, placed: false })), ready: false, pressed: false };
}
