/**
 * Chapter 6, the fields: tall corn hides him when he is still and gives him away when he moves, the clean-run jar, the caught
 * line, the coolers of light beer, the bottles lesson and the drone fight.
 */

import { describe, expect, it } from 'vitest';
import { chapter6 } from '../../src/chapters/06/index';
import { COOLER_SPOTS, FARM_STAND_PICKUP, FIELDS_CORN, STEALTH_START, T, TRACK_SPOTTED_AREA } from '../../src/chapters/06/maps';
import { TUNING } from '../../src/content/tuning';
import type { ChapterModule } from '../../src/core/chapter';
import { drinkItem, frame, placeAt, record, startChapterGame } from './helpers';
import { NO_INPUT, settleDialogue } from './helpers';
import { crossFields, doMotel, doTown, enter, intoYard, mid, newGame, settle, toFields, winDrones } from './chapter6-steps';

/** The real chapter with one stationary drone over the corn and the corn not blocking sight (the spec: corn hides by standing still, not by being a wall). */
function oneDrone(at: { col: number; row: number }): ChapterModule {
  const fieldsIndex = chapter6.screens.findIndex((s) => s.id === 'c6.fields');
  const fields = chapter6.screens[fieldsIndex]!;
  const open = { ...fields.grid, blocksSight: fields.grid.blocksSight.map(() => false) };
  const section = {
    ...chapter6.def.stealthSections[0]!,
    guards: [{ enemyId: 'drone' as const, route: { mode: 'stationary' as const, waypoints: [{ position: T(at.col, at.row), waitMs: 0 }] } }],
  };
  return {
    ...chapter6,
    def: { ...chapter6.def, stealthSections: [section] },
    screens: chapter6.screens.map((s, i) => (i === fieldsIndex ? { ...s, grid: open } : s)),
  };
}

async function inFieldsWithDrone(at: { col: number; row: number }, facingDeg: number) {
  const g = startChapterGame(oneDrone(at), 'chapter');
  const { run } = g;
  run.tick(16, NO_INPUT);
  await settleDialogue(run);
  run.goToScreen('c6.fields', T(20, 12));
  run.startSection('c6.stealth.fields');
  const guard = run.stealthHere()[0]!.runner.guards[0]!;
  guard.pos = T(at.col, at.row);
  guard.facingDeg = facingDeg;
  return { ...g, guard };
}

describe('chapter 6: corn in the fields', () => {
  it('the layout stands corn on the rows (and the arena), and not on the track or in the maze', () => {
    const fields = chapter6.screens.find((s) => s.id === 'c6.fields')!;
    const tiles = new Set<string>();
    for (const r of fields.corn!) for (let dy = 0; dy < r.height; dy++) for (let dx = 0; dx < r.width; dx++) tiles.add(`${r.col + dx},${r.row + dy}`);
    expect(tiles.size).toBe(FIELDS_CORN.length);
    for (const t of FIELDS_CORN) expect(tiles.has(`${t.col},${t.row}`)).toBe(true);
    expect(tiles.has('20,12')).toBe(true);
    expect(tiles.has('20,15')).toBe(false); // the farm track
  });

  it('standing still in the corn hides him from a drone looking straight at him; on the bare row he is seen', async () => {
    const { run, guard } = await inFieldsWithDrone({ col: 20, row: 9 }, 90);
    expect(run.corn.isStanding('c6.fields', 20, 12)).toBe(true);
    placeAt(run, 20, 12);
    for (let i = 0; i < 90; i++) run.tick(16, NO_INPUT);
    expect(guard.detection).toBe(0);
    // One row up the corn is rolled flat (a bare row): the drone has him.
    placeAt(run, 20, 11);
    for (let i = 0; i < 25; i++) run.tick(16, NO_INPUT);
    expect(guard.detection).toBeGreaterThan(0);
  });

  it('cut corn does not hide him', async () => {
    const { run, guard } = await inFieldsWithDrone({ col: 20, row: 9 }, 90);
    placeAt(run, 20, 12);
    expect(run.cutCorn({ x: 19 * 16, y: 11 * 16, width: 48, height: 48 })).toBeGreaterThan(0);
    expect(run.corn.isStanding('c6.fields', 20, 12)).toBe(false);
    for (let i = 0; i < 30; i++) run.tick(16, NO_INPUT);
    expect(guard.detection).toBeGreaterThan(0);
  });

  it('moving through the corn rustles (less when sneaking), and a guard that hears it turns to look: "the corn is giving you away"', async () => {
    const { run, guard } = await inFieldsWithDrone({ col: 20, row: 9 }, 270);
    const noises = record(run.bus, 'stealth:noise');
    const shown = record(run.bus, 'dialogue:show');
    placeAt(run, 20, 12);
    for (let i = 0; i < 20; i++) run.tick(16, frame({ move: { x: 0.3, y: 0 } }));
    expect(noises.some((n) => n.kind === 'rustle' && n.radius === TUNING.overhaul!.corn!.rustleRadius)).toBe(true);
    expect(guard.alert).toBe('investigating');
    await settle(run, 4);
    expect(shown.map((s) => s.sequenceId)).toContain('c6.fields.rustle');
    noises.length = 0;
    placeAt(run, 20, 12);
    for (let i = 0; i < 20; i++) run.tick(16, frame({ move: { x: 0.2, y: 0 }, held: ['sneak'] }));
    expect(noises.some((n) => n.kind === 'rustle' && n.radius === TUNING.overhaul!.corn!.sneakRustleRadius)).toBe(true);
  });
});

