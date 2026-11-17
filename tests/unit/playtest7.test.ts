/**
 * Playtest 7: the sheep gates still swing once the flock is penned (Andrew opens his own way back), Myko lights up on
 * every new area, the whiskey lesson waits to be read, an empty from every beer up to six, a harder bottle, the
 * chapter 1 keg lever, and bottles on the chapter 3 bay floor while the gantry fight lasts.
 */

import { describe, expect, it } from 'vitest';
import { chapter1 } from '../../src/chapters/01/index';
import { chapter2 } from '../../src/chapters/02/index';
import { T } from '../../src/chapters/02/maps';
import { BAY_ARRIVAL, BAY_BOTTLE_SPOTS } from '../../src/chapters/03/maps';
import { PROP } from '../../src/art/props';
import { sequence } from '../../src/content/dialogue';
import { TUNING } from '../../src/content/tuning';
import { createKit, pickUpDrink, useSelected } from '../../src/systems/kit';
import type { ChapterRun } from '../../src/systems/run';
import { NO_INPUT, frame, settleDialogue, startChapterGame } from './helpers';
import { enter, examine, newGame, settle, toBayPuzzleSolved } from './chapter3-steps';

const O = TUNING.overhaul!;

describe('chapter 2: the sheep gates after the flock is penned', () => {
  async function solvedFarm() {
    const g = startChapterGame(chapter2, 'chapter');
    g.run.tick(16, NO_INPUT);
    await settleDialogue(g.run);
    g.run.goToScreen('c2.farm', T(2, 11));
    g.run.tick(16, NO_INPUT);
    await settleDialogue(g.run);
    const puzzle = g.run.sheepPuzzlesHere()[0]!.puzzle;
    puzzle.completeNow('player');
    await settleDialogue(g.run);
    return { ...g, puzzle };
  }

  it('every gate still swings, so Andrew can walk back out of the far pens', async () => {
    const { puzzle } = await solvedFarm();
    expect(puzzle.isComplete()).toBe(true);
    for (const g of puzzle.layout.gates) {
      const before = puzzle.gatePosition(g.id);
      expect(puzzle.toggleGate(g.id, { x: 0, y: 0 })).toBe(true);
      expect(puzzle.gatePosition(g.id)).not.toBe(before);
    }
  });

  it('from pen 3 (where the last push leaves him) a way back to pen 1 opens with the gates beside him', async () => {
    const { puzzle } = await solvedFarm();
    const open = (tiles: readonly { col: number; row: number }[]) => tiles.every((t) => !puzzle.blocks(t.col, t.row));
    const [gateA, gateB] = puzzle.layout.gates;
    // Gate B: D3 shut, D2 open (pen 3 to pen 2). Gate A: D2 shut again, D1 open (pen 2 to pen 1).
    puzzle.toggleGate(gateB!.id, { x: 0, y: 0 });
    expect(open(gateB!.positions[0]!)).toBe(true);
    puzzle.toggleGate(gateA!.id, { x: 0, y: 0 });
    expect(open(gateA!.positions[0]!)).toBe(true);
  });

  it('a gate swung after the puzzle is done does not restart it', async () => {
    const { puzzle } = await solvedFarm();
    puzzle.toggleGate(puzzle.layout.gates[0]!.id, { x: 0, y: 0 });
    expect(puzzle.isComplete()).toBe(true);
  });
});

describe('Myko smokes more', () => {
  it('lights up the first time Andrew walks into an area, and keeps it lit while he walks', async () => {
    const { run } = startChapterGame(chapter2, 'chapter');
    run.tick(16, NO_INPUT);
    await settleDialogue(run);
    run.goToScreen('c2.farm', T(2, 11));
    expect(run.myko.smoking).toBe(true);
    // Walking about for most of the arrival smoke: still lit.
    for (let i = 0; i < TUNING.myko.arrivalSmokeMs / 100 - 5; i++) {
      run.myko.moving = true;
      run.myko.tickScripted(100);
    }
    expect(run.myko.smoking).toBe(true);
  });

  it('a second visit to the same area does not light another', async () => {
    const { run } = startChapterGame(chapter2, 'chapter');
    run.tick(16, NO_INPUT);
    await settleDialogue(run);
    run.goToScreen('c2.farm', T(2, 11));
    run.myko.smoking = false;
    run.goToScreen('c2.bog', T(58, 11));
    run.myko.smoking = false;
    run.goToScreen('c2.farm', T(2, 11));
    expect(run.myko.smoking).toBe(false);
  });

  it('smokes after well under a minute standing still (playtest 8 eased it back from 20 s)', () => {
    expect(TUNING.myko.smokeIntervalMs + TUNING.myko.smokeJitterMs).toBeLessThanOrEqual(50000);
    expect(TUNING.myko.smokeIntervalMs - TUNING.myko.smokeJitterMs).toBeGreaterThanOrEqual(30000);
  });
});

