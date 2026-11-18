/** Chapter 8 boss: Pruitt round two (`pruitt2.ts`) through the run. */

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/content/tuning';
import type { ChapterModule } from '../../src/core/chapter';
import { createChapter2Sandbox } from '../../src/core/sandbox2';
import type { Vec2 } from '../../src/core/types';
import { createKit } from '../../src/systems/kit';
import { createMeter } from '../../src/systems/meter';
import { advance, frame, makeRun, record } from './helpers';

const BOSS = 'c8.boss.pruitt2' as const;
const DEF = TUNING.bosses[BOSS];
const P = TUNING.overhaul!.pruitt2!;
const atk = (id: string) => DEF.phases.flatMap((p) => p.attacks).find((a) => a.id === id)!;
const LINES = [
  { id: 'l1', from: { x: 700, y: 40 }, to: { x: 700, y: 150 } },
  { id: 'l2', from: { x: 800, y: 40 }, to: { x: 800, y: 150 } },
];
const PATH = { from: { x: 940, y: 100 }, to: { x: 660, y: 100 }, width: 28 };

function mod(): ChapterModule {
  const base = createChapter2Sandbox();
  return {
    ...base,
    createScript: undefined,
    bosses: [
      {
        bossId: BOSS,
        screenId: base.def.startScreenId,
        trigger: { kind: 'script' },
        bodies: [{ tag: 'pruitt', position: { x: 900, y: 30 } }],
        pruitt2: { barrierLines: LINES, truckPath: PATH },
        entrance: { x: 700, y: 140 },
      },
    ],
  };
}

function start(at: Vec2 = { x: 760, y: 100 }) {
  const h = makeRun({ module: mod() });
  const { run } = h;
  run.player.setKit(createKit());
  run.player.holdDrain(true);
  run.setPlayerPosition(at);
  run.startSection(BOSS);
  const boss = run.boss(BOSS)!;
  const pruitt = boss.body('pruitt')!;
  // He does not walk or throw: only the director's attacks are under test.
  pruitt.stationary = true;
  pruitt.attacks = [];
  const step = (ms: number, pos: Vec2 = at): void => {
    for (let t = 0; t < ms; t += 16) {
      run.player.meter = createMeter(2, 55);
      run.setPlayerPosition(pos);
      run.tick(16, frame());
    }
  };
  return { ...h, boss, pruitt, step };
}

describe('Pruitt round two: phase 1', () => {
  it('keeps the paired darts; the rest is the director', () => {
    const h = makeRun({ module: mod() });
    h.run.startSection(BOSS);
    const body = h.run.boss(BOSS)!.body('pruitt')!;
    expect(body.attacks.map((a) => a.id)).toEqual(['darts']);
    expect(body.attacks[0]?.burst).toBe(2);
  });

  it('the flashbang marker lights for a second, then whites out the screen for 1 s if Andrew is inside', () => {
    const { run, bus, step } = start();
    const seen = record(bus, 'pruitt:changed');
    const hits = record(bus, 'player:hit');
    let litAt = -1;
    let burstAt = -1;
    let whiteSeen = 0;
    for (let t = 0; t < atk('flashbang').cooldownMs + 9000; t += 16) {
      step(16);
      if (litAt < 0 && seen.some((e) => e.phase === 'flashLit')) litAt = t;
      if (burstAt < 0 && seen.some((e) => e.phase === 'flash')) burstAt = t;
      if (run.whiteoutAlpha() > 0) whiteSeen += 16;
    }
    expect(burstAt - litAt).toBeGreaterThanOrEqual(atk('flashbang').telegraphMs - 50);
    expect(burstAt - litAt).toBeLessThanOrEqual(atk('flashbang').telegraphMs + 50);
    expect(seen.some((e) => e.phase === 'whiteout')).toBe(true);
    expect(whiteSeen).toBeGreaterThanOrEqual(P.whiteoutMs - 100);
    expect(whiteSeen).toBeLessThanOrEqual(P.whiteoutMs + 100);
    // The marker was lit on the ground where he stood.
    expect(hits.filter((h) => h.source.kind === 'boss' && h.source.attackId === 'flashbang')).toHaveLength(0);
  });

  it('no white-out if Andrew walks out of the marker', () => {
    const { run, bus, step } = start();
    const seen = record(bus, 'pruitt:changed');
    let moved = false;
    for (let t = 0; t < atk('flashbang').cooldownMs + 3000; t += 16) {
      if (seen.some((e) => e.phase === 'flashLit') && !moved) moved = true;
      step(16, moved ? { x: 760, y: 148 } : { x: 760, y: 100 });
    }
    expect(seen.some((e) => e.phase === 'flash')).toBe(true);
    expect(seen.some((e) => e.phase === 'whiteout')).toBe(false);
    expect(run.whiteoutAlpha()).toBe(0);
  });

  it('the barrier arm lights the nearest marked line, then drops on it: heavy if he stays', () => {
    const { run, bus, step } = start({ x: 702, y: 100 });
    const seen = record(bus, 'pruitt:changed');
    const hits = record(bus, 'player:hit');
    let lit: string | undefined;
    for (let t = 0; t < atk('barrier').cooldownMs + 3000; t += 16) {
      step(16, { x: 702, y: 100 });
      const v = run.pruittHere()[0]!.director.view(run.boss(BOSS));
      if (v.barrier && !lit) lit = v.barrier.line.id;
    }
    expect(lit).toBe('l1');
    expect(seen.map((e) => e.phase)).toEqual(expect.arrayContaining(['barrierLit', 'barrierDown']));
    expect(hits.some((h) => h.weight === 'heavy' && h.source.kind === 'boss' && h.source.attackId === 'barrier')).toBe(true);
  });

  it('the barrier misses him if he steps off the line, stays down, then lifts', () => {
    const { run, bus, step } = start({ x: 750, y: 100 });
    const seen = record(bus, 'pruitt:changed');
    const hits = record(bus, 'player:hit');
    step(atk('barrier').cooldownMs + 3000, { x: 750, y: 100 });
    expect(seen.some((e) => e.phase === 'barrierDown')).toBe(true);
    expect(hits.filter((h) => h.source.kind === 'boss' && h.source.attackId === 'barrier')).toHaveLength(0);
    step(P.barrierDownMs + 200, { x: 750, y: 100 });
    expect(seen.some((e) => e.phase === 'barrierUp')).toBe(true);
    void run;
  });

  it('no truck in phase 1', () => {
    const { bus, step } = start();
    const seen = record(bus, 'pruitt:changed');
    step(14000);
    expect(seen.some((e) => e.phase === 'truckLit')).toBe(false);
  });
});

