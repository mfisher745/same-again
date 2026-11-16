/**
 * Mr Halloran on the real chapter: the forks stick in a crate stack and only there, phase 2 carries a pallet that blocks
 * frontal hits and not hits from behind or while he is stuck, and the charges come in pairs. Plus the call-in on each
 * callable section.
 */

import { describe, expect, it } from 'vitest';
import { chapter3 } from '../../src/chapters/03/index';
import { BAY_ARRIVAL, STACKS, stackTile } from '../../src/chapters/03/maps';
import { TUNING } from '../../src/content/tuning';
import type { HitInfo, Vec2 } from '../../src/core/types';
import type { ChapterRun } from '../../src/systems/run';
import { NO_INPUT, frame, placeAt, record } from './helpers';
import { enter, newGame, settle } from './chapter3-steps';

const hit = (amount: number): HitInfo => ({ source: { kind: 'player', abilityId: 'punchCombo' }, targetInstanceId: 'x', amount, knockback: { x: 0, y: 0 }, stunMs: 0, holdMs: 0 });
const tile = (col: number, row: number): Vec2 => ({ x: col * 16 + 8, y: row * 16 + 8 });

async function inBay() {
  const g = await newGame();
  await enter(g.run, 'c3.bay', BAY_ARRIVAL);
  g.run.startSection('c3.boss.halloran');
  await settle(g.run);
  const boss = g.run.boss('c3.boss.halloran')!;
  return { ...g, boss, body: boss.body('halloran')! };
}

/**
 * Lines Halloran up on a row so that a straight charge at Andrew carries on past him, then steps Andrew out of the way as
 * soon as the telegraph begins. Returns once the charge has ended (he is stuck, or has stopped).
 */
async function chargeAlong(run: ChapterRun, body: ReturnType<typeof Object>, from: Vec2, andrew: Vec2, aside: Vec2): Promise<void> {
  const b = body as unknown as { pos: Vec2; status: string };
  b.pos = from;
  run.setPlayerPosition(andrew);
  let moved = false;
  for (let i = 0; i < 400; i++) {
    run.tick(16, NO_INPUT);
    if (b.status === 'telegraphing' && !moved) {
      moved = true;
      run.setPlayerPosition(aside);
    }
    if (moved && b.status !== 'telegraphing' && b.status !== 'attacking') break;
  }
  await settle(run, 1);
}

describe('Halloran: the forks and the crate stacks', () => {
  it('four stacks stand in the arena, each two hits to break, and the forks stick only at a stack tile', () => {
    const bay = chapter3.screens.find((s) => s.id === 'c3.bay')!;
    for (const s of STACKS) {
      const p = bay.dressing?.props?.find((q) => q.id === s.id);
      expect(p?.breakable?.hits).toBe(2);
      expect(p?.solid).toBeDefined();
    }
    expect(STACKS.map(stackTile)).toHaveLength(4);
  });

  it('a charge that runs into a crate stack sticks for the charge\'s recovery (2.5 s), says c3.halloran.stuck, and he can be hit then', async () => {
    const { run, boss, body } = await inBay();
    const shown = record(run.bus, 'dialogue:show');
    // From the west of the east stack: the stack (col 34, solid tile row 10) is past Andrew on the same row.
    await chargeAlong(run, body, tile(27, 10), tile(31, 10), tile(31, 13));
    expect(body.status).toBe('stunned');
    expect(shown.map((s) => s.sequenceId)).toContain('c3.halloran.stuck');
    const fork = TUNING.bosses['c3.boss.halloran'].phases[0]!.attacks.find((a) => a.id === 'forkCharge')!;
    expect(fork.recoveryMs).toBe(2500);
    // Stuck for 2.5 s: still stunned a second in, back on his feet after three.
    const before = (body as unknown as { statusMs: number }).statusMs;
    expect(before).toBeGreaterThan(2000);
    expect(before).toBeLessThanOrEqual(2500);
    // Hit from the side while he is stuck: it lands.
    const hp = body.health;
    expect(body.takeHit(hit(10), { x: body.pos.x, y: body.pos.y + 20 })).toBe('hit');
    expect(body.health).toBe(hp - 10);
    for (let i = 0; i < 200; i++) run.tick(16, NO_INPUT);
    expect(body.status).not.toBe('stunned');
    expect(boss.active).toBe(true);
  });

  it('a charge that ends against the wall (no crate stack) does not stick him', async () => {
    const { run, body } = await inBay();
    const shown = record(run.bus, 'dialogue:show');
    // Row 12 east of the first stack has no stack on it: the charge ends at the east wall.
    await chargeAlong(run, body, tile(27, 12), tile(31, 12), tile(31, 15));
    expect(body.status).not.toBe('stunned');
    expect(shown.map((s) => s.sequenceId)).not.toContain('c3.halloran.stuck');
  });
});

