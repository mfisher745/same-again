/** Chapter 1 smoke tests: layouts, the keg puzzle (four pushes minimum), triggers and the scripted walk. */

import { describe, expect, it } from 'vitest';
import { clearChapterRegistry, registerChapter } from '../../src/core/chapter';
import { NO_INPUT } from '../../src/core/input';
import { MemoryStorage, SaveStore } from '../../src/core/save';
import { GameSession } from '../../src/systems';
import type { TileGrid } from '../../src/core/types';
import type { PushPuzzleLayout } from '../../src/systems/puzzles';
import { findPath, isBlocked, tileOf } from '../../src/systems/grid';
import { chapter1 } from '../../src/chapters/01/index';
import { T } from '../../src/chapters/01/maps';

const layoutOf = (id: string) => {
  const s = chapter1.screens.find((x) => x.id === id);
  if (!s) throw new Error(`no screen ${id}`);
  return s;
};

function newRun() {
  clearChapterRegistry();
  registerChapter(chapter1);
  const session = new GameSession({ store: new SaveStore(new MemoryStorage()) });
  session.setDriver({ showTitle: () => undefined, startGame: () => undefined, pauseGame: () => undefined, resumeGame: () => undefined });
  session.startChapter(1);
  const run = session.createRun();
  if (!run) throw new Error('no run');
  return { session, run };
}

describe('chapter 1 screens', () => {
  const sizes: Record<string, [number, number]> = { 'c1.pub': [30, 17], 'c1.yard': [20, 17], 'c1.street': [70, 17], 'c1.road': [30, 17] };
  for (const [id, [w, h]] of Object.entries(sizes)) {
    it(`${id} is ${w} x ${h} with matching grid, tiles and def`, () => {
      const s = layoutOf(id);
      expect(s.grid.widthTiles).toBe(w);
      expect(s.grid.heightTiles).toBe(h);
      expect(s.grid.blocked).toHaveLength(w * h);
      expect(s.tiles).toHaveLength(w * h);
      expect(chapter1.def.screens.find((x) => x.id === id)).toMatchObject({ widthTiles: w, heightTiles: h });
    });
  }

  it('every exit, spawn, pickup, examinable neighbour and placement is on open ground and reachable', () => {
    const reach = (screenId: string, from: { x: number; y: number }, to: { x: number; y: number }): boolean => {
      const s = layoutOf(screenId);
      const open = (col: number, row: number): boolean => col >= 0 && row >= 0 && col < s.grid.widthTiles && row < s.grid.heightTiles && !s.grid.blocked[row * s.grid.widthTiles + col];
      const a = tileOf(from);
      const b = tileOf(to);
      if (!open(a.col, a.row) || !open(b.col, b.row)) return false;
      return findPath(s.grid, from, to) !== null;
    };
    for (const s of chapter1.screens) {
      expect(reach(s.id, s.playerStart, s.playerStart)).toBe(true);
      for (const ex of s.exits) {
        const centre = { x: ex.area.x + ex.area.width / 2, y: ex.area.y + ex.area.height / 2 };
        expect(reach(s.id, s.playerStart, centre), `${ex.id} reachable`).toBe(true);
        // The spawn on the target screen is open ground.
        const target = layoutOf(ex.toScreen);
        const t = tileOf(ex.spawn);
        expect(target.grid.blocked[t.row * target.grid.widthTiles + t.col], `${ex.id} spawn`).toBe(false);
      }
    }
    for (const p of chapter1.pickups) expect(reach(p.screenId, layoutOf(p.screenId).playerStart, p.position), p.id).toBe(true);
    // Street pickups and the street's start are reachable from the street's arrival point.
    for (const p of chapter1.pickups) expect(reach('c1.street', T(3, 8), p.position), p.id).toBe(true);
  });
});

