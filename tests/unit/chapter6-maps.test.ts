/**
 * Chapter 6 layout: every screen loads, every exit leads somewhere that has a way back, arrivals and spawns are on
 * walkable tiles, everything Andrew has to reach can be reached, the maze is a maze, and every examinable has a line.
 */

import { describe, expect, it } from 'vitest';
import { chapter6 } from '../../src/chapters/06/index';
import {
  AGENT_SPAWNS,
  ARENA,
  ARENA_CORN,
  BALE_SPOTS,
  COMBINE_ENTRY,
  COMBINE_LANES,
  COOLER_SPOTS,
  DRONE_SPAWNS,
  FARM_STAND_PICKUP,
  FIELDS_CORN,
  FIELDS_STEALTH,
  MAZE_GATE_TILE,
  MAZE_GRID,
  MAZE_OPENING_TILE,
  MAZE_ORDER,
  MAZE_STONES,
  STEALTH_EXIT,
  STEALTH_START,
} from '../../src/chapters/06/maps';
import { hasSequence, hasText } from '../../src/content/dialogue';
import { TUNING } from '../../src/content/tuning';
import type { AreaRect, ExitDef, ScreenLayout } from '../../src/core/chapter';
import type { ScreenId, Vec2 } from '../../src/core/types';

const screen = (id: ScreenId): ScreenLayout => {
  const s = chapter6.screens.find((x) => x.id === id);
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

describe('chapter 6 layout: screens', () => {
  it('loads three screens whose grids match the chapter definition', () => {
    expect(chapter6.def.screens.map((s) => s.id)).toEqual(['c6.motel', 'c6.town', 'c6.fields']);
    for (const d of chapter6.def.screens) {
      const s = screen(d.id);
      expect(s.grid.widthTiles).toBe(d.widthTiles);
      expect(s.grid.heightTiles).toBe(d.heightTiles);
      expect(s.tiles).toHaveLength(d.widthTiles * d.heightTiles);
      expect(s.grid.blocked).toHaveLength(d.widthTiles * d.heightTiles);
      expect(d.region).toBe('ohio');
    }
    expect(chapter6.def.startScreenId).toBe('c6.motel');
    expect(chapter6.def.bar?.screenId).toBe('c6.motel');
  });

  it('every exit leads to a screen that has an exit back, and arrivals are on walkable tiles', () => {
    for (const s of chapter6.screens) {
      expect(walkable(s, s.playerStart), `${s.id} start`).toBe(true);
      if (s.mykoStart) expect(walkable(s, s.mykoStart), `${s.id} Myko start`).toBe(true);
      for (const e of s.exits) {
        const to = screen(e.toScreen);
        expect(walkable(to, e.spawn), `${e.id} spawn on ${to.id}`).toBe(true);
        const back = to.exits.filter((x: ExitDef) => x.toScreen === s.id);
        expect(back.length, `${to.id} has an exit back to ${s.id}`).toBeGreaterThan(0);
        // The spawn is not inside the exit it would bounce straight back out of.
        for (const b of to.exits) expect(tilesOf(b.area).some((p) => tileOf(p).col === tileOf(e.spawn).col && tileOf(p).row === tileOf(e.spawn).row), `${e.id} spawns inside ${b.id}`).toBe(false);
        // The exit's own tiles can be walked to from the screen's start.
        expect(anyIn(flood(s, s.playerStart), e.area), `${e.id} reachable`).toBe(true);
      }
    }
    expect(chapter6.def.bar && walkable(screen('c6.motel'), chapter6.def.bar.arrival)).toBe(true);
  });

  it('every spawn point, entrance and drop spot is on walkable ground of the fields', () => {
    const f = screen('c6.fields');
    const spots = [...COOLER_SPOTS, FARM_STAND_PICKUP, ...BALE_SPOTS, COMBINE_ENTRY];
    for (const p of spots) expect(walkable(f, p), `${p.x},${p.y}`).toBe(true);
    // Drones fly, so only the agents' spawn points and Myko's entrance need ground.
    for (const p of [...AGENT_SPAWNS, ...(chapter6.fights[0] ? [chapter6.fights[0].entrance] : [])]) expect(walkable(f, p)).toBe(true);
    expect(chapter6.fights[0]?.spawnPoints).toEqual([...DRONE_SPAWNS, ...AGENT_SPAWNS]);
    for (const st of chapter6.stealth) expect(walkable(f, st.entrance)).toBe(true);
    for (const b of chapter6.bosses) expect(walkable(f, b.entrance)).toBe(true);
  });

  it('everything on each screen can be reached from where Andrew arrives', () => {
    for (const s of chapter6.screens) {
      const reach = flood(s, s.playerStart);
      for (const e of chapter6.examinables.filter((x) => x.screenId === s.id)) {
        if (e.id === 'c6.clue.receipt') continue; // behind the maze gate; below
        expect(near(reach, e.position), `${e.id} on ${s.id}`).toBe(true);
      }
      for (const t of chapter6.triggers.filter((x) => x.screenId === s.id)) expect(anyIn(reach, t.area), t.id).toBe(true);
    }
    const f = screen('c6.fields');
    const reach = flood(f, f.playerStart);
    expect(anyIn(reach, STEALTH_START)).toBe(true);
    expect(anyIn(reach, STEALTH_EXIT)).toBe(true);
    expect(near(reach, FARM_STAND_PICKUP, 8)).toBe(true);
  });
});

describe('chapter 6 layout: the crop-circle maze', () => {
  it('is shut until the gate goes: the opening and every stone can be walked to, the hatch cannot', () => {
    const f = screen('c6.fields');
    const open = MAZE_OPENING_TILE;
    const reach = flood(f, { x: open.col * 16 + 8, y: open.row * 16 + 8 });
    for (const s of MAZE_STONES) expect(reach.has(`${s.col},${s.row}`), `stone ${s.id}`).toBe(true);
    const hatch = chapter6.examinables.find((e) => e.id === 'c6.clue.receipt');
    expect(hatch).toBeDefined();
    expect(near(reach, hatch?.position ?? { x: 0, y: 0 }, 8)).toBe(false);
    expect(reach.has(`${MAZE_GATE_TILE.col},${MAZE_GATE_TILE.row}`)).toBe(false);
    const solved = flood(f, { x: open.col * 16 + 8, y: open.row * 16 + 8 }, ['maze.gate']);
    expect(near(solved, hatch?.position ?? { x: 0, y: 0 }, 8)).toBe(true);
  });

  it('has three different stones in a fixed order, on dead ends, none of them on the way to another', () => {
    expect(MAZE_ORDER).toEqual(['near', 'far', 'hatch']);
    expect(new Set(MAZE_STONES.map((s) => `${s.col},${s.row}`)).size).toBe(3);
    const [a, b, c] = MAZE_GRID.stoneDistances as [number, number, number];
    // The near stone is nearer than the far one; the walk through all three is well under two minutes at walking pace.
    expect(a).toBeLessThan(b);
    expect(a).toBeGreaterThanOrEqual(8);
    expect(c).toBeGreaterThan(0);
    const walk = a + Math.abs(b - a) * 2 + (b + c);
    expect(walk * 16 / TUNING.player.runSpeed).toBeLessThan(120);
    for (const s of MAZE_GRID.stones) {
      let open = 0;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (MAZE_GRID.walls[s.row + dr]?.[s.col + dc] === false) open++;
      expect(open).toBe(1);
    }
  });
});

describe('chapter 6 layout: the corn, the drones and the combine', () => {
  it('standing corn is walkable and does not block sight', () => {
    const f = screen('c6.fields');
    expect(FIELDS_CORN.length).toBeGreaterThan(1500);
    for (const t of FIELDS_CORN) {
      const i = t.row * f.grid.widthTiles + t.col;
      expect(f.grid.blocked[i]).toBe(false);
      // Standing corn hides by standing still in it, not by being a wall (docs/build/c5c6.md): it does not block sight.
      expect(f.grid.blocksSight[i]).toBe(false);
    }
    expect(ARENA_CORN.length).toBeGreaterThan(400);
  });

  it('five drone patrols with routes inside the field', () => {
    expect(FIELDS_STEALTH.guards).toHaveLength(5);
    for (const g of FIELDS_STEALTH.guards) {
      expect(g.enemyId).toBe('drone');
      for (const w of g.route.waypoints) {
        expect(w.position.x).toBeGreaterThan(16);
        expect(w.position.x).toBeLessThan(79 * 16);
        expect(w.position.y).toBeGreaterThan(16);
        expect(w.position.y).toBeLessThan(39 * 16);
      }
    }
    expect(chapter6.def.stealthSections).toEqual([FIELDS_STEALTH]);
  });

  it('the combine arena matches its tuning and its lanes lie inside it', () => {
    expect({ width: ARENA.width, height: ARENA.height }).toEqual(TUNING.bosses['c6.setpiece.combine']?.arenaTiles);
    for (const l of COMBINE_LANES) {
      expect(l.col).toBeGreaterThanOrEqual(ARENA.col);
      expect(l.col + l.width).toBeLessThanOrEqual(ARENA.col + ARENA.width);
    }
    const b = chapter6.bosses[0];
    expect(b?.bodies.map((x) => x.tag)).toEqual(['harvester', 'light1', 'light2', 'light3']);
  });
});

describe('chapter 6 layout: dialogue', () => {
  it('every examinable id is unique and has a line (or a clue with a title)', () => {
    const ids = chapter6.examinables.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of chapter6.examinables) {
      expect(e.dialogueId !== undefined && hasSequence(e.dialogueId), `${e.id} has dialogue`).toBe(true);
      if (e.evidenceId) expect(hasText(`${e.evidenceId}.title`), `${e.evidenceId} title`).toBe(true);
    }
  });

  it('every NPC with a talk id has an examinable, and every screen has four things Myko can admire', () => {
    const examinableIds = new Set(chapter6.examinables.map((e) => e.id));
    for (const s of chapter6.screens) {
      for (const n of s.dressing?.npcs ?? []) if (n.examinableId) expect(examinableIds.has(n.examinableId), n.examinableId).toBe(true);
      const admired = chapter6.examinables.filter((e) => e.screenId === s.id && e.dialogueId?.startsWith('c6.ohio.'));
      expect(admired.length, s.id).toBeGreaterThanOrEqual(4);
    }
  });

  it('the objectives, hints and the board remarks all exist', () => {
    for (const o of chapter6.def.objectives) {
      expect(hasText(o.textId)).toBe(true);
      expect(hasSequence(o.hint.nudgeDialogueId)).toBe(true);
      expect(hasSequence(o.hint.answerDialogueId)).toBe(true);
    }
    const board = chapter6.def.deductionBoard;
    expect(board).toBeDefined();
    for (const id of board?.wrongAnswerDialogueIds ?? []) expect(hasSequence(id)).toBe(true);
    expect(hasText(board?.leadTextId ?? '')).toBe(true);
    for (const id of [chapter6.def.bar?.openDialogueId, chapter6.def.bar?.hotDrinkDialogueId, chapter6.def.bar?.returnDialogueId]) expect(hasSequence(id ?? '')).toBe(true);
  });
});
