/** Chapters 9 and 10 art: every PROP_C910 frame is in the props atlas at its contract size, the console puzzle's shapes are consistent, and the new tiles and the Administrator's sit exist. */

import { describe, expect, it } from 'vitest';
import { PROPS_KEY, animKey } from '../../src/art/keys';
import type { Sheet } from '../../src/art/pixels';
import { PROP } from '../../src/art/props';
import { PROP_C34 } from '../../src/art/propsC34';
import { PROP_C56 } from '../../src/art/propsC56';
import { PROP_C78 } from '../../src/art/propsC78';
import { CONSOLE_SOCKETS, PROOFS, PROOF_SOCKET, PROP_C910, SOCKET_SHAPES } from '../../src/art/propsC910';
import { allSheets } from '../../src/art/sheets';
import { tileIndex } from '../../src/art/tiles';

const sheets = allSheets();
const props = sheets.find((s) => s.key === PROPS_KEY);
const flatten = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(flatten) : typeof v === 'object' && v !== null ? Object.values(v).flatMap(flatten) : [];
const size = (name: string): string => {
  const f = props?.frames.find((x) => x.name === name);
  return f ? `${f.width}x${f.height}` : 'missing';
};
const pixels = (sheet: Sheet | undefined, name: string): string => {
  const f = sheet?.frames.find((x) => x.name === name);
  if (sheet === undefined || f === undefined) return 'missing';
  const out: string[] = [];
  for (let y = f.y; y < f.y + f.height; y++) for (let x = f.x; x < f.x + f.width; x++) out.push(String(sheet.buffer.get(x, y)));
  return out.join(',');
};

describe('chapter 9 and 10 props', () => {
  it('every PROP_C910 frame is in the props atlas, once', () => {
    const names = props?.frames.map((f) => f.name) ?? [];
    expect(flatten(PROP_C910).filter((n) => !names.includes(n))).toEqual([]);
    expect(new Set(names).size).toBe(names.length);
  });

  it('no PROP_C910 key shadows an earlier chapter key in PROP', () => {
    const earlier = new Set([...Object.keys(PROP_C34), ...Object.keys(PROP_C56), ...Object.keys(PROP_C78)]);
    expect(Object.keys(PROP_C910).filter((k) => earlier.has(k))).toEqual([]);
    expect(PROP.baseDesk).toBe(PROP_C910.baseDesk);
  });

  it('frames have their contract sizes', () => {
    expect(size(PROP_C910.baseDesk.seated)).toBe('32x24');
    expect(size(PROP_C910.kitchenette)).toBe('48x24');
    expect(size(PROP_C910.staffNoticeboard.taken)).toBe('32x24');
    expect(size(PROP_C910.baseFridge.open)).toBe('16x24');
    expect(size(PROP_C910.gravitySwitch.thrown.left)).toBe('16x16');
    expect(size(PROP_C910.hangarWindow)).toBe('64x32');
    expect(size(PROP_C910.recordsShelves.taken)).toBe('32x32');
    expect(size(PROP_C910.liftDoors.open)).toBe('32x32');
    expect(size(PROP_C910.drinksCabinet)).toBe('32x32');
    expect(size(PROP_C910.waitingChairs)).toBe('48x16');
    expect(size(PROP_C910.receptionDesk)).toBe('48x24');
    expect(size(PROP_C910.adminDesk)).toBe('48x32');
    expect(size(PROP_C910.deskShield[1])).toBe('64x48');
    expect(size(PROP_C910.screenWall[1])).toBe('64x32');
    expect(size(PROP_C910.broadcastConsole)).toBe('80x32');
    expect(size(PROP_C910.bigButton.pressed)).toBe('16x24');
    expect(size(PROP_C910.coatHook.jacket)).toBe('16x24');
    expect(size(PROP_C910.sunShaft)).toBe('32x32');
    for (const name of Object.values(PROP_C910.reactionCard)) expect(size(name)).toBe('64x40');
    for (const name of Object.values(PROP_C910.socketCloseup)) expect(size(name)).toBe('32x32');
  });

  it('the door timer has a frame for every segment count from 0 to 6', () => {
    expect(PROP_C910.doorTimer).toHaveLength(7);
    expect(new Set(PROP_C910.doorTimer.map((n) => pixels(props, n))).size).toBe(7);
  });

  it('the four gravity switches, arrows and streaks all differ by direction', () => {
    for (const set of [PROP_C910.gravitySwitch, PROP_C910.gravitySwitch.thrown, PROP_C910.slideStreak]) {
      expect(new Set((['up', 'down', 'left', 'right'] as const).map((f) => pixels(props, set[f]))).size).toBe(4);
    }
    expect(new Set((['up', 'down', 'left', 'right'] as const).map((f) => pixels(props, PROP_C910.gravityArrow[f][0]))).size).toBe(4);
  });
});

describe('the broadcast console', () => {
  it('every proof fits exactly one socket and every socket is on the console once', () => {
    const fits = PROOFS.map((p) => PROOF_SOCKET[p]);
    expect(new Set(fits).size).toBe(5);
    expect(CONSOLE_SOCKETS.map((s) => s.shape).sort()).toEqual([...SOCKET_SHAPES].sort());
  });

  it('sockets sit inside the console frame without overlapping', () => {
    const xs = CONSOLE_SOCKETS.map((s) => s.x);
    for (const s of CONSOLE_SOCKETS) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x + 16).toBeLessThanOrEqual(80);
      expect(s.y + 16).toBeLessThanOrEqual(32);
    }
    for (let i = 1; i < xs.length; i++) expect((xs[i] ?? 0) - (xs[i - 1] ?? 0)).toBeGreaterThanOrEqual(14);
  });

  it('the two lookalike sockets differ by only a few pixels at console size, and plainly close up', () => {
    const diff = (a: string, b: string): number => {
      const pa = pixels(props, a).split(',');
      const pb = pixels(props, b).split(',');
      return pa.filter((p, i) => p !== pb[i]).length;
    };
    expect(diff(PROP_C910.socket.square, PROP_C910.socket.notched)).toBeLessThanOrEqual(4);
    expect(diff(PROP_C910.socketCloseup.square, PROP_C910.socketCloseup.notched)).toBeGreaterThanOrEqual(20);
    expect(diff(PROP_C910.socket.circle, PROP_C910.socket.triangle)).toBeGreaterThan(4);
  });

  it('the two lookalikes are not side by side on the console', () => {
    const order = CONSOLE_SOCKETS.map((s) => s.shape);
    expect(Math.abs(order.indexOf('square') - order.indexOf('notched'))).toBeGreaterThan(1);
  });
});

describe('chapter 9 and 10 tiles and figures', () => {
  it('the base has office carpet tiles and a north-south glass partition; Kilnamoe has a daylight window', () => {
    expect(() => tileIndex('base', 'carpetTile')).not.toThrow();
    expect(() => tileIndex('base', 'glassAlong')).not.toThrow();
    expect(() => tileIndex('kilnamoe', 'windowDay')).not.toThrow();
  });

  it('the Administrator can sit on the floor, in his jacket and in his shirt sleeves', () => {
    for (const key of ['boss.c10.boss.administrator', 'boss.c10.boss.administrator.personally']) {
      const sheet = sheets.find((s) => s.key === key);
      for (const facing of ['up', 'down', 'left', 'right'] as const) expect(sheet?.anims.some((a) => a.key === animKey(key, 'sit', facing)), `${key} ${facing}`).toBe(true);
    }
  });
});
