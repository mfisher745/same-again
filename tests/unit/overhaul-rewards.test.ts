/** DESIGN.md 7.3: clean-run rewards and footstep noise by level. */

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/content/tuning';
import type { ClueId, CleanRunRewardDef, StealthSectionId } from '../../src/core/types';
import { createKit, pickUpDrink } from '../../src/systems/kit';
import { applyDrinkReward, claimReward, createRewardState, footstepNoiseRadius, openShortcut } from '../../src/systems/rewards';

const sec = (s: string): StealthSectionId => s as StealthSectionId;
const clue = 'c1.clue.note' as ClueId;
const defs: CleanRunRewardDef[] = [
  { kind: 'clue', clueId: clue },
  { kind: 'drink', drinkId: 'whiskey' },
  { kind: 'shortcut', shortcutId: 'c1.gate' },
  { kind: 'drinkFromHome', drinkId: 'stout' },
];

describe('rewards: the four kinds', () => {
  it('grants each kind on a clean run', () => {
    for (const def of defs) {
      const r = claimReward(createRewardState(), sec('c1.stealth.a'), def, true);
      expect(r.refusal).toBeNull();
      expect(r.grant).toMatchObject({ kind: def.kind });
      expect(r.state.granted).toEqual(['c1.stealth.a']);
    }
  });

  it('carries the payload through', () => {
    expect(claimReward(createRewardState(), sec('s'), defs[0], true).grant).toEqual({ kind: 'clue', clueId: clue });
    expect(claimReward(createRewardState(), sec('s'), defs[1], true).grant).toEqual({ kind: 'drink', drinkId: 'whiskey' });
    expect(claimReward(createRewardState(), sec('s'), defs[2], true).grant).toEqual({ kind: 'shortcut', shortcutId: 'c1.gate' });
    expect(claimReward(createRewardState(), sec('s'), defs[3], true).grant).toEqual({ kind: 'drinkFromHome', drinkId: 'stout' });
  });

  it('gives nothing when the run was not clean, and does not use up the reward', () => {
    const r = claimReward(createRewardState(), sec('s'), defs[1], false);
    expect(r).toMatchObject({ grant: null, refusal: 'notClean' });
    expect(r.state.granted).toEqual([]);
    expect(claimReward(r.state, sec('s'), defs[1], true).grant).not.toBeNull();
  });

  it('grants once per section', () => {
    const first = claimReward(createRewardState(), sec('s'), defs[1], true);
    const again = claimReward(first.state, sec('s'), defs[1], true);
    expect(again).toMatchObject({ grant: null, refusal: 'alreadyGranted' });
    expect(claimReward(first.state, sec('t'), defs[1], true).grant).not.toBeNull();
  });

  it('a section with no reward gives nothing', () => {
    expect(claimReward(createRewardState(), sec('s'), undefined, true).refusal).toBe('noReward');
  });

  it('never grants coffee or tea', () => {
    // 'as never' forges a bad definition the types already forbid.
    for (const drinkId of ['coffee', 'tea']) {
      const bad = { kind: 'drink', drinkId } as never;
      expect(claimReward(createRewardState(), sec('s'), bad, true)).toMatchObject({ grant: null, refusal: 'invalidReward' });
      const bad2 = { kind: 'drinkFromHome', drinkId } as never;
      expect(claimReward(createRewardState(), sec('s'), bad2, true).refusal).toBe('invalidReward');
    }
  });
});

describe('rewards: applying', () => {
  it('a drink reward goes into the kit', () => {
    const g = claimReward(createRewardState(), sec('s'), defs[1], true).grant!;
    const r = applyDrinkReward(createKit(), g);
    expect(r.kit.drinks.whiskey).toBe(1);
  });

  it('a full kit refuses the drink so the caller can leave it on the ground', () => {
    let k = createKit();
    for (let i = 0; i < 6; i++) k = pickUpDrink(k, 'lager').kit;
    const g = claimReward(createRewardState(), sec('s'), defs[3], true).grant!;
    expect(applyDrinkReward(k, g)).toMatchObject({ changed: false, refusal: 'carryFull' });
  });

  it('non-drink grants change nothing in the kit', () => {
    const g = claimReward(createRewardState(), sec('s'), defs[0], true).grant!;
    expect(applyDrinkReward(createKit(), g).changed).toBe(false);
  });

  it('opens a shortcut once', () => {
    const a = openShortcut([], 'c1.gate');
    expect(a).toEqual(['c1.gate']);
    expect(openShortcut(a, 'c1.gate')).toBe(a);
  });
});

describe('footstep noise by level', () => {
  const O = TUNING.overhaul!;
  it('walking is steady to Grand, louder at Bit much, loudest at Fecked', () => {
    expect(footstepNoiseRadius(1, false)).toBe(footstepNoiseRadius(2, false));
    expect(footstepNoiseRadius(3, false)).toBeGreaterThan(footstepNoiseRadius(2, false));
    expect(footstepNoiseRadius(4, false)).toBeGreaterThan(footstepNoiseRadius(3, false));
    expect(footstepNoiseRadius(2, false)).toBe(O.footstepNoiseRadiusByLevel![2]);
  });

  it('sneaking is silent until Fecked, then short range', () => {
    for (const l of [0, 1, 2, 3] as const) expect(footstepNoiseRadius(l, true)).toBe(0);
    const f = footstepNoiseRadius(4, true);
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThan(footstepNoiseRadius(1, false));
  });
});
