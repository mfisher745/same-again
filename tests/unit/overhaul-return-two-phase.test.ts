/**
 * The two-phase return to the bar (DESIGN.md 7.1 "Back to the bar"): `bar:returning` freezes the world, the scene
 * calls `completeBarReturn()` at black, a failsafe completes it otherwise. Run, tuning, Myko, timers, the clock
 * and the settled hook. The UI, audio and FakeSource sides are in ui-model.test.ts and audio-wiring.test.ts.
 * Every time and distance comes from tuning.
 */

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/content/tuning';
import type { ChapterContext, ChapterModule, ChapterScript } from '../../src/core/chapter';
import { createSandboxModule } from '../../src/core/sandbox';
import type { HitInfo } from '../../src/core/types';
import { distance } from '../../src/systems/geometry';
import { createMeter } from '../../src/systems/meter';
import { blackStartMs } from '../../src/ui/model/returns';
import { frame, makeRun, record } from './helpers';
import type { RunHarness } from './helpers';
import type { ChapterRun } from '../../src/systems/run';

const O = TUNING.overhaul!;
const UI = TUNING.ui!;
const FECKED = 95;
const SANDBOX_BOUNDS = { width: 30 * 16, height: 17 * 16 };
/** A point well inside the sandbox screen. */
const ANDREW = { x: 400, y: 100 };

const hazard = (): Omit<HitInfo, 'targetInstanceId'> => ({
  source: { kind: 'hazard', hazardId: 'x' },
  amount: 0,
  knockback: { x: 0, y: 0 },
  stunMs: 0,
  holdMs: 0,
  weight: 'worst',
});

/** Ticks `ms` in `step` slices with an empty frame. */
const tickFor = (run: ChapterRun, ms: number, step = 10): void => {
  for (let t = 0; t < ms; t += step) run.tick(step, frame());
};
const toSober = (run: ChapterRun): void => {
  run.player.meter = createMeter(1, 0.01);
  tickFor(run, 100);
};
const toFloor = (run: ChapterRun): void => {
  run.player.meter = createMeter(1, FECKED);
  run.hitPlayer(hazard());
  run.tick(16, frame());
};

/** A manual-return run whose script is `script`; `ctx` is the context the script was given. */
function scripted(script: Partial<ChapterScript> = {}): RunHarness & { ctx: () => ChapterContext } {
  let ctx: ChapterContext | null = null;
  const module: ChapterModule = {
    ...createSandboxModule(1),
    createScript: (c) => {
      ctx = c;
      return script;
    },
  };
  const h = makeRun({ module, manualReturn: true });
  return {
    ...h,
    ctx: () => {
      if (!ctx) throw new Error('script not created');
      return ctx;
    },
  };
}

describe('tuning: the failsafe outlasts the longest return the UI plays to black', () => {
  const margin = 500;
  it('sober: flatten + fade, plus a margin', () => {
    expect(O.barReturnFailsafeMs!).toBeGreaterThanOrEqual(UI.soberReturn.flattenMs + UI.soberReturn.fadeMs + margin);
  });
  it('floor: fall + hurry + smoke, plus a margin', () => {
    expect(O.barReturnFailsafeMs!).toBeGreaterThanOrEqual(UI.floorReturn.fallMs + UI.floorReturn.hurryMs + UI.floorReturn.smokeMs + margin);
  });
  it('is the black moment of both returns (the scene completes there) plus a margin', () => {
    for (const reason of ['sober', 'floor'] as const) expect(O.barReturnFailsafeMs!).toBeGreaterThanOrEqual(blackStartMs(reason, UI) + margin);
  });
});

