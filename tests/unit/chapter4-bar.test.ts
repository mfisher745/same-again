/**
 * Chapter 4: Paddy O'Shamrock's, back to the bar (DESIGN.md 7.1, docs/chapters/README.md "What a return to the bar keeps"),
 * save and load mid-chapter, and Myko's call on each callable section.
 */

import { describe, expect, it } from 'vitest';
import { chapter4 } from '../../src/chapters/04/index';
import { BAR_ARRIVAL, CONTAINER_INSIDE, FOREMAN_TRIGGER, RAILS, STEALTH_START, T, tilesArea } from '../../src/chapters/04/maps';
import { TUNING } from '../../src/content/tuning';
import type { EvidenceId } from '../../src/core/types';
import { holds } from '../../src/systems/kit';
import { levelTable, restValue } from '../../src/systems/meter';
import { NO_INPUT, drinkItem, frame, placeAt, record, settleDialogue } from './helpers';
import { crossDocks, enter, examine, mid, newGame, settle, startBrawl, talkToTheBar, toDocks, winBrawl } from './chapter4-steps';

const ev = (id: string): EvidenceId => id as EvidenceId;
type Run = Awaited<ReturnType<typeof newGame>>['run'];

async function toSober(run: Run): Promise<void> {
  run.holdDrain(false); // the bar holds the drain until the brawl (playtest 8); these tests are about the return itself
  run.player.meter = { ...run.player.meter, value: 0.01, tea: null };
  for (let i = 0; i < 12; i++) run.tick(16, NO_INPUT);
  run.completeBarReturn();
  await settle(run, 4);
}

async function pull(run: Run, railIndex: number): Promise<void> {
  const r = RAILS[railIndex]!;
  placeAt(run, r.leverTile.col, r.leverTile.row + 1);
  run.tick(16, frame({ pressed: ['interact'] }));
  await settle(run, 40);
}

async function solvePuzzle(run: Run): Promise<void> {
  for (const [i, n] of [[0, 2], [1, 3], [2, 1]] as const) for (let k = 0; k < n; k++) await pull(run, i);
}

/** Through the brawl and the stealth section with the puzzle still to do. */
async function atContainers() {
  const g = await newGame();
  await startBrawl(g.run);
  await winBrawl(g.run);
  await toDocks(g.run);
  await crossDocks(g.run);
  return g;
}

