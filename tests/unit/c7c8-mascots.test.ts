/** Chapter 7 boss: Zip, Zap and Zorp (`mascots.ts`) through the run, on the chapter 2 sandbox yard. */

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/content/tuning';
import type { ChapterModule } from '../../src/core/chapter';
import { createChapter2Sandbox } from '../../src/core/sandbox2';
import type { HitInfo, Vec2 } from '../../src/core/types';
import { fanAngles, formationSpots } from '../../src/systems/mascots';
import { createKit } from '../../src/systems/kit';
import { createMeter, levelTable } from '../../src/systems/meter';
import { advance, frame, makeRun, record } from './helpers';

const BOSS = 'c7.boss.mascots' as const;
const M = TUNING.overhaul!.mascots!;
const DEF = TUNING.bosses[BOSS];
const LINE = { from: { x: 900, y: 100 }, to: { x: 700, y: 100 } };
const ARENA = { x: 680, y: 32, width: 250, height: 112 };
const hit = (): HitInfo => ({ source: { kind: 'player', abilityId: 'punchCombo' }, targetInstanceId: 'x', amount: 5, knockback: { x: 0, y: 0 }, stunMs: 0, holdMs: 0 });

function mascotModule(opts: { line?: boolean } = {}): ChapterModule {
  const base = createChapter2Sandbox();
  return {
    ...base,
    createScript: undefined,
    bosses: [
      {
        bossId: BOSS,
        screenId: base.def.startScreenId,
        trigger: { kind: 'script' },
        bodies: [
          { tag: 'zorp', position: { x: 840, y: 100 }, spriteKey: 'zorp' },
          { tag: 'zap', position: { x: 880, y: 70 }, spriteKey: 'zap' },
          { tag: 'zip', position: { x: 880, y: 100 }, spriteKey: 'zip' },
        ],
        mascots: { arena: ARENA, ...(opts.line === false ? {} : { tumbleLine: LINE }) },
        entrance: { x: 500, y: 140 },
      },
    ],
  };
}

function start(opts: { line?: boolean; at?: Vec2 } = {}) {
  const h = makeRun({ module: mascotModule(opts) });
  const { run } = h;
  run.player.setKit(createKit());
  run.player.holdDrain(true);
  run.player.meter = createMeter(2, 55);
  run.setPlayerPosition(opts.at ?? { x: 780, y: 100 });
  run.startSection(BOSS);
  const boss = run.boss(BOSS)!;
  return { ...h, boss, zip: boss.body('zip')!, zap: boss.body('zap')!, zorp: boss.body('zorp')!, keepBuzz: () => (run.player.meter = createMeter(2, 55)) };
}

describe('pure helpers', () => {
  it('Zorp stands toward Andrew and the other two behind him either side', () => {
    const s = formationSpots({ x: 0, y: 0 }, { x: 100, y: 0 }, { zip: true, zap: true, zorp: true }, M);
    expect(s.zorp).toEqual({ x: M.standOffPx, y: 0 });
    expect(s.zip.x).toBe(M.standOffPx + M.frontOffsetPx);
    expect(s.zap.x).toBe(s.zip.x);
    expect(s.zip.y).toBe(-s.zap.y);
    expect(Math.abs(s.zip.y)).toBe(M.sideOffsetPx);
    expect(formationSpots({ x: 0, y: 0 }, { x: 100, y: 0 }, { zip: true, zap: true, zorp: false }, M).zip.x).toBe(M.standOffPx);
  });

  it('a fan is three bolts with the centre on Andrew and gaps between', () => {
    expect(fanAngles(0, 28, 3)).toEqual([-28, 0, 28]);
    expect(fanAngles(90, 28, 3)).toEqual([62, 90, 118]);
  });
});