describe('the run: begin, wait, complete', () => {
  it('emits bar:returning once; a second begin while waiting is ignored and the reason stays', () => {
    const { run, bus } = makeRun({ manualReturn: true });
    const returning = record(bus, 'bar:returning');
    toSober(run);
    expect(returning).toHaveLength(1);
    // A hit at the top while the first return waits must not start another.
    run.player.meter = createMeter(1, FECKED);
    run.hitPlayer(hazard());
    tickFor(run, 200);
    expect(returning).toHaveLength(1);
    expect(run.barReturning?.reason).toBe('sober');
  });

  it('nothing moves or resets until completeBarReturn()', () => {
    const { run, bus, returns } = makeRun({ manualReturn: true });
    const returning = record(bus, 'bar:returning');
    run.setPlayerPosition(ANDREW);
    run.setFlag('c1.later', true);
    toSober(run);
    const meterAt = run.player.meter.value;
    tickFor(run, 1000);
    expect(returning).toHaveLength(1);
    expect(run.player.pos).toEqual(ANDREW);
    expect(run.player.meter.value).toBe(meterAt);
    expect(run.flag('c1.later')).toBe(true);
    expect(returns).toEqual([]);
    run.completeBarReturn();
    expect(returns).toEqual(['sober']);
    expect(run.player.pos).toEqual(run.screenLayout.playerStart);
    expect(run.flag('c1.later')).toBeUndefined();
    expect(run.player.meter.value).toBeGreaterThan(meterAt);
  });

  it('completeBarReturn() with nothing pending does nothing', () => {
    const { run, bus, returns } = makeRun({ manualReturn: true });
    const returning = record(bus, 'bar:returning');
    run.setPlayerPosition(ANDREW);
    const before = { pos: run.player.pos, value: run.player.meter.value, mode: run.myko.mode };
    run.completeBarReturn();
    run.completeBarReturn();
    expect(returns).toEqual([]);
    expect(returning).toEqual([]);
    expect(run.barReturning).toBeNull();
    expect({ pos: run.player.pos, value: run.player.meter.value, mode: run.myko.mode }).toEqual(before);
  });

  it('a second completeBarReturn() after the first does nothing', () => {
    const { run, returns } = makeRun({ manualReturn: true });
    toSober(run);
    run.completeBarReturn();
    run.completeBarReturn();
    expect(returns).toEqual(['sober']);
  });

  it('a return can happen again after one completed', () => {
    const { run, bus, returns } = makeRun({ manualReturn: true });
    const returning = record(bus, 'bar:returning');
    toSober(run);
    run.completeBarReturn();
    toFloor(run);
    expect(returning.map((r) => r.reason)).toEqual(['sober', 'floor']);
    run.completeBarReturn();
    expect(returns).toEqual(['sober', 'floor']);
  });

  it('the failsafe completes it at barReturnFailsafeMs, not before', () => {
    const { run, returns } = makeRun({ manualReturn: true });
    toSober(run);
    tickFor(run, O.barReturnFailsafeMs! - 200);
    expect(returns).toEqual([]);
    expect(run.barReturning).not.toBeNull();
    tickFor(run, 400);
    expect(returns).toEqual(['sober']);
    expect(run.barReturning).toBeNull();
  });

  it('the failsafe clock restarts for the next return', () => {
    const { run, returns } = makeRun({ manualReturn: true });
    toSober(run);
    tickFor(run, O.barReturnFailsafeMs! - 500);
    run.completeBarReturn();
    toFloor(run);
    tickFor(run, O.barReturnFailsafeMs! - 500);
    expect(returns).toEqual(['sober']);
    tickFor(run, 800);
    expect(returns).toEqual(['sober', 'floor']);
  });
});

