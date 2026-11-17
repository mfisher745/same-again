/**
 * Chapter 6 bottles lesson: one lone drone spawned when Andrew is spotted on the farm track. A bottle brings it down and
 * that plays `c6.bottles.done`. It is no part of the stealth alarm or the clean run, and it is never saved.
 */

import { describe, expect, it } from 'vitest';
import { LESSON_DRONE_SPAWN, STEALTH_START, TRACK_SPOTTED_AREA } from '../../src/chapters/06/maps';
import { createKit } from '../../src/systems/kit';
import { advance, frame, record } from './helpers';
import { crossFields, doMotel, doTown, mid, newGame, settle, toFields } from './chapter6-steps';

type Run = Awaited<ReturnType<typeof newGame>>['run'];

const droneCount = (run: Run): number => run.enemies().filter((a) => a.enemyId === 'drone' && !a.down).length;

/** In the fields, stealth under way, then spotted on the track. */
async function spotted() {
  const g = await newGame();
  await doMotel(g.run);
  await doTown(g.run);
  await toFields(g.run);
  g.run.setPlayerPosition(mid(STEALTH_START));
  await settle(g.run, 3);
  const shown = record(g.run.bus, 'dialogue:show');
  g.run.setPlayerPosition(mid(TRACK_SPOTTED_AREA));
  await settle(g.run, 6);
  return { ...g, shown };
}

/** Drone hovering where a bottle can reach it, Andrew with bottles; throws until it falls. */
function throwBottle(run: Run): void {
  const d = run.enemies().find((a) => a.enemyId === 'drone')!;
  run.setPlayerPosition({ x: 200, y: 200 });
  d.pos = { x: 280, y: 200 };
  d.stationary = true;
  run.player.setKit({ ...createKit(), bottles: 2 });
  // A bottle does 15 and the drone has 30: it takes two.
  for (let i = 0; i < 2; i++) {
    run.tick(16, frame({ pressed: ['aimHold'], aim: d.pos }));
    run.tick(16, frame({ released: ['aimHold'], aim: d.pos }));
    advance(run, 1500);
  }
}

describe('chapter 6 lesson drone', () => {
  it('spawns one drone at the lesson spot when he is spotted, and says the lesson', async () => {
    const { run, shown } = await spotted();
    expect(shown.map((s) => s.sequenceId)).toContain('c6.bottles.lesson');
    const drones = run.enemies().filter((a) => a.enemyId === 'drone');
    expect(drones).toHaveLength(1);
    expect(Math.abs(drones[0]!.pos.x - LESSON_DRONE_SPAWN.x)).toBeLessThan(40);
    // Spotted again while it hovers does not make a second one.
    run.setPlayerPosition({ x: 40, y: 200 });
    await settle(run, 2);
    run.setPlayerPosition(mid(TRACK_SPOTTED_AREA));
    await settle(run, 4);
    expect(droneCount(run)).toBe(1);
  });

  it('a thrown bottle brings it down, and c6.bottles.done plays once', async () => {
    const { run, shown } = await spotted();
    const fell = record(run.bus, 'enemy:defeated');
    throwBottle(run);
    await settle(run, 6);
    expect(fell.filter((e) => e.enemyId === 'drone')).toHaveLength(1);
    expect(run.flag('bottles.done')).toBe(true);
    expect(shown.filter((s) => s.sequenceId === 'c6.bottles.done')).toHaveLength(1);
  });

  it('is no part of the alarm: no alarm event, and the clean run is still possible', async () => {
    const { run } = await spotted();
    const alarms = record(run.bus, 'stealth:alarm');
    const clean = record(run.bus, 'stealth:cleanRun');
    throwBottle(run);
    await settle(run, 6);
    expect(alarms).toHaveLength(0);
    expect(run.fight('c6.stealth.fields.alarm' as never)?.active ?? false).toBe(false);
    run.setPlayerPosition(mid(STEALTH_START));
    await crossFields(run);
    expect(alarms).toHaveLength(0);
    expect(clean).toHaveLength(1);
    expect(run.flag('fields.clean')).toBe(true);
  });

  it('is gone after a return to the bar, and spawns again if the lesson is not done', async () => {
    const { run } = await spotted();
    expect(droneCount(run)).toBe(1);
    run.holdDrain(false);
    run.player.meter = { ...run.player.meter, value: 0.01, tea: null };
    for (let i = 0; i < 12; i++) run.tick(16, frame());
    run.completeBarReturn();
    await settle(run, 4);
    expect(droneCount(run)).toBe(0);
    expect(run.flag('bottles.done')).not.toBe(true);
    await toFields(run);
    run.setPlayerPosition(mid(STEALTH_START));
    await settle(run, 3);
    run.setPlayerPosition(mid(TRACK_SPOTTED_AREA));
    await settle(run, 6);
    expect(droneCount(run)).toBe(1);
  });

  it('is not spawned again once the lesson is done', async () => {
    const { run, shown } = await spotted();
    throwBottle(run);
    await settle(run, 6);
    expect(run.flag('bottles.done')).toBe(true);
    run.setPlayerPosition({ x: 40, y: 200 });
    await settle(run, 2);
    run.setPlayerPosition(mid(TRACK_SPOTTED_AREA));
    await settle(run, 6);
    expect(droneCount(run)).toBe(0);
    expect(shown.filter((s) => s.sequenceId === 'c6.bottles.lesson')).toHaveLength(1);
  });

  it('spawnLoneEnemy: a screen change removes it without calling its callback', async () => {
    const { run } = await newGame();
    let called = 0;
    const h = run.spawnLoneEnemy('drone', { x: 100, y: 100 }, { onDefeated: () => called++ });
    expect(h.alive()).toBe(true);
    run.goToScreen('c6.town', { x: 100, y: 100 });
    expect(h.alive()).toBe(false);
    expect(called).toBe(0);
  });
});
