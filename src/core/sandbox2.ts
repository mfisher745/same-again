/**
 * Chapter 2 sandbox: one 60 x 24 screen with every mechanism the chapter
 * needs, built from placeholder shapes, for headless proof and the dev
 * harness. Not part of the game. It borrows the real section IDs
 * (`c2.stealth.bog`, `c2.puzzle.sheep`, `c2.setpiece.ram`) so their tuning
 * applies, and uses `ChapterContext` only, the way chapter 2's script will.
 *
 * Layout (tiles):
 * - The bar: cols 1 to 8, rows 12 to 21. Andrew arrives at (4, 14).
 * - The yard: cols 1 to 58, rows 1 to 9, joined to the bar by a gap at cols 3 to 5.
 *   - Stealth section `c2.stealth.bog`: one suit patrols row 3 from col 14 to col 26; stacked turf (sight only)
 *     at cols 18 and 19, rows 2 to 5; exit at cols 27 and 28. It has no start area: the trigger at cols 10 to 12
 *     (the van arriving) starts it from the script.
 *   - Feed buckets (breakable, two hits) at (24, 5) and (25, 5), for The Stumble.
 *   - Sheep puzzle `c2.puzzle.sheep`: three sheep in the first pen, gates at cols 34, 37 and 40 (rows 4 to 6),
 *     far pen cols 41 to 45. Each gate swings between closed and open. E at the examinable beside it swings it.
 * - The lane: cols 9 to 58, rows 15 to 17. `c2.setpiece.ram`: an invulnerable ram at (9, 16), a puddle (slow) at
 *   cols 14 to 16, a wheelbarrow at col 20 (row 15), a gate across the lane at col 30 that E opens, a cattle grid
 *   at col 52 that enemies cannot cross, and the exit at cols 56 to 58.
 */

import { PROP } from '../art/props';
import type { ChapterModule } from './chapter';
import type { ChapterNumber, ScreenId, StealthSectionDef, Vec2 } from './types';
import { gridFromAscii, tileCentre } from '../systems/grid';

const T = (col: number, row: number): Vec2 => tileCentre({ col, row });
const px = (col: number, row: number, w: number, h: number): { x: number; y: number; width: number; height: number } => ({ x: col * 16, y: row * 16, width: w * 16, height: h * 16 });

const W = 60;
const H = 24;

function rows(): string[] {
  const g: string[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => '#'));
  const open = (c0: number, r0: number, c1: number, r1: number, ch = '.'): void => {
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) (g[r] as string[])[c] = ch;
  };
  open(1, 12, 8, 21); // the bar
  open(1, 1, 58, 9); // the yard
  open(3, 10, 5, 11); // the gap between the bar and the yard
  open(9, 15, 58, 17); // the lane
  // Stacked turf: blocks sight only.
  open(18, 2, 19, 5, 'o');
  // The sheep pens: walls across the area except the gate gaps (rows 4 to 6).
  for (const c of [34, 37, 40]) for (const r of [2, 3, 7, 8]) (g[r] as string[])[c] = '#';
  return g.map((r) => r.join(''));
}

const GATES = [
  { id: 'gateA', col: 34, examinable: 'sandbox.gateA' },
  { id: 'gateB', col: 37, examinable: 'sandbox.gateB' },
  { id: 'gateC', col: 40, examinable: 'sandbox.gateC' },
] as const;

const gateTiles = (col: number): { col: number; row: number }[] => [4, 5, 6].map((row) => ({ col, row }));

