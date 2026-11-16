/**
 * Chapter 4 smoke against the built game at ?chapter=4: Paddy O'Shamrock's (the tea, the patrons, Bedside Manner, the brawl),
 * the docks (the shut gate, the stealth start, the clean run, the lunchbox, the container puzzle by real lever pulls, the
 * container and the board), and the foreman (the crane, the Slam beside the box, the shillelagh, the closing).
 * Real keyboard walking and E; the fights and the board's cards go through the run. Screenshots land in test-results/chapter4/.
 */

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { GameWindow } from './chapterKit';
import { aimAt, complete, dismissScenes, examinablePos, flag, objective, screenId, shot, shown, start, until, use, walkThroughExit, walkTo, withRun, centre } from './chapterKit';

const DIR = 'chapter4';
let errors: string[] = [];

test.setTimeout(180_000);
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
});

const missing = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as GameWindow).__game.state()?.missingDialogue ?? []);
/** Keeps Andrew well clear of sober so a heavy hit or a long wait is never what ends a test. */
const topUp = (page: Page): Promise<unknown> => withRun(page, (r) => { r.player.meter = { ...r.player.meter, value: 50 } as never; });

test('the bar: the tea by real E, the four regulars, Bedside Manner, the brawl and out the back door', async ({ page }) => {
  await start(page, 4);
  expect(await screenId(page)).toBe('c4.bar');
  expect(await page.evaluate(() => (window as unknown as GameWindow).__game.state()?.chapter)).toBe(4);
  await until(page, 'the opening to finish', async () => (await flag(page, 'intro.done')) === true, 40_000);
  await dismissScenes(page);
  await shot(page, DIR, '01-bar-arrival');

  // The tea: E at the counter, she asks hot or iced, it is hot; then "one at a time", once however hard E is pressed.
  await use(page, await examinablePos(page, 'c4.tea'), 18);
  await until(page, 'the tea in the kit', async () => (await withRun(page, (r) => r.player.kit.hotDrink)) === 'tea');
  await dismissScenes(page);
  expect(await shown(page)).toEqual(expect.arrayContaining(['c4.bar.tea', 'c4.bar.hotDrink']));
  // Colleen-Ann's own box lines must be off screen first (a line queued behind another is dropped as stale, as it should be).
  await until(page, 'her lines to clear', async () => (await withRun(page, (r) => (r.dialogue as unknown as { showing(d: string): unknown }).showing('box'))) === null, 30_000);
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(120);
  }
  await until(page, 'the one-at-a-time line', async () => (await shown(page)).includes('c4.tea.held'), 15_000);
  await dismissScenes(page);
  await page.waitForTimeout(1500); // a second copy queued by the other presses would be on screen by now
  expect((await shown(page)).filter((s) => s === 'c4.tea.held')).toHaveLength(1);
  await shot(page, DIR, '02-bar-tea');

  // The four regulars and the roster, each by walking up and pressing E.
  for (const who of ['doug', 'barb', 'kev', 'sully']) {
    await use(page, await examinablePos(page, `c4.${who}`), 18);
    await until(page, `${who} talked to`, async () => (await flag(page, `talked.${who}`)) === true);
    await dismissScenes(page);
  }
  await use(page, await examinablePos(page, 'c4.roster'), 18);
  await until(page, 'the roster read', async () => (await flag(page, 'clue.roster')) === true);
  await dismissScenes(page);
  await until(page, 'Bedside Manner offered', async () => (await objective(page)) === 'c4.manner');
  expect(await complete(page, 'c4.explore.bar')).toBe(true);
  await shot(page, DIR, '03-bar-patrons');

  // Step in at the table: the lesson. Slot 2 holds Stout Slam, so Bedside Manner goes in by hand (the Tab), then 2 near Kev.
  const kev = await examinablePos(page, 'c4.kev');
  await walkTo(page, { x: kev.x, y: kev.y + 32 });
  await until(page, 'the lesson', async () => (await flag(page, 'manner.taught')) === true);
  await dismissScenes(page);
  expect(await withRun(page, (r) => r.player.kit.moves)).toContain('bedsideManner');
  expect(await withRun(page, (r) => r.assignMove(2, 'bedsideManner'))).toBe(true);
  await walkTo(page, { x: kev.x, y: kev.y + 24 });
  await topUp(page);
  await aimAt(page, kev);
  await page.keyboard.press('Digit2');
  await until(page, 'the brawl to start', async () => (await withRun(page, (r) => r.fight('c4.fight.brawl')?.active)) === true);
  await dismissScenes(page);
  await shot(page, DIR, '04-bar-brawl');

  // Six brawlers in three waves, taken down through the run (the fight itself is covered in the unit suite).
  await until(
    page,
    'the brawl won',
    async () => {
      await topUp(page);
      await withRun(page, (r) => { for (const a of r.fight('c4.fight.brawl')?.aliveActors() ?? []) r.defeat(a, 'player'); });
      return complete(page, 'c4.fight.brawl');
    },
    40_000,
  );
  await dismissScenes(page);
  expect(await objective(page)).toBe('c4.docks');

  // The back door is open now; out on to the pier.
  await walkThroughExit(page, 'c4.bar.backdoor');
  await until(page, 'the docks screen', async () => (await screenId(page)) === 'c4.docks');
  await dismissScenes(page);
  await shot(page, DIR, '05-docks-alley');
  expect(await missing(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('the docks: the shut gate, the guards at the fence gap, a clean run, the lunchbox, the container puzzle by real pulls, the container and the board', async ({ page }) => {
  await start(page, 4);
  await until(page, 'the opening to finish', async () => (await flag(page, 'intro.done')) === true, 40_000);
  await dismissScenes(page);
  // Skip the bar (the first test covers it): out of the back door as it would deliver him.
  await withRun(page, (r) => { r.completeSection('c4.fight.brawl', 'debug'); r.addEvidence('c4.clue.roster'); });
  await withRun(page, (r) => { r.goToScreen('c4.docks', { x: 2 * 16 + 8, y: 21 * 16 + 8 }); });
  await until(page, 'the docks', async () => (await screenId(page)) === 'c4.docks');
  await dismissScenes(page);

  // The side gate is shut, and Myko says so as Andrew comes up to it.
  expect(await withRun(page, (r) => r.dressing.prop('dockGate')?.visible)).toBe(true);
  await walkTo(page, centre(7, 21));
  await until(page, 'Myko at the gate', async () => (await shown(page)).includes('c4.gate.shut'));
  await dismissScenes(page);

  // Up the alley to the gap in the fence: the guards come on.
  await walkTo(page, centre(9, 4));
  await until(page, 'the stealth section to start', async () => (await withRun(page, (r) => r.guardsHere().length)) === 4);
  await shot(page, DIR, '06-docks-stealth-start');
  expect(await complete(page, 'c4.stealth.docks')).toBe(false);

  // Through to the far side (a clean run; the route is proved in the unit suite): the gate opens, the whiskey is left on the bollard.
  await withRun(page, (r) => { r.setPlayerPosition({ x: 40 * 16, y: 13 * 16 + 8 }); });
  await until(page, 'the stealth passed', async () => complete(page, 'c4.stealth.docks'));
  await dismissScenes(page);
  expect(await flag(page, 'docks.clean')).toBe(true);
  expect(await withRun(page, (r) => r.dressing.prop('dockGate')?.visible)).toBe(false);
  expect(await withRun(page, (r) => r.guardsHere().length)).toBe(0);
  await walkTo(page, centre(41, 6));
  await until(page, 'the lunchbox whiskey', async () => ((await withRun(page, (r) => r.player.kit.drinks['whiskey'])) ?? 0) >= 1);
  await dismissScenes(page);
  await shot(page, DIR, '07-docks-clean-run');

  // The container puzzle: six real pulls. Two on A, three on B, one on C.
  const pulls = [['c4.leverA', 2], ['c4.leverB', 3], ['c4.leverC', 1]] as const;
  for (const [id, n] of pulls) {
    const at = await examinablePos(page, id);
    for (let i = 0; i < n; i++) {
      const before = await withRun(page, (r) => r.slidePuzzlesHere()[0]?.puzzle.isComplete());
      expect(before).toBe(false);
      await walkTo(page, { x: at.x, y: at.y + 16 });
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(700); // the piece slides over about half a second; one E is one pull
    }
  }
  await until(page, 'the puzzle solved', async () => complete(page, 'c4.puzzle.containers'));
  await dismissScenes(page);
  await shot(page, DIR, '08-docks-containers-solved');

  // The container: in at the hatch, the seizure notice, and the board.
  const seizure = await examinablePos(page, 'c4.seizure');
  await use(page, seizure, 18);
  await until(page, 'the board to open', async () => (await withRun(page, (r) => r.activeDeduction()?.isOpen)) === true);
  await shot(page, DIR, '09-docks-board');
  await withRun(page, (r) => { r.addEvidence('c3.clue.manifest'); });
  expect(await withRun(page, (r) => r.submitDeduction('c4.deduction.dc', ['c4.clue.seizure', 'c4.clue.roster', 'c3.clue.manifest']))).toBe(true);
  await dismissScenes(page);
  expect(await objective(page)).toBe('c4.foreman');
  expect(await missing(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('the foreman: the crane\'s shadow, the Slam beside the control box, phase 2, the shillelagh and the closing', async ({ page }) => {
  await start(page, 4);
  await until(page, 'the opening to finish', async () => (await flag(page, 'intro.done')) === true, 40_000);
  await dismissScenes(page);
  await withRun(page, (r) => { for (const id of ['c4.fight.brawl', 'c4.stealth.docks', 'c4.puzzle.containers', 'c4.deduction.dc']) r.completeSection(id, 'debug'); });
  await withRun(page, (r) => { r.goToScreen('c4.docks', { x: 41 * 16 + 8, y: 25 * 16 + 8 }); });
  await until(page, 'the docks', async () => (await screenId(page)) === 'c4.docks');
  await dismissScenes(page);

  // Walk into the arena: the foreman arrives.
  await walkTo(page, centre(52, 21));
  await until(page, 'the foreman to start', async () => (await withRun(page, (r) => r.boss('c4.boss.foreman')?.active)) === true, 25_000);
  await dismissScenes(page);
  await topUp(page);
  // The crane's shadow lies along its lane before the container moves.
  await until(page, 'the crane\'s shadow', async () => (await withRun(page, (r) => r.sweepsHere().length)) > 0, 10_000);
  await shot(page, DIR, '10-foreman-crane-shadow');
  expect(await withRun(page, (r) => r.boss('c4.boss.foreman')?.phase?.id)).toBe('crane');

  // Beside the control box, the Slam knocks him off it.
  const box = await withRun(page, (r) => r.boss('c4.boss.foreman')?.body('foreman')?.pos);
  if (!box) throw new Error('no foreman body');
  await withRun(page, (r) => { r.learnMove('stoutSlam'); });
  await walkTo(page, { x: box.x - 16, y: box.y + 16 });
  await topUp(page);
  await aimAt(page, box);
  await page.keyboard.press('Digit2');
  await until(page, 'phase 2', async () => (await withRun(page, (r) => r.boss('c4.boss.foreman')?.phase?.id)) === 'onFoot', 10_000);
  await dismissScenes(page);
  await shot(page, DIR, '11-foreman-on-foot');

  // Done with him: the shillelagh is left on the box, KISS ME and all.
  await withRun(page, (r) => { r.completeSection('c4.boss.foreman', 'player'); });
  await dismissScenes(page);
  expect(await withRun(page, (r) => r.dressing.prop('shillelagh')?.visible)).toBe(true);
  await shot(page, DIR, '12-foreman-shillelagh');
  await use(page, await examinablePos(page, 'c4.shillelagh'), 18);
  await until(page, 'the shillelagh taken', async () => ((await withRun(page, (r) => r.player.kit.weapons)) as string[]).includes('shillelagh'), 20_000);
  await dismissScenes(page, 30_000);
  expect(await missing(page)).toEqual([]);
  expect(errors).toEqual([]);
});