describe('Myko in a return', () => {
  const reach = (TUNING.myko.walkSpeed * UI.floorReturn.hurryMs) / 1000;
  const target = { x: ANDREW.x - TUNING.myko.followDistance, y: ANDREW.y };

  /** Andrew at ANDREW, Myko at `from`, then the floor. */
  const floorFrom = (from: { x: number; y: number }): ChapterRun => {
    const { run } = makeRun({ manualReturn: true });
    run.setPlayerPosition(ANDREW);
    run.myko.pos = { ...from };
    toFloor(run);
    return run;
  };
  const arrives = (run: ChapterRun): void => {
    tickFor(run, UI.floorReturn.hurryMs);
    expect(run.barReturning).not.toBeNull();
    expect(distance(run.myko.pos, target)).toBeLessThanOrEqual(1.5);
  };

  it('a floor return makes him scripted and hurrying', () => {
    const run = floorFrom({ x: ANDREW.x - 40, y: ANDREW.y });
    expect(run.myko.mode).toBe('scripted');
    expect(run.myko.hurrying).toBe(true);
  });

  it('from near he is not moved, and arrives within hurryMs', () => {
    const from = { x: ANDREW.x - 60, y: ANDREW.y + 10 };
    const run = floorFrom(from);
    expect(distance(run.myko.pos, from)).toBeLessThan(3);
    arrives(run);
  });

  it('his hurrying flag clears once he has arrived', () => {
    const run = floorFrom({ x: ANDREW.x - 60, y: ANDREW.y + 10 });
    tickFor(run, UI.floorReturn.hurryMs + 500);
    expect(run.myko.hurrying).toBe(false);
  });

  it('from far he is placed at reach distance, inside the grid, and still arrives within hurryMs', () => {
    const run = floorFrom({ x: 20, y: 250 });
    expect(distance(run.myko.pos, target)).toBeLessThanOrEqual(reach + 2);
    expect(distance(run.myko.pos, target)).toBeGreaterThan(reach * 0.5);
    arrives(run);
  });

  it.each([
    ['above and left of the screen', { x: -500, y: -500 }],
    ['below and right of the screen', { x: 5000, y: 4000 }],
    ['directly right of the screen', { x: 3000, y: ANDREW.y }],
  ])('from outside the screen (%s) he is put inside the grid at reach distance and still arrives', (_n, from) => {
    const run = floorFrom(from);
    const p = run.myko.pos;
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThanOrEqual(SANDBOX_BOUNDS.width);
    expect(p.y).toBeLessThanOrEqual(SANDBOX_BOUNDS.height);
    expect(distance(p, target)).toBeLessThanOrEqual(reach + 2);
    arrives(run);
  });

  it('with Andrew at a screen corner the target and Myko stay inside the grid', () => {
    const { run } = makeRun({ manualReturn: true });
    run.setPlayerPosition({ x: 20, y: 20 });
    run.myko.pos = { x: 4000, y: 4000 };
    toFloor(run);
    expect(run.myko.pos.x).toBeGreaterThanOrEqual(0);
    expect(run.myko.pos.y).toBeGreaterThanOrEqual(0);
    tickFor(run, UI.floorReturn.hurryMs);
    expect(run.myko.pos.x).toBeGreaterThanOrEqual(0);
  });

  it('a sober return does not send him', () => {
    const { run } = makeRun({ manualReturn: true });
    run.setPlayerPosition(ANDREW);
    run.myko.pos = { x: 20, y: 250 };
    toSober(run);
    expect(run.myko.hurrying).toBe(false);
    expect(run.myko.mode).not.toBe('scripted');
    expect(distance(run.myko.pos, { x: 20, y: 250 })).toBeLessThan(20);
  });

  it('completeBarReturn() releases him to following', () => {
    const run = floorFrom({ x: ANDREW.x - 60, y: ANDREW.y });
    run.completeBarReturn();
    expect(run.myko.mode).toBe('following');
    expect(run.myko.hurrying).toBe(false);
  });

  it('completion mid-hurry (the scene was quicker) still releases him', () => {
    const run = floorFrom({ x: 20, y: 250 });
    tickFor(run, 200);
    expect(run.myko.hurrying).toBe(true);
    run.completeBarReturn();
    expect(run.myko.mode).toBe('following');
    expect(run.myko.hurrying).toBe(false);
  });

  it("a chapter script's onBarReturn can place him again", () => {
    const spot = { x: 100, y: 60 };
    const h = scripted({
      onBarReturn: () => h.ctx().setMykoScripted(spot),
    });
    toFloor(h.run);
    h.run.completeBarReturn();
    expect(h.run.myko.mode).toBe('scripted');
    expect(h.run.myko.standPoint).toEqual(spot);
  });
});

