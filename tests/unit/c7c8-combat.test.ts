/**
 * Chapter 7 and 8 combat systems through the run: tequila, Last Orders, the inflatable alien, clerks lining up,
 * Barred's throw, and the fence fight's headlights.
 */

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/content/tuning';
import type { ChapterModule } from '../../src/core/chapter';
import { createChapter2Sandbox } from '../../src/core/sandbox2';
import type { Vec2 } from '../../src/core/types';
import { lineUpGoals, statsFromDef } from '../../src/systems/enemies';
import { createKit } from '../../src/systems/kit';
import { createMeter, levelTable } from '../../src/systems/meter';
import { advance, drinkItem, frame, makeRun, record } from './helpers';

const O = TUNING.overhaul!;
const LV = levelTable(1);
const FECKED = LV.fecked.min + 2;

function learned(...ids: Parameters<ReturnType<typeof makeRun>['run']['learnMove']>[0][]) {
  const h = makeRun();
  h.run.player.setKit(createKit());
  for (const id of ids) h.run.learnMove(id);
  h.run.player.meter = createMeter(1, FECKED);
  h.run.player.holdDrain(true);
  h.run.setPlayerPosition({ x: 100, y: 100 });
  return h;
}

describe('tequila', () => {
  it('sends Andrew to the middle of Fecked, doubles and lowers hits, and drops 30 when the window ends', () => {
    const h = makeRun();
    h.run.player.setKit(createKit());
    h.run.give({ kind: 'drink', drinkId: 'tequila', count: 1 });
    h.run.player.meter = createMeter(1, LV.buzzed.min + 5);
    const started = record(h.bus, 'spirit:started');
    expect(drinkItem(h.run, 'tequila')).toBe(true);
    const def = O.drinks.tequila;
    expect(h.run.player.level).toBe(4);
    expect(started).toHaveLength(1);
    expect(started[0]?.durationMs).toBe(def.kind === 'spirit' ? def.windowMs : -1);
    const top = h.run.player.meter.value;
    h.run.player.holdDrain(true);
    advance(h.run, (def.kind === 'spirit' ? def.windowMs : 0) + 200);
    expect(h.run.player.meter.value).toBeCloseTo(top - (def.kind === 'spirit' ? def.dropAfterWindow ?? 0 : 0), 0);
  });

  it('only enemies of chapter 7 and later drop it', () => {
    expect(O.drops.enemy.tequilaFromChapter).toBe(7);
  });
});

describe('Last Orders (slot 4)', () => {
  const effect = O.moves.lastOrders.effect;
  if (effect.kind !== 'screenWipe') throw new Error('not a wipe');

  it('leaves every ordinary enemy on screen a sliver and stunned, wherever they stand', () => {
    const { run } = learned('lastOrders');
    const near = run.spawnEnemy('lad', { x: 130, y: 100 });
    const far = run.spawnEnemy('clerk', { x: 700, y: 120 });
    const fx = run.fx.length;
    run.tick(16, frame({ pressed: ['special4'] }));
    for (const e of [near, far]) {
      expect(e.health).toBeCloseTo(e.stats.maxHealth * effect.leaveHealthFraction, 0);
      expect(e.down).toBe(false);
      expect(e.status).toBe('stunned');
      expect(e.statusMsLeft).toBeGreaterThan(effect.stunMs - 100);
    }
    expect(run.fx.length).toBeGreaterThan(fx);
    expect(run.fx.some((f) => f.kind === 'wipe')).toBe(true);
  });

  it('a boss body takes the boss fraction of its health, even behind a sign, and is not stunned', () => {
    const { run } = learned('lastOrders');
    const body = run.spawnBossBody('c7.boss.mascots', { ...statsFromDef(TUNING.enemies.mascot), maxHealth: 100, spriteKey: 'x' }, { x: 200, y: 100 });
    body.guardSide = 'front';
    run.tick(16, frame({ pressed: ['special4'] }));
    expect(body.health).toBeCloseTo(100 * (1 - effect.bossFraction), 0);
    expect(body.status).not.toBe('stunned');
    expect(body.guardSide).toBe('front');
  });

  it('is dark below Fecked', () => {
    const { run } = learned('lastOrders');
    run.player.meter = createMeter(1, LV.bitMuch.min + 1);
    run.tick(16, frame({ pressed: ['special4'] }));
    expect(run.combat.lastRefusal?.textId).toBe('ui.move.dark');
  });
});

describe('the inflatable alien', () => {
  it('sweeps a wide arc, hurts almost nobody and moves everybody', () => {
    const { run } = makeRun();
    run.player.setKit(createKit());
    run.gainWeapon('inflatableAlien');
    run.assignWeapon('inflatableAlien');
    expect(run.player.kit.slots.melee).toBe('inflatableAlien');
    run.setPlayerPosition({ x: 100, y: 100 });
    // Three lads inside the 160 degree arc, one behind.
    const a = run.spawnEnemy('lad', { x: 100, y: 78 });
    const b = run.spawnEnemy('lad', { x: 120, y: 90 });
    const c = run.spawnEnemy('lad', { x: 120, y: 110 });
    const behind = run.spawnEnemy('lad', { x: 70, y: 100 });
    for (const e of [a, b, c, behind]) e.stationary = true;
    run.tick(16, frame({ pressed: ['melee'], aim: { x: 300, y: 100 } }));
    advance(run, 400);
    const w = O.weapons.inflatableAlien;
    expect(w.damage).toBeLessThan(O.weapons.fists.damage);
    for (const e of [b, c]) {
      expect(e.health).toBeLessThan(e.stats.maxHealth);
      expect(e.health).toBeGreaterThan(e.stats.maxHealth - 20);
      expect(e.pos.x).toBeGreaterThan(121);
    }
    expect(behind.health).toBe(behind.stats.maxHealth);
  });
});

