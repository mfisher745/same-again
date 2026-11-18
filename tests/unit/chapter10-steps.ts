/** Not a test file. Steps through chapter 10 by its real triggers and examinables, shared by the chapter 10 tests. */

import { BAR_ARRIVAL, BUTTON_SPOT, CHANNEL_SPOTS, CONSOLE_AREA, CONTROL_ENTRY_AREA, PUB_STOOL, chapter10 } from '../../src/chapters/10/index';
import { CONTROL_FROM_ANTE } from '../../src/chapters/10/maps';
import type { EvidenceId, ProofId } from '../../src/core/types';
import { PROOFS } from '../../src/core/types';
import type { ChapterScript } from '../../src/systems';
import type { ChapterRun } from '../../src/systems/run';
import { createMeter } from '../../src/systems/meter';
import { NO_INPUT, frame, record, settleDialogue, startChapterGame } from './helpers';

export const FIGHT = 'c10.fight.anteroom';
export const BOSS = 'c10.boss.administrator';
export const PUZZLE = 'c10.puzzle.broadcast';
export const EXPLORE_PUB = 'c10.explore.pub';

export { BAR_ARRIVAL, BUTTON_SPOT, CHANNEL_SPOTS, PUB_STOOL };

type Run = ChapterRun;

/** The proof in each socket of the console, left to right (the art's order: triangle, square, circle, notched, twin hole). */
export const SOLUTION: readonly (readonly [string, ProofId])[] = [
  ['s1', 'c9.proof.log'],
  ['s2', 'c9.proof.contract'],
  ['s3', 'c9.proof.craft'],
  ['s4', 'c9.proof.directory'],
  ['s5', 'c9.proof.footage'],
];

/** E on an examinable for real: Andrew is put on its spot (on its screen) and presses interact. */
export function examine(run: Run, id: string): void {
  const ex = chapter10.examinables.find((e) => e.id === id);
  if (!ex) throw new Error(`no examinable ${id}`);
  if (run.screenId !== ex.screenId) run.goToScreen(ex.screenId, ex.position);
  run.setPlayerPosition(ex.position);
  run.tick(16, frame({ pressed: ['interact'] }));
}

/** The chapter script's own examine hook, without the default. */
export const hook = (run: object, id: string): boolean | void => (run as { script: ChapterScript }).script.onExamine?.(id);

/**
 * A new run of chapter 10 as Chapter Select makes it. Only this chapter is registered, so the five proofs chapter 9 would
 * have seeded (its `def.evidence`) are added by hand, and the Glove he learned there is learned.
 */
export async function newGame(how: 'chapter' | 'continue' = 'chapter', store?: Parameters<typeof startChapterGame>[2]) {
  const g = startChapterGame(chapter10, how, store);
  if (how === 'chapter') {
    for (const p of PROOFS) g.run.addEvidence(p as EvidenceId);
    g.run.learnMove('borrowedGlove');
  }
  g.run.tick(16, NO_INPUT);
  await settleDialogue(g.run);
  g.run.tick(16, NO_INPUT);
  await settleDialogue(g.run);
  return g;
}

/** Ticks a few frames and lets the scripts' chains run. */
export async function settle(run: Run, frames = 3): Promise<void> {
  for (let i = 0; i < frames; i++) {
    run.tick(16, NO_INPUT);
    await settleDialogue(run, 4);
  }
}

/** Keeps Andrew steady while something else is watched: no drain, a full meter. */
export function safe(run: Run): void {
  run.player.holdDrain(true);
  run.player.meter = createMeter(10, 60);
}

/** Sober enough to be sent back to the cabinet, then back. */
export async function toSober(run: Run): Promise<void> {
  run.holdDrain(false);
  run.player.meter = { ...run.player.meter, value: 0.01, tea: null };
  for (let i = 0; i < 120 && run.barReturning === null; i++) {
    run.tick(16, NO_INPUT);
    if (i % 5 === 0) await settleDialogue(run, 2);
  }
  run.completeBarReturn();
  await settle(run, 4);
}

/** The hot drink, then the trolley. */
export async function doCabinet(run: Run): Promise<void> {
  examine(run, 'c10.bar.hotDrink');
  await settle(run, 6);
  run.takeHotDrink('coffee');
}

/** E at the ticket machine: number 848, and the fight starts. */
export async function takeTicket(run: Run): Promise<void> {
  examine(run, 'c10.ticket');
  for (let i = 0; i < 6 && run.fight(FIGHT)?.active !== true; i++) await settle(run, 2);
}

/** Wins the anteroom fight, wave by wave. */
export async function winAnteroom(run: Run): Promise<void> {
  const fight = run.fight(FIGHT)!;
  for (let i = 0; i < 60 && !fight.isComplete(); i++) {
    safe(run);
    for (const a of fight.aliveActors()) run.defeat(a, 'player');
    await settle(run, 6);
  }
}

