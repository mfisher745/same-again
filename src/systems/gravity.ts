/**
 * Chapter 9 gravity rooms (`c9.puzzle.gravity`). Three small rooms. A wall switch, worked with the Borrowed Glove,
 * changes which way is down: everything loose in the room (crates, and Andrew if he is in it) slides toward that wall
 * until something stops it. Plain TypeScript; the run feeds it Andrew's tile and draws the result.
 *
 * - Pieces: crates (Andrew pushes them a tile at a time, as the keg puzzle), pressure plates (a crate must rest on
 *   each), ledges (Andrew must come to rest on one: he is stopped there by a crate he placed first), walls and
 *   `fixed` pillars. Gravity acts only when a switch is worked, never continuously.
 * - A room is solved when every plate is covered and, if it has ledges, Andrew has come to rest on one. A solved room
 *   stays solved and its switches stop working. Each unsolved room can be put back (`resetRoom`).
 * - `completeNow()` (the Myko call, the debug walk) solves all three.
 * - `solveRoom` is a breadth-first planner over the same rules: tests use it to prove a layout can be solved and how
 *   long it takes; a chapter's layout should be run through it.
 *
 * Positions are screen tiles. A room's `area` is its floor; every tile outside it counts as wall, as does any blocked
 * tile of the screen grid and every `fixed` tile.
 */

import { TUNING } from '../content/tuning';
import { GameEvents } from '../core/types';
import type { GameEventBus, GravityDir, PuzzleDef, PuzzleSectionId, Reward, TileCoord, TileGrid, Vec2 } from '../core/types';
import { PuzzleBase } from './investigation';
import { isBlocked, tileCentre, tileOf } from './grid';
import { cardinalOf } from './puzzles';
import type { Cardinal } from './puzzles';
import type { SectionHost } from './sections';

export interface GravityCrate {
  readonly id: string;
  readonly col: number;
  readonly row: number;
}

export interface GravityPlate {
  readonly id: string;
  readonly col: number;
  readonly row: number;
}

export interface GravityLedge {
  readonly id: string;
  readonly col: number;
  readonly row: number;
}

export interface GravitySwitch {
  readonly id: string;
  /** The examinable at the switch: E on it works it (the chapter declares the `ExaminableDef`). */
  readonly examinableId: string;
  /** Which way "down" points once it is worked. */
  readonly dir: GravityDir;
  /** The wall tile it sits on. Andrew works it from a tile beside it. */
  readonly col: number;
  readonly row: number;
}

export interface GravityRoomLayout {
  readonly id: string;
  /** The floor, in screen tiles. Everything outside is wall. */
  readonly area: { readonly col: number; readonly row: number; readonly width: number; readonly height: number };
  readonly crates: readonly GravityCrate[];
  /** Immovable tiles inside the area (pillars, the ledge's stop). */
  readonly fixed: readonly TileCoord[];
  readonly plates: readonly GravityPlate[];
  readonly ledges: readonly GravityLedge[];
  readonly switches: readonly GravitySwitch[];
  /** Where Andrew comes in; a reset that finds him under a crate puts him here. */
  readonly andrewStart: TileCoord;
  /** E on this examinable puts the room back (the chapter's "reset" panel; the line is `c9.gravity.reset`). */
  readonly resetExaminableId?: string;
}

export interface GravityLayout {
  /** Three rooms, in order. */
  readonly rooms: readonly GravityRoomLayout[];
}

/** One body that moved in a pull: a crate, or `andrew`. */
export interface GravityMove {
  readonly id: string;
  readonly from: TileCoord;
  readonly to: TileCoord;
}

export interface GravityPull {
  readonly roomId: string;
  readonly dir: GravityDir;
  readonly moves: readonly GravityMove[];
  /** Where Andrew comes to rest (his own tile if he was not in the room or did not move). */
  readonly andrewTo: TileCoord;
  /** Whether Andrew was in the room and moved. */
  readonly andrewMoved: boolean;
  /** How long the slide takes, ms. */
  readonly durationMs: number;
}

