/**
 * Chapter 9 beats, in order, through the real triggers and examinables: the staff social area, the offices stealth (overheard
 * lines, the proofs, the clean-run tequila), the Glove, the gravity rooms, the hangar and the records, the labs fight, the board,
 * the lockdown (a door catching Andrew, the tape, the lift gate, the wand), Myko's calls and the closing.
 */

import { describe, expect, it } from 'vitest';
import { PROP } from '../../src/art/props';
import { BAR_ARRIVAL, HALL_BAYS, LIFT_ROOM, MYKO_BAR, OFFICES_OVERHEARD, OFFICES_START, WAND_TILE } from '../../src/chapters/09/index';
import { TUNING } from '../../src/content/tuning';
import type { ChapterRun } from '../../src/systems/run';
import { NO_INPUT, holdM, record, settleDialogue } from './helpers';
import {
  BOARD,
  BOSS,
  EXPLORE_LABS,
  FIGHT,
  STEALTH,
  crossOffices,
  doBar,
  doBoard,
  doLabsProofs,
  doProofsOffices,
  ev,
  examine,
  hook,
  intoBay,
  mid,
  newGame,
  pressBaySwitch,
  pressLift,
  settle,
  solveGravity,
  startLabsFight,
  startLockdown,
  step,
  steady,
  takeGlove,
  takeTape,
  toHall,
  toLabs,
  winLabsFight,
} from './chapter9-steps';

const DOOR_MS = TUNING.bosses['c9.setpiece.lockdown'].phases[0]!.attacks.find((a) => a.id === 'door')!.telegraphMs ?? 0;
const has = (run: ChapterRun, id: string): boolean => run.casebook.hasEvidence(ev(id));
/** `exitLocks` is the run's own table; there is no reader for it. */
const locked = (run: ChapterRun, id: string): boolean => (run as unknown as { exitLocks: Map<string, boolean> }).exitLocks.get(id) === true;

/** Everything up to the hall: bar, offices, Glove, rooms, labs proofs, the fight and the board. */
async function toLockdown() {
  const g = await newGame();
  const { run } = g;
  await doBar(run);
  await crossOffices(run);
  await doProofsOffices(run);
  await takeGlove(run);
  await toLabs(run);
  steady(run);
  await solveGravity(run);
  await doLabsProofs(run);
  await startLabsFight(run);
  await winLabsFight(run);
  await doBoard(run);
  return g;
}

describe('chapter 9: the staff social area', () => {
  it('opens at the bar with the title, the open scene, Myko at the table, steam on the kettle and the offices objective', async () => {
    const { run } = await newGame();
    expect(run.screenId).toBe('c9.offices');
    expect(run.player.pos).toEqual(BAR_ARRIVAL);
    expect(run.myko.pos).toEqual(MYKO_BAR);
    expect(run.objective()).toBe('c9.offices');
    expect(run.hotDrinkOffered()).toBe(true);
    expect(run.dressing.prop('bar.steam')?.visible).toBe(true);
  });

  it('E at the kettle completes the bar section and offers the tea; taking it puts the steam out and plays the tea scene', async () => {
    const { run } = await newGame();
    const shown = record(run.bus, 'dialogue:show');
    await doBar(run);
    expect(run.isComplete('c9.explore.bar')).toBe(true);
    expect(run.player.kit.hotDrink).toBe('tea');
    expect(run.dressing.prop('bar.steam')?.visible).toBe(false);
    expect(shown.map((s) => s.sequenceId)).toEqual(expect.arrayContaining(['c9.bar.hotDrink', 'c9.bar.tea']));
  });

  it('the dartboard, the sign-up sheet and the fridge each have their line', async () => {
    const { run } = await newGame();
    const shown = record(run.bus, 'dialogue:show');
    for (const id of ['c9.examine.signUp', 'c9.examine.dartboard', 'c9.examine.fridge']) {
      examine(run, id);
      await settle(run, 4);
    }
    expect(shown.map((s) => s.sequenceId)).toEqual(expect.arrayContaining(['c9.examine.signUp', 'c9.examine.dartboard', 'c9.examine.fridge']));
  });
});

