/** src/ui/model: dialogue queue and typewriter, wrapping, HUD, deduction selection, casebook, overlays. */

import { describe, expect, it } from 'vitest';
import { hasText, sequence, text } from '../../src/content/dialogue';
import type { DialogueId, DialogueLine, DialogueSequence, Kit, MoveSlotView } from '../../src/core/types';
import { DIALOGUE_TEXT, DIALOGUE_TIMING } from '../../src/ui/layout';
import { CASEBOOK_TABS, groupCasebook, tabTextId, toItem } from '../../src/ui/model/casebook';
import { LINKS_REQUIRED, LinkSelection } from '../../src/ui/model/deduction';
import { DialogueQueue } from '../../src/ui/model/dialogue';
import { FakeSource } from '../../src/ui/dev/fakeSource';
import { buildHudModel, flatness, meterWidth, perimeterSegments } from '../../src/ui/model/hud';
import { levelTable } from '../../src/systems/meter';
import { OverlayTracker } from '../../src/ui/model/overlay';
import { paginate, wrapText } from '../../src/ui/model/wrap';

describe('wrapText', () => {
  it('wraps greedily at 64 characters on word breaks', () => {
    const words = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');
    const lines = wrapText(words, 64);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(64);
    expect(lines.join(' ')).toBe(words);
  });
  it('keeps a short line whole and drops extra whitespace', () => {
    expect(wrapText('hello   world', 64)).toEqual(['hello world']);
    expect(wrapText('', 64)).toEqual([]);
    expect(wrapText('   ', 64)).toEqual([]);
  });
  it('exactly 64 characters stays on one line, 65 breaks', () => {
    const a = 'a'.repeat(32);
    expect(wrapText(`${a} ${a.slice(1)}`, 64)).toHaveLength(1); // 32 + 1 + 31 = 64
    expect(wrapText(`${a} ${a}`, 64)).toHaveLength(2); // 65
  });
  it('splits a word longer than the width', () => {
    expect(wrapText('x'.repeat(130), 64).map((l) => l.length)).toEqual([64, 64, 2]);
  });
});

describe('paginate', () => {
  it('three lines per page, more text makes more pages, never empty', () => {
    const long = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    const pages = paginate(long, 64, 3);
    expect(pages.length).toBeGreaterThan(1);
    for (const p of pages) expect(p.length).toBeLessThanOrEqual(3);
    expect(paginate('', 64, 3)).toEqual([[]]);
  });
  it('every real dialogue line fits one page', () => {
    // Pairs with the 192 character content rule: no line needs a second page.
    const ids = ['c1.pub.open', 'c1.pub.stool'];
    for (const id of ids) for (const l of sequence(id).lines) expect(paginate(l.text, DIALOGUE_TEXT.maxChars, DIALOGUE_TEXT.maxLines)).toHaveLength(1);
  });
  it('layout says 64 characters and 3 lines', () => {
    expect(DIALOGUE_TEXT.maxChars).toBe(64);
    expect(DIALOGUE_TEXT.maxLines).toBe(3);
  });
});

// ---------------------------------------------------------------------------

const line = (id: string, speaker: DialogueLine['speaker'], t: string): DialogueLine => ({ id, speaker, text: t });
const seq = (id: DialogueId, delivery: DialogueSequence['delivery'], ...texts: [DialogueLine['speaker'], string][]): DialogueSequence => ({
  id,
  delivery,
  lines: texts.map(([sp, t], i) => line(`${id}.${i + 1}`, sp, t)),
});

function queue(seqs: DialogueSequence[]) {
  const finished: DialogueId[] = [];
  const chars: string[] = [];
  const errors: string[] = [];
  const q = new DialogueQueue({
    lookup: (id) => {
      const s = seqs.find((x) => x.id === id);
      if (!s) throw new Error('missing');
      return s;
    },
    speakerName: (l) => (l.speaker === 'narrator' ? null : l.speaker.toUpperCase()),
    onFinished: (id) => void finished.push(id),
    onChar: (l) => void chars.push(l.speaker),
    onError: (id) => void errors.push(id),
  });
  return { q, finished, chars, errors };
}