export interface GravityRoomView {
  readonly id: string;
  readonly area: GravityRoomLayout['area'];
  readonly gravity: GravityDir | null;
  readonly solved: boolean;
  readonly plates: readonly { readonly id: string; readonly col: number; readonly row: number; readonly covered: boolean }[];
  readonly ledges: readonly GravityLedge[];
  readonly switches: readonly GravitySwitch[];
  readonly fixed: readonly TileCoord[];
}

const DELTA: Readonly<Record<GravityDir, TileCoord>> = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
};

interface LiveCrate {
  readonly id: string;
  col: number;
  row: number;
  drawFrom: Vec2;
  slideMs: number;
  slideTotalMs: number;
}

interface RoomState {
  readonly layout: GravityRoomLayout;
  crates: LiveCrate[];
  gravity: GravityDir | null;
  solved: boolean;
}

/** Whether a tile is wall for this room (outside the floor, a blocked tile or a pillar). */
export function gravityWall(room: GravityRoomLayout, grid: TileGrid, col: number, row: number): boolean {
  const a = room.area;
  if (col < a.col || row < a.row || col >= a.col + a.width || row >= a.row + a.height) return true;
  if (isBlocked(grid, col, row)) return true;
  return room.fixed.some((f) => f.col === col && f.row === row);
}

interface Body {
  id: string;
  col: number;
  row: number;
}

/**
 * Slides every body toward `dir` until something stops it. Bodies nearest the wall go first, so a line of bodies packs
 * against the wall. Mutates `bodies`; returns what moved.
 */
export function slideBodies(bodies: Body[], dir: GravityDir, wall: (col: number, row: number) => boolean): GravityMove[] {
  const d = DELTA[dir];
  const order = [...bodies].sort((a, b) => b.col * d.col + b.row * d.row - (a.col * d.col + a.row * d.row));
  const moves: GravityMove[] = [];
  for (const b of order) {
    const from = { col: b.col, row: b.row };
    while (!wall(b.col + d.col, b.row + d.row) && !bodies.some((o) => o !== b && o.col === b.col + d.col && o.row === b.row + d.row)) {
      b.col += d.col;
      b.row += d.row;
    }
    if (b.col !== from.col || b.row !== from.row) moves.push({ id: b.id, from, to: { col: b.col, row: b.row } });
  }
  return moves;
}

const inRoom = (room: GravityRoomLayout, t: TileCoord): boolean => {
  const a = room.area;
  return t.col >= a.col && t.row >= a.row && t.col < a.col + a.width && t.row < a.row + a.height;
};

/** Whether a room is solved: every plate covered, and Andrew at rest on a ledge if it has any. */
export function roomGoalMet(room: GravityRoomLayout, crates: readonly { col: number; row: number }[], andrew: TileCoord | null): boolean {
  if (!room.plates.every((p) => crates.some((c) => c.col === p.col && c.row === p.row))) return false;
  if (room.ledges.length === 0) return true;
  return andrew !== null && room.ledges.some((l) => l.col === andrew.col && l.row === andrew.row);
}

const adjacent = (a: TileCoord, b: TileCoord): boolean => Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row)) <= 1;

export class GravityPuzzle extends PuzzleBase {
  private rooms: RoomState[];
  private holdMs = 0;
  private holdDir: Cardinal | null = null;
  /** Rooms whose slide has been started and whose result is checked when it ends. */
  private pending: { room: RoomState; andrew: TileCoord | null; leftMs: number }[] = [];
  pulls = 0;
  /** Whether Andrew has the Glove (a switch refuses without it). Set by the run. */
  hasGlove: () => boolean = () => true;
  /** Called after each successful push (sound). */
  onPush: (() => void) | null = null;
  /** Called when a room is solved, with the solved room ids so far (the run saves them). */
  onRoomSolved: ((solvedIds: readonly string[]) => void) | null = null;

  constructor(
    def: PuzzleDef,
    readonly layout: GravityLayout,
    private readonly grid: TileGrid,
    host: SectionHost,
    private readonly events: GameEventBus,
    reward?: Reward,
  ) {
    super(def, host, events, reward);
    this.rooms = layout.rooms.map((r) => freshRoom(r));
  }

  private get puzzleId(): PuzzleSectionId {
    return this.def.id;
  }

  // -- Reading ---------------------------------------------------------------

