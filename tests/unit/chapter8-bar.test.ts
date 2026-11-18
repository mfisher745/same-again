/**
 * Chapter 8: back to the bar (DESIGN.md 7.1), a load with each fight, puzzle or boss under way, and Myko's call on each callable section.
 *
 * The reload trap: a fight, puzzle or boss started by a trigger is never guarded by a saved "started" flag, so after a load or a
 * return to the bar the next walk into its trigger starts it again. Finished sections stay finished and Andrew walks through them.
 */

import { describe, expect, it } from 'vitest';
import { PROP } from '../../src/art/props';
import { BAR_ARRIVAL, CORRIDOR_LINES, JUNCTION_BOXES, MYKO_BAR, boxFrame, junctionPropId } from '../../src/chapters/08/maps';
import { chapter8 } from '../../src/chapters/08/index';
import { NO_INPUT, record, settleDialogue, startChapterGame } from './helpers';
import {
  BOARD,
  BOSS,
  FIGHT,
  PUZZLE,
  STEALTH,
  crossPerimeter,
  doBoard,
  doRoadhouse,
  enter,
  examine,
  newGame,
  pressBox,
  settle,
  solveJunctions,
  startFence,
  startPruitt,
  toGate,
  toPerimeter,
  toWash,
  wearDown,
  winFence,
} from './chapter8-steps';

type Run = Awaited<ReturnType<typeof newGame>>['run'];

async function toSober(run: Run): Promise<void> {
  run.holdDrain(false);
  run.player.meter = { ...run.player.meter, value: 0.01, tea: null };
  for (let i = 0; i < 12; i++) run.tick(16, NO_INPUT);
  run.completeBarReturn();
  await settle(run, 4);
}

const sensorsOn = (run: Run, line: number): boolean[] => run.stealthHere()[0]!.runner.hazards.filter((h) => h.id.startsWith(`c8.line${line}.`)).map((h) => h.enabled);

async function throughStealth() {
  const g = await newGame();
  await crossPerimeter(g.run);
  return g;
}
async function throughFence() {
  const g = await throughStealth();
  await solveJunctions(g.run);
  await startFence(g.run);
  await winFence(g.run);
  return g;
}
async function throughBoard() {
  const g = await throughFence();
  await doRoadhouse(g.run);
  await doBoard(g.run);
  return g;
}

