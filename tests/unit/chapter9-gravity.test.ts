/**
 * Chapter 9 gravity rooms: the chapter's own three rooms through the system's planner (`solveRoom`), the converter from the
 * maps' plain data, and the puzzle in a real run (the Glove from any slot, the refusal line, the reset panel, the solved rooms).
 */

import { describe, expect, it } from 'vitest';
import { GRAVITY_LAYOUT, GRAVITY_ROOMS, gravityCrateId, gravityResetId, gravityTile } from '../../src/chapters/09/index';
import { chapter9 } from '../../src/chapters/09/index';
import { estimateSeconds, solveRoom } from '../../src/systems/gravity';
import type { GravityRoomLayout } from '../../src/systems/gravity';
import { tileCentre, tileOf } from '../../src/systems/grid';
import { NO_INPUT, frame, record } from './helpers';
import { GRAVITY, doProofsOffices, enter, examine, mid, newGame, settle, solveGravity, solveGravityRoom, takeGlove, toLabs } from './chapter9-steps';

const labsGrid = () => chapter9.screens.find((s) => s.id === 'c9.labs')!.grid;
const rooms = GRAVITY_LAYOUT.rooms as readonly [GravityRoomLayout, GravityRoomLayout, GravityRoomLayout];

describe('chapter 9 gravity: the layout through the planner', () => {
  it('the converter keeps the maps\' cells: floors, pillars, ledges, plates, crates and switches', () => {
    expect(rooms).toHaveLength(3);
    GRAVITY_ROOMS.forEach((def, i) => {
      const r = rooms[i]!;
      expect(r.id).toBe(def.id);
      expect(r.switches.map((s) => s.id)).toEqual(def.switches.map((s) => s.id));
      expect(r.crates.map((c) => c.id)).toEqual(def.crates.map((_, k) => gravityCrateId(def, k)));
      expect(r.andrewStart).toEqual(gravityTile(def, def.start));
      expect(r.resetExaminableId).toBe(gravityResetId(def));
      for (const l of r.ledges) {
        const local = { col: l.col - def.origin.col, row: l.row - def.origin.row };
        expect(def.rows[local.row]?.[local.col]).toBe('H');
      }
      for (const f of r.fixed) {
        const local = { col: f.col - def.origin.col, row: f.row - def.origin.row };
        expect(def.rows[local.row]?.[local.col]).toBe('#');
      }
    });
    expect(rooms[0]!.ledges).toHaveLength(1);
    expect(rooms[1]!.plates).toHaveLength(1);
    expect(rooms[2]!.ledges).toHaveLength(1);
  });

  it('every room has a plan on the labs grid, and the three together take under two minutes', () => {
    let total = 0;
    for (const room of rooms) {
      const plan = solveRoom(room, labsGrid());
      expect(plan, room.id).not.toBeNull();
      total += estimateSeconds(plan ?? []);
    }
    expect(total).toBeLessThan(120);
  });

  it('room 1 is one pull; room 2 pulls left then up; room 3 places the crate first and pulls once', () => {
    expect(solveRoom(rooms[0], labsGrid())?.filter((s) => s.kind === 'pull')).toHaveLength(1);
    const p2 = solveRoom(rooms[1], labsGrid()) ?? [];
    expect(p2.filter((s) => s.kind === 'pull').map((s) => (s as { switchId: string }).switchId)).toEqual(['c9.gravity.room2.left', 'c9.gravity.room2.up']);
    const p3 = solveRoom(rooms[2], labsGrid()) ?? [];
    expect(p3.some((s) => s.kind === 'walk')).toBe(true);
    expect(p3.filter((s) => s.kind === 'pull').length).toBeGreaterThanOrEqual(1);
  });

  it('with no crate the third room cannot be solved (the crate is what stops him on the ledge)', () => {
    expect(solveRoom({ ...rooms[2], crates: [] }, labsGrid())).toBeNull();
  });

  it('every switch and reset panel has an examinable on the labs, beside its wall cell', () => {
    for (const room of rooms) {
      for (const sw of room.switches) {
        const ex = chapter9.examinables.find((e) => e.id === sw.examinableId);
        expect(ex?.screenId).toBe('c9.labs');
        expect(tileOf(ex!.position)).toEqual({ col: sw.col, row: sw.row });
      }
      expect(chapter9.examinables.some((e) => e.id === room.resetExaminableId)).toBe(true);
    }
  });
});

