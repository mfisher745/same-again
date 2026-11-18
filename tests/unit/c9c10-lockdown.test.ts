/** Chapter 9 set piece: the containment hall lockdown (`lockdown.ts`) through a real run. */

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/content/tuning';
import type { BossPlacement } from '../../src/core/chapter';
import type { ProofId } from '../../src/core/types';
import { PROOFS } from '../../src/core/types';
import type { LockdownBay, LockdownPlacement } from '../../src/systems/lockdown';
import { createMeter } from '../../src/systems/meter';
import { frame, holdM, makeRun, record } from './helpers';
import { SCREEN, T, makeWorld, rect } from './c9c10-world';

const ID = 'c9.setpiece.lockdown' as const;
const DOOR = TUNING.bosses[ID].phases[0]!.attacks.find((a) => a.id === 'door')!;
const L = TUNING.overhaul!.lockdown!;

const bayCol = (k: number): number => 2 + 10 * k;

function bays(guards = true): LockdownBay[] {
  return [0, 1, 2, 3, 4].map((k): LockdownBay => {
    const c = bayCol(k);
    return {
      id: `bay${k + 1}`,
      area: rect(c, 10, 9, 5),
      start: T(c + 1, 12),
      door: rect(c + 9, 10, 1, 5),
      guards: guards
        ? [
            { enemyId: 'security', position: T(c + 5, 11) },
            { enemyId: 'clerk', position: T(c + 6, 13) },
          ]
        : [],
      ...(k === 1 ? { gravitySwitch: { examinableId: 'h.sw2', position: T(c + 4, 9), barrier: rect(c + 4, 10, 1, 2), slideGuardsTo: T(c + 8, 12) } } : {}),
      ...(k === 2 ? { recorder: { examinableId: 'h.rec', position: T(c + 4, 9) } } : {}),
    };
  });
}

const placement = (guards: boolean): LockdownPlacement => ({
  bays: bays(guards),
  lift: { examinableId: 'h.lift', door: rect(56, 10, 1, 5), wandPosition: T(54, 12) },
  beyondArea: rect(52, 10, 4, 5),
});
const PLACEMENT = placement(true);

const boss = (guards: boolean): BossPlacement => ({ bossId: ID, screenId: SCREEN, trigger: { kind: 'script' }, bodies: [], entrance: T(3, 12), callId: 'lockdown', exitArea: rect(57, 10, 2, 5), lockdown: placement(guards) });

function world(guards: boolean) {
  return makeWorld({
    chapter: 9,
    sections: [{ id: ID, kind: 'setpiece', mykoCallable: true }],
    carve: [[2, 8, 58, 14]],
    start: T(3, 12),
    bosses: [boss(guards)],
    examinables: [
      { id: 'h.sw2', screenId: SCREEN, position: T(bayCol(1) + 4, 9) },
      { id: 'h.rec', screenId: SCREEN, position: T(bayCol(2) + 4, 9) },
      { id: 'h.lift', screenId: SCREEN, position: T(55, 9) },
    ],
  });
}

function start(guards = false) {
  const h = makeRun({ module: world(guards) });
  h.run.player.holdDrain(true);
  h.run.startSection(ID);
  const boss = h.run.boss(ID)!;
  const dir = h.run.lockdown(ID)!;
  const step = (ms: number, hold?: { x: number; y: number }): void => {
    for (let t = 0; t < ms; t += 16) {
      h.run.player.meter = createMeter(9, 105);
      if (hold) h.run.setPlayerPosition(hold);
      h.run.tick(16, frame());
    }
  };
  return { ...h, boss, dir, step };
}

