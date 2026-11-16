/**
 * Not a spec. Shared helpers for the chapter 3 and 4 smoke specs: starting a chapter, reading the running game through
 * window.__game, clearing scenes with E, and walking with the real keyboard to a spot (a breadth-first route over the
 * running game's own grid, solid props and puzzle pieces included). Nothing waits on fixed sleeps except short polls.
 */

import type { Page } from '@playwright/test';

export interface Vec { x: number; y: number }

/** The parts of the running chapter the specs read. Loosely typed on purpose: it is a view onto window.__game. */
export interface Run {
  flag(k: string): unknown;
  isComplete(id: string): boolean;
  objective(): string | null;
  screenId: string;
  grid: { widthTiles: number; heightTiles: number; blocked: boolean[] };
  dialogue: { blocking: boolean };
  player: { pos: Vec; kit: { drinks: Record<string, number | undefined>; hotDrink: string | null; bottles: number; weapons: string[]; moves: string[]; slots: { specials: (string | null)[] } }; level: number; meter: { value: number } };
  setPlayerPosition(p: Vec): void;
  goToScreen(id: string, spawn: Vec): void;
  extraBlocked(col: number, row: number): boolean;
  screenLayout: { exits: { id: string; area: { x: number; y: number; width: number; height: number } }[] };
  guardsHere(): unknown[];
  sweepsHere(): { moving: boolean }[];
  learnMove(id: string): void;
  callsRemaining(): number;
  assignMove(slot: number, id: string): boolean;
  takeHotDrink(id: string): boolean;
  completeSection(id: string, by: string): void;
  startSection(id: string): void;
  fight(id: string): { active: boolean; aliveActors(): { instanceId: string }[]; isComplete(): boolean } | null;
  boss(id: string): { active: boolean; isComplete(): boolean; phase: { id: string } | null; body(tag: string): { pos: Vec } | undefined } | null;
  defeat(actor: unknown, by: string): void;
  addEvidence(id: string): void;
  submitDeduction(id: string, ev: string[]): boolean;
  activeDeduction(): { isOpen: boolean } | null;
  pickups(): { def: { id: string } }[];
  pushPuzzlesHere(): { puzzle: { piecePositions(): { id: string; col: number; row: number }[]; layout: { area: { col: number; row: number; width: number; height: number }; fixed: { col: number; row: number }[] }; isComplete(): boolean } }[];
  slidePuzzlesHere(): { puzzle: { slotOf(id: string): number | undefined; isComplete(): boolean } }[];
  snapshot(): { casebook: unknown[] };
  dressing: { prop(id: string): { visible: boolean } | undefined };
  module: { examinables: { id: string; position: Vec }[] };
}
export interface GameWindow {
  __game: {
    session: { run: Run | null; bus: { on(ev: string, fn: (p: unknown) => void): () => void } };
    state(): { chapter: number | null; screenId: string | null; completed: string[]; missingDialogue: string[] } | null;
  };
  __phaserGame: { scene: { getScene(k: string): { cameras: { main: { scrollX: number; scrollY: number; zoom: number } } } } };
  __shown?: string[];
}

export const TILE = 16;
const KEYS = { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS' } as const;
const SPEED = 100;

export const centre = (col: number, row: number): Vec => ({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });

export async function start(page: Page, chapter: number): Promise<void> {
  await page.goto(`./?chapter=${chapter}`);
  await page.waitForFunction(() => {
    const g = (window as unknown as GameWindow).__game;
    return g?.session.run != null && g.state() !== null;
  });
  await page.locator('canvas').click({ position: { x: 5, y: 5 }, button: 'middle' }); // focus without a game action
  // Keep a list of every dialogue sequence shown, for the "said once" checks.
  await page.evaluate(() => {
    const w = window as unknown as GameWindow;
    w.__shown = [];
    w.__game.session.bus.on('dialogue:show', (p) => void w.__shown?.push((p as { sequenceId: string }).sequenceId));
  });
}

export const shown = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as GameWindow).__shown ?? []);
export const blocking = (page: Page): Promise<boolean> => page.evaluate(() => (window as unknown as GameWindow).__game.session.run?.dialogue.blocking === true);
export const flag = (page: Page, key: string): Promise<unknown> => page.evaluate((k) => (window as unknown as GameWindow).__game.session.run?.flag(k), key);
export const complete = (page: Page, id: string): Promise<boolean> => page.evaluate((k) => (window as unknown as GameWindow).__game.session.run?.isComplete(k) === true, id);
export const screenId = (page: Page): Promise<string | null> => page.evaluate(() => (window as unknown as GameWindow).__game.state()?.screenId ?? null);
export const objective = (page: Page): Promise<string | null> => page.evaluate(() => (window as unknown as GameWindow).__game.session.run?.objective() ?? null);

