/**
 * Engine features for chapters 3 and 4 (docs/build/c3c4.md "Systems"): the slide puzzle, boss guard / pin / forcePhase,
 * the sweep hazard, leashed fight enemies, `lineClear`, and the deduction board using a clue from an earlier chapter.
 */

import { describe, expect, it } from 'vitest';
import { PROP } from '../../src/art/props';
import { TUNING } from '../../src/content/tuning';
import type { ChapterModule, SlidePuzzlePlacement } from '../../src/core/chapter';
import { createChapter2Sandbox } from '../../src/core/sandbox2';
import { EventBus } from '../../src/core/events';
import { seededRandom } from '../../src/core/random';
import type { BossId, CompletionSource, DeductionBoardDef, EnemyId, EvidenceId, HitInfo, SectionId, SectionKind, Vec2 } from '../../src/core/types';
import { BossRunner } from '../../src/systems/boss';
import type { BossBodyPlacement, BossWorld } from '../../src/systems/boss';
import { EnemyActor, statsFromDef } from '../../src/systems/enemies';
import type { ActorStats, CombatWorld } from '../../src/systems/enemies';
import { FightRunner } from '../../src/systems/fight';
import type { FightWorld } from '../../src/systems/fight';
import { bandClear, gridFromAscii } from '../../src/systems/grid';
import type { SectionHost } from '../../src/systems/sections';
import { SlidePuzzle } from '../../src/systems/slide';
import { advance, frame, makeRun, openGrid, placeAt, record } from './helpers';

const tile = (col: number, row: number): Vec2 => ({ x: col * 16 + 8, y: row * 16 + 8 });

// ---------------------------------------------------------------------------
// Slide puzzle
// ---------------------------------------------------------------------------

const PLACEMENT: SlidePuzzlePlacement = {
  sectionId: 'c4.puzzle.containers',
  screenId: 'c2.sandbox',
  rails: [
    { id: 'a', origin: { col: 20, row: 7 }, axis: 'across', slots: 3, length: 3, breadth: 2, start: 0, frame: PROP.crate },
    { id: 'b', origin: { col: 10, row: 3 }, axis: 'along', slots: 3, length: 2, breadth: 2, start: 1, frame: PROP.crate },
  ],
  levers: [
    { examinableId: 'test.leverA', railId: 'a', propId: 'test.leverA.prop' },
    { examinableId: 'test.leverB', railId: 'b' },
  ],
  goal: { a: 2, b: 2 },
};

function slideModule(): ChapterModule {
  const base = createChapter2Sandbox();
  const screen = base.screens[0]!;
  return {
    ...base,
    screens: [
      {
        ...screen,
        dressing: {
          ...screen.dressing,
          props: [...(screen.dressing?.props ?? []), { id: 'test.leverA.prop', frame: PROP.lever.up, col: 21, row: 5 }],
        },
      },
    ],
    examinables: [
      ...base.examinables,
      { id: 'test.leverA', screenId: 'c2.sandbox', position: tile(21, 5) },
      { id: 'test.leverB', screenId: 'c2.sandbox', position: tile(25, 5) },
    ],
    slidePuzzles: [PLACEMENT],
  };
}

const press = (run: ReturnType<typeof makeRun>['run']): void => run.tick(16, frame({ pressed: ['interact'] }));

