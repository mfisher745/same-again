/**
 * Chapter 10: the Administrator through the chapter's own placement and script: the three phases and what the script plays
 * on them, the four switches, his end, Myko's refusal (with and without calls left) and the shield prop.
 */

import { describe, expect, it } from 'vitest';
import { PROP } from '../../src/art/props';
import { ADMIN_START, GRAVITY_SWITCHES } from '../../src/chapters/10/maps';
import { TUNING } from '../../src/content/tuning';
import { frame, holdM, record } from './helpers';
import { BOSS, beatBoss, doCabinet, intoControl, newGame, safe, settle, stepBoss, takeTicket, winAnteroom } from './chapter10-steps';

const A = TUNING.overhaul!.administrator!;

async function atBoss(save?: Parameters<typeof newGame>[1]) {
  const g = await newGame('chapter', save);
  await doCabinet(g.run);
  await takeTicket(g.run);
  await winAnteroom(g.run);
  await intoControl(g.run);
  safe(g.run);
  return g;
}

/** Ticks the boss with the guards put down, so nothing else is in the way. */
function stepClear(run: Awaited<ReturnType<typeof atBoss>>['run'], ms: number): void {
  const boss = run.boss(BOSS)!;
  const body = boss.body('administrator')!;
  for (let t = 0; t < ms; t += 16) {
    for (const a of boss.aliveActors()) if (a !== body) a.knockDown();
    stepBoss(run, 16);
  }
}

describe('chapter 10: the Administrator, wired from the maps', () => {
  it('stands at his desk with four switches, three stamp rows and six pieces of furniture', async () => {
    const { run } = await atBoss();
    const dir = run.administrator(BOSS)!;
    expect(dir.placement.switches.map((s) => s.examinableId)).toEqual(GRAVITY_SWITCHES.map((s) => s.id));
    expect(dir.placement.stampRows).toEqual([9, 13, 17]);
    expect(dir.placement.furniture).toHaveLength(6);
    expect(run.boss(BOSS)!.body('administrator')!.pos).toEqual(ADMIN_START);
    expect(run.boss(BOSS)!.directedAttackIds).toEqual(expect.arrayContaining(['stamp', 'gravityFlip', 'beamSweep']));
  });

  it('phase 1: guards come in a pair, the shield drops for 4 s when both are down, and the shield prop follows', async () => {
    const { run } = await atBoss();
    const seen = record(run.bus, 'administrator:changed');
    const dir = run.administrator(BOSS)!;
    const boss = run.boss(BOSS)!;
    const body = boss.body('administrator')!;
    for (let t = 0; t < A.callDelayMs + 800 && !seen.some((e) => e.phase === 'guardsCalled'); t += 16) stepBoss(run, 16);
    const guards = boss.aliveActors().filter((a) => a !== body);
    expect(guards).toHaveLength(2);
    expect(run.dressing.prop('control.shield')?.visible).toBe(true);
    for (const g of guards) g.knockDown();
    stepBoss(run, 48);
    expect(dir.shieldUp).toBe(false);
    expect(run.dressing.prop('control.shield')?.visible).toBe(false);
    stepBoss(run, A.shieldDownMs + 400);
    expect(dir.shieldUp).toBe(true);
    expect(run.dressing.prop('control.shield')?.visible).toBe(true);
  });

  it('phase 2 plays c10.admin.phase2 and flips gravity; E at a switch puts it back and stuns him', async () => {
    const { run } = await atBoss();
    const shown = record(run.bus, 'dialogue:show');
    const seen = record(run.bus, 'administrator:changed');
    const boss = run.boss(BOSS)!;
    boss.forcePhase('restructuring');
    stepClear(run, 48);
    await settle(run, 2);
    expect(shown.map((s) => s.sequenceId)).toContain('c10.admin.phase2');
    for (let t = 0; t < 20000 && !seen.some((e) => e.phase === 'gravityFlip'); t += 16) stepClear(run, 16);
    stepClear(run, A.furnitureSlideMs + 100);
    expect(run.administrator(BOSS)!.flipped).toBe(true);
    // E at the east switch, the real examinable on its real spot.
    const sw = GRAVITY_SWITCHES.find((s) => s.wall === 'east')!;
    run.setPlayerPosition(sw.spot);
    safe(run);
    run.tick(16, frame({ pressed: ['interact'] }));
    expect(seen.some((e) => e.phase === 'gravityBack')).toBe(true);
    expect(run.administrator(BOSS)!.flipped).toBe(false);
    expect(boss.body('administrator')!.status).toBe('stunned');
  });

  it('phase 3 plays c10.admin.phase3, drops the shield prop and puts the jacket on the hook; the three offers come in order', async () => {
    const { run } = await atBoss();
    const shown = record(run.bus, 'dialogue:show');
    const seen = record(run.bus, 'administrator:changed');
    const boss = run.boss(BOSS)!;
    expect(run.dressing.prop('control.hook')?.frame).toBe(PROP.coatHook.empty);
    boss.forcePhase('personally');
    const body = boss.body('administrator')!;
    body.stationary = true;
    for (let t = 0; t < 60000 && seen.filter((e) => e.phase === 'offer').length < 3; t += 16) {
      for (const a of boss.aliveActors()) if (a !== body) a.knockDown();
      safe(run);
      // Andrew keeps out of the way of every attack: the marker and the beam are what they are, the meter is full.
      run.setPlayerPosition({ x: 20 * 16 + 8, y: 20 * 16 + 8 });
      run.tick(16, frame());
      if (t % 480 === 0) await settle(run, 1);
    }
    await settle(run, 3);
    const ids = shown.map((s) => s.sequenceId);
    expect(ids).toContain('c10.admin.phase3');
    expect(ids.indexOf('c10.admin.offer1')).toBeLessThan(ids.indexOf('c10.admin.offer2'));
    expect(ids.indexOf('c10.admin.offer2')).toBeLessThan(ids.indexOf('c10.admin.offer3'));
    expect(seen.filter((e) => e.phase === 'offer').map((e) => e.offer)).toEqual([1, 2, 3]);
    expect(run.dressing.prop('control.shield')?.visible).toBe(false);
    expect(run.dressing.prop('control.hook')?.frame).toBe(PROP.coatHook.jacket);
  });

  it('his end: he sits, c10.admin.end plays, the objective is the broadcast and the shield is gone', async () => {
    const { run } = await atBoss();
    const shown = record(run.bus, 'dialogue:show');
    const seen = record(run.bus, 'administrator:changed');
    await beatBoss(run);
    expect(run.isComplete(BOSS)).toBe(true);
    expect(seen.some((e) => e.phase === 'sits')).toBe(true);
    expect(shown.map((s) => s.sequenceId)).toContain('c10.admin.end');
    expect(run.objective()).toBe('c10.broadcast');
    expect(run.dressing.prop('control.shield')?.visible).toBe(false);
    // The broadcast is now the current section, so Myko can be called on it.
    expect(run.currentCompletable()?.sectionId).toBe('c10.puzzle.broadcast');
  });

  it('walking in again after he is beaten does not start him again', async () => {
    const { run } = await atBoss();
    await beatBoss(run);
    run.goToScreen('c10.anteroom', { x: 15 * 16, y: 3 * 16 });
    await settle(run, 4);
    await intoControl(run);
    await settle(run, 6);
    expect(run.boss(BOSS)?.active).toBe(false);
  });
});