describe('DialogueQueue', () => {
  it('plays sequences in the order they were enqueued, one at a time', () => {
    const { q, finished } = queue([seq('a', 'box', ['andrew', 'one']), seq('b', 'box', ['myko', 'two'])]);
    q.enqueue('a');
    q.enqueue('b');
    expect(q.view()?.sequenceId).toBe('a');
    expect(q.queued).toBe(1);
    for (let i = 0; i < 400; i++) q.update(16);
    expect(finished).toEqual(['a', 'b']);
    expect(q.idle).toBe(true);
    expect(q.view()).toBeNull();
  });

  it('steps through the lines of a sequence in order', () => {
    const { q } = queue([seq('a', 'box', ['andrew', 'first'], ['myko', 'second'])]);
    q.enqueue('a');
    const seen: string[] = [];
    for (let i = 0; i < 600; i++) {
      q.update(16);
      const v = q.view();
      if (v && v.lines[0] && !seen.includes(v.lines[0])) seen.push(v.lines[0]);
    }
    expect(seen).toEqual(['first', 'second']);
  });

  it('typewriter reveals characterPerSecond characters per second and reports revealed', () => {
    const { q } = queue([seq('a', 'scene', ['andrew', 'abcdefghij'])]);
    q.enqueue('a');
    expect(q.view()?.shown).toEqual(['']);
    q.update(1000 / DIALOGUE_TIMING.charsPerSecond);
    expect(q.view()?.shown).toEqual(['a']);
    q.update((1000 / DIALOGUE_TIMING.charsPerSecond) * 4);
    expect(q.view()?.shown).toEqual(['abcde']);
    expect(q.view()?.revealed).toBe(false);
    q.update(10_000);
    expect(q.view()?.shown).toEqual(['abcdefghij']);
    expect(q.view()?.revealed).toBe(true);
  });

  it('the typewriter cuts across wrapped lines', () => {
    const t = `${'a'.repeat(40)} ${'b'.repeat(40)}`;
    const { q } = queue([seq('a', 'scene', ['myko', t])]);
    q.enqueue('a');
    q.update((50 * 1000) / DIALOGUE_TIMING.charsPerSecond);
    const v = q.view();
    expect(v?.lines).toEqual(['a'.repeat(40), 'b'.repeat(40)]);
    expect(v?.shown).toEqual(['a'.repeat(40), 'b'.repeat(10)]);
  });

  it('scene delivery blocks play and waits for advance; the first advance completes the line, the next moves on', () => {
    const { q, finished } = queue([seq('s', 'scene', ['dympna', 'hello there'], ['andrew', 'hi'])]);
    q.enqueue('s');
    expect(q.blocking).toBe(true);
    q.update(10_000);
    expect(q.view()?.awaitingAdvance).toBe(true);
    expect(q.view()?.lineIndex).toBe(0);
    q.advance();
    expect(q.view()?.lineIndex).toBe(1);
    q.update(10);
    q.advance(); // skips to the end of the typewriter
    expect(q.view()?.revealed).toBe(true);
    expect(finished).toEqual([]);
    q.advance();
    expect(finished).toEqual(['s']);
    expect(q.blocking).toBe(false);
  });

  it('box and caption delivery never block and ignore advance', () => {
    const { q } = queue([seq('b', 'box', ['myko', 'commentary']), seq('c', 'caption', ['narrator', 'A Quiet Pint'])]);
    q.enqueue('b');
    expect(q.blocking).toBe(false);
    q.advance();
    expect(q.view()?.lineIndex).toBe(0);
    expect(q.view()?.shown[0]).toBe('');
  });

  it('box lines advance on their own after the hold time', () => {
    const { q, finished } = queue([seq('b', 'box', ['myko', 'hi'])]);
    q.enqueue('b');
    q.update(1000);
    expect(finished).toEqual([]);
    q.update(DIALOGUE_TIMING.boxHoldBaseMs + 2000);
    q.update(16);
    expect(finished).toEqual(['b']);
  });

  it('blips once per visible character, not for spaces, and not for captions', () => {
    const a = queue([seq('b', 'box', ['andrew', 'a b c'])]);
    a.q.enqueue('b');
    a.q.update(5000);
    expect(a.chars).toHaveLength(3);
    const c = queue([seq('c', 'caption', ['narrator', 'hello'])]);
    c.q.enqueue('c');
    c.q.update(5000);
    expect(c.chars).toHaveLength(0);
  });

  it('a missing sequence reports an error and still finishes, so nothing waits forever', () => {
    const { q, finished, errors } = queue([seq('b', 'box', ['myko', 'x'])]);
    q.enqueue('nope');
    q.enqueue('b');
    expect(errors).toEqual(['nope']);
    expect(finished).toEqual(['nope']);
    expect(q.view()?.sequenceId).toBe('b');
  });

  it('exposes speaker, name and direction', () => {
    const s: DialogueSequence = { id: 'd', delivery: 'box', lines: [{ id: 'd.1', speaker: 'myko', direction: 'quietly', text: 'You don\'t.' }] };
    const { q } = queue([s]);
    q.enqueue('d');
    expect(q.view()).toMatchObject({ speaker: 'myko', name: 'MYKO', direction: 'quietly' });
  });

  it('plays real content: a real scene blocks and finishes', () => {
    const real = sequence('c1.pub.open');
    const finished: string[] = [];
    const q = new DialogueQueue({ lookup: sequence, speakerName: () => 'x', onFinished: (id) => void finished.push(id) });
    q.enqueue('c1.pub.open');
    expect(q.blocking).toBe(true);
    for (let i = 0; i < real.lines.length * 2; i++) {
      q.update(10_000);
      q.advance();
    }
    expect(finished).toEqual(['c1.pub.open']);
  });
});

