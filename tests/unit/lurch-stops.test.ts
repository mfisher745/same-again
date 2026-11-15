/**
 * Shoulder and Stumble lurch: stops at kegs, closed sheep gates and walls. Breakables in the lane before the stop break, ones
 * beyond do not; a move hook beyond the stop does not fire, one at the blocker does (run.ts HOOK_TOUCH).
 * Built on the chapter 2 sandbox (closed gates at cols 34/37/40, rows 4 to 6) and the chapter 1 sandbox (kegs).
 */

import { describe, expect, it } from 'vitest';
import { PROP } from '../../src/art/props';
import type { ChapterModule } from '../../src/core/chapter';
import { createSandboxModule } from '../../src/core/sandbox';
import { createChapter2Sandbox } from '../../src/core/sandbox2';
import type { AreaRect } from '../../src/core/chapter';
import type { MoveId } from '../../src/core/types';
import type { ChapterRun } from '../../src/systems/run';
import { advance, frame, makeRun, placeAt, record } from './helpers';

const tileRect = (col: number, row: number, w = 1, h = 1): AreaRect => ({ x: col * 16, y: row * 16, width: w * 16, height: h * 16 });
const bucket = (id: string, col: number, row: number) => ({ id, frame: PROP.feedBuckets, col, row, solid: { width: 1, height: 1 }, breakable: { hits: 2, loot: 'none' as const } });

/** The chapter 2 sandbox with extra breakables on its one screen. */
function withProps(base: ChapterModule, extra: ReturnType<typeof bucket>[]): ChapterModule {
  const [screen, ...rest] = base.screens;
  if (!screen) throw new Error('no screen');
  return { ...base, screens: [{ ...screen, dressing: { ...screen.dressing, props: [...(screen.dressing?.props ?? []), ...extra] } }, ...rest] };
}

/** Level 3 with the Stumble in slot 3, standing on (col, row), aiming at the given tile centre; then lurches. */
function stumble(run: ChapterRun, from: [number, number], aimAt: [number, number]): void {
  run.player.meter = { ...run.player.meter, value: 75 };
  run.tick(16, frame());
  expect(run.player.level).toBe(3);
  placeAt(run, from[0], from[1]);
  const aim = { x: aimAt[0] * 16 + 8, y: aimAt[1] * 16 + 8 };
  run.tick(16, frame({ aim }));
  run.tick(16, frame({ pressed: ['special3'], aim }));
}

const hookNames = (run: ChapterRun, areas: Record<string, AreaRect>): string[] => {
  const hit: string[] = [];
  for (const [name, area] of Object.entries(areas)) run.onMoveHit(area, (h) => hit.push(`${name}:${h.moveId}`));
  return hit;
};

describe('Stumble stops at a closed sheep gate', () => {
  // Gate A is closed at col 34, rows 4 to 6. Andrew walks east along row 5 from col 28.
  const build = () => makeRun({ chapter: 2, module: withProps(createChapter2Sandbox(), [bucket('before', 31, 5), bucket('beyond', 36, 5)]) });

  it('ends against the gate and does not go through it', () => {
    const { run } = build();
    stumble(run, [28, 5], [40, 5]);
    expect(run.player.pos.x).toBeLessThan(34 * 16);
    expect(run.player.pos.x).toBeGreaterThan(30 * 16);
  });

  it('breaks the breakable in the lane before the gate, not the one beyond it', () => {
    const { run } = build();
    const broken = record(run.bus, 'prop:broken');
    stumble(run, [28, 5], [40, 5]);
    expect(broken.map((b) => b.propId)).toEqual(['before']);
  });

  it('a move hook beyond the gate does not fire; one on the gate does', () => {
    const { run } = build();
    const hit = hookNames(run, { gate: tileRect(34, 4, 1, 3), beyond: tileRect(36, 4, 1, 3), farBeyond: tileRect(37, 4, 1, 3) });
    stumble(run, [28, 5], [40, 5]);
    expect(hit).toEqual(['gate:stumble']);
  });

  it('an open gate lets it through to the next one', () => {
    const { run } = build();
    run.sheepPuzzlesHere()[0]!.puzzle.toggleGate('gateA');
    const broken = record(run.bus, 'prop:broken');
    // From col 31 the 88 px lane runs to col 37: past the open gate, through both breakables, short of gate B's far side.
    stumble(run, [30, 5], [40, 5]);
    expect(run.player.pos.x).toBeGreaterThan(34 * 16);
    expect(broken.map((b) => b.propId).sort()).toEqual(['before', 'beyond']);
  });
});

