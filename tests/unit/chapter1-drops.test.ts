/** Chapter 1 chipper fight: the second wave drops exactly one stout, from the last lad to fall; the first wave still rolls. */

import { describe, expect, it } from 'vitest';
import { chapter1 } from '../../src/chapters/01/index';
import { T } from '../../src/chapters/01/maps';
import { TUNING } from '../../src/content/tuning';
import { dropRngFor, regionBeer, rollEnemyDrop } from '../../src/systems/drops';
import { NO_INPUT, advance, makeRun, settleDialogue } from './helpers';

const SEEDS = [0, 1, 2, 3, 7, 42, 99, 12345, 777777, 0x7ffffffe];

/** Clears wave 1 and lets the second arrive (Stout Slam's lesson is a scene that holds the clock until it is read). */
async function toSecondWave(h: ReturnType<typeof chipper>) {
  const first = h.fight.aliveActors();
  expect(first).toHaveLength(1);
  h.run.defeat(first[0]!, 'player');
  h.run.tick(16, NO_INPUT);
  for (let i = 0; i < 6 && h.fight.aliveActors().length === 0; i++) {
    await settleDialogue(h.run);
    advance(h.run, (TUNING.combat.betweenWavesMs + 400) / 2);
  }
  const wave2 = h.fight.aliveActors();
  expect(wave2).toHaveLength(2);
  return wave2;
}

function chipper(lootSeed: number) {
  const h = makeRun({ module: chapter1, chapter: 1, save: (b) => ({ ...b, lootSeed }) });
  h.run.goToScreen('c1.street', T(3, 8));
  h.run.tick(16, NO_INPUT);
  h.run.startSection('c1.fight.chipper');
  const fight = h.run.fight('c1.fight.chipper');
  if (!fight) throw new Error('no chipper fight');
  const drops = () => h.run.pickups().filter((p) => p.def.id.startsWith('drop.'));
  return { ...h, fight, drops };
}

describe('chipper fight guaranteed drop', () => {
  it('the tuning says wave 2 of the chipper fight guarantees a stout and wave 1 does not', () => {
    const waves = TUNING.fights['c1.fight.chipper']?.waves ?? [];
    expect(waves).toHaveLength(2);
    expect(waves[0]?.guaranteedDrop).toBeUndefined();
    expect(waves[1]?.guaranteedDrop).toBe('stout');
    expect(waves[1]?.enemies).toEqual([{ enemyId: 'lad', count: 2 }]);
  });

  it.each(SEEDS)('seed %i: the second wave drops exactly one stout, from the last lad down', async (seed) => {
    const h = chipper(seed);
    const { run, drops } = h;
    const wave2 = await toSecondWave(h);
    const before = drops().length;
    // The first of the pair to fall leaves nothing.
    run.defeat(wave2[0]!, 'player');
    expect(drops().length).toBe(before);
    // The last one leaves the stout.
    run.defeat(wave2[1]!, 'player');
    const after = drops();
    expect(after.length).toBe(before + 1);
    const dropped = after.find((p) => p.def.id === `drop.${wave2[1]!.instanceId}`);
    expect(dropped?.item).toEqual({ kind: 'drink', drinkId: 'stout', count: 1 });
  });

  it('the order they fall in does not matter: whichever falls last drops it', async () => {
    const h = chipper(5);
    const { run, drops } = h;
    const [a, b] = await toSecondWave(h);
    const before = drops().length;
    run.defeat(b!, 'player');
    expect(drops().length).toBe(before);
    run.defeat(a!, 'player');
    expect(drops().filter((p) => p.def.id === `drop.${a!.instanceId}`)).toHaveLength(1);
  });

  it('the first wave still rolls its own drop from the loot seed', () => {
    // Over many seeds the lone first lad sometimes drops and sometimes does not, exactly as drops.ts rolls it.
    let dropped = 0;
    let nothing = 0;
    for (let seed = 0; seed < 200; seed++) {
      const { run, fight, drops } = chipper(seed);
      const lad = fight.aliveActors()[0]!;
      const expected = rollEnemyDrop(dropRngFor(seed, lad.instanceId), regionBeer('kilnamoe'), 1);
      const before = drops().length;
      run.defeat(lad, 'player');
      const got = drops().length - before;
      expect(got).toBe(expected === null ? 0 : 1);
      if (got) dropped++;
      else nothing++;
    }
    expect(dropped).toBeGreaterThan(0);
    expect(nothing).toBeGreaterThan(0);
  });
});

