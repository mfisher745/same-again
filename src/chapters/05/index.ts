/**
 * Chapter 5: The Paper Trail. docs/chapters/05-the-paper-trail.md. LAYOUT ONLY: the four screens, the exits between
 * them, props, examinables, pickups, patrol routes and the section placements. Not registered in
 * `src/chapters/index.ts` yet: registering would make finishing chapter 4 start this stub.
 *
 * What `script.ts` still needs to wire (it is a stub that returns no hooks):
 *   - Bar: show `bar.steam` while `ctx.hotDrinkOffered()`, `c5.bar.open` / `.return` timing, the hot drink on `c5.tea`.
 *   - Lobby: `c5.open` on arrival (`c5.trig.lobby`), the ticket machine, the Act Natural lesson (`c5.trig.actNatural`)
 *     and `c5.actNatural.done`, the lobby guard (build one from `LOBBY_GUARD_ROUTE` and `LOBBY_HIDING`; the spec has
 *     no stealth section for the lobby), the retirement clue `c5.clue.retirement`.
 *   - Floor stealth `c5.stealth.floor` (def and placement are here; the `.alarm` fight uses `ALARM_REINFORCEMENTS`):
 *     overheard lines `c5.floor.overheard.1-5`, `c5.floor.clean/caught/loud`, reveal the `memo` prop on a clean run.
 *   - Files: the requisition and busticket clues, sheets 1-5 collected into the lightbox puzzle
 *     (`c5.puzzle.redacted`; props `sheet.1-5` and `lightbox`; the puzzle logic is systems-dev's), `c5.clue.site`.
 *   - Copier jam and alarm (`c5.copier`, swap the `copier` prop frame), the Lock-in lesson `c5.lockIn.lesson` / `.done`,
 *     `c5.fight.floor` (three waves of three from `FIGHT_SPAWNS`), `c5.fight.intro/wave2/end`, the deduction board
 *     `c5.deduction.ohio` and its remarks.
 *   - Pruitt (`c5.boss.pruitt1`): the shelf cranks (move the twelve `shelf.<unit>.<0..11>` props of unit
 *     `LANES[k].closingUnit` by `LANES[k].slideTiles`, light the rails 1 s before), phase 2 adds at `PRUITT_ADDS`,
 *     `c5.pruitt.intro/phase2/end`, the umbrella (`umbrella` prop, `c5.umbrella`, `c5.weapon.umbrella`), `c5.closing`.
 *   - Objectives, `c5.caption.*` cards, Myko calls, return-to-the-bar resets, Myko's `by phone` positions.
 */

import { hasSequence } from '../../content/dialogue';
import type { ChapterModule } from '../../core/chapter';
import type { ChapterDef, ClueId, DeductionBoardDef, DialogueId, ObjectiveDef, TextId } from '../../core/types';
import { createChapterScript } from './script';
import {
  ALARM_REINFORCEMENTS,
  BAR_ARRIVAL,
  BREAK_ROOM,
  BUSTICKET_SPOT,
  COPIER_QUEUE_AREA,
  COPIER_SPOT,
  FIGHT_ENTRANCE,
  FIGHT_SPAWNS,
  FLOOR_BOTTLE_SPOTS,
  FLOOR_MYKO_SPOT,
  FLOOR_STEALTH,
  FRIDGE_SPOT,
  LANES,
  LIGHTBOX_SPOT,
  LOBBY_QUEUE_AREA,
  LOBBY_REINFORCEMENTS,
  LOBBY_STEALTH,
  LOBBY_STEALTH_EXIT,
  LOBBY_STEALTH_START,
  LOBBY_MYKO_SPOT,
  MEMO_SPOT,
  PRUITT_ENTRANCE,
  PRUITT_START,
  PRUITT_TRIGGER,
  REQUISITION_SPOT,
  RETIREMENT_SPOT,
  SHEETS,
  STACKS_BOTTLE_SPOTS,
  STEALTH_EXIT,
  STEALTH_START,
  TEA_SPOT,
  TICKET_SPOT,
  UMBRELLA_SPOT,
  barScreen,
  floorScreen,
  lobbyScreen,
  stacksScreen,
  tilesArea,
} from './maps';

