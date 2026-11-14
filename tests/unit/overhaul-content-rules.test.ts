/**
 * Content rules from DESIGN.md that a script can check across every file in
 * `src/content/dialogue/`: the Myko rule (section 3) and the "leave out"
 * vocabulary list (section 2). Violations are text for the creative director to
 * fix; they are marked `it.fails` below with the list, so the build stays green
 * and the test turns red the moment the text is fixed (remove the `.fails`).
 */

import { describe, expect, it } from 'vitest';
import { allSequenceIds, allTextIds, sequence, text } from '../../src/content/dialogue';

interface Found {
  readonly where: string;
  readonly text: string;
}

const lines = (): Found[] => {
  const out: Found[] = [];
  for (const id of allSequenceIds()) for (const l of sequence(id).lines) out.push({ where: `${id}:${l.id}:${l.speaker}`, text: l.text });
  return out;
};
/** System and UI text keys (names, prompts, labels, casebook cards). */
const texts = (): Found[] => allTextIds().map((id) => ({ where: id, text: text(id) }));

// ---------------------------------------------------------------------------
// The Myko rule: nobody except Andrew speaks to, answers, looks at or mentions Myko.
// ---------------------------------------------------------------------------

const MYKO_NAMED = /\bmyko\b/i;

/**
 * Lines whose speaker is neither Andrew nor Myko and that name Myko. The narrator
 * is not a character, and DESIGN.md section 3 gives it the blackout when Myko is
 * called in ("myko.call.*.blackout.*"), so captions there may name him; a narrator
 * line anywhere else may not.
 */
export const mykoNamedByOthers = (): Found[] =>
  allSequenceIds().flatMap((id) =>
    sequence(id)
      .lines.filter((l) => l.speaker !== 'andrew' && l.speaker !== 'myko' && MYKO_NAMED.test(l.text))
      .filter((l) => !(l.speaker === 'narrator' && id.includes('.blackout.')))
      .map((l) => ({ where: `${id}:${l.id}:${l.speaker}`, text: l.text })),
  );

describe('the Myko rule', () => {
  it('there are speaker lines to check', () => {
    expect(lines().length).toBeGreaterThan(100);
    expect(lines().some((l) => l.where.endsWith(':myko'))).toBe(true);
    expect(lines().some((l) => l.where.endsWith(':andrew'))).toBe(true);
  });

  it('no line by anyone but Andrew or Myko names Myko', () => {
    const found = mykoNamedByOthers();
    expect(found, JSON.stringify(found, null, 1)).toEqual([]);
  });

  // CANDIDATES for the creative director (heuristic, adjacency only): 9 lines by another character directly after a Myko line.
  // c1.pub.open.04 dympna, c1.chipper.intro.06 npc, c1.bigTom.end.07 npc, c4.bar.open.03 colleenAnn, c4.bar.colleenHelp.04 colleenAnn,
  // c4.call.fight.02 colleenAnn, c5.bar.open.03 npc, c8.call.pruitt.02 pruitt, c10.open.04 npc. Some may be fine (a reply to Andrew's action);
  // fix or confirm each, then delete `.fails`.
  it.fails('no one but Andrew answers a Myko line: in a sequence, the line after Myko is Myko, Andrew or the narrator', () => {
    const found: Found[] = [];
    for (const id of allSequenceIds()) {
      const ls = sequence(id).lines;
      ls.forEach((l, i) => {
        const prev = ls[i - 1];
        if (prev?.speaker === 'myko' && !['andrew', 'myko', 'narrator'].includes(l.speaker)) found.push({ where: `${id}:${l.id}:${l.speaker}`, text: l.text });
      });
    }
    expect(found, JSON.stringify(found, null, 1)).toEqual([]);
  });

  it('the blackout captions are the only narrator lines that name him (the exemption is real, not a hole)', () => {
    const narrated = lines().filter((l) => l.where.endsWith(':narrator') && MYKO_NAMED.test(l.text));
    expect(narrated.length).toBeGreaterThan(0);
    expect(narrated.every((l) => l.where.includes('.blackout.'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Vocabulary: the "Leave out" row of the table in DESIGN.md section 2.
// ---------------------------------------------------------------------------

const LEAVE_OUT: readonly (readonly [string, RegExp])[] = [
  ['banjaxed', /\bbanjaxed\b/i],
  ['scarlet', /\bscarlet\b/i],
  ['deadly', /\bdeadly\b/i],
  ['the messages', /\bthe messages\b/i],
  ['the press', /\bthe press\b/i],
  ['the jacks', /\bthe jacks\b/i],
  ['a naggin', /\bnaggin\b/i],
  ['now we\'re sucking diesel', /sucking diesel/i],
  ['it\'s a soft day', /\bsoft day\b/i],
  ['the immersion', /\bthe immersion\b/i],
  ['hang sandwiches', /\bhang sandwich/i],
  ['a 99', /\ba 99\b/i],
  ['the Angelus', /\bangelus\b/i],
  ['a removal', /\ba removal\b/i],
  ['the NCT', /\bthe NCT\b|\bNCT\b/],
];

/** Every player-visible string that uses a "leave out" word, with the word. */
export const leaveOutHits = (): (Found & { readonly word: string })[] =>
  [...lines(), ...texts()].flatMap((f) => LEAVE_OUT.filter(([, re]) => re.test(f.text)).map(([word]) => ({ ...f, word })));

describe('vocabulary (DESIGN.md section 2, "Leave out")', () => {
  it('the word list is the one in DESIGN.md', () => {
    expect(LEAVE_OUT).toHaveLength(15);
  });

  it('no dialogue line or text uses a "leave out" word', () => {
    const found = leaveOutHits();
    expect(found, JSON.stringify(found, null, 1)).toEqual([]);
  });
});
