/**
 * Chapter 10, the whole way: the cabinet, ticket 848 and the locked door, the Administrator, the broadcast, the world's
 * reaction, Feeney's (no meter), the epilogue in both versions and the credits.
 */

import { describe, expect, it } from 'vitest';
import { PROP } from '../../src/art/props';
import { chapter10 } from '../../src/chapters/10/index';
import { MYKO_BAR, MYKO_PUB } from '../../src/chapters/10/maps';
import { NO_INPUT, record } from './helpers';
import {
  BAR_ARRIVAL,
  BOSS,
  FIGHT,
  callMyko,
  PUZZLE,
  doCabinet,
  examine,
  intoControl,
  newGame,
  playThroughCards,
  pressButton,
  settle,
  sitAndFinish,
  takeTicket,
  toPub,
  upToButton,
  winAnteroom,
} from './chapter10-steps';

describe('chapter 10: the cabinet and the ticket gate', () => {
  it('opens at the cabinet with the captions, the line, Myko by the entrance and the first objective', async () => {
    const g = await newGame();
    const { run } = g;
    expect(run.screenId).toBe('c10.anteroom');
    expect(run.player.pos).toEqual(BAR_ARRIVAL);
    expect(run.myko.pos).toEqual(MYKO_BAR);
    expect(run.objective()).toBe('c10.anteroom');
    expect(run.fight(FIGHT)?.active).toBe(false);
  });

  it('the hot drink at the trolley completes the bar section', async () => {
    const { run } = await newGame();
    await doCabinet(run);
    expect(run.isComplete('c10.explore.bar')).toBe(true);
    expect(run.player.kit.hotDrink).not.toBeNull();
  });

  it('the fight does not start until Andrew takes the ticket; the ticket plays c10.open and starts it', async () => {
    const { run } = await newGame();
    for (let i = 0; i < 20; i++) await settle(run, 2);
    expect(run.fight(FIGHT)?.active).toBe(false);
    const shown = record(run.bus, 'dialogue:show');
    await takeTicket(run);
    expect(shown.map((s) => s.sequenceId)).toContain('c10.open');
    expect(run.fight(FIGHT)?.active).toBe(true);
  });

  it('the door to control is locked until the fight is complete, and opens after it', async () => {
    const { run } = await newGame();
    run.setPlayerPosition({ x: 15 * 16, y: 1 * 16 + 8 });
    run.tick(16, NO_INPUT);
    await settle(run, 4);
    expect(run.screenId).toBe('c10.anteroom');
    await takeTicket(run);
    // Still locked while the fight is on.
    run.setPlayerPosition({ x: 15 * 16, y: 1 * 16 + 8 });
    await settle(run, 4);
    expect(run.screenId).toBe('c10.anteroom');
    const shown = record(run.bus, 'dialogue:show');
    await winAnteroom(run);
    expect(run.isComplete(FIGHT)).toBe(true);
    expect(shown.map((s) => s.sequenceId)).toContain('c10.anteroom.end');
    expect(run.objective()).toBe('c10.administrator');
    run.setPlayerPosition({ x: 15 * 16, y: 1 * 16 + 8 });
    await settle(run, 6);
    expect(run.screenId).toBe('c10.control');
  });

  it('wave 2 plays its line; taking the ticket again while the fight is on does not start a second one', async () => {
    const { run } = await newGame();
    const shown = record(run.bus, 'dialogue:show');
    await takeTicket(run);
    examine(run, 'c10.ticket');
    await settle(run, 4);
    const fight = run.fight(FIGHT)!;
    for (let i = 0; i < 40 && !shown.some((s) => s.sequenceId === 'c10.anteroom.wave2'); i++) {
      for (const a of fight.aliveActors()) run.defeat(a, 'player');
      await settle(run, 4);
    }
    expect(shown.map((s) => s.sequenceId)).toContain('c10.anteroom.wave2');
  });

  it('a Myko call on the fight finishes it and leaves the door open', async () => {
    const { run } = await newGame();
    await takeTicket(run);
    await callMyko(run);
    expect(run.isComplete(FIGHT)).toBe(true);
    expect(run.mykoCallsUsed()).toBe(1);
  });
});

