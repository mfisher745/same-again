/**
 * Chapter 5 piece by piece: the bar, the lobby and its caught path, Act Natural, the floor stealth, the files, the redaction
 * puzzle (right and wrong picks), the copier, Lock-in, the cubicle fight and the board.
 */

import { describe, expect, it } from 'vitest';
import { PROP } from '../../src/art/props';
import { LOBBY_FROM_BAR, LOBBY_HIDING, MEMO_SPOT, T } from '../../src/chapters/05/maps';
import type { EvidenceId } from '../../src/core/types';
import { createMeter, levelTable } from '../../src/systems/meter';
import { frame, record } from './helpers';
import {
  BOARD,
  FIGHT,
  PUZZLE,
  crossFloor,
  crossLobby,
  examine,
  gatherFiles,
  jamCopier,
  mid,
  newGame,
  settle,
  solveBoard,
  solveRedaction,
  toFloor,
  toLobby,
  toQueue,
  toTheBoard,
  winFight,
} from './chapter5-steps';

const ev = (id: string): EvidenceId => id as EvidenceId;
const held = (run: Awaited<ReturnType<typeof newGame>>['run']): string => JSON.stringify(run.snapshot().casebook);

describe('chapter 5: the bar', () => {
  it('opens on the marked spot with the steam up and the objective set; the barman offers the hot drink', async () => {
    const { run } = await newGame();
    const shown = record(run.bus, 'dialogue:show');
    expect(run.objective()).toBe('c5.lobby');
    expect(run.dressing.prop('bar.steam')?.visible).toBe(true);
    examine(run, 'c5.tea');
    await settle(run, 4);
    expect(shown.map((s) => s.sequenceId)).toContain('c5.bar.hotDrink');
  });
});

describe('chapter 5: the lobby', () => {
  it('c5.open plays on arrival; the bar section is done and the guard is on his route', async () => {
    const { run } = await newGame();
    const shown = record(run.bus, 'dialogue:show');
    await toLobby(run);
    expect(shown.map((s) => s.sequenceId)).toEqual(expect.arrayContaining(['c5.caption.lobby', 'c5.open']));
    expect(run.isComplete('c5.explore.bar')).toBe(true);
    expect(run.objective()).toBe('c5.lobby');
    expect(run.player.pos).toEqual(LOBBY_FROM_BAR);
  });

  it('the Act Natural lesson plays at the queue, once: the move is learned and the guard looks through him', async () => {
    const { run } = await newGame();
    await toLobby(run);
    const shown = record(run.bus, 'dialogue:show');
    await toQueue(run);
    expect(shown.filter((s) => s.sequenceId === 'c5.actNatural.lesson')).toHaveLength(1);
    expect(run.player.kit.moves).toContain('actNatural');
    await toQueue(run);
    expect(shown.filter((s) => s.sequenceId === 'c5.actNatural.lesson')).toHaveLength(1);
    // Beside a hiding prop, still: Act Natural, and "he looked right through you".
    const queue = LOBBY_HIDING.find((h) => h.kind === 'queue')!;
    run.assignMove(1, 'actNatural');
    run.setPlayerPosition({ x: queue.position.x, y: queue.position.y + 8 });
    run.player.meter = { ...run.player.meter, value: Math.max(run.player.meter.value, 0.2) };
    run.tick(16, frame({ pressed: ['special1'] }));
    await settle(run, 4);
    expect(shown.map((s) => s.sequenceId)).toContain('c5.actNatural.done');
  });

  it('walking round the queue and on past it still gets the lesson before the guard matters', async () => {
    const { run } = await newGame();
    await toLobby(run);
    run.setPlayerPosition(T(30, 10));
    for (let i = 0; i < 40; i++) {
      run.tick(16, frame());
      await settle(run, 1);
    }
    expect(run.player.kit.moves).toContain('actNatural');
  });

  it('caught: the guard plus one agent (c5.stealth.lobby.alarm), the line plays, and the section is done when they are down', async () => {
    const { run } = await newGame();
    await toLobby(run);
    await toQueue(run);
    run.setPlayerPosition(mid({ x: 4 * 16, y: 4 * 16, width: 16, height: 16 }));
    await settle(run, 3);
    const shown = record(run.bus, 'dialogue:show');
    run.stealth('c5.stealth.lobby')!.alarm();
    await settle(run, 4);
    expect(shown.map((s) => s.sequenceId)).toContain('c5.lobby.caught');
    const fight = run.fight('c5.stealth.lobby.alarm' as never)!;
    expect(fight.aliveActors()).toHaveLength(2);
    expect(fight.aliveActors().every((a) => a.enemyId === 'agent')).toBe(true);
    for (let i = 0; i < 40 && !fight.isComplete(); i++) {
      for (const a of fight.aliveActors()) run.defeat(a, 'player');
      await settle(run, 8);
    }
    expect(fight.isComplete()).toBe(true);
    expect(run.isComplete('c5.stealth.lobby')).toBe(true);
    expect(run.isComplete('c5.explore.lobby')).toBe(true);
    expect(run.objective()).toBe('c5.floor');
  });

  it('the ticket machine says it is serving 13 now (and may be asked again)', async () => {
    const { run } = await newGame();
    await toLobby(run);
    const shown = record(run.bus, 'dialogue:show');
    examine(run, 'c5.ticket');
    await settle(run, 3);
    examine(run, 'c5.ticket');
    await settle(run, 3);
    expect(shown.filter((s) => s.sequenceId === 'c5.examine.ticket')).toHaveLength(2);
  });

  it('the noticeboard gives the retirement clue', async () => {
    const { run } = await newGame();
    await toLobby(run);
    examine(run, 'c5.retirement');
    await settle(run, 2);
    expect(held(run)).toContain('c5.clue.retirement');
  });
});

