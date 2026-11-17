/** Playtest 5: no drinking before the first pint, the bottle cap, the casebook's first-evidence flag, the sheep stall. */

import { describe, expect, it } from 'vitest';
import { chapter1 } from '../../src/chapters/01/index';
import { chapter2 } from '../../src/chapters/02/index';
import { T } from '../../src/chapters/02/maps';
import { TUNING } from '../../src/content/tuning';
import { createKit, pickUpDrink, topUpForLeaving, useSelected } from '../../src/systems/kit';
import { takeItem } from '../../src/systems/pickups';
import { Casebook } from '../../src/systems/investigation';
import { EventBus } from '../../src/core/events';
import { NO_INPUT, drinkItem, frame, record, settleDialogue, startChapterGame } from './helpers';

const CAP = TUNING.overhaul!.carry.bottleLimit;

describe('no drinking before the first pint', () => {
  it('Q and G are refused while the meter is hidden; the scripted pint still goes through', async () => {
    const { run } = startChapterGame(chapter1, 'new');
    run.tick(16, NO_INPUT);
    await settleDialogue(run);
    expect(run.player.meterHidden).toBe(true);
    run.give({ kind: 'drink', drinkId: 'stout', count: 1 });
    run.give({ kind: 'drink', drinkId: 'whiskey', count: 1 });
    const refused = record(run.bus, 'kit:useRefused');
    const drunk = record(run.bus, 'drink:consumed');
    run.selectItem('stout');
    expect(run.useSelected()).toBe(false);
    expect(run.useSpirit()).toBe(false);
    run.tick(16, frame({ pressed: ['drink'] }));
    expect(drunk).toHaveLength(0);
    expect(refused.map((r) => [r.textId, r.reason])).toEqual([
      ['ui.use.notYet', 'meterHidden'],
      ['ui.use.notYet', 'meterHidden'],
      ['ui.use.notYet', 'meterHidden'],
    ]);
    // Dympna has handed over the pint (pub.step 2): that one is drinkable.
    run.setFlag('pub.step', 2);
    expect(drinkItem(run, 'stout')).toBe(true);
    expect(run.player.meterHidden).toBe(false);
  });
});

describe('bottle cap', () => {
  it('drinking at the cap adds no bottle', () => {
    let kit = pickUpDrink(createKit(), 'stout').kit;
    kit = { ...kit, bottles: CAP, selectedItem: 'stout' };
    const r = useSelected(kit);
    expect(r.consumed).toBe('stout');
    expect(r.kit.bottles).toBe(CAP);
    const empty = { ...createKit(), bottles: 0 };
    const k2 = pickUpDrink(empty, 'stout').kit;
    expect(useSelected({ ...k2, selectedItem: 'stout' }).kit.bottles).toBe(1);
  });
  it('a floor bottle stays put at the cap and is taken below it', () => {
    const full = { ...createKit(), bottles: CAP };
    const r = takeItem(full, { kind: 'empties', count: 1 });
    expect(r.kit.bottles).toBe(CAP);
    expect(r.taken).toBeNull();
    expect(r.leftover).toEqual({ kind: 'empties', count: 1 });
    expect(takeItem({ ...createKit(), bottles: CAP - 1 }, { kind: 'empties', count: 3 }).kit.bottles).toBe(CAP);
  });
  it('top-ups and old saves never exceed the cap', () => {
    expect(topUpForLeaving({ ...createKit(), bottles: CAP + 4 }, 'stout').bottles).toBe(CAP);
    expect(topUpForLeaving(createKit(), 'stout').bottles).toBeLessThanOrEqual(CAP);
  });
  it('a run clamps a save holding more', async () => {
    const { run, store } = startChapterGame(chapter1, 'new');
    run.tick(16, NO_INPUT);
    await settleDialogue(run);
    run.player.setKit({ ...run.player.kit, bottles: CAP + 3 });
    run.learnMove('shoulder'); // any save will do
    expect(store.load()?.kit.bottles).toBe(CAP + 3);
    const loaded = startChapterGame(chapter1, 'continue', store);
    expect(loaded.run.player.kit.bottles).toBe(CAP);
  });
});

describe('casebook first evidence', () => {
  it('first is true only for the first evidence ever', () => {
    const bus = new EventBus();
    const found = record(bus, 'evidence:found');
    const book = new Casebook(bus);
    book.addEvidence('c1.clue.a' as never, 1);
    book.addEvidence('c1.clue.b' as never, 1);
    book.addEvidence('c1.clue.b' as never, 1);
    expect(found.map((f) => f.first)).toEqual([true, false]);
  });
});

describe('sheep never stall', () => {
  const open = () => {
    const { run } = startChapterGame(chapter2, 'chapter');
    run.goToScreen('c2.farm', T(2, 11));
    const p = run.sheepPuzzlesHere()[0]!.puzzle;
    return p;
  };
  const far = { x: 0, y: 0 };

  it('a gate closing on a sheep whose body straddles the door no longer wedges it', () => {
    const p = open();
    p.toggleGate('gateA'); // D1 opens, D2 shuts
    // Centre in col 18, body reaching into the door tile at col 19.
    p.sheep()[0]!.pos = { x: 18 * 16 + 14, y: 12 * 16 + 8 };
    expect(p.toggleGate('gateA')).toBe(true); // closes D1 over it: not refused
    const s = p.sheep()[0]!;
    for (let t = 0; t < 30000; t += 50) p.update(50, far);
    expect(s.pos.x < 19 * 16 - 5 || s.pos.x > 20 * 16 + 5).toBe(true);
    let moved = false;
    const at = { ...s.pos };
    for (let t = 0; t < 60000 && !moved; t += 50) {
      p.update(50, far);
      moved = Math.hypot(s.pos.x - at.x, s.pos.y - at.y) > 4;
    }
    expect(moved).toBe(true);
  });

  it('a sheep standing in the gateway of an open door walks out and the gate can then close', () => {
    const p = open();
    p.toggleGate('gateA');
    p.sheep()[1]!.pos = { x: 19 * 16 + 8, y: 12 * 16 + 8 };
    for (let t = 0; t < 5000; t += 50) p.update(50, far);
    expect(Math.floor(p.sheep()[1]!.pos.x / 16)).not.toBe(19);
    expect(p.toggleGate('gateA')).toBe(true);
  });

  it('a sheep sitting dead in the gateway when it closes is nudged to the nearer side', () => {
    const p = open();
    p.toggleGate('gateA');
    p.sheep()[2]!.pos = { x: 19 * 16 + 5, y: 12 * 16 + 8 };
    expect(p.toggleGate('gateA')).toBe(true);
    expect(p.sheep()[2]!.pos.x).toBeLessThan(19 * 16);
  });
});
