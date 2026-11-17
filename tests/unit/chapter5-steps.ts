/** Not a test file. Steps through chapter 5 by its real triggers and examinables, shared by the chapter 5 tests. */

import { chapter5 } from '../../src/chapters/05/index';
import {
  BAR_FROM_LOBBY,
  COPIER_SPOT,
  FLOOR_ARRIVAL,
  LIGHTBOX_SPOT,
  LOBBY_FROM_BAR,
  LOBBY_QUEUE_AREA,
  LOBBY_STEALTH_EXIT,
  LOBBY_STEALTH_START,
  PRUITT_TRIGGER,
  STACKS_ARRIVAL,
  STEALTH_EXIT,
  STEALTH_START,
} from '../../src/chapters/05/maps';
import type { HitInfo } from '../../src/core/types';
import type { ChapterScript } from '../../src/systems';
import type { ChapterRun } from '../../src/systems/run';
import { NO_INPUT, settleDialogue, startChapterGame } from './helpers';

export const PUZZLE = 'c5.puzzle.redacted';
export const FIGHT = 'c5.fight.floor';
export const BOARD = 'c5.deduction.ohio';
export const BOSS = 'c5.boss.pruitt1';

/** E on an examinable, straight to the chapter script (the walk up to it is not what is under test). */
export const examine = (run: object, id: string): void => void (run as { script: ChapterScript }).script.onExamine?.(id);

export async function newGame(how: 'chapter' | 'continue' = 'chapter', store?: Parameters<typeof startChapterGame>[2]) {
  const g = startChapterGame(chapter5, how, store);
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

export type C5Screen = 'c5.bar' | 'c5.lobby' | 'c5.floor' | 'c5.stacks';

export async function enter(run: ChapterRun, screen: C5Screen, at: { x: number; y: number }): Promise<void> {
  run.goToScreen(screen, at);
  await settle(run);
}

/** The mid-point of an area, in pixels. */
export const mid = (a: { x: number; y: number; width: number; height: number }) => ({ x: a.x + a.width / 2, y: a.y + a.height / 2 });

export const hit = (amount: number): HitInfo => ({ source: { kind: 'player', abilityId: 'punchCombo' }, targetInstanceId: 'x', amount, knockback: { x: 0, y: 0 }, stunMs: 0, holdMs: 0 });

/** Across the street into the lobby. */
export async function toLobby(run: ChapterRun): Promise<void> {
  await enter(run, 'c5.lobby', LOBBY_FROM_BAR);
}

/** The queue (the Act Natural lesson plays when he steps in). */
export async function toQueue(run: ChapterRun): Promise<void> {
  run.setPlayerPosition(mid(LOBBY_QUEUE_AREA));
  await settle(run, 6);
}

/** The lobby stealth, a clean run: past the queue, into the section, out at the Staff door. */
export async function crossLobby(run: ChapterRun): Promise<void> {
  await toQueue(run);
  run.setPlayerPosition(mid(LOBBY_STEALTH_START));
  await settle(run);
  run.setPlayerPosition(mid(LOBBY_STEALTH_EXIT));
  await settle(run);
}

/** The records floor: in from the Staff door. */
export async function toFloor(run: ChapterRun): Promise<void> {
  await enter(run, 'c5.floor', FLOOR_ARRIVAL);
}

/** The floor stealth, a clean run: in at the start, out at the lightbox end of the south aisle. */
export async function crossFloor(run: ChapterRun): Promise<void> {
  run.setPlayerPosition(mid(STEALTH_START));
  await settle(run);
  run.setPlayerPosition(mid(STEALTH_EXIT));
  await settle(run);
}

/** Every sheet, the requisition and the bus claim, by E. */
export async function gatherFiles(run: ChapterRun): Promise<void> {
  for (const n of [1, 2, 3, 4, 5]) examine(run, `c5.sheet.${n}`);
  await settle(run, 6);
  examine(run, 'c5.requisition');
  await settle(run, 4);
  examine(run, 'c5.busticket');
  await settle(run, 4);
}

/** The lightbox: step up, E, and overlay the right three through the UI's own calls. */
export async function solveRedaction(run: ChapterRun, picks: readonly string[] = ['sheet1', 'sheet3', 'sheet4']) {
  run.setPlayerPosition(LIGHTBOX_SPOT);
  await settle(run, 4);
  examine(run, 'c5.lightbox');
  await settle(run, 6);
  return run.submitRedaction(PUZZLE, picks);
}

/** E at the copier: the jam, the Lock-in lesson and the fight's intro, then the fight starts. */
export async function jamCopier(run: ChapterRun): Promise<void> {
  run.setPlayerPosition(COPIER_SPOT);
  await settle(run, 2);
  examine(run, 'c5.copier');
  await settle(run, 12);
}

/** Wins the cubicle fight wave by wave (the next wave comes when the last is down). */
export async function winFight(run: ChapterRun): Promise<void> {
  const fight = run.fight(FIGHT)!;
  for (let i = 0; i < 60 && !fight.isComplete(); i++) {
    for (const a of fight.aliveActors()) run.defeat(a, 'player');
    await settle(run, 10);
  }
}

/** The board by its own submission: the line from the file, the corn order and the bus claim. */
export async function solveBoard(run: ChapterRun): Promise<boolean> {
  await settle(run, 4);
  return run.submitDeduction(BOARD, ['c5.clue.site', 'c5.clue.requisition', 'c5.clue.busticket']);
}

export async function toStacks(run: ChapterRun): Promise<void> {
  await enter(run, 'c5.stacks', STACKS_ARRIVAL);
}

/** Into the arena: Pruitt's intro plays and the boss starts. */
export async function startPruitt(run: ChapterRun): Promise<void> {
  run.setPlayerPosition({ x: PRUITT_TRIGGER.x - 400, y: PRUITT_TRIGGER.y });
  await settle(run, 2);
  run.setPlayerPosition(mid(PRUITT_TRIGGER));
  await settle(run, 10);
}

/** Everything up to the board open, by the real path (a clean lobby and floor). */
export async function toTheBoard(run: ChapterRun): Promise<void> {
  await toLobby(run);
  await crossLobby(run);
  await toFloor(run);
  await crossFloor(run);
  await gatherFiles(run);
  await solveRedaction(run);
  await jamCopier(run);
  await winFight(run);
  await settle(run, 8);
}

export { BAR_FROM_LOBBY };
