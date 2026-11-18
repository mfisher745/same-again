/**
 * Chapter 10 and the reload trap: the anteroom fight, the Administrator, the console and the epilogue, each under way, a
 * load (Continue) or a return to the cabinet, and each starts again from what the script finds (not complete, not under
 * way), never from a saved "started" flag. Also the two versions of the epilogue's calls remark.
 */

import { describe, expect, it } from 'vitest';
import { BAR_ARRIVAL, MYKO_BAR } from '../../src/chapters/10/maps';
import { record } from './helpers';
import {
  BOSS,
  FIGHT,
  PUZZLE,
  beatBoss,
  callMyko,
  doCabinet,
  examine,
  intoControl,
  newGame,
  playThroughCards,
  plugAll,
  pressButton,
  safe,
  settle,
  sitAndFinish,
  stepBoss,
  takeTicket,
  toConsole,
  toPub,
  toSober,
  upToButton,
  winAnteroom,
} from './chapter10-steps';

type Run = Awaited<ReturnType<typeof newGame>>['run'];

/** Anything that writes a save (a clue he did not have), so a load finds the state as it stands. */
const save = (run: Run): void => run.addEvidence('c7.clue.permit' as never);

describe('chapter 10: the anteroom fight survives a load and a return', () => {
  it('under way, saved and loaded: the fight is off, the door is locked, and the ticket starts it again', async () => {
    const a = await newGame();
    await doCabinet(a.run);
    await takeTicket(a.run);
    expect(a.run.fight(FIGHT)?.active).toBe(true);
    save(a.run);
    const b = await newGame('continue', a.store);
    expect(b.run.fight(FIGHT)?.active).toBe(false);
    expect(b.run.isComplete(FIGHT)).toBe(false);
    expect(b.run.objective()).toBe('c10.anteroom');
    b.run.setPlayerPosition({ x: 15 * 16, y: 1 * 16 + 8 });
    await settle(b.run, 4);
    expect(b.run.screenId).toBe('c10.anteroom');
    await takeTicket(b.run);
    expect(b.run.fight(FIGHT)?.active).toBe(true);
  });

  it('back to the cabinet mid-fight: the line, the fight reset, Myko by the entrance, the ticket starts it again', async () => {
    const { run } = await newGame();
    await doCabinet(run);
    await takeTicket(run);
    const shown = record(run.bus, 'dialogue:show');
    await toSober(run);
    expect(run.screenId).toBe('c10.anteroom');
    expect(run.player.pos).toEqual(BAR_ARRIVAL);
    expect(run.myko.pos).toEqual(MYKO_BAR);
    expect(shown.map((s) => s.sequenceId)).toContain('c10.bar.return');
    expect(run.fight(FIGHT)?.active).toBe(false);
    await takeTicket(run);
    expect(run.fight(FIGHT)?.active).toBe(true);
    await winAnteroom(run);
    expect(run.isComplete(FIGHT)).toBe(true);
  });

  it('a finished fight stays finished after a return: the door is open and the ticket does nothing', async () => {
    const { run } = await newGame();
    await takeTicket(run);
    await winAnteroom(run);
    await toSober(run);
    expect(run.isComplete(FIGHT)).toBe(true);
    examine(run, 'c10.ticket');
    await settle(run, 4);
    expect(run.fight(FIGHT)?.active).toBe(false);
    run.setPlayerPosition({ x: 15 * 16, y: 1 * 16 + 8 });
    await settle(run, 6);
    expect(run.screenId).toBe('c10.control');
  });
});

