/**
 * Not a test file. A time-expanded route planner over the stealth system's own guard and floodlight motion: it records
 * every guard and hazard at every 16 ms frame (a real `StealthRunner` ticked with Andrew hidden, so nothing reacts to him),
 * then searches (cell, time) for a sneaking route that no cone ever sees. `replayRoute` then walks it through a real run.
 */

import { TUNING } from '../../src/content/tuning';
import { EventBus } from '../../src/core/events';
import type { AreaRect } from '../../src/core/chapter';
import type { StealthSectionDef, TileGrid, Vec2 } from '../../src/core/types';
import { isBlocked, rectBlocked } from '../../src/systems/grid';
import { StealthRunner, canSee } from '../../src/systems/stealth';

export const FRAME_MS = 16;
/** A route step: one 8 px cell in 10 frames, which is 50 px/s, the sneaking speed. */
export const STEP_FRAMES = 10;
export const CELL = 8;

interface Frame {
  readonly guards: readonly { pos: Vec2; facing: number }[];
  readonly lights: readonly number[];
}

export function recordMotion(def: StealthSectionDef, grid: TileGrid, frames: number): Frame[] {
  const runner = new StealthRunner(def, { bus: new EventBus(), getGrid: () => grid, raiseAlarm: () => undefined, cleanRun: () => undefined });
  runner.start();
  const out: Frame[] = [];
  const hidden = { pos: { x: -9999, y: -9999 }, hidden: true, running: false, thermalVisible: false };
  for (let i = 0; i < frames; i++) {
    runner.tick(FRAME_MS, hidden);
    out.push({ guards: runner.guards.map((g) => ({ pos: { ...g.pos }, facing: g.facingDeg })), lights: runner.hazards.map((h) => h.facingDeg) });
  }
  return out;
}

export function seenAt(def: StealthSectionDef, grid: TileGrid, f: Frame, p: Vec2): boolean {
  for (let i = 0; i < def.guards.length; i++) {
    const g = f.guards[i];
    const enemy = TUNING.enemies[def.guards[i]?.enemyId ?? 'suit'];
    const s = enemy.senses;
    if (g && s && canSee(grid, g.pos, g.facing, { range: s.visionRange, angleDeg: s.visionAngleDeg }, p)) return true;
  }
  for (let i = 0; i < def.hazards.length; i++) {
    const h = def.hazards[i];
    const facing = f.lights[i];
    if (h?.kind === 'floodlight' && facing !== undefined && canSee(grid, h.position, facing, h.cone, p)) return true;
  }
  return false;
}

export interface Route {
  /** Cell centres, one per step; step k is taken during route time k (STEP_FRAMES frames each). Waits repeat a cell. */
  readonly cells: readonly Vec2[];
  readonly seconds: number;
}

const inRect = (r: AreaRect, p: Vec2): boolean => p.x >= r.x && p.y >= r.y && p.x < r.x + r.width && p.y < r.y + r.height;

export function planRoute(opts: { def: StealthSectionDef; grid: TileGrid; start: AreaRect; exit: AreaRect; horizonSec?: number; margin?: number }): Route | null {
  const { def, grid, start, exit } = opts;
  const margin = opts.margin ?? 0;
  const w = Math.ceil((grid.widthTiles * 16) / CELL);
  const h = Math.ceil((grid.heightTiles * 16) / CELL);
  const centre = (i: number, j: number): Vec2 => ({ x: i * CELL + CELL / 2, y: j * CELL + CELL / 2 });
  const walk = new Uint8Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const c = centre(i, j);
      walk[j * w + i] = rectBlocked(grid, { x: c.x - 5, y: c.y - 4, width: 10, height: 8 }) ? 0 : 1;
    }
  const ticks = Math.floor(((opts.horizonSec ?? 120) * 1000) / (FRAME_MS * STEP_FRAMES));
  const frames = recordMotion(def, grid, (ticks + 2) * STEP_FRAMES);
  const exposed = (tick: number, from: Vec2, to: Vec2): boolean => {
    // Check every other frame of the step at the interpolated position, plus a small margin ring when asked.
    for (let k = 0; k <= STEP_FRAMES; k += 2) {
      const t = k / STEP_FRAMES;
      const p = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      const f = frames[Math.min(frames.length - 1, tick * STEP_FRAMES + k)];
      if (!f) continue;
      if (seenAt(def, grid, f, p)) return true;
      if (margin > 0) for (const [dx, dy] of [[margin, 0], [-margin, 0], [0, margin], [0, -margin]] as const) if (seenAt(def, grid, f, { x: p.x + dx, y: p.y + dy })) return true;
    }
    return false;
  };
  // Sources: walkable cells inside the start area that touch a walkable cell outside it.
  const idx = (i: number, j: number) => j * w + i;
  const parent = new Map<number, number>();
  let frontier: number[] = [];
  const key = (cell: number, tick: number) => tick * w * h + cell;
  const dirs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      if (!walk[idx(i, j)] || !inRect(start, centre(i, j))) continue;
      const edge = dirs.slice(1).some(([dx, dy]) => {
        const a = i + dx;
        const b = j + dy;
        return a >= 0 && b >= 0 && a < w && b < h && walk[idx(a, b)] === 1 && !inRect(start, centre(a, b));
      });
      if (!edge) continue;
      const f = frames[0];
      if (f && seenAt(def, grid, f, centre(i, j))) continue;
      frontier.push(idx(i, j));
      parent.set(key(idx(i, j), 0), -1);
    }
  for (let tick = 0; tick < ticks && frontier.length > 0; tick++) {
    const next: number[] = [];
    for (const cell of frontier) {
      const ci = cell % w;
      const cj = Math.floor(cell / w);
      if (inRect(exit, centre(ci, cj))) return buildRoute(parent, key(cell, tick), w * h, centre, w);
      for (const [dx, dy] of dirs) {
        const a = ci + dx;
        const b = cj + dy;
        if (a < 0 || b < 0 || a >= w || b >= h || !walk[idx(a, b)]) continue;
        const nk = key(idx(a, b), tick + 1);
        if (parent.has(nk)) continue;
        if (exposed(tick, centre(ci, cj), centre(a, b))) continue;
        parent.set(nk, key(cell, tick));
        next.push(idx(a, b));
      }
    }
    frontier = [...new Set(next)];
  }
  return null;
}

function buildRoute(parent: Map<number, number>, end: number, n: number, centre: (i: number, j: number) => Vec2, w: number): Route {
  const cells: Vec2[] = [];
  for (let k = end; k >= 0; k = parent.get(k) ?? -1) {
    const cell = k % n;
    cells.push(centre(cell % w, Math.floor(cell / w)));
    if (parent.get(k) === -1) break;
  }
  cells.reverse();
  return { cells, seconds: ((cells.length - 1) * STEP_FRAMES * FRAME_MS) / 1000 };
}

/** Whether `isBlocked`-style tile checks are all that stops Andrew (kept for tests that want to assert the grid they planned on). */
export const open = (grid: TileGrid, col: number, row: number): boolean => !isBlocked(grid, col, row);
