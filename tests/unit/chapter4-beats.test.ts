/**
 * Chapter 4 beats, in order, through the real triggers: the bar and its four patrons, Bedside Manner, the brawl, the docks
 * stealth and the side gate, the container puzzle (six pulls), the container, the board, the foreman and the closing.
 */

import { describe, expect, it } from 'vitest';
import { chapter4 } from '../../src/chapters/04/index';
import { BAR_ARRIVAL, CONTAINER_INSIDE, FOREMAN_TRIGGER, GATE, RAILS, SHILLELAGH_SPOT, STEALTH_START, T, tilesArea } from '../../src/chapters/04/maps';
import type { EvidenceId } from '../../src/core/types';
import { frame, placeAt, record } from './helpers';
import { crossDocks, examine, mid, newGame, settle, solveContainers, startBrawl, talkToTheBar, toDocks, winBrawl } from './chapter4-steps';

const ev = (id: string): EvidenceId => id as EvidenceId;

/** Pulls a lever with the real E, standing south of it, and lets the slide finish. */
async function pull(run: Awaited<ReturnType<typeof newGame>>['run'], railIndex: number): Promise<void> {
  const r = RAILS[railIndex]!;
  placeAt(run, r.leverTile.col, r.leverTile.row + 1);
  run.tick(16, frame({ pressed: ['interact'] }));
  await settle(run, 40);
}

describe('chapter 4: the bar', () => {
  it('opens on the stool, Colleen-Ann pours, the objective is the bar; the section is done when all four have spoken and the roster is read', async () => {
    const { run } = await newGame();
    const shown = record(run.bus, 'dialogue:show');
    expect(run.player.pos).toEqual(BAR_ARRIVAL);
    expect(run.objective()).toBe('c4.bar');
    // Colour first: the stout (a clue), Colleen's help, the tea.
    examine(run, 'c4.stout');
    examine(run, 'c4.colleen');
    await settle(run, 4);
    expect(run.isComplete('c4.explore.bar')).toBe(false);
    for (const who of ['doug', 'barb', 'kev']) examine(run, `c4.${who}`);
    await settle(run, 6);
    examine(run, 'c4.roster');
    await settle(run, 3);
    expect(run.isComplete('c4.explore.bar')).toBe(false); // Sully is still to talk to
    examine(run, 'c4.sully');
    await settle(run, 4);
    expect(run.isComplete('c4.explore.bar')).toBe(true);
    expect(run.objective()).toBe('c4.manner');
    const ids = JSON.stringify(run.snapshot().casebook);
    for (const c of ['c4.clue.roster', 'c4.clue.patch', 'c4.clue.stout']) expect(ids).toContain(c);
    expect(shown.map((s) => s.sequenceId)).toEqual(expect.arrayContaining(['c4.bar.doug', 'c4.bar.barb', 'c4.bar.kev', 'c4.bar.sully', 'c4.bar.stout', 'c4.bar.colleenHelp']));
  });

  it('the tea: asked once (c4.bar.tea), always hot, one free; then c4.tea.held and c4.tea.spent, each once at a time', async () => {
    const { run } = await newGame();
    const shown = record(run.bus, 'dialogue:show');
    expect(run.dressing.prop('bar.steam')?.visible).toBe(true);
    examine(run, 'c4.tea');
    await settle(run, 6);
    expect(shown.map((s) => s.sequenceId)).toEqual(expect.arrayContaining(['c4.bar.tea', 'c4.bar.hotDrink']));
    expect(run.player.kit.hotDrink).toBe('tea');
    expect(run.hotDrinkOffered()).toBe(false);
    expect(run.dressing.prop('bar.steam')?.visible).toBe(false);
    // Holding one: "one at a time", however often E is pressed.
    for (let i = 0; i < 8; i++) examine(run, 'c4.tea');
    await settle(run, 6);
    expect(shown.filter((s) => s.sequenceId === 'c4.tea.held')).toHaveLength(1);
    expect(shown.filter((s) => s.sequenceId === 'c4.tea.spent')).toHaveLength(0);
    examine(run, 'c4.tea');
    await settle(run, 6);
    expect(shown.filter((s) => s.sequenceId === 'c4.tea.held')).toHaveLength(2); // once at a time, not once ever
    // Drunk: the next ask says that was her one.
    run.selectItem('tea');
    expect(run.useSelected()).toBe(true);
    await settle(run, 6);
    for (let i = 0; i < 8; i++) examine(run, 'c4.tea');
    await settle(run, 6);
    expect(shown.filter((s) => s.sequenceId === 'c4.tea.spent')).toHaveLength(1);
    // And she pours it again after a return.
    run.holdDrain(false); // the bar holds the drain until the brawl; this is about the tea after a return
    run.player.meter = { ...run.player.meter, value: 0.01, tea: null };
    for (let i = 0; i < 12; i++) run.tick(16, frame());
    run.completeBarReturn();
    await settle(run, 4);
    expect(run.hotDrinkOffered()).toBe(true);
  });

  it('the pickups on the bar: the first light beer carries the DESIGN.md pickup text, the IPA comes with Myko\'s opinion', async () => {
    const { run } = await newGame();
    const shown = record(run.bus, 'dialogue:show');
    placeAt(run, 2, 9);
    run.tick(16, frame());
    await settle(run, 3);
    expect(run.player.kit.drinks.lightBeer).toBe(1);
    expect(shown.map((s) => s.sequenceId)).toContain('c4.lightBeer');
    placeAt(run, 23, 6);
    run.tick(16, frame());
    await settle(run, 3);
    expect(run.player.kit.drinks.craftIpa).toBe(1);
    expect(shown.map((s) => s.sequenceId)).toContain('c4.bar.ipa');
  });
});

