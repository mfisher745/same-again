/** Chapter 10 broadcast console (`broadcast.ts`): five proofs, five channels, two look-alike sockets, then the button. */

import { describe, expect, it } from 'vitest';
import { PROOFS } from '../../src/core/types';
import type { ProofId } from '../../src/core/types';
import { validateBroadcast } from '../../src/systems/broadcast';
import { frame, makeRun, record } from './helpers';
import { SCREEN, T, makeWorld, sampleBroadcast } from './c9c10-world';

const PID = 'c10.puzzle.broadcast' as const;
const RIGHT: Record<ProofId, string> = {
  'c9.proof.craft': 's4',
  'c9.proof.contract': 's2',
  'c9.proof.directory': 's3',
  'c9.proof.log': 's1',
  'c9.proof.footage': 's5',
};

function world() {
  const layout = sampleBroadcast();
  return makeWorld({
    chapter: 10,
    sections: [{ id: PID, kind: 'puzzle', mykoCallable: true }],
    start: T(10, 10),
    broadcast: layout,
    examinables: [...layout.sockets.map((s, i) => ({ id: s.examinableId, screenId: SCREEN, position: T(10 + i * 2, 8) })), { id: layout.buttonExaminableId, screenId: SCREEN, position: T(20, 12) }],
  });
}

function start(proofs: readonly ProofId[] = PROOFS) {
  const h = makeRun({ module: world() });
  h.run.dialogue.finishAll();
  for (const p of proofs) h.run.addEvidence(p);
  return { ...h, puzzle: h.run.broadcast(PID)! };
}

describe('the layout', () => {
  it('the sample is sound: five sockets, five plugs, one-to-one, exactly two look-alike sockets', () => {
    expect(validateBroadcast(sampleBroadcast())).toEqual([]);
  });

  it('a layout with no look-alike pair, or two, or a missing proof, is reported', () => {
    const l = sampleBroadcast();
    expect(validateBroadcast({ ...l, sockets: l.sockets.map((s) => ({ ...s, look: s.shape })) })).toContain('exactly two sockets must share a look');
    expect(validateBroadcast({ ...l, plugs: l.plugs.slice(1) })).toEqual(expect.arrayContaining(['needs five plugs']));
    expect(validateBroadcast({ ...l, plugs: l.plugs.map((p, i) => (i === 0 ? { ...p, shape: 'nope' } : p)) }).join()).toContain('fits no socket');
  });
});

describe('plugging in', () => {
  it('a proof that is not in the casebook cannot be plugged', () => {
    const { puzzle } = start(['c9.proof.craft']);
    expect(puzzle.plug('c9.proof.log', 's1')).toMatchObject({ ok: false, refusal: 'noProof' });
    expect(puzzle.plug('c9.proof.craft', 's4')).toEqual({ ok: true });
  });

  it('a plug that does not fit is refused with the wrong line and costs nothing', () => {
    const { puzzle, bus, run } = start();
    const seen = record(bus, 'broadcast:changed');
    const hits = record(bus, 'player:hit');
    const r = puzzle.plug('c9.proof.log', 's2');
    expect(r).toEqual({ ok: false, refusal: 'wrongShape', textId: 'c10.broadcast.wrong' });
    expect(seen.map((e) => e.phase)).toEqual(['wrong']);
    expect(hits).toHaveLength(0);
    expect(puzzle.pluggedCount()).toBe(0);
    void run;
  });

  it('the two look-alike sockets look the same until examined; the tape and the photo are the pair', () => {
    const { puzzle, run, bus } = start();
    const seen = record(bus, 'broadcast:changed');
    const shown = (id: string): string => puzzle.views().sockets.find((s) => s.id === id)!.shown;
    expect(shown('s4')).toBe('slot');
    expect(shown('s5')).toBe('slot');
    expect(shown('s1')).toBe('round');
    expect(puzzle.views().sockets.filter((s) => s.ambiguous).map((s) => s.id)).toEqual(['s4', 's5']);
    // The photo goes in the unnotched one: the other refuses it.
    expect(puzzle.plug('c9.proof.craft', 's5').refusal).toBe('wrongShape');
    // E on a socket examines it.
    run.setPlayerPosition(T(10 + 4 * 2, 9));
    run.tick(16, frame({ pressed: ['interact'] }));
    expect(seen.some((e) => e.phase === 'examined' && e.channelId === 's5')).toBe(true);
    expect(shown('s5')).toBe('flatNotched');
    expect(shown('s4')).toBe('slot');
    expect(puzzle.plug('c9.proof.footage', 's5').ok).toBe(true);
  });

  it('a socket takes one plug, and a proof goes in once', () => {
    const { puzzle } = start();
    expect(puzzle.plug('c9.proof.log', 's1').ok).toBe(true);
    expect(puzzle.plug('c9.proof.contract', 's1').refusal).toBe('occupied');
    expect(puzzle.plug('c9.proof.log', 's2').refusal).toBe('alreadyPlugged');
    expect(puzzle.unplug('s1')).toBe(true);
    expect(puzzle.plug('c9.proof.log', 's1').ok).toBe(true);
  });

  it('all five in completes the section and reports ready; the button is still to press', () => {
    const { puzzle, bus, run } = start();
    const seen = record(bus, 'broadcast:changed');
    const done = record(bus, 'section:completed');
    for (const p of PROOFS) expect(puzzle.plug(p, RIGHT[p]).ok).toBe(true);
    expect(seen.map((e) => e.phase)).toContain('ready');
    expect(done.map((d) => d.sectionId)).toEqual([PID]);
    expect(puzzle.ready).toBe(true);
    expect(puzzle.pressed).toBe(false);
    expect(run.isComplete(PID)).toBe(true);
  });
});

