/**
 * The two-phase return to the bar in a real browser (DESIGN.md 7.1 "Back to the bar"). The unit suite covers the
 * run, the model and the audio; this covers what needs a real Phaser scene: HudScene and ReturnDirector.
 *
 * - "in the game": the built game at ?chapter=1 (the Playwright config's base URL), a real run, a real return.
 * - "dev harness": the UI harness on the Vite dev server (`pnpm dev`, port 5173), FakeSource, the same two buttons a
 *   person presses. Skipped if the dev server is not running; the harness is not part of the build.
 *
 * Both read scene state (the HUD's `returnPhase`, the overlay tracker, the Game scene's pause) through the running
 * game, never with fixed sleeps.
 */

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface Run {
  barReturning: { reason: string } | null;
  player: { pos: { x: number; y: number }; meter: { value: number } };
  screenLayout: { playerStart: { x: number; y: number } };
  completeBarReturn(): void;
  hitPlayer(hit: object): boolean;
  myko: { mode: string };
}
interface HudInternals {
  returnPhase: 'none' | 'live' | 'covered';
  shared: { overlays: { isOpen(k: string): boolean; any: boolean } };
  returns: { frame: { stage: string; cover: number } | null };
}
interface GameWindow {
  __game: { session: { run: Run | null; bus: { on(ev: string, fn: (p: unknown) => void): () => void } }; state(): unknown };
  __phaserGame: { scene: { isPaused(k: string): boolean; getScene(k: string): unknown } };
  __qa_returns?: { returning: number; returned: number; completeCalls: number; events: string[] };
}

const HUD = 'UiHud';
let errors: string[] = [];

