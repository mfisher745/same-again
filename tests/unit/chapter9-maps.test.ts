/**
 * Chapter 9 layout: screens load at spec size, exits pair up and land on walkable ground, everything is reachable, the
 * offices have eight clerks (six seated), the gravity rooms can each be solved (brute force), the bays and doors line up,
 * examinables have dialogue and ids are unique.
 */

import { describe, expect, it } from 'vitest';
import { chapter9 } from '../../src/chapters/09/index';
import {
  BAY_ROWS,
  DESK_TILES,
  DOOR_COLS,
  DOOR_OPENING_ROWS,
  GRAVITY_ENTRY_AREAS,
  GRAVITY_ROOMS,
  HALL_BAYS,
  LABS_COVER,
  LABS_SPAWNS,
  LIFT_AREA,
  LIFT_GUARD_SPOT,
  OFFICES_EXIT,
  OFFICES_HIDING,
  OFFICES_OVERHEARD,
  OFFICES_START,
  OFFICES_STEALTH,
  SEATED_CLERKS,
  TEQUILA_SPOT,
  WALKING_CLERKS,
  gravityCrateId,
  gravityTile,
} from '../../src/chapters/09/maps';
import type { GravityDirection, GravityRoomDef } from '../../src/chapters/09/maps';
import { PROP } from '../../src/art/props';
import { hasSequence, hasText } from '../../src/content/dialogue';
import { TUNING } from '../../src/content/tuning';
import type { AreaRect, ExitDef, ScreenLayout } from '../../src/core/chapter';
import type { ScreenId, TileCoord, Vec2 } from '../../src/core/types';

const screen = (id: ScreenId): ScreenLayout => {
  const s = chapter9.screens.find((x) => x.id === id);
  if (!s) throw new Error(`no screen ${id}`);
  return s;
};
const tileOf = (p: Vec2) => ({ col: Math.floor(p.x / 16), row: Math.floor(p.y / 16) });

/** Tiles blocked by the grid or by a visible solid prop (`skip` ids are treated as gone, like a barrier once dropped). */
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

const walkable = (s: ScreenLayout, p: Vec2, skip: readonly string[] = []): boolean => !blockedSet(s, skip).has(`${tileOf(p).col},${tileOf(p).row}`);
const has = (reach: Set<string>, p: Vec2): boolean => reach.has(`${tileOf(p).col},${tileOf(p).row}`);
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