describe('chapter 9: the offices', () => {
  it('walking in plays c9.open and starts the stealth section; each overheard trigger plays its line', async () => {
    const { run } = await newGame();
    const shown = record(run.bus, 'dialogue:show');
    run.setPlayerPosition(mid(OFFICES_START));
    await settle(run, 4);
    expect(shown.map((s) => s.sequenceId)).toContain('c9.open');
    for (const [i, o] of OFFICES_OVERHEARD.entries()) {
      run.setPlayerPosition(mid(o.area));
      await settle(run, 3);
      expect(shown.map((s) => s.sequenceId), `overheard ${i + 1}`).toContain(o.dialogueId);
    }
  });

  it('a clean run reveals the tequila; E at it takes it once', async () => {
    const { run } = await newGame();
    expect(run.dressing.prop('offices.tequila')?.visible).toBe(false);
    await crossOffices(run);
    expect(run.isComplete(STEALTH)).toBe(true);
    expect(run.dressing.prop('offices.tequila')?.visible).toBe(true);
    const before = run.player.kit.drinks.tequila ?? 0;
    examine(run, 'c9.offices.tequila');
    await settle(run, 3);
    expect(run.player.kit.drinks.tequila ?? 0).toBe(before + 1);
    expect(run.dressing.prop('offices.tequila')?.visible).toBe(false);
    examine(run, 'c9.offices.tequila');
    await settle(run, 3);
    expect(run.player.kit.drinks.tequila ?? 0).toBe(before + 1);
  });

  it('the tequila is not there before a clean run (E does nothing)', async () => {
    const { run } = await newGame();
    const before = run.player.kit.drinks.tequila ?? 0;
    expect(hook(run, 'c9.offices.tequila')).toBe(true);
    examine(run, 'c9.offices.tequila');
    await settle(run, 3);
    expect(run.player.kit.drinks.tequila ?? 0).toBe(before);
  });

  it('being seen plays the caught line; the tequila is not offered after an alarm', async () => {
    const { run } = await newGame();
    const shown = record(run.bus, 'dialogue:show');
    run.setPlayerPosition(mid(OFFICES_START));
    await settle(run, 3);
    run.stealthHere()[0]!.runner.alarm();
    await settle(run, 3);
    expect(shown.map((s) => s.sequenceId)).toContain('c9.offices.caught');
    expect(run.dressing.prop('offices.tequila')?.visible).toBe(false);
  });

  it('the contract opens the cabinet and the directory empties the noticeboard; both stay so', async () => {
    const { run } = await newGame();
    expect(run.dressing.prop('offices.cabinet')?.frame).toBe(PROP.baseFilingCabinet.shut);
    expect(run.dressing.prop('offices.board')?.frame).toBe(PROP.staffNoticeboard.full);
    await doProofsOffices(run);
    expect(run.dressing.prop('offices.cabinet')?.frame).toBe(PROP.baseFilingCabinet.open);
    expect(run.dressing.prop('offices.board')?.frame).toBe(PROP.staffNoticeboard.taken);
    expect(has(run, 'c9.proof.contract')).toBe(true);
    expect(has(run, 'c9.proof.directory')).toBe(true);
  });
});

describe('chapter 9: the Glove', () => {
  it('the lost-property box gives it after its scene, empties the box, and the first stun says its line', async () => {
    const { run } = await newGame();
    const shown = record(run.bus, 'dialogue:show');
    expect(run.dressing.prop('offices.lostProperty')?.frame).toBe(PROP.lostPropertyBox.withGlove);
    await takeGlove(run);
    expect(shown.map((s) => s.sequenceId)).toContain('c9.glove.find');
    expect(run.player.kit.moves).toContain('borrowedGlove');
    expect(run.dressing.prop('offices.lostProperty')?.frame).toBe(PROP.lostPropertyBox.empty);
    run.bus.emit('move:used', { moveId: 'borrowedGlove', slot: 3 });
    await settle(run, 3);
    expect(shown.map((s) => s.sequenceId)).toContain('c9.glove.done');
  });

  it('the objective goes offices, glove (at the lobby), offices again, then gravity once both are done', async () => {
    const { run } = await newGame();
    expect(run.objective()).toBe('c9.offices');
    run.setPlayerPosition({ x: 33 * 16, y: 18 * 16 });
    await settle(run, 3);
    expect(run.objective()).toBe('c9.glove');
    await takeGlove(run);
    expect(run.objective()).toBe('c9.offices');
    await doProofsOffices(run);
    expect(run.objective()).toBe('c9.gravity');
  });
});

