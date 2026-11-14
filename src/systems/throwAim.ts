/**
 * The thrown bottle: hold to aim, release to throw. DESIGN.md 7.2 "Thrown
 * bottles". Plain TypeScript, no Phaser. The preview is a pure function of
 * origin, pointer, drunk level and time held, and the throw is that same
 * function evaluated at release, so the bottle goes exactly where the preview
 * pointed. Sway is a deterministic sine of time: none at levels 1 and 2,
 * moderate at 3, strong at 4 (degrees from tuning). The kit does the
 * consuming: on a throw the caller calls `spendBottle`.
 */

import { TUNING } from '../content/tuning';
import type { DrunkLevel, OverhaulTuning, ThrowAim, ThrowTuning, Vec2 } from '../core/types';
import { angleTo, distance, fromAngle } from './geometry';

function tun(tuning?: OverhaulTuning): { o: OverhaulTuning; t: ThrowTuning } {
  const o = tuning ?? TUNING.overhaul;
  if (!o?.throw) throw new Error('TUNING.overhaul.throw is missing');
  return { o, t: o.throw };
}

/** Sway angle in degrees at `elapsedMs` of holding, at `level`. Zero when the level has no sway. */
export function swayDegrees(level: DrunkLevel, elapsedMs: number, tuning?: OverhaulTuning): number {
  const { o, t } = tun(tuning);
  const amp = o.swayByLevel[level];
  if (amp === 0) return 0;
  return amp * Math.sin((2 * Math.PI * elapsedMs) / t.swayPeriodMs);
}

/** The preview for one moment. Landing is at most `range` from the origin. */
export function previewAt(origin: Vec2, pointer: Vec2, level: DrunkLevel, elapsedMs: number, tuning?: OverhaulTuning): ThrowAim {
  const { t } = tun(tuning);
  const sway = swayDegrees(level, elapsedMs, tuning);
  const dist = Math.min(t.range, distance(origin, pointer));
  const dir = fromAngle(angleTo(origin, pointer) + sway);
  const landing: Vec2 = { x: origin.x + dir.x * dist, y: origin.y + dir.y * dist };
  const n = Math.max(2, t.previewPoints);
  const path: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    path.push(i === n - 1 ? landing : { x: origin.x + (landing.x - origin.x) * f, y: origin.y + (landing.y - origin.y) * f });
  }
  return { origin, landing, path, swayAmount: sway };
}

export interface ThrowAimState {
  readonly aiming: boolean;
  /** Time the button has been held, ms. The sway runs on this. */
  readonly elapsedMs: number;
}

export const createThrowAimState = (): ThrowAimState => ({ aiming: false, elapsedMs: 0 });

export type ThrowRefusal = 'noBottle' | 'notAiming';

/** What the caller launches. Landing equals the last preview's landing. */
export interface ThrowRequest {
  readonly origin: Vec2;
  readonly landing: Vec2;
  readonly path: readonly Vec2[];
  readonly swayAmount: number;
  /** Fixed; the drunk level does not change it. */
  readonly damage: number;
  readonly knockback: number;
  /** The noise where it lands; distracts guards. */
  readonly noiseRadius: number;
}

/** Press: start aiming. Needs at least one bottle. */
export function beginAim(state: ThrowAimState, bottles: number): { state: ThrowAimState; refusal: ThrowRefusal | null } {
  if (bottles < 1) return { state: createThrowAimState(), refusal: 'noBottle' };
  if (state.aiming) return { state, refusal: null };
  return { state: { aiming: true, elapsedMs: 0 }, refusal: null };
}

/** Time passes while the button is held. */
export const tickAim = (state: ThrowAimState, dtMs: number): ThrowAimState =>
  state.aiming ? { ...state, elapsedMs: state.elapsedMs + dtMs } : state;

/** The preview to draw this frame, or null when not aiming. */
export function currentPreview(state: ThrowAimState, origin: Vec2, pointer: Vec2, level: DrunkLevel, tuning?: OverhaulTuning): ThrowAim | null {
  return state.aiming ? previewAt(origin, pointer, level, state.elapsedMs, tuning) : null;
}

/** Drop the aim without throwing (button released with no bottle, menu opened, hit). */
export const cancelAim = (): ThrowAimState => createThrowAimState();

/**
 * Release. Returns the throw request, or a refusal. Bottles are checked again
 * here, so a bottle spent while aiming stops the throw.
 */
export function release(
  state: ThrowAimState,
  origin: Vec2,
  pointer: Vec2,
  level: DrunkLevel,
  bottles: number,
  tuning?: OverhaulTuning,
): { state: ThrowAimState; request: ThrowRequest | null; refusal: ThrowRefusal | null } {
  const idle = createThrowAimState();
  if (!state.aiming) return { state: idle, request: null, refusal: 'notAiming' };
  if (bottles < 1) return { state: idle, request: null, refusal: 'noBottle' };
  const { t } = tun(tuning);
  const aim = previewAt(origin, pointer, level, state.elapsedMs, tuning);
  return {
    state: idle,
    request: { origin: aim.origin, landing: aim.landing, path: aim.path, swayAmount: aim.swayAmount, damage: t.damage, knockback: t.knockback, noiseRadius: t.noiseRadius },
    refusal: null,
  };
}
