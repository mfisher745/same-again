/**
 * Agent Pruitt, round one, on the real chapter: the shelf cranks (rails glow a second before, the unit slides across the
 * lane), his dart, phase 2 (two agents and two shelves), five o'clock and the umbrella.
 */

import { describe, expect, it } from 'vitest';
import { PROP } from '../../src/art/props';
import { LANES, PRUITT_ADDS, SHELF_UNIT_COLS, shelfPropId } from '../../src/chapters/05/maps';
import { TUNING } from '../../src/content/tuning';
import { NO_INPUT, record } from './helpers';
import { BOSS, examine, hit, mid, newGame, settle, startPruitt, toStacks } from './chapter5-steps';
import type { ChapterRun } from '../../src/systems/run';

const SHELF = TUNING.bosses[BOSS].phases[0]!.attacks.find((a) => a.id === 'shelf')!;

async function ticks(run: ChapterRun, ms: number, andrew?: { x: number; y: number }): Promise<void> {
  for (let t = 0; t < ms; t += 16) {
    if (andrew) run.setPlayerPosition(andrew);
    run.tick(16, NO_INPUT);
    await Promise.resolve();
    if (run.sceneBlocking) run.dialogue.finishAll();
  }
}

/** Through the door and into the arena, deduction done (the debug way), with Pruitt started by his own trigger. */
async function atPruitt() {
  const g = await newGame();
  for (const s of ['c5.explore.bar', 'c5.stealth.lobby', 'c5.stealth.floor', 'c5.puzzle.redacted', 'c5.fight.floor', 'c5.deduction.ohio'] as const) g.run.completeSection(s, 'debug');
  await toStacks(g.run);
  await startPruitt(g.run);
  const boss = g.run.boss(BOSS)!;
  boss.body('pruitt')!.frozen = true;
  return { ...g, boss, body: boss.body('pruitt')! };
}

const inLane = (k: number) => mid(LANES[k]!.area);
const unitCol = (run: ChapterRun, unit: number): number => run.dressing.prop(shelfPropId(unit, 0))!.col;

describe('Pruitt, phase 1: one shelf', () => {
  it('starts by his own trigger with the intro, and the arena is the five lanes of the placement', async () => {
    const { run, boss } = await atPruitt();
    expect(boss.active).toBe(true);
    expect(boss.phase?.id).toBe('oneShelf');
    expect(run.objective()).toBe('c5.pruitt');
    expect(boss.addsAlive()).toBe(0);
    expect(run.dressing.prop('umbrella')?.visible).toBe(false);
  });

  it('lights the rails of Andrew\'s lane a second before, then slides the unit across it, and catching him is heavy', async () => {
    const { run } = await atPruitt();
    const shelves = record(run.bus, 'shelves:changed');
    const hits = record(run.bus, 'player:hit');
    const stand = inLane(2);
    let litAt = -1;
    let closingAt = -1;
    let ambientLit = false;
    let crankDown = false;
    for (let t = 0; t < SHELF.cooldownMs + 4000; t += 16) {
      await ticks(run, 16, stand);
      if (litAt < 0 && shelves.some((s) => s.phase === 'lit')) {
        litAt = t;
        ambientLit = (run.ambient()?.lights?.length ?? 0) > 0;
        crankDown = run.dressing.prop('crank')?.frame === PROP.lever.down;
      }
      if (closingAt < 0 && shelves.some((s) => s.phase === 'closing')) closingAt = t;
    }
    expect(shelves.find((s) => s.phase === 'lit')?.laneIds).toEqual(['lane2']);
    expect(ambientLit, 'the rails glow while lit').toBe(true);
    expect(crankDown).toBe(true);
    expect(closingAt - litAt).toBeGreaterThanOrEqual(SHELF.telegraphMs - 50);
    expect(closingAt - litAt).toBeLessThanOrEqual(SHELF.telegraphMs + 50);
    expect(hits.some((h) => h.weight === 'heavy' && h.source.kind === 'boss')).toBe(true);
    // The unit that closes lane 2 is unit 3: it slid west a lane's width, and the rails stopped glowing.
    expect(shelves.some((s) => s.phase === 'closed' && s.laneIds.includes('lane2'))).toBe(true);
  });

  it('the unit beside the lane ends up in it, then goes back when the lane opens', async () => {
    const { run } = await atPruitt();
    const shelves = record(run.bus, 'shelves:changed');
    const away = { x: 20 * 16, y: 12 * 16 };
    let closedCol: number | null = null;
    for (let t = 0; t < 9000 && !shelves.some((s) => s.phase === 'open'); t += 16) {
      await ticks(run, 16, away);
      const closed = shelves.filter((s) => s.phase === 'closed').at(-1);
      if (closed && closedCol === null) closedCol = unitCol(run, LANES[Number(closed.laneIds[0]!.slice(4))]!.closingUnit);
    }
    expect(closedCol).not.toBeNull();
    const lane = LANES[Number(shelves.find((s) => s.phase === 'lit')!.laneIds[0]!.slice(4))]!;
    expect(closedCol).toBe(SHELF_UNIT_COLS[lane.closingUnit]! + lane.slideTiles);
    await ticks(run, 800, away);
    expect(unitCol(run, lane.closingUnit)).toBe(SHELF_UNIT_COLS[lane.closingUnit]);
    expect(run.ambient()).toBeNull();
  });
});