describe('lockdown: doors', () => {
  it('a bay door closes DOOR.telegraphMs after Andrew enters; the timer is the door attack', () => {
    const { bus, dir, step, run } = start();
    const seen = record(bus, 'lockdown:changed');
    step(48);
    expect(seen.map((e) => e.phase)).toEqual(expect.arrayContaining(['bayEntered', 'doorLit']));
    expect(dir.doorState(0)).toBe('running');
    step(DOOR.telegraphMs / 2);
    expect(dir.leftMs(0)).toBeGreaterThan(DOOR.telegraphMs / 2 - 400);
    expect(dir.leftMs(0)).toBeLessThan(DOOR.telegraphMs / 2 + 200);
    step(DOOR.telegraphMs / 2 + 100);
    expect(seen.some((e) => e.phase === 'doorShut' && e.bay === 1)).toBe(true);
    void run;
  });

  it('a door that closes on Andrew is a heavy hit and puts him at the bay start with a full timer; the hall does not restart', () => {
    const { run, bus, dir, step } = start();
    const hits = record(bus, 'player:hit');
    const seen = record(bus, 'lockdown:changed');
    // Pass bay 1 into bay 2 first, so a restart of the hall would be visible.
    run.setPlayerPosition(T(bayCol(1) + 1, 12));
    step(48);
    expect(dir.doorState(0)).toBe('passed');
    // Stand at bay 2's door when it shuts.
    const atDoor = T(bayCol(1) + 8, 12);
    for (let t = 0; t < DOOR.telegraphMs + 400 && !seen.some((e) => e.phase === 'crushed'); t += 16) {
      run.player.meter = createMeter(9, 105);
      run.setPlayerPosition(atDoor);
      run.tick(16, frame());
    }
    expect(seen.some((e) => e.phase === 'crushed' && e.bay === 2)).toBe(true);
    const hit = hits.find((h) => h.source.kind === 'boss' && h.source.attackId === 'door');
    expect(hit?.weight).toBe('heavy');
    expect(run.player.pos).toEqual(T(bayCol(1) + 1, 12));
    expect(dir.doorState(0)).toBe('passed');
    // It reopens with a full timer.
    step(L.doorReopenMs + 100);
    expect(dir.doorState(1)).toBe('running');
    expect(dir.leftMs(1)).toBeGreaterThan(DOOR.telegraphMs - 500);
  });

  it('a door that shuts with Andrew elsewhere in the bay costs nothing but sends him back', () => {
    const { run, bus } = start();
    const hits = record(bus, 'player:hit');
    const seen = record(bus, 'lockdown:changed');
    const away = T(bayCol(0) + 2, 12);
    for (let t = 0; t < DOOR.telegraphMs + 400 && !seen.some((e) => e.phase === 'doorShut'); t += 16) {
      run.player.meter = createMeter(9, 105);
      run.setPlayerPosition(away);
      run.tick(16, frame());
    }
    expect(seen.some((e) => e.phase === 'doorShut')).toBe(true);
    expect(hits.filter((h) => h.source.kind === 'boss')).toHaveLength(0);
    expect(run.player.pos).toEqual(T(bayCol(0) + 1, 12));
  });

  it('a shut door blocks the tiles; an open one does not', () => {
    const { dir, step } = start();
    const col = bayCol(0) + 9;
    expect(dir.blocks(col, 12)).toBe(false);
    step(DOOR.telegraphMs + 16, T(bayCol(0) + 2, 12));
    expect(dir.blocks(col, 12)).toBe(true);
    step(L.doorReopenMs + 100);
    expect(dir.blocks(col, 12)).toBe(false);
  });

  it('a door still counts down after he passes the one before; passing bay k stops its timer', () => {
    const { run, dir, step } = start();
    step(48);
    run.setPlayerPosition(T(bayCol(1) + 1, 12));
    step(48);
    expect(dir.doorState(0)).toBe('passed');
    expect(dir.doorState(1)).toBe('running');
    const left = dir.leftMs(1);
    step(1000);
    expect(dir.leftMs(1)).toBeLessThan(left);
  });

  it('the view reports each door, its timer and how far down it is', () => {
    const { run, boss, dir, step } = start();
    step(48);
    const v = dir.view(boss);
    expect(v.bays).toHaveLength(5);
    expect(v.bays[0]).toMatchObject({ index: 1, state: 'running', totalMs: DOOR.telegraphMs });
    expect(v.bays[0]!.closed).toBeGreaterThanOrEqual(0);
    expect(v.bays[0]!.timerAt.y).toBeLessThan(v.bays[0]!.door.y);
    void run;
  });
});

