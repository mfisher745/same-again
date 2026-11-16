/**
 * Chapter 3 beats, in order, through the real triggers: the social club, the yard, the office clues, Same Again and the
 * cabinet, the crate puzzle, the manifest, the night shift, the board, One for the Road, Halloran and the closing.
 */

import { describe, expect, it } from 'vitest';
import { BAR_ARRIVAL, BAY_ARRIVAL, BOSS_AREA, DOORS_AREA, GANTRY_ZONE, OFFICE_ARRIVAL, YARD_EXIT_AREA, YARD_START_AREA } from '../../src/chapters/03/maps';
import type { EvidenceId } from '../../src/core/types';
import { holds } from '../../src/systems/kit';
import { frame, placeAt, record } from './helpers';
import { px } from './reach';
import { enter, examine, mid, newGame, settle } from './chapter3-steps';

const ev = (id: string): EvidenceId => id as EvidenceId;

describe('chapter 3 beats in order', () => {
  it('the opening: the social club, then the yard begins when Andrew steps out and the bar section completes', async () => {
    const g = await newGame();
    const shown = record(g.run.bus, 'dialogue:show');
    expect(g.run.objective()).toBe('c3.yard');
    expect(g.run.isComplete('c3.explore.bar')).toBe(false);
    expect(g.run.player.pos).toEqual(BAR_ARRIVAL);
    const done = record(g.run.bus, 'section:completed');
    const started = record(g.run.bus, 'section:started');
    g.run.setPlayerPosition(mid(YARD_START_AREA));
    await settle(g.run);
    expect(done.map((d) => d.sectionId)).toContain('c3.explore.bar');
    expect(started.map((s) => s.sectionId)).toContain('c3.stealth.yard');
    expect(shown.map((s) => s.sequenceId)).toContain('c3.open');
  });

  it('a clean yard run completes the stealth section, shows the logbook and gives the logbook clue', async () => {
    const g = await newGame();
    const found = record(g.run.bus, 'evidence:found');
    const clean = record(g.run.bus, 'stealth:cleanRun');
    g.run.setPlayerPosition(mid(YARD_START_AREA));
    await settle(g.run);
    g.run.setPlayerPosition(mid(YARD_EXIT_AREA));
    await settle(g.run);
    expect(clean).toHaveLength(1);
    expect(g.run.isComplete('c3.stealth.yard')).toBe(true);
    expect(found.map((f) => f.evidenceId)).toContain('c3.clue.logbook');
    expect(g.run.dressing.prop('yard.logbook')?.visible).toBe(true);
  });

  it('the whole chapter, in order, by the triggers and the examinables', async () => {
    const g = await newGame();
    const { run } = g;
    const order: string[] = [];
    run.bus.on('section:completed', ({ sectionId }) => void order.push(sectionId));
    const shown = record(run.bus, 'dialogue:show');
    const said = (id: string) => shown.some((s) => s.sequenceId === id);
    const evidence = record(run.bus, 'evidence:found');
    const learned = record(run.bus, 'move:learned');

    // The yard.
    run.setPlayerPosition(mid(YARD_START_AREA));
    await settle(run);
    run.setPlayerPosition(mid(YARD_EXIT_AREA));
    await settle(run);

    // The office: entering says so, the colour clues do not unlock the door, the key two and the cabinet do.
    await enter(run, 'c3.office', OFFICE_ARRIVAL);
    expect(said('c3.office.enter')).toBe(true);
    expect(run.objective()).toBe('c3.office');
    examine(run, 'c3.certificate');
    examine(run, 'c3.visitors');
    await settle(run);
    expect(run.isComplete('c3.explore.office')).toBe(false);
    examine(run, 'c3.map');
    await settle(run);
    expect(run.objective()).toBe('c3.office'); // the brochure is still to find
    examine(run, 'c3.brochure');
    await settle(run);
    expect(run.objective()).toBe('c3.cabinet');
    expect(run.isComplete('c3.explore.office')).toBe(false); // the cabinet is part of it
    expect(evidence.map((e) => e.evidenceId)).toEqual(expect.arrayContaining(['c3.clue.map', 'c3.clue.brochure', 'c3.clue.certificate', 'c3.clue.visitors']));

    // Same Again: the first swing dents it and Myko explains; with the move on, the next opens it.
    const swing = async () => {
      placeAt(run, 28, 4);
      run.tick(16, frame({ pressed: ['melee'], aim: px(28, 3) }));
      await settle(run, 30);
    };
    await swing();
    expect(said('c3.sameAgain.lesson')).toBe(true);
    expect(learned.map((l) => l.moveId)).toContain('sameAgain');
    expect(run.flag('cabinet.open')).not.toBe(true);
    await swing(); // not armed: nothing more
    expect(run.flag('cabinet.open')).not.toBe(true);
    // Slot 2 already holds Stout Slam: Same Again is learned as the second move for it and goes in by hand (the Tab).
    expect(run.player.kit.moves).toContain('sameAgain');
    expect(run.player.kit.slots.specials[1]).toBe('stoutSlam');
    expect(run.assignMove(2, 'sameAgain')).toBe(true);
    run.tick(16, frame({ pressed: ['special2'], aim: px(28, 3) }));
    await swing();
    expect(run.flag('cabinet.open')).toBe(true);
    expect(said('c3.sameAgain.done')).toBe(true);
    expect(run.isComplete('c3.explore.office')).toBe(true);
    expect(run.objective()).toBe('c3.crates');
    // The whiskey filed under W is on the floor in front of it (Andrew is standing there, so he has it).
    expect(run.flag('whiskey.taken')).toBe(true);
    expect(holds(run.player.kit, 'whiskey')).toBe(true);

    // The bay: the crates, then the manifest, then the night shift.
    await enter(run, 'c3.bay', BAY_ARRIVAL);
    expect(said('c3.crates.intro')).toBe(true);
    expect(run.isComplete('c3.puzzle.crates')).toBe(false);
    expect(run.flag('manifest.found')).not.toBe(true);
    run.completeSection('c3.puzzle.crates', 'player');
    await settle(run);
    expect(said('c3.crates.done')).toBe(true);
    expect(run.objective()).toBe('c3.manifest');
    examine(run, 'c3.manifest');
    await settle(run, 8);
    expect(said('c3.manifest.found')).toBe(true);
    expect(said('c3.bay.intro')).toBe(true);
    expect(run.isComplete('c3.explore.bayoffice')).toBe(true);
    expect(evidence.map((e) => e.evidenceId)).toContain('c3.clue.manifest');
    const fight = run.fight('c3.fight.bay');
    expect(fight?.active).toBe(true);
    // Four workers on the gantry, two lads in hi-vis.
    const alive = fight!.aliveActors();
    expect(alive.filter((a) => a.enemyId === 'worker')).toHaveLength(4);
    expect(alive.filter((a) => a.enemyId === 'lad')).toHaveLength(2);
    for (const w of alive.filter((a) => a.enemyId === 'worker')) {
      expect(w.pos.y).toBeGreaterThanOrEqual(GANTRY_ZONE.y);
      expect(w.pos.y).toBeLessThanOrEqual(GANTRY_ZONE.y + GANTRY_ZONE.height);
    }
    // The board is shut while the night shift stands.
    examine(run, 'c3.board');
    expect(run.activeDeduction()?.isOpen ?? false).toBe(false);
    for (const a of fight!.aliveActors()) run.defeat(a, 'player');
    await settle(run, 8);
    expect(run.isComplete('c3.fight.bay')).toBe(true);
    expect(said('c3.bay.end')).toBe(true);
    expect(said('c3.board.tutorial')).toBe(true);

    // The board. Chapter 2's fragment comes with a real playthrough (only chapter 3 is registered here, so Chapter Select seeds none).
    run.addEvidence(ev('c2.clue.fragment'));
    // A wrong answer gets a remark, the right one names the lead.
    const board = run.activeDeduction();
    expect(board?.isOpen).toBe(true);
    expect(run.submitDeduction('c3.deduction.boston', [ev('c3.clue.brochure'), ev('c3.clue.manifest'), ev('c2.clue.fragment')])).toBe(false);
    await settle(run, 3);
    expect(['c3.board.wrong.1', 'c3.board.wrong.2', 'c3.board.wrong.3'].some(said)).toBe(true);
    expect(run.isComplete('c3.deduction.boston')).toBe(false);
    expect(run.submitDeduction('c3.deduction.boston', [ev('c3.clue.map'), ev('c3.clue.manifest'), ev('c2.clue.fragment')])).toBe(true);
    await settle(run, 3);
    expect(run.isComplete('c3.deduction.boston')).toBe(true);
    expect(said('c3.board.right')).toBe(true);
    expect(run.objective()).toBe('c3.halloran');

    // One for the Road at the doors, then Halloran in the bay.
    expect(learned.map((l) => l.moveId)).not.toContain('oneForTheRoad');
    run.setPlayerPosition(mid(DOORS_AREA));
    await settle(run, 6);
    expect(said('c3.oneForTheRoad.lesson')).toBe(true);
    expect(learned.map((l) => l.moveId)).toContain('oneForTheRoad');
    expect(run.player.kit.slots.specials[3]).toBe('oneForTheRoad');
    expect(run.boss('c3.boss.halloran')?.active).toBe(false);
    run.setPlayerPosition(mid(BOSS_AREA));
    await settle(run, 8);
    expect(said('c3.halloran.intro')).toBe(true);
    const boss = run.boss('c3.boss.halloran')!;
    expect(boss.active).toBe(true);
    // The lesson is told once, not again at the boss.
    expect(shown.filter((s) => s.sequenceId === 'c3.oneForTheRoad.lesson')).toHaveLength(1);

    // Beat him: the clipboard, then the closing, then the chapter is done.
    const ended = record(run.bus, 'chapter:completed');
    const body = boss.body('halloran')!;
    body.takeHit({ source: { kind: 'player', abilityId: 'punchCombo' }, targetInstanceId: 'x', amount: 9999, knockback: { x: 0, y: 0 }, stunMs: 0, holdMs: 0 }, { x: body.pos.x - 30, y: body.pos.y });
    await settle(run, 20);
    expect(boss.isComplete()).toBe(true);
    expect(said('c3.halloran.end')).toBe(true);
    expect(run.player.kit.weapons).toContain('clipboard');
    expect(said('c3.weapon.clipboard')).toBe(true);
    expect(said('c3.closing')).toBe(true);
    expect(ended).toHaveLength(1);
    expect(run.dialogue.missing.size).toBe(0);

    // The order the sections finished in is the spec's.
    const want = ['c3.explore.bar', 'c3.stealth.yard', 'c3.explore.office', 'c3.puzzle.crates', 'c3.explore.bayoffice', 'c3.fight.bay', 'c3.deduction.boston', 'c3.boss.halloran'];
    expect(order.filter((s) => want.includes(s))).toEqual(want);
  });
});
