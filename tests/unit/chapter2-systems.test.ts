/** Chapter 2's systems on the sandbox (src/core/sandbox2.ts): bar, stealth, Stumble, sheep gates, the ram. */

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/content/tuning';
import { createChapter2Sandbox } from '../../src/core/sandbox2';
import { carryOver } from '../../src/systems/session';
import { createMeter } from '../../src/systems/meter';
import { advance, frame, makeRun, placeAt, record } from './helpers';

const mk = (opts: Parameters<typeof makeRun>[0] = {}) => makeRun({ module: createChapter2Sandbox(), chapter: 2, ...opts });
const at = placeAt;

describe('chapter 2 sandbox: bar and kit', () => {
  it('starts in the lean-to with a hot drink on offer and a bottle', () => {
    const { run } = mk();
    expect(run.screenId).toBe('c2.sandbox');
    expect(run.hotDrinkOffered()).toBe(true);
    expect(run.takeHotDrink('tea')).toBe(true);
    expect(run.player.kit.hotDrink).toBe('tea');
    const carried = carryOver(run.snapshot(), 'grand', createChapter2Sandbox());
    expect(carried.kit.bottles).toBe(TUNING.overhaul!.carry.bottleLimit);
    expect(run.player.level).toBe(2);
  });
});

describe('chapter 2 sandbox: stealth', () => {
  it('script starts the section; guards exist only then; caught -> alarm fight; return resets; clean run gives the lanyard', () => {
    const { run, bus } = mk();
    const alarms = record(bus, 'stealth:alarm');
    expect(run.guardsHere()).toHaveLength(0);
    at(run, 11, 8);
    advance(run, 64);
    expect(run.guardsHere()).toHaveLength(1);
    // Stand in the guard's way until the detection fills.
    const g = run.guardsHere()[0]!;
    at(run, Math.floor(g.pos.x / 16) + 2, Math.floor(g.pos.y / 16));
    for (let i = 0; i < 200 && alarms.length === 0; i++) {
      run.player.pos = { x: g.pos.x + 24, y: g.pos.y };
      g.facingDeg = 0;
      run.tick(16, frame());
    }
    expect(alarms).toHaveLength(1);
    expect(run.fight('c2.stealth.bog.alarm' as never)).not.toBeNull();
    // Sober during the alarm fight: back to the bar, the section starts over, no fight left.
    run.player.meter = createMeter(2, 0.01);
    advance(run, 100);
    expect(run.screenId).toBe('c2.sandbox');
    expect(run.player.pos).toEqual(run.module.def.bar!.arrival);
    expect(run.guardsHere()).toHaveLength(0);
    expect(run.isComplete('c2.stealth.bog')).toBe(false);
    // Again, clean this time.
    at(run, 11, 8);
    advance(run, 64);
    expect(run.guardsHere()).toHaveLength(1);
    const lanyards = record(bus, 'evidence:found');
    at(run, 27, 8);
    advance(run, 32);
    expect(run.isComplete('c2.stealth.bog')).toBe(true);
    expect(lanyards.map((l) => l.evidenceId)).toContain('c2.clue.lanyard');
    expect(run.guardsHere()).toHaveLength(0);
  });

  it('a thrown bottle draws the guard to look', () => {
    const { run } = mk();
    at(run, 11, 8);
    advance(run, 64);
    const g = run.guardsHere()[0]!;
    run.emitNoise({ kind: 'bottle', position: { x: g.pos.x + 30, y: g.pos.y + 30 }, radius: 90 });
    expect(g.alert).toBe('investigating');
  });
});

describe('chapter 2 sandbox: The Stumble', () => {
  it('breaks the feed buckets in its lane and is not blocked by them', () => {
    const { run } = mk();
    run.player.meter = { ...run.player.meter, value: 75 };
    run.tick(16, frame());
    expect(run.player.level).toBe(3);
    expect(run.player.kit.slots.specials[2]).toBe('stumble');
    at(run, 20, 5);
    run.tick(16, frame({ aim: { x: 400, y: 5 * 16 + 8 } }));
    const broken = record(run.bus, 'prop:broken');
    const hooks: string[] = [];
    run.onMoveHit({ x: 24 * 16, y: 5 * 16, width: 32, height: 16 }, (h) => hooks.push(h.moveId));
    run.tick(16, frame({ pressed: ['special3'], aim: { x: 400, y: 5 * 16 + 8 } }));
    expect(broken.map((b) => b.propId).sort()).toEqual(['yard.bucket1', 'yard.bucket2']);
    expect(hooks).toEqual(['stumble']);
    expect(run.player.pos.x).toBeGreaterThan(24 * 16);
  });
});

