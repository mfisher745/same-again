/**
 * Chapter 10 layout: screens load at spec size, exits pair up and land on walkable ground, everything Andrew has to
 * reach can be reached, ids are unique, every examinable has a line, and the boss arena is 36 x 20 of open floor.
 */

import { describe, expect, it } from 'vitest';
import {
  ADMIN_SIT_SPOT,
  ADMIN_START,
  ANTEROOM_ENTRANCE,
  ANTEROOM_SPAWNS,
  ANTEROOM_WAVE_SPAWNS,
  BUTTON_SPOT,
  CABINET_SPOT,
  CHANNEL_SPOTS,
  CONSOLE_AREA,
  CONTROL_ARENA,
  CONTROL_BOTTLE_SPOTS,
  CONTROL_ENTRY_AREA,
  CONTROL_TO_PUB,
  DESK_SHIELD_AREA,
  FRUIT_MACHINE_SPOT,
  GRAVITY_SWITCHES,
  GUARD_PAIR_SPAWNS,
  LOOSE_FURNITURE,
  PUB_STOOL,
  SILENT_EXAMINABLES,
  STAMP_ROWS,
  TELLY_SPOT,
  chapter10,
} from '../../src/chapters/10/index';
import { hasSequence, hasText } from '../../src/content/dialogue';
import { TUNING } from '../../src/content/tuning';
import { tileIndex } from '../../src/art/tiles';
import type { AreaRect, ExitDef, ScreenLayout } from '../../src/core/chapter';
import type { ScreenId, Vec2 } from '../../src/core/types';

const T = (col: number, row: number): Vec2 => ({ x: col * 16 + 8, y: row * 16 + 8 });

const screen = (id: ScreenId): ScreenLayout => {
  const s = chapter10.screens.find((x) => x.id === id);
  if (!s) throw new Error(`no screen ${id}`);
  return s;
};
const tileOf = (p: Vec2) => ({ col: Math.floor(p.x / 16), row: Math.floor(p.y / 16) });

/** Tiles blocked by the grid or by a solid prop or NPC. */
function blockedSet(s: ScreenLayout): Set<string> {
  const blocked = new Set<string>();
  const g = s.grid;
  for (let r = 0; r < g.heightTiles; r++) for (let c = 0; c < g.widthTiles; c++) if (g.blocked[r * g.widthTiles + c]) blocked.add(`${c},${r}`);
  for (const p of s.dressing?.props ?? []) {
    if (!p.solid || p.hidden) continue;
    for (let dy = 0; dy < p.solid.height; dy++) for (let dx = 0; dx < p.solid.width; dx++) blocked.add(`${p.col + (p.solid.dx ?? 0) + dx},${p.row + (p.solid.dy ?? 0) + dy}`);
  }
  for (const n of s.dressing?.npcs ?? []) if (n.solid) blocked.add(`${n.col},${n.row}`);
  return blocked;
}

