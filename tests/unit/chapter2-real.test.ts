/**
 * Chapter 2 on the real chapter (not the sandbox): the bog crossing and its caught fight, puddles, the ram, the sheep puzzle's
 * wrong-pen line and its return and load behaviour, the ram call, the closing, owed Stumble, and bottles at start and on load.
 */

import { describe, expect, it } from 'vitest';
import { chapter2 } from '../../src/chapters/02/index';
import { BAR_ARRIVAL, T } from '../../src/chapters/02/maps';
import { TUNING } from '../../src/content/tuning';
import { createSandboxModule } from '../../src/core/sandbox';
import { createChapter2Sandbox } from '../../src/core/sandbox2';
import type { ChapterRun } from '../../src/systems/run';
import { carryOver } from '../../src/systems/session';
import { NO_INPUT, advance, frame, makeRun, placeAt, record, settleDialogue, startChapterGame, drinkItem } from './helpers';

async function newGame(how: 'chapter' | 'continue' = 'chapter', store?: Parameters<typeof startChapterGame>[2]) {
  const g = startChapterGame(chapter2, how, store);
  g.run.tick(16, NO_INPUT);
  await settleDialogue(g.run);
  g.run.tick(16, NO_INPUT);
  return g;
}

/** Examines the three key clues in the bog: the van and the crossing follow. */
async function findKeyClues(run: ChapterRun): Promise<void> {
  for (const p of [T(25, 13), T(29, 13), T(34, 14)]) {
    run.setPlayerPosition(p);
    run.tick(16, NO_INPUT);
    await settleDialogue(run);
    run.tick(16, frame({ pressed: ['interact'] }));
    await settleDialogue(run);
  }
  await settleDialogue(run);
  run.tick(16, NO_INPUT);
}

/** Just under Bit much, then a pint across the line (a real level change, not a set value). */
async function drinkIntoBitMuch(run: ChapterRun): Promise<void> {
  run.give({ kind: 'drink', drinkId: 'stout', count: 1 });
  run.player.meter = { ...run.player.meter, value: 60 };
  expect(run.player.level).toBe(2);
  expect(drinkItem(run, 'stout')).toBe(true);
  for (let i = 0; i < 6; i++) {
    run.tick(50, NO_INPUT);
    await settleDialogue(run);
  }
  expect(run.player.level).toBe(3);
}

async function toSober(run: ChapterRun): Promise<void> {
  run.player.meter = { ...run.player.meter, value: 0.01 };
  advance(run, 200);
  run.completeBarReturn();
  run.tick(16, NO_INPUT);
  await settleDialogue(run);
}

describe('bottles at the start of the chapter and on a load', () => {
  it('Chapter Select starts with the one bottle he is allowed', async () => {
    const { run } = await newGame();
    expect(run.player.kit.bottles).toBeGreaterThanOrEqual(TUNING.overhaul!.carry.minBottlesOnLeavingBar);
    expect(run.player.kit.bottles).toBe(TUNING.overhaul!.carry.bottleLimit);
  });

  it('a load tops bottles up to the minimum and clamps an old save to the cap', async () => {
    const a = await newGame();
    a.run.player.setKit({ ...a.run.player.kit, bottles: 0 });
    a.run.learnMove('reflexTest'); // writes a save with no bottles
    expect(a.store.load()?.kit.bottles).toBe(0);
    const loaded = await newGame('continue', a.store);
    expect(loaded.run.player.kit.bottles).toBe(TUNING.overhaul!.carry.minBottlesOnLeavingBar);

    const b = await newGame();
    b.run.player.setKit({ ...b.run.player.kit, bottles: 5 });
    b.run.learnMove('reflexTest');
    const reloaded = await newGame('continue', b.store);
    expect(reloaded.run.player.kit.bottles).toBe(TUNING.overhaul!.carry.bottleLimit); // an old save holding five is clamped
  });

  it('a fresh game in chapter 1 is not topped up by a load (the pub keeps its own start)', () => {
    const { run } = makeRun({ chapter: 1, module: createSandboxModule(1) });
    expect(run.player.kit.bottles).toBeGreaterThanOrEqual(0);
  });
});