describe('chapter 5: the records floor', () => {
  it('the overheard lines play only while the stealth is under way, and a clean run reveals the memo', async () => {
    const { run } = await newGame();
    await toLobby(run);
    await toQueue(run);
    await crossFloorFromLobby(run);
    const shown = record(run.bus, 'dialogue:show');
    expect(run.dressing.prop('memo')?.visible).toBe(false);
    examine(run, 'c5.memo');
    await settle(run, 2);
    expect(held(run)).not.toContain('c5.clue.memo');
    for (const n of [1, 2, 3, 4, 5]) {
      const t = run.module.triggers.find((x) => x.id === `c5.trig.over${n}`)!;
      run.setPlayerPosition({ x: t.area.x - 200, y: t.area.y });
      await settle(run, 1);
      run.setPlayerPosition(mid(t.area));
      await settle(run, 4);
    }
    expect(shown.map((s) => s.sequenceId).filter((s) => s.startsWith('c5.floor.overheard'))).toHaveLength(5);
    await crossFloor(run);
    expect(run.isComplete('c5.stealth.floor')).toBe(true);
    expect(shown.map((s) => s.sequenceId)).toContain('c5.floor.clean');
    expect(run.dressing.prop('memo')?.visible).toBe(true);
    expect(run.objective()).toBe('c5.files');
    run.setPlayerPosition(MEMO_SPOT);
    examine(run, 'c5.memo');
    await settle(run, 2);
    expect(held(run)).toContain('c5.clue.memo');
    expect(run.dressing.prop('memo')?.visible).toBe(false);
  });

  it('caught on the floor: the line plays, no memo, and the alarm fight finishes the section', async () => {
    const { run } = await newGame();
    await toFloor(run);
    run.setPlayerPosition(mid(run.module.stealth.find((s) => s.sectionId === 'c5.stealth.floor')!.startArea!));
    await settle(run, 3);
    const shown = record(run.bus, 'dialogue:show');
    run.stealth('c5.stealth.floor')!.alarm();
    await settle(run, 4);
    expect(shown.map((s) => s.sequenceId)).toContain('c5.floor.caught');
    const fight = run.fight('c5.stealth.floor.alarm' as never)!;
    for (let i = 0; i < 60 && !fight.isComplete(); i++) {
      for (const a of fight.aliveActors()) run.defeat(a, 'player');
      await settle(run, 8);
    }
    expect(run.isComplete('c5.stealth.floor')).toBe(true);
    expect(run.dressing.prop('memo')?.visible).toBe(false);
    expect(run.flag('floor.clean')).not.toBe(true);
  });

  it('louder footsteps at Bit much get the Myko line, on the floor stealth only', async () => {
    const { run } = await newGame();
    await toFloor(run);
    run.setPlayerPosition(mid(run.module.stealth.find((s) => s.sectionId === 'c5.stealth.floor')!.startArea!));
    await settle(run, 3);
    const shown = record(run.bus, 'dialogue:show');
    run.bus.emit('buzz:levelChanged', { from: 2, to: 3, state: 'bitMuch' as never, value: 0.7 });
    await settle(run, 3);
    expect(shown.map((s) => s.sequenceId)).toContain('c5.floor.loud');
  });
});