test.setTimeout(60_000);
test.beforeEach(({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
});
test.afterEach(() => {
  expect(errors).toEqual([]);
});

const hudPhase = (page: Page): Promise<string> =>
  page.evaluate((k) => ((window as unknown as GameWindow).__phaserGame.scene.getScene(k) as HudInternals).returnPhase, HUD);
const waitPhase = (page: Page, phase: string): Promise<unknown> =>
  page.waitForFunction(([k, want]) => ((window as unknown as GameWindow).__phaserGame.scene.getScene(k as string) as HudInternals).returnPhase === want, [HUD, phase], { timeout: 20_000, polling: 25 });

async function startGame(page: Page): Promise<void> {
  await page.goto('./?chapter=1');
  await page.waitForFunction(() => {
    const g = (window as unknown as GameWindow).__game;
    return g?.session.run != null && g.state() !== null;
  });
  await page.locator('canvas').click({ position: { x: 5, y: 5 }, button: 'middle' });
  // The opening scene is on: the run does not tick until it is dismissed.
  const end = Date.now() + 25_000;
  let quiet = 0;
  while (quiet < 3) {
    if (Date.now() > end) throw new Error('the opening scene never cleared');
    if (await page.evaluate(() => (window as unknown as { __game: { session: { run: { dialogue: { blocking: boolean } } } } }).__game.session.run.dialogue.blocking)) {
      quiet = 0;
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(40);
    } else {
      quiet++;
      await page.waitForTimeout(60);
    }
  }
  // Count what the return does: events, and calls into the run.
  await page.evaluate(() => {
    const w = window as unknown as GameWindow;
    const run = w.__game.session.run as Run;
    const rec = { returning: 0, returned: 0, completeCalls: 0, events: [] as string[] };
    w.__qa_returns = rec;
    w.__game.session.bus.on('bar:returning', () => {
      rec.returning++;
      rec.events.push('returning');
    });
    w.__game.session.bus.on('bar:returned', () => {
      rec.returned++;
      rec.events.push('returned');
    });
    const orig = run.completeBarReturn.bind(run);
    run.completeBarReturn = () => {
      rec.completeCalls++;
      orig();
    };
  });
}
const counts = (page: Page) => page.evaluate(() => (window as unknown as GameWindow).__qa_returns);

/** Move Andrew off the start so a completed return is seen to move him, then make the meter return him. */
async function trigger(page: Page, reason: 'sober' | 'floor'): Promise<void> {
  await page.evaluate((r) => {
    const run = (window as unknown as GameWindow).__game.session.run as Run;
    run.player.pos = { x: run.screenLayout.playerStart.x + 40, y: run.screenLayout.playerStart.y };
    // Same ways the unit tests use: the meter at the bottom, or a hit from the top of Fecked.
    if (r === 'sober') run.player.meter = { ...run.player.meter, value: 0.01 };
    else {
      run.player.meter = { ...run.player.meter, value: 99.9 };
      run.hitPlayer({ source: { kind: 'hazard', hazardId: 'x' }, amount: 0, knockback: { x: 0, y: 0 }, stunMs: 0, holdMs: 0, weight: 'worst' });
    }
  }, reason);
}

test.describe('in the game', () => {
  for (const reason of ['sober', 'floor'] as const) {
    test(`${reason}: the world freezes unpaused, completes once at black, then resumes`, async ({ page }) => {
      await startGame(page);
      const before = await page.evaluate(() => {
        const run = (window as unknown as GameWindow).__game.session.run as Run;
        return { start: run.screenLayout.playerStart };
      });
      await trigger(page, reason);
      await page.waitForFunction(() => (window as unknown as GameWindow).__game.session.run?.barReturning != null, undefined, { polling: 10 });

      // Phase one: frozen where he was, not paused, nothing completed yet.
      expect(await hudPhase(page)).toBe('live');
      const first = await page.evaluate(() => {
        const w = window as unknown as GameWindow;
        const hud = w.__phaserGame.scene.getScene('UiHud') as HudInternals;
        const run = w.__game.session.run as Run;
        return { paused: w.__phaserGame.scene.isPaused('Game'), overlay: hud.shared.overlays.isOpen('return'), any: hud.shared.overlays.any, at: run.player.pos, reason: run.barReturning?.reason };
      });
      expect(first.reason).toBe(reason);
      expect(first.paused).toBe(false);
      expect(first.overlay).toBe(false);
      expect(first.at).not.toEqual(before.start);
      expect(await counts(page)).toMatchObject({ returning: 1, returned: 0, completeCalls: 0 });

      // Input is blocked in the first phase: Esc and Tab open nothing.
      await page.keyboard.press('Escape');
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => ((window as unknown as GameWindow).__phaserGame.scene.getScene('UiHud') as HudInternals).shared.overlays.any)).toBe(false);

      // Black: the overlay opens and the game pauses together, and the run was completed by the scene, once.
      await waitPhase(page, 'covered');
      const black = await page.evaluate(() => {
        const w = window as unknown as GameWindow;
        const hud = w.__phaserGame.scene.getScene('UiHud') as HudInternals;
        const run = w.__game.session.run as Run;
        return { paused: w.__phaserGame.scene.isPaused('Game'), overlay: hud.shared.overlays.isOpen('return'), waiting: run.barReturning, at: run.player.pos };
      });
      expect(black.overlay).toBe(true);
      expect(black.paused).toBe(true);
      expect(black.waiting).toBeNull();
      expect(black.at).toEqual(before.start);
      expect(await counts(page)).toMatchObject({ returning: 1, returned: 1, completeCalls: 1, events: ['returning', 'returned'] });

      // Done: resumed, nothing else completed.
      await waitPhase(page, 'none');
      expect(await page.evaluate(() => (window as unknown as GameWindow).__phaserGame.scene.isPaused('Game'))).toBe(false);
      expect(await counts(page)).toMatchObject({ returning: 1, returned: 1, completeCalls: 1 });
    });
  }

  test('floor: Myko is sent hurrying while the world is frozen', async ({ page }) => {
    await startGame(page);
    await trigger(page, 'floor');
    await page.waitForFunction(() => (window as unknown as GameWindow).__game.session.run?.barReturning != null, undefined, { polling: 10 });
    expect(await page.evaluate(() => ((window as unknown as GameWindow).__game.session.run as Run).myko.mode)).toBe('scripted');
    await waitPhase(page, 'none');
    expect(await page.evaluate(() => ((window as unknown as GameWindow).__game.session.run as Run).myko.mode)).not.toBe('scripted');
  });

  test('a return completed without the scene (the failsafe path) jumps to black and the scene does not complete it again', async ({ page }) => {
    await startGame(page);
    await trigger(page, 'sober');
    await waitPhase(page, 'live');
    // Stand in for the failsafe: complete it from outside, mid-first-phase.
    await page.evaluate(() => {
      const run = (window as unknown as GameWindow).__game.session.run as Run;
      // The wrapper counts this call; the scene's own call would make it two.
      run.completeBarReturn();
    });
    await waitPhase(page, 'covered');
    const c = await counts(page);
    expect(c).toMatchObject({ returning: 1, returned: 1, completeCalls: 1 });
    await waitPhase(page, 'none');
    expect(await counts(page)).toMatchObject({ returned: 1, completeCalls: 1 });
    expect(await page.evaluate(() => (window as unknown as GameWindow).__phaserGame.scene.isPaused('Game'))).toBe(false);
  });
});

