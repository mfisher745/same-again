/**
 * Chapter 3 smoke against the built game at ?chapter=3: the social club (the kettle), the yard (the guards at the fence gap),
 * the office (the clues, Same Again and the cabinet), the bay (the crate puzzle solved by nine real pushes, the manifest, the
 * night shift, the board) and Halloran. Real keyboard walking, E and mouse swings; the night shift and the board's cards go
 * through the run. Screenshots land in test-results/chapter3/.
 */

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { GameWindow, Vec } from './chapterKit';
import { TILE, aimAt, centre, complete, dismissScenes, examinablePos, flag, objective, screenId, shot, shown, start, until, use, walkThroughExit, walkTo, withRun } from './chapterKit';

const DIR = 'chapter3';
let errors: string[] = [];

test.setTimeout(240_000);
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
});

const missing = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as GameWindow).__game.state()?.missingDialogue ?? []);
const topUp = (page: Page): Promise<unknown> => withRun(page, (r) => { r.player.meter = { ...r.player.meter, value: 50 } as never; });

/** A real swing: aim with the mouse, click. */
async function swing(page: Page, at: Vec): Promise<void> {
  await aimAt(page, at);
  await page.mouse.down();
  await page.waitForTimeout(60);
  await page.mouse.up();
  await page.waitForTimeout(500);
}

test('the social club, the yard, the office: the kettle, the guards, the clues, Same Again and the cabinet', async ({ page }) => {
  await start(page, 3);
  expect(await screenId(page)).toBe('c3.yard');
  expect(await page.evaluate(() => (window as unknown as GameWindow).__game.state()?.chapter)).toBe(3);
  await until(page, 'the opening to finish', async () => (await flag(page, 'intro.done')) === true, 40_000);
  await dismissScenes(page);
  await shot(page, DIR, '01-social-club');

  // The kettle: its free hot drink (taken through the run, as the menu does), then E says "one at a time", once however hard E is pressed.
  expect(await withRun(page, (r) => r.takeHotDrink('tea'))).toBe(true);
  await until(page, 'the scenes to clear', async () => (await withRun(page, (r) => (r.dialogue as unknown as { showing(d: string): unknown }).showing('box'))) === null, 30_000);
  await use(page, await examinablePos(page, 'c3.kettle'), 18);
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(120);
  }
  await until(page, 'the kettle line', async () => (await shown(page)).includes('c3.kettle.held'), 15_000);
  await dismissScenes(page);
  await page.waitForTimeout(1500);
  expect((await shown(page)).filter((s) => s === 'c3.kettle.held')).toHaveLength(1);

  // Out of the club and across to the gap behind the skip: the guards come on.
  await walkTo(page, centre(14, 21));
  await until(page, 'the yard section to start', async () => (await withRun(page, (r) => r.guardsHere().length)) === 3);
  await dismissScenes(page);
  await shot(page, DIR, '02-yard-stealth-start');
  expect(await complete(page, 'c3.explore.bar')).toBe(true);

  // A clean run to the office door (the route is proved in the unit suite): the logbook shows on the watchman's chair.
  await withRun(page, (r) => { r.setPlayerPosition({ x: 34 * 16, y: 3 * 16 + 8 }); });
  await until(page, 'the yard passed', async () => complete(page, 'c3.stealth.yard'));
  await dismissScenes(page);
  expect(await withRun(page, (r) => r.dressing.prop('yard.logbook')?.visible)).toBe(true);
  await shot(page, DIR, '03-yard-clean-run');
  await walkThroughExit(page, 'c3.yard.door');
  await until(page, 'the office', async () => (await screenId(page)) === 'c3.office');
  await dismissScenes(page);
  await shot(page, DIR, '04-office');

  // The clues, each by walking up to it and pressing E.
  for (const id of ['c3.map', 'c3.brochure', 'c3.certificate', 'c3.visitors']) {
    await use(page, await examinablePos(page, id), 18);
    await page.waitForTimeout(200);
    await dismissScenes(page);
  }
  expect(await flag(page, 'clue.map')).toBe(true);
  expect(await flag(page, 'clue.brochure')).toBe(true);
  expect(await objective(page)).toBe('c3.cabinet');
  await shot(page, DIR, '05-office-clues');

  // The cabinet: one swing dents it and Myko explains (Same Again is learned); with it in slot 2 and used, the next opens it.
  const cabinet = centre(28, 3);
  await walkTo(page, centre(28, 4));
  await topUp(page);
  await swing(page, cabinet);
  await until(page, 'the lesson', async () => (await flag(page, 'cabinet.dented')) === true);
  await until(page, 'Same Again learned', async () => ((await withRun(page, (r) => r.player.kit.moves)) as string[]).includes('sameAgain'), 20_000);
  await dismissScenes(page);
  expect(await withRun(page, (r) => r.assignMove(2, 'sameAgain'))).toBe(true);
  await walkTo(page, centre(28, 4));
  await topUp(page);
  await aimAt(page, cabinet);
  await page.keyboard.press('Digit2');
  await page.waitForTimeout(200);
  for (let i = 0; i < 4 && (await flag(page, 'cabinet.open')) !== true; i++) await swing(page, cabinet);
  await until(page, 'the cabinet open', async () => (await flag(page, 'cabinet.open')) === true);
  await dismissScenes(page);
  await shot(page, DIR, '06-office-cabinet-open');
  expect(await complete(page, 'c3.explore.office')).toBe(true);

  // The whiskey filed under W was on the floor where he stood; the way to the bay is unlocked, and he walks it.
  expect(await withRun(page, (r) => r.player.kit.drinks['whiskey'])).toBe(1);
  await walkThroughExit(page, 'c3.office.bay');
  await until(page, 'the bay', async () => (await screenId(page)) === 'c3.bay');
  await dismissScenes(page);
  expect(await missing(page)).toEqual([]);
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// The crate puzzle by real pushes
// ---------------------------------------------------------------------------

interface Cell { col: number; row: number }
type Dir = 'up' | 'down' | 'left' | 'right';
const D: Record<Dir, Cell> = { up: { col: 0, row: -1 }, down: { col: 0, row: 1 }, left: { col: -1, row: 0 }, right: { col: 1, row: 0 } };
const KEY: Record<Dir, string> = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };

/** Fewest-push solution, Andrew walking round to the pushing side. Reads only what the running game reports. */
function solve(area: { col: number; row: number; width: number; height: number }, fixed: Cell[], crates: Cell[], road: Cell[], blocked: boolean[], w: number, player: Cell): { crate: Cell; dir: Dir }[] {
  const key = (c: number, r: number) => r * w + c;
  const inArea = (c: number, r: number) => c >= area.col && r >= area.row && c < area.col + area.width && r < area.row + area.height;
  const isFixed = (c: number, r: number) => fixed.some((f) => f.col === c && f.row === r);
  const walkable = (c: number, r: number, occupied: Set<number>) => !blocked[key(c, r)] && !isFixed(c, r) && !occupied.has(key(c, r));
  const flood = (occupied: Set<number>, from: Cell): Set<number> => {
    const seen = new Set<number>([key(from.col, from.row)]);
    const stack = [from];
    for (let t = stack.pop(); t; t = stack.pop()) {
      for (const d of Object.values(D)) {
        const c = t.col + d.col;
        const r = t.row + d.row;
        if (seen.has(key(c, r)) || !walkable(c, r, occupied)) continue;
        seen.add(key(c, r));
        stack.push({ col: c, row: r });
      }
    }
    return seen;
  };
  const clear = (cs: Cell[]) => road.every((r) => !cs.some((c) => c.col === r.col && c.row === r.row));
  interface Node { crates: Cell[]; player: Cell; prev: Node | null; push: { crate: Cell; dir: Dir } | null }
  const canon = (crates: Cell[], reach: Set<number>) => `${crates.map((c) => key(c.col, c.row)).sort((a, b) => a - b).join(',')}#${Math.min(...reach)}`;
  const first: Node = { crates, player, prev: null, push: null };
  const seen = new Set<string>([canon(crates, flood(new Set(crates.map((c) => key(c.col, c.row))), player))]);
  let frontier: Node[] = [first];
  while (frontier.length > 0) {
    const next: Node[] = [];
    for (const n of frontier) {
      if (clear(n.crates)) {
        const out: { crate: Cell; dir: Dir }[] = [];
        for (let m: Node | null = n; m?.push; m = m.prev) out.unshift(m.push);
        return out;
      }
      const occupied = new Set(n.crates.map((c) => key(c.col, c.row)));
      const reach = flood(occupied, n.player);
      for (const c of n.crates) {
        for (const dir of Object.keys(D) as Dir[]) {
          const d = D[dir];
          if (!reach.has(key(c.col - d.col, c.row - d.row))) continue;
          const to = { col: c.col + d.col, row: c.row + d.row };
          if (!inArea(to.col, to.row) || !walkable(to.col, to.row, occupied)) continue;
          const moved = n.crates.map((o) => (o === c ? to : o));
          const k = canon(moved, flood(new Set(moved.map((m) => key(m.col, m.row))), c));
          if (seen.has(k)) continue;
          seen.add(k);
          next.push({ crates: moved, player: c, prev: n, push: { crate: c, dir } });
        }
      }
    }
    frontier = next;
  }
  throw new Error('the crate puzzle has no solution from here');
}

