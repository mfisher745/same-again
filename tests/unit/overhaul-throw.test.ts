/** DESIGN.md 7.2 "Thrown bottles": hold to aim, release to throw, sway from level 3. */

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/content/tuning';
import { createKit, spendBottle } from '../../src/systems/kit';
import { distance } from '../../src/systems/geometry';
import { beginAim, cancelAim, createThrowAimState, currentPreview, previewAt, release, swayDegrees, tickAim } from '../../src/systems/throwAim';

const O = TUNING.overhaul!;
const T = O.throw!;
const origin = { x: 100, y: 100 };
const pointer = { x: 160, y: 100 };

describe('throw: sway', () => {
  it('is zero at levels 1 and 2 at any time', () => {
    for (const level of [1, 2] as const) {
      for (const ms of [0, 100, 425, 1234, 99999]) expect(swayDegrees(level, ms)).toBe(0);
    }
  });

  it('is zero at the start of the cycle and peaks at the tuned degrees', () => {
    expect(swayDegrees(3, 0)).toBeCloseTo(0);
    expect(swayDegrees(3, T.swayPeriodMs / 4)).toBeCloseTo(O.swayByLevel[3]);
    expect(swayDegrees(4, T.swayPeriodMs / 4)).toBeCloseTo(O.swayByLevel[4]);
    expect(swayDegrees(4, (3 * T.swayPeriodMs) / 4)).toBeCloseTo(-O.swayByLevel[4]);
  });

  it('is strongest at level 4, moderate at 3, and deterministic', () => {
    const m = T.swayPeriodMs / 4;
    expect(Math.abs(swayDegrees(4, m))).toBeGreaterThan(Math.abs(swayDegrees(3, m)));
    expect(swayDegrees(3, 777)).toBe(swayDegrees(3, 777));
  });
});

describe('throw: preview', () => {
  it('is a straight, steady line toward the pointer at level 2', () => {
    const a = previewAt(origin, pointer, 2, 500);
    expect(a.swayAmount).toBe(0);
    expect(a.landing.x).toBeCloseTo(160);
    expect(a.landing.y).toBeCloseTo(100);
    expect(a.path).toHaveLength(T.previewPoints);
    expect(a.path[0]).toEqual(origin);
    expect(a.path[a.path.length - 1]).toEqual(a.landing);
  });

  it('is the same at any time at levels 1 and 2', () => {
    expect(previewAt(origin, pointer, 1, 0)).toEqual(previewAt(origin, pointer, 1, 999));
  });

  it('is limited by the throw range', () => {
    const a = previewAt(origin, { x: 5000, y: 100 }, 2, 0);
    expect(distance(origin, a.landing)).toBeCloseTo(T.range);
  });

  it('moves with time at level 3 and swings further at level 4', () => {
    const t = T.swayPeriodMs / 4;
    const a = previewAt(origin, pointer, 3, t);
    const b = previewAt(origin, pointer, 4, t);
    expect(a.landing.y).not.toBeCloseTo(100);
    expect(Math.abs(b.landing.y - 100)).toBeGreaterThan(Math.abs(a.landing.y - 100));
    expect(distance(origin, a.landing)).toBeCloseTo(60);
  });

  it('reports a degenerate pointer on the origin without NaN', () => {
    const a = previewAt(origin, origin, 4, 300);
    expect(a.landing).toEqual(origin);
  });
});

describe('throw: hold and release', () => {
  it('needs a bottle to begin aiming', () => {
    const r = beginAim(createThrowAimState(), 0);
    expect(r.refusal).toBe('noBottle');
    expect(r.state.aiming).toBe(false);
    expect(currentPreview(r.state, origin, pointer, 2)).toBeNull();
  });

  it('release without a bottle gives no throw', () => {
    const aiming = beginAim(createThrowAimState(), 1).state;
    const r = release(aiming, origin, pointer, 2, 0);
    expect(r.request).toBeNull();
    expect(r.refusal).toBe('noBottle');
    expect(r.state.aiming).toBe(false);
  });

  it('release without aiming does nothing', () => {
    expect(release(createThrowAimState(), origin, pointer, 2, 5).refusal).toBe('notAiming');
  });

  it('the bottle goes exactly where the preview pointed at the moment of release', () => {
    for (const level of [1, 2, 3, 4] as const) {
      let s = beginAim(createThrowAimState(), 3).state;
      for (let i = 0; i < 23; i++) s = tickAim(s, 37);
      const shown = currentPreview(s, origin, pointer, level)!;
      const r = release(s, origin, pointer, level, 3);
      expect(r.request!.landing).toEqual(shown.landing);
      expect(r.request!.path).toEqual(shown.path);
      expect(r.request!.swayAmount).toBe(shown.swayAmount);
    }
  });

  it('a different release time gives a different landing at level 4 (timing matters), never at level 2', () => {
    const aim = (ms: number, level: 2 | 4) => release(tickAim(beginAim(createThrowAimState(), 1).state, ms), origin, pointer, level, 1).request!.landing;
    expect(aim(100, 4)).not.toEqual(aim(300, 4));
    expect(aim(100, 2)).toEqual(aim(300, 2));
  });

  it('carries fixed damage and noise, unchanged by level', () => {
    const s = beginAim(createThrowAimState(), 1).state;
    const a = release(s, origin, pointer, 1, 1).request!;
    const b = release(s, origin, pointer, 4, 1).request!;
    expect(a.damage).toBe(T.damage);
    expect(b.damage).toBe(a.damage);
    expect(a.noiseRadius).toBe(T.noiseRadius);
  });

  it('release ends the aim and sway restarts on the next press', () => {
    const s = tickAim(beginAim(createThrowAimState(), 1).state, 500);
    const r = release(s, origin, pointer, 3, 1);
    expect(r.state).toEqual({ aiming: false, elapsedMs: 0 });
    expect(beginAim(r.state, 1).state.elapsedMs).toBe(0);
    expect(cancelAim().aiming).toBe(false);
  });

  it('ticking while not aiming changes nothing', () => {
    const s = createThrowAimState();
    expect(tickAim(s, 500)).toBe(s);
  });

  it('works with the kit: releasing spends one bottle', () => {
    const kit = { ...createKit(), bottles: 2 };
    const aim = beginAim(createThrowAimState(), kit.bottles).state;
    const r = release(aim, origin, pointer, 2, kit.bottles);
    expect(r.request).not.toBeNull();
    expect(spendBottle(kit).kit.bottles).toBe(1);
  });
});