describe('chapter 4: Bedside Manner and the brawl', () => {
  it('the lesson plays only once the four have talked and the roster is read; the move is learned; used near Kev it starts the brawl', async () => {
    const { run } = await newGame();
    const shown = record(run.bus, 'dialogue:show');
    const learned = record(run.bus, 'move:learned');
    run.setPlayerPosition(mid(tilesArea(16, 12, 8, 3)));
    await settle(run, 4);
    expect(shown.map((s) => s.sequenceId)).not.toContain('c4.manner.lesson'); // too early
    run.setPlayerPosition(T(5, 6)); // and out again: the lesson comes on stepping in once they have all spoken
    await settle(run, 3);
    await startBrawl(run);
    expect(shown.map((s) => s.sequenceId)).toEqual(expect.arrayContaining(['c4.manner.lesson', 'c4.manner.done']));
    expect(shown.filter((s) => s.sequenceId === 'c4.manner.lesson')).toHaveLength(1);
    expect(learned.map((l) => l.moveId)).toContain('bedsideManner');
    expect(run.fight('c4.fight.brawl')?.active).toBe(true);
    expect(run.objective()).toBe('c4.brawl');
  });

  it('Bedside Manner away from Kev does not start the brawl', async () => {
    const { run } = await newGame();
    await talkToTheBar(run);
    run.setPlayerPosition(mid(tilesArea(16, 12, 8, 3)));
    await settle(run, 6);
    run.assignMove(2, 'bedsideManner');
    run.setPlayerPosition(T(35, 4));
    run.tick(16, frame({ pressed: ['special2'], aim: T(34, 4) }));
    await settle(run, 6);
    expect(run.fight('c4.fight.brawl')?.active).not.toBe(true);
    expect(run.flag('manner.done')).not.toBe(true);
  });

  it('six brawlers in three waves of two; Colleen-Ann throws a stout between waves; the end line and the open back door follow', async () => {
    const { run } = await newGame();
    const shown = record(run.bus, 'dialogue:show');
    const found = record(run.bus, 'pickup:collected');
    await startBrawl(run);
    const fight = run.fight('c4.fight.brawl')!;
    const seen = new Set<string>();
    for (let i = 0; i < 60 && !fight.isComplete(); i++) {
      const alive = fight.aliveActors();
      for (const a of alive) seen.add(a.instanceId);
      expect(alive.every((a) => a.enemyId === 'brawler')).toBe(true);
      for (const a of alive) run.defeat(a, 'player');
      await settle(run, 10);
    }
    expect(fight.isComplete()).toBe(true);
    expect(seen.size).toBe(6);
    const ids = shown.map((s) => s.sequenceId);
    expect(ids).toEqual(expect.arrayContaining(['c4.brawl.wave2', 'c4.brawl.wave3', 'c4.brawl.end']));
    expect(found.filter((f) => f.pickupId.startsWith('reward.c4.brawl.stout'))).toHaveLength(2);
    expect(run.objective()).toBe('c4.docks');
  });
});