describe('chapter 4: back to the bar', () => {
  it.each(['sober', 'floor'] as const)('%s: back on the stool with Buzz at the bottom of Grand, the return line, tea on offer again and bottles topped up', async (reason) => {
    const { run } = await newGame();
    await talkToTheBar(run);
    const shown = record(run.bus, 'dialogue:show');
    const returned = record(run.bus, 'bar:returned');
    run.holdDrain(false);
    if (reason === 'sober') run.player.meter = { ...run.player.meter, value: 0.01 };
    else {
      run.give({ kind: 'drink', drinkId: 'stout', count: 1 });
      run.player.meter = { ...run.player.meter, value: levelTable(4).floor - 1 };
      expect(drinkItem(run, 'stout')).toBe(true);
    }
    for (let i = 0; i < 80 && returned.length === 0; i++) {
      run.tick(16, NO_INPUT);
      run.completeBarReturn();
    }
    await settle(run, 4);
    expect(returned.map((r) => r.reason)).toEqual([reason]);
    expect(run.screenId).toBe('c4.bar');
    expect(run.player.pos).toEqual(BAR_ARRIVAL);
    expect(run.player.meter.value).toBeCloseTo(restValue(4), 0);
    expect(shown.map((s) => s.sequenceId)).toContain('c4.bar.return');
    expect(run.hotDrinkOffered()).toBe(true);
    expect(run.player.kit.bottles).toBeGreaterThanOrEqual(TUNING.overhaul!.carry.minBottlesOnLeavingBar);
    // What was done stays done: the patrons and the roster.
    expect(run.flag('manner.ready')).toBe(true);
    expect(run.isComplete('c4.explore.bar')).toBe(true);
  });

  it('a return during the brawl puts it back to before Bedside Manner (Doug and Kev at their table); saying it to Kev again starts it from the first wave', async () => {
    const { run } = await newGame();
    await startBrawl(run);
    const fight = run.fight('c4.fight.brawl')!;
    for (const a of fight.aliveActors()) run.defeat(a, 'player'); // wave one down
    await settle(run, 12);
    expect(fight.active).toBe(true);
    await toSober(run);
    expect(run.isComplete('c4.fight.brawl')).toBe(false);
    expect(run.fight('c4.fight.brawl')?.active).toBe(false);
    expect(run.fight('c4.fight.brawl')?.aliveActors()).toHaveLength(0);
    expect(run.screenId).toBe('c4.bar');
    expect(run.objective()).toBe('c4.manner');
    expect(run.dressing.npc('kev')?.visible).toBe(true);
    // The back door is still shut.
    const exit = run.screenLayout.exits.find((e) => e.id === 'c4.bar.backdoor')!;
    run.setPlayerPosition({ x: exit.area.x + 8, y: exit.area.y + 8 });
    run.tick(16, NO_INPUT);
    expect(run.screenId).toBe('c4.bar');
    // Say it to Kev again (the cooldown from the first time has run out).
    for (let i = 0; i < 1000; i++) {
      run.player.meter = { ...run.player.meter, value: 50 }; // idling would drain him to a second return
      run.tick(16, NO_INPUT);
    }
    const kev = { x: 20 * 16 + 8, y: 12 * 16 + 8 };
    run.setPlayerPosition({ x: kev.x, y: kev.y + 24 });
    run.tick(16, frame({ pressed: ['special2'], aim: kev }));
    await settle(run, 8);
    const again = run.fight('c4.fight.brawl')!;
    expect(again.active).toBe(true);
    expect(again.aliveActors()).toHaveLength(2);
  });

  it('keeps the finished brawl, the open gate, the clean-run whiskey, the learned move, the casebook, and a half-pulled puzzle', async () => {
    const { run } = await atContainers();
    expect(run.flag('docks.clean')).toBe(true);
    await pull(run, 0);
    await toSober(run);
    expect(run.isComplete('c4.fight.brawl')).toBe(true);
    expect(run.isComplete('c4.stealth.docks')).toBe(true);
    expect(run.player.kit.moves).toContain('bedsideManner');
    expect(JSON.stringify(run.snapshot().casebook)).toContain('c4.clue.roster');
    // Out the back door (open now), the gate stays open, the lunchbox whiskey is still to take, and the one pull is still there.
    const exit = run.screenLayout.exits.find((e) => e.id === 'c4.bar.backdoor')!;
    run.setPlayerPosition({ x: exit.area.x + 8, y: exit.area.y + 8 });
    await settle(run);
    expect(run.screenId).toBe('c4.docks');
    expect(run.dressing.prop('dockGate')?.visible).toBe(false);
    expect(run.pickups().some((p) => p.def.id === 'c4.pickup.lunchbox')).toBe(true);
    const puzzle = run.slidePuzzlesHere()[0]!.puzzle;
    expect(puzzle.slotOf('railA')).toBe((RAILS[0].start + 1) % RAILS[0].slots);
  });

  it('a stealth section under way puts its guards back, and a return after it was passed leaves none', async () => {
    const { run } = await newGame();
    await toDocks(run);
    run.setPlayerPosition(mid(STEALTH_START));
    await settle(run, 40);
    const start = run.guardsHere().map((g) => ({ ...g.pos }));
    expect(start).toHaveLength(4);
    for (let i = 0; i < 100; i++) run.tick(16, NO_INPUT);
    expect(run.guardsHere().some((g, i) => g.pos.x !== start[i]!.x || g.pos.y !== start[i]!.y)).toBe(true);
    await toSober(run);
    expect(run.isComplete('c4.stealth.docks')).toBe(false);
    await toDocks(run);
    run.setPlayerPosition(mid(STEALTH_START));
    run.tick(16, NO_INPUT);
    expect(run.guardsHere().map((g) => g.pos)).toEqual(start);
    // Passed (clean): nothing to put back.
    await crossDocks(run);
    await toSober(run);
    expect(run.guardsHere()).toHaveLength(0);
  });

  it('a return after the board keeps the lead; the container stays solved and open', async () => {
    const { run } = await atContainers();
    await solvePuzzle(run);
    expect(run.isComplete('c4.puzzle.containers')).toBe(true);
    run.setPlayerPosition(mid(CONTAINER_INSIDE));
    await settle(run, 3);
    examine(run, 'c4.seizure');
    await settle(run, 3);
    run.addEvidence(ev('c3.clue.manifest'));
    expect(run.submitDeduction('c4.deduction.dc', [ev('c4.clue.seizure'), ev('c4.clue.roster'), ev('c3.clue.manifest')])).toBe(true);
    await settle(run, 3);
    await toSober(run);
    expect(run.isComplete('c4.deduction.dc')).toBe(true);
    expect(run.objective()).toBe('c4.foreman');
    await toDocks(run);
    expect(run.dressing.prop('hatch')?.visible).toBe(false);
  });

  // Fragile by design: 'foreman.started' is never cleared, it just is not saved while the fight runs (nothing saves during it). Any
  // save mid-fight (a clue, a move, a Myko call that is not on the boss) would write it and shut the arena for good.
  it('a return mid-foreman: stepping back into the arena starts him again', async () => {
    const { run } = await atContainers();
    await solvePuzzle(run);
    run.setPlayerPosition(mid(CONTAINER_INSIDE));
    await settle(run, 3);
    examine(run, 'c4.seizure');
    await settle(run, 3);
    run.addEvidence(ev('c3.clue.manifest'));
    run.submitDeduction('c4.deduction.dc', [ev('c4.clue.seizure'), ev('c4.clue.roster'), ev('c3.clue.manifest')]);
    await settle(run, 3);
    run.setPlayerPosition(mid(FOREMAN_TRIGGER));
    await settle(run, 8);
    expect(run.boss('c4.boss.foreman')?.active).toBe(true);
    await toSober(run);
    await toDocks(run);
    run.setPlayerPosition(mid(FOREMAN_TRIGGER));
    await settle(run, 12);
    expect(run.boss('c4.boss.foreman')?.active).toBe(true);
  });
});