describe('chapter 9 layout: screens', () => {
  it('loads three screens at spec size in the base region', () => {
    expect(chapter9.def.screens.map((s) => [s.id, s.widthTiles, s.heightTiles])).toEqual([
      ['c9.offices', 40, 25],
      ['c9.labs', 60, 40],
      ['c9.hall', 50, 30],
    ]);
    for (const d of chapter9.def.screens) {
      const s = screen(d.id);
      expect(s.grid.widthTiles).toBe(d.widthTiles);
      expect(s.grid.heightTiles).toBe(d.heightTiles);
      expect(s.tiles).toHaveLength(d.widthTiles * d.heightTiles);
      expect(d.region).toBe('base');
    }
    expect(chapter9.def.bar?.screenId).toBe('c9.offices');
  });

  it('every exit leads to a screen that has an exit back, and arrivals are on walkable tiles', () => {
    for (const s of chapter9.screens) {
      expect(walkable(s, s.playerStart), `${s.id} start`).toBe(true);
      if (s.mykoStart) expect(walkable(s, s.mykoStart), `${s.id} Myko start`).toBe(true);
      for (const e of s.exits) {
        const to = screen(e.toScreen);
        expect(walkable(to, e.spawn), `${e.id} spawn on ${to.id}`).toBe(true);
        expect(to.exits.filter((x: ExitDef) => x.toScreen === s.id).length, `${to.id} back to ${s.id}`).toBeGreaterThan(0);
        for (const b of to.exits) expect(tilesOf(b.area).some((p) => tileOf(p).col === tileOf(e.spawn).col && tileOf(p).row === tileOf(e.spawn).row), `${e.id} spawns inside ${b.id}`).toBe(false);
        expect(anyIn(flood(s, s.playerStart, allSkips(s)), e.area), `${e.id} reachable`).toBe(true);
      }
    }
    const bar = chapter9.def.bar;
    expect(bar && walkable(screen('c9.offices'), bar.arrival)).toBe(true);
  });

  it('every prop frame is a real frame in the props atlas', () => {
    const frames = new Set<string>();
    const walk = (v: unknown): void => {
      if (typeof v === 'string') frames.add(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(PROP);
    for (const s of chapter9.screens) for (const p of s.dressing?.props ?? []) expect(frames.has(p.frame), `${s.id} ${p.id ?? p.frame}`).toBe(true);
  });
});

/** The hall's barriers, which the switches drop: treated as gone when checking the way through. */
const allSkips = (s: ScreenLayout): string[] => (s.id === 'c9.hall' ? HALL_BAYS.flatMap((b) => b.gravity?.barrier.propIds ?? []) : []);

describe('chapter 9 layout: reachability', () => {
  it('everything on each screen can be reached from where Andrew arrives', () => {
    for (const s of chapter9.screens) {
      const reach = flood(s, s.playerStart, allSkips(s));
      for (const e of chapter9.examinables.filter((x) => x.screenId === s.id)) expect(near(reach, e.position), `${e.id} on ${s.id}`).toBe(true);
      for (const t of chapter9.triggers.filter((x) => x.screenId === s.id)) expect(anyIn(reach, t.area), t.id).toBe(true);
    }
  });

  it('the labs: the fight spawns, the entrance, the window, the records room and every gravity room door are reachable', () => {
    const labs = screen('c9.labs');
    const reach = flood(labs, labs.playerStart);
    for (const p of [...LABS_SPAWNS, chapter9.fights[0]!.entrance]) expect(has(reach, p), `${p.x},${p.y}`).toBe(true);
    for (const b of LABS_COVER) expect(reach.has(`${b.col},${b.row}`), 'cover is solid').toBe(false);
    for (const room of GRAVITY_ROOMS) {
      const entry = gravityTile(room, room.entry);
      expect(reach.has(`${entry.col},${entry.row}`), `${room.id} entry`).toBe(true);
    }
    for (const area of GRAVITY_ENTRY_AREAS) expect(anyIn(reach, area)).toBe(true);
  });
});

describe('chapter 9 layout: the offices stealth section', () => {
  it('has eight clerks: six seated at desks, two walking', () => {
    const guards = OFFICES_STEALTH.guards;
    expect(guards).toHaveLength(8);
    expect(guards.every((g) => g.enemyId === 'clerk')).toBe(true);
    const seated = guards.filter((g) => g.seated);
    expect(seated).toHaveLength(6);
    for (const g of seated) {
      expect(g.route.mode).toBe('stationary');
      expect(g.route.waypoints).toHaveLength(1);
    }
    expect(guards.filter((g) => !g.seated)).toHaveLength(2);
    expect(WALKING_CLERKS).toHaveLength(2);
    expect(SEATED_CLERKS).toHaveLength(6);
    expect(DESK_TILES).toHaveLength(6);
    expect(chapter9.def.stealthSections).toEqual([OFFICES_STEALTH]);
  });

  it('seated clerks sit on open ground beside a desk, and the walkers walk on open ground', () => {
    const offices = screen('c9.offices');
    const blocked = blockedSet(offices);
    SEATED_CLERKS.forEach((c, i) => {
      expect(blocked.has(`${c.tile.col},${c.tile.row}`), `clerk ${i}`).toBe(false);
      const d = DESK_TILES[i]!;
      expect(Math.abs(d.row - c.tile.row), `desk ${i} is a row away`).toBe(1);
      expect(c.tile.col >= d.col && c.tile.col <= d.col + 1, `desk ${i} is beside the clerk`).toBe(true);
    });
    for (const g of OFFICES_STEALTH.guards.filter((x) => !x.seated))
      for (const w of g.route.waypoints) expect(walkable(offices, w.position), `${w.position.x},${w.position.y}`).toBe(true);
  });

  it('has start and exit areas, Act Natural spots at the cooler, the noticeboard and the kitchenette queue, and the tequila', () => {
    const offices = screen('c9.offices');
    const reach = flood(offices, offices.playerStart);
    expect(anyIn(reach, OFFICES_START)).toBe(true);
    expect(anyIn(reach, OFFICES_EXIT)).toBe(true);
    expect(OFFICES_HIDING.map((h) => h.kind).sort()).toEqual(['noticeboard', 'queue', 'waterCooler']);
    for (const h of OFFICES_HIDING) expect(has(reach, h.position), h.id).toBe(true);
    expect(near(reach, TEQUILA_SPOT)).toBe(true);
    expect(offices.dressing?.props?.some((p) => p.id === 'offices.tequila' && p.hidden)).toBe(true);
  });

  it('has six overheard triggers, each with its line', () => {
    expect(OFFICES_OVERHEARD).toHaveLength(6);
    for (const o of OFFICES_OVERHEARD) expect(hasSequence(o.dialogueId), o.dialogueId).toBe(true);
    const ids = chapter9.triggers.filter((t) => t.id.startsWith('c9.trig.overheard.'));
    expect(ids).toHaveLength(6);
  });

  it('has the five proofs in the places the spec says', () => {
    const at = (id: string) => chapter9.examinables.find((e) => e.id === id)?.screenId;
    expect(at('c9.proof.contract')).toBe('c9.offices');
    expect(at('c9.proof.directory')).toBe('c9.offices');
    expect(at('c9.proof.craft')).toBe('c9.labs');
    expect(at('c9.proof.log')).toBe('c9.labs');
    const rec = HALL_BAYS.find((b) => b.index === 3)?.recorder;
    expect(rec).toBeDefined();
    expect(chapter9.def.evidence).toEqual(['c9.proof.contract', 'c9.proof.directory', 'c9.proof.craft', 'c9.proof.log', 'c9.proof.footage']);
    // The lost-property box holds the Glove, beside the lift lobby.
    expect(at('c9.glove.box')).toBe('c9.offices');
  });
});

// ---------------------------------------------------------------------------
// The gravity rooms
// ---------------------------------------------------------------------------

const DIRS: Readonly<Record<GravityDirection, readonly [number, number]>> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const key = (c: TileCoord): string => `${c.col},${c.row}`;

interface State {
  readonly andrew: TileCoord;
  readonly crates: readonly TileCoord[];
}

/** Brute force: walk anywhere open (not onto crates or ledges), press any switch from its stand cell, slide everything loose. */
function solveRoom(room: GravityRoomDef, maxPresses = 6): string[] | null {
  const cell = (c: number, r: number): string => room.rows[r]?.[c] ?? '#';
  const wall = (c: number, r: number): boolean => cell(c, r) === '#';
  const walkReach = (s: State): Set<string> => {
    const crates = new Set(s.crates.map(key));
    const seen = new Set<string>([key(s.andrew)]);
    const queue = [s.andrew];
    for (let t = queue.shift(); t !== undefined; t = queue.shift()) {
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const n = { col: t.col + dc, row: t.row + dr };
        if (seen.has(key(n)) || cell(n.col, n.row) !== '.' || crates.has(key(n))) continue;
        seen.add(key(n));
        queue.push(n);
      }
    }
    return seen;
  };
  const slide = (s: State, dir: GravityDirection): State => {
    const [dc, dr] = DIRS[dir];
    const movers: { id: number; at: TileCoord }[] = [{ id: -1, at: s.andrew }, ...s.crates.map((at, i) => ({ id: i, at }))];
    // The ones nearest the wall in the direction of travel move first.
    movers.sort((a, b) => (b.at.col - a.at.col) * dc + (b.at.row - a.at.row) * dr);
    for (const m of movers) {
      for (;;) {
        const next = { col: m.at.col + dc, row: m.at.row + dr };
        if (wall(next.col, next.row) || movers.some((o) => o !== m && key(o.at) === key(next))) break;
        m.at = next;
      }
    }
    return { andrew: movers.find((m) => m.id === -1)!.at, crates: movers.filter((m) => m.id >= 0).sort((a, b) => a.id - b.id).map((m) => m.at) };
  };
  const solved = (s: State): boolean => {
    if (room.plate && !s.crates.some((c) => key(c) === key(room.plate!))) return false;
    return key(s.andrew) === key(room.goal) || (cell(room.goal.col, room.goal.row) === '.' && walkReach(s).has(key(room.goal)));
  };
  const stateKey = (s: State): string => `${key(s.andrew)}|${s.crates.map(key).sort().join(';')}`;
  const start: State = { andrew: room.start, crates: room.crates };
  let frontier: { s: State; path: string[] }[] = [{ s: start, path: [] }];
  const seen = new Set<string>([stateKey(start)]);
  for (let depth = 0; depth <= maxPresses; depth++) {
    const next: { s: State; path: string[] }[] = [];
    for (const { s, path } of frontier) {
      if (solved(s)) return path;
      if (depth === maxPresses) continue;
      const reach = walkReach(s);
      for (const sw of room.switches) {
        if (!reach.has(key(sw.standAt))) continue;
        const moved = slide({ andrew: sw.standAt, crates: s.crates }, sw.direction);
        const k = stateKey(moved);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ s: moved, path: [...path, sw.id] });
      }
    }
    frontier = next;
  }
  return null;
}

