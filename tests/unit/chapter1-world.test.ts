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
    expect(p.push({ col: 12, row: 6 }, 'right')).toBe(true); // keg1 right
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
    kegs(run).push({ col: 12, row: 6 }, 'right');
    expect(at(kegs(run).piecePositions())).not.toEqual(start);
    run.learnMove('shoulder'); // writes a save
    const loaded = startChapterGame(chapter1, 'continue', store);
    loaded.run.tick(16, NO_INPUT);
    loaded.run.goToScreen('c1.yard', T(5, 3));
    expect(at(kegs(loaded.run).piecePositions())).toEqual(start);
  });
});

describe('the keg puzzle by walking', () => {
  /** Tiles Andrew can stand on from the yard door: the grid (stuck gate prop included) minus the kegs and the fixed crate. */
  const reachable = (run: ChapterRun, to: { col: number; row: number }): boolean => {
    const g = run.grid;
    const p = kegs(run);
    const open = (c: number, r: number) => c >= 0 && r >= 0 && c < g.widthTiles && r < g.heightTiles && !g.blocked[r * g.widthTiles + c] && !p.occupies(c, r);
    const seen = new Set<number>([3 * g.widthTiles + 5]);
    const queue = [{ c: 5, r: 3 }];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur.c === to.col && cur.r === to.row) return true;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const n = { c: cur.c + dc, r: cur.r + dr };
        const k = n.r * g.widthTiles + n.c;
        if (!open(n.c, n.r) || seen.has(k)) continue;
        seen.add(k);
        queue.push(n);
      }
    }
    return false;
  };

  /** Stands on `from` (which must be reachable), holds `dir` for a second, and returns where the pieces are. */
  const pushBy = (run: ChapterRun, from: { col: number; row: number }, dir: 'up' | 'left' | 'right'): void => {
    expect(reachable(run, from), `can walk to ${from.col},${from.row}`).toBe(true);
    placeAt(run, from.col, from.row);
    const move = dir === 'up' ? { x: 0, y: -1 } : dir === 'left' ? { x: -1, y: 0 } : { x: 1, y: 0 };
    const before = JSON.stringify(kegs(run).piecePositions());
    // Hold until the keg has moved one tile, then let go, so a second push cannot follow.
    for (let i = 0; i < 120 && JSON.stringify(kegs(run).piecePositions()) === before; i++) run.tick(16, frame({ move }));
    for (let i = 0; i < 30; i++) run.tick(16, NO_INPUT);
  };

  it('is solved by walking: keg1 right, keg2 up, keg3 right to the end of the path, keg3 up into the corner', async () => {
    const { run } = await inYard();
    const p = kegs(run);
    const start = p.piecePositions();
    expect(start.map((k) => `${k.id}@${k.col},${k.row}`)).toEqual(['keg1@12,6', 'keg2@12,7', 'keg3@13,7']);
    pushBy(run, { col: 11, row: 6 }, 'right');
    expect(at(p.piecePositions())).toContain('keg1@13,6');
    pushBy(run, { col: 12, row: 8 }, 'up');
    expect(at(p.piecePositions())).toContain('keg2@12,6');
    pushBy(run, { col: 12, row: 7 }, 'right');
    pushBy(run, { col: 13, row: 7 }, 'right');
    pushBy(run, { col: 14, row: 7 }, 'right');
    expect(at(p.piecePositions())).toContain('keg3@16,7');
    expect(p.isComplete()).toBe(false); // the last keg is on the gate's step
    pushBy(run, { col: 16, row: 8 }, 'up');
    expect(p.piecePositions().map((k) => `${k.id}@${k.col},${k.row}`)).toEqual(['keg1@13,6', 'keg2@12,6', 'keg3@16,6']);
    expect(p.isComplete()).toBe(true);
    expect(reachable(run, { col: 17, row: 7 })).toBe(true);
  });

  it('the kegs close the path: the gate step cannot be reached until they are moved, and the gateway is shut', async () => {
    const { run } = await inYard();
    expect(reachable(run, { col: 17, row: 7 })).toBe(false);
    expect(reachable(run, { col: 11, row: 7 })).toBe(true);
    expect(run.grid.blocked[7 * run.grid.widthTiles + 18]).toBe(true); // the gateway itself is shut
  });
});

describe('the Shoulder on the stuck yard gate', () => {
  it('opens it: the yard section completes and the gate exit unlocks', async () => {
    const { run } = await inYard();
    kegs(run).completeNow('debug');
    await settleDialogue(run);
    expect(run.player.kit.moves).toContain('shoulder');
    expect(run.isComplete('c1.explore.yard')).toBe(false);
    // On the path, past where the kegs were, facing the gate in the gateway (18, 7).
    placeAt(run, 16, 7);
    const aim = { x: 18 * 16 + 8, y: 7 * 16 + 8 };
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

    it('plays again on a second approach after walking away', async () => {
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
