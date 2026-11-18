/** Not a test file. Steps through chapter 9 by its real triggers and examinables, shared by the chapter 9 tests. */

import { chapter9 } from '../../src/chapters/09/index';
import {
  GRAVITY_ENTRY_AREAS,
  GRAVITY_LAYOUT,
  HALL_BAYS,
  HALL_FROM_LABS,
  HANGAR_AREA,
  LABS_FIGHT_TRIGGER,
  LABS_FROM_OFFICES,
  LIFT_AREA,
  LIFT_SPOT,
  LOCKDOWN_TRIGGER,
  OFFICES_EXIT,
  OFFICES_FROM_LABS,
  OFFICES_START,
  RECORDS_AREA,
  T,
  WAND_TILE,
} from '../../src/chapters/09/index';
import type { EvidenceId } from '../../src/core/types';
import type { ChapterScript } from '../../src/systems';
import { solveRoom } from '../../src/systems/gravity';
import type { GravityRoomLayout, GravityStep } from '../../src/systems/gravity';
import { createMeter } from '../../src/systems/meter';
import { tileCentre, tileOf } from '../../src/systems/grid';
import type { ChapterRun } from '../../src/systems/run';
import { NO_INPUT, frame, settleDialogue, startChapterGame } from './helpers';

export const GRAVITY = 'c9.puzzle.gravity';
export const EXPLORE_LABS = 'c9.explore.labs';
export const FIGHT = 'c9.fight.labs';
export const BOARD = 'c9.deduction.uplink';
export const BOSS = 'c9.setpiece.lockdown';
export const STEALTH = 'c9.stealth.offices';

export const ev = (id: string): EvidenceId => id as EvidenceId;

/** E on an examinable for real: Andrew is put on its spot (on its screen) and presses interact. */
export function examine(run: ChapterRun, id: string, at?: { x: number; y: number }): void {
  const ex = chapter9.examinables.find((e) => e.id === id);
  if (!ex) throw new Error(`no examinable ${id}`);
  const to = at ?? ex.position;
  if (run.screenId !== ex.screenId) run.goToScreen(ex.screenId, to);
  run.setPlayerPosition(to);
  run.tick(16, frame({ pressed: ['interact'] }));
}

/** The chapter script's own examine hook, without the default. */
export const hook = (run: object, id: string): boolean | void => (run as { script: ChapterScript }).script.onExamine?.(id);

