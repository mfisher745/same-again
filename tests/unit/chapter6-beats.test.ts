/**
 * Chapter 6 beats, in order, through the real triggers and examinables: the Starlite, Main Street and Dale (Second Opinion), the
 * Ohio rule, the fields, the drone fight, the maze, the centre, the board, the combine and the closing.
 */

import { describe, expect, it } from 'vitest';
import { chapter6 } from '../../src/chapters/06/index';
import { BAR_ARRIVAL, DALE_AREA, MYKO_ICE, TOWN_TO_FIELDS, T } from '../../src/chapters/06/maps';
import { pool } from '../../src/content/dialogue';
import { NO_INPUT, record } from './helpers';
import {
  crossFields,
  doCentre,
  doMotel,
  doTown,
  examine,
  intoYard,
  mid,
  newGame,
  settle,
  solveMaze,
  toFields,
  toTown,
  winDrones,
} from './chapter6-steps';

describe('chapter 6: the Starlite', () => {
  it('opens in the lounge with the title, the open scene, Myko at the ice machine and the coffee on offer', async () => {
    const g = await newGame();
    const { run } = g;
    expect(run.screenId).toBe('c6.motel');
    expect(run.player.pos).toEqual(BAR_ARRIVAL);
    expect(run.objective()).toBe('c6.motel');
    expect(run.hotDrinkOffered()).toBe(true);
    expect(run.dressing.prop('bar.steam')?.visible).toBe(true);
    expect(run.myko.pos).toEqual(MYKO_ICE);
  });

  it('the coffee scene plays once, the section is done and the hot drink is taken; the steam goes with it', async () => {
    const { run } = await newGame();
    const shown = record(run.bus, 'dialogue:show');
    examine(run, 'c6.coffee');
    await settle(run, 6);
    expect(shown.map((s) => s.sequenceId)).toContain('c6.bar.coffee');
    expect(run.isComplete('c6.explore.bar')).toBe(true);
    expect(JSON.stringify(run.snapshot().casebook)).toContain('c6.clue.coffee');
    expect(run.takeHotDrink('coffee')).toBe(true);
    expect(run.dressing.prop('bar.steam')?.visible).toBe(false);
  });

  it('the ledger and the postcard finish the motel and send him to the town', async () => {
    const { run } = await newGame();
    examine(run, 'c6.clue.ledger');
    await settle(run, 6);
    expect(run.isComplete('c6.explore.motel')).toBe(false);
    examine(run, 'c6.clue.postcard');
    await settle(run, 6);
    expect(run.isComplete('c6.explore.motel')).toBe(true);
    expect(run.objective()).toBe('c6.town');
    const book = JSON.stringify(run.snapshot().casebook);
    expect(book).toContain('c6.clue.ledger');
    expect(book).toContain('c6.clue.postcard');
  });

  it('the ice machine: the second look is the "not finished" line', async () => {
    const { run } = await newGame();
    const shown = record(run.bus, 'dialogue:show');
    examine(run, 'c6.ohio.iceMachine');
    await settle(run, 4);
    examine(run, 'c6.ohio.iceMachine');
    await settle(run, 4);
    expect(shown.map((s) => s.sequenceId).filter((s) => s.startsWith('c6.ohio.iceMachine'))).toEqual(['c6.ohio.iceMachine', 'c6.ohio.iceMachine.again']);
  });
});

