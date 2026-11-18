/** Chapter 10 boss: the Administrator (`administrator.ts`) through a real run. */

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/content/tuning';
import type { BossPlacement } from '../../src/core/chapter';
import type { HitInfo, Vec2 } from '../../src/core/types';
import type { AdministratorPlacement } from '../../src/systems/administrator';
import { distance } from '../../src/systems/geometry';
import { createMeter } from '../../src/systems/meter';
import { frame, holdM, makeRun, record } from './helpers';
import { SCREEN, T, makeWorld, rect } from './c9c10-world';

const ID = 'c10.boss.administrator' as const;
const DEF = TUNING.bosses[ID];
const A = TUNING.overhaul!.administrator!;
const atk = (id: string) => DEF.phases.flatMap((p) => p.attacks).find((a) => a.id === id)!;
const DESK = T(28, 8);

const PLACEMENT: AdministratorPlacement = {
  arena: rect(10, 5, 36, 20),
  desk: DESK,
  guardEntrances: [T(12, 14), T(44, 14)],
  switches: [
    { examinableId: 'a.sw1', position: T(11, 6) },
    { examinableId: 'a.sw2', position: T(44, 6) },
    { examinableId: 'a.sw3', position: T(11, 23) },
    { examinableId: 'a.sw4', position: T(44, 23) },
  ],
  furniture: [
    { id: 'f1', position: T(30, 14) },
    { id: 'f2', position: T(18, 8) },
    { id: 'f3', position: T(40, 20) },
  ],
};

const BOSS: BossPlacement = { bossId: ID, screenId: SCREEN, trigger: { kind: 'script' }, bodies: [{ tag: 'administrator', position: DESK }], entrance: T(12, 8), administrator: PLACEMENT };

function world() {
  return makeWorld({
    chapter: 10,
    sections: [{ id: ID, kind: 'boss', mykoCallable: false }],
    carve: [[10, 5, 45, 24]],
    start: T(28, 16),
    bosses: [BOSS],
    examinables: PLACEMENT.switches.map((s) => ({ id: s.examinableId, screenId: SCREEN, position: s.position })),
  });
}

const andrewAt = T(28, 16);

function start(opts: { killGuards?: boolean; save?: Parameters<typeof makeRun>[0] extends infer O ? (O extends { save?: infer S } ? S : never) : never } = {}) {
  const h = makeRun({ module: world(), ...(opts.save ? { save: opts.save } : {}) });
  const { run } = h;
  run.dialogue.finishAll();
  run.player.holdDrain(true);
  run.setPlayerPosition(andrewAt);
  run.startSection(ID);
  const boss = run.boss(ID)!;
  const dir = run.administrator(ID)!;
  const body = boss.body('administrator')!;
  let at: Vec2 = andrewAt;
  const kill = opts.killGuards !== false;
  const step = (ms: number, pos?: Vec2): void => {
    if (pos) at = pos;
    for (let t = 0; t < ms; t += 16) {
      run.player.meter = createMeter(10, 60);
      run.setPlayerPosition(at);
      if (kill) for (const a of boss.aliveActors()) if (a !== body) a.knockDown();
      run.tick(16, frame());
    }
  };
  const until = (done: () => boolean, maxMs = 20000): void => {
    for (let t = 0; t < maxMs && !done(); t += 16) step(16);
  };
  return { ...h, boss, dir, body, step, until };
}

const hitOn = (body: { instanceId: string }, amount = 5): HitInfo => ({ source: { kind: 'player', abilityId: 'punchCombo' }, targetInstanceId: body.instanceId, amount, knockback: { x: 0, y: 0 }, stunMs: 0, holdMs: 0 });