export async function newGame(how: 'chapter' | 'continue' = 'chapter', store?: Parameters<typeof startChapterGame>[2]) {
  const g = startChapterGame(chapter9, how, store);
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

export type C9Screen = 'c9.offices' | 'c9.labs' | 'c9.hall';

export async function enter(run: ChapterRun, screen: C9Screen, at: { x: number; y: number }): Promise<void> {
  run.goToScreen(screen, at);
  await settle(run);
}

/** The mid-point of an area, in pixels. */
export const mid = (a: { x: number; y: number; width: number; height: number }) => ({ x: a.x + a.width / 2, y: a.y + a.height / 2 });

/** Keeps the meter high and the drain held while a test walks past guards that would hit him. */
export function steady(run: ChapterRun): void {
  run.player.holdDrain(true);
  run.player.meter = createMeter(9, 105);
}

/** Ticks `ms` of game time, the meter topped up each frame, Andrew held at `hold` if given. */
export function step(run: ChapterRun, ms: number, hold?: { x: number; y: number }): void {
  for (let t = 0; t < ms; t += 16) {
    steady(run);
    if (hold) run.setPlayerPosition(hold);
    run.tick(16, NO_INPUT);
  }
}

// --- The offices ---

/** The kettle: the bar section, and the free tea. */
export async function doBar(run: ChapterRun): Promise<void> {
  examine(run, 'c9.bar.hotDrink');
  await settle(run, 6);
  run.takeHotDrink('tea');
  await settle(run, 3);
}

/** The offices stealth, a clean run: in at the lobby door, out at the west end. */
export async function crossOffices(run: ChapterRun): Promise<void> {
  run.setPlayerPosition(mid(OFFICES_START));
  await settle(run, 4);
  run.setPlayerPosition(mid(OFFICES_EXIT));
  await settle(run, 4);
}

export async function doProofsOffices(run: ChapterRun): Promise<void> {
  examine(run, 'c9.proof.contract');
  await settle(run, 4);
  examine(run, 'c9.proof.directory');
  await settle(run, 4);
}

export async function takeGlove(run: ChapterRun): Promise<void> {
  examine(run, 'c9.glove.box');
  await settle(run, 8);
}

// --- The gravity rooms ---

const walkDir = (dir: 'up' | 'down' | 'left' | 'right') => (dir === 'up' ? { x: 0, y: -1 } : dir === 'down' ? { x: 0, y: 1 } : dir === 'left' ? { x: -1, y: 0 } : { x: 1, y: 0 });

/** Walks one tile in `dir` with real input until Andrew's tile changes (a crate in the way is pushed). */
export function walk(run: ChapterRun, dir: 'up' | 'down' | 'left' | 'right'): void {
  const from = tileOf(run.player.pos);
  const goal = { col: from.col + (dir === 'right' ? 1 : dir === 'left' ? -1 : 0), row: from.row + (dir === 'down' ? 1 : dir === 'up' ? -1 : 0) };
  const centre = tileCentre(goal);
  for (let i = 0; i < 80; i++) {
    run.tick(16, frame({ move: walkDir(dir) }));
    const p = run.player.pos;
    if (Math.abs(p.x - centre.x) <= 3 && Math.abs(p.y - centre.y) <= 3) break;
  }
  run.setPlayerPosition(centre);
}

export function runPlan(run: ChapterRun, steps: readonly GravityStep[]): void {
  for (const s of steps) {
    if (s.kind === 'walk') walk(run, s.dir);
    else {
      run.tick(16, frame({ pressed: ['interact'] }));
      for (let t = 0; t < 1200; t += 16) run.tick(16, NO_INPUT);
    }
  }
}

/** The labs, from the offices' west door. */
export async function toLabs(run: ChapterRun): Promise<void> {
  await enter(run, 'c9.labs', LABS_FROM_OFFICES);
}

/** Walks up to room `n`'s door (its prompt line, the section armed), then does the planner's plan for it in the real run. */
export async function solveGravityRoom(run: ChapterRun, n: number): Promise<void> {
  const room = GRAVITY_LAYOUT.rooms[n - 1] as GravityRoomLayout;
  run.setPlayerPosition(mid(GRAVITY_ENTRY_AREAS[n - 1] as never));
  await settle(run, 6);
  run.setPlayerPosition(tileCentre(room.andrewStart));
  run.tick(16, NO_INPUT);
  const plan = solveRoom(room, run.grid);
  if (!plan) throw new Error(`no plan for ${room.id}`);
  runPlan(run, plan);
  await settle(run, 3);
}

export async function solveGravity(run: ChapterRun): Promise<void> {
  for (const n of [1, 2, 3]) await solveGravityRoom(run, n);
}

// --- The labs ---

/** The hangar photograph and the flight log. */
export async function doLabsProofs(run: ChapterRun): Promise<void> {
  run.setPlayerPosition(mid(HANGAR_AREA));
  await settle(run, 3);
  examine(run, 'c9.proof.craft');
  await settle(run, 10);
  run.setPlayerPosition(mid(RECORDS_AREA));
  await settle(run, 3);
  examine(run, 'c9.proof.log');
  await settle(run, 12);
}

/** Walks in at the labs' west strip: the fight starts (if the rooms and both proofs are in). */
export async function startLabsFight(run: ChapterRun): Promise<void> {
  run.setPlayerPosition(mid(LABS_FIGHT_TRIGGER));
  for (let i = 0; i < 40 && run.fight(FIGHT)?.active !== true; i++) {
    run.tick(16, NO_INPUT);
    if (i % 4 === 0) await settleDialogue(run, 2);
  }
  await settle(run, 3);
}

/** Wins the labs fight, both waves. */
export async function winLabsFight(run: ChapterRun): Promise<void> {
  const fight = run.fight(FIGHT)!;
  for (let i = 0; i < 60 && !fight.isComplete(); i++) {
    steady(run);
    for (const a of fight.aliveActors()) run.defeat(a, 'player');
    await settle(run, 6);
  }
}

/** The board, answered with the three clues (Pruitt's lanyard comes from chapter 8). */
export async function doBoard(run: ChapterRun): Promise<void> {
  run.addEvidence(ev('c8.clue.shift'));
  run.submitDeduction(BOARD, [ev('c9.proof.contract'), ev('c9.proof.directory'), ev('c8.clue.shift')]);
  await settle(run, 8);
}

// --- The hall ---

export async function toHall(run: ChapterRun): Promise<void> {
  await enter(run, 'c9.hall', HALL_FROM_LABS);
}

/** Walks into bay 1: the intro scene, then the set piece. */
export async function startLockdown(run: ChapterRun): Promise<void> {
  run.setPlayerPosition(mid(LOCKDOWN_TRIGGER));
  for (let i = 0; i < 60 && run.boss(BOSS)?.active !== true; i++) {
    steady(run);
    run.tick(16, NO_INPUT);
    if (i % 3 === 0) await settleDialogue(run, 2);
  }
  await settle(run, 2);
}

/** Puts Andrew in bay `n` (at its start) and lets a few frames run. */
export async function intoBay(run: ChapterRun, n: number): Promise<void> {
  run.setPlayerPosition(HALL_BAYS[n - 1]!.start);
  step(run, 96);
  await settleDialogue(run, 2);
}

/** E at a bay's switch from the cell beside it. */
export function pressBaySwitch(run: ChapterRun, n: number): void {
  const g = HALL_BAYS[n - 1]!.gravity!;
  const stand = T(g.switch.standAt.col, g.switch.standAt.row);
  examine(run, g.switch.id, stand);
}

/** E at the recorder and stays at it for the take. */
export function takeTape(run: ChapterRun): void {
  const rec = HALL_BAYS[2]!.recorder!;
  examine(run, 'c9.hall.recorder', rec.spot);
  step(run, 3400, rec.spot);
}

/** The lift's panel from the floor in front of it. */
export function pressLift(run: ChapterRun): void {
  examine(run, 'c9.hall.lift', LIFT_SPOT);
}

export { LIFT_AREA, WAND_TILE, OFFICES_FROM_LABS };
