/** DESIGN.md 7.1 "The kit" and 7.7: carry limit, hot drink, bottles, slots. */

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/content/tuning';
import {
  assignDrink,
  assignMove,
  assignWeapon,
  carriedCount,
  createKit,
  cycleDrink,
  cycleWeapon,
  drinkFromInventory,
  drinkSelected,
  gainWeapon,
  heldDrinks,
  learnMove,
  pickUpDrink,
  spendBottle,
  takeHotDrink,
  topUpBottles,
} from '../../src/systems/kit';
import type { Kit } from '../../src/core/types';

const full = (): Kit => {
  let k = createKit();
  for (let i = 0; i < TUNING.overhaul!.carry.limit; i++) k = pickUpDrink(k, 'stout').kit;
  return k;
};

describe('kit: carry limit', () => {
  it('starts with fists, no drinks, no bottles', () => {
    const k = createKit();
    expect(k.carryLimit).toBe(6);
    expect(k.weapons).toEqual(['fists']);
    expect(k.slots.melee).toBe('fists');
    expect(k.bottles).toBe(0);
  });

  it('accepts drinks up to the limit and refuses the next', () => {
    const k = full();
    expect(carriedCount(k)).toBe(6);
    const r = pickUpDrink(k, 'whiskey');
    expect(r.changed).toBe(false);
    expect(r.refusal).toBe('carryFull');
    expect(r.kit).toBe(k);
  });

  it('counts any mix toward the limit', () => {
    let k = createKit();
    for (const id of ['stout', 'lager', 'lightBeer', 'craftIpa', 'whiskey', 'tequila'] as const) k = pickUpDrink(k, id).kit;
    expect(carriedCount(k)).toBe(6);
    expect(pickUpDrink(k, 'stout').refusal).toBe('carryFull');
  });

  it('the hot drink and bottles do not count toward the limit', () => {
    let k = full();
    k = takeHotDrink(k, 'coffee').kit;
    k = { ...k, bottles: 40 };
    expect(carriedCount(k)).toBe(6);
    expect(k.hotDrink).toBe('coffee');
  });

  it('refuses a second hot drink, by either route', () => {
    const k = takeHotDrink(createKit(), 'coffee').kit;
    expect(takeHotDrink(k, 'tea').refusal).toBe('hotDrinkHeld');
    expect(pickUpDrink(k, 'tea').refusal).toBe('hotDrinkHeld');
    expect(takeHotDrink(k, 'tea').kit.hotDrink).toBe('coffee');
  });

  it('a hot drink is accepted even when the carry is full', () => {
    expect(takeHotDrink(full(), 'tea').changed).toBe(true);
  });
});

describe('kit: drinking', () => {
  it('first pickup fills the empty drink slot', () => {
    expect(pickUpDrink(createKit(), 'lager').kit.slots.drink).toBe('lager');
  });

  it('a beer leaves one bottle and returns what was consumed', () => {
    const k = pickUpDrink(createKit(), 'stout').kit;
    const r = drinkSelected(k);
    expect(r.consumed).toBe('stout');
    expect(r.bottlesAdded).toBe(1);
    expect(r.kit.bottles).toBe(1);
    expect(carriedCount(r.kit)).toBe(0);
    expect(r.kit.slots.drink).toBeNull();
  });

  it('every beer leaves a bottle, spirits and hot drinks do not', () => {
    for (const id of ['stout', 'lager', 'lightBeer', 'craftIpa'] as const) {
      expect(drinkFromInventory(pickUpDrink(createKit(), id).kit, id).kit.bottles).toBe(1);
    }
    for (const id of ['whiskey', 'tequila'] as const) {
      const r = drinkFromInventory(pickUpDrink(createKit(), id).kit, id);
      expect(r.consumed).toBe(id);
      expect(r.kit.bottles).toBe(0);
    }
    const c = drinkFromInventory(takeHotDrink(createKit(), 'coffee').kit, 'coffee');
    expect(c.consumed).toBe('coffee');
    expect(c.kit.hotDrink).toBeNull();
    expect(c.kit.bottles).toBe(0);
  });

  it('drinking from the inventory does not change the slot while it still holds', () => {
    let k = pickUpDrink(createKit(), 'stout').kit;
    k = pickUpDrink(k, 'whiskey').kit;
    k = pickUpDrink(k, 'whiskey').kit;
    const r = drinkFromInventory(k, 'whiskey');
    expect(r.kit.slots.drink).toBe('stout');
    expect(r.kit.drinks.whiskey).toBe(1);
  });

  it('an emptied slot moves to the next held drink', () => {
    let k = pickUpDrink(createKit(), 'stout').kit;
    k = pickUpDrink(k, 'whiskey').kit;
    expect(drinkSelected(k).kit.slots.drink).toBe('whiskey');
  });

  it('refuses a drink not held, and drinking with an empty slot', () => {
    const k = createKit();
    expect(drinkFromInventory(k, 'stout')).toMatchObject({ consumed: null, changed: false, refusal: 'notHeld' });
    expect(drinkSelected(k)).toMatchObject({ consumed: null, refusal: 'notHeld' });
  });

  it('drinking frees room to pick up again', () => {
    const r = drinkSelected(full());
    expect(pickUpDrink(r.kit, 'lager').changed).toBe(true);
  });
});

