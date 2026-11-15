/**
 * Chapter 1's world rules on the real chapter: the keg yard through a return and a load, the Shoulder on the stuck gate, the
 * east exit's lock (Big Tom and the hurley) and its one line, the bar-return hooks, and saves on a clue, a move and a weapon.
 */

import { describe, expect, it } from 'vitest';
import { chapter1 } from '../../src/chapters/01/index';
import { T } from '../../src/chapters/01/maps';
import { createSandboxModule } from '../../src/core/sandbox';
import type { OverhaulSaveState } from '../../src/core/types';
import type { ChapterRun } from '../../src/systems/run';
import { NO_INPUT, advance, frame, makeRun, placeAt, record, settleDialogue, startChapterGame } from './helpers';

const kegs = (run: ChapterRun) => run.pushPuzzlesHere()[0]!.puzzle;
const at = (p: ReadonlyArray<{ id: string; col: number; row: number }>) => p.map((k) => `${k.id}@${k.col},${k.row}`);

/** A chapter 1 game with the opening read, standing in the yard. */
async function inYard() {
  const g = startChapterGame(chapter1, 'new');
  g.run.tick(16, NO_INPUT);
  await settleDialogue(g.run);
  g.run.goToScreen('c1.yard', T(5, 3));
  g.run.tick(16, NO_INPUT);
  await settleDialogue(g.run);
  return g;
}

/** Makes Andrew sober, lets the two-phase return finish, and reads out the bar's lines. */
async function returnToBar(run: ChapterRun): Promise<void> {
  run.player.meter = { ...run.player.meter, value: 0.01 };
  advance(run, 200);
  run.completeBarReturn();
  run.tick(16, NO_INPUT);
  await settleDialogue(run);
}

describe('the keg puzzle through a return to the bar', () => {
  it('chapter 1: kegs stay where Andrew left them', async () => {
    const { run } = await inYard();
    const p = kegs(run);
    const start = at(p.piecePositions());
    expect(p.push({ col: 4 + 11, row: 2 + 5 }, 'up')).toBe(true); // keg1 up (yard area origin col 11, row 5)
    const moved = at(p.piecePositions());
    expect(moved).not.toEqual(start);
    await returnToBar(run);
    expect(run.screenId).toBe('c1.pub');
    run.goToScreen('c1.yard', T(5, 3));
    expect(at(kegs(run).piecePositions())).toEqual(moved);
    expect(kegs(run).isComplete()).toBe(false);
  });

  it('a solved puzzle stays solved and the gate section is not reopened by a return', async () => {
    const { run } = await inYard();
    kegs(run).completeNow('debug');
    await settleDialogue(run);
    await returnToBar(run);
    expect(run.isComplete('c1.puzzle.kegs')).toBe(true);
    run.goToScreen('c1.yard', T(5, 3));
    expect(kegs(run).isComplete()).toBe(true);
  });

  it('a return does not reset it, but the reset examinable still does (sandbox lever)', () => {
    const { run } = makeRun({ chapter: 1, module: createSandboxModule(1) });
    const p = kegs(run);
    const start = at(p.piecePositions());
    expect(p.push({ col: 9, row: 14 }, 'left')).toBe(true);
    expect(at(p.piecePositions())).not.toEqual(start);
    run.player.meter = { ...run.player.meter, value: 0.01 };
    advance(run, 200);
    expect(at(kegs(run).piecePositions())).not.toEqual(start);
    // Stand by the lever and press E.
    placeAt(run, 12, 13);
    run.tick(16, frame());
    expect(run.interactTarget()?.examinableId).toBe('sandbox.lever');
    run.tick(16, frame({ pressed: ['interact'] }));
    expect(at(kegs(run).piecePositions())).toEqual(start);
    expect(kegs(run).pushes).toBe(0);
  });

  it('a half-finished puzzle resets on a load (puzzle state is not saved)', async () => {
    const { run, store } = await inYard();
    const start = at(kegs(run).piecePositions());
    kegs(run).push({ col: 15, row: 7 }, 'up');
    expect(at(kegs(run).piecePositions())).not.toEqual(start);
    run.learnMove('shoulder'); // writes a save
    const loaded = startChapterGame(chapter1, 'continue', store);
    loaded.run.tick(16, NO_INPUT);
    loaded.run.goToScreen('c1.yard', T(5, 3));
    expect(at(kegs(loaded.run).piecePositions())).toEqual(start);
  });
});

