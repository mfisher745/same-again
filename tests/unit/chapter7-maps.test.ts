/**
 * Chapter 7 layout: screens load at spec size, exits pair up and land on walkable ground, everything is reachable,
 * the figures, clerks and arena match the spec, examinables have dialogue and ids are unique.
 */

import { describe, expect, it } from 'vitest';
import { chapter7 } from '../../src/chapters/07/index';
import {
  ALIEN_FIGURES,
  FIGURES,
  MASCOT_ARENA,
  MASCOT_BOTTLE_SPOTS,
  MASCOT_FORMATION,
  RACK_SPOT,
  STOCK_EXIT,
  STOCK_START,
  STOCK_STEALTH,
  STRIP_CROWD_SPOTS,
  TOURIST_FIGURES,
  YARD_AREA,
  YARD_BOTTLE_SPOTS,
  YARD_SPAWNS,
  ZIP_TUMBLE_LINE,
} from '../../src/chapters/07/maps';
import { hasSequence, hasText } from '../../src/content/dialogue';
import { TUNING } from '../../src/content/tuning';
import type { AreaRect, ExitDef, ScreenLayout } from '../../src/core/chapter';
import type { ScreenId, Vec2 } from '../../src/core/types';

const screen = (id: ScreenId): ScreenLayout => {
  const s = chapter7.screens.find((x) => x.id === id);
  if (!s) throw new Error(`no screen ${id}`);
  return s;
};
const tileOf = (p: Vec2) => ({ col: Math.floor(p.x / 16), row: Math.floor(p.y / 16) });

/** Tiles blocked by the grid or by a visible solid prop (`skip` ids are treated as gone, like the maze gate once solved). */
function blockedSet(s: ScreenLayout, skip: readonly string[] = []): Set<string> {
  const blocked = new Set<string>();
  const g = s.grid;
  for (let r = 0; r < g.heightTiles; r++) for (let c = 0; c < g.widthTiles; c++) if (g.blocked[r * g.widthTiles + c]) blocked.add(`${c},${r}`);
  for (const p of s.dressing?.props ?? []) {
    if (!p.solid || p.hidden || (p.id !== undefined && skip.includes(p.id))) continue;
    for (let dy = 0; dy < p.solid.height; dy++) for (let dx = 0; dx < p.solid.width; dx++) blocked.add(`${p.col + (p.solid.dx ?? 0) + dx},${p.row + (p.solid.dy ?? 0) + dy}`);
  }
  for (const n of s.dressing?.npcs ?? []) if (n.solid) blocked.add(`${n.col},${n.row}`);
  return blocked;
}

function flood(s: ScreenLayout, from: Vec2, skip: readonly string[] = []): Set<string> {
  const blocked = blockedSet(s, skip);
  const seen = new Set<string>();
  const start = tileOf(from);
  const queue = [start];
  seen.add(`${start.col},${start.row}`);
  for (let t = queue.shift(); t !== undefined; t = queue.shift()) {
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const col = t.col + dc;
      const row = t.row + dr;
      const k = `${col},${row}`;
      if (col < 0 || row < 0 || col >= s.grid.widthTiles || row >= s.grid.heightTiles || blocked.has(k) || seen.has(k)) continue;
      seen.add(k);
      queue.push({ col, row });
    }
  }
  return seen;
}

const walkable = (s: ScreenLayout, p: Vec2): boolean => !blockedSet(s).has(`${tileOf(p).col},${tileOf(p).row}`);
const near = (reach: Set<string>, at: Vec2, radius: number = TUNING.investigation.interactRadius): boolean =>
  [...reach].some((k) => {
    const [c, r] = k.split(',').map(Number) as [number, number];
    const nx = Math.min(Math.max(at.x, c * 16), c * 16 + 15.99);
    const ny = Math.min(Math.max(at.y, r * 16), r * 16 + 15.99);
    return Math.hypot(at.x - nx, at.y - ny) <= radius;
  });
const anyIn = (reach: Set<string>, a: AreaRect): boolean =>
  [...reach].some((k) => {
    const [c, r] = k.split(',').map(Number) as [number, number];
    return c * 16 >= a.x && r * 16 >= a.y && c * 16 < a.x + a.width && r * 16 < a.y + a.height;
  });