export * from './maps';

const objective = (key: string, id: string): ObjectiveDef => ({
  id,
  textId: `c5.objective.${key}`,
  hint: {
    objectiveId: id,
    nudgeDialogueId: `c5.hint.${key}.1`,
    answerDialogueId: `c5.hint.${key}.2`,
    ...(hasSequence(`c5.hint.${key}.where`) ? { whereDialogueId: `c5.hint.${key}.where` } : {}),
  },
});

const clue = (key: string): ClueId => `c5.clue.${key}`;

const board: DeductionBoardDef = {
  id: 'c5.deduction.ohio',
  chapter: 5,
  candidateIds: [clue('site'), clue('requisition'), clue('busticket'), clue('retirement'), clue('memo')],
  solution: [clue('site'), clue('requisition'), clue('busticket')],
  leadTextId: 'c5.deduction.ohio.lead',
  leadMarginTextId: 'c5.deduction.ohio.lead.margin',
  wrongAnswerDialogueIds: ['c5.board.wrong.1', 'c5.board.wrong.2', 'c5.board.wrong.3'],
};

/**
 * What E says on each examinable: an existing dialogue sequence, or the body text of a clue entry. The clues have
 * no dialogue sequence of their own in `c05.ts`; the casebook entry is what the player reads.
 */
export const EXAMINE_LINES: Readonly<Record<string, { readonly sequence?: DialogueId; readonly text?: TextId }>> = {
  'c5.tea': { sequence: 'c5.bar.hotDrink' },
  'c5.ticket': { sequence: 'c5.examine.ticket' },
  'c5.retirement': { text: 'c5.clue.retirement.body' },
  'c5.sheet.1': { sequence: 'c5.files.sheet' },
  'c5.sheet.2': { sequence: 'c5.files.sheet' },
  'c5.sheet.3': { sequence: 'c5.files.sheet' },
  'c5.sheet.4': { sequence: 'c5.files.sheet' },
  'c5.sheet.5': { sequence: 'c5.files.sheet' },
  'c5.requisition': { sequence: 'c5.files.requisition' },
  'c5.busticket': { text: 'c5.clue.busticket.body' },
  'c5.memo': { text: 'c5.clue.memo.body' },
  'c5.lightbox': { sequence: 'c5.examine.lightbox' },
  'c5.copier': { sequence: 'c5.copier' },
  'c5.umbrella': { sequence: 'c5.examine.umbrellaStand' },
};

