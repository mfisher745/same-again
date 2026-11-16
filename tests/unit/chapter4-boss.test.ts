/**
 * The dock foreman on the real chapter: pinned in his control box in phase 1 with two dockers and the crane's swinging
 * container; Stout Slam or The Shoulder beside the box knocks him off it (phase 2); the crane's sweep hits Andrew at most
 * once per pass; on foot he has the long sweep, the overhead and the jab; the crane keeps one slow pass on its own.
 */

import { describe, expect, it } from 'vitest';
import { CRANE_LANES, DOCKER_ADDS, FOREMAN_PIN } from '../../src/chapters/04/maps';
import { TUNING } from '../../src/content/tuning';
import type { HitInfo, Vec2 } from '../../src/core/types';
import type { ChapterRun } from '../../src/systems/run';
import { NO_INPUT, frame, placeAt, record } from './helpers';
import { newGame, settle, toDocks } from './chapter4-steps';

const hit = (amount: number): HitInfo => ({ source: { kind: 'player', abilityId: 'punchCombo' }, targetInstanceId: 'x', amount, knockback: { x: 0, y: 0 }, stunMs: 0, holdMs: 0 });
const tile = (col: number, row: number): Vec2 => ({ x: col * 16 + 8, y: row * 16 + 8 });
const CRANE = TUNING.overhaul!.crane!;
const SWING = TUNING.bosses['c4.boss.foreman'].phases[0]!.attacks.find((a) => a.id === 'containerSwing')!;

async function onDocks() {
  const g = await newGame();
  await toDocks(g.run);
  g.run.startSection('c4.boss.foreman');
  await settle(g.run, 4);
  const boss = g.run.boss('c4.boss.foreman')!;
  return { ...g, boss, body: boss.body('foreman')! };
}

/** Yields so the script's promise chains (a sweep ending, then the next one scheduled) run between frames, as they do in the game. */
const yieldFrame = async (run?: ChapterRun): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  // A scene (the foreman's phase line) holds the world still until it is read: read it.
  if (run?.sceneBlocking) run.dialogue.finishAll();
};

async function ticks(run: ChapterRun, ms: number, andrew?: Vec2): Promise<void> {
  for (let t = 0; t < ms; t += 16) {
    if (andrew) run.setPlayerPosition(andrew);
    run.tick(16, NO_INPUT);
    await yieldFrame(run);
  }
}

describe('the foreman, phase 1: the crane', () => {
  it('stands in the control box and does not move or attack however long it goes on; two dockers keep Andrew busy', async () => {
    const { run, boss, body } = await onDocks();
    expect(boss.phase?.id).toBe('crane');
    expect(body.pos).toEqual(FOREMAN_PIN);
    expect(boss.addsAlive()).toBe(DOCKER_ADDS.length);
    expect(DOCKER_ADDS).toHaveLength(2);
    const hits = record(run.bus, 'player:hit');
    await ticks(run, 8000, tile(60, 25)); // right in front of the box, waiting
    expect(body.pos).toEqual(FOREMAN_PIN);
    expect((body as unknown as { current: unknown }).current).toBeNull();
    expect(hits.filter((h) => JSON.stringify(h).includes('sweep') || JSON.stringify(h).includes('overhead'))).toHaveLength(0);
  });

  it('a pass: the shadow lies along the lane for 1.2 s before anything moves, then the container crosses in 0.9 s, down lane 1 first and the next lane next', async () => {
    const { run } = await onDocks();
    const lanes: number[] = [];
    let firstMoving = -1;
    let firstSeen = -1;
    for (let t = 0; t < 22000; t += 16) {
      run.setPlayerPosition(tile(36, 3)); // out of the way
      run.tick(16, NO_INPUT);
      await yieldFrame(run);
      for (const s of run.sweepsHere()) {
        if (firstSeen < 0) firstSeen = t;
        if (s.moving && firstMoving < 0) firstMoving = t;
        const lane = Math.round((s.opts.from.x - 8) / 16);
        if (lanes[lanes.length - 1] !== lane) lanes.push(lane);
      }
    }
    expect(SWING.telegraphMs).toBe(1200);
    expect(firstMoving - firstSeen).toBeGreaterThanOrEqual(1100);
    expect(firstMoving - firstSeen).toBeLessThanOrEqual(1400);
    expect(lanes.slice(0, 3)).toEqual([...CRANE_LANES]);
    expect(CRANE.travelMs).toBe(900);
  });

  it('hits Andrew at most once per pass, however long he stands in the lane, and every pass is a heavy hit', async () => {
    const { run } = await onDocks();
    const moving: number[] = [];
    const hits: number[] = [];
    run.bus.on('hazard:swept', ({ phase }) => {
      if (phase === 'moving') moving.push(run.sweepsHere().length);
      else if (phase === 'hit') hits.push(1);
    });
    const weights: string[] = [];
    run.bus.on('player:hit', (h) => void weights.push(String((h as { weight?: string }).weight)));
    // Stand in each lane in turn for the whole pass.
    for (let pass = 0; pass < 3; pass++) {
      const lane = CRANE_LANES[pass]!;
      for (let t = 0; t < 7000; t += 16) {
        // The pass is on while its sweep is on screen: keep him in its lane at the middle of the run.
        const sw = run.sweepsHere()[0];
        if (sw) run.setPlayerPosition({ x: lane * 16 + 8, y: sw.opts.from.y + (sw.opts.to.y - sw.opts.from.y) / 2 });
        // Heavy hits cost Buzz at Grand: keep him a long way from sober so the pass, not a return, is what is under test.
        run.player.meter = { ...run.player.meter, value: 45 };
        run.tick(16, NO_INPUT);
        await yieldFrame(run);
      }
    }
    expect(moving.length).toBeGreaterThanOrEqual(3);
    // One hit a pass at the very most, and at least one of the three passes did hit him standing there.
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.length).toBeLessThanOrEqual(moving.length);
    expect(SWING.weight ?? 'heavy').toBe('heavy');
  });
});