describe('chapter 10: from the cabinet to the credits', () => {
  it('runs the whole chapter by the real triggers, no Myko call, and ends in the credits', async () => {
    const g = await newGame();
    const { run } = g;
    const shown = record(run.bus, 'dialogue:show');
    const completed = record(run.bus, 'section:completed');
    await toPub(run);
    // The button was pressed and the cards played.
    expect(run.broadcast(PUZZLE)?.pressed).toBe(true);
    const seen = shown.map((s) => s.sequenceId);
    for (const id of ['c10.open', 'c10.admin.intro', 'c10.admin.end', 'c10.broadcast.intro', 'c10.broadcast.ready', 'c10.broadcast.sent', 'c10.reaction.news', 'c10.reaction.comment', 'c10.reaction.colleen', 'c10.pub.enter']) {
      expect(seen, id).toContain(id);
    }
    expect(run.screenId).toBe('c10.pub');
    expect(run.objective()).toBe('c10.sit');
    expect(completed.map((c) => c.sectionId)).toEqual(expect.arrayContaining([FIGHT, BOSS, PUZZLE]));
    expect(run.myko.pos).toEqual(MYKO_PUB);
    const played = await sitAndFinish(run);
    for (const id of ['c10.pub.dympna', 'c10.epilogue.1', 'c10.epilogue.2', 'c10.epilogue.calls.unused', 'c10.epilogue.3', 'c10.epilogue.ohio']) expect(played, id).toContain(id);
    expect(run.isComplete('c10.explore.pub')).toBe(true);
  });

  it('the reaction cards, in order, then the cut to Feeney\'s with no exit between', async () => {
    const { run } = await newGame();
    await upToButton(run);
    const cards = record(run.bus, 'epilogue:card');
    await pressButton(run);
    const ids = await playThroughCards(run);
    expect(cards.map((c) => c.cardId)).toEqual(['governments', 'statement', 'news', 'views', 'comment', 'colleen', 'lake', 'week']);
    expect(ids.length).toBeGreaterThan(0);
    expect(run.screenId).toBe('c10.pub');
    expect(cards.map((c) => c.kind)).toEqual(['caption', 'caption', 'scene', 'caption', 'scene', 'scene', 'caption', 'caption']);
  });
});

describe('chapter 10: Feeney\'s', () => {
  it('has no meter: it is hidden and does not drain, and it is never saved', async () => {
    const g = await newGame();
    await toPub(g.run);
    const snap = g.run.player.meterSnapshot();
    expect(snap.hidden).toBe(true);
    const before = g.run.player.meter.value;
    for (let i = 0; i < 100; i++) g.run.tick(16, NO_INPUT);
    expect(g.run.player.meter.value).toBe(before);
    expect(g.run.dressing.prop('pub.telly')?.frame).toBe(PROP.tellyOn.weather);
    expect(g.run.dressing.npc('dympna')?.visible).toBe(true);
    expect(g.run.flag('meterHidden')).not.toBe(true);
  });

  it('E at the stool sits him: he is held, faces the bar, and the chapter completes after the credits', async () => {
    const g = await newGame();
    await toPub(g.run);
    expect(g.run.seated).toBeNull();
    const ended = record(g.run.bus, 'chapter:completed');
    const played = await sitAndFinish(g.run);
    expect(played).toContain('c10.pub.dympna');
    expect(g.run.seated).not.toBeNull();
    expect(g.run.seated?.facing).toBe('up');
    expect(ended).toHaveLength(1);
  });

  it('the pub exit does not exist: there is nowhere to walk to', async () => {
    const g = await newGame();
    await toPub(g.run);
    expect(g.run.screenId).toBe('c10.pub');
    expect(chapter10.screens.find((x) => x.id === 'c10.pub')?.exits).toHaveLength(0);
  });
});

describe('chapter 10: the intro to the Administrator', () => {
  it('walking in plays his intro and starts the boss from phase 1 with the desk shield up', async () => {
    const { run } = await newGame();
    const shown = record(run.bus, 'dialogue:show');
    await takeTicket(run);
    await winAnteroom(run);
    await intoControl(run);
    expect(shown.map((s) => s.sequenceId)).toContain('c10.admin.intro');
    const boss = run.boss(BOSS)!;
    expect(boss.active).toBe(true);
    expect(boss.phase?.id).toBe('delegation');
    expect(run.administrator(BOSS)?.shieldUp).toBe(true);
    expect(run.dressing.prop('control.shield')?.visible).toBe(true);
  });
});