describe('chapter 8: back to the bar', () => {
  it('lands in the roadhouse with the return line, Myko at the table, and the clue and the move kept', async () => {
    const { run } = await newGame();
    await doRoadhouse(run);
    await toWash(run);
    const shown = record(run.bus, 'dialogue:show');
    await toSober(run);
    expect(run.screenId).toBe('c8.road');
    expect(run.player.pos).toEqual(BAR_ARRIVAL);
    expect(run.myko.pos).toEqual(MYKO_BAR);
    expect(shown.map((s) => s.sequenceId)).toContain('c8.bar.return');
    expect(run.player.kit.moves).toContain('barred');
    expect(JSON.stringify(run.snapshot().casebook)).toContain('c8.clue.schedule');
    expect(run.objective()).toBe('c8.wash');
  });

  it('keeps the finished sections: the stealth passed, the puzzle solved with its lines dark, the fight done, the board done, the gates open; Andrew walks through them', async () => {
    const { run } = await throughBoard();
    await toSober(run);
    for (const s of [STEALTH, PUZZLE, FIGHT, BOARD] as const) expect(run.isComplete(s), s).toBe(true);
    expect(run.isNight()).toBe(true);
    expect(run.objective()).toBe('c8.pruitt');
    await enter(run, 'c8.perimeter', run.screenLayout.playerStart);
    expect(run.dressing.prop('fence.gate')?.visible).toBe(false);
    expect(run.dressing.prop('fence.gate.open')?.visible).toBe(true);
    expect(run.dressing.prop('fence.service')?.visible).toBe(false);
    expect(run.dressing.prop('fight.truck')?.visible).toBe(true);
    for (const b of JUNCTION_BOXES) expect(run.dressing.prop(junctionPropId(b.id))?.frame).toBe(boxFrame(b, true));
    // Walking over the perimeter again is only walking: no section starts, no sensor trips, the fight is not on again.
    await toPerimeter(run);
    run.setPlayerPosition({ x: 640, y: 112 });
    await settle(run, 12);
    expect(run.fight(FIGHT)?.active).not.toBe(true);
    expect(run.stealthHere()[0]?.runner.active).not.toBe(true);
  });

  it('a return mid-fight takes the fight back to the start, the clipboard is not out, and walking into the fence zone starts it again', async () => {
    const { run } = await throughStealth();
    await solveJunctions(run);
    await startFence(run);
    const fight = run.fight(FIGHT)!;
    expect(fight.active).toBe(true);
    for (const a of fight.aliveActors().slice(0, 2)) run.defeat(a, 'player');
    await settle(run, 4);
    await toSober(run);
    expect(run.isComplete(FIGHT)).toBe(false);
    expect(run.fight(FIGHT)?.active).not.toBe(true);
    expect(run.fight(FIGHT)?.aliveActors()).toHaveLength(0);
    expect(run.isComplete(PUZZLE)).toBe(true);
    expect(run.objective()).toBe('c8.fence');
    await enter(run, 'c8.perimeter', run.screenLayout.playerStart);
    expect(run.dressing.prop('fence.clipboard')?.visible).toBe(false);
    expect(run.dressing.prop('fight.truck')?.visible).toBe(false);
    await startFence(run);
    const again = run.fight(FIGHT)!;
    expect(again.active).toBe(true);
    expect(again.aliveActors()).toHaveLength(4);
    expect(run.dressing.prop('fight.truck')?.visible).toBe(true);
    expect(run.headlightsHere()).toHaveLength(1);
    await winFence(run);
    expect(run.isComplete(FIGHT)).toBe(true);
  });

  it('a return while the truck is still driving in: the fight starts at the next walk-in, once', async () => {
    const { run } = await throughStealth();
    await solveJunctions(run);
    run.setPlayerPosition({ x: 640, y: 112 });
    await settle(run, 4);
    expect(run.dressing.prop('fight.truckDrive')?.visible).toBe(true);
    expect(run.fight(FIGHT)?.active).toBe(false);
    await toSober(run);
    expect(run.dressing.prop('fight.truckDrive')?.visible).toBe(false);
    for (let i = 0; i < 300; i++) run.tick(16, NO_INPUT);
    expect(run.fight(FIGHT)?.active).not.toBe(true);
    await enter(run, 'c8.perimeter', run.screenLayout.playerStart);
    await startFence(run);
    expect(run.fight(FIGHT)?.active).toBe(true);
  });

  it('a return mid-stealth puts the section back to the start (the trucks too); the puzzle boxes are as the last save left them', async () => {
    const { run } = await newGame();
    await toPerimeter(run);
    run.setPlayerPosition({ x: 21 * 16 + 8, y: 37 * 16 + 8 });
    await settle(run, 3);
    expect(run.stealthHere()[0]?.runner.active).toBe(true);
    await toSober(run);
    expect(run.isComplete(STEALTH)).toBe(false);
    expect(run.stealthHere()[0]?.runner.active).not.toBe(true);
    await toPerimeter(run);
    expect(run.stealthHere()[0]?.runner.active).toBe(true);
  });

  it('a return mid-puzzle: the boxes show what the puzzle holds, the lines and the sensors agree, and the rest of the presses solve it', async () => {
    const { run } = await throughStealth();
    await pressBox(run, 'near');
    await toSober(run);
    expect(run.isComplete(PUZZLE)).toBe(false);
    await enter(run, 'c8.perimeter', run.screenLayout.playerStart);
    const puzzle = run.junctions(PUZZLE)!;
    for (const b of JUNCTION_BOXES) {
      const thrown = b.lines.every((l) => puzzle.isLineOff(String(l)));
      expect(run.dressing.prop(junctionPropId(b.id))?.frame, b.id).toBe(boxFrame(b, thrown));
    }
    expect(sensorsOn(run, 1).every((e) => e === !puzzle.isLineOff('1'))).toBe(true);
    // The box thrown before the return is still thrown: the other two finish it.
    await pressBox(run, 'middle');
    await pressBox(run, 'far');
    expect(run.isComplete(PUZZLE)).toBe(true);
    for (const l of CORRIDOR_LINES) expect(puzzle.isLineOff(String(l))).toBe(true);
  });

  it('a return with Pruitt under way: he is gone, the board stays done, and walking in at his chair starts him again', async () => {
    const { run } = await throughBoard();
    await toGate(run);
    run.player.holdDrain(true);
    await startPruitt(run);
    expect(run.boss(BOSS)?.active).toBe(true);
    await toSober(run);
    expect(run.isComplete(BOSS)).toBe(false);
    expect(run.boss(BOSS)?.active).not.toBe(true);
    expect(run.isComplete(BOARD)).toBe(true);
    expect(run.objective()).toBe('c8.pruitt');
    await toGate(run);
    expect(run.dressing.npc('gate.pruitt')?.visible).toBe(true);
    await startPruitt(run);
    expect(run.boss(BOSS)?.active).toBe(true);
    expect(run.boss(BOSS)!.body('pruitt')!.attacks.map((a) => a.id)).toEqual(['darts']);
  });

  it('a return after he let him through keeps it finished; he sits on his chair, the barrier is up, and the road up is open to the closing', async () => {
    const { run } = await throughBoard();
    await toGate(run);
    run.player.holdDrain(true);
    await startPruitt(run);
    wearDown(run);
    for (let i = 0; i < 20; i++) run.tick(16, NO_INPUT);
    await settle(run, 8);
    expect(run.isComplete(BOSS)).toBe(true);
    await toSober(run);
    expect(run.isComplete(BOSS)).toBe(true);
    expect(run.objective()).toBeNull();
    await toGate(run);
    expect(run.boss(BOSS)?.active).not.toBe(true);
    expect(run.dressing.prop('gate.barrier')?.frame).toBe(PROP.barrierArm.up);
    expect(run.dressing.npc('gate.pruitt')?.visible).toBe(true);
    const ended = record(run.bus, 'chapter:completed');
    run.setPlayerPosition({ x: 36 * 16, y: 10 * 16 });
    await settle(run, 10);
    expect(ended).toHaveLength(1);
  });
});

