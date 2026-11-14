/**
 * Melee weapons. DESIGN.md 7.2 "Melee". Plain TypeScript, no Phaser. Damage is
 * the weapon's own multiplied by the drunk level (7.1); quirks come from the
 * `WeaponDef` in tuning. `swing` advances the combo or hit counter and returns
 * what the swing does; the caller finds the targets and applies it.
 */

import { TUNING } from '../content/tuning';
import type { DrunkLevel, OverhaulTuning, WeaponDef, WeaponId } from '../core/types';

function tun(tuning?: OverhaulTuning): OverhaulTuning {
  const o = tuning ?? TUNING.overhaul;
  if (!o) throw new Error('TUNING.overhaul is missing');
  return o;
}

export const weaponDef = (id: WeaponId, tuning?: OverhaulTuning): WeaponDef => tun(tuning).weapons[id];

/** Melee multiplier for a level. Sober is the back-to-the-bar state, so it counts as x1. */
export function meleeMultiplier(level: DrunkLevel, tuning?: OverhaulTuning): number {
  return level === 0 ? 1 : tun(tuning).meleeMultiplierByLevel[level];
}

/** Base damage times the level multiplier. */
export function weaponDamage(id: WeaponId, level: DrunkLevel, tuning?: OverhaulTuning): number {
  return weaponDef(id, tuning).damage * meleeMultiplier(level, tuning);
}

/** What a swing does, ready for the caller to apply to whatever it hits. */
export interface SwingResult {
  readonly weaponId: WeaponId;
  readonly reach: number;
  readonly swingMs: number;
  /** After the level multiplier. */
  readonly damage: number;
  /** After any haymaker multiplier. */
  readonly knockback: number;
  /** 1-based place in the combo (fists), or in the stun count (wand); 1 for other weapons. */
  readonly comboIndex: number;
  /** Fists: the last hit of the combo. */
  readonly haymaker: boolean;
  /** Clipboard: the hit interrupts whatever the enemy was about to do. */
  readonly interrupts: boolean;
  /** Wand: stun on this hit, ms; 0 otherwise. */
  readonly stunMs: number;
  /** Umbrella: enemies the poke goes through; 1 for other weapons. */
  readonly pierceCount: number;
  /** Alien: the swing hits everything in this arc, degrees; 0 for other weapons. */
  readonly sweepArcDeg: number;
}

export interface WeaponState {
  readonly weapon: WeaponId;
  /** Swings in the current run (resets on a gap, a weapon change or after the combo ends). */
  readonly swings: number;
  /** Time since the last swing, ms. */
  readonly sinceLastMs: number;
}

export const createWeaponState = (weapon: WeaponId = 'fists'): WeaponState => ({ weapon, swings: 0, sinceLastMs: 0 });

/** Switching weapon resets the count. Same weapon changes nothing. */
export const switchWeapon = (state: WeaponState, weapon: WeaponId): WeaponState =>
  state.weapon === weapon ? state : createWeaponState(weapon);

/** Time passes. A gap longer than the combo window resets the count. */
export function tickWeapon(state: WeaponState, dtMs: number, tuning?: OverhaulTuning): WeaponState {
  if (state.swings === 0) return state;
  const sinceLastMs = state.sinceLastMs + dtMs;
  const window = tun(tuning).weaponComboWindowMs ?? 0;
  if (sinceLastMs > window) return { ...state, swings: 0, sinceLastMs: 0 };
  return { ...state, sinceLastMs };
}

/** Swing the current weapon at the given drunk level. */
export function swing(state: WeaponState, level: DrunkLevel, tuning?: OverhaulTuning): { state: WeaponState; result: SwingResult } {
  const def = weaponDef(state.weapon, tuning);
  const q = def.quirk;
  const swings = state.swings + 1;
  let comboIndex = 1;
  let haymaker = false;
  let stunMs = 0;
  let knockback = def.knockback;
  let next = swings;
  if (q.kind === 'combo') {
    comboIndex = swings;
    if (swings >= q.hits) {
      haymaker = true;
      knockback = def.knockback * q.finisherKnockbackMultiplier;
      next = 0;
    }
  } else if (q.kind === 'nthHitStuns') {
    comboIndex = swings;
    if (swings >= q.everyHits) {
      stunMs = q.stunMs;
      next = 0;
    }
  } else {
    next = 0;
  }
  const result: SwingResult = {
    weaponId: def.id,
    reach: def.reach,
    swingMs: def.swingMs,
    damage: weaponDamage(def.id, level, tuning),
    knockback,
    comboIndex,
    haymaker,
    interrupts: q.kind === 'interrupts',
    stunMs,
    pierceCount: q.kind === 'pierce' ? q.count : 1,
    sweepArcDeg: q.kind === 'sweep' ? q.arcDeg : 0,
  };
  return { state: { weapon: state.weapon, swings: next, sinceLastMs: 0 }, result };
}
