/**
 * The overhaul Buzz meter. DESIGN.md 7.1. Pure logic: plain state objects and
 * pure step functions, no Phaser, no event bus. Every function returns the
 * next state plus the facts the caller needs to emit `buzz:levelChanged`,
 * `spirit:started` and `spirit:ended` and to start the return to the bar.
 *
 * Not wired in yet; the old `buzz.ts` still drives the game.
 */

import { TUNING } from '../content/tuning';
import { DRUNK_STATES } from '../core/types';
import type {
  BarReturnReason,
  BeerDef,
  ChapterNumber,
  DrunkLevel,
  DrunkLevelTable,
  DrunkState,
  HotDrinkDef,
  LevelBounds,
  MeterSnapshot,
  OverhaulDrinkId,
  OverhaulTuning,
  SpiritDef,
  SpiritId,
} from '../core/types';

/** The overhaul tuning, or a loud failure if it is missing. */
export function overhaulTuning(t: OverhaulTuning | undefined = TUNING.overhaul): OverhaulTuning {
  if (!t) throw new Error('TUNING.overhaul is missing');
  return t;
}

/** A running whiskey or tequila window. */
export interface SpiritWindow {
  readonly drinkId: SpiritId;
  readonly msLeft: number;
  /** Hits lower the meter at this multiple (2). */
  readonly hitMultiplier: number;
  /** Points lost when the window ends (tequila: 30). */
  readonly dropAfter: number;
}

/** A tea easing to its target, then holding with no drain. */
export interface TeaState {
  readonly phase: 'easing' | 'holding';
  /** Time left in the current phase. */
  readonly msLeft: number;
  /** Points per ms moved towards `target` while easing. */
  readonly ratePerMs: number;
  readonly target: number;
  /** How long the hold lasts once the ease is done. */
  readonly holdMs: number;
}

export interface MeterState {
  readonly chapter: ChapterNumber;
  readonly value: number;
  readonly inSun: boolean;
  readonly spirit: SpiritWindow | null;
  readonly tea: TeaState | null;
  /** Set once the meter hits 0 or the floor. The caller then returns to the bar. */
  readonly returnReason: BarReturnReason | null;
}

export type MeterEvent =
  | { readonly kind: 'levelChanged'; readonly from: DrunkLevel; readonly to: DrunkLevel; readonly state: DrunkState; readonly value: number }
  | { readonly kind: 'spiritStarted'; readonly drinkId: SpiritId; readonly durationMs: number }
  | { readonly kind: 'spiritEnded'; readonly drinkId: SpiritId };

export interface MeterResult {
  readonly state: MeterState;
  readonly events: readonly MeterEvent[];
  /** Set the moment this call took the meter to 0 or the floor; absent otherwise. */
  readonly returned?: BarReturnReason;
}

export const levelTable = (chapter: ChapterNumber, t: OverhaulTuning = overhaulTuning()): DrunkLevelTable => t.levels[chapter];

/** Value to level. 0 is sober; fractional values (drain) fall into the level below the next minimum. */
export function levelFor(value: number, table: DrunkLevelTable): DrunkLevel {
  if (value <= 0) return 0;
  if (value < table.grand.min) return 1;
  if (value < table.bitMuch.min) return 2;
  if (value < table.fecked.min) return 3;
  return 4;
}

export const stateFor = (level: DrunkLevel): DrunkState => DRUNK_STATES[level];

/** Bottom of Grand: where every chapter and every return to the bar starts. */
export const restValue = (chapter: ChapterNumber, t: OverhaulTuning = overhaulTuning()): number => levelBottom(levelTable(chapter, t), t.restLevel);

/** Lowest value of a level (level 0 is 0). */
export function levelBottom(table: DrunkLevelTable, level: DrunkLevel): number {
  return level === 0 ? 0 : levelBounds(table, level).min;
}

/** Highest value of a level. */
export function levelTop(table: DrunkLevelTable, level: DrunkLevel): number {
  return level === 0 ? 0 : levelBounds(table, level).max;
}

function levelBounds(table: DrunkLevelTable, level: 1 | 2 | 3 | 4): LevelBounds {
  switch (level) {
    case 1:
      return table.buzzed;
    case 2:
      return table.grand;
    case 3:
      return table.bitMuch;
    case 4:
      return table.fecked;
  }
}