describe('script timers and the clock during the freeze', () => {
  it('a one-shot timer due during the freeze does not fire in it, and fires its full remaining time after completion', () => {
    const h = scripted();
    let fired = 0;
    h.ctx().after(1000, () => void fired++);
    tickFor(h.run, 800);
    expect(fired).toBe(0);
    toSober(h.run);
    expect(h.run.barReturning).not.toBeNull();
    // 200 ms was left; the freeze is long enough to pass it many times over.
    tickFor(h.run, O.barReturnFailsafeMs! - 500);
    expect(fired).toBe(0);
    h.run.completeBarReturn();
    expect(fired).toBe(0);
    tickFor(h.run, 100);
    expect(fired).toBe(0);
    tickFor(h.run, 300);
    expect(fired).toBe(1);
    tickFor(h.run, 2000);
    expect(fired).toBe(1);
  });

  it('a timer set before a floor return behaves the same', () => {
    const h = scripted();
    let fired = 0;
    h.ctx().after(500, () => void fired++);
    tickFor(h.run, 300);
    toFloor(h.run);
    tickFor(h.run, 3000);
    expect(fired).toBe(0);
    h.run.completeBarReturn();
    tickFor(h.run, 100);
    expect(fired).toBe(0);
    tickFor(h.run, 300);
    expect(fired).toBe(1);
  });

  it('a repeating timer does not fire on consecutive ticks to catch up', () => {
    const h = scripted();
    let fired = 0;
    h.ctx().every(100, () => void fired++);
    tickFor(h.run, 500);
    toSober(h.run);
    tickFor(h.run, O.barReturnFailsafeMs! - 500);
    const during = fired;
    h.run.completeBarReturn();
    tickFor(h.run, 100, 10);
    // 100 ms of resumed time is one or two periods, not the ~50 a burst would give.
    expect(fired - during).toBeLessThanOrEqual(2);
    expect(fired - during).toBeGreaterThanOrEqual(1);
  });

  it('a timer still fires on schedule in normal play (the control)', () => {
    const h = scripted();
    let fired = 0;
    h.ctx().after(1000, () => void fired++);
    tickFor(h.run, 800);
    expect(fired).toBe(0);
    tickFor(h.run, 400);
    expect(fired).toBe(1);
  });

  describe('a dialogue line queued just before the freeze', () => {
    const FIRST = 'c1.hint.bar.1';
    const SECOND = 'c1.hint.bar.2';
    const staleMs = TUNING.myko.commentStaleMs;

    it('is not dropped as stale after the freeze, if the frozen time stays under the stale limit in run time', () => {
      const h = scripted();
      void h.run.dialogue.play(FIRST);
      void h.run.dialogue.play(SECOND);
      expect(h.run.dialogue.showing('box')).toBe(FIRST);
      expect(h.run.dialogue.hasPlayed(SECOND)).toBe(true);
      toSober(h.run);
      // Wall time under freeze beyond the stale limit.
      const freeze = Math.min(O.barReturnFailsafeMs! - 500, staleMs + 500);
      expect(freeze).toBeGreaterThan(staleMs - 1000);
      tickFor(h.run, freeze);
      h.run.completeBarReturn();
      tickFor(h.run, 1000);
      expect(h.run.dialogue.hasPlayed(SECOND)).toBe(true);
    });

    it('control: the same line IS dropped as stale after staleMs of ordinary play', () => {
      const h = scripted();
      void h.run.dialogue.play(FIRST);
      void h.run.dialogue.play(SECOND);
      tickFor(h.run, staleMs + 500);
      expect(h.run.dialogue.hasPlayed(SECOND)).toBe(false);
    });
  });
});

describe('onBarReturnSettled', () => {
  it('fires once per completion, after onBarReturn has run', () => {
    const order: string[] = [];
    const h = scripted({ onBarReturn: () => void order.push('script') });
    h.run.onBarReturnSettled(() => void order.push('settled'));
    toSober(h.run);
    expect(order).toEqual([]);
    h.run.completeBarReturn();
    expect(order).toEqual(['script', 'settled']);
    h.run.completeBarReturn();
    expect(order).toEqual(['script', 'settled']);
    toFloor(h.run);
    h.run.completeBarReturn();
    expect(order).toEqual(['script', 'settled', 'script', 'settled']);
  });

  it('does not fire when nothing is pending', () => {
    const { run } = makeRun({ manualReturn: true });
    let n = 0;
    run.onBarReturnSettled(() => void n++);
    run.completeBarReturn();
    tickFor(run, 200);
    expect(n).toBe(0);
  });

  it('fires when the failsafe completes it', () => {
    const { run } = makeRun({ manualReturn: true });
    let n = 0;
    run.onBarReturnSettled(() => void n++);
    toSober(run);
    tickFor(run, O.barReturnFailsafeMs! + 100);
    expect(n).toBe(1);
  });

  it('the world is final when it fires: Andrew is already in the bar', () => {
    const { run } = makeRun({ manualReturn: true });
    run.setPlayerPosition(ANDREW);
    let at: { x: number; y: number } | null = null;
    run.onBarReturnSettled(() => void (at = { ...run.player.pos }));
    toSober(run);
    run.completeBarReturn();
    expect(at).toEqual(run.screenLayout.playerStart);
  });

  it('unsubscribe works, and others still fire', () => {
    const { run } = makeRun({ manualReturn: true });
    let a = 0;
    let b = 0;
    const off = run.onBarReturnSettled(() => void a++);
    run.onBarReturnSettled(() => void b++);
    off();
    toSober(run);
    run.completeBarReturn();
    expect([a, b]).toEqual([0, 1]);
  });

  it('a listener that unsubscribes itself does not skip the next one', () => {
    const { run } = makeRun({ manualReturn: true });
    let b = 0;
    const off = run.onBarReturnSettled(() => off());
    run.onBarReturnSettled(() => void b++);
    toSober(run);
    run.completeBarReturn();
    expect(b).toBe(1);
  });
});