describe('lockdown: guards and switches', () => {
  it('each bay spawns its guards, leashed to the bay, the first time he enters; they only need passing', () => {
    const { run, boss, step } = start(true);
    step(48);
    const adds = boss.aliveActors();
    expect(adds).toHaveLength(2);
    expect(adds.every((a) => a.leash !== null)).toBe(true);
    const area = PLACEMENT.bays[0]!.area;
    expect(adds.every((a) => a.leash?.x === area.x && a.leash?.width === area.width)).toBe(true);
    // Entering again does not spawn them twice.
    step(2000);
    expect(boss.aliveActors().length).toBeLessThanOrEqual(2);
    void run;
  });

  it('a gravity switch needs the Glove; with it the barrier drops and the bay guards slide to the far wall, stunned', () => {
    const { run, bus, dir, boss, step } = start(true);
    const seen = record(bus, 'lockdown:changed');
    run.setPlayerPosition(T(bayCol(1) + 4, 10));
    step(48);
    expect(dir.blocks(bayCol(1) + 4, 10)).toBe(true);
    run.tick(16, frame({ pressed: ['interact'] }));
    // No Glove yet: nothing happens.
    expect(seen.some((e) => e.phase === 'barrierDropped')).toBe(false);
    expect(dir.blocks(bayCol(1) + 4, 10)).toBe(true);
    run.learnMove('borrowedGlove');
    run.player.meter = createMeter(9, 105);
    run.tick(16, frame({ pressed: ['interact'] }));
    expect(seen.map((e) => e.phase)).toEqual(expect.arrayContaining(['barrierDropped', 'guardsSlid']));
    expect(dir.blocks(bayCol(1) + 4, 10)).toBe(false);
    step(L.guardSlideMs + 200);
    const far = T(bayCol(1) + 8, 12);
    const guards = boss.aliveActors();
    expect(guards.length).toBeGreaterThan(0);
    for (const g of guards) {
      expect(g.pos.x).toBeCloseTo(far.x, 0);
      expect(g.status).toBe('stunned');
    }
  });
});

describe('lockdown: the tape', () => {
  it('E at the recorder, then staying for takeMs, gives c9.proof.footage; stepping away stops it', () => {
    const { run, bus, step } = start();
    const seen = record(bus, 'lockdown:changed');
    const at = T(bayCol(2) + 4, 10);
    run.setPlayerPosition(at);
    step(48, at);
    run.tick(16, frame({ pressed: ['interact'] }));
    expect(seen.some((e) => e.phase === 'takeStarted')).toBe(true);
    step(L.takeMs / 2, at);
    expect(run.casebook.hasEvidence('c9.proof.footage')).toBe(false);
    // Away from the wall: it stops and has to start again.
    step(200, T(bayCol(2) + 4, 14));
    step(L.takeMs, at);
    expect(run.casebook.hasEvidence('c9.proof.footage')).toBe(false);
    run.tick(16, frame({ pressed: ['interact'] }));
    step(L.takeMs + 100, at);
    expect(run.casebook.hasEvidence('c9.proof.footage')).toBe(true);
    expect(seen.some((e) => e.phase === 'takeDone')).toBe(true);
  });
});

