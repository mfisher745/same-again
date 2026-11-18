/** Not a test file. Steps through chapter 8 by its real triggers and examinables, shared by the chapter 8 tests. */

import { chapter8 } from '../../src/chapters/08/index';
import {
  BARRED_TRIGGER,
  FENCE_FIGHT_AREA,
  GATE_ARRIVE_AREA,
  GATE_CLOSING_AREA,
  JUNCTION_BOXES,
  JUNCTION_TRIGGER,
  PERIMETER_FROM_ROAD,
  PERIMETER_OPEN_AREA,
  PRUITT_TRIGGER,
  ROAD_FROM_PERIMETER,
  SUN_AREA,
  STEALTH_EXIT,
  STEALTH_START,
  GATE_FROM_PERIMETER,
} from '../../src/chapters/08/maps';
import type { EvidenceId } from '../../src/core/types';
import type { ChapterScript } from '../../src/systems';
import type { ChapterRun } from '../../src/systems/run';
import { NO_INPUT, frame, settleDialogue, startChapterGame } from './helpers';

export const PUZZLE = 'c8.puzzle.junctions';
export const FIGHT = 'c8.fight.fence';
export const BOARD = 'c8.deduction.gate';
export const BOSS = 'c8.boss.pruitt2';
export const STEALTH = 'c8.stealth.perimeter';

export const ev = (id: string): EvidenceId => id as EvidenceId;

/** E on an examinable for real: Andrew is put on its spot (on its screen) and presses interact. */
export function examine(run: ChapterRun, id: string): void {
  const ex = chapter8.examinables.find((e) => e.id === id);
  if (!ex) throw new Error(`no examinable ${id}`);
  if (run.screenId !== ex.screenId) run.goToScreen(ex.screenId, ex.position);
  run.setPlayerPosition(ex.position);
  run.tick(16, frame({ pressed: ['interact'] }));
}

/** The chapter script's own examine hook, without the default. */
export const hook = (run: object, id: string): boolean | void => (run as { script: ChapterScript }).script.onExamine?.(id);

export async function newGame(how: 'chapter' | 'continue' = 'chapter', store?: Parameters<typeof startChapterGame>[2]) {
  const g = startChapterGame(chapter8, how, store);
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

export type C8Screen = 'c8.road' | 'c8.perimeter' | 'c8.gate';

export async function enter(run: ChapterRun, screen: C8Screen, at: { x: number; y: number }): Promise<void> {
  run.goToScreen(screen, at);
  await settle(run);
}

/** The mid-point of an area, in pixels. */
export const mid = (a: { x: number; y: number; width: number; height: number }) => ({ x: a.x + a.width / 2, y: a.y + a.height / 2 });

/** The roadhouse: the hot drink, the dollar and the beer, the fuel log and the grey car. */
export async function doRoadhouse(run: ChapterRun): Promise<void> {
  examine(run, 'c8.tea');
  await settle(run, 6);
  run.takeHotDrink('coffee');
  examine(run, 'c8.attendant');
  await settle(run, 6);
  examine(run, 'c8.clue.schedule');
  await settle(run, 6);
  examine(run, 'c8.clue.car');
  await settle(run, 6);
}

export async function stepOutFromAwning(run: ChapterRun): Promise<void> {
  run.setPlayerPosition(mid(SUN_AREA));
  await settle(run, 6);
}

/** Walking in at the wash: the lone agent, then the lesson. */
export async function toWash(run: ChapterRun): Promise<void> {
  await enter(run, 'c8.road', ROAD_FROM_PERIMETER);
  run.setPlayerPosition(mid(BARRED_TRIGGER));
  await settle(run, 8);
}

export async function toPerimeter(run: ChapterRun): Promise<void> {
  await enter(run, 'c8.perimeter', PERIMETER_FROM_ROAD);
  run.setPlayerPosition(mid(PERIMETER_OPEN_AREA));
  await settle(run, 6);
}

/** The stealth section, a clean run: in at the wash's mouth, out at the fence zone. */
export async function crossPerimeter(run: ChapterRun): Promise<void> {
  await toPerimeter(run);
  run.setPlayerPosition(mid(STEALTH_START));
  await settle(run);
  run.setPlayerPosition(mid(STEALTH_EXIT));
  await settle(run);
}

/** Works one box by pressing E at it. */
export async function pressBox(run: ChapterRun, boxId: 'near' | 'middle' | 'far'): Promise<void> {
  examine(run, `c8.junction.${boxId}`);
  await settle(run, 3);
}

export async function solveJunctions(run: ChapterRun): Promise<void> {
  run.setPlayerPosition(mid(JUNCTION_TRIGGER));
  await settle(run, 6);
  for (const b of JUNCTION_BOXES) await pressBox(run, b.id);
}

/** Walks into the fence zone: the sun goes down, the truck drives in and parks, and the fight starts. */
export async function startFence(run: ChapterRun): Promise<void> {
  run.setPlayerPosition(mid(FENCE_FIGHT_AREA));
  for (let i = 0; i < 400 && run.fight(FIGHT)?.active !== true; i++) {
    run.tick(16, NO_INPUT);
    if (i % 10 === 0) await settleDialogue(run, 2);
  }
  await settle(run, 3);
}

/** Wins the fence fight. */
export async function winFence(run: ChapterRun): Promise<void> {
  const fight = run.fight(FIGHT)!;
  for (let i = 0; i < 60 && !fight.isComplete(); i++) {
    for (const a of fight.aliveActors()) run.defeat(a, 'player');
    await settle(run, 6);
  }
}

/** The clipboard (the clue, and the board with it), then the board answered with the permit from chapter 7. */
export async function doBoard(run: ChapterRun): Promise<void> {
  run.addEvidence(ev('c7.clue.permit'));
  examine(run, 'c8.clue.shift');
  await settle(run, 8);
  run.submitDeduction(BOARD, [ev('c8.clue.schedule'), ev('c8.clue.shift'), ev('c7.clue.permit')]);
  await settle(run, 8);
}

export async function toGate(run: ChapterRun): Promise<void> {
  await enter(run, 'c8.gate', GATE_FROM_PERIMETER);
  run.setPlayerPosition(mid(GATE_ARRIVE_AREA));
  await settle(run, 4);
}

/** Walks in at Pruitt's chair: his intro scene, then the boss starts. */
export async function startPruitt(run: ChapterRun): Promise<void> {
  run.setPlayerPosition(mid(PRUITT_TRIGGER));
  await settle(run, 8);
}

/** Wears Pruitt down to 40%. */
export function wearDown(run: ChapterRun): void {
  const boss = run.boss(BOSS)!;
  const h = boss.health()!;
  boss.body('pruitt')!.health = h.max * 0.4 - 1;
}

/** Walks up the service road. */
export async function walkClosing(run: ChapterRun): Promise<void> {
  run.setPlayerPosition(mid(GATE_CLOSING_AREA));
  await settle(run, 8);
}
