/**
 * Chapter 10: Disclosure. docs/chapters/10-disclosure.md. Layout in `maps.ts`, script in `script.ts`. Not registered in
 * `src/chapters/index.ts` yet (the merge does that).
 *
 * Wired here: the Administrator's placement (desk, shield area, guard entrances, four switches, furniture, stamp rows), the
 * broadcast console layout (five sockets, two look-alikes, five plugs) and the objectives. The script plays the beats:
 * - the cabinet, ticket 848 (E on the machine starts `c10.fight.anteroom`), the locked door to control until it is won;
 * - walking into control starts `c10.boss.administrator` with `c10.admin.intro`; phases, offers and the end are events;
 * - walking onto the dais starts `c10.puzzle.broadcast` and opens the console scene; the button is its own step;
 * - after the press: the reaction cards, the cut to Feeney's (`CONTROL_TO_PUB`), the stool, Dympna, the epilogue, the credits.
 */

import type { ChapterModule } from '../../core/chapter';
import type { ChapterDef, ObjectiveDef, ProofId } from '../../core/types';
import { PROOF_SOCKET } from '../../art/propsC910';
import type { BroadcastLayout } from '../../systems/broadcast';
import type { AdministratorPlacement } from '../../systems/administrator';
import { createChapterScript } from './script';
import {
  ADMIN_ENTRANCE,
  ADMIN_START,
  ANTEROOM_ENTRANCE,
  ANTEROOM_SPAWNS,
  BAR_ARRIVAL,
  BUTTON_SPOT,
  CHANNEL_SPOTS,
  CONSOLE_AREA,
  CONTROL_ARENA_AREA,
  CONTROL_ENTRY_AREA,
  FRUIT_MACHINE_SPOT,
  GRAVITY_SWITCHES,
  GUARD_PAIR_SPAWNS,
  LOOSE_FURNITURE,
  PUB_STOOL,
  STAMP_ROWS,
  TEA_SPOT,
  T,
  TELLY_SPOT,
  TICKET_MACHINE,
  anteroomScreen,
  controlScreen,
  feeneysScreen,
} from './maps';

export * from './maps';

const objective = (key: string, id: string): ObjectiveDef => ({
  id,
  textId: `c10.objective.${key}`,
  hint: {
    objectiveId: id,
    nudgeDialogueId: `c10.hint.${key}.1`,
    answerDialogueId: `c10.hint.${key}.2`,
  },
});

const def: ChapterDef = {
  number: 10,
  titleTextId: 'c10.title',
  screens: [
    { id: 'c10.anteroom', region: 'base', widthTiles: 30, heightTiles: 17 },
    { id: 'c10.control', region: 'base', widthTiles: 40, heightTiles: 25 },
    { id: 'c10.pub', region: 'kilnamoe', widthTiles: 30, heightTiles: 17 },
  ],
  startScreenId: 'c10.anteroom',
  bar: {
    screenId: 'c10.anteroom',
    arrival: BAR_ARRIVAL,
    hotDrinkProp: TEA_SPOT,
    openDialogueId: 'c10.bar.open',
    hotDrinkDialogueId: 'c10.bar.hotDrink',
    returnDialogueId: 'c10.bar.return',
  },
  sections: [
    { id: 'c10.explore.bar', kind: 'explore', mykoCallable: false },
    { id: 'c10.fight.anteroom', kind: 'fight', mykoCallable: true },
    { id: 'c10.boss.administrator', kind: 'boss', mykoCallable: false },
    { id: 'c10.puzzle.broadcast', kind: 'puzzle', mykoCallable: true },
    { id: 'c10.explore.pub', kind: 'explore', mykoCallable: false },
  ],
  stealthSections: [],
  puzzle: { id: 'c10.puzzle.broadcast', chapter: 10, kind: 'broadcast' },
  evidence: [],
  objectives: [
    objective('anteroom', 'c10.anteroom'),
    objective('administrator', 'c10.administrator'),
    objective('broadcast', 'c10.broadcast'),
    objective('button', 'c10.button'),
    objective('pub', 'c10.pub'),
    // Walking in to Feeney's: the stool's hint is the pub's (the objective text is `c10.objective.sit`).
    { id: 'c10.sit', textId: 'c10.objective.sit', hint: { objectiveId: 'c10.sit', nudgeDialogueId: 'c10.hint.pub.1', answerDialogueId: 'c10.hint.pub.2' } },
  ],
  newAbilities: [],
  mykoCallLines: {
    fight: { sequenceId: 'c10.call.fight', casebookBodyTextId: 'c10.call.fight.casebook', casebookMarginTextId: 'c10.call.fight.margin' },
    puzzle: { sequenceId: 'c10.call.puzzle', casebookBodyTextId: 'c10.call.puzzle.casebook', casebookMarginTextId: 'c10.call.puzzle.margin' },
  },
  finaleSectionId: 'c10.boss.administrator',
};