// ---------------------------------------------------------------------------

describe('LinkSelection (deduction board)', () => {
  const cands = ['c3.clue.map', 'c3.clue.manifest', 'c2.clue.fragment', 'c3.clue.brochure'] as const;

  it('needs three links', () => {
    expect(LINKS_REQUIRED).toBe(3);
  });

  it('selection is capped at three', () => {
    const s = new LinkSelection(cands);
    expect(s.toggle(cands[0])).toBe(true);
    expect(s.toggle(cands[1])).toBe(true);
    expect(s.toggle(cands[2])).toBe(true);
    expect(s.complete).toBe(true);
    expect(s.toggle(cands[3])).toBe(false);
    expect(s.picks()).toEqual([cands[0], cands[1], cands[2]]);
  });

  it('toggling a selected item removes it and frees a place', () => {
    const s = new LinkSelection(cands);
    s.toggle(cands[0]);
    s.toggle(cands[1]);
    s.toggle(cands[2]);
    expect(s.toggle(cands[1])).toBe(true);
    expect(s.complete).toBe(false);
    expect(s.toggle(cands[3])).toBe(true);
    expect(s.picks()).toEqual([cands[0], cands[2], cands[3]]);
  });

  it('ignores things that are not candidates', () => {
    const s = new LinkSelection(cands);
    expect(s.toggle('c9.proof.log')).toBe(false);
    expect(s.picks()).toEqual([]);
  });

  it('numbers picks from 1 and draws links between consecutive picks', () => {
    const s = new LinkSelection(cands);
    s.toggle(cands[2]);
    s.toggle(cands[0]);
    expect(s.order(cands[2])).toBe(1);
    expect(s.order(cands[0])).toBe(2);
    expect(s.order(cands[1])).toBe(0);
    expect(s.links()).toEqual([[cands[2], cands[0]]]);
    expect(s.has(cands[0])).toBe(true);
    s.clear();
    expect(s.picks()).toEqual([]);
  });

  it('a double toggle in one frame returns to empty', () => {
    const s = new LinkSelection(cands);
    s.toggle(cands[0]);
    s.toggle(cands[0]);
    expect(s.picks()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe('casebook model', () => {
  it('evidence entries use <evidenceId>.title|body|margin', () => {
    const it = toItem({ kind: 'evidence', evidenceId: 'c2.clue.fragment', chapter: 2 });
    expect(it).toMatchObject({ tab: 'clues', titleId: 'c2.clue.fragment.title', bodyId: 'c2.clue.fragment.body', marginId: 'c2.clue.fragment.margin', chapter: 2 });
  });

  it('proofs go to the proof tab', () => {
    expect(toItem({ kind: 'evidence', evidenceId: 'c9.proof.log', chapter: 9 }).tab).toBe('proof');
  });

  it('leads use <deductionId>.lead.title|body|margin', () => {
    const it = toItem({ kind: 'lead', deductionId: 'c3.deduction.boston', chapter: 3 });
    expect(it).toMatchObject({ tab: 'leads', titleId: 'c3.deduction.boston.lead.title', bodyId: 'c3.deduction.boston.lead.body', marginId: 'c3.deduction.boston.lead.margin' });
  });

  it('Myko calls use c<chapter>.call.<kind>.casebook|margin with the shared title', () => {
    const it = toItem({ kind: 'mykoCall', sectionId: 'c4.fight.brawl', callKind: 'fight', chapter: 4 });
    expect(it).toMatchObject({ bodyId: 'c4.call.fight.casebook', marginId: 'c4.call.fight.margin', titleId: 'ui.casebook.callTitle', tab: 'clues' });
    expect(toItem({ kind: 'mykoCall', sectionId: 'c4.puzzle.containers', callKind: 'puzzle', chapter: 4 }).bodyId).toBe('c4.call.puzzle.casebook');
  });

  it('every ID the model produces for real content exists', () => {
    const entries = [
      { kind: 'evidence', evidenceId: 'c2.clue.fragment', chapter: 2 },
      { kind: 'evidence', evidenceId: 'c9.proof.craft', chapter: 9 },
      { kind: 'lead', deductionId: 'c3.deduction.boston', chapter: 3 },
      { kind: 'mykoCall', sectionId: 'c1.fight.chipper', callKind: 'fight', chapter: 1 },
      { kind: 'mykoCall', sectionId: 'c10.puzzle.broadcast', callKind: 'puzzle', chapter: 10 },
    ] as const;
    for (const e of entries) {
      const it = toItem(e);
      for (const id of [it.titleId, it.bodyId, it.marginId]) if (id) expect(hasText(id), id).toBe(true);
    }
  });

  it('groups by tab, keeping the order entries were added, and never loses one', () => {
    const entries = [
      { kind: 'evidence', evidenceId: 'c2.clue.ring', chapter: 2 },
      { kind: 'lead', deductionId: 'c3.deduction.boston', chapter: 3 },
      { kind: 'evidence', evidenceId: 'c9.proof.log', chapter: 9 },
      { kind: 'mykoCall', sectionId: 'c2.fight.yard', callKind: 'fight', chapter: 2 },
      { kind: 'evidence', evidenceId: 'c2.clue.tracks', chapter: 2 },
    ] as const;
    const g = groupCasebook(entries);
    expect(g.clues.map((i) => i.key)).toEqual(['e:c2.clue.ring', 'm:c2.fight.yard', 'e:c2.clue.tracks']);
    expect(g.leads).toHaveLength(1);
    expect(g.proof).toHaveLength(1);
    expect(g.clues.length + g.leads.length + g.proof.length).toBe(entries.length);
    expect(groupCasebook([])).toEqual({ clues: [], leads: [], proof: [] });
  });

  it('tab labels exist as text', () => {
    for (const t of CASEBOOK_TABS) expect(hasText(tabTextId(t)), t).toBe(true);
    expect(hasText('ui.casebook.callTitle')).toBe(true);
  });
});

// ---------------------------------------------------------------------------

/** A FakeSource with some of its state or methods replaced. Chapter 1 table: Buzzed 1-34, Grand 35-65, Bit much 66-90, Fecked 91-99, floor 100. */
function source(over: Partial<Record<keyof FakeSource, unknown>> = {}): FakeSource {
  return Object.assign(new FakeSource(), over);
}

const slotView = (slot: 1 | 2 | 3 | 4, moveId: MoveSlotView['moveId'], lit: boolean, cooldownLeftMs = 0): MoveSlotView => ({ slot, moveId, lit, cooldownLeftMs, cooldownMs: moveId ? 12000 : 0 });
const kitWith = (over: Partial<Kit>): Kit => ({ ...new FakeSource().kitState, ...over });

describe('HUD model', () => {
  it('the meter fraction and marks come from the chapter table, not constants', () => {
    const t = levelTable(1);
    const m = buildHudModel(source({ buzzValue: 45 }));
    expect(m.buzz.marks).toEqual([t.grand.min / t.floor, t.bitMuch.min / t.floor, t.fecked.min / t.floor]);
    expect(m.buzz.fraction).toBeCloseTo(45 / t.floor, 5);
    expect(m.buzz.state).toBe('grand');
    expect(hasText(m.buzz.stateTextId)).toBe(true);
    expect(m.buzz.flashing).toBe(false);
  });

  it('the meter is longer in a chapter with a higher floor, within limits', () => {
    expect(meterWidth(200)).toBeGreaterThan(meterWidth(100));
    expect(meterWidth(1)).toBe(80);
    expect(meterWidth(10_000)).toBe(190);
    expect(meterWidth(Number.NaN)).toBe(80);
    expect(buildHudModel(source()).buzz.widthPx).toBe(meterWidth(levelTable(1).floor));
  });

  it('every level has HUD text and the meter flashes only during a spirit window', () => {
    const values: [number, string][] = [[0, 'sober'], [20, 'buzzed'], [50, 'grand'], [75, 'bitMuch'], [95, 'fecked']];
    for (const [value, state] of values) {
      const m = buildHudModel(source({ buzzValue: value }));
      expect(m.buzz.state).toBe(state);
      expect(hasText(m.buzz.stateTextId), state).toBe(true);
      expect(m.buzz.flashing).toBe(false);
      expect(buildHudModel(source({ buzzValue: value, spiritActive: true })).buzz.flashing).toBe(true);
    }
  });

  it('the sun mark follows the meter', () => {
    expect(buildHudModel(source()).buzz.inSun).toBe(false);
    expect(buildHudModel(source({ inSun: true })).buzz.inSun).toBe(true);
  });

  it('colours go flat under the low warning, deepening towards 0, and not before', () => {
    expect(buildHudModel(source({ buzzValue: 10 })).buzz.flatness).toBe(0);
    const at5 = buildHudModel(source({ buzzValue: 5 })).buzz.flatness;
    const at1 = buildHudModel(source({ buzzValue: 1 })).buzz.flatness;
    const at0 = buildHudModel(source({ buzzValue: 0 })).buzz.flatness;
    expect(at5).toBeGreaterThan(0);
    expect(at1).toBeGreaterThan(at5);
    expect(at0).toBeGreaterThan(at1);
    expect(at0).toBeLessThanOrEqual(1);
    expect(flatness({ ...new FakeSource().meter(), value: Number.NaN })).toBeGreaterThanOrEqual(0);
  });

  it('clamps a nonsense meter value', () => {
    expect(buildHudModel(source({ buzzValue: 250 })).buzz.fraction).toBe(1);
    expect(buildHudModel(source({ buzzValue: -5 })).buzz.fraction).toBe(0);
    expect(buildHudModel(source({ buzzValue: Number.NaN })).buzz.fraction).toBe(0);
  });

  it('three leaf flags for Myko calls, spent ones false', () => {
    expect(buildHudModel(source({ callsLeft: 3 })).calls).toEqual([true, true, true]);
    expect(buildHudModel(source({ callsLeft: 1 })).calls).toEqual([true, false, false]);
    expect(buildHudModel(source({ callsLeft: 0 })).calls).toEqual([false, false, false]);
  });

  it('four special slots: empty, dark, recharging with a fraction, ready', () => {
    const none = buildHudModel(source({ slots: [slotView(1, null, true), slotView(2, null, false), slotView(3, null, false), slotView(4, null, false)] }));
    expect(none.specials.map((s) => s.ready)).toEqual([false, false, false, false]);
    expect(none.specials[1]?.moveId).toBeNull();
    const dark = buildHudModel(source({ slots: [slotView(1, null, true), slotView(2, 'stoutSlam', false), slotView(3, null, false), slotView(4, null, false)] }));
    expect(dark.specials[1]).toMatchObject({ moveId: 'stoutSlam', lit: false, ready: false });
    const recharging = buildHudModel(source({ slots: [slotView(1, null, true), slotView(2, 'stoutSlam', true, 3000), slotView(3, null, false), slotView(4, null, false)] }));
    expect(recharging.specials[1]).toMatchObject({ lit: true, ready: false });
    expect(recharging.specials[1]?.cooldownFraction).toBeCloseTo(0.25, 5);
    const ready = buildHudModel(source({ slots: [slotView(1, null, true), slotView(2, 'stoutSlam', true, 0), slotView(3, null, false), slotView(4, null, false)] }));
    expect(ready.specials[1]).toMatchObject({ ready: true, cooldownFraction: 0 });
  });

  it('the drink slot shows the selected drink and its count; bottles are the throw count', () => {
    const kit = kitWith({ drinks: { stout: 2, whiskey: 1, lager: 3 }, bottles: 4, slots: { drink: 'whiskey', specials: [null, null, null, null], melee: 'fists' } });
    const m = buildHudModel(source({ kitState: kit }));
    expect(m.drink).toEqual({ drinkId: 'whiskey', count: 1 });
    expect(m.bottles).toBe(4);
    const none = buildHudModel(source({ kitState: kitWith({ drinks: {}, slots: { drink: null, specials: [null, null, null, null], melee: 'fists' } }) }));
    expect(none.drink).toEqual({ drinkId: null, count: 0 });
  });

  it('a hot drink in the slot counts one', () => {
    const m = buildHudModel(source({ kitState: kitWith({ drinks: { stout: 1 }, hotDrink: 'tea', slots: { drink: 'tea', specials: [null, null, null, null], melee: 'fists' } }) }));
    expect(m.drink).toEqual({ drinkId: 'tea', count: 1 });
  });

  it('the weapon follows the kit, and a refusal comes through with its seq', () => {
    expect(buildHudModel(source({ weaponId: 'hurley' })).weapon).toBe('hurley');
    expect(buildHudModel(source()).refusal).toBeNull();
    expect(buildHudModel(source({ lastRefusal: { textId: 'ui.move.dark', seq: 2 } })).refusal).toEqual({ textId: 'ui.move.dark', seq: 2 });
  });

  it('boss bar fraction and name', () => {
    const m = buildHudModel(source({ bossState: { bossId: 'c1.boss.bigtom', health: { current: 110, max: 220 } } }));
    expect(m.boss).toMatchObject({ bossId: 'c1.boss.bigtom', fraction: 0.5 });
    expect(hasText(m.boss?.nameTextId ?? '')).toBe(true);
    expect(buildHudModel(source()).boss).toBeNull();
  });

  it('the Myko call ring covers a quarter of the perimeter at 0.25', () => {
    expect(perimeterSegments(0, 10, 10)).toEqual([]);
    const total = (p: number) => perimeterSegments(p, 10, 6).reduce((n, [a, b, c, d]) => n + Math.abs(c - a) + Math.abs(d - b), 0);
    expect(total(0.5)).toBeCloseTo(16, 5);
    expect(total(1)).toBeCloseTo(32, 5);
    expect(total(7)).toBeCloseTo(32, 5);
    expect(perimeterSegments(0.1, 10, 10)[0]?.slice(0, 2)).toEqual([0, 0]);
  });

  it('FakeSource implements the whole source and the throw preview and refusal are null to start', () => {
    const f = new FakeSource();
    expect(f.throwPreview()).toBeNull();
    expect(f.refusal()).toBeNull();
    f.lastRefusal = { textId: 'ui.throw.noBottle', seq: 1 };
    expect(f.refusal()?.textId).toBe('ui.throw.noBottle');
    expect(hasText('ui.throw.noBottle')).toBe(true);
  });
});

describe('OverlayTracker', () => {
  it('pauses on the first overlay and resumes only when the last closes', () => {
    const log: string[] = [];
    const t = new OverlayTracker(() => void log.push('pause'), () => void log.push('resume'));
    t.show('casebook');
    t.show('settings');
    t.show('settings');
    expect(log).toEqual(['pause']);
    t.hide('casebook');
    expect(log).toEqual(['pause']);
    t.hide('settings');
    expect(log).toEqual(['pause', 'resume']);
    expect(t.any).toBe(false);
  });
  it('hiding something never shown does nothing', () => {
    const log: string[] = [];
    const t = new OverlayTracker(() => void log.push('p'), () => void log.push('r'));
    t.hide('x');
    expect(log).toEqual([]);
  });
});

describe('real content in the UI model', () => {
  it('speaker display names exist for all named characters', () => {
    for (const id of ['name.dympna', 'name.bigTom']) expect(text(id).length).toBeGreaterThan(0);
  });
});
