/**
 * Chapter 8 beats, in order, through the real triggers and examinables: the roadhouse, the sun, Barred, the perimeter, the
 * junction puzzle, the fence, the board, Pruitt and the closing.
 */

import { describe, expect, it } from 'vitest';
import { chapter8 } from '../../src/chapters/08/index';
import { BARRED_AGENT_SPOT, BAR_ARRIVAL, MYKO_BAR } from '../../src/chapters/08/maps';
import { pool } from '../../src/content/dialogue';
import { createMeter, levelTable } from '../../src/systems/meter';
import { NO_INPUT, frame, record } from './helpers';
import {
  BOARD,
  BOSS,
  FIGHT,
  PUZZLE,
  STEALTH,
  crossPerimeter,
  doBoard,
  doRoadhouse,
  examine,
  newGame,
  settle,
  solveJunctions,
  startFence,
  startPruitt,
  stepOutFromAwning,
  toGate,
  toWash,
  walkClosing,
  wearDown,
  winFence,
} from './chapter8-steps';

describe('chapter 8: the roadhouse', () => {
  it('opens at the bar with the title, the open scene, Myko at the table, the hot drink on offer, and the roadhouse in shade', async () => {
    const { run } = await newGame();
    expect(run.screenId).toBe('c8.road');
    expect(run.player.pos).toEqual(BAR_ARRIVAL);
    expect(run.objective()).toBe('c8.station');
    expect(run.hotDrinkOffered()).toBe(true);
    expect(run.dressing.prop('bar.steam')?.visible).toBe(true);
    expect(run.myko.pos).toEqual(MYKO_BAR);
    expect(run.heat()).toEqual({ active: true, sunnyScreen: true, inSun: false });
  });

  it('the hot drink, the dollar and one beer, then the attendant\'s four lines in turn; the fuel log and the car finish the road', async () => {
    const { run } = await newGame();
    const shown = record(run.bus, 'dialogue:show');
    const beers = () => run.player.kit.drinks.lightBeer ?? 0;
    const before = beers();
    examine(run, 'c8.tea');
    await settle(run, 6);
    expect(run.isComplete('c8.explore.bar')).toBe(true);
    expect(run.takeHotDrink('coffee')).toBe(true);
    expect(run.dressing.prop('bar.steam')?.visible).toBe(false);
    examine(run, 'c8.attendant');
    await settle(run, 6);
    expect(beers()).toBe(before + 1);
    for (let i = 0; i < 5; i++) {
      examine(run, 'c8.attendant');
      await settle(run, 6);
    }
    const lines = shown.map((s) => s.sequenceId).filter((s) => s.startsWith('c8.attendant.') || s === 'c8.bar.dollar');
    expect(lines).toEqual(['c8.bar.dollar', 'c8.attendant.1', 'c8.attendant.2', 'c8.attendant.3', 'c8.attendant.4', 'c8.attendant.1']);
    expect(beers()).toBe(before + 1);
    examine(run, 'c8.clue.schedule');
    await settle(run, 6);
    expect(run.isComplete('c8.explore.road')).toBe(false);
    examine(run, 'c8.clue.car');
    await settle(run, 6);
    expect(run.isComplete('c8.explore.road')).toBe(true);
    expect(run.objective()).toBe('c8.wash');
    const book = JSON.stringify(run.snapshot().casebook);
    expect(book).toContain('c8.clue.schedule');
    expect(book).toContain('c8.clue.car');
  });

  it('the Ohio rule: Myko has a pool of tangents and eight Ohio lines', () => {
    expect(chapter8.mykoTangentPools?.ohio).toBe('c8.ohio');
    expect(pool('c8.ohio').length).toBeGreaterThanOrEqual(8);
  });
});

describe('chapter 8: Barred', () => {
  type Run = Awaited<ReturnType<typeof newGame>>['run'];
  const agents = (run: Run) => run.enemies().filter((e) => e.enemyId === 'agent' && !e.down);
  const FECKED = levelTable(8).fecked.min + 2;

  it('walking in at the wash puts a lone agent at the end of it, plays the lesson once and puts Barred in the kit; throwing him out finishes it', async () => {
    const { run } = await newGame();
    const shown = record(run.bus, 'dialogue:show');
    const learned = record(run.bus, 'move:learned');
    await toWash(run);
    expect(shown.map((s) => s.sequenceId)).toContain('c8.barred.lesson');
    expect(learned.map((l) => l.moveId)).toEqual(['barred']);
    expect(run.player.kit.moves).toContain('barred');
    expect(agents(run)).toHaveLength(1);
    expect(Math.abs(agents(run)[0]!.pos.x - BARRED_AGENT_SPOT.x)).toBeLessThan(40);
    // The real move: on slot 4 (taken by another move at this point of the kit, so the Tab screen puts it there), Fecked, the agent in reach, key 4.
    run.assignMove(4, 'barred');
    const a = agents(run)[0]!;
    a.stationary = true;
    run.player.holdDrain(true);
    run.player.meter = createMeter(8, FECKED);
    run.setPlayerPosition({ x: a.pos.x - 30, y: a.pos.y });
    run.tick(16, frame({ pressed: ['special4'], aim: a.pos }));
    await settle(run, 4);
    expect(a.down).toBe(true);
    expect(run.flag('barred.done')).toBe(true);
    expect(shown.map((s) => s.sequenceId)).toContain('c8.barred.done');
  });

  it('the lesson is not played twice, and nobody is left once the agent is out', async () => {
    const { run } = await newGame();
    await toWash(run);
    const shown = record(run.bus, 'dialogue:show');
    run.defeat(agents(run)[0]!, 'player');
    await settle(run, 3);
    expect(run.flag('barred.done')).toBe(true);
    await toWash(run);
    expect(shown.filter((s) => s.sequenceId === 'c8.barred.lesson')).toHaveLength(0);
    expect(agents(run)).toHaveLength(0);
  });
});

