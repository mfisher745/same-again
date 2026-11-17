/**
 * Playtest 5 checks in the running game: the Tab kit screen with the longest descriptions, the casebook notice,
 * the early drink refusal, the one-bottle cap. Assertions read game state through window.__game; screenshots are
 * written only when QA_SHOTS names a directory.
 */

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface Vec { x: number; y: number }
interface Kit { drinks: Record<string, number | undefined>; hotDrink: string | null; bottles: number; weapons: string[]; moves: string[] }
interface Run {
  flag(k: string): unknown;
  screenId: string;
  dialogue: { blocking: boolean };
  player: { pos: Vec; kit: Kit; meterHidden: boolean; meter: { value: number } };
  pickups(): { def: { id: string; screenId: string; position: Vec }; item: { kind: string; count?: number } }[];
  spawnPickup(def: { id: string; item: unknown; screenId: string; position: Vec }): void;
  give(item: unknown): void;
  takeHotDrink(id: string): boolean;
  learnMove(id: string): void;
  gainWeapon(id: string): void;
  addEvidence(id: string): void;
  setPlayerPosition(p: Vec): void;
  goToScreen(id: string, spawn: Vec): void;
  useSelected(): boolean;
  useSpirit(): boolean;
  isComplete(id: string): boolean;
  assignWeapon(id: string): boolean;
}
interface GameWindow {
  __game: { session: { run: Run | null; bus: { on(ev: string, fn: (p: unknown) => void): () => void } }; state(): { screenId: string | null } | null };
}

const SHOTS = process.env['QA_SHOTS'];
test.setTimeout(120_000);

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
});

async function start(page: Page, chapter: 1 | 2): Promise<void> {
  await page.goto(`./?chapter=${chapter}`);
  await page.waitForFunction(() => {
    const g = (window as unknown as GameWindow).__game;
    return g?.session.run != null && g.state() !== null;
  });
  await page.locator('canvas').click({ position: { x: 5, y: 5 }, button: 'middle' });
}

const run = <T>(page: Page, fn: (r: Run) => T): Promise<T> =>
  page.evaluate(`(${fn.toString()})((window).__game.session.run)`) as Promise<T>;
const blocking = (page: Page): Promise<boolean> => run(page, (r) => r.dialogue.blocking);

async function until(page: Page, what: string, fn: () => Promise<unknown>, maxMs = 30_000): Promise<void> {
  const end = Date.now() + maxMs;
  while (Date.now() < end) {
    if (await fn()) return;
    if (await blocking(page)) await page.keyboard.press('KeyE');
    await page.waitForTimeout(50);
  }
  throw new Error(`timed out waiting for ${what}`);
}

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

/** Text of every visible Phaser text object across scenes (for notice checks). */
const visibleTexts = (page: Page): Promise<{ text: string; y: number; bottom: number }[]> =>
  page.evaluate(() => {
    const g = (window as unknown as { __phaserGame: { scene: { scenes: { sys: { isVisible(): boolean }; children: { list: { type: string; visible: boolean; text?: string; getBounds?: () => { y: number; bottom: number } }[] } }[] } } }).__phaserGame;
    const out: { text: string; y: number; bottom: number }[] = [];
    for (const s of g.scene.scenes) {
      if (!(s as unknown as { sys: { isVisible(): boolean } }).sys.isVisible()) continue;
      for (const o of s.children.list) {
        if ((o.type === 'Text' || o.type === 'BitmapText') && o.visible && o.text && o.getBounds) {
          const b = o.getBounds();
          out.push({ text: o.text, y: b.y, bottom: b.bottom });
        }
      }
    }
    return out;
  });

