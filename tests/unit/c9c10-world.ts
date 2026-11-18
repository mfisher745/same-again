/**
 * Not a test file. A small chapter 9 / 10 module on one 60 x 40 screen of walls with carved rooms, for the c9c10 tests.
 * The real chapters are the level-builders'; this proves the systems against placements shaped like the ones the docs
 * describe (`docs/build/c9c10.md`).
 */

import type { AreaRect, BossPlacement, ChapterModule, ChapterScript, ChapterContext } from '../../src/core/chapter';
import { createChapter2Sandbox } from '../../src/core/sandbox2';
import type { ChapterNumber, ExaminableDef, ScreenId, SectionDef, Vec2 } from '../../src/core/types';
import { gridFromAscii, tileCentre } from '../../src/systems/grid';
import type { GravityLayout, GravityRoomLayout } from '../../src/systems/gravity';
import type { BroadcastLayout } from '../../src/systems/broadcast';

export const SCREEN: ScreenId = 'c9.hall';
export const T = (col: number, row: number): Vec2 => tileCentre({ col, row });
export const rect = (col: number, row: number, w: number, h: number): AreaRect => ({ x: col * 16, y: row * 16, width: w * 16, height: h * 16 });

export interface WorldOptions {
  readonly chapter?: ChapterNumber;
  readonly sections?: readonly SectionDef[];
  /** Rectangles of floor to carve out of the walls, in tiles: `[col0, row0, col1, row1]`. */
  readonly carve?: readonly (readonly [number, number, number, number])[];
  readonly bosses?: readonly BossPlacement[];
  readonly examinables?: readonly ExaminableDef[];
  readonly gravity?: GravityLayout;
  readonly broadcast?: BroadcastLayout;
  readonly puzzleId?: string;
  readonly puzzleKind?: 'gravity' | 'broadcast';
  readonly noMeter?: boolean;
  readonly start?: Vec2;
  readonly script?: (ctx: ChapterContext) => ChapterScript;
}

export function makeWorld(o: WorldOptions = {}): ChapterModule {
  const base = createChapter2Sandbox();
  const g: string[][] = Array.from({ length: 40 }, () => Array.from({ length: 60 }, () => '#'));
  for (const [c0, r0, c1, r1] of o.carve ?? [[1, 1, 58, 38]]) for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) (g[r] as string[])[c] = '.';
  const chapter = o.chapter ?? 9;
  const start = o.start ?? T(3, 3);
  const puzzleId = (o.puzzleId ?? (chapter === 9 ? 'c9.puzzle.gravity' : 'c10.puzzle.broadcast')) as never;
  return {
    ...base,
    def: {
      ...base.def,
      number: chapter,
      screens: [{ id: SCREEN, region: 'base', widthTiles: 60, heightTiles: 40 }],
      startScreenId: SCREEN,
      sections: o.sections ?? [],
      stealthSections: [],
      puzzle: { id: puzzleId, chapter, kind: o.puzzleKind ?? (chapter === 9 ? 'gravity' : 'broadcast') },
      evidence: [],
      bar: { screenId: SCREEN, arrival: start, hotDrinkProp: start, openDialogueId: 'c2.bar.open', hotDrinkDialogueId: 'c2.bar.hotDrink', returnDialogueId: 'c2.bar.return' },
    },
    screens: [{ id: SCREEN, grid: gridFromAscii(g.map((r) => r.join(''))), exits: [], playerStart: start, ...(o.noMeter ? { noMeter: true as const } : {}) }],
    pickups: [],
    examinables: o.examinables ?? [],
    fights: [],
    bosses: o.bosses ?? [],
    stealth: [],
    sheepPuzzles: [],
    triggers: [],
    ...(o.gravity ? { gravityPuzzles: [{ sectionId: puzzleId, screenId: SCREEN, layout: o.gravity }] } : {}),
    ...(o.broadcast ? { broadcastPuzzles: [{ sectionId: puzzleId, screenId: SCREEN, layout: o.broadcast }] } : {}),
    createScript: o.script,
  };
}