/** From the lobby straight to the floor by the Staff door (a clean lobby). */
async function crossFloorFromLobby(run: Awaited<ReturnType<typeof newGame>>['run']): Promise<void> {
  await crossLobby(run);
  await toFloor(run);
  run.setPlayerPosition(mid(run.module.stealth.find((s) => s.sectionId === 'c5.stealth.floor')!.startArea!));
  await settle(run, 3);
}

describe('chapter 5: the files and the lightbox', () => {
  async function onFloor() {
    const g = await newGame();
    await toFloor(g.run);
    await crossFloor(g.run);
    return g;
  }

  it('each sheet is taken once and its prop goes; the files section is done with five sheets, the requisition and the bus claim', async () => {
    const { run } = await onFloor();
    for (const n of [1, 2, 3, 4, 5]) expect(run.dressing.prop(`sheet.${n}`)?.visible).toBe(true);
    examine(run, 'c5.sheet.2');
    examine(run, 'c5.sheet.2');
    await settle(run, 3);
    expect(run.dressing.prop('sheet.2')?.visible).toBe(false);
    expect(run.redaction(PUZZLE)!.collected()).toEqual(['sheet2']);
    examine(run, 'c5.requisition');
    examine(run, 'c5.busticket');
    await settle(run, 4);
    expect(run.isComplete('c5.explore.files')).toBe(false);
    for (const n of [1, 3, 4, 5]) examine(run, `c5.sheet.${n}`);
    await settle(run, 6);
    expect(run.isComplete('c5.explore.files')).toBe(true);
    expect(run.objective()).toBe('c5.redacted');
    expect(held(run)).toContain('c5.clue.requisition');
    expect(held(run)).toContain('c5.clue.busticket');
  });

  it('the lightbox with too few sheets only says so; with all five it opens the pick screen', async () => {
    const { run } = await onFloor();
    const shown = record(run.bus, 'dialogue:show');
    examine(run, 'c5.sheet.1');
    await settle(run, 3);
    examine(run, 'c5.lightbox');
    await settle(run, 4);
    expect(shown.map((s) => s.sequenceId)).toContain('c5.examine.lightbox');
    expect(run.activeRedaction()).toBeNull();
    await gatherFiles(run);
    examine(run, 'c5.lightbox');
    await settle(run, 6);
    expect(shown.map((s) => s.sequenceId)).toContain('c5.redacted.intro');
    expect(run.activeRedaction()?.view().sheets.filter((s) => s.collected)).toHaveLength(5);
  });

  it('a wrong set shows the useless sentence, costs nothing and gives no clue; the right three solve it and give the line', async () => {
    const { run } = await onFloor();
    await gatherFiles(run);
    const shown = record(run.bus, 'dialogue:show');
    const tried = record(run.bus, 'redaction:tried');
    const wrong = await solveRedaction(run, ['sheet1', 'sheet2', 'sheet3']);
    await settle(run, 4);
    expect(wrong).toEqual({ correct: false, textId: 'c5.redacted.wrong', refused: false });
    expect(run.isComplete(PUZZLE)).toBe(false);
    expect(held(run)).not.toContain('c5.clue.site');
    expect(shown.map((s) => s.sequenceId)).toContain('c5.redacted.wrongLine');
    // Another wrong set, in another order, and a set with a repeat.
    expect((await solveRedaction(run, ['sheet5', 'sheet2', 'sheet4'])).correct).toBe(false);
    expect(run.submitRedaction(PUZZLE, ['sheet1', 'sheet1', 'sheet3']).refused).toBe(true);
    expect(run.activeRedaction()).not.toBeNull();
    const right = run.submitRedaction(PUZZLE, ['sheet4', 'sheet1', 'sheet3']);
    await settle(run, 8);
    expect(right).toEqual({ correct: true, textId: 'c5.redacted.right', refused: false });
    expect(tried.map((t) => t.correct)).toEqual([false, false, true]);
    expect(run.isComplete(PUZZLE)).toBe(true);
    expect(run.activeRedaction()).toBeNull();
    expect(held(run)).toContain('c5.clue.site');
    expect(shown.map((s) => s.sequenceId)).toContain('c5.redacted.solved');
  });

  it('stepping back shuts the screen without trying; E opens it again', async () => {
    const { run } = await onFloor();
    await gatherFiles(run);
    examine(run, 'c5.lightbox');
    await settle(run, 6);
    expect(run.activeRedaction()).not.toBeNull();
    run.closeRedaction();
    expect(run.activeRedaction()).toBeNull();
    examine(run, 'c5.lightbox');
    await settle(run, 4);
    expect(run.activeRedaction()).not.toBeNull();
    expect(run.isComplete(PUZZLE)).toBe(false);
  });

  it('Myko\'s call on the puzzle gives the same clue and skips the scene', async () => {
    const { run } = await onFloor();
    await gatherFiles(run);
    const shown = record(run.bus, 'dialogue:show');
    run.startSection(PUZZLE);
    run.redaction(PUZZLE)!.completeNow('myko');
    await settle(run, 6);
    expect(run.isComplete(PUZZLE)).toBe(true);
    expect(held(run)).toContain('c5.clue.site');
    expect(shown.map((s) => s.sequenceId)).not.toContain('c5.redacted.solved');
  });
});

