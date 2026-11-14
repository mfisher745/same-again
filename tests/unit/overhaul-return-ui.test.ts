/**
 * The UI side of the two-phase return, as far as it runs headless: the return timeline (`blackStartMs`) and the
 * dev FakeSource's `returnToBar` / `completeBarReturn`. HudScene and ReturnDirector need a real Phaser scene and
 * are covered by the Playwright spec (tests/e2e/return.spec.ts), not here.
 */

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/content/tuning';
import type { GameEventPayloads } from '../../src/core/types';
import { FakeSource } from '../../src/ui/dev/fakeSource';
import { blackStartMs, returnDuration, returnFrame } from '../../src/ui/model/returns';

const ui = TUNING.ui!;

describe('blackStartMs', () => {
  it.each(['sober', 'floor'] as const)('%s: equals the first moment returnFrame is black', (reason) => {
    let first = -1;
    for (let t = 0; t <= returnDuration(reason, ui); t++) {
      if (returnFrame(reason, t, ui).stage === 'black') {
        first = t;
        break;
      }
    }
    expect(first).toBe(blackStartMs(reason, ui));
    // Just before it the cover is not black yet; at it, it is fully black.
    expect(returnFrame(reason, blackStartMs(reason, ui) - 0.5, ui).stage).not.toBe('black');
    expect(returnFrame(reason, blackStartMs(reason, ui), ui).cover).toBe(1);
  });

  it('is built from the stage lengths in tuning', () => {
    expect(blackStartMs('sober', ui)).toBe(ui.soberReturn.flattenMs + ui.soberReturn.fadeMs);
    expect(blackStartMs('floor', ui)).toBe(ui.floorReturn.fallMs + ui.floorReturn.hurryMs + ui.floorReturn.smokeMs);
  });

  it('follows tuning when it changes', () => {
    const longer = { ...ui, soberReturn: { ...ui.soberReturn, fadeMs: ui.soberReturn.fadeMs + 700 }, floorReturn: { ...ui.floorReturn, smokeMs: ui.floorReturn.smokeMs + 700 } };
    for (const reason of ['sober', 'floor'] as const) {
      expect(blackStartMs(reason, longer)).toBe(blackStartMs(reason, ui) + 700);
      expect(returnFrame(reason, blackStartMs(reason, longer), longer).stage).toBe('black');
    }
  });

  it('the cover is never full before black, and stays full through black', () => {
    for (const reason of ['sober', 'floor'] as const) {
      const at = blackStartMs(reason, ui);
      for (let t = 0; t < at; t += 25) expect(returnFrame(reason, t, ui).cover, `${reason} ${t}`).toBeLessThan(1);
      expect(returnFrame(reason, at + ui.soberReturn.blackMs / 2, ui).cover).toBe(1);
    }
  });
});

describe('ReturnFrame', () => {
  it.each(['sober', 'floor'] as const)('%s: has no backdrop (the real world is the stage)', (reason) => {
    for (const t of [0, 300, blackStartMs(reason, ui), returnDuration(reason, ui)]) expect('backdrop' in returnFrame(reason, t, ui)).toBe(false);
  });
});

describe('FakeSource: the two-phase return', () => {
  const watch = (s: FakeSource) => {
    const returning: GameEventPayloads['bar:returning'][] = [];
    const returned: GameEventPayloads['bar:returned'][] = [];
    s.bus.on('bar:returning', (p) => void returning.push(p));
    s.bus.on('bar:returned', (p) => void returned.push(p));
    return { returning, returned };
  };

  it('returnToBar makes barReturning() non-null and emits bar:returning with the spot', () => {
    const s = new FakeSource();
    const { returning, returned } = watch(s);
    expect(s.barReturning()).toBeNull();
    s.returnToBar('floor');
    expect(s.barReturning()).toEqual({ reason: 'floor', andrew: s.andrewAt });
    expect(returning).toEqual([{ reason: 'floor', andrew: s.andrewAt }]);
    expect(returned).toEqual([]);
  });

  it('nothing resets until completeBarReturn()', () => {
    const s = new FakeSource();
    s.buzzValue = 99;
    s.hotOffer = false;
    s.returnToBar('floor');
    expect(s.buzzValue).toBe(99);
    expect(s.hotOffer).toBe(false);
  });

  it('completeBarReturn() clears it, resets, and emits bar:returned', () => {
    const s = new FakeSource();
    const { returned } = watch(s);
    s.buzzValue = 99;
    s.hotOffer = false;
    s.returnToBar('floor');
    s.completeBarReturn();
    expect(s.barReturning()).toBeNull();
    expect(s.buzzValue).toBe(20);
    expect(s.hotOffer).toBe(true);
    expect(returned).toEqual([{ reason: 'floor' }]);
  });

  it('a sober return resets the meter to 0, as the dev harness shows it', () => {
    const s = new FakeSource();
    s.returnToBar('sober');
    s.completeBarReturn();
    expect(s.buzzValue).toBe(0);
  });

  it('a second returnToBar while waiting is ignored: one event, the first reason kept', () => {
    const s = new FakeSource();
    const { returning, returned } = watch(s);
    s.returnToBar('sober');
    s.returnToBar('floor');
    expect(returning).toEqual([{ reason: 'sober', andrew: s.andrewAt }]);
    expect(s.barReturning()?.reason).toBe('sober');
    s.completeBarReturn();
    expect(returned).toEqual([{ reason: 'sober' }]);
  });

  it('completeBarReturn() with nothing waiting does nothing, and a second call after one does nothing', () => {
    const s = new FakeSource();
    const { returned } = watch(s);
    s.buzzValue = 77;
    s.completeBarReturn();
    expect(returned).toEqual([]);
    expect(s.buzzValue).toBe(77);
    s.returnToBar('floor');
    s.completeBarReturn();
    s.completeBarReturn();
    expect(returned).toHaveLength(1);
  });

  it('a new return can start after one completed', () => {
    const s = new FakeSource();
    const { returning, returned } = watch(s);
    s.returnToBar('sober');
    s.completeBarReturn();
    s.returnToBar('floor');
    s.completeBarReturn();
    expect(returning.map((r) => r.reason)).toEqual(['sober', 'floor']);
    expect(returned.map((r) => r.reason)).toEqual(['sober', 'floor']);
  });
});