describe('Pruitt, phase 2: two shelves and two agents', () => {
  it('at half health two agents come in from the east margin, the line plays, and two shelves close with one lane safe', async () => {
    const { run, boss, body } = await atPruitt();
    const shown = record(run.bus, 'dialogue:show');
    const shelves = record(run.bus, 'shelves:changed');
    const h = boss.health()!;
    body.takeHit(hit(Math.ceil(h.current - h.max * 0.48)), { x: body.pos.x - 20, y: body.pos.y });
    await ticks(run, 64);
    expect(boss.phase?.id).toBe('twoShelves');
    expect(boss.addsAlive()).toBe(PRUITT_ADDS.length);
    expect(shown.map((s) => s.sequenceId)).toContain('c5.pruitt.phase2');
    for (const a of run.fight('c5.fight.floor')?.aliveActors() ?? []) a.frozen = true;
    for (const actor of boss.aliveActors()) actor.frozen = true;
    await ticks(run, 6000, { x: 20 * 16, y: 12 * 16 });
    const lit = shelves.find((s) => s.phase === 'lit');
    expect(lit?.laneIds).toHaveLength(4);
    expect(LANES.map((l) => `lane${l.index}`).filter((l) => !lit?.laneIds.includes(l))).toHaveLength(1);
  });
});

describe('Pruitt: five o\'clock', () => {
  it('ends at the umbrella: the end scene, the umbrella shows, the stand gives it and the chapter ends', async () => {
    const { run, boss, body } = await atPruitt();
    const shown = record(run.bus, 'dialogue:show');
    const ended = record(run.bus, 'chapter:completed');
    // Before the boss is beaten the stand is only a stand.
    examine(run, 'c5.umbrella');
    await settle(run, 4);
    expect(shown.map((s) => s.sequenceId)).toContain('c5.examine.umbrellaStand');
    expect(run.player.kit.weapons).not.toContain('umbrella');
    body.takeHit(hit(9999), { x: body.pos.x - 20, y: body.pos.y });
    await settle(run, 10);
    expect(boss.isComplete()).toBe(true);
    expect(shown.map((s) => s.sequenceId)).toContain('c5.pruitt.end');
    expect(run.dressing.prop('umbrella')?.visible).toBe(true);
    expect(run.ambient()).toBeNull();
    expect(unitCol(run, 3)).toBe(SHELF_UNIT_COLS[3]);
    examine(run, 'c5.umbrella');
    await settle(run, 14);
    expect(run.player.kit.weapons).toContain('umbrella');
    expect(run.dressing.prop('umbrella')?.visible).toBe(false);
    expect(shown.map((s) => s.sequenceId)).toEqual(expect.arrayContaining(['c5.weapon.umbrella', 'c5.closing']));
    expect(ended).toHaveLength(1);
  });

  it('a Myko call finishes him without the speech, and the umbrella is still there', async () => {
    const { run, boss } = await atPruitt();
    const shown = record(run.bus, 'dialogue:show');
    boss.complete('myko');
    await settle(run, 6);
    expect(shown.map((s) => s.sequenceId)).not.toContain('c5.pruitt.end');
    expect(run.dressing.prop('umbrella')?.visible).toBe(true);
  });
});

describe('before the board', () => {
  it('Pruitt does not start until the board is solved', async () => {
    const g = await newGame();
    expect(g.run.screenId).toBe('c5.bar');
    await toStacks(g.run);
    await startPruitt(g.run);
    expect(g.run.boss(BOSS)?.active).toBe(false);
  });
});
