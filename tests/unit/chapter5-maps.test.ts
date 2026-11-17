/**
 * Chapter 5 layout: every screen loads, every exit has a matching arrival, every arrival, spawn, patrol stop and
 * examinable is on a tile Andrew (or a guard) can stand on and reach, and every examinable has dialogue.
 */

import { describe, expect, it } from 'vitest';
import { EXAMINE_LINES, FLOOR_STEALTH, LANES, LOBBY_GUARD_ROUTE, LOBBY_HIDING, SHELF_ROW_COUNT, SHELF_UNIT_COLS, chapter5, shelfPropId } from '../../src/chapters/05/index';
import { hasSequence, hasText } from '../../src/content/dialogue';
import type { ScreenLayout } from '../../src/core/chapter';
import type { Vec2 } from '../../src/core/types';

const screen = (id: string): ScreenLayout => {
  const s = chapter5.screens.find((x) => x.id === id);
  if (!s) throw new Error(`no screen ${id}`);
  return s;
};

/** Tiles blocked by the grid or by a visible solid prop. */
function blockedTiles(s: ScreenLayout): Set<string> {
  const out = new Set<string>();
  const g = s.grid;
  for (let r = 0; r < g.heightTiles; r++) for (let c = 0; c < g.widthTiles; c++) if (g.blocked[r * g.widthTiles + c]) out.add(`${c},${r}`);
  for (const p of s.dressing?.props ?? []) {
    if (p.hidden || !p.solid) continue;
    for (let dy = 0; dy < p.solid.height; dy++) for (let dx = 0; dx < p.solid.width; dx++) out.add(`${p.col + (p.solid.dx ?? 0) + dx},${p.row + (p.solid.dy ?? 0) + dy}`);
  }
  return out;
}
const tileOf = (p: Vec2): string => `${Math.floor(p.x / 16)},${Math.floor(p.y / 16)}`;
const inArea = (p: Vec2, a: { x: number; y: number; width: number; height: number }): boolean => p.x >= a.x && p.y >= a.y && p.x < a.x + a.width && p.y < a.y + a.height;

function flood(s: ScreenLayout, from: Vec2): Set<string> {
  const blocked = blockedTiles(s);
  const seen = new Set<string>();
  const q: string[] = [tileOf(from)];
  if (blocked.has(q[0]!)) return seen;
  seen.add(q[0]!);
  for (let k = q.shift(); k !== undefined; k = q.shift()) {
    const [c, r] = k.split(',').map(Number) as [number, number];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const key = `${c + dc},${r + dr}`;
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= s.grid.widthTiles || nr >= s.grid.heightTiles || blocked.has(key) || seen.has(key)) continue;
      seen.add(key);
      q.push(key);
    }
  }
  return seen;
}

/** True when Andrew can stand on a reachable tile within one tile of `p` (a prop's spot is beside the prop). */
const reachable = (reach: Set<string>, p: Vec2): boolean => reach.has(tileOf(p));