describe('lockdown: the lift', () => {
  const give = (run: ReturnType<typeof start>['run'], skip?: ProofId): void => {
    for (const p of PROOFS) if (p !== skip) run.addEvidence(p);
  };

  it('needs all five proofs and the lanyard; refuses otherwise', () => {
    const { run, bus, dir, step } = start();
    const seen = record(bus, 'lockdown:changed');
    const at = T(55, 10);
    run.setPlayerPosition(at);
    step(48, at);
    give(run, 'c9.proof.footage');
    run.setFlag('lanyard', true);
    run.tick(16, frame({ pressed: ['interact'] }));
    expect(seen.map((e) => e.phase)).toContain('liftRefused');
    expect(dir.isLiftOpen()).toBe(false);
    run.addEvidence('c9.proof.footage');
    run.setFlag('lanyard', false);
    run.tick(16, frame({ pressed: ['interact'] }));
    expect(dir.isLiftOpen()).toBe(false);
    // The lanyard is also held if the c8 clipboard clue is in the casebook.
    run.addEvidence('c8.clue.shift');
    run.tick(16, frame({ pressed: ['interact'] }));
    expect(dir.isLiftOpen()).toBe(true);
    expect(seen.map((e) => e.phase)).toEqual(expect.arrayContaining(['liftOpen', 'wandLeft']));
  });

  it('the guard leaves his wand: a weapon pickup; walking onto it gains the security wand; the lift door opens', () => {
    const { run, dir, step } = start();
    const at = T(55, 10);
    run.setPlayerPosition(at);
    give(run);
    run.setFlag('lanyard', true);
    step(48, at);
    run.tick(16, frame({ pressed: ['interact'] }));
    expect(dir.blocks(56, 12)).toBe(false);
    expect(run.weaponPickupsHere().map((w) => w.weaponId)).toEqual(['securityWand']);
    expect(run.player.kit.weapons).not.toContain('securityWand');
    run.setPlayerPosition(T(54, 12));
    step(48);
    expect(run.player.kit.weapons).toContain('securityWand');
    expect(run.weaponPickupsHere()).toHaveLength(0);
  });

  it('reaching the lift ends the set piece; the closed lift door blocks until then', () => {
    const { run, boss, dir, step } = start();
    expect(dir.blocks(56, 12)).toBe(true);
    give(run);
    run.setFlag('lanyard', true);
    run.setPlayerPosition(T(55, 10));
    step(48, T(55, 10));
    run.tick(16, frame({ pressed: ['interact'] }));
    run.setPlayerPosition(T(57, 12));
    step(48);
    expect(boss.isComplete()).toBe(true);
  });
});

describe('lockdown: a Myko call and a return to the bar', () => {
  it('a Myko call leaves every door open, gives the tape and leaves the wand', () => {
    const { run, bus, dir, boss, step } = start();
    const seen = record(bus, 'lockdown:changed');
    step(48);
    holdM(run, TUNING.myko.callHoldMs);
    for (let t = 0; t < TUNING.myko.blackoutTimeoutMs + 400; t += 16) run.tick(16, frame());
    expect(boss.isComplete()).toBe(true);
    expect(seen.map((e) => e.phase)).toEqual(expect.arrayContaining(['allOpen', 'wandLeft']));
    expect(run.casebook.hasEvidence('c9.proof.footage')).toBe(true);
    for (let k = 0; k < 5; k++) expect(dir.blocks(bayCol(k) + 9, 12)).toBe(false);
    expect(dir.blocks(56, 12)).toBe(false);
    expect(run.mykoCallsUsed()).toBe(1);
  });

  it('a return to the bar restarts the hall from bay 1 but the tape stays taken', () => {
    const { run, dir, step } = start();
    run.addEvidence('c9.proof.footage');
    run.setPlayerPosition(T(bayCol(2) + 1, 12));
    step(48);
    expect(dir.doorState(0)).toBe('passed');
    expect(dir.doorState(1)).toBe('passed');
    expect(dir.doorState(2)).toBe('running');
    run.player.holdDrain(false);
    run.player.meter = createMeter(9, 0.01);
    for (let i = 0; i < 20; i++) run.tick(16, frame());
    expect([0, 1, 2, 3, 4].map((k) => dir.doorState(k))).toEqual(['idle', 'idle', 'idle', 'idle', 'idle']);
    expect(run.casebook.hasEvidence('c9.proof.footage')).toBe(true);
    expect(run.boss(ID)?.active).toBe(false);
  });

  it('the hall starts again after a bar return when the script starts the section again (nothing saved)', () => {
    const { run, bus, dir, step } = start();
    step(48);
    run.player.holdDrain(false);
    run.player.meter = createMeter(9, 0.01);
    for (let i = 0; i < 20; i++) run.tick(16, frame());
    run.player.holdDrain(true);
    const seen = record(bus, 'lockdown:changed');
    run.startSection(ID);
    step(48);
    expect(seen.some((e) => e.phase === 'bayEntered' && e.bay === 1)).toBe(true);
    expect(dir.doorState(0)).toBe('running');
  });
});