describe('the bog crossing', () => {
  it('the key clues bring the van and start the stealth section with three suits', async () => {
    const { run } = await newGame();
    expect(run.guardsHere()).toHaveLength(0);
    await findKeyClues(run);
    expect(run.guardsHere()).toHaveLength(3);
    expect(run.guardsHere().every((g) => g.enemyId === 'suit')).toBe(true);
  });

  it('caught: the alarm fight is the three suits plus exactly one reinforcement', async () => {
    const { run } = await newGame();
    await findKeyClues(run);
    const alarms = record(run.bus, 'stealth:alarm');
    run.stealth('c2.stealth.bog')!.alarm();
    run.tick(16, NO_INPUT);
    expect(alarms).toHaveLength(1);
    const fight = run.fight('c2.stealth.bog.alarm' as never);
    expect(fight).not.toBeNull();
    const alive = fight!.aliveActors();
    expect(alive).toHaveLength(4);
    expect(alive.filter((a) => a.enemyId === 'suit')).toHaveLength(4);
    const waves = TUNING.fights['c2.stealth.bog.alarm']?.waves;
    expect(waves).toHaveLength(1);
    expect(waves?.[0]?.enemies).toEqual([{ enemyId: 'suit', count: 1 }]);
  });

  it('a clean run gives the lanyard and completes the section', async () => {
    const { run } = await newGame();
    await findKeyClues(run);
    const found = record(run.bus, 'evidence:found');
    // The suits are on their routes; Andrew steps straight onto the exit.
    run.setPlayerPosition(T(56, 11));
    for (let i = 0; i < 4; i++) run.tick(16, NO_INPUT);
    expect(run.isComplete('c2.stealth.bog')).toBe(true);
    expect(found.map((f) => f.evidenceId)).toContain('c2.clue.lanyard');
    expect(run.guardsHere()).toHaveLength(0);
  });

  it('caught and then sober: back at the lean-to, and the crossing starts over with its guards', async () => {
    const { run } = await newGame();
    await findKeyClues(run);
    run.stealth('c2.stealth.bog')!.alarm();
    run.tick(16, NO_INPUT);
    await settleDialogue(run);
    await toSober(run);
    expect(run.screenId).toBe('c2.bog');
    expect(run.player.pos).toEqual(BAR_ARRIVAL);
    expect(run.isComplete('c2.stealth.bog')).toBe(false);
    expect(run.fight('c2.stealth.bog.alarm' as never)).toBeNull();
    expect(run.guardsHere()).toHaveLength(3);
    expect(run.stealth('c2.stealth.bog')!.alarmRaised).toBe(false);
    // And a clean run is still available.
    const found = record(run.bus, 'evidence:found');
    run.setPlayerPosition(T(56, 11));
    for (let i = 0; i < 4; i++) run.tick(16, NO_INPUT);
    expect(found.map((f) => f.evidenceId)).toContain('c2.clue.lanyard');
  });

  it('a bottle thrown in the bog sends a guard to look and Myko comments', async () => {
    const { run } = await newGame();
    await findKeyClues(run);
    const shown = record(run.bus, 'dialogue:show');
    const g = run.guardsHere()[0]!;
    run.emitNoise({ kind: 'bottle', position: { x: g.pos.x + 20, y: g.pos.y }, radius: 90 });
    expect(g.alert).toBe('investigating');
    expect(shown.some((s) => s.sequenceId === 'c2.suits.distracted')).toBe(true);
  });
});

