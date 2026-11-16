/**
 * Chapter 4 (Southie) on the real chapter: the screens connect, everything on them can be walked to (the shut gate, the hatch
 * and the rails respected), and walkChapter completes it.
 */

import { describe, expect, it } from 'vitest';
import { chapter4 } from '../../src/chapters/04/index';
import {
  ARENA,
  BAR_ARRIVAL,
  BAR_FROM_DOCKS,
  BOLLARD,
  CONTROL_BOX,
  DOCKS_ARRIVAL,
  FOAM_SPOT,
  FOREMAN_ENTRANCE,
  GATE,
  LUNCHBOX_PICKUP,
  RAILS,
  SEIZURE_SPOT,
  SHILLELAGH_SPOT,
  STEALTH_EXIT,
  STEALTH_START,
} from '../../src/chapters/04/maps';
import { floodFrom, onReachable, unreachableHere, within } from './reach';
import { record } from './helpers';
import { enter, examine, newGame, settle, startBrawl, toDocks, winBrawl } from './chapter4-steps';

const anyIn = (reach: Set<string>, a: { x: number; y: number; width: number; height: number }) =>
  [...reach].some((k) => {
    const [c, r] = k.split(',').map(Number) as [number, number];
    return c * 16 >= a.x && r * 16 >= a.y && c * 16 < a.x + a.width && r * 16 < a.y + a.height;
  });

describe('chapter 4: the screens connect and everything on them can be reached', () => {
  it('the bar: every patron, the tea, the roster, the stout, both bottles on the bar and the back door, from the stool', async () => {
    const { run } = await newGame();
    expect(chapter4.screens.map((s) => s.id)).toEqual(['c4.bar', 'c4.docks']);
    expect(run.screenId).toBe('c4.bar');
    expect(run.player.pos).toEqual(BAR_ARRIVAL);
    expect(unreachableHere(run, [BAR_ARRIVAL])).toEqual([]);
    // Where he steps back in from the pier is the same room.
    expect(onReachable(floodFrom(run, [BAR_ARRIVAL]), BAR_FROM_DOCKS)).toBe(true);
  });

  it('the docks: the alley, the fence gap and the stealth start and exit, the shut gate and the door back into the bar', async () => {
    const { run } = await newGame();
    await toDocks(run);
    const reach = floodFrom(run, [DOCKS_ARRIVAL]);
    expect(anyIn(reach, STEALTH_START)).toBe(true);
    expect(anyIn(reach, STEALTH_EXIT)).toBe(true);
    expect(onReachable(reach, DOCKS_ARRIVAL)).toBe(true);
    // Shut: the gate props block the alley's way through.
    const gateTiles = Array.from({ length: GATE.height }, (_, i) => `${GATE.col},${GATE.row + i}`);
    for (const t of gateTiles) expect(reach.has(t), `gate tile ${t} is walked through while shut`).toBe(false);
  });

  it('the docks: with the hatch shut and the rails where they start, MAS-4471 cannot be entered; solved, it can', async () => {
    const { run } = await newGame();
    await toDocks(run);
    const shut = floodFrom(run, [DOCKS_ARRIVAL]);
    expect(within(shut, SEIZURE_SPOT, 8)).toBe(false);
    expect(within(shut, FOAM_SPOT, 8)).toBe(false);
    run.completeSection('c4.puzzle.containers', 'debug');
    run.tick(16, { ...(await import('./helpers')).NO_INPUT });
    const open = floodFrom(run, [DOCKS_ARRIVAL]);
    expect(within(open, SEIZURE_SPOT, 8)).toBe(true);
    expect(within(open, FOAM_SPOT, 8)).toBe(true);
  });

  it('the docks, once the stealth is passed: the gate opens, the levers, the arena, the control box and the shillelagh are all reachable', async () => {
    const { run } = await newGame();
    await toDocks(run);
    run.completeSection('c4.stealth.docks', 'debug');
    await settle(run);
    expect(run.dressing.prop('dockGate')?.visible).toBe(false);
    const reach = floodFrom(run, [DOCKS_ARRIVAL]);
    for (const t of Array.from({ length: GATE.height }, (_, i) => `${GATE.col},${GATE.row + i}`)) expect(reach.has(t), t).toBe(true);
    for (const r of RAILS) expect(within(reach, { x: r.leverTile.col * 16 + 8, y: r.leverTile.row * 16 + 8 }), r.examinableId).toBe(true);
    expect(within(reach, SHILLELAGH_SPOT)).toBe(true);
    expect(within(reach, { x: CONTROL_BOX.col * 16 + 8, y: (CONTROL_BOX.row + 2) * 16 }, 24)).toBe(true);
    expect(onReachable(reach, FOREMAN_ENTRANCE)).toBe(true);
    for (const [c, r] of [[ARENA.col + 1, ARENA.row + 3], [ARENA.col + ARENA.width - 2, ARENA.row + ARENA.height - 3]] as const) expect(reach.has(`${c},${r}`), `${c},${r}`).toBe(true);
    // The clean-run whiskey sits in front of the bollard's lunchbox, on ground that can be stood on.
    expect(reach.has(`${Math.floor(LUNCHBOX_PICKUP.x / 16)},${Math.floor(LUNCHBOX_PICKUP.y / 16)}`)).toBe(true);
    expect(BOLLARD.col).toBe(40);
  });

  it('the pulled levers are reachable from the standing room beside them (lever, south side), not only by the straight line', async () => {
    const { run } = await newGame();
    await toDocks(run);
    const reach = floodFrom(run, [DOCKS_ARRIVAL]);
    for (const r of RAILS) expect(reach.has(`${r.leverTile.col},${r.leverTile.row + 1}`) || reach.has(`${r.leverTile.col - 1},${r.leverTile.row}`), r.examinableId).toBe(true);
  });
});

describe('chapter 4: walkChapter', () => {
  it('completes every section and the chapter with no missing dialogue', async () => {
    const { run, session } = await newGame();
    let completed = 0;
    session.bus.on('chapter:completed', () => void completed++);
    const done = record(session.bus, 'section:completed');
    run.walkChapter();
    await settle(run);
    expect(completed).toBe(1);
    expect(chapter4.def.sections.every((s) => run.isComplete(s.id))).toBe(true);
    expect(done.length).toBeGreaterThanOrEqual(chapter4.def.sections.length - 1);
    expect(run.dialogue.missing.size).toBe(0);
  });

  it('the brawl by the real beats completes and unlocks the back door', async () => {
    const { run } = await newGame();
    await startBrawl(run);
    expect(run.fight('c4.fight.brawl')?.active).toBe(true);
    await winBrawl(run);
    expect(run.isComplete('c4.fight.brawl')).toBe(true);
    await enter(run, 'c4.bar', BAR_ARRIVAL);
    const exit = run.screenLayout.exits.find((e) => e.id === 'c4.bar.backdoor')!;
    run.setPlayerPosition({ x: exit.area.x + 8, y: exit.area.y + 8 });
    await settle(run);
    expect(run.screenId).toBe('c4.docks');
    void examine;
  });
});
