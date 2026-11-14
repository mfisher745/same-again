/**
 * The four level-gated special slots and the thirteen moves. DESIGN.md 7.2.
 * Plain TypeScript, no Phaser. Slot n fires only at drunk level n or above.
 * Cooldowns run all the time, including while a slot is dark. Moves cost no
 * Buzz. `useSlot` returns a `MoveUse` that the caller applies to the world;
 * the helpers below resolve it against targets.
 */

import { TUNING } from '../content/tuning';
import type { DrunkLevel, MoveDef, MoveEffect, MoveId, OverhaulTuning, SpecialSlotIndex, Vec2 } from '../core/types';
import { angleDiff, angleTo, distance, fromAngle } from './geometry';

function tun(tuning?: OverhaulTuning): OverhaulTuning {
  const o = tuning ?? TUNING.overhaul;
  if (!o) throw new Error('TUNING.overhaul is missing');
  return o;
}

export const moveDef = (id: MoveId, tuning?: OverhaulTuning): MoveDef => tun(tuning).moves[id];

type Four<T> = readonly [T, T, T, T];

export interface MovesState {
  /** Milliseconds left on each slot's cooldown, slots 1 to 4. */
  readonly cooldownsMs: Four<number>;
  /** Same Again: melee hits still to land twice. */
  readonly repeat: { readonly hitsLeft: number; readonly times: number } | null;
  /** Second Opinion: the next hit on `targetId` does this multiple. */
  readonly mark: { readonly targetId: string | null; readonly damageMultiplier: number } | null;
  /** Act Natural: unseen until he moves. */
  readonly hidden: boolean;
}

export const createMovesState = (): MovesState => ({ cooldownsMs: [0, 0, 0, 0], repeat: null, mark: null, hidden: false });

/** A slot works at its own level or higher. Sober has no slots. */
export const slotWorks = (slot: SpecialSlotIndex, level: DrunkLevel): boolean => level >= slot;

/** Time passes. Every cooldown runs, lit or dark. */
export function tickMoves(state: MovesState, dtMs: number): MovesState {
  const c = state.cooldownsMs.map((ms) => Math.max(0, ms - dtMs)) as unknown as Four<number>;
  return { ...state, cooldownsMs: c };
}

export const cooldownLeft = (state: MovesState, slot: SpecialSlotIndex): number => state.cooldownsMs[slot - 1] as number;

export type MoveRefusal = 'empty' | 'dark' | 'cooldown' | 'noTarget' | 'noProp' | 'seen';

/** What the caller needs to know about the moment of use. */
export interface MoveContext {
  /** Something valid stands where a single-target move aims (Reflex Test, Second Opinion, One for the Road, Barred). */
  readonly hasTarget?: boolean;
  /** Id of that target, kept for Second Opinion's mark. */
  readonly targetId?: string;
  /** Andrew is beside a prop (Act Natural). */
  readonly besideProp?: boolean;
  /** A guard has seen him (Act Natural does nothing then). */
  readonly seenByGuard?: boolean;
}

/** The result of firing a move; shaped for `move:used`. */
export interface MoveUse {
  readonly moveId: MoveId;
  readonly slot: SpecialSlotIndex;
  readonly level: DrunkLevel;
  readonly cooldownMs: number;
  /** The tuned effect; switch on `effect.kind` to apply it. */
  readonly effect: MoveEffect;
  /** Second Opinion: who was marked. */
  readonly targetId: string | null;
}

export type UseOutcome =
  | { readonly ok: true; readonly use: MoveUse }
  | { readonly ok: false; readonly refusal: MoveRefusal };

const NEEDS_TARGET: ReadonlySet<MoveEffect['kind']> = new Set(['stagger', 'markTarget', 'finisher', 'throwOut']);

/** The `move:used` payload. */
export const moveUsedPayload = (use: MoveUse): { readonly moveId: MoveId; readonly slot: SpecialSlotIndex } => ({ moveId: use.moveId, slot: use.slot });

/**
 * Press slot `slot`. `specials` is `kit.slots.specials`; `level` is Andrew's
 * current level. A refusal costs nothing and starts no cooldown.
 */
export function useSlot(
  state: MovesState,
  specials: Four<MoveId | null>,
  slot: SpecialSlotIndex,
  level: DrunkLevel,
  ctx: MoveContext = {},
  tuning?: OverhaulTuning,
): { state: MovesState; outcome: UseOutcome } {
  const refuse = (refusal: MoveRefusal): { state: MovesState; outcome: UseOutcome } => ({ state, outcome: { ok: false, refusal } });
  const id = specials[slot - 1];
  if (id === null || id === undefined) return refuse('empty');
  if (!slotWorks(slot, level)) return refuse('dark');
  if (cooldownLeft(state, slot) > 0) return refuse('cooldown');
  const def = moveDef(id, tuning);
  const e = def.effect;
  if (NEEDS_TARGET.has(e.kind) && !ctx.hasTarget) return refuse('noTarget');
  if (e.kind === 'hideBesideProp') {
    if (ctx.seenByGuard) return refuse('seen');
    if (!ctx.besideProp) return refuse('noProp');
  }

  const cooldownsMs = state.cooldownsMs.map((ms, i) => (i === slot - 1 ? def.cooldownMs : ms)) as unknown as Four<number>;
  let next: MovesState = { ...state, cooldownsMs };
  let targetId: string | null = null;
  if (e.kind === 'repeatHits') next = { ...next, repeat: { hitsLeft: e.hits, times: e.times } };
  else if (e.kind === 'markTarget') {
    targetId = ctx.targetId ?? null;
    next = { ...next, mark: { targetId, damageMultiplier: e.damageMultiplier } };
  } else if (e.kind === 'hideBesideProp') next = { ...next, hidden: true };

  return { state: next, outcome: { ok: true, use: { moveId: id, slot, level, cooldownMs: def.cooldownMs, effect: e, targetId } } };
}