describe('the keg puzzle by walking', () => {
  // BUG (level-builder, src/chapters/01/maps.ts yardScreen): the stuck gate prop is solid on (17,7) and (18,7). Keg2 (16,7) can only
  // be pushed left from (17,7); up and down are shut by the fixed crate at (16,8). So no walk can ever move keg2 and the
  // puzzle cannot be solved while the gate is shut. The unit search in chapter1.test.ts ignores props. Remove `.fails` when fixed.
  it.fails('Andrew can reach the tile east of keg2 and push it left', async () => {
    const { run } = await inYard();
    const p = kegs(run);
    run.setPlayerPosition(T(19, 7)); // the street side of the gate: the only way to the east of the kegs
    for (let i = 0; i < 400; i++) run.tick(16, frame({ move: { x: -1, y: 0 } }));
    expect(p.piecePositions().find((k) => k.id === 'keg2')?.col).toBe(15);
  });
});

describe('the Shoulder on the stuck yard gate', () => {
  it('opens it: the yard section completes and the gate exit unlocks', async () => {
    const { run } = await inYard();
    kegs(run).completeNow('debug');
    await settleDialogue(run);
    expect(run.player.kit.moves).toContain('shoulder');
    expect(run.isComplete('c1.explore.yard')).toBe(false);
    // Below the gate prop (cols 17 and 18, row 7), facing it.
    placeAt(run, 17, 9);
    const aim = { x: 17 * 16 + 8, y: 6 * 16 };
    run.tick(16, frame({ aim }));
    run.tick(16, frame({ pressed: ['special1'], aim }));
    await settleDialogue(run);
    expect(run.isComplete('c1.explore.yard')).toBe(true);
  });

  it('does nothing to the gate when used outside the gate area', async () => {
    const { run } = await inYard();
    kegs(run).completeNow('debug');
    await settleDialogue(run);
    placeAt(run, 2, 12);
    const aim = { x: 6 * 16, y: 12 * 16 };
    run.tick(16, frame({ aim }));
    run.tick(16, frame({ pressed: ['special1'], aim }));
    await settleDialogue(run);
    expect(run.isComplete('c1.explore.yard')).toBe(false);
  });
});

