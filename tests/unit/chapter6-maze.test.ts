/**
 * Chapter 6, the crop-circle maze: three marker stones in the order on the postcard, a wrong stone puts all three dark, solving it
 * opens the gate to the centre, and the postcard on the Tab screen shows the pattern.
 */

import { describe, expect, it } from 'vitest';
import { chapter6 } from '../../src/chapters/06/index';
import { MAZE_GRID, MAZE_ORDER, MAZE_STONES } from '../../src/chapters/06/maps';
import { postcardPicture } from '../../src/ui/model/postcard';
import { NO_INPUT, record } from './helpers';
import { crossFields, doMotel, doTown, examine, intoYard, mid, newGame, settle, stepOn, winDrones } from './chapter6-steps';
import { MAZE_INTRO_AREA } from '../../src/chapters/06/maps';

async function atMaze() {
  const g = await newGame();
  await doMotel(g.run);
  await doTown(g.run);
  await crossFields(g.run);
  await intoYard(g.run);
  await winDrones(g.run);
  g.run.setPlayerPosition(mid(MAZE_INTRO_AREA));
  await settle(g.run, 4);
  return g;
}

describe('chapter 6: the maze', () => {
  it('is placed on the fields with the three stones in the postcard order', () => {
    const p = chapter6.mazePuzzles?.[0];
    expect(p?.sectionId).toBe('c6.puzzle.maze');
    expect(p?.order).toEqual(MAZE_ORDER);
    expect(p?.stones.map((s) => s.id)).toEqual(['near', 'far', 'hatch']);
    expect(MAZE_STONES).toHaveLength(3);
  });

  it('the intro plays at the formation once, and not before the drones are down', async () => {
    const g = await newGame();
    await doMotel(g.run);
    await doTown(g.run);
    await crossFields(g.run);
    const shown = record(g.run.bus, 'dialogue:show');
    g.run.setPlayerPosition(mid(MAZE_INTRO_AREA));
    await settle(g.run, 4);
    expect(shown.map((s) => s.sequenceId)).not.toContain('c6.maze.intro');
    expect(g.run.currentCompletable()?.sectionId).not.toBe('c6.puzzle.maze');
    await intoYard(g.run);
    await winDrones(g.run);
    g.run.setPlayerPosition(mid(MAZE_INTRO_AREA));
    await settle(g.run, 4);
    expect(shown.filter((s) => s.sequenceId === 'c6.maze.intro')).toHaveLength(1);
    expect(g.run.currentCompletable()?.sectionId).toBe('c6.puzzle.maze');
    expect(g.run.objective()).toBe('c6.maze');
  });

  it('the right order lights the stones one by one and opens the gate and the hatch', async () => {
    const { run } = await atMaze();
    const stones = record(run.bus, 'maze:stone');
    const shown = record(run.bus, 'dialogue:show');
    expect(run.dressing.prop('maze.gate')?.visible).toBe(true);
    expect(run.dressing.prop('maze.hatch')?.visible).toBe(false);
    for (const id of MAZE_ORDER) await stepOn(run, id);
    expect(stones.map((s) => s.outcome)).toEqual(['right', 'right', 'solved']);
    expect(stones.map((s) => s.stoneId)).toEqual(MAZE_ORDER);
    expect(run.isComplete('c6.puzzle.maze')).toBe(true);
    expect(run.dressing.prop('maze.gate')?.visible).toBe(false);
    expect(run.dressing.prop('maze.hatch')?.visible).toBe(true);
    expect(shown.map((s) => s.sequenceId)).toContain('c6.maze.done');
    expect(shown.map((s) => s.sequenceId)).not.toContain('c6.maze.wrong');
  });

  it('a wrong stone puts all three dark again, says so, and the right order still works afterwards', async () => {
    const { run } = await atMaze();
    const stones = record(run.bus, 'maze:stone');
    const shown = record(run.bus, 'dialogue:show');
    await stepOn(run, 'far');
    expect(stones.map((s) => s.outcome)).toEqual(['wrong']);
    expect(stones[0]?.lit).toEqual([]);
    await stepOn(run, 'near');
    await stepOn(run, 'hatch');
    expect(stones.map((s) => s.outcome)).toEqual(['wrong', 'right', 'wrong']);
    expect(stones[2]?.lit).toEqual([]);
    expect(shown.filter((s) => s.sequenceId === 'c6.maze.wrong').length).toBeGreaterThanOrEqual(2);
    expect(run.isComplete('c6.puzzle.maze')).toBe(false);
    expect(run.dressing.prop('maze.gate')?.visible).toBe(true);
    for (const id of MAZE_ORDER) await stepOn(run, id);
    expect(run.isComplete('c6.puzzle.maze')).toBe(true);
  });

  it('the centre: the receipt is the key clue, the section finishes and the board opens', async () => {
    const { run } = await atMaze();
    for (const id of MAZE_ORDER) await stepOn(run, id);
    const shown = record(run.bus, 'dialogue:show');
    examine(run, 'c6.clue.receipt');
    await settle(run, 10);
    expect(shown.map((s) => s.sequenceId)).toContain('c6.centre');
    expect(run.isComplete('c6.explore.centre')).toBe(true);
    expect(JSON.stringify(run.snapshot().casebook)).toContain('c6.clue.receipt');
    expect(run.activeDeduction()?.isOpen).toBe(true);
    expect(run.objective()).toBe('c6.board');
  });

  it('the receipt does nothing before the maze is solved', async () => {
    const { run } = await atMaze();
    examine(run, 'c6.clue.receipt');
    await settle(run, 6);
    expect(run.isComplete('c6.explore.centre')).toBe(false);
    expect(JSON.stringify(run.snapshot().casebook)).not.toContain('c6.clue.receipt');
    run.tick(16, NO_INPUT);
  });
});

describe('chapter 6: the postcard on the Tab screen', () => {
  const pic = postcardPicture();

  it('shows the three stones in the order they are stepped on, one pip, two pips, three, joined in that order', () => {
    expect(pic.stones.map((s) => s.order)).toEqual([1, 2, 3]);
    expect(pic.stones.map((s) => s.pips.length)).toEqual([1, 2, 3]);
    // The stones sit where the maze's stones are (local tile centres).
    const cell = 5;
    MAZE_GRID.stones.forEach((s, i) => {
      const box = pic.stones[i]!.box;
      expect(box.x + Math.floor(box.w / 2)).toBe(s.col * cell + 2);
      expect(box.y + Math.floor(box.h / 2)).toBe(s.row * cell + 2);
    });
    expect(pic.links.length).toBe(4);
  });

  it('draws every staked wall of the maze and stays inside the card', () => {
    const walls = MAZE_GRID.walls.flat().filter(Boolean).length;
    const covered = pic.walls.reduce((n, w) => n + (w.w / 5) * (w.h / 5), 0);
    expect(covered).toBe(walls);
    for (const r of [...pic.walls, ...pic.links, ...pic.stones.flatMap((s) => [s.box, ...s.pips])]) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(pic.width + 4);
      expect(r.y + r.h).toBeLessThanOrEqual(pic.height + 4);
    }
  });
});