describe('the button', () => {
  it('does nothing before all five are in; pressed with E once, it saves that', () => {
    const { puzzle, run, bus } = start();
    const seen = record(bus, 'broadcast:changed');
    run.setPlayerPosition(T(20, 13));
    run.tick(16, frame({ pressed: ['interact'] }));
    expect(puzzle.pressed).toBe(false);
    for (const p of PROOFS) puzzle.plug(p, RIGHT[p]);
    run.tick(16, frame({ pressed: ['interact'] }));
    expect(puzzle.pressed).toBe(true);
    expect(seen.filter((e) => e.phase === 'pressed')).toHaveLength(1);
    run.tick(16, frame({ pressed: ['interact'] }));
    expect(seen.filter((e) => e.phase === 'pressed')).toHaveLength(1);
    expect(run.flag('broadcast.' + PID + '.pressed')).toBe(true);
  });

  it('completeNow (the Myko call) plugs all five in and leaves the button for Andrew', () => {
    const { puzzle, run, bus } = start([]);
    const seen = record(bus, 'broadcast:changed');
    const done = record(bus, 'section:completed');
    puzzle.completeNow('myko');
    expect(puzzle.views().sockets.map((s) => s.plugged).sort()).toEqual([...PROOFS].sort());
    for (const p of PROOFS) expect(puzzle.pluggedIn(RIGHT[p])).toBe(p);
    expect(done.map((d) => d.by)).toEqual(['myko']);
    expect(puzzle.pressed).toBe(false);
    expect(seen.some((e) => e.phase === 'pressed')).toBe(false);
    expect(puzzle.press()).toBe(true);
    void run;
  });

  it('a load puts the plugs and the button back: nothing is a saved "already started" flag', () => {
    const a = start();
    a.puzzle.plug('c9.proof.log', 's1');
    a.puzzle.plug('c9.proof.contract', 's2');
    const flags = { ...a.run.snapshot().flags };
    const b = makeRun({ module: world(), save: (base) => ({ ...base, flags, casebook: a.run.casebook.entries() }) });
    const puzzle = b.run.broadcast(PID)!;
    expect(puzzle.pluggedIn('s1')).toBe('c9.proof.log');
    expect(puzzle.pluggedIn('s2')).toBe('c9.proof.contract');
    expect(puzzle.pluggedCount()).toBe(2);
    // A solved console loads solved, with the button still waiting if it was not pressed.
    for (const p of PROOFS) a.puzzle.plug(p, RIGHT[p]);
    const done = a.run.snapshot();
    const c = makeRun({ module: world(), save: (base) => ({ ...base, flags: { ...done.flags }, completedSectionIds: [...done.completedSectionIds], casebook: done.casebook }) });
    expect(c.run.broadcast(PID)?.ready).toBe(true);
    expect(c.run.broadcast(PID)?.pressed).toBe(false);
  });
});
