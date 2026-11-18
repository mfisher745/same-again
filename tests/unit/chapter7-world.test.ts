/**
 * Chapter 7 after the accusation: Gary and the payslip, Last Orders and the tourists leaving, the stockroom (clean run, the
 * caught path, the overheard lines), the yard fight and the gate, the van and the board.
 */

import { describe, expect, it } from 'vitest';
import { PROP } from '../../src/art/props';
import { chapter7 } from '../../src/chapters/07/index';
import { SHOP_CLOSING_EXIT, SHOP_TO_STOCK, STOCK_BACK_GATE, STOCK_OVERHEARD, STOCK_START, STRIP_BACK_GATE, STOUT_PICKUP_SPOT, YARD_SPAWNS } from '../../src/chapters/07/maps';
import { NO_INPUT, record } from './helpers';
import {
  ALIENS,
  STEALTH,
  TELLS,
  YARD,
  crossStock,
  doBoard,
  doGary,
  doTells,
  doVan,
  enter,
  examine,
  intoYard,
  mid,
  newGame,
  settle,
  wait,
  winYard,
} from './chapter7-steps';

type Run = Awaited<ReturnType<typeof newGame>>['run'];

/** The tells solved and Gary talked out: the shop is closed. */
async function toClosed(run: Run): Promise<void> {
  await doTells(run);
  await doGary(run);
}

describe('chapter 7: Gary and Last Orders', () => {
  it('each exchange is one press at the till; the payslip is the key clue; Gary closes the shop and Last Orders is learned', async () => {
    const { run } = await newGame();
    await doTells(run);
    const shown = record(run.bus, 'dialogue:show');
    examine(run, 'c7.gary');
    await settle(run, 8);
    expect(shown.map((s) => s.sequenceId)).toEqual(['c7.gary.intro']);
    expect(run.flag('garyStep')).toBe(1);
    expect(JSON.stringify(run.snapshot().casebook)).not.toContain('c7.clue.payslip');
    examine(run, 'c7.gary');
    await settle(run, 8);
    examine(run, 'c7.gary');
    await wait(run, 4000);
    expect(shown.map((s) => s.sequenceId)).toEqual(['c7.gary.intro', 'c7.gary.nineteen', 'c7.gary.payslip', 'c7.lastOrders.lesson']);
    expect(JSON.stringify(run.snapshot().casebook)).toContain('c7.clue.payslip');
    expect(run.player.kit.moves).toContain('lastOrders');
    expect(run.flag('lastOrders.done')).toBe(true);
  });

  it('the tourists walk out of the front door and are gone; the figures who are not tourists stay', async () => {
    const { run } = await newGame();
    await doTells(run);
    for (const id of ['figure.a', 'figure.c', 'figure.e']) expect(run.dressing.npc(id)?.visible, id).toBe(true);
    await doGary(run);
    for (const id of ['figure.a', 'figure.c', 'figure.e']) expect(run.dressing.npc(id)?.visible, id).toBe(false);
    for (const id of ['figure.b', 'figure.d', 'gary']) expect(run.dressing.npc(id)?.visible, id).toBe(true);
    // They were on their way to the door.
    expect(SHOP_CLOSING_EXIT.y).toBeGreaterThan(run.dressing.npc('figure.a')!.def.row * 16);
  });

  it('the shop\'s back door is shut until Gary has closed the shop', async () => {
    const { run } = await newGame();
    await doTells(run);
    run.setPlayerPosition(mid(SHOP_TO_STOCK));
    await settle(run, 3);
    expect(run.screenId).toBe('c7.shop');
    await doGary(run);
    run.setPlayerPosition(mid(SHOP_TO_STOCK));
    await settle(run, 3);
    expect(run.screenId).toBe('c7.stock');
  });

  it('after the accusation Gary says it out loud: talking before it only examines him', async () => {
    const { run } = await newGame();
    await doTells(run);
    expect(run.isComplete(TELLS)).toBe(true);
    expect(ALIENS).toContain('gary');
  });
});