describe('chapter 8: save and load', () => {
  it('a load with the fence fight under way: it is not under way, the night is kept, and the fence trigger starts it again', async () => {
    const a = await throughStealth();
    await solveJunctions(a.run);
    await startFence(a.run);
    expect(a.run.fight(FIGHT)?.active).toBe(true);
    a.run.completeSection('c8.explore.bar', 'debug'); // writes a save with the fight under way
    const { run } = await newGame('continue', a.store);
    expect(run.fight(FIGHT)?.active).not.toBe(true);
    expect(run.isComplete(FIGHT)).toBe(false);
    expect(run.isComplete(PUZZLE)).toBe(true);
    await enter(run, 'c8.perimeter', run.screenLayout.playerStart);
    await startFence(run);
    expect(run.fight(FIGHT)?.active).toBe(true);
    expect(run.isNight()).toBe(true);
    expect(run.fight(FIGHT)!.aliveActors()).toHaveLength(4);
  });

  it('a load with the fight done: the night, the truck, the open gate and the clipboard all come back', async () => {
    const a = await throughFence();
    a.run.completeSection('c8.explore.bar', 'debug'); // writes a save
    const { run } = await newGame('continue', a.store);
    expect(run.isComplete(FIGHT)).toBe(true);
    expect(run.isNight()).toBe(true);
    expect(run.heatActive()).toBe(false);
    await enter(run, 'c8.perimeter', run.screenLayout.playerStart);
    expect(run.dressing.prop('fight.truck')?.visible).toBe(true);
    expect(run.dressing.prop('fence.gate.open')?.visible).toBe(true);
    expect(run.dressing.prop('fence.clipboard')?.visible).toBe(true);
    expect(run.objective()).toBe('c8.board');
    examine(run, 'c8.clue.shift');
    await settle(run, 6);
    expect(JSON.stringify(run.snapshot().casebook)).toContain('c8.clue.shift');
  });

  it('a load with the junctions half done keeps the lines off and the boxes thrown', async () => {
    const a = await throughStealth();
    await pressBox(a.run, 'near');
    a.run.completeSection('c8.explore.bar', 'debug'); // writes a save
    const { run } = await newGame('continue', a.store);
    expect(run.isComplete(PUZZLE)).toBe(false);
    await enter(run, 'c8.perimeter', run.screenLayout.playerStart);
    const puzzle = run.junctions(PUZZLE)!;
    expect(puzzle.linesOff()).toEqual(['1', '2']);
    expect(run.dressing.prop(junctionPropId('near'))?.frame).toBe(boxFrame(JUNCTION_BOXES[0]!, true));
  });

  it('a load with Pruitt under way: he starts again at his chair, and finishing it plays the closing', async () => {
    const a = await throughBoard();
    await toGate(a.run);
    a.run.player.holdDrain(true);
    await startPruitt(a.run);
    expect(a.run.boss(BOSS)?.active).toBe(true);
    a.run.completeSection('c8.explore.bar', 'debug'); // writes a save
    const { run } = await newGame('continue', a.store);
    expect(run.boss(BOSS)?.active).not.toBe(true);
    expect(run.isComplete(BOARD)).toBe(true);
    await toGate(run);
    run.player.holdDrain(true);
    await startPruitt(run);
    expect(run.boss(BOSS)?.active).toBe(true);
    const ended = record(run.bus, 'chapter:completed');
    wearDown(run);
    for (let i = 0; i < 20; i++) run.tick(16, NO_INPUT);
    await settle(run, 8);
    expect(run.isComplete(BOSS)).toBe(true);
    run.setPlayerPosition({ x: 36 * 16, y: 10 * 16 });
    await settle(run, 10);
    expect(ended).toHaveLength(1);
  });

  it('a load after the chapter was finished but for the closing: the closing plays when he walks up the road', async () => {
    const a = await throughBoard();
    await toGate(a.run);
    a.run.player.holdDrain(true);
    await startPruitt(a.run);
    wearDown(a.run);
    for (let i = 0; i < 20; i++) a.run.tick(16, NO_INPUT);
    await settle(a.run, 8);
    expect(a.run.isComplete(BOSS)).toBe(true);
    const { run } = startChapterGame(chapter8, 'continue', a.store);
    for (let i = 0; i < 20; i++) {
      run.tick(16, NO_INPUT);
      await settleDialogue(run, 4);
    }
    const ended = record(run.bus, 'chapter:completed');
    await enter(run, 'c8.gate', run.screenLayout.playerStart);
    run.setPlayerPosition({ x: 36 * 16, y: 10 * 16 });
    await settle(run, 10);
    expect(ended).toHaveLength(1);
  });
});

