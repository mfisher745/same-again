/**
 * Chapter 8: the junction puzzle (three toggles, one per box, any order, and the fence fight waits for it) and the fence
 * fight (sunset, the truck, its headlights, four agents, the clipboard, the board).
 */

import { describe, expect, it } from 'vitest';
import { PROP } from '../../src/art/props';
import {
  CLIPBOARD_SPOT,
  CORRIDOR_LINES,
  FENCE_AGENT_SPAWNS,
  FIGHT_HEADLIGHTS,
  FIGHT_TRUCK_PROP,
  JUNCTION_BOXES,
  SENSOR_LINES,
  boxFrame,
  junctionPropId,
} from '../../src/chapters/08/maps';
import { TUNING } from '../../src/content/tuning';
import type { Vec2 } from '../../src/core/types';
import { frame, record } from './helpers';
import { BOARD, FIGHT, PUZZLE, crossPerimeter, doBoard, examine, mid, newGame, pressBox, settle, solveJunctions, startFence, winFence } from './chapter8-steps';

type Run = Awaited<ReturnType<typeof newGame>>['run'];

/** Sensors of a line, enabled or not, in the running stealth section. */
const sensorsOn = (run: Run, line: number): boolean[] =>
  run.stealthHere()[0]!.runner.hazards.filter((h) => h.id.startsWith(`c8.line${line}.`)).map((h) => h.enabled);

const frameOf = (run: Run, boxId: string) => run.dressing.prop(junctionPropId(boxId))?.frame;

async function throughStealth() {
  const g = await newGame();
  await crossPerimeter(g.run);
  return g;
}

describe('chapter 8: the junction boxes', () => {
  it('every sensor of every line is a real ground sensor, and every box is an examinable at its spot', async () => {
    const { run } = await throughStealth();
    for (const l of SENSOR_LINES) expect(sensorsOn(run, l.line)).toHaveLength(l.sensors.length);
    const examinables = run.screenLayout.id === 'c8.perimeter' ? JUNCTION_BOXES.map((b) => `c8.junction.${b.id}`) : [];
    expect(examinables).toHaveLength(3);
  });

  it('the diagram on each door shows the two lines it toggles, and a pressed box shows its lever thrown', async () => {
    const { run } = await throughStealth();
    for (const b of JUNCTION_BOXES) expect(frameOf(run, b.id), b.id).toBe(boxFrame(b, false));
    await pressBox(run, 'near');
    const near = JUNCTION_BOXES[0]!;
    expect(frameOf(run, 'near')).toBe(boxFrame(near, true));
    expect(frameOf(run, 'near')).toBe(PROP.junctionBox.thrown['4-5']);
    expect(frameOf(run, 'middle')).toBe(boxFrame(JUNCTION_BOXES[1]!, false));
    expect(PROP.junctionBox.lines['1-3']).toBe(boxFrame(JUNCTION_BOXES[1]!, false));
    expect(PROP.junctionBox.lines['1-2']).toBe(boxFrame(JUNCTION_BOXES[2]!, false));
    await pressBox(run, 'near');
    expect(frameOf(run, 'near')).toBe(boxFrame(near, false));
  });

  it('a box flips its two lines and switches exactly their sensors off; pressing again undoes it', async () => {
    const { run } = await throughStealth();
    const toggled = record(run.bus, 'junctions:toggled');
    await pressBox(run, 'near');
    expect(toggled[0]).toMatchObject({ boxId: 'near', off: ['1', '2'] });
    expect(sensorsOn(run, 1).every((e) => !e)).toBe(true);
    expect(sensorsOn(run, 2).every((e) => !e)).toBe(true);
    expect(sensorsOn(run, 3).every((e) => e)).toBe(true);
    await pressBox(run, 'near');
    expect(sensorsOn(run, 2).every((e) => e)).toBe(true);
  });

  it('turning one line off and another back on is the "hobby" line', async () => {
    const { run } = await throughStealth();
    const shown = record(run.bus, 'dialogue:show');
    await pressBox(run, 'middle');
    await pressBox(run, 'far');
    expect(shown.map((s) => s.sequenceId)).toContain('c8.junctions.wrong');
  });

  it.each([
    ['near', 'middle', 'far'],
    ['far', 'middle', 'near'],
    ['middle', 'near', 'far'],
    ['far', 'near', 'middle'],
  ] as const)('three toggles in the order %s, %s, %s open the corridor (lines 2, 3, 4 dark)', async (a, b, c) => {
    const { run } = await throughStealth();
    const shown = record(run.bus, 'dialogue:show');
    run.setPlayerPosition(mid({ x: 26 * 16, y: 34 * 16, width: 8 * 16, height: 4 * 16 }));
    await settle(run, 6);
    for (const id of [a, b, c]) await pressBox(run, id);
    expect(run.isComplete(PUZZLE)).toBe(true);
    for (const l of CORRIDOR_LINES) expect(sensorsOn(run, l).every((e) => !e), `line ${l}`).toBe(true);
    expect(sensorsOn(run, 5).every((e) => e)).toBe(true);
    expect(shown.map((s) => s.sequenceId)).toContain('c8.junctions.done');
    expect(run.objective()).toBe('c8.fence');
    for (const box of JUNCTION_BOXES) expect(frameOf(run, box.id)).toBe(boxFrame(box, true));
  });

  it('the puzzle is the current section once the way across is behind him, so Myko can be called in on it; and the call solves it', async () => {
    const { run } = await throughStealth();
    const shown = record(run.bus, 'dialogue:show');
    expect(run.myko.tryCall()).toBe(true);
    for (let i = 0; i < 400; i++) {
      run.tick(50, frame());
      if (i % 20 === 0) await settle(run, 1);
    }
    await settle(run, 4);
    expect(run.isComplete(PUZZLE)).toBe(true);
    expect(shown.map((s) => s.sequenceId)).toContain('c8.call.puzzle');
    expect(shown.map((s) => s.sequenceId)).not.toContain('c8.junctions.done');
  });

  it('the fence fight does not start until the puzzle is solved: not at the fence, and the sun does not set', async () => {
    const { run } = await throughStealth();
    run.setPlayerPosition(mid({ x: 34 * 16, y: 5 * 16, width: 32 * 16, height: 5 * 16 }));
    await settle(run, 20);
    expect(run.fight(FIGHT)?.active).toBe(false);
    expect(run.isNight()).toBe(false);
    expect(run.dressing.prop('fight.truck')?.visible).toBe(false);
  });
});

