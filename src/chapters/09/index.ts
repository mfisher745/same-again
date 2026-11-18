/**
 * Chapter 9: Level Minus Four. docs/chapters/09-level-minus-four.md.
 *
 * The three screens, exits, dressing, examinables, placements and constants are in `maps.ts` (plain data: `GRAVITY_ROOMS`,
 * `HALL_BAYS`); `layouts.ts` turns that data into what `gravity.ts` and `lockdown.ts` take; `script.ts` plays every beat.
 * Not registered in `src/chapters/index.ts`.
 */

import type { ChapterModule } from '../../core/chapter';
import { createChapterScript } from './script';
import { GRAVITY_LAYOUT, LIFT_PANEL, LIFT_PANEL_ID, RECORDER_ID, lockdownPlacement } from './layouts';
import type { ChapterDef, ClueId, DeductionBoardDef, EvidenceId, ObjectiveDef } from '../../core/types';
import {
  BAR_ARRIVAL,
  CABINET_SPOT,
  GRAVITY_ENTRY_AREAS,
  HALL_ENTRANCE,
  HANGAR_AREA,
  HANGAR_SPOT,
  LABS_ENTRANCE,
  LABS_EXIT_AREA,
  LABS_FIGHT_TRIGGER,
  LABS_SPAWNS,
  LIFT_AREA,
  GRAVITY_ROOMS,
  gravityCentre,
  gravityResetId,
  gravityResetTile,
  T,
  HALL_BAYS,
  LOBBY_AREA,
  LOCKDOWN_TRIGGER,
  LOG_SPOT,
  LOST_PROPERTY_SPOT,
  NOTICEBOARD_SPOT,
  OFFICES_ENTRANCE,
  OFFICES_EXIT,
  OFFICES_OVERHEARD,
  OFFICES_REINFORCEMENTS,
  OFFICES_START,
  OFFICES_STEALTH,
  RECORDS_AREA,
  TEA_SPOT,
  TEQUILA_SPOT,
  hallScreen,
  labsScreen,
  officesScreen,
} from './maps';

export * from './maps';
export * from './layouts';

const objective = (key: string, id: string): ObjectiveDef => ({
  id,
  textId: `c9.objective.${key}`,
  hint: {
    objectiveId: id,
    nudgeDialogueId: `c9.hint.${key}.1`,
    answerDialogueId: `c9.hint.${key}.2`,
  },
});

const proof = (key: 'contract' | 'directory' | 'craft' | 'log' | 'footage'): EvidenceId => `c9.proof.${key}`;
const SHIFT: ClueId = 'c8.clue.shift';

/** `c9.deduction.uplink`: the contract, the directory and Pruitt's lanyard (the c8 shift clue) name the control room uplink. */
const board: DeductionBoardDef = {
  id: 'c9.deduction.uplink',
  chapter: 9,
  candidateIds: [proof('contract'), proof('directory'), SHIFT, proof('craft')],
  solution: [proof('contract'), proof('directory'), SHIFT],
  leadTextId: 'c9.deduction.uplink.lead.body',
  leadMarginTextId: 'c9.deduction.uplink.lead.margin',
  wrongAnswerDialogueIds: ['c9.board.wrong.1', 'c9.board.wrong.2', 'c9.board.wrong.3'],
};