describe('chapter 4: the docks', () => {
  it('the side gate is shut with Myko saying so on each approach, and stays open once the stealth is passed (clean or not)', async () => {
    const { run } = await newGame();
    await startBrawl(run);
    await winBrawl(run);
    await toDocks(run);
    const shown = record(run.bus, 'dialogue:show');
    const gate = tilesArea(GATE.col - 2, GATE.row, 2, GATE.height);
    expect(run.dressing.prop('dockGate')?.visible).toBe(true);
    run.setPlayerPosition(mid(gate));
    await settle(run, 3);
    expect(shown.filter((s) => s.sequenceId === 'c4.gate.shut')).toHaveLength(1);
    // Walk away and back: it says it again (each approach), but not while he stands there.
    run.setPlayerPosition(T(3, 10));
    await settle(run, 3);
    run.setPlayerPosition(mid(gate));
    await settle(run, 3);
    expect(shown.filter((s) => s.sequenceId === 'c4.gate.shut').length).toBeGreaterThanOrEqual(2);
    // A caught run still opens it: pass the section the way an alarm fight does (resolved).
    run.completeSection('c4.stealth.docks', 'player');
    await settle(run, 3);
    expect(run.dressing.prop('dockGate')?.visible).toBe(false);
    const before = shown.filter((s) => s.sequenceId === 'c4.gate.shut').length;
    run.setPlayerPosition(T(3, 10));
    await settle(run, 3);
    run.setPlayerPosition(mid(gate));
    await settle(run, 3);
    expect(shown.filter((s) => s.sequenceId === 'c4.gate.shut')).toHaveLength(before); // open: nothing to say
    // And it stays open through a return to the bar, a reload of the screen and a load.
    run.player.meter = { ...run.player.meter, value: 0.01 };
    for (let i = 0; i < 12; i++) run.tick(16, frame());
    run.completeBarReturn();
    await settle(run, 4);
    await toDocks(run);
    expect(run.dressing.prop('dockGate')?.visible).toBe(false);
  });

  it('a clean run leaves a whiskey in the lunchbox on the bollard; picking it up takes the box off it', async () => {
    const { run } = await newGame();
    await toDocks(run);
    const found = record(run.bus, 'pickup:collected');
    await crossDocks(run);
    expect(run.isComplete('c4.stealth.docks')).toBe(true);
    expect(run.flag('docks.clean')).toBe(true);
    placeAt(run, 41, 6);
    run.tick(16, frame());
    await settle(run, 3);
    expect(found.map((f) => f.pickupId)).toContain('c4.pickup.lunchbox');
    expect(run.dressing.prop('lunchbox')?.visible).toBe(false);
    expect(run.player.kit.drinks.whiskey).toBe(1);
  });

  it('a caught run: no lunchbox whiskey, and the section still completes when the alarm fight is won', async () => {
    const { run } = await newGame();
    await toDocks(run);
    run.setPlayerPosition(mid(STEALTH_START));
    await settle(run, 3);
    run.stealth('c4.stealth.docks')!.alarm();
    await settle(run, 3);
    const fight = run.fight('c4.stealth.docks.alarm' as never)!;
    expect(fight.aliveActors().length).toBeGreaterThan(0);
    for (let i = 0; i < 40 && !fight.isComplete(); i++) {
      for (const a of fight.aliveActors()) run.defeat(a, 'player');
      await settle(run, 8);
    }
    expect(fight.isComplete()).toBe(true);
    expect(run.flag('docks.clean')).not.toBe(true);
    expect(run.pickups().some((p) => p.def.id === 'c4.pickup.lunchbox')).toBe(false);
  });
});

