/** Chapter 2: the three screens' sizes and reachability, the five-swing sheep proof and herding bot, the clue to stealth flow and the scripted walk. */

import { describe, expect, it } from 'vitest';
import { frame, NO_INPUT, settleDialogue as settle, startChapterGame } from './helpers';
import { findPath, tileOf } from '../../src/systems/grid';
import { chapter2 } from '../../src/chapters/02/index';
import { BAR_ARRIVAL, SHEEP_LAYOUT, T } from '../../src/chapters/02/maps';

const layoutOf = (id: string) => {
  const s = chapter2.screens.find((x) => x.id === id);
  if (!s) throw new Error(id);
  return s;
};
function newRun() {
  const { session, run } = startChapterGame(chapter2, 'chapter');
  return { session, run };
}

describe('chapter 2 layout', () => {
  it('screens are the sizes the spec gives, and every clue, exit and pen is reachable', () => {
    const sizes: Record<string, [number, number]> = { 'c2.bog': [60, 34], 'c2.farm': [40, 30], 'c2.lane': [90, 12] };
    for (const [id, [w, h]] of Object.entries(sizes)) {
      const s = layoutOf(id);
      expect(s.grid.widthTiles).toBe(w);
      expect(s.grid.heightTiles).toBe(h);
    }
    const reach = (id: string, from: { x: number; y: number }, to: { x: number; y: number }) => {
      const s = layoutOf(id);
      const a = tileOf(from), b = tileOf(to);
      const open = (c: number, r: number) => !s.grid.blocked[r * s.grid.widthTiles + c];
      return open(a.col, a.row) && open(b.col, b.row) && findPath(s.grid, from, to) !== null;
    };
    const bog = (c: number, r: number) => reach('c2.bog', BAR_ARRIVAL, T(c, r));
    for (const [c, r] of [[25, 13], [29, 13], [34, 14], [28, 10], [32, 16], [6, 27], [37, 12], [43, 5], [55, 5], [43, 19], [55, 19], [48, 4], [48, 20], [41, 5], [41, 22], [56, 11], [58, 11]] as const) expect(bog(c, r), `bog ${c},${r}`).toBe(true);
    const farm = (c: number, r: number) => reach('c2.farm', T(2, 11), T(c, r));
    for (const [c, r] of [[10, 11], [20, 12], [18, 12], [22, 15], [4, 27], [7, 17], [7, 21], [2, 22], [2, 25], [12, 8], [13, 6]] as const) expect(farm(c, r), `farm ${c},${r}`).toBe(true);
    // Shed interior via door tile.
    expect(farm(17, 2)).toBe(true);
    expect(farm(11, 4)).toBe(true);
    const lane = (c: number, r: number) => reach('c2.lane', T(6, 6), T(c, r));
    for (const [c, r] of [[1, 5], [2, 3], [86, 5], [51, 5], [10, 5]] as const) expect(lane(c, r), `lane ${c},${r}`).toBe(true);
  });
});

