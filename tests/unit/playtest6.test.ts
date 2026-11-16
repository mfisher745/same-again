/**
 * Playtest 6: plainer chapter 1 opening (Myko on drinking before the first pint), the dispensers say why they will
 * not pour, the dispenser's steam shows its one free charge, commentary never holds up a waiting scene, and separate
 * beer and spirit limits (the limits themselves are in overhaul-kit.test.ts).
 */

import { describe, expect, it } from 'vitest';
import { chapter1 } from '../../src/chapters/01/index';
import { chapter2 } from '../../src/chapters/02/index';
import { DialogueQueue } from '../../src/ui/model/dialogue';
import type { DialogueSequence } from '../../src/core/types';
import type { ChapterScript } from '../../src/systems';
import { NO_INPUT, record, settleDialogue, startChapterGame } from './helpers';

/** E on an examinable, straight to the chapter script (the walk up to it is not what is under test). */
const examine = (run: object, id: string): void => void (run as { script: ChapterScript }).script.onExamine?.(id);
/** The last of these lines shown since `from`, if any. */
const lastOf = (lines: { sequenceId: string }[], ids: readonly string[]): string | undefined => [...lines].reverse().find((l) => ids.includes(l.sequenceId))?.sequenceId;
const URN = ['c1.urn.notYet', 'c1.urn.held', 'c1.urn.spent'] as const;
const FLASK = ['c2.flask.held', 'c2.flask.spent'] as const;

const shown = (run: { bus: Parameters<typeof record>[0] }) => record(run.bus, 'dialogue:show');

describe('chapter 1: drinking before Dympna has poured', () => {
  it('the first refusal brings Myko’s line on what to do, once; the HUD refusal keeps its reason', async () => {
    const { run } = startChapterGame(chapter1, 'new');
    run.tick(16, NO_INPUT);
    await settleDialogue(run);
    const lines = shown(run);
    const refused = record(run.bus, 'kit:useRefused');
    run.give({ kind: 'drink', drinkId: 'stout', count: 1 });
    run.selectItem('stout');
    expect(run.useSelected()).toBe(false);
    await settleDialogue(run);
    expect(run.useSelected()).toBe(false);
    await settleDialogue(run);
    expect(refused.every((r) => r.reason === 'meterHidden' && r.textId === 'ui.use.notYet')).toBe(true);
    expect(lines.filter((l) => l.sequenceId === 'c1.pub.notYet')).toHaveLength(1);
  });
});

describe('the dispensers say why they will not pour', () => {
  it('chapter 1: the urn before item four, with one already held, and once it is spent', async () => {
    const { run } = startChapterGame(chapter1, 'new');
    run.tick(16, NO_INPUT);
    await settleDialogue(run);
    const lines = shown(run);
    const urn = () => examine(run, 'c1.urn');
    urn();
    expect(lastOf(lines, URN)).toBe('c1.urn.notYet');
    // Mashing E does not stack the line up.
    for (let i = 0; i < 5; i++) urn();
    await settleDialogue(run);
    expect(lines.filter((l) => l.sequenceId === 'c1.urn.notYet')).toHaveLength(1);
    await settleDialogue(run);
    run.setFlag('pub.step', 5);
    expect(run.takeHotDrink('tea')).toBe(true);
    urn();
    expect(lastOf(lines, URN)).toBe('c1.urn.held');
    await settleDialogue(run);
    run.setMeterHidden(false); // past the first pint, as the list would be by item five
    run.selectItem('tea');
    expect(run.useSelected()).toBe(true);
    urn();
    await settleDialogue(run); // queued behind Myko's line on the tea
    expect(lastOf(lines, URN)).toBe('c1.urn.spent');
  });

  it('the urn steams while its free hot drink can be taken, and stops once it is taken', async () => {
    const { run } = startChapterGame(chapter1, 'new');
    run.tick(16, NO_INPUT);
    await settleDialogue(run);
    expect(run.dressing.prop('urn.steam')?.visible).toBe(true);
    run.setFlag('pub.step', 4);
    expect(run.takeHotDrink('coffee')).toBe(true);
    expect(run.dressing.prop('urn.steam')?.visible).toBe(false);
  });

  it('chapter 2: the flask has a free drink at the start, steams, and says why when it will not pour', async () => {
    const { run } = startChapterGame(chapter2, 'chapter');
    run.tick(16, NO_INPUT);
    await settleDialogue(run);
    expect(run.hotDrinkOffered()).toBe(true);
    expect(run.dressing.prop('bar.steam')?.visible).toBe(true);
    const lines = shown(run);
    expect(run.takeHotDrink('tea')).toBe(true);
    expect(run.dressing.prop('bar.steam')?.visible).toBe(false);
    examine(run, 'c2.flask');
    expect(lastOf(lines, FLASK)).toBe('c2.flask.held');
    await settleDialogue(run);
    run.selectItem('tea');
    expect(run.useSelected()).toBe(true);
    examine(run, 'c2.flask');
    await settleDialogue(run);
    expect(lastOf(lines, FLASK)).toBe('c2.flask.spent');
  });
});