describe('chapter 4: the container puzzle needs exactly six pulls', () => {
  async function atPuzzle() {
    const g = await newGame();
    await toDocks(g.run);
    await crossDocks(g.run);
    return g;
  }

  it('the rails\' own arithmetic: no sequence of fewer than six pulls lines the three up (breadth-first over every position)', () => {
    const def = chapter4.slidePuzzles![0]!;
    const start = def.rails.map((r) => r.start);
    const goal = def.rails.map((r) => def.goal[r.id]!);
    const slots = def.rails.map((r) => r.slots);
    const key = (s: number[]) => s.join(',');
    const seen = new Map<string, number>([[key(start), 0]]);
    let frontier = [start];
    let minPulls = -1;
    while (frontier.length > 0 && minPulls < 0) {
      const next: number[][] = [];
      for (const s of frontier) {
        if (key(s) === key(goal)) {
          minPulls = seen.get(key(s))!;
          break;
        }
        s.forEach((_, i) => {
          const n = [...s];
          n[i] = (n[i]! + 1) % slots[i]!;
          if (!seen.has(key(n))) {
            seen.set(key(n), seen.get(key(s))! + 1);
            next.push(n);
          }
        });
      }
      frontier = next;
    }
    expect(minPulls).toBe(6);
  });

  it('in the real run: after every one of five pulls it is not solved; the sixth solves it, and a pull is one E', async () => {
    const { run } = await atPuzzle();
    const pulled = record(run.bus, 'slide:pulled');
    // C once, B three times, A twice (any order of the six works).
    const order = [2, 1, 1, 1, 0, 0];
    for (let i = 0; i < order.length - 1; i++) {
      await pull(run, order[i]!);
      expect(pulled).toHaveLength(i + 1);
      expect(run.isComplete('c4.puzzle.containers')).toBe(false);
    }
    await pull(run, order[5]!);
    expect(pulled).toHaveLength(6);
    expect(run.isComplete('c4.puzzle.containers')).toBe(true);
    // The hatch is open, and a solved puzzle takes no more pulls.
    expect(run.dressing.prop('hatch')?.visible).toBe(false);
    await pull(run, 0);
    expect(pulled).toHaveLength(6);
  });

  it('rapid input: E twice in two ticks is one pull (the piece is still sliding)', async () => {
    const { run } = await atPuzzle();
    const pulled = record(run.bus, 'slide:pulled');
    const r = RAILS[0];
    placeAt(run, r.leverTile.col, r.leverTile.row + 1);
    run.tick(16, frame({ pressed: ['interact'] }));
    run.tick(16, frame({ pressed: ['interact'] }));
    run.tick(16, frame({ pressed: ['interact'] }));
    expect(pulled).toHaveLength(1);
  });

  it('a pulled lever flips its prop; the wrong ones do not solve it (6 pulls on one rail wraps and goes nowhere)', async () => {
    const { run } = await atPuzzle();
    const before = run.dressing.prop('lever.railA')?.frame;
    await pull(run, 0);
    expect(run.dressing.prop('lever.railA')?.frame).not.toBe(before);
    for (let i = 0; i < 5; i++) await pull(run, 0);
    expect(run.isComplete('c4.puzzle.containers')).toBe(false);
  });

  it('the intro plays at the first approach (once), the inside scene plays when he walks in, once', async () => {
    const { run } = await atPuzzle();
    const shown = record(run.bus, 'dialogue:show');
    run.setPlayerPosition(mid(tilesArea(40, 8, 2, 4)));
    await settle(run, 3);
    run.setPlayerPosition(T(36, 3));
    await settle(run, 3);
    run.setPlayerPosition(mid(tilesArea(40, 8, 2, 4)));
    await settle(run, 3);
    expect(shown.filter((s) => s.sequenceId === 'c4.containers.intro')).toHaveLength(1);
    await solveContainers(run);
    // solveContainers goes through the script, which has no pull; use the real thing.
    for (const [i, n] of [[0, 2], [1, 3], [2, 1]] as const) for (let k = 0; k < n; k++) await pull(run, i);
    expect(run.isComplete('c4.puzzle.containers')).toBe(true);
    expect(shown.map((s) => s.sequenceId)).toContain('c4.containers.done');
    run.setPlayerPosition(mid(CONTAINER_INSIDE));
    await settle(run, 3);
    run.setPlayerPosition(T(40, 3));
    await settle(run, 3);
    run.setPlayerPosition(mid(CONTAINER_INSIDE));
    await settle(run, 3);
    expect(shown.filter((s) => s.sequenceId === 'c4.container.inside')).toHaveLength(1);
  });
});