describe('chapter 2 sandbox: sheep puzzle', () => {
  it('flock herded east through three gates into the far pen; solved; returns keep it', () => {
    const { run, bus } = mk();
    const done = record(bus, 'section:completed');
    const sheep = () => (run.sheepPuzzlesHere()[0]?.puzzle ?? null)!;
    expect(sheep().sheep()).toHaveLength(3);
    const herd = (toCol: number): void => {
      // A person herds one sheep at a time: stand opposite the gap so it walks to it.
      for (let i = 0; i < 1500; i++) {
        const laggard = sheep().sheep().filter((x) => x.pos.x < toCol * 16).sort((m, n) => m.pos.x - n.pos.x)[0];
        if (!laggard) return;
        const target = { x: toCol * 16 + 8, y: 5 * 16 + 8 };
        const d = { x: target.x - laggard.pos.x, y: target.y - laggard.pos.y };
        const len = Math.hypot(d.x, d.y) || 1;
        run.player.pos = { x: laggard.pos.x - (d.x / len) * 14, y: laggard.pos.y - (d.y / len) * 14 };
        run.tick(50, frame());
      }
    };
    const swing = (id: string, col: number): void => {
      at(run, col, 2);
      run.tick(16, frame({ pressed: ['interact'] }));
      expect(sheep().gatePosition(id)).toBe(1);
    };
    // Gate A closed: the flock jams against it.
    herd(33);
    expect(sheep().sheep().every((s) => s.pos.x < 34 * 16)).toBe(true);
    expect(sheep().isComplete()).toBe(false);
    // Part-way, the run's current section is the puzzle (Myko call target).
    expect(run.currentCompletable()?.sectionId).toBe('c2.puzzle.sheep');
    swing('gateA', 33);
    herd(35);
    swing('gateB', 36);
    herd(38);
    swing('gateC', 39);
    herd(41);
    for (let i = 0; i < 100 && !sheep().isComplete(); i++) {
      run.player.pos = { x: 38 * 16, y: 5 * 16 + 8 };
      run.tick(50, frame());
    }
    expect(sheep().gateChanges).toBe(3);
    expect(sheep().isComplete()).toBe(true);
    expect(done.some((d) => d.sectionId === 'c2.puzzle.sheep')).toBe(true);
  });

  it('a gate closes on a sheep by nudging it out; an unsolved puzzle keeps its state across a return to the bar', () => {
    const { run } = mk();
    const p = run.sheepPuzzlesHere()[0]!.puzzle;
    p.toggleGate('gateA');
    expect(p.gatePosition('gateA')).toBe(1);
    // A sheep stands in the gap; closing A still works and the sheep is put to one side.
    p.sheep()[0]!.pos = { x: 34 * 16 + 8, y: 5 * 16 + 8 };
    expect(p.toggleGate('gateA')).toBe(true);
    expect(p.gatePosition('gateA')).toBe(0);
    expect(Math.floor(p.sheep()[0]!.pos.x / 16)).not.toBe(34);
    p.toggleGate('gateA');
    run.player.meter = createMeter(2, 0.01);
    advance(run, 100);
    expect(p.gatePosition('gateA')).toBe(1);
  });

  it('completeNow (Myko call) puts everything in the solved state', () => {
    const { run } = mk();
    const p = run.sheepPuzzlesHere()[0]!.puzzle;
    p.completeNow('myko');
    expect(p.isComplete()).toBe(true);
    expect(p.flockPenned()).toBe(true);
  });
});

