/** Not a test file. Steps through chapter 4 by its real triggers and examinables, shared by the chapter 4 tests. */

import { chapter4 } from '../../src/chapters/04/index';
import { BAR_FROM_DOCKS, DOCKS_ARRIVAL, MANNER_AREA, PATRON_TILES, RAILS, STEALTH_EXIT, STEALTH_START } from '../../src/chapters/04/maps';
import type { ChapterScript } from '../../src/systems';
import type { ChapterRun } from '../../src/systems/run';
import { NO_INPUT, frame, settleDialogue, startChapterGame } from './helpers';

/** E on an examinable, straight to the chapter script (the walk up to it is not what is under test). */
export const examine = (run: object, id: string): void => void (run as { script: ChapterScript }).script.onExamine?.(id);

export async function newGame(how: 'chapter' | 'continue' = 'chapter', store?: Parameters<typeof startChapterGame>[2]) {
  const g = startChapterGame(chapter4, how, store);
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

export async function enter(run: ChapterRun, screen: 'c4.bar' | 'c4.docks', at: { x: number; y: number }): Promise<void> {
  run.goToScreen(screen, at);
  await settle(run);
}

/** The mid-point of an area, in pixels. */
export const mid = (a: { x: number; y: number; width: number; height: number }) => ({ x: a.x + a.width / 2, y: a.y + a.height / 2 });

/** The four regulars, the roster; Bedside Manner is the next beat. */
export async function talkToTheBar(run: ChapterRun): Promise<void> {
  for (const who of ['doug', 'barb', 'kev', 'sully'] as const) examine(run, `c4.${who}`);
  await settle(run, 6);
  examine(run, 'c4.roster');
  await settle(run, 4);
}

/** Through the lesson to the brawl: steps into the table, takes the move, says it to Kev (the brawl starts). */
export async function startBrawl(run: ChapterRun): Promise<void> {
  await talkToTheBar(run);
  run.setPlayerPosition(mid(MANNER_AREA));
  await settle(run, 6);
  // Slot 2 holds Stout Slam from chapter 2's kit: Bedside Manner goes in by hand (the Tab).
  run.assignMove(2, 'bedsideManner');
  const kev = { x: PATRON_TILES.kev.col * 16 + 8, y: PATRON_TILES.kev.row * 16 + 8 };
  run.setPlayerPosition({ x: kev.x, y: kev.y + 24 });
  run.tick(16, frame({ pressed: ['special2'], aim: kev }));
  await settle(run, 8);
}

/** Wins the brawl wave by wave (the next wave comes when the last is down). */
export async function winBrawl(run: ChapterRun): Promise<void> {
  const fight = run.fight('c4.fight.brawl')!;
  for (let i = 0; i < 60 && !fight.isComplete(); i++) {
    for (const a of fight.aliveActors()) run.defeat(a, 'player');
    await settle(run, 10);
  }
}

/** The docks: out of the back door into the alley. */
export async function toDocks(run: ChapterRun): Promise<void> {
  await enter(run, 'c4.docks', DOCKS_ARRIVAL);
}

/** The stealth section, a clean run: in through the fence gap, out at the east wall. */
export async function crossDocks(run: ChapterRun): Promise<void> {
  run.setPlayerPosition(mid(STEALTH_START));
  await settle(run);
  run.setPlayerPosition(mid(STEALTH_EXIT));
  await settle(run);
}

/** The container puzzle by real pulls: 2 on A, 3 on B, 1 on C. */
export async function solveContainers(run: ChapterRun): Promise<void> {
  const pulls: Record<string, number> = { railA: 2, railB: 3, railC: 1 };
  for (const r of RAILS) {
    for (let i = 0; i < (pulls[r.id] ?? 0); i++) {
      examine(run, r.examinableId);
      for (let t = 0; t < 40; t++) run.tick(16, NO_INPUT);
    }
  }
  await settle(run, 4);
}

export { BAR_FROM_DOCKS };