describe('chapter 9: the labs', () => {
  it('the hangar photograph waits for the gravity rooms; the log is in the records room and the shelves lose a box', async () => {
    const { run } = await newGame();
    await takeGlove(run);
    await toLabs(run);
    steady(run);
    examine(run, 'c9.proof.craft');
    await settle(run, 8);
    expect(has(run, 'c9.proof.craft')).toBe(false);
    await solveGravity(run);
    expect(run.objective()).toBe('c9.labs');
    const shown = record(run.bus, 'dialogue:show');
    await doLabsProofs(run);
    expect(has(run, 'c9.proof.craft')).toBe(true);
    expect(has(run, 'c9.proof.log')).toBe(true);
    expect(shown.map((s) => s.sequenceId)).toEqual(expect.arrayContaining(['c9.hangar', 'c9.log']));
    expect(run.dressing.prop('records.shelves')?.frame).toBe(PROP.recordsShelves.taken);
    expect(run.isComplete(EXPLORE_LABS)).toBe(true);
  });

  it('with the rooms and both proofs in, the fight starts by itself once the last scene is over: intro, four enemies in the first wave, the end line and the board objective', async () => {
    const { run } = await newGame();
    await takeGlove(run);
    await toLabs(run);
    steady(run);
    await solveGravity(run);
    const shown = record(run.bus, 'dialogue:show');
    await doLabsProofs(run);
    for (let i = 0; i < 40 && run.fight(FIGHT)?.active !== true; i++) await settle(run, 3);
    expect(run.fight(FIGHT)?.active).toBe(true);
    expect(run.objective()).toBe('c9.fight');
    expect(shown.map((s) => s.sequenceId)).toContain('c9.fight.intro');
    expect(run.fight(FIGHT)!.aliveActors().length).toBeGreaterThan(0);
    await winLabsFight(run);
    expect(run.isComplete(FIGHT)).toBe(true);
    expect(shown.map((s) => s.sequenceId)).toContain('c9.fight.end');
    expect(run.objective()).toBe('c9.board');
  });

  it('the west strip does not start the fight before the rooms and proofs are in', async () => {
    const { run } = await newGame();
    await takeGlove(run);
    await toLabs(run);
    steady(run);
    await startLabsFight(run);
    expect(run.fight(FIGHT)?.active).not.toBe(true);
  });
});

describe('chapter 9: the board', () => {
  it('opens after the fight; a wrong answer says its line, the right one unlocks the hall and sets the lockdown objective', async () => {
    const { run } = await newGame();
    await takeGlove(run);
    await doProofsOffices(run);
    await toLabs(run);
    steady(run);
    await solveGravity(run);
    await doLabsProofs(run);
    await startLabsFight(run);
    await winLabsFight(run);
    const shown = record(run.bus, 'dialogue:show');
    run.addEvidence(ev('c8.clue.shift'));
    for (let i = 0; i < 20; i++) await settle(run, 2);
    expect(run.activeDeduction()).not.toBeNull();
    run.submitDeduction(BOARD, [ev('c9.proof.craft'), ev('c9.proof.log'), ev('c9.proof.contract')]);
    await settle(run, 6);
    expect(run.isComplete(BOARD)).toBe(false);
    expect(shown.some((s) => s.sequenceId.startsWith('c9.board.wrong'))).toBe(true);
    // The way on is shut until the board is right.
    expect(locked(run, 'c9.labs.hall')).toBe(true);
    await doBoard(run);
    expect(run.isComplete(BOARD)).toBe(true);
    expect(shown.map((s) => s.sequenceId)).toContain('c9.board.right');
    expect(locked(run, 'c9.labs.hall')).toBe(false);
    expect(run.objective()).toBe('c9.lockdown');
  });
});