  roomIds(): readonly string[] {
    return this.rooms.map((r) => r.layout.id);
  }

  solvedRooms(): readonly string[] {
    return this.rooms.filter((r) => r.solved).map((r) => r.layout.id);
  }

  isRoomSolved(roomId: string): boolean {
    return this.rooms.find((r) => r.layout.id === roomId)?.solved === true;
  }

  roomAt(t: TileCoord): GravityRoomLayout | undefined {
    return this.rooms.find((r) => inRoom(r.layout, t))?.layout;
  }

  gravityOf(roomId: string): GravityDir | null {
    return this.rooms.find((r) => r.layout.id === roomId)?.gravity ?? null;
  }

  /** The room and switch an examinable belongs to, if it is a gravity switch. */
  switchFor(examinableId: string): { room: GravityRoomLayout; sw: GravitySwitch } | undefined {
    for (const r of this.layout.rooms) {
      const sw = r.switches.find((s) => s.examinableId === examinableId);
      if (sw) return { room: r, sw };
    }
    return undefined;
  }

  resetFor(examinableId: string): GravityRoomLayout | undefined {
    return this.layout.rooms.find((r) => r.resetExaminableId === examinableId);
  }

  /** Crates now, in tiles. */
  cratePositions(): readonly (GravityCrate & { readonly roomId: string })[] {
    return this.rooms.flatMap((r) => r.crates.map((c) => ({ id: c.id, col: c.col, row: c.row, roomId: r.layout.id })));
  }

  /** Pixel centre of each crate for drawing (interpolated while it slides). */
  crateDrawPositions(): readonly { readonly id: string; readonly roomId: string; readonly pos: Vec2 }[] {
    return this.rooms.flatMap((r) =>
      r.crates.map((c) => {
        const to = tileCentre(c);
        if (c.slideMs <= 0 || c.slideTotalMs <= 0) return { id: c.id, roomId: r.layout.id, pos: to };
        const t = 1 - c.slideMs / c.slideTotalMs;
        return { id: c.id, roomId: r.layout.id, pos: { x: c.drawFrom.x + (to.x - c.drawFrom.x) * t, y: c.drawFrom.y + (to.y - c.drawFrom.y) * t } };
      }),
    );
  }

  views(): readonly GravityRoomView[] {
    return this.rooms.map((r) => ({
      id: r.layout.id,
      area: r.layout.area,
      gravity: r.gravity,
      solved: r.solved,
      plates: r.layout.plates.map((p) => ({ ...p, covered: r.crates.some((c) => c.col === p.col && c.row === p.row) })),
      ledges: r.layout.ledges,
      switches: r.layout.switches,
      fixed: r.layout.fixed,
    }));
  }

  /** Whether a tile is held by a crate (for collision: a crate is solid to Andrew). */
  occupies(col: number, row: number): boolean {
    return this.rooms.some((r) => r.crates.some((c) => c.col === col && c.row === row));
  }

  /** A slide is under way: Andrew's controls are the run's to hold. */
  get sliding(): boolean {
    return this.pending.length > 0;
  }

  // -- Switches --------------------------------------------------------------

