/**
 * Chapter 2: The Bog. docs/chapters/02-the-bog.md.
 */

import type { ChapterModule } from '../../core/chapter';
import type { ChapterDef, ObjectiveDef } from '../../core/types';
import { createChapterScript } from './script';
import {
  BAR_ARRIVAL,
  BOG_EXIT_AREA,
  BOG_STEALTH,
  CLUE_SPOTS,
  COUSIN_TRIGGER,
  FLASK_SPOT,
  LANE_EXIT_AREA,
  LANE_GATE_COL,
  RING_AREA,
  SHEEP_LAYOUT,
  T,
  bogScreen,
  farmScreen,
  laneScreen,
  tilesArea,
} from './maps';

const objective = (key: string, id: string): ObjectiveDef => ({
  id,
  textId: `c2.objective.${key}`,
  hint: { objectiveId: id, nudgeDialogueId: `c2.hint.${key}.1`, answerDialogueId: `c2.hint.${key}.2` },
});

const def: ChapterDef = {
  number: 2,
  titleTextId: 'c2.title',
  screens: [
    { id: 'c2.bog', region: 'kilnamoe', widthTiles: 60, heightTiles: 34 },
    { id: 'c2.farm', region: 'kilnamoe', widthTiles: 40, heightTiles: 30 },
    { id: 'c2.lane', region: 'kilnamoe', widthTiles: 90, heightTiles: 12 },
  ],
  startScreenId: 'c2.bog',
  bar: {
    screenId: 'c2.bog',
    arrival: BAR_ARRIVAL,
    hotDrinkProp: FLASK_SPOT,
    openDialogueId: 'c2.bar.open',
    hotDrinkDialogueId: 'c2.bar.hotDrink',
    returnDialogueId: 'c2.bar.return',
  },
  sections: [
    { id: 'c2.explore.bar', kind: 'explore', mykoCallable: false },
    { id: 'c2.explore.ring', kind: 'explore', mykoCallable: false },
    { id: 'c2.stealth.bog', kind: 'stealth', mykoCallable: false },
    { id: 'c2.puzzle.sheep', kind: 'puzzle', mykoCallable: true },
    { id: 'c2.explore.shed', kind: 'explore', mykoCallable: false },
    { id: 'c2.fight.yard', kind: 'fight', mykoCallable: true },
    { id: 'c2.setpiece.ram', kind: 'setpiece', mykoCallable: true },
  ],
  stealthSections: [BOG_STEALTH],
  puzzle: { id: 'c2.puzzle.sheep', chapter: 2, kind: 'sheepGates' },
  evidence: [
    'c2.clue.ring',
    'c2.clue.fragment',
    'c2.clue.tracks',
    'c2.clue.frog',
    'c2.clue.welly',
    'c2.clue.lanyard',
    'c2.clue.docket',
    'c2.clue.conclusion',
  ],
  objectives: [
    objective('ring', 'c2.ring'),
    objective('cross', 'c2.cross'),
    objective('sheep', 'c2.sheep'),
    objective('shed', 'c2.shed'),
    objective('yard', 'c2.yard'),
    objective('ram', 'c2.ram'),
  ],
  newAbilities: ['stumble'],
  mykoCallLines: {
    fight: { sequenceId: 'c2.call.fight', casebookBodyTextId: 'c2.call.fight.casebook', casebookMarginTextId: 'c2.call.fight.margin' },
    puzzle: { sequenceId: 'c2.call.puzzle', casebookBodyTextId: 'c2.call.puzzle.casebook', casebookMarginTextId: 'c2.call.puzzle.margin' },
  },
  finaleSectionId: 'c2.setpiece.ram',
};

export const chapter2: ChapterModule = {
  def,
  screens: [bogScreen(), farmScreen(), laneScreen()],
  pickups: [{ id: 'c2.pickup.whiskey', item: { kind: 'drink', drinkId: 'whiskey', count: 1 }, screenId: 'c2.farm', position: T(17, 2), commentDialogueId: 'c2.shed.whiskey' }],
  examinables: [
    { id: 'c2.flask', screenId: 'c2.bog', position: FLASK_SPOT },
    { id: 'c2.ring', screenId: 'c2.bog', position: CLUE_SPOTS.ring },
    { id: 'c2.fragment', screenId: 'c2.bog', position: CLUE_SPOTS.fragment },
    { id: 'c2.tracks', screenId: 'c2.bog', position: CLUE_SPOTS.tracks },
    { id: 'c2.frog', screenId: 'c2.bog', position: CLUE_SPOTS.frog },
    { id: 'c2.welly', screenId: 'c2.bog', position: CLUE_SPOTS.welly },
    { id: 'c2.docket', screenId: 'c2.farm', position: T(11, 3) },
    // The three sheep gates hang at the middle of the cross; E at each swings it.
    { id: 'c2.gateA', screenId: 'c2.farm', position: T(19, 12) },
    { id: 'c2.gateB', screenId: 'c2.farm', position: T(20, 14) },
    { id: 'c2.gateC', screenId: 'c2.farm', position: T(19, 16) },
    { id: 'c2.lane.gate', screenId: 'c2.lane', position: T(LANE_GATE_COL - 1, 5) },
  ],
  fights: [
    {
      sectionId: 'c2.fight.yard',
      screenId: 'c2.farm',
      trigger: { kind: 'script' },
      spawnPoints: [T(7, 17), T(7, 21), T(2, 22)],
      entrance: T(2, 25),
    },
  ],
  bosses: [
    {
      bossId: 'c2.setpiece.ram',
      screenId: 'c2.lane',
      trigger: { kind: 'script' },
      bodies: [{ tag: 'ram', position: T(1, 5), invulnerable: true }],
      entrance: T(2, 3),
      exitArea: LANE_EXIT_AREA,
    },
  ],
  stealth: [
    {
      sectionId: 'c2.stealth.bog',
      screenId: 'c2.bog',
      exitArea: BOG_EXIT_AREA,
      entrance: T(37, 12),
      reinforcementPoints: [T(41, 5), T(41, 22)],
    },
  ],
  sheepPuzzles: [{ sectionId: 'c2.puzzle.sheep', screenId: 'c2.farm', layout: SHEEP_LAYOUT }],
  triggers: [
    { id: 'c2.trig.ring', screenId: 'c2.bog', area: RING_AREA, once: false },
    { id: 'c2.trig.over1', screenId: 'c2.bog', area: tilesArea(40, 10, 2, 3), once: false },
    { id: 'c2.trig.over2', screenId: 'c2.bog', area: tilesArea(46, 10, 2, 3), once: false },
    { id: 'c2.trig.over3', screenId: 'c2.bog', area: tilesArea(50, 10, 2, 3), once: false },
    { id: 'c2.trig.cousins', screenId: 'c2.farm', area: COUSIN_TRIGGER, once: false },
    { id: 'c2.trig.ram1', screenId: 'c2.lane', area: tilesArea(10, 2, 2, 8), once: false },
    { id: 'c2.trig.ram2', screenId: 'c2.lane', area: tilesArea(40, 2, 2, 8), once: false },
    { id: 'c2.trig.ram3', screenId: 'c2.lane', area: tilesArea(58, 2, 2, 8), once: false },
  ],
  createScript: createChapterScript,
};
