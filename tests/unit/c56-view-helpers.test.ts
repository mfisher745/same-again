import { describe, expect, it } from 'vitest';
import {
  baleShadowFrame,
  COMBINE_TEXTURE,
  cutCornTiles,
  DITCH_SINK_MAX_PX,
  ditchSinkPx,
  isSensorLightBody,
  loopFrame,
  PLUME_SPACING,
  plumeSpots,
  shelfRowFrame,
} from '../../src/systems/view/c56';
import type { CombineLane } from '../../src/systems/combine';

describe('chapter 5 and 6 view helpers', () => {
  it('shelf frames by row: top first, bottom last, mid between', () => {
    expect([0, 1, 5, 10, 11].map((r) => shelfRowFrame(r, 12))).toEqual(['top', 'mid', 'mid', 'mid', 'bottom']);
    expect(shelfRowFrame(0, 1)).toBe('top');
  });

  it('the plume loops its frames by time', () => {
    expect([0, 100, 200, 340, 520].map((ms) => loopFrame(ms, 6, 3))).toEqual([0, 0, 1, 2, 0]);
    expect(loopFrame(-50, 6, 3)).toBe(0);
  });

  it('tiles drawn as stubble are the original corn that no longer stands', () => {
    const original = [{ col: 1, row: 1 }, { col: 2, row: 1 }, { col: 3, row: 1 }];
    expect(cutCornTiles(original, new Set(['1,1', '3,1']))).toEqual([{ col: 2, row: 1 }]);
    expect(cutCornTiles(original, new Set())).toHaveLength(3);
    expect(cutCornTiles(original, new Set(['1,1', '2,1', '3,1']))).toEqual([]);
  });

  it('plume spots run along the lane, only the part still ahead', () => {
    const lane: CombineLane = { id: 'l', axis: 'vertical', at: 100, from: 0, to: 320 };
    const all = plumeSpots(lane, 0);
    expect(all).toHaveLength(320 / PLUME_SPACING);
    for (const p of all) expect(Math.abs(p.x - 100)).toBeLessThanOrEqual(10);
    const ahead = plumeSpots(lane, 160);
    expect(ahead.length).toBeLessThan(all.length);
    for (const p of ahead) expect(p.y).toBeGreaterThanOrEqual(160);
    const back: CombineLane = { id: 'b', axis: 'horizontal', at: 50, from: 320, to: 0 };
    const rev = plumeSpots(back, 100);
    for (const p of rev) expect(p.x).toBeLessThanOrEqual(100);
  });

  it('the bale shadow is on frame 0 when thrown and 1 just before it lands', () => {
    expect(baleShadowFrame(0)).toBe(0);
    expect(baleShadowFrame(0.3)).toBe(0);
    expect(baleShadowFrame(0.9)).toBe(1);
    expect(baleShadowFrame(1)).toBe(1);
  });

  it('the harvester sinks only near the end of the ditch', () => {
    expect(ditchSinkPx(200)).toBe(0);
    expect(ditchSinkPx(20)).toBeGreaterThan(0);
    expect(ditchSinkPx(0)).toBe(DITCH_SINK_MAX_PX);
    expect(ditchSinkPx(-5)).toBe(DITCH_SINK_MAX_PX);
  });

  it('only the combine\'s lightN bodies are sensor lights', () => {
    expect(isSensorLightBody('light2', COMBINE_TEXTURE)).toBe(true);
    expect(isSensorLightBody('harvester', COMBINE_TEXTURE)).toBe(false);
    expect(isSensorLightBody('light1', 'enemy.drone')).toBe(false);
  });
});