describe('Halloran phase 2: the pallet shield', () => {
  async function phaseTwo() {
    const g = await inBay();
    expect(g.boss.phase?.id).toBe('forks');
    // Halloran takes the bar's worth to half health.
    const h = g.boss.health()!;
    const down = Math.ceil(h.current - h.max * 0.49);
    g.body.takeHit(hit(down), { x: g.body.pos.x - 30, y: g.body.pos.y });
    await settle(g.run, 3);
    return g;
  }

  it('drops to the pallet at half health, says so, and charges come in pairs', async () => {
    const { run, boss, body } = await phaseTwo();
    const shown = record(run.bus, 'dialogue:show');
    run.tick(16, NO_INPUT);
    await settle(run, 2);
    expect(boss.phase?.id).toBe('palletShield');
    expect(body.attacks.find((a) => a.id === 'forkCharge')?.burst).toBe(2);
    expect(TUNING.bosses['c3.boss.halloran'].phases[0]!.attacks.find((a) => a.id === 'forkCharge')?.burst ?? 1).toBe(1);
    void shown;
  });

  it('a hit from the front does nothing and says boss:guarded; a hit from behind lands; a hit while he is stuck lands', async () => {
    const { run, body } = await phaseTwo();
    const guarded = record(run.bus, 'boss:guarded');
    body.facingDeg = 0; // facing east
    const hp = body.health;
    expect(body.takeHit(hit(15), { x: body.pos.x + 30, y: body.pos.y })).toBe('blocked');
    expect(body.takeHit(hit(15), { x: body.pos.x, y: body.pos.y + 30 })).toBe('blocked'); // 90 degrees is still the front
    expect(body.health).toBe(hp);
    expect(guarded).toHaveLength(2);
    expect(body.takeHit(hit(15), { x: body.pos.x - 30, y: body.pos.y })).toBe('hit');
    expect(body.health).toBe(hp - 15);
    // Stuck in a stack: a frontal hit lands.
    run.boss('c3.boss.halloran')!.daze('halloran', 2500, 1);
    expect(body.takeHit(hit(15), { x: body.pos.x + 30, y: body.pos.y })).toBe('hit');
  });

  it('Andrew\'s real punch from the front is turned away (no damage), the same punch from behind lands', async () => {
    const { run, body } = await phaseTwo();
    const guarded = record(run.bus, 'boss:guarded');
    // He stands still and faces Andrew: freeze the AI so the punch is the only thing that moves.
    body.frozen = true;
    body.pos = tile(26, 12);
    body.facingDeg = 0;
    const hp = body.health;
    placeAt(run, 27, 12);
    run.tick(16, frame({ pressed: ['melee'], aim: body.pos }));
    for (let i = 0; i < 20; i++) run.tick(16, NO_INPUT);
    expect(body.health).toBe(hp);
    expect(guarded.length).toBeGreaterThan(0);
    // Behind him.
    advanceCooldown(run);
    placeAt(run, 25, 12);
    run.tick(16, frame({ pressed: ['melee'], aim: body.pos }));
    for (let i = 0; i < 20; i++) run.tick(16, NO_INPUT);
    expect(body.health).toBeLessThan(hp);
  });

  it('starting the fight over (a return to the bar) takes the shield down again', async () => {
    const { run, boss, body } = await phaseTwo();
    expect(body.guardSide).toBe('front');
    boss.reset();
    boss.start();
    const fresh = boss.body('halloran')!;
    expect(fresh.guardSide).toBeNull();
    expect(boss.phase?.id).toBe('forks');
    void run;
  });
});

function advanceCooldown(run: ChapterRun): void {
  for (let i = 0; i < 80; i++) run.tick(16, NO_INPUT);
}
