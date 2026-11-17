/**
 * Chapter 5 and the reload trap: a fight, boss or set piece started by a one-time trigger must start again after a load
 * (Continue) or a return to the bar, and what was finished stays finished. Also the walk back after a return.
 */

import { describe, expect, it } from 'vitest';
import { PROP } from '../../src/art/props';
import { LOBBY_STEALTH_START, SHELF_UNIT_COLS, shelfPropId } from '../../src/chapters/05/maps';
import { NO_INPUT, record } from './helpers';
import { BOARD, BOSS, FIGHT, PUZZLE, crossFloor, crossLobby, examine, gatherFiles, jamCopier, mid, newGame, settle, solveRedaction, startPruitt, toFloor, toLobby, toQueue, toStacks } from './chapter5-steps';

type Run = Awaited<ReturnType<typeof newGame>>['run'];

async function toSober(run: Run): Promise<void> {
  run.holdDrain(false);
  run.player.meter = { ...run.player.meter, value: 0.01, tea: null };
  for (let i = 0; i < 12; i++) run.tick(16, NO_INPUT);
  run.completeBarReturn();
  await settle(run, 4);
}

/** The path to the copier with the redaction solved: the lobby and floor passed, the sheets held. */
async function toCopier(run: Run): Promise<void> {
  await toLobby(run);
  await crossLobby(run);
  await toFloor(run);
  await crossFloor(run);
  await gatherFiles(run);
  await solveRedaction(run);
  await settle(run, 6);
}

describe('chapter 5: a fight under way survives a load', () => {
  it('the cubicle fight: started by the copier, saved, loaded, and the copier starts it again', async () => {
    const a = await newGame();
    await toCopier(a.run);
    await jamCopier(a.run);
    expect(a.run.fight(FIGHT)?.active).toBe(true);
    a.run.learnMove('lastOrders'); // a move not yet known: writes a save
    const b = await newGame('continue', a.store);
    expect(b.run.isComplete(PUZZLE)).toBe(true);
    expect(b.run.fight(FIGHT)?.active).toBe(false);
    expect(b.run.screenId).toBe('c5.bar');
    await toFloor(b.run);
    await jamCopier(b.run);
    expect(b.run.fight(FIGHT)?.active, 'starts again after a load').toBe(true);
    expect(b.run.fight(FIGHT)!.aliveActors()).toHaveLength(3);
  });

  it('the cubicle fight: a load with the Lock-in lesson saved but the fight not won still has the move, and the fight starts', async () => {
    const a = await newGame();
    await toCopier(a.run);
    await jamCopier(a.run);
    a.run.completeSection('c5.explore.bar', 'debug'); // writes a save
    const b = await newGame('continue', a.store);
    expect(b.run.player.kit.moves).toContain('lockIn');
    const shown = record(b.run.bus, 'dialogue:show');
    await toFloor(b.run);
    await jamCopier(b.run);
    expect(b.run.fight(FIGHT)?.active).toBe(true);
    // The scenes that played before are not played again.
    expect(shown.map((s) => s.sequenceId)).not.toContain('c5.lockIn.lesson');
  });

  it('Pruitt: started by his trigger, saved, loaded, and the trigger starts him again', async () => {
    const a = await newGame();
    for (const s of ['c5.explore.bar', 'c5.stealth.lobby', 'c5.stealth.floor', PUZZLE, FIGHT, BOARD] as const) a.run.completeSection(s, 'debug');
    await toStacks(a.run);
    await startPruitt(a.run);
    expect(a.run.boss(BOSS)?.active).toBe(true);
    a.run.learnMove('lastOrders');
    const b = await newGame('continue', a.store);
    expect(b.run.isComplete(BOARD)).toBe(true);
    expect(b.run.boss(BOSS)?.active).toBe(false);
    await toStacks(b.run);
    await startPruitt(b.run);
    expect(b.run.boss(BOSS)?.active, 'starts again after a load').toBe(true);
    expect(b.run.boss(BOSS)?.phase?.id).toBe('oneShelf');
  });

  it('the lobby alarm: a load puts the guard back, and he can be caught again', async () => {
    const a = await newGame();
    await toLobby(a.run);
    await toQueue(a.run);
    a.run.setPlayerPosition(mid(LOBBY_STEALTH_START));
    await settle(a.run, 3);
    a.run.stealth('c5.stealth.lobby')!.alarm();
    await settle(a.run, 3);
    expect(a.run.fight('c5.stealth.lobby.alarm' as never)?.active).toBe(true);
    a.run.learnMove('lastOrders');
    const b = await newGame('continue', a.store);
    expect(b.run.isComplete('c5.stealth.lobby')).toBe(false);
    await toLobby(b.run);
    b.run.setPlayerPosition(mid(LOBBY_STEALTH_START));
    await settle(b.run, 3);
    b.run.stealth('c5.stealth.lobby')!.alarm();
    await settle(b.run, 3);
    expect(b.run.fight('c5.stealth.lobby.alarm' as never)?.active).toBe(true);
    expect(b.run.fight('c5.stealth.lobby.alarm' as never)!.aliveActors()).toHaveLength(2);
  });

  it('the floor alarm: a load puts the six guards back on their routes', async () => {
    const a = await newGame();
    await toFloor(a.run);
    a.run.setPlayerPosition(mid(a.run.module.stealth.find((s) => s.sectionId === 'c5.stealth.floor')!.startArea!));
    await settle(a.run, 3);
    a.run.stealth('c5.stealth.floor')!.alarm();
    await settle(a.run, 3);
    a.run.learnMove('lastOrders');
    const b = await newGame('continue', a.store);
    expect(b.run.isComplete('c5.stealth.floor')).toBe(false);
    await toFloor(b.run);
    b.run.setPlayerPosition(mid(b.run.module.stealth.find((s) => s.sectionId === 'c5.stealth.floor')!.startArea!));
    await settle(b.run, 3);
    b.run.stealth('c5.stealth.floor')!.alarm();
    await settle(b.run, 3);
    // The six guards are back on their routes (and join the fight), with the first wave on top.
    expect(b.run.fight('c5.stealth.floor.alarm' as never)!.aliveActors()).toHaveLength(6 + 3);
  });
});