describe('the Administrator: phase 1, delegation', () => {
  it('uses only the director for his attacks: his body has none of its own', () => {
    const { body, boss } = start();
    expect(body.attacks).toEqual([]);
    expect(boss.directedAttackIds).toEqual(expect.arrayContaining(['stamp', 'gravityFlip', 'stunPulse', 'teleportStrike', 'beamSweep']));
  });

  it('stands behind his desk with the shield up; hits do nothing', () => {
    const { body, dir, step } = start();
    step(48);
    expect(dir.shieldUp).toBe(true);
    expect(body.pos).toEqual(DESK);
    expect(body.takeHit(hitOn(body), andrewAt)).toBe('blocked');
  });

  it('calls security in pairs; the shield drops for 4 s whenever both guards are down, then comes back and a new pair arrives', () => {
    const { bus, boss, dir, body, step, until } = start({ killGuards: false });
    const seen = record(bus, 'administrator:changed');
    until(() => seen.some((e) => e.phase === 'guardsCalled'), A.callDelayMs + 500);
    const guards = boss.aliveActors().filter((a) => a !== body);
    expect(guards).toHaveLength(2);
    expect(guards.every((g) => g.enemyId === 'security')).toBe(true);
    expect(dir.shieldUp).toBe(true);
    // One down is not enough.
    guards[0]?.knockDown();
    step(100);
    expect(dir.shieldUp).toBe(true);
    guards[1]?.knockDown();
    step(48);
    expect(dir.shieldUp).toBe(false);
    expect(seen.some((e) => e.phase === 'shieldDown')).toBe(true);
    expect(body.takeHit(hitOn(body), andrewAt)).toBe('hit');
    step(A.shieldDownMs - 400);
    expect(dir.shieldUp).toBe(false);
    step(600);
    expect(dir.shieldUp).toBe(true);
    expect(seen.some((e) => e.phase === 'shieldUp')).toBe(true);
    // A second pair comes.
    until(() => seen.filter((e) => e.phase === 'guardsCalled').length === 2, A.callDelayMs + 500);
    expect(seen.filter((e) => e.phase === 'guardsCalled')).toHaveLength(2);
  });

  it('a stamp marks a row for its telegraph, then a heavy shockwave runs along it', () => {
    const { bus, step, until } = start();
    const seen = record(bus, 'administrator:changed');
    const hits = record(bus, 'player:hit');
    until(() => seen.some((e) => e.phase === 'stampLit'));
    expect(seen.some((e) => e.phase === 'stampLit')).toBe(true);
    const lit = seen.findIndex((e) => e.phase === 'stampLit');
    let t = 0;
    while (!seen.some((e) => e.phase === 'stamp') && t < 3000) {
      step(16);
      t += 16;
    }
    expect(t).toBeGreaterThanOrEqual(atk('stamp').telegraphMs - 50);
    expect(t).toBeLessThanOrEqual(atk('stamp').telegraphMs + 50);
    step(A.stampTravelMs + 100);
    const hit = hits.find((h) => h.source.kind === 'boss' && h.source.attackId === 'stamp');
    expect(hit?.weight).toBe('heavy');
    expect(lit).toBeGreaterThanOrEqual(0);
  });

  it('a stamp misses him if he leaves the marked row', () => {
    const { bus, step, until } = start();
    const seen = record(bus, 'administrator:changed');
    const hits = record(bus, 'player:hit');
    until(() => seen.some((e) => e.phase === 'stampLit'));
    step(16, T(28, 20));
    step(atk('stamp').telegraphMs + A.stampTravelMs + 300);
    expect(seen.some((e) => e.phase === 'stamp')).toBe(true);
    expect(hits.filter((h) => h.source.kind === 'boss' && h.source.attackId === 'stamp')).toHaveLength(0);
  });

  it('the view marks the row, the shield and the wave', () => {
    const { boss, dir, step, until, bus } = start();
    const seen = record(bus, 'administrator:changed');
    step(48);
    expect(dir.view(boss).shield).toBe(true);
    until(() => seen.some((e) => e.phase === 'stampLit'));
    const v = dir.view(boss);
    expect(v.stamp?.state).toBe('lit');
    expect(v.stamp?.y).toBe(16 * 16 + 8);
    step(atk('stamp').telegraphMs + 100);
    expect(dir.view(boss).stamp?.state).toBe('wave');
  });
});