/** Puzzle and boss interaction points: examinables with no line of their own (the script or the system handles E). */
export const SILENT_EXAMINABLES: readonly string[] = [...GRAVITY_SWITCHES.map((s) => s.id), ...CHANNEL_SPOTS.map((_, i) => `c10.channel.${i + 1}`), 'c10.button'];

const BOSS_ID = 'c10.boss.administrator' as const;
const PUZZLE_ID = 'c10.puzzle.broadcast' as const;

/** The Administrator's director placement from the maps constants. Furniture homes are the centre of the first solid tile. */
export const ADMINISTRATOR: AdministratorPlacement = {
  arena: CONTROL_ARENA_AREA,
  desk: ADMIN_START,
  // A pair uses the first two entrances.
  guardEntrances: [...GUARD_PAIR_SPAWNS[0]!],
  switches: GRAVITY_SWITCHES.map((s) => ({ examinableId: s.id, position: s.spot })),
  furniture: LOOSE_FURNITURE.map((f) => ({ id: f.id, position: T(f.col, f.row + (f.solid.dy ?? 0)) })),
  stampRows: STAMP_ROWS.map((r) => r.row),
};

/**
 * The console, left to right as drawn (`CONSOLE_SOCKETS`): triangle, square, circle, notched, twin hole. The square and
 * the notched socket look alike until examined (`look: 'square'`): the contract's and the staff directory's.
 */
const SOCKET_ORDER = ['triangle', 'square', 'circle', 'notched', 'twinHole'] as const;
const PROOF_KEYS = ['craft', 'contract', 'directory', 'log', 'footage'] as const;
export const BROADCAST: BroadcastLayout = {
  sockets: SOCKET_ORDER.map((shape, i) => ({ id: `s${i + 1}`, examinableId: `c10.channel.${i + 1}`, shape, look: shape === 'notched' ? 'square' : shape })),
  plugs: PROOF_KEYS.map((k) => ({ proofId: `c9.proof.${k}` as ProofId, shape: PROOF_SOCKET[k] })),
  buttonExaminableId: 'c10.button',
  wrongTextId: 'c10.broadcast.wrong',
};

export const chapter10: ChapterModule = {
  def,
  screens: [anteroomScreen(), controlScreen(), feeneysScreen()],
  pickups: [],
  examinables: [
    { id: 'c10.bar.hotDrink', screenId: 'c10.anteroom', position: TEA_SPOT, dialogueId: 'c10.bar.hotDrink' },
    { id: 'c10.ticket', screenId: 'c10.anteroom', position: TICKET_MACHINE, dialogueId: 'c10.open', objective: true },
    ...GRAVITY_SWITCHES.map((s) => ({ id: s.id, screenId: 'c10.control' as const, position: s.spot })),
    ...CHANNEL_SPOTS.map((p, i) => ({ id: `c10.channel.${i + 1}`, screenId: 'c10.control' as const, position: p })),
    { id: 'c10.button', screenId: 'c10.control', position: BUTTON_SPOT },
    { id: 'c10.pub.stool', screenId: 'c10.pub', position: PUB_STOOL, dialogueId: 'c10.pub.dympna', objective: true },
    { id: 'c10.pub.machine', screenId: 'c10.pub', position: FRUIT_MACHINE_SPOT, dialogueId: 'c10.pub.machine' },
    { id: 'c10.pub.telly', screenId: 'c10.pub', position: TELLY_SPOT, dialogueId: 'c10.pub.telly' },
  ],
  fights: [{ sectionId: 'c10.fight.anteroom', screenId: 'c10.anteroom', trigger: { kind: 'script' }, spawnPoints: ANTEROOM_SPAWNS, entrance: ANTEROOM_ENTRANCE }],
  bosses: [{ bossId: BOSS_ID, screenId: 'c10.control', trigger: { kind: 'script' }, bodies: [{ tag: 'administrator', position: ADMIN_START }], entrance: ADMIN_ENTRANCE, administrator: ADMINISTRATOR }],
  broadcastPuzzles: [{ sectionId: PUZZLE_ID, screenId: 'c10.control', layout: BROADCAST }],
  stealth: [],
  triggers: [
    { id: 'c10.trig.control', screenId: 'c10.control', area: CONTROL_ENTRY_AREA, once: false },
    { id: 'c10.trig.console', screenId: 'c10.control', area: CONSOLE_AREA, once: false },
  ],
  createScript: createChapterScript,
};