describe('chapter 6: Main Street and Dale', () => {
  it('the farm track is shut until the motel and the town are done', async () => {
    const { run } = await newGame();
    await toTown(run);
    run.setPlayerPosition(mid(TOWN_TO_FIELDS));
    await settle(run, 3);
    expect(run.screenId).toBe('c6.town');
    await doMotel(run);
    await doTown(run);
    run.setPlayerPosition(mid(TOWN_TO_FIELDS));
    await settle(run, 3);
    expect(run.screenId).toBe('c6.fields');
  });

  it('Dale: looking at his shoulder, the lesson, and Second Opinion goes into the kit; the town section follows the notice', async () => {
    const { run } = await newGame();
    await toTown(run);
    const shown = record(run.bus, 'dialogue:show');
    const learned = record(run.bus, 'move:learned');
    run.setPlayerPosition(mid(DALE_AREA));
    await settle(run, 8);
    expect(shown.map((s) => s.sequenceId)).toEqual(expect.arrayContaining(['c6.dale.shoulder', 'c6.secondOpinion.lesson']));
    expect(learned.map((l) => l.moveId)).toEqual(['secondOpinion']);
    expect(run.player.kit.moves).toContain('secondOpinion');
    expect(run.isComplete('c6.explore.town')).toBe(false);
    examine(run, 'c6.clue.noticeboard');
    await settle(run, 6);
    expect(run.isComplete('c6.explore.town')).toBe(true);
    // Dale's shop is walked into again: nothing plays twice.
    shown.length = 0;
    run.setPlayerPosition(T(3, 12));
    await settle(run, 2);
    run.setPlayerPosition(mid(DALE_AREA));
    await settle(run, 6);
    expect(shown.filter((s) => s.sequenceId === 'c6.secondOpinion.lesson')).toHaveLength(0);
  });

  it('the hurley in the bin gives nothing; the hello man talks', async () => {
    const { run } = await newGame();
    await toTown(run);
    const shown = record(run.bus, 'dialogue:show');
    const gained = record(run.bus, 'weapon:gained');
    examine(run, 'c6.dale.bin');
    await settle(run, 6);
    examine(run, 'c6.town.hello');
    await settle(run, 6);
    expect(shown.map((s) => s.sequenceId)).toEqual(expect.arrayContaining(['c6.dale.bin', 'c6.town.hello']));
    expect(gained).toHaveLength(0);
  });

  it('the Ohio rule: Myko\'s tangents are the Ohio pool, and every screen has at least four things he admires', () => {
    expect(chapter6.mykoTangentPools?.ohio).toBe('c6.ohio.general');
    expect(pool('c6.ohio.general').length).toBeGreaterThanOrEqual(8);
    expect(pool('c6.insults')).toHaveLength(3);
    for (const s of chapter6.screens) {
      const admired = chapter6.examinables.filter((e) => e.screenId === s.id && e.dialogueId?.startsWith('c6.ohio.'));
      expect(admired.length, s.id).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('chapter 6: the whole chapter in order', () => {
  it('motel, town, fields, drones, maze, centre, board, combine, closing', async () => {
    const { run } = await newGame();
    const order: string[] = [];
    run.bus.on('section:completed', ({ sectionId }) => void order.push(sectionId));
    const shown = record(run.bus, 'dialogue:show');
    const said = (id: string) => shown.some((s) => s.sequenceId === id);
    const ended = record(run.bus, 'chapter:completed');

    await doMotel(run);
    expect(run.objective()).toBe('c6.town');
    await doTown(run);
    expect(run.objective()).toBe('c6.fields');
    await toFields(run);
    expect(said('c6.fields.open')).toBe(true);
    expect(run.myko.pos).toEqual(chapter6.screens[2]?.mykoStart);
    await crossFields(run);
    expect(run.flag('fields.clean')).toBe(true);
    expect(run.objective()).toBe('c6.drones');
    expect(said('c6.fields.clean')).toBe(true);
    await intoYard(run);
    expect(run.fight('c6.fight.drones')?.active).toBe(true);
    await winDrones(run);
    expect(run.objective()).toBe('c6.maze');
    await solveMaze(run);
    expect(run.isComplete('c6.puzzle.maze')).toBe(true);
    await doCentre(run);
    expect(run.isComplete('c6.explore.centre')).toBe(true);
    expect(run.isComplete('c6.deduction.roswell')).toBe(true);
    expect(run.objective()).toBe('c6.combine');

    await intoYard(run);
    await settle(run, 6);
    const boss = run.boss('c6.setpiece.combine')!;
    expect(boss.active).toBe(true);
    for (const tag of ['light1', 'light2', 'light3']) {
      run.defeat(boss.body(tag)!, 'player');
      await settle(run, 3);
    }
    for (let i = 0; i < 4000 && ended.length === 0; i++) {
      run.tick(16, NO_INPUT);
      if (i % 20 === 0) await settle(run, 1);
    }
    await settle(run, 6);
    for (const id of ['c6.bar.coffee', 'c6.dale.shoulder', 'c6.secondOpinion.lesson', 'c6.caption.fields', 'c6.drones.wave2', 'c6.maze.done', 'c6.centre', 'c6.board.right', 'c6.combine.intro', 'c6.combine.light1', 'c6.combine.light2', 'c6.combine.end', 'c6.closing']) {
      expect(said(id), id).toBe(true);
    }
    expect(ended).toHaveLength(1);
    expect(run.screenId).toBe('c6.town');
    expect(run.dialogue.missing.size).toBe(0);
    const want = ['c6.explore.bar', 'c6.explore.motel', 'c6.explore.town', 'c6.stealth.fields', 'c6.fight.drones', 'c6.puzzle.maze', 'c6.explore.centre', 'c6.deduction.roswell', 'c6.setpiece.combine'];
    expect(order.filter((s) => want.includes(s))).toEqual(want);
  });

  it('walkChapter completes every section and the chapter', async () => {
    const { run } = await newGame();
    const ended = record(run.bus, 'chapter:completed');
    run.walkChapter();
    await settle(run, 6);
    for (const s of chapter6.def.sections) expect(run.isComplete(s.id), s.id).toBe(true);
    expect(ended).toHaveLength(1);
  });
});
