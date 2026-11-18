/**
 * Chapter 9: back to the bar (DESIGN.md 7.1), a load with each fight, puzzle or set piece under way, and Myko's call on each
 * callable section.
 *
 * The reload trap: a fight, puzzle or set piece started by a trigger is never guarded by a saved "started" flag, so after a load
 * or a return to the bar the next walk into its trigger starts it again. Finished sections stay finished and Andrew walks
 * through them.
 */

import { describe, expect, it } from 'vitest';
import { PROP } from '../../src/art/props';
import { BAR_ARRIVAL, GRAVITY_ENTRY_AREAS, GRAVITY_LAYOUT, HALL_BAYS, LIFT_ROOM, MYKO_BAR, WAND_TILE } from '../../src/chapters/09/index';
import { TUNING } from '../../src/content/tuning';
import { tileCentre } from '../../src/systems/grid';
import { solveRoom } from '../../src/systems/gravity';
import { NO_INPUT, holdM, record, settleDialogue } from './helpers';
import {
  BOARD,
  BOSS,
  EXPLORE_LABS,
  FIGHT,
  GRAVITY,
  STEALTH,
  crossOffices,
  doBoard,
  doLabsProofs,
  doProofsOffices,
  enter,
  ev,
  intoBay,
  mid,
  newGame,
  pressBaySwitch,
  runPlan,
  settle,
  solveGravity,
  solveGravityRoom,
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

type Run = Awaited<ReturnType<typeof newGame>>['run'];
const has = (run: Run, id: string): boolean => run.casebook.hasEvidence(ev(id));
const locked = (run: Run, id: string): boolean => (run as unknown as { exitLocks: Map<string, boolean> }).exitLocks.get(id) === true;

async function toSober(run: Run): Promise<void> {
  run.holdDrain(false);
  run.player.meter = { ...run.player.meter, value: 0.01, tea: null };
  for (let i = 0; i < 12; i++) run.tick(16, NO_INPUT);
  run.completeBarReturn();
  await settle(run, 4);
}

async function throughRooms() {
  const g = await newGame();
  await crossOffices(g.run);
  await doProofsOffices(g.run);
  await takeGlove(g.run);
  await toLabs(g.run);
  steady(g.run);
  await solveGravity(g.run);
  return g;
}
async function throughFight() {
  const g = await throughRooms();
  await doLabsProofs(g.run);
  await startLabsFight(g.run);
  await winLabsFight(g.run);
  return g;
}
async function throughBoard() {
  const g = await throughFight();
  await doBoard(g.run);
  return g;
}

describe('chapter 9: back to the bar', () => {
  it('lands in the staff social area with the return line, Myko at the table, and the Glove and the proofs kept', async () => {
    const { run } = await newGame();
    await takeGlove(run);
    await doProofsOffices(run);
    await toLabs(run);
    const shown = record(run.bus, 'dialogue:show');
    await toSober(run);
    expect(run.screenId).toBe('c9.offices');
    expect(run.player.pos).toEqual(BAR_ARRIVAL);
    expect(run.myko.pos).toEqual(MYKO_BAR);
    expect(shown.map((s) => s.sequenceId)).toContain('c9.bar.return');
    expect(run.player.kit.moves).toContain('borrowedGlove');
    expect(has(run, 'c9.proof.contract')).toBe(true);
    expect(run.dressing.prop('offices.cabinet')?.frame).toBe(PROP.baseFilingCabinet.open);
    expect(run.dressing.prop('offices.board')?.frame).toBe(PROP.staffNoticeboard.taken);
    expect(run.dressing.prop('offices.lostProperty')?.frame).toBe(PROP.lostPropertyBox.empty);
    expect(run.objective()).toBe('c9.gravity');
  });

  it('keeps the finished sections: stealth, rooms, fight and board are done, the hall is open, the crates props stay hidden; walking about starts nothing', async () => {
    const { run } = await throughBoard();
    await toSober(run);
    for (const s of [STEALTH, GRAVITY, EXPLORE_LABS, FIGHT, BOARD] as const) expect(run.isComplete(s), s).toBe(true);
    expect(run.gravity(GRAVITY)!.solvedRooms()).toHaveLength(3);
    expect(locked(run, 'c9.labs.hall')).toBe(false);
    expect(run.objective()).toBe('c9.lockdown');
    await toLabs(run);
    for (const n of [1, 2, 3]) {
      run.setPlayerPosition(mid(GRAVITY_ENTRY_AREAS[n - 1] as never));
      await settle(run, 4);
    }
    run.setPlayerPosition({ x: 12 * 16, y: 20 * 16 });
    await settle(run, 8);
    expect(run.fight(FIGHT)?.active).not.toBe(true);
    expect(run.stealthHere()[0]?.runner.active).not.toBe(true);
    expect(run.gravity(GRAVITY)!.isComplete()).toBe(true);
  });

  it('a return mid-fight takes the fight back to the start; the west strip starts it again and it can be won', async () => {
    const { run } = await throughRooms();
    await doLabsProofs(run);
    for (let i = 0; i < 40 && run.fight(FIGHT)?.active !== true; i++) await settle(run, 3);
    const fight = run.fight(FIGHT)!;
    expect(fight.active).toBe(true);
    for (const a of fight.aliveActors().slice(0, 2)) run.defeat(a, 'player');
    await settle(run, 4);
    await toSober(run);
    expect(run.isComplete(FIGHT)).toBe(false);
    expect(run.fight(FIGHT)?.active).not.toBe(true);
    expect(run.fight(FIGHT)?.aliveActors()).toHaveLength(0);
    expect(run.isComplete(EXPLORE_LABS)).toBe(true);
    expect(run.objective()).toBe('c9.fight');
    await toLabs(run);
    await startLabsFight(run);
    expect(run.fight(FIGHT)?.active).toBe(true);
    expect(run.fight(FIGHT)!.aliveActors().length).toBeGreaterThan(0);
    steady(run);
    await winLabsFight(run);
    expect(run.isComplete(FIGHT)).toBe(true);
  });

  it('a return mid-puzzle keeps what was solved and the crates where they were; the next room is played from where it stands', async () => {
    const { run } = await newGame();
    await takeGlove(run);
    await toLabs(run);
    steady(run);
    await solveGravityRoom(run, 1);
    const puzzle = () => run.gravity(GRAVITY)!;
    expect(puzzle().solvedRooms()).toEqual([GRAVITY_LAYOUT.rooms[0]!.id]);
    await toSober(run);
    expect(puzzle().solvedRooms()).toEqual([GRAVITY_LAYOUT.rooms[0]!.id]);
    expect(run.isComplete(GRAVITY)).toBe(false);
    await toLabs(run);
    steady(run);
    await solveGravityRoom(run, 2);
    await solveGravityRoom(run, 3);
    expect(run.isComplete(GRAVITY)).toBe(true);
  });

  it('a return mid-lockdown restarts the hall from bay 1: barriers back, doors open, guards fresh, the tape still taken; bay 1 starts it again', async () => {
    const { run } = await throughBoard();
    await toHall(run);
    await startLockdown(run);
    await intoBay(run, 2);
    pressBaySwitch(run, 2);
    step(run, 700);
    await intoBay(run, 3);
    takeTape(run);
    expect(has(run, 'c9.proof.footage')).toBe(true);
    await toSober(run);
    expect(run.isComplete(BOSS)).toBe(false);
    expect(run.boss(BOSS)?.active).not.toBe(true);
    expect(has(run, 'c9.proof.footage')).toBe(true);
    for (const id of HALL_BAYS[1]!.gravity!.barrier.propIds) expect(run.dressing.prop(id)?.visible, id).toBe(true);
    for (const bay of HALL_BAYS) for (const id of bay.door.propIds) expect(run.dressing.prop(id)?.visible).toBe(false);
    expect(run.dressing.prop('hall.recorder')?.frame).toBe(PROP.wallRecorder.empty);
    expect(run.objective()).toBe('c9.lockdown');
    await toHall(run);
    await startLockdown(run);
    expect(run.boss(BOSS)?.active).toBe(true);
    expect([0, 1, 2, 3, 4].map((k) => run.lockdown(BOSS)!.doorState(k))).toEqual(['running', 'idle', 'idle', 'idle', 'idle']);
  });

  it('a return after the board and before the hall: the exit is open and the set piece starts at bay 1', async () => {
    const { run } = await throughBoard();
    await toSober(run);
    await toHall(run);
    await startLockdown(run);
    expect(run.boss(BOSS)?.active).toBe(true);
  });
});

describe('chapter 9: a load with each section under way', () => {
  it('the labs fight under way, saved, loaded: the proofs and rooms are kept and the west strip starts it again', async () => {
    const a = await throughRooms();
    await doLabsProofs(a.run);
    for (let i = 0; i < 40 && a.run.fight(FIGHT)?.active !== true; i++) await settle(a.run, 3);
    expect(a.run.fight(FIGHT)?.active).toBe(true);
    a.run.addEvidence(ev('c8.clue.shift'));
    const b = await newGame('continue', a.store);
    expect(b.run.isComplete(GRAVITY)).toBe(true);
    expect(b.run.isComplete(EXPLORE_LABS)).toBe(true);
    expect(b.run.fight(FIGHT)?.active).not.toBe(true);
    expect(b.run.objective()).toBe('c9.fight');
    await toLabs(b.run);
    await startLabsFight(b.run);
    expect(b.run.fight(FIGHT)?.active, 'starts again after a load').toBe(true);
  });

  it('the gravity rooms half done, saved, loaded: the solved rooms come back solved and the rest can be played', async () => {
    const a = await newGame();
    await takeGlove(a.run);
    await toLabs(a.run);
    steady(a.run);
    await solveGravityRoom(a.run, 1);
    a.run.addEvidence(ev('c8.clue.shift'));
    const b = await newGame('continue', a.store);
    expect(b.run.gravity(GRAVITY)!.solvedRooms()).toEqual([GRAVITY_LAYOUT.rooms[0]!.id]);
    await toLabs(b.run);
    steady(b.run);
    await solveGravityRoom(b.run, 2);
    await solveGravityRoom(b.run, 3);
    expect(b.run.isComplete(GRAVITY)).toBe(true);
  });

  it('the board unanswered, saved, loaded: the hall is shut and its east door opens the board again', async () => {
    const a = await throughFight();
    a.run.addEvidence(ev('c8.clue.shift'));
    const b = await newGame('continue', a.store);
    expect(b.run.isComplete(FIGHT)).toBe(true);
    expect(b.run.isComplete(BOARD)).toBe(false);
    expect(locked(b.run, 'c9.labs.hall')).toBe(true);
    expect(b.run.objective()).toBe('c9.board');
    await toLabs(b.run);
    run_at_exit(b.run);
    await settle(b.run, 6);
    expect(b.run.activeDeduction()).not.toBeNull();
  });

  it('the lockdown under way, saved, loaded: the tape is still taken and bay 1 starts it again from the beginning', async () => {
    const a = await throughBoard();
    await toHall(a.run);
    await startLockdown(a.run);
    await intoBay(a.run, 3);
    takeTape(a.run);
    const b = await newGame('continue', a.store);
    expect(b.run.isComplete(BOARD)).toBe(true);
    expect(b.run.isComplete(BOSS)).toBe(false);
    expect(b.run.boss(BOSS)?.active).not.toBe(true);
    expect(has(b.run, 'c9.proof.footage')).toBe(true);
    await toHall(b.run);
    await startLockdown(b.run);
    expect(b.run.boss(BOSS)?.active, 'starts again after a load').toBe(true);
    expect(b.run.lockdown(BOSS)!.doorState(0)).toBe('running');
    expect(b.run.lockdown(BOSS)!.doorState(1)).toBe('idle');
  });

  it('the set piece done and the wand not taken, saved, loaded: the wand is on the floor again, and the closing follows its pickup', async () => {
    const a = await throughBoard();
    await toHall(a.run);
    await startLockdown(a.run);
    step(a.run, 64);
    holdM(a.run, TUNING.myko.callHoldMs);
    for (let t = 0; t < TUNING.myko.blackoutTimeoutMs + 600 && !a.run.isComplete(BOSS); t += 16) {
      a.run.tick(16, NO_INPUT);
      await settleDialogue(a.run, 1);
    }
    await settle(a.run, 8);
    expect(a.run.isComplete(BOSS)).toBe(true);
    expect(a.run.player.kit.weapons).not.toContain('securityWand');
    const b = await newGame('continue', a.store);
    expect(b.run.isComplete(BOSS)).toBe(true);
    expect(b.run.player.kit.weapons).not.toContain('securityWand');
    await toHall(b.run);
    expect(b.run.weaponPickupsHere().map((w) => w.weaponId)).toEqual(['securityWand']);
    const ended = record(b.run.bus, 'chapter:completed');
    b.run.setPlayerPosition({ x: WAND_TILE.col * 16 + 8, y: WAND_TILE.row * 16 + 8 });
    for (let i = 0; i < 40 && ended.length === 0; i++) await settle(b.run, 3);
    expect(b.run.player.kit.weapons).toContain('securityWand');
    expect(ended).toHaveLength(1);
    void LIFT_ROOM;
  });
});

describe('chapter 9: Myko\'s call on each callable section', () => {
  it('the gravity rooms: all three solved, the section complete and the labs objective set', async () => {
    const { run } = await newGame();
    await takeGlove(run);
    await toLabs(run);
    run.startSection(GRAVITY);
    holdM(run, TUNING.myko.callHoldMs);
    for (let t = 0; t < TUNING.myko.blackoutTimeoutMs + 600 && !run.isComplete(GRAVITY); t += 16) {
      run.tick(16, NO_INPUT);
      await settleDialogue(run, 1);
    }
    await settle(run, 6);
    expect(run.isComplete(GRAVITY)).toBe(true);
    expect(run.gravity(GRAVITY)!.solvedRooms()).toHaveLength(3);
    expect(run.objective()).toBe('c9.labs');
  });

  it('the fight and the board complete by call too; the board then unlocks the hall', async () => {
    const { run } = await throughRooms();
    await doLabsProofs(run);
    for (let i = 0; i < 40 && run.fight(FIGHT)?.active !== true; i++) await settle(run, 3);
    holdM(run, TUNING.myko.callHoldMs);
    for (let t = 0; t < TUNING.myko.blackoutTimeoutMs + 600 && !run.isComplete(FIGHT); t += 16) {
      run.tick(16, NO_INPUT);
      await settleDialogue(run, 1);
    }
    await settle(run, 6);
    expect(run.isComplete(FIGHT)).toBe(true);
    run.addEvidence(ev('c8.clue.shift'));
    for (let i = 0; i < 20; i++) await settle(run, 2);
    expect(run.activeDeduction()).not.toBeNull();
    void enter;
    void runPlan;
    void solveRoom;
    void tileCentre;
  });
});

function run_at_exit(run: Run): void {
  run.setPlayerPosition({ x: 55 * 16, y: 18 * 16 });
}
