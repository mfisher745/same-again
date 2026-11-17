/**
 * Chapter 6: Flyover Country. docs/chapters/06-flyover-country.md.
 *
 * The three screens, their exits, the dressing, the examinables, the section placements and the
 * systems placements are here (corn, the marker-stone maze, the combine, the coolers of light beer);
 * `script.ts` wires the beats, the Ohio rule, the lessons and the closing scene. The chapter is not
 * registered in `src/chapters/index.ts` yet, so it is not in Chapter Select or the menu.
 */

import { hasSequence } from '../../content/dialogue';
import type { ChapterModule } from '../../core/chapter';
import type { ChapterDef, ClueId, DeductionBoardDef, ExaminableDef, ObjectiveDef, PickupDef, ScreenId, Vec2 } from '../../core/types';
import { createChapterScript } from './script';
import {
  AGENT_SPAWNS,
  BAR_ARRIVAL,
  CENTRE_RECEIPT_SPOT,
  CLERK_SPOT,
  COMBINE_ENTRY,
  COMBINE_ESCORT_SPAWNS,
  COMBINE_LANES,
  COOLER_SPOTS,
  DITCH_CURVE,
  COMBINE_MYKO_ENTRANCE,
  DALE_AREA,
  DALE_BIN_SPOT,
  DALE_TILE,
  DRONE_FIGHT_ENTRANCE,
  DRONE_SPAWNS,
  FIELDS_ADMIRE,
  FIELDS_OPEN_AREA,
  FIELDS_STEALTH,
  HELLO_MAN_TILE,
  LEDGER_SPOT,
  MAZE_INTRO_AREA,
  MAZE_ORDER,
  MAZE_STONES,
  MOTEL_ADMIRE,
  NOTICEBOARD_SPOT,
  POSTCARD_SPOT,
  SENSOR_LIGHT_OFFSETS,
  STEALTH_ENTRANCE,
  STEALTH_EXIT,
  STEALTH_REINFORCEMENTS,
  STEALTH_START,
  T,
  TEA_SPOT,
  TOWN_ADMIRE,
  TRACK_SPOTTED_AREA,
  YARD_TRIGGER,
  fieldsScreen,
  motelScreen,
  townScreen,
} from './maps';

const objective = (key: string, id: string): ObjectiveDef => ({
  id,
  textId: `c6.objective.${key}`,
  hint: {
    objectiveId: id,
    nudgeDialogueId: `c6.hint.${key}.1`,
    answerDialogueId: `c6.hint.${key}.2`,
    ...(hasSequence(`c6.hint.${key}.where`) ? { whereDialogueId: `c6.hint.${key}.where` } : {}),
  },
});

const clue = (key: string): ClueId => `c6.clue.${key}`;

const board: DeductionBoardDef = {
  id: 'c6.deduction.roswell',
  chapter: 6,
  candidateIds: [clue('ledger'), clue('receipt'), clue('postcard'), clue('noticeboard'), clue('coffee')],
  solution: [clue('ledger'), clue('receipt'), clue('postcard')],
  leadTextId: 'c6.deduction.roswell.lead.body',
  leadMarginTextId: 'c6.deduction.roswell.lead.margin',
  wrongAnswerDialogueIds: ['c6.board.wrong.1', 'c6.board.wrong.2', 'c6.board.wrong.3'],
};

