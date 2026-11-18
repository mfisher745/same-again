/** Chapter 8 heat: sun and shade on the real screens, the sun lesson and its aside, the HUD flag, and no heat after sunset. */

import { describe, expect, it } from 'vitest';
import { AWNING_SHADE, FIGHT_TRUCK_SHADE, PERIMETER_OUTCROPS, PERIMETER_FROM_ROAD, ROAD_OUTCROPS, T, TRUCK_SHADE } from '../../src/chapters/08/maps';
import { pool } from '../../src/content/dialogue';
import { TUNING } from '../../src/content/tuning';
import { createKit } from '../../src/systems/kit';
import { createMeter } from '../../src/systems/meter';
import { advance, frame, record } from './helpers';
import { crossPerimeter, enter, newGame, settle, solveJunctions, startFence, stepOutFromAwning, winFence } from './chapter8-steps';

const O = TUNING.overhaul!;
type Run = Awaited<ReturnType<typeof newGame>>['run'];

/** Meter points lost over `ms` standing still at the spot. */
function drainOver(run: Run, at: { x: number; y: number }, ms: number): number {
  run.setPlayerPosition(at);
  run.tick(16, frame());
  run.player.meter = createMeter(8, 50);
  const before = run.player.meter.value;
  advance(run, ms);
  return before - run.player.meter.value;
}

describe('chapter 8: heat on the road', () => {
  it('the three screens are sunny', async () => {
    const { run } = await newGame();
    for (const s of ['c8.road', 'c8.perimeter', 'c8.gate'] as const) {
      await enter(run, s, run.screenLayout.playerStart);
      expect(run.heat().sunnyScreen, s).toBe(true);
    }
  });

  it('the roadhouse, its awning and the truck\'s shadow are shade; out on the road it is sun, with the HUD flag and a double drain', async () => {
    const { run } = await newGame();
    run.player.holdDrain(false);
    const shade = (r: { col: number; row: number; width: number; height: number }) => T(r.col + 1, r.row + 1);
    expect(drainOver(run, T(18, 7), 3000)).toBeCloseTo(O.drainPerSecond * 3, 1);
    expect(run.heat().inSun).toBe(false);
    expect(drainOver(run, shade(AWNING_SHADE), 3000)).toBeCloseTo(O.drainPerSecond * 3, 1);
    expect(drainOver(run, T(TRUCK_SHADE.col + 1, TRUCK_SHADE.row), 3000)).toBeCloseTo(O.drainPerSecond * 3, 1);
    const out = T(12, 15);
    expect(drainOver(run, out, 3000)).toBeCloseTo(O.drainPerSecond * 3 * O.sun.drainMultiplier, 1);
    expect(run.heat()).toEqual({ active: true, sunnyScreen: true, inSun: true });
    expect(run.player.meter.inSun).toBe(true);
  });

  it('a rock outcrop throws shade on its west side, on the road and on the perimeter', async () => {
    const { run } = await newGame();
    run.player.holdDrain(false);
    const o = ROAD_OUTCROPS[2]!;
    expect(drainOver(run, T(o.shade.col + 1, o.shade.row), 3000)).toBeCloseTo(O.drainPerSecond * 3, 1);
    await enter(run, 'c8.perimeter', PERIMETER_FROM_ROAD);
    run.player.holdDrain(false);
    const p = PERIMETER_OUTCROPS[0]!;
    expect(drainOver(run, T(p.shade.col, p.shade.row), 3000)).toBeCloseTo(O.drainPerSecond * 3, 1);
    expect(drainOver(run, T(p.col + p.width + 2, p.row), 3000)).toBeCloseTo(O.drainPerSecond * 3 * O.sun.drainMultiplier, 1);
  });

  it('stepping out from the awning plays the sun lesson once', async () => {
    const { run } = await newGame();
    const shown = record(run.bus, 'dialogue:show');
    await stepOutFromAwning(run);
    run.setPlayerPosition(T(14, 8));
    await settle(run, 3);
    await stepOutFromAwning(run);
    expect(shown.filter((s) => s.sequenceId === 'c8.sun.lesson')).toHaveLength(1);
  });

  it('standing in the sun a while brings a line from the sun pool, each in turn; in shade it does not', async () => {
    const { run } = await newGame();
    run.player.setKit(createKit());
    run.player.holdDrain(true);
    const lines = new Set(pool('c8.sun'));
    const shown = record(run.bus, 'dialogue:show');
    run.setPlayerPosition(T(14, 8));
    for (let t = 0; t < 70000; t += 16) {
      run.player.meter = createMeter(8, 50);
      run.tick(16, frame());
    }
    expect(shown.filter((s) => lines.has(s.sequenceId))).toHaveLength(0);
    run.setPlayerPosition(T(12, 15));
    for (let t = 0; t < 70000; t += 16) {
      run.player.meter = createMeter(8, 50);
      run.tick(16, frame());
      if (t % 800 === 0) await settle(run, 1);
    }
    const said = shown.map((s) => s.sequenceId).filter((s) => lines.has(s));
    expect(said.length).toBeGreaterThanOrEqual(2);
    expect(new Set(said).size).toBe(said.length);
  });
});

describe('chapter 8: no heat after sunset', () => {
  it('the sun goes down at the fence: heat off, no sun on any screen, the night on every screen, and the truck\'s shade is set', async () => {
    const { run } = await newGame();
    run.player.holdDrain(false);
    await crossPerimeter(run);
    run.player.holdDrain(false);
    expect(run.heatActive()).toBe(true);
    expect(run.ambient()).toBeNull();
    await solveJunctions(run);
    await startFence(run);
    expect(run.isNight()).toBe(true);
    expect(run.heatActive()).toBe(false);
    expect(run.heat()).toEqual({ active: false, sunnyScreen: true, inSun: false });
    expect(run.ambient()).not.toBeNull();
    expect(drainOver(run, T(70, 20), 3000)).toBeCloseTo(O.drainPerSecond * 3, 1);
    expect(run.player.meter.inSun).toBe(false);
    for (const s of ['c8.road', 'c8.gate'] as const) {
      await enter(run, s, run.screenLayout.playerStart);
      expect(run.ambient(), s).not.toBeNull();
    }
  });

  it('the parked truck throws a shadow while the fight is on, which is where Andrew stands out of the sun in the dark too', async () => {
    const { run } = await newGame();
    await crossPerimeter(run);
    await solveJunctions(run);
    await startFence(run);
    await winFence(run);
    const at = T(FIGHT_TRUCK_SHADE.col + 1, FIGHT_TRUCK_SHADE.row);
    expect(run.shadeAreasHere().some((a) => at.x >= a.x && at.x < a.x + a.width && at.y >= a.y && at.y < a.y + a.height)).toBe(true);
  });
});