test('the bay: the crate puzzle by nine real pushes, the manifest, the night shift, the board, One for the Road and Halloran', async ({ page }) => {
  await start(page, 3);
  await until(page, 'the opening to finish', async () => (await flag(page, 'intro.done')) === true, 40_000);
  await dismissScenes(page);
  // Skip what the first test covers: the yard and the office are done; he arrives in the bay as the office door would deliver him.
  await withRun(page, (r) => { for (const id of ['c3.explore.bar', 'c3.stealth.yard']) r.completeSection(id, 'debug'); });
  await withRun(page, (r) => { r.addEvidence('c3.clue.map'); r.addEvidence('c3.clue.brochure'); r.addEvidence('c2.clue.fragment'); });
  await withRun(page, (r) => { r.goToScreen('c3.bay', { x: 3 * 16 + 8, y: 17 * 16 + 8 }); });
  await until(page, 'the bay', async () => (await screenId(page)) === 'c3.bay');
  await dismissScenes(page);
  await shot(page, DIR, '07-bay-crates');
  expect(await shown(page)).toContain('c3.crates.intro');

  // Plan from what the running game says about the pen, then push.
  const info = await page.evaluate(() => {
    const r = (window as unknown as GameWindow).__game.session.run;
    const pz = r?.pushPuzzlesHere()[0]?.puzzle;
    if (!r || !pz) throw new Error('no puzzle');
    const layout = pz.layout as unknown as { area: { col: number; row: number; width: number; height: number }; fixed: { col: number; row: number }[]; goal: { cells: { col: number; row: number }[] } };
    return { area: layout.area, fixed: layout.fixed, road: layout.goal.cells, crates: pz.piecePositions(), blocked: r.grid.blocked, w: r.grid.widthTiles, player: { col: Math.floor(r.player.pos.x / 16), row: Math.floor(r.player.pos.y / 16) } };
  });
  const plan = solve(info.area, info.fixed, info.crates.map((c) => ({ col: c.col, row: c.row })), info.road, info.blocked, info.w, info.player);
  expect(plan).toHaveLength(9);

  const pieces = () => withRun(page, (r) => r.pushPuzzlesHere()[0]?.puzzle.piecePositions() ?? []);
  for (const [i, step] of plan.entries()) {
    const now = await pieces();
    const crate = now.find((c) => c.col === step.crate.col && c.row === step.crate.row);
    if (!crate) throw new Error(`push ${i}: no crate at ${JSON.stringify(step.crate)}`);
    const d = D[step.dir];
    const blocked = now.map((c) => ({ col: c.col, row: c.row }));
    // Square up on the tile he is on first (a push can leave him half a tile off), then to the pushing side.
    const here = await withRun(page, (r) => r.player.pos);
    await walkTo(page, centre(Math.floor(here.x / TILE), Math.floor(here.y / TILE)), { extraBlocked: blocked });
    await walkTo(page, centre(crate.col - d.col, crate.row - d.row), { extraBlocked: blocked });
    await page.keyboard.down(KEY[step.dir]);
    try {
      await until(page, `push ${i + 1} of 9`, async () => {
        const after = (await pieces()).find((c) => c.id === crate.id);
        return after !== undefined && (after.col !== crate.col || after.row !== crate.row);
      }, 6000);
    } finally {
      await page.keyboard.up(KEY[step.dir]);
    }
    await page.waitForTimeout(250);
  }
  await until(page, 'the puzzle complete', async () => complete(page, 'c3.puzzle.crates'));
  await dismissScenes(page);
  await shot(page, DIR, '08-bay-crates-solved');

  // The manifest: the lights come on and the night shift is there, four on the gantry and two in hi-vis.
  await use(page, await examinablePos(page, 'c3.manifest'), 18);
  await until(page, 'the night shift', async () => (await withRun(page, (r) => r.fight('c3.fight.bay')?.active)) === true, 30_000);
  await dismissScenes(page);
  await shot(page, DIR, '09-bay-night-shift');
  await until(
    page,
    'the night shift beaten',
    async () => {
      await topUp(page);
      await withRun(page, (r) => { for (const a of r.fight('c3.fight.bay')?.aliveActors() ?? []) r.defeat(a, 'player'); });
      return complete(page, 'c3.fight.bay');
    },
    30_000,
  );
  await until(page, 'the board', async () => (await withRun(page, (r) => r.activeDeduction()?.isOpen)) === true, 30_000);
  await shot(page, DIR, '10-bay-board');
  expect(await withRun(page, (r) => r.submitDeduction('c3.deduction.boston', ['c3.clue.map', 'c3.clue.manifest', 'c2.clue.fragment']))).toBe(true);
  await dismissScenes(page);
  expect(await objective(page)).toBe('c3.halloran');

  // By the doors: One for the Road. Then into the bay: Halloran and his forklift.
  await walkTo(page, centre(30, 20));
  await until(page, 'One for the Road', async () => ((await withRun(page, (r) => r.player.kit.moves)) as string[]).includes('oneForTheRoad'), 25_000);
  await dismissScenes(page);
  await walkTo(page, centre(24, 12));
  await until(page, 'Halloran to start', async () => (await withRun(page, (r) => r.boss('c3.boss.halloran')?.active)) === true, 30_000);
  await dismissScenes(page);
  await shot(page, DIR, '11-bay-halloran');
  expect(await missing(page)).toEqual([]);

  // Done with him: the clipboard, then the closing.
  await withRun(page, (r) => { r.completeSection('c3.boss.halloran', 'player'); });
  await until(page, 'the clipboard', async () => ((await withRun(page, (r) => r.player.kit.weapons)) as string[]).includes('clipboard'), 30_000);
  await dismissScenes(page, 30_000);
  expect(await missing(page)).toEqual([]);
  expect(errors).toEqual([]);
});