describe('chapter 10: the Administrator survives a load and a return', () => {
  async function inFight() {
    const g = await newGame();
    await takeTicket(g.run);
    await winAnteroom(g.run);
    await intoControl(g.run);
    safe(g.run);
    return g;
  }

  it('loaded in the control room mid-fight: he starts again from phase 1 with the shield up', async () => {
    const a = await inFight();
    expect(a.run.boss(BOSS)?.active).toBe(true);
    a.run.boss(BOSS)!.forcePhase('personally');
    stepBoss(a.run, 100);
    save(a.run);
    const b = await newGame('continue', a.store);
    // A load starts at the cabinet with the fight cleared; the door to control is open.
    expect(b.run.screenId).toBe('c10.anteroom');
    expect(b.run.isComplete(FIGHT)).toBe(true);
    expect(b.run.boss(BOSS)?.active).toBe(false);
    await intoControl(b.run);
    expect(b.run.isComplete(BOSS)).toBe(false);
    expect(b.run.boss(BOSS)?.active).toBe(true);
    expect(b.run.boss(BOSS)?.phase?.id).toBe('delegation');
    expect(b.run.administrator(BOSS)?.shieldUp).toBe(true);
  });

  it('back to the cabinet mid-fight: phase 1 again on the way back in, jacket on the floor not the hook, no flag in the way', async () => {
    const { run } = await inFight();
    run.boss(BOSS)!.forcePhase('personally');
    stepBoss(run, 100);
    await toSober(run);
    expect(run.screenId).toBe('c10.anteroom');
    expect(run.boss(BOSS)?.active).toBe(false);
    expect(run.isComplete(BOSS)).toBe(false);
    run.setPlayerPosition({ x: 15 * 16, y: 1 * 16 + 8 });
    for (let i = 0; i < 12 && run.boss(BOSS)?.active !== true; i++) await settle(run, 3);
    expect(run.boss(BOSS)?.active).toBe(true);
    expect(run.boss(BOSS)?.phase?.id).toBe('delegation');
    expect(run.administrator(BOSS)?.shieldUp).toBe(true);
    expect(run.administrator(BOSS)?.flipped).toBe(false);
  });

  it('beaten, saved and loaded: he stays beaten and the broadcast is the section', async () => {
    const a = await inFight();
    await beatBoss(a.run);
    save(a.run);
    const b = await newGame('continue', a.store);
    await settle(b.run, 6);
    expect(b.run.isComplete(BOSS)).toBe(true);
    expect(b.run.boss(BOSS)?.active).toBe(false);
    expect(b.run.objective()).toBe('c10.broadcast');
  });
});

describe('chapter 10: the console survives a load and a return', () => {
  async function beforeConsole() {
    const g = await newGame();
    await takeTicket(g.run);
    await winAnteroom(g.run);
    await intoControl(g.run);
    await beatBoss(g.run);
    return g;
  }

  it('back to the cabinet with three plugs in: the console starts again on the dais and can be finished', async () => {
    const { run } = await beforeConsole();
    await toConsole(run);
    const puzzle = run.broadcast(PUZZLE)!;
    puzzle.plug('c9.proof.log', 's1');
    puzzle.plug('c9.proof.contract', 's2');
    puzzle.plug('c9.proof.craft', 's3');
    await toSober(run);
    expect(run.isComplete(PUZZLE)).toBe(false);
    expect(run.isComplete(BOSS)).toBe(true);
    run.setPlayerPosition({ x: 15 * 16, y: 1 * 16 + 8 });
    await settle(run, 6);
    expect(run.screenId).toBe('c10.control');
    await toConsole(run);
    expect(run.currentCompletable()?.sectionId).toBe(PUZZLE);
    await plugAll(run);
    expect(run.isComplete(PUZZLE)).toBe(true);
  });

  it('saved with the console under way, loaded: it is started again by walking onto the dais', async () => {
    const a = await beforeConsole();
    await toConsole(a.run);
    save(a.run);
    const b = await newGame('continue', a.store);
    await settle(b.run, 6);
    expect(b.run.isComplete(BOSS)).toBe(true);
    expect(b.run.isComplete(PUZZLE)).toBe(false);
    await intoControl(b.run);
    await toConsole(b.run);
    expect(b.run.currentCompletable()?.sectionId).toBe(PUZZLE);
    await plugAll(b.run);
    expect(b.run.isComplete(PUZZLE)).toBe(true);
    expect(b.run.objective()).toBe('c10.button');
  });

  it('a Myko call, saved and loaded: the five stay plugged and the button is still there', async () => {
    const a = await beforeConsole();
    await toConsole(a.run);
    await callMyko(a.run);
    save(a.run);
    const b = await newGame('continue', a.store);
    await settle(b.run, 6);
    expect(b.run.isComplete(PUZZLE)).toBe(true);
    expect(b.run.broadcast(PUZZLE)!.views().sockets.every((s) => s.plugged !== null)).toBe(true);
    expect(b.run.broadcast(PUZZLE)!.pressed).toBe(false);
    expect(b.run.objective()).toBe('c10.button');
    await pressButton(b.run);
    expect(b.run.broadcast(PUZZLE)!.pressed).toBe(true);
  });
});