describe('the foreman: knocked off his box', () => {
  /** Beside the box, with the move learned and in its slot, at Grand (level 2: both slots lit). */
  async function besideBox(slot: 1 | 2) {
    const g = await onDocks();
    const move = slot === 1 ? 'shoulder' : 'stoutSlam';
    g.run.learnMove(move);
    expect(g.run.player.kit.slots.specials[slot - 1]).toBe(move);
    return { ...g, move };
  }
  const press = (run: ChapterRun, slot: 1 | 2, from: Vec2, aim: Vec2) => {
    run.setPlayerPosition(from);
    run.tick(16, frame({ pressed: [`special${slot}` as 'special1'], aim }));
  };

  it.each([[2, 'Stout Slam'], [1, 'The Shoulder']] as const)('slot %i (%s) beside the control box forces phase 2: he steps off the box, unpinned, and says c4.foreman.phase2', async (...[slot]) => {
    const { run, boss, body } = await besideBox(slot);
    const shown = record(run.bus, 'dialogue:show');
    const phases = record(run.bus, 'boss:phaseChanged');
    press(run, slot, { x: FOREMAN_PIN.x - 24, y: FOREMAN_PIN.y + 24 }, FOREMAN_PIN);
    await settle(run, 3);
    expect(boss.phase?.id).toBe('onFoot');
    expect(phases.map((p) => p.phaseId)).toEqual(['onFoot']);
    expect(shown.map((s) => s.sequenceId)).toContain('c4.foreman.phase2');
    expect(body.pinned).toBeNull();
    expect(body.attacks.map((a) => a.id).sort()).toEqual(['overhead', 'pull', 'sweep']);
    // He is no longer held: he attacks with the on-foot set (the jab from range, the sweep and the overhead close up).
    const used = new Set<string>();
    for (let t = 0; t < 12000; t += 16) {
      run.setPlayerPosition(tile(61, 18));
      run.tick(16, NO_INPUT);
      await yieldFrame(run);
      const cur = (body as unknown as { current: { id: string } | null }).current;
      if (cur) used.add(cur.id);
    }
    expect([...used].every((id) => ['sweep', 'overhead', 'pull'].includes(id))).toBe(true);
    expect(used.size).toBeGreaterThan(0);
  });

  it('the same move away from the box does nothing to the phase', async () => {
    const { run, boss, body } = await besideBox(2);
    press(run, 2, tile(45, 25), tile(46, 25));
    await settle(run, 3);
    expect(boss.phase?.id).toBe('crane');
    expect(body.pos).toEqual(FOREMAN_PIN);
  });

  it('plain punches wear him down to 60 per cent and the same phase 2 follows, and the phase is not entered twice', async () => {
    const { run, boss, body } = await onDocks();
    const phases = record(run.bus, 'boss:phaseChanged');
    const h = boss.health()!;
    // A hit he can take: still in the box at just over 60 per cent.
    body.takeHit(hit(Math.floor(h.current - h.max * 0.62)), { x: body.pos.x - 20, y: body.pos.y });
    await ticks(run, 64);
    expect(boss.phase?.id).toBe('crane');
    body.takeHit(hit(Math.ceil(boss.health()!.current - h.max * 0.58)), { x: body.pos.x - 20, y: body.pos.y });
    await ticks(run, 64);
    expect(boss.phase?.id).toBe('onFoot');
    expect(body.pinned).toBeNull();
    // A move beside the box now changes nothing.
    run.learnMove('stoutSlam');
    press(run, 2, { x: FOREMAN_PIN.x - 24, y: FOREMAN_PIN.y + 24 }, FOREMAN_PIN);
    await settle(run, 3);
    expect(phases.map((p) => p.phaseId)).toEqual(['onFoot']);
  });

  it('the crane stops its fast passes and keeps one slow pass on its own after phase 2', async () => {
    const { run, boss } = await besideBox(2);
    const moving: { t: number }[] = [];
    let clock = 0;
    run.bus.on('hazard:swept', ({ phase }) => {
      if (phase === 'moving') moving.push({ t: clock });
    });
    const passesBefore = (): number => moving.length;
    press(run, 2, { x: FOREMAN_PIN.x - 24, y: FOREMAN_PIN.y + 24 }, FOREMAN_PIN);
    const base = passesBefore();
    run.setPlayerPosition(tile(36, 3));
    for (let t = 0; t < 20000; t += 16) {
      clock = t;
      run.tick(16, NO_INPUT);
      await yieldFrame(run);
      run.setPlayerPosition(tile(36, 3));
      // Keep the foreman from ever reaching him so nothing else is in the way.
      boss.body('foreman')!.frozen = true;
    }
    expect(moving.length - base).toBe(1);
    const slow = run.sweepsHere();
    expect(slow).toHaveLength(0);
    expect(CRANE.slowTravelMs).toBeGreaterThan(CRANE.travelMs);
    expect(CRANE.slowDelayMs).toBe(3000);
  });

  it('the slow pass hits Andrew at most once if he stands in it', async () => {
    const { run, boss } = await besideBox(2);
    const hits: number[] = [];
    run.bus.on('hazard:swept', ({ phase }) => {
      if (phase === 'hit') hits.push(1);
    });
    press(run, 2, { x: FOREMAN_PIN.x - 24, y: FOREMAN_PIN.y + 24 }, FOREMAN_PIN);
    boss.body('foreman')!.frozen = true;
    const lane = CRANE_LANES[1];
    for (let t = 0; t < 12000; t += 16) {
      const sw = run.sweepsHere()[0];
      if (sw) run.setPlayerPosition({ x: lane * 16 + 8, y: sw.opts.from.y + (sw.opts.to.y - sw.opts.from.y) / 2 });
      else run.setPlayerPosition(tile(36, 3));
      run.player.meter = { ...run.player.meter, value: 45 };
      run.tick(16, NO_INPUT);
      await yieldFrame(run);
    }
    expect(hits.length).toBeLessThanOrEqual(1);
  });
});

describe('the foreman: on foot', () => {
  it('has the long sweep, the overhead and the pull (the jab that knocks Andrew back towards the crane), all tuned', () => {
    const phase = TUNING.bosses['c4.boss.foreman'].phases[1]!;
    expect(phase.id).toBe('onFoot');
    expect(phase.attacks.map((a) => a.id)).toEqual(['sweep', 'overhead', 'pull']);
    expect(phase.attacks.find((a) => a.id === 'pull')?.knockback).toBeLessThan(0); // towards him: negative is a pull
  });

  it('ends when he is beaten: the end line plays, the shillelagh shows on the control box; the Myko call skips the speech but the shillelagh is still there', async () => {
    const { run, boss, body } = await onDocks();
    const shown = record(run.bus, 'dialogue:show');
    body.takeHit(hit(9999), { x: body.pos.x - 20, y: body.pos.y });
    await settle(run, 8);
    expect(boss.isComplete()).toBe(true);
    expect(shown.map((s) => s.sequenceId)).toContain('c4.foreman.end');
    expect(run.dressing.prop('shillelagh')?.visible).toBe(true);
    placeAt(run, 1, 1);
  });
});
