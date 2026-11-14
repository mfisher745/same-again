/**
 * The two ways back to the bar as a timeline. Pure: given the reason and how
 * long it has been running, say what the screen shows. DESIGN.md 7.1 "Back to
 * the bar". The timeline starts on `bar:returning`, while the world is frozen
 * where Andrew stands and still on screen. The sober return flattens the
 * colours and fades to black. On the floor the world itself shows Andrew's fall
 * and Myko hurrying to his side (the `fall` and `hurry` stages draw nothing
 * here), then smoke grows from Andrew to fill the screen, then black. The
 * scene completes the return at the first moment of black (`blackStartMs`),
 * and both end with a fade up on the bar.
 */

import type { BarReturnReason, UiTuning } from '../../core/types';

export type ReturnStage = 'flatten' | 'fade' | 'fall' | 'hurry' | 'smoke' | 'black' | 'reveal' | 'done';

export interface ReturnFrame {
  readonly stage: ReturnStage;
  /** 0..1 how flat the world's colours are. */
  readonly flat: number;
  /** 0..1 alpha of the black cover. */
  readonly cover: number;
  /** Floor only: 0..1 progress of Andrew's fall (the world draws it). */
  readonly fall: number;
  /** Floor only: 0..1 progress of Myko's hurry (the world draws it). */
  readonly hurry: number;
  /** Floor only: 0..1 growth of the smoke from a puff to filling the screen. */
  readonly smoke: number;
  /** Myko says nothing and the music stays off until this is false (sober). */
  readonly silent: boolean;
  readonly done: boolean;
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const ratio = (t: number, from: number, len: number): number => (len <= 0 ? (t >= from ? 1 : 0) : clamp01((t - from) / len));

/** When the cover first reaches full black, in ms from the start: the moment the scene completes the return. */
export function blackStartMs(reason: BarReturnReason, ui: UiTuning): number {
  return reason === 'sober'
    ? ui.soberReturn.flattenMs + ui.soberReturn.fadeMs
    : ui.floorReturn.fallMs + ui.floorReturn.hurryMs + ui.floorReturn.smokeMs;
}

/** Total length of a return in milliseconds, reveal included. */
export function returnDuration(reason: BarReturnReason, ui: UiTuning): number {
  return reason === 'sober'
    ? ui.soberReturn.flattenMs + ui.soberReturn.fadeMs + ui.soberReturn.blackMs + ui.revealMs
    : ui.floorReturn.fallMs + ui.floorReturn.hurryMs + ui.floorReturn.smokeMs + ui.floorReturn.blackMs + ui.revealMs;
}

export function returnFrame(reason: BarReturnReason, elapsedMs: number, ui: UiTuning): ReturnFrame {
  const t = Math.max(0, elapsedMs);
  const total = returnDuration(reason, ui);
  const done = t >= total;
  const reveal = ratio(t, total - ui.revealMs, ui.revealMs);
  if (reason === 'sober') {
    const s = ui.soberReturn;
    const fadeAt = s.flattenMs;
    const blackAt = fadeAt + s.fadeMs;
    const revealAt = blackAt + s.blackMs;
    const stage: ReturnStage = done ? 'done' : t < fadeAt ? 'flatten' : t < blackAt ? 'fade' : t < revealAt ? 'black' : 'reveal';
    return {
      stage,
      flat: t < revealAt ? Math.max(ratio(t, 0, s.flattenMs), 0) : 0,
      cover: t < revealAt ? ratio(t, fadeAt, s.fadeMs) : 1 - reveal,
      fall: 0,
      hurry: 0,
      smoke: 0,
      silent: !done,
      done,
    };
  }
  const f = ui.floorReturn;
  const hurryAt = f.fallMs;
  const smokeAt = hurryAt + f.hurryMs;
  const blackAt = smokeAt + f.smokeMs;
  const revealAt = blackAt + f.blackMs;
  const stage: ReturnStage = done ? 'done' : t < hurryAt ? 'fall' : t < smokeAt ? 'hurry' : t < blackAt ? 'smoke' : t < revealAt ? 'black' : 'reveal';
  const smoke = ratio(t, smokeAt, f.smokeMs);
  return {
    stage,
    flat: 0,
    // The smoke fills the screen first; the last of it goes to black.
    cover: t < blackAt ? ratio(t, smokeAt + f.smokeMs * 0.75, f.smokeMs * 0.25) : t < revealAt ? 1 : 1 - reveal,
    fall: ratio(t, 0, f.fallMs),
    hurry: ratio(t, hurryAt, f.hurryMs),
    smoke,
    silent: false,
    done,
  };
}