describe('chapter 4: save and load mid-chapter', () => {
  it('a load puts Andrew on the stool with the finished work kept, the gate open and the guards gone', async () => {
    const a = await atContainers();
    a.run.learnMove('lastOrders'); // a move not yet known: writes a save
    const b = await newGame('continue', a.store);
    const { run } = b;
    expect(run.screenId).toBe('c4.bar');
    expect(run.player.pos).toEqual(BAR_ARRIVAL);
    expect(run.isComplete('c4.fight.brawl')).toBe(true);
    expect(run.isComplete('c4.stealth.docks')).toBe(true);
    expect(run.hotDrinkOffered()).toBe(true);
    await toDocks(run);
    expect(run.dressing.prop('dockGate')?.visible).toBe(false);
    expect(run.guardsHere()).toHaveLength(0);
    expect(run.pickups().some((p) => p.def.id === 'c4.pickup.lunchbox') || holds(run.player.kit, 'whiskey')).toBe(true);
    expect(run.player.kit.moves).toContain('bedsideManner');
  });

  it('a half-pulled puzzle goes back to the start on a load', async () => {
    const a = await atContainers();
    await pull(a.run, 0);
    await pull(a.run, 1);
    a.run.learnMove('lastOrders'); // a move not yet known: writes a save
    const b = await newGame('continue', a.store);
    await toDocks(b.run);
    const puzzle = b.run.slidePuzzlesHere()[0]!.puzzle;
    for (const r of RAILS) expect(puzzle.slotOf(r.id), r.id).toBe(r.start);
    await solvePuzzle(b.run);
    expect(b.run.isComplete('c4.puzzle.containers')).toBe(true);
  });
});