describe('chapter 9 layout: the gravity rooms', () => {
  it('has three rooms with the spec switch counts, crates and plates', () => {
    expect(GRAVITY_ROOMS.map((r) => r.switches.length)).toEqual([1, 2, 2]);
    expect(GRAVITY_ROOMS.map((r) => r.crates.length)).toEqual([0, 1, 1]);
    expect(GRAVITY_ROOMS.map((r) => r.plate !== undefined)).toEqual([false, true, false]);
    // Room 3's goal is a ledge Andrew cannot walk onto.
    const r3 = GRAVITY_ROOMS[2]!;
    expect(r3.rows[r3.goal.row]?.[r3.goal.col]).toBe('H');
    expect(chapter9.def.puzzle.kind).toBe('gravity');
  });

  it('every cell is in range, on the right kind of ground, and the door, switches and start fit together', () => {
    for (const room of GRAVITY_ROOMS) {
      const w = room.rows[0]!.length;
      expect(room.rows.every((r) => r.length === w), `${room.id} rows are the same width`).toBe(true);
      const at = (c: TileCoord): string => room.rows[c.row]?.[c.col] ?? '?';
      expect(at(room.door), 'door is in the wall').toBe('#');
      expect(at(room.entry), 'entry is open').toBe('.');
      expect(room.door.row, 'door is on the north wall').toBe(0);
      expect(room.entry.col).toBe(room.door.col);
      expect(at(room.start)).toBe('.');
      for (const c of room.crates) expect(at(c), 'crate on open floor').toBe('.');
      if (room.plate) expect(at(room.plate)).toBe('.');
      for (const sw of room.switches) {
        expect(at(sw.wall), `${sw.id} panel is in a wall`).toBe('#');
        expect(at(sw.standAt), `${sw.id} stand cell is open`).toBe('.');
        expect(Math.abs(sw.wall.col - sw.standAt.col) + Math.abs(sw.wall.row - sw.standAt.row), `${sw.id} is next to its panel`).toBe(1);
      }
      // The same cells are on the screen: panels are gravity-switch tiles, the door a door strip.
      const labs = screen('c9.labs');
      for (const sw of room.switches) {
        const t = gravityTile(room, sw.wall);
        expect(labs.grid.blocked[t.row * labs.grid.widthTiles + t.col], `${sw.id} tile blocks`).toBe(true);
      }
      for (const c of room.crates) expect(labs.dressing?.props?.some((p) => p.id === gravityCrateId(room, room.crates.indexOf(c))), 'crate prop').toBe(true);
      expect(hasSequence(room.promptDialogueId), room.promptDialogueId).toBe(true);
    }
  });

  it('the start is reachable from the entry on foot, in every room', () => {
    for (const room of GRAVITY_ROOMS) {
      const open = (c: number, r: number): boolean => room.rows[r]?.[c] === '.';
      const seen = new Set<string>([key(room.entry)]);
      const queue = [room.entry];
      for (let t = queue.shift(); t !== undefined; t = queue.shift())
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const n = { col: t.col + dc, row: t.row + dr };
          if (seen.has(key(n)) || !open(n.col, n.row) || room.crates.some((c) => key(c) === key(n))) continue;
          seen.add(key(n));
          queue.push(n);
        }
      expect(seen.has(key(room.start)), `${room.id} start`).toBe(true);
      for (const sw of room.switches) expect(seen.has(key(sw.standAt)), `${sw.id} stand cell`).toBe(true);
    }
  });

  it('each room is solved by sliding everything loose to the chosen wall, and quickly', () => {
    const solutions = GRAVITY_ROOMS.map((r) => solveRoom(r));
    for (const [i, s] of solutions.entries()) {
      expect(s, `${GRAVITY_ROOMS[i]!.id} is solvable`).not.toBeNull();
      expect(s!.length, `${GRAVITY_ROOMS[i]!.id} takes few presses`).toBeLessThanOrEqual(4);
    }
    // Room 1 teaches the idea: one press. Rooms 2 and 3 need both of their switches.
    expect(solutions[0]).toHaveLength(1);
    for (const i of [1, 2]) expect(new Set(solutions[i]).size, `${GRAVITY_ROOMS[i]!.id} uses both switches`).toBe(2);
    // The ledge cannot be walked onto: with the crate left where it starts, room 3 is not solved by the left switch alone.
    const r3 = GRAVITY_ROOMS[2]!;
    expect(solveRoom({ ...r3, switches: r3.switches.filter((s) => s.direction === 'left') }), 'the crate has to be placed first').toBeNull();
    // Room 2 needs the crate on the plate: without the up switch it never gets there.
    const r2 = GRAVITY_ROOMS[1]!;
    expect(solveRoom({ ...r2, switches: r2.switches.filter((s) => s.direction === 'left') })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The hall: five bays and the lift
// ---------------------------------------------------------------------------

describe('chapter 9 layout: the hall', () => {
  const hall = screen('c9.hall');

  it('has five bays in a row, door lines on blast frame with the opening between them, and a lift at the far end', () => {
    expect(HALL_BAYS).toHaveLength(5);
    expect(HALL_BAYS.map((b) => b.door.col)).toEqual([...DOOR_COLS]);
    const blocked = blockedSet(hall);
    for (const bay of HALL_BAYS) {
      for (let r = BAY_ROWS.from; r <= BAY_ROWS.to; r++) {
        const open = r >= DOOR_OPENING_ROWS.from && r <= DOOR_OPENING_ROWS.to;
        for (let dc = 0; dc < bay.door.width; dc++) expect(blocked.has(`${bay.door.col + dc},${r}`), `door ${bay.index} ${bay.door.col + dc},${r}`).toBe(!open);
      }
      expect(bay.door.area.x).toBe(bay.door.col * 16);
      expect(walkable(hall, bay.start), `bay ${bay.index} start`).toBe(true);
      expect(bay.start.x >= bay.cols.from * 16 && bay.start.x < (bay.cols.to + 1) * 16, `bay ${bay.index} start is inside the bay`).toBe(true);
      // The leaf props that close the door sit in the opening, hidden until it closes.
      for (const id of bay.door.propIds) {
        const p = hall.dressing?.props?.find((x) => x.id === id);
        expect(p?.hidden, id).toBe(true);
        expect(p?.col).toBe(bay.door.col);
        expect(p!.row >= DOOR_OPENING_ROWS.from && p!.row + 1 <= DOOR_OPENING_ROWS.to, id).toBe(true);
      }
      expect(bay.guards.length).toBeGreaterThanOrEqual(2);
      expect(bay.guards.some((g) => g.enemyId === 'security') && bay.guards.some((g) => g.enemyId === 'clerk'), `bay ${bay.index} has both kinds`).toBe(true);
    }
    // Each bay sits between its predecessor's door and its own.
    HALL_BAYS.forEach((bay, i) => {
      const prev = i === 0 ? 1 : HALL_BAYS[i - 1]!.door.col + 2 - 1;
      expect(bay.cols.from).toBeGreaterThan(prev);
      expect(bay.cols.to).toBe(bay.door.col - 1);
    });
  });

  it('everything in the hall is reachable once the switches have dropped the barriers, in order', () => {
    const reach = flood(hall, hall.playerStart, allSkips(hall));
    for (const bay of HALL_BAYS) {
      for (const g of bay.guards) expect(reach.has(`${g.tile.col},${g.tile.row}`), `bay ${bay.index} guard ${g.tile.col},${g.tile.row}`).toBe(true);
    }
    expect(has(reach, LIFT_GUARD_SPOT)).toBe(true);
    expect(anyIn(reach, LIFT_AREA)).toBe(true);
    const rec = HALL_BAYS[2]!.recorder!;
    expect(near(reach, rec.spot, 20)).toBe(true);
    expect(walkable(hall, rec.spot)).toBe(true);
    // The recorder is in bay 3's north wall.
    expect(rec.tile.col >= HALL_BAYS[2]!.cols.from && rec.tile.col <= HALL_BAYS[2]!.cols.to).toBe(true);
  });

  it('a barrier in bay 2 and in bay 4 shuts the way until its switch, which is reachable before it', () => {
    const gravityBays = HALL_BAYS.filter((b) => b.gravity);
    expect(gravityBays.map((b) => b.index)).toEqual([2, 4]);
    for (const bay of gravityBays) {
      const g = bay.gravity!;
      const others = HALL_BAYS.filter((b) => b !== bay).flatMap((b) => b.gravity?.barrier.propIds ?? []);
      // Barrier standing: the bay's door is cut off, the switch is not.
      const shut = flood(hall, hall.playerStart, others);
      expect(shut.has(`${g.switch.standAt.col},${g.switch.standAt.row}`), `bay ${bay.index} switch reachable`).toBe(true);
      expect(anyIn(shut, bay.door.area), `bay ${bay.index} door is cut off by the barrier`).toBe(false);
      // The barrier dropped: through.
      expect(anyIn(flood(hall, hall.playerStart, [...others, ...g.barrier.propIds]), bay.door.area)).toBe(true);
      // The switch is a gravity-switch panel in the wall next to its stand cell.
      expect(hall.grid.blocked[g.switch.wall.row * hall.grid.widthTiles + g.switch.wall.col]).toBe(true);
      expect(Math.abs(g.switch.wall.col - g.switch.standAt.col) + Math.abs(g.switch.wall.row - g.switch.standAt.row)).toBe(1);
      expect(g.barrier.propIds).toHaveLength((BAY_ROWS.to - BAY_ROWS.from + 1) / 2);
      for (const id of g.barrier.propIds) expect(hall.dressing?.props?.some((p) => p.id === id && !p.hidden && p.solid), id).toBe(true);
    }
  });
});

describe('chapter 9 layout: dialogue and ids', () => {
  it('every examinable id is unique and has a line, and every proof a title', () => {
    const ids = chapter9.examinables.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    // The gravity switches, the bay switches and the lift panel are mechanisms: the systems work them and the script speaks for them.
    const mechanism = (id: string): boolean => /^c9\.gravity\.room\d\.|^c9\.hall\.(bay\d\.switch|lift)$/.test(id);
    for (const e of chapter9.examinables) {
      if (mechanism(e.id)) continue;
      expect(e.dialogueId !== undefined && hasSequence(e.dialogueId), `${e.id} has dialogue`).toBe(true);
      if (e.evidenceId) expect(hasText(`${e.evidenceId}.title`), `${e.evidenceId} title`).toBe(true);
    }
    for (const id of chapter9.def.evidence) expect(hasText(`${id}.title`), id).toBe(true);
  });

  it('prop, exit, trigger and section ids are unique', () => {
    for (const s of chapter9.screens) {
      const propIds = (s.dressing?.props ?? []).map((p) => p.id).filter((x): x is string => x !== undefined);
      expect(new Set(propIds).size, `${s.id} props`).toBe(propIds.length);
    }
    const all = (xs: readonly string[]): void => expect(new Set(xs).size).toBe(xs.length);
    all(chapter9.screens.flatMap((s) => s.exits.map((e) => e.id)));
    all(chapter9.triggers.map((t) => t.id));
    all(chapter9.def.sections.map((s) => s.id));
    all(chapter9.screens.flatMap((s) => (s.dressing?.props ?? []).map((p) => p.id ?? '')).filter((x) => x !== ''));
  });

  it('the objectives, hints, bar and board lines all exist', () => {
    for (const o of chapter9.def.objectives) {
      expect(hasText(o.textId), o.textId).toBe(true);
      expect(hasSequence(o.hint.nudgeDialogueId), o.hint.nudgeDialogueId).toBe(true);
      expect(hasSequence(o.hint.answerDialogueId), o.hint.answerDialogueId).toBe(true);
    }
    for (const id of chapter9.def.deductionBoard?.wrongAnswerDialogueIds ?? []) expect(hasSequence(id)).toBe(true);
    for (const id of [chapter9.def.bar?.openDialogueId, chapter9.def.bar?.hotDrinkDialogueId, chapter9.def.bar?.returnDialogueId]) expect(hasSequence(id ?? '')).toBe(true);
  });
});
