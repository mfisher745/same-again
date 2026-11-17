/**
 * Chapter 5 beats in order, through the real triggers: the bar, the lobby (Act Natural), the floor stealth, the files, the
 * lightbox, the copier and Lock-in, the cubicle fight, the board, Pruitt and the closing.
 */

import { describe, expect, it } from 'vitest';
import { chapter4 } from '../../src/chapters/04/index';
import { chapter5 } from '../../src/chapters/05/index';
import { clearChapterRegistry, registerChapter } from '../../src/core/chapter';
import { MemoryStorage, SaveStore } from '../../src/core/save';
import { GameSession } from '../../src/systems/session';
import { record } from './helpers';
import { BOARD, BOSS, FIGHT, PUZZLE, examine, newGame, settle, solveBoard, startPruitt, toStacks, toTheBoard } from './chapter5-steps';

describe('chapter 5: a full run from the bar to the closing', () => {
  it('plays every beat and ends the chapter', async () => {
    const { run } = await newGame();
    const ended = record(run.bus, 'chapter:completed');
    const shown = record(run.bus, 'dialogue:show');
    expect(run.screenId).toBe('c5.bar');
    expect(run.objective()).toBe('c5.lobby');
    await toTheBoard(run);
    for (const s of ['c5.explore.bar', 'c5.stealth.lobby', 'c5.explore.lobby', 'c5.stealth.floor', 'c5.explore.files', PUZZLE, FIGHT]) expect(run.isComplete(s as never), s).toBe(true);
    expect(run.player.kit.moves).toEqual(expect.arrayContaining(['actNatural', 'lockIn']));
    expect(await solveBoard(run)).toBe(true);
    expect(run.isComplete(BOARD)).toBe(true);
    await toStacks(run);
    await startPruitt(run);
    expect(run.boss(BOSS)?.active).toBe(true);
    run.boss(BOSS)!.complete('player');
    await settle(run, 8);
    expect(run.isComplete(BOSS)).toBe(true);
    examine(run, 'c5.umbrella');
    await settle(run, 12);
    expect(run.player.kit.weapons).toContain('umbrella');
    expect(ended).toHaveLength(1);
    const ids = shown.map((s) => s.sequenceId);
    for (const id of ['c5.open', 'c5.actNatural.lesson', 'c5.floor.clean', 'c5.redacted.solved', 'c5.copier', 'c5.lockIn.lesson', 'c5.fight.intro', 'c5.fight.end', 'c5.board.right', 'c5.pruitt.intro', 'c5.pruitt.end', 'c5.weapon.umbrella', 'c5.closing']) expect(ids, id).toContain(id);
  });
});

describe('chapter 5: the way in and out', () => {
  it('finishing chapter 4 starts chapter 5 at its bar', async () => {
    clearChapterRegistry();
    registerChapter(chapter4);
    registerChapter(chapter5);
    const session = new GameSession({ store: new SaveStore(new MemoryStorage()) });
    session.setDriver({ showTitle: () => undefined, startGame: () => undefined, pauseGame: () => undefined, resumeGame: () => undefined });
    session.startChapter(4);
    const four = session.createRun()!;
    expect(four.chapter).toBe(4);
    four.completeChapter();
    const five = session.createRun()!;
    expect(five.chapter).toBe(5);
    expect(five.screenId).toBe('c5.bar');
    expect(five.player.pos).toEqual(chapter5.def.bar!.arrival);
  });
});
