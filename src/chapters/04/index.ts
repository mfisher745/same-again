/**
 * Chapter 4: Southie. docs/chapters/04-southie.md.
 */

import { PROP } from '../../art/props';
import { hasSequence } from '../../content/dialogue';
import type { ChapterModule } from '../../core/chapter';
import type { ChapterDef, ClueId, DeductionBoardDef, ObjectiveDef } from '../../core/types';
import { createChapterScript } from './script';
import {
  BAR_ARRIVAL,
  BRAWL_ENTRANCE,
  BRAWL_SPAWNS,
  BREWERY_SPOT,
  CONTAINER_INSIDE,
  DOCKS_STEALTH,
  FOAM_SPOT,
  FOREMAN_ENTRANCE,
  FOREMAN_PIN,
  FOREMAN_TRIGGER,
  GATE_SEAT,
  LIGHT_BEER_SPOT,
  MANNER_AREA,
  PATRON_TILES,
  RAILS,
  ROSTER_SPOT,
  SEIZURE_SPOT,
  SHILLELAGH_SPOT,
  STEALTH_EXIT,
  STEALTH_START,
  STOUT_SPOT,
  TEA_SPOT,
  T,
  barScreen,
  docksScreen,
  tilesArea,
} from './maps';

const objective = (key: string, id: string): ObjectiveDef => ({
  id,
  textId: `c4.objective.${key}`,
  hint: {
    objectiveId: id,
    nudgeDialogueId: `c4.hint.${key}.1`,
    answerDialogueId: `c4.hint.${key}.2`,
    ...(hasSequence(`c4.hint.${key}.where`) ? { whereDialogueId: `c4.hint.${key}.where` } : {}),
  },
});

const clue = (key: string): ClueId => `c4.clue.${key}`;

const board: DeductionBoardDef = {
  id: 'c4.deduction.dc',
  chapter: 4,
  candidateIds: [clue('seizure'), clue('roster'), 'c3.clue.manifest', clue('patch'), clue('foam'), clue('stout')],
  solution: [clue('seizure'), clue('roster'), 'c3.clue.manifest'],
  leadTextId: 'c4.deduction.dc.lead',
  leadMarginTextId: 'c4.deduction.dc.lead.margin',
  wrongAnswerDialogueIds: ['c4.board.wrong.1', 'c4.board.wrong.2', 'c4.board.wrong.3'],
};

const def: ChapterDef = {
  number: 4,
  titleTextId: 'c4.title',
  screens: [
    { id: 'c4.bar', region: 'cities', widthTiles: 40, heightTiles: 22 },
    { id: 'c4.docks', region: 'cities', widthTiles: 70, heightTiles: 34 },
  ],
  startScreenId: 'c4.bar',
  bar: {
    screenId: 'c4.bar',
    arrival: BAR_ARRIVAL,
    hotDrinkProp: TEA_SPOT,
    openDialogueId: 'c4.bar.open',
    hotDrinkDialogueId: 'c4.bar.hotDrink',
    returnDialogueId: 'c4.bar.return',
  },
  sections: [
    { id: 'c4.explore.bar', kind: 'explore', mykoCallable: false },
    { id: 'c4.fight.brawl', kind: 'fight', mykoCallable: true },
    { id: 'c4.stealth.docks', kind: 'stealth', mykoCallable: false },
    { id: 'c4.puzzle.containers', kind: 'puzzle', mykoCallable: true },
    { id: 'c4.explore.container', kind: 'explore', mykoCallable: false },
    { id: 'c4.deduction.dc', kind: 'deduction', mykoCallable: true },
    { id: 'c4.boss.foreman', kind: 'boss', mykoCallable: true },
  ],
  stealthSections: [DOCKS_STEALTH],
  puzzle: { id: 'c4.puzzle.containers', chapter: 4, kind: 'containers' },
  deductionBoard: board,
  evidence: [clue('roster'), clue('patch'), clue('stout'), clue('seizure'), clue('foam')],
  objectives: [
    objective('bar', 'c4.bar'),
    objective('manner', 'c4.manner'),
    objective('brawl', 'c4.brawl'),
    objective('docks', 'c4.docks'),
    objective('containers', 'c4.containers'),
    objective('board', 'c4.board'),
    objective('foreman', 'c4.foreman'),
  ],
  newAbilities: [],
  mykoCallLines: {
    fight: { sequenceId: 'c4.call.fight', casebookBodyTextId: 'c4.call.fight.casebook', casebookMarginTextId: 'c4.call.fight.margin' },
    puzzle: { sequenceId: 'c4.call.puzzle', casebookBodyTextId: 'c4.call.puzzle.casebook', casebookMarginTextId: 'c4.call.puzzle.margin' },
  },
  finaleSectionId: 'c4.boss.foreman',
};