describe('Stumble stops at a wall', () => {
  // The wall between the yard and the bar: rows 10 and 11 at col 7. Andrew goes south from (7, 8).
  const build = () => makeRun({ chapter: 2, module: withProps(createChapter2Sandbox(), [bucket('before', 7, 9), bucket('beyond', 7, 12)]) });

  it('breaks what is in the lane before the wall, never what is beyond it', () => {
    const { run } = build();
    const broken = record(run.bus, 'prop:broken');
    stumble(run, [7, 8], [7, 14]);
    expect(broken.map((b) => b.propId)).toEqual(['before']);
    expect(run.player.pos.y).toBeLessThan(10 * 16);
  });

  it('a hook beyond the wall does not fire; one against the wall does', () => {
    const { run } = build();
    const hit = hookNames(run, { wall: tileRect(7, 10), beyond: tileRect(7, 12) });
    stumble(run, [7, 8], [7, 14]);
    expect(hit).toEqual(['wall:stumble']);
  });
});

describe('Stumble stops at a keg', () => {
  // The chapter 1 sandbox keg puzzle: keg2 at (9, 13) in front of a wall at col 10, keg1 at (9, 14) with open ground beyond.
  const kegModule = () => {
    const base = createSandboxModule(1);
    const [screen, ...rest] = base.screens;
    const props = [bucket('before', 7, 14), bucket('beyond', 11, 14)];
    return { ...base, screens: [{ ...screen!, dressing: { ...screen!.dressing, props: [...(screen!.dressing?.props ?? []), ...props] } }, ...rest] } as ChapterModule;
  };

  it('keg1 stops it; the breakable before the keg breaks, the one past it does not, and the hook at the keg fires', () => {
    const { run } = makeRun({ chapter: 1, module: kegModule() });
    run.learnMove('stumble');
    expect(run.pushPuzzlesHere()[0]!.puzzle.occupies(9, 14)).toBe(true);
    const broken = record(run.bus, 'prop:broken');
    const hit = hookNames(run, { keg: tileRect(9, 14), beyond: tileRect(11, 14) });
    stumble(run, [5, 14], [14, 14]);
    expect(run.player.pos.x).toBeLessThan(9 * 16);
    expect(broken.map((b) => b.propId)).toEqual(['before']);
    expect(hit).toEqual(['keg:stumble']);
  });

  it('once the keg is pushed out of the lane it no longer stops it', () => {
    const { run } = makeRun({ chapter: 1, module: kegModule() });
    run.learnMove('stumble');
    expect(run.pushPuzzlesHere()[0]!.puzzle.push({ col: 9, row: 14 }, 'left')).toBe(true);
    // keg1 now at (8, 14): still in the lane, so it stops him earlier.
    stumble(run, [5, 14], [14, 14]);
    expect(run.player.pos.x).toBeLessThan(8 * 16);
  });
});

describe('Shoulder (a short lurch)', () => {
  it('stops at a keg and fires a hook at the keg but not past it', () => {
    const { run } = makeRun({ chapter: 1, module: createSandboxModule(1) });
    const hit: MoveId[] = [];
    const past: MoveId[] = [];
    run.onMoveHit(tileRect(9, 14), (h) => hit.push(h.moveId));
    run.onMoveHit(tileRect(10, 14), (h) => past.push(h.moveId));
    placeAt(run, 7, 14);
    const aim = { x: 12 * 16, y: 14 * 16 + 8 };
    run.tick(16, frame({ aim }));
    run.tick(16, frame({ pressed: ['special1'], aim }));
    advance(run, 400);
    expect(run.player.pos.x).toBeLessThan(9 * 16);
    expect(hit).toEqual(['shoulder']);
    expect(past).toEqual([]);
  });
});
