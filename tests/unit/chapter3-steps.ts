/** Not a test file. Steps through chapter 3 by its real triggers and examinables, shared by the chapter 3 tests. */

import { chapter3 } from '../../src/chapters/03/index';
import { BAY_ARRIVAL, OFFICE_ARRIVAL, YARD_EXIT_AREA, YARD_START_AREA } from '../../src/chapters/03/maps';
import type { ChapterScript } from '../../src/systems';
import type { ChapterRun } from '../../src/systems/run';
import { NO_INPUT, frame, placeAt, settleDialogue, startChapterGame } from './helpers';
import { px } from './reach';

/** E on an examinable, straight to the chapter script (the walk up to it is not what is under test). */
export const examine = (run: object, id: string): void => void (run as { script: ChapterScript }).script.onExamine?.(id);

export async function newGame(how: 'chapter' | 'continue' = 'chapter', store?: Parameters<typeof startChapterGame>[2]) {
  const g = startChapterGame(chapter3, how, store);
  g.run.tick(16, NO_INPUT);
  await settleDialogue(g.run);
  g.run.tick(16, NO_INPUT);
  await settleDialogue(g.run);
  return g;
}

/** Ticks a few frames and lets the scripts' chains run. */
export async function settle(run: ChapterRun, frames = 3): Promise<void> {
  for (let i = 0; i < frames; i++) {
    run.tick(16, NO_INPUT);
    await settleDialogue(run, 4);
  }
}

export async function enter(run: ChapterRun, screen: 'c3.yard' | 'c3.office' | 'c3.bay', at: { x: number; y: number }): Promise<void> {
  run.goToScreen(screen, at);
  await settle(run);
}

/** The mid-point of an area, in pixels. */
export const mid = (a: { x: number; y: number; width: number; height: number }) => ({ x: a.x + a.width / 2, y: a.y + a.height / 2 });

/** The yard, a clean run: steps out of the gap and onto the office door's end. */
export async function crossYard(run: ChapterRun): Promise<void> {
  run.setPlayerPosition(mid(YARD_START_AREA));
  await settle(run);
  run.setPlayerPosition(mid(YARD_EXIT_AREA));
  await settle(run);
}

/** The office through to the open cabinet: the two key clues, the dent, Same Again, the swing that opens it. */
export async function openOffice(run: ChapterRun): Promise<void> {
  await enter(run, 'c3.office', OFFICE_ARRIVAL);
  examine(run, 'c3.map');
  examine(run, 'c3.brochure');
  await settle(run);
  const swing = async () => {
    placeAt(run, 28, 4);
    run.tick(16, frame({ pressed: ['melee'], aim: px(28, 3) }));
    await settle(run, 30);
  };
  await swing();
  run.assignMove(2, 'sameAgain');
  run.tick(16, frame({ pressed: ['special2'], aim: px(28, 3) }));
  await swing();
}

/** To the bay with the crates solved and the manifest not yet taken. */
export async function toBayPuzzleSolved(run: ChapterRun): Promise<void> {
  await crossYard(run);
  await openOffice(run);
  await enter(run, 'c3.bay', BAY_ARRIVAL);
  run.completeSection('c3.puzzle.crates', 'player');
  await settle(run);
}

/** Sober: the meter at nothing, a few ticks, and the scene's part played. */
export async function toSober(run: ChapterRun): Promise<void> {
  run.player.meter = { ...run.player.meter, value: 0.01 };
  for (let i = 0; i < 12; i++) run.tick(16, NO_INPUT);
  run.completeBarReturn();
  await settle(run, 4);
}