describe('the east exit', () => {
  const EXIT = T(69, 10);
  const APPROACH = T(66, 10);

  /** Walks onto the exit tiles; true if he came out on the bog road. */
  const tryExit = async (run: ChapterRun): Promise<boolean> => {
    run.goToScreen('c1.street', T(60, 10));
    run.tick(16, NO_INPUT);
    await settleDialogue(run); // the street's opening caption
    run.setPlayerPosition(EXIT);
    run.tick(16, NO_INPUT);
    return run.screenId === 'c1.road';
  };

  it('is locked on a fresh game', async () => {
    const { run } = startChapterGame(chapter1, 'chapter');
    run.tick(16, NO_INPUT);
    expect(await tryExit(run)).toBe(false);
  });

  it('Big Tom beaten but no hurley: still locked', async () => {
    const { run } = startChapterGame(chapter1, 'chapter');
    run.tick(16, NO_INPUT);
    run.completeSection('c1.boss.bigtom', 'debug');
    expect(await tryExit(run)).toBe(false);
  });

  it('the hurley without Big Tom beaten: still locked', async () => {
    const { run } = startChapterGame(chapter1, 'chapter');
    run.tick(16, NO_INPUT);
    run.gainWeapon('hurley');
    expect(await tryExit(run)).toBe(false);
  });

  it('Big Tom beaten and the hurley taken: open', async () => {
    const { run } = startChapterGame(chapter1, 'chapter');
    run.tick(16, NO_INPUT);
    run.completeSection('c1.boss.bigtom', 'debug');
    run.gainWeapon('hurley');
    expect(await tryExit(run)).toBe(true);
  });

  it('stays open after a load of a save that has both', async () => {
    const { run, store } = startChapterGame(chapter1, 'chapter');
    run.tick(16, NO_INPUT);
    run.completeSection('c1.boss.bigtom', 'debug');
    run.gainWeapon('hurley');
    const loaded = startChapterGame(chapter1, 'continue', store);
    loaded.run.tick(16, NO_INPUT);
    expect(await tryExit(loaded.run)).toBe(true);
  });

  it('stays locked after a load of a save with Big Tom beaten and no hurley', async () => {
    const { run, store } = startChapterGame(chapter1, 'chapter');
    run.tick(16, NO_INPUT);
    run.completeSection('c1.boss.bigtom', 'debug'); // writes a save
    const loaded = startChapterGame(chapter1, 'continue', store);
    loaded.run.tick(16, NO_INPUT);
    expect(loaded.run.isComplete('c1.boss.bigtom')).toBe(true);
    expect(await tryExit(loaded.run)).toBe(false);
  });

  it('stays open after a return to the bar, and locked if the hurley was never taken', async () => {
    const a = startChapterGame(chapter1, 'chapter');
    a.run.tick(16, NO_INPUT);
    a.run.completeSection('c1.boss.bigtom', 'debug');
    a.run.gainWeapon('hurley');
    await returnToBar(a.run);
    expect(await tryExit(a.run)).toBe(true);

    const b = startChapterGame(chapter1, 'chapter');
    b.run.tick(16, NO_INPUT);
    b.run.completeSection('c1.boss.bigtom', 'debug');
    await returnToBar(b.run);
    expect(await tryExit(b.run)).toBe(false);
  });

  describe('c1.exit.needHurley', () => {
    const lines = (run: ChapterRun) => {
      const shown = record(run.bus, 'dialogue:show');
      return () => shown.filter((s) => s.sequenceId === 'c1.exit.needHurley').length;
    };

    /** Walks to the approach tile with Big Tom beaten and no hurley, optionally having been in the trigger before. */
    async function setUp() {
      const { run } = startChapterGame(chapter1, 'chapter');
      run.tick(16, NO_INPUT);
      run.goToScreen('c1.street', T(60, 10));
      run.tick(16, NO_INPUT);
      await settleDialogue(run);
      return { run, count: lines(run) };
    }

    it('is silent while Big Tom is still on his feet (the hurley is not the missing piece)', async () => {
      const { run, count } = await setUp();
      run.setPlayerPosition(APPROACH);
      run.tick(16, NO_INPUT);
      await settleDialogue(run);
      expect(count()).toBe(0);
    });

    it('plays on the approach, and standing in the trigger does not repeat it', async () => {
      const { run, count } = await setUp();
      run.completeSection('c1.boss.bigtom', 'debug');
      await settleDialogue(run);
      run.setPlayerPosition(APPROACH);
      run.tick(16, NO_INPUT);
      expect(count()).toBe(1);
      await settleDialogue(run);
      for (let i = 0; i < 5; i++) run.tick(16, NO_INPUT);
      expect(count()).toBe(1);
    });

    // BUG (level-builder, src/chapters/01/script.ts onTrigger 'c1.trig.eastexit'): the line is played with ctx.say(id) and no
    // `{ repeat: true }`, so the dialogue runner treats the second approach as already played and stays silent. The spec
    // (docs/chapters/01-a-quiet-pint.md beat 11) and the script's own comment say the line plays once per approach.
    it.fails('plays again on a second approach after walking away', async () => {
      const { run, count } = await setUp();
      run.completeSection('c1.boss.bigtom', 'debug');
      await settleDialogue(run);
      run.setPlayerPosition(APPROACH);
      run.tick(16, NO_INPUT);
      await settleDialogue(run);
      run.setPlayerPosition(T(60, 10));
      run.tick(16, NO_INPUT);
      run.setPlayerPosition(APPROACH);
      run.tick(16, NO_INPUT);
      expect(count()).toBe(2);
    });

    it('is silent once the hurley is in hand', async () => {
      const { run } = startChapterGame(chapter1, 'chapter');
      run.tick(16, NO_INPUT);
      run.goToScreen('c1.street', T(60, 10));
      run.completeSection('c1.boss.bigtom', 'debug');
      run.gainWeapon('hurley');
      await settleDialogue(run);
      const count = lines(run);
      run.setPlayerPosition(APPROACH);
      run.tick(16, NO_INPUT);
      expect(count()).toBe(0);
    });
  });
});