const tilesOf = (a: AreaRect): Vec2[] => {
  const out: Vec2[] = [];
  for (let y = a.y; y < a.y + a.height; y += 16) for (let x = a.x; x < a.x + a.width; x += 16) out.push({ x: x + 8, y: y + 8 });
  return out;
};


describe('chapter 7 layout: screens', () => {
  it('loads three screens at spec size in the roswell region', () => {
    expect(chapter7.def.screens.map((s) => [s.id, s.widthTiles, s.heightTiles])).toEqual([
      ['c7.strip', 60, 20],
      ['c7.shop', 40, 25],
      ['c7.stock', 30, 20],
    ]);
    for (const d of chapter7.def.screens) {
      const s = screen(d.id);
      expect(s.grid.widthTiles).toBe(d.widthTiles);
      expect(s.grid.heightTiles).toBe(d.heightTiles);
      expect(s.tiles).toHaveLength(d.widthTiles * d.heightTiles);
      expect(d.region).toBe('roswell');
    }
    expect(chapter7.def.bar?.screenId).toBe('c7.strip');
  });

  it('every exit leads to a screen that has an exit back, and arrivals are on walkable tiles', () => {
    for (const s of chapter7.screens) {
      expect(walkable(s, s.playerStart), `${s.id} start`).toBe(true);
      if (s.mykoStart) expect(walkable(s, s.mykoStart), `${s.id} Myko start`).toBe(true);
      for (const e of s.exits) {
        const to = screen(e.toScreen);
        expect(walkable(to, e.spawn), `${e.id} spawn on ${to.id}`).toBe(true);
        expect(to.exits.filter((x: ExitDef) => x.toScreen === s.id).length, `${to.id} back to ${s.id}`).toBeGreaterThan(0);
        for (const b of to.exits) expect(tilesOf(b.area).some((p) => tileOf(p).col === tileOf(e.spawn).col && tileOf(p).row === tileOf(e.spawn).row), `${e.id} spawns inside ${b.id}`).toBe(false);
        expect(anyIn(flood(s, s.playerStart), e.area), `${e.id} reachable`).toBe(true);
      }
    }
    expect(chapter7.def.bar && walkable(screen('c7.strip'), chapter7.def.bar.arrival)).toBe(true);
  });

  it('everything on each screen can be reached from where Andrew arrives', () => {
    for (const s of chapter7.screens) {
      const reach = flood(s, s.playerStart);
      for (const e of chapter7.examinables.filter((x) => x.screenId === s.id)) expect(near(reach, e.position), `${e.id} on ${s.id}`).toBe(true);
      for (const t of chapter7.triggers.filter((x) => x.screenId === s.id)) expect(anyIn(reach, t.area), t.id).toBe(true);
    }
    const stock = screen('c7.stock');
    const reach = flood(stock, stock.playerStart);
    expect(anyIn(reach, STOCK_START)).toBe(true);
    expect(anyIn(reach, STOCK_EXIT)).toBe(true);
    for (const p of YARD_SPAWNS) expect(reach.has(`${tileOf(p).col},${tileOf(p).row}`), `${p.x},${p.y}`).toBe(true);
    // The crates are solid, so a bottle spot is reached from beside it.
    for (const p of YARD_BOTTLE_SPOTS) expect(near(reach, p, 20), `${p.x},${p.y}`).toBe(true);
    const strip = screen('c7.strip');
    const sr = flood(strip, strip.playerStart);
    for (const p of MASCOT_BOTTLE_SPOTS) expect(near(sr, p, 20), `${p.x},${p.y}`).toBe(true);
    for (const p of [...STRIP_CROWD_SPOTS, RACK_SPOT, ...Object.values(MASCOT_FORMATION), chapter7.bosses[0]?.entrance ?? RACK_SPOT]) {
      expect(sr.has(`${tileOf(p).col},${tileOf(p).row}`), `${p.x},${p.y}`).toBe(true);
    }
  });
});

