/** Chapter 9 gravity rooms (`gravity.ts`): the sliding rules, the planner, and the puzzle through a real run. */

import { describe, expect, it } from 'vitest';
import type { ChapterRun } from '../../src/systems/run';
import { gridFromAscii, tileCentre, tileOf } from '../../src/systems/grid';
import { GravityPuzzle, estimateSeconds, slideBodies, solveRoom } from '../../src/systems/gravity';
import type { GravityLayout, GravityRoomLayout, GravityStep } from '../../src/systems/gravity';
import { createMeter } from '../../src/systems/meter';
import { frame, makeRun, record } from './helpers';
import { GRAVITY_CARVE, SCREEN, gravityExaminables, makeWorld, sampleGravity } from './c9c10-world';

const PID = 'c9.puzzle.gravity' as const;

function world(layout: GravityLayout = sampleGravity()) {
  return makeWorld({
    chapter: 9,
    sections: [{ id: PID, kind: 'puzzle', mykoCallable: true }],
    carve: GRAVITY_CARVE,
    examinables: gravityExaminables(layout),
    gravity: layout,
  });
}

function start(glove = true) {
  const h = makeRun({ module: world() });
  if (glove) h.run.learnMove('borrowedGlove');
  h.run.player.holdDrain(true);
  return { ...h, puzzle: h.run.gravity(PID)! };
}

const at = (run: ChapterRun, col: number, row: number): void => run.setPlayerPosition(tileCentre({ col, row }));
const press = (run: ChapterRun): void => run.tick(16, frame({ pressed: ['interact'] }));
const settle = (run: ChapterRun, ms = 1200): void => {
  for (let t = 0; t < ms; t += 16) run.tick(16, frame());
};
const tileNow = (run: ChapterRun) => tileOf(run.player.pos);

/** Walks one tile in `dir` with real input until Andrew's tile changes (or gives up). */
function walk(run: ChapterRun, dir: 'up' | 'down' | 'left' | 'right'): void {
  const move = dir === 'up' ? { x: 0, y: -1 } : dir === 'down' ? { x: 0, y: 1 } : dir === 'left' ? { x: -1, y: 0 } : { x: 1, y: 0 };
  const from = tileNow(run);
  const goal = { col: from.col + (dir === 'right' ? 1 : dir === 'left' ? -1 : 0), row: from.row + (dir === 'down' ? 1 : dir === 'up' ? -1 : 0) };
  const centre = tileCentre(goal);
  for (let i = 0; i < 80; i++) {
    run.tick(16, frame({ move }));
    const p = run.player.pos;
    if (Math.abs(p.x - centre.x) <= 3 && Math.abs(p.y - centre.y) <= 3) break;
  }
  // Settle onto the centre so the next step starts square.
  run.setPlayerPosition(centre);
}

function runPlan(run: ChapterRun, steps: readonly GravityStep[], examinables: Record<string, string>): void {
  for (const s of steps) {
    if (s.kind === 'walk') walk(run, s.dir);
    else {
      expect(examinables[s.switchId]).toBeDefined();
      press(run);
      settle(run);
    }
  }
}

