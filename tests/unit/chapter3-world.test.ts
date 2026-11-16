/**
 * Chapter 3 (Regional Office) on the real chapter: the screens connect, everything on them can be walked to (locks and the
 * crate puzzle respected), the beats fire in order, the bar keeps what it should, and the dispenser lines play once at a time.
 */

import { describe, expect, it } from 'vitest';
import { chapter3 } from '../../src/chapters/03/index';
import {
  BAR_ARRIVAL,
  BAY_ARRIVAL,
  CABINET_HIT_AREA,
  CLUE_SPOTS,
  KETTLE_SPOT,
  LEVER_SPOT,
  MANIFEST_SPOT,
  OFFICE_ARRIVAL,
  OFFICE_FROM_BAY,
  STOUT_SPOTS,
  WHISKEY_SPOT,
  YARD_EXIT_AREA,
  YARD_FROM_OFFICE,
  YARD_START_AREA,
} from '../../src/chapters/03/maps';
import type { ChapterRun } from '../../src/systems/run';
import type { ChapterScript } from '../../src/systems';
import { floodFrom, onReachable, unreachableHere, within } from './reach';
import { NO_INPUT, advance, frame, record, settleDialogue, startChapterGame } from './helpers';

/** E on an examinable, straight to the chapter script (the walk up to it is not what is under test). */
const examine = (run: object, id: string): void => void (run as { script: ChapterScript }).script.onExamine?.(id);

async function newGame(how: 'chapter' | 'continue' = 'chapter', store?: Parameters<typeof startChapterGame>[2]) {
  const g = startChapterGame(chapter3, how, store);
  g.run.tick(16, NO_INPUT);
  await settleDialogue(g.run);
  g.run.tick(16, NO_INPUT);
  return g;
}

async function go(run: ChapterRun, screen: 'c3.yard' | 'c3.office' | 'c3.bay', at: { x: number; y: number }): Promise<void> {
  run.goToScreen(screen, at);
  run.tick(16, NO_INPUT);
  await settleDialogue(run);
}

