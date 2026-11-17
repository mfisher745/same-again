/** Chapters 5 and 6 art: every PROP_C56 frame is in the props atlas at its contract size, and the new tiles have the right flags. */

import { describe, expect, it } from 'vitest';
import { PROPS_KEY, animKey } from '../../src/art/keys';
import { PROP_C56 } from '../../src/art/propsC56';
import { allSheets } from '../../src/art/sheets';
import { tileFlags, tileIndex } from '../../src/art/tiles';

const sheets = allSheets();
const props = sheets.find((s) => s.key === PROPS_KEY);
const flatten = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(flatten) : typeof v === 'object' && v !== null ? Object.values(v).flatMap(flatten) : [];

describe('chapter 5 and 6 props', () => {
  it('every PROP_C56 frame is in the props atlas', () => {
    const names = new Set(props?.frames.map((f) => f.name));
    expect(flatten(PROP_C56).filter((n) => !names.has(n))).toEqual([]);
  });

  it('frames have their contract sizes', () => {
    const size = (name: string): string => {
      const f = props?.frames.find((x) => x.name === name);
      return f ? `${f.width}x${f.height}` : 'missing';
    };
    expect(size(PROP_C56.photocopier.jammed)).toBe('16x24');
    expect(size(PROP_C56.lightbox.lit)).toBe('32x16');
    expect(size(PROP_C56.rollingShelf.mid)).toBe('32x16');
    expect(size(PROP_C56.waterTower)).toBe('32x48');
    expect(size(PROP_C56.flag[1])).toBe('16x32');
    expect(size(PROP_C56.dustPlume[2])).toBe('32x32');
    expect(size(PROP_C56.sensorLight.broken)).toBe('8x8');
  });
});

describe('chapter 5 and 6 tiles', () => {
  it('cities has a lit rail, walkable', () => {
    expect(tileFlags('cities', tileIndex('cities', 'railLit'))).toEqual({ blocked: false, blocksSight: false });
  });
  it('ohio corn: standing corn hides (walkable, blocks sight), stubble is open, the maze wall blocks both', () => {
    expect(tileFlags('ohio', tileIndex('ohio', 'cornStanding'))).toEqual({ blocked: false, blocksSight: true });
    expect(tileFlags('ohio', tileIndex('ohio', 'cornStubble'))).toEqual({ blocked: false, blocksSight: false });
    expect(tileFlags('ohio', tileIndex('ohio', 'cornWall'))).toEqual({ blocked: true, blocksSight: true });
  });
});

describe('drone', () => {
  it('has a low animation in every facing', () => {
    const drone = sheets.find((s) => s.key === 'enemy.drone');
    for (const facing of ['up', 'down', 'left', 'right'] as const) {
      expect(drone?.anims.some((a) => a.key === animKey('enemy.drone', 'low', facing))).toBe(true);
    }
  });
});
