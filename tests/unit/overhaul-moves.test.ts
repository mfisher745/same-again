/** DESIGN.md 7.2 "Special moves": level-gated slots, cooldowns, thirteen effects. */

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/content/tuning';
import type { DrunkLevel, MoveId, SpecialSlotIndex } from '../../src/core/types';
import {
  breakHide,
  consumeMark,
  consumeRepeat,
  cooldownLeft,
  createMovesState,
  moveUsedPayload,
  resolveOnTarget,
  selectTargets,
  slotWorks,
  tickMoves,
  useSlot,
} from '../../src/systems/moves';
import type { MoveContext, MovesState } from '../../src/systems/moves';

const O = TUNING.overhaul!;
const ALL: MoveId[] = Object.keys(O.moves) as MoveId[];
const specialsWith = (slot: SpecialSlotIndex, id: MoveId): [MoveId | null, MoveId | null, MoveId | null, MoveId | null] => {
  const a: [MoveId | null, MoveId | null, MoveId | null, MoveId | null] = [null, null, null, null];
  a[slot - 1] = id;
  return a;
};
const fire = (id: MoveId, level: DrunkLevel, ctx: MoveContext = { hasTarget: true, besideProp: true }, state: MovesState = createMovesState()) => {
  const slot = O.moves[id].level;
  return useSlot(state, specialsWith(slot, id), slot, level, ctx);
};

describe('moves: slot gating', () => {
  it('slot n works at level n or above only', () => {
    for (const slot of [1, 2, 3, 4] as const) {
      for (const level of [0, 1, 2, 3, 4] as const) expect(slotWorks(slot, level)).toBe(level >= slot);
    }
  });

  it('refuses a dark slot without starting a cooldown', () => {
    const r = fire('stoutSlam', 1);
    expect(r.outcome).toEqual({ ok: false, refusal: 'dark' });
    expect(r.state).toEqual(createMovesState());
    expect(fire('lastOrders', 3).outcome).toEqual({ ok: false, refusal: 'dark' });
  });

  it('refuses an empty slot', () => {
    expect(useSlot(createMovesState(), [null, null, null, null], 1, 4).outcome).toEqual({ ok: false, refusal: 'empty' });
  });

  it('fires every move at its own level and above, with the tuned cooldown and no Buzz field', () => {
    for (const id of ALL) {
      const def = O.moves[id];
      for (const level of [def.level, 4] as const) {
        const r = fire(id, level);
        expect(r.outcome.ok).toBe(true);
        if (r.outcome.ok) {
          expect(r.outcome.use.cooldownMs).toBe(def.cooldownMs);
          expect(r.outcome.use.effect).toBe(def.effect);
          expect(cooldownLeft(r.state, def.level)).toBe(def.cooldownMs);
          expect(Object.keys(r.outcome.use)).not.toContain('cost');
        }
      }
    }
  });

  it('cooldowns by level are 5, 12, 25 and 60 seconds', () => {
    const cds = ([1, 2, 3, 4] as const).map((l) => O.moveCooldownMsByLevel[l]);
    expect(cds).toEqual([5000, 12000, 25000, 60000]);
  });

  it('shapes move:used', () => {
    const r = fire('shoulder', 1);
    if (!r.outcome.ok) throw new Error('expected ok');
    expect(moveUsedPayload(r.outcome.use)).toEqual({ moveId: 'shoulder', slot: 1 });
  });
});

describe('moves: cooldowns', () => {
  it('blocks reuse until the cooldown has run out', () => {
    let r = fire('shoulder', 2);
    let s = r.state;
    s = tickMoves(s, 4999);
    r = useSlot(s, specialsWith(1, 'shoulder'), 1, 2);
    expect(r.outcome).toEqual({ ok: false, refusal: 'cooldown' });
    s = tickMoves(s, 1);
    expect(useSlot(s, specialsWith(1, 'shoulder'), 1, 2).outcome.ok).toBe(true);
  });

  it('keeps running while the slot is dark', () => {
    const used = fire('stoutSlam', 2).state;
    expect(cooldownLeft(used, 2)).toBe(12000);
    // Andrew drops to level 1: slot 2 is dark. Time passes.
    const s = tickMoves(used, 12000);
    expect(cooldownLeft(s, 2)).toBe(0);
    // Back up at level 2 it is ready at once.
    expect(useSlot(s, specialsWith(2, 'stoutSlam'), 2, 2).outcome.ok).toBe(true);
  });

  it('does not go below zero and slots are independent', () => {
    let s = fire('shoulder', 4).state;
    const second = useSlot(s, specialsWith(2, 'stoutSlam'), 2, 4);
    expect(second.outcome.ok).toBe(true);
    s = tickMoves(second.state, 99999);
    expect(s.cooldownsMs).toEqual([0, 0, 0, 0]);
  });
});