describe('chapter 2 sheep puzzle', () => {
  it('needs exactly five gate swings (state search over the gates and the flock)', () => {
    const g = SHEEP_LAYOUT.gates;
    const key = (p: number[]) => p.join('');
    const blockedBy = (p: number[]) => new Set(g.flatMap((gate, i) => gate.positions[p[i] as 0 | 1].map((t) => `${t.col},${t.row}`)));
    // Region graph: pens P0..P3, doors d1 (0-1), d2 (1-2), d3 (2-3). Sheep move forward through an open door at any time.
    const doors: Array<[string, number, number]> = [['19,12', 0, 1], ['21,14', 1, 2], ['19,16', 2, 3]];
    const open = (p: number[], d: string) => !blockedBy(p).has(d);
    const queue: Array<{ p: number[]; region: number; n: number }> = [{ p: [0, 0, 0], region: 0, n: 0 }];
    const seen = new Set<string>();
    let best = -1;
    while (queue.length) {
      const s = queue.shift()!;
      let region = s.region;
      for (const [d, a, b] of doors) if (region === a && open(s.p, d)) region = b;
      if (region === 3) { best = s.n; break; }
      const k = key(s.p) + region;
      if (seen.has(k)) continue;
      seen.add(k);
      for (let i = 0; i < 3; i++) {
        const p = [...s.p]; p[i] = 1 - (p[i] as number);
        queue.push({ p, region, n: s.n + 1 });
      }
    }
    expect(best).toBe(5);
  });
  it('a herding bot gets the flock through all three doors in five swings', () => {
    const { run } = newRun();
    run.goToScreen('c2.farm', T(2, 11));
    const puzzle = run.sheepPuzzlesHere()[0]?.puzzle;
    if (!puzzle) throw new Error('no puzzle');
    const pen = (x: number, y: number) => { const c = x / 16, r = y / 16; if ((c > 18.6 && c < 20.4) || (r > 13.6 && r < 15)) return -1; return c < 19 ? (r < 14 ? 0 : 3) : (r < 14 ? 1 : 2); };
    let pos = T(11, 11);
    const doors = [T(19, 12), T(21, 14), T(19, 16)];
    // plan: [gate toggles before pass], target pen
    const plan: Array<{ toggles: string[]; door: number; pen: number }> = [
      { toggles: ['gateA'], door: 0, pen: 1 },
      { toggles: ['gateA', 'gateB'], door: 1, pen: 2 },
      { toggles: ['gateB', 'gateC'], door: 2, pen: 3 },
    ];
    let swings = 0;
    for (const step of plan) {
      for (const g of step.toggles) {
        let tries = 0;
        while (!puzzle.toggleGate(g, pos) && tries++ < 5) pos = { x: pos.x, y: pos.y - 16 };
        swings++;
      }
      let ticks = 0;
      const door = doors[step.door]!;
      while (puzzle.sheep().some((s) => pen(s.pos.x, s.pos.y) !== step.pen) && ticks++ < 6000) {
        const outside = puzzle.sheep().filter((s) => pen(s.pos.x, s.pos.y) !== step.pen);
        outside.sort((a, b) => Math.hypot(a.pos.x - door.x, a.pos.y - door.y) - Math.hypot(b.pos.x - door.x, b.pos.y - door.y));
        const sh = outside[outside.length - 1]!;
        const goal = { x: door.x + (step.door === 1 ? 0 : step.door === 0 ? 40 : -40), y: door.y + (step.door === 1 ? 40 : 0) };
        const dx = sh.pos.x - goal.x, dy = sh.pos.y - goal.y;
        const dl = Math.hypot(dx, dy) || 1;
        const stand = { x: sh.pos.x + (dx / dl) * 20, y: sh.pos.y + (dy / dl) * 20 };
        const d = Math.hypot(stand.x - pos.x, stand.y - pos.y);
        if (d > 1.2) pos = { x: pos.x + ((stand.x - pos.x) / d) * 1.2, y: pos.y + ((stand.y - pos.y) / d) * 1.2 };
        puzzle.update(16, pos);
      }
      expect(ticks).toBeLessThan(6000);
      // Andrew follows into the pen via the door.
      pos = { x: door.x + (step.door === 1 ? 0 : 16), y: door.y + (step.door === 1 ? 16 : 0) };
    }
    for (let i = 0; i < 100; i++) puzzle.update(16, { x: 40, y: 40 });
    expect(swings).toBe(5);
    expect(puzzle.isComplete()).toBe(true);
  });
});

describe('chapter 2 script', () => {
  it('opens at the bar', async () => {
    const { run } = newRun();
    run.tick(16, NO_INPUT);
    await settle(run);
    run.tick(16, NO_INPUT);
    expect(run.screenId).toBe('c2.bog');
    expect(run.objective()).toBe('c2.ring');
  });
  it('three clues bring the van and the guards; the crossing, then the farm', async () => {
    const { run } = newRun();
    run.tick(16, NO_INPUT);
    await settle(run);
    for (const p of [T(25, 13), T(29, 13), T(34, 14)]) {
      run.setPlayerPosition(p);
      run.tick(16, NO_INPUT);
      await settle(run);
      run.tick(16, frame({ pressed: ['interact'] }));
      await settle(run);
    }
    await settle(run);
    await settle(run);
    expect(run.flag('clue.tracks')).toBe(true);
    expect(run.objective()).toBe('c2.cross');
    expect(run.isComplete('c2.explore.ring')).toBe(true);
    run.tick(16, NO_INPUT);
    expect(run.stealthHere().length).toBeGreaterThan(0);
    const st = run.stealthHere()[0]!;
    expect(st.runner.guards).toHaveLength(3);
    // Walk the crossing: finishing the stealth section opens the exit.
    run.setPlayerPosition(T(56, 11));
    for (let i = 0; i < 5; i++) run.tick(16, NO_INPUT);
    expect(run.isComplete('c2.stealth.bog')).toBe(true);
    expect(run.objective()).not.toBe('c2.cross');
  });
  it('the lane starts the ram once the conclusion is written', async () => {
    const { run } = newRun();
    run.tick(16, NO_INPUT);
    run.setFlag('concluded', true);
    run.goToScreen('c2.lane', T(6, 6));
    run.tick(16, NO_INPUT);
    await settle(run);
    run.tick(16, NO_INPUT);
    expect(run.boss('c2.setpiece.ram')?.active).toBe(true);
  });
  it('the scripted walk completes every section and the chapter with no missing dialogue', () => {
    const { session, run } = newRun();
    run.tick(16, NO_INPUT);
    let done = 0;
    session.bus.on('chapter:completed', () => {
      done++;
      expect(run.dialogue.missing.size).toBe(0);
    });
    run.walkChapter();
    expect(done).toBeGreaterThanOrEqual(1);
    expect(chapter2.def.sections.every((s) => run.isComplete(s.id))).toBe(true);
  });
});