describe('chapter 5: back to the bar mid-chapter', () => {
  it('a return during the cubicle fight: the bar, finished sections kept, the fight started over by the copier, and the guards gone', async () => {
    const { run } = await newGame();
    await toCopier(run);
    await jamCopier(run);
    expect(run.fight(FIGHT)?.active).toBe(true);
    const shown = record(run.bus, 'dialogue:show');
    await toSober(run);
    expect(run.screenId).toBe('c5.bar');
    expect(shown.map((s) => s.sequenceId)).toContain('c5.bar.return');
    expect(run.hotDrinkOffered()).toBe(true);
    for (const s of ['c5.stealth.lobby', 'c5.stealth.floor', 'c5.explore.files', PUZZLE] as const) expect(run.isComplete(s), s).toBe(true);
    expect(run.fight(FIGHT)?.active).toBe(false);
    expect(run.isComplete(FIGHT)).toBe(false);
    expect(run.dressing.prop('copier')?.frame).toBe(PROP.filingCabinet.shut);
    expect(run.player.kit.moves).toEqual(expect.arrayContaining(['actNatural', 'lockIn']));
    // Back through the beaten parts: the lobby and the floor have no guards, and the sheets stay taken.
    await toLobby(run);
    run.setPlayerPosition(mid(LOBBY_STEALTH_START));
    await settle(run, 4);
    run.stealth('c5.stealth.lobby')!.alarm();
    await toFloor(run);
    run.stealth('c5.stealth.floor')!.alarm();
    await settle(run, 4);
    expect(run.fight('c5.stealth.lobby.alarm' as never)).toBeFalsy();
    expect(run.fight('c5.stealth.floor.alarm' as never)).toBeFalsy();
    for (const n of [1, 2, 3, 4, 5]) expect(run.dressing.prop(`sheet.${n}`)?.visible).toBe(false);
    await jamCopier(run);
    expect(run.fight(FIGHT)?.active, 'starts again').toBe(true);
    expect(run.fight(FIGHT)!.aliveActors()).toHaveLength(3);
  });

  it('a return during Pruitt: the shelves and rails are back as they were, and the trigger starts him from the beginning', async () => {
    const { run } = await newGame();
    for (const s of ['c5.explore.bar', 'c5.stealth.lobby', 'c5.stealth.floor', PUZZLE, FIGHT, BOARD] as const) run.completeSection(s, 'debug');
    await toStacks(run);
    await startPruitt(run);
    const boss = run.boss(BOSS)!;
    boss.body('pruitt')!.frozen = true;
    // Run it until a shelf is under way, then lose.
    for (let i = 0; i < 400 && run.ambient() === null; i++) {
      run.setPlayerPosition({ x: 20 * 16, y: 12 * 16 });
      run.tick(16, NO_INPUT);
      if (run.sceneBlocking) run.dialogue.finishAll();
    }
    expect(run.ambient()).not.toBeNull();
    await toSober(run);
    expect(run.screenId).toBe('c5.bar');
    expect(run.boss(BOSS)?.active).toBe(false);
    expect(run.isComplete(BOSS)).toBe(false);
    expect(run.isComplete(BOARD)).toBe(true);
    await toStacks(run);
    expect(run.ambient()).toBeNull();
    for (let u = 0; u < SHELF_UNIT_COLS.length; u++) expect(run.dressing.prop(shelfPropId(u, 0))?.col).toBe(SHELF_UNIT_COLS[u]);
    await startPruitt(run);
    expect(run.boss(BOSS)?.active, 'starts again').toBe(true);
    expect(run.boss(BOSS)?.phase?.id).toBe('oneShelf');
  });

  it('a return before the files are done keeps the lobby and the floor passed and the sheets already held', async () => {
    const { run } = await newGame();
    await toLobby(run);
    await crossLobby(run);
    await toFloor(run);
    await crossFloor(run);
    examine(run, 'c5.sheet.1');
    examine(run, 'c5.requisition');
    await settle(run, 6);
    run.completeSection('c5.explore.bar', 'debug'); // a save
    await toSober(run);
    expect(run.isComplete('c5.stealth.floor')).toBe(true);
    expect(run.redaction(PUZZLE)!.collected()).toEqual(['sheet1']);
    expect(run.dressing.prop('sheet.1')?.visible).toBe(false);
    expect(run.dressing.prop('sheet.2')?.visible).toBe(true);
    expect(run.objective()).toBe('c5.files');
  });
});