/** Same Again: one melee hit lands. Returns how many times it counts (1 when no repeat is running). */
export function consumeRepeat(state: MovesState): { state: MovesState; times: number } {
  const r = state.repeat;
  if (!r) return { state, times: 1 };
  const left = r.hitsLeft - 1;
  return { state: { ...state, repeat: left > 0 ? { ...r, hitsLeft: left } : null }, times: r.times };
}

/** Second Opinion: a hit lands on `targetId`. The mark is spent by that hit, and only by that target. */
export function consumeMark(state: MovesState, targetId: string): { state: MovesState; multiplier: number } {
  const m = state.mark;
  if (!m || (m.targetId !== null && m.targetId !== targetId)) return { state, multiplier: 1 };
  return { state: { ...state, mark: null }, multiplier: m.damageMultiplier };
}

/** Act Natural ends when Andrew moves, or when a guard sees him. */
export const breakHide = (state: MovesState): MovesState => (state.hidden ? { ...state, hidden: false } : state);

/** A candidate for area selection. */
export interface MoveCandidate {
  readonly id: string;
  readonly pos: Vec2;
}

/**
 * Who an area effect reaches. `facingDeg` is Andrew's facing in degrees.
 * Circle effects (Stout Slam, Bedside Manner, Lock-in), the cone (Borrowed
 * Glove), the lurch line (The Stumble) and the charge (first in the way) are
 * handled; single-target moves and Last Orders (everyone on screen) return
 * every candidate or none as noted.
 */
export function selectTargets(effect: MoveEffect, origin: Vec2, facingDeg: number, candidates: readonly MoveCandidate[]): string[] {
  switch (effect.kind) {
    case 'knockdownAround':
    case 'calmAround':
    case 'holdAround':
      return candidates.filter((c) => distance(origin, c.pos) <= effect.radius).map((c) => c.id);
    case 'stunCone':
      return candidates
        .filter((c) => distance(origin, c.pos) <= effect.range && Math.abs(angleDiff(facingDeg, angleTo(origin, c.pos))) <= effect.angleDeg / 2)
        .map((c) => c.id);
    case 'lurch': {
      const dir = fromAngle(facingDeg);
      return candidates
        .filter((c) => {
          const dx = c.pos.x - origin.x;
          const dy = c.pos.y - origin.y;
          const along = dx * dir.x + dy * dir.y;
          const across = Math.abs(-dx * dir.y + dy * dir.x);
          return along >= 0 && along <= effect.distance && across <= effect.width / 2;
        })
        .map((c) => c.id);
    }
    case 'charge': {
      const dir = fromAngle(facingDeg);
      let best: { id: string; along: number } | null = null;
      for (const c of candidates) {
        const dx = c.pos.x - origin.x;
        const dy = c.pos.y - origin.y;
        const along = dx * dir.x + dy * dir.y;
        const across = Math.abs(-dx * dir.y + dy * dir.x);
        if (along >= 0 && along <= effect.distance && across <= 12 && (!best || along < best.along)) best = { id: c.id, along };
      }
      return best ? [best.id] : [];
    }
    case 'screenWipe':
      return candidates.map((c) => c.id);
    default:
      return [];
  }
}

/** A thing a move hits, for the health-based effects. */
export interface MoveTarget {
  readonly boss: boolean;
  readonly health: number;
  readonly maxHealth: number;
}

export interface TargetOutcome {
  /** Health to remove. */
  readonly damage: number;
  /** The target is finished or thrown out of the fight. */
  readonly removed: boolean;
  readonly stunMs: number;
  /** Damage dealt to anyone the thrown enemy lands on (Barred). */
  readonly landingDamage: number;
}

/**
 * One for the Road, Last Orders and Barred against one target. An ordinary
 * enemy is finished (One for the Road), left with a sliver and stunned (Last
 * Orders) or thrown out (Barred). A boss loses a fraction of its maximum
 * (One for the Road a third, Last Orders a fifth) or takes `bossDamage`
 * (Barred, which cannot lift it). Other effects return no damage.
 */
export function resolveOnTarget(effect: MoveEffect, target: MoveTarget): TargetOutcome {
  const none: TargetOutcome = { damage: 0, removed: false, stunMs: 0, landingDamage: 0 };
  switch (effect.kind) {
    case 'finisher':
      return target.boss
        ? { ...none, damage: Math.min(target.health, target.maxHealth * effect.bossFraction) }
        : { ...none, damage: target.health, removed: true };
    case 'screenWipe':
      return target.boss
        ? { ...none, damage: Math.min(target.health, target.maxHealth * effect.bossFraction) }
        : { ...none, damage: Math.max(0, target.health - target.maxHealth * effect.leaveHealthFraction), stunMs: effect.stunMs };
    case 'throwOut':
      return target.boss
        ? { ...none, damage: Math.min(target.health, effect.bossDamage) }
        : { ...none, damage: target.health, removed: true, landingDamage: effect.landingDamage };
    default:
      return none;
  }
}