describe('commentary never holds up a scene', () => {
  const seqs: DialogueSequence[] = [
    { id: 'b', delivery: 'box', lines: [{ id: 'b.1', speaker: 'myko', text: 'A long bit of commentary.' }, { id: 'b.2', speaker: 'myko', text: 'And more.' }] },
    { id: 's', delivery: 'scene', lines: [{ id: 's.1', speaker: 'dympna', text: 'Item one.' }] },
  ];
  const make = () => {
    const finished: string[] = [];
    const q = new DialogueQueue({ lookup: (id) => seqs.find((s) => s.id === id) as DialogueSequence, speakerName: () => null, onFinished: (id) => void finished.push(id) });
    return { q, finished };
  };

  it('E does nothing to a box on its own', () => {
    const { q, finished } = make();
    q.enqueue('b');
    q.update(5000);
    q.advance();
    q.advance();
    expect(finished).toEqual([]);
    expect(q.view()?.awaitingAdvance).toBe(false);
  });

  it('with a scene waiting behind it, E skips the box and the scene comes up', () => {
    const { q, finished } = make();
    q.enqueue('b');
    q.enqueue('s');
    q.update(5000);
    expect(q.view()?.awaitingAdvance).toBe(true);
    q.advance();
    q.advance();
    q.advance();
    expect(finished).toEqual(['b']);
    expect(q.blocking).toBe(true);
    expect(q.view()?.sequenceId).toBe('s');
  });
});

describe('breakables are scattered, never in the way (playtest 6)', () => {
  for (const module of [chapter1, chapter2]) {
    for (const screen of module.screens) {
      const props = screen.dressing?.props ?? [];
      const breakables = props.filter((p) => p.breakable);
      if (breakables.length === 0) continue;

      it(`${screen.id}: each sits on open ground and overlaps no other solid, NPC, pickup, examinable or exit`, () => {
        const g = screen.grid;
        const taken = new Map<string, string>();
        const mark = (c: number, r: number, what: string) => taken.set(`${c},${r}`, what);
        for (const p of props) {
          if (p.breakable || !p.solid) continue;
          for (let y = 0; y < p.solid.height; y++) for (let x = 0; x < p.solid.width; x++) mark(p.col + (p.solid.dx ?? 0) + x, p.row + (p.solid.dy ?? 0) + y, p.id ?? p.frame);
        }
        for (const n of screen.dressing?.npcs ?? []) mark(n.col, n.row, n.id ?? n.npc);
        for (const p of module.pickups.filter((q) => q.screenId === screen.id)) mark(Math.floor(p.position.x / 16), Math.floor(p.position.y / 16), p.id);
        for (const e of module.examinables.filter((q) => q.screenId === screen.id)) mark(Math.floor(e.position.x / 16), Math.floor(e.position.y / 16), e.id);
        for (const e of screen.exits) for (let y = e.area.y; y < e.area.y + e.area.height; y += 16) for (let x = e.area.x; x < e.area.x + e.area.width; x += 16) mark(x / 16, y / 16, e.id);
        for (const b of breakables) {
          const id = b.id ?? b.frame;
          expect(g.blocked[b.row * g.widthTiles + b.col], `${id} on a wall`).toBe(false);
          expect(taken.get(`${b.col},${b.row}`), `${id} overlaps`).toBeUndefined();
          mark(b.col, b.row, id);
        }
      });

      it(`${screen.id}: with every breakable standing, every exit and pickup that could be walked to still can be`, () => {
        const g = screen.grid;
        const solids = (withBreakables: boolean): Set<string> => {
          const out = new Set<string>();
          for (const p of props) {
            if (!p.solid || p.hidden || (p.breakable && !withBreakables)) continue;
            for (let y = 0; y < p.solid.height; y++) for (let x = 0; x < p.solid.width; x++) out.add(`${p.col + (p.solid.dx ?? 0) + x},${p.row + (p.solid.dy ?? 0) + y}`);
          }
          return out;
        };
        const reach = (solid: Set<string>): Set<string> => {
          const start = { col: Math.floor(screen.playerStart.x / 16), row: Math.floor(screen.playerStart.y / 16) };
          const seen = new Set([`${start.col},${start.row}`]);
          const queue = [start];
          for (let t = queue.shift(); t !== undefined; t = queue.shift()) {
            for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
              const c = t.col + dc;
              const r = t.row + dr;
              if (c < 0 || r < 0 || c >= g.widthTiles || r >= g.heightTiles || g.blocked[r * g.widthTiles + c] || solid.has(`${c},${r}`) || seen.has(`${c},${r}`)) continue;
              seen.add(`${c},${r}`);
              queue.push({ col: c, row: r });
            }
          }
          return seen;
        };
        const open = reach(solids(false));
        const withThem = reach(solids(true));
        const places = [
          ...screen.exits.map((e) => ({ id: e.id, key: `${Math.floor(e.area.x / 16)},${Math.floor(e.area.y / 16)}` })),
          ...module.pickups.filter((q) => q.screenId === screen.id).map((p) => ({ id: p.id, key: `${Math.floor(p.position.x / 16)},${Math.floor(p.position.y / 16)}` })),
        ];
        // The naggin is meant to be behind the bins: breaking them is the throw lesson.
        const behindOnPurpose = new Set(['c1.pickup.naggin']);
        for (const pl of places) if (open.has(pl.key) && !behindOnPurpose.has(pl.id)) expect(withThem.has(pl.key), pl.id).toBe(true);
        // And every breakable can be walked up to, wherever its spot can be reached at all (a shut gate shuts both).
        const nextTo = (set: Set<string>, c: number, r: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => set.has(`${c + (dc ?? 0)},${r + (dr ?? 0)}`));
        for (const b of breakables) if (nextTo(open, b.col, b.row)) expect(nextTo(withThem, b.col, b.row), `${b.id ?? b.frame} can be reached`).toBe(true);
      });
    }
  }
});
