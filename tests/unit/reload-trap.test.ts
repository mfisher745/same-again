/**
 * The reload trap (found in chapter 4's brawl): a fight started by a one-time script trigger whose flag is saved must
 * be startable again after a load, or after a walk back from the bar, or the chapter cannot be finished.
 */

import { describe, expect, it } from 'vitest';
import { chapter1 } from '../../src/chapters/01/index';
import { chapter2 } from '../../src/chapters/02/index';
import { chapter3 } from '../../src/chapters/03/index';
import { chapter4 } from '../../src/chapters/04/index';
import type { ChapterModule } from '../../src/core/chapter';
import type { ChapterRun } from '../../src/systems/run';
import { NO_INPUT, settleDialogue, startChapterGame } from './helpers';

type Store = Parameters<typeof startChapterGame>[2];

async function settle(run: ChapterRun, frames = 6): Promise<void> {
  for (let i = 0; i < frames; i++) {
    run.tick(16, NO_INPUT);
    await settleDialogue(run);
  }
}

async function begin(module: ChapterModule, how: 'chapter' | 'continue', store?: Store) {
  const g = startChapterGame(module, how, store);
  await settle(g.run, 3);
  return g;
}

const mid = (a: { x: number; y: number; width: number; height: number }) => ({ x: a.x + a.width / 2, y: a.y + a.height / 2 });
const triggerSpot = (module: ChapterModule, id: string) => {
  const t = module.triggers?.find((x) => x.id === id);
  if (!t) throw new Error(`no trigger ${id}`);
  return { screenId: t.screenId, at: mid(t.area) };
};

/** Walks into a trigger's area on its screen. */
async function walkInto(run: ChapterRun, module: ChapterModule, id: string): Promise<void> {
  const { screenId, at } = triggerSpot(module, id);
  if (run.currentScreen() !== screenId) run.goToScreen(screenId, at);
  run.setPlayerPosition({ x: at.x + 400, y: at.y });
  await settle(run, 2);
  run.setPlayerPosition(at);
  await settle(run, 8);
}

interface Case {
  readonly name: string;
  readonly module: ChapterModule;
  readonly before: readonly string[];
  readonly trigger: string;
  readonly active: (run: ChapterRun) => boolean;
}

const CASES: readonly Case[] = [
  { name: 'chapter 1: the chipper row', module: chapter1, before: ['c1.explore.pub', 'c1.puzzle.kegs', 'c1.explore.yard'], trigger: 'c1.trig.chipper', active: (r) => r.fight('c1.fight.chipper')?.active === true },
  { name: 'chapter 1: Big Tom', module: chapter1, before: ['c1.explore.pub', 'c1.puzzle.kegs', 'c1.explore.yard', 'c1.explore.street', 'c1.fight.chipper'], trigger: 'c1.trig.boss', active: (r) => r.boss('c1.boss.bigtom')?.active === true },
  { name: 'chapter 2: the cousins', module: chapter2, before: ['c2.explore.bog', 'c2.stealth.bog', 'c2.explore.shed'], trigger: 'c2.trig.cousins', active: (r) => r.fight('c2.fight.yard')?.active === true },
  {
    name: 'chapter 3: Halloran',
    module: chapter3,
   
    before: ['c3.explore.bar', 'c3.stealth.yard', 'c3.explore.office', 'c3.puzzle.crates', 'c3.explore.bayoffice', 'c3.fight.bay', 'c3.deduction.boston'],
    trigger: 'c3.trig.boss',
    active: (r) => r.boss('c3.boss.halloran')?.active === true,
  },
  {
    name: 'chapter 4: the foreman',
    module: chapter4,
   
    before: ['c4.explore.bar', 'c4.fight.brawl', 'c4.stealth.docks', 'c4.puzzle.containers', 'c4.explore.container', 'c4.deduction.dc'],
    trigger: 'c4.trig.foreman',
    active: (r) => r.boss('c4.boss.foreman')?.active === true,
  },
];

describe('a fight under way survives a load and a return to the bar', () => {
  for (const c of CASES) {
    it(`${c.name}: started, saved, loaded, and it can be started again`, async () => {
      const a = await begin(c.module, 'chapter');
      for (const id of c.before) a.run.completeSection(id as never, 'debug');
      await settle(a.run);
      await walkInto(a.run, c.module, c.trigger);
      expect(c.active(a.run), 'starts the first time').toBe(true);
      a.run.learnMove('lastOrders'); // a move not yet known: writes a save
      const b = await begin(c.module, 'continue', a.store);
      await walkInto(b.run, c.module, c.trigger);
      expect(c.active(b.run), 'starts again after a load').toBe(true);
    });
  }
});