describe('slide puzzle', () => {
  const bareHost: SectionHost = { grantReward: () => undefined, markCompleted: () => undefined };
  const mk = () => new SlidePuzzle({ id: 'c4.puzzle.containers', chapter: 4, kind: 'containers' }, PLACEMENT, bareHost, new EventBus());

  it('pulls move a piece one slot on and wrap from the last slot to 0', () => {
    const p = mk();
    expect(p.slots()).toEqual({ a: 0, b: 1 });
    expect(p.pull('a')).toBe(true);
    expect(p.slotOf('a')).toBe(1);
    p.update(TUNING.world.pushSlideMs);
    expect(p.pull('a')).toBe(true);
    p.update(TUNING.world.pushSlideMs);
    expect(p.slotOf('a')).toBe(2);
    expect(p.pull('a')).toBe(true);
    expect(p.slotOf('a')).toBe(0);
  });

  it('a piece in motion refuses a second pull, and slides over pushSlideMs', () => {
    const p = mk();
    p.pull('a');
    expect(p.pull('a')).toBe(false);
    const start = p.pieceDraw()[0]!.pos.x;
    p.update(TUNING.world.pushSlideMs / 2);
    const mid = p.pieceDraw()[0]!.pos.x;
    expect(start).toBe(20 * 16);
    expect(mid).toBeGreaterThan(start);
    expect(mid).toBeLessThan(23 * 16);
    p.update(TUNING.world.pushSlideMs);
    expect(p.pieceDraw()[0]!.pos.x).toBe(23 * 16);
  });

  it('pieces are solid by their footprint, and the swept stretch is solid while sliding', () => {
    const p = mk();
    // Rail a, slot 0: cols 20-22, rows 7-8.
    expect(p.blocks(20, 7)).toBe(true);
    expect(p.blocks(22, 8)).toBe(true);
    expect(p.blocks(23, 7)).toBe(false);
    // Rail b along, slot 1: cols 10-11, rows 5-6.
    expect(p.blocks(10, 5)).toBe(true);
    expect(p.blocks(10, 4)).toBe(false);
    p.pull('a');
    expect(p.blocks(20, 7)).toBe(true);
    expect(p.blocks(23, 7)).toBe(true);
    p.update(TUNING.world.pushSlideMs);
    expect(p.blocks(20, 7)).toBe(false);
    expect(p.blocks(23, 7)).toBe(true);
  });

  it('refuses a pull while Andrew stands where the piece would go', () => {
    const p = mk();
    expect(p.pull('a', tile(24, 7))).toBe(false);
    expect(p.slotOf('a')).toBe(0);
    expect(p.pull('a', tile(24, 12))).toBe(true);
  });

  it('completes when every rail is in its goal slot, once each slide ends; emits a pull event', () => {
    const bus = new EventBus();
    const done: string[] = [];
    const host: SectionHost = { grantReward: () => undefined, markCompleted: (id) => void done.push(id) };
    const pulls = record(bus, 'slide:pulled');
    const p = new SlidePuzzle({ id: 'c4.puzzle.containers', chapter: 4, kind: 'containers' }, PLACEMENT, host, bus);
    const pull = (id: string): void => {
      p.pull(id);
      p.update(TUNING.world.pushSlideMs);
    };
    pull('a');
    pull('a');
    expect(p.isComplete()).toBe(false);
    expect(pulls).toHaveLength(2);
    expect(pulls[0]).toEqual({ puzzleId: 'c4.puzzle.containers', railId: 'a', slot: 1 });
    // Not complete while a slide is under way; complete as it ends.
    p.pull('b');
    expect(p.isComplete()).toBe(false);
    p.update(TUNING.world.pushSlideMs);
    expect(p.slotOf('b')).toBe(2);
    expect(p.isComplete()).toBe(true);
    expect(done).toEqual(['c4.puzzle.containers']);
    expect(p.pull('a')).toBe(false);
  });

  it('completeNow moves every piece to its goal; reset puts them back', () => {
    const p = mk();
    p.pull('a');
    p.reset();
    expect(p.slots()).toEqual({ a: 0, b: 1 });
    p.completeNow('debug');
    expect(p.slots()).toEqual({ a: 2, b: 2 });
    expect(p.isComplete()).toBe(true);
  });

  it('in a run: E on the lever pulls it, flips the lever prop, blocks Andrew, completes the section', () => {
    const { run, bus } = makeRun({ module: slideModule(), chapter: 2 });
    const pulls = record(bus, 'slide:pulled');
    const puzzle = run.slidePuzzlesHere()[0]!.puzzle;
    expect(run.extraBlocked(20, 7)).toBe(true);
    placeAt(run, 21, 5);
    press(run);
    expect(pulls).toEqual([{ puzzleId: 'c4.puzzle.containers', railId: 'a', slot: 1 }]);
    expect(run.dressing.propsOn('c2.sandbox').find((x) => x.def.id === 'test.leverA.prop')?.frame).toBe(PROP.lever.down);
    advance(run, TUNING.world.pushSlideMs + 32);
    expect(run.extraBlocked(23, 7)).toBe(true);
    expect(run.extraBlocked(20, 7)).toBe(false);
    puzzle.completeNow('debug');
    expect(run.isComplete('c4.puzzle.containers')).toBe(true);
  });

  it('a load puts a half-finished puzzle back at its start', () => {
    const first = makeRun({ module: slideModule(), chapter: 2 });
    first.run.slidePuzzlesHere()[0]!.puzzle.pull('a');
    const second = makeRun({ module: slideModule(), chapter: 2 });
    expect(second.run.slidePuzzlesHere()[0]!.puzzle.slotOf('a')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Boss: guard, pin, forcePhase
// ---------------------------------------------------------------------------

interface TestHost extends SectionHost {
  completed: { id: SectionId; kind: SectionKind; by: CompletionSource }[];
}

function bossWorld() {
  const bus = new EventBus();
  const w: BossWorld & FightWorld = {
    bus,
    spawnEnemy: (id: EnemyId, pos: Vec2) => new EnemyActor(id, statsFromDef(TUNING.enemies[id]), pos, () => ({ kind: 'enemy', enemyId: id, attackId: 'x' }), seededRandom(1)),
    spawnBossBody: (id: BossId, stats: ActorStats, pos: Vec2) => new EnemyActor(null, stats, pos, () => ({ kind: 'boss', bossId: id, attackId: 'x' }), seededRandom(1)),
    defeat: (a) => {
      if (!a.down) a.knockDown();
    },
    playerIn: () => false,
  };
  const host: TestHost = { completed: [], grantReward: () => undefined, markCompleted: (id, kind, by) => void host.completed.push({ id, kind, by }) };
  return { w, bus, host };
}

const hit = (amount: number): HitInfo => ({ source: { kind: 'player', abilityId: 'punchCombo' }, targetInstanceId: 'x', amount, knockback: { x: 0, y: 0 }, stunMs: 0, holdMs: 0 });

const bodyAt = (tag: string): BossBodyPlacement => ({ tag, position: { x: 100, y: 100 }, moveSpeed: 30 });

describe('BossRunner guard, pin and forcePhase', () => {
  it('guard(front) turns away hits from within 90 degrees of the facing and says so; null lowers it', () => {
    const { w, bus, host } = bossWorld();
    const r = new BossRunner(TUNING.bosses['c3.boss.halloran'], [bodyAt('halloran')], w, host, null);
    const guarded = record(bus, 'boss:guarded');
    r.start();
    const b = r.body('halloran')!;
    b.facingDeg = 0;
    r.guard('halloran', 'front');
    const hp = b.health;
    expect(b.takeHit(hit(20), { x: 140, y: 100 })).toBe('blocked');
    expect(b.takeHit(hit(20), { x: 100, y: 140 })).toBe('blocked');
    expect(b.health).toBe(hp);
    expect(guarded).toEqual([
      { bossId: 'c3.boss.halloran', tag: 'halloran' },
      { bossId: 'c3.boss.halloran', tag: 'halloran' },
    ]);
    // From behind: past 90 degrees.
    expect(b.takeHit(hit(20), { x: 60, y: 100 })).toBe('hit');
    expect(b.health).toBe(hp - 20);
    r.guard('halloran', null);
    expect(b.takeHit(hit(20), { x: 140, y: 100 })).toBe('hit');
    expect(guarded).toHaveLength(2);
  });

  it('a dazed (stunned) guarded body takes the hit', () => {
    const { w, host } = bossWorld();
    const r = new BossRunner(TUNING.bosses['c3.boss.halloran'], [bodyAt('halloran')], w, host, null);
    r.start();
    const b = r.body('halloran')!;
    b.facingDeg = 0;
    r.guard('halloran', 'front');
    r.daze('halloran', 2500, 1);
    expect(b.takeHit(hit(20), { x: 140, y: 100 })).toBe('hit');
  });

  it('forcePhase jumps to a phase now, fires the hook and the event; unknown ids do nothing', () => {
    const { w, bus, host } = bossWorld();
    const hooked: string[] = [];
    const r = new BossRunner(TUNING.bosses['c4.boss.foreman'], [bodyAt('foreman')], w, host, null, undefined, { onPhaseChanged: (_b, p) => void hooked.push(p.id) });
    const events = record(bus, 'boss:phaseChanged');
    r.start();
    expect(r.phase?.id).toBe('crane');
    r.forcePhase('nope');
    expect(r.phase?.id).toBe('crane');
    r.forcePhase('onFoot');
    expect(r.phase?.id).toBe('onFoot');
    expect(hooked).toEqual(['crane', 'onFoot']);
    expect(events.map((e) => e.phaseId)).toEqual(['crane', 'onFoot']);
    expect(r.body('foreman')?.attacks).toEqual(TUNING.bosses['c4.boss.foreman'].phases[1]?.attacks);
    r.forcePhase('onFoot');
    expect(hooked).toHaveLength(2);
  });
});

function combatWorld(player: Vec2): CombatWorld & { hits: number } {
  const w: CombatWorld & { hits: number } = {
    grid: openGrid(),
    bus: new EventBus(),
    rng: seededRandom(3),
    screenId: 'c1.test',
    hits: 0,
    playerPosition: () => player,
    playerTargetable: () => true,
    hitPlayer: () => {
      w.hits++;
      return true;
    },
    spawnProjectile: () => undefined,
    extraBlocked: () => false,
    actors: () => [],
  };
  return w;
}

describe('pinned bodies and leashed enemies', () => {
  it('a pinned body stays at its post, faces Andrew, never attacks, and can still be hit', () => {
    const { w, host } = bossWorld();
    const r = new BossRunner(TUNING.bosses['c4.boss.foreman'], [bodyAt('foreman')], w, host, null);
    r.start();
    const b = r.body('foreman')!;
    const at = { x: 60, y: 60 };
    r.pin('foreman', at);
    const cw = combatWorld({ x: 62, y: 100 });
    for (let i = 0; i < 300; i++) b.tick(16, cw);
    expect(b.pos).toEqual(at);
    expect(cw.hits).toBe(0);
    expect(b.currentAttack).toBeNull();
    expect(Math.round(b.facingDeg)).toBe(87);
    const hp = b.health;
    expect(b.takeHit({ ...hit(10), knockback: { x: 200, y: 0 } }, { x: 62, y: 100 })).toBe('hit');
    b.tick(16, cw);
    expect(b.health).toBe(hp - 10);
    expect(b.pos).toEqual(at);
    r.pin('foreman', null);
    for (let i = 0; i < 100; i++) b.tick(16, cw);
    expect(b.pos).not.toEqual(at);
  });

  it('a leashed enemy never leaves its area, even chasing Andrew or knocked back', () => {
    const a = new EnemyActor('worker', statsFromDef(TUNING.enemies.worker), { x: 100, y: 100 }, () => ({ kind: 'enemy', enemyId: 'worker', attackId: 'x' }), seededRandom(2));
    a.leash = { x: 80, y: 80, width: 40, height: 40 };
    const cw = combatWorld({ x: 100, y: 200 });
    for (let i = 0; i < 400; i++) {
      a.tick(16, cw);
      expect(a.pos.x).toBeGreaterThanOrEqual(80);
      expect(a.pos.x).toBeLessThanOrEqual(120);
      expect(a.pos.y).toBeGreaterThanOrEqual(80);
      expect(a.pos.y).toBeLessThanOrEqual(120);
    }
    a.takeHit({ ...hit(1), knockback: { x: 4000, y: 4000 } }, { x: 0, y: 0 });
    for (let i = 0; i < 60; i++) a.tick(16, cw);
    expect(a.pos.x).toBeLessThanOrEqual(120);
    expect(a.pos.y).toBeLessThanOrEqual(120);
  });

  it('FightRunner spawns zoned enemies inside their zone, leashed, and others at the spawn points', () => {
    const { w, host } = bossWorld();
    const spawned: EnemyActor[] = [];
    const world: FightWorld = { ...w, spawnEnemy: (id, pos) => (spawned[spawned.push(w.spawnEnemy(id, pos)) - 1] as EnemyActor) };
    const zone = { x: 200, y: 40, width: 100, height: 20 };
    const f = new FightRunner(TUNING.fights['c3.fight.bay']!, [{ x: 10, y: 10 }], world, host, undefined, {}, [{ enemyId: 'worker', area: zone }]);
    f.start();
    const workers = spawned.filter((a) => a.enemyId === 'worker');
    const others = spawned.filter((a) => a.enemyId !== 'worker');
    expect(workers).toHaveLength(4);
    expect(new Set(workers.map((a) => a.pos.x)).size).toBe(4);
    for (const a of workers) {
      expect(a.pos.x).toBeGreaterThanOrEqual(zone.x);
      expect(a.pos.x).toBeLessThanOrEqual(zone.x + zone.width);
      expect(a.leash).toEqual(zone);
    }
    for (const a of others) {
      expect(a.leash).toBeNull();
      expect(a.pos).toEqual({ x: 10, y: 10 });
    }
  });

  it('in a run, a fight placement with zones leashes its workers', () => {
    const base = createChapter2Sandbox();
    const zone = { x: 20 * 16, y: 2 * 16, width: 4 * 16, height: 2 * 16 };
    const module: ChapterModule = {
      ...base,
      fights: [{ sectionId: 'c3.fight.bay', screenId: 'c2.sandbox', trigger: { kind: 'script' }, spawnPoints: [tile(12, 8)], entrance: tile(10, 8), zones: [{ enemyId: 'worker', area: zone }] }],
    };
    const { run } = makeRun({ module, chapter: 2 });
    run.startSection('c3.fight.bay');
    const workers = run.fight('c3.fight.bay')!.aliveActors().filter((a) => a.enemyId === 'worker');
    expect(workers.length).toBe(4);
    for (const a of workers) expect(a.leash).toEqual(zone);
    advance(run, 2000);
    for (const a of workers) {
      expect(a.pos.x).toBeGreaterThanOrEqual(zone.x);
      expect(a.pos.x).toBeLessThanOrEqual(zone.x + zone.width);
      expect(a.pos.y).toBeGreaterThanOrEqual(zone.y);
      expect(a.pos.y).toBeLessThanOrEqual(zone.y + zone.height);
    }
  });
});

// ---------------------------------------------------------------------------
// Sweep hazard
// ---------------------------------------------------------------------------

describe('sweepHazard', () => {
  const SWEEP = {
    from: tile(30, 11),
    to: tile(50, 11),
    width: 24,
    telegraphMs: 400,
    travelMs: 1000,
    weight: 'heavy' as const,
    knockback: 120,
    frame: PROP.crate,
    shadowFrame: PROP.crate,
  };
  // The ram's lane (rows 15-17) in the sandbox is open; sweep along row 16.
  const LANE = { ...SWEEP, from: tile(14, 16), to: tile(50, 16) };

  it('shows its shadow first, then moves; hits Andrew once per pass at the heavy weight', async () => {
    const { run, bus } = makeRun({ module: createChapter2Sandbox(), chapter: 2 });
    const swept = record(bus, 'hazard:swept');
    const hits = record(bus, 'player:hit');
    placeAt(run, 30, 16);
    let ended = false;
    void run.sweepHazard(LANE).then(() => {
      ended = true;
    });
    // Telegraph: he stands in the path and nothing happens.
    advance(run, 300);
    expect(hits).toHaveLength(0);
    expect(run.sweepsHere()[0]?.moving).toBe(false);
    advance(run, 400);
    expect(swept.map((s) => s.phase)).toContain('moving');
    expect(run.sweepsHere()[0]?.moving).toBe(true);
    advance(run, 2000);
    await Promise.resolve();
    expect(hits).toHaveLength(1);
    expect(hits[0]?.weight).toBe('heavy');
    expect(swept.filter((s) => s.phase === 'hit')).toHaveLength(1);
    expect(ended).toBe(true);
    expect(run.sweepsHere()).toHaveLength(0);
  });

  it('misses Andrew when he is clear of the band, and hurts no enemy', () => {
    const { run } = makeRun({ module: createChapter2Sandbox(), chapter: 2 });
    const hits = record(run.bus, 'player:hit');
    placeAt(run, 30, 4);
    const enemy = run.spawnEnemy('worker', tile(30, 16));
    const hp = enemy.health;
    void run.sweepHazard(LANE);
    advance(run, 2000);
    expect(hits).toHaveLength(0);
    expect(enemy.health).toBe(hp);
  });

  it('a return to the bar cancels it and resolves the promise', () => {
    const { run } = makeRun({ module: createChapter2Sandbox(), chapter: 2 });
    let ended = false;
    void run.sweepHazard(LANE).then(() => {
      ended = true;
    });
    advance(run, 100);
    expect(ended).toBe(false);
    run.dispose();
    return Promise.resolve().then(() => {
      expect(ended).toBe(true);
      expect(run.sweepsHere()).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// lineClear
// ---------------------------------------------------------------------------

describe('bandClear', () => {
  const grid = gridFromAscii(['##########', '#........#', '#...#....#', '#........#', '##########']);
  const blocked = (c: number, r: number): boolean => grid.blocked[r * grid.widthTiles + c] === true || c < 0 || r < 0 || c >= grid.widthTiles || r >= grid.heightTiles;

  it('is clear along an open row and blocked through a wall tile', () => {
    expect(bandClear(tile(1, 1), tile(8, 1), 8, blocked)).toBe(true);
    expect(bandClear(tile(1, 2), tile(8, 2), 8, blocked)).toBe(false);
  });

  it('width matters: a wide band grazes a tile a thin one misses', () => {
    expect(bandClear(tile(1, 3), tile(8, 3), 8, (c, r) => c === 4 && r === 2)).toBe(true);
    expect(bandClear(tile(1, 3), tile(8, 3), 30, (c, r) => c === 4 && r === 2)).toBe(false);
  });
});

describe('ChapterContext.lineClear', () => {
  it('sees solid props, NPCs, puzzle pieces and walls; breakables only when asked', () => {
    const { run } = makeRun({ module: slideModule(), chapter: 2 });
    // The yard row 1 is open from col 2 to col 12 until the turf at 18; a puzzle piece (rail a) sits at cols 20-22, rows 7-8.
    expect(run.lineClear(tile(15, 8), tile(19, 8), 8)).toBe(true);
    expect(run.lineClear(tile(15, 8), tile(24, 8), 8)).toBe(false);
    // Rail a moved on: the line is clear again past col 22 but blocked at col 23.
    run.slidePuzzlesHere()[0]!.puzzle.pull('a');
    advance(run, TUNING.world.pushSlideMs + 32);
    expect(run.lineClear(tile(15, 8), tile(21, 8), 8)).toBe(true);
    expect(run.lineClear(tile(15, 8), tile(24, 8), 8)).toBe(false);
    // The yard's buckets (breakable, solid) at cols 24-25, row 5.
    expect(run.lineClear(tile(22, 5), tile(28, 5), 8)).toBe(false);
    expect(run.lineClear(tile(22, 5), tile(28, 5), 8, { ignoreBreakables: true })).toBe(true);
    // Out of the map is walls.
    expect(run.lineClear(tile(2, 2), tile(2, -3), 8)).toBe(false);
  });

  it('a visible NPC blocks (solid or not); a hidden one does not', () => {
    const base = createChapter2Sandbox();
    const screen = base.screens[0]!;
    const module: ChapterModule = {
      ...base,
      screens: [{ ...screen, dressing: { ...screen.dressing, npcs: [{ id: 'test.npc', npc: 'myko', col: 30, row: 8, facing: 'down' } as never] } }],
    };
    const { run } = makeRun({ module, chapter: 2 });
    expect(run.lineClear(tile(26, 8), tile(32, 8), 8)).toBe(false);
    expect(run.lineClear(tile(26, 6), tile(32, 6), 8)).toBe(true);
    run.setNpcVisible('test.npc', false);
    expect(run.lineClear(tile(26, 8), tile(32, 8), 8)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Deduction board and evidence across chapters
// ---------------------------------------------------------------------------

describe('deduction board with a clue from an earlier chapter', () => {
  const ev = (id: string): EvidenceId => id as EvidenceId;
  const board: DeductionBoardDef = {
    id: 'c3.deduction.office' as DeductionBoardDef['id'],
    chapter: 3,
    candidateIds: [ev('c2.clue.fragment'), ev('c3.clue.map'), ev('c3.clue.brochure'), ev('c3.clue.manifest')],
    solution: [ev('c2.clue.fragment'), ev('c3.clue.map'), ev('c3.clue.manifest')],
    wrongAnswerDialogueIds: [],
    leadTextId: 'ui.title',
    leadMarginTextId: 'ui.title',
  } as unknown as DeductionBoardDef;

  it('offers and accepts last chapter\'s clue; evidence survives carry-over to the next chapter', () => {
    const base = createChapter2Sandbox();
    const module: ChapterModule = { ...base, def: { ...base.def, deductionBoard: board } };
    const { run } = makeRun({
      module,
      chapter: 2,
      save: (s) => ({ ...s, casebook: [{ kind: 'evidence', evidenceId: ev('c2.clue.fragment'), chapter: 2 }] }),
    });
    run.addEvidence(ev('c3.clue.map'));
    run.addEvidence(ev('c3.clue.manifest'));
    run.openDeduction();
    expect(run.activeDeduction()?.candidates()).toEqual([ev('c2.clue.fragment'), ev('c3.clue.map'), ev('c3.clue.manifest')]);
    expect(run.submitDeduction(board.id, [ev('c2.clue.fragment'), ev('c3.clue.map'), ev('c3.clue.manifest')])).toBe(true);
    // The next chapter's start save keeps every clue found so far.
    const snap = run.snapshot();
    expect(snap.casebook.filter((e) => e.kind === 'evidence').map((e) => (e.kind === 'evidence' ? e.evidenceId : ''))).toEqual(
      expect.arrayContaining(['c2.clue.fragment', 'c3.clue.map', 'c3.clue.manifest']),
    );
  });
});