describe('moves: context rules', () => {
  it('single-target moves need a target and refuse for free', () => {
    for (const id of ['reflexTest', 'secondOpinion', 'oneForTheRoad', 'barred'] as MoveId[]) {
      const r = fire(id, 4, {});
      expect(r.outcome).toEqual({ ok: false, refusal: 'noTarget' });
      expect(r.state).toEqual(createMovesState());
    }
  });

  it('Act Natural needs a prop and does nothing once seen', () => {
    expect(fire('actNatural', 1, {}).outcome).toEqual({ ok: false, refusal: 'noProp' });
    expect(fire('actNatural', 1, { besideProp: true, seenByGuard: true }).outcome).toEqual({ ok: false, refusal: 'seen' });
    const ok = fire('actNatural', 1, { besideProp: true });
    expect(ok.state.hidden).toBe(true);
    expect(breakHide(ok.state).hidden).toBe(false);
  });

  it('area moves fire with no target', () => {
    expect(fire('stoutSlam', 2, {}).outcome.ok).toBe(true);
    expect(fire('borrowedGlove', 3, {}).outcome.ok).toBe(true);
    expect(fire('lastOrders', 4, {}).outcome.ok).toBe(true);
  });
});

describe('moves: Same Again and Second Opinion', () => {
  it('Same Again doubles the next three hits only', () => {
    let s = fire('sameAgain', 2).state;
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = consumeRepeat(s);
      s = r.state;
      seen.push(r.times);
    }
    expect(seen).toEqual([2, 2, 2, 1]);
    expect(s.repeat).toBeNull();
  });

  it('Second Opinion quadruples one hit on the marked enemy', () => {
    let s = fire('secondOpinion', 3, { hasTarget: true, targetId: 'a' }).state;
    expect(consumeMark(s, 'b').multiplier).toBe(1);
    const r = consumeMark(s, 'a');
    expect(r.multiplier).toBe(4);
    s = r.state;
    expect(consumeMark(s, 'a').multiplier).toBe(1);
  });
});

describe('moves: target selection', () => {
  const origin = { x: 0, y: 0 };
  const c = (id: string, x: number, y: number) => ({ id, pos: { x, y } });

  it('circle moves take everyone within the radius', () => {
    const e = O.moves.stoutSlam.effect;
    expect(selectTargets(e, origin, 0, [c('in', 40, 0), c('out', 50, 0)])).toEqual(['in']);
    expect(selectTargets(O.moves.bedsideManner.effect, origin, 0, [c('in', 60, 0), c('out', 70, 0)])).toEqual(['in']);
    expect(selectTargets(O.moves.lockIn.effect, origin, 0, [c('in', 0, 60), c('out', 0, 70)])).toEqual(['in']);
  });

  it('the glove takes a cone in front', () => {
    const e = O.moves.borrowedGlove.effect;
    const got = selectTargets(e, origin, 0, [c('front', 50, 0), c('edge', 50, 30), c('side', 0, 50), c('behind', -50, 0), c('far', 200, 0)]);
    expect(got).toEqual(['front', 'edge']);
  });

  it('the stumble hits everything in a narrow line', () => {
    const e = O.moves.stumble.effect;
    expect(selectTargets(e, origin, 90, [c('a', 0, 30), c('b', 0, 80), c('wide', 30, 40), c('behind', 0, -10), c('far', 0, 120)])).toEqual(['a', 'b']);
  });

  it('the shoulder takes the nearest in its path', () => {
    const e = O.moves.shoulder.effect;
    expect(selectTargets(e, origin, 0, [c('far', 38, 0), c('near', 20, 2), c('side', 20, 40)])).toEqual(['near']);
    expect(selectTargets(e, origin, 0, [c('out', 60, 0)])).toEqual([]);
  });

  it('Last Orders takes everyone on screen; single-target moves select none', () => {
    expect(selectTargets(O.moves.lastOrders.effect, origin, 0, [c('a', 500, 500)])).toEqual(['a']);
    expect(selectTargets(O.moves.reflexTest.effect, origin, 0, [c('a', 1, 1)])).toEqual([]);
  });
});

describe('moves: health-based outcomes', () => {
  const ordinary = { boss: false, health: 40, maxHealth: 40 };
  const boss = { boss: true, health: 300, maxHealth: 300 };

  it('One for the Road finishes an ordinary enemy and takes a third off a boss', () => {
    const e = O.moves.oneForTheRoad.effect;
    expect(resolveOnTarget(e, ordinary)).toMatchObject({ damage: 40, removed: true });
    const b = resolveOnTarget(e, boss);
    expect(b.damage).toBeCloseTo(100);
    expect(b.removed).toBe(false);
  });

  it('Last Orders leaves a sliver and stuns ordinary enemies; bosses lose a fifth', () => {
    const e = O.moves.lastOrders.effect;
    const o = resolveOnTarget(e, ordinary);
    expect(40 - o.damage).toBeCloseTo(2);
    expect(o).toMatchObject({ removed: false, stunMs: 3000 });
    const b = resolveOnTarget(e, boss);
    expect(b.damage).toBeCloseTo(60);
    expect(b.stunMs).toBe(0);
  });

  it('Barred throws an ordinary enemy out and hurts what he lands on; a boss just takes damage', () => {
    const e = O.moves.barred.effect;
    expect(resolveOnTarget(e, ordinary)).toMatchObject({ removed: true, landingDamage: 60 });
    expect(resolveOnTarget(e, boss)).toMatchObject({ damage: 80, removed: false, landingDamage: 0 });
  });

  it('never takes more than the target has', () => {
    expect(resolveOnTarget(O.moves.barred.effect, { boss: true, health: 20, maxHealth: 300 }).damage).toBe(20);
  });

  it('other effects deal no health damage', () => {
    expect(resolveOnTarget(O.moves.stoutSlam.effect, ordinary)).toEqual({ damage: 0, removed: false, stunMs: 0, landingDamage: 0 });
  });
});
