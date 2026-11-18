/**
 * Chapter 10: the broadcast console through the chapter's own layout and script: five plugs and five sockets, the two
 * look-alikes, a wrong plug, the button as its own step, Myko's call (all five plugged, the button left), and the UI source.
 */

import { describe, expect, it } from 'vitest';
import { PROP } from '../../src/art/props';
import { BROADCAST, chapter10 } from '../../src/chapters/10/index';
import { PROOFS } from '../../src/core/types';
import { validateBroadcast } from '../../src/systems/broadcast';
import { ConsoleCursor } from '../../src/ui/model/console';
import { FakeSource, sampleBroadcastView } from '../../src/ui/dev/fakeSource';
import { record } from './helpers';
import {
  PUZZLE,
  SOLUTION,
  beatBoss,
  callMyko,
  doCabinet,
  examine,
  intoControl,
  newGame,
  plugAll,
  pressButton,
  settle,
  takeTicket,
  toConsole,
  winAnteroom,
} from './chapter10-steps';

async function atConsole() {
  const g = await newGame();
  await doCabinet(g.run);
  await takeTicket(g.run);
  await winAnteroom(g.run);
  await intoControl(g.run);
  await beatBoss(g.run);
  await toConsole(g.run);
  return g;
}

describe('chapter 10: the console layout', () => {
  it('is a sound layout: five sockets, five plugs, one per proof, exactly two look-alikes', () => {
    expect(validateBroadcast(BROADCAST)).toEqual([]);
    expect(chapter10.broadcastPuzzles?.[0]?.sectionId).toBe(PUZZLE);
    expect(chapter10.def.puzzle).toEqual({ id: PUZZLE, chapter: 10, kind: 'broadcast' });
    expect(BROADCAST.plugs.map((p) => p.proofId).sort()).toEqual([...PROOFS].sort());
  });

  it('the look-alike pair is the contract\'s square and the directory\'s notched socket; the examinables line up with the channels', () => {
    const twins = BROADCAST.sockets.filter((s) => s.look === 'square').map((s) => s.shape);
    expect(twins.sort()).toEqual(['notched', 'square']);
    expect(BROADCAST.sockets.map((s) => s.examinableId)).toEqual([1, 2, 3, 4, 5].map((n) => `c10.channel.${n}`));
    for (const s of BROADCAST.sockets) expect(chapter10.examinables.some((e) => e.id === s.examinableId)).toBe(true);
    expect(chapter10.examinables.some((e) => e.id === BROADCAST.buttonExaminableId)).toBe(true);
  });
});