describe('chapter 10: Myko cannot be called on the Administrator', () => {
  it('with calls left: the ring does not fill, Myko says this one is Andrew\'s and keeps his calls', async () => {
    const { run } = await atBoss();
    const shown = record(run.bus, 'dialogue:show');
    const started = record(run.bus, 'myko:callStarted');
    const refused = record(run.bus, 'myko:callRefused');
    holdM(run, 1500);
    await settle(run, 4);
    expect(started).toHaveLength(0);
    expect(refused.length).toBeGreaterThan(0);
    expect(run.myko.callHoldProgress()).toBe(0);
    expect(shown.map((s) => s.sequenceId)).toContain('myko.callRefused.administrator.callsLeft');
    expect(run.boss(BOSS)!.isComplete()).toBe(false);
    expect(run.mykoCallsUsed()).toBe(0);
    expect(run.callsRemaining()).toBe(3);
  });

  it('with no calls left it is the plain line', async () => {
    const first = await atBoss();
    first.store.write({ ...first.store.load()!, mykoCallsLeft: 0 });
    const { run } = await newGame('continue', first.store);
    await intoControl(run);
    const shown = record(run.bus, 'dialogue:show');
    holdM(run, 1500);
    await settle(run, 4);
    const ids = shown.map((s) => s.sequenceId);
    expect(run.callsRemaining()).toBe(0);
    expect(ids).toContain('myko.callRefused.administrator');
    expect(ids).not.toContain('myko.callRefused.administrator.callsLeft');
    expect(run.boss(BOSS)!.isComplete()).toBe(false);
  });
});