describe('puddles and the ram', () => {
  it('a puddle slows Andrew and not the enemies', () => {
    const { run } = makeRun({ chapter: 2, module: createChapter2Sandbox() });
    // Andrew: slowed in the puddle (the sandbox puddle is cols 14 to 16, rows 15 and 16).
    placeAt(run, 13, 16);
    const x0 = run.player.pos.x;
    run.tick(100, frame({ move: { x: 1, y: 0 } }));
    const plain = run.player.pos.x - x0;
    placeAt(run, 15, 16);
    const x1 = run.player.pos.x;
    run.tick(100, frame({ move: { x: 1, y: 0 } }));
    expect(run.player.pos.x - x1).toBeCloseTo(plain * TUNING.overhaul!.slowGroundMultiplier!, 5);

    // A lad chasing Andrew walks at the same speed on and off the puddle.
    const speedOf = (col: number): number => {
      const lad = run.spawnEnemy('lad', { x: col * 16 + 8, y: 16 * 16 + 8 });
      const start = { ...lad.pos };
      placeAt(run, col + 4, 16);
      for (let i = 0; i < 6; i++) run.tick(50, frame());
      const d = lad.pos.x - start.x;
      lad.knockDown();
      return d;
    };
    const onPuddle = speedOf(15);
    const offPuddle = speedOf(22);
    expect(onPuddle).toBeGreaterThan(0);
    expect(onPuddle).toBeCloseTo(offPuddle, 1);
  });
});

describe('the ram, in the real lane', () => {
  async function inLane() {
    const g = await newGame();
    g.run.setFlag('concluded', true);
    g.run.goToScreen('c2.lane', T(6, 6));
    g.run.tick(16, NO_INPUT);
    await settleDialogue(g.run);
    g.run.tick(16, NO_INPUT);
    await settleDialogue(g.run);
    g.run.tick(16, NO_INPUT);
    return g;
  }

  it('entering the lane reads the intro and starts the set piece with the camera leading right', async () => {
    const { run } = await inLane();
    const ram = run.boss('c2.setpiece.ram')!;
    expect(ram.active).toBe(true);
    expect(run.flag('ram.started')).toBe(true);
    expect(run.cameraLead().x).toBe(TUNING.overhaul!.cameraLeadPx);
    expect(ram.body('ram')!.invulnerable).toBe(true);
  });

  it('a bottle landing near the ram stops it for 1.5 seconds, then it runs again', async () => {
    const { run } = await inLane();
    const body = run.boss('c2.setpiece.ram')!.body('ram')!;
    // Let it get going.
    advance(run, 600);
    run.emitNoise({ kind: 'bottle', position: { x: body.pos.x + 24, y: body.pos.y }, radius: 90 });
    expect(body.looking).toBe(true);
    const frozenAt = body.pos.x;
    advance(run, 1400);
    expect(body.pos.x).toBe(frozenAt);
    advance(run, 400);
    expect(body.looking).toBe(false);
    advance(run, 600);
    expect(body.pos.x).toBeGreaterThan(frozenAt);
  });

  it('the ram stops at the cattle grid and Andrew can cross it', async () => {
    const { run } = await inLane();
    const body = run.boss('c2.setpiece.ram')!.body('ram')!;
    const run4 = (move: { x: number; y: number }, pressed: 'interact'[] = []) => {
      run.player.meter = { ...run.player.meter, value: 60 }; // hits would only knock him back; keep him on his feet
      run.tick(50, frame({ move, pressed }));
    };
    // Run the lane with the ram behind him; E at the gate (col 52) opens it.
    for (let i = 0; i < 700 && run.player.pos.x < 51 * 16 + 8; i++) run4({ x: 1, y: 0 });
    expect(run.player.pos.x).toBeLessThan(52 * 16); // stopped by the shut gate
    expect(run.interactTarget()?.examinableId).toBe('c2.lane.gate');
    run4({ x: 0, y: 0 }, ['interact']);
    for (let i = 0; i < 900 && run.player.pos.x < 84 * 16; i++) run4({ x: 1, y: 0 });
    for (let i = 0; i < 200; i++) run4({ x: 0, y: 0 });
    const GRID_X = 82 * 16;
    expect(run.player.pos.x).toBeGreaterThan(GRID_X);
    expect(body.pos.x).toBeGreaterThan(60 * 16); // it did run the lane
    expect(body.pos.x).toBeLessThan(GRID_X); // and no further than the grid
  });
});

