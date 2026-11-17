/**
 * Chapter 5 and 6 systems through the run: the drone's altitude, Lock-in, Second Opinion, the umbrella, the agent,
 * Act Natural and corn in stealth, Pruitt's shelves and the combine. Built on the chapter 2 sandbox screen.
 */

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/content/tuning';
import type { ChapterModule } from '../../src/core/chapter';
import { createChapter2Sandbox } from '../../src/core/sandbox2';
import type { StealthSectionDef, Vec2 } from '../../src/core/types';
import { createKit } from '../../src/systems/kit';
import { createMeter } from '../../src/systems/meter';
import { advance, frame, makeRun, record } from './helpers';

const AT = { grand: 50, bitMuch: 75 } as const;
const T = (col: number, row: number): Vec2 => ({ x: col * 16 + 8, y: row * 16 + 8 });
const ids = <T extends { id: string }>(l: readonly T[]): string[] => l.map((x) => x.id);

/** A run on the chapter 2 sandbox with a bare kit and a quiet script. */
function bare(module?: ChapterModule) {
  const h = makeRun(module ? { module } : { module: sandbox() });
  h.run.player.setKit(createKit());
  return h;
}
const sandbox = (): ChapterModule => ({ ...createChapter2Sandbox(), createScript: undefined });

describe('drone altitude', () => {
  const swingAt = (run: ReturnType<typeof bare>['run']) => run.tick(16, frame({ pressed: ['melee'], aim: { x: 300, y: 100 } }));

  it('hovers out of melee reach, and drops while it telegraphs, fires and recovers', () => {
    const { run } = bare();
    run.setPlayerPosition({ x: 100, y: 100 });
    const d = run.spawnEnemy('drone', { x: 120, y: 100 });
    expect(d.aloft).toBe(true);
    swingAt(run);
    expect(d.health).toBe(d.stats.maxHealth);
    for (const status of ['telegraphing', 'attacking', 'recovering', 'stunned'] as const) {
      d.status = status;
      expect(d.aloft, status).toBe(false);
    }
    advance(run, 400);
    d.status = 'telegraphing';
    swingAt(run);
    expect(d.health).toBeLessThan(d.stats.maxHealth);
  });

  it('a thrown bottle reaches it at any height', () => {
    const { run } = bare();
    run.setPlayerPosition({ x: 100, y: 100 });
    const d = run.spawnEnemy('drone', { x: 200, y: 100 });
    d.pos = { x: 200, y: 100 };
    d.stationary = true;
    run.player.setKit({ ...createKit(), bottles: 1 });
    expect(d.aloft).toBe(true);
    run.tick(16, frame({ pressed: ['aimHold'], aim: { x: 200, y: 100 } }));
    run.tick(16, frame({ released: ['aimHold'], aim: { x: 200, y: 100 } }));
    advance(run, 1500);
    expect(d.health).toBeLessThan(d.stats.maxHealth);
  });

  it('shoots a slow bolt from a distance', () => {
    const { run } = bare();
    run.setPlayerPosition({ x: 100, y: 100 });
    run.spawnEnemy('drone', { x: 200, y: 100 });
    let bolt = false;
    for (let i = 0; i < 200 && !bolt; i++) {
      run.tick(16, frame());
      bolt = run.projectiles().some((p) => p.owner === 'enemy' && p.frame === 'bolt');
    }
    expect(bolt).toBe(true);
  });
});

describe('agent', () => {
  it('fires a straight dart at range and cuffs hold Andrew up close', () => {
    const a = bare();
    a.run.setPlayerPosition({ x: 100, y: 100 });
    a.run.spawnEnemy('agent', { x: 200, y: 100 });
    let dart = false;
    for (let i = 0; i < 200 && !dart; i++) {
      a.run.tick(16, frame());
      dart = a.run.projectiles().some((p) => p.owner === 'enemy' && p.frame === 'dart' && !p.shape.lobbed);
    }
    expect(dart).toBe(true);

    const b = bare();
    b.run.setPlayerPosition({ x: 100, y: 100 });
    b.run.spawnEnemy('agent', { x: 112, y: 100 });
    let held = false;
    for (let i = 0; i < 200 && !held; i++) {
      b.run.tick(16, frame());
      held = b.run.player.held;
    }
    expect(held).toBe(true);
  });

  it('comes at him from the side, not straight on', () => {
    const { run } = bare();
    run.setPlayerPosition({ x: 100, y: 100 });
    const ag = run.spawnEnemy('agent', { x: 300, y: 100 });
    let off = 0;
    for (let i = 0; i < 60; i++) {
      run.tick(16, frame());
      off = Math.max(off, Math.abs(ag.pos.y - 100));
    }
    expect(off).toBeGreaterThan(2);
  });
});

