/**
 * The chapter 2 rulings: the forced lurch (ctx.forceLurch), bosses battering a prop (bossBreaksAfterMs, prop:brokenByBoss), the
 * carried-over lesson's fallback (waits for a quiet moment, then move:taughtByFallback), and chapter 2's positional Stumble
 * lesson (the first stack, the practice stack, c2.stumble.done, and no lurch at nothing).
 */

import { describe, expect, it, vi } from 'vitest';
import { chapter2 } from '../../src/chapters/02/index';
import { T } from '../../src/chapters/02/maps';
import { TUNING } from '../../src/content/tuning';
import { createSandboxModule } from '../../src/core/sandbox';
import { createChapter2Sandbox } from '../../src/core/sandbox2';
import { carryOver } from '../../src/systems/session';
import type { ChapterRun } from '../../src/systems/run';
import { NO_INPUT, advance, frame, makeRun, placeAt, record, settleDialogue, startChapterGame } from './helpers';

const px = (c: number, r: number) => ({ x: c * 16 + 8, y: r * 16 + 8 });
const settled = async (run: ChapterRun, ticks = 6): Promise<void> => {
  for (let i = 0; i < ticks; i++) {
    run.tick(50, NO_INPUT);
    await settleDialogue(run);
  }
};

describe('forceLurch', () => {
  /** The chapter 2 sandbox with no script, so the Stumble is NOT in the kit. */
  const bare = () => makeRun({ chapter: 2, module: { ...createChapter2Sandbox(), createScript: undefined } });

  it('works without the move learned: breaks the stack in its lane and moves Andrew', async () => {
    const { run } = bare();
    expect(run.player.kit.moves).not.toContain('stumble');
    placeAt(run, 22, 5);
    run.tick(16, NO_INPUT);
    const broken = record(run.bus, 'prop:broken');
    const from = run.player.pos.x;
    const p = run.forceLurch('right');
    advance(run, 400);
    await p;
    expect(broken.map((b) => b.propId).sort()).toEqual(['yard.bucket1', 'yard.bucket2']);
    expect(run.player.pos.x).toBeGreaterThan(from + 40);
  });

  it('resolves only when it ends, after about forcedLurchMs, and blocks input until then', async () => {
    const { run } = bare();
    placeAt(run, 22, 5);
    run.tick(16, NO_INPUT);
    let done = false;
    void run.forceLurch('right').then(() => (done = true));
    const y0 = run.player.pos.y;
    run.tick(16, frame({ move: { x: 0, y: 1 } }));
    await Promise.resolve();
    expect(done).toBe(false);
    expect(run.player.pos.y).toBe(y0);
    advance(run, TUNING.overhaul!.forcedLurchMs! + 100);
    await Promise.resolve();
    expect(done).toBe(true);
    expect(run.player.pos.y).toBeCloseTo(y0, 3);
    // Input works again.
    run.tick(100, frame({ move: { x: 0, y: 1 } }));
    expect(run.player.pos.y).toBeGreaterThan(y0);
  });

  it('costs nothing: no cooldown, no meter, no drink', () => {
    const { run } = bare();
    placeAt(run, 22, 5);
    run.tick(16, NO_INPUT);
    const drinks = { ...run.player.kit.drinks };
    const cooldowns = JSON.stringify(run.player.kit.slots);
    const meter = run.player.meter.value;
    void run.forceLurch('right', { durationMs: 100 });
    advance(run, 200, 10);
    expect(run.player.kit.drinks).toEqual(drinks);
    expect(JSON.stringify(run.player.kit.slots)).toBe(cooldowns);
    // Only the drain moved the meter (a point per three seconds).
    expect(Math.abs(run.player.meter.value - meter)).toBeLessThan(0.5);
  });

  it('fires move hooks as stumble, and stops at a closed gate', () => {
    const { run } = bare();
    const hits: string[] = [];
    run.onMoveHit({ x: 24 * 16, y: 5 * 16, width: 16, height: 16 }, (h) => hits.push(h.moveId));
    placeAt(run, 22, 5);
    run.tick(16, NO_INPUT);
    void run.forceLurch('right');
    expect(hits).toEqual(['stumble']);
    // And into a shut sheep gate (gate A at col 34): from col 30 it stops short.
    placeAt(run, 30, 5);
    run.tick(16, NO_INPUT);
    advance(run, 400);
    void run.forceLurch('right', { distance: 100 });
    advance(run, 400);
    expect(run.player.pos.x).toBeLessThan(34 * 16);
  });

  it('a second call while one is under way returns the first promise', () => {
    const { run } = bare();
    placeAt(run, 22, 5);
    run.tick(16, NO_INPUT);
    const a = run.forceLurch('right');
    expect(run.forceLurch('left')).toBe(a);
  });

  it('resolves early when he returns to the bar mid-lurch', async () => {
    const { run } = bare();
    placeAt(run, 22, 5);
    run.tick(16, NO_INPUT);
    let done = false;
    void run.forceLurch('right', { durationMs: 5000 }).then(() => (done = true));
    run.player.meter = { ...run.player.meter, value: 0.01 };
    run.tick(16, NO_INPUT);
    advance(run, 100);
    await Promise.resolve();
    expect(done).toBe(true);
  });

  it('resolves early when the run is disposed', async () => {
    const { run } = bare();
    let done = false;
    void run.forceLurch('right', { durationMs: 5000 }).then(() => (done = true));
    run.dispose();
    await Promise.resolve();
    expect(done).toBe(true);
  });

  it('with nothing in the lane it still lurches, and breaks nothing', () => {
    const { run } = bare();
    placeAt(run, 10, 6);
    run.tick(16, NO_INPUT);
    const broken = record(run.bus, 'prop:broken');
    const x0 = run.player.pos.x;
    void run.forceLurch('right');
    advance(run, 400);
    expect(broken).toEqual([]);
    expect(run.player.pos.x).toBeGreaterThan(x0 + 40);
  });
});

