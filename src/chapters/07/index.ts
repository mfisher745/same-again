/**
 * Chapter 7: Gift Shop. docs/chapters/07-gift-shop.md. The three screens, exits, dressing, examinables, placements and
 * constants are in `maps.ts`; `script.ts` wires every beat (the bar, the strip, the tells puzzle, Gary and Last Orders,
 * the stockroom stealth, the yard, the van, the board, the mascots and the closing). All text is by id from
 * `src/content/dialogue/c07.ts`.
 */


import type { ChapterModule } from '../../core/chapter';
import type { ChapterDef, ClueId, DeductionBoardDef, ObjectiveDef } from '../../core/types';
import type { TellsLayout } from '../../systems/tells';
import { createChapterScript } from './script';
import {
  BAR_ARRIVAL,
  ALIEN_FIGURES,
  BARTENDER_SPOT,
  FIGURES,
  FRIDGE_SPOT,
  GARY_TILE,
  LEAFLET_SPOT,
  MASCOT_ARENA,
  MASCOT_ENTRANCE,
  MASCOT_FORMATION,
  MASCOT_TRIGGER,
  NOTICEBOARD_SPOT,
  SHOP_ENTRY_AREA,
  STOCK_ENTRANCE,
  STOCK_EXIT,
  STOCK_OVERHEARD,
  STOCK_REINFORCEMENTS,
  STOCK_START,
  STOCK_STEALTH,
  STRIP_SHOP_AREA,
  T,
  TEA_SPOT,
  TOURIST1_TILE,
  TOURIST2_TILE,
  VAN_SPOT,
  YARD_ENTRANCE,
  YARD_SPAWNS,
  YARD_TRIGGER,
  ZIP_TUMBLE_LINE,
  shopScreen,
  stockScreen,
  stripScreen,
} from './maps';

export * from './maps';

const objective = (key: string, id: string): ObjectiveDef => ({
  id,
  textId: `c7.objective.${key}`,
  hint: {
    objectiveId: id,
    nudgeDialogueId: `c7.hint.${key}.1`,
    answerDialogueId: `c7.hint.${key}.2`,
  },
});

const clue = (key: string): ClueId => `c7.clue.${key}`;

const board: DeductionBoardDef = {
  id: 'c7.deduction.nevada',
  chapter: 7,
  candidateIds: [clue('leaflet'), clue('payslip'), clue('permit'), clue('route')],
  solution: [clue('payslip'), clue('permit'), clue('route')],
  leadTextId: 'c7.deduction.nevada.lead.body',
  leadMarginTextId: 'c7.deduction.nevada.lead.margin',
  wrongAnswerDialogueIds: ['c7.board.wrong.1', 'c7.board.wrong.2', 'c7.board.wrong.3'],
};

/** `c7.puzzle.tells`: the six figures (Gary is examined at the till), the three aliens fixed. */
const tellsLayout: TellsLayout = {
  figures: FIGURES.map((f) => ({
    id: f.key,
    examinableId: f.key === 'gary' ? 'c7.gary' : `c7.tells.${f.key}`,
    labelTextId: f.nameTextId ?? 'name.costumeF',
  })),
  aliens: ALIEN_FIGURES as unknown as readonly [string, string, string],
  promptTextId: 'c7.tells.prompt',
  rightTextId: 'c7.tells.right',
  wrongTextId: 'c7.tells.wrong',
};

const def: ChapterDef = {
  number: 7,
  titleTextId: 'c7.title',
  screens: [
    { id: 'c7.strip', region: 'roswell', sun: true, widthTiles: 60, heightTiles: 20 },
    { id: 'c7.shop', region: 'roswell', widthTiles: 40, heightTiles: 25 },
    { id: 'c7.stock', region: 'roswell', widthTiles: 30, heightTiles: 20 },
  ],
  startScreenId: 'c7.strip',
  bar: {
    screenId: 'c7.strip',
    arrival: BAR_ARRIVAL,
    hotDrinkProp: TEA_SPOT,
    openDialogueId: 'c7.bar.open',
    hotDrinkDialogueId: 'c7.bar.hotDrink',
    returnDialogueId: 'c7.bar.return',
  },
  sections: [
    { id: 'c7.explore.bar', kind: 'explore', mykoCallable: false },
    { id: 'c7.explore.strip', kind: 'explore', mykoCallable: false },
    { id: 'c7.puzzle.tells', kind: 'puzzle', mykoCallable: true },
    { id: 'c7.explore.gary', kind: 'explore', mykoCallable: false },
    { id: 'c7.stealth.stock', kind: 'stealth', mykoCallable: false },
    { id: 'c7.fight.yard', kind: 'fight', mykoCallable: true },
    { id: 'c7.explore.van', kind: 'explore', mykoCallable: false },
    { id: 'c7.deduction.nevada', kind: 'deduction', mykoCallable: true },
    { id: 'c7.boss.mascots', kind: 'boss', mykoCallable: true },
  ],
  stealthSections: [STOCK_STEALTH],
  puzzle: { id: 'c7.puzzle.tells', chapter: 7, kind: 'spotTheAlien' },
  deductionBoard: board,
  evidence: [clue('leaflet'), clue('payslip'), clue('permit'), clue('route')],
  objectives: [
    objective('strip', 'c7.strip'),
    objective('tells', 'c7.tells'),
    objective('gary', 'c7.gary'),
    objective('stock', 'c7.stock'),
    objective('yard', 'c7.yard'),
    objective('van', 'c7.van'),
    objective('board', 'c7.board'),
    objective('mascots', 'c7.mascots'),
  ],
  newAbilities: [],
  mykoCallLines: {
    fight: { sequenceId: 'c7.call.fight', casebookBodyTextId: 'c7.call.fight.casebook', casebookMarginTextId: 'c7.call.fight.margin' },
    puzzle: { sequenceId: 'c7.call.puzzle', casebookBodyTextId: 'c7.call.puzzle.casebook', casebookMarginTextId: 'c7.call.puzzle.margin' },
  },
  finaleSectionId: 'c7.boss.mascots',
};