const def: ChapterDef = {
  number: 5,
  titleTextId: 'c5.title',
  screens: [
    { id: 'c5.bar', region: 'cities', widthTiles: 30, heightTiles: 17 },
    { id: 'c5.lobby', region: 'cities', widthTiles: 40, heightTiles: 20 },
    { id: 'c5.floor', region: 'cities', widthTiles: 60, heightTiles: 30 },
    { id: 'c5.stacks', region: 'cities', widthTiles: 50, heightTiles: 30 },
  ],
  startScreenId: 'c5.bar',
  bar: {
    screenId: 'c5.bar',
    arrival: BAR_ARRIVAL,
    hotDrinkProp: TEA_SPOT,
    openDialogueId: 'c5.bar.open',
    hotDrinkDialogueId: 'c5.bar.hotDrink',
    returnDialogueId: 'c5.bar.return',
  },
  sections: [
    { id: 'c5.explore.bar', kind: 'explore', mykoCallable: false },
    { id: 'c5.explore.lobby', kind: 'explore', mykoCallable: false },
    { id: 'c5.stealth.lobby', kind: 'stealth', mykoCallable: false },
    { id: 'c5.stealth.floor', kind: 'stealth', mykoCallable: false },
    { id: 'c5.explore.files', kind: 'explore', mykoCallable: false },
    // The unredacted line is the puzzle's reward, whoever solves it (Andrew, or Myko on a call).
    { id: 'c5.puzzle.redacted', kind: 'puzzle', mykoCallable: true, reward: { evidenceIds: [clue('site')] } },
    { id: 'c5.fight.floor', kind: 'fight', mykoCallable: true },
    { id: 'c5.deduction.ohio', kind: 'deduction', mykoCallable: true },
    { id: 'c5.boss.pruitt1', kind: 'boss', mykoCallable: true },
  ],
  stealthSections: [LOBBY_STEALTH, FLOOR_STEALTH],
  puzzle: { id: 'c5.puzzle.redacted', chapter: 5, kind: 'redacted' },
  deductionBoard: board,
  evidence: [clue('retirement'), clue('memo'), clue('requisition'), clue('busticket'), clue('site')],
  objectives: [
    objective('lobby', 'c5.lobby'),
    objective('floor', 'c5.floor'),
    objective('files', 'c5.files'),
    objective('redacted', 'c5.redacted'),
    objective('fight', 'c5.fight'),
    objective('board', 'c5.board'),
    objective('pruitt', 'c5.pruitt'),
  ],
  newAbilities: [],
  mykoCallLines: {
    fight: { sequenceId: 'c5.call.fight', casebookBodyTextId: 'c5.call.fight.casebook', casebookMarginTextId: 'c5.call.fight.margin' },
    puzzle: { sequenceId: 'c5.call.puzzle', casebookBodyTextId: 'c5.call.puzzle.casebook', casebookMarginTextId: 'c5.call.puzzle.margin' },
  },
  finaleSectionId: 'c5.boss.pruitt1',
};