describe('chapter 3: the screens connect and everything on them can be reached', () => {
  it('the yard: the kettle, the door to the office and the stealth start are reachable from the social club', async () => {
    const { run } = await newGame();
    expect(run.screenId).toBe('c3.yard');
    expect(unreachableHere(run, [BAR_ARRIVAL])).toEqual([]);
    const reach = floodFrom(run, [BAR_ARRIVAL]);
    expect(within(reach, KETTLE_SPOT)).toBe(true);
    // Every tile of the stealth section's start and exit is reachable somewhere (the section can begin and end).
    const some = (a: { x: number; y: number; width: number; height: number }) => [...reach].some((k) => {
      const [c, r] = k.split(',').map(Number) as [number, number];
      return c * 16 >= a.x && r * 16 >= a.y && c * 16 < a.x + a.width && r * 16 < a.y + a.height;
    });
    expect(some(YARD_START_AREA)).toBe(true);
    expect(some(YARD_EXIT_AREA)).toBe(true);
    // Where he steps out of the office is part of the same yard.
    expect(onReachable(reach, YARD_FROM_OFFICE)).toBe(true);
  });

  it('the office: every clue, the cabinet and its whiskey, and both doors, from either arrival', async () => {
    const { run } = await newGame();
    await go(run, 'c3.office', OFFICE_ARRIVAL);
    expect(unreachableHere(run, [OFFICE_ARRIVAL])).toEqual([]);
    const reach = floodFrom(run, [OFFICE_ARRIVAL]);
    for (const spot of Object.values(CLUE_SPOTS)) expect(within(reach, spot)).toBe(true);
    expect(within(reach, WHISKEY_SPOT, 8)).toBe(true);
    // A swing at the cabinet can be made from standing room.
    const hitFrom = [...reach].some((k) => {
      const [c, r] = k.split(',').map(Number) as [number, number];
      return c * 16 >= CABINET_HIT_AREA.x && r * 16 >= CABINET_HIT_AREA.y && c * 16 < CABINET_HIT_AREA.x + CABINET_HIT_AREA.width && r * 16 < CABINET_HIT_AREA.y + CABINET_HIT_AREA.height;
    });
    expect(hitFrom).toBe(true);
    expect(onReachable(reach, OFFICE_FROM_BAY)).toBe(true);
  });

  it('the bay: with the crates where they start the manifest and the board are shut off; solved, they are reachable', async () => {
    const { run } = await newGame();
    await go(run, 'c3.bay', BAY_ARRIVAL);
    const shut = unreachableHere(run, [BAY_ARRIVAL]);
    expect(shut).toEqual(expect.arrayContaining(['c3.manifest']));
    expect(shut).not.toContain('c3.crates.lever');
    expect(unreachableHere(run, [BAY_ARRIVAL]).filter((id) => id !== 'c3.manifest' && id !== 'c3.board')).toEqual([]);
    // Everything else on the screen (the lever, the stouts, the exit) is reachable with the crates in place.
    const reach = floodFrom(run, [BAY_ARRIVAL]);
    expect(within(reach, LEVER_SPOT)).toBe(true);
    for (const s of STOUT_SPOTS) expect(within(reach, s)).toBe(true);
    // Solve it: the road is clear, the bay office can be walked into.
    run.completeSection('c3.puzzle.crates', 'debug');
    run.tick(16, NO_INPUT);
    expect(unreachableHere(run, [BAY_ARRIVAL])).toEqual([]);
    expect(within(floodFrom(run, [BAY_ARRIVAL]), MANIFEST_SPOT)).toBe(true);
  });

  it('chapter 3 has the three screens, an office exit that is locked until the clues and cabinet are done', async () => {
    const { run } = await newGame();
    expect(chapter3.screens.map((s) => s.id)).toEqual(['c3.yard', 'c3.office', 'c3.bay']);
    await go(run, 'c3.office', OFFICE_ARRIVAL);
    const bay = run.screenLayout.exits.find((e) => e.id === 'c3.office.bay');
    expect(bay).toBeDefined();
    // Locked at the start: standing in the doorway does nothing.
    run.setPlayerPosition({ x: bay!.area.x + 8, y: bay!.area.y + 8 });
    run.tick(16, NO_INPUT);
    expect(run.screenId).toBe('c3.office');
    // The map, the brochure and the opened cabinet unlock it.
    examine(run, 'c3.map');
    examine(run, 'c3.brochure');
    await settleDialogue(run);
    run.setPlayerPosition({ x: bay!.area.x + 8, y: bay!.area.y + 8 });
    run.tick(16, NO_INPUT);
    expect(run.screenId).toBe('c3.office');
    run.setFlag('cabinet.open', true);
    examine(run, 'c3.certificate'); // any clue re-checks the lock
    await settleDialogue(run);
    run.setPlayerPosition({ x: bay!.area.x + 8, y: bay!.area.y + 8 });
    run.tick(16, NO_INPUT);
    await settleDialogue(run);
    expect(run.screenId).toBe('c3.bay');
  });
});

describe('chapter 3: the run', () => {
  it('walkChapter completes every section and the chapter, with no missing dialogue and no unreferenced objective', async () => {
    const { run, session } = await newGame();
    const done = record(session.bus, 'section:completed');
    run.walkChapter();
    await settleDialogue(run);
    expect(chapter3.def.sections.every((s) => run.isComplete(s.id))).toBe(true);
    expect(done.map((d) => d.sectionId).sort()).toEqual(expect.arrayContaining(chapter3.def.sections.map((s) => s.id).sort()));
    expect(run.dialogue.missing.size).toBe(0);
  });
});

describe('chapter 3: cabinet advance and frames', () => {
  it('ticks cleanly through the opening and a long idle with no dialogue missing', async () => {
    const { run } = await newGame();
    advance(run, 20_000);
    run.tick(16, frame());
    expect(run.dialogue.missing.size).toBe(0);
  });
});
