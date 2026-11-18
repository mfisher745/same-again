/** Chapter 8: Agent Pruitt, round two, at Gate C: his chair, the two phases, being let through (by health and by Myko's call) and the closing. */

import { describe, expect, it } from 'vitest';
import { PROP } from '../../src/art/props';
import { GATE_CLOSING_AREA, GATE_MYKO_START, PRUITT_START, PRUITT_TRIGGER } from '../../src/chapters/08/maps';
import { createMeter } from '../../src/systems/meter';
import { NO_INPUT, frame, record } from './helpers';
import { BOARD, BOSS, FIGHT, PUZZLE, STEALTH, mid, newGame, settle, startPruitt, toGate, walkClosing, wearDown } from './chapter8-steps';

type Run = Awaited<ReturnType<typeof newGame>>['run'];

/** Everything before the gate finished, as a debug walk does, and Andrew at the gate. */
async function atGate() {
  const g = await newGame();
  for (const s of ['c8.explore.bar', 'c8.explore.road', STEALTH, PUZZLE, FIGHT, BOARD] as const) g.run.completeSection(s, 'debug');
  await toGate(g.run);
  g.run.player.holdDrain(true);
  return g;
}

/** Ticks with Andrew standing still and in no danger (the boss's own attacks are what is watched). */
function step(run: Run, ms: number, at = { x: 16 * 8, y: 16 * 6 }): void {
  for (let t = 0; t < ms; t += 16) {
    run.player.meter = createMeter(8, 55);
    run.setPlayerPosition(at);
    run.tick(16, frame());
  }
}

describe('chapter 8: Gate C', () => {
  it('after the fight is done it is night: the floodlights are lit, the hut window is lit, Pruitt sits on his chair, Myko waits', async () => {
    const { run } = await atGate();
    expect(run.isNight()).toBe(true);
    expect(run.heatActive()).toBe(false);
    expect(run.ambient()).not.toBeNull();
    expect(run.dressing.prop('gate.flood1')?.frame).toBe(PROP.gateFloodlight.on);
    expect(run.dressing.prop('gate.hut')?.frame).toBe(PROP.guardHut.night);
    expect(run.dressing.prop('gate.barrier')?.frame).toBe(PROP.barrierArm.up);
    expect(run.dressing.npc('gate.pruitt')?.visible).toBe(true);
    expect(run.objective()).toBe('c8.pruitt');
    expect(run.myko.pos).toEqual(GATE_MYKO_START);
  });

  it('his trigger does nothing until the board is done', async () => {
    const g = await newGame();
    for (const s of ['c8.explore.bar', 'c8.explore.road', STEALTH, PUZZLE, FIGHT] as const) g.run.completeSection(s, 'debug');
    await toGate(g.run);
    await startPruitt(g.run);
    expect(g.run.boss(BOSS)?.active).toBe(false);
  });

  it('walking in: the intro scene, he gets up from the chair and the fight starts with his darts', async () => {
    const { run } = await atGate();
    const shown = record(run.bus, 'dialogue:show');
    await startPruitt(run);
    expect(shown.map((s) => s.sequenceId)).toContain('c8.pruitt.intro');
    const boss = run.boss(BOSS)!;
    expect(boss.active).toBe(true);
    expect(run.dressing.npc('gate.pruitt')?.visible).toBe(false);
    const body = boss.body('pruitt')!;
    expect(Math.hypot(body.pos.x - PRUITT_START.x, body.pos.y - PRUITT_START.y)).toBeLessThan(40);
    expect(boss.phase?.id).toBe('gate');
    expect(body.attacks.map((a) => a.id)).toEqual(['darts']);
    // Walking in again while he is up does not start him twice.
    run.setPlayerPosition(mid(PRUITT_TRIGGER));
    await settle(run, 4);
    expect(run.boss(BOSS)?.active).toBe(true);
  });

  it('phase 1: the flashbang marks the ground and whites out the screen, the barrier arm comes down on its line and goes up again', async () => {
    const { run } = await atGate();
    await startPruitt(run);
    const boss = run.boss(BOSS)!;
    boss.body('pruitt')!.stationary = true;
    boss.body('pruitt')!.attacks = [];
    const seen = record(run.bus, 'pruitt:changed');
    const frames: (string | undefined)[] = [];
    let white = 0;
    for (let t = 0; t < 20000; t += 16) {
      step(run, 16, { x: 22 * 16 + 8, y: 9 * 16 });
      frames.push(run.dressing.prop('gate.barrier')?.frame);
      white = Math.max(white, run.whiteoutAlpha());
    }
    const phases = seen.map((e) => e.phase);
    expect(phases).toEqual(expect.arrayContaining(['flashLit', 'flash', 'barrierLit', 'barrierDown', 'barrierUp']));
    expect(white).toBeGreaterThan(0);
    // Down on its line, then up again.
    const down = frames.indexOf(PROP.barrierArm.down);
    expect(down).toBeGreaterThan(-1);
    expect(frames.slice(down).includes(PROP.barrierArm.up)).toBe(true);
  });

  it('phase 2 at 60%: the line about the truck, then the truck passes along the lit path', async () => {
    const { run } = await atGate();
    await startPruitt(run);
    const boss = run.boss(BOSS)!;
    const shown = record(run.bus, 'dialogue:show');
    const seen = record(run.bus, 'pruitt:changed');
    const h = boss.health()!;
    boss.body('pruitt')!.health = h.max * 0.55;
    step(run, 200);
    await settle(run, 6);
    expect(boss.phase?.id).toBe('truck');
    expect(shown.map((s) => s.sequenceId)).toContain('c8.pruitt.phase2');
    step(run, 14000, { x: 600, y: 80 });
    expect(seen.some((e) => e.phase === 'truckLit')).toBe(true);
    expect(seen.some((e) => e.phase === 'truckPass')).toBe(true);
  });
});