describe('chapter 7 layout: the section pieces', () => {
  it('has six figures, three of them aliens (b, d, Gary), and the three tourists', () => {
    expect(FIGURES).toHaveLength(6);
    expect(FIGURES.filter((f) => f.alien).map((f) => f.key)).toEqual([...ALIEN_FIGURES]);
    expect(FIGURES.filter((f) => !f.alien).map((f) => f.key)).toEqual([...TOURIST_FIGURES]);
    const shop = screen('c7.shop');
    for (const f of FIGURES) {
      expect(shop.dressing?.npcs?.some((n) => n.id === f.npcId)).toBe(true);
      expect(walkable(shop, f.spot), f.key).toBe(true);
    }
  });

  it('has four clerks on regular pingPong lanes on open ground', () => {
    expect(STOCK_STEALTH.guards).toHaveLength(4);
    for (const g of STOCK_STEALTH.guards) {
      expect(g.enemyId).toBe('clerk');
      expect(g.route.mode).toBe('pingPong');
      for (const w of g.route.waypoints) expect(walkable(screen('c7.stock'), w.position)).toBe(true);
    }
    expect(chapter7.def.stealthSections).toEqual([STOCK_STEALTH]);
  });

  it('the yard is six spawns inside the yard, and the arena matches its tuning', () => {
    expect(YARD_SPAWNS).toHaveLength(6);
    for (const p of YARD_SPAWNS) expect(p.x >= YARD_AREA.x && p.x < YARD_AREA.x + YARD_AREA.width).toBe(true);
    expect({ width: MASCOT_ARENA.width, height: MASCOT_ARENA.height }).toEqual(TUNING.bosses['c7.boss.mascots']?.arenaTiles);
    expect(ZIP_TUMBLE_LINE.row).toBeGreaterThanOrEqual(MASCOT_ARENA.row);
    expect(ZIP_TUMBLE_LINE.row).toBeLessThan(MASCOT_ARENA.row + MASCOT_ARENA.height);
    expect(chapter7.bosses[0]?.bodies.map((b) => b.tag)).toEqual(['zorp', 'zap', 'zip']);
  });
});

describe('chapter 7 layout: dialogue and ids', () => {
  it('every examinable id is unique and has a line, and every clue a title', () => {
    const ids = chapter7.examinables.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of chapter7.examinables) {
      expect(e.dialogueId !== undefined && hasSequence(e.dialogueId), `${e.id} has dialogue`).toBe(true);
      if (e.evidenceId) expect(hasText(`${e.evidenceId}.title`), `${e.evidenceId} title`).toBe(true);
    }
    for (const id of chapter7.def.evidence) expect(hasText(`${id}.title`), id).toBe(true);
  });

  it('prop, NPC, exit, trigger and section ids are unique, and NPC talk ids have examinables', () => {
    const examinableIds = new Set(chapter7.examinables.map((e) => e.id));
    for (const s of chapter7.screens) {
      const propIds = (s.dressing?.props ?? []).map((p) => p.id).filter((x): x is string => x !== undefined);
      const npcIds = (s.dressing?.npcs ?? []).map((n) => n.id).filter((x): x is string => x !== undefined);
      expect(new Set(propIds).size, `${s.id} props`).toBe(propIds.length);
      expect(new Set(npcIds).size, `${s.id} npcs`).toBe(npcIds.length);
      for (const n of s.dressing?.npcs ?? []) if (n.examinableId) expect(examinableIds.has(n.examinableId), n.examinableId).toBe(true);
    }
    const all = (xs: readonly string[]): void => expect(new Set(xs).size).toBe(xs.length);
    all(chapter7.screens.flatMap((s) => s.exits.map((e) => e.id)));
    all(chapter7.triggers.map((t) => t.id));
    all(chapter7.def.sections.map((s) => s.id));
    all([...chapter7.screens.flatMap((s) => (s.dressing?.props ?? []).map((p) => p.id ?? '')).filter((x) => x !== ''), ...chapter7.screens.flatMap((s) => (s.dressing?.npcs ?? []).map((n) => `npc:${n.id}`))]);
  });

  it('the objectives, hints, bar and board lines all exist', () => {
    for (const o of chapter7.def.objectives) {
      expect(hasText(o.textId), o.textId).toBe(true);
      expect(hasSequence(o.hint.nudgeDialogueId), o.hint.nudgeDialogueId).toBe(true);
      expect(hasSequence(o.hint.answerDialogueId), o.hint.answerDialogueId).toBe(true);
    }
    for (const id of chapter7.def.deductionBoard?.wrongAnswerDialogueIds ?? []) expect(hasSequence(id)).toBe(true);
    for (const id of [chapter7.def.bar?.openDialogueId, chapter7.def.bar?.hotDrinkDialogueId, chapter7.def.bar?.returnDialogueId]) expect(hasSequence(id ?? '')).toBe(true);
  });
});
