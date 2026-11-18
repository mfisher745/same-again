/** Not a test file. Steps through chapter 7 by its real triggers and examinables, shared by the chapter 7 tests. */

import { chapter7 } from '../../src/chapters/07/index';
import {
  FIGURES,
  MASCOT_ARENA,
  SHOP_FROM_STRIP,
  STOCK_EXIT,
  STOCK_FROM_SHOP,
  STOCK_START,
  STRIP_FROM_GATE,
  STRIP_SHOP_AREA,
  T,
  YARD_TRIGGER,
} from '../../src/chapters/07/maps';
import type { EvidenceId } from '../../src/core/types';
import type { ChapterScript } from '../../src/systems';
import type { ChapterRun } from '../../src/systems/run';
import { NO_INPUT, frame, settleDialogue, startChapterGame } from './helpers';

export const ev = (id: string): EvidenceId => id as EvidenceId;

export const TELLS = 'c7.puzzle.tells';
export const STEALTH = 'c7.stealth.stock';
export const YARD = 'c7.fight.yard';
export const BOARD = 'c7.deduction.nevada';
export const BOSS = 'c7.boss.mascots';

/** E on an examinable for real: Andrew is put on its spot (on its screen) and presses interact. */
export function examine(run: ChapterRun, id: string): void {
  const ex = chapter7.examinables.find((e) => e.id === id);
  if (!ex) throw new Error(`no examinable ${id}`);
  if (run.screenId !== ex.screenId) run.goToScreen(ex.screenId, ex.position);
  run.setPlayerPosition(ex.position);
  run.tick(16, frame({ pressed: ['interact'] }));
}

/** The chapter script's own examine hook, without the default (for what the hook alone does). */
export const hook = (run: object, id: string): boolean | void => (run as { script: ChapterScript }).script.onExamine?.(id);

export async function newGame(how: 'chapter' | 'continue' = 'chapter', store?: Parameters<typeof startChapterGame>[2]) {
  const g = startChapterGame(chapter7, how, store);
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

/** Ticks for `ms` of game time, finishing lines as they come. */
export async function wait(run: ChapterRun, ms: number): Promise<void> {
  for (let t = 0; t < ms; t += 16) {
    run.tick(16, NO_INPUT);
    if (t % 160 === 0) await settleDialogue(run, 2);
  }
  await settleDialogue(run, 4);
}

export type C7Screen = 'c7.strip' | 'c7.shop' | 'c7.stock';

export async function enter(run: ChapterRun, screen: C7Screen, at: { x: number; y: number }): Promise<void> {
  run.goToScreen(screen, at);
  await settle(run);
}

/** The mid-point of an area, in pixels. */
export const mid = (a: { x: number; y: number; width: number; height: number }) => ({ x: a.x + a.width / 2, y: a.y + a.height / 2 });

/** The bar: the hot drink (taken as the choice screen would), then the bartender and the first tequila. */
export async function doBar(run: ChapterRun): Promise<void> {
  examine(run, 'c7.bar.hotDrink');
  await settle(run, 6);
  run.takeHotDrink('tea');
  examine(run, 'c7.bar.tequila');
  await settle(run, 6);
}

/** The leaflet, then up to the shop's door. */
export async function doStrip(run: ChapterRun): Promise<void> {
  examine(run, 'c7.clue.leaflet');
  await settle(run, 6);
  run.setPlayerPosition(mid(STRIP_SHOP_AREA));
  await settle(run, 4);
}

export async function toShop(run: ChapterRun): Promise<void> {
  await enter(run, 'c7.shop', SHOP_FROM_STRIP);
}

/** Examines the five figures by their examinables, and Gary last, which opens the accuse screen. */
export async function examineFigures(run: ChapterRun): Promise<void> {
  for (const f of FIGURES) {
    examine(run, f.key === 'gary' ? 'c7.gary' : `c7.tells.${f.key}`);
    await settle(run, 8);
  }
  await wait(run, 4000);
}

export const ALIENS = ['b', 'd', 'gary'] as const;

/** The three right figures, accused. */
export async function accuse(run: ChapterRun): Promise<void> {
  run.submitTells(TELLS, [...ALIENS]);
  await settle(run, 8);
}

/** The whole tells puzzle. */
export async function doTells(run: ChapterRun): Promise<void> {
  await toShop(run);
  await examineFigures(run);
  await accuse(run);
}

/** Gary's three exchanges, then Last Orders. */
export async function doGary(run: ChapterRun): Promise<void> {
  for (let i = 0; i < 3; i++) {
    examine(run, 'c7.gary');
    await settle(run, 8);
  }
  await wait(run, 4000);
}

/** The stockroom, a clean run: in from the shop, out at the roller door. */
export async function crossStock(run: ChapterRun): Promise<void> {
  await enter(run, 'c7.stock', STOCK_FROM_SHOP);
  run.setPlayerPosition(mid(STOCK_START));
  await settle(run);
  run.setPlayerPosition(mid(STOCK_EXIT));
  await settle(run);
}

/** Into the yard: the intro scene, then the fight. */
export async function intoYard(run: ChapterRun): Promise<void> {
  run.setPlayerPosition(mid(YARD_TRIGGER));
  await settle(run, 8);
}

/** Wins a fight wave by wave. */
export async function winYard(run: ChapterRun): Promise<void> {
  const fight = run.fight(YARD)!;
  for (let i = 0; i < 60 && !fight.isComplete(); i++) {
    for (const a of fight.aliveActors()) run.defeat(a, 'player');
    await settle(run, 10);
  }
}

/** The van's log, which opens the board; then the board answered. */
export async function doVan(run: ChapterRun): Promise<void> {
  examine(run, 'c7.clue.route');
  await settle(run, 8);
}

export async function doBoard(run: ChapterRun): Promise<void> {
  run.submitDeduction(BOARD, [ev('c7.clue.payslip'), ev('c7.clue.permit'), ev('c7.clue.route')]);
  await settle(run, 8);
}

/** Out through the back gate onto the strip, and into the arena: the intro, then the boss. */
export async function intoArena(run: ChapterRun): Promise<void> {
  await enter(run, 'c7.strip', STRIP_FROM_GATE);
  await wait(run, 800);
}

export const ARENA_CENTRE = T(MASCOT_ARENA.col + MASCOT_ARENA.width / 2, MASCOT_ARENA.row + MASCOT_ARENA.height / 2);

/** Everything up to the mascots, the debug way for the sections that are not under test. */
export async function upToMascots(run: ChapterRun): Promise<void> {
  for (const s of ['c7.explore.bar', 'c7.explore.strip', TELLS, 'c7.explore.gary', STEALTH, YARD, 'c7.explore.van', BOARD] as const) run.completeSection(s, 'debug');
}
