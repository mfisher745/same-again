/**
 * Chapter 10: Disclosure. docs/chapters/10-disclosure.md. Layout half: the three screens, exits, dressing, examinables
 * and placements are in `maps.ts`. Not registered in `src/chapters/index.ts` yet. `script.ts` is a stub.
 *
 * What the script must wire:
 * - Bar (`c10.explore.bar`): `c10.bar.open` on the first visit, `c10.bar.hotDrink` at the trolley (`TEA_SPOT`; show and
 *   hide `bar.steam`), `c10.bar.return` on the first return.
 * - Ticket (`c10.ticket`, `TICKET_MACHINE`): E plays `c10.open` and starts `c10.fight.anteroom` (the placement is a
 *   script trigger). Waves 2 and 3 play `c10.anteroom.wave2` and `c10.anteroom.end` at the end; the side door
 *   (`ANTE_SIDE_DOOR_AREA`) is where wave 2 comes through. `ANTEROOM_SPAWNS` is the flat list the fight takes in order.
 * - Control room entry (`c10.trig.control`): starts `c10.boss.administrator` with `c10.admin.intro`. The boss placement is
 *   not here: systems-dev's Administrator needs the desk (`ADMIN_DESK`, `DESK_SHIELD_AREA`, `ADMIN_START`),
 *   `GUARD_PAIR_SPAWNS`, `STAMP_ROWS`, `GRAVITY_SWITCHES` (examinables `c10.switch.*`, no text), `LOOSE_FURNITURE` (prop
 *   ids to move), `ADMIN_SIT_SPOT` and `CONTROL_ARENA`, and a `BossPlacement` for `c10.boss.administrator` (not callable:
 *   the M refusal lines are in common.ts). The gravity arrows, shockwave, shield and phase 3 markers are drawn in code.
 *   A return to the cabinet restarts the fight from phase 1. After it: `c10.admin.end`.
 * - Broadcast (`c10.puzzle.broadcast`, kind `broadcast`): `c10.trig.console` starts it with `c10.broadcast.intro`.
 *   `CHANNEL_SPOTS` (examinables `c10.channel.1` to `.5`) and `BUTTON_SPOT` (`c10.button`) are the interaction points, the
 *   console is `control.console1` to `3`. Register it (`ctx.registerPuzzle`); `completeNow` plugs all five and leaves
 *   the button.
 * - Reaction (scripted): cards and short scenes, then `ctx.goToScreen(CONTROL_TO_PUB.screenId, CONTROL_TO_PUB.spawn)`.
 *   There is no exit from control to the pub: it is a cut. The pub has no way out and no meter.
 * - Feeney's: `c10.pub.enter` on arrival; `c10.pub.stool` (E at `PUB_STOOL`) sits Andrew and plays `c10.pub.dympna`
 *   (Dympna speaks only to Andrew); `pub.telly` should show the lit frame; the epilogue, credits and title card follow.
 *   The camera does not count stools or glasses.
 * - The finale for `def.finaleSectionId` is the Administrator; the chapter ends after the epilogue (`ctx.completeChapter()`).
 */

import type { ChapterModule } from '../../core/chapter';
import type { ChapterDef, ObjectiveDef } from '../../core/types';
import { createChapterScript } from './script';
import {
  ANTEROOM_ENTRANCE,
  ANTEROOM_SPAWNS,
  BAR_ARRIVAL,
  BUTTON_SPOT,
  CHANNEL_SPOTS,
  CONSOLE_AREA,
  CONTROL_ENTRY_AREA,
  FRUIT_MACHINE_SPOT,
  GRAVITY_SWITCHES,
  PUB_STOOL,
  TEA_SPOT,
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
  bosses: [],
  stealth: [],
  triggers: [
    { id: 'c10.trig.control', screenId: 'c10.control', area: CONTROL_ENTRY_AREA, once: false },
    { id: 'c10.trig.console', screenId: 'c10.control', area: CONSOLE_AREA, once: false },
  ],
  createScript: createChapterScript,
};