describe('chapter 5: layout', () => {
  it('loads four screens, each the size the spec gives, with a start and a bar', () => {
    expect(chapter5.screens.map((s) => s.id)).toEqual(['c5.bar', 'c5.lobby', 'c5.floor', 'c5.stacks']);
    const sizes = chapter5.def.screens.map((d) => [d.id, d.widthTiles, d.heightTiles]);
    expect(sizes).toEqual([
      ['c5.bar', 30, 17],
      ['c5.lobby', 40, 20],
      ['c5.floor', 60, 30],
      ['c5.stacks', 50, 30],
    ]);
    for (const d of chapter5.def.screens) {
      const s = screen(d.id);
      expect([s.grid.widthTiles, s.grid.heightTiles]).toEqual([d.widthTiles, d.heightTiles]);
      expect(s.tiles).toHaveLength(d.widthTiles * d.heightTiles);
    }
    expect(chapter5.def.startScreenId).toBe('c5.bar');
    expect(chapter5.def.bar?.screenId).toBe('c5.bar');
    expect(screen('c5.bar').playerStart).toEqual(chapter5.def.bar?.arrival);
  });

  it('every exit leads to a screen that has an exit back, and every spawn is on a walkable tile outside the exit it lands beside', () => {
    for (const s of chapter5.screens) {
      for (const e of s.exits) {
        const to = screen(e.toScreen);
        const back = to.exits.filter((x) => x.toScreen === s.id);
        expect(back.length, `${e.id} has no way back from ${to.id}`).toBeGreaterThan(0);
        expect(blockedTiles(to).has(tileOf(e.spawn)), `${e.id} spawns inside a wall on ${to.id}`).toBe(false);
        for (const b of back) expect(inArea(e.spawn, b.area), `${e.id} spawns inside ${b.id}`).toBe(false);
        // The exit itself is walkable (a door), so Andrew can step onto it.
        expect(blockedTiles(s).has(tileOf({ x: e.area.x + 1, y: e.area.y + 1 })), `${e.id} is in a wall`).toBe(false);
      }
    }
  });

  it('everything on a screen can be walked to from where Andrew arrives', () => {
    for (const s of chapter5.screens) {
      const reach = flood(s, s.playerStart);
      expect(reach.size, `${s.id} start`).toBeGreaterThan(20);
      // Every exit area, and every spawn into this screen.
      for (const e of s.exits) expect(reachable(reach, { x: e.area.x + 1, y: e.area.y + 1 }), e.id).toBe(true);
      for (const o of chapter5.screens) for (const e of o.exits.filter((x) => x.toScreen === s.id)) expect(reachable(reach, e.spawn), `spawn of ${e.id}`).toBe(true);
      if (s.mykoStart) expect(reachable(reach, s.mykoStart), `${s.id} Myko`).toBe(true);
      for (const ex of chapter5.examinables.filter((x) => x.screenId === s.id)) expect(reachable(reach, ex.position), ex.id).toBe(true);
      for (const p of chapter5.pickups.filter((x) => x.screenId === s.id)) expect(reachable(reach, p.position), p.id).toBe(true);
      for (const n of s.dressing?.npcs ?? []) expect(reach.has(`${n.col},${n.row}`) || !blockedTiles(s).has(`${n.col},${n.row}`), `${s.id} npc ${n.id}`).toBe(true);
    }
  });

  it('the section placements are on walkable, reachable tiles', () => {
    const floor = flood(screen('c5.floor'), screen('c5.floor').playerStart);
    for (const f of chapter5.fights) {
      for (const p of [...f.spawnPoints, f.entrance]) expect(reachable(floor, p), `${f.sectionId} ${tileOf(p)}`).toBe(true);
    }
    for (const st of chapter5.stealth) {
      for (const p of [...st.reinforcementPoints, st.entrance]) expect(reachable(floor, p), `${st.sectionId} ${tileOf(p)}`).toBe(true);
      expect([...floor].some((k) => inArea({ x: Number(k.split(',')[0]) * 16 + 8, y: Number(k.split(',')[1]) * 16 + 8 }, st.exitArea))).toBe(true);
      expect(st.startArea !== undefined && inArea(screen('c5.floor').playerStart, st.startArea)).toBe(true);
    }
    const stacks = flood(screen('c5.stacks'), screen('c5.stacks').playerStart);
    for (const b of chapter5.bosses) for (const body of b.bodies) expect(reachable(stacks, body.position), b.bossId).toBe(true);
    expect(reachable(stacks, chapter5.bosses[0]!.entrance)).toBe(true);
  });

  it('guards walk only on open tiles, and Act Natural has props to stand beside on every route screen', () => {
    const floor = flood(screen('c5.floor'), screen('c5.floor').playerStart);
    expect(FLOOR_STEALTH.guards).toHaveLength(6);
    for (const g of FLOOR_STEALTH.guards) {
      expect(g.enemyId).toBe('agent');
      for (const w of g.route.waypoints) expect(reachable(floor, w.position), `waypoint ${tileOf(w.position)}`).toBe(true);
    }
    for (const h of FLOOR_STEALTH.hidingProps) expect(reachable(floor, h.position), h.id).toBe(true);
    expect(new Set(FLOOR_STEALTH.hidingProps.map((h) => h.kind))).toEqual(new Set(['vendingMachine', 'waterCooler', 'noticeboard', 'queue']));
    const lobby = flood(screen('c5.lobby'), screen('c5.lobby').playerStart);
    for (const w of LOBBY_GUARD_ROUTE.waypoints) expect(reachable(lobby, w.position)).toBe(true);
    for (const h of LOBBY_HIDING) expect(reachable(lobby, h.position), h.id).toBe(true);
  });

  it("Pruitt's arena has six shelf units and five lanes, each lane a clear strip a unit can slide into", () => {
    const stacks = screen('c5.stacks');
    expect(SHELF_UNIT_COLS).toHaveLength(6);
    expect(LANES).toHaveLength(5);
    const ids = new Set((stacks.dressing?.props ?? []).map((p) => p.id));
    for (let u = 0; u < 6; u++) for (let r = 0; r < SHELF_ROW_COUNT; r++) expect(ids.has(shelfPropId(u, r))).toBe(true);
    const blocked = blockedTiles(stacks);
    for (const lane of LANES) {
      for (let r = 0; r < SHELF_ROW_COUNT; r++) for (let dx = 0; dx < lane.width; dx++) expect(blocked.has(`${lane.col + dx},${10 + r}`), `lane ${lane.index}`).toBe(false);
      // The lane is the gap between two units: the unit that closes it sits right beside it, to the east.
      expect(SHELF_UNIT_COLS[lane.closingUnit]).toBe(lane.col + lane.width);
    }
  });

  it('every examinable has an id, a spot, and dialogue that exists', () => {
    const ids = chapter5.examinables.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      const line = EXAMINE_LINES[id];
      expect(line, `${id} has no dialogue entry`).toBeDefined();
      const ok = (line?.sequence !== undefined && hasSequence(line.sequence)) || (line?.text !== undefined && hasText(line.text));
      expect(ok, `${id} points at dialogue that does not exist`).toBe(true);
    }
    for (const id of Object.keys(EXAMINE_LINES)) expect(ids, `${id} is not an examinable`).toContain(id);
    for (const npc of chapter5.screens.flatMap((s) => s.dressing?.npcs ?? [])) if (npc.examinableId) expect(ids).toContain(npc.examinableId);
  });

  it('prop and trigger ids are unique, and the sections, objectives and hints name text that exists', () => {
    const propIds = chapter5.screens.flatMap((s) => (s.dressing?.props ?? []).map((p) => p.id).filter((id): id is string => id !== undefined));
    expect(new Set(propIds).size).toBe(propIds.length);
    const trig = chapter5.triggers.map((t) => t.id);
    expect(new Set(trig).size).toBe(trig.length);
    for (const o of chapter5.def.objectives) {
      expect(hasText(o.textId), o.textId).toBe(true);
      expect(hasSequence(o.hint.nudgeDialogueId), o.hint.nudgeDialogueId).toBe(true);
      expect(hasSequence(o.hint.answerDialogueId), o.hint.answerDialogueId).toBe(true);
    }
    for (const c of chapter5.def.evidence) expect(hasText(`${c}.title`) && hasText(`${c}.body`) && hasText(`${c}.margin`), c).toBe(true);
    for (const id of chapter5.def.bar ? [chapter5.def.bar.openDialogueId, chapter5.def.bar.hotDrinkDialogueId, chapter5.def.bar.returnDialogueId] : []) expect(hasSequence(id), id).toBe(true);
  });
});
