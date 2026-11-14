/** DESIGN.md 7.5 and 7.1: which pool Myko draws from on meter events. */

import { describe, expect, it } from 'vitest';
import { pool } from '../../src/content/dialogue';
import { TUNING } from '../../src/content/tuning';
import { MYKO_POOLS, createMykoLines, mykoLineFor, stepMykoLines } from '../../src/systems/mykoLines';
import type { MykoLinesState, MykoTrigger } from '../../src/systems/mykoLines';

const CD = TUNING.overhaul?.mykoLineCooldownMs ?? 0;
const ask = (s: MykoLinesState, t: MykoTrigger, v = 50): ReturnType<typeof mykoLineFor> => mykoLineFor(s, t, v);

describe('pools exist', () => {
  it.each(Object.values(MYKO_POOLS))('%s has lines in the dialogue content', (id) => {
    expect(pool(id).length).toBeGreaterThan(0);
  });
});

describe('triggers', () => {
  const fresh = createMykoLines();
  it('has a cooldown in tuning', () => {
    expect(CD).toBeGreaterThan(0);
  });

  it('bar returns pick the sober or floor pool', () => {
    expect(ask(fresh, { kind: 'barReturn', reason: 'sober' }, 35).poolId).toBe('myko.bar.sober');
    expect(ask(fresh, { kind: 'barReturn', reason: 'floor' }, 35).poolId).toBe('myko.bar.floor');
  });

  it('entering Bit much or Fecked from below picks its pool', () => {
    expect(ask(fresh, { kind: 'levelChanged', from: 2, to: 3 }).poolId).toBe('myko.bitMuch');
    expect(ask(fresh, { kind: 'levelChanged', from: 3, to: 4 }).poolId).toBe('myko.fecked');
    expect(ask(fresh, { kind: 'levelChanged', from: 2, to: 4 }).poolId).toBe('myko.fecked');
  });

  it('other level changes and coming back down are quiet', () => {
    expect(ask(fresh, { kind: 'levelChanged', from: 2, to: 1 }).poolId).toBeNull();
    expect(ask(fresh, { kind: 'levelChanged', from: 1, to: 2 }).poolId).toBeNull();
    expect(ask(fresh, { kind: 'levelChanged', from: 4, to: 3 }).poolId).toBeNull();
    expect(ask(fresh, { kind: 'levelChanged', from: 3, to: 2 }).poolId).toBeNull();
  });

  it('spirits and hot drinks pick their pools', () => {
    expect(ask(fresh, { kind: 'spiritStarted', drinkId: 'whiskey' }).poolId).toBe('myko.whiskey');
    expect(ask(fresh, { kind: 'spiritStarted', drinkId: 'tequila' }).poolId).toBe('myko.tequila');
    expect(ask(fresh, { kind: 'hotDrink' }).poolId).toBe('myko.hotDrink');
  });

  it('the meter growing is remarked on from chapter 2, not chapter 1', () => {
    expect(ask(fresh, { kind: 'chapterStart', chapter: 1 }).poolId).toBeNull();
    expect(ask(fresh, { kind: 'chapterStart', chapter: 2 }).poolId).toBe('myko.meterGrows');
    expect(ask(fresh, { kind: 'chapterStart', chapter: 10 }).poolId).toBe('myko.meterGrows');
  });
});

describe('silence at 0', () => {
  it.each<MykoTrigger>([
    { kind: 'barReturn', reason: 'sober' },
    { kind: 'levelChanged', from: 2, to: 3 },
    { kind: 'spiritStarted', drinkId: 'whiskey' },
    { kind: 'hotDrink' },
    { kind: 'chapterStart', chapter: 3 },
    { kind: 'meterValue' },
  ])('says nothing for %o at 0', (trigger) => {
    const r = mykoLineFor(createMykoLines(), trigger, 0);
    expect(r.poolId).toBeNull();
    expect(r.state).toEqual(createMykoLines());
  });
});

describe('low remark', () => {
  const t = TUNING.overhaul?.lowWarningBelow ?? 10;

  it('fires once on dipping below the warning, not above it', () => {
    expect(ask(createMykoLines(), { kind: 'meterValue' }, t).poolId).toBeNull();
    const r = ask(createMykoLines(), { kind: 'meterValue' }, t - 0.1);
    expect(r.poolId).toBe('myko.low');
    expect(ask(stepMykoLines(r.state, CD), { kind: 'meterValue' }, t - 1).poolId).toBeNull();
  });

  it('re-arms after the meter climbs back above the warning', () => {
    let s = ask(createMykoLines(), { kind: 'meterValue' }, 5).state;
    s = ask(stepMykoLines(s, CD), { kind: 'meterValue' }, 30).state;
    expect(ask(s, { kind: 'meterValue' }, 5).poolId).toBe('myko.low');
  });

  it('waits out the cooldown without losing the remark', () => {
    let s = ask(createMykoLines(), { kind: 'hotDrink' }).state;
    const blocked = ask(s, { kind: 'meterValue' }, 5);
    expect(blocked.poolId).toBeNull();
    s = stepMykoLines(blocked.state, CD);
    expect(ask(s, { kind: 'meterValue' }, 5).poolId).toBe('myko.low');
  });
});

describe('cooldown', () => {
  it('blocks a second ambient remark until it has run out', () => {
    const first = ask(createMykoLines(), { kind: 'spiritStarted', drinkId: 'whiskey' });
    expect(first.poolId).toBe('myko.whiskey');
    expect(first.state.cooldownMs).toBe(CD);
    // Whiskey from Grand also reports a level change straight after; he does not pile on.
    expect(ask(first.state, { kind: 'levelChanged', from: 2, to: 4 }).poolId).toBeNull();
    const almost = stepMykoLines(first.state, CD - 1);
    expect(ask(almost, { kind: 'hotDrink' }).poolId).toBeNull();
    expect(ask(stepMykoLines(almost, 1), { kind: 'hotDrink' }).poolId).toBe('myko.hotDrink');
  });

  it('a blocked remark does not extend the cooldown', () => {
    const first = ask(createMykoLines(), { kind: 'hotDrink' });
    const blocked = ask(first.state, { kind: 'levelChanged', from: 2, to: 3 });
    expect(blocked.state.cooldownMs).toBe(CD);
  });

  it('bar-return lines ignore it', () => {
    const busy = ask(createMykoLines(), { kind: 'hotDrink' }).state;
    expect(ask(busy, { kind: 'barReturn', reason: 'floor' }, 35).poolId).toBe('myko.bar.floor');
  });

  it('a return restarts the cooldown so he does not follow it with chatter', () => {
    const r = ask(createMykoLines(), { kind: 'barReturn', reason: 'sober' }, 35);
    expect(ask(r.state, { kind: 'hotDrink' }, 35).poolId).toBeNull();
  });

  it('stepping never goes below 0 and ignores negative time', () => {
    const s = stepMykoLines({ cooldownMs: 100, lowArmed: true }, 5000);
    expect(s.cooldownMs).toBe(0);
    expect(stepMykoLines({ cooldownMs: 100, lowArmed: true }, -50).cooldownMs).toBe(100);
  });
});
