/**
 * Chapter 3: Regional Office. docs/chapters/03-regional-office.md.
 */

import { hasSequence } from '../../content/dialogue';
import type { ChapterModule } from '../../core/chapter';
import type { ChapterDef, EvidenceId, ObjectiveDef } from '../../core/types';
import { createChapterScript } from './script';
import {
  BAR_ARRIVAL,
  BAY_ARRIVAL,
  BOARD_SPOT,
  BOSS_AREA,
  CLUE_SPOTS,
  DOORS_AREA,
  GANTRY_ZONE,
  HALLORAN_START,
  KETTLE_SPOT,
  LEVER_SPOT,
  MANIFEST_SPOT,
  STOUT_SPOTS,
  T,
  YARD_EXIT_AREA,
  YARD_START_AREA,
  YARD_STEALTH,
  bayScreen,
  officeScreen,
  tilesArea,
  yardScreen,
} from './maps';
import { PUSH_LAYOUT } from './puzzle';

const objective = (key: string, id: string): ObjectiveDef => ({
  id,
  textId: `c3.objective.${key}`,
  hint: {
    objectiveId: id,
    nudgeDialogueId: `c3.hint.${key}.1`,
    answerDialogueId: `c3.hint.${key}.2`,
    ...(hasSequence(`c3.hint.${key}.where`) ? { whereDialogueId: `c3.hint.${key}.where` } : {}),
  },
});

const ev = (id: string): EvidenceId => id as EvidenceId;

const def: ChapterDef = {
  number: 3,
  titleTextId: 'c3.title',
  screens: [
    { id: 'c3.yard', region: 'kilnamoe', widthTiles: 40, heightTiles: 25 },
    { id: 'c3.office', region: 'kilnamoe', widthTiles: 50, heightTiles: 30 },
    { id: 'c3.bay', region: 'kilnamoe', widthTiles: 40, heightTiles: 25 },
  ],
  startScreenId: 'c3.yard',
  bar: {
    screenId: 'c3.yard',
    arrival: BAR_ARRIVAL,
    hotDrinkProp: KETTLE_SPOT,
    openDialogueId: 'c3.bar.open',
    hotDrinkDialogueId: 'c3.bar.hotDrink',
    returnDialogueId: 'c3.bar.return',
  },
  sections: [
    { id: 'c3.explore.bar', kind: 'explore', mykoCallable: false },
    { id: 'c3.stealth.yard', kind: 'stealth', mykoCallable: false },
    { id: 'c3.explore.office', kind: 'explore', mykoCallable: false },
    { id: 'c3.puzzle.crates', kind: 'puzzle', mykoCallable: true },
    { id: 'c3.explore.bayoffice', kind: 'explore', mykoCallable: false },
    { id: 'c3.fight.bay', kind: 'fight', mykoCallable: true },
    { id: 'c3.deduction.boston', kind: 'deduction', mykoCallable: true },
    { id: 'c3.boss.halloran', kind: 'boss', mykoCallable: true },
  ],
  stealthSections: [YARD_STEALTH],
  puzzle: { id: 'c3.puzzle.crates', chapter: 3, kind: 'push' },
  deductionBoard: {
    id: 'c3.deduction.boston',
    chapter: 3,
    candidateIds: ['c3.clue.map', 'c3.clue.brochure', 'c3.clue.certificate', 'c3.clue.visitors', 'c3.clue.manifest', 'c2.clue.fragment'].map(ev),
    solution: [ev('c3.clue.map'), ev('c3.clue.manifest'), ev('c2.clue.fragment')],
    leadTextId: 'c3.deduction.boston.lead.body',
    leadMarginTextId: 'c3.deduction.boston.lead.margin',
    wrongAnswerDialogueIds: ['c3.board.wrong.1', 'c3.board.wrong.2', 'c3.board.wrong.3'],
  },
  evidence: [
    'c3.clue.map',
    'c3.clue.brochure',
    'c3.clue.certificate',
    'c3.clue.visitors',
    'c3.clue.logbook',
    'c3.clue.manifest',
  ],
  objectives: [
    objective('yard', 'c3.yard'),
    objective('office', 'c3.office'),
    objective('cabinet', 'c3.cabinet'),
    objective('crates', 'c3.crates'),
    objective('manifest', 'c3.manifest'),
    objective('bay', 'c3.bay'),
    objective('board', 'c3.board'),
    objective('halloran', 'c3.halloran'),
  ],
  newAbilities: [],
  mykoCallLines: {
    fight: { sequenceId: 'c3.call.fight', casebookBodyTextId: 'c3.call.fight.casebook', casebookMarginTextId: 'c3.call.fight.margin' },
    puzzle: { sequenceId: 'c3.call.puzzle', casebookBodyTextId: 'c3.call.puzzle.casebook', casebookMarginTextId: 'c3.call.puzzle.margin' },
  },
  finaleSectionId: 'c3.boss.halloran',
};

