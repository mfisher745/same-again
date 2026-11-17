/**
 * Chapter 3: the social club, back to the bar (DESIGN.md 7.1, docs/chapters/README.md "What a return to the bar keeps"),
 * save and load mid-chapter, the kettle's lines, and Myko's call on each callable section.
 */

import { describe, expect, it } from 'vitest';
import { BAR_ARRIVAL, BAY_ARRIVAL } from '../../src/chapters/03/maps';
import { TUNING } from '../../src/content/tuning';
import type { EvidenceId } from '../../src/core/types';
import { levelTable, restValue } from '../../src/systems/meter';
import { holds } from '../../src/systems/kit';
import { PROP } from '../../src/art/props';
import { NO_INPUT, drinkItem, record, settleDialogue } from './helpers';
import { crossYard, enter, examine, mid, newGame, openOffice, settle, toBayPuzzleSolved, toSober } from './chapter3-steps';
import { BOSS_AREA, DOORS_AREA, OFFICE_ARRIVAL } from '../../src/chapters/03/maps';

const ev = (id: string): EvidenceId => id as EvidenceId;
const lastOf = (lines: { sequenceId: string }[], ids: readonly string[]): string | undefined => [...lines].reverse().find((l) => ids.includes(l.sequenceId))?.sequenceId;
const KETTLE = ['c3.kettle.held', 'c3.kettle.spent'] as const;

describe('the kettle (the free hot drink, once at a time)', () => {
  it('has a free drink at the start, steams, and says why it will not pour: held, then spent', async () => {
    const { run } = await newGame();
    expect(run.hotDrinkOffered()).toBe(true);
    expect(run.dressing.prop('bar.steam')?.visible).toBe(true);
    const lines = record(run.bus, 'dialogue:show');
    expect(run.takeHotDrink('tea')).toBe(true);
    expect(run.dressing.prop('bar.steam')?.visible).toBe(false);
    examine(run, 'c3.kettle');
    expect(lastOf(lines, KETTLE)).toBe('c3.kettle.held');
    await settleDialogue(run);
    run.selectItem('tea');
    expect(run.useSelected()).toBe(true);
    examine(run, 'c3.kettle');
    await settleDialogue(run);
    expect(lastOf(lines, KETTLE)).toBe('c3.kettle.spent');
  });

  it('mashing E does not stack the line up: each line plays once at a time', async () => {
    const { run } = await newGame();
    const lines = record(run.bus, 'dialogue:show');
    run.takeHotDrink('tea');
    for (let i = 0; i < 8; i++) examine(run, 'c3.kettle');
    await settleDialogue(run);
    expect(lines.filter((l) => l.sequenceId === 'c3.kettle.held')).toHaveLength(1);
    // Once it has played, the next E says it again (it is a reply to the player, so it may repeat).
    examine(run, 'c3.kettle');
    await settleDialogue(run);
    expect(lines.filter((l) => l.sequenceId === 'c3.kettle.held')).toHaveLength(2);
    run.selectItem('tea');
    run.useSelected();
    await settleDialogue(run);
    for (let i = 0; i < 8; i++) examine(run, 'c3.kettle');
    await settleDialogue(run);
    expect(lines.filter((l) => l.sequenceId === 'c3.kettle.spent')).toHaveLength(1);
  });

  it('is offered again after a return to the bar', async () => {
    const { run } = await newGame();
    run.takeHotDrink('coffee');
    expect(run.hotDrinkOffered()).toBe(false);
    // The free one is offered again once the last is drunk (he cannot carry two).
    run.selectItem('coffee');
    expect(run.useSelected()).toBe(true);
    await toSober(run);
    expect(run.hotDrinkOffered()).toBe(true);
    expect(run.dressing.prop('bar.steam')?.visible).toBe(true);
  });
});