describe('chapter 5: the copier, Lock-in and the cubicle fight', () => {
  async function atCopier() {
    const g = await newGame();
    await toFloor(g.run);
    await crossFloor(g.run);
    await gatherFiles(g.run);
    return g;
  }

  it('does nothing until the redaction is solved', async () => {
    const { run } = await atCopier();
    const shown = record(run.bus, 'dialogue:show');
    await jamCopier(run);
    expect(run.fight(FIGHT)?.active).toBe(false);
    expect(run.player.kit.moves).not.toContain('lockIn');
    // The "not yet" line plays, and plays again on every E.
    await jamCopier(run);
    expect(shown.filter((s) => s.sequenceId === 'c5.copier.notYet')).toHaveLength(2);
    expect(shown.map((s) => s.sequenceId)).not.toContain('c5.copier');
  });

  it('the jam, the Lock-in lesson (once) and the intro come first; then three waves of three agents', async () => {
    const { run } = await atCopier();
    await solveRedaction(run);
    await settle(run, 6);
    const shown = record(run.bus, 'dialogue:show');
    await jamCopier(run);
    const ids = shown.map((s) => s.sequenceId);
    expect(ids.indexOf('c5.copier')).toBeLessThan(ids.indexOf('c5.lockIn.lesson'));
    expect(ids.indexOf('c5.lockIn.lesson')).toBeLessThan(ids.indexOf('c5.fight.intro'));
    expect(run.player.kit.moves).toContain('lockIn');
    expect(run.dressing.prop('copier')?.frame).toBe(PROP.photocopier.jammed);
    const fight = run.fight(FIGHT)!;
    expect(fight.active).toBe(true);
    expect(run.objective()).toBe('c5.fight');
    expect(fight.aliveActors()).toHaveLength(3);
    await winFight(run);
    expect(fight.isComplete()).toBe(true);
    expect(shown.map((s) => s.sequenceId)).toEqual(expect.arrayContaining(['c5.fight.wave2', 'c5.fight.end']));
    expect(shown.filter((s) => s.sequenceId === 'c5.lockIn.lesson')).toHaveLength(1);
  });

  it('Lock-in used in the fight gets its line once', async () => {
    const { run } = await atCopier();
    await solveRedaction(run);
    await jamCopier(run);
    const shown = record(run.bus, 'dialogue:show');
    run.assignMove(3, 'lockIn');
    run.holdDrain(true);
    run.player.meter = createMeter(5, levelTable(5).bitMuch.min + 1);
    run.tick(16, frame({ pressed: ['special3'] }));
    await settle(run, 4);
    expect(shown.filter((s) => s.sequenceId === 'c5.lockIn.done')).toHaveLength(1);
  });

  it('a second E at the copier while the fight is on does not start it twice', async () => {
    const { run } = await atCopier();
    await solveRedaction(run);
    await jamCopier(run);
    const started = record(run.bus, 'section:started');
    await jamCopier(run);
    expect(started.filter((s) => s.sectionId === FIGHT)).toHaveLength(0);
    expect(run.fight(FIGHT)!.aliveActors()).toHaveLength(3);
  });

  it('the Myko call on the fight skips the end line; the board opens either way', async () => {
    const { run } = await atCopier();
    await solveRedaction(run);
    await jamCopier(run);
    const shown = record(run.bus, 'dialogue:show');
    run.fight(FIGHT)!.completeNow('myko');
    await settle(run, 8);
    expect(shown.map((s) => s.sequenceId)).not.toContain('c5.fight.end');
    expect(run.activeDeduction()?.isOpen).toBe(true);
  });
});

