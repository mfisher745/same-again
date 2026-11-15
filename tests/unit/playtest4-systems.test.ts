/** Playtest 4: sheep wander, the objective glint, the use model's input, the save migration, and the bar top-up. */

import { describe, expect, it } from 'vitest';
import { chapter2 } from '../../src/chapters/02/index';
import { T } from '../../src/chapters/02/maps';
import { TUNING } from '../../src/content/tuning';
import { migrateSave } from '../../src/core/save';
import { seededRandom } from '../../src/core/random';
import { DEFAULT_BINDINGS } from '../../src/core/types';
import type { ObjectiveMark } from '../../src/core/chapter';
import { GlintTracker } from '../../src/systems/glint';
import { createKit, pickUpDrink } from '../../src/systems/kit';
import { arriveAtBar } from '../../src/systems/barReturn';
import { NO_INPUT, frame, record, settleDialogue, startChapterGame } from './helpers';

const G = TUNING.overhaul!.glint!;

describe('G is bound to the spirit slot', () => {
  it('KeyG by default', () => {
    expect(DEFAULT_BINDINGS.useSpirit).toEqual([{ device: 'keyboard', code: 'KeyG' }]);
  });
});

describe('objective glint', () => {
  const mark: ObjectiveMark = { id: 'm', screenId: 'c2.farm', position: { x: 100, y: 100 } };
  it('is silent out of range, pulses in range, and never for a finished mark', () => {
    const g = new GlintTracker(seededRandom(1));
    const far = { x: 100 + (G.radiusTiles + 2) * 16, y: 100 };
    let n = 0;
    for (let t = 0; t < 60000; t += 100) n += g.tick(100, [mark], far).length;
    expect(n).toBe(0);
    for (let t = 0; t < 60000; t += 100) n += g.tick(100, [mark], { x: 110, y: 100 }).length;
    expect(n).toBeGreaterThan(5);
    expect(n).toBeLessThan(60000 / G.intervalMsMin + 1);
    let none = 0;
    for (let t = 0; t < 60000; t += 100) none += g.tick(100, [], { x: 110, y: 100 }).length;
    expect(none).toBe(0);
  });
  it('faint marks glint from further off and more often', () => {
    const g = new GlintTracker(seededRandom(2));
    const spot = { x: 100 + (G.radiusTiles + 1) * 16, y: 100 };
    let plain = 0;
    let faint = 0;
    for (let t = 0; t < 60000; t += 100) {
      plain += g.tick(100, [mark], spot).length;
      faint += g.tick(100, [{ ...mark, id: 'f', faint: true as const }], spot).length;
    }
    expect(plain).toBe(0);
    expect(faint).toBeGreaterThan(10);
  });
});

describe('save migration', () => {
  it('moves a spirit out of the old drink slot and starts the selection on a held beer', () => {
    const kit = { drinks: { whiskey: 1, stout: 1 }, carryLimit: 6, hotDrink: null, bottles: 0, weapons: ['fists'], moves: [], slots: { drink: 'whiskey', specials: [null, null, null, null], melee: 'fists' } };
    const out = migrateSave({ kit }) as { kit: { slots: { drink: string; spirit: string }; selectedItem: string } };
    expect(out.kit.slots.drink).toBe('stout');
    expect(out.kit.slots.spirit).toBe('whiskey');
    expect(out.kit.selectedItem).toBe('stout');
  });
});

describe('beers on leaving the bar', () => {
  it('a return tops beers up to two with the region beer and keeps more', () => {
    const base = { chapter: 2 as const, completedSectionIds: [], underWaySectionId: null };
    expect(arriveAtBar({ ...base, kit: createKit() }, 'sober', undefined, 'lightBeer').progress.kit.drinks.lightBeer).toBe(2);
    let k = createKit();
    for (let i = 0; i < 4; i++) k = pickUpDrink(k, 'stout').kit;
    expect(arriveAtBar({ ...base, kit: k }, 'sober').progress.kit.drinks.stout).toBe(4);
  });

  it('walking out of the chapter 2 bar leaves him with two beers and two bottles', async () => {
    const { run } = startChapterGame(chapter2, 'chapter');
    run.tick(16, NO_INPUT);
    await settleDialogue(run);
    run.player.setKit({ ...run.player.kit, drinks: {}, bottles: 0, selectedItem: null, slots: { ...run.player.kit.slots, drink: null, spirit: null } });
    run.goToScreen('c2.farm', T(2, 11));
    const drinks = Object.values(run.player.kit.drinks).reduce((n, c) => n + (c ?? 0), 0);
    expect(drinks).toBeGreaterThanOrEqual(2);
    expect(run.player.kit.bottles).toBeGreaterThanOrEqual(2);
  });
});

describe('Q and G in a run', () => {
  it('Q drinks the selection, G the spirit; refusals say why', async () => {
    const { run } = startChapterGame(chapter2, 'chapter');
    run.tick(16, NO_INPUT);
    await settleDialogue(run);
    const refused = record(run.bus, 'kit:useRefused');
    run.player.setKit(createKit());
    run.tick(16, frame({ pressed: ['drink'] }));
    run.tick(16, frame({ pressed: ['useSpirit'] }));
    expect(refused.map((r) => r.textId)).toEqual(['ui.use.nothing', 'ui.spirit.none']);
    run.give({ kind: 'drink', drinkId: 'whiskey', count: 1 });
    run.give({ kind: 'drink', drinkId: 'stout', count: 1 });
    const drunk = record(run.bus, 'drink:consumed');
    run.tick(16, frame({ pressed: ['drink'] }));
    run.tick(16, frame({ pressed: ['useSpirit'] }));
    expect(drunk.map((d) => d.drinkId)).toEqual(['stout', 'whiskey']);
  });
});

describe('sheep wander', () => {
  it('sheep drift on their own when Andrew is far, and stay in their pen', () => {
    const { run } = startChapterGame(chapter2, 'chapter');
    run.goToScreen('c2.farm', T(2, 11));
    const puzzle = run.sheepPuzzlesHere()[0]?.puzzle;
    if (!puzzle) throw new Error('no puzzle');
    const start = puzzle.sheep().map((s) => ({ ...s.pos }));
    const far = { x: 0, y: 0 };
    for (let t = 0; t < 120000; t += 50) {
      puzzle.update(50, far);
      for (const s of puzzle.sheep()) {
        const c = s.pos.x / 16;
        const r = s.pos.y / 16;
        // Pen 1 is cols 10-18, rows 7-13: a sheep that began there never leaves it.
        expect(c >= 10 && c < 19 && r >= 7 && r < 14).toBe(true);
      }
    }
    const moved = puzzle.sheep().some((s, i) => Math.hypot(s.pos.x - (start[i]?.x ?? 0), s.pos.y - (start[i]?.y ?? 0)) > 8);
    expect(moved).toBe(true);
  });
});