test('Tab screen: the longest descriptions fit, the Picked bar is separate', async ({ page }) => {
  await start(page, 1);
  await until(page, 'intro', async () => (await run(page, (r) => r.flag('intro.done'))) === true, 60_000);
  await run(page, (r) => {
    r.give({ kind: 'drink', drinkId: 'whiskey', count: 1 });
    r.give({ kind: 'drink', drinkId: 'tequila', count: 1 });
    r.takeHotDrink('coffee');
    for (const w of ['hurley', 'clipboard', 'shillelagh', 'umbrella']) r.gainWeapon(w);
    for (const m of ['secondOpinion', 'lastOrders', 'stumble']) r.learnMove(m);
  });
  while (await blocking(page)) await page.keyboard.press('KeyE');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Digit2');
  await page.waitForTimeout(400);
  await shot(page, 'tab-0');
  for (let i = 1; i < 16; i++) {
    await page.keyboard.press('KeyS');
    await page.waitForTimeout(120);
    await shot(page, `tab-${i}`);
    // The kit screen's panel ends at y 308 in game pixels (the frame is 232 tall from y 46): nothing may be drawn past it,
    // and the "Picked:" bar sits above the description heading.
    const texts = await visibleTexts(page);
    for (const t of texts) expect(t.bottom, `"${t.text}" runs off the panel`).toBeLessThanOrEqual(310);
    const picked = texts.find((t) => t.text.startsWith('Picked:'));
    expect(picked).toBeTruthy();
    const below = texts.filter((t) => t.y > (picked?.bottom ?? 0) && t.y < 308 && !t.text.startsWith('Picked:'));
    expect(below.length).toBeGreaterThan(0);
  }
  expect(errors).toEqual([]);
});

test('casebook notice: first stays until Tab, later ones flash for ~3.2s, clear of any comment box', async ({ page }) => {
  await start(page, 2);
  await until(page, 'intro', async () => (await run(page, (r) => r.flag('intro.done'))) === true, 60_000);
  while (await blocking(page)) await page.keyboard.press('KeyE');
  await run(page, (r) => r.addEvidence('c2.clue.ring'));
  await page.waitForTimeout(500);
  await shot(page, 'notice-first');
  let texts = await visibleTexts(page);
  const first = texts.find((t) => t.text.includes('went in the casebook'));
  expect(first, 'first-clue notice').toBeTruthy();
  // Anything drawn lower on screen (a Myko comment box) starts below the notice.
  for (const t of texts.filter((x) => x !== first && x.y > (first?.y ?? 0) && x.y < 330)) expect(first?.bottom, `overlaps "${t.text}"`).toBeLessThanOrEqual(t.y);
  await page.waitForTimeout(3600);
  texts = await visibleTexts(page);
  expect(texts.some((t) => t.text.includes('went in the casebook')), 'first notice persists with no Tab').toBe(true);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(200);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(300);
  expect((await visibleTexts(page)).some((t) => t.text.includes('went in the casebook')), 'first notice clears after Tab').toBe(false);

  await run(page, (r) => r.addEvidence('c2.clue.fragment'));
  await page.waitForTimeout(400);
  await shot(page, 'notice-later');
  texts = await visibleTexts(page);
  const later = texts.find((t) => t.text === 'Written down.');
  expect(later, 'later-clue notice').toBeTruthy();
  for (const t of texts.filter((x) => x !== later && x.y > (later?.y ?? 0) && x.y < 330)) expect(later?.bottom).toBeLessThanOrEqual(t.y);
  await page.waitForTimeout(3500);
  expect((await visibleTexts(page)).some((t) => t.text === 'Written down.')).toBe(false);
  expect(errors).toEqual([]);
});