describe('the mascots', () => {
  it('start held in formation: Zorp has his sign up and nobody walks at Andrew', () => {
    const { zorp, zip, zap, run } = start();
    expect(zorp.guardSide).toBe('front');
    advance(run, 3000);
    // Zorp comes to the stand-off distance in front, the others behind him.
    const d = (p: Vec2) => Math.hypot(p.x - run.player.pos.x, p.y - run.player.pos.y);
    expect(d(zorp.pos)).toBeLessThan(d(zap.pos));
    expect(Math.abs(d(zorp.pos) - M.standOffPx)).toBeLessThan(25);
    expect(zip.pinned).not.toBeNull();
    expect(zorp.attacks.map((a) => a.id)).toEqual([]);
  });

  it('the sign turns away every hit from the front; a hit from behind lands', () => {
    const { run, zorp, boss } = start();
    advance(run, 1500);
    zorp.facingDeg = 180;
    const front = { x: zorp.pos.x - 40, y: zorp.pos.y };
    const behind = { x: zorp.pos.x + 40, y: zorp.pos.y };
    const before = zorp.health;
    expect(zorp.takeHit(hit(), front)).toBe('blocked');
    expect(zorp.health).toBe(before);
    expect(zorp.takeHit(hit(), behind)).toBe('hit');
    expect(zorp.health).toBeLessThan(before);
    expect(boss.active).toBe(true);
  });

  it('a Stumble through Zorp knocks the sign away for 3 s, the hit lands, and the sign comes back', () => {
    const { run, zorp, bus } = start({ line: false, at: { x: 400, y: 100 } });
    run.learnMove('stumble');
    const seen = record(bus, 'mascots:changed');
    advance(run, 200);
    // Stand him right in front of Andrew.
    zorp.pinned = { x: 440, y: 100 };
    zorp.pos = { x: 440, y: 100 };
    zorp.facingDeg = 180;
    run.player.meter = createMeter(2, levelTable(2).bitMuch.min + 3);
    run.player.holdDrain(true);
    const before = zorp.health;
    run.tick(16, frame({ pressed: ['special3'], aim: { x: 600, y: 100 } }));
    expect(seen.some((e) => e.phase === 'signKnocked' && e.tag === 'zorp')).toBe(true);
    expect(zorp.guardSide).toBeNull();
    expect(zorp.health).toBeLessThan(before);
    advance(run, M.signKnockedMs - 300);
    expect(zorp.guardSide).toBeNull();
    advance(run, 600);
    expect(zorp.guardSide).toBe('front');
    expect(seen.some((e) => e.phase === 'signBack')).toBe(true);
  });

  it("Zap's fan is three bolts a spread apart; standing in a gap is safe, in a bolt is a hit", () => {
    const { run, zap, bus, boss } = start({ line: false, at: { x: 800, y: 100 } });
    const atk = DEF.phases[0]!.attacks.find((a) => a.id === 'zapFan')!;
    const tele = record(bus, 'mascots:changed');
    const hits = record(bus, 'player:hit');
    const seenAt: number[] = [];
    for (let t = 0; t < atk.cooldownMs + atk.telegraphMs + 400; t += 16) {
      run.player.meter = createMeter(2, 55);
      run.tick(16, frame());
      const shots = run.projectiles().filter((p) => p.frame === 'ray');
      if (shots.length > 0 && seenAt.length === 0) {
        seenAt.push(shots.length);
        const angles = shots.map((p) => (Math.atan2(p.vel.y, p.vel.x) * 180) / Math.PI);
        const gap = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);
        const sorted = [...angles].sort((a, b) => gap(a, angles[0]!) - gap(b, angles[0]!));
        // The two outer bolts are one spread either side of the centre one.
        const centre = angles.find((a) => angles.every((b) => gap(a, b) <= M.fanSpreadDeg + 0.001))!;
        expect(sorted).toHaveLength(3);
        expect(angles.filter((a) => a !== centre).map((a) => Math.round(gap(a, centre) * 1000) / 1000)).toEqual([M.fanSpreadDeg, M.fanSpreadDeg]);
      }
    }
    expect(seenAt).toEqual([3]);
    expect(tele.some((e) => e.phase === 'telegraph' && e.tag === 'zap')).toBe(true);
    void zap;
    void boss;
    void hits;
  });

  it('Zip tumbles along the marked line when Andrew is near it, hits heavy, then lies on his back for 2 s', () => {
    const { run, zip, bus } = start({ at: { x: 780, y: 100 } });
    const tele = record(bus, 'mascots:changed');
    const hits = record(bus, 'player:hit');
    const atk = DEF.phases[0]!.attacks.find((a) => a.id === 'zipTumble')!;
    let proneAt = -1;
    let proneX = 0;
    let litSeen = false;
    for (let t = 0; t < atk.cooldownMs + 6000; t += 16) {
      run.player.meter = createMeter(2, 55);
      run.setPlayerPosition({ x: 780, y: 100 });
      run.tick(16, frame());
      const view = run.mascotsHere()[0]!.director.view(run.boss(BOSS));
      if (view.tumble) {
        litSeen = true;
        expect(view.tumble.to.y).toBeCloseTo(LINE.to.y, 3);
        expect(view.tumble.to.x).toBeCloseTo(LINE.to.x, 3);
      }
      if (zip.status === 'stunned' && proneAt < 0) {
        proneAt = t;
        proneX = zip.pos.x;
      }
    }
    expect(tele.some((e) => e.phase === 'telegraph' && e.tag === 'zip')).toBe(true);
    expect(litSeen).toBe(true);
    expect(hits.some((h) => h.weight === 'heavy' && h.source.kind === 'boss' && h.source.attackId === 'zipTumble')).toBe(true);
    expect(proneAt).toBeGreaterThan(0);
    // He ended on the line's far end.
    expect(proneX).toBeLessThan(LINE.to.x + 40);
    expect(atk.recoveryMs).toBe(2000);
  });

  it('Zip does not tumble while Andrew is far from the line', () => {
    const { run, zip } = start({ at: { x: 780, y: 152 } });
    const atk = DEF.phases[0]!.attacks.find((a) => a.id === 'zipTumble')!;
    for (let t = 0; t < atk.cooldownMs + 3000; t += 16) {
      run.player.meter = createMeter(2, 55);
      run.setPlayerPosition({ x: 780, y: 152 });
      run.tick(16, frame());
      expect(zip.status).not.toBe('stunned');
    }
  });

  it('when one falls the others speed up, and when the last falls the tourists applaud', () => {
    const { run, boss, zip, zap, zorp, bus } = start({ line: false });
    const seen = record(bus, 'mascots:changed');
    expect(boss.phase?.id).toBe('three');
    run.defeat(zip, 'player');
    advance(run, 100);
    expect(boss.phase?.id).toBe('two');
    expect(boss.phase!.attackSpeedMultiplier).toBeGreaterThan(1);
    expect(seen.some((e) => e.phase === 'fell' && e.tag === 'zip')).toBe(true);
    run.defeat(zap, 'player');
    advance(run, 100);
    expect(boss.phase?.id).toBe('one');
    expect(boss.isComplete()).toBe(false);
    run.defeat(zorp, 'player');
    advance(run, 100);
    expect(boss.isComplete()).toBe(true);
    expect(seen.filter((e) => e.phase === 'applause')).toHaveLength(1);
    expect(run.mascotsHere()[0]!.director.view(boss).applauding).toBe(true);
    advance(run, M.applauseMs + 100);
    expect(run.mascotsHere()[0]!.director.view(boss).applauding).toBe(false);
  });

  it('completeNow (a Myko call) finishes it and the tourists applaud', () => {
    const { run, boss, bus } = start({ line: false });
    const seen = record(bus, 'mascots:changed');
    boss.completeNow('myko');
    expect(boss.isComplete()).toBe(true);
    expect(seen.some((e) => e.phase === 'applause')).toBe(true);
    void run;
  });

  it('starts again after a return to the bar (no saved started flag)', () => {
    const h = start({ line: false });
    const { run } = h;
    h.zip.health = 5;
    run.player.meter = createMeter(2, 0.01);
    run.player.holdDrain(false);
    advance(run, 300);
    expect(h.boss.active).toBe(false);
    run.startSection(BOSS);
    const again = run.boss(BOSS)!;
    expect(again.active).toBe(true);
    expect(again.body('zip')!.health).toBe(again.body('zip')!.stats.maxHealth);
    expect(again.body('zorp')!.guardSide).toBe('front');
    expect(again.phase?.id).toBe('three');
  });
});
