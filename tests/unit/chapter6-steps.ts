/** Not a test file. Steps through chapter 6 by its real triggers and examinables, shared by the chapter 6 tests. */

import { chapter6 } from '../../src/chapters/06/index';
import {
  ARENA,
  DALE_AREA,
  FIELDS_ARRIVAL,
  FIELDS_OPEN_AREA,
  MAZE_INTRO_AREA,
  MAZE_STONES,
  STEALTH_EXIT,
  STEALTH_START,
  T,
  TOWN_FROM_MOTEL,
  YARD_TRIGGER,
} from '../../src/chapters/06/maps';
import type { EvidenceId } from '../../src/core/types';
import type { ChapterScript } from '../../src/systems';
import type { ChapterRun } from '../../src/systems/run';
import { NO_INPUT, frame, settleDialogue, startChapterGame } from './helpers';

export const ev = (id: string): EvidenceId => id as EvidenceId;

/** E on an examinable for real: Andrew is put on its spot (on its screen) and presses interact. */
export function examine(run: ChapterRun, id: string): void {
  const ex = chapter6.examinables.find((e) => e.id === id);
  if (!ex) throw new Error(`no examinable ${id}`);
  if (run.screenId !== ex.screenId) run.goToScreen(ex.screenId, ex.position);
  run.setPlayerPosition(ex.position);
  run.tick(16, frame({ pressed: ['interact'] }));
}

/** The chapter script's own examine hook, without the default (for what the hook alone does). */
export const hook = (run: object, id: string): boolean | void => (run as { script: ChapterScript }).script.onExamine?.(id);

export async function newGame(how: 'chapter' | 'continue' = 'chapter', store?: Parameters<typeof startChapterGame>[2]) {
  const g = startChapterGame(chapter6, how, store);
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

export async function enter(run: ChapterRun, screen: 'c6.motel' | 'c6.town' | 'c6.fields', at: { x: number; y: number }): Promise<void> {
  run.goToScreen(screen, at);
  await settle(run);
}

/** The mid-point of an area, in pixels. */
export const mid = (a: { x: number; y: number; width: number; height: number }) => ({ x: a.x + a.width / 2, y: a.y + a.height / 2 });

/** The Starlite: the ledger, the postcard and the coffee (with the hot drink taken, as the choice screen would). */
export async function doMotel(run: ChapterRun): Promise<void> {
  examine(run, 'c6.coffee');
  await settle(run, 6);
  run.takeHotDrink('coffee');
  examine(run, 'c6.clue.ledger');
  await settle(run, 6);
  examine(run, 'c6.clue.postcard');
  await settle(run, 6);
}

export async function toTown(run: ChapterRun): Promise<void> {
  await enter(run, 'c6.town', TOWN_FROM_MOTEL);
}

/** Main Street: the noticeboard, then Dale (walking into his shop). */
export async function doTown(run: ChapterRun): Promise<void> {
  await toTown(run);
  examine(run, 'c6.clue.noticeboard');
  await settle(run, 6);
  run.setPlayerPosition(mid(DALE_AREA));
  await settle(run, 8);
}

export async function toFields(run: ChapterRun): Promise<void> {
  await enter(run, 'c6.fields', FIELDS_ARRIVAL);
  run.setPlayerPosition(mid(FIELDS_OPEN_AREA));
  await settle(run, 4);
}

/** The stealth section, a clean run: in at the lane's end, out at the yard. */
export async function crossFields(run: ChapterRun): Promise<void> {
  await toFields(run);
  run.setPlayerPosition(mid(STEALTH_START));
  await settle(run);
  run.setPlayerPosition(mid(STEALTH_EXIT));
  await settle(run);
}

/** Into the yard: the drone fight starts (or, with the board done, the combine). */
export async function intoYard(run: ChapterRun): Promise<void> {
  run.setPlayerPosition(mid(YARD_TRIGGER));
  await settle(run, 4);
}

/** Wins a fight wave by wave. */
export async function winDrones(run: ChapterRun): Promise<void> {
  const fight = run.fight('c6.fight.drones')!;
  for (let i = 0; i < 60 && !fight.isComplete(); i++) {
    for (const a of fight.aliveActors()) run.defeat(a, 'player');
    await settle(run, 10);
  }
}

/** The maze by its real stones: walks onto each in the right order, stepping off between. */
export async function solveMaze(run: ChapterRun): Promise<void> {
  run.setPlayerPosition(mid(MAZE_INTRO_AREA));
  await settle(run, 4);
  for (const s of MAZE_STONES) await stepOn(run, s.id);
}

/** Steps onto one stone, then off it (a tile away is outside the stone's reach). */
export async function stepOn(run: ChapterRun, id: string): Promise<void> {
  const s = MAZE_STONES.find((x) => x.id === id)!;
  run.setPlayerPosition(T(s.col + 4, s.row));
  await settle(run, 2);
  run.setPlayerPosition(T(s.col, s.row));
  await settle(run, 3);
  run.setPlayerPosition(T(s.col + 4, s.row));
  await settle(run, 2);
}

/** The receipt under the hatch (the board opens), then the board answered. */
export async function doCentre(run: ChapterRun): Promise<void> {
  examine(run, 'c6.clue.receipt');
  await settle(run, 10);
  run.submitDeduction('c6.deduction.roswell', [ev('c6.clue.ledger'), ev('c6.clue.receipt'), ev('c6.clue.postcard')]);
  await settle(run, 8);
}

/** Back west through the yard with the board done: the combine's intro, then the set piece. */
export async function startCombine(run: ChapterRun): Promise<void> {
  await intoYard(run);
  await settle(run, 8);
}

export const ARENA_CENTRE = T(ARENA.col + ARENA.width / 2, ARENA.row + ARENA.height / 2);
