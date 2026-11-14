/** ChapterRun on the dev sandbox: stealth hand-off, debug walk, edge input. Pickups, drinking and the bar return are in overhaul-integration. */

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/content/tuning';
import { restValue } from '../../src/systems/meter';
import { frame, makeRun, record, teleport } from './helpers';

describe('stealth through a run', () => {
  it('a clean run is recorded in the save, rewards its drink and emits once', () => {
    const { run, bus, saves } = makeRun();
    const clean = record(bus, 'stealth:cleanRun');
    run.startSection('c2.stealth.bog');
    run.stealth('c2.stealth.bog')?.finish();
    run.stealth('c2.stealth.bog')?.finish();
    expect(clean).toEqual([{ sectionId: 'c2.stealth.bog' }]);
    expect(run.isComplete('c2.stealth.bog')).toBe(true);
    expect(saves.at(-1)?.reason).toBe('sectionDone');
    expect(saves.at(-1)?.state.cleanStealthRunIds).toEqual(['c2.stealth.bog']);
    expect(run.snapshot().cleanStealthRunIds).toEqual(['c2.stealth.bog']);
  });

  it('the alarm starts the .alarm fight from tuning, with the guards joining it', () => {
    const { run, bus } = makeRun();
    const alarm = record(bus, 'stealth:alarm');
    run.startSection('c2.stealth.bog');
    run.stealth('c2.stealth.bog')?.alarm();
    expect(alarm).toEqual([{ sectionId: 'c2.stealth.bog', fightId: 'c2.stealth.bog.alarm' }]);
    const alive = run.enemies().filter((e) => !e.down);
    const alarmWave = TUNING.fights['c2.stealth.bog.alarm']?.waves[0]?.enemies.reduce((n, g) => n + g.count, 0) ?? 0;
    expect(alive.length).toBe(1 + alarmWave); // the original guard plus tuning's first wave
    expect(run.stealth('c2.stealth.bog')?.alarmRaised).toBe(true);
    run.completeCurrent();
    expect(run.isComplete('c2.stealth.bog.alarm')).toBe(true);
    expect(run.isComplete('c2.stealth.bog')).toBe(true); // getting caught is never a restart
  });

  it('a caught section gives no clean-run credit', () => {
    const { run } = makeRun();
    run.startSection('c2.stealth.bog');
    run.stealth('c2.stealth.bog')?.alarm();
    run.completeCurrent();
    expect(run.snapshot().cleanStealthRunIds).toEqual([]);
  });
});

describe('debug entry points', () => {
  it('completeCurrent is a no-op when nothing is running', () => {
    const { run } = makeRun();
    expect(run.completeCurrent()).toBeNull();
  });

  it('completeCurrent finishes the running fight with source debug', () => {
    const { run, bus } = makeRun();
    const done = record(bus, 'section:completed');
    teleport(run, 22, 13);
    expect(run.completeCurrent()).toBe('c1.fight.chipper');
    expect(done.find((d) => d.sectionId === 'c1.fight.chipper')?.by).toBe('debug');
  });

  it('walkChapter completes every declared section, then the chapter, once', () => {
    const { run, completions } = makeRun();
    run.walkChapter();
    for (const s of run.module.def.sections) expect(run.snapshot().completedSectionIds).toContain(s.id);
    expect(completions).toHaveLength(1);
    run.walkChapter();
    expect(completions).toHaveLength(1);
  });

  it('every section completes exactly once during a walk', () => {
    const { run, bus } = makeRun();
    const done = record(bus, 'section:completed');
    run.walkChapter();
    const ids = done.map((d) => d.sectionId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("a walk leaves the kit sane: the old food reward is not a thing", () => {
    const { run } = makeRun();
    const before = run.player.kit.carryLimit;
    run.walkChapter();
    expect(run.player.kit.carryLimit).toBe(before);
    expect(run.player.meter.value).toBeGreaterThan(0);
  });
});

describe('rapid and edge input', () => {
  it('hammering every action in one frame does not throw or double-fire', () => {
    const { run } = makeRun();
    const all = ['interact', 'melee', 'aimHold', 'special1', 'special2', 'special3', 'special4', 'cycleWeapon', 'cycleDrink', 'openTab', 'drink', 'hint', 'callMyko', 'sneak'] as const;
    for (let i = 0; i < 200; i++) run.tick(1, frame({ pressed: [...all], released: i % 2 ? ['aimHold'] : [] }));
    expect(Number.isFinite(run.player.meter.value)).toBe(true);
    expect(run.player.kit.bottles).toBeGreaterThanOrEqual(0);
  });

  it('a huge time step after a window blur drains to 0 and returns him to the bar once, nothing breaks', () => {
    const { run, returns } = makeRun();
    run.tick(300_000, frame()); // far longer than the meter lasts
    run.tick(16, frame());
    expect(Number.isFinite(run.player.pos.x)).toBe(true);
    expect(returns).toEqual(['sober']);
    expect(run.player.meter.value).toBeCloseTo(restValue(1), 0);
  });

  it('zero and tiny time steps are harmless', () => {
    const { run } = makeRun();
    const before = run.player.meter.value;
    run.tick(0, frame());
    run.tick(0.001, frame());
    expect(run.player.meter.value).toBeCloseTo(before, 3);
  });
});