export const chapter7: ChapterModule = {
  def,
  screens: [stripScreen(), shopScreen(), stockScreen()],
  pickups: [],
  mykoTangentPools: { ohio: 'c7.ohio', other: 'c7.tangent' },
  examinables: [
    // The strip: the bar's hot drink and the bartender.
    { id: 'c7.bar.hotDrink', screenId: 'c7.strip', position: TEA_SPOT, dialogueId: 'c7.bar.hotDrink', objective: true },
    { id: 'c7.bar.tequila', screenId: 'c7.strip', position: BARTENDER_SPOT, dialogueId: 'c7.bar.tequila' },
    { id: 'c7.strip.tourist1', screenId: 'c7.strip', position: T(TOURIST1_TILE.col, TOURIST1_TILE.row), dialogueId: 'c7.strip.tourist1' },
    { id: 'c7.strip.tourist2', screenId: 'c7.strip', position: T(TOURIST2_TILE.col, TOURIST2_TILE.row), dialogueId: 'c7.strip.tourist2' },
    { id: 'c7.clue.leaflet', screenId: 'c7.strip', position: LEAFLET_SPOT, dialogueId: 'c7.strip.leaflet', evidenceId: clue('leaflet'), objective: true },
    // The shop: the five figures, and Gary.
    ...FIGURES.filter((f) => f.key !== 'gary').map((f) => ({ id: `c7.tells.${f.key}`, screenId: 'c7.shop' as const, position: T(f.col, f.row), dialogueId: f.tellsDialogueId })),
    { id: 'c7.gary', screenId: 'c7.shop', position: T(GARY_TILE.col, GARY_TILE.row), dialogueId: 'c7.gary.intro', objective: true },
    // The stockroom and yard.
    { id: 'c7.clue.permit', screenId: 'c7.stock', position: NOTICEBOARD_SPOT, dialogueId: 'c7.stock.permit', evidenceId: clue('permit'), objective: true },
    { id: 'c7.stock.fridge', screenId: 'c7.stock', position: FRIDGE_SPOT, dialogueId: 'c7.stock.clean' },
    { id: 'c7.clue.route', screenId: 'c7.stock', position: VAN_SPOT, dialogueId: 'c7.van.log', evidenceId: clue('route'), objective: true },
  ],
  fights: [{ sectionId: 'c7.fight.yard', screenId: 'c7.stock', trigger: { kind: 'script' }, spawnPoints: YARD_SPAWNS, entrance: YARD_ENTRANCE }],
  bosses: [
    {
      bossId: 'c7.boss.mascots',
      screenId: 'c7.strip',
      trigger: { kind: 'script' },
      bodies: [
        { tag: 'zorp', position: MASCOT_FORMATION.zorp, spriteKey: 'boss.c7.boss.mascots.zorp' },
        { tag: 'zap', position: MASCOT_FORMATION.zap, spriteKey: 'boss.c7.boss.mascots.zap' },
        { tag: 'zip', position: MASCOT_FORMATION.zip, spriteKey: 'boss.c7.boss.mascots.zip' },
      ],
      entrance: MASCOT_ENTRANCE,
      mascots: {
        arena: { x: MASCOT_ARENA.col * 16, y: MASCOT_ARENA.row * 16, width: MASCOT_ARENA.width * 16, height: MASCOT_ARENA.height * 16 },
        tumbleLine: { from: ZIP_TUMBLE_LINE.from, to: ZIP_TUMBLE_LINE.to },
      },
    },
  ],
  tellsPuzzles: [{ sectionId: 'c7.puzzle.tells', layout: tellsLayout }],
  stealth: [
    {
      sectionId: 'c7.stealth.stock',
      screenId: 'c7.stock',
      startArea: STOCK_START,
      exitArea: STOCK_EXIT,
      entrance: STOCK_ENTRANCE,
      reinforcementPoints: STOCK_REINFORCEMENTS,
    },
  ],
  triggers: [
    { id: 'c7.trig.shop', screenId: 'c7.shop', area: SHOP_ENTRY_AREA, once: false },
    { id: 'c7.trig.shopDoor', screenId: 'c7.strip', area: STRIP_SHOP_AREA, once: false },
    { id: 'c7.trig.yard', screenId: 'c7.stock', area: YARD_TRIGGER, once: false },
    { id: 'c7.trig.mascots', screenId: 'c7.strip', area: MASCOT_TRIGGER, once: false },
    ...STOCK_OVERHEARD.map((o, i) => ({ id: `c7.trig.overheard.${i + 1}`, screenId: 'c7.stock' as const, area: o.area, once: false })),
  ],
  createScript: createChapterScript,
};