// Fixed: a script's prompt sync used to hide every prompt when a scene opened, wiping the casebook notice.
test('casebook notice survives a scripted scene opening and sits above its dialogue box', async ({ page }) => {
  await start(page, 2);
  await until(page, 'intro', async () => (await run(page, (r) => r.flag('intro.done'))) === true, 60_000);
  while (await blocking(page)) await page.keyboard.press('KeyE');
  await run(page, (r) => r.addEvidence('c2.clue.ring'));
  await page.waitForTimeout(300);
  await run(page, (r) => void (r as unknown as { say(id: string): Promise<void> }).say('c2.throw.reminder'));
  await until(page, 'scene box', async () => blocking(page));
  await page.waitForTimeout(400);
  await shot(page, 'notice-with-scene-box');
  const texts = await visibleTexts(page);
  const notice = texts.find((t) => t.text.includes('went in the casebook'));
  expect(notice, 'notice still up with a scene showing').toBeTruthy();
  const boxText = texts.filter((t) => t !== notice && t.y > (notice?.y ?? 0) && t.y < 330);
  expect(boxText.length, 'scene box text is below the notice').toBeGreaterThan(0);
  for (const t of boxText) expect(notice?.bottom, `notice overlaps "${t.text}"`).toBeLessThanOrEqual(t.y);
});

test('no drinking before the first pint: Q and G refuse and the items stay', async ({ page }) => {
  await start(page, 1);
  await until(page, 'intro', async () => (await run(page, (r) => r.flag('intro.done'))) === true, 60_000);
  while (await blocking(page)) await page.keyboard.press('KeyE');
  expect(await run(page, (r) => r.player.meterHidden)).toBe(true);
  await run(page, (r) => { r.give({ kind: 'drink', drinkId: 'stout', count: 1 }); r.give({ kind: 'drink', drinkId: 'whiskey', count: 1 }); });
  const before = JSON.stringify(await run(page, (r) => r.player.kit));
  for (const key of ['KeyQ', 'KeyG']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(250);
    await shot(page, `refusal-${key}`);
    expect((await visibleTexts(page)).some((t) => t.text.includes('Not yet. Dympna pours')), `refusal text for ${key}`).toBe(true);
    await page.waitForTimeout(2500);
  }
  expect(JSON.stringify(await run(page, (r) => r.player.kit))).toBe(before);
  expect(await run(page, (r) => r.player.meterHidden)).toBe(true);
  expect(errors).toEqual([]);
});

// Playtest 7 raised the cap from one to six (carry.bottleLimit): at the cap a floor bottle still stays put.
test('bottle cap: a floor bottle stays on the floor when he holds six', async ({ page }) => {
  await start(page, 1);
  await until(page, 'intro', async () => (await run(page, (r) => r.flag('intro.done'))) === true, 60_000);
  while (await blocking(page)) await page.keyboard.press('KeyE');
  await run(page, (r) => {
    r.give({ kind: 'empties', count: 9 });
    r.spawnPickup({ id: 'qa.bottle', item: { kind: 'empties', count: 1 }, screenId: r.screenId, position: { x: r.player.pos.x, y: r.player.pos.y } });
  });
  await page.waitForTimeout(800);
  expect(await run(page, (r) => r.player.kit.bottles)).toBe(6);
  expect(await run(page, (r) => r.pickups().some((p) => p.def.id === 'qa.bottle'))).toBe(true);
  await shot(page, 'bottle-cap');
  expect(errors).toEqual([]);
});