describe('chapter 3: back to the bar', () => {
  /** Through the yard, the office and the crates, the manifest taken: the night shift is under way. */
  async function duringNightShift() {
    const g = await newGame();
    await toBayPuzzleSolved(g.run);
    examine(g.run, 'c3.manifest');
    await settle(g.run, 8);
    expect(g.run.fight('c3.fight.bay')?.active).toBe(true);
    return g;
  }

  it.each(['sober', 'floor'] as const)('%s: back at the club with Buzz at the bottom of Grand, the return line, a hot drink on offer and bottles topped up', async (reason) => {
    const { run } = await duringNightShift();
    const shown = record(run.bus, 'dialogue:show');
    const returned = record(run.bus, 'bar:returned');
    if (reason === 'sober') run.player.meter = { ...run.player.meter, value: 0.01 };
    else {
      // The floor is reached by a pint, not by drifting there.
      run.give({ kind: 'drink', drinkId: 'stout', count: 1 });
      run.player.meter = { ...run.player.meter, value: levelTable(3).floor - 1 };
      expect(drinkItem(run, 'stout')).toBe(true);
    }
    for (let i = 0; i < 80 && returned.length === 0; i++) {
      run.tick(16, NO_INPUT);
      run.completeBarReturn();
    }
    await settle(run, 4);
    expect(returned.map((r) => r.reason)).toEqual([reason]);
    expect(run.screenId).toBe('c3.yard');
    expect(run.player.pos).toEqual(BAR_ARRIVAL);
    expect(run.player.meter.value).toBeCloseTo(restValue(3), 0);
    expect(shown.map((s) => s.sequenceId)).toContain('c3.bar.return');
    expect(run.hotDrinkOffered()).toBe(true);
    expect(run.player.kit.bottles).toBeGreaterThanOrEqual(TUNING.overhaul!.carry.minBottlesOnLeavingBar);
  });

  it('keeps everything finished (clues, cabinet and its whiskey, moves, solved crates, the open door) and resets the night shift', async () => {
    const { run } = await duringNightShift();
    await toSober(run);
    for (const s of ['c3.explore.bar', 'c3.stealth.yard', 'c3.explore.office', 'c3.puzzle.crates', 'c3.explore.bayoffice'] as const) expect(run.isComplete(s), s).toBe(true);
    expect(run.isComplete('c3.fight.bay')).toBe(false);
    const fight = run.fight('c3.fight.bay');
    expect(fight?.active).toBe(false);
    expect(fight?.aliveActors()).toHaveLength(0);
    const have = run.snapshot().casebook;
    const ids = JSON.stringify(have);
    for (const c of ['c3.clue.map', 'c3.clue.brochure', 'c3.clue.manifest']) expect(ids).toContain(c);
    expect(run.player.kit.moves).toContain('sameAgain');
    expect(holds(run.player.kit, 'whiskey')).toBe(true);
    // The office: cabinet still open, the way to the bay still unlocked.
    await enter(run, 'c3.office', OFFICE_ARRIVAL);
    expect(run.dressing.prop('office.cabinet')?.frame).toBe(PROP.filingCabinet.open);
    const exit = run.screenLayout.exits.find((e) => e.id === 'c3.office.bay')!;
    run.setPlayerPosition({ x: exit.area.x + 8, y: exit.area.y + 8 });
    run.tick(16, NO_INPUT);
    await settle(run);
    expect(run.screenId).toBe('c3.bay');
  });

  it('a stealth section under way puts its guards back on their routes', async () => {
    const { run } = await newGame();
    run.setPlayerPosition({ x: 14 * 16 + 8, y: 20 * 16 + 8 });
    await settle(run, 40);
    const guards = run.guardsHere();
    expect(guards).toHaveLength(3);
    const start = guards.map((g) => ({ ...g.pos }));
    for (let i = 0; i < 100; i++) run.tick(16, NO_INPUT);
    expect(run.guardsHere().some((g, i) => g.pos.x !== start[i]!.x || g.pos.y !== start[i]!.y)).toBe(true);
    await toSober(run);
    expect(run.isComplete('c3.stealth.yard')).toBe(false);
    // Not under way any more: no guards about until Andrew steps out again, and then they stand where they began.
    expect(run.guardsHere()).toHaveLength(0);
    expect(run.stealth('c3.stealth.yard')!.alarmRaised).toBe(false);
    run.setPlayerPosition({ x: 14 * 16 + 8, y: 20 * 16 + 8 });
    run.tick(16, NO_INPUT);
    expect(run.guardsHere().map((g) => g.pos)).toEqual(start);
  });

  it('a caught run: the alarm fight is the three guards plus the tuned wave of suits, and a return puts it all back', async () => {
    const { run } = await newGame();
    run.setPlayerPosition({ x: 14 * 16 + 8, y: 20 * 16 + 8 });
    await settle(run, 3);
    run.stealth('c3.stealth.yard')!.alarm();
    run.tick(16, NO_INPUT);
    const fight = run.fight('c3.stealth.yard.alarm' as never);
    const reinforcements = TUNING.fights['c3.stealth.yard.alarm']?.waves[0]?.enemies[0]?.count ?? 0;
    expect(fight?.aliveActors().filter((a) => a.enemyId === 'suit')).toHaveLength(3 + reinforcements);
    await toSober(run);
    expect(run.fight('c3.stealth.yard.alarm' as never)).toBeNull();
    run.setPlayerPosition({ x: 14 * 16 + 8, y: 20 * 16 + 8 });
    run.tick(16, NO_INPUT);
    expect(run.guardsHere()).toHaveLength(3);
    expect(run.isComplete('c3.stealth.yard')).toBe(false);
  });

  // BUG (level-builder, src/chapters/03/script.ts takeManifest ~l.240 and onBarReturn ~l.305): the night shift is started only by
  // the first E on the manifest ("if (flag('manifest.found')) return"). A return to the bar mid-fight resets the fight but nothing
  // starts it again, and the board stays shut until it is won, so the chapter cannot be finished (the Myko call has no section).
  it('a return mid night shift: walking back into the bay starts the night shift again (BUG: it never restarts, the board stays shut)', async () => {
    const { run } = await duringNightShift();
    await toSober(run);
    await enter(run, 'c3.office', OFFICE_ARRIVAL);
    await enter(run, 'c3.bay', BAY_ARRIVAL);
    await settle(run, 20);
    expect(run.fight('c3.fight.bay')?.active).toBe(true);
    expect(run.fight('c3.fight.bay')?.aliveActors()).toHaveLength(6);
  });

  // BUG (level-builder, src/chapters/03/script.ts: the 'lights.on' flag is set after the manifest scene and is not saved before the
  // fight): after a return the bay is dark again until the night shift is won.
  it('a return after the manifest: the bay lights stay on (BUG: dark again)', async () => {
    const { run } = await duringNightShift();
    await toSober(run);
    await enter(run, 'c3.office', OFFICE_ARRIVAL);
    await enter(run, 'c3.bay', BAY_ARRIVAL);
    expect(run.ambient()?.strength).toBeLessThan(0.3);
  });

  // BUG (level-builder, src/chapters/03/script.ts hallorannArrives ~l.283): 'halloran.started' is saved true and never cleared on a
  // return, so stepping back into the boss area never starts the fight again.
  it('a return mid-Halloran: stepping into the boss area starts him again (BUG: flag halloran.started blocks it)', async () => {
    const { run } = await duringNightShift();
    for (const a of run.fight('c3.fight.bay')!.aliveActors()) run.defeat(a, 'player');
    await settle(run, 8);
    run.addEvidence(ev('c2.clue.fragment'));
    run.submitDeduction('c3.deduction.boston', [ev('c3.clue.map'), ev('c3.clue.manifest'), ev('c2.clue.fragment')]);
    await settle(run, 4);
    run.setPlayerPosition(mid(BOSS_AREA));
    await settle(run, 10);
    expect(run.boss('c3.boss.halloran')?.active).toBe(true);
    await toSober(run);
    await enter(run, 'c3.office', OFFICE_ARRIVAL);
    await enter(run, 'c3.bay', BAY_ARRIVAL);
    run.setPlayerPosition(mid(BOSS_AREA));
    await settle(run, 12);
    expect(run.boss('c3.boss.halloran')?.active).toBe(true);
  });

  it('a return after the board is solved keeps the lead and the boss waits at the doors', async () => {
    const { run } = await duringNightShift();
    for (const a of run.fight('c3.fight.bay')!.aliveActors()) run.defeat(a, 'player');
    await settle(run, 8);
    run.addEvidence(ev('c2.clue.fragment'));
    expect(run.submitDeduction('c3.deduction.boston', [ev('c3.clue.map'), ev('c3.clue.manifest'), ev('c2.clue.fragment')])).toBe(true);
    await settle(run, 4);
    await toSober(run);
    expect(run.isComplete('c3.deduction.boston')).toBe(true);
    expect(run.isComplete('c3.fight.bay')).toBe(true);
    expect(run.objective()).toBe('c3.halloran');
    await enter(run, 'c3.office', OFFICE_ARRIVAL);
    await enter(run, 'c3.bay', BAY_ARRIVAL);
    run.setPlayerPosition(mid(DOORS_AREA));
    await settle(run, 8);
    expect(run.player.kit.moves).toContain('oneForTheRoad');
  });
});