export const chapter3: ChapterModule = {
  def,
  screens: [yardScreen(), officeScreen(), bayScreen()],
  pickups: [
    { id: 'c3.pickup.stout1', item: { kind: 'drink', drinkId: 'stout', count: 1 }, screenId: 'c3.bay', position: STOUT_SPOTS[0] },
    { id: 'c3.pickup.stout2', item: { kind: 'drink', drinkId: 'stout', count: 1 }, screenId: 'c3.bay', position: STOUT_SPOTS[1] },
  ],
  examinables: [
    { id: 'c3.kettle', screenId: 'c3.yard', position: KETTLE_SPOT, objective: true },
    { id: 'c3.map', screenId: 'c3.office', position: CLUE_SPOTS.map, objective: true },
    { id: 'c3.brochure', screenId: 'c3.office', position: CLUE_SPOTS.brochure, objective: true },
    { id: 'c3.certificate', screenId: 'c3.office', position: CLUE_SPOTS.certificate },
    { id: 'c3.visitors', screenId: 'c3.office', position: CLUE_SPOTS.visitors },
    { id: 'c3.manifest', screenId: 'c3.bay', position: MANIFEST_SPOT, objective: true },
    { id: 'c3.crates.lever', screenId: 'c3.bay', position: LEVER_SPOT },
    { id: 'c3.board', screenId: 'c3.bay', position: BOARD_SPOT },
  ],
  fights: [
    {
      sectionId: 'c3.fight.bay',
      screenId: 'c3.bay',
      trigger: { kind: 'script' },
      spawnPoints: [T(14, 10), T(14, 17), T(20, 19)],
      entrance: T(3, 14),
      // The four box-throwers stay on the gantry, along the north wall.
      zones: [{ enemyId: 'worker', area: GANTRY_ZONE }],
    },
  ],
  bosses: [
    {
      bossId: 'c3.boss.halloran',
      screenId: 'c3.bay',
      trigger: { kind: 'script' },
      bodies: [{ tag: 'halloran', position: HALLORAN_START }],
      entrance: BAY_ARRIVAL,
    },
  ],
  stealth: [
    {
      sectionId: 'c3.stealth.yard',
      screenId: 'c3.yard',
      startArea: YARD_START_AREA,
      exitArea: YARD_EXIT_AREA,
      entrance: T(16, 22),
      reinforcementPoints: [T(37, 20), T(37, 6)],
    },
  ],
  pushPuzzles: [{ sectionId: 'c3.puzzle.crates', screenId: 'c3.bay', pieceKind: 'crate', resetExaminableId: 'c3.crates.lever', layout: PUSH_LAYOUT }],
  deduction: { examinableId: 'c3.board' },
  triggers: [
    // Stepping out of the gap behind the skip: the yard begins.
    { id: 'c3.trig.yard', screenId: 'c3.yard', area: YARD_START_AREA, once: false },
    { id: 'c3.trig.watch1', screenId: 'c3.yard', area: tilesArea(14, 5, 4, 3), once: false },
    { id: 'c3.trig.watch2', screenId: 'c3.yard', area: tilesArea(22, 13, 4, 3), once: false },
    { id: 'c3.trig.doors', screenId: 'c3.bay', area: DOORS_AREA, once: false },
    { id: 'c3.trig.boss', screenId: 'c3.bay', area: BOSS_AREA, once: false },
  ],
  createScript: createChapterScript,
};