describe('the Administrator: phase 2, restructuring', () => {
  const into2 = (h: ReturnType<typeof start>) => {
    h.boss.forcePhase('restructuring');
    h.step(48);
  };

  it('flips gravity toward a wall every 10 s, arrows lit 1.5 s ahead', () => {
    const h = start();
    const seen = record(h.bus, 'administrator:changed');
    into2(h);
    let litAt = -1;
    let flipAt = -1;
    let flip2 = -1;
    for (let t = 0; t < 30000 && flip2 < 0; t += 16) {
      h.step(16);
      if (litAt < 0 && seen.some((e) => e.phase === 'gravityLit')) litAt = t;
      const flips = seen.filter((e) => e.phase === 'gravityFlip').length;
      if (flipAt < 0 && flips === 1) flipAt = t;
      if (flip2 < 0 && flips === 2) flip2 = t;
    }
    expect(flipAt - litAt).toBeGreaterThanOrEqual(atk('gravityFlip').telegraphMs - 50);
    expect(flipAt - litAt).toBeLessThanOrEqual(atk('gravityFlip').telegraphMs + 50);
    expect(flipAt).toBeGreaterThan(9900);
    expect(flipAt).toBeLessThan(10100);
    expect(flip2 - flipAt).toBeGreaterThanOrEqual(atk('gravityFlip').cooldownMs - 100);
    expect(flip2 - flipAt).toBeLessThanOrEqual(atk('gravityFlip').cooldownMs + 100);
    const dirs = seen.filter((e) => e.phase === 'gravityFlip').map((e) => e.dir);
    expect(dirs[0]).not.toBe(dirs[1]);
  });

  it('the floor arrows show on the view while lit, and loose furniture slides to that wall on the flip', () => {
    const h = start();
    const seen = record(h.bus, 'administrator:changed');
    into2(h);
    h.until(() => seen.some((e) => e.phase === 'gravityLit'));
    const lit = seen.find((e) => e.phase === 'gravityLit')!;
    expect(h.dir.view(h.boss).gravity).toEqual({ dir: lit.dir, state: 'lit' });
    h.until(() => seen.some((e) => e.phase === 'gravityFlip'));
    h.step(A.furnitureSlideMs + 100);
    const f1 = h.dir.view(h.boss).furniture.find((f) => f.id === 'f1')!;
    const a = PLACEMENT.arena;
    if (lit.dir === 'left') expect(f1.pos.x).toBeLessThan(a.x + 24);
    if (lit.dir === 'right') expect(f1.pos.x).toBeGreaterThan(a.x + a.width - 24);
    if (lit.dir === 'up') expect(f1.pos.y).toBeLessThan(a.y + 24);
    if (lit.dir === 'down') expect(f1.pos.y).toBeGreaterThan(a.y + a.height - 24);
  });

  it('furniture that slides through Andrew is a heavy hit; out of the way it is not', () => {
    for (const inTheWay of [true, false]) {
      const h = start();
      const seen = record(h.bus, 'administrator:changed');
      const hits = record(h.bus, 'player:hit');
      into2(h);
      h.until(() => seen.some((e) => e.phase === 'gravityLit'));
      const d = seen.find((e) => e.phase === 'gravityLit')!.dir!;
      // f1 starts at (30, 14); put him three tiles along its way, or well off it.
      const way: Record<string, Vec2> = { left: T(27, 14), right: T(33, 14), up: T(30, 11), down: T(30, 17) };
      h.step(16, inTheWay ? way[d]! : T(22, 22));
      h.step(atk('gravityFlip').telegraphMs + A.furnitureSlideMs + 400);
      const got = hits.filter((x) => x.source.kind === 'boss' && x.source.attackId === 'gravityFlip');
      if (inTheWay) expect(got[0]?.weight).toBe('heavy');
      else expect(got).toHaveLength(0);
    }
  });

  it('E at any of the four switches puts it back: furniture home, he is thrown against the far wall, stunned, shield or not', () => {
    for (const sw of PLACEMENT.switches) {
      const h = start();
      const seen = record(h.bus, 'administrator:changed');
      into2(h);
      h.until(() => seen.some((e) => e.phase === 'gravityFlip'));
      const flipped = seen.find((e) => e.phase === 'gravityFlip')!.dir!;
      h.step(A.furnitureSlideMs + 100);
      expect(h.dir.flipped).toBe(true);
      // Next to the switch, then E.
      h.step(16, { x: sw.position.x + 4, y: sw.position.y + 12 });
      h.run.tick(16, frame({ pressed: ['interact'] }));
      const back = seen.find((e) => e.phase === 'gravityBack');
      expect(back, sw.examinableId).toBeDefined();
      expect(h.dir.flipped).toBe(false);
      const far = flipped === 'left' ? 'right' : flipped === 'right' ? 'left' : flipped === 'up' ? 'down' : 'up';
      expect(back?.dir).toBe(far);
      const a = PLACEMENT.arena;
      if (far === 'left') expect(h.body.pos.x).toBeLessThan(a.x + 20);
      if (far === 'right') expect(h.body.pos.x).toBeGreaterThan(a.x + a.width - 20);
      if (far === 'up') expect(h.body.pos.y).toBeLessThan(a.y + 20);
      if (far === 'down') expect(h.body.pos.y).toBeGreaterThan(a.y + a.height - 20);
      expect(h.body.status).toBe('stunned');
      // The desk shield does not turn a stunned man's hits away.
      expect(h.body.takeHit(hitOn(h.body), h.body.pos)).toBe('hit');
      // The furniture is home again.
      for (const f of h.dir.view(h.boss).furniture) {
        const home = PLACEMENT.furniture.find((x) => x.id === f.id)!;
        h.step(A.furnitureSlideMs + 50);
        expect(distance(h.dir.view(h.boss).furniture.find((x) => x.id === f.id)!.pos, home.position)).toBeLessThan(1);
      }
    }
  });

  it('E at a switch when gravity is not flipped does nothing; after the stun he walks back to his desk', () => {
    const h = start();
    const seen = record(h.bus, 'administrator:changed');
    into2(h);
    const sw = PLACEMENT.switches[0]!;
    h.step(16, { x: sw.position.x + 4, y: sw.position.y + 12 });
    h.run.tick(16, frame({ pressed: ['interact'] }));
    expect(seen.some((e) => e.phase === 'gravityBack')).toBe(false);
    h.until(() => seen.some((e) => e.phase === 'gravityFlip'));
    h.step(A.furnitureSlideMs + 100, { x: sw.position.x + 4, y: sw.position.y + 12 });
    h.run.tick(16, frame({ pressed: ['interact'] }));
    expect(h.body.status).toBe('stunned');
    const thrown = distance(h.body.pos, DESK);
    expect(thrown).toBeGreaterThan(100);
    h.step(A.gravityStunMs + (thrown / A.returnSpeedPx) * 1000 + 600);
    expect(distance(h.body.pos, DESK)).toBeLessThan(2);
    expect(h.body.status).not.toBe('stunned');
  });

  it('still stamps, and the guards still come, in phase 2', () => {
    const h = start();
    const seen = record(h.bus, 'administrator:changed');
    into2(h);
    h.step(atk('stamp').cooldownMs + 2000);
    expect(seen.some((e) => e.phase === 'stampLit')).toBe(true);
    expect(seen.some((e) => e.phase === 'guardsCalled')).toBe(true);
  });
});

