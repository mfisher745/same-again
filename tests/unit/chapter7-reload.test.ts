/**
 * Chapter 7 and the reload trap: a fight, boss or stealth section started by a one-time trigger starts again after a load
 * (Continue) or a return to the bar, and what was finished stays finished. Also the walk back after a return.
 */

import { describe, expect, it } from 'vitest';
import { PROP } from '../../src/art/props';
import { BAR_ARRIVAL, MYKO_BAR, STOCK_START } from '../../src/chapters/07/maps';
import { NO_INPUT, record } from './helpers';
import {
  BOARD,
  BOSS,
  STEALTH,
  TELLS,
  YARD,
  crossStock,
  doGary,
  doTells,
  enter,
  examine,
  examineFigures,
  intoArena,
  intoYard,
  mid,
  newGame,
  settle,
  toShop,
  upToMascots,
} from './chapter7-steps';

type Run = Awaited<ReturnType<typeof newGame>>['run'];

async function toSober(run: Run): Promise<void> {
  run.holdDrain(false);
  run.player.meter = { ...run.player.meter, value: 0.01, tea: null };
  for (let i = 0; i < 12; i++) run.tick(16, NO_INPUT);
  run.completeBarReturn();
  await settle(run, 4);
}

/** The path to the yard: tells, Gary, the stockroom crossed clean. */
async function toYard(run: Run): Promise<void> {
  await doTells(run);
  await doGary(run);
  await crossStock(run);
}

describe('chapter 7: the yard fight survives a load and a return', () => {
  it('started by the roller door, saved, loaded, and the door starts it again', async () => {
    const a = await newGame();
    await toYard(a.run);
    await intoYard(a.run);
    expect(a.run.fight(YARD)?.active).toBe(true);
    a.run.learnMove('barred'); // a move not yet known: writes a save
    const b = await newGame('continue', a.store);
    expect(b.run.isComplete(STEALTH)).toBe(true);
    expect(b.run.fight(YARD)?.active).toBe(false);
    expect(b.run.screenId).toBe('c7.strip');
    expect(b.run.objective()).toBe('c7.yard');
    await enter(b.run, 'c7.stock', mid(STOCK_START));
    await intoYard(b.run);
    expect(b.run.fight(YARD)?.active, 'starts again after a load').toBe(true);
  });

  it('a return to the bar mid-fight puts the fight back to its start, and the yard door starts it again', async () => {
    const { run } = await newGame();
    await toYard(run);
    await intoYard(run);
    expect(run.fight(YARD)?.active).toBe(true);
    await toSober(run);
    expect(run.screenId).toBe('c7.strip');
    expect(run.player.pos).toEqual(BAR_ARRIVAL);
    expect(run.fight(YARD)?.active).toBe(false);
    expect(run.isComplete(YARD)).toBe(false);
    expect(run.isComplete(STEALTH)).toBe(true);
    expect(run.myko.pos).toEqual(MYKO_BAR);
    await enter(run, 'c7.stock', { x: 17 * 16, y: 6 * 16 });
    await intoYard(run);
    expect(run.fight(YARD)?.active).toBe(true);
  });
});

describe('chapter 7: the mascots survive a load and a return', () => {
  it('under way, saved, loaded, and walking into the arena starts them again from the beginning', async () => {
    const a = await newGame();
    await upToMascots(a.run);
    await intoArena(a.run);
    expect(a.run.boss(BOSS)?.active).toBe(true);
    a.run.learnMove('barred');
    const b = await newGame('continue', a.store);
    expect(b.run.isComplete(BOARD)).toBe(true);
    expect(b.run.boss(BOSS)?.active).toBe(false);
    expect(b.run.objective()).toBe('c7.mascots');
    await intoArena(b.run);
    expect(b.run.boss(BOSS)?.active, 'starts again after a load').toBe(true);
    expect(b.run.boss(BOSS)?.phase?.id).toBe('three');
    expect(b.run.boss(BOSS)!.aliveActors()).toHaveLength(3);
  });

  it('a return mid-boss resets it with the sign put away; the arena starts it again; the board stays done', async () => {
    const { run } = await newGame();
    await upToMascots(run);
    await intoArena(run);
    const boss = run.boss(BOSS)!;
    run.defeat(boss.body('zip')!, 'player');
    await settle(run, 3);
    expect(boss.phase?.id).toBe('two');
    await toSober(run);
    expect(run.isComplete(BOARD)).toBe(true);
    expect(run.isComplete(BOSS)).toBe(false);
    expect(run.boss(BOSS)?.active).toBe(false);
    expect(run.dressing.prop('mascot.sign')?.visible).toBe(false);
    expect(run.objective()).toBe('c7.mascots');
    await intoArena(run);
    expect(run.boss(BOSS)?.active).toBe(true);
    expect(run.boss(BOSS)?.phase?.id).toBe('three');
    expect(run.boss(BOSS)!.aliveActors()).toHaveLength(3);
  });

  it('beaten and then a load before the closing: the prize and the night come again, once', async () => {
    const a = await newGame();
    await upToMascots(a.run);
    await intoArena(a.run);
    a.run.completeSection(BOSS, 'debug');
    await settle(a.run, 2);
    const b = await newGame('continue', a.store);
    const ended = record(b.run.bus, 'chapter:completed');
    const shown = record(b.run.bus, 'dialogue:show');
    for (let i = 0; i < 4000 && ended.length === 0; i++) {
      b.run.tick(16, NO_INPUT);
      if (i % 20 === 0) await settle(b.run, 1);
    }
    expect(b.run.isComplete(BOSS)).toBe(true);
    expect(ended).toHaveLength(1);
    expect(b.run.player.kit.weapons).toContain('inflatableAlien');
    expect(shown.filter((s) => s.sequenceId === 'c7.closing')).toHaveLength(1);
    expect(shown.map((s) => s.sequenceId)).toContain('c7.closing');
  });
});

