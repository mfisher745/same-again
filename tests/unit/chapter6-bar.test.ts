/**
 * Chapter 6: back to the bar (DESIGN.md 7.1, docs/chapters/README.md "What a return to the bar keeps"), a load with each fight, the
 * maze or the combine under way, and Myko's call on each callable section.
 *
 * The reload trap: a fight, set piece or puzzle started by a trigger is never guarded by a saved "started" flag, so after a load or a
 * return to the bar the next walk into its trigger starts it again.
 */

import { describe, expect, it } from 'vitest';
import { BAR_ARRIVAL, MAZE_INTRO_AREA, MYKO_ICE, STEALTH_START } from '../../src/chapters/06/maps';
import { TUNING } from '../../src/content/tuning';
import { levelTable } from '../../src/systems/meter';
import { chapter6 } from '../../src/chapters/06/index';
import { NO_INPUT, drinkItem, record, settleDialogue, startChapterGame } from './helpers';
import {
  crossFields,
  doCentre,
  doMotel,
  doTown,
  enter,
  examine,
  intoYard,
  mid,
  newGame,
  settle,
  solveMaze,
  stepOn,
  toFields,
  winDrones,
} from './chapter6-steps';

type Run = Awaited<ReturnType<typeof newGame>>['run'];

async function toSober(run: Run): Promise<void> {
  run.holdDrain(false);
  run.player.meter = { ...run.player.meter, value: 0.01, tea: null };
  for (let i = 0; i < 12; i++) run.tick(16, NO_INPUT);
  run.completeBarReturn();
  await settle(run, 4);
}

async function throughDrones() {
  const g = await newGame();
  await doMotel(g.run);
  await doTown(g.run);
  await crossFields(g.run);
  await intoYard(g.run);
  await winDrones(g.run);
  return g;
}

async function throughBoard() {
  const g = await throughDrones();
  await solveMaze(g.run);
  await doCentre(g.run);
  return g;
}