/** Presses E until no scripted scene is showing. */
export async function dismissScenes(page: Page, maxMs = 20_000): Promise<void> {
  const end = Date.now() + maxMs;
  let quiet = 0;
  while (Date.now() < end) {
    if (await blocking(page)) {
      quiet = 0;
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(40);
    } else if (++quiet >= 3) return;
    else await page.waitForTimeout(60);
  }
  throw new Error('dialogue never cleared');
}

/** Polls until `fn` returns truthy, clearing scenes on the way. */
export async function until(page: Page, what: string, fn: () => Promise<unknown>, maxMs = 15_000): Promise<void> {
  const end = Date.now() + maxMs;
  while (Date.now() < end) {
    if (await fn()) return;
    if (await blocking(page)) await page.keyboard.press('KeyE');
    await page.waitForTimeout(50);
  }
  throw new Error(`timed out waiting for ${what}`);
}

const look = (page: Page): Promise<{ x: number; y: number; screen: string; blocking: boolean }> =>
  page.evaluate(() => {
    const r = (window as unknown as GameWindow).__game.session.run as Run;
    return { x: r.player.pos.x, y: r.player.pos.y, screen: r.screenId, blocking: r.dialogue.blocking };
  });

interface Grid { w: number; h: number; blocked: boolean[]; pos: Vec }
const gridNow = (page: Page): Promise<Grid> =>
  page.evaluate(() => {
    const r = (window as unknown as GameWindow).__game.session.run as Run;
    const w = r.grid.widthTiles;
    const h = r.grid.heightTiles;
    const blocked = r.grid.blocked.map((b, i) => b || r.extraBlocked(i % w, Math.floor(i / w)));
    return { w, h, blocked, pos: r.player.pos };
  });

function bfs(info: Grid, extra: Set<number>): { came: Map<number, number>; key: (c: number, r: number) => number } {
  const key = (c: number, r: number): number => r * info.w + c;
  const open = (c: number, r: number): boolean => c >= 0 && r >= 0 && c < info.w && r < info.h && !info.blocked[key(c, r)] && !extra.has(key(c, r));
  const start = { c: Math.floor(info.pos.x / TILE), r: Math.floor(info.pos.y / TILE) };
  const came = new Map<number, number>([[key(start.c, start.r), -1]]);
  const queue = [start];
  for (let cur = queue.shift(); cur; cur = queue.shift()) {
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { c: cur.c + dc, r: cur.r + dr };
      if (!open(n.c, n.r) || came.has(key(n.c, n.r))) continue;
      came.set(key(n.c, n.r), key(cur.c, cur.r));
      queue.push(n);
    }
  }
  return { came, key };
}

async function route(page: Page, to: Vec, extraBlocked: { col: number; row: number }[] = []): Promise<Vec[]> {
  const info = await gridNow(page);
  const { came, key } = bfs(info, new Set(extraBlocked.map((b) => b.row * info.w + b.col)));
  const goal = { c: Math.floor(to.x / TILE), r: Math.floor(to.y / TILE) };
  if (!came.has(key(goal.c, goal.r))) throw new Error(`no route to ${JSON.stringify(to)}`);
  const tiles: Vec[] = [];
  for (let k = key(goal.c, goal.r); k !== -1; k = came.get(k) ?? -1) tiles.push({ x: (k % info.w) * TILE + TILE / 2, y: Math.floor(k / info.w) * TILE + TILE / 2 });
  tiles.reverse();
  tiles.shift();
  if (tiles.length > 0) tiles[tiles.length - 1] = { x: to.x, y: to.y };
  return tiles;
}

/** The reachable standing spot closest to `target` (within `reach` px): where to stand to use it, and nothing else nearer. */
export async function spotNear(page: Page, target: Vec, reach = 16): Promise<Vec> {
  const info = await gridNow(page);
  const { came } = bfs(info, new Set());
  let best: { d: number; p: Vec } | null = null;
  for (const k of came.keys()) {
    const p = { x: (k % info.w) * TILE + TILE / 2, y: Math.floor(k / info.w) * TILE + TILE / 2 };
    const d = Math.hypot(p.x - target.x, p.y - target.y);
    if (d <= reach && (!best || d < best.d - 0.5)) best = { d, p };
  }
  if (!best) throw new Error(`nowhere to stand within ${reach} of ${JSON.stringify(target)}`);
  return best.p;
}