export function createMeter(chapter: ChapterNumber, value?: number, t: OverhaulTuning = overhaulTuning()): MeterState {
  const floor = levelTable(chapter, t).floor;
  const v = clamp(value ?? restValue(chapter, t), 0, floor);
  return { chapter, value: v, inSun: false, spirit: null, tea: null, returnReason: null };
}

export function snapshot(s: MeterState, t: OverhaulTuning = overhaulTuning()): MeterSnapshot {
  const table = levelTable(s.chapter, t);
  const level = levelFor(s.value, table);
  return {
    value: s.value,
    level,
    state: stateFor(level),
    floor: table.floor,
    spiritActive: s.spirit !== null,
    teaHoldActive: s.tea?.phase === 'holding',
    inSun: s.inSun,
  };
}

export const setInSun = (s: MeterState, inSun: boolean): MeterState => (s.inSun === inSun ? s : { ...s, inSun });

/**
 * Move the value by `delta` (negative lowers it), clamp, and report the level
 * change and any return to the bar. Used by drinks, hits and the step.
 */
export function adjustMeter(s: MeterState, delta: number, t: OverhaulTuning = overhaulTuning()): MeterResult {
  return setValue(s, s.value + delta, t);
}

function setValue(s: MeterState, raw: number, t: OverhaulTuning, extraEvents: readonly MeterEvent[] = []): MeterResult {
  if (s.returnReason) return { state: s, events: extraEvents };
  const table = levelTable(s.chapter, t);
  const before = levelFor(s.value, table);
  const value = clamp(raw, 0, table.floor);
  const after = levelFor(value, table);
  const returned: BarReturnReason | undefined = value <= 0 ? 'sober' : value >= table.floor ? 'floor' : undefined;
  const events: MeterEvent[] = [...extraEvents];
  if (after !== before) events.push({ kind: 'levelChanged', from: before, to: after, state: stateFor(after), value });
  const state: MeterState = { ...s, value, returnReason: returned ?? null };
  return returned ? { state, events, returned } : { state, events };
}

/** Merge a follow-on result into an accumulated one. */
function chain(prev: MeterResult, next: MeterResult): MeterResult {
  const returned = next.returned ?? prev.returned;
  const events = [...prev.events, ...next.events];
  return returned ? { state: next.state, events, returned } : { state: next.state, events };
}

/** Whether the meter is draining right now. DESIGN.md 7.1: no drain in a spirit window or a tea hold or ease. */
export const isDraining = (s: MeterState): boolean => s.spirit === null && s.tea === null && s.returnReason === null;

export function drinkBeer(s: MeterState, def: BeerDef, t: OverhaulTuning = overhaulTuning()): MeterResult {
  const points = def.points * (s.inSun ? t.sun.beerMultiplier : 1);
  return adjustMeter(s, points, t);
}

export function drinkSpirit(s: MeterState, def: SpiritDef, t: OverhaulTuning = overhaulTuning()): MeterResult {
  if (s.returnReason) return { state: s, events: [] };
  const table = levelTable(s.chapter, t);
  // A second spirit ends the first window first (its drop lands) so tequila cannot be dodged.
  let acc: MeterResult = { state: s, events: [] };
  if (acc.state.spirit) acc = endSpirit(acc.state, t);
  if (acc.returned) return acc;
  const level = levelFor(acc.state.value, table);
  const target =
    def.jump.kind === 'middleOfLevel'
      ? midpoint(levelBounds(table, def.jump.level))
      : Math.max(acc.state.value, levelTop(table, nextLevel(level)));
  const durationMs = def.windowMs * (acc.state.inSun ? t.sun.spiritWindowMultiplier : 1);
  const window: SpiritWindow = { drinkId: def.id, msLeft: durationMs, hitMultiplier: def.hitMultiplier, dropAfter: def.dropAfterWindow ?? 0 };
  const started: MeterEvent = { kind: 'spiritStarted', drinkId: def.id, durationMs };
  const jumped = setValue({ ...acc.state, spirit: window, tea: null }, target, t, [started]);
  return chain(acc, jumped);
}