describe('chapter 8: the whole chapter in order', () => {
  it('roadhouse, sun, Barred, perimeter, junctions, fence, board, Pruitt, closing', async () => {
    const { run } = await newGame();
    const order: string[] = [];
    run.bus.on('section:completed', ({ sectionId }) => void order.push(sectionId));
    const shown = record(run.bus, 'dialogue:show');
    const said = (id: string) => shown.some((s) => s.sequenceId === id);
    const ended = record(run.bus, 'chapter:completed');

    await doRoadhouse(run);
    expect(run.objective()).toBe('c8.wash');
    await stepOutFromAwning(run);
    expect(said('c8.sun.lesson')).toBe(true);
    await toWash(run);
    expect(said('c8.barred.lesson')).toBe(true);

    await crossPerimeter(run);
    expect(run.isComplete(STEALTH)).toBe(true);
    expect(run.flag('perimeter.clean')).toBe(true);
    expect(said('c8.perimeter.open')).toBe(true);
    expect(said('c8.perimeter.clean')).toBe(true);
    expect(run.objective()).toBe('c8.junctions');
    // The service gate is open and its exit usable.
    expect(run.dressing.prop('fence.service')?.visible).toBe(false);
    expect(run.dressing.prop('fence.service.open')?.visible).toBe(true);

    // The fence fight does not start until the puzzle is solved.
    run.setPlayerPosition({ x: 640, y: 112 });
    await settle(run, 8);
    expect(run.fight(FIGHT)?.active).toBe(false);
    expect(run.isNight()).toBe(false);

    await solveJunctions(run);
    expect(run.isComplete(PUZZLE)).toBe(true);
    expect(said('c8.junctions.intro')).toBe(true);
    expect(said('c8.junctions.done')).toBe(true);
    expect(run.objective()).toBe('c8.fence');

    await startFence(run);
    expect(said('c8.fence.intro')).toBe(true);
    expect(run.isNight()).toBe(true);
    expect(run.heatActive()).toBe(false);
    expect(run.fight(FIGHT)?.active).toBe(true);
    expect(run.fight(FIGHT)!.aliveActors()).toHaveLength(4);
    expect(run.dressing.prop('fight.truck')?.visible).toBe(true);
    await winFence(run);
    expect(run.isComplete(FIGHT)).toBe(true);
    expect(said('c8.fence.end')).toBe(true);
    expect(run.dressing.prop('fence.clipboard')?.visible).toBe(true);
    expect(run.dressing.prop('fence.gate')?.visible).toBe(false);
    expect(run.objective()).toBe('c8.board');

    await doBoard(run);
    expect(run.isComplete(BOARD)).toBe(true);
    expect(said('c8.board.right')).toBe(true);
    expect(run.objective()).toBe('c8.pruitt');
    expect(JSON.stringify(run.snapshot().casebook)).toContain('c8.clue.shift');

    await toGate(run);
    expect(said('c8.caption.gate')).toBe(true);
    await startPruitt(run);
    expect(said('c8.pruitt.intro')).toBe(true);
    expect(run.boss(BOSS)?.active).toBe(true);
    wearDown(run);
    await settle(run, 8);
    expect(run.isComplete(BOSS)).toBe(true);
    expect(said('c8.pruitt.end')).toBe(true);
    expect(run.boss(BOSS)!.body('pruitt')!.down).toBe(false);
    expect(run.flag('lanyard')).toBe(true);
    expect(ended).toHaveLength(0);

    await walkClosing(run);
    for (let i = 0; i < 10 && ended.length === 0; i++) run.tick(16, NO_INPUT);
    await settle(run, 6);
    expect(said('c8.closing')).toBe(true);
    expect(ended).toHaveLength(1);
    expect(run.dialogue.missing.size).toBe(0);
    const want = ['c8.explore.bar', 'c8.explore.road', STEALTH, PUZZLE, FIGHT, BOARD, BOSS];
    expect(order.filter((s) => want.includes(s))).toEqual(want);
  });

  it('walkChapter completes every section', async () => {
    const { run } = await newGame();
    run.walkChapter();
    await settle(run, 6);
    for (const s of chapter8.def.sections) expect(run.isComplete(s.id), s.id).toBe(true);
  });
});