describe('chapter context hooks', () => {
  it('ctx.kit() is the live kit', () => {
    const { run } = makeRun({ chapter: 1, module: createSandboxModule(1) });
    expect(run.kit()).toBe(run.player.kit);
    run.give({ kind: 'drink', drinkId: 'stout', count: 1 });
    expect(run.kit()).toBe(run.player.kit);
    expect(run.kit().drinks['stout']).toBeGreaterThanOrEqual(1);
  });

  it('onBarReturnSettled fires at the end of a return, once per return, and unsubscribes', () => {
    const { run } = makeRun({ chapter: 1, module: createSandboxModule(1), manualReturn: true });
    let n = 0;
    const off = run.onBarReturnSettled(() => void n++);
    run.player.meter = { ...run.player.meter, value: 0.01 };
    advance(run, 200);
    expect(run.barReturning).not.toBeNull();
    expect(n).toBe(0); // not before the scene reaches black
    run.completeBarReturn();
    expect(n).toBe(1);
    run.completeBarReturn(); // nothing waiting
    expect(n).toBe(1);
    off();
    run.player.meter = { ...run.player.meter, value: 0.01 };
    advance(run, 200);
    run.completeBarReturn();
    expect(n).toBe(1);
  });

  it('a chapter with no checkpoints loads and plays', () => {
    expect(chapter1.def.checkpoints ?? []).toEqual([]);
    const { run } = startChapterGame(chapter1, 'chapter');
    run.tick(16, NO_INPUT);
    advance(run, 1000);
    expect(run.screenId).toBe('c1.pub');
  });
});

describe('saves', () => {
  const lastSave = (saves: { state: OverhaulSaveState; reason: string }[]) => saves.at(-1);

  it('a clue, a move and a weapon each write a save with that reason, holding what was gained', () => {
    const { run, saves } = makeRun({ chapter: 2, module: createSandboxModule(2) });
    const n = saves.length;
    run.addEvidence('c2.clue.ring');
    expect(lastSave(saves)?.reason).toBe('clue');
    expect(lastSave(saves)?.state.casebook.length).toBeGreaterThan(0);
    run.learnMove('reflexTest');
    expect(lastSave(saves)?.reason).toBe('move');
    expect(lastSave(saves)?.state.kit.moves).toContain('reflexTest');
    run.gainWeapon('shillelagh');
    expect(lastSave(saves)?.reason).toBe('weapon');
    expect(lastSave(saves)?.state.kit.weapons).toContain('shillelagh');
    expect(saves.length).toBeGreaterThanOrEqual(n + 3);
  });

  it('a move already known, or a clue already found, does not save again', () => {
    const { run, saves } = makeRun({ chapter: 2, module: createSandboxModule(2) });
    run.learnMove('reflexTest');
    run.addEvidence('c2.clue.ring');
    const n = saves.length;
    run.learnMove('reflexTest');
    run.addEvidence('c2.clue.ring');
    expect(saves.length).toBe(n);
  });
});