const def: ChapterDef = {
  number: 6,
  titleTextId: 'c6.title',
  screens: [
    { id: 'c6.motel', region: 'ohio', widthTiles: 30, heightTiles: 17 },
    { id: 'c6.town', region: 'ohio', widthTiles: 50, heightTiles: 20 },
    { id: 'c6.fields', region: 'ohio', widthTiles: 80, heightTiles: 40 },
  ],
  startScreenId: 'c6.motel',
  bar: {
    screenId: 'c6.motel',
    arrival: BAR_ARRIVAL,
    hotDrinkProp: TEA_SPOT,
    openDialogueId: 'c6.bar.open',
    hotDrinkDialogueId: 'c6.bar.hotDrink',
    returnDialogueId: 'c6.bar.return',
  },
  sections: [
    { id: 'c6.explore.bar', kind: 'explore', mykoCallable: false },
    { id: 'c6.explore.motel', kind: 'explore', mykoCallable: false },
    { id: 'c6.explore.town', kind: 'explore', mykoCallable: false },
    { id: 'c6.stealth.fields', kind: 'stealth', mykoCallable: false },
    { id: 'c6.fight.drones', kind: 'fight', mykoCallable: true },
    { id: 'c6.puzzle.maze', kind: 'puzzle', mykoCallable: true },
    { id: 'c6.explore.centre', kind: 'explore', mykoCallable: false },
    { id: 'c6.deduction.roswell', kind: 'deduction', mykoCallable: true },
    { id: 'c6.setpiece.combine', kind: 'setpiece', mykoCallable: true },
  ],
  stealthSections: [FIELDS_STEALTH],
  puzzle: { id: 'c6.puzzle.maze', chapter: 6, kind: 'maze' },
  deductionBoard: board,
  evidence: [clue('ledger'), clue('receipt'), clue('postcard'), clue('noticeboard'), clue('coffee')],
  objectives: [
    objective('town', 'c6.town'),
    objective('dale', 'c6.dale'),
    objective('motel', 'c6.motel'),
    objective('fields', 'c6.fields'),
    objective('drones', 'c6.drones'),
    objective('maze', 'c6.maze'),
    objective('board', 'c6.board'),
    objective('combine', 'c6.combine'),
  ],
  newAbilities: [],
  mykoCallLines: {
    fight: { sequenceId: 'c6.call.fight', casebookBodyTextId: 'c6.call.fight.casebook', casebookMarginTextId: 'c6.call.fight.margin' },
    puzzle: { sequenceId: 'c6.call.puzzle', casebookBodyTextId: 'c6.call.puzzle.casebook', casebookMarginTextId: 'c6.call.puzzle.margin' },
    setpiece: { sequenceId: 'c6.call.combine', casebookBodyTextId: 'c6.call.combine.casebook', casebookMarginTextId: 'c6.call.combine.margin' },
  },
  finaleSectionId: 'c6.setpiece.combine',
};

/** Something Myko admires: plays `dialogue` on E. A `suffix` keeps the examinable id unique when the same line is used twice. */
const admire = (screenId: ScreenId, dialogue: string, position: Vec2, suffix?: string): ExaminableDef => ({
  id: suffix === undefined ? dialogue : `${dialogue}.${suffix}`,
  screenId,
  position,
  dialogueId: dialogue,
});

/** Nine coolers of light beer along the farm track: each is one light beer to take (and every one drunk leaves a bottle). */
const coolerPickups: readonly PickupDef[] = COOLER_SPOTS.map((position, i) => ({
  id: `c6.pickup.cooler${i + 1}`,
  item: { kind: 'drink', drinkId: 'lightBeer', count: 1 },
  screenId: 'c6.fields',
  position,
}));

/** The combine's lanes: vertical passes through the arena, north to south and back. */
const combineLanes = COMBINE_LANES.map((l, i) => {
  const top = l.fromRow * 16;
  const bottom = (l.toRow + 1) * 16;
  return { id: l.id, axis: 'vertical' as const, at: (l.col + l.width / 2) * 16, from: i % 2 === 0 ? top : bottom, to: i % 2 === 0 ? bottom : top };
});