describe('the Administrator: phase 3, personally', () => {
  const into3 = (h: ReturnType<typeof start>) => {
    h.boss.forcePhase('personally');
    h.step(16);
    // He does not walk here: only the director's attacks are under test.
    h.body.stationary = true;
  };

  it('takes the jacket off: the sprite changes, the shield and the guards are gone', () => {
    const h = start();
    const seen = record(h.bus, 'administrator:changed');
    into3(h);
    h.step(48);
    expect(seen.some((e) => e.phase === 'jacketOff')).toBe(true);
    expect(h.body.spriteKey).toBe('boss.c10.boss.administrator.personally');
    expect(h.dir.shieldUp).toBe(false);
    expect(h.body.takeHit(hitOn(h.body), andrewAt)).toBe('hit');
    h.step(5000);
    expect(seen.some((e) => e.phase === 'guardsCalled')).toBe(false);
  });

  it('the stun pulse lights a ground marker on his spot, then holds him if he stays in it', () => {
    const h = start();
    const seen = record(h.bus, 'administrator:changed');
    into3(h);
    h.until(() => seen.some((e) => e.phase === 'pulseLit'));
    expect(h.dir.view(h.boss).pulse).toMatchObject({ state: 'lit', radius: 48 });
    const spot = h.dir.view(h.boss).pulse!.spot;
    expect(distance(spot, andrewAt)).toBeLessThan(2);
    h.step(atk('stunPulse').telegraphMs / 1.15 + 100);
    expect(seen.some((e) => e.phase === 'pulse')).toBe(true);
    expect(h.run.player.held).toBe(true);
  });

  it('walking out of the pulse marker avoids it', () => {
    const h = start();
    const seen = record(h.bus, 'administrator:changed');
    const hits = record(h.bus, 'player:hit');
    into3(h);
    h.until(() => seen.some((e) => e.phase === 'pulseLit'));
    h.step(16, T(28, 21));
    h.step(atk('stunPulse').telegraphMs + 200);
    expect(hits.filter((x) => x.source.kind === 'boss' && x.source.attackId === 'stunPulse')).toHaveLength(0);
    expect(h.run.player.held).toBe(false);
  });

  it('teleports behind Andrew after a 600 ms telegraph and strikes: heavy', () => {
    const h = start();
    const seen = record(h.bus, 'administrator:changed');
    const hits = record(h.bus, 'player:hit');
    into3(h);
    h.until(() => seen.some((e) => e.phase === 'teleportLit'), 30000);
    const lit = h.dir.view(h.boss).teleport;
    expect(lit?.state).toBe('lit');
    // Andrew faces down (the default): behind him is up.
    expect(lit!.spot.y).toBeLessThan(andrewAt.y);
    expect(distance(lit!.spot, andrewAt)).toBeCloseTo(A.teleportBehindPx, 0);
    let t = 0;
    while (!seen.some((e) => e.phase === 'teleport') && t < 2000) {
      h.step(16);
      t += 16;
    }
    expect(t).toBeGreaterThanOrEqual(atk('teleportStrike').telegraphMs / 1.15 - 50);
    expect(t).toBeLessThanOrEqual(atk('teleportStrike').telegraphMs / 1.15 + 50);
    expect(distance(h.body.pos, lit!.spot)).toBeLessThan(2);
    h.step(48);
    expect(hits.find((x) => x.source.kind === 'boss' && x.source.attackId === 'teleportStrike')?.weight).toBe('heavy');
  });

  it('the beam lights a quarter of the room, then sweeps it: the worst hit if he is in it', () => {
    const h = start();
    const seen = record(h.bus, 'administrator:changed');
    const hits = record(h.bus, 'player:hit');
    into3(h);
    h.until(() => seen.some((e) => e.phase === 'beamLit'), 40000);
    const v = h.dir.view(h.boss).beam!;
    expect(v.state).toBe('lit');
    expect(v.angleDeg).toBe(90);
    expect(v.range).toBe(300);
    h.step(atk('beamSweep').telegraphMs / 1.15 + A.beamSweepMs + 300);
    expect(seen.some((e) => e.phase === 'beam')).toBe(true);
    expect(hits.find((x) => x.source.kind === 'boss' && x.source.attackId === 'beamSweep')?.weight).toBe('worst');
  });

  it('the beam misses him if he leaves the quarter it lights', () => {
    const h = start();
    const seen = record(h.bus, 'administrator:changed');
    const hits = record(h.bus, 'player:hit');
    into3(h);
    h.until(() => seen.some((e) => e.phase === 'beamLit'), 40000);
    // Behind the body, well outside the wedge.
    h.step(16, T(28, 5));
    h.step(atk('beamSweep').telegraphMs + A.beamSweepMs + 300);
    expect(hits.filter((x) => x.source.kind === 'boss' && x.source.attackId === 'beamSweep')).toHaveLength(0);
  });

  it('makes three offers between attacks: settlement, a better settlement, a job. Then no more', () => {
    const h = start();
    const seen = record(h.bus, 'administrator:changed');
    into3(h);
    h.step(90000, T(28, 22));
    const offers = seen.filter((e) => e.phase === 'offer').map((e) => e.offer);
    expect(offers).toEqual([1, 2, 3]);
    // Each offer comes after at least `offerEveryAttacks` attacks since the last one.
    const phases = seen.map((e) => e.phase);
    const first = phases.indexOf('offer');
    const before = phases.slice(0, first).filter((p) => ['pulse', 'teleport', 'beam'].includes(p));
    expect(before.length).toBe(A.offerEveryAttacks);
  });
});

