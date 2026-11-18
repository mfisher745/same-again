/**
 * Chapter 7 beats, in order, through the real triggers and examinables: the bar, the strip, who is an alien, Gary and
 * Last Orders, the stockroom, the yard, the van, the board, the mascots and the closing. Also chapter 6 leading into 7.
 */

import { describe, expect, it } from 'vitest';
import { chapter6 } from '../../src/chapters/06/index';
import { chapter7 } from '../../src/chapters/07/index';
import { BAR_ARRIVAL, MYKO_BAR } from '../../src/chapters/07/maps';
import { clearChapterRegistry, registerChapter } from '../../src/core/chapter';
import { MemoryStorage, SaveStore } from '../../src/core/save';
import { GameSession } from '../../src/systems/session';
import { NO_INPUT, record } from './helpers';
import {
  BOARD,
  BOSS,
  STEALTH,
  TELLS,
  YARD,
  crossStock,
  doBar,
  doBoard,
  doGary,
  doStrip,
  doTells,
  doVan,
  examine,
  intoArena,
  intoYard,
  newGame,
  settle,
  winYard,
} from './chapter7-steps';

describe('chapter 7: the bar', () => {
  it('opens on the strip with the title, the open scene, Myko apart, the objective, and the tea on offer', async () => {
    const { run } = await newGame();
    expect(run.screenId).toBe('c7.strip');
    expect(run.player.pos).toEqual(BAR_ARRIVAL);
    expect(run.objective()).toBe('c7.strip');
    expect(run.hotDrinkOffered()).toBe(true);
    expect(run.dressing.prop('bar.steam')?.visible).toBe(true);
    expect(run.myko.pos).toEqual(MYKO_BAR);
  });

  it('the hot drink is free once; the first tequila is on the house; the bar section is done', async () => {
    const { run } = await newGame();
    const shown = record(run.bus, 'dialogue:show');
    const before = run.player.kit.drinks.tequila ?? 0;
    await doBar(run);
    expect(run.player.kit.hotDrink).toBe('tea');
    expect(run.dressing.prop('bar.steam')?.visible).toBe(false);
    expect(run.player.kit.drinks.tequila ?? 0).toBe(before + 1);
    expect(shown.map((s) => s.sequenceId)).toContain('c7.bar.tequila');
    expect(run.isComplete('c7.explore.bar')).toBe(true);
    // The second time he asks, there is no second tequila.
    examine(run, 'c7.bar.tequila');
    await settle(run, 6);
    expect(run.player.kit.drinks.tequila ?? 0).toBe(before + 1);
  });

  it('the leaflet is a clue; the shop door finishes the strip and points to the figures', async () => {
    const { run } = await newGame();
    await doStrip(run);
    expect(JSON.stringify(run.snapshot().casebook)).toContain('c7.clue.leaflet');
    expect(run.isComplete('c7.explore.strip')).toBe(true);
    expect(run.objective()).toBe('c7.tells');
  });
});

describe('chapter 7: the whole chapter in order', () => {
  it('bar, strip, tells, Gary, stockroom, yard, van, board, mascots, closing', async () => {
    const { run } = await newGame();
    const order: string[] = [];
    run.bus.on('section:completed', ({ sectionId }) => void order.push(sectionId));
    const shown = record(run.bus, 'dialogue:show');
    const said = (id: string) => shown.some((s) => s.sequenceId === id);
    const ended = record(run.bus, 'chapter:completed');

    await doBar(run);
    await doStrip(run);
    await doTells(run);
    expect(run.isComplete(TELLS)).toBe(true);
    expect(said('c7.tells.intro')).toBe(true);
    expect(said('c7.tells.right')).toBe(true);
    expect(run.objective()).toBe('c7.gary');

    await doGary(run);
    for (const id of ['c7.gary.intro', 'c7.gary.nineteen', 'c7.gary.payslip', 'c7.lastOrders.lesson']) expect(said(id), id).toBe(true);
    expect(JSON.stringify(run.snapshot().casebook)).toContain('c7.clue.payslip');
    expect(run.player.kit.moves).toContain('lastOrders');
    expect(run.objective()).toBe('c7.stock');
    expect(run.isComplete('c7.explore.gary')).toBe(true);

    await crossStock(run);
    expect(said('c7.stock.open')).toBe(true);
    expect(run.isComplete(STEALTH)).toBe(true);
    expect(run.flag('stock.clean')).toBe(true);
    expect(said('c7.stock.clean')).toBe(true);
    examine(run, 'c7.clue.permit');
    await settle(run, 6);
    expect(run.objective()).toBe('c7.yard');
    await intoYard(run);
    expect(said('c7.yard.intro')).toBe(true);
    expect(run.fight(YARD)?.active).toBe(true);
    await winYard(run);
    expect(said('c7.yard.end')).toBe(true);
    expect(run.objective()).toBe('c7.van');

    await doVan(run);
    expect(run.isComplete('c7.explore.van')).toBe(true);
    expect(run.objective()).toBe('c7.board');
    expect(run.activeDeduction()).not.toBeNull();
    await doBoard(run);
    expect(run.isComplete(BOARD)).toBe(true);
    expect(run.objective()).toBe('c7.mascots');

    await intoArena(run);
    expect(said('c7.mascots.intro')).toBe(true);
    const boss = run.boss(BOSS)!;
    expect(boss.active).toBe(true);
    for (const tag of ['zorp', 'zap', 'zip']) {
      run.defeat(boss.body(tag)!, 'player');
      await settle(run, 3);
    }
    for (let i = 0; i < 4000 && ended.length === 0; i++) {
      run.tick(16, NO_INPUT);
      if (i % 20 === 0) await settle(run, 1);
    }
    await settle(run, 6);
    for (const id of ['c7.mascots.first', 'c7.mascots.second', 'c7.mascots.end', 'c7.weapon.inflatable', 'c7.closing']) expect(said(id), id).toBe(true);
    expect(run.player.kit.weapons).toContain('inflatableAlien');
    expect(run.isNight()).toBe(true);
    expect(ended).toHaveLength(1);
    expect(run.dialogue.missing.size).toBe(0);
    const want = ['c7.explore.bar', 'c7.explore.strip', TELLS, 'c7.explore.gary', STEALTH, YARD, 'c7.explore.van', BOARD, BOSS];
    expect(order.filter((s) => want.includes(s))).toEqual(want);
  });

  it('walkChapter completes every section and the chapter', async () => {
    const { run } = await newGame();
    const ended = record(run.bus, 'chapter:completed');
    run.walkChapter();
    await settle(run, 6);
    for (const s of chapter7.def.sections) expect(run.isComplete(s.id), s.id).toBe(true);
    expect(ended).toHaveLength(1);
  });
});

describe('chapter 6 leads into chapter 7', () => {
  it('finishing chapter 6 starts chapter 7 on the strip, with its bar and Buzz at the bottom of Grand', async () => {
    clearChapterRegistry();
    registerChapter(chapter6);
    registerChapter(chapter7);
    const store = new SaveStore(new MemoryStorage());
    const session = new GameSession({ store });
    session.setDriver({ showTitle: () => undefined, startGame: () => undefined, pauseGame: () => undefined, resumeGame: () => undefined });
    session.startChapter(6);
    const six = session.createRun()!;
    six.walkChapter();
    for (let i = 0; i < 40; i++) {
      six.tick(16, NO_INPUT);
      await Promise.resolve();
    }
    const seven = session.createRun()!;
    expect(seven).not.toBe(six);
    expect(seven.module.def.number).toBe(7);
    expect(seven.screenId).toBe('c7.strip');
  });
});
