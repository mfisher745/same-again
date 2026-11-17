/** Chapter 5 and 6 systems, pure: the maze, the lightbox, the corn field, the shelves. */

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/content/tuning';
import { EventBus } from '../../src/core/events';
import { seededRandom } from '../../src/core/random';
import type { HitInfo, Vec2 } from '../../src/core/types';
import { CornField } from '../../src/systems/corn';
import { MazePuzzle } from '../../src/systems/maze';
import { RedactionPuzzle } from '../../src/systems/redaction';
import type { SectionHost } from '../../src/systems/sections';
import { ShelfDirector, shelfGroupings } from '../../src/systems/shelves';
import type { ShelfHost } from '../../src/systems/shelves';
import { canHear } from '../../src/systems/stealth';
import { record } from './helpers';

const host: SectionHost = { grantReward: () => undefined, markCompleted: () => undefined };

describe('maze puzzle', () => {
  const placement = {
    sectionId: 'c6.puzzle.maze' as const,
    screenId: 'c6.fields' as const,
    stones: [
      { id: 'a', position: { x: 100, y: 100 } },
      { id: 'b', position: { x: 200, y: 100 } },
      { id: 'c', position: { x: 300, y: 100 } },
    ],
    order: ['b', 'a', 'c'],
  };
  const make = () => {
    const bus = new EventBus();
    const p = new MazePuzzle({ id: 'c6.puzzle.maze', chapter: 6, kind: 'maze' }, placement, host, bus);
    return { p, bus };
  };
  const step = (p: MazePuzzle, at: Vec2): void => {
    p.update(at);
    p.update({ x: 0, y: 0 });
  };

  it('lights stones in order and solves on the third', () => {
    const { p, bus } = make();
    const seen = record(bus, 'maze:stone');
    step(p, { x: 200, y: 100 });
    step(p, { x: 100, y: 100 });
    expect(p.litStones()).toEqual(['b', 'a']);
    expect(p.isComplete()).toBe(false);
    step(p, { x: 300, y: 100 });
    expect(p.isComplete()).toBe(true);
    expect(seen.map((e) => e.outcome)).toEqual(['right', 'right', 'solved']);
  });

  it('a wrong stone resets all three', () => {
    const { p, bus } = make();
    const seen = record(bus, 'maze:stone');
    step(p, { x: 200, y: 100 });
    step(p, { x: 300, y: 100 });
    expect(p.litStones()).toEqual([]);
    expect(seen[1]?.outcome).toBe('wrong');
    step(p, { x: 200, y: 100 });
    expect(p.litStones()).toEqual(['b']);
  });

  it('standing on a stone counts once, and a lit stone is ignored', () => {
    const { p } = make();
    p.update({ x: 200, y: 100 });
    p.update({ x: 200, y: 100 });
    expect(p.litStones()).toEqual(['b']);
    step(p, { x: 200, y: 100 });
    expect(p.litStones()).toEqual(['b']);
  });

  it('completeNow solves it', () => {
    const { p } = make();
    p.completeNow('myko');
    expect(p.isComplete()).toBe(true);
    expect(p.litStones()).toEqual(['b', 'a', 'c']);
  });
});

describe('redaction puzzle', () => {
  const layout = {
    sheets: ['s1', 's2', 's3', 's4', 's5'].map((id) => ({ id })),
    correct: ['s1', 's3', 's4'] as [string, string, string],
    rightTextId: 'c5.redacted.right',
    wrongTextId: 'c5.redacted.wrong',
    promptTextId: 'c5.redacted.prompt',
  } as const;
  const make = () => {
    const bus = new EventBus();
    const p = new RedactionPuzzle({ id: 'c5.puzzle.redacted', chapter: 5, kind: 'redacted' }, layout, host, bus);
    return { p, bus };
  };

  it('needs three distinct collected sheets', () => {
    const { p } = make();
    expect(p.submit(['s1', 's3', 's4']).refused).toBe(true);
    for (const id of ['s1', 's2', 's3', 's4', 's5']) p.collect(id);
    expect(p.allCollected()).toBe(true);
    expect(p.submit(['s1', 's1', 's3']).refused).toBe(true);
    expect(p.submit(['s1', 's3']).refused).toBe(true);
  });

  it('a wrong set shows the useless sentence and costs nothing; the right set solves, in any order', () => {
    const { p, bus } = make();
    const tried = record(bus, 'redaction:tried');
    for (const s of layout.sheets) p.collect(s.id);
    const wrong = p.submit(['s1', 's2', 's3']);
    expect(wrong).toEqual({ correct: false, textId: 'c5.redacted.wrong', refused: false });
    expect(p.isComplete()).toBe(false);
    const right = p.submit(['s4', 's1', 's3']);
    expect(right.textId).toBe('c5.redacted.right');
    expect(p.isComplete()).toBe(true);
    expect(tried.map((t) => t.correct)).toEqual([false, true]);
  });

  it('the view lists which sheets are held, and completeNow solves it', () => {
    const { p } = make();
    p.collect('s2');
    expect(p.view().sheets.filter((s) => s.collected).map((s) => s.id)).toEqual(['s2']);
    expect(p.collect('s2')).toBe(false);
    p.completeNow('debug');
    expect(p.isComplete()).toBe(true);
    expect(p.allCollected()).toBe(true);
  });
});