describe('chapter 6: back to the bar', () => {
  it.each(['sober', 'floor'] as const)('%s: back in the lounge, the return line, the coffee on offer again, bottles topped up, Myko at the ice machine, the clue kept', async (reason) => {
    const { run } = await newGame();
    examine(run, 'c6.clue.ledger');
    await settle(run, 6);
    const shown = record(run.bus, 'dialogue:show');
    const returned = record(run.bus, 'bar:returned');
    run.holdDrain(false);
    if (reason === 'sober') run.player.meter = { ...run.player.meter, value: 0.01 };
    else {
      run.give({ kind: 'drink', drinkId: 'stout', count: 1 });
      run.player.meter = { ...run.player.meter, value: levelTable(4).floor - 1 };
      expect(drinkItem(run, 'stout')).toBe(true);
    }
    for (let i = 0; i < 80 && returned.length === 0; i++) {
      run.tick(16, NO_INPUT);
      run.completeBarReturn();
    }
    await settle(run, 4);
    expect(returned).toHaveLength(1);
    expect(run.screenId).toBe('c6.motel');
    expect(run.player.pos).toEqual(BAR_ARRIVAL);
    expect(shown.map((s) => s.sequenceId)).toContain('c6.bar.return');
    expect(run.hotDrinkOffered()).toBe(true);
    expect(run.player.kit.bottles).toBeGreaterThanOrEqual(TUNING.overhaul!.carry.minBottlesOnLeavingBar);
    expect(run.myko.pos).toEqual(MYKO_ICE);
    expect(run.flag('clue.ledger')).toBe(true);
  });

  it('keeps the finished sections: passed drones are gone, the fight is not on again, the maze stays solved and open, Second Opinion stays learned', async () => {
    const { run } = await throughBoard();
    await toSober(run);
    expect(run.isComplete('c6.stealth.fields')).toBe(true);
    expect(run.isComplete('c6.fight.drones')).toBe(true);
    expect(run.isComplete('c6.puzzle.maze')).toBe(true);
    expect(run.player.kit.moves).toContain('secondOpinion');
    expect(run.objective()).toBe('c6.combine');
    await enter(run, 'c6.town', T0);
    await enter(run, 'c6.fields', { x: 5 * 16 + 8, y: 15 * 16 + 8 });
    expect(run.guardsHere()).toHaveLength(0);
    expect(run.dressing.prop('maze.gate')?.visible).toBe(false);
    expect(run.dressing.prop('maze.hatch')?.visible).toBe(true);
    // Walking through the yard again is just walking: the drone fight does not come back.
    run.setPlayerPosition(mid({ x: 46 * 16, y: 14 * 16, width: 32, height: 48 }));
    await settle(run, 4);
    expect(run.fight('c6.fight.drones')?.active).not.toBe(true);
    // And the way to the track is open from the town.
    expect(run.screenLayout.exits.some((e) => e.id === 'c6.fields.town')).toBe(true);
  });

  it('a return mid-fight puts it back to the first wave; the stealth stays passed; walking into the yard starts it again', async () => {
    const { run } = await newGame();
    await doMotel(run);
    await doTown(run);
    await crossFields(run);
    await intoYard(run);
    const fight = run.fight('c6.fight.drones')!;
    for (const a of fight.aliveActors()) run.defeat(a, 'player'); // wave one down
    await settle(run, 12);
    expect(fight.active).toBe(true);
    await toSober(run);
    expect(run.isComplete('c6.fight.drones')).toBe(false);
    expect(run.fight('c6.fight.drones')?.active).toBe(false);
    expect(run.fight('c6.fight.drones')?.aliveActors()).toHaveLength(0);
    expect(run.isComplete('c6.stealth.fields')).toBe(true);
    expect(run.objective()).toBe('c6.drones');
    await toFields(run);
    expect(run.guardsHere()).toHaveLength(0);
    await intoYard(run);
    const again = run.fight('c6.fight.drones')!;
    expect(again.active).toBe(true);
    expect(again.aliveActors().filter((a) => a.enemyId === 'drone')).toHaveLength(3);
  });

  it('a return mid-stealth puts the guards back at the start of the section', async () => {
    const { run } = await newGame();
    await doMotel(run);
    await doTown(run);
    await toFields(run);
    run.setPlayerPosition(mid(STEALTH_START));
    await settle(run, 3);
    expect(run.guardsHere()).toHaveLength(5);
    await toSober(run);
    expect(run.isComplete('c6.stealth.fields')).toBe(false);
    await toFields(run);
    run.setPlayerPosition(mid(STEALTH_START));
    await settle(run, 3);
    expect(run.guardsHere()).toHaveLength(5);
  });

  it('a return mid-maze keeps the stones lit (an unsolved puzzle keeps its state); the rest of the order solves it', async () => {
    const { run } = await throughDrones();
    run.setPlayerPosition(mid(MAZE_INTRO_AREA));
    await settle(run, 4);
    await stepOn(run, 'near');
    await toSober(run);
    expect(run.isComplete('c6.puzzle.maze')).toBe(false);
    await enter(run, 'c6.fields', { x: 5 * 16 + 8, y: 15 * 16 + 8 });
    run.setPlayerPosition(mid(MAZE_INTRO_AREA));
    await settle(run, 4);
    const stones = record(run.bus, 'maze:stone');
    await stepOn(run, 'far');
    await stepOn(run, 'hatch');
    expect(stones.map((s) => s.outcome)).toEqual(['right', 'solved']);
    expect(run.isComplete('c6.puzzle.maze')).toBe(true);
  });

  it('a return mid-combine: the corn regrows, the harvester is gone, and walking back into the arena starts it again', async () => {
    const { run } = await throughBoard();
    await intoYard(run);
    await settle(run, 6);
    expect(run.boss('c6.setpiece.combine')?.active).toBe(true);
    const standing = run.corn.standingTiles('c6.fields').length;
    run.cutCorn({ x: 20 * 16, y: 8 * 16, width: 64, height: 160 });
    expect(run.corn.standingTiles('c6.fields').length).toBeLessThan(standing);
    await toSober(run);
    expect(run.isComplete('c6.setpiece.combine')).toBe(false);
    expect(run.boss('c6.setpiece.combine')?.active).not.toBe(true);
    expect(run.corn.standingTiles('c6.fields').length).toBe(standing);
    expect(run.objective()).toBe('c6.combine');
    await enter(run, 'c6.fields', { x: 5 * 16 + 8, y: 15 * 16 + 8 });
    await intoYard(run);
    await settle(run, 6);
    expect(run.boss('c6.setpiece.combine')?.active).toBe(true);
  });
});