describe("chapter 8: Myko's call-in on each callable section", () => {
  it('lists exactly the junctions, the fence fight, the board and Pruitt as callable', () => {
    expect(chapter8.def.sections.filter((s) => s.mykoCallable).map((s) => s.id).sort()).toEqual([BOARD, FIGHT, PUZZLE, BOSS].sort());
  });

  async function call(run: Run): Promise<void> {
    expect(run.myko.tryCall()).toBe(true);
    for (let i = 0; i < 400; i++) {
      run.tick(50, NO_INPUT);
      if (i % 20 === 0) await settleDialogue(run);
    }
    await settleDialogue(run);
  }

  it('the board: the call solves it and the way to Pruitt opens', async () => {
    const { run } = await throughFence();
    await doRoadhouse(run);
    run.addEvidence('c7.clue.permit' as never);
    examine(run, 'c8.clue.shift');
    await settle(run, 8);
    expect(run.activeDeduction()?.isOpen).toBe(true);
    await call(run);
    expect(run.isComplete(BOARD)).toBe(true);
    expect(run.objective()).toBe('c8.pruitt');
  });

  it('Pruitt: a call during the fight ends it with the sealed scene, and walking up the road closes the chapter', async () => {
    const { run } = await throughBoard();
    await toGate(run);
    run.player.holdDrain(true);
    await startPruitt(run);
    await call(run);
    expect(run.isComplete(BOSS)).toBe(true);
    expect(run.boss(BOSS)!.body('pruitt')!.down).toBe(false);
    const ended = record(run.bus, 'chapter:completed');
    run.setPlayerPosition({ x: 36 * 16, y: 10 * 16 });
    await settle(run, 10);
    expect(ended).toHaveLength(1);
  });
});
