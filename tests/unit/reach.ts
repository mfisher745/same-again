/**
 * Not a test file. Walkability over a real run's current screen: a flood fill over the tiles Andrew can stand on (the
 * run's grid, with solid props, NPCs and puzzle pieces merged in), and the interaction check (E and pickups reach 20 px).
 */

import { TUNING } from '../../src/content/tuning';
import type { Vec2 } from '../../src/core/types';
import type { ChapterRun } from '../../src/systems/run';

export const px = (col: number, row: number): Vec2 => ({ x: col * 16 + 8, y: row * 16 + 8 });

/** Every tile (as "col,row") Andrew can walk to from `from` on the run's current screen. */
export function floodFrom(run: ChapterRun, from: readonly Vec2[]): Set<string> {
  const g = run.grid;
  const seen = new Set<string>();
  const queue: { col: number; row: number }[] = [];
  const open = (c: number, r: number): boolean => c >= 0 && r >= 0 && c < g.widthTiles && r < g.heightTiles && !g.blocked[r * g.widthTiles + c] && !run.extraBlocked(c, r);
  for (const p of from) {
    const t = { col: Math.floor(p.x / 16), row: Math.floor(p.y / 16) };
    if (open(t.col, t.row) && !seen.has(`${t.col},${t.row}`)) {
      seen.add(`${t.col},${t.row}`);
      queue.push(t);
    }
  }
  for (let t = queue.shift(); t !== undefined; t = queue.shift()) {
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const c = t.col + dc;
      const r = t.row + dr;
      if (!open(c, r) || seen.has(`${c},${r}`)) continue;
      seen.add(`${c},${r}`);
      queue.push({ col: c, row: r });
    }
  }
  return seen;
}

/** True when Andrew can stand within `reach` px of `at` (the nearest point of any reachable tile). */
export function within(reachable: Set<string>, at: Vec2, reach: number = TUNING.investigation.interactRadius): boolean {
  for (const key of reachable) {
    const [c, r] = key.split(',').map(Number) as [number, number];
    const nx = Math.min(Math.max(at.x, c * 16), c * 16 + 15.99);
    const ny = Math.min(Math.max(at.y, r * 16), r * 16 + 15.99);
    if (Math.hypot(at.x - nx, at.y - ny) <= reach) return true;
  }
  return false;
}

/** True when the tile that holds `at` is itself reachable (an exit's own area). */
export const onReachable = (reachable: Set<string>, at: Vec2): boolean => reachable.has(`${Math.floor(at.x / 16)},${Math.floor(at.y / 16)}`);

/**
 * Ids of everything on the run's current screen that cannot be reached from `from`: exits (standing in their area),
 * examinables (E range), and pickups. Props that a script spawns later are not listed here.
 */
export function unreachableHere(run: ChapterRun, from: readonly Vec2[], skip: readonly string[] = []): string[] {
  const reach = floodFrom(run, from);
  const screen = run.screenLayout;
  const out: string[] = [];
  for (const e of screen.exits) {
    let ok = false;
    for (let y = e.area.y; y < e.area.y + e.area.height && !ok; y += 16) for (let x = e.area.x; x < e.area.x + e.area.width && !ok; x += 16) ok = onReachable(reach, { x: x + 1, y: y + 1 });
    if (!ok && !skip.includes(e.id)) out.push(e.id);
  }
  for (const e of run.module.examinables.filter((q) => q.screenId === screen.id)) if (!skip.includes(e.id) && !within(reach, e.position)) out.push(e.id);
  for (const p of run.module.pickups.filter((q) => q.screenId === screen.id)) if (!skip.includes(p.id) && !within(reach, p.position)) out.push(p.id);
  return out;
}
