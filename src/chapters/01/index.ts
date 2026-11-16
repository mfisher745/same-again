/**
 * Chapter 1: A Quiet Pint. docs/chapters/01-a-quiet-pint.md.
 */

import { hasSequence } from '../../content/dialogue';
import type { ChapterModule } from '../../core/chapter';
import type { ChapterDef, ObjectiveDef } from '../../core/types';
import { createChapterScript } from './script';
import {
  HURLEY_TILE,
  KEG_AREA,
  PUB_ARRIVAL,
  T,
  URN_SPOT,
  YARD_GATE_FRONT,
  YARD_PATH_MOUTH,
  kegTile,
  pubScreen,
  roadScreen,
  streetScreen,
  tilesArea,
  yardScreen,
} from './maps';

const objective = (key: string, id: string): ObjectiveDef => ({
  id,
  textId: `c1.objective.${key}`,
  hint: {
    objectiveId: id,
    nudgeDialogueId: `c1.hint.${key}.1`,
    answerDialogueId: `c1.hint.${key}.2`,
    ...(hasSequence(`c1.hint.${key}.where`) ? { whereDialogueId: `c1.hint.${key}.where` } : {}),
  },
});

const def: ChapterDef = {
  number: 1,
  titleTextId: 'c1.title',
  screens: [
    { id: 'c1.pub', region: 'kilnamoe', widthTiles: 30, heightTiles: 17 },
    { id: 'c1.yard', region: 'kilnamoe', widthTiles: 20, heightTiles: 17 },
    { id: 'c1.street', region: 'kilnamoe', widthTiles: 70, heightTiles: 17 },
    { id: 'c1.road', region: 'kilnamoe', widthTiles: 30, heightTiles: 17 },
  ],
  startScreenId: 'c1.pub',
  bar: {
    screenId: 'c1.pub',
    arrival: PUB_ARRIVAL,
    hotDrinkProp: URN_SPOT,
    openDialogueId: 'c1.pub.open',
    hotDrinkDialogueId: 'c1.bar.hotDrink',
    returnDialogueId: 'c1.bar.return',
  },
  sections: [
    { id: 'c1.explore.pub', kind: 'explore', mykoCallable: false },
    { id: 'c1.puzzle.kegs', kind: 'puzzle', mykoCallable: true },
    // The stuck gate: done when The Shoulder shifts it. Finishing it is what keeps the gate open after a return to the bar.
    { id: 'c1.explore.yard', kind: 'explore', mykoCallable: false },
    { id: 'c1.explore.street', kind: 'explore', mykoCallable: false },
    { id: 'c1.fight.chipper', kind: 'fight', mykoCallable: true },
    { id: 'c1.boss.bigtom', kind: 'boss', mykoCallable: true },
    { id: 'c1.explore.road', kind: 'explore', mykoCallable: false },
  ],
  stealthSections: [],
  puzzle: { id: 'c1.puzzle.kegs', chapter: 1, kind: 'push' },
  evidence: [],
  objectives: [
    objective('bar', 'c1.bar'),
    objective('dympna', 'c1.dympna'),
    objective('pint', 'c1.pint'),
    objective('machine', 'c1.machine'),
    objective('leave', 'c1.leave'),
    objective('kegs', 'c1.kegs'),
    objective('chipper', 'c1.chipper'),
    objective('row', 'c1.row'),
    objective('bigTom', 'c1.bigTom'),
    objective('road', 'c1.road'),
    objective('hotDrink', 'c1.hotDrink'),
    objective('kit', 'c1.kit'),
    objective('gate', 'c1.gate'),
    objective('bins', 'c1.bins'),
    objective('hurley', 'c1.hurley'),
  ],
  newAbilities: ['punchCombo'],
  mykoCallLines: {
    fight: { sequenceId: 'c1.call.fight', casebookBodyTextId: 'c1.call.fight.casebook', casebookMarginTextId: 'c1.call.fight.margin' },
    puzzle: { sequenceId: 'c1.call.puzzle', casebookBodyTextId: 'c1.call.puzzle.casebook', casebookMarginTextId: 'c1.call.puzzle.margin' },
  },
  finaleSectionId: 'c1.boss.bigtom',
};

const k = kegTile;