describe('chapter 7: the stockroom', () => {
  it('four clerks on regular routes; the lines are overheard on the route', async () => {
    const { run } = await newGame();
    await toClosed(run);
    expect(chapter7.def.stealthSections[0]!.guards.map((g) => g.enemyId)).toEqual(['clerk', 'clerk', 'clerk', 'clerk']);
    await enter(run, 'c7.stock', mid(STOCK_START));
    const shown = record(run.bus, 'dialogue:show');
    for (let i = 0; i < STOCK_OVERHEARD.length; i++) {
      run.setPlayerPosition(mid(STOCK_OVERHEARD[i]!.area));
      await settle(run, 3);
    }
    expect(shown.map((s) => s.sequenceId).filter((s) => s.startsWith('c7.stock.overheard'))).toEqual([1, 2, 3, 4].map((n) => `c7.stock.overheard.${n}`));
    expect(run.objective()).toBe('c7.stock');
  });

  it('a clean run reveals the stout in the staff fridge: the can, the open door and a pickup that goes into the kit', async () => {
    const { run } = await newGame();
    await toClosed(run);
    expect(run.dressing.prop('stock.stout')?.visible).toBe(false);
    await crossStock(run);
    expect(run.flag('stock.clean')).toBe(true);
    expect(run.dressing.prop('stock.stout')?.visible).toBe(true);
    expect(run.dressing.prop('stock.fridge')?.frame).toBe(PROP.staffFridge.open);
    expect(run.pickups().some((p) => p.def.id === 'c7.pickup.stout')).toBe(true);
    const before = run.player.kit.drinks.stout ?? 0;
    run.setPlayerPosition(STOUT_PICKUP_SPOT);
    run.tick(16, NO_INPUT);
    await settle(run, 3);
    expect(run.player.kit.drinks.stout ?? 0).toBe(before + 1);
    expect(run.flag('stout.taken')).toBe(true);
    expect(run.dressing.prop('stock.stout')?.visible).toBe(false);
    expect(run.pickups().some((p) => p.def.id === 'c7.pickup.stout')).toBe(false);
  });

  it('the noticeboard gives the permit', async () => {
    const { run } = await newGame();
    await toClosed(run);
    await crossStock(run);
    examine(run, 'c7.clue.permit');
    await settle(run, 6);
    expect(JSON.stringify(run.snapshot().casebook)).toContain('c7.clue.permit');
  });

  it('caught: the caught line, the clerks line up and fight, no stout, and the section completes when the fight is won', async () => {
    const { run } = await newGame();
    await toClosed(run);
    await enter(run, 'c7.stock', mid(STOCK_START));
    await settle(run, 3);
    const shown = record(run.bus, 'dialogue:show');
    run.stealth(STEALTH)!.alarm();
    await settle(run, 3);
    expect(shown.map((s) => s.sequenceId)).toContain('c7.stock.caught');
    const fight = run.fight('c7.stealth.stock.alarm' as never)!;
    expect(fight.active).toBe(true);
    for (let i = 0; i < 40 && !fight.isComplete(); i++) {
      for (const a of fight.aliveActors()) run.defeat(a, 'player');
      await settle(run, 8);
    }
    expect(run.isComplete(STEALTH)).toBe(true);
    expect(run.flag('stock.clean')).not.toBe(true);
    expect(run.dressing.prop('stock.stout')?.visible).toBe(false);
    expect(run.dressing.prop('stock.fridge')?.frame).toBe(PROP.staffFridge.shut);
    expect(run.pickups().some((p) => p.def.id === 'c7.pickup.stout')).toBe(false);
    expect(run.objective()).toBe('c7.yard');
    expect(shown.map((s) => s.sequenceId)).not.toContain('c7.stock.clean');
  });

  it('the fridge says nothing until there is something in it', async () => {
    const { run } = await newGame();
    await toClosed(run);
    await enter(run, 'c7.stock', mid(STOCK_START));
    const shown = record(run.bus, 'dialogue:show');
    examine(run, 'c7.stock.fridge');
    await settle(run, 6);
    expect(shown.map((s) => s.sequenceId)).not.toContain('c7.stock.clean');
  });
});

describe('chapter 7: the yard, the van and the board', () => {
  it('three mascots and three clerks; the back gate is shut until they are down and then opens onto the strip', async () => {
    const { run } = await newGame();
    await toClosed(run);
    await crossStock(run);
    run.setPlayerPosition(mid(STOCK_BACK_GATE));
    await settle(run, 3);
    expect(run.screenId, 'gate shut before the yard').toBe('c7.stock');
    await intoYard(run);
    const fight = run.fight(YARD)!;
    expect(fight.active).toBe(true);
    expect(YARD_SPAWNS).toHaveLength(6);
    const kinds = () => fight.aliveActors().map((a) => a.enemyId);
    for (let i = 0; i < 20 && kinds().filter((k) => k === 'mascot').length < 3; i++) await settle(run, 10);
    expect(kinds().filter((k) => k === 'mascot')).toHaveLength(3);
    expect(kinds().filter((k) => k === 'clerk')).toHaveLength(3);
    await winYard(run);
    expect(run.isComplete(YARD)).toBe(true);
    run.setPlayerPosition(mid(STOCK_BACK_GATE));
    await settle(run, 3);
    expect(run.screenId).toBe('c7.strip');
    // And from the strip side.
    await enter(run, 'c7.strip', mid(STRIP_BACK_GATE));
    expect(run.screenId).toBe('c7.stock');
  });

  it('the van log is the route clue and opens the board; the board names Meridian Basin, and a wrong answer says so', async () => {
    const { run } = await newGame();
    await toClosed(run);
    await crossStock(run);
    examine(run, 'c7.clue.permit');
    await settle(run, 6);
    await intoYard(run);
    await winYard(run);
    await doVan(run);
    expect(JSON.stringify(run.snapshot().casebook)).toContain('c7.clue.route');
    expect(run.activeDeduction()?.def.id).toBe('c7.deduction.nevada');
    expect(run.submitDeduction('c7.deduction.nevada', [ev('c7.clue.leaflet'), ev('c7.clue.permit'), ev('c7.clue.route')])).toBe(false);
    await doBoard(run);
    expect(run.isComplete('c7.deduction.nevada')).toBe(true);
    expect(run.objective()).toBe('c7.mascots');
  });
});

const ev = (id: string) => id as never;
