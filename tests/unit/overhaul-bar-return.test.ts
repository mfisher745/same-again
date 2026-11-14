/** DESIGN.md 7.1 "Back to the bar": what is kept, what is reset. */

import { describe, expect, it } from 'vitest';
import type { Kit } from '../../src/core/types';
import { arriveAtBar, loadIntoBar, returnToBar, takeFreeHotDrink, topUpBottles } from '../../src/systems/barReturn';
import type { BarProgress } from '../../src/systems/barReturn';
import { snapshot } from '../../src/systems/meter';

const kit = (over: Partial<Kit> = {}): Kit => ({
  drinks: { stout: 2, whiskey: 1 },
  carryLimit: 6,
  hotDrink: null,
  bottles: 0,
  weapons: ['fists', 'hurley'],
  moves: ['shoulder'],
  slots: { drink: 'stout', specials: ['shoulder', null, null, null], melee: 'hurley' },
  ...over,
});

const progress = (over: Partial<BarProgress> = {}): BarProgress & { extra: string } => ({
  chapter: 1,
  completedSectionIds: ['c1.stealth.chipper', 'c1.puzzle.tab'],
  kit: kit(),
  underWaySectionId: 'c1.fight.row',
  extra: 'carried through',
  ...over,
});

describe.each(['sober', 'floor'] as const)('return to the bar: %s', (reason) => {
  it('puts the meter at the bottom of Grand and reports the reason', () => {
    const a = returnToBar(progress(), reason);
    expect(a.meter.value).toBe(35);
    expect(snapshot(a.meter)).toMatchObject({ level: 2, state: 'grand', spiritActive: false, teaHoldActive: false });
    expect(a.meter.returnReason).toBeNull();
    expect(a.returned).toEqual({ reason });
  });

  it('keeps finished sections and everything else on the progress', () => {
    const a = returnToBar(progress(), reason);
    expect(a.progress.completedSectionIds).toEqual(['c1.stealth.chipper', 'c1.puzzle.tab']);
    expect(a.progress.extra).toBe('carried through');
    expect(a.progress.kit.drinks).toEqual({ stout: 2, whiskey: 1 });
    expect(a.progress.kit.weapons).toEqual(['fists', 'hurley']);
  });

  it('resets the encounter under way', () => {
    const a = returnToBar(progress(), reason);
    expect(a.resetSectionId).toBe('c1.fight.row');
    expect(a.progress.underWaySectionId).toBeNull();
    expect(a.progress.completedSectionIds).not.toContain('c1.fight.row');
  });

  it('re-offers one free hot drink', () => {
    expect(returnToBar(progress(), reason).hotDrinkOffer).toEqual({ available: true });
  });
});

describe('arrival details', () => {
  it('uses the chapter meter table', () => {
    expect(returnToBar(progress({ chapter: 5 }), 'floor').meter.value).toBe(43);
  });

  it('nothing under way means nothing to reset', () => {
    expect(returnToBar(progress({ underWaySectionId: null }), 'sober').resetSectionId).toBeNull();
  });

  it('a section already finished is not reset', () => {
    expect(returnToBar(progress({ underWaySectionId: 'c1.puzzle.tab' }), 'sober').resetSectionId).toBeNull();
  });

  it('a plain arrival or loaded save is the same state with no return', () => {
    const a = loadIntoBar(progress());
    expect(a.returned).toBeNull();
    expect(a.meter.value).toBe(35);
    expect(arriveAtBar(progress(), null).hotDrinkOffer.available).toBe(true);
  });
});

describe('bottles', () => {
  it('tops up to two', () => {
    expect(topUpBottles(kit({ bottles: 0 })).bottles).toBe(2);
    expect(topUpBottles(kit({ bottles: 1 })).bottles).toBe(2);
    expect(returnToBar(progress(), 'sober').progress.kit.bottles).toBe(2);
  });

  it('never takes bottles away; there is no cap', () => {
    expect(topUpBottles(kit({ bottles: 2 })).bottles).toBe(2);
    expect(topUpBottles(kit({ bottles: 17 })).bottles).toBe(17);
    expect(returnToBar(progress({ kit: kit({ bottles: 9 }) }), 'floor').progress.kit.bottles).toBe(9);
  });
});

describe('free hot drink', () => {
  const offer = { available: true };

  it('is taken once per visit', () => {
    const r = takeFreeHotDrink(kit(), offer, 'tea');
    expect(r.taken).toBe(true);
    expect(r.kit.hotDrink).toBe('tea');
    expect(r.offer.available).toBe(false);
    const again = takeFreeHotDrink(kit({ hotDrink: null }), r.offer, 'coffee');
    expect(again.taken).toBe(false);
    expect(again.kit.hotDrink).toBeNull();
  });

  it('is refused while he already carries one', () => {
    const r = takeFreeHotDrink(kit({ hotDrink: 'coffee' }), offer, 'tea');
    expect(r).toMatchObject({ taken: false, offer: { available: true } });
    expect(r.kit.hotDrink).toBe('coffee');
  });

  it('is offered again after the next return', () => {
    const first = takeFreeHotDrink(kit(), offer, 'coffee');
    const a = returnToBar(progress({ kit: first.kit }), 'floor');
    expect(a.hotDrinkOffer.available).toBe(true);
    expect(a.progress.kit.hotDrink).toBe('coffee');
  });
});