describe('Lock-in', () => {
  it('holds enemies near Andrew for the tuned time at double damage, and no one beyond', () => {
    const { run } = bare();
    run.learnMove('lockIn');
    run.player.meter = createMeter(1, AT.bitMuch);
    run.setPlayerPosition({ x: 100, y: 100 });
    const near = run.spawnEnemy('lad', { x: 130, y: 100 });
    const far = run.spawnEnemy('lad', { x: 400, y: 100 });
    run.tick(16, frame({ pressed: ['special3'] }));
    const e = TUNING.overhaul!.moves.lockIn.effect;
    if (e.kind !== 'holdAround') throw new Error('not holdAround');
    expect(near.status).toBe('stunned');
    expect(near.damageTakenMultiplier).toBe(2);
    expect(near.statusMsLeft).toBeGreaterThan(e.durationMs - 100);
    expect(far.status).not.toBe('stunned');
    advance(run, e.durationMs + 100);
    expect(near.status).not.toBe('stunned');
    expect(near.damageTakenMultiplier).toBe(1);
  });
});

describe('Second Opinion', () => {
  const strike = (marked: boolean): number => {
    const { run } = bare();
    run.learnMove('secondOpinion');
    run.player.meter = createMeter(1, AT.bitMuch);
    run.setPlayerPosition({ x: 100, y: 100 });
    const t = run.spawnEnemy('docker', { x: 125, y: 100 });
    t.stationary = true;
    if (marked) {
      run.tick(16, frame({ pressed: ['special3'] }));
      expect(run.combat.markedTargetId).toBe(t.instanceId);
    }
    const before = t.health;
    run.tick(16, frame({ pressed: ['melee'], aim: { x: 300, y: 100 } }));
    return before - t.health;
  };

  it('the next hit on the marked enemy does four times the damage, and only that one', () => {
    const plain = strike(false);
    const marked = strike(true);
    expect(plain).toBeGreaterThan(0);
    expect(marked).toBe(plain * 4);
  });

  it('a bottle spends the mark too, once', () => {
    const { run } = bare();
    run.learnMove('secondOpinion');
    run.player.meter = createMeter(1, AT.bitMuch);
    run.setPlayerPosition({ x: 100, y: 100 });
    const t = run.spawnEnemy('docker', { x: 125, y: 100 });
    t.stationary = true;
    run.tick(16, frame({ pressed: ['special3'] }));
    expect(run.combat.consumeMarkFor(t.instanceId)).toBe(4);
    expect(run.combat.consumeMarkFor(t.instanceId)).toBe(1);
  });

  it('the mark clears when its target goes down', () => {
    const { run } = bare();
    run.learnMove('secondOpinion');
    run.player.meter = createMeter(1, AT.bitMuch);
    run.setPlayerPosition({ x: 100, y: 100 });
    const t = run.spawnEnemy('lad', { x: 125, y: 100 });
    run.tick(16, frame({ pressed: ['special3'] }));
    t.knockDown();
    run.tick(16, frame());
    expect(run.combat.markedTargetId).toBeNull();
  });
});

describe('umbrella', () => {
  it('a poke goes through two enemies in line and no more', () => {
    const { run } = bare();
    run.gainWeapon('umbrella');
    run.assignWeapon('umbrella');
    run.setPlayerPosition({ x: 100, y: 100 });
    const xs = [112, 124, 136];
    const lads = xs.map((x) => {
      const l = run.spawnEnemy('lad', { x, y: 100 });
      l.stationary = true;
      return l;
    });
    run.tick(16, frame({ pressed: ['melee'], aim: { x: 300, y: 100 } }));
    expect(lads.map((l) => l.health < l.stats.maxHealth)).toEqual([true, true, false]);
  });
});

// ---------------------------------------------------------------------------
// Stealth: Act Natural and corn
// ---------------------------------------------------------------------------

function stealthModule(opts: { prop?: boolean; corn?: boolean }): ChapterModule {
  const base = createChapter2Sandbox();
  const def = base.def.stealthSections[0] as StealthSectionDef;
  const section: StealthSectionDef = {
    ...def,
    guards: [{ enemyId: 'suit', route: { mode: 'stationary', waypoints: [{ position: T(12, 3), waitMs: 0, facing: 'right' }] } }],
    hidingProps: opts.prop ? [{ id: 'board', kind: 'noticeboard', position: T(15, 3), radius: 14 }] : [],
  };
  const screen = base.screens[0]!;
  return {
    ...base,
    createScript: undefined,
    def: { ...base.def, stealthSections: [section] },
    screens: [{ ...screen, ...(opts.corn ? { corn: [{ col: 14, row: 2, width: 4, height: 3 }] } : {}) }],
  };
}

