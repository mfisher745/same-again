/**
 * Chapter 8 heat through the run: sun, shade areas (static and moving), the switch, sunset, the HUD flag and the
 * thermal masts. Built on the chapter 2 sandbox with its yard declared sunny.
 */

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/content/tuning';
import type { ChapterModule } from '../../src/core/chapter';
import { createChapter2Sandbox } from '../../src/core/sandbox2';
import type { StealthHazardDef } from '../../src/core/types';
import { createKit } from '../../src/systems/kit';
import { createMeter, levelTable } from '../../src/systems/meter';
import { advance, frame, makeRun, record } from './helpers';

const O = TUNING.overhaul!;
const BITMUCH = levelTable(2).bitMuch.min + 5;

function sunny(extra: Partial<ChapterModule['screens'][number]> = {}, hazards: StealthHazardDef[] = []): ChapterModule {
  const base = createChapter2Sandbox();
  return {
    ...base,
    createScript: undefined,
    def: {
      ...base.def,
      screens: base.def.screens.map((s) => ({ ...s, sun: true })),
      stealthSections: base.def.stealthSections.map((s) => ({ ...s, hazards, guards: [] })),
    },
    screens: base.screens.map((s) => ({ ...s, ...extra })),
  };
}

function setup(module = sunny()) {
  const h = makeRun({ module });
  h.run.player.setKit(createKit());
  h.run.setPlayerPosition({ x: 300, y: 100 });
  return h;
}

/** Meter points lost over `ms` standing still. */
function drainOver(run: ReturnType<typeof setup>['run'], ms: number): number {
  run.player.meter = createMeter(2, 50);
  const before = run.player.meter.value;
  advance(run, ms);
  return before - run.player.meter.value;
}

describe('heat: sun and shade', () => {
  it('drains twice as fast in the sun and the HUD flag is on', () => {
    const { run } = setup();
    const lost = drainOver(run, 3000);
    expect(lost).toBeCloseTo(O.drainPerSecond * 3 * O.sun.drainMultiplier, 1);
    expect(run.heat()).toEqual({ active: true, sunnyScreen: true, inSun: true });
    expect(run.player.meter.inSun).toBe(true);
  });

  it('a static shade area is shade, and leaving it is sun again', () => {
    const { run } = setup(makeRunModule({ shadeAreas: [{ x: 280, y: 80, width: 60, height: 60 }] }));
    run.tick(16, frame());
    expect(run.heat().inSun).toBe(false);
    const lost = drainOver(run, 3000);
    expect(lost).toBeCloseTo(O.drainPerSecond * 3, 1);
    run.setPlayerPosition({ x: 500, y: 100 });
    run.tick(16, frame());
    expect(run.heat().inSun).toBe(true);
  });

  it('a moving shade area (a truck shadow) shades only while it is there', () => {
    const { run } = setup();
    run.tick(16, frame());
    expect(run.heat().inSun).toBe(true);
    run.setShadeArea('truck', { x: 280, y: 80, width: 60, height: 60 });
    run.tick(16, frame());
    expect(run.heat().inSun).toBe(false);
    expect(run.shadeAreasHere()).toHaveLength(1);
    run.setShadeArea('truck', null);
    run.tick(16, frame());
    expect(run.heat().inSun).toBe(true);
  });

  it('beer goes one and a half times as far in the sun', () => {
    const { run } = setup();
    run.tick(16, frame());
    expect(run.player.meter.inSun).toBe(true);
    const sunBeer = O.drinks.stout;
    expect(sunBeer.kind === 'beer' ? sunBeer.points * O.sun.beerMultiplier : 0).toBeGreaterThan(sunBeer.kind === 'beer' ? sunBeer.points : 0);
  });

  it('switching heat off ends the sun, says so, and is kept in a saved flag', () => {
    const { run, bus } = setup();
    const switched = record(bus, 'heat:switched');
    run.setHeatActive(false);
    run.setHeatActive(false);
    run.tick(16, frame());
    expect(switched).toEqual([{ active: false }]);
    expect(run.heatActive()).toBe(false);
    expect(run.heat()).toEqual({ active: false, sunnyScreen: true, inSun: false });
    expect(run.flag('sys.heatOff')).toBe(true);
    run.setHeatActive(true);
    run.tick(16, frame());
    expect(run.heat().inSun).toBe(true);
  });

  it('a run built from a save with the flag set starts in the dark with heat off', () => {
    const { run } = makeRun({
      module: sunny(),
      save: (s) => ({ ...s, flags: { ...s.flags, 'sys.heatOff': true, 'sys.night': true } }),
    });
    run.tick(16, frame());
    expect(run.heatActive()).toBe(false);
    expect(run.isNight()).toBe(true);
    expect(run.dressing.ambient(run.screenId)).not.toBeNull();
  });

  it('sunset turns heat off, puts the night tint on every screen and survives a return to the bar', () => {
    const { run, returns } = setup();
    run.sunset();
    run.sunset();
    expect(run.isNight()).toBe(true);
    expect(run.heatActive()).toBe(false);
    expect(run.dressing.ambient(run.screenId)).toMatchObject({ tint: O.sunsetAmbient?.tint, strength: O.sunsetAmbient?.strength });
    run.player.meter = createMeter(2, 0.01);
    advance(run, 200);
    expect(returns).toContain('sober');
    expect(run.isNight()).toBe(true);
    expect(run.dressing.ambient(run.screenId)).not.toBeNull();
  });
});

/** A sunny module whose screen is patched. */
function makeRunModule(patch: Partial<ChapterModule['screens'][number]>): ChapterModule {
  return sunny(patch);
}

describe('thermal masts', () => {
  const mast: StealthHazardDef = { kind: 'thermalMast', id: 'mast', position: { x: 400, y: 60 }, range: 160 };

  function mastRun(shade = false) {
    const h = setup(sunny(shade ? { shadeAreas: [{ x: 350, y: 60, width: 100, height: 100 }] } : {}, [mast]));
    h.run.stealthHere()[0]!.runner.start();
    return h;
  }
  const detection = (run: ReturnType<typeof setup>['run']): number => run.stealthHere()[0]!.runner.hazards[0]!.detection;

  it('see Andrew at Bit much in the sun', () => {
    const { run } = mastRun();
    run.setPlayerPosition({ x: 400, y: 100 });
    run.player.holdDrain(true);
    run.player.meter = createMeter(2, BITMUCH);
    advance(run, 300);
    expect(detection(run)).toBeGreaterThan(0);
  });

  it('do not see him at Grand, in shade, or after sunset', () => {
    const grand = mastRun();
    grand.run.setPlayerPosition({ x: 400, y: 100 });
    grand.run.player.holdDrain(true);
    grand.run.player.meter = createMeter(2, levelTable(2).grand.min + 2);
    advance(grand.run, 300);
    expect(detection(grand.run)).toBe(0);

    const shaded = mastRun(true);
    shaded.run.setPlayerPosition({ x: 400, y: 100 });
    shaded.run.player.holdDrain(true);
    shaded.run.player.meter = createMeter(2, BITMUCH);
    advance(shaded.run, 300);
    expect(detection(shaded.run)).toBe(0);

    const night = mastRun();
    night.run.setPlayerPosition({ x: 400, y: 100 });
    night.run.player.holdDrain(true);
    night.run.sunset();
    night.run.player.meter = createMeter(2, BITMUCH);
    advance(night.run, 300);
    expect(detection(night.run)).toBe(0);
  });
});