describe('chapter 10: the epilogue survives a load', () => {
  it('pressed and saved, loaded: the cards play and Andrew is cut to Feeney\'s again', async () => {
    const a = await newGame();
    await upToButton(a.run);
    a.run.broadcast(PUZZLE)!.press();
    save(a.run);
    const b = await newGame('continue', a.store);
    expect(b.run.broadcast(PUZZLE)!.pressed).toBe(true);
    const cards = record(b.run.bus, 'epilogue:card');
    await settle(b.run, 6);
    await playThroughCards(b.run);
    expect(cards.length).toBeGreaterThan(0);
    expect(b.run.screenId).toBe('c10.pub');
  });

  it('home and saved, loaded at the cabinet: he is taken back to Feeney\'s, the epilogue plays again and the chapter ends', async () => {
    const a = await newGame();
    await toPub(a.run);
    a.run.completeSection('c10.explore.pub');
    save(a.run);
    const b = await newGame('continue', a.store);
    await settle(b.run, 4);
    expect(b.run.screenId).toBe('c10.pub');
    expect(b.run.seated).not.toBeNull();
    for (let i = 0; i < 80 && b.run.activeCard() === null; i++) await settle(b.run, 2);
    for (let i = 0; i < 30 && b.run.activeCard() !== null; i++) {
      await new Promise<void>((r) => setTimeout(r, 0));
      b.run.advanceCard();
      await settle(b.run, 2);
    }
    expect(b.run.isEnded).toBe(true);
  });
});

describe("chapter 10: Feeney's has no saved meter state", () => {
  it('a save made at the pub loads with the meter showing and draining as normal', async () => {
    const a = await newGame();
    await toPub(a.run);
    expect(a.run.player.meterSnapshot().hidden).toBe(true);
    save(a.run);
    const b = await newGame('continue', a.store);
    expect(b.run.player.meterSnapshot().hidden).toBe(false);
  });
});

describe('chapter 10: the two versions of the epilogue', () => {
  const REMARK = 'c10.epilogue.calls.unused';

  it('no calls used: Myko\'s remark plays', async () => {
    const { run } = await newGame();
    await toPub(run);
    expect(run.mykoCallsUsed()).toBe(0);
    expect(await sitAndFinish(run)).toContain(REMARK);
  });

  it('a call used: the remark is not played, and nothing else in the epilogue changes', async () => {
    const plain = await newGame();
    await toPub(plain.run);
    const without = await sitAndFinish(plain.run);

    const { run } = await newGame();
    await doCabinet(run);
    await takeTicket(run);
    await callMyko(run);
    await intoControl(run);
    await beatBoss(run);
    await toConsole(run);
    await plugAll(run);
    await pressButton(run);
    await playThroughCards(run);
    await settle(run, 4);
    expect(run.mykoCallsUsed()).toBe(1);
    const withCall = await sitAndFinish(run);
    expect(withCall).not.toContain(REMARK);
    // The same scenes in the same order, bar the one remark.
    const tail = (ids: string[]) => ids.slice(ids.indexOf('c10.pub.dympna'));
    expect(tail(withCall)).toEqual(tail(without).filter((id) => id !== REMARK));
    // Dympna's scene and the epilogue never mention how many (the text files are the creative director's; this checks the ids played).
    expect(tail(withCall)).toContain('c10.epilogue.ohio');
  });
});
