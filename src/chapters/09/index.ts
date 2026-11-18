/**
 * Chapter 9: Level Minus Four. docs/chapters/09-level-minus-four.md. THE LAYOUT HALF: the three screens, exits, dressing,
 * examinables, placements and constants are in `maps.ts`. There is NO script yet (no `createScript`): Andrew can walk
 * between the screens and examine what is placed. Not registered in `src/chapters/index.ts`.
 *
 * WHAT THE SCRIPT MUST WIRE (all text by id from `src/content/dialogue/c09.ts`; numbers from `TUNING`):
 *   - the bar and the opening: `c9.bar.open` / `.hotDrink` / `.return`, the kettle's steam (`bar.steam`), the tea (`c9.bar.tea`),
 *     captions `c9.caption.offices|labs|hall`, `c9.open` on first walking into the open plan;
 *   - `c9.stealth.offices` (placed here: eight clerks, six seated): the `c9.offices.overheard.N` triggers
 *     (`c9.trig.overheard.N`), `c9.offices.caught` on the alarm, the clean-run reward (reveal the `offices.tequila` prop and
 *     take it from `TEQUILA_SPOT`; `c9.offices.clean` is its examinable's line); the proofs `c9.proof.contract` (cabinet)
 *     and `c9.proof.directory` (noticeboard) are examinables with evidence;
 *   - the Glove: `c9.glove.find` at the lost-property box (`offices.lostProperty`), then slot 3; `c9.glove.done` after its first
 *     stun; E at a gravity switch works the Glove whatever is in the slot;
 *   - `c9.puzzle.gravity`: the three rooms in `GRAVITY_ROOMS` (data shape on `GravityRoomDef`), the entry triggers
 *     `c9.trig.gravity.N` (`promptDialogueId`), `c9.gravity.reset`, `c9.gravity.done`, `completeNow()` finishing all three,
 *     opening each room's door on solve; crates are the props `gravity.roomN.crateK`;
 *   - `c9.explore.labs`: the hangar window `c9.proof.craft` (only after the gravity puzzle; needs the bog fragment, `c9.hangar`)
 *     and the records room `c9.proof.log` (`c9.log`, read twice), the hints `c9.hint.labs.*` on `c9.trig.hangar` / `c9.trig.records`;
 *   - `c9.fight.labs` (`c9.fight.intro` / `.end`, two waves, shields): placed here with a script trigger (`c9.trig.labsFight`);
 *   - `c9.deduction.uplink` (board defined here: contract, directory and `c8.clue.shift`); `c9.board.right`;
 *   - `c9.setpiece.lockdown` in `HALL_BAYS`: `c9.lockdown.intro`, the announcements `.announce.1-4` and Myko lines `.myko.1-4`,
 *     each bay's door (`hall.doorN.a` and `.b`, shown to close; `c9.lockdown.shut` when one catches Andrew, back to `start`),
 *     the bay 2 and 4 switches (hide `hall.barrierN.*`, slide the bay's guards), the bay 3 recorder (`c9.proof.footage`, 3 s),
 *     the lift guard (`LIFT_GUARD_SPOT`, `c9.weapon.wand`, show `hall.wand`), the lift (`LIFT_AREA`, all five proofs and the lanyard),
 *     `c9.closing`; sober or on the floor sends Andrew to the bar and restarts the hall from bay 1 (the tape stays taken);
 *   - the Ohio and other tangent pools (`c9.ohio`, `c9.tangent`) and `onBarReturn`.
 */

import type { ChapterModule } from '../../core/chapter';
import type { ChapterDef, ClueId, DeductionBoardDef, EvidenceId, ObjectiveDef } from '../../core/types';
import {
  BAR_ARRIVAL,
  CABINET_SPOT,
  GRAVITY_ENTRY_AREAS,
  HALL_ENTRANCE,
  HANGAR_AREA,
  HANGAR_SPOT,
  LABS_ENTRANCE,
  LABS_FIGHT_TRIGGER,
  LABS_SPAWNS,
  LIFT_AREA,
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
    // The labs: the craft through the window and the flight log.
    { id: 'c9.proof.craft', screenId: 'c9.labs', position: HANGAR_SPOT, dialogueId: 'c9.hangar', evidenceId: proof('craft'), objective: true },
    { id: 'c9.proof.log', screenId: 'c9.labs', position: LOG_SPOT, dialogueId: 'c9.log', evidenceId: proof('log'), objective: true },
  ],
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
    { id: 'c9.trig.lockdown', screenId: 'c9.hall', area: LOCKDOWN_TRIGGER, once: false },
  ],
};