describe('bossBreaksAfterMs and prop:brokenByBoss', () => {
  const PAUSE = TUNING.overhaul!.ramGatePauseMs!;
  const setup = () => {
    const { run } = makeRun({ chapter: 2, module: createChapter2Sandbox() });
    const events = record(run.bus, 'prop:brokenByBoss');
    run.startSection('c2.setpiece.ram');
    run.tick(16, NO_INPUT);
    const ram = run.boss('c2.setpiece.ram')!.body('ram')!;
    const gate = () => run.dressing.prop('lane.gate')!;
    /** Holds the ram against the gate for `ms`; returns when the gate went, or -1. */
    const hold = (ms: number): number => {
      for (let t = 0; t < ms; t += 16) {
        ram.pos = px(29, 16);
        run.tick(16, NO_INPUT);
        if (!gate().visible) return t;
      }
      return -1;
    };
    return { run, ram, events, gate, hold };
  };

  it('the ram pauses at the shut gate for the tuned time and then batters it open', () => {
    const { events, gate, hold } = setup();
    expect(gate().visible).toBe(true);
    const at = hold(PAUSE * 3);
    expect(at).toBeGreaterThanOrEqual(PAUSE - 100);
    expect(at).toBeLessThanOrEqual(PAUSE + 100);
    expect(gate().visible).toBe(false);
    expect(events).toEqual([{ propId: 'lane.gate', bossId: 'c2.setpiece.ram', screenId: 'c2.sandbox' }]);
  });

  it('does not break it early', () => {
    const { gate, hold, events } = setup();
    expect(hold(PAUSE - 200)).toBe(-1);
    expect(gate().visible).toBe(true);
    expect(events).toEqual([]);
  });

  it('the time resets if the ram leaves the gate', () => {
    const { run, ram, gate, hold, events } = setup();
    expect(hold(PAUSE * 0.7)).toBe(-1);
    ram.pos = px(15, 16);
    run.tick(16, NO_INPUT);
    expect(hold(PAUSE * 0.7)).toBe(-1);
    expect(gate().visible).toBe(true);
    expect(events).toEqual([]);
  });

  it('an ordinary enemy at the gate does not break it', () => {
    const { run, gate, events } = setup();
    const lad = run.spawnEnemy('lad', px(29, 16));
    for (let t = 0; t < PAUSE * 2; t += 16) {
      lad.pos = px(29, 16);
      run.tick(16, NO_INPUT);
    }
    expect(gate().visible).toBe(true);
    expect(events).toEqual([]);
  });

  it('nothing happens when the gate is already open (E), and the event does not fire', () => {
    const { run, hold, events } = setup();
    run.setPropVisible('lane.gate', false);
    expect(hold(PAUSE * 2)).toBe(0);
    expect(events).toEqual([]);
  });
});

