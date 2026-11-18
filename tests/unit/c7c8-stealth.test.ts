/**
 * Chapter 8 perimeter hazards (ground sensors, thermal masts, patrol trucks), the planner's view of them, the perimeter
 * built from chapter 8's own layout, and the pure view helpers.
 */

import { describe, expect, it } from 'vitest';
import { chapter8 } from '../../src/chapters/08/index';
import { CORRIDOR_LINES, JUNCTION_BOXES, PATROL_TRUCKS, SENSOR_LINES, THERMAL_MASTS } from '../../src/chapters/08/maps';
import { TUNING } from '../../src/content/tuning';
import type { PatrolRoute, StealthSectionDef, Vec2 } from '../../src/core/types';
import { gridFromAscii } from '../../src/systems/grid';
import { Hazard } from '../../src/systems/stealth';
import { perimeterHazards } from '../../src/systems/perimeter';
import { applausePoints, fanEnd, pulse, sensorLamp, signPosition, stampPoints, throwPoint } from '../../src/systems/view/c78';
import { createKit } from '../../src/systems/kit';
import { createChapter2Sandbox } from '../../src/core/sandbox2';
import { createMeter } from '../../src/systems/meter';
import { advance, frame, makeRun, record } from './helpers';
import { planRoute } from './stealthPlanner';

const per = (o: Partial<Parameters<Hazard['detects']>[1]> = {}) => ({ pos: { x: 100, y: 100 }, hidden: false, running: false, thermalVisible: false, ...o });
const open = gridFromAscii(Array.from({ length: 20 }, () => '.'.repeat(40)));

describe('ground sensors through the run', () => {
  function sensorRun() {
    const base = createChapter2Sandbox();
    const h = makeRun({
      module: {
        ...base,
        createScript: undefined,
        def: { ...base.def, stealthSections: base.def.stealthSections.map((s) => ({ ...s, guards: [], hazards: [{ kind: 'groundSensor' as const, id: 's', position: { x: 300, y: 100 }, radius: 40 }] })) },
      },
    });
    h.run.player.setKit(createKit());
    h.run.player.holdDrain(true);
    h.run.stealthHere()[0]!.runner.start();
    return h;
  }
  const walkOver = (run: ReturnType<typeof makeRun>['run'], sneak: boolean): void => {
    run.setPlayerPosition({ x: 250, y: 100 });
    for (let t = 0; t < 3000; t += 16) {
      run.player.meter = createMeter(2, 55);
      run.tick(16, frame({ move: { x: 1, y: 0 }, held: sneak ? ['sneak'] : [] }));
      if (run.player.pos.x > 330) run.setPlayerPosition({ x: 250, y: 100 });
    }
  };

  it('catch normal movement within their radius', () => {
    const { run, bus } = sensorRun();
    const alarms = record(bus, 'stealth:alarm');
    walkOver(run, false);
    expect(alarms).toHaveLength(1);
  });

  it('do not catch sneaking', () => {
    const { run, bus } = sensorRun();
    const alarms = record(bus, 'stealth:alarm');
    walkOver(run, true);
    expect(alarms).toHaveLength(0);
  });

  it('do not catch standing still', () => {
    const { run, bus } = sensorRun();
    const alarms = record(bus, 'stealth:alarm');
    run.setPlayerPosition({ x: 300, y: 100 });
    advance(run, 3000);
    expect(alarms).toHaveLength(0);
  });
});