/** The three sample gravity rooms from `docs/build/c9c10.md`. Room 1 teaches, room 2 puts a crate on a plate, room 3 needs a ledge. */
export function sampleGravity(): GravityLayout {
  const room1: GravityRoomLayout = {
    id: 'room1',
    area: { col: 2, row: 2, width: 6, height: 3 },
    crates: [],
    fixed: [],
    plates: [],
    ledges: [{ id: 'l1', col: 7, row: 2 }],
    switches: [{ id: 'r1.s', examinableId: 'g.r1.s', dir: 'right', col: 2, row: 1 }],
    andrewStart: { col: 2, row: 2 },
    resetExaminableId: 'g.r1.reset',
  };
  const room2: GravityRoomLayout = {
    id: 'room2',
    area: { col: 12, row: 2, width: 6, height: 4 },
    crates: [{ id: 'c2a', col: 14, row: 3 }],
    fixed: [],
    plates: [{ id: 'p2', col: 17, row: 5 }],
    ledges: [],
    switches: [
      { id: 'r2.a', examinableId: 'g.r2.a', dir: 'right', col: 11, row: 3 },
      { id: 'r2.b', examinableId: 'g.r2.b', dir: 'down', col: 16, row: 1 },
    ],
    andrewStart: { col: 12, row: 3 },
    resetExaminableId: 'g.r2.reset',
  };
  const room3: GravityRoomLayout = {
    id: 'room3',
    area: { col: 22, row: 2, width: 6, height: 5 },
    crates: [{ id: 'c3a', col: 23, row: 5 }],
    fixed: [{ col: 25, row: 6 }],
    plates: [],
    ledges: [{ id: 'l3', col: 25, row: 4 }],
    switches: [
      { id: 'r3.a', examinableId: 'g.r3.a', dir: 'down', col: 25, row: 1 },
      { id: 'r3.b', examinableId: 'g.r3.b', dir: 'up', col: 22, row: 7 },
    ],
    andrewStart: { col: 22, row: 5 },
    resetExaminableId: 'g.r3.reset',
  };
  return { rooms: [room1, room2, room3] };
}

export const GRAVITY_CARVE: readonly (readonly [number, number, number, number])[] = [
  [2, 2, 7, 4],
  [12, 2, 17, 5],
  [22, 2, 27, 6],
  // A corridor along the bottom joins everything, for walking between rooms.
  [1, 9, 40, 12],
];

export function gravityExaminables(layout: GravityLayout): ExaminableDef[] {
  return layout.rooms.flatMap((r) => [
    ...r.switches.map((s) => ({ id: s.examinableId, screenId: SCREEN, position: T(s.col, s.row) })),
    ...(r.resetExaminableId ? [{ id: r.resetExaminableId, screenId: SCREEN, position: T(r.area.col + 1, r.area.row - 1) }] : []),
  ]);
}

export function sampleBroadcast(): BroadcastLayout {
  return {
    sockets: [
      { id: 's1', examinableId: 'b.s1', shape: 'round', look: 'round' },
      { id: 's2', examinableId: 'b.s2', shape: 'square', look: 'square' },
      { id: 's3', examinableId: 'b.s3', shape: 'triangle', look: 'triangle' },
      { id: 's4', examinableId: 'b.s4', shape: 'flat', look: 'slot' },
      { id: 's5', examinableId: 'b.s5', shape: 'flatNotched', look: 'slot' },
    ],
    plugs: [
      { proofId: 'c9.proof.craft', shape: 'flat' },
      { proofId: 'c9.proof.contract', shape: 'square' },
      { proofId: 'c9.proof.directory', shape: 'triangle' },
      { proofId: 'c9.proof.log', shape: 'round' },
      { proofId: 'c9.proof.footage', shape: 'flatNotched' },
    ],
    buttonExaminableId: 'b.button',
    wrongTextId: 'c10.broadcast.wrong',
  };
}