describe('chapter 4: Myko\'s call-in on each callable section', () => {
  async function finishCall(run: Run): Promise<void> {
    for (let i = 0; i < 400; i++) {
      run.tick(50, NO_INPUT);
      if (i % 20 === 0) await settleDialogue(run);
    }
    await settleDialogue(run);
  }

  it('lists exactly the brawl, the containers, the board and the foreman as callable', () => {
    expect(chapter4.def.sections.filter((s) => s.mykoCallable).map((s) => s.id).sort()).toEqual(['c4.boss.foreman', 'c4.deduction.dc', 'c4.fight.brawl', 'c4.puzzle.containers']);
  });

  it('the brawl: the call finishes it and plays c4.call.fight, and the back door opens', async () => {
    const { run } = await newGame();
    await startBrawl(run);
    const shown = record(run.bus, 'dialogue:show');
    const started = record(run.bus, 'myko:callStarted');
    expect(run.myko.tryCall()).toBe(true);
    expect(started[0]).toMatchObject({ sectionId: 'c4.fight.brawl', kind: 'fight' });
    await finishCall(run);
    expect(run.isComplete('c4.fight.brawl')).toBe(true);
    expect(shown.map((s) => s.sequenceId)).toContain('c4.call.fight');
    expect(run.callsRemaining()).toBe(TUNING.myko.callsPerGame - 1);
    await enter(run, 'c4.bar', BAR_ARRIVAL);
    const exit = run.screenLayout.exits.find((e) => e.id === 'c4.bar.backdoor')!;
    run.setPlayerPosition({ x: exit.area.x + 8, y: exit.area.y + 8 });
    await settle(run);
    expect(run.screenId).toBe('c4.docks');
  });

  it('the board: the call solves it and the foreman is next', async () => {
    const { run } = await atContainers();
    await solvePuzzle(run);
    run.setPlayerPosition(mid(CONTAINER_INSIDE));
    await settle(run, 3);
    examine(run, 'c4.seizure');
    await settle(run, 3);
    expect(run.activeDeduction()?.isOpen).toBe(true);
    const started = record(run.bus, 'myko:callStarted');
    expect(run.myko.tryCall()).toBe(true);
    expect(started[0]?.sectionId).toBe('c4.deduction.dc');
    await finishCall(run);
    expect(run.isComplete('c4.deduction.dc')).toBe(true);
    expect(run.objective()).toBe('c4.foreman');
  });

  it('the foreman: the call ends the fight, the shillelagh is left on the box, and taking it closes the chapter', async () => {
    const { run } = await atContainers();
    await solvePuzzle(run);
    run.startSection('c4.boss.foreman');
    await settle(run, 4);
    expect(run.myko.tryCall()).toBe(true);
    await finishCall(run);
    expect(run.isComplete('c4.boss.foreman')).toBe(true);
    expect(run.dressing.prop('shillelagh')?.visible).toBe(true);
    const ended = record(run.bus, 'chapter:completed');
    run.setPlayerPosition(T(63, 15));
    examine(run, 'c4.shillelagh');
    await settle(run, 10);
    expect(run.player.kit.weapons).toContain('shillelagh');
    expect(ended).toHaveLength(1);
  });

  // BUG (level-builder, src/chapters/04/script.ts: nothing starts c4.puzzle.containers as a section; chapter 1 does it with
  // ctx.startSection in enteredYard): a lever pull does not make it the current section, so M answers "noSection" and the container
  // puzzle, listed as callable, can never be called in. Chapter 3's crate puzzle has the same gap.
  it('the container puzzle: M at the docks (stealth passed) calls it in', async () => {
    const { run } = await atContainers();
    await pull(run, 0);
    expect(run.myko.tryCall()).toBe(true);
  });

  it('M is refused during the docks stealth while uncaught', async () => {
    const { run } = await newGame();
    await toDocks(run);
    const refused = record(run.bus, 'myko:callRefused');
    run.setPlayerPosition(mid(tilesArea(9, 3, 2, 3)));
    await settle(run, 3);
    expect(run.guardsHere()).toHaveLength(4);
    expect(run.myko.tryCall()).toBe(false);
    expect(refused).toHaveLength(1);
  });
});