export function drinkHot(s: MeterState, def: HotDrinkDef, t: OverhaulTuning = overhaulTuning()): MeterResult {
  if (s.returnReason) return { state: s, events: [] };
  const target = restValue(s.chapter, t);
  const cleared: MeterState = { ...s, spirit: null, tea: null };
  if (def.reset.kind === 'instant') return setValue(cleared, target, t);
  const { easeMs, holdMs } = def.reset;
  const tea: TeaState = { phase: 'easing', msLeft: easeMs, ratePerMs: easeMs > 0 ? Math.abs(s.value - target) / easeMs : 0, target, holdMs };
  // With no ease time, jump straight to the hold.
  if (easeMs <= 0) return setValue({ ...cleared, tea: { ...tea, phase: 'holding', msLeft: holdMs } }, target, t);
  return setValue({ ...cleared, tea }, s.value, t);
}

/** Drink any drink by id. Throws on an id with no definition. */
export function drink(s: MeterState, id: OverhaulDrinkId, t: OverhaulTuning = overhaulTuning()): MeterResult {
  const def = t.drinks[id];
  switch (def.kind) {
    case 'beer':
      return drinkBeer(s, def, t);
    case 'spirit':
      return drinkSpirit(s, def, t);
    case 'hot':
      return drinkHot(s, def, t);
  }
}

function endSpirit(s: MeterState, t: OverhaulTuning): MeterResult {
  const w = s.spirit;
  if (!w) return { state: s, events: [] };
  const ended: MeterEvent = { kind: 'spiritEnded', drinkId: w.drinkId };
  return setValue({ ...s, spirit: null }, s.value - w.dropAfter, t, [ended]);
}

/** Advance `dtMs` of play: drain, spirit window, tea ease and hold. */
export function stepMeter(s: MeterState, dtMs: number, t: OverhaulTuning = overhaulTuning()): MeterResult {
  let acc: MeterResult = { state: s, events: [] };
  let left = Math.max(0, dtMs);
  // Each pass consumes a whole segment up to the next timer edge; at most a handful of edges exist.
  for (let guard = 0; left > 0 && guard < 8 && !acc.state.returnReason; guard++) {
    const cur = acc.state;
    if (cur.spirit) {
      const seg = Math.min(left, cur.spirit.msLeft);
      left -= seg;
      const remaining = cur.spirit.msLeft - seg;
      if (remaining > 0) {
        acc = { ...acc, state: { ...cur, spirit: { ...cur.spirit, msLeft: remaining } } };
      } else {
        acc = chain(acc, endSpirit({ ...cur, spirit: { ...cur.spirit, msLeft: 0 } }, t));
      }
    } else if (cur.tea) {
      const tea = cur.tea;
      const seg = Math.min(left, tea.msLeft);
      left -= seg;
      const remaining = tea.msLeft - seg;
      if (tea.phase === 'easing') {
        const toGo = tea.target - cur.value;
        const move = Math.sign(toGo) * Math.min(Math.abs(toGo), tea.ratePerMs * seg);
        const eased = remaining > 0 ? cur.value + move : tea.target;
        const next: TeaState | null = remaining > 0 ? { ...tea, msLeft: remaining } : tea.holdMs > 0 ? { ...tea, phase: 'holding', msLeft: tea.holdMs } : null;
        acc = chain(acc, setValue({ ...cur, tea: next }, eased, t));
      } else {
        acc = { ...acc, state: { ...cur, tea: remaining > 0 ? { ...tea, msLeft: remaining } : null } };
      }
    } else {
      const rate = t.drainPerSecond * (cur.inSun ? t.sun.drainMultiplier : 1);
      acc = chain(acc, setValue(cur, cur.value - (rate * left) / 1000, t));
      left = 0;
    }
  }
  return acc;
}

function nextLevel(level: DrunkLevel): 1 | 2 | 3 | 4 {
  // Sober (an already-returned meter) aims at the top of Buzzed; Bit much and Fecked top out at Fecked.
  return Math.min(4, level + 1) as 1 | 2 | 3 | 4;
}

const midpoint = (b: LevelBounds): number => (b.min + b.max) / 2;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