describe('chapter 8: he lets Andrew through', () => {
  it('at 40% he stops: nobody is knocked down, the markers go, the midnight scene plays, the barrier is up and Andrew has the lanyard', async () => {
    const { run } = await atGate();
    await startPruitt(run);
    const shown = record(run.bus, 'dialogue:show');
    const seen = record(run.bus, 'pruitt:changed');
    wearDown(run);
    step(run, 200);
    await settle(run, 8);
    const boss = run.boss(BOSS)!;
    expect(run.isComplete(BOSS)).toBe(true);
    expect(boss.body('pruitt')!.down).toBe(false);
    expect(boss.body('pruitt')!.frozen).toBe(true);
    expect(seen.filter((e) => e.phase === 'letThrough')).toHaveLength(1);
    expect(shown.map((s) => s.sequenceId)).toContain('c8.pruitt.end');
    expect(run.dressing.prop('gate.barrier')?.frame).toBe(PROP.barrierArm.up);
    expect(run.flag('lanyard')).toBe(true);
    expect(run.objective()).toBeNull();
    expect(run.whiteoutAlpha()).toBe(0);
    step(run, 15000);
    expect(seen.some((e) => e.phase === 'flashLit' || e.phase === 'barrierLit' || e.phase === 'truckLit')).toBe(false);
  });

  it('a Myko call lets him through sooner: he is looking at his watch, the call scene plays instead of the midnight one', async () => {
    const { run } = await atGate();
    await startPruitt(run);
    const shown = record(run.bus, 'dialogue:show');
    const seen = record(run.bus, 'pruitt:changed');
    expect(run.myko.tryCall()).toBe(true);
    for (let i = 0; i < 400; i++) {
      run.tick(50, NO_INPUT);
      if (i % 20 === 0) await settle(run, 1);
    }
    await settle(run, 4);
    expect(run.isComplete(BOSS)).toBe(true);
    expect(run.boss(BOSS)!.body('pruitt')!.down).toBe(false);
    expect(seen.some((e) => e.phase === 'letThrough')).toBe(true);
    expect(shown.map((s) => s.sequenceId)).toContain('c8.call.pruitt');
    expect(shown.map((s) => s.sequenceId)).not.toContain('c8.pruitt.end');
    expect(JSON.stringify(run.snapshot().casebook)).toContain('"callId":"pruitt"');
  });

  it('the walk up the service road: the closing scene plays once and the chapter ends', async () => {
    const { run } = await atGate();
    await startPruitt(run);
    const shown = record(run.bus, 'dialogue:show');
    const ended = record(run.bus, 'chapter:completed');
    // Not before he has let him through.
    run.setPlayerPosition(mid(GATE_CLOSING_AREA));
    await settle(run, 6);
    expect(ended).toHaveLength(0);
    wearDown(run);
    step(run, 200);
    await settle(run, 8);
    await walkClosing(run);
    await settle(run, 8);
    expect(shown.filter((s) => s.sequenceId === 'c8.closing')).toHaveLength(1);
    expect(ended).toHaveLength(1);
  });
});