export const chapter6: ChapterModule = {
  def,
  screens: [motelScreen(), townScreen(), fieldsScreen()],
  pickups: coolerPickups,
  mykoTangentPools: { ohio: 'c6.ohio.general' },
  examinables: [
    // The Starlite.
    { id: 'c6.coffee', screenId: 'c6.motel', position: TEA_SPOT, dialogueId: 'c6.bar.coffee', evidenceId: clue('coffee') },
    { id: 'c6.motel.desk', screenId: 'c6.motel', position: CLERK_SPOT, dialogueId: 'c6.motel.desk' },
    { id: 'c6.clue.ledger', screenId: 'c6.motel', position: LEDGER_SPOT, dialogueId: 'c6.motel.desk', evidenceId: clue('ledger'), objective: true },
    { id: 'c6.clue.postcard', screenId: 'c6.motel', position: POSTCARD_SPOT, dialogueId: 'c6.motel.desk', evidenceId: clue('postcard'), objective: true },
    admire('c6.motel', 'c6.ohio.iceMachine', MOTEL_ADMIRE.iceMachine),
    admire('c6.motel', 'c6.ohio.pool', MOTEL_ADMIRE.pool),
    admire('c6.motel', 'c6.ohio.motelSign', MOTEL_ADMIRE.motelSign),
    admire('c6.motel', 'c6.ohio.sky', MOTEL_ADMIRE.sky),
    admire('c6.motel', 'c6.ohio.carPark', MOTEL_ADMIRE.carPark, 'motel'),
    // Main Street.
    { id: 'c6.clue.noticeboard', screenId: 'c6.town', position: NOTICEBOARD_SPOT, dialogueId: 'c6.town.notice', evidenceId: clue('noticeboard'), objective: true },
    { id: 'c6.town.hello', screenId: 'c6.town', position: T(HELLO_MAN_TILE.col, HELLO_MAN_TILE.row), dialogueId: 'c6.town.hello' },
    { id: 'c6.dale.shoulder', screenId: 'c6.town', position: T(DALE_TILE.col, DALE_TILE.row), dialogueId: 'c6.dale.shoulder', objective: true },
    { id: 'c6.dale.bin', screenId: 'c6.town', position: DALE_BIN_SPOT, dialogueId: 'c6.dale.bin' },
    admire('c6.town', 'c6.ohio.busStation', TOWN_ADMIRE.busStation),
    admire('c6.town', 'c6.ohio.shop', TOWN_ADMIRE.shop),
    admire('c6.town', 'c6.ohio.diner', TOWN_ADMIRE.diner),
    admire('c6.town', 'c6.ohio.sidewalk', TOWN_ADMIRE.sidewalk),
    admire('c6.town', 'c6.ohio.road', TOWN_ADMIRE.road),
    admire('c6.town', 'c6.ohio.carPark', TOWN_ADMIRE.carPark, 'town'),
    admire('c6.town', 'c6.ohio.waterTower', TOWN_ADMIRE.waterTower),
    admire('c6.town', 'c6.ohio.flag', TOWN_ADMIRE.flag),
    // The fields.
    admire('c6.fields', 'c6.ohio.mailbox', FIELDS_ADMIRE.mailbox),
    admire('c6.fields', 'c6.ohio.corn', FIELDS_ADMIRE.corn),
    admire('c6.fields', 'c6.ohio.sky', FIELDS_ADMIRE.sky, 'fields'),
    admire('c6.fields', 'c6.ohio.ditch', FIELDS_ADMIRE.ditch),
    { id: 'c6.clue.receipt', screenId: 'c6.fields', position: CENTRE_RECEIPT_SPOT, dialogueId: 'c6.centre', evidenceId: clue('receipt'), objective: true },
  ],
  fights: [
    {
      sectionId: 'c6.fight.drones',
      screenId: 'c6.fields',
      trigger: { kind: 'script' },
      spawnPoints: [...DRONE_SPAWNS, ...AGENT_SPAWNS],
      entrance: DRONE_FIGHT_ENTRANCE,
    },
  ],
  bosses: [
    {
      bossId: 'c6.setpiece.combine',
      screenId: 'c6.fields',
      trigger: { kind: 'script' },
      bodies: [
        { tag: 'harvester', position: COMBINE_ENTRY, invulnerable: true, attacks: 'none', stationary: true },
        ...SENSOR_LIGHT_OFFSETS.map((o, i) => ({ tag: `light${i + 1}`, position: { x: COMBINE_ENTRY.x + o.x, y: COMBINE_ENTRY.y + o.y }, stationary: true, attacks: 'none' as const })),
      ],
      combine: {
        lights: SENSOR_LIGHT_OFFSETS.map((offset, i) => ({ tag: `light${i + 1}`, offset })),
        lanes: combineLanes,
        escortPoints: COMBINE_ESCORT_SPAWNS,
        ditchPath: DITCH_CURVE,
      },
      callId: 'combine',
      entrance: COMBINE_MYKO_ENTRANCE,
    },
  ],
  mazePuzzles: [
    {
      sectionId: 'c6.puzzle.maze',
      screenId: 'c6.fields',
      stones: MAZE_STONES.map((s) => ({ id: s.id, position: T(s.col, s.row) })),
      order: MAZE_ORDER,
    },
  ],
  stealth: [
    {
      sectionId: 'c6.stealth.fields',
      screenId: 'c6.fields',
      startArea: STEALTH_START,
      exitArea: STEALTH_EXIT,
      entrance: STEALTH_ENTRANCE,
      reinforcementPoints: STEALTH_REINFORCEMENTS,
    },
  ],
  triggers: [
    { id: 'c6.trig.dale', screenId: 'c6.town', area: DALE_AREA, once: false },
    { id: 'c6.trig.fieldsOpen', screenId: 'c6.fields', area: FIELDS_OPEN_AREA, once: false },
    { id: 'c6.trig.spotted', screenId: 'c6.fields', area: TRACK_SPOTTED_AREA, once: false },
    { id: 'c6.trig.yard', screenId: 'c6.fields', area: YARD_TRIGGER, once: false },
    { id: 'c6.trig.maze', screenId: 'c6.fields', area: MAZE_INTRO_AREA, once: false },
  ],
  createScript: createChapterScript,
};
