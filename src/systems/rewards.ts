/**
 * Stealth: clean-run rewards and footstep noise. DESIGN.md 7.3. Plain
 * TypeScript. A clean run is rewarded, never required. Each stealth section
 * has one reward, granted once; the result tells the caller what to apply to
 * the kit, the casebook or the opened shortcuts. Never a hot drink.
 */

import { TUNING } from '../content/tuning';
import type {
  CarriedDrinkId,
  ClueId,
  CleanRunRewardDef,
  DrunkLevel,
  Kit,
  OverhaulTuning,
  ShortcutId,
  StealthSectionId,
} from '../core/types';
import { pickUpDrink } from './kit';
import type { KitChange } from './kit';

/** What the caller applies. */
export type RewardGrant =
  | { readonly kind: 'clue'; readonly clueId: ClueId }
  | { readonly kind: 'drink'; readonly drinkId: CarriedDrinkId }
  | { readonly kind: 'shortcut'; readonly shortcutId: ShortcutId }
  | { readonly kind: 'drinkFromHome'; readonly drinkId: CarriedDrinkId };

export type RewardRefusal = 'notClean' | 'alreadyGranted' | 'noReward' | 'invalidReward';

export interface RewardState {
  /** Sections whose reward has been given (the save's `cleanStealthRunIds`). */
  readonly granted: readonly StealthSectionId[];
}

export const createRewardState = (granted: readonly StealthSectionId[] = []): RewardState => ({ granted });

const CARRIED: readonly string[] = ['stout', 'lager', 'lightBeer', 'craftIpa', 'whiskey', 'tequila'];

/**
 * A stealth section ended. `clean` is true when the alarm never went off.
 * Granted once per section; a second clean run of the same section gives
 * nothing. A reward naming coffee or tea (or anything not carried) is refused.
 */
export function claimReward(
  state: RewardState,
  sectionId: StealthSectionId,
  reward: CleanRunRewardDef | undefined,
  clean: boolean,
): { state: RewardState; grant: RewardGrant | null; refusal: RewardRefusal | null } {
  const no = (refusal: RewardRefusal): { state: RewardState; grant: null; refusal: RewardRefusal } => ({ state, grant: null, refusal });
  if (!reward) return no('noReward');
  if (!clean) return no('notClean');
  if (state.granted.includes(sectionId)) return no('alreadyGranted');
  if ((reward.kind === 'drink' || reward.kind === 'drinkFromHome') && !CARRIED.includes(reward.drinkId)) return no('invalidReward');
  let grant: RewardGrant;
  switch (reward.kind) {
    case 'clue':
      grant = { kind: 'clue', clueId: reward.clueId };
      break;
    case 'drink':
      grant = { kind: 'drink', drinkId: reward.drinkId };
      break;
    case 'shortcut':
      grant = { kind: 'shortcut', shortcutId: reward.shortcutId };
      break;
    case 'drinkFromHome':
      grant = { kind: 'drinkFromHome', drinkId: reward.drinkId };
      break;
  }
  return { state: { granted: [...state.granted, sectionId] }, grant, refusal: null };
}

/** Put a drink reward in the kit. Other kinds change nothing here. A full kit refuses; the caller leaves the drink on the ground. */
export function applyDrinkReward(kit: Kit, grant: RewardGrant): KitChange {
  if (grant.kind !== 'drink' && grant.kind !== 'drinkFromHome') return { kit, changed: false, refusal: 'unchanged' };
  return pickUpDrink(kit, grant.drinkId);
}

/** Add a shortcut to the opened list. Opening twice changes nothing. */
export function openShortcut(opened: readonly ShortcutId[], id: ShortcutId): readonly ShortcutId[] {
  return opened.includes(id) ? opened : [...opened, id];
}

/**
 * Radius of the noise Andrew's footsteps make, by level. Walking is louder from
 * Bit much; sneaking is silent until Fecked, when it can be heard at short range.
 */
export function footstepNoiseRadius(level: DrunkLevel, sneaking: boolean, tuning?: OverhaulTuning): number {
  const o = tuning ?? TUNING.overhaul;
  const table = sneaking ? o?.sneakNoiseRadiusByLevel : o?.footstepNoiseRadiusByLevel;
  if (!table) throw new Error('TUNING.overhaul footstep noise tables are missing');
  return table[level];
}