describe('chapter 3: save and load mid-chapter', () => {
  it('a load puts Andrew in the club with the finished work kept and the open cabinet, unlocked door and clues in place', async () => {
    const a = await newGame();
    await crossYard(a.run);
    await openOffice(a.run);
    a.run.learnMove('oneForTheRoad'); // a move gained writes a save
    const saved = a.store.load();
    expect(saved?.completedSectionIds).toEqual(expect.arrayContaining(['c3.explore.bar', 'c3.stealth.yard', 'c3.explore.office']));
    const b = await newGame('continue', a.store);
    const { run } = b;
    expect(run.screenId).toBe('c3.yard');
    expect(run.player.pos).toEqual(BAR_ARRIVAL);
    expect(run.isComplete('c3.explore.office')).toBe(true);
    expect(run.isComplete('c3.stealth.yard')).toBe(true);
    expect(run.guardsHere()).toHaveLength(0);
    expect(run.player.kit.moves).toEqual(expect.arrayContaining(['sameAgain', 'oneForTheRoad']));
    expect(run.hotDrinkOffered()).toBe(true);
    expect(run.player.kit.bottles).toBeGreaterThanOrEqual(TUNING.overhaul!.carry.minBottlesOnLeavingBar);
    await enter(run, 'c3.office', OFFICE_ARRIVAL);
    expect(run.dressing.prop('office.cabinet')?.frame).toBe(PROP.filingCabinet.open);
    const exit = run.screenLayout.exits.find((e) => e.id === 'c3.office.bay')!;
    run.setPlayerPosition({ x: exit.area.x + 8, y: exit.area.y + 8 });
    run.tick(16, NO_INPUT);
    await settle(run);
    expect(run.screenId).toBe('c3.bay');
    expect(run.objective()).toBe('c3.crates');
  });

  it('a half-finished crate puzzle goes back to the start on a load', async () => {
    const a = await newGame();
    await enter(a.run, 'c3.bay', BAY_ARRIVAL);
    const puzzle = a.run.pushPuzzlesHere()[0]!.puzzle;
    const start = puzzle.piecePositions().map((p) => `${p.col},${p.row}`);
    expect(puzzle.push({ col: 8, row: 10 }, 'right')).toBe(true); // the bottom-right crate, one to the right
    expect(puzzle.piecePositions().map((p) => `${p.col},${p.row}`)).not.toEqual(start);
    a.run.learnMove('oneForTheRoad');
    const b = await newGame('continue', a.store);
    await enter(b.run, 'c3.bay', BAY_ARRIVAL);
    expect(b.run.pushPuzzlesHere()[0]!.puzzle.piecePositions().map((p) => `${p.col},${p.row}`)).toEqual(start);
  });
});

