/**
 * Myko's remarks on the meter, applied to the running chapter. DESIGN.md 7.5.
 * `mykoLines.ts` decides whether he speaks and from which pool (silent at 0,
 * one shared gap, level lines only on the way up); this picks a line from the
 * pool, never the one he said last time from that pool, and hands it to the
 * dialogue. The three Myko calls and the H hint are not here.
 */

import type { Random } from '../core/random';
import type { DialogueId } from '../core/types';
import { createMykoLines, mykoLineFor, stepMykoLines } from './mykoLines';
import type { MykoLinesState, MykoMeterPool, MykoTrigger } from './mykoLines';

export interface MykoMeterHost {
  readonly rng: Random;
  /** Sequence IDs of a dialogue pool, [] if unknown. */
  pool(poolId: string): readonly DialogueId[];
  /** Play a line (pool lines may repeat). */
  say(id: DialogueId): void;
}

export class MykoMeterVoice {
  private state: MykoLinesState = createMykoLines();
  private readonly last = new Map<MykoMeterPool, DialogueId>();

  constructor(private readonly host: MykoMeterHost) {}

  /** Time passes: the gap between remarks runs down. */
  step(dtMs: number): void {
    this.state = stepMykoLines(this.state, dtMs);
  }

  /** Something happened (or, for `meterValue`, a frame passed). `meterValue` is the meter now. */
  trigger(trigger: MykoTrigger, meterValue: number): void {
    const r = mykoLineFor(this.state, trigger, meterValue);
    this.state = r.state;
    if (r.poolId) this.speak(r.poolId);
  }

  private speak(poolId: MykoMeterPool): void {
    const ids = this.host.pool(poolId);
    if (ids.length === 0) return;
    const prev = this.last.get(poolId);
    const choices = ids.length > 1 ? ids.filter((id) => id !== prev) : ids;
    const id = choices[Math.floor(this.host.rng.next() * choices.length)];
    if (id === undefined) return;
    this.last.set(poolId, id);
    this.host.say(id);
  }
}
