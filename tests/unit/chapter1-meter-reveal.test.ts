/**
 * Chapter 1: the meter is hidden and the drain held until the first pint and the first step into the yard
 * (docs/chapters/01-a-quiet-pint.md beats 1 and 2; DESIGN.md 7.1). Plus the HUD and Myko's silence while it is hidden.
 */

import { describe, expect, it } from 'vitest';
import { chapter1 } from '../../src/chapters/01/index';
import { T } from '../../src/chapters/01/maps';
import { MykoMeterVoice } from '../../src/systems/mykoMeter';
import { buildHudModel } from '../../src/ui/model/hud';
import { FakeSource } from '../../src/ui/dev/fakeSource';
import { NO_INPUT, advance, record, settleDialogue, startChapterGame } from './helpers';

/** A fresh New Game on chapter 1, past its first tick (so the script's onStart has run). */
function freshGame() {
  const g = startChapterGame(chapter1, 'new');
  g.run.tick(16, NO_INPUT);
  return g;
}

/** Plays the part of Dympna's list up to the pint: step 2, a stout in the kit, then Q. */
function drinkFirstPint(run: ReturnType<typeof freshGame>['run']): void {
  run.setFlag('pub.step', 2);
  run.give({ kind: 'drink', drinkId: 'stout', count: 1 });
  expect(run.drinkFromInventory('stout')).toBe(true);
}

describe('chapter 1 meter reveal', () => {
  it('a fresh game has the meter hidden and the drain held', () => {
    const { run } = freshGame();
    expect(run.player.meterHidden).toBe(true);
    expect(run.player.drainHeld).toBe(true);
    expect(run.player.meterSnapshot().hidden).toBe(true);
  });

  it('the held drain really holds the value while the meter is hidden', async () => {
    const { run } = freshGame();
    await settleDialogue(run);
    const before = run.player.meter.value;
    advance(run, 20_000);
    expect(run.player.meter.value).toBe(before);
  });

  it('the first pint shows the meter but the drain stays held', async () => {
    const { run } = freshGame();
    await settleDialogue(run);
    const shown = record(run.bus, 'meter:hiddenChanged');
    drinkFirstPint(run);
    expect(run.player.meterHidden).toBe(false);
    expect(shown).toEqual([{ hidden: false }]);
    expect(run.player.drainHeld).toBe(true);
    await settleDialogue(run);
    const after = run.player.meter.value;
    advance(run, 20_000);
    expect(run.player.meter.value).toBe(after);
  });

  it('the drain starts when Andrew first enters the yard, and the meter then falls', async () => {
    const { run } = freshGame();
    await settleDialogue(run);
    drinkFirstPint(run);
    await settleDialogue(run);
    run.goToScreen('c1.yard', T(5, 3));
    run.tick(16, NO_INPUT);
    expect(run.player.drainHeld).toBe(false);
    const before = run.player.meter.value;
    advance(run, 9000);
    expect(run.player.meter.value).toBeLessThan(before);
  });

  it('a return to the bar neither hides nor holds the meter again', async () => {
    const { run } = freshGame();
    await settleDialogue(run);
    drinkFirstPint(run);
    run.goToScreen('c1.yard', T(5, 3));
    run.tick(16, NO_INPUT);
    run.player.meter = { ...run.player.meter, value: 0.01 };
    advance(run, 200);
    run.completeBarReturn();
    run.tick(16, NO_INPUT);
    expect(run.screenId).toBe('c1.pub');
    expect(run.player.meterHidden).toBe(false);
    expect(run.player.drainHeld).toBe(false);
    await settleDialogue(run); // Myko's and Dympna's lines on the return
    const before = run.player.meter.value;
    advance(run, 9000);
    expect(run.player.meter.value).toBeLessThan(before);
  });

  it('a save before the pint keeps both, and loading it does not reveal or release them', async () => {
    const { run, store } = freshGame();
    await settleDialogue(run);
    run.learnMove('shoulder'); // any save will do
    const saved = store.load();
    expect(saved?.meterHidden).toBe(true);
    expect(saved?.drainHeld).toBe(true);
    const loaded = startChapterGame(chapter1, 'continue', store);
    loaded.run.tick(16, NO_INPUT);
    expect(loaded.run.player.meterHidden).toBe(true);
    expect(loaded.run.player.drainHeld).toBe(true);
  });

  it('a save after the pint and the yard loads with the meter shown and draining', async () => {
    const { run, store } = freshGame();
    await settleDialogue(run);
    drinkFirstPint(run);
    run.goToScreen('c1.yard', T(5, 3));
    run.tick(16, NO_INPUT);
    run.learnMove('shoulder');
    const saved = store.load();
    expect(saved?.meterHidden).toBeUndefined();
    expect(saved?.drainHeld).toBeUndefined();
    const loaded = startChapterGame(chapter1, 'continue', store);
    loaded.run.tick(16, NO_INPUT);
    expect(loaded.run.player.meterHidden).toBe(false);
    expect(loaded.run.player.drainHeld).toBe(false);
  });
});

describe('HUD model with a hidden meter', () => {
  it('reports the meter hidden so the HUD draws none', () => {
    const fake = new FakeSource();
    expect(buildHudModel(fake).buzz.hidden).toBe(false);
    const base = fake.meter();
    const hidden = buildHudModel(Object.assign(fake, { meter: () => ({ ...base, hidden: true }) }));
    expect(hidden.buzz.hidden).toBe(true);
  });
});

describe('Myko while the meter is hidden', () => {
  function voice(hidden: { value: boolean }) {
    const said: string[] = [];
    const v = new MykoMeterVoice({
      rng: { next: () => 0 },
      pool: (id) => [`${id}.a`],
      say: (id) => void said.push(id),
      meterHidden: () => hidden.value,
    });
    return { v, said };
  }

  it('low and level remarks are silent while hidden; nothing fires when it is shown', () => {
    const hidden = { value: true };
    const { v, said } = voice(hidden);
    v.trigger({ kind: 'meterValue' }, 5);
    v.trigger({ kind: 'levelChanged', from: 2, to: 3 }, 70);
    expect(said).toEqual([]);
    hidden.value = false;
    v.step(60_000);
    expect(said).toEqual([]);
    v.trigger({ kind: 'meterValue' }, 5);
    expect(said).toEqual([]);
  });

  it('speaks on the next genuine change once shown', () => {
    const hidden = { value: true };
    const { v, said } = voice(hidden);
    v.trigger({ kind: 'meterValue' }, 5);
    hidden.value = false;
    v.trigger({ kind: 'levelChanged', from: 2, to: 3 }, 70);
    expect(said).toEqual(['myko.bitMuch.a']);
    v.step(60_000);
    v.trigger({ kind: 'meterValue' }, 40);
    v.trigger({ kind: 'meterValue' }, 5);
    expect(said).toHaveLength(2);
    expect(said[1]).toMatch(/^myko\.low/);
  });

  it('drink lines still play while hidden', () => {
    const { v, said } = voice({ value: true });
    v.trigger({ kind: 'spiritStarted', drinkId: 'whiskey' }, 50);
    v.step(60_000);
    v.trigger({ kind: 'hotDrink' }, 50);
    expect(said).toHaveLength(2);
    expect(said[0]).toMatch(/whiskey/);
    expect(said[1]).toMatch(/hotDrink/);
  });
});