describe('chapter 3: Myko\'s call-in on each callable section', () => {
  async function finishCall(run: Awaited<ReturnType<typeof newGame>>['run']): Promise<void> {
    for (let i = 0; i < 400; i++) {
      run.tick(50, NO_INPUT);
      if (i % 20 === 0) await settleDialogue(run);
    }
    await settleDialogue(run);
  }
  const callable = (id: string) => chapter3Def().sections.find((s) => s.id === id)?.mykoCallable;

  it('the spec lists exactly the puzzle, the fight, the board and Halloran as callable', () => {
    const ids = chapter3Def().sections.filter((s) => s.mykoCallable).map((s) => s.id);
    expect(ids.sort()).toEqual(['c3.boss.halloran', 'c3.deduction.boston', 'c3.fight.bay', 'c3.puzzle.crates']);
    expect(callable('c3.stealth.yard')).toBe(false);
  });

  it('the night shift: the call clears it and plays c3.call.fight', async () => {
    const { run } = await (async () => {
      const g = await newGame();
      await toBayPuzzleSolved(g.run);
      examine(g.run, 'c3.manifest');
      await settle(g.run, 8);
      return g;
    })();
    const shown = record(run.bus, 'dialogue:show');
    const started = record(run.bus, 'myko:callStarted');
    expect(run.myko.tryCall()).toBe(true);
    expect(started[0]).toMatchObject({ sectionId: 'c3.fight.bay', kind: 'fight' });
    await finishCall(run);
    expect(run.isComplete('c3.fight.bay')).toBe(true);
    expect(shown.map((s) => s.sequenceId)).toContain('c3.call.fight');
    expect(run.callsRemaining()).toBe(TUNING.myko.callsPerGame - 1);
    // The board follows, as it does after a won fight.
    expect(run.flag('board.started')).toBe(true);
  });

  it('the board: opened, the call solves it and plays the puzzle call line (deduction uses the puzzle set)', async () => {
    const g = await newGame();
    await toBayPuzzleSolved(g.run);
    examine(g.run, 'c3.manifest');
    await settle(g.run, 8);
    for (const a of g.run.fight('c3.fight.bay')!.aliveActors()) g.run.defeat(a, 'player');
    await settle(g.run, 8);
    expect(g.run.activeDeduction()?.isOpen).toBe(true);
    const started = record(g.run.bus, 'myko:callStarted');
    expect(g.run.myko.tryCall()).toBe(true);
    expect(started[0]?.sectionId).toBe('c3.deduction.boston');
    await finishCall(g.run);
    expect(g.run.isComplete('c3.deduction.boston')).toBe(true);
  });

  it('Halloran: the call ends the fight, then the clipboard and the closing follow and the chapter completes', async () => {
    const g = await newGame();
    await toBayPuzzleSolved(g.run);
    g.run.startSection('c3.boss.halloran');
    await settle(g.run, 4);
    const ended = record(g.run.bus, 'chapter:completed');
    const shown = record(g.run.bus, 'dialogue:show');
    expect(g.run.myko.tryCall()).toBe(true);
    await finishCall(g.run);
    expect(g.run.isComplete('c3.boss.halloran')).toBe(true);
    expect(g.run.player.kit.weapons).toContain('clipboard');
    expect(shown.map((s) => s.sequenceId)).toContain('c3.closing');
    expect(ended).toHaveLength(1);
  });

  // BUG (level-builder, src/chapters/03/script.ts enteredBay ~l.215): nothing ever starts c3.puzzle.crates as a section (chapter 1
  // does it in enteredYard with ctx.startSection), and a push does not make it the current section, so M answers "noSection" and the
  // crate puzzle, listed as callable, can never be called in. Chapter 4 has the same gap for c4.puzzle.containers.
  it('the crate puzzle: M in the bay calls it in (BUG: refused, no current section)', async () => {
    const { run } = await newGame();
    await enter(run, 'c3.bay', BAY_ARRIVAL);
    expect(run.myko.tryCall()).toBe(true);
  });

  it('M is refused during the stealth yard while uncaught (stealth is not callable)', async () => {
    const { run } = await newGame();
    const refused = record(run.bus, 'myko:callRefused');
    run.setPlayerPosition({ x: 14 * 16 + 8, y: 20 * 16 + 8 });
    await settle(run, 3);
    expect(run.guardsHere()).toHaveLength(3);
    expect(run.myko.tryCall()).toBe(false);
    expect(refused).toHaveLength(1);
  });
});

import { chapter3 } from '../../src/chapters/03/index';
function chapter3Def() {
  return chapter3.def;
}