const def: ChapterDef = {
  number: 9,
  titleTextId: 'c9.title',
  screens: [
    { id: 'c9.offices', region: 'base', widthTiles: 40, heightTiles: 25 },
    { id: 'c9.labs', region: 'base', widthTiles: 60, heightTiles: 40 },
    { id: 'c9.hall', region: 'base', widthTiles: 50, heightTiles: 30 },
  ],
  startScreenId: 'c9.offices',
  bar: {
    screenId: 'c9.offices',
    arrival: BAR_ARRIVAL,
    hotDrinkProp: TEA_SPOT,
    openDialogueId: 'c9.bar.open',
    hotDrinkDialogueId: 'c9.bar.hotDrink',
    returnDialogueId: 'c9.bar.return',
  },
  sections: [
    { id: 'c9.explore.bar', kind: 'explore', mykoCallable: false },
    { id: 'c9.stealth.offices', kind: 'stealth', mykoCallable: false },
    { id: 'c9.puzzle.gravity', kind: 'puzzle', mykoCallable: true },
    { id: 'c9.explore.labs', kind: 'explore', mykoCallable: false },
    { id: 'c9.fight.labs', kind: 'fight', mykoCallable: true },
    { id: 'c9.deduction.uplink', kind: 'deduction', mykoCallable: true },
    { id: 'c9.setpiece.lockdown', kind: 'setpiece', mykoCallable: true },
  ],
  stealthSections: [OFFICES_STEALTH],
  puzzle: { id: 'c9.puzzle.gravity', chapter: 9, kind: 'gravity' },
  deductionBoard: board,
  evidence: [proof('contract'), proof('directory'), proof('craft'), proof('log'), proof('footage')],
  objectives: [
    objective('offices', 'c9.offices'),
    objective('glove', 'c9.glove'),
    objective('gravity', 'c9.gravity'),
    objective('labs', 'c9.labs'),
    objective('fight', 'c9.fight'),
    objective('board', 'c9.board'),
    objective('lockdown', 'c9.lockdown'),
  ],
  newAbilities: [],
  mykoCallLines: {
    fight: { sequenceId: 'c9.call.fight', casebookBodyTextId: 'c9.call.fight.casebook', casebookMarginTextId: 'c9.call.fight.margin' },
    puzzle: { sequenceId: 'c9.call.puzzle', casebookBodyTextId: 'c9.call.puzzle.casebook', casebookMarginTextId: 'c9.call.puzzle.margin' },
    setpiece: { sequenceId: 'c9.call.lockdown', casebookBodyTextId: 'c9.call.lockdown.casebook', casebookMarginTextId: 'c9.call.lockdown.margin' },
  },
  finaleSectionId: 'c9.setpiece.lockdown',
};

