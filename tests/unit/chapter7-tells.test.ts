/**
 * Chapter 7, who is an alien: the six figures, the tells, the accuse screen opening once all are seen, the right three and
 * the wrong ones (free), the stand-in for Gary's own tell, the accuse screen's fake source, and Myko's call.
 */

import { describe, expect, it } from 'vitest';
import { FIGURES } from '../../src/chapters/07/maps';
import { FakeSource } from '../../src/ui/dev/fakeSource';
import { record } from './helpers';
import { ALIENS, TELLS, accuse, doBar, examine, examineFigures, newGame, settle, toShop, wait } from './chapter7-steps';

describe('chapter 7: who is an alien', () => {
  it('walking into the shop plays the intro, makes the figures the objective and starts the puzzle', async () => {
    const { run } = await newGame();
    const shown = record(run.bus, 'dialogue:show');
    await toShop(run);
    expect(shown.map((s) => s.sequenceId)).toContain('c7.tells.intro');
    expect(run.objective()).toBe('c7.tells');
    expect(run.isComplete('c7.explore.strip')).toBe(true);
    expect(run.tells(TELLS)?.examined()).toEqual([]);
  });

  it('the figures: three tourists and three aliens, Gary behind the till, fixed', () => {
    expect(FIGURES).toHaveLength(6);
    expect(FIGURES.filter((f) => f.alien).map((f) => f.key)).toEqual([...ALIENS]);
    expect(FIGURES.find((f) => f.key === 'gary')?.row).toBe(3);
  });

  it('each figure shows its own tells line, and the accuse screen opens only when all six are examined', async () => {
    const { run } = await newGame();
    await toShop(run);
    const shown = record(run.bus, 'dialogue:show');
    for (const f of FIGURES.filter((x) => x.key !== 'gary')) {
      examine(run, `c7.tells.${f.key}`);
      await settle(run, 6);
      expect(shown.map((s) => s.sequenceId), f.key).toContain(`c7.tells.${f.key}`);
      await wait(run, 2000);
      expect(run.activeTells(), `not yet after ${f.key}`).toBeNull();
    }
    expect(run.tells(TELLS)?.examined()).toHaveLength(5);
    expect(run.openTells(TELLS)).toBe(false);
    examine(run, 'c7.gary');
    await wait(run, 4000);
    expect(run.tells(TELLS)?.allExamined()).toBe(true);
    expect(run.activeTells()?.view().figures.every((f) => f.examined)).toBe(true);
  });

  it('a wrong accusation costs nothing and leaves the screen open; the right three solve it and Gary answers', async () => {
    const { run } = await newGame();
    await doBar(run);
    await toShop(run);
    await examineFigures(run);
    expect(run.activeTells()).not.toBeNull();
    const buzz = run.player.meter.value;
    const shown = record(run.bus, 'dialogue:show');
    const tried = record(run.bus, 'tells:accused');
    const wrong = run.submitTells(TELLS, ['a', 'b', 'c']);
    expect(wrong).toEqual({ correct: false, textId: 'c7.tells.wrong', refused: false });
    expect(run.player.meter.value).toBe(buzz);
    expect(run.activeTells()).not.toBeNull();
    expect(run.isComplete(TELLS)).toBe(false);
    expect(run.submitTells(TELLS, ['b', 'd']).refused).toBe(true);
    expect(run.submitTells(TELLS, ['b', 'b', 'd']).refused).toBe(true);
    // Two of the three is still wrong.
    expect(run.submitTells(TELLS, ['b', 'd', 'e']).correct).toBe(false);
    expect(run.isComplete(TELLS)).toBe(false);
    await accuse(run);
    expect(tried.map((t) => t.correct)).toEqual([false, false, true]);
    expect(run.isComplete(TELLS)).toBe(true);
    expect(run.activeTells()).toBeNull();
    expect(shown.map((s) => s.sequenceId)).toContain('c7.tells.right');
    expect(run.objective()).toBe('c7.gary');
  });

  it('stepping back from the screen and looking at a figure again opens it again', async () => {
    const { run } = await newGame();
    await toShop(run);
    await examineFigures(run);
    run.closeTells();
    expect(run.activeTells()).toBeNull();
    examine(run, 'c7.tells.b');
    await wait(run, 4000);
    expect(run.activeTells()).not.toBeNull();
  });

  it('talking to Gary before the accusation examines him, and does not give him away', async () => {
    const { run } = await newGame();
    await toShop(run);
    const shown = record(run.bus, 'dialogue:show');
    examine(run, 'c7.gary');
    await settle(run, 6);
    expect(run.tells(TELLS)?.examined()).toEqual(['gary']);
    expect(shown.map((s) => s.sequenceId)).not.toContain('c7.gary.intro');
    expect(run.flag('garyStep')).toBeUndefined();
  });

  it('a Myko call solves it (and he does not play the accusation scene)', async () => {
    const { run } = await newGame();
    await toShop(run);
    const shown = record(run.bus, 'dialogue:show');
    run.startSection(TELLS);
    run.tells(TELLS)!.completeNow('myko');
    await settle(run, 12);
    await wait(run, 4000);
    expect(run.tells(TELLS)?.allExamined()).toBe(true);
    expect(run.isComplete(TELLS)).toBe(true);
    expect(shown.map((s) => s.sequenceId)).not.toContain('c7.tells.right');
  });
});