const detection = (run: ReturnType<typeof bare>['run']): number => run.stealthHere()[0]?.runner.guards[0]?.detection ?? -1;

describe('Act Natural and corn in stealth', () => {
  const setup = (opts: { prop?: boolean; corn?: boolean }) => {
    const h = bare(stealthModule(opts));
    h.run.startSection('c2.stealth.bog');
    h.run.setPlayerPosition(T(15, 3));
    return h;
  };

  it('is seen standing in the open', () => {
    const { run } = setup({});
    advance(run, 400);
    expect(detection(run)).toBeGreaterThan(0);
  });

  it('Act Natural beside a marked prop: unseen while still, seen once he moves', () => {
    const { run } = setup({ prop: true });
    run.learnMove('actNatural');
    run.player.meter = createMeter(1, AT.grand);
    run.tick(16, frame({ pressed: ['special1'] }));
    expect(run.combat.hidden).toBe(true);
    advance(run, 3000);
    expect(detection(run)).toBe(0);
    run.tick(16, frame({ move: { x: 0, y: 1 } }));
    expect(run.combat.hidden).toBe(false);
  });

  it('Act Natural refuses away from a marked prop', () => {
    const { run } = setup({ prop: true });
    run.learnMove('actNatural');
    run.player.meter = createMeter(1, AT.grand);
    run.setPlayerPosition(T(15, 6));
    run.tick(16, frame({ pressed: ['special1'] }));
    expect(run.combat.hidden).toBe(false);
    expect(run.combat.lastRefusal?.textId).toBe('ui.move.noProp');
  });

  it('standing still in standing corn hides him without the move', () => {
    const { run } = setup({ corn: true });
    advance(run, 3000);
    expect(detection(run)).toBe(0);
  });

  it('moving through corn rustles, less when sneaking', () => {
    const { run, bus } = setup({ corn: true });
    const noises = record(bus, 'stealth:noise');
    for (let i = 0; i < 30; i++) run.tick(16, frame({ move: { x: 0.2, y: 0 } }));
    expect(noises.some((n) => n.kind === 'rustle' && n.radius === TUNING.overhaul!.corn!.rustleRadius)).toBe(true);
    noises.length = 0;
    run.setPlayerPosition(T(15, 3));
    for (let i = 0; i < 30; i++) run.tick(16, frame({ move: { x: 0.2, y: 0 }, held: ['sneak'] }));
    expect(noises.some((n) => n.kind === 'rustle' && n.radius === TUNING.overhaul!.corn!.sneakRustleRadius)).toBe(true);
  });

  it('cut corn does not hide him', () => {
    const { run } = setup({ corn: true });
    expect(run.cutCorn({ x: 14 * 16, y: 2 * 16, width: 64, height: 48 })).toBe(12);
    advance(run, 1500);
    expect(detection(run)).toBeGreaterThan(0);
  });
});

describe('flying guards', () => {
  it('a drone on patrol flies over a wall', async () => {
    const { Guard } = await import('../../src/systems/stealth');
    const { gridFromAscii } = await import('../../src/systems/grid');
    const { EventBus } = await import('../../src/core/events');
    const grid = gridFromAscii(['.....#.....', '.....#.....', '.....#.....']);
    const g = new Guard(
      'drone',
      { enemyId: 'drone', route: { mode: 'pingPong', waypoints: [{ position: { x: 24, y: 24 }, waitMs: 0 }, { position: { x: 150, y: 24 }, waitMs: 0 }] } },
      TUNING.enemies.drone.senses!,
      TUNING.enemies.drone.moveSpeed,
    );
    const bus = new EventBus();
    let farthest = 0;
    for (let i = 0; i < 400; i++) {
      g.tick(16, grid, { pos: { x: 24, y: 300 }, hidden: true }, bus);
      farthest = Math.max(farthest, g.pos.x);
    }
    expect(farthest).toBeGreaterThan(100);
  });
});

// ---------------------------------------------------------------------------
// Pruitt's shelves
// ---------------------------------------------------------------------------

const LANES = [0, 1, 2, 3, 4].map((i) => ({ id: `lane${i}`, area: { x: 400 + i * 48, y: 16, width: 32, height: 144 }, travel: 'right' as const }));

