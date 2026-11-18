/**
 * Chapter 8: The Long Road. docs/chapters/08-the-long-road.md.
 *
 * The three screens, their exits, the dressing, the examinables, the section placements and every constant for the
 * script and the systems are in `maps.ts`. `script.ts` plays every beat.
 * Not registered in `src/chapters/index.ts`.
 */

import { hasSequence } from '../../content/dialogue';
import type { ChapterModule } from '../../core/chapter';
import type { ChapterDef, ClueId, DeductionBoardDef, DialogueId, ObjectiveDef, PickupDef, TextId } from '../../core/types';
import { junctionExaminableId, junctionLayoutFrom } from '../../systems/perimeter';
import { createChapterScript } from './script';
import {
  ATTENDANT_TILE,
  BAR_ARRIVAL,
  BARRED_TRIGGER,
  CAR_SPOT,
  CLIPBOARD_SPOT,
  CORRIDOR_LINES,
  FENCE_AGENT_SPAWNS,
  FENCE_FIGHT_AREA,
  FIGHT_ENTRANCE,
  FIGHT_HEADLIGHTS,
  JUNCTION_BOXES,
  PRUITT2,
  SENSOR_LINES,
  GATE_ARRIVE_AREA,
  GATE_BOTTLE_SPOTS,
  GATE_CLOSING_AREA,
  GATE_MYKO_ENTRANCE,
  JUNCTION_TRIGGER,
  PERIMETER_BOTTLE_SPOTS,
  PERIMETER_OPEN_AREA,
  PERIMETER_STEALTH,
  PRUITT_START,
  PRUITT_TRIGGER,
  ROAD_BOTTLE_SPOTS,
  SCHEDULE_SPOT,
  STEALTH_ENTRANCE,
  STEALTH_EXIT,
  STEALTH_REINFORCEMENTS,
  STEALTH_START,
  SUN_AREA,
  T,
  TEA_SPOT,
  gateScreen,
  perimeterScreen,
  roadScreen,
} from './maps';

export * from './maps';

const objective = (key: string, id: string): ObjectiveDef => ({
  id,
  textId: `c8.objective.${key}`,
  hint: {
    objectiveId: id,
    nudgeDialogueId: `c8.hint.${key}.1`,
    answerDialogueId: `c8.hint.${key}.2`,
    ...(hasSequence(`c8.hint.${key}.where`) ? { whereDialogueId: `c8.hint.${key}.where` } : {}),
  },
});

const clue = (key: string): ClueId => `c8.clue.${key}`;
const PERMIT: ClueId = 'c7.clue.permit';

const board: DeductionBoardDef = {
  id: 'c8.deduction.gate',
  chapter: 8,
  candidateIds: [clue('schedule'), clue('shift'), PERMIT, clue('car')],
  solution: [clue('schedule'), clue('shift'), PERMIT],
  leadTextId: 'c8.deduction.gate.lead.body',
  leadMarginTextId: 'c8.deduction.gate.lead.margin',
  wrongAnswerDialogueIds: ['c8.board.wrong.1', 'c8.board.wrong.2', 'c8.board.wrong.3'],
};

/** What E says on each examinable: an existing sequence, or the body text of a clue entry. */
export const EXAMINE_LINES: Readonly<Record<string, { readonly sequence?: DialogueId; readonly text?: TextId }>> = {
  'c8.tea': { sequence: 'c8.bar.hotDrink' },
  'c8.attendant': { sequence: 'c8.attendant.1' },
  'c8.clue.schedule': { text: 'c8.clue.schedule.body' },
  'c8.clue.car': { sequence: 'c8.car' },
  'c8.clue.shift': { text: 'c8.clue.shift.body' },
  // The door of each box shows its two lines: `c8.junction.diagram` filled in with their numbers.
  ...Object.fromEntries(JUNCTION_BOXES.map((b) => [junctionExaminableId(b.id), { text: 'c8.junction.diagram' }])),
};

const def: ChapterDef = {
  number: 8,
  titleTextId: 'c8.title',
  screens: [
    { id: 'c8.road', region: 'nevada', sun: true, widthTiles: 60, heightTiles: 20 },
    { id: 'c8.perimeter', region: 'nevada', sun: true, widthTiles: 100, heightTiles: 40 },
    { id: 'c8.gate', region: 'nevada', sun: true, widthTiles: 40, heightTiles: 20 },
  ],
  startScreenId: 'c8.road',
  bar: {
    screenId: 'c8.road',
    arrival: BAR_ARRIVAL,
    hotDrinkProp: TEA_SPOT,
    openDialogueId: 'c8.bar.open',
    hotDrinkDialogueId: 'c8.bar.hotDrink',
    returnDialogueId: 'c8.bar.return',
  },
  sections: [
    { id: 'c8.explore.bar', kind: 'explore', mykoCallable: false },
    { id: 'c8.explore.road', kind: 'explore', mykoCallable: false },
    { id: 'c8.stealth.perimeter', kind: 'stealth', mykoCallable: false },
    { id: 'c8.puzzle.junctions', kind: 'puzzle', mykoCallable: true },
    { id: 'c8.fight.fence', kind: 'fight', mykoCallable: true },
    { id: 'c8.deduction.gate', kind: 'deduction', mykoCallable: true },
    { id: 'c8.boss.pruitt2', kind: 'boss', mykoCallable: true },
  ],
  stealthSections: [PERIMETER_STEALTH],
  puzzle: { id: 'c8.puzzle.junctions', chapter: 8, kind: 'junctions' },
  deductionBoard: board,
  evidence: [clue('schedule'), clue('car'), clue('shift')],
  objectives: [
    objective('station', 'c8.station'),
    objective('wash', 'c8.wash'),
    objective('perimeter', 'c8.perimeter'),
    objective('junctions', 'c8.junctions'),
    objective('fence', 'c8.fence'),
    objective('board', 'c8.board'),
    objective('pruitt', 'c8.pruitt'),
  ],
  newAbilities: [],
  mykoCallLines: {
    fight: { sequenceId: 'c8.call.fight', casebookBodyTextId: 'c8.call.fight.casebook', casebookMarginTextId: 'c8.call.fight.margin' },
    puzzle: { sequenceId: 'c8.call.puzzle', casebookBodyTextId: 'c8.call.puzzle.casebook', casebookMarginTextId: 'c8.call.puzzle.margin' },
    setpiece: { sequenceId: 'c8.call.pruitt', casebookBodyTextId: 'c8.call.pruitt.casebook', casebookMarginTextId: 'c8.call.pruitt.margin' },
  },
  finaleSectionId: 'c8.boss.pruitt2',
};