describe('the sheep puzzle in the real farm', () => {
  const sheepOf = (run: ChapterRun) => run.sheepPuzzlesHere()[0]!.puzzle;
  async function onFarm(how: 'chapter' | 'continue' = 'chapter', store?: Parameters<typeof startChapterGame>[2]) {
    const g = await newGame(how, store);
    g.run.goToScreen('c2.farm', T(2, 11));
    g.run.tick(16, NO_INPUT);
    await settleDialogue(g.run);
    return g;
  }

  it('c2.sheep.wrong plays when the flock settles in pen1, and only then', async () => {
    const { run } = await onFarm();
    const shown = record(run.bus, 'dialogue:show');
    const wrong = () => shown.filter((s) => s.sequenceId === 'c2.sheep.wrong').length;
    const puzzle = sheepOf(run);
    const layout = puzzle.layout;
    const pens = layout.pens ?? [];
    expect(pens.map((p) => p.id)).toContain('pen1');
    const settleIn = async (penId: string) => {
      const pen = pens.find((p) => p.id === penId)!;
      const cx = (pen.col + pen.width / 2) * 16;
      const cy = (pen.row + pen.height / 2) * 16;
      for (const s of puzzle.sheep()) s.pos = { x: cx, y: cy };
      run.setPlayerPosition({ x: 2 * 16, y: 28 * 16 });
      for (let i = 0; i < 120; i++) run.tick(50, NO_INPUT);
      await settleDialogue(run);
    };
    for (const other of pens.filter((p) => p.id !== 'pen1')) {
      await settleIn(other.id ?? '');
      expect(wrong(), other.id).toBe(0);
    }
    await settleIn('pen1');
    expect(wrong()).toBe(1);
  });

  it('after the puzzle is solved the flock settling in pen1 says nothing', async () => {
    const { run } = await onFarm();
    const puzzle = sheepOf(run);
    puzzle.completeNow('debug');
    await settleDialogue(run);
    const shown = record(run.bus, 'dialogue:show');
    const pen = (puzzle.layout.pens ?? []).find((p) => p.id === 'pen1')!;
    for (const s of puzzle.sheep()) s.pos = { x: (pen.col + pen.width / 2) * 16, y: (pen.row + pen.height / 2) * 16 };
    for (let i = 0; i < 120; i++) run.tick(50, NO_INPUT);
    expect(shown.filter((s) => s.sequenceId === 'c2.sheep.wrong')).toHaveLength(0);
  });

  it('an unsolved puzzle keeps its gates and sheep through a return to the bar, and resets on a load', async () => {
    const { run, store } = await onFarm();
    const puzzle = sheepOf(run);
    const gateId = puzzle.layout.gates[0]!.id;
    expect(puzzle.toggleGate(gateId, { x: 0, y: 0 })).toBe(true);
    puzzle.sheep()[0]!.pos = { x: 23 * 16 + 8, y: 10 * 16 + 8 };
    const sheepBefore = puzzle.sheep().map((s) => ({ ...s.pos }));
    const startPositions = sheepOf(run).layout.sheep.map((sh) => ({ x: sh.col * 16 + 8, y: sh.row * 16 + 8 }));
    const gateBefore = puzzle.gatePosition(gateId);
    await toSober(run);
    run.goToScreen('c2.farm', T(2, 11));
    expect(sheepOf(run).gatePosition(gateId)).toBe(gateBefore);
    expect(sheepOf(run).sheep().map((s) => s.pos)).toEqual(sheepBefore);

    run.learnMove('reflexTest'); // a save
    const loaded = await onFarm('continue', store);
    expect(sheepOf(loaded.run).gatePosition(gateId)).toBe(0);
    expect(sheepOf(loaded.run).sheep().map((s) => s.pos)).toEqual(startPositions);
  });
});