/** Walks with the keyboard to a world point, one tile centre at a time, then taps in to the exact spot. */
export async function walkTo(page: Page, to: Vec, opts: { extraBlocked?: { col: number; row: number }[]; tolerance?: number } = {}): Promise<void> {
  const tol = opts.tolerance ?? 3;
  const held = new Set<string>();
  const set = async (want: Set<string>): Promise<void> => {
    for (const k of [...held]) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
  };
  try {
    const startScreen = (await look(page)).screen;
    const wps = await route(page, to, opts.extraBlocked);
    for (const wp of wps) {
      const last = wp === wps[wps.length - 1];
      const end = Date.now() + 12_000;
      for (;;) {
        const p = await look(page);
        if (p.screen !== startScreen) return; // walked through an exit on the way
        if (Date.now() > end) throw new Error(`stuck walking to ${JSON.stringify(wp)} (waypoint ${wps.indexOf(wp)} of ${wps.length}) at ${JSON.stringify(p)}`);
        if (p.blocking) {
          await set(new Set());
          await page.keyboard.press('KeyE');
          await page.waitForTimeout(40);
          continue;
        }
        const dx = wp.x - p.x;
        const dy = wp.y - p.y;
        const slack = last ? tol : 2.5;
        if (Math.abs(dx) <= slack && Math.abs(dy) <= slack) break;
        const alongX = Math.abs(dx) > slack;
        const d = alongX ? dx : dy;
        const key = alongX ? (dx > 0 ? KEYS.right : KEYS.left) : dy > 0 ? KEYS.down : KEYS.up;
        if (Math.abs(d) > 14) {
          await set(new Set([key]));
          await page.waitForTimeout(10);
        } else {
          await set(new Set());
          await page.keyboard.down(key);
          await page.waitForTimeout(Math.max(8, (Math.abs(d) / SPEED) * 1000 * 0.7));
          await page.keyboard.up(key);
          await page.waitForTimeout(30);
        }
      }
    }
  } finally {
    await set(new Set());
  }
}

/** Walks up to something and presses E. */
export async function use(page: Page, target: Vec, reach = 16): Promise<void> {
  await walkTo(page, await spotNear(page, target, reach));
  await page.keyboard.press('KeyE');
}

/** Walks through an exit of the current screen by id (to the middle of its area). */
export async function walkThroughExit(page: Page, exitId: string): Promise<void> {
  const area = await page.evaluate((id) => (window as unknown as GameWindow).__game.session.run?.screenLayout.exits.find((e) => e.id === id)?.area, exitId);
  if (!area) throw new Error(`no exit ${exitId}`);
  await walkTo(page, { x: area.x + area.width / 2, y: area.y + area.height / 2 });
}

/** Moves the mouse so the game's aim point is the given world point. */
export async function aimAt(page: Page, world: Vec): Promise<void> {
  const s = await page.evaluate(() => {
    const cam = (window as unknown as GameWindow).__phaserGame.scene.getScene('Game').cameras.main;
    const rect = document.querySelector('canvas')?.getBoundingClientRect();
    return { sx: cam.scrollX, sy: cam.scrollY, zoom: cam.zoom, left: rect?.left ?? 0, top: rect?.top ?? 0, scale: (rect?.width ?? 480) / 480 };
  });
  await page.mouse.move(s.left + (world.x - s.sx) * s.zoom * s.scale, s.top + (world.y - s.sy) * s.zoom * s.scale);
  await page.waitForTimeout(80);
}

/** A screenshot into test-results/<dir>/<name>.png. */
export async function shot(page: Page, dir: string, name: string): Promise<string> {
  const path = `test-results/${dir}/${name}.png`;
  await page.screenshot({ path });
  return path;
}

/** Runs a function against the live run (serialised; it cannot close over anything). */
export const withRun = <T>(page: Page, fn: (r: Run) => T): Promise<T> =>
  page.evaluate(`(${fn.toString()})(window.__game.session.run)`) as Promise<T>;

/** Where an examinable is, read from the running chapter. */
export async function examinablePos(page: Page, id: string): Promise<Vec> {
  const p = await page.evaluate((k) => (window as unknown as GameWindow).__game.session.run?.module.examinables.find((e) => e.id === k)?.position, id);
  if (!p) throw new Error(`no examinable ${id}`);
  return p;
}
