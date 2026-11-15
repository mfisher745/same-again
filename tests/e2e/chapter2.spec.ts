/** Chapter 2 smoke: ?chapter=2 loads at the lean-to, the opening plays, and the first beats (the clues and the van) are reached. */

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface Run {
  flag(k: string): unknown;
  screenId: string;
  objective(): string | null;
  dialogue: { blocking: boolean };
  player: { kit: { bottles: number } };
  setPlayerPosition(p: { x: number; y: number }): void;
  guardsHere(): unknown[];
  isComplete(id: string): boolean;
}
interface GameWindow {
  __game: { session: { run: Run | null }; state(): { chapter: number | null; screenId: string | null; missingDialogue: string[] } | null };
}

const errors: string[] = [];
test.setTimeout(90_000);
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
});

const run = <T>(page: Page, fn: (r: Run) => T): Promise<T> =>
  page.evaluate(`(${fn.toString()})((window).__game.session.run)`) as Promise<T>;

async function clearScenes(page: Page, until: () => Promise<boolean>): Promise<void> {
  const end = Date.now() + 40_000;
  while (Date.now() < end) {
    if (await until()) return;
    if (await run(page, (r) => r.dialogue.blocking)) await page.keyboard.press('KeyE');
    await page.waitForTimeout(50);
  }
  throw new Error('timed out');
}

test('?chapter=2 starts at the lean-to and reaches the first beats', async ({ page }) => {
  await page.goto('./?chapter=2');
  await page.waitForFunction(() => {
    const g = (window as unknown as GameWindow).__game;
    return g?.session.run != null && g.state() !== null;
  });
  await page.locator('canvas').click({ position: { x: 5, y: 5 }, button: 'middle' });
  expect(await page.evaluate(() => (window as unknown as GameWindow).__game.state()?.chapter)).toBe(2);
  expect(await run(page, (r) => r.screenId)).toBe('c2.bog');
  expect(await run(page, (r) => r.player.kit.bottles)).toBeGreaterThanOrEqual(2);

  // The opening plays and sets the first objective.
  await clearScenes(page, async () => (await run(page, (r) => r.flag('intro.done'))) === true);
  expect(await run(page, (r) => r.objective())).toBe('c2.ring');

  // Examine the three key clues with E; the van and the Department men follow and the crossing starts.
  for (const [col, row, key] of [[25, 13, 'clue.ring'], [29, 13, 'clue.fragment'], [34, 14, 'clue.tracks']] as const) {
    await page.evaluate(([c, r]) => (window as unknown as GameWindow & { __game: { session: { run: Run } } }).__game.session.run.setPlayerPosition({ x: (c as number) * 16 + 8, y: (r as number) * 16 + 8 }), [col, row]);
    await clearScenes(page, async () => !(await run(page, (r) => r.dialogue.blocking)));
    await page.keyboard.press('KeyE');
    await clearScenes(page, async () => (await page.evaluate((k) => (window as unknown as GameWindow).__game.session.run?.flag(k), key)) === true);
  }
  await clearScenes(page, async () => (await run(page, (r) => r.guardsHere().length)) === 3);
  expect(await run(page, (r) => r.objective())).toBe('c2.cross');
  expect(await page.evaluate(() => (window as unknown as GameWindow).__game.state()?.missingDialogue)).toEqual([]);
  expect(errors).toEqual([]);
});