function pruittModule(): ChapterModule {
  const base = createChapter2Sandbox();
  return {
    ...base,
    createScript: undefined,
    bosses: [
      {
        bossId: 'c5.boss.pruitt1',
        screenId: 'c2.sandbox',
        trigger: { kind: 'script' },
        bodies: [{ tag: 'pruitt', position: T(55, 5) }],
        shelves: { lanes: LANES },
        entrance: T(50, 8),
      },
    ],
  };
}

describe("Pruitt's shelves through the run", () => {
  it('Pruitt keeps the dart; the shelf is the crank, lit a second before, and catching Andrew is heavy', () => {
    const { run, bus } = bare(pruittModule());
    const changes = record(bus, 'shelves:changed');
    const hits = record(bus, 'player:hit');
    run.setPlayerPosition({ x: 400 + 2 * 48 + 16, y: 90 });
    run.startSection('c5.boss.pruitt1');
    const boss = run.boss('c5.boss.pruitt1')!;
    expect(boss.active).toBe(true);
    const body = boss.body('pruitt')!;
    expect(body.attacks.map((a) => a.id)).toEqual(['dart']);
    body.stationary = true;
    body.frozen = true;
    const shelf = boss.phase!.attacks.find((a) => a.id === 'shelf')!;
    const standIn = (): void => run.setPlayerPosition({ x: 400 + 2 * 48 + 16, y: 90 });
    let litAt = -1;
    let closingAt = -1;
    for (let t = 0; t < shelf.cooldownMs + 4000; t += 16) {
      standIn();
      run.tick(16, frame());
      if (litAt < 0 && changes.some((c) => c.phase === 'lit')) litAt = t;
      if (closingAt < 0 && changes.some((c) => c.phase === 'closing')) closingAt = t;
    }
    expect(changes.find((c) => c.phase === 'lit')?.laneIds).toEqual(['lane2']);
    expect(closingAt - litAt).toBeGreaterThanOrEqual(shelf.telegraphMs - 50);
    expect(closingAt - litAt).toBeLessThanOrEqual(shelf.telegraphMs + 50);
    expect(hits.some((h) => h.weight === 'heavy' && h.source.kind === 'boss')).toBe(true);
  });

  it('phase 2 closes four lanes and leaves one', () => {
    const { run, bus } = bare(pruittModule());
    const changes = record(bus, 'shelves:changed');
    run.setPlayerPosition({ x: 100, y: 100 });
    run.startSection('c5.boss.pruitt1');
    const boss = run.boss('c5.boss.pruitt1')!;
    boss.body('pruitt')!.frozen = true;
    boss.forcePhase('twoShelves');
    advance(run, 6000);
    const lit = changes.find((c) => c.phase === 'lit');
    expect(lit?.laneIds).toHaveLength(4);
    expect(ids(LANES).filter((l) => !lit?.laneIds.includes(l))).toHaveLength(1);
  });

  it('starts again after a return to the bar (no saved started flag)', () => {
    const { run, returns } = bare(pruittModule());
    run.startSection('c5.boss.pruitt1');
    expect(run.boss('c5.boss.pruitt1')!.active).toBe(true);
    run.player.meter = createMeter(1, 0.01);
    advance(run, 400);
    expect(returns.length).toBeGreaterThan(0);
    expect(run.boss('c5.boss.pruitt1')!.active).toBe(false);
    run.startSection('c5.boss.pruitt1');
    expect(run.boss('c5.boss.pruitt1')!.active).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The combine
// ---------------------------------------------------------------------------

function combineModule(): ChapterModule {
  const base = createChapter2Sandbox();
  const screen = base.screens[0]!;
  return {
    ...base,
    createScript: undefined,
    screens: [{ ...screen, corn: [{ col: 18, row: 2, width: 30, height: 7 }] }],
    bosses: [
      {
        bossId: 'c6.setpiece.combine',
        screenId: 'c2.sandbox',
        trigger: { kind: 'script' },
        bodies: [
          { tag: 'harvester', position: T(20, 6), invulnerable: true, attacks: 'none', stationary: true },
          { tag: 'light1', position: T(20, 6), stationary: true, attacks: 'none' },
          { tag: 'light2', position: T(20, 6), stationary: true, attacks: 'none' },
          { tag: 'light3', position: T(20, 6), stationary: true, attacks: 'none' },
        ],
        combine: {
          lights: [
            { tag: 'light1', offset: { x: -8, y: -6 } },
            { tag: 'light2', offset: { x: 0, y: -6 } },
            { tag: 'light3', offset: { x: 8, y: -6 } },
          ],
          lanes: [
            { id: 'laneA', axis: 'horizontal', at: 48, from: 300, to: 700 },
            { id: 'laneB', axis: 'horizontal', at: 96, from: 300, to: 700 },
          ],
          escortPoints: [T(58, 1), T(58, 2)],
          ditchPath: [{ x: 340, y: 60 }, { x: 360, y: 70 }],
        },
        entrance: T(50, 8),
      },
    ],
  };
}

describe('the combine through the run', () => {
  const ID = 'c6.setpiece.combine' as const;

  it('plume, then the pass; the lane is a worst hit that throws him clear; it cuts corn; the lights are reachable only while it passes', () => {
    const { run, bus } = bare(combineModule());
    const changes = record(bus, 'combine:changed');
    const cuts = record(bus, 'corn:cut');
    const hits = record(bus, 'player:hit');
    run.startSection(ID);
    const boss = run.boss(ID)!;
    expect(boss.active).toBe(true);
    expect(boss.addsAlive()).toBe(2);
    const light = boss.body('light1')!;
    expect(light.aloft).toBe(true);
    const pass = boss.phase!.attacks.find((a) => a.id === 'pass')!;
    let plumeAt = -1;
    let passAt = -1;
    let reachableDuringPass = false;
    for (let t = 0; t < pass.cooldownMs + pass.telegraphMs + 3000; t += 16) {
      run.setPlayerPosition({ x: 500, y: 96 });
      run.tick(16, frame());
      if (plumeAt < 0 && changes.some((c) => c.phase === 'plume')) plumeAt = t;
      if (passAt < 0 && changes.some((c) => c.phase === 'pass')) passAt = t;
      if (changes.some((c) => c.phase === 'pass') && !changes.some((c) => c.phase === 'passEnded')) reachableDuringPass ||= !light.aloft;
    }
    expect(changes.find((c) => c.phase === 'plume')?.laneId).toBe('laneB');
    expect(Math.abs(passAt - plumeAt - pass.telegraphMs)).toBeLessThanOrEqual(32);
    expect(hits.some((h) => h.weight === 'worst')).toBe(true);
    expect(changes.some((c) => c.phase === 'caught')).toBe(true);
    expect(reachableDuringPass).toBe(true);
    expect(cuts.length).toBeGreaterThan(0);
    expect(run.corn.isStanding('c2.sandbox', 25, 6)).toBe(false);
    expect(light.aloft).toBe(true);
  });

  it('throws a bale on a shadow marker', () => {
    const { run, bus } = bare(combineModule());
    const changes = record(bus, 'combine:changed');
    run.startSection(ID);
    for (let t = 0; t < 8000 && !changes.some((c) => c.phase === 'baleLanded'); t += 16) {
      run.setPlayerPosition({ x: 500, y: 140 });
      run.tick(16, frame());
    }
    const marker = changes.find((c) => c.phase === 'baleMarker');
    expect(marker?.position).toBeDefined();
    expect(changes.some((c) => c.phase === 'baleLanded')).toBe(true);
  });

  it('with all three lights out it ends and drives into the ditch', () => {
    const { run, bus } = bare(combineModule());
    const changes = record(bus, 'combine:changed');
    run.startSection(ID);
    const boss = run.boss(ID)!;
    for (const tag of ['light1', 'light2', 'light3']) boss.body(tag)!.knockDown();
    run.setPlayerPosition({ x: 300, y: 140 });
    advance(run, 8000);
    expect(boss.isComplete()).toBe(true);
    expect(changes.filter((c) => c.phase === 'lightOut')).toHaveLength(3);
    expect(changes.some((c) => c.phase === 'ditching')).toBe(true);
    expect(changes.some((c) => c.phase === 'ditched')).toBe(true);
  });

  it('completeNow (the Myko call) ends it and parks the harvester in the ditch', () => {
    const { run, bus } = bare(combineModule());
    const changes = record(bus, 'combine:changed');
    run.startSection(ID);
    run.completeSection(ID, 'myko');
    advance(run, 3000);
    const boss = run.boss(ID)!;
    expect(boss.isComplete()).toBe(true);
    expect(changes.some((c) => c.phase === 'ditched')).toBe(true);
  });

  it('starts again after a return to the bar, with the corn regrown', () => {
    const { run, returns } = bare(combineModule());
    run.startSection(ID);
    run.cutCorn({ x: 300, y: 32, width: 200, height: 100 });
    expect(run.corn.isStanding('c2.sandbox', 25, 4)).toBe(false);
    run.player.meter = createMeter(1, 0.01);
    advance(run, 400);
    expect(returns.length).toBeGreaterThan(0);
    expect(run.corn.isStanding('c2.sandbox', 25, 4)).toBe(true);
    run.startSection(ID);
    expect(run.boss(ID)!.active).toBe(true);
  });
});