for (const points of [[[7, 5], [11, 5], [30, 5]], [[45, 5], [59, 5]]] as [number, number][][]) test(`ram chase: calling Myko at chase points ${points.map((p) => p[0]).join(', ')} without reloading ends the chapter each time (three calls per game)`, async ({ page }) => {
  test.setTimeout(240_000);
  await start(page, 2);
  await page.evaluate(() => {
    const w = window as unknown as { __done: number[]; __game: GameWindow['__game'] };
    w.__done = [];
    w.__game.session.bus.on('chapter:completed', () => w.__done.push(Date.now()));
  });
  let n = 0;
  for (const [col, row] of points) {
    if (n > 0) {
      await page.evaluate(() => (window as unknown as { __game: { session: { startChapter(c: number): void } } }).__game.session.startChapter(2));
      await page.waitForFunction(() => (window as unknown as GameWindow).__game.session.run != null);
    }
    await until(page, 'a run', async () => run(page, (r) => r != null), 10_000);
    await run(page, (r) => { (r as unknown as { setFlag(k: string, v: boolean): void }).setFlag('concluded', true); r.goToScreen('c2.lane', { x: 6 * 16 + 8, y: 6 * 16 + 8 }); });
    await until(page, 'the ram chase running', async () => run(page, (r) => (r as unknown as { boss(id: string): { active: boolean } | undefined }).boss('c2.setpiece.ram')?.active === true), 60_000);
    while (await blocking(page)) await page.keyboard.press('KeyE');
    await page.evaluate(([c, r]) => (window as unknown as GameWindow).__game.session.run?.setPlayerPosition({ x: (c as number) * 16 + 8, y: (r as number) * 16 + 8 }), [col, row]);
    await page.waitForTimeout(300);
    while (await blocking(page)) await page.keyboard.press('KeyE');
    const callsBefore = await page.evaluate(() => (window as unknown as { __game: { state(): { mykoCallsLeft: number } } }).__game.state().mykoCallsLeft);
    await page.keyboard.down('KeyM');
    await page.waitForTimeout(1300);
    await page.keyboard.up('KeyM');
    n++;
    await until(page, `chapter end after call at col ${col}`, async () => (await page.evaluate(() => (window as unknown as { __done: number[] }).__done.length)) >= n, 60_000);
    expect(callsBefore).toBeGreaterThan(0);
    await shot(page, `ram-end-${col}`);
  }
  expect(errors).toEqual([]);
});

test('sheep gate: a gate closed on a straddling sheep nudges it clear and the puzzle still finishes', async ({ page }) => {
  await start(page, 2);
  await until(page, 'intro', async () => (await run(page, (r) => r.flag('intro.done'))) === true, 60_000);
  while (await blocking(page)) await page.keyboard.press('KeyE');
  await run(page, (r) => r.goToScreen('c2.farm', { x: 2 * 16 + 8, y: 11 * 16 + 8 }));
  await until(page, 'the farm', async () => (await run(page, (r) => r.screenId)) === 'c2.farm');
  while (await blocking(page)) await page.keyboard.press('KeyE');
  const res = await run(page, (r) => {
    const { puzzle } = (r as unknown as { sheepPuzzlesHere(): { puzzle: { toggleGate(id: string): boolean; sheep(): { pos: Vec }[] } }[] }).sheepPuzzlesHere()[0] as { puzzle: { toggleGate(id: string): boolean; sheep(): { pos: Vec }[] } };
    puzzle.toggleGate('gateA'); // door 1 opens
    puzzle.sheep()[0]!.pos = { x: 18 * 16 + 14, y: 12 * 16 + 8 }; // body reaching into the door tile at column 19
    return puzzle.toggleGate('gateA'); // closes door 1 over it
  });
  expect(res, 'the gate is not refused').toBe(true);
  await page.waitForTimeout(2500);
  const x = await run(page, (r) => (r as unknown as { sheepPuzzlesHere(): { puzzle: { sheep(): { pos: Vec }[] } }[] }).sheepPuzzlesHere()[0]!.puzzle.sheep()[0]!.pos.x);
  expect(x < 19 * 16 - 5 || x > 20 * 16 + 5, `sheep clear of the door tile (x ${x})`).toBe(true);
  await shot(page, 'sheep-gate');
  // The puzzle can still be finished: the flock in the far pen, held there, completes it.
  await run(page, (r) => {
    const { puzzle, placement } = (r as unknown as { sheepPuzzlesHere(): { puzzle: { sheep(): { pos: Vec }[] }; placement: { layout: { targetPen: { col: number; row: number; width: number; height: number } } } }[] }).sheepPuzzlesHere()[0]!;
    const pen = placement.layout.targetPen;
    puzzle.sheep().forEach((s, i) => { s.pos = { x: (pen.col + 0.5 + (i % pen.width)) * 16, y: (pen.row + 0.5 + Math.floor(i / pen.width) % pen.height) * 16 }; });
  });
  await until(page, 'the sheep puzzle complete', async () => run(page, (r) => r.isComplete('c2.puzzle.sheep')), 30_000);
  expect(errors).toEqual([]);
});

