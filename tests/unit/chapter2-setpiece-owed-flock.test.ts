/** Chapter 2 systems: the flock-settled event, owed move lessons, and the set-piece Myko call (sandbox). */

import { describe, expect, it } from 'vitest';
import { createChapter2Sandbox } from '../../src/core/sandbox2';
import { GameEvents } from '../../src/core/types';
import { advance, frame, makeRun, record } from './helpers';

describe('flock settled', () => {
  it('announces the pen once when the whole flock stands in it, and not again until it changes', () => {
    const h = makeRun({ chapter: 2, module: createChapter2Sandbox() });
    const settled = record(h.bus, 'sheep:flockSettled');
    const sp = h.run.sheepPuzzlesHere()[0];
    expect(sp).toBeDefined();
    for (const s of sp!.puzzle.sheep()) s.pos = { x: 36 * 16, y: 5 * 16 };
    advance(h.run, 5000, 50);
    expect(settled).toEqual([{ puzzleId: 'c2.puzzle.sheep', pen: 'pen2' }]);
    // One sheep strays: the flock is no longer all in one pen, and nothing new is announced.
    sp!.puzzle.sheep()[0]!.pos = { x: 32 * 16, y: 5 * 16 };
    advance(h.run, 5000, 50);
    expect(settled).toHaveLength(1);
  });
});

describe('owed move lessons', () => {
  it('stay owed below Bit much, play the scene at Bit much, then learn the move and clear the debt', async () => {
    const mod = createChapter2Sandbox();
    // Run as if it were chapter 3, with the Stumble owed from chapter 2.
    const h = makeRun({
      chapter: 2,
      module: { ...mod, createScript: undefined, def: { ...mod.def, number: 3 } },
      save: (b) => ({ ...b, owedMoves: [{ moveId: 'stumble', sceneId: 'c2.stumble.lesson', chapter: 2 }] }),
    });
    expect(h.run.player.kit.moves).not.toContain('stumble');
    const learned = record(h.bus, 'move:learned');
    h.bus.emit(GameEvents.BuzzLevelChanged, { from: 2, to: 3, state: 'bitMuch', value: 60 });
    advance(h.run, 20_000, 50);
    // The scene is still on screen, so nothing is learned yet.
    expect(learned).toEqual([]);
    expect(h.run.movesOwed()).toEqual(['stumble']);
    h.run.dialogueFinished('c2.stumble.lesson');
    await Promise.resolve();
    await Promise.resolve();
    h.run.tick(50, frame());
    expect(learned).toEqual([{ moveId: 'stumble' }]);
    expect(h.run.movesOwed()).toEqual([]);
    expect(h.run.snapshot().owedMoves).toBeUndefined();
    expect(h.run.player.kit.moves).toContain('stumble');
  });
});

describe('a set-piece call', () => {
  it('is a setpiece call with casebook text, and completes the ram by Myko', () => {
    const h = makeRun({ chapter: 2, module: createChapter2Sandbox() });
    const started = record(h.bus, 'myko:callStarted');
    const entries = record(h.bus, 'casebook:entryAdded');
    const ends: string[] = [];
    h.bus.on('section:completed', (e) => void ends.push(`${e.sectionId}:${e.by}`));
    h.run.startSection('c2.setpiece.ram');
    h.run.tick(50, frame());
    expect(h.run.myko.tryCall()).toBe(true);
    expect(started[0]?.kind).toBe('setpiece');
    expect(JSON.stringify(entries)).toContain('"callId":"ram"');
    advance(h.run, 20_000, 50);
    expect(ends).toContain('c2.setpiece.ram:myko');
  });
});