  /**
   * Works a switch. Every crate in the room, and Andrew if his tile is in it, slides toward the switch's `dir`.
   * Returns what moved (the run slides Andrew along `andrewTo`), or null if nothing happened: not a switch, the room
   * is solved, a slide is already under way in it, or Andrew has no Glove (event `gravity:changed` `refused`).
   * `viaGlove` is true when the Glove's pulse worked the switch (it needs no check).
   */
  pull(examinableId: string, andrew: TileCoord, viaGlove = false): GravityPull | null {
    if (this.isComplete()) return null;
    const hit = this.switchFor(examinableId);
    if (!hit) return null;
    const state = this.rooms.find((r) => r.layout.id === hit.room.id);
    if (!state || state.solved || this.pending.some((p) => p.room === state)) return null;
    if (!viaGlove && !this.hasGlove()) {
      this.events.emit(GameEvents.GravityChanged, { puzzleId: this.puzzleId, roomId: state.layout.id, phase: 'refused' });
      return null;
    }
    this.start();
    const dir = hit.sw.dir;
    const wall = (c: number, r: number): boolean => gravityWall(state.layout, this.grid, c, r);
    const bodies: Body[] = state.crates.map((c) => ({ id: c.id, col: c.col, row: c.row }));
    const andrewIn = inRoom(state.layout, andrew);
    if (andrewIn) bodies.push({ id: 'andrew', col: andrew.col, row: andrew.row });
    const moves = slideBodies(bodies, dir, wall);
    const tiles = Math.max(0, ...moves.map((m) => Math.abs(m.to.col - m.from.col) + Math.abs(m.to.row - m.from.row)));
    const t = TUNING.overhaul?.gravity;
    const durationMs = tiles === 0 ? 0 : Math.max(t?.minSlideMs ?? 0, tiles * (t?.slideMsPerTile ?? 0));
    for (const m of moves) {
      const crate = state.crates.find((c) => c.id === m.id);
      if (!crate) continue;
      crate.drawFrom = tileCentre(m.from);
      crate.col = m.to.col;
      crate.row = m.to.row;
      crate.slideMs = durationMs;
      crate.slideTotalMs = durationMs;
    }
    state.gravity = dir;
    this.pulls += 1;
    const a = bodies.find((b) => b.id === 'andrew');
    const andrewTo = a ? { col: a.col, row: a.row } : andrew;
    const andrewMoved = a !== undefined && (a.col !== andrew.col || a.row !== andrew.row);
    this.events.emit(GameEvents.GravityChanged, { puzzleId: this.puzzleId, roomId: state.layout.id, phase: 'pulled', dir });
    this.pending.push({ room: state, andrew: andrewIn ? andrewTo : null, leftMs: durationMs });
    if (durationMs === 0) this.settle();
    return { roomId: state.layout.id, dir, moves, andrewTo, andrewMoved, durationMs };
  }

  /** Whether a switch's examinable is within reach of a tile (tile beside it), for planners. */
  static canReach(sw: GravitySwitch, andrew: TileCoord): boolean {
    return adjacent({ col: sw.col, row: sw.row }, andrew);
  }

  // -- Crates ----------------------------------------------------------------

  /** Pushes the crate at `from` one tile in `dir` (Andrew walking into it). Returns true if it moved. */
  push(from: TileCoord, dir: Cardinal): boolean {
    if (this.isComplete()) return false;
    const state = this.rooms.find((r) => r.crates.some((c) => c.col === from.col && c.row === from.row));
    if (!state || state.solved || this.pending.some((p) => p.room === state)) return false;
    const crate = state.crates.find((c) => c.col === from.col && c.row === from.row);
    if (!crate) return false;
    const d = DELTA[dir];
    const nc = crate.col + d.col;
    const nr = crate.row + d.row;
    if (gravityWall(state.layout, this.grid, nc, nr) || this.occupies(nc, nr)) return false;
    this.start();
    crate.drawFrom = tileCentre(crate);
    crate.col = nc;
    crate.row = nr;
    const ms = TUNING.world.pushSlideMs;
    crate.slideMs = ms;
    crate.slideTotalMs = ms;
    this.onPush?.();
    // A crate on the last plate solves a room that has no ledge; a room with a ledge waits for Andrew's slide.
    if (state.layout.ledges.length === 0 && roomGoalMet(state.layout, state.crates, null)) this.solveRoom(state);
    return true;
  }

  /** Each tick: crates ease along; walking into a crate along one axis for `pushHoldMs` pushes it; slides end. */
  update(dtMs: number, playerPos: Vec2, move: Vec2): void {
    for (const r of this.rooms) for (const c of r.crates) c.slideMs = Math.max(0, c.slideMs - dtMs);
    if (this.pending.length > 0) {
      for (const p of this.pending) p.leftMs -= dtMs;
      this.settle();
    }
    const dir = cardinalOf(move);
    if (!dir || this.isComplete() || this.sliding) {
      this.holdMs = 0;
      this.holdDir = null;
      return;
    }
    const d = DELTA[dir];
    const reach = TUNING.player.bodyWidth / 2 + 2;
    const t = tileOf({ x: playerPos.x + d.col * reach, y: playerPos.y + d.row * reach });
    const crate = this.rooms.flatMap((r) => r.crates).find((c) => c.col === t.col && c.row === t.row && c.slideMs <= 0);
    if (!crate) {
      this.holdMs = 0;
      this.holdDir = null;
      return;
    }
    if (this.holdDir !== dir) {
      this.holdDir = dir;
      this.holdMs = 0;
    }
    this.holdMs += dtMs;
    if (this.holdMs >= TUNING.world.pushHoldMs) {
      this.holdMs = 0;
      this.push({ col: crate.col, row: crate.row }, dir);
    }
  }