function flood(s: ScreenLayout, from: Vec2): Set<string> {
  const blocked = blockedSet(s);
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

describe('chapter 10 layout: screens', () => {
  it('loads the anteroom, control room and pub at spec size', () => {
    const sizes: Record<string, [number, number]> = { 'c10.anteroom': [30, 17], 'c10.control': [40, 25], 'c10.pub': [30, 17] };
    expect(chapter10.def.screens.map((s) => s.id)).toEqual(Object.keys(sizes));
    for (const d of chapter10.def.screens) {
      const s = screen(d.id);
      expect([d.widthTiles, d.heightTiles]).toEqual(sizes[d.id]);
      expect(s.grid.widthTiles).toBe(d.widthTiles);
      expect(s.grid.heightTiles).toBe(d.heightTiles);
      expect(s.tiles).toHaveLength(d.widthTiles * d.heightTiles);
    }
    expect(chapter10.def.screens.map((s) => s.region)).toEqual(['base', 'base', 'kilnamoe']);
    expect(chapter10.def.startScreenId).toBe('c10.anteroom');
    expect(chapter10.def.bar?.screenId).toBe('c10.anteroom');
  });

  it('exits pair up and land on walkable ground; the pub is reached by a cut, not an exit', () => {
    for (const s of chapter10.screens) {
      expect(walkable(s, s.playerStart), `${s.id} start`).toBe(true);
      if (s.mykoStart) expect(walkable(s, s.mykoStart), `${s.id} Myko start`).toBe(true);
      for (const e of s.exits) {
        const to = screen(e.toScreen);
        expect(walkable(to, e.spawn), `${e.id} spawn on ${to.id}`).toBe(true);
        expect(to.exits.filter((x: ExitDef) => x.toScreen === s.id).length, `${to.id} has an exit back to ${s.id}`).toBeGreaterThan(0);
        for (const b of to.exits) expect(tilesOf(b.area).some((p) => tileOf(p).col === tileOf(e.spawn).col && tileOf(p).row === tileOf(e.spawn).row), `${e.id} spawns inside ${b.id}`).toBe(false);
        expect(anyIn(flood(s, s.playerStart), e.area), `${e.id} reachable`).toBe(true);
      }
    }
    expect(screen('c10.pub').exits).toHaveLength(0);
    expect(chapter10.screens.flatMap((s) => s.exits).some((e) => e.toScreen === 'c10.pub')).toBe(false);
    expect(CONTROL_TO_PUB.screenId).toBe('c10.pub');
    expect(walkable(screen('c10.pub'), CONTROL_TO_PUB.spawn)).toBe(true);
    const bar = chapter10.def.bar;
    expect(bar && walkable(screen('c10.anteroom'), bar.arrival)).toBe(true);
  });

  it('everything on each screen can be reached from where Andrew arrives', () => {
    for (const s of chapter10.screens) {
      const reach = flood(s, s.playerStart);
      for (const e of chapter10.examinables.filter((x) => x.screenId === s.id)) expect(near(reach, e.position), `${e.id} on ${s.id}`).toBe(true);
      for (const t of chapter10.triggers.filter((x) => x.screenId === s.id)) expect(anyIn(reach, t.area), t.id).toBe(true);
      for (const n of s.dressing?.npcs ?? []) expect(near(reach, T(n.col, n.row), 40), `npc ${n.id}`).toBe(true);
    }
    const ante = screen('c10.anteroom');
    const ar = flood(ante, ante.playerStart);
    for (const p of [...ANTEROOM_SPAWNS, ANTEROOM_ENTRANCE, CABINET_SPOT]) expect(walkable(ante, p) && near(ar, p, 8), `${p.x},${p.y}`).toBe(true);
    const ctl = screen('c10.control');
    const cr = flood(ctl, ctl.playerStart);
    const spots = [ADMIN_START, ADMIN_SIT_SPOT, BUTTON_SPOT, ...CHANNEL_SPOTS, ...GRAVITY_SWITCHES.map((s) => s.spot), ...GUARD_PAIR_SPAWNS.flat(), ...STAMP_ROWS.flatMap((r) => [r.west, r.east])];
    for (const p of spots) expect(walkable(ctl, p) && near(cr, p, 8), `${p.x},${p.y}`).toBe(true);
    for (const p of CONTROL_BOTTLE_SPOTS) expect(near(cr, p, 24), `crate ${p.x},${p.y}`).toBe(true);
    for (const f of LOOSE_FURNITURE) expect(near(cr, T(f.col, f.row + (f.solid.dy ?? 0)), 24), f.id).toBe(true);
    expect(anyIn(cr, CONTROL_ENTRY_AREA)).toBe(true);
    expect(anyIn(cr, CONSOLE_AREA)).toBe(true);
    const pub = screen('c10.pub');
    const pr = flood(pub, pub.playerStart);
    expect(walkable(pub, PUB_STOOL) && near(pr, PUB_STOOL, 8)).toBe(true);
    expect(near(pr, FRUIT_MACHINE_SPOT, 8)).toBe(true);
    expect(near(pr, TELLY_SPOT, 8)).toBe(true);
  });
});

describe('chapter 10 layout: the anteroom fight', () => {
  it('spawn lists match the three waves of c10.fight.anteroom in size, six security and four clerks in all', () => {
    const waves = TUNING.fights['c10.fight.anteroom']?.waves ?? [];
    expect(waves).toHaveLength(3);
    expect(ANTEROOM_WAVE_SPAWNS.map((w) => w.length)).toEqual(waves.map((w) => w.enemies.reduce((n, g) => n + g.count, 0)));
    expect(ANTEROOM_SPAWNS).toHaveLength(10);
    const total = (id: string) => waves.flatMap((w) => w.enemies).filter((g) => g.enemyId === id).reduce((n, g) => n + g.count, 0);
    expect([total('security'), total('clerk')]).toEqual([6, 4]);
    expect(chapter10.fights.map((f) => f.sectionId)).toEqual(['c10.fight.anteroom']);
  });
});

describe('chapter 10 layout: the control room', () => {
  const ctl = () => screen('c10.control');

  it('the boss arena is 36 x 20 of open floor inside the room', () => {
    expect([CONTROL_ARENA.width, CONTROL_ARENA.height]).toEqual([36, 20]);
    const g = ctl().grid;
    expect(CONTROL_ARENA.col + CONTROL_ARENA.width).toBeLessThanOrEqual(g.widthTiles - 2);
    expect(CONTROL_ARENA.row + CONTROL_ARENA.height).toBeLessThanOrEqual(g.heightTiles - 2);
    for (let r = CONTROL_ARENA.row; r < CONTROL_ARENA.row + CONTROL_ARENA.height; r++) {
      for (let c = CONTROL_ARENA.col; c < CONTROL_ARENA.col + CONTROL_ARENA.width; c++) expect(g.blocked[r * g.widthTiles + c], `tile ${c},${r}`).toBe(false);
    }
  });

  it('four switches, one in each wall, each with a standing spot beside it; the stamp rows are marked across the arena', () => {
    expect(GRAVITY_SWITCHES.map((s) => s.wall).sort()).toEqual(['east', 'north', 'south', 'west']);
    const g = ctl().grid;
    const switchTile = tileIndex('base', 'gravitySwitch');
    for (const s of GRAVITY_SWITCHES) {
      expect(ctl().tiles?.[s.tile.row * g.widthTiles + s.tile.col], s.id).toBe(switchTile);
      expect(g.blocked[s.tile.row * g.widthTiles + s.tile.col], s.id).toBe(true);
      expect(Math.abs(tileOf(s.spot).col - s.tile.col) + Math.abs(tileOf(s.spot).row - s.tile.row), `${s.id} spot beside it`).toBe(1);
    }
    const marking = tileIndex('base', 'marking');
    expect(STAMP_ROWS).toHaveLength(3);
    for (const r of STAMP_ROWS) for (let c = CONTROL_ARENA.col; c < CONTROL_ARENA.col + CONTROL_ARENA.width; c++) expect(ctl().tiles?.[r.row * g.widthTiles + c], `row ${r.row} col ${c}`).toBe(marking);
  });

  it('the desk, shield, dais, console and five channel spots are laid out as the spec says', () => {
    expect(CHANNEL_SPOTS).toHaveLength(5);
    const dais = tileIndex('base', 'consoleDais');
    const g = ctl().grid;
    for (const p of [...CHANNEL_SPOTS, BUTTON_SPOT]) expect(ctl().tiles?.[tileOf(p).row * g.widthTiles + tileOf(p).col]).toBe(dais);
    // The Administrator starts behind his desk, inside the shield; the guard pairs start outside it.
    const inside = (p: Vec2, a: AreaRect) => p.x >= a.x && p.y >= a.y && p.x < a.x + a.width && p.y < a.y + a.height;
    expect(inside(ADMIN_START, DESK_SHIELD_AREA)).toBe(true);
    for (const p of GUARD_PAIR_SPAWNS.flat()) expect(inside(p, DESK_SHIELD_AREA), `${p.x},${p.y}`).toBe(false);
    expect(GUARD_PAIR_SPAWNS.every((pair) => pair.length === 2)).toBe(true);
    // Furniture is clear of the stamp rows.
    for (const f of LOOSE_FURNITURE) for (const r of STAMP_ROWS) expect(f.row + (f.solid.dy ?? 0) + f.solid.height - 1 < r.row || f.row + (f.solid.dy ?? 0) > r.row, f.id).toBe(true);
  });
});

describe('chapter 10 layout: ids and dialogue', () => {
  it('every examinable id is unique and has a line, except the puzzle and switch points', () => {
    const ids = chapter10.examinables.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of chapter10.examinables) {
      if (SILENT_EXAMINABLES.includes(e.id)) expect(e.dialogueId, e.id).toBeUndefined();
      else expect(e.dialogueId !== undefined && hasSequence(e.dialogueId), `${e.id} has dialogue`).toBe(true);
    }
    for (const id of SILENT_EXAMINABLES) expect(ids).toContain(id);
    for (const n of chapter10.screens.flatMap((s) => s.dressing?.npcs ?? [])) if (n.examinableId) expect(ids).toContain(n.examinableId);
  });

  it('prop, npc, trigger, pickup and exit ids are unique', () => {
    const lists = [
      chapter10.screens.flatMap((s) => (s.dressing?.props ?? []).map((p) => p.id).filter((x): x is string => x !== undefined)),
      chapter10.screens.flatMap((s) => (s.dressing?.npcs ?? []).map((n) => n.id).filter((x): x is string => x !== undefined)),
      chapter10.triggers.map((t) => t.id),
      chapter10.pickups.map((p) => p.id),
      chapter10.screens.flatMap((s) => s.exits.map((e) => e.id)),
    ];
    for (const l of lists) expect(new Set(l).size).toBe(l.length);
  });

  it('the objectives, hints and bar lines all exist', () => {
    for (const o of chapter10.def.objectives) {
      expect(hasText(o.textId), o.textId).toBe(true);
      expect(hasSequence(o.hint.nudgeDialogueId), o.hint.nudgeDialogueId).toBe(true);
      expect(hasSequence(o.hint.answerDialogueId), o.hint.answerDialogueId).toBe(true);
    }
    for (const id of [chapter10.def.bar?.openDialogueId, chapter10.def.bar?.hotDrinkDialogueId, chapter10.def.bar?.returnDialogueId]) expect(hasSequence(id ?? ''), id).toBe(true);
    for (const k of ['fight', 'puzzle'] as const) expect(hasSequence(chapter10.def.mykoCallLines[k].sequenceId)).toBe(true);
  });
});