export const chapter9: ChapterModule = {
  def,
  screens: [officesScreen(), labsScreen(), hallScreen()],
  pickups: [],
  mykoTangentPools: { ohio: 'c9.ohio', other: 'c9.tangent' },
  examinables: [
    // The staff social area: the kettle.
    { id: 'c9.bar.hotDrink', screenId: 'c9.offices', position: TEA_SPOT, dialogueId: 'c9.bar.hotDrink', objective: true },
    // The offices: the two proofs, the Glove in lost property, the clean-run tequila.
    { id: 'c9.proof.contract', screenId: 'c9.offices', position: CABINET_SPOT, dialogueId: 'c9.offices.contract', evidenceId: proof('contract'), objective: true },
    { id: 'c9.proof.directory', screenId: 'c9.offices', position: NOTICEBOARD_SPOT, dialogueId: 'c9.offices.directory', evidenceId: proof('directory'), objective: true },
    { id: 'c9.glove.box', screenId: 'c9.offices', position: LOST_PROPERTY_SPOT, dialogueId: 'c9.glove.find', objective: true },
    { id: 'c9.offices.tequila', screenId: 'c9.offices', position: TEQUILA_SPOT, dialogueId: 'c9.offices.clean' },
    // The staff social area's furniture.
    { id: 'c9.examine.signUp', screenId: 'c9.offices', position: T(32, 3), dialogueId: 'c9.examine.signUp' },
    { id: 'c9.examine.dartboard', screenId: 'c9.offices', position: T(30, 3), dialogueId: 'c9.examine.dartboard' },
    { id: 'c9.examine.fridge', screenId: 'c9.offices', position: T(34, 3), dialogueId: 'c9.examine.fridge' },
    // The labs: the craft through the window and the flight log.
    { id: 'c9.proof.craft', screenId: 'c9.labs', position: HANGAR_SPOT, dialogueId: 'c9.hangar', evidenceId: proof('craft'), objective: true },
    { id: 'c9.proof.log', screenId: 'c9.labs', position: LOG_SPOT, dialogueId: 'c9.log', evidenceId: proof('log'), objective: true },
    // The gravity rooms: a wall switch each (E works it with the Glove), and a reset panel beside each room's door.
    ...GRAVITY_ROOMS.flatMap((room) => [
      ...room.switches.map((sw) => ({ id: sw.id, screenId: 'c9.labs' as const, position: gravityCentre(room, sw.wall) })),
      { id: gravityResetId(room), screenId: 'c9.labs' as const, position: T(gravityResetTile(room).col, gravityResetTile(room).row), dialogueId: 'c9.gravity.reset' },
    ]),
    // The hall: the gravity switches of bays 2 and 4, the recorder in bay 3, the lift's panel.
    ...HALL_BAYS.flatMap((bay) => (bay.gravity ? [{ id: bay.gravity.switch.id, screenId: 'c9.hall' as const, position: T(bay.gravity.switch.wall.col, bay.gravity.switch.wall.row) }] : [])),
    { id: RECORDER_ID, screenId: 'c9.hall', position: T(23, 5), dialogueId: 'c9.examine.recorder' },
    { id: LIFT_PANEL_ID, screenId: 'c9.hall', position: LIFT_PANEL },
  ],
  gravityPuzzles: [{ sectionId: 'c9.puzzle.gravity', screenId: 'c9.labs', layout: GRAVITY_LAYOUT }],
  fights: [{ sectionId: 'c9.fight.labs', screenId: 'c9.labs', trigger: { kind: 'script' }, spawnPoints: LABS_SPAWNS, entrance: LABS_ENTRANCE }],
  bosses: [
    {
      bossId: 'c9.setpiece.lockdown',
      screenId: 'c9.hall',
      trigger: { kind: 'script' },
      // No bodies: the doors, the barriers and the guards are the set piece's (`HALL_BAYS`).
      bodies: [],
      entrance: HALL_ENTRANCE,
      exitArea: LIFT_AREA,
      callId: 'lockdown',
      lockdown: lockdownPlacement(),
    },
  ],
  stealth: [
    {
      sectionId: 'c9.stealth.offices',
      screenId: 'c9.offices',
      startArea: OFFICES_START,
      exitArea: OFFICES_EXIT,
      entrance: OFFICES_ENTRANCE,
      reinforcementPoints: OFFICES_REINFORCEMENTS,
    },
  ],
  triggers: [
    { id: 'c9.trig.lobby', screenId: 'c9.offices', area: LOBBY_AREA, once: false },
    ...OFFICES_OVERHEARD.map((o, i) => ({ id: `c9.trig.overheard.${i + 1}`, screenId: 'c9.offices' as const, area: o.area, once: false })),
    ...GRAVITY_ENTRY_AREAS.map((area, i) => ({ id: `c9.trig.gravity.${i + 1}`, screenId: 'c9.labs' as const, area, once: false })),
    { id: 'c9.trig.hangar', screenId: 'c9.labs', area: HANGAR_AREA, once: false },
    { id: 'c9.trig.records', screenId: 'c9.labs', area: RECORDS_AREA, once: false },
    { id: 'c9.trig.labsFight', screenId: 'c9.labs', area: LABS_FIGHT_TRIGGER, once: false },
    { id: 'c9.trig.labsExit', screenId: 'c9.labs', area: LABS_EXIT_AREA, once: false },
    { id: 'c9.trig.lockdown', screenId: 'c9.hall', area: LOCKDOWN_TRIGGER, once: false },
    { id: 'c9.trig.lift', screenId: 'c9.hall', area: LIFT_AREA, once: false },
  ],
  createScript: createChapterScript,
};