describe('chapter 6: save and load', () => {
  it('a load puts Andrew in the lounge with the finished work kept and the guards gone', async () => {
    const a = await throughDrones();
    a.run.learnMove('lastOrders'); // a move not yet known: writes a save
    const { run } = await newGame('continue', a.store);
    expect(run.screenId).toBe('c6.motel');
    expect(run.player.pos).toEqual(BAR_ARRIVAL);
    expect(run.isComplete('c6.stealth.fields')).toBe(true);
    expect(run.isComplete('c6.fight.drones')).toBe(true);
    expect(run.player.kit.moves).toContain('secondOpinion');
    expect(run.objective()).toBe('c6.maze');
    await enter(run, 'c6.fields', { x: 5 * 16 + 8, y: 15 * 16 + 8 });
    expect(run.guardsHere()).toHaveLength(0);
  });

  it('a load with the drone fight under way: it starts again at the yard', async () => {
    const a = await newGame();
    await doMotel(a.run);
    await doTown(a.run);
    await crossFields(a.run);
    await intoYard(a.run);
    expect(a.run.fight('c6.fight.drones')?.active).toBe(true);
    a.run.learnMove('lastOrders'); // writes a save with the fight under way
    const { run } = await newGame('continue', a.store);
    expect(run.fight('c6.fight.drones')?.active).not.toBe(true);
    expect(run.isComplete('c6.fight.drones')).toBe(false);
    await enter(run, 'c6.fields', { x: 5 * 16 + 8, y: 15 * 16 + 8 });
    await intoYard(run);
    expect(run.fight('c6.fight.drones')?.active).toBe(true);
    await winDrones(run);
    expect(run.isComplete('c6.fight.drones')).toBe(true);
  });

  it('a load with the maze under way: it can be solved from the start', async () => {
    const a = await throughDrones();
    a.run.setPlayerPosition(mid(MAZE_INTRO_AREA));
    await settle(a.run, 4);
    await stepOn(a.run, 'near');
    a.run.learnMove('lastOrders');
    const { run } = await newGame('continue', a.store);
    expect(run.isComplete('c6.puzzle.maze')).toBe(false);
    await enter(run, 'c6.fields', { x: 5 * 16 + 8, y: 15 * 16 + 8 });
    await solveMaze(run);
    expect(run.isComplete('c6.puzzle.maze')).toBe(true);
    expect(run.dressing.prop('maze.hatch')?.visible).toBe(true);
  });

  it('a load with the maze solved keeps the gate open', async () => {
    const a = await throughDrones();
    await solveMaze(a.run);
    a.run.learnMove('lastOrders');
    const { run } = await newGame('continue', a.store);
    expect(run.isComplete('c6.puzzle.maze')).toBe(true);
    expect(run.dressing.prop('maze.gate')?.visible).toBe(false);
    expect(run.dressing.prop('maze.hatch')?.visible).toBe(true);
  });

  it('a load with the combine under way: it starts again, and finishing it closes the chapter', async () => {
    const a = await throughBoard();
    await intoYard(a.run);
    await settle(a.run, 6);
    expect(a.run.boss('c6.setpiece.combine')?.active).toBe(true);
    a.run.learnMove('lastOrders');
    const { run } = await newGame('continue', a.store);
    expect(run.boss('c6.setpiece.combine')?.active).not.toBe(true);
    expect(run.isComplete('c6.setpiece.combine')).toBe(false);
    expect(run.isComplete('c6.deduction.roswell')).toBe(true);
    await enter(run, 'c6.fields', { x: 5 * 16 + 8, y: 15 * 16 + 8 });
    await intoYard(run);
    await settle(run, 6);
    expect(run.boss('c6.setpiece.combine')?.active).toBe(true);
    const ended = record(run.bus, 'chapter:completed');
    const boss = run.boss('c6.setpiece.combine')!;
    for (const tag of ['light1', 'light2', 'light3']) {
      run.defeat(boss.body(tag)!, 'player');
      await settle(run, 3);
    }
    for (let i = 0; i < 4000 && ended.length === 0; i++) {
      run.player.meter = { ...run.player.meter, value: 50 };
      run.tick(16, NO_INPUT);
      if (i % 20 === 0) await settle(run, 1);
    }
    expect(ended).toHaveLength(1);
  });

  it('a load after the combine was stopped plays the closing and finishes the chapter', async () => {
    const a = await throughBoard();
    await intoYard(a.run);
    await settle(a.run, 6);
    const boss = a.run.boss('c6.setpiece.combine')!;
    for (const tag of ['light1', 'light2', 'light3']) {
      a.run.defeat(boss.body(tag)!, 'player');
      await settle(a.run, 3);
    }
    expect(a.run.isComplete('c6.setpiece.combine')).toBe(true);
    // Not through `newGame`: that would run the closing before it could be watched.
    const { run } = startChapterGame(chapter6, 'continue', a.store);
    const shown = record(run.bus, 'dialogue:show');
    const ended = record(run.bus, 'chapter:completed');
    for (let i = 0; i < 40; i++) {
      run.tick(16, NO_INPUT);
      await settleDialogue(run, 4);
    }
    expect(shown.map((s) => s.sequenceId)).toContain('c6.closing');
    expect(ended).toHaveLength(1);
  });
});