const bottles = (prefix: string, screenId: 'c8.road' | 'c8.perimeter' | 'c8.gate', spots: readonly { x: number; y: number }[]): PickupDef[] =>
  spots.map((position, i) => ({ id: `c8.pickup.empties.${prefix}.${i}`, item: { kind: 'empties' as const, count: 1 }, screenId, position }));

export const chapter8: ChapterModule = {
  def,
  screens: [roadScreen(), perimeterScreen(), gateScreen()],
  pickups: [
    ...bottles('road', 'c8.road', ROAD_BOTTLE_SPOTS),
    ...bottles('perimeter', 'c8.perimeter', PERIMETER_BOTTLE_SPOTS),
    ...bottles('gate', 'c8.gate', GATE_BOTTLE_SPOTS),
  ],
  mykoTangentPools: { ohio: 'c8.ohio', other: 'c8.tangent' },
  examinables: [
    { id: 'c8.tea', screenId: 'c8.road', position: TEA_SPOT, dialogueId: 'c8.bar.hotDrink' },
    { id: 'c8.attendant', screenId: 'c8.road', position: T(ATTENDANT_TILE.col, ATTENDANT_TILE.row + 2), dialogueId: 'c8.attendant.1' },
    { id: 'c8.clue.schedule', screenId: 'c8.road', position: SCHEDULE_SPOT, evidenceId: clue('schedule'), objective: true },
    { id: 'c8.clue.car', screenId: 'c8.road', position: CAR_SPOT, dialogueId: 'c8.car', evidenceId: clue('car'), objective: true },
    // The three junction boxes: E on one flips its two lines (the puzzle), and shows what is on its door.
    ...JUNCTION_BOXES.map((b) => ({ id: junctionExaminableId(b.id), screenId: 'c8.perimeter' as const, position: b.spot })),
    // The clipboard is shown by the script when the fence fight ends.
    { id: 'c8.clue.shift', screenId: 'c8.perimeter', position: CLIPBOARD_SPOT, evidenceId: clue('shift'), objective: true },
  ],
  fights: [
    {
      sectionId: 'c8.fight.fence',
      screenId: 'c8.perimeter',
      trigger: { kind: 'script' },
      spawnPoints: FENCE_AGENT_SPAWNS,
      entrance: FIGHT_ENTRANCE,
      headlights: FIGHT_HEADLIGHTS,
    },
  ],
  bosses: [
    {
      bossId: 'c8.boss.pruitt2',
      screenId: 'c8.gate',
      trigger: { kind: 'script' },
      bodies: [{ tag: 'pruitt', position: PRUITT_START }],
      entrance: GATE_MYKO_ENTRANCE,
      pruitt2: PRUITT2,
      callId: 'pruitt',
    },
  ],
  stealth: [
    {
      sectionId: 'c8.stealth.perimeter',
      screenId: 'c8.perimeter',
      startArea: STEALTH_START,
      exitArea: STEALTH_EXIT,
      entrance: STEALTH_ENTRANCE,
      reinforcementPoints: STEALTH_REINFORCEMENTS,
    },
  ],
  junctionPuzzles: [
    {
      sectionId: 'c8.puzzle.junctions',
      layout: junctionLayoutFrom({ lines: SENSOR_LINES, boxes: JUNCTION_BOXES, targetLines: CORRIDOR_LINES, stealthId: 'c8.stealth.perimeter' }),
    },
  ],
  // Every trigger fires each time Andrew walks in: the script tests what is done and what is under way, never a saved
  // "started" flag, so a load or a bar return starts a section again.
  triggers: [
    { id: 'c8.trig.sun', screenId: 'c8.road', area: SUN_AREA, once: false },
    { id: 'c8.trig.barred', screenId: 'c8.road', area: BARRED_TRIGGER, once: false },
    { id: 'c8.trig.perimeter', screenId: 'c8.perimeter', area: PERIMETER_OPEN_AREA, once: false },
    { id: 'c8.trig.junctions', screenId: 'c8.perimeter', area: JUNCTION_TRIGGER, once: false },
    { id: 'c8.trig.fence', screenId: 'c8.perimeter', area: FENCE_FIGHT_AREA, once: false },
    { id: 'c8.trig.gate', screenId: 'c8.gate', area: GATE_ARRIVE_AREA, once: false },
    { id: 'c8.trig.closing', screenId: 'c8.gate', area: GATE_CLOSING_AREA, once: false },
    { id: 'c8.trig.pruitt', screenId: 'c8.gate', area: PRUITT_TRIGGER, once: false },
  ],
  createScript: createChapterScript,
};