describe('chapter 4: the whole chapter in order', () => {
  it('bar, Bedside Manner, brawl, docks, puzzle, container, board, foreman, shillelagh, closing', async () => {
    const { run } = await newGame();
    const order: string[] = [];
    run.bus.on('section:completed', ({ sectionId }) => void order.push(sectionId));
    const shown = record(run.bus, 'dialogue:show');
    const said = (id: string) => shown.some((s) => s.sequenceId === id);
    const ended = record(run.bus, 'chapter:completed');

    await startBrawl(run);
    await winBrawl(run);
    expect(run.objective()).toBe('c4.docks');
    await toDocks(run);
    expect(said('c4.docks.open')).toBe(true);
    await crossDocks(run);
    expect(run.objective()).toBe('c4.containers');
    for (const [i, n] of [[0, 2], [1, 3], [2, 1]] as const) for (let k = 0; k < n; k++) await pull(run, i);
    expect(run.isComplete('c4.puzzle.containers')).toBe(true);

    // Inside: the seizure notice (key) opens the board at once; the foam is colour.
    run.setPlayerPosition(mid(CONTAINER_INSIDE));
    await settle(run, 3);
    examine(run, 'c4.foam');
    expect(JSON.stringify(run.snapshot().casebook)).toContain('c4.clue.foam');
    examine(run, 'c4.seizure');
    await settle(run, 3);
    expect(run.isComplete('c4.explore.container')).toBe(true);
    expect(run.activeDeduction()?.isOpen).toBe(true);
    // The board: wrong, then right (chapter 3's manifest is last chapter's clue).
    run.addEvidence(ev('c3.clue.manifest'));
    expect(run.submitDeduction('c4.deduction.dc', [ev('c4.clue.patch'), ev('c4.clue.foam'), ev('c3.clue.manifest')])).toBe(false);
    await settle(run, 3);
    expect(['c4.board.wrong.1', 'c4.board.wrong.2', 'c4.board.wrong.3'].some(said)).toBe(true);
    expect(run.submitDeduction('c4.deduction.dc', [ev('c4.clue.seizure'), ev('c4.clue.roster'), ev('c3.clue.manifest')])).toBe(true);
    await settle(run, 3);
    expect(said('c4.board.right')).toBe(true);
    expect(run.objective()).toBe('c4.foreman');

    // The foreman.
    run.setPlayerPosition(mid(FOREMAN_TRIGGER));
    await settle(run, 8);
    expect(said('c4.foreman.intro')).toBe(true);
    const boss = run.boss('c4.boss.foreman')!;
    expect(boss.active).toBe(true);
    const body = boss.body('foreman')!;
    body.takeHit({ source: { kind: 'player', abilityId: 'punchCombo' }, targetInstanceId: 'x', amount: 9999, knockback: { x: 0, y: 0 }, stunMs: 0, holdMs: 0 }, { x: body.pos.x - 30, y: body.pos.y });
    await settle(run, 10);
    expect(boss.isComplete()).toBe(true);
    expect(said('c4.foreman.end')).toBe(true);
    expect(run.dressing.prop('shillelagh')?.visible).toBe(true);
    expect(ended).toHaveLength(0); // the shillelagh is still to be taken
    run.setPlayerPosition(SHILLELAGH_SPOT);
    examine(run, 'c4.shillelagh');
    await settle(run, 10);
    expect(run.player.kit.weapons).toContain('shillelagh');
    expect(said('c4.weapon.shillelagh')).toBe(true);
    expect(said('c4.closing')).toBe(true);
    expect(ended).toHaveLength(1);
    expect(run.dialogue.missing.size).toBe(0);
    const want = ['c4.explore.bar', 'c4.fight.brawl', 'c4.stealth.docks', 'c4.puzzle.containers', 'c4.explore.container', 'c4.deduction.dc', 'c4.boss.foreman'];
    expect(order.filter((s) => want.includes(s))).toEqual(want);
  });
});