describe("chapter 6: Myko's call-in on each callable section", () => {
  async function finishCall(run: Run): Promise<void> {
    for (let i = 0; i < 400; i++) {
      run.tick(50, NO_INPUT);
      if (i % 20 === 0) await settleDialogue(run);
    }
    await settleDialogue(run);
  }

  it('lists exactly the drone fight, the maze, the board and the combine as callable', async () => {
    expect(chapter6.def.sections.filter((s) => s.mykoCallable).map((s) => s.id).sort()).toEqual(['c6.deduction.roswell', 'c6.fight.drones', 'c6.puzzle.maze', 'c6.setpiece.combine']);
  });

  it('the drone fight: the call finishes it and plays c6.call.fight', async () => {
    const { run } = await newGame();
    await doMotel(run);
    await doTown(run);
    await crossFields(run);
    await intoYard(run);
    const shown = record(run.bus, 'dialogue:show');
    expect(run.myko.tryCall()).toBe(true);
    await finishCall(run);
    expect(run.isComplete('c6.fight.drones')).toBe(true);
    expect(shown.map((s) => s.sequenceId)).toContain('c6.call.fight');
    expect(run.objective()).toBe('c6.maze');
  });

  it('the maze: the call solves it, opens the gate and plays c6.call.puzzle', async () => {
    const { run } = await throughDrones();
    run.setPlayerPosition(mid(MAZE_INTRO_AREA));
    await settle(run, 4);
    const shown = record(run.bus, 'dialogue:show');
    expect(run.myko.tryCall()).toBe(true);
    await finishCall(run);
    expect(run.isComplete('c6.puzzle.maze')).toBe(true);
    expect(run.dressing.prop('maze.gate')?.visible).toBe(false);
    expect(run.dressing.prop('maze.hatch')?.visible).toBe(true);
    expect(shown.map((s) => s.sequenceId)).toContain('c6.call.puzzle');
    expect(shown.map((s) => s.sequenceId)).not.toContain('c6.maze.done');
  });

  it('the board: the call solves it and the combine is next', async () => {
    const { run } = await throughDrones();
    await solveMaze(run);
    examine(run, 'c6.clue.receipt');
    await settle(run, 10);
    expect(run.activeDeduction()?.isOpen).toBe(true);
    expect(run.myko.tryCall()).toBe(true);
    await finishCall(run);
    expect(run.isComplete('c6.deduction.roswell')).toBe(true);
    expect(run.objective()).toBe('c6.combine');
  });
});

/** On the road in the town, where he steps in from the track. */
const T0 = { x: 47 * 16 + 8, y: 10 * 16 + 8 };