export const chapter1: ChapterModule = {
  def,
  screens: [pubScreen(), yardScreen(), streetScreen(), roadScreen()],
  pickups: [
    { id: 'c1.pickup.naggin', item: { kind: 'drink', drinkId: 'whiskey', count: 1 }, screenId: 'c1.street', position: T(26, 2), commentDialogueId: 'c1.street.whiskey' },
    { id: 'c1.pickup.empty', item: { kind: 'empties', count: 1 }, screenId: 'c1.street', position: T(12, 6), commentDialogueId: 'c1.street.empties' },
    { id: 'c1.pickup.stout1', item: { kind: 'drink', drinkId: 'stout', count: 1 }, screenId: 'c1.street', position: T(46, 5) },
    { id: 'c1.pickup.stout2', item: { kind: 'drink', drinkId: 'stout', count: 1 }, screenId: 'c1.street', position: T(53, 5) },
  ],
  examinables: [
    { id: 'c1.dympna', screenId: 'c1.pub', position: T(21, 3) },
    { id: 'c1.urn', screenId: 'c1.pub', position: URN_SPOT, objective: true },
    { id: 'c1.hurley', screenId: 'c1.street', position: T(HURLEY_TILE.col, HURLEY_TILE.row), objective: true },
    { id: 'c1.trophies', screenId: 'c1.pub', position: { x: 25 * 16, y: 24 }, dialogueId: 'c1.pub.trophies' },
    { id: 'c1.telly', screenId: 'c1.pub', position: T(27, 1), dialogueId: 'c1.pub.telly' },
    { id: 'c1.photo', screenId: 'c1.pub', position: T(1, 4), dialogueId: 'c1.pub.photo' },
    { id: 'c1.dartboard', screenId: 'c1.pub', position: T(1, 10), dialogueId: 'c1.pub.dartboard' },
  ],
  fights: [
    {
      sectionId: 'c1.fight.chipper',
      screenId: 'c1.street',
      trigger: { kind: 'script' },
      spawnPoints: [T(33, 6), T(35, 8), T(36, 10)],
      entrance: T(26, 8),
    },
  ],
  bosses: [
    {
      bossId: 'c1.boss.bigtom',
      screenId: 'c1.street',
      trigger: { kind: 'script' },
      bodies: [{ tag: 'bigtom', position: T(60, 9) }],
      entrance: T(40, 11),
    },
  ],
  stealth: [],
  pushPuzzles: [
    {
      sectionId: 'c1.puzzle.kegs',
      screenId: 'c1.yard',
      pieceKind: 'keg',
      layout: {
        // Playtest 6. The walled path to the gate, three tiles wide. Three kegs stand across its yard end and three
        // crates are stacked on it for good; kegs never leave the path. Solved when Andrew can walk to the gate.
        //   col 12 13 14 15 16 17
        //   r6   1  .  .  #  .  =
        //   r7   2  3  .  .  .  ·  gate
        //   r8   .  #  #  .  .  =
        area: KEG_AREA,
        pieces: [
          { id: 'keg1', ...k(0, 0) },
          { id: 'keg2', ...k(0, 1) },
          { id: 'keg3', ...k(1, 1) },
        ],
        fixed: [k(3, 0), k(1, 2), k(2, 2)],
        goal: { kind: 'reach', from: YARD_PATH_MOUTH, to: YARD_GATE_FRONT },
        // Six pushes: keg1 right, keg2 up, keg3 right three times to the end of the path, keg3 up into the corner.
        // The search in tests/unit/chapter1.test.ts finds no position it cannot be solved from.
        solution: [
          { id: 'keg1', ...k(1, 0) },
          { id: 'keg2', ...k(0, 0) },
          { id: 'keg3', ...k(4, 0) },
        ],
      },
    },
  ],
  triggers: [
    { id: 'c1.trig.bar', screenId: 'c1.pub', area: tilesArea(19, 4, 4, 2), once: false },
    { id: 'c1.trig.machine', screenId: 'c1.pub', area: tilesArea(2, 6, 2, 3), once: false },
    { id: 'c1.trig.chipper', screenId: 'c1.street', area: tilesArea(29, 5, 8, 4), once: false },
    { id: 'c1.trig.call', screenId: 'c1.street', area: tilesArea(43, 5, 2, 9), once: false },
    { id: 'c1.trig.bins', screenId: 'c1.street', area: tilesArea(22, 5, 7, 3), once: false },
    { id: 'c1.trig.boss', screenId: 'c1.street', area: tilesArea(47, 5, 2, 9), once: false },
    // Just short of the east exit: the hurley reminder.
    { id: 'c1.trig.eastexit', screenId: 'c1.street', area: tilesArea(65, 8, 3, 5), once: false },
    { id: 'c1.trig.lights', screenId: 'c1.road', area: tilesArea(22, 7, 2, 3), once: false },
  ],
  createScript: createChapterScript,
};