export const chapter4: ChapterModule = {
  def,
  screens: [barScreen(), docksScreen()],
  pickups: [
    { id: 'c4.pickup.lightBeer', item: { kind: 'drink', drinkId: 'lightBeer', count: 1 }, screenId: 'c4.bar', position: LIGHT_BEER_SPOT, commentDialogueId: 'c4.lightBeer' },
    { id: 'c4.pickup.ipa', item: { kind: 'drink', drinkId: 'craftIpa', count: 1 }, screenId: 'c4.bar', position: BREWERY_SPOT, commentDialogueId: 'c4.bar.ipa' },
  ],
  examinables: [
    { id: 'c4.tea', screenId: 'c4.bar', position: TEA_SPOT, objective: true },
    { id: 'c4.colleen', screenId: 'c4.bar', position: T(PATRON_TILES.colleen.col, 5) },
    { id: 'c4.doug', screenId: 'c4.bar', position: T(PATRON_TILES.doug.col, PATRON_TILES.doug.row) },
    { id: 'c4.kev', screenId: 'c4.bar', position: T(PATRON_TILES.kev.col, PATRON_TILES.kev.row) },
    { id: 'c4.barb', screenId: 'c4.bar', position: T(PATRON_TILES.barb.col, PATRON_TILES.barb.row) },
    { id: 'c4.sully', screenId: 'c4.bar', position: T(PATRON_TILES.sully.col, PATRON_TILES.sully.row) },
    { id: 'c4.roster', screenId: 'c4.bar', position: ROSTER_SPOT, objective: true },
    { id: 'c4.stout', screenId: 'c4.bar', position: STOUT_SPOT },
    ...RAILS.map((r) => ({ id: r.examinableId, screenId: 'c4.docks' as const, position: T(r.leverTile.col, r.leverTile.row), objective: true as const })),
    { id: 'c4.seizure', screenId: 'c4.docks', position: SEIZURE_SPOT, objective: true },
    { id: 'c4.foam', screenId: 'c4.docks', position: FOAM_SPOT },
    { id: 'c4.shillelagh', screenId: 'c4.docks', position: SHILLELAGH_SPOT },
  ],
  fights: [
    {
      sectionId: 'c4.fight.brawl',
      screenId: 'c4.bar',
      trigger: { kind: 'script' },
      spawnPoints: BRAWL_SPAWNS,
      entrance: BRAWL_ENTRANCE,
    },
  ],
  bosses: [
    {
      bossId: 'c4.boss.foreman',
      screenId: 'c4.docks',
      trigger: { kind: 'script' },
      bodies: [{ tag: 'foreman', position: FOREMAN_PIN }],
      entrance: FOREMAN_ENTRANCE,
    },
  ],
  stealth: [
    {
      sectionId: 'c4.stealth.docks',
      screenId: 'c4.docks',
      startArea: STEALTH_START,
      exitArea: STEALTH_EXIT,
      entrance: GATE_SEAT,
      reinforcementPoints: [T(12, 27), T(34, 27)],
    },
  ],
  slidePuzzles: [
    {
      sectionId: 'c4.puzzle.containers',
      screenId: 'c4.docks',
      rails: RAILS.map((r) => ({
        id: r.id,
        origin: r.origin,
        axis: 'across' as const,
        slots: r.slots,
        length: 2,
        breadth: 1,
        start: r.start,
        frame: PROP.container.plain,
      })),
      levers: RAILS.map((r) => ({ examinableId: r.examinableId, railId: r.id, propId: `lever.${r.id}` })),
      goal: Object.fromEntries(RAILS.map((r) => [r.id, r.goal])),
    },
  ],
  triggers: [
    { id: 'c4.trig.manner', screenId: 'c4.bar', area: MANNER_AREA, once: false },
    { id: 'c4.trig.over1', screenId: 'c4.docks', area: tilesArea(20, 3, 2, 4), once: false },
    { id: 'c4.trig.over2', screenId: 'c4.docks', area: tilesArea(26, 11, 2, 4), once: false },
    { id: 'c4.trig.puzzle', screenId: 'c4.docks', area: tilesArea(40, 8, 2, 4), once: false },
    { id: 'c4.trig.inside', screenId: 'c4.docks', area: CONTAINER_INSIDE, once: false },
    { id: 'c4.trig.foreman', screenId: 'c4.docks', area: FOREMAN_TRIGGER, once: false },
  ],
  createScript: createChapterScript,
};