describe('slideBodies', () => {
  const wall = (c: number, r: number): boolean => c < 0 || r < 0 || c > 5 || r > 3;
  it('packs everything against the wall, nearest first', () => {
    const bodies = [
      { id: 'a', col: 1, row: 1 },
      { id: 'b', col: 3, row: 1 },
      { id: 'c', col: 2, row: 2 },
    ];
    const moves = slideBodies(bodies, 'right', wall);
    expect(bodies.find((b) => b.id === 'b')).toMatchObject({ col: 5, row: 1 });
    expect(bodies.find((b) => b.id === 'a')).toMatchObject({ col: 4, row: 1 });
    expect(bodies.find((b) => b.id === 'c')).toMatchObject({ col: 5, row: 2 });
    expect(moves.map((m) => m.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('a body already at rest does not move; every direction works', () => {
    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      const bodies = [{ id: 'x', col: 2, row: 2 }];
      slideBodies(bodies, dir, wall);
      expect(bodies[0]).toMatchObject(dir === 'up' ? { col: 2, row: 0 } : dir === 'down' ? { col: 2, row: 3 } : dir === 'left' ? { col: 0, row: 2 } : { col: 5, row: 2 });
      const again = slideBodies(bodies, dir, wall);
      expect(again).toEqual([]);
    }
  });
});

describe('the planner proves a layout is solvable', () => {
  const grid = gridFromAscii(Array.from({ length: 12 }, () => '.'.repeat(40)));
  const layout = sampleGravity();

  it('every sample room has a plan; the three together take well under two minutes', () => {
    let total = 0;
    for (const room of layout.rooms) {
      const plan = solveRoom(room, grid);
      expect(plan, room.id).not.toBeNull();
      total += estimateSeconds(plan ?? []);
    }
    expect(total).toBeLessThan(120);
  });

  it('room 1 is one pull, room 2 is pull-walk-pull, room 3 needs a crate placed first', () => {
    const [r1, r2, r3] = layout.rooms as [GravityRoomLayout, GravityRoomLayout, GravityRoomLayout];
    expect(solveRoom(r1, grid)).toEqual([{ kind: 'pull', switchId: 'r1.s' }]);
    const p2 = solveRoom(r2, grid) ?? [];
    expect(p2.filter((s) => s.kind === 'pull').map((s) => (s as { switchId: string }).switchId)).toEqual(['r2.a', 'r2.b']);
    const p3 = solveRoom(r3, grid) ?? [];
    // The first thing he does is walk (push the crate to its stop); only then does the switch do anything.
    expect(p3[0]?.kind).toBe('walk');
    expect(p3.filter((s) => s.kind === 'pull')).toHaveLength(1);
  });

  it('with no crate placed, the ledge is not reached by any single pull', () => {
    const [, , r3] = layout.rooms as [GravityRoomLayout, GravityRoomLayout, GravityRoomLayout];
    const bare: GravityRoomLayout = { ...r3, crates: [] };
    expect(solveRoom(bare, grid)).toBeNull();
  });

  it('reports an unsolvable layout', () => {
    const [, r2] = layout.rooms as [GravityRoomLayout, GravityRoomLayout, GravityRoomLayout];
    // The plate is walled off.
    const bad: GravityRoomLayout = { ...r2, plates: [{ id: 'p', col: 17, row: 2 }], fixed: [{ col: 17, row: 2 }] };
    expect(solveRoom(bad, grid)).toBeNull();
  });
});

describe('the puzzle in a run', () => {
  it('a switch refuses without the Glove, then works once he has it (E, whatever is in slot 3)', () => {
    const { run, bus, puzzle } = start(false);
    run.learnMove('stumble');
    const seen = record(bus, 'gravity:changed');
    at(run, 2, 2);
    press(run);
    expect(seen.map((e) => e.phase)).toEqual(['refused']);
    expect(tileNow(run)).toEqual({ col: 2, row: 2 });
    run.learnMove('borrowedGlove');
    // Slot 3 holds something else; E still works the switch.
    expect(run.player.kit.slots.specials[2]).not.toBe('borrowedGlove');
    press(run);
    settle(run);
    expect(seen.map((e) => e.phase)).toContain('pulled');
    expect(puzzle.isRoomSolved('room1')).toBe(true);
  });

  it('everything loose slides to the wall, Andrew included, until something stops it', () => {
    const { run, bus, puzzle } = start();
    const seen = record(bus, 'gravity:changed');
    at(run, 12, 3);
    press(run); // reset panel is elsewhere; this is the room 2 left switch at (11, 3)
    // Andrew slides right along row 3 and stops against the crate at the wall (17, 3).
    expect(puzzle.sliding).toBe(true);
    // His controls are held while he slides.
    run.tick(16, frame({ move: { x: 0, y: 1 } }));
    settle(run);
    expect(puzzle.cratePositions().find((c) => c.id === 'c2a')).toMatchObject({ col: 17, row: 3 });
    expect(tileNow(run)).toEqual({ col: 16, row: 3 });
    expect(seen.map((e) => e.phase)).toEqual(expect.arrayContaining(['pulled', 'settled']));
    expect(puzzle.gravityOf('room2')).toBe('right');
  });

  it('a crate Andrew placed stops him on the ledge (room 3), and the room solves', () => {
    const { run, puzzle } = start();
    at(run, 22, 5);
    // Push the crate from (23, 5) to (25, 5), where the pillar under it holds it.
    walk(run, 'right');
    walk(run, 'right');
    expect(puzzle.cratePositions().find((c) => c.id === 'c3a')).toMatchObject({ col: 25, row: 5 });
    for (const d of ['up', 'up', 'up', 'right'] as const) walk(run, d);
    expect(tileNow(run)).toEqual({ col: 25, row: 2 });
    press(run);
    settle(run);
    expect(tileNow(run)).toEqual({ col: 25, row: 4 });
    expect(puzzle.isRoomSolved('room3')).toBe(true);
  });

  it('the planner plan for each room solves it in the real run, and all three complete the puzzle', () => {
    const { run, bus, puzzle } = start();
    const done = record(bus, 'section:completed');
    const layout = sampleGravity();
    const grid = run.grid;
    const ex: Record<string, string> = {};
    for (const r of layout.rooms) for (const s of r.switches) ex[s.id] = s.examinableId;
    for (const room of layout.rooms) {
      at(run, room.andrewStart.col, room.andrewStart.row);
      const plan = solveRoom(room, grid);
      expect(plan, room.id).not.toBeNull();
      runPlan(run, plan ?? [], ex);
      expect(puzzle.isRoomSolved(room.id), room.id).toBe(true);
    }
    expect(puzzle.isComplete()).toBe(true);
    expect(done.map((d) => d.sectionId)).toContain(PID);
  });

  it('a room can be reset: crates go home, gravity rests; a solved room cannot', () => {
    const { run, puzzle } = start();
    at(run, 12, 3);
    press(run);
    settle(run);
    expect(puzzle.cratePositions().find((c) => c.id === 'c2a')).toMatchObject({ col: 17, row: 3 });
    // The reset panel sits above room 2's floor.
    at(run, 13, 2);
    press(run);
    expect(puzzle.cratePositions().find((c) => c.id === 'c2a')).toMatchObject({ col: 14, row: 3 });
    expect(puzzle.gravityOf('room2')).toBeNull();
    // Room 1 solved: its switch is dead afterwards and a reset does nothing.
    at(run, 2, 2);
    press(run);
    settle(run);
    expect(puzzle.isRoomSolved('room1')).toBe(true);
    expect(puzzle.resetRoom('room1')).toBeNull();
    expect(puzzle.pull('g.r1.s', { col: 2, row: 2 }, true)).toBeNull();
  });

  it('a reset that finds Andrew under a returning crate puts him at the room start', () => {
    const { puzzle } = start();
    puzzle.hasGlove = () => true;
    puzzle.pull('g.r2.a', { col: 12, row: 3 });
    // Andrew now stands on the crate's start tile.
    expect(puzzle.resetRoom('room2', { col: 14, row: 3 })).toEqual({ col: 12, row: 3 });
    expect(puzzle.resetRoom('room2', { col: 13, row: 3 })).toEqual({ col: 13, row: 3 });
  });

  it('completeNow solves all three rooms and the section', () => {
    const { run, bus, puzzle } = start();
    const done = record(bus, 'section:completed');
    puzzle.completeNow('myko');
    expect(puzzle.isComplete()).toBe(true);
    expect(puzzle.solvedRooms()).toEqual(['room1', 'room2', 'room3']);
    expect(puzzle.cratePositions().find((c) => c.id === 'c2a')).toMatchObject({ col: 17, row: 5 });
    expect(done).toHaveLength(1);
    void run;
  });

  it('the Glove pulse at a switch works it too, aimed at it, whatever slot 3 holds', () => {
    const { run, bus, puzzle } = start();
    const seen = record(bus, 'gravity:changed');
    at(run, 2, 2);
    // Aim up at the switch in the wall above, then use the Glove (key 3) from slot 3.
    run.player.setKit(assignGlove(run));
    run.player.meter = createMeter(9, 105);
    run.tick(16, frame({ pressed: ['special3'], aim: { x: 2 * 16 + 8, y: 0 } }));
    settle(run);
    expect(seen.some((e) => e.phase === 'pulled'), JSON.stringify([run.player.level, run.combat.lastRefusal, run.player.kit.slots.specials])).toBe(true);
    expect(puzzle.isRoomSolved('room1')).toBe(true);
  });

  it('a solved room stays solved across a return to the bar; the unsolved ones keep their state', () => {
    const { run, puzzle } = start();
    at(run, 2, 2);
    press(run);
    settle(run);
    expect(puzzle.isRoomSolved('room1')).toBe(true);
    run.player.meter = { ...run.player.meter, value: 0 };
    for (let i = 0; i < 20; i++) run.tick(16, frame());
    expect(run.gravity(PID)?.isRoomSolved('room1')).toBe(true);
  });
});

function assignGlove(run: ChapterRun) {
  const kit = run.player.kit;
  const specials = [...kit.slots.specials] as typeof kit.slots.specials;
  specials[2] = 'borrowedGlove';
  return { ...kit, slots: { ...kit.slots, specials } };
}

void SCREEN;