describe('chapter 7: what a load or a return keeps and what it puts back', () => {
  it('the shop stays closed: the tourists are gone, the back door is open, Last Orders is learned, no second tequila', async () => {
    const a = await newGame();
    examine(a.run, 'c7.bar.tequila');
    await settle(a.run, 6);
    const tequila = a.run.player.kit.drinks.tequila ?? 0;
    await doTells(a.run);
    await doGary(a.run);
    const b = await newGame('continue', a.store);
    expect(b.run.player.kit.moves).toContain('lastOrders');
    await toShop(b.run);
    for (const id of ['figure.a', 'figure.c', 'figure.e']) expect(b.run.dressing.npc(id)?.visible, id).toBe(false);
    for (const id of ['figure.b', 'figure.d']) expect(b.run.dressing.npc(id)?.visible, id).toBe(true);
    b.run.setPlayerPosition({ x: 4 * 16, y: 1 * 16 + 8 });
    await settle(b.run, 3);
    expect(b.run.screenId).toBe('c7.stock');
    examine(b.run, 'c7.bar.tequila');
    await settle(b.run, 6);
    expect(b.run.player.kit.drinks.tequila ?? 0).toBeLessThanOrEqual(tequila);
  });

  it('a return to the bar keeps the solved tells and Gary; the tourists stay gone; Andrew walks through', async () => {
    const { run } = await newGame();
    await doTells(run);
    await doGary(run);
    await toSober(run);
    expect(run.isComplete(TELLS)).toBe(true);
    expect(run.isComplete('c7.explore.gary')).toBe(true);
    expect(run.player.kit.moves).toContain('lastOrders');
    expect(run.objective()).toBe('c7.stock');
    await toShop(run);
    expect(run.dressing.npc('figure.a')?.visible).toBe(false);
    expect(run.tells(TELLS)?.isComplete()).toBe(true);
  });

  it('the tells half done: the examined figures are kept through a load and the rest finish it', async () => {
    const a = await newGame();
    await toShop(a.run);
    examine(a.run, 'c7.tells.a');
    await settle(a.run, 6);
    examine(a.run, 'c7.tells.b');
    await settle(a.run, 6);
    a.run.learnMove('barred');
    const b = await newGame('continue', a.store);
    expect(b.run.tells(TELLS)?.examined()).toEqual(['a', 'b']);
    await toShop(b.run);
    await examineFigures(b.run);
    expect(b.run.activeTells()).not.toBeNull();
    expect(b.run.submitTells(TELLS, ['gary', 'd', 'b']).correct).toBe(true);
  });

  it('the stockroom alarm: a return puts the clerks back on their routes and he can be caught again', async () => {
    const { run } = await newGame();
    await doTells(run);
    await doGary(run);
    await enter(run, 'c7.stock', mid(STOCK_START));
    await settle(run, 3);
    run.stealth(STEALTH)!.alarm();
    await settle(run, 3);
    await toSober(run);
    expect(run.isComplete(STEALTH)).toBe(false);
    await enter(run, 'c7.stock', mid(STOCK_START));
    await settle(run, 3);
    expect(run.guardsHere()).toHaveLength(4);
    run.stealth(STEALTH)!.alarm();
    await settle(run, 3);
    expect(run.fight('c7.stealth.stock.alarm' as never)?.active).toBe(true);
  });

  it('the clean-run stout is put back after a load until it is taken', async () => {
    const a = await newGame();
    await doTells(a.run);
    await doGary(a.run);
    await crossStock(a.run);
    a.run.learnMove('barred');
    const b = await newGame('continue', a.store);
    expect(b.run.flag('stock.clean')).toBe(true);
    await enter(b.run, 'c7.stock', mid(STOCK_START));
    expect(b.run.dressing.prop('stock.fridge')?.frame).toBe(PROP.staffFridge.open);
    expect(b.run.pickups().some((p) => p.def.id === 'c7.pickup.stout')).toBe(true);
  });
});