describe('the Administrator: the end, and starting again', () => {
  it('when he is beaten he sits down; everything stops', () => {
    const h = start();
    const seen = record(h.bus, 'administrator:changed');
    h.body.health = 0;
    h.body.status = 'down';
    h.step(64);
    expect(h.boss.isComplete()).toBe(true);
    expect(seen.map((e) => e.phase)).toContain('sits');
    expect(h.dir.view(h.boss).sits).toBe(true);
    const n = seen.length;
    h.step(5000);
    expect(seen.length).toBe(n);
  });

  it('a return to the cabinet restarts the fight from phase 1', () => {
    const h = start();
    h.boss.forcePhase('personally');
    h.step(48);
    expect(h.boss.phase?.id).toBe('personally');
    h.run.player.holdDrain(false);
    h.run.player.meter = createMeter(10, 0.01);
    for (let i = 0; i < 20; i++) h.run.tick(16, frame());
    expect(h.boss.active).toBe(false);
    const seen = record(h.bus, 'administrator:changed');
    h.run.player.holdDrain(true);
    h.run.startSection(ID);
    const boss = h.run.boss(ID)!;
    expect(boss.phase?.id).toBe('delegation');
    for (let t = 0; t < 4000; t += 16) {
      h.run.player.meter = createMeter(10, 60);
      h.run.tick(16, frame());
    }
    expect(h.run.administrator(ID)?.shieldUp).toBe(true);
    expect(seen.some((e) => e.phase === 'jacketOff')).toBe(false);
    expect(boss.body('administrator')?.pinned).not.toBeNull();
  });

  it('a whole fight on the real numbers runs through all three phases as his health falls', () => {
    const h = start();
    const phases = record(h.bus, 'boss:phaseChanged');
    const body = h.body;
    const max = body.stats.maxHealth;
    for (const f of [0.6, 0.3]) {
      body.health = Math.floor(max * f);
      h.step(64);
    }
    expect(phases.map((p) => p.phaseId)).toEqual(['restructuring', 'personally']);
  });
});

describe('the Administrator cannot be called in', () => {
  it('holding M does not fill the ring, and Myko says this one is Andrew\'s, with calls left', () => {
    const h = start();
    const shown = record(h.bus, 'dialogue:show');
    const started = record(h.bus, 'myko:callStarted');
    const refused = record(h.bus, 'myko:callRefused');
    holdM(h.run, 1500);
    expect(h.run.myko.callHoldProgress()).toBe(0);
    expect(started).toHaveLength(0);
    expect(refused.length).toBeGreaterThan(0);
    expect(shown.map((s) => s.sequenceId)).toContain('myko.callRefused.administrator.callsLeft');
    expect(h.run.callsRemaining()).toBe(3);
    expect(h.boss.isComplete()).toBe(false);
  });

  it('with no calls left the line is the plain one', () => {
    const h = start({ save: (base) => ({ ...base, mykoCallsLeft: 0 }) });
    const shown = record(h.bus, 'dialogue:show');
    holdM(h.run, 1500);
    expect(shown.map((s) => s.sequenceId)).toContain('myko.callRefused.administrator');
    expect(shown.map((s) => s.sequenceId)).not.toContain('myko.callRefused.administrator.callsLeft');
    expect(h.boss.isComplete()).toBe(false);
  });
});