describe('patrol trucks', () => {
  const route: PatrolRoute = { mode: 'pingPong', waypoints: [{ position: { x: 40, y: 160 }, waitMs: 0, facing: 'right' }, { position: { x: 600, y: 160 }, waitMs: 0, facing: 'left' }] };
  const def = { kind: 'patrolTruck' as const, id: 't', route, speed: 100, headlights: { range: 100, angleDeg: 50 } };

  it('see Andrew inside the spotter cone and not when hidden or out of range', () => {
    const h = new Hazard(def);
    h.tick(16, open, per({ pos: { x: 500, y: 100 } }));
    h.pos = { x: 100, y: 160 };
    h.facingDeg = 0;
    expect(h.detects(open, per({ pos: { x: 150, y: 160 } }))).toBe(true);
    expect(h.detects(open, per({ pos: { x: 150, y: 160 }, hidden: true }))).toBe(false);
    expect(h.detects(open, per({ pos: { x: 260, y: 160 } }))).toBe(false);
    expect(h.detects(open, per({ pos: { x: 50, y: 160 } }))).toBe(false);
  });

  it('are blocked by a rock outcrop between them and Andrew', () => {
    const rows = Array.from({ length: 20 }, (_, r) => (r >= 8 && r <= 11 ? `${'.'.repeat(8)}#${'.'.repeat(31)}` : '.'.repeat(40)));
    const g = gridFromAscii(rows);
    const h = new Hazard(def);
    h.pos = { x: 100, y: 160 };
    h.facingDeg = 0;
    expect(h.detects(open, per({ pos: { x: 180, y: 160 } }))).toBe(true);
    expect(h.detects(g, per({ pos: { x: 180, y: 160 } }))).toBe(false);
  });

  it('drive their track and turn round at the end', () => {
    const h = new Hazard(def);
    for (let t = 0; t < 8000; t += 16) h.tick(16, open, per({ pos: { x: -999, y: -999 } }));
    expect(h.pos.x).toBeGreaterThan(300);
    for (let t = 0; t < 20000; t += 16) h.tick(16, open, per({ pos: { x: -999, y: -999 } }));
    expect(h.pos.x).toBeLessThan(600);
  });
});

describe('the planner sees trucks and masts', () => {
  const mk = (hazards: StealthSectionDef['hazards']): StealthSectionDef => ({ id: 'c8.stealth.perimeter', checkpointId: 'x', guards: [], hazards, hidingProps: [] } as unknown as StealthSectionDef);
  const wide = gridFromAscii(Array.from({ length: 10 }, (_, r) => (r === 0 || r === 9 ? '#'.repeat(40) : `#${'.'.repeat(38)}#`)));
  const start = { x: 16, y: 32, width: 32, height: 112 };
  const exit = { x: 560, y: 32, width: 48, height: 112 };

  it('a truck that sweeps the whole way makes the plan wait or fail; a far track does not', () => {
    const lane = (y: number): PatrolRoute => ({ mode: 'pingPong', waypoints: [{ position: { x: 20, y }, waitMs: 0, facing: 'right' }, { position: { x: 600, y }, waitMs: 0, facing: 'left' }] });
    const truck = (y: number): StealthSectionDef['hazards'] => [{ kind: 'patrolTruck', id: 'k', route: lane(y), speed: 60, headlights: { range: 90, angleDeg: 60 } }];
    expect(planRoute({ def: mk(truck(300)), grid: wide, start, exit })).not.toBeNull();
    const withTruck = planRoute({ def: mk(truck(90)), grid: wide, start, exit, horizonSec: 60 });
    const without = planRoute({ def: mk([]), grid: wide, start, exit });
    expect(without).not.toBeNull();
    if (withTruck) expect(withTruck.seconds).toBeGreaterThanOrEqual(without!.seconds);
  });

  it('a mast covering the way blocks it only when the route is hot (Bit much in the sun)', () => {
    const mast: StealthSectionDef['hazards'] = [{ kind: 'thermalMast', id: 'm', position: { x: 300, y: 80 }, range: 400 }];
    expect(planRoute({ def: mk(mast), grid: wide, start, exit })).not.toBeNull();
    expect(planRoute({ def: mk(mast), grid: wide, start, exit, heat: () => true, horizonSec: 30 })).toBeNull();
    // A mast with a short range that leaves a way round does not stop a hot sneaker.
    const short: StealthSectionDef['hazards'] = [{ kind: 'thermalMast', id: 'm', position: { x: 300, y: 40 }, range: 50 }];
    expect(planRoute({ def: mk(short), grid: wide, start, exit, heat: () => true })).not.toBeNull();
  });
});