describe('chapter 2 sandbox: the ram', () => {
  it('invulnerable, stops for a bottle, will not cross the cattle grid, slow puddle, gate opens with E, return restarts it', () => {
    const { run, bus } = mk();
    const done = record(bus, 'section:completed');
    // Puddle slows Andrew.
    at(run, 13, 16);
    const x0 = run.player.pos.x;
    run.tick(100, frame({ move: { x: 1, y: 0 } }));
    const normal = run.player.pos.x - x0;
    at(run, 15, 16);
    const x1 = run.player.pos.x;
    run.tick(100, frame({ move: { x: 1, y: 0 } }));
    const slowed = run.player.pos.x - x1;
    expect(slowed).toBeCloseTo(normal * TUNING.overhaul!.slowGroundMultiplier!, 5);

    // Start the run.
    at(run, 12, 16);
    advance(run, 32);
    const boss = run.boss('c2.setpiece.ram')!;
    expect(boss.active).toBe(true);
    const ram = boss.body('ram')!;
    expect(ram.invulnerable).toBe(true);
    // A bottle that lands near the ram stops it for 1500 ms.
    run.emitNoise({ kind: 'bottle', position: { x: ram.pos.x + 20, y: ram.pos.y }, radius: 90 });
    expect(ram.looking).toBe(true);
    const px0 = ram.pos.x;
    advance(run, 1000);
    expect(ram.pos.x).toBe(px0);
    advance(run, 700);
    expect(ram.looking).toBe(false);

    // Run: Andrew blocked by the lane gate until E.
    run.player.meter = { ...run.player.meter, value: 60 };
    const runTo = (col: number): void => {
      for (let i = 0; i < 400 && run.player.pos.x < col * 16; i++) {
        run.player.meter = { ...run.player.meter, value: Math.max(run.player.meter.value, 45) };
        run.tick(16, frame({ move: { x: 1, y: 0 } }));
      }
    };
    run.setPlayerPosition({ x: 22 * 16, y: 16 * 16 + 8 });
    // The ram now batters a shut gate open after a pause (bossBreaksAfterMs), so hold it with a bottle while Andrew tests the gate.
    run.emitNoise({ kind: 'bottle', position: { x: ram.pos.x + 10, y: ram.pos.y }, radius: 90 });
    for (let i = 0; i < 70; i++) run.tick(16, frame({ move: { x: 1, y: 0 } }));
    expect(run.player.pos.x).toBeLessThan(30 * 16);
    at(run, 29, 16);
    run.tick(16, frame({ pressed: ['interact'] }));
    runTo(55);
    expect(run.player.pos.x).toBeGreaterThan(53 * 16);
    // The ram cannot cross the grid and the exit completes the set piece.
    advance(run, 3000);
    expect(ram.pos.x).toBeLessThan(52 * 16);
    at(run, 57, 16);
    advance(run, 32);
    expect(boss.isComplete()).toBe(true);
    expect(done.some((d) => d.sectionId === 'c2.setpiece.ram')).toBe(true);
  });

  it('sober mid-run: back at the bar and the set piece starts over', () => {
    const { run } = mk();
    at(run, 12, 16);
    advance(run, 32);
    const boss = run.boss('c2.setpiece.ram')!;
    expect(boss.active).toBe(true);
    run.player.meter = createMeter(2, 0.01);
    advance(run, 100);
    expect(boss.active).toBe(false);
    expect(run.actors()).toHaveLength(0);
    at(run, 12, 16);
    advance(run, 32);
    expect(boss.active).toBe(true);
    expect(run.actors().filter((a) => !a.down)).toHaveLength(1);
  });

  it('a butt is a heavy hit', () => {
    const atk = TUNING.bosses['c2.setpiece.ram'].phases[0]!.attacks[0]!;
    expect(atk.weight).toBe('heavy');
  });

  it('camera lead', () => {
    const { run } = mk();
    expect(run.cameraLead()).toEqual({ x: 0, y: 0 });
    run.setCameraLead('right');
    expect(run.cameraLead().x).toBe(TUNING.overhaul!.cameraLeadPx);
  });

  it('Myko call on the set piece works', () => {
    const { run } = mk();
    at(run, 12, 16);
    advance(run, 32);
    run.completeCurrent();
    expect(run.boss('c2.setpiece.ram')!.isComplete()).toBe(true);
  });
});
