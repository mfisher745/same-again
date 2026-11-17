/**
 * Playtest 8: the chapter 4 container puzzle says there is one arrangement that opens the doors, tells the player when
 * a box lands in its place, and Myko's second hint is a clue rather than the lever counts.
 */

import { describe, expect, it } from 'vitest';
import { chapter4 } from '../../src/chapters/04/index';
import { RAILS, pullsNeeded } from '../../src/chapters/04/maps';
import { sequence } from '../../src/content/dialogue';
import { NO_INPUT, settleDialogue, startChapterGame } from './helpers';

const text = (id: string): string => JSON.stringify(sequence(id));

describe('chapter 4: the container puzzle explains itself', () => {
  it('the intro says one arrangement opens the doors and nothing else is needed', () => {
    expect(text('c4.containers.intro')).toMatch(/one way/);
    expect(text('c4.containers.intro')).toMatch(/Nothing else to pull/);
  });

  it("Myko's last hint is a clue, not the lever counts", () => {
    expect(text('c4.hint.containers.2')).not.toMatch(/twice|three times|once/);
  });

  it('a box landing in its place gets a line, except the last, which is the puzzle’s own', async () => {
    const { run } = startChapterGame(chapter4, 'chapter');
    run.tick(16, NO_INPUT);
    await settleDialogue(run);
    run.completeSection('c4.stealth.docks', 'player');
    run.goToScreen('c4.docks', { x: 39 * 16, y: 12 * 16 });
    run.tick(16, NO_INPUT);
    await settleDialogue(run);
    run.startSection('c4.puzzle.containers');
    await settleDialogue(run);
    const puzzle = run.slidePuzzlesHere()[0]!.puzzle;
    const shown: string[] = [];
    run.bus.on('dialogue:show', ({ sequenceId }) => shown.push(sequenceId));
    const settle = async (): Promise<void> => {
      for (let i = 0; i < 40; i++) run.tick(50, NO_INPUT);
      await settleDialogue(run);
    };
    const seated = (): number => shown.filter((s) => s === 'c4.containers.seated').length;
    let expected = 0;
    for (const [i, r] of RAILS.entries()) {
      for (let n = 0; n < pullsNeeded(r); n++) {
        expect(seated()).toBe(expected);
        expect(puzzle.pull(r.id)).toBe(true);
        await settle();
      }
      if (i < RAILS.length - 1) expected++;
      expect(seated()).toBe(expected);
    }
    expect(puzzle.isComplete()).toBe(true);
    expect(shown).toContain('c4.containers.done');
  });
});