describe('the accuse screen model (the fake source)', () => {
  const view = (examined: readonly string[]) => ({
    puzzleId: 'c7.puzzle.tells' as const,
    promptTextId: 'c7.tells.prompt',
    figures: FIGURES.map((f) => ({ id: f.key, examined: examined.includes(f.key) })),
    pick: 3 as const,
  });

  it('shows nothing until a view is set, refuses figures not examined and ones not three, tells right from wrong', () => {
    const s = new FakeSource();
    expect(s.activeTells()).toBeNull();
    s.tells = view(['a', 'b', 'c', 'd', 'e']);
    expect(s.submitTells('c7.puzzle.tells', ['a', 'b', 'gary']).refused).toBe(true);
    s.tells = view(FIGURES.map((f) => f.key));
    expect(s.submitTells('c7.puzzle.tells', ['a', 'b']).refused).toBe(true);
    expect(s.submitTells('c7.puzzle.tells', ['a', 'b', 'c'])).toEqual({ correct: false, textId: 'c7.tells.wrong', refused: false });
    expect(s.activeTells()).not.toBeNull();
    expect(s.submitTells('c7.puzzle.tells', ['gary', 'd', 'b'])).toEqual({ correct: true, textId: 'c7.tells.right', refused: false });
    expect(s.activeTells()).toBeNull();
  });

  it('one at a time: the third tick accuses, a second tick unticks, and an unexamined figure is ignored', () => {
    const s = new FakeSource();
    s.tells = view(['a', 'b', 'c', 'd', 'e']);
    expect(s.selectTells('c7.puzzle.tells', 'gary')).toBeNull();
    expect(s.tellsSelection()).toEqual([]);
    expect(s.selectTells('c7.puzzle.tells', 'a')).toBeNull();
    expect(s.selectTells('c7.puzzle.tells', 'b')).toBeNull();
    expect(s.selectTells('c7.puzzle.tells', 'a')).toBeNull();
    expect(s.tellsSelection()).toEqual(['b']);
    s.selectTells('c7.puzzle.tells', 'a');
    expect(s.selectTells('c7.puzzle.tells', 'c')?.correct).toBe(false);
    expect(s.tellsSelection()).toEqual([]);
  });

  it('steps back, and carries the heat and white-out values the chapter 8 HUD reads', () => {
    const s = new FakeSource();
    s.tells = view(FIGURES.map((f) => f.key));
    s.closeTells();
    expect(s.activeTells()).toBeNull();
    expect(s.heat()).toEqual({ active: false, sunnyScreen: false, inSun: false });
    s.heatState = { active: true, sunnyScreen: true, inSun: true };
    s.whiteout = 0.5;
    expect(s.heat().inSun).toBe(true);
    expect(s.whiteoutAlpha()).toBe(0.5);
  });
});