  private settle(): void {
    const done = this.pending.filter((p) => p.leftMs <= 0);
    if (done.length === 0) return;
    this.pending = this.pending.filter((p) => p.leftMs > 0);
    for (const p of done) {
      this.events.emit(GameEvents.GravityChanged, { puzzleId: this.puzzleId, roomId: p.room.layout.id, phase: 'settled', ...(p.room.gravity ? { dir: p.room.gravity } : {}) });
      if (!p.room.solved && roomGoalMet(p.room.layout, p.room.crates, p.andrew)) this.solveRoom(p.room);
    }
  }

  private solveRoom(state: RoomState): void {
    if (state.solved) return;
    state.solved = true;
    this.events.emit(GameEvents.GravityChanged, { puzzleId: this.puzzleId, roomId: state.layout.id, phase: 'roomSolved' });
    this.onRoomSolved?.(this.solvedRooms());
    if (this.rooms.every((r) => r.solved)) this.solved();
  }

  // -- Reset -----------------------------------------------------------------

  /**
   * Puts an unsolved room back: crates at their start tiles, gravity at rest. Returns the tile Andrew goes to if he
   * was standing where a crate comes back (his own tile otherwise), or null if there was nothing to reset.
   */
  resetRoom(roomId: string, andrew?: TileCoord): TileCoord | null {
    const state = this.rooms.find((r) => r.layout.id === roomId);
    if (!state || state.solved || this.isComplete()) return null;
    this.pending = this.pending.filter((p) => p.room !== state);
    state.crates = state.layout.crates.map((c) => liveCrate(c));
    state.gravity = null;
    this.events.emit(GameEvents.GravityChanged, { puzzleId: this.puzzleId, roomId, phase: 'reset' });
    if (andrew && inRoom(state.layout, andrew) && state.crates.some((c) => c.col === andrew.col && c.row === andrew.row)) return { ...state.layout.andrewStart };
    return andrew ?? null;
  }

  /** Puts every unsolved room back. */
  override reset(): void {
    if (this.isComplete()) return;
    for (const r of this.rooms) this.resetRoom(r.layout.id);
    this.pulls = 0;
  }

  /** Restores solved rooms from a saved list (a load): crates on plates, switches dead. No events. */
  restoreSolved(roomIds: readonly string[]): void {
    for (const r of this.rooms) {
      if (!roomIds.includes(r.layout.id)) continue;
      r.crates = solvedCrates(r.layout);
      r.solved = true;
    }
  }

  protected applySolution(): void {
    this.pending = [];
    for (const r of this.rooms) {
      r.crates = solvedCrates(r.layout);
      r.gravity = null;
      r.solved = true;
    }
  }
}

function liveCrate(c: GravityCrate): LiveCrate {
  return { id: c.id, col: c.col, row: c.row, drawFrom: tileCentre(c), slideMs: 0, slideTotalMs: 0 };
}

function freshRoom(layout: GravityRoomLayout): RoomState {
  return { layout, crates: layout.crates.map((c) => liveCrate(c)), gravity: null, solved: false };
}

/** Crates with the first ones on the plates, the rest where they started. */
function solvedCrates(layout: GravityRoomLayout): LiveCrate[] {
  return layout.crates.map((c, i) => {
    const plate = layout.plates[i];
    return liveCrate(plate ? { id: c.id, col: plate.col, row: plate.row } : c);
  });
}

// ---------------------------------------------------------------------------
// Planner
// ---------------------------------------------------------------------------

export type GravityStep = { readonly kind: 'walk'; readonly dir: GravityDir } | { readonly kind: 'pull'; readonly switchId: string };