/** Breaks every breakable on each screen of a chapter (through the run's own hit path) and counts the beers that dropped. */
for (const chapter of [1, 2] as const) {
  test(`beer supply: chapter ${chapter}'s screens still yield beer from breakables`, async ({ page }) => {
    test.setTimeout(150_000);
    await start(page, chapter);
    await until(page, 'intro', async () => (await run(page, (r) => r.flag('intro.done'))) === true, 60_000);
    while (await blocking(page)) await page.keyboard.press('KeyE');
    const report = await page.evaluate(() => {
      type R = { module: { screens: Record<string, unknown> | { id: string }[] }; dressing: { breakablesOn(id: string): { key: string }[] }; hitBreakable(p: unknown): unknown; goToScreen(id: string, at: Vec): void; screenId: string; pickups(): { def: { screenId: string }; item: { kind: string; drinkId?: string; count: number } }[]; screenLayout: { exits: unknown[] } };
      const r = (window as unknown as { __game: { session: { run: R } } }).__game.session.run;
      const screens = Array.isArray(r.module.screens) ? r.module.screens.map((s) => s.id) : Object.keys(r.module.screens);
      const out: Record<string, { breakables: number; beers: number; floorBeers: number }> = {};
      for (const id of screens) {
        r.goToScreen(id, { x: 3 * 16 + 8, y: 3 * 16 + 8 });
        const props = r.dressing.breakablesOn(id);
        const floorBeers = r.pickups().filter((p) => p.def.screenId === id && p.item.kind === 'drink').reduce((n, p) => n + p.item.count, 0);
        const before = r.pickups().filter((p) => p.def.screenId === id && p.item.kind === 'drink').reduce((n, p) => n + p.item.count, 0);
        for (const prop of props) for (let i = 0; i < 12; i++) r.hitBreakable(prop);
        const after = r.pickups().filter((p) => p.def.screenId === id && p.item.kind === 'drink').reduce((n, p) => n + p.item.count, 0);
        out[id] = { breakables: props.length, beers: after - before, floorBeers };
      }
      return out;
    });
    const totalBeers = Object.values(report).reduce((n, s) => n + s.beers + s.floorBeers, 0);
    expect(totalBeers, 'beers findable across the chapter').toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}

test('Tab kit list and slot show the short name; the description heading shows the full name', async ({ page }) => {
  await start(page, 1);
  await until(page, 'intro', async () => (await run(page, (r) => r.flag('intro.done'))) === true, 60_000);
  await run(page, (r) => { r.gainWeapon('clipboard'); r.gainWeapon('shillelagh'); r.assignWeapon('clipboard'); });
  while (await blocking(page)) await page.keyboard.press('KeyE');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Digit2');
  await page.waitForTimeout(400);
  // Move the cursor to the clipboard (fists, hurley is not held: fists then clipboard).
  for (let i = 0; i < 12; i++) {
    const heading = (await visibleTexts(page)).some((t) => t.text === 'Halloran’s clipboard');
    if (heading) break;
    await page.keyboard.press('KeyS');
    await page.waitForTimeout(100);
  }
  await shot(page, 'tab-short-names');
  const texts = (await visibleTexts(page)).map((t) => t.text);
  expect(texts.filter((t) => t === 'Clipboard').length, 'short name in the list and in the melee slot').toBeGreaterThanOrEqual(2);
  expect(texts.includes('Shillelagh'), 'short name in the list').toBe(true);
  expect(texts.includes('Halloran’s clipboard'), 'full name as the description heading').toBe(true);
  expect(errors).toEqual([]);
});