describe('chapter 10: the broadcast', () => {
  it('walking onto the dais starts the puzzle, plays the intro and asks for the console; the objective is the broadcast', async () => {
    const { run } = await atConsole();
    expect(run.currentCompletable()?.sectionId).toBe(PUZZLE);
    expect(run.objective()).toBe('c10.broadcast');
  });

  it('the five proofs are in the casebook and all five plugs are owned', async () => {
    const { run } = await atConsole();
    const view = run.broadcast(PUZZLE)!.views();
    expect(view.plugs.every((p) => p.owned)).toBe(true);
    expect(view.ready).toBe(false);
  });

  it('two sockets look the same until examined; E on one shows its notch (and the scene is asked for by E at a channel)', async () => {
    const { run } = await atConsole();
    const puzzle = run.broadcast(PUZZLE)!;
    const shown = (id: string) => puzzle.views().sockets.find((s) => s.id === id)!.shown;
    expect(shown('s2')).toBe(shown('s4'));
    examine(run, 'c10.channel.4');
    expect(shown('s4')).toBe('notched');
    expect(shown('s2')).toBe('square');
    expect(puzzle.views().sockets.find((s) => s.id === 's4')!.examined).toBe(true);
  });

  it('a wrong plug costs nothing and gives the line; the right ones go in; the fifth completes the section and says so', async () => {
    const { run } = await atConsole();
    const puzzle = run.broadcast(PUZZLE)!;
    const shown = record(run.bus, 'dialogue:show');
    const events = record(run.bus, 'broadcast:changed');
    // The notched plug in the look-alike square socket.
    const wrong = puzzle.plug('c9.proof.directory', 's2');
    expect(wrong).toEqual({ ok: false, refusal: 'wrongShape', textId: 'c10.broadcast.wrong' });
    expect(events.some((e) => e.phase === 'wrong')).toBe(true);
    expect(puzzle.pluggedCount()).toBe(0);
    // The right four, then the fifth.
    for (const [socket, proof] of SOLUTION.slice(0, 4)) expect(puzzle.plug(proof, socket).ok).toBe(true);
    expect(run.isComplete(PUZZLE)).toBe(false);
    expect(puzzle.plug(SOLUTION[4]![1], SOLUTION[4]![0]).ok).toBe(true);
    await settle(run, 8);
    expect(run.isComplete(PUZZLE)).toBe(true);
    expect(shown.map((s) => s.sequenceId)).toContain('c10.broadcast.ready');
    expect(run.objective()).toBe('c10.button');
    expect(run.dressing.prop('control.button')?.frame).toBe(PROP.bigButton.ready);
    // The button is its own step.
    expect(puzzle.pressed).toBe(false);
  });

  it('the button does nothing before the fifth plug, and presses once after it', async () => {
    const { run } = await atConsole();
    const puzzle = run.broadcast(PUZZLE)!;
    const events = record(run.bus, 'broadcast:changed');
    await pressButton(run);
    expect(puzzle.pressed).toBe(false);
    await plugAll(run);
    await pressButton(run);
    expect(puzzle.pressed).toBe(true);
    expect(events.filter((e) => e.phase === 'pressed')).toHaveLength(1);
  });

  it('a Myko call plugs all five, says its scene, and leaves the button', async () => {
    const { run } = await atConsole();
    const shown = record(run.bus, 'dialogue:show');
    await callMyko(run);
    const puzzle = run.broadcast(PUZZLE)!;
    expect(run.isComplete(PUZZLE)).toBe(true);
    expect(puzzle.views().sockets.every((s) => s.plugged !== null)).toBe(true);
    expect(puzzle.pressed).toBe(false);
    expect(shown.map((s) => s.sequenceId)).toContain('c10.call.puzzle');
    // The ready line is not played over the call's own scene.
    expect(shown.map((s) => s.sequenceId)).not.toContain('c10.broadcast.ready');
    expect(run.objective()).toBe('c10.button');
    expect(run.mykoCallsUsed()).toBe(1);
    await pressButton(run);
    expect(puzzle.pressed).toBe(true);
  });
});

describe('chapter 10: the UI side of the console', () => {
  it('the fake source plugs, refuses a wrong shape, examines and presses, like the real one', () => {
    const src = new FakeSource();
    src.broadcast = sampleBroadcastView();
    expect(src.activeBroadcast()?.sockets).toHaveLength(5);
    expect(src.plugProof(PUZZLE, 'c9.proof.directory', 's2')).toEqual({ ok: false, refusal: 'wrongShape', textId: 'c10.broadcast.wrong' });
    expect(src.examineSocket(PUZZLE, 's4')).toBe(true);
    expect(src.examineSocket(PUZZLE, 's4')).toBe(false);
    expect(src.activeBroadcast()?.sockets.find((s) => s.id === 's4')?.shown).toBe('notched');
    expect(src.pressBroadcast(PUZZLE)).toBe(false);
    for (const [socket, proof] of SOLUTION) expect(src.plugProof(PUZZLE, proof, socket).ok).toBe(true);
    expect(src.activeBroadcast()?.ready).toBe(true);
    expect(src.pressBroadcast(PUZZLE)).toBe(true);
    expect(src.pressBroadcast(PUZZLE)).toBe(false);
  });

  it('the fake source advances and clears a card', () => {
    const src = new FakeSource();
    src.card = { index: 0, total: 2, card: { id: 'title', kind: 'title', textId: 'c10.credits.title', durationMs: 0 } };
    expect(src.activeCard()?.card.id).toBe('title');
    src.advanceCard();
    expect(src.activeCard()).toBeNull();
  });

  it('the cursor moves across rows, picks a plug up and puts it back', () => {
    const c = new ConsoleCursor(5);
    expect([c.row, c.col]).toEqual(['plugs', 0]);
    c.step(-1);
    expect(c.col).toBe(4);
    c.pick(4);
    expect([c.row, c.held]).toEqual(['sockets', 4]);
    c.rowStep(1);
    c.rowStep(1);
    expect(c.row).toBe('button');
    c.step(1);
    expect(c.col).toBe(0);
    c.rowStep(1);
    expect(c.row).toBe('sockets');
    c.pick(4);
    expect(c.held).toBeNull();
  });
});