describe('Pruitt round two: phase 2 (60%)', () => {
  it('a patrol truck makes a pass along the lit path every 12 s: lit, then a worst hit', () => {
    const { run, bus, boss, step } = start({ x: 800, y: 100 });
    const seen = record(bus, 'pruitt:changed');
    const hits = record(bus, 'player:hit');
    boss.forcePhase('truck');
    expect(boss.phase?.id).toBe('truck');
    const lits: number[] = [];
    let t = 0;
    for (; t < 40000; t += 16) {
      step(16, { x: 800, y: 100 });
      if (seen.filter((e) => e.phase === 'truckLit').length > lits.length) lits.push(t);
    }
    expect(lits.length).toBeGreaterThanOrEqual(3);
    expect(lits[1]! - lits[0]!).toBeGreaterThanOrEqual(11900);
    expect(lits[1]! - lits[0]!).toBeLessThanOrEqual(12100);
    expect(seen.some((e) => e.phase === 'truckPass')).toBe(true);
    expect(hits.some((h) => h.weight === 'worst' && h.source.kind === 'boss' && h.source.attackId === 'truckPass')).toBe(true);
    void run;
  });

  it('the pass is lit for the telegraph before the truck moves, and the truck leaves the path at its far end', () => {
    const { run, boss, step } = start({ x: 600, y: 100 });
    boss.forcePhase('truck');
    let sawLit = false;
    let sawPassing = false;
    for (let t = 0; t < 16000; t += 16) {
      step(16, { x: 600, y: 100 });
      const v = run.pruittHere()[0]!.director.view(boss);
      if (v.truck?.state === 'lit') {
        sawLit = true;
        expect(sawPassing).toBe(false);
      }
      if (v.truck?.state === 'passing') sawPassing = true;
    }
    expect(sawLit && sawPassing).toBe(true);
  });
});

describe('Pruitt round two: the end', () => {
  const nearEnd = (boss: ReturnType<typeof start>['boss']) => {
    const h = boss.health()!;
    boss.body('pruitt')!.health = h.max * (DEF.end.kind === 'healthBelow' ? DEF.end.fraction : 0.4) - 1;
  };

  it('at 40% he stops: the boss ends, nothing is knocked down, every marker is gone', () => {
    const { run, boss, pruitt, bus, step } = start();
    const seen = record(bus, 'pruitt:changed');
    const done = record(bus, 'section:completed');
    nearEnd(boss);
    step(100);
    expect(boss.isComplete()).toBe(true);
    expect(pruitt.down).toBe(false);
    expect(pruitt.frozen).toBe(true);
    expect(seen.filter((e) => e.phase === 'letThrough')).toHaveLength(1);
    expect(done.filter((d) => d.sectionId === BOSS)).toHaveLength(1);
    const v = run.pruittHere()[0]!.director.view(boss);
    expect(v).toMatchObject({ flash: null, barrier: null, truck: null, whiteout: 0, stopped: true });
    step(20000);
    expect(seen.some((e) => e.phase === 'flashLit' || e.phase === 'barrierLit' || e.phase === 'truckLit')).toBe(false);
  });

  it('a Myko call ends it the same way: he is not knocked down', () => {
    const { boss, pruitt, bus } = start();
    const seen = record(bus, 'pruitt:changed');
    boss.completeNow('myko');
    expect(boss.isComplete()).toBe(true);
    expect(pruitt.down).toBe(false);
    expect(seen.some((e) => e.phase === 'letThrough')).toBe(true);
  });

  it('starts again after a return to the bar', () => {
    const { run, boss, step } = start();
    step(2000);
    run.player.holdDrain(false);
    run.player.meter = createMeter(2, 0.01);
    advance(run, 300);
    expect(boss.active).toBe(false);
    run.startSection(BOSS);
    const again = run.boss(BOSS)!;
    expect(again.active).toBe(true);
    expect(again.body('pruitt')!.attacks.map((a) => a.id)).toEqual(['darts']);
    expect(run.pruittHere()[0]!.director.view(again).stopped).toBe(false);
  });
});
