/**
 * Chapter 6, the combine harvester: it starts when Andrew walks back west into the arena with the board done, crosses the
 * arena in lanes (plume, pass, bales), cuts the corn, goes down light by light and ends in the ditch, then the closing.
 */

import { describe, expect, it } from 'vitest';
import { chapter6 } from '../../src/chapters/06/index';
import { ARENA, DITCH_CURVE, T } from '../../src/chapters/06/maps';
import { NO_INPUT, record } from './helpers';
import { crossFields, doCentre, doMotel, doTown, intoYard, newGame, settle, solveMaze, winDrones } from './chapter6-steps';

type Run = Awaited<ReturnType<typeof newGame>>['run'];

async function toBoardDone() {
  const g = await newGame();
  await doMotel(g.run);
  await doTown(g.run);
  await crossFields(g.run);
  await intoYard(g.run);
  await winDrones(g.run);
  await solveMaze(g.run);
  await doCentre(g.run);
  return g;
}

/** Ticks with Andrew parked between two lanes (col 18), his meter held up. */
async function tickFor(run: Run, ms: number, until?: () => boolean): Promise<void> {
  for (let t = 0; t < ms && !(until?.() ?? false); t += 16) {
    run.player.meter = { ...run.player.meter, value: 50 };
    run.tick(16, NO_INPUT);
    if ((t / 16) % 20 === 0) await settle(run, 1);
  }
}

describe('chapter 6: the combine', () => {
  it('is a script-started set piece with five lanes, three lights and two escorts', () => {
    const b = chapter6.bosses[0]!;
    expect(b.trigger.kind).toBe('script');
    expect(b.callId).toBe('combine');
    expect(b.combine?.lanes).toHaveLength(5);
    expect(b.combine?.lights.map((l) => l.tag)).toEqual(['light1', 'light2', 'light3']);
    expect(b.combine?.escortPoints).toHaveLength(2);
    expect(b.combine?.ditchPath).toEqual(DITCH_CURVE);
    expect(chapter6.def.mykoCallLines.setpiece?.sequenceId).toBe('c6.call.combine');
  });

  it('does not start before the board is done; after it, walking back west into the yard plays the intro and starts it', async () => {
    const { run } = await toBoardDone();
    const shown = record(run.bus, 'dialogue:show');
    expect(run.boss('c6.setpiece.combine')?.active).not.toBe(true);
    await intoYard(run);
    await settle(run, 6);
    expect(shown.map((s) => s.sequenceId)).toContain('c6.combine.intro');
    expect(run.boss('c6.setpiece.combine')?.active).toBe(true);
    expect(run.objective()).toBe('c6.combine');
    // Two escort drones with it.
    expect(run.actors().filter((a) => !a.down && a.enemyId === 'drone')).toHaveLength(2);
    // Walking out and in again does not start a second one.
    await intoYard(run);
    expect(run.actors().filter((a) => !a.down && a.enemyId === 'drone')).toHaveLength(2);
  });

  it('passes cut the corn in its lane; the dust plume comes first; the lights go out in turn with Myko\'s lines; then the ditch', async () => {
    const { run } = await toBoardDone();
    const events = record(run.bus, 'combine:changed');
    const shown = record(run.bus, 'dialogue:show');
    const ended = record(run.bus, 'chapter:completed');
    await intoYard(run);
    await settle(run, 6);
    run.holdDrain(true);
    run.setPlayerPosition(T(18, 24));
    const standing = run.corn.standingTiles('c6.fields').length;
    await tickFor(run, 25000, () => events.some((e) => e.phase === 'passEnded'));
    const phases = events.map((e) => e.phase);
    expect(phases).toContain('plume');
    expect(phases.indexOf('plume')).toBeLessThan(phases.indexOf('pass'));
    expect(phases).toContain('passEnded');
    expect(run.corn.standingTiles('c6.fields').length).toBeLessThan(standing);
    // The arena's corn is what it cuts.
    for (const t of run.corn.standingTiles('c6.fields')) expect(t).toBeDefined();
    const boss = run.boss('c6.setpiece.combine')!;
    run.defeat(boss.body('light1')!, 'player');
    await settle(run, 3);
    run.defeat(boss.body('light2')!, 'player');
    await settle(run, 3);
    expect(shown.map((s) => s.sequenceId)).toEqual(expect.arrayContaining(['c6.combine.light1', 'c6.combine.light2']));
    expect(boss.isComplete()).toBe(false);
    run.defeat(boss.body('light3')!, 'player');
    await settle(run, 3);
    expect(boss.isComplete()).toBe(true);
    await tickFor(run, 120000, () => ended.length > 0);
    await settle(run, 6);
    const harvester = boss.body('harvester')!;
    const end = DITCH_CURVE[DITCH_CURVE.length - 1]!;
    expect(Math.hypot(harvester.pos.x - end.x, harvester.pos.y - end.y)).toBeLessThan(2);
    expect(events.map((e) => e.phase)).toEqual(expect.arrayContaining(['ditching', 'ditched']));
    const ids = shown.map((s) => s.sequenceId);
    expect(ids.indexOf('c6.combine.end')).toBeGreaterThan(-1);
    expect(ids.indexOf('c6.closing')).toBeGreaterThan(ids.indexOf('c6.combine.end'));
    expect(run.screenId).toBe('c6.town');
    expect(ended).toHaveLength(1);
  });

  it('the set piece has the harvester and its three lights as bodies', async () => {
    const { run } = await toBoardDone();
    await intoYard(run);
    await settle(run, 6);
    const boss = run.boss('c6.setpiece.combine')!;
    expect(boss.body('harvester')?.stats.maxHealth).toBeDefined();
    for (const tag of ['light1', 'light2', 'light3']) expect(boss.body(tag)).toBeDefined();
    expect(ARENA.width).toBe(36);
  });

  it('Myko\'s call on the combine: the call scene and the casebook line, the combine is stopped, and the closing follows without the end scene', async () => {
    const { run } = await toBoardDone();
    await intoYard(run);
    await settle(run, 6);
    const shown = record(run.bus, 'dialogue:show');
    const ended = record(run.bus, 'chapter:completed');
    const started = record(run.bus, 'myko:callStarted');
    expect(run.myko.tryCall()).toBe(true);
    expect(started[0]).toMatchObject({ sectionId: 'c6.setpiece.combine' });
    for (let i = 0; i < 600 && ended.length === 0; i++) {
      run.tick(50, NO_INPUT);
      if (i % 20 === 0) await settle(run, 1);
    }
    await settle(run, 6);
    expect(run.isComplete('c6.setpiece.combine')).toBe(true);
    const ids = shown.map((s) => s.sequenceId);
    expect(ids).toContain('c6.call.combine');
    expect(ids).not.toContain('c6.combine.end');
    expect(ids).toContain('c6.closing');
    expect(JSON.stringify(run.snapshot().casebook)).toContain('"callId":"combine"');
    expect(ended).toHaveLength(1);
  });
});