/**
 * The shortest list of steps (Andrew walks a tile, pushing a crate in front of him if there is room, or works a switch
 * he is beside) that solves a room from its start, or null if none exists within `maxStates` states. Same rules as the
 * puzzle: crates and Andrew slide at a pull, plates and ledges do not stop anything.
 */
export function solveRoom(room: GravityRoomLayout, grid: TileGrid, maxStates = 200000): GravityStep[] | null {
  const wall = (c: number, r: number): boolean => gravityWall(room, grid, c, r);
  interface S {
    a: TileCoord;
    crates: TileCoord[];
  }
  const key = (s: S): string => `${s.a.col},${s.a.row}|${s.crates.map((c) => `${c.col},${c.row}`).join(';')}`;
  const start: S = { a: { ...room.andrewStart }, crates: room.crates.map((c) => ({ col: c.col, row: c.row })) };
  const seen = new Map<string, { prev: string | null; step: GravityStep | null }>([[key(start), { prev: null, step: null }]]);
  const states = new Map<string, S>([[key(start), start]]);
  let frontier = [start];
  const dirs: GravityDir[] = ['up', 'down', 'left', 'right'];
  const finish = (k: string): GravityStep[] => {
    const out: GravityStep[] = [];
    for (let cur: string | null = k; cur !== null; ) {
      const e = seen.get(cur);
      if (!e) break;
      if (e.step) out.push(e.step);
      cur = e.prev;
    }
    return out.reverse();
  };
  if (room.plates.length === 0 && room.ledges.length === 0) return null;
  while (frontier.length > 0 && seen.size < maxStates) {
    const next: S[] = [];
    for (const s of frontier) {
      const sk = key(s);
      const visit = (n: S, step: GravityStep, solvedHere: boolean): GravityStep[] | null => {
        const nk = key(n);
        if (seen.has(nk)) return null;
        seen.set(nk, { prev: sk, step });
        states.set(nk, n);
        if (solvedHere) return finish(nk);
        next.push(n);
        return null;
      };
      for (const dir of dirs) {
        const d = DELTA[dir];
        const t = { col: s.a.col + d.col, row: s.a.row + d.row };
        if (wall(t.col, t.row)) continue;
        const ci = s.crates.findIndex((c) => c.col === t.col && c.row === t.row);
        let crates = s.crates;
        if (ci >= 0) {
          const b = { col: t.col + d.col, row: t.row + d.row };
          if (wall(b.col, b.row) || s.crates.some((c) => c.col === b.col && c.row === b.row)) continue;
          crates = s.crates.map((c, i) => (i === ci ? b : c));
        }
        const n: S = { a: t, crates };
        const done = room.ledges.length === 0 && roomGoalMet(room, crates, null);
        const r = visit(n, { kind: 'walk', dir }, done);
        if (r) return r;
      }
      for (const sw of room.switches) {
        if (!adjacent({ col: sw.col, row: sw.row }, s.a)) continue;
        const bodies: Body[] = [{ id: 'andrew', col: s.a.col, row: s.a.row }, ...s.crates.map((c, i) => ({ id: `c${i}`, col: c.col, row: c.row }))];
        slideBodies(bodies, sw.dir, wall);
        const andrew = bodies[0] as Body;
        const n: S = { a: { col: andrew.col, row: andrew.row }, crates: bodies.slice(1).map((b) => ({ col: b.col, row: b.row })) };
        const r = visit(n, { kind: 'pull', switchId: sw.id }, roomGoalMet(room, n.crates, n.a));
        if (r) return r;
      }
    }
    frontier = next;
  }
  return null;
}

/**
 * A rough time for a plan, seconds: Andrew walks a tile in `TILE / runSpeed` and a pull is the slide itself plus half a
 * second to reach and press E. For "solvable in under two minutes" checks.
 */
export function estimateSeconds(steps: readonly GravityStep[]): number {
  const walk = 16 / TUNING.player.runSpeed;
  const slide = Math.max(TUNING.overhaul?.gravity?.minSlideMs ?? 0, 6 * (TUNING.overhaul?.gravity?.slideMsPerTile ?? 0)) / 1000;
  return steps.reduce((t, s) => t + (s.kind === 'walk' ? walk : slide + 0.5), 0);
}