describe('chapter 9 gravity: in a real run', () => {
  it('the three rooms, by the planner\'s plans with real walking and real E, finish the puzzle and open the way on', async () => {
    const { run } = await newGame();
    await takeGlove(run);
    expect(run.player.kit.moves).toContain('borrowedGlove');
    await toLabs(run);
    const done = record(run.bus, 'section:completed');
    run.player.holdDrain(true);
    await solveGravity(run);
    const puzzle = run.gravity(GRAVITY)!;
    expect(puzzle.solvedRooms()).toEqual(rooms.map((r) => r.id));
    expect(run.isComplete(GRAVITY)).toBe(true);
    expect(done.map((d) => d.sectionId)).toContain(GRAVITY);
    expect(run.objective()).toBe('c9.labs');
    // The starting-place crate props are hidden: the world view draws the live ones.
    expect(run.dressing.prop(gravityCrateId(GRAVITY_ROOMS[1]!, 0))?.visible).toBe(false);
  });

  it('a switch without the Glove is refused with its line; with it, E works whatever is in slot 3', async () => {
    const { run } = await newGame();
    await toLabs(run);
    run.player.holdDrain(true);
    const shown = record(run.bus, 'dialogue:show');
    const seen = record(run.bus, 'gravity:changed');
    const room = rooms[0];
    run.setPlayerPosition(tileCentre({ col: room.switches[0]!.col - 1, row: room.switches[0]!.row }));
    run.tick(16, frame({ pressed: ['interact'] }));
    await settle(run, 3);
    expect(seen.map((e) => e.phase)).toEqual(['refused']);
    expect(shown.map((s) => s.sequenceId)).toContain('c9.gravity.noGlove');
    // Slot 3 holds another move; the Glove is learned into a taken slot. E still works the switch.
    run.learnMove('stumble');
    run.learnMove('borrowedGlove');
    expect(run.player.kit.slots.specials[2]).not.toBe('borrowedGlove');
    run.tick(16, frame({ pressed: ['interact'] }));
    for (let t = 0; t < 1200; t += 16) run.tick(16, NO_INPUT);
    expect(run.gravity(GRAVITY)!.isRoomSolved(room.id)).toBe(true);
  });

  it('the Glove from the box works a switch with E whichever slot it is in (the chapter starts with slot 3 taken)', async () => {
    const { run } = await newGame();
    await takeGlove(run);
    expect(run.player.kit.moves).toContain('borrowedGlove');
    expect(run.player.kit.slots.specials[2]).not.toBe('borrowedGlove');
    await toLabs(run);
    run.player.holdDrain(true);
    await solveGravityRoom(run, 1);
    expect(run.gravity(GRAVITY)!.isRoomSolved(rooms[0].id)).toBe(true);
  });

  it('the reset panel puts an unsolved room back with its line; a solved room\'s panel is silent', async () => {
    const { run } = await newGame();
    await takeGlove(run);
    await toLabs(run);
    run.player.holdDrain(true);
    const puzzle = run.gravity(GRAVITY)!;
    const room = rooms[1];
    const crate = room.crates[0]!;
    // Pull the left switch (Andrew stands at it), then reset from the panel.
    const sw = room.switches.find((s) => s.dir === 'left')!;
    run.setPlayerPosition(tileCentre({ col: sw.col - 1, row: sw.row }));
    run.tick(16, frame({ pressed: ['interact'] }));
    for (let t = 0; t < 1200; t += 16) run.tick(16, NO_INPUT);
    expect(puzzle.cratePositions().find((c) => c.id === crate.id)).not.toMatchObject({ col: crate.col, row: crate.row });
    const shown = record(run.bus, 'dialogue:show');
    examine(run, room.resetExaminableId!, tileCentre({ col: tileOf(chapter9.examinables.find((e) => e.id === room.resetExaminableId)!.position).col, row: tileOf(chapter9.examinables.find((e) => e.id === room.resetExaminableId)!.position).row - 1 }));
    await settle(run, 3);
    expect(puzzle.cratePositions().find((c) => c.id === crate.id)).toMatchObject({ col: crate.col, row: crate.row });
    expect(shown.map((s) => s.sequenceId)).toContain('c9.gravity.reset');
    // Solved: the panel does nothing and says nothing.
    await solveGravityRoom(run, 1);
    const after = record(run.bus, 'dialogue:show');
    const r1 = rooms[0];
    examine(run, r1.resetExaminableId!, tileCentre({ col: tileOf(chapter9.examinables.find((e) => e.id === r1.resetExaminableId)!.position).col, row: tileOf(chapter9.examinables.find((e) => e.id === r1.resetExaminableId)!.position).row - 1 }));
    await settle(run, 3);
    expect(after.map((s) => s.sequenceId)).not.toContain('c9.gravity.reset');
  });

  it('completeNow (the Myko call) solves all three rooms and the section', async () => {
    const { run } = await newGame();
    await toLabs(run);
    run.gravity(GRAVITY)!.completeNow('myko');
    expect(run.gravity(GRAVITY)!.solvedRooms()).toHaveLength(3);
    expect(run.isComplete(GRAVITY)).toBe(true);
  });

  it('the room prompts play when Andrew walks up to each door', async () => {
    const { run } = await newGame();
    await toLabs(run);
    const shown = record(run.bus, 'dialogue:show');
    for (const n of [1, 2, 3]) {
      run.setPlayerPosition(mid({ x: 0, y: 0, width: 0, height: 0 }));
      await enter(run, 'c9.labs', mid(chapter9.triggers.find((t) => t.id === `c9.trig.gravity.${n}`)!.area));
    }
    const ids = shown.map((s) => s.sequenceId);
    for (const id of ['c9.gravity.intro', 'c9.gravity.room2', 'c9.gravity.room3']) expect(ids).toContain(id);
    void doProofsOffices;
  });
});