export function createChapter2Sandbox(): ChapterModule {
  const chapter: ChapterNumber = 2;
  const screenId: ScreenId = 'c2.sandbox';
  const stealthDef: StealthSectionDef = {
    id: 'c2.stealth.bog',
    checkpointId: 'c2.sandbox.stealth',
    guards: [
      {
        enemyId: 'suit',
        route: {
          mode: 'pingPong',
          waypoints: [
            { position: T(14, 3), waitMs: 800, facing: 'right' },
            { position: T(26, 3), waitMs: 800, facing: 'left' },
          ],
        },
      },
    ],
    hazards: [],
    hidingProps: [],
    reward: { kind: 'clue', clueId: 'c2.clue.lanyard' },
  };

  return {
    def: {
      number: chapter,
      titleTextId: 'ui.title',
      screens: [{ id: screenId, region: 'kilnamoe', widthTiles: W, heightTiles: H }],
      startScreenId: screenId,
      checkpoints: [],
      sections: [
        { id: 'c2.explore.bar', kind: 'explore', mykoCallable: false },
        { id: 'c2.stealth.bog', kind: 'stealth', mykoCallable: false },
        { id: 'c2.puzzle.sheep', kind: 'puzzle', mykoCallable: true },
        { id: 'c2.setpiece.ram', kind: 'setpiece', mykoCallable: true },
      ],
      stealthSections: [stealthDef],
      puzzle: { id: 'c2.puzzle.sheep', chapter, kind: 'sheepGates' },
      evidence: ['c2.clue.ring', 'c2.clue.lanyard'],
      objectives: [],
      newAbilities: [],
      mykoCallLines: {
        setpiece: { sequenceId: 'c2.call.ram', casebookBodyTextId: 'c2.call.ram.casebook', casebookMarginTextId: 'c2.call.ram.margin' },
        fight: { sequenceId: 'c2.call.fight', casebookBodyTextId: 'c2.call.fight.casebook', casebookMarginTextId: 'c2.call.fight.margin' },
        puzzle: { sequenceId: 'c2.call.puzzle', casebookBodyTextId: 'c2.call.puzzle.casebook', casebookMarginTextId: 'c2.call.puzzle.margin' },
      },
      finaleSectionId: 'c2.setpiece.ram',
      bar: {
        screenId,
        arrival: T(4, 14),
        hotDrinkProp: T(6, 14),
        openDialogueId: 'c2.bar.open',
        hotDrinkDialogueId: 'c2.bar.hotDrink',
        returnDialogueId: 'c2.bar.return',
      },
    },
    screens: [
      {
        id: screenId,
        grid: gridFromAscii(rows()),
        exits: [],
        playerStart: T(4, 14),
        dressing: {
          props: [
            { id: 'yard.bucket1', frame: PROP.feedBuckets, col: 24, row: 5, solid: { width: 1, height: 1 }, breakable: { hits: 2, loot: 'none' } },
            { id: 'yard.bucket2', frame: PROP.feedBuckets, col: 25, row: 5, solid: { width: 1, height: 1 }, breakable: { hits: 2, loot: 'none' } },
            { id: 'lane.puddle', frame: PROP.puddleLarge, col: 14, row: 15, layer: 'floor', slows: { width: 3, height: 2 } },
            { id: 'lane.wheelbarrow', frame: PROP.wheelbarrow, col: 20, row: 15, solid: { width: 1, height: 1 } },
            { id: 'lane.gate', frame: PROP.fieldGate.along3, col: 30, row: 15, solid: { width: 1, height: 3 } },
            ...[15, 16, 17].map((row) => ({ id: `lane.grid.${row}`, frame: PROP.cattleGrid, col: 52, row, layer: 'floor' as const, blocksEnemies: { width: 1, height: 1 } })),
          ],
        },
      },
    ],
    pickups: [],
    examinables: [
      { id: 'sandbox.ring', screenId, position: T(6, 6), evidenceId: 'c2.clue.ring' },
      { id: 'sandbox.laneGate', screenId, position: T(29, 16) },
      { id: 'sandbox.gateA', screenId, position: T(33, 2) },
      { id: 'sandbox.gateB', screenId, position: T(36, 2) },
      { id: 'sandbox.gateC', screenId, position: T(39, 2) },
    ],
    fights: [],
    bosses: [
      {
        bossId: 'c2.setpiece.ram',
        callId: 'ram',
        screenId,
        trigger: { kind: 'area', area: px(11, 15, 3, 3) },
        bodies: [{ tag: 'ram', position: T(9, 16), invulnerable: true }],
        entrance: T(10, 16),
        exitArea: px(56, 15, 3, 3),
      },
    ],
    stealth: [
      {
        sectionId: 'c2.stealth.bog',
        screenId,
        exitArea: px(27, 1, 2, 9),
        entrance: T(12, 8),
        reinforcementPoints: [T(28, 8), T(28, 9)],
      },
    ],
    sheepPuzzles: [
      {
        sectionId: 'c2.puzzle.sheep',
        screenId,
        layout: {
          area: { col: 30, row: 2, width: 16, height: 7 },
          sheep: [
            { id: 'sheep1', col: 32, row: 3 },
            { id: 'sheep2', col: 32, row: 5 },
            { id: 'sheep3', col: 32, row: 7 },
          ],
          gates: GATES.map((g) => ({ id: g.id, positions: [gateTiles(g.col), []] as const, examinableId: g.examinable })),
          // The three pens before the far one, between the gates.
          pens: [
            { id: 'pen1', col: 30, row: 2, width: 4, height: 7 },
            { id: 'pen2', col: 35, row: 2, width: 2, height: 7 },
            { id: 'pen3', col: 38, row: 2, width: 2, height: 7 },
          ],
          targetPen: { col: 41, row: 2, width: 5, height: 7 },
          solution: {
            sheep: [
              { id: 'sheep1', col: 43, row: 3 },
              { id: 'sheep2', col: 43, row: 5 },
              { id: 'sheep3', col: 43, row: 7 },
            ],
            gates: { gateA: 1, gateB: 1, gateC: 1 },
          },
        },
      },
    ],
    // Not `once`: after a return to the bar the section starts over and the van trigger must start it again.
    triggers: [{ id: 'sandbox.van', screenId, area: px(10, 1, 3, 9), once: false }],
    createScript: (ctx) => ({
      onStart: () => {
        for (const id of ['shoulder', 'stoutSlam', 'stumble'] as const) ctx.learnMove(id);
        ctx.give({ kind: 'drink', drinkId: 'stout', count: 2 });
      },
      onTrigger: (id) => {
        // The van arrives: the Department men take up their routes.
        if (id === 'sandbox.van') ctx.startSection('c2.stealth.bog');
      },
      onExamine: (id) => {
        if (id !== 'sandbox.laneGate') return undefined;
        ctx.setPropVisible('lane.gate', false);
        return true;
      },
    }),
  };
}