/** Through the door and in: the intro scene, then the boss starts. */
export async function intoControl(run: Run): Promise<void> {
  safe(run);
  run.goToScreen('c10.control', CONTROL_FROM_ANTE);
  for (let i = 0; i < 12 && run.boss(BOSS)?.active !== true && !run.isComplete(BOSS); i++) await settle(run, 3);
}

export const mid = (a: { x: number; y: number; width: number; height: number }) => ({ x: a.x + a.width / 2, y: a.y + a.height / 2 });

/** Walks in at the door again (the entry trigger). */
export async function walkIn(run: Run): Promise<void> {
  run.setPlayerPosition(mid(CONTROL_ENTRY_AREA));
  await settle(run, 6);
}

/** Ticks the boss for `ms` with Andrew standing still and safe. */
export function stepBoss(run: Run, ms: number, at = CONTROL_FROM_ANTE): void {
  for (let t = 0; t < ms; t += 16) {
    safe(run);
    run.setPlayerPosition(at);
    run.tick(16, frame());
  }
}

/** Beats the Administrator: he is down at 0 health. */
export async function beatBoss(run: Run): Promise<void> {
  const boss = run.boss(BOSS)!;
  for (const a of boss.aliveActors()) if (a !== boss.body('administrator')) a.knockDown();
  const body = boss.body('administrator')!;
  body.health = 0;
  body.status = 'down';
  for (let i = 0; i < 8 && !run.isComplete(BOSS); i++) {
    safe(run);
    await settle(run, 2);
  }
  await settle(run, 8);
}

/** Walking onto the dais: the intro, and the console is asked for. */
export async function toConsole(run: Run): Promise<void> {
  safe(run);
  run.setPlayerPosition(mid(CONSOLE_AREA));
  await settle(run, 8);
}

/** Plugs all five by the console's own API, right proof in the right socket. */
export async function plugAll(run: Run): Promise<void> {
  const puzzle = run.broadcast(PUZZLE)!;
  for (const [socket, proof] of SOLUTION) puzzle.plug(proof, socket);
  await settle(run, 8);
}

/** E at the big button. */
export async function pressButton(run: Run): Promise<void> {
  examine(run, 'c10.button');
  await settle(run, 4);
}

/**
 * Plays the reaction cards to the end by pressing through them, finishing scene cards' dialogue as they come, until the cut
 * to Feeney's. Returns the ids of the cards that were on view.
 */
export async function playThroughCards(run: Run, until: () => boolean = () => run.screenId === 'c10.pub'): Promise<string[]> {
  const seen: string[] = [];
  const cards = record(run.bus, 'epilogue:card');
  for (let i = 0; i < 200 && !until(); i++) {
    const c = run.activeCard();
    if (c && c.card.kind !== 'scene') await new Promise<void>((r) => setTimeout(r, 0)).then(() => run.advanceCard());
    run.tick(16, NO_INPUT);
    await settleDialogue(run, 3);
  }
  for (const e of cards) seen.push(e.cardId);
  return seen;
}

/** The whole way from the cabinet to the button, by the real triggers. */
export async function upToButton(run: Run): Promise<void> {
  await doCabinet(run);
  await takeTicket(run);
  await winAnteroom(run);
  await intoControl(run);
  await beatBoss(run);
  await toConsole(run);
  await plugAll(run);
}

/** To the pub: the button pressed, the cards played through, and Andrew at Feeney's. */
export async function toPub(run: Run): Promise<void> {
  await upToButton(run);
  await pressButton(run);
  await playThroughCards(run);
  await settle(run, 4);
}

/** E at the stool, then the epilogue and the credits through to the end. Returns the ids of the dialogue played. */
export async function sitAndFinish(run: Run): Promise<string[]> {
  const shown = record(run.bus, 'dialogue:show');
  examine(run, 'c10.pub.stool');
  for (let i = 0; i < 80 && run.activeCard() === null; i++) await settle(run, 2);
  // The title waits for a key; the credits roll for their time.
  for (let i = 0; i < 30 && run.activeCard() !== null; i++) {
    await new Promise<void>((r) => setTimeout(r, 0));
    run.advanceCard();
    await settle(run, 2);
  }
  return shown.map((s) => s.sequenceId);
}

/** Myko's call on the current section: the scene plays and the section completes. */
export async function callMyko(run: Run): Promise<void> {
  if (!run.myko.tryCall()) throw new Error('the call was refused');
  for (let i = 0; i < 400; i++) {
    run.tick(50, NO_INPUT);
    if (i % 20 === 0) await settleDialogue(run);
  }
  await settleDialogue(run);
}
