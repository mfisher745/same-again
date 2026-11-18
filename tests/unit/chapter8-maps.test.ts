/**
 * Chapter 8 layout: every screen loads at spec size, exits pair up and land on walkable ground, everything Andrew has to
 * reach can be reached, ids are unique, every examinable has a line, and the junction puzzle is solvable in the fewest
 * toggles the layout allows.
 */

import { describe, expect, it } from 'vitest';
import {
  BARRED_AGENT_SPOT,
  CLIPBOARD_SPOT,
  CORRIDOR_LINES,
  EXAMINE_LINES,
  FENCE_AGENT_SPAWNS,
  FIGHT_TRUCK_PARK,
  GATE_ARENA,
  GATE_BOTTLE_SPOTS,
  GATE_CLOSING_AREA,
  GATE_LIT_PATH,
  GATE_TRUCK_ROUTE,
  JUNCTION_BOXES,
  LINES_ON_AT_START,
  PATROL_TRUCKS,
  PERIMETER_BOTTLE_SPOTS,
  PRUITT_START,
  ROAD_BOTTLE_SPOTS,
  SENSOR_LINES,
  STEALTH_EXIT,
  STEALTH_START,
  THERMAL_MASTS,
  chapter8,
  junctionSolved,
  pressJunction,
} from '../../src/chapters/08/index';
import { hasSequence, hasText } from '../../src/content/dialogue';
import { TUNING } from '../../src/content/tuning';
import type { AreaRect, ExitDef, ScreenLayout } from '../../src/core/chapter';
import type { ScreenId, Vec2 } from '../../src/core/types';

const JUNCTION_MIN_TOGGLES = 3;
const T = (col: number, row: number): Vec2 => ({ x: col * 16 + 8, y: row * 16 + 8 });

