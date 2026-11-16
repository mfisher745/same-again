/**
 * Playtest 6: plainer chapter 1 opening (Myko on drinking before the first pint), the dispensers say why they will
 * not pour, the dispenser's steam shows its one free charge, commentary never holds up a waiting scene, and separate
 * beer and spirit limits (the limits themselves are in overhaul-kit.test.ts).
 */

import { describe, expect, it } from 'vitest';
import { chapter1 } from '../../src/chapters/01/index';
import { chapter2 } from '../../src/chapters/02/index';
import { DialogueQueue } from '../../src/ui/model/dialogue';
import type { DialogueSequence } from '../../src/core/types';
import type { ChapterScript } from '../../src/systems';
import { NO_INPUT, record, settleDialogue, startChapterGame } from './helpers';

/** E on an examinable, straight to the chapter script (the walk up to it is not what is under test). */
const examine = (run: object, id: string): void => void (run as { script: ChapterScript }).script.onExamine?.(id);
/** The last of these lines shown since `from`, if any. */
const lastOf = (lines: { sequenceId: string }[], ids: readonly string[]): string | undefined => [...lines].reverse().find((l) => ids.includes(l.sequenceId))?.sequenceId;
const URN = ['c1.urn.notYet', 'c1.urn.held', 'c1.urn.spent'] as const;
const FLASK = ['c2.flask.held', 'c2.flask.spent'] as const;

const shown = (run: { bus: Parameters<typeof record>[0] }) => record(run.bus, 'dialogue:show');

describe('chapter 1: drinking before Dympna has poured', () => {
  it('the first refusal brings Myko’s line on what to do, once; the HUD refusal keeps its reason', async () => {
    const { run } = startChapterGame(chapter1, 'new');
    run.tick(16, NO_INPUT);
    await settleDialogue(run);
    const lines = shown(run);
    const refused = record(run.bus, 'kit:useRefused');
    run.give({ kind: 'drink', drinkId: 'stout', count: 1 });
    run.selectItem('stout');
    expect(run.useSelected()).toBe(false);
    await settleDialogue(run);
    expect(run.useSelected()).toBe(false);
    await settleDialogue(run);
    expect(refused.every((r) => r.reason === 'meterHidden' && r.textId === 'ui.use.notYet')).toBe(true);
    expect(lines.filter((l) => l.sequenceId === 'c1.pub.notYet')).toHaveLength(1);
  });
});

describe('the dispensers say why they will not pour', () => {
  it('chapter 1: the urn before item four, with one already held, and once it is spent', async () => {
    const { run } = startChapterGame(chapter1, 'new');
    run.tick(16, NO_INPUT);
    await settleDialogue(run);
    const lines = shown(run);
    const urn = () => examine(run, 'c1.urn');
    urn();
    expect(lastOf(lines, URN)).toBe('c1.urn.notYet');
    await settleDialogue(run);
    run.setFlag('pub.step', 5);
    expect(run.takeHotDrink('tea')).toBe(true);
    urn();
    expect(lastOf(lines, URN)).toBe('c1.urn.held');
    await settleDialogue(run);
    run.setMeterHidden(false); // past the first pint, as the list would be by item five
    run.selectItem('tea');
    expect(run.useSelected()).toBe(true);
    urn();
    await settleDialogue(run); // queued behind Myko's line on the tea
    expect(lastOf(lines, URN)).toBe('c1.urn.spent');
  });

  it('the urn steams while its free hot drink can be taken, and stops once it is taken', async () => {
    const { run } = startChapterGame(chapter1, 'new');
    run.tick(16, NO_INPUT);
    await settleDialogue(run);
    expect(run.dressing.prop('urn.steam')?.visible).toBe(true);
    run.setFlag('pub.step', 4);
    expect(run.takeHotDrink('coffee')).toBe(true);
    expect(run.dressing.prop('urn.steam')?.visible).toBe(false);
  });

  it('chapter 2: the flask has a free drink at the start, steams, and says why when it will not pour', async () => {
    const { run } = startChapterGame(chapter2, 'chapter');
    run.tick(16, NO_INPUT);
    await settleDialogue(run);
    expect(run.hotDrinkOffered()).toBe(true);
    expect(run.dressing.prop('bar.steam')?.visible).toBe(true);
    const lines = shown(run);
    expect(run.takeHotDrink('tea')).toBe(true);
    expect(run.dressing.prop('bar.steam')?.visible).toBe(false);
    examine(run, 'c2.flask');
    expect(lastOf(lines, FLASK)).toBe('c2.flask.held');
    await settleDialogue(run);
    run.selectItem('tea');
    expect(run.useSelected()).toBe(true);
    examine(run, 'c2.flask');
    await settleDialogue(run);
    expect(lastOf(lines, FLASK)).toBe('c2.flask.spent');
  });
});

describe('commentary never holds up a scene', () => {
  const seqs: DialogueSequence[] = [
    { id: 'b', delivery: 'box', lines: [{ id: 'b.1', speaker: 'myko', text: 'A long bit of commentary.' }, { id: 'b.2', speaker: 'myko', text: 'And more.' }] },
    { id: 's', delivery: 'scene', lines: [{ id: 's.1', speaker: 'dympna', text: 'Item one.' }] },
  ];
  const make = () => {
    const finished: string[] = [];
    const q = new DialogueQueue({ lookup: (id) => seqs.find((s) => s.id === id) as DialogueSequence, speakerName: () => null, onFinished: (id) => void finished.push(id) });
    return { q, finished };
  };

  it('E does nothing to a box on its own', () => {
    const { q, finished } = make();
    q.enqueue('b');
    q.update(5000);
    q.advance();
    q.advance();
    expect(finished).toEqual([]);
    expect(q.view()?.awaitingAdvance).toBe(false);
  });

  it('with a scene waiting behind it, E skips the box and the scene comes up', () => {
    const { q, finished } = make();
    q.enqueue('b');
    q.enqueue('s');
    q.update(5000);
    expect(q.view()?.awaitingAdvance).toBe(true);
    q.advance();
    q.advance();
    q.advance();
    expect(finished).toEqual(['b']);
    expect(q.blocking).toBe(true);
    expect(q.view()?.sequenceId).toBe('s');
  });
});