describe('the whiskey lesson waits to be read', () => {
  it('is a scene (E moves it on) rather than a timed box', () => {
    expect(sequence('c1.street.whiskey').delivery).toBe('scene');
  });
});

describe('bottles', () => {
  it('every beer drunk leaves an empty, up to six', () => {
    let kit = { ...createKit(), bottles: 0 };
    for (let i = 0; i < 6; i++) kit = pickUpDrink(kit, 'stout').kit;
    for (let i = 0; i < 6; i++) {
      const r = useSelected({ ...kit, selectedItem: 'stout' });
      expect(r.bottlesAdded).toBe(1);
      kit = r.kit;
    }
    expect(kit.bottles).toBe(6);
    expect(O.carry.bottleLimit).toBe(6);
  });

  it('a thrown bottle does 15', () => {
    expect(O.throw?.damage).toBe(15);
  });
});

describe('chapter 1: the keg lever', () => {
  it('puts the kegs back where they started, swings the lever, and Myko says so', async () => {
    const { run } = startChapterGame(chapter1, 'chapter');
    run.tick(16, NO_INPUT);
    await settleDialogue(run);
    run.goToScreen('c1.yard', { x: 8 * 16, y: 8 * 16 });
    run.tick(16, NO_INPUT);
    await settleDialogue(run);
    const puzzle = run.pushPuzzlesHere()[0]!.puzzle;
    const start = puzzle.piecePositions().map((p) => ({ ...p }));
    // Push keg1 right (Andrew to its left).
    const keg = start.find((p) => p.id === 'keg1')!;
    expect(puzzle.push({ col: keg.col, row: keg.row }, 'right')).toBe(true);
    expect(puzzle.piecePositions()).not.toEqual(start);
    const shown: string[] = [];
    run.bus.on('dialogue:show', ({ sequenceId }) => shown.push(sequenceId));
    run.setPlayerPosition({ x: 10 * 16 + 8, y: 5 * 16 + 8 });
    pressE(run);
    await settleDialogue(run);
    expect(puzzle.piecePositions()).toEqual(start);
    expect(shown).toContain('c1.kegs.reset');
    expect(run.dressing.prop('yard.lever')?.frame).toBe(PROP.lever.down);
  });
});

describe('chapter 3: bottles on the bay floor for the gantry fight', () => {
  const bottles = (run: ChapterRun) => run.pickups().filter((p) => p.def.id.startsWith('drop.c3.bay.bottle.'));

  it('are laid when the lights come on, and one taken comes back until the fight is won', async () => {
    const { run } = await newGame();
    await toBayPuzzleSolved(run);
    expect(bottles(run)).toHaveLength(0);
    examine(run, 'c3.manifest');
    await settle(run, 6);
    expect(run.fight('c3.fight.bay')?.active).toBe(true);
    expect(bottles(run)).toHaveLength(BAY_BOTTLE_SPOTS.length);
    run.player.setKit({ ...run.player.kit, bottles: 0 });
    const first = BAY_BOTTLE_SPOTS[0];
    run.setPlayerPosition(first);
    run.tick(16, NO_INPUT);
    expect(run.player.kit.bottles).toBe(1);
    expect(bottles(run)).toHaveLength(BAY_BOTTLE_SPOTS.length - 1);
    run.setPlayerPosition(BAY_ARRIVAL);
    for (let t = 0; t < (O.fightBottleRespawnMs ?? 4000) + 200; t += 100) run.tick(100, NO_INPUT);
    expect(bottles(run)).toHaveLength(BAY_BOTTLE_SPOTS.length);
  });

  it('come back after leaving the bay and coming back mid-fight, and stop coming back once it is won', async () => {
    const { run } = await newGame();
    await toBayPuzzleSolved(run);
    examine(run, 'c3.manifest');
    await settle(run, 6);
    await enter(run, 'c3.office', { x: 46 * 16, y: 21 * 16 });
    await enter(run, 'c3.bay', BAY_ARRIVAL);
    expect(bottles(run)).toHaveLength(BAY_BOTTLE_SPOTS.length);
    run.player.setKit({ ...run.player.kit, bottles: 0 });
    run.completeSection('c3.fight.bay', 'player');
    await settle(run);
    run.setPlayerPosition(BAY_BOTTLE_SPOTS[1]);
    run.tick(16, NO_INPUT);
    run.setPlayerPosition(BAY_ARRIVAL);
    for (let t = 0; t < (O.fightBottleRespawnMs ?? 4000) + 200; t += 100) run.tick(100, NO_INPUT);
    expect(bottles(run)).toHaveLength(BAY_BOTTLE_SPOTS.length - 1);
  });
});

/** E this frame. */
function pressE(run: ChapterRun): void {
  run.tick(16, frame({ pressed: ['interact'] }));
}