describe('kit: cycling and assigning drinks', () => {
  it('cycles through held drinks including the hot drink, and wraps', () => {
    let k = pickUpDrink(createKit(), 'stout').kit;
    k = pickUpDrink(k, 'whiskey').kit;
    k = takeHotDrink(k, 'tea').kit;
    expect(heldDrinks(k)).toEqual(['stout', 'whiskey', 'tea']);
    const seen: (string | null)[] = [k.slots.drink];
    for (let i = 0; i < 3; i++) {
      k = cycleDrink(k).kit;
      seen.push(k.slots.drink);
    }
    expect(seen).toEqual(['stout', 'whiskey', 'tea', 'stout']);
    expect(cycleDrink(k, -1).kit.slots.drink).toBe('tea');
  });

  it('cycling with one drink or none changes nothing', () => {
    expect(cycleDrink(createKit()).changed).toBe(false);
    expect(cycleDrink(pickUpDrink(createKit(), 'stout').kit).refusal).toBe('unchanged');
  });

  it('assigns only held drinks', () => {
    const k = pickUpDrink(createKit(), 'stout').kit;
    expect(assignDrink(k, 'whiskey').refusal).toBe('notHeld');
    expect(assignDrink(k, null).kit.slots.drink).toBeNull();
  });
});

describe('kit: moves and slots', () => {
  it('learns a move once', () => {
    const a = learnMove(createKit(), 'shoulder');
    expect(a.learned).toBe('shoulder');
    expect(a.kit.moves).toEqual(['shoulder']);
    const b = learnMove(a.kit, 'shoulder');
    expect(b.learned).toBeNull();
    expect(b.changed).toBe(false);
  });

  it('does not assign on learning by default; autoAssign fills an empty slot only', () => {
    expect(learnMove(createKit(), 'shoulder').kit.slots.specials[0]).toBeNull();
    const a = learnMove(createKit(), 'shoulder', { autoAssign: true }).kit;
    expect(a.slots.specials[0]).toBe('shoulder');
    const b = learnMove(a, 'reflexTest', { autoAssign: true }).kit;
    expect(b.slots.specials[0]).toBe('shoulder');
    expect(b.moves).toContain('reflexTest');
  });

  it('refuses an unlearned move', () => {
    expect(assignMove(createKit(), 1, 'shoulder').refusal).toBe('notLearned');
  });

  it('slot n takes only a move of level n', () => {
    const k = learnMove(learnMove(createKit(), 'shoulder').kit, 'stoutSlam').kit;
    expect(assignMove(k, 2, 'shoulder').refusal).toBe('wrongLevel');
    expect(assignMove(k, 1, 'stoutSlam').refusal).toBe('wrongLevel');
    expect(assignMove(k, 4, 'shoulder').refusal).toBe('wrongLevel');
    expect(assignMove(k, 1, 'shoulder').kit.slots.specials).toEqual(['shoulder', null, null, null]);
    expect(assignMove(k, 2, 'stoutSlam').kit.slots.specials).toEqual([null, 'stoutSlam', null, null]);
  });

  it('a slot can be swapped and cleared; a move sits in only one slot', () => {
    let k = learnMove(learnMove(createKit(), 'shoulder').kit, 'reflexTest').kit;
    k = assignMove(k, 1, 'shoulder').kit;
    k = assignMove(k, 1, 'reflexTest').kit;
    expect(k.slots.specials[0]).toBe('reflexTest');
    expect(k.slots.specials.filter((m) => m === 'shoulder')).toHaveLength(0);
    expect(assignMove(k, 1, 'reflexTest').changed).toBe(false);
    expect(assignMove(k, 1, null).kit.slots.specials[0]).toBeNull();
    expect(assignMove(k, 3, null).refusal).toBe('unchanged');
  });

  it('every tuned move fits only the slot of its level', () => {
    for (const def of Object.values(TUNING.overhaul!.moves)) {
      const k = learnMove(createKit(), def.id).kit;
      for (const slot of [1, 2, 3, 4] as const) {
        expect(assignMove(k, slot, def.id).changed).toBe(slot === def.level);
      }
    }
  });
});