describe('the chapter 8 perimeter, built from its layout', () => {
  const hazards = perimeterHazards({ lines: SENSOR_LINES, masts: THERMAL_MASTS, trucks: PATROL_TRUCKS });

  it('has a sensor for every sensor of every line, five masts and two trucks, with unique ids', () => {
    expect(hazards.filter((h) => h.kind === 'groundSensor')).toHaveLength(SENSOR_LINES.reduce((n, l) => n + l.sensors.length, 0));
    expect(hazards.filter((h) => h.kind === 'thermalMast')).toHaveLength(THERMAL_MASTS.length);
    expect(hazards.filter((h) => h.kind === 'patrolTruck')).toHaveLength(2);
    expect(new Set(hazards.map((h) => h.id)).size).toBe(hazards.length);
    expect(JUNCTION_BOXES).toHaveLength(3);
    expect(CORRIDOR_LINES).toEqual([2, 3, 4]);
  });

  it('uses the perimeter tuning', () => {
    const t = TUNING.overhaul!.perimeter!;
    const s = hazards.find((h) => h.kind === 'groundSensor');
    const k = hazards.find((h) => h.kind === 'patrolTruck');
    expect(s?.kind === 'groundSensor' && s.radius).toBe(t.sensorRadiusPx);
    expect(k?.kind === 'patrolTruck' && k.headlights).toEqual(t.truckCone);
  });

  it('has a route past the trucks for a sneaker at Grand, over the real perimeter grid', { timeout: 120000 }, () => {
    const placement = chapter8.stealth.find((s) => s.sectionId === 'c8.stealth.perimeter')!;
    const def = { ...chapter8.def.stealthSections.find((s) => s.id === 'c8.stealth.perimeter')!, hazards };
    const screen = chapter8.screens.find((s) => s.id === placement.screenId)!;
    const route = planRoute({ def, grid: screen.grid, start: placement.startArea!, exit: placement.exitArea, margin: 2 });
    expect(route, 'no sneaking route past the trucks').not.toBeNull();
    console.log(`c8 perimeter: route of ${route?.cells.length} steps, ${route?.seconds.toFixed(1)} s`);
  });
});

describe('view helpers', () => {
  it('sensor lamp', () => {
    expect(sensorLamp(false, 1)).toBe('off');
    expect(sensorLamp(true, 0)).toBe('live');
    expect(sensorLamp(true, 0.2)).toBe('alert');
  });

  it('a thrown enemy flies from Andrew to the landing with an arc that is zero at both ends', () => {
    const a: Vec2 = { x: 0, y: 0 };
    const b: Vec2 = { x: 100, y: 0 };
    expect(throwPoint(a, b, 0, 20)).toEqual({ pos: a, height: 0 });
    expect(throwPoint(a, b, 1, 20)).toEqual({ pos: b, height: 0 });
    expect(throwPoint(a, b, 0.5, 20)).toEqual({ pos: { x: 50, y: 0 }, height: 20 });
    expect(throwPoint(a, b, 3, 20).pos).toEqual(b);
  });

  it('stamps, fan ends, the sign, applause and the pulse', () => {
    expect(stampPoints({ x: 0, y: 0 }, { x: 64, y: 0 }, 16)).toHaveLength(5);
    expect(stampPoints({ x: 5, y: 5 }, { x: 5, y: 5 }, 16)).toEqual([{ x: 5, y: 5 }]);
    expect(fanEnd({ x: 0, y: 0 }, 90, 10).y).toBeCloseTo(10, 6);
    expect(signPosition({ x: 0, y: 0 }, 0, true).x).toBeCloseTo(10, 6);
    expect(signPosition({ x: 0, y: 0 }, 0, false)).toEqual({ x: 9, y: 6 });
    expect(applausePoints({ x: 0, y: 50, width: 100 }, 4).map((p) => p.x)).toEqual([12.5, 37.5, 62.5, 87.5]);
    expect(pulse(0, 1)).toBeCloseTo(0.5, 6);
  });
});