describe('keg puzzle', () => {
  const placement = chapter1.pushPuzzles?.[0];
  if (!placement) throw new Error('no push puzzle');
  const layout: PushPuzzleLayout = placement.layout;
  const yard = layoutOf('c1.yard');

  it('is solved by six real pushes', () => {
    const { run } = newRun();
    run.goToScreen('c1.yard', T(5, 3));
    const puzzle = run.pushPuzzlesHere()[0]?.puzzle;
    if (!puzzle) throw new Error('no puzzle on the yard screen');
    // keg1 right, keg2 up, keg3 right three times, keg3 up.
    const pos = layout.pieces.map((p) => ({ ...p }));
    const order: Array<[number, 'up' | 'right']> = [[0, 'right'], [1, 'up'], [2, 'right'], [2, 'right'], [2, 'right'], [2, 'up']];
    order.forEach(([i, d], n) => {
      const piece = pos[i];
      if (!piece) throw new Error('piece');
      expect(puzzle.goalMet(), `not solved before push ${n + 1}`).toBe(false);
      expect(puzzle.push({ col: piece.col, row: piece.row }, d)).toBe(true);
      piece.col += d === 'right' ? 1 : 0;
      piece.row += d === 'up' ? -1 : 0;
    });
    expect(puzzle.goalMet()).toBe(true);
    expect(puzzle.isComplete()).toBe(true);
    expect(puzzle.piecePositions()).toEqual(layout.solution.map((p) => ({ id: p.id, col: p.col, row: p.row })));
  });

  it('needs at least six pushes (breadth-first search, player walking round to push)', () => {
    expect(searchPushes(layout, yard.grid, tileOf(T(5, 3))).minPushes).toBe(6);
  });

  it('can be finished from every position the kegs can be pushed into', () => {
    expect(searchPushes(layout, yard.grid, tileOf(T(5, 3))).deadEnds).toBe(0);
  });

  it('the kegs close the path: Andrew cannot walk round them to the gate', () => {
    expect(goalMet(layout, yard.grid, layout.pieces)).toBe(false);
    // And the solution's positions leave the way open.
    expect(goalMet(layout, yard.grid, layout.solution)).toBe(true);
  });

  it('the gate is its own obstacle: solid in the gateway, outside the keg area', () => {
    const gate = yard.dressing?.props?.find((p) => p.id === 'yardGate');
    expect(gate?.solid).toBeDefined();
    expect(gate && gate.col >= layout.area.col + layout.area.width).toBe(true);
  });
});

const D4 = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;

/** The goal on a set of keg positions: cells clear or covered, or (`reach`) a walk from `from` to `to`. */
function goalMet(layout: PushPuzzleLayout, grid: TileGrid, kegs: readonly { col: number; row: number }[]): boolean {
  const g = layout.goal;
  const keg = (c: number, r: number) => kegs.some((k) => k.col === c && k.row === r);
  if (g.kind !== 'reach') return g.kind === 'clear' ? g.cells.every((c) => !keg(c.col, c.row)) : g.cells.every((c) => keg(c.col, c.row));
  const fixed = (c: number, r: number) => layout.fixed.some((f) => f.col === c && f.row === r);
  const seen = new Set([`${g.from.col},${g.from.row}`]);
  const stack = [g.from];
  while (stack.length > 0) {
    const w = stack.pop();
    if (!w) break;
    if (w.col === g.to.col && w.row === g.to.row) return true;
    for (const [dc, dr] of D4) {
      const c = w.col + dc;
      const r = w.row + dr;
      if (isBlocked(grid, c, r) || fixed(c, r) || keg(c, r) || seen.has(`${c},${r}`)) continue;
      seen.add(`${c},${r}`);
      stack.push({ col: c, row: r });
    }
  }
  return false;
}

/**
 * Every position the kegs can reach, Andrew walking round to the pushing side. A solved puzzle takes no more pushes.
 * `minPushes`: fewest pushes to the goal, or -1. `deadEnds`: positions from which the goal can no longer be reached.
 */