const DEV = 'http://localhost:5173/same-again/src/ui/dev/harness.html?hud=1';

interface DevWindow {
  __dev: {
    source: { barReturning(): unknown; completeBarReturn(): void; returnToBar(r: string): void; buzzValue: number };
    game: { scene: { getScene(k: string): unknown } };
    returnSober(): void;
    returnFloor(): void;
  };
}

test.describe('dev harness', () => {
  test.beforeEach(async ({ page, request }) => {
    const up = await request.get(DEV).then(
      (r) => r.ok(),
      () => false,
    );
    test.skip(!up, 'the Vite dev server is not running on :5173 (pnpm dev)');
    await page.goto(DEV);
    await page.waitForFunction(() => (window as unknown as DevWindow).__dev?.game.scene.getScene('UiHud') != null);
    await page.evaluate(() => {
      // The harness has no `__phaserGame`; give it one so the helpers above work on both pages.
      const d = window as unknown as DevWindow & GameWindow;
      d.__phaserGame = d.__dev.game as unknown as GameWindow['__phaserGame'];
      const w = window as unknown as DevWindow & { __n: { complete: number; returned: number } };
      const s = w.__dev.source;
      w.__n = { complete: 0, returned: 0 };
      const orig = s.completeBarReturn.bind(s);
      s.completeBarReturn = () => {
        w.__n.complete++;
        orig();
      };
      (s as unknown as { bus: { on(e: string, f: () => void): void } }).bus.on('bar:returned', () => void w.__n.returned++);
    });
  });

  for (const reason of ['sober', 'floor'] as const) {
    test(`${reason}: the HUD plays to black, completes the source once there, then finishes`, async ({ page }) => {
      await page.evaluate((r) => (r === 'sober' ? (window as unknown as DevWindow).__dev.returnSober() : (window as unknown as DevWindow).__dev.returnFloor()), reason);
      expect(await hudPhase(page)).toBe('live');
      expect(await page.evaluate(() => (window as unknown as DevWindow).__dev.source.barReturning())).not.toBeNull();
      // A second press while waiting is ignored.
      await page.evaluate((r) => (window as unknown as DevWindow).__dev.source.returnToBar(r === 'sober' ? 'floor' : 'sober'), reason);
      await waitPhase(page, 'covered');
      expect(await page.evaluate(() => (window as unknown as DevWindow).__dev.source.barReturning())).toBeNull();
      expect(await page.evaluate(() => ((window as unknown as DevWindow & { __n: unknown }).__n))).toEqual({ complete: 1, returned: 1 });
      const stage = await page.evaluate(() => ((window as unknown as DevWindow).__dev.game.scene.getScene('UiHud') as HudInternals).returns.frame?.stage);
      expect(['black', 'reveal']).toContain(stage);
      await waitPhase(page, 'none');
      expect(await page.evaluate(() => ((window as unknown as DevWindow & { __n: unknown }).__n))).toEqual({ complete: 1, returned: 1 });
    });
  }
});