describe('the carried-over lesson fallback', () => {
  const owed = (b: Parameters<NonNullable<Parameters<typeof makeRun>[0]>['save'] & object>[0]) => ({ ...b, owedMoves: [{ moveId: 'stumble' as const, sceneId: 'c2.stumble.lesson' as const, chapter: 2 as const }] });
  const ch3 = () => makeRun({ chapter: 3, module: createSandboxModule(3), save: owed });
  const drinkIntoBitMuch = (run: ChapterRun): void => {
    run.give({ kind: 'drink', drinkId: 'stout', count: 1 });
    run.player.meter = { ...run.player.meter, value: 60 };
    run.drinkFromInventory('stout');
  };

  it('plays at once when nothing else is going on, learns the move, and announces move:taughtByFallback with its slot', async () => {
    const { run, bus } = ch3();
    const shown = record(bus, 'dialogue:show');
    const taught = record(bus, 'move:taughtByFallback');
    drinkIntoBitMuch(run);
    run.tick(16, NO_INPUT);
    expect(shown.map((s) => s.sequenceId)).toContain('c2.stumble.lesson');
    expect(taught).toEqual([]); // not before the scene is read
    await settled(run);
    expect(run.player.kit.moves).toContain('stumble');
    const slot = run.player.kit.slots.specials.indexOf('stumble') + 1;
    expect(slot).toBeGreaterThan(0);
    expect(taught).toEqual([{ moveId: 'stumble', slot }]);
    expect(run.movesOwed()).toEqual([]);
  });

  it('waits out a fight, then plays when it ends, whatever his level by then', async () => {
    const { run, bus } = ch3();
    const shown = record(bus, 'dialogue:show');
    const taught = record(bus, 'move:taughtByFallback');
    run.startSection('c1.fight.chipper');
    run.tick(16, NO_INPUT);
    drinkIntoBitMuch(run);
    await settled(run, 3);
    expect(shown.map((s) => s.sequenceId)).not.toContain('c2.stumble.lesson');
    expect(run.movesOwed()).toEqual(['stumble']);
    // He drops back to Grand during the fight; the lesson is still due when it ends.
    run.player.meter = { ...run.player.meter, value: 40 };
    run.completeCurrent();
    await settled(run, 8);
    expect(shown.map((s) => s.sequenceId)).toContain('c2.stumble.lesson');
    expect(taught).toHaveLength(1);
    expect(run.player.kit.moves).toContain('stumble');
  });

  it('waits out a dialogue scene', async () => {
    const { run, bus } = ch3();
    const shown = record(bus, 'dialogue:show');
    void run.say('c1.pub.open');
    run.tick(16, NO_INPUT);
    expect(run.dialogue.blocking).toBe(true);
    drinkIntoBitMuch(run);
    expect(shown.map((s) => s.sequenceId)).not.toContain('c2.stumble.lesson');
    await settleDialogue(run);
    run.tick(16, NO_INPUT);
    await settled(run, 4);
    expect(run.player.kit.moves).toContain('stumble');
  });

  it('with the move already in the kit nothing plays and nothing is announced', async () => {
    const { run, bus } = ch3();
    run.learnMove('stumble');
    const shown = record(bus, 'dialogue:show');
    const taught = record(bus, 'move:taughtByFallback');
    drinkIntoBitMuch(run);
    await settled(run, 3);
    expect(shown.map((s) => s.sequenceId)).not.toContain('c2.stumble.lesson');
    expect(taught).toEqual([]);
    expect(run.movesOwed()).toEqual([]);
  });

  it('carried from a finished chapter 2 save', async () => {
    const g = startChapterGame(chapter2, 'chapter');
    g.run.tick(16, NO_INPUT);
    g.run.completeSection('c2.explore.shed', 'debug');
    const carried = carryOver(g.run.snapshot(), 'grand', createSandboxModule(3));
    expect(carried.owedMoves).toHaveLength(1);
  });
});

