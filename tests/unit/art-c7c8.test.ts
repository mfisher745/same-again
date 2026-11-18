/** Chapters 7 and 8 art: every PROP_C78 frame is in the props atlas at its contract size, and the costumed NPC looks exist and behave. */

import { describe, expect, it } from 'vitest';
import { PROPS_KEY, animKey, icon, npcKey, TEX } from '../../src/art/keys';
import type { Sheet } from '../../src/art/pixels';
import { PROP_C78 } from '../../src/art/propsC78';
import { allSheets } from '../../src/art/sheets';

const sheets = allSheets();
const props = sheets.find((s) => s.key === PROPS_KEY);
const flatten = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(flatten) : typeof v === 'object' && v !== null ? Object.values(v).flatMap(flatten) : [];
const size = (name: string): string => {
  const f = props?.frames.find((x) => x.name === name);
  return f ? `${f.width}x${f.height}` : 'missing';
};

describe('chapter 7 and 8 props', () => {
  it('every PROP_C78 frame is in the props atlas, once', () => {
    const names = props?.frames.map((f) => f.name) ?? [];
    const wanted = flatten(PROP_C78);
    expect(wanted.filter((n) => !names.includes(n))).toEqual([]);
    expect(new Set(names).size).toBe(names.length);
  });

  it('frames have their contract sizes', () => {
    expect(size(PROP_C78.photoBooth)).toBe('32x32');
    expect(size(PROP_C78.eyeLamp.night)).toBe('16x32');
    expect(size(PROP_C78.inflatableRack.taken)).toBe('64x32');
    expect(size(PROP_C78.saucerDiner)).toBe('256x48');
    expect(size(PROP_C78.busStop.shelter)).toBe('48x32');
    expect(size(PROP_C78.snowGlobeShelf)).toBe('32x24');
    expect(size(PROP_C78.staffFridge.open)).toBe('16x24');
    expect(size(PROP_C78.deliveryVan.left)).toBe('48x32');
    expect(size(PROP_C78.zorpSign.dropped)).toBe('24x16');
    expect(size(PROP_C78.awning)).toBe('64x32');
    expect(size(PROP_C78.govCar.right)).toBe('48x24');
    expect(size(PROP_C78.rockOutcrop.large)).toBe('48x32');
    expect(size(PROP_C78.rockOutcrop.small)).toBe('32x24');
    expect(size(PROP_C78.thermalMast[1])).toBe('16x48');
    expect(size(PROP_C78.barrierArm.up)).toBe('48x48');
    expect(size(PROP_C78.flashbangMarker[1])).toBe('32x32');
    expect(size(PROP_C78.truckPath.along[1])).toBe('16x16');
  });

  it('there is a junction box, lever up and thrown, for each of the ten pairs of five lines', () => {
    expect(Object.keys(PROP_C78.junctionBox.lines)).toHaveLength(10);
    for (const name of [...Object.values(PROP_C78.junctionBox.lines), ...Object.values(PROP_C78.junctionBox.thrown)]) expect(size(name)).toBe('16x24');
  });
});

/** The pixels of one named frame, as a string, to compare frames. */
const pixels = (sheet: Sheet, name: string): string => {
  const f = sheet.frames.find((x) => x.name === name);
  if (f === undefined) return 'missing';
  const out: string[] = [];
  for (let y = f.y; y < f.y + f.height; y++) for (let x = f.x; x < f.x + f.width; x++) out.push(String(sheet.buffer.get(x, y)));
  return out.join(',');
};

describe('chapter 7 costumed figures', () => {
  const figures = ['costumeA', 'costumeB', 'costumeC', 'costumeD', 'costumeE', 'gary', 'roswellBartender'];

  it('each has idle and walk in every facing, in a 16 x 28 cell', () => {
    for (const id of figures) {
      const sheet = sheets.find((s) => s.key === npcKey(id));
      expect(sheet, id).toBeDefined();
      for (const facing of ['up', 'down', 'left', 'right'] as const) {
        expect(sheet?.anims.some((a) => a.key === animKey(npcKey(id), 'idle', facing))).toBe(true);
        expect(sheet?.anims.some((a) => a.key === animKey(npcKey(id), 'walk', facing))).toBe(true);
      }
      expect(sheet?.frames[0]?.height).toBe(28);
    }
  });

  it('the six look different from each other', () => {
    const fronts = ['costumeA', 'costumeB', 'costumeC', 'costumeD', 'costumeE', 'gary'].map((id) => {
      const sheet = sheets.find((s) => s.key === npcKey(id));
      return sheet ? pixels(sheet, 'idle.down.0') : id;
    });
    expect(new Set(fronts).size).toBe(6);
  });

  it('tourists fidget; aliens stand too still', () => {
    const moves = (id: string): boolean => {
      const sheet = sheets.find((s) => s.key === npcKey(id));
      if (sheet === undefined) return false;
      return pixels(sheet, 'idle.down.0') !== pixels(sheet, 'idle.down.1');
    };
    expect(['costumeA', 'costumeC', 'costumeE'].map(moves)).toEqual([true, true, true]);
    expect(['costumeB', 'costumeD', 'gary'].map(moves)).toEqual([false, false, false]);
  });
});

describe('chapter 8 HUD', () => {
  it('has the sun icon', () => {
    const icons = sheets.find((s) => s.key === TEX.icons);
    expect(icons?.frames.some((f) => f.name === icon.sun)).toBe(true);
  });
});