export const chapter5: ChapterModule = {
  def,
  screens: [barScreen(), lobbyScreen(), floorScreen(), stacksScreen()],
  pickups: [
    // The break-room fridge's birthday whiskey, for anyone not yet at Bit much (Lock-in needs it).
    { id: 'c5.pickup.birthdayWhiskey', item: { kind: 'drink', drinkId: 'whiskey', count: 1 }, screenId: 'c5.floor', position: FRIDGE_SPOT, commentDialogueId: 'c5.examine.whiskey' },
    // Bottle spots: empties to throw.
    ...FLOOR_BOTTLE_SPOTS.map((position, i) => ({ id: `c5.pickup.empties.floor.${i}`, item: { kind: 'empties' as const, count: 1 }, screenId: 'c5.floor' as const, position })),
    ...STACKS_BOTTLE_SPOTS.map((position, i) => ({ id: `c5.pickup.empties.stacks.${i}`, item: { kind: 'empties' as const, count: 1 }, screenId: 'c5.stacks' as const, position })),
  ],
  examinables: [
    { id: 'c5.tea', screenId: 'c5.bar', position: TEA_SPOT, objective: true },
    { id: 'c5.ticket', screenId: 'c5.lobby', position: TICKET_SPOT },
    { id: 'c5.retirement', screenId: 'c5.lobby', position: RETIREMENT_SPOT, objective: true },
    ...SHEETS.map((s) => ({ id: `c5.sheet.${s.n}`, screenId: 'c5.floor' as const, position: s.spot, objective: true as const })),
    { id: 'c5.requisition', screenId: 'c5.floor', position: REQUISITION_SPOT, objective: true },
    { id: 'c5.busticket', screenId: 'c5.floor', position: BUSTICKET_SPOT, objective: true },
    // The memo is the clean-run reward: the script ignores E on it until the run is clean.
    { id: 'c5.memo', screenId: 'c5.floor', position: MEMO_SPOT },
    { id: 'c5.lightbox', screenId: 'c5.floor', position: LIGHTBOX_SPOT, objective: true },
    { id: 'c5.copier', screenId: 'c5.floor', position: COPIER_SPOT, objective: true },
    { id: 'c5.umbrella', screenId: 'c5.stacks', position: UMBRELLA_SPOT },
  ],
  fights: [
    {
      sectionId: 'c5.fight.floor',
      screenId: 'c5.floor',
      trigger: { kind: 'script' },
      spawnPoints: FIGHT_SPAWNS,
      entrance: FIGHT_ENTRANCE,
    },
  ],
  bosses: [
    {
      bossId: 'c5.boss.pruitt1',
      screenId: 'c5.stacks',
      trigger: { kind: 'script' },
      bodies: [{ tag: 'pruitt', position: PRUITT_START }],
      // The shelf cranks: each lane is the aisle between two units, closed by the unit to its east sliding west.
      shelves: { lanes: LANES.map((l) => ({ id: `lane${l.index}`, area: l.area, travel: 'left' as const })), drawnByChapter: true },
      entrance: PRUITT_ENTRANCE,
    },
  ],
  stealth: [
    {
      sectionId: 'c5.stealth.lobby',
      screenId: 'c5.lobby',
      startArea: LOBBY_STEALTH_START,
      exitArea: LOBBY_STEALTH_EXIT,
      entrance: LOBBY_MYKO_SPOT,
      reinforcementPoints: LOBBY_REINFORCEMENTS,
    },
    {
      sectionId: 'c5.stealth.floor',
      screenId: 'c5.floor',
      startArea: STEALTH_START,
      exitArea: STEALTH_EXIT,
      entrance: FLOOR_MYKO_SPOT,
      reinforcementPoints: ALARM_REINFORCEMENTS,
    },
  ],
  redactionPuzzles: [
    {
      sectionId: 'c5.puzzle.redacted',
      examinableId: 'c5.lightbox',
      layout: {
        sheets: [{ id: 'sheet1' }, { id: 'sheet2' }, { id: 'sheet3' }, { id: 'sheet4' }, { id: 'sheet5' }],
        correct: ['sheet1', 'sheet3', 'sheet4'],
        rightTextId: 'c5.redacted.right',
        wrongTextId: 'c5.redacted.wrong',
        promptTextId: 'c5.redacted.prompt',
      },
    },
  ],
  triggers: [
    { id: 'c5.trig.lobby', screenId: 'c5.lobby', area: tilesArea(16, 13, 8, 5) },
    { id: 'c5.trig.actNatural', screenId: 'c5.lobby', area: LOBBY_QUEUE_AREA, once: false },
    // Overheard small talk, along the south aisle and the aisle between the middle cubicles (once the stealth is under way).
    { id: 'c5.trig.over1', screenId: 'c5.floor', area: tilesArea(10, 25, 3, 2), once: false },
    { id: 'c5.trig.over2', screenId: 'c5.floor', area: tilesArea(18, 25, 3, 2), once: false },
    { id: 'c5.trig.over3', screenId: 'c5.floor', area: tilesArea(24, 22, 3, 2), once: false },
    { id: 'c5.trig.over4', screenId: 'c5.floor', area: tilesArea(29, 26, 3, 2), once: false },
    { id: 'c5.trig.over5', screenId: 'c5.floor', area: tilesArea(30, 21, 3, 2), once: false },
    { id: 'c5.trig.lightbox', screenId: 'c5.floor', area: tilesArea(32, 25, 5, 3), once: false },
    { id: 'c5.trig.copierQueue', screenId: 'c5.floor', area: COPIER_QUEUE_AREA, once: false },
    { id: 'c5.trig.breakRoom', screenId: 'c5.floor', area: BREAK_ROOM, once: false },
    { id: 'c5.trig.stacks', screenId: 'c5.stacks', area: tilesArea(2, 12, 6, 8) },
    { id: 'c5.trig.pruitt', screenId: 'c5.stacks', area: PRUITT_TRIGGER, once: false },
    { id: 'c5.trig.pruittDesk', screenId: 'c5.stacks', area: tilesArea(41, 11, 7, 7), once: false },
  ],
  createScript: createChapterScript,
};