describe('chapter 6: the fields stealth section', () => {
  it('a clean run leaves the jar by the honesty box; taking it is a whiskey, and the jar stays gone', async () => {
    const { run } = await newGame();
    await doMotel(run);
    await doTown(run);
    const shown = record(run.bus, 'dialogue:show');
    await crossFields(run);
    expect(shown.map((s) => s.sequenceId)).toContain('c6.fields.clean');
    expect(run.pickups().some((p) => p.def.id === 'c6.pickup.jar')).toBe(true);
    const before = run.player.kit.drinks.whiskey ?? 0;
    run.setPlayerPosition(FARM_STAND_PICKUP);
    run.tick(16, NO_INPUT);
    await settle(run, 3);
    expect(run.player.kit.drinks.whiskey ?? 0).toBe(before + 1);
    expect(run.flag('jar.taken')).toBe(true);
    expect(run.pickups().some((p) => p.def.id === 'c6.pickup.jar')).toBe(false);
  });

  it('caught: the caught line, no jar, and the section still completes when the alarm fight is won', async () => {
    const { run } = await newGame();
    await doMotel(run);
    await doTown(run);
    await toFields(run);
    const shown = record(run.bus, 'dialogue:show');
    run.setPlayerPosition(mid(STEALTH_START));
    await settle(run, 3);
    run.stealth('c6.stealth.fields')!.alarm();
    await settle(run, 3);
    expect(shown.map((s) => s.sequenceId)).toContain('c6.fields.caught');
    const fight = run.fight('c6.stealth.fields.alarm' as never)!;
    for (let i = 0; i < 40 && !fight.isComplete(); i++) {
      for (const a of fight.aliveActors()) run.defeat(a, 'player');
      await settle(run, 8);
    }
    expect(run.isComplete('c6.stealth.fields')).toBe(true);
    expect(run.flag('fields.clean')).not.toBe(true);
    expect(run.pickups().some((p) => p.def.id === 'c6.pickup.jar')).toBe(false);
    expect(run.objective()).toBe('c6.drones');
  });
});

describe('chapter 6: bottles', () => {
  it('nine coolers of light beer along the track: a pickup each, the crate goes when it is taken, and every one drunk leaves a bottle', async () => {
    const { run } = await newGame();
    await enter(run, 'c6.fields', T(10, 15));
    expect(chapter6.pickups).toHaveLength(9);
    expect(COOLER_SPOTS).toHaveLength(9);
    for (let i = 0; i < 9; i++) expect(run.dressing.prop(`fields.cooler${i + 1}`)?.visible).toBe(true);
    const pick = chapter6.pickups[0]!;
    expect(pick.item).toEqual({ kind: 'drink', drinkId: 'lightBeer', count: 1 });
    run.setPlayerPosition(pick.position);
    run.tick(16, NO_INPUT);
    await settle(run, 3);
    expect(run.dressing.prop('fields.cooler1')?.visible).toBe(false);
    expect(run.dressing.prop('fields.cooler2')?.visible).toBe(true);
    expect(run.player.kit.drinks.lightBeer ?? 0).toBeGreaterThan(0);
    const bottles = run.player.kit.bottles;
    expect(drinkItem(run, 'lightBeer')).toBe(true);
    expect(run.player.kit.bottles).toBe(bottles + 1);
  });

  it('the lesson plays once when a drone has spotted him on the track while he sneaks the corn; the done line belongs to the lesson drone, not the yard fight', async () => {
    const { run } = await newGame();
    await doMotel(run);
    await doTown(run);
    await toFields(run);
    const shown = record(run.bus, 'dialogue:show');
    // Not while the stealth section is not under way.
    run.setPlayerPosition(mid(TRACK_SPOTTED_AREA));
    await settle(run, 3);
    expect(shown.map((s) => s.sequenceId)).not.toContain('c6.bottles.lesson');
    run.setPlayerPosition(mid(STEALTH_START));
    await settle(run, 3);
    run.setPlayerPosition(mid(TRACK_SPOTTED_AREA));
    await settle(run, 6);
    expect(shown.filter((s) => s.sequenceId === 'c6.bottles.lesson')).toHaveLength(1);
    run.setPlayerPosition(T(3, 12));
    await settle(run, 2);
    run.setPlayerPosition(mid(TRACK_SPOTTED_AREA));
    await settle(run, 6);
    expect(shown.filter((s) => s.sequenceId === 'c6.bottles.lesson')).toHaveLength(1);
    await crossFields(run);
    await intoYard(run);
    const fight = run.fight('c6.fight.drones')!;
    const drone = fight.aliveActors().find((a) => a.enemyId === 'drone')!;
    run.defeat(drone, 'player');
    await settle(run, 4);
    // The lesson drone (tests/unit/c6-lesson-drone.test.ts) says the done line, not the yard fight.
    expect(shown.filter((s) => s.sequenceId === 'c6.bottles.done')).toHaveLength(0);
  });
});

describe('chapter 6: the drone fight', () => {
  it('six drones in two waves and two agents on foot; the second wave line, the end line, and the maze is next', async () => {
    const { run } = await newGame();
    await doMotel(run);
    await doTown(run);
    await crossFields(run);
    const shown = record(run.bus, 'dialogue:show');
    await intoYard(run);
    const fight = run.fight('c6.fight.drones')!;
    expect(fight.active).toBe(true);
    const first = fight.aliveActors();
    expect(first.filter((a) => a.enemyId === 'drone')).toHaveLength(3);
    expect(first.filter((a) => a.enemyId === 'agent')).toHaveLength(1);
    await winDrones(run);
    const ids = shown.map((s) => s.sequenceId);
    expect(ids).toContain('c6.drones.wave2');
    expect(ids).toContain('c6.drones.end');
    expect(run.objective()).toBe('c6.maze');
    // Walking back into the yard does not start it again.
    await intoYard(run);
    expect(run.fight('c6.fight.drones')?.active).toBe(false);
  });
});