describe('chapter 8: the fence fight', () => {
  async function atFence() {
    const g = await throughStealth();
    await solveJunctions(g.run);
    return g;
  }

  it('the sun goes down as he arrives, the truck drives in and parks, then four agents', async () => {
    const { run } = await atFence();
    const shown = record(run.bus, 'dialogue:show');
    run.setPlayerPosition(mid({ x: 34 * 16, y: 5 * 16, width: 32 * 16, height: 5 * 16 }));
    run.tick(16, frame());
    await settle(run, 2);
    // The sun is down and the truck is on its way in: the fight has not begun.
    expect(run.isNight()).toBe(true);
    expect(run.fight(FIGHT)?.active).toBe(false);
    expect(run.dressing.prop('fight.truckDrive')?.visible).toBe(true);
    expect(run.dressing.prop('fight.truck')?.visible).toBe(false);
    for (let i = 0; i < 400 && run.fight(FIGHT)?.active !== true; i++) run.tick(16, frame());
    await settle(run, 2);
    expect(run.fight(FIGHT)?.active).toBe(true);
    expect(run.dressing.prop('fight.truckDrive')?.visible).toBe(false);
    expect(run.dressing.prop('fight.truck')?.visible).toBe(true);
    expect(shown.map((s) => s.sequenceId)).toContain('c8.fence.intro');
    const agents = run.fight(FIGHT)!.aliveActors();
    expect(agents).toHaveLength(4);
    expect(agents.every((a) => a.enemyId === 'agent')).toBe(true);
    expect(FENCE_AGENT_SPAWNS).toHaveLength(4);
    expect(run.objective()).toBe('c8.fence');
  });

  it('the headlights are on while the fight is under way and not before or after, and a dart inside the cone flies faster', async () => {
    const { run } = await atFence();
    expect(run.headlightsHere()).toHaveLength(0);
    await startFence(run);
    expect(run.headlightsHere()).toEqual([FIGHT_HEADLIGHTS]);
    const dart = (from: Vec2) => {
      run.spawnProjectile({
        owner: 'enemy',
        source: { kind: 'enemy', enemyId: 'agent', attackId: 'dart' },
        screenId: run.screenId,
        from,
        angleDeg: 90,
        shape: { kind: 'projectile', speed: 150, range: 180, pierce: 0, lobbed: false, deflectable: false, impactNoiseRadius: 0 },
        damage: 10,
        knockback: 10,
        frame: 'dart',
      });
      return run.projectiles()[run.projectiles().length - 1]!;
    };
    const { position, cone } = FIGHT_HEADLIGHTS;
    const inside = dart({ x: position.x + cone.range / 2, y: position.y });
    const outside = dart({ x: position.x + cone.range / 2, y: position.y + 200 });
    run.tick(16, frame());
    expect(inside.speedScale).toBe(TUNING.overhaul!.headlights.dartSpeedMultiplier);
    expect(outside.speedScale).toBe(1);
    await winFence(run);
    expect(run.headlightsHere()).toHaveLength(0);
  });

  it('the parked truck sits where the headlights are, with its shade', async () => {
    const { run } = await atFence();
    await startFence(run);
    expect(FIGHT_HEADLIGHTS.position.x).toBe((FIGHT_TRUCK_PROP.col + 3) * 16);
    expect(run.shadeAreasHere().length).toBeGreaterThan(0);
  });

  it('winning it: the end line, the clipboard on the ground, the fence gate open, the way to Gate C still shut until the plan', async () => {
    const { run } = await atFence();
    const shown = record(run.bus, 'dialogue:show');
    await startFence(run);
    expect(run.dressing.prop('fence.clipboard')?.visible).toBe(false);
    expect(run.dressing.prop('fence.gate')?.visible).toBe(true);
    await winFence(run);
    expect(shown.map((s) => s.sequenceId)).toContain('c8.fence.end');
    expect(run.dressing.prop('fence.clipboard')?.visible).toBe(true);
    expect(run.dressing.prop('fence.gate')?.visible).toBe(false);
    expect(run.dressing.prop('fence.gate.open')?.visible).toBe(true);
    expect(run.objective()).toBe('c8.board');
    // The way to Gate C is shut until the board is solved.
    run.setPlayerPosition({ x: 50 * 16 + 8, y: 1 * 16 + 8 });
    await settle(run, 3);
    expect(run.screenId).toBe('c8.perimeter');
    expect(CLIPBOARD_SPOT).toBeDefined();
  });

  it('the clipboard is the clue only after the fight, and it opens the board', async () => {
    const { run } = await atFence();
    run.addEvidence('c7.clue.permit' as never);
    examine(run, 'c8.clue.shift');
    await settle(run, 4);
    expect(JSON.stringify(run.snapshot().casebook)).not.toContain('c8.clue.shift');
    await startFence(run);
    await winFence(run);
    examine(run, 'c8.clue.shift');
    await settle(run, 6);
    expect(JSON.stringify(run.snapshot().casebook)).toContain('c8.clue.shift');
    expect(run.activeDeduction()?.isOpen).toBe(true);
    expect(run.dressing.prop('fence.clipboard')?.visible).toBe(false);
  });

  it('the board takes the fuel log, the clipboard and the permit from chapter 7, and not the car; the wrong ones get a remark', async () => {
    const { run } = await atFence();
    await startFence(run);
    await winFence(run);
    for (const id of ['c8.clue.schedule', 'c8.clue.car', 'c7.clue.permit']) run.addEvidence(id as never);
    examine(run, 'c8.clue.shift');
    await settle(run, 6);
    const shown = record(run.bus, 'dialogue:show');
    run.submitDeduction(BOARD, ['c8.clue.car', 'c8.clue.shift', 'c7.clue.permit'] as never);
    await settle(run, 4);
    expect(run.isComplete(BOARD)).toBe(false);
    expect(shown.some((s) => s.sequenceId.startsWith('c8.board.wrong'))).toBe(true);
    await doBoard(run);
    expect(run.isComplete(BOARD)).toBe(true);
  });

  it('a Myko call finishes the fight and plays c8.call.fight; the clipboard is still there', async () => {
    const { run } = await atFence();
    await startFence(run);
    const shown = record(run.bus, 'dialogue:show');
    expect(run.myko.tryCall()).toBe(true);
    for (let i = 0; i < 400; i++) {
      run.tick(50, frame());
      if (i % 20 === 0) await settle(run, 1);
    }
    await settle(run, 4);
    expect(run.isComplete(FIGHT)).toBe(true);
    expect(shown.map((s) => s.sequenceId)).toContain('c8.call.fight');
    expect(shown.map((s) => s.sequenceId)).not.toContain('c8.fence.end');
    expect(run.dressing.prop('fence.clipboard')?.visible).toBe(true);
  });
});