const screen = (id: ScreenId): ScreenLayout => {
  const s = chapter8.screens.find((x) => x.id === id);
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


/** The solid gate props are open in these floods (the script hides them). */
const GATES = ['fence.gate', 'fence.service'];

describe('chapter 8 layout: screens', () => {
  it('loads three nevada screens at spec size', () => {
    const sizes: Record<string, [number, number]> = { 'c8.road': [60, 20], 'c8.perimeter': [100, 40], 'c8.gate': [40, 20] };
    expect(chapter8.def.screens.map((s) => s.id)).toEqual(Object.keys(sizes));
    for (const d of chapter8.def.screens) {
      const s = screen(d.id);
      expect([d.widthTiles, d.heightTiles]).toEqual(sizes[d.id]);
      expect(s.grid.widthTiles).toBe(d.widthTiles);
      expect(s.grid.heightTiles).toBe(d.heightTiles);
      expect(s.tiles).toHaveLength(d.widthTiles * d.heightTiles);
      expect(d.region).toBe('nevada');
    }
    expect(chapter8.def.startScreenId).toBe('c8.road');
    expect(chapter8.def.bar?.screenId).toBe('c8.road');
  });

  it('exits pair up and land on walkable ground, and the exit tiles can be walked to', () => {
    for (const s of chapter8.screens) {
      expect(walkable(s, s.playerStart), `${s.id} start`).toBe(true);
      if (s.mykoStart) expect(walkable(s, s.mykoStart), `${s.id} Myko start`).toBe(true);
      for (const e of s.exits) {
        const to = screen(e.toScreen);
        expect(walkable(to, e.spawn), `${e.id} spawn on ${to.id}`).toBe(true);
        expect(to.exits.filter((x: ExitDef) => x.toScreen === s.id).length, `${to.id} has an exit back to ${s.id}`).toBeGreaterThan(0);
        for (const b of to.exits) expect(tilesOf(b.area).some((p) => tileOf(p).col === tileOf(e.spawn).col && tileOf(p).row === tileOf(e.spawn).row), `${e.id} spawns inside ${b.id}`).toBe(false);
        expect(anyIn(flood(s, s.playerStart, GATES), e.area), `${e.id} reachable`).toBe(true);
      }
    }
    expect(chapter8.def.bar && walkable(screen('c8.road'), chapter8.def.bar.arrival)).toBe(true);
  });

  it('the two fence gates are shut tiles in the fence until opened, and the service gate opens onto the road', () => {
    const p = screen('c8.perimeter');
    const reach = flood(p, p.playerStart);
    const gate = chapter8.screens.flatMap((s) => s.exits).find((e) => e.id === 'c8.perimeter.gate');
    const service = p.exits.find((e) => e.id === 'c8.perimeter.service');
    expect(gate && anyIn(reach, gate.area)).toBe(false);
    expect(service && anyIn(reach, service.area)).toBe(false);
    expect(service?.toScreen).toBe('c8.road');
  });

  it('everything on each screen can be reached from where Andrew arrives', () => {
    for (const s of chapter8.screens) {
      const reach = flood(s, s.playerStart, GATES);
      for (const e of chapter8.examinables.filter((x) => x.screenId === s.id)) expect(near(reach, e.position), `${e.id} on ${s.id}`).toBe(true);
      for (const t of chapter8.triggers.filter((x) => x.screenId === s.id)) expect(anyIn(reach, t.area), t.id).toBe(true);
      for (const pk of chapter8.pickups.filter((x) => x.screenId === s.id)) expect(walkable(s, pk.position) && near(reach, pk.position, 8), pk.id).toBe(true);
      for (const n of s.dressing?.npcs ?? []) expect(near(reach, T(n.col, n.row), 24), `npc ${n.id}`).toBe(true);
    }
    const p = screen('c8.perimeter');
    const reach = flood(p, p.playerStart, GATES);
    expect(anyIn(reach, STEALTH_START)).toBe(true);
    expect(anyIn(reach, STEALTH_EXIT)).toBe(true);
    for (const b of JUNCTION_BOXES) expect(near(reach, b.spot, 8), `box ${b.id}`).toBe(true);
    for (const p2 of [...FENCE_AGENT_SPAWNS, FIGHT_TRUCK_PARK, CLIPBOARD_SPOT]) expect(near(reach, p2, 8)).toBe(true);
    const road = screen('c8.road');
    expect(near(flood(road, road.playerStart), BARRED_AGENT_SPOT, 8)).toBe(true);
    const g = screen('c8.gate');
    const gr = flood(g, g.playerStart);
    expect(near(gr, PRUITT_START, 8)).toBe(true);
    expect(anyIn(gr, GATE_CLOSING_AREA)).toBe(true);
    for (const t of GATE_TRUCK_ROUTE) expect(walkable(g, t)).toBe(true);
    for (const t of tilesOf({ x: GATE_LIT_PATH.col * 16, y: GATE_LIT_PATH.row * 16, width: GATE_LIT_PATH.width * 16, height: GATE_LIT_PATH.height * 16 })) expect(walkable(g, t)).toBe(true);
    for (const t of [...ROAD_BOTTLE_SPOTS]) expect(walkable(road, t)).toBe(true);
    for (const t of PERIMETER_BOTTLE_SPOTS) expect(walkable(p, t)).toBe(true);
    for (const t of GATE_BOTTLE_SPOTS) expect(walkable(g, t)).toBe(true);
  });

  it('the gate arena is 30 x 14 and fits the screen', () => {
    expect([GATE_ARENA.width, GATE_ARENA.height]).toEqual([30, 14]);
    expect(GATE_ARENA.col + GATE_ARENA.width).toBeLessThanOrEqual(40);
    expect(GATE_ARENA.row + GATE_ARENA.height).toBeLessThanOrEqual(20);
  });
});

describe('chapter 8 layout: the perimeter hazards', () => {
  it('five sensor lines of real sensors, in order from the south, on walkable-adjacent tiles', () => {
    expect(SENSOR_LINES.map((l) => l.line)).toEqual([1, 2, 3, 4, 5]);
    const rows = SENSOR_LINES.map((l) => l.row);
    expect([...rows].sort((a, b) => b - a)).toEqual(rows);
    const p = screen('c8.perimeter');
    for (const l of SENSOR_LINES) {
      expect(l.sensors.length).toBeGreaterThan(5);
      for (const s of l.sensors) expect(tileOf(s).row).toBe(l.row);
    }
    expect(CORRIDOR_LINES).toEqual([2, 3, 4]);
    expect(p.grid.widthTiles).toBe(100);
  });

  it('two trucks on tracks and five thermal masts, all on the map and clear of walls', () => {
    const p = screen('c8.perimeter');
    expect(PATROL_TRUCKS).toHaveLength(2);
    for (const t of PATROL_TRUCKS) for (const w of t.route.waypoints) expect(walkable(p, w.position), t.id).toBe(true);
    expect(THERMAL_MASTS).toHaveLength(5);
    const ids = PATROL_TRUCKS.map((t) => t.id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('chapter 8 layout: the junction boxes', () => {
  /** The fewest toggles from the start state to a solved state, by breadth-first search over presses. */
  function fewestToggles(): number {
    const key = (s: readonly boolean[]) => s.map((x) => (x ? '1' : '0')).join('');
    const seen = new Set([key(LINES_ON_AT_START)]);
    let frontier: boolean[][] = [[...LINES_ON_AT_START]];
    for (let n = 0; frontier.length > 0; n++) {
      if (frontier.some(junctionSolved)) return n;
      const next: boolean[][] = [];
      for (const s of frontier) {
        for (const b of JUNCTION_BOXES) {
          const t = pressJunction(s, b);
          if (!seen.has(key(t))) {
            seen.add(key(t));
            next.push(t);
          }
        }
      }
      frontier = next;
    }
    return -1;
  }

  it('three boxes, each toggling two of five lines, each line touched, and it starts unsolved', () => {
    expect(JUNCTION_BOXES).toHaveLength(3);
    const touched = new Set<number>();
    for (const b of JUNCTION_BOXES) {
      expect(b.lines[0]).not.toBe(b.lines[1]);
      for (const l of b.lines) {
        expect(l).toBeGreaterThanOrEqual(1);
        expect(l).toBeLessThanOrEqual(5);
        touched.add(l);
      }
    }
    expect(touched.size).toBe(5);
    expect(junctionSolved(LINES_ON_AT_START)).toBe(false);
  });

  it('is solvable, and no fewer toggles than the minimum work', () => {
    const min = fewestToggles();
    expect(min).toBeGreaterThan(0);
    // Every sequence shorter than the minimum fails.
    const seqs = (len: number): number[][] => (len === 0 ? [[]] : seqs(len - 1).flatMap((s) => JUNCTION_BOXES.map((_, i) => [...s, i])));
    for (let len = 0; len < min; len++) {
      for (const s of seqs(len)) expect(junctionSolved(s.reduce((st, i) => pressJunction(st, JUNCTION_BOXES[i] as (typeof JUNCTION_BOXES)[number]), [...LINES_ON_AT_START]))).toBe(false);
    }
    // Three flip-two boxes: the minimum is three toggles, one per box (docs/chapters/08).
    expect(min).toBe(JUNCTION_MIN_TOGGLES);
  });
});

describe('chapter 8 layout: ids and dialogue', () => {
  it('every examinable id is unique and has a line', () => {
    const ids = chapter8.examinables.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      const line = EXAMINE_LINES[id];
      expect(line, `${id} has an entry`).toBeDefined();
      expect((line?.sequence !== undefined && hasSequence(line.sequence)) || (line?.text !== undefined && hasText(line.text)), `${id} points at dialogue that exists`).toBe(true);
    }
    for (const id of Object.keys(EXAMINE_LINES)) expect(ids).toContain(id);
    for (const e of chapter8.examinables) if (e.dialogueId) expect(hasSequence(e.dialogueId), e.id).toBe(true);
    for (const e of chapter8.examinables) if (e.evidenceId) expect(hasText(`${e.evidenceId}.title`), e.evidenceId).toBe(true);
    for (const n of chapter8.screens.flatMap((s) => s.dressing?.npcs ?? [])) if (n.examinableId) expect(ids).toContain(n.examinableId);
  });

  it('prop, npc, trigger, pickup and exit ids are unique', () => {
    const lists = [
      chapter8.screens.flatMap((s) => (s.dressing?.props ?? []).map((p) => p.id).filter((x): x is string => x !== undefined)),
      chapter8.screens.flatMap((s) => (s.dressing?.npcs ?? []).map((n) => n.id).filter((x): x is string => x !== undefined)),
      chapter8.triggers.map((t) => t.id),
      chapter8.pickups.map((p) => p.id),
      chapter8.screens.flatMap((s) => s.exits.map((e) => e.id)),
    ];
    for (const l of lists) expect(new Set(l).size).toBe(l.length);
  });

  it('the objectives, hints, board remarks and bar lines all exist', () => {
    for (const o of chapter8.def.objectives) {
      expect(hasText(o.textId)).toBe(true);
      expect(hasSequence(o.hint.nudgeDialogueId)).toBe(true);
      expect(hasSequence(o.hint.answerDialogueId)).toBe(true);
    }
    const board = chapter8.def.deductionBoard;
    for (const id of board?.wrongAnswerDialogueIds ?? []) expect(hasSequence(id)).toBe(true);
    expect(hasText(board?.leadTextId ?? '')).toBe(true);
    for (const id of [chapter8.def.bar?.openDialogueId, chapter8.def.bar?.hotDrinkDialogueId, chapter8.def.bar?.returnDialogueId]) expect(hasSequence(id ?? '')).toBe(true);
  });
});