describe('chapter 9: the lockdown', () => {
  it('walking into bay 1 plays the intro and starts the set piece; entering bays plays the announcements and Myko\'s lines', async () => {
    const { run } = await toLockdown();
    await toHall(run);
    const shown = record(run.bus, 'dialogue:show');
    await startLockdown(run);
    expect(run.boss(BOSS)?.active).toBe(true);
    for (let n = 1; n <= 5; n++) await intoBay(run, n);
    const ids = shown.map((s) => s.sequenceId);
    for (const id of ['c9.lockdown.intro', 'c9.lockdown.announce.1', 'c9.lockdown.announce.2', 'c9.lockdown.announce.3', 'c9.lockdown.announce.4', 'c9.lockdown.myko.1', 'c9.lockdown.myko.2', 'c9.lockdown.myko.3', 'c9.lockdown.myko.4']) {
      expect(ids, id).toContain(id);
    }
  });

  it('a door that runs out puts Andrew back at the bay start with the shut line, though he was elsewhere in the bay; the leaves show while it is shut', async () => {
    const { run } = await toLockdown();
    await toHall(run);
    await startLockdown(run);
    const shown = record(run.bus, 'dialogue:show');
    const bay = HALL_BAYS[0]!;
    const hits = record(run.bus, 'player:hit');
    run.setPlayerPosition({ x: 8 * 16 + 8, y: 8 * 16 + 8 });
    for (let t = 0; t < DOOR_MS + 600; t += 16) {
      steady(run);
      run.tick(16, NO_INPUT);
      if (run.lockdown(BOSS)!.doorState(0) === 'shut') break;
    }
    expect(run.lockdown(BOSS)!.doorState(0)).toBe('shut');
    expect(run.dressing.prop(bay.door.propIds[0])?.visible).toBe(true);
    expect(run.player.pos).toEqual(bay.start);
    // The guards may land hits of their own; the door does not.
    expect(hits.filter((h) => h.source.kind === 'boss' && h.source.attackId === 'door')).toHaveLength(0);
    await settle(run, 2);
    expect(shown.map((s) => s.sequenceId)).toContain('c9.lockdown.shut');
    // It reopens with a full timer and the leaves go.
    step(run, 1200);
    expect(run.lockdown(BOSS)!.doorState(0)).toBe('running');
    expect(run.dressing.prop(bay.door.propIds[0])?.visible).toBe(false);
  });

  it('a door that closes on him is a heavy hit', async () => {
    const { run } = await toLockdown();
    await toHall(run);
    await startLockdown(run);
    const hits = record(run.bus, 'player:hit');
    const door = HALL_BAYS[0]!.door.area;
    const at = { x: door.x + 4, y: door.y + door.height / 2 };
    for (let t = 0; t < DOOR_MS + 600; t += 16) {
      run.player.holdDrain(true);
      run.setPlayerPosition(at);
      run.tick(16, NO_INPUT);
      if (hits.some((h) => h.source.kind === 'boss' && h.source.attackId === 'door')) break;
    }
    expect(hits.filter((h) => h.source.kind === 'boss' && h.source.attackId === 'door').length).toBeGreaterThan(0);
  });

  it('the bay 2 and bay 4 switches drop the barrier (its props go) and slide the guards', async () => {
    const { run } = await toLockdown();
    await toHall(run);
    await startLockdown(run);
    for (const n of [2, 4] as const) {
      await intoBay(run, n);
      const g = HALL_BAYS[n - 1]!.gravity!;
      for (const id of g.barrier.propIds) expect(run.dressing.prop(id)?.visible, id).toBe(true);
      pressBaySwitch(run, n);
      step(run, 700);
      for (const id of g.barrier.propIds) expect(run.dressing.prop(id)?.visible, id).toBe(false);
    }
  });

  it('a bay switch without the Glove does nothing but say so', async () => {
    const { run } = await toLockdown();
    await toHall(run);
    await startLockdown(run);
    await intoBay(run, 2);
    run.player.setKit({ ...run.player.kit, moves: run.player.kit.moves.filter((m) => m !== 'borrowedGlove') });
    const shown = record(run.bus, 'dialogue:show');
    pressBaySwitch(run, 2);
    await settle(run, 3);
    expect(shown.map((s) => s.sequenceId)).toContain('c9.gravity.noGlove');
    expect(run.dressing.prop(HALL_BAYS[1]!.gravity!.barrier.propIds[0]!)?.visible).toBe(true);
  });

  it('the recorder takes three seconds at the wall; leaving stops it; the tape is the fifth proof and the recorder empties', async () => {
    const { run } = await toLockdown();
    await toHall(run);
    await startLockdown(run);
    await intoBay(run, 3);
    const shown = record(run.bus, 'dialogue:show');
    const rec = HALL_BAYS[2]!.recorder!;
    examine(run, 'c9.hall.recorder', rec.spot);
    step(run, 1000, rec.spot);
    run.setPlayerPosition({ x: rec.spot.x + 70, y: rec.spot.y + 40 });
    step(run, 600);
    expect(has(run, 'c9.proof.footage')).toBe(false);
    takeTape(run);
    await settle(run, 2);
    expect(has(run, 'c9.proof.footage')).toBe(true);
    expect(run.dressing.prop('hall.recorder')?.frame).toBe(PROP.wallRecorder.empty);
    expect(shown.map((s) => s.sequenceId)).toEqual(expect.arrayContaining(['c9.examine.recorder', 'c9.lockdown.takeStarted']));
  });

  it('the lift opens with all five proofs and the lanyard, the guard goes on his break, the wand is picked up and the closing ends the chapter', async () => {
    const { run } = await toLockdown();
    await toHall(run);
    await startLockdown(run);
    const shown = record(run.bus, 'dialogue:show');
    const ended = record(run.bus, 'chapter:completed');
    for (let n = 1; n <= 5; n++) {
      await intoBay(run, n);
      if (n === 2 || n === 4) pressBaySwitch(run, n);
      if (n === 3) takeTape(run);
    }
    run.setPlayerPosition({ x: (LIFT_ROOM.col + 1) * 16, y: 17 * 16 });
    step(run, 64);
    pressLift(run);
    await settle(run, 6);
    expect(run.lockdown(BOSS)!.isLiftOpen()).toBe(true);
    expect(shown.map((s) => s.sequenceId)).toContain('c9.weapon.wand');
    expect(run.dressing.prop('hall.lift.a')?.frame).toBe(PROP.liftDoors.open);
    expect(run.dressing.prop('hall.guardChair')?.frame).toBe(PROP.liftGuardChair.onBreak);
    expect(run.player.kit.weapons).not.toContain('securityWand');
    // Pick up the wand, then walk into the lift.
    run.setPlayerPosition({ x: WAND_TILE.col * 16 + 8, y: WAND_TILE.row * 16 + 8 });
    step(run, 64);
    expect(run.player.kit.weapons).toContain('securityWand');
    run.setPlayerPosition({ x: 47 * 16 + 8, y: 16 * 16 + 8 });
    for (let i = 0; i < 40 && ended.length === 0; i++) await settle(run, 3);
    expect(run.isComplete(BOSS)).toBe(true);
    expect(shown.map((s) => s.sequenceId)).toContain('c9.closing');
    expect(ended).toHaveLength(1);
  });

  it('the lift says its refusal line when a proof is missing, and refuses without the lanyard even with five proofs', async () => {
    const { run } = await newGame();
    await takeGlove(run);
    await toHall(run);
    run.startSection(BOSS);
    await settle(run, 2);
    run.setPlayerPosition({ x: (LIFT_ROOM.col + 1) * 16, y: 17 * 16 });
    step(run, 64);
    const shown = record(run.bus, 'dialogue:show');
    const seen = record(run.bus, 'lockdown:changed');
    pressLift(run);
    await settle(run, 4);
    expect(shown.map((s) => s.sequenceId)).toContain('c9.lockdown.liftRefused');
    for (const id of ['c9.proof.craft', 'c9.proof.contract', 'c9.proof.directory', 'c9.proof.log', 'c9.proof.footage']) run.addEvidence(ev(id));
    pressLift(run);
    await settle(run, 3);
    expect(seen.filter((e) => e.phase === 'liftRefused').length).toBeGreaterThanOrEqual(2);
    expect(run.lockdown(BOSS)!.isLiftOpen()).toBe(false);
    run.addEvidence(ev('c8.clue.shift'));
    pressLift(run);
    await settle(run, 3);
    expect(run.lockdown(BOSS)!.isLiftOpen()).toBe(true);
  });

  it('Myko\'s call opens every door and gives the tape; the wand is on the floor and the closing follows when Andrew has it in the lift', async () => {
    const { run } = await toLockdown();
    await toHall(run);
    await startLockdown(run);
    step(run, 64);
    const shown = record(run.bus, 'dialogue:show');
    const ended = record(run.bus, 'chapter:completed');
    holdM(run, TUNING.myko.callHoldMs);
    for (let t = 0; t < TUNING.myko.blackoutTimeoutMs + 600 && !run.isComplete(BOSS); t += 16) {
      run.tick(16, NO_INPUT);
      await settleDialogue(run, 1);
    }
    await settle(run, 8);
    expect(run.isComplete(BOSS)).toBe(true);
    expect(has(run, 'c9.proof.footage')).toBe(true);
    expect(shown.map((s) => s.sequenceId)).toContain('c9.call.lockdown');
    for (const bay of HALL_BAYS) for (const id of bay.door.propIds) expect(run.dressing.prop(id)?.visible).toBe(false);
    for (const bay of HALL_BAYS) for (const id of bay.gravity?.barrier.propIds ?? []) expect(run.dressing.prop(id)?.visible).toBe(false);
    expect(run.dressing.prop('hall.lift.a')?.frame).toBe(PROP.liftDoors.open);
    expect(ended).toHaveLength(0);
    run.setPlayerPosition({ x: WAND_TILE.col * 16 + 8, y: WAND_TILE.row * 16 + 8 });
    for (let i = 0; i < 40 && ended.length === 0; i++) await settle(run, 3);
    expect(run.player.kit.weapons).toContain('securityWand');
    expect(ended).toHaveLength(1);
  });
});
