/** The lightbox screen's model and the fake source it is built against (the scene itself needs Phaser). */

import { describe, expect, it } from 'vitest';
import { FakeSource } from '../../src/ui/dev/fakeSource';
import { REDACTED_ON, SheetPicks } from '../../src/ui/model/picks';

const IDS = ['sheet1', 'sheet2', 'sheet3', 'sheet4', 'sheet5'];

describe('SheetPicks', () => {
  it('takes up to three in the order picked, drops one picked again, and ignores unknown or held-back sheets', () => {
    const p = new SheetPicks(IDS.slice(0, 4));
    expect(p.toggle('sheet4')).toBe(true);
    expect(p.toggle('sheet1')).toBe(true);
    expect(p.toggle('sheet5')).toBe(false);
    expect(p.toggle('sheet3')).toBe(true);
    expect(p.complete).toBe(true);
    expect(p.toggle('sheet2')).toBe(false);
    expect(p.picks()).toEqual(['sheet4', 'sheet1', 'sheet3']);
    expect(p.order('sheet1')).toBe(2);
    expect(p.toggle('sheet1')).toBe(true);
    expect(p.complete).toBe(false);
    p.clear();
    expect(p.picks()).toEqual([]);
  });
});

describe('the fake source for the lightbox', () => {
  const view = (collected: readonly string[]) => ({
    puzzleId: 'c5.puzzle.redacted' as const,
    promptTextId: 'c5.redacted.prompt',
    sheets: IDS.map((id) => ({ id, collected: collected.includes(id) })),
    pick: 3 as const,
  });

  it('shows nothing until a view is set, refuses sheets not held, tells right from wrong and shuts on the right set', () => {
    const s = new FakeSource();
    expect(s.activeRedaction()).toBeNull();
    s.redaction = view(['sheet1', 'sheet2', 'sheet3', 'sheet4']);
    expect(s.submitRedaction('c5.puzzle.redacted', ['sheet1', 'sheet2', 'sheet5']).refused).toBe(true);
    expect(s.submitRedaction('c5.puzzle.redacted', ['sheet1', 'sheet2', 'sheet3'])).toEqual({ correct: false, textId: 'c5.redacted.wrong', refused: false });
    expect(s.activeRedaction()).not.toBeNull();
    expect(s.submitRedaction('c5.puzzle.redacted', ['sheet3', 'sheet4', 'sheet1'])).toEqual({ correct: true, textId: 'c5.redacted.right', refused: false });
    expect(s.activeRedaction()).toBeNull();
  });

  it('steps back', () => {
    const s = new FakeSource();
    s.redaction = view(IDS);
    s.closeRedaction();
    expect(s.activeRedaction()).toBeNull();
  });
});

describe('the black bars on the five sheets', () => {
  const words = 12;
  const shows = (sheets: readonly number[], w: number): boolean => sheets.some((i) => !REDACTED_ON[w]!.includes(i));
  it('the first, third and fourth together show every word; every other three leave a word blacked out', () => {
    expect(REDACTED_ON).toHaveLength(words);
    for (let a = 0; a < 5; a++)
      for (let b = a + 1; b < 5; b++)
        for (let c = b + 1; c < 5; c++) {
          const all = Array.from({ length: words }, (_, w) => shows([a, b, c], w)).every(Boolean);
          expect(all, `${a + 1},${b + 1},${c + 1}`).toBe(a === 0 && b === 2 && c === 3);
        }
  });
});