describe('chapter 5: the board', () => {
  it('opens when the fight is won with all three clues; a wrong link costs nothing and Myko answers; the right three open the stacks', async () => {
    const { run } = await newGame();
    await toTheBoard(run);
    expect(run.activeDeduction()?.isOpen).toBe(true);
    expect(run.objective()).toBe('c5.board');
    const shown = record(run.bus, 'dialogue:show');
    expect(run.submitDeduction(BOARD, [ev('c5.clue.retirement'), ev('c5.clue.memo'), ev('c5.clue.site')])).toBe(false);
    await settle(run, 3);
    expect(shown.map((s) => s.sequenceId).some((s) => s.startsWith('c5.board.wrong'))).toBe(true);
    expect(await solveBoard(run)).toBe(true);
    await settle(run, 8);
    expect(run.isComplete(BOARD)).toBe(true);
    expect(run.objective()).toBe('c5.pruitt');
    expect(shown.map((s) => s.sequenceId)).toContain('c5.board.right');
  });

  it('with the fight won and a clue missing, the objective sends him back to the files and the board opens when it is found', async () => {
    const { run } = await newGame();
    await toFloor(run);
    await crossFloor(run);
    for (const n of [1, 2, 3, 4, 5]) examine(run, `c5.sheet.${n}`);
    examine(run, 'c5.requisition');
    await settle(run, 6);
    await solveRedaction(run);
    await jamCopier(run);
    await winFight(run);
    await settle(run, 8);
    expect(run.activeDeduction()).toBeNull();
    expect(run.objective()).toBe('c5.files');
    examine(run, 'c5.busticket');
    await settle(run, 4);
    expect(run.activeDeduction()?.isOpen).toBe(true);
  });
});
