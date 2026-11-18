/**
 * Chapter 7, the three mascots on the real strip: walking into the arena starts them (the intro first), the sign knocked
 * away by The Stumble and back, the speed-up as each falls, and the applause, the tip, the prize and the night.
 */

import { describe, expect, it } from 'vitest';
import { PROP } from '../../src/art/props';
import { MASCOT_TRIGGER } from '../../src/chapters/07/maps';
import { TUNING } from '../../src/content/tuning';
import { createMeter, levelTable } from '../../src/systems/meter';
import { NO_INPUT, frame, record } from './helpers';
import { BOSS, intoArena, mid, newGame, settle, upToMascots, wait } from './chapter7-steps';

const M = TUNING.overhaul!.mascots!;

async function atMascots() {
  const g = await newGame();
  await upToMascots(g.run);
  await intoArena(g.run);
  const boss = g.run.boss(BOSS)!;
  return { ...g, boss, zorp: boss.body('zorp')!, zap: boss.body('zap')!, zip: boss.body('zip')! };
}

describe('chapter 7: the mascots start', () => {
  it('coming out of the back gate into the arena: the intro scene, then the boss, with the objective', async () => {
    const { run, boss } = await atMascots();
    expect(boss.active).toBe(true);
    expect(run.objective()).toBe('c7.mascots');
    expect(boss.phase?.id).toBe('three');
    expect(boss.allBodies().map((b) => b.tag).sort()).toEqual(['zap', 'zip', 'zorp']);
    expect(run.dressing.prop('mascot.sign')?.visible).toBe(false);
  });

  it('walking in from the bar side starts them too, once, and not before the board is done', async () => {
    const g = await newGame();
    const shown = record(g.run.bus, 'dialogue:show');
    g.run.setPlayerPosition(mid(MASCOT_TRIGGER));
    await settle(g.run, 8);
    expect(g.run.boss(BOSS)?.active, 'board not done').toBe(false);
    await upToMascots(g.run);
    g.run.setPlayerPosition(mid(MASCOT_TRIGGER));
    await wait(g.run, 800);
    expect(g.run.boss(BOSS)?.active).toBe(true);
    await wait(g.run, 1500);
    expect(shown.filter((s) => s.sequenceId === 'c7.mascots.intro')).toHaveLength(1);
  });

  it('four bottle crates are in reach at the arena corners', async () => {
    const { run } = await atMascots();
    for (let i = 1; i <= 4; i++) expect(run.dressing.prop(`strip.arenaCrate${i}`)?.visible, `crate ${i}`).toBe(true);
  });
});

describe('chapter 7: the sign', () => {
  it('The Stumble through Zorp knocks the sign out of his hands for 3 s: the sign lies on the road, then it is back', async () => {
    const { run, zorp } = await atMascots();
    run.learnMove('stumble');
    run.setPlayerPosition({ x: 640, y: 160 });
    const seen = record(run.bus, 'mascots:changed');
    await wait(run, 200);
    zorp.pinned = { x: 680, y: 160 };
    zorp.pos = { x: 680, y: 160 };
    zorp.facingDeg = 180;
    run.player.meter = createMeter(7, levelTable(7).bitMuch.min + 3);
    run.player.holdDrain(true);
    expect(zorp.guardSide).toBe('front');
    const before = zorp.health;
    run.tick(16, frame({ pressed: ['special3'], aim: { x: 800, y: 160 } }));
    expect(seen.some((e) => e.phase === 'signKnocked' && e.tag === 'zorp')).toBe(true);
    expect(zorp.guardSide).toBeNull();
    expect(zorp.health).toBeLessThan(before);
    const sign = run.dressing.prop('mascot.sign')!;
    expect(sign.visible).toBe(true);
    expect(sign.frame).toBe(PROP.zorpSign.dropped);
    for (let t = 0; t < M.signKnockedMs + 300; t += 16) {
      run.player.meter = createMeter(7, levelTable(7).bitMuch.min + 3);
      run.tick(16, NO_INPUT);
    }
    expect(seen.some((e) => e.phase === 'signBack')).toBe(true);
    expect(zorp.guardSide).toBe('front');
    expect(run.dressing.prop('mascot.sign')?.visible).toBe(false);
  });
});

describe('chapter 7: the mascots fall', () => {
  it('each that falls speeds the others up, and the tourists comment on the first two', async () => {
    const { run, boss, zip, zap } = await atMascots();
    const shown = record(run.bus, 'dialogue:show');
    const mult = () => boss.phase!.attackSpeedMultiplier;
    expect(mult()).toBe(1);
    run.defeat(zip, 'player');
    await settle(run, 4);
    expect(boss.phase?.id).toBe('two');
    expect(mult()).toBeGreaterThan(1);
    const two = mult();
    run.defeat(zap, 'player');
    await settle(run, 4);
    expect(boss.phase?.id).toBe('one');
    expect(mult()).toBeGreaterThan(two);
    const ids = shown.map((s) => s.sequenceId);
    expect(ids).toContain('c7.mascots.first');
    expect(ids).toContain('c7.mascots.second');
  });

  it('the last falls: applause, the tip and the prize off the rack, the night, and the chapter is done', async () => {
    const { run, boss } = await atMascots();
    const seen = record(run.bus, 'mascots:changed');
    const shown = record(run.bus, 'dialogue:show');
    const ended = record(run.bus, 'chapter:completed');
    expect(run.player.kit.weapons).not.toContain('inflatableAlien');
    expect(run.dressing.prop('strip.rack')?.frame).toBe(PROP.inflatableRack.full);
    for (const tag of ['zorp', 'zap', 'zip']) {
      run.defeat(boss.body(tag)!, 'player');
      await settle(run, 3);
    }
    expect(seen.filter((e) => e.phase === 'applause')).toHaveLength(1);
    expect(run.dressing.npc('tipper')?.pos.x).toBeGreaterThan(run.player.pos.x - 1);
    for (let i = 0; i < 4000 && ended.length === 0; i++) {
      run.tick(16, NO_INPUT);
      if (i % 20 === 0) await settle(run, 1);
    }
    const ids = shown.map((s) => s.sequenceId);
    expect(ids.indexOf('c7.mascots.end')).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf('c7.mascots.end')).toBeLessThan(ids.indexOf('c7.weapon.inflatable'));
    expect(ids.indexOf('c7.weapon.inflatable')).toBeLessThan(ids.indexOf('c7.closing'));
    expect(run.player.kit.weapons).toContain('inflatableAlien');
    expect(run.dressing.prop('strip.rack')?.frame).toBe(PROP.inflatableRack.taken);
    expect(run.isNight()).toBe(true);
    expect(run.dressing.prop('strip.lamp1')?.frame).toBe(PROP.eyeLamp.night);
    expect(run.dressing.npc('closing.gary')?.visible).toBe(true);
    expect(run.objective()).toBeNull();
    expect(ended).toHaveLength(1);
  });

  it('a Myko call on the mascots still gives the prize, with no tip scene', async () => {
    const { run, boss } = await atMascots();
    const shown = record(run.bus, 'dialogue:show');
    boss.completeNow('myko');
    await wait(run, 6000);
    expect(shown.map((s) => s.sequenceId)).not.toContain('c7.mascots.end');
    expect(run.player.kit.weapons).toContain('inflatableAlien');
  });
});
