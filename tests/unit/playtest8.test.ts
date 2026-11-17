/**
 * Playtest 8: the chapter 4 container puzzle says there is one arrangement that opens the doors, tells the player when
 * a box lands in its place, and Myko's second hint is a clue rather than the lever counts. Second round: the deduction
 * board can be stepped back from and reopened, light beer is worth 10, and the call-in cards are rewritten.
 */

import { describe, expect, it } from 'vitest';
import type { EvidenceId } from '../../src/core/types';
import { chapter4 } from '../../src/chapters/04/index';
import { RAILS, pullsNeeded } from '../../src/chapters/04/maps';
import { sequence, text as uiText } from '../../src/content/dialogue';
import { TUNING } from '../../src/content/tuning';
import { NO_INPUT, frame, settleDialogue, startChapterGame } from './helpers';
import { examine, newGame, settle, toBayPuzzleSolved } from './chapter3-steps';
import { newGame as newGame4, startBrawl } from './chapter4-steps';

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

describe('the deduction board can be stepped back from', () => {
  it('closing it leaves it pending, the world runs again, and reopening brings it back unanswered', async () => {
    const { run } = await newGame();
    await toBayPuzzleSolved(run);
    examine(run, 'c3.manifest');
    await settle(run, 6);
    const fight = run.fight('c3.fight.bay')!;
    for (const a of fight.aliveActors()) run.defeat(a, 'player');
    await settle(run, 8);
    run.addEvidence('c2.clue.fragment' as EvidenceId);
    expect(run.activeDeduction()?.isOpen).toBe(true);
    expect(run.pendingDeduction()).toBe(false);
    run.closeDeduction();
    expect(run.activeDeduction()).toBeNull();
    expect(run.pendingDeduction()).toBe(true);
    expect(run.isComplete('c3.deduction.boston')).toBe(false);
    run.reopenDeduction();
    expect(run.activeDeduction()?.isOpen).toBe(true);
    expect(run.pendingDeduction()).toBe(false);
    expect(run.submitDeduction('c3.deduction.boston', ['c3.clue.map', 'c3.clue.manifest', 'c2.clue.fragment'])).toBe(true);
    expect(run.pendingDeduction()).toBe(false);
  });

  it('a board never opened is not pending', async () => {
    const { run } = await newGame();
    expect(run.pendingDeduction()).toBe(false);
    run.reopenDeduction();
    expect(run.activeDeduction()).toBeNull();
  });
});

describe('light beer and the call-in cards', () => {
  it('American light beer is worth 10', () => {
    expect(TUNING.overhaul!.drinks.lightBeer).toMatchObject({ points: 10 });
    expect(uiText('drink.lightBeer.pickup')).toMatch(/Buzz \+10/);
  });

  it('every call-in blackout has three cards, no exclamation marks', () => {
    for (const kind of ['fight', 'puzzle']) {
      for (const n of [1, 2, 3]) {
        const s = sequence(`myko.call.${kind}.blackout.${n}`);
        expect(s.lines).toHaveLength(3);
        for (const l of s.lines) expect(l.text).not.toMatch(/!/);
      }
    }
  });
});

describe('chapter 4: the shift roster', () => {
  it('reading it says so, every time, and files the clue', async () => {
    const { run } = startChapterGame(chapter4, 'chapter');
    run.tick(16, NO_INPUT);
    await settleDialogue(run);
    const shown: string[] = [];
    run.bus.on('dialogue:show', ({ sequenceId }) => shown.push(sequenceId));
    const roster = chapter4.examinables.find((e) => e.id === 'c4.roster')!;
    for (let i = 0; i < 2; i++) {
      run.setPlayerPosition({ x: roster.position.x + 16, y: roster.position.y });
      run.tick(16, frame({ pressed: ['interact'] }));
      await settleDialogue(run);
    }
    expect(shown.filter((s) => s === 'c4.bar.roster')).toHaveLength(2);
    expect(JSON.stringify(run.casebook.entries())).toContain('c4.clue.roster');
  });
});

describe('chapter 4: the way out of the bar does not depend on hurrying', () => {
  it('after minutes of talk he is still Grand, Bedside Manner works on Kev, and the drain is back for the brawl', async () => {
    const { run } = await newGame4();
    for (let i = 0; i < 1800; i++) run.tick(100, NO_INPUT);
    expect(run.player.level).toBeGreaterThanOrEqual(2);
    await startBrawl(run);
    expect(run.fight('c4.fight.brawl')?.active).toBe(true);
    expect(run.player.drainHeld).toBe(false);
  });
});