describe('corn field', () => {
  it('marks tiles, cuts what a rectangle touches, regrows', () => {
    const f = new CornField();
    f.mark('c6.fields', [{ col: 2, row: 2, width: 4, height: 2 }]);
    expect(f.isStanding('c6.fields', 2, 2)).toBe(true);
    expect(f.isStanding('c6.fields', 6, 2)).toBe(false);
    const cut = f.cut('c6.fields', { x: 3 * 16, y: 2 * 16, width: 32, height: 16 });
    expect(cut).toEqual([{ col: 3, row: 2 }, { col: 4, row: 2 }]);
    expect(f.isStanding('c6.fields', 3, 2)).toBe(false);
    expect(f.cut('c6.fields', { x: 3 * 16, y: 2 * 16, width: 32, height: 16 })).toEqual([]);
    expect(f.regrow('c6.fields')).toHaveLength(2);
    expect(f.standingTiles('c6.fields')).toHaveLength(8);
  });
});

describe('rustle noise', () => {
  it('reaches a deaf drone inside its radius, and only inside it', () => {
    const n = { kind: 'rustle' as const, position: { x: 50, y: 0 }, radius: 56 };
    expect(canHear({ x: 0, y: 0 }, 0, n)).toBe(true);
    expect(canHear({ x: -10, y: 0 }, 0, n)).toBe(false);
    expect(canHear({ x: 0, y: 0 }, 0, { ...n, kind: 'bottle' })).toBe(false);
  });
});

describe('rolling shelves', () => {
  const lanes = [0, 1, 2, 3, 4].map((i) => ({ id: `lane${i}`, area: { x: i * 48, y: 0, width: 32, height: 160 }, travel: 'right' as const }));
  const pruitt = TUNING.bosses['c5.boss.pruitt1'];
  const phase1 = pruitt.phases[0]!;
  const phase2 = pruitt.phases[1]!;

  const make = (pos: Vec2) => {
    const hits: Omit<HitInfo, 'targetInstanceId'>[] = [];
    const pushes: { d: number; a: number }[] = [];
    const bus = new EventBus();
    const state = { pos, targetable: true };
    const h: ShelfHost = {
      bus,
      rng: seededRandom(3),
      playerPosition: () => state.pos,
      playerTargetable: () => state.targetable,
      hitPlayer: (hit) => {
        hits.push(hit);
        return true;
      },
      pushPlayer: (d, a) => void pushes.push({ d, a }),
    };
    const d = new ShelfDirector('c5.boss.pruitt1', { lanes }, h);
    return { d, hits, pushes, bus, state };
  };
  const run = (d: ShelfDirector, ms: number, phase = phase1): void => {
    for (let t = 0; t < ms; t += 16) d.tick(16, phase, true);
  };

  it('groups: one lane each, or two pairs leaving one safe lane', () => {
    expect(shelfGroupings(5, 1, 1)).toHaveLength(5);
    const pairs = shelfGroupings(5, 2, 2);
    expect(pairs).toHaveLength(3);
    for (const g of pairs) expect(new Set(g.flat()).size).toBe(4);
  });

  it('phase 1: lights the lane Andrew is in, one second before it closes, then catches him heavy and pushes him out', () => {
    const shelf = phase1.attacks.find((a) => a.id === 'shelf')!;
    const { d, hits, pushes, bus } = make({ x: 2 * 48 + 16, y: 80 });
    const seen = record(bus, 'shelves:changed');
    run(d, shelf.cooldownMs + 40);
    const lit = seen.find((e) => e.phase === 'lit');
    expect(lit?.laneIds).toEqual(['lane2']);
    run(d, shelf.telegraphMs - 100);
    expect(seen.some((e) => e.phase === 'closing')).toBe(false);
    run(d, 100 + TUNING.overhaul!.shelves!.slideMs);
    expect(seen.some((e) => e.phase === 'closing')).toBe(true);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.weight).toBe('heavy');
    expect(pushes.length).toBeGreaterThan(0);
    expect(seen.some((e) => e.phase === 'caught')).toBe(true);
  });

  it('stepping out during the light means no hit', () => {
    const shelf = phase1.attacks.find((a) => a.id === 'shelf')!;
    const { d, hits, state } = make({ x: 2 * 48 + 16, y: 80 });
    run(d, shelf.cooldownMs + 40);
    state.pos = { x: 4 * 48 + 16, y: 80 };
    run(d, shelf.telegraphMs + 2000);
    expect(hits).toHaveLength(0);
  });

  it('phase 2: two shelves at once close four lanes and leave one safe', () => {
    const { d, bus } = make({ x: 16, y: 80 });
    const seen = record(bus, 'shelves:changed');
    const shelf = phase2.attacks.find((a) => a.id === 'shelf')!;
    run(d, shelf.cooldownMs / phase2.attackSpeedMultiplier + 40, phase2);
    const lit = seen.find((e) => e.phase === 'lit');
    expect(lit?.laneIds).toHaveLength(4);
  });

  it('does nothing while the boss is not running, and resets', () => {
    const { d, bus } = make({ x: 16, y: 80 });
    const seen = record(bus, 'shelves:changed');
    for (let t = 0; t < 20000; t += 16) d.tick(16, phase1, false);
    expect(seen).toEqual([]);
    expect(d.laneStates().every((l) => l.state === 'open')).toBe(true);
  });
});