describe('the Stumble lesson in the real farm', () => {
  async function farm() {
    const g = startChapterGame(chapter2, 'chapter');
    g.run.tick(16, NO_INPUT);
    await settleDialogue(g.run);
    g.run.completeSection('c2.explore.shed', 'debug');
    await settleDialogue(g.run);
    g.run.goToScreen('c2.farm', T(2, 2)); // outside the cousins' trigger
    g.run.tick(16, NO_INPUT);
    await settleDialogue(g.run);
    const lurch = vi.spyOn(g.run, 'forceLurch');
    const shown = record(g.run.bus, 'dialogue:show');
    return { ...g, lurch, shown };
  }
  const atBitMuch = async (run: ChapterRun, pos: { x: number; y: number }): Promise<void> => {
    run.setPlayerPosition(pos);
    run.give({ kind: 'drink', drinkId: 'stout', count: 1 });
    run.player.meter = { ...run.player.meter, value: 60 };
    run.drinkFromInventory('stout');
    await settled(run, 8);
  };
  const lessonShown = (shown: { sequenceId: string }[]) => shown.some((s) => s.sequenceId === 'c2.stumble.lesson');

  it('from a clear spot a few tiles off, he lurches into the stack, breaks it, then Myko explains and he learns it', async () => {
    const { run, lurch, shown } = await farm();
    const broken = record(run.bus, 'prop:broken');
    await atBitMuch(run, px(5, 15));
    expect(lurch).toHaveBeenCalledTimes(1);
    expect(broken.map((b) => b.propId).some((id) => id.startsWith('yard.bucket'))).toBe(true);
    expect(run.flag('stack1.broken')).toBe(true);
    expect(lessonShown(shown)).toBe(true);
    expect(run.player.kit.moves).toContain('stumble');
    expect(run.flag('stumble.taught')).toBe(true);
  });

  it('with the first stack already broken the lesson plays with no lurch', async () => {
    const { run, lurch, shown } = await farm();
    run.setFlag('stack1.broken', true);
    await atBitMuch(run, px(5, 15));
    expect(lurch).not.toHaveBeenCalled();
    expect(lessonShown(shown)).toBe(true);
    expect(run.player.kit.moves).toContain('stumble');
  });

  describe('no lurch at nothing: the lesson waits', () => {
    it('too far from the stack', async () => {
      const { run, lurch, shown } = await farm();
      await atBitMuch(run, px(5, 2));
      expect(lurch).not.toHaveBeenCalled();
      expect(lessonShown(shown)).toBe(false);
    });

    it('too close to it', async () => {
      const { run, lurch } = await farm();
      await atBitMuch(run, px(5, 20));
      expect(lurch).not.toHaveBeenCalled();
    });

    it('from the yard south of row 25 (the practice stack end)', async () => {
      const { run, lurch } = await farm();
      await atBitMuch(run, { x: 5 * 16 + 8, y: 26 * 16 });
      expect(lurch).not.toHaveBeenCalled();
    });

    it('with the sleeping dog on the line to the stack', async () => {
      const { run, lurch, shown } = await farm();
      await atBitMuch(run, { x: 136, y: 398 });
      expect(lurch).not.toHaveBeenCalled();
      expect(lessonShown(shown)).toBe(false);
    });

    it('from the field side of the fence', async () => {
      const { run, lurch } = await farm();
      await atBitMuch(run, px(12, 20));
      expect(lurch).not.toHaveBeenCalled();
    });

    it('into the cousins\' fight', async () => {
      const { run, lurch, shown } = await farm();
      run.setFlag('cousins.started', true);
      await atBitMuch(run, px(5, 15));
      expect(lurch).not.toHaveBeenCalled();
      expect(lessonShown(shown)).toBe(false);
    });

    it('before the shed is done', async () => {
      const g = startChapterGame(chapter2, 'chapter');
      g.run.tick(16, NO_INPUT);
      await settleDialogue(g.run);
      g.run.goToScreen('c2.farm', T(2, 11));
      g.run.tick(16, NO_INPUT);
      await settleDialogue(g.run);
      const lurch = vi.spyOn(g.run, 'forceLurch');
      await atBitMuch(g.run, px(5, 15));
      expect(lurch).not.toHaveBeenCalled();
    });

    it('off the farm screen', async () => {
      const { run, lurch } = await farm();
      run.goToScreen('c2.bog', T(6, 28));
      run.tick(16, NO_INPUT);
      await settleDialogue(run);
      await atBitMuch(run, px(6, 28));
      expect(lurch).not.toHaveBeenCalled();
    });

    it('then, once he walks to a good spot, the lesson plays on its own', async () => {
      const { run, lurch, shown } = await farm();
      await atBitMuch(run, px(5, 2));
      expect(lurch).not.toHaveBeenCalled();
      run.setPlayerPosition(px(5, 15));
      await settled(run, 20); // the script looks again every half second
      expect(lurch).toHaveBeenCalledTimes(1);
      expect(lessonShown(shown)).toBe(true);
    });
  });

  describe('the practice stack and c2.stumble.done', () => {
    /** Andrew with the Stumble learned, at Bit much, at the west wall, two tiles from the practice stack (cols 6 to 7, rows 27 to 28; the lurch ends on the gate's exit tiles). */
    async function practise(taught: boolean) {
      const g = await farm();
      g.run.learnMove('stumble');
      if (taught) g.run.setFlag('stumble.taught', true);
      g.run.player.meter = { ...g.run.player.meter, value: 75 };
      g.run.tick(16, NO_INPUT);
      expect(g.run.player.level).toBe(3);
      const slot = g.run.player.kit.slots.specials.indexOf('stumble') + 1;
      const doneLines = () => g.shown.filter((s) => s.sequenceId === 'c2.stumble.done').length;
      const stumble = async (): Promise<void> => {
        g.run.goToScreen('c2.farm', px(1, 27));
        const aim = { x: 12 * 16, y: 27 * 16 + 8 };
        g.run.tick(16, frame({ aim }));
        g.run.tick(16, frame({ pressed: [`special${slot}` as 'special1'], aim }));
        await settled(g.run, 3);
        advance(g.run, 13_000); // out the cooldown
      };
      return { ...g, stumble, doneLines };
    }

    it('his own Stumble through the practice stack plays c2.stumble.done once', async () => {
      const p = await practise(true);
      await p.stumble();
      expect(p.doneLines()).toBe(1);
      expect(p.run.flag('stumble.done')).toBe(true);
      p.run.player.meter = { ...p.run.player.meter, value: 75 };
      await p.stumble();
      expect(p.doneLines()).toBe(1);
    });

    it('not before the lesson has been taught (the accidental lurch does not count)', async () => {
      const p = await practise(false);
      await p.stumble();
      expect(p.doneLines()).toBe(0);
      expect(p.run.flag('stumble.done')).not.toBe(true);
    });

    it('the first stack\'s accidental lurch does not finish it', async () => {
      const { run, shown } = await farm();
      await atBitMuch(run, px(5, 15));
      expect(shown.some((s) => s.sequenceId === 'c2.stumble.done')).toBe(false);
      expect(run.flag('stumble.done')).not.toBe(true);
    });
  });
});
