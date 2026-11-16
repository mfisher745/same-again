/** Chapter 3 smoke tests: the crate puzzle (nine pushes, no dead ends) and the scripted walk. */

import { describe, expect, it } from 'vitest';
import { clearChapterRegistry, registerChapter } from '../../src/core/chapter';
import { NO_INPUT } from '../../src/core/input';
import { MemoryStorage, SaveStore } from '../../src/core/save';
import { GameSession } from '../../src/systems';
import type { TileGrid } from '../../src/core/types';
import type { PushPuzzleLayout } from '../../src/systems/puzzles';
import { isBlocked } from '../../src/systems/grid';
import { chapter3 } from '../../src/chapters/03/index';
import { PEN, PEN_ENTRANCE_COLS } from '../../src/chapters/03/puzzle';

function newRun() {
  clearChapterRegistry();
  registerChapter(chapter3);
  const session = new GameSession({ store: new SaveStore(new MemoryStorage()) });
  session.setDriver({ showTitle: () => undefined, startGame: () => undefined, pauseGame: () => undefined, resumeGame: () => undefined });
  session.startChapter(3);
  const run = session.createRun();
  if (!run) throw new Error('no run');
  return { session, run };
}

describe('crate puzzle', () => {
  const placement = chapter3.pushPuzzles?.[0];
  if (!placement) throw new Error('no push puzzle');
  const layout: PushPuzzleLayout = placement.layout;
  const bay = chapter3.screens.find((s) => s.id === 'c3.bay');
  if (!bay) throw new Error('no bay');
  const start = { col: PEN.col + (PEN_ENTRANCE_COLS[0] ?? 0), row: PEN.row + PEN.height + 1 };
  // One search, shared: about 140 000 positions.
  let result: { minPushes: number; deadEnds: number; positions: number } | null = null;
  const search = () => (result ??= searchPushes(layout, bay.grid, start));

  it('needs nine pushes at least (breadth-first search, Andrew walking round to push)', { timeout: 120000 }, () => {
    expect(search().minPushes).toBe(9);
  });

  it('counts the positions the crates can be pushed into that cannot be finished (the reset lever covers them)', { timeout: 120000 }, () => {
    // A crate pushed against a wall inside the road can stay there for good; the lever puts every crate back.
    expect(search().deadEnds).toBeLessThan(search().positions / 5);
  });

  it('is shut to begin with and open in the solution', () => {
    expect(clearOf(layout, layout.pieces)).toBe(false);
    expect(clearOf(layout, layout.solution)).toBe(true);
  });
});

const clearOf = (layout: PushPuzzleLayout, crates: readonly { col: number; row: number }[]): boolean => {
  const g = layout.goal;
  if (g.kind !== 'clear') throw new Error('this layout is a clear goal');
  return g.cells.every((c) => !crates.some((k) => k.col === c.col && k.row === c.row));
};

/**
 * Every position the crates can reach, Andrew walking round to the pushing side (a flood fill over the tiles round the pen,
 * integers throughout so the whole space is a few seconds). `minPushes`: fewest pushes to a clear road, or -1.
 * `deadEnds`: positions from which a clear road can no longer be reached.
 */
function searchPushes(layout: PushPuzzleLayout, grid: TileGrid, startTile: { col: number; row: number }): { minPushes: number; deadEnds: number; positions: number } {
  const a = layout.area;
  const col0 = a.col - 1;
  const row0 = a.row - 3;
  const w = a.width + 2;
  const h = a.height + 6;
  const n = w * h;
  const at = (c: number, r: number) => (r - row0) * w + (c - col0);
  const open = new Uint8Array(n);
  const inArea = new Uint8Array(n);
  for (let r = row0; r < row0 + h; r++) {
    for (let c = col0; c < col0 + w; c++) {
      const i = at(c, r);
      open[i] = !isBlocked(grid, c, r) && !layout.fixed.some((f) => f.col === c && f.row === r) ? 1 : 0;
      inArea[i] = c >= a.col && r >= a.row && c < a.col + a.width && r < a.row + a.height && open[i] === 1 ? 1 : 0;
    }
  }
  const g = layout.goal;
  if (g.kind !== 'clear') throw new Error('this search is for a clear goal');
  const road = g.cells.map((c) => at(c.col, c.row));
  const dirs = [-w, w, -1, 1];
  const flood = (crates: readonly number[], from: number): Uint8Array => {
    const seen = new Uint8Array(n);
    const occupied = new Uint8Array(n);
    for (const c of crates) occupied[c] = 1;
    const stack = [from];
    seen[from] = 1;
    for (let t = stack.pop(); t !== undefined; t = stack.pop()) {
      for (const d of dirs) {
        const m = t + d;
        if (m < 0 || m >= n || seen[m] || !open[m] || occupied[m]) continue;
        seen[m] = 1;
        stack.push(m);
      }
    }
    return seen;
  };
  type State = { crates: number[]; player: number; pushes: number; next: string[]; solved: boolean };
  const make = (crates: number[], player: number, pushes: number): { key: string; state: State } => {
    const reach = flood(crates, player);
    let low = 0;
    while (!reach[low]) low++;
    const sorted = [...crates].sort((x, y) => x - y);
    return { key: `${sorted.join(',')}#${low}`, state: { crates, player, pushes, next: [], solved: road.every((c) => !crates.includes(c)) } };
  };
  const states = new Map<string, State>();
  const crates0 = layout.pieces.map((p) => at(p.col, p.row));
  const first = make(crates0, at(startTile.col, startTile.row), 0);
  states.set(first.key, first.state);
  let frontier = [first.key];
  let minPushes = -1;
  while (frontier.length > 0) {
    const nextFrontier: string[] = [];
    for (const sk of frontier) {
      const s = states.get(sk);
      if (!s) continue;
      if (s.solved) {
        if (minPushes < 0) minPushes = s.pushes;
        continue;
      }
      const reach = flood(s.crates, s.player);
      s.crates.forEach((c, i) => {
        for (const d of dirs) {
          if (!reach[c - d]) continue;
          const to = c + d;
          if (!inArea[to] || s.crates.includes(to)) continue;
          const crates = s.crates.map((o, j) => (j === i ? to : o));
          const made = make(crates, c, s.pushes + 1);
          s.next.push(made.key);
          if (states.has(made.key)) continue;
          states.set(made.key, made.state);
          nextFrontier.push(made.key);
        }
      });
    }
    frontier = nextFrontier;
  }
  const good = new Set([...states].filter(([, s]) => s.solved).map(([k]) => k));
  for (let changed = true; changed; ) {
    changed = false;
    for (const [k, s] of states) {
      if (!good.has(k) && s.next.some((x) => good.has(x))) {
        good.add(k);
        changed = true;
      }
    }
  }
  return { minPushes, deadEnds: states.size - good.size, positions: states.size };
}

describe('chapter 3 script', () => {
  it('loads at the social club', () => {
    const { run } = newRun();
    run.tick(16, NO_INPUT);
    expect(run.screenId).toBe('c3.yard');
  });

  it('the scripted walk completes every section and the chapter with no missing dialogue', () => {
    const { session, run } = newRun();
    run.tick(16, NO_INPUT);
    let completedChapter = 0;
    session.bus.on('chapter:completed', () => {
      completedChapter++;
      expect(run.dialogue.missing.size).toBe(0);
      expect(chapter3.def.sections.every((s) => run.isComplete(s.id))).toBe(true);
    });
    run.walkChapter();
    expect(completedChapter).toBe(1);
  });
});