describe('kit: weapons', () => {
  it('gains a weapon once, keeps cycle order, does not equip it', () => {
    let k = gainWeapon(createKit(), 'umbrella').kit;
    k = gainWeapon(k, 'hurley').kit;
    expect(k.weapons).toEqual(['fists', 'hurley', 'umbrella']);
    expect(k.slots.melee).toBe('fists');
    const again = gainWeapon(k, 'hurley');
    expect(again.gained).toBeNull();
    expect(again.changed).toBe(false);
  });

  it('assigns and cycles only owned weapons', () => {
    let k = gainWeapon(gainWeapon(createKit(), 'hurley').kit, 'clipboard').kit;
    expect(assignWeapon(k, 'umbrella').refusal).toBe('notOwned');
    expect(cycleWeapon(createKit()).changed).toBe(false);
    const order = [k.slots.melee];
    for (let i = 0; i < 3; i++) {
      k = cycleWeapon(k).kit;
      order.push(k.slots.melee);
    }
    expect(order).toEqual(['fists', 'hurley', 'clipboard', 'fists']);
    expect(cycleWeapon(k, -1).kit.slots.melee).toBe('clipboard');
    expect(assignWeapon(k, 'hurley').kit.slots.melee).toBe('hurley');
  });
});

describe('kit: bottles', () => {
  it('tops up to the minimum on leaving the bar, never down', () => {
    expect(topUpBottles(createKit()).kit.bottles).toBe(2);
    const k = { ...createKit(), bottles: 1 };
    expect(topUpBottles(k).kit.bottles).toBe(2);
    const rich = { ...createKit(), bottles: 9 };
    expect(topUpBottles(rich).changed).toBe(false);
    expect(topUpBottles(rich).kit.bottles).toBe(9);
  });

  it('spends one bottle and refuses with none', () => {
    expect(spendBottle({ ...createKit(), bottles: 3 }).kit.bottles).toBe(2);
    expect(spendBottle(createKit()).refusal).toBe('notHeld');
  });

  it('bottles are unlimited', () => {
    let k = createKit();
    for (let i = 0; i < 50; i++) k = drinkFromInventory(pickUpDrink(k, 'lightBeer').kit, 'lightBeer').kit;
    expect(k.bottles).toBe(50);
  });
});

describe('kit: purity', () => {
  it('never mutates its input', () => {
    const k = createKit();
    const snap = JSON.stringify(k);
    pickUpDrink(k, 'stout');
    learnMove(k, 'shoulder');
    gainWeapon(k, 'hurley');
    topUpBottles(k);
    expect(JSON.stringify(k)).toBe(snap);
  });
});