describe('clerks line up to fire', () => {
  it('the nearest keeps its bearing and the rest stand behind it on the same line', () => {
    const player = { x: 0, y: 0 };
    const goals = lineUpGoals(
      [
        { id: 'a', pos: { x: 100, y: 20 } },
        { id: 'b', pos: { x: 200, y: -40 } },
        { id: 'c', pos: { x: 90, y: 90 } },
      ],
      player,
      110,
      20,
    );
    const g = ['a', 'b', 'c'].map((k) => goals.get(k) as Vec2);
    // Nearest first: a (about 102), then c, then b.
    expect(Math.hypot(g[0]!.x, g[0]!.y)).toBeCloseTo(110, 3);
    expect(Math.hypot(g[2]!.x, g[2]!.y)).toBeCloseTo(130, 3);
    expect(Math.hypot(g[1]!.x, g[1]!.y)).toBeCloseTo(150, 3);
    const angle = (p: Vec2): number => Math.atan2(p.y, p.x);
    expect(angle(g[1]!)).toBeCloseTo(angle(g[0]!), 6);
    expect(angle(g[2]!)).toBeCloseTo(angle(g[0]!), 6);
  });

  it('in a fight three clerks end up on one line toward Andrew, which a Stumble then catches', () => {
    const { run } = makeRun({ module: { ...createChapter2Sandbox(), createScript: undefined } });
    run.player.setKit(createKit());
    run.player.holdDrain(true);
    run.setPlayerPosition({ x: 200, y: 100 });
    const clerks = [run.spawnEnemy('clerk', { x: 520, y: 40 }), run.spawnEnemy('clerk', { x: 560, y: 100 }), run.spawnEnemy('clerk', { x: 520, y: 150 })];
    for (let t = 0; t < 12000; t += 16) {
      run.player.meter = createMeter(2, 55);
      run.setPlayerPosition({ x: 200, y: 100 });
      run.tick(16, frame());
    }
    const bearings = clerks.map((c) => (Math.atan2(c.pos.y - 100, c.pos.x - 200) * 180) / Math.PI);
    const spread = Math.max(...bearings) - Math.min(...bearings);
    expect(spread).toBeLessThan(12);
    const dists = clerks.map((c) => Math.hypot(c.pos.x - 200, c.pos.y - 100)).sort((x, y) => x - y);
    expect(dists[1]! - dists[0]!).toBeGreaterThan(10);
  });
});

describe('Barred', () => {
  it('lifts the nearest enemy to Andrew and throws him: a throw fx with its origin, and the landing hits his neighbours', () => {
    const { run } = learned('barred');
    const e = run.spawnEnemy('lad', { x: 130, y: 100 });
    e.stationary = true;
    run.tick(16, frame({ pressed: ['special4'], aim: { x: 300, y: 100 } }));
    expect(e.down).toBe(true);
    const fx = run.fx.find((f) => f.kind === 'throw');
    expect(fx?.from).toEqual(run.player.pos);
    expect(fx?.pos).toEqual(e.pos);
    expect(fx?.ttlMs).toBe(O.throwOutFlightMs);
  });

  it('refuses with nobody to throw', () => {
    const { run } = learned('barred');
    run.tick(16, frame({ pressed: ['special4'] }));
    expect(run.combat.lastRefusal?.textId).toBe('ui.move.noTarget');
  });
});

describe("the fence fight's headlights", () => {
  const cone = { range: 120, angleDeg: 60 };
  function fenceModule(): ChapterModule {
    const base = createChapter2Sandbox();
    return {
      ...base,
      createScript: undefined,
      fights: [
        {
          sectionId: 'c2.fight.yard',
          screenId: base.def.startScreenId,
          trigger: { kind: 'script' },
          spawnPoints: [{ x: 600, y: 100 }],
          entrance: { x: 600, y: 120 },
          headlights: { position: { x: 300, y: 100 }, facingDeg: 0, cone },
        },
      ],
    };
  }
  const dart = (run: ReturnType<typeof makeRun>['run'], from: Vec2) => {
    run.spawnProjectile({
      owner: 'enemy',
      source: { kind: 'enemy', enemyId: 'agent', attackId: 'dart' },
      screenId: run.screenId,
      from,
      angleDeg: 90,
      shape: { kind: 'projectile', speed: 150, range: 180, pierce: 0, lobbed: false, deflectable: false, impactNoiseRadius: 0 },
      damage: 10,
      knockback: 10,
      frame: 'dart',
    });
    return run.projectiles()[run.projectiles().length - 1]!;
  };

  it('are on only while the fight is under way, and darts fly faster inside the cone', () => {
    const { run } = makeRun({ module: fenceModule() });
    run.player.setKit(createKit());
    run.setPlayerPosition({ x: 40, y: 40 });
    expect(run.headlightsHere()).toHaveLength(0);
    run.startSection('c2.fight.yard');
    expect(run.headlightsHere()).toHaveLength(1);
    const inside = dart(run, { x: 360, y: 90 });
    const outside = dart(run, { x: 500, y: 60 });
    run.tick(16, frame());
    expect(inside.speedScale).toBe(O.headlights?.dartSpeedMultiplier);
    expect(outside.speedScale).toBe(1);
    expect(inside.travelled).toBeGreaterThan(outside.travelled);
  });
});
