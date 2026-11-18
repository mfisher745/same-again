/**
 * Chapter 9 offices stealth: eight seated clerks and two walking ones. The route planner (`stealthPlanner.ts`) now plans
 * seated clerks with their short cones, so the offices can be added to `stealth-feasibility.test.ts` once chapter 9 exists.
 */

import { describe, expect, it } from 'vitest';
import type { AreaRect } from '../../src/core/chapter';
import type { GuardPlacement, StealthSectionDef } from '../../src/core/types';
import { gridFromAscii, tileCentre } from '../../src/systems/grid';
import { FRAME_MS, planRoute, recordMotion, seenAt } from './stealthPlanner';

const T = (col: number, row: number) => tileCentre({ col, row });
const rect = (col: number, row: number, w: number, h: number): AreaRect => ({ x: col * 16, y: row * 16, width: w * 16, height: h * 16 });

const seat = (col: number, row: number, facing: 'up' | 'down'): GuardPlacement => ({
  enemyId: 'clerk',
  seated: true,
  route: { mode: 'stationary', waypoints: [{ position: T(col, row), facing, waitMs: 0 }] },
});
const walker = (col: number, r0: number, r1: number): GuardPlacement => ({
  enemyId: 'clerk',
  route: { mode: 'pingPong', waypoints: [{ position: T(col, r0), facing: 'down', waitMs: 1500 }, { position: T(col, r1), facing: 'up', waitMs: 1500 }] },
});

/** Open-plan floor: three rows of desks (blocked, low: they do not stop sight), aisles between, a wall round it all. */
function offices() {
  const rows = Array.from({ length: 25 }, (_, r) => (r === 0 || r === 24 ? '#'.repeat(40) : `#${'.'.repeat(38)}#`).split(''));
  for (const r of [5, 6, 12, 13, 19, 20]) for (const c of [4, 5, 6, 7, 8, 12, 13, 14, 15, 16, 24, 25, 26, 27, 28, 32, 33, 34, 35, 36]) (rows[r] as string[])[c] = 'x';
  return gridFromAscii(rows.map((r) => r.join('')));
}

const def = (guards: GuardPlacement[]): StealthSectionDef => ({ id: 'c9.stealth.offices', checkpointId: 'c9.test', guards, hazards: [], hidingProps: [] });

const GUARDS: GuardPlacement[] = [
  seat(6, 7, 'down'),
  seat(14, 7, 'down'),
  seat(26, 7, 'down'),
  seat(34, 7, 'down'),
  seat(6, 11, 'up'),
  seat(14, 11, 'up'),
  seat(26, 14, 'down'),
  seat(34, 14, 'down'),
  walker(20, 2, 9),
  walker(21, 14, 22),
];

describe('the planner and seated clerks', () => {
  it('a seated clerk sees only 60% as far as a standing one, so a point at 60 px is seen by one and not the other', () => {
    const grid = gridFromAscii(Array.from({ length: 12 }, () => '.'.repeat(30)));
    const seated = def([{ enemyId: 'clerk', seated: true, route: { mode: 'stationary', waypoints: [{ position: { x: 100, y: 100 }, facing: 'right', waitMs: 0 }] } }]);
    const standing = def([{ enemyId: 'clerk', route: { mode: 'stationary', waypoints: [{ position: { x: 100, y: 100 }, facing: 'right', waitMs: 0 }] } }]);
    const p = { x: 160, y: 100 };
    expect(seenAt(seated, grid, recordMotion(seated, grid, 2)[0]!, p)).toBe(false);
    expect(seenAt(standing, grid, recordMotion(standing, grid, 2)[0]!, p)).toBe(true);
    expect(seenAt(seated, grid, recordMotion(seated, grid, 2)[0]!, { x: 140, y: 100 })).toBe(true);
  });

  it('the offices have a route no cone ever sees, well under 90 s', { timeout: 120000 }, () => {
    const route = planRoute({ def: def(GUARDS), grid: offices(), start: rect(1, 1, 2, 23), exit: rect(37, 1, 2, 23), margin: 2 });
    expect(route, 'no zero-exposure sneaking route').not.toBeNull();
    expect(route!.seconds).toBeLessThan(90);
    expect(FRAME_MS).toBeGreaterThan(0);
  });

  it('with the seated clerks standing, the same floor leaves a longer route or none: the short cones are what make it fair', { timeout: 120000 }, () => {
    const standing = GUARDS.map((g): GuardPlacement => ({ ...g, seated: false }));
    const a = planRoute({ def: def(GUARDS), grid: offices(), start: rect(1, 1, 2, 23), exit: rect(37, 1, 2, 23), margin: 2 });
    const b = planRoute({ def: def(standing), grid: offices(), start: rect(1, 1, 2, 23), exit: rect(37, 1, 2, 23), margin: 2 });
    expect(a).not.toBeNull();
    if (b) expect(b.seconds).toBeGreaterThanOrEqual(a!.seconds);
  });
});