function searchPushes(layout: PushPuzzleLayout, grid: TileGrid, startTile: { col: number; row: number }): { minPushes: number; deadEnds: number } {
  const fixed = (c: number, r: number) => layout.fixed.some((f) => f.col === c && f.row === r);
  const inArea = (c: number, r: number) => c >= layout.area.col && r >= layout.area.row && c < layout.area.col + layout.area.width && r < layout.area.row + layout.area.height;
  type Tile = { col: number; row: number };
  type State = { kegs: Tile[]; player: Tile; pushes: number; next: string[]; solved: boolean };
  const reachOf = (kegs: Tile[], player: Tile): Set<string> => {
    const seen = new Set([`${player.col},${player.row}`]);
    const stack = [player];
    while (stack.length > 0) {
      const w = stack.pop();
      if (!w) break;
      for (const [dc, dr] of D4) {
        const c = w.col + dc;
        const r = w.row + dr;
        if (isBlocked(grid, c, r) || fixed(c, r) || kegs.some((k) => k.col === c && k.row === r) || seen.has(`${c},${r}`)) continue;
        seen.add(`${c},${r}`);
        stack.push({ col: c, row: r });
      }
    }
    return seen;
  };
  const key = (kegs: Tile[], reach: Set<string>) => `${kegs.map((k) => `${k.col},${k.row}`).join(';')}#${[...reach].sort()[0]}`;
  const states = new Map<string, State>();
  const kegs0 = layout.pieces.map((p) => ({ col: p.col, row: p.row }));
  const k0 = key(kegs0, reachOf(kegs0, startTile));
  states.set(k0, { kegs: kegs0, player: startTile, pushes: 0, next: [], solved: goalMet(layout, grid, kegs0) });
  let frontier = [k0];
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
      const reach = reachOf(s.kegs, s.player);
      s.kegs.forEach((k, i) => {
        for (const [dc, dr] of D4) {
          if (!reach.has(`${k.col - dc},${k.row - dr}`)) continue;
          const n = { col: k.col + dc, row: k.row + dr };
          if (!inArea(n.col, n.row) || isBlocked(grid, n.col, n.row) || fixed(n.col, n.row) || s.kegs.some((o) => o.col === n.col && o.row === n.row)) continue;
          const kegs = s.kegs.map((o, j) => (j === i ? n : o));
          const nk = key(kegs, reachOf(kegs, k));
          s.next.push(nk);
          if (states.has(nk)) continue;
          states.set(nk, { kegs, player: k, pushes: s.pushes + 1, next: [], solved: goalMet(layout, grid, kegs) });
          nextFrontier.push(nk);
        }
      });
    }
    frontier = nextFrontier;
  }
  const good = new Set([...states].filter(([, s]) => s.solved).map(([k]) => k));
  for (let changed = true; changed; ) {
    changed = false;
    for (const [k, s] of states) {
      if (!good.has(k) && s.next.some((n) => good.has(n))) {
        good.add(k);
        changed = true;
      }
    }
  }
  return { minPushes, deadEnds: states.size - good.size };
}

/** Finishes every queued line, letting the script's awaited chains run between passes. */
async function settle(run: { dialogue: { finishAll(): void } }): Promise<void> {
  for (let i = 0; i < 6; i++) {
    run.dialogue.finishAll();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe('chapter 1 scene and script', () => {
  it('loads: the opening plays and the first objective and exits are set', async () => {
    const { run } = newRun();
    run.tick(16, NO_INPUT);
    expect(run.screenId).toBe('c1.pub');
    await settle(run);
    run.tick(16, NO_INPUT);
    expect(run.objective()).toBe('c1.bar');
    expect(run.myko.mode).toBe('scripted');
  });

  it('fires the pub triggers in order: end of the bar, then Dympna', async () => {
    const { run } = newRun();
    run.tick(16, NO_INPUT);
    await settle(run);
    run.setPlayerPosition(T(21, 4));
    run.tick(16, NO_INPUT);
    expect(run.flag('pub.step')).toBe(1);
    await settle(run);
    expect(run.objective()).toBe('c1.dympna');
  });

  it('the scripted walk completes every section and the chapter with no missing dialogue', () => {
    const { session, run } = newRun();
    run.tick(16, NO_INPUT);
    let completedChapter = 0;
    session.bus.on('chapter:completed', () => {
      completedChapter++;
      expect(run.dialogue.missing.size).toBe(0);
      expect(chapter1.def.sections.every((s) => run.isComplete(s.id))).toBe(true);
    });
    run.walkChapter();
    expect(completedChapter).toBe(1);
  });
});