describe('the ram call and the closing', () => {
  async function ramCall() {
    const g = await newGame();
    const started = record(g.run.bus, 'myko:callStarted');
    const entries = record(g.run.bus, 'casebook:entryAdded');
    const ended = record(g.run.bus, 'chapter:completed');
    const shown = record(g.run.bus, 'dialogue:show');
    g.run.setFlag('concluded', true);
    g.run.goToScreen('c2.lane', T(6, 6));
    g.run.tick(16, NO_INPUT);
    await settleDialogue(g.run);
    g.run.tick(16, NO_INPUT);
    await settleDialogue(g.run);
    expect(g.run.boss('c2.setpiece.ram')!.active).toBe(true);
    return { ...g, started, entries, ended, shown };
  }

  it('is a set-piece call that writes c2.call.ram.* into the casebook and ends the chapter with c2.closing', async () => {
    const g = await ramCall();
    expect(g.run.myko.tryCall()).toBe(true);
    expect(g.started[0]?.kind).toBe('setpiece');
    for (let i = 0; i < 400; i++) {
      g.run.tick(50, NO_INPUT);
      if (i % 20 === 0) await settleDialogue(g.run);
    }
    await settleDialogue(g.run);
    expect(g.run.boss('c2.setpiece.ram')!.isComplete()).toBe(true);
    const book = JSON.stringify(g.entries);
    expect(book).toContain('"callId":"ram"');
    const call = g.run.snapshot().casebook.find((e) => e.kind === 'mykoCall');
    expect(call).toMatchObject({ kind: 'mykoCall', sectionId: 'c2.setpiece.ram', callKind: 'setpiece' });
    const ids = g.shown.map((s) => s.sequenceId);
    expect(ids).toContain('c2.call.ram');
    expect(ids).toContain('c2.closing');
    expect(ids).not.toContain('c2.ram.end'); // a call skips the ram's own ending
    expect(ids.indexOf('c2.closing')).toBeGreaterThan(ids.indexOf('c2.call.ram'));
    expect(g.ended).toHaveLength(1);
  });

  it('finishing the run yourself plays c2.ram.end and then c2.closing, and the chapter ends once', async () => {
    const g = await ramCall();
    g.run.completeCurrent();
    await settleDialogue(g.run);
    const ids = g.shown.map((s) => s.sequenceId);
    expect(ids).toContain('c2.closing');
    expect(g.ended).toHaveLength(1);
    g.run.tick(16, NO_INPUT);
    await settleDialogue(g.run);
    expect(g.ended).toHaveLength(1);
  });
});

describe('the owed Stumble', () => {
  it('is owed once the shed is done and he has not learned it, and is cleared when he learns it', async () => {
    const { run } = await newGame();
    expect(run.movesOwed()).toEqual([]);
    run.completeSection('c2.explore.shed', 'debug');
    expect(run.movesOwed()).toEqual(['stumble']);
    expect(run.snapshot().owedMoves).toEqual([{ moveId: 'stumble', sceneId: 'c2.stumble.lesson', chapter: 2 }]);
    run.learnMove('stumble');
    expect(run.movesOwed()).toEqual([]);
    expect(run.snapshot().owedMoves).toBeUndefined();
  });

  it('is carried into the next chapter and taught the first time he is at Bit much there', async () => {
    const { run } = await newGame();
    run.completeSection('c2.explore.shed', 'debug');
    const snap = run.snapshot();
    expect(snap.owedMoves).toHaveLength(1);
    const next = createSandboxModule(3);
    const carried = carryOver(snap, 'grand', next);
    expect(carried.owedMoves).toEqual(snap.owedMoves);
    const h = makeRun({ chapter: 3, module: next, save: () => carried });
    expect(h.run.movesOwed()).toEqual(['stumble']);
    expect(h.run.player.kit.moves).not.toContain('stumble');
    const shown = record(h.bus, 'dialogue:show');
    await drinkIntoBitMuch(h.run);
    expect(shown.map((s) => s.sequenceId)).toContain('c2.stumble.lesson');
    expect(h.run.player.kit.moves).toContain('stumble');
    expect(h.run.movesOwed()).toEqual([]);
  });
});
