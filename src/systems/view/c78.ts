/**
 * Pure helpers for drawing the chapter 7 and 8 systems (`hazardView.ts`, `worldView.ts`): where a thrown enemy is, how
 * a fan's lines run, how a band along a path is stamped. No Phaser here, so they are unit-testable. Timings and sizes
 * are presentation, not balance.
 */

import type { Vec2 } from '../../core/types';

/** The sensor lamp: red while the sensor is live, grey when a junction switched it off. */
export type SensorLamp = 'live' | 'alert' | 'off';

export function sensorLamp(enabled: boolean, detection: number): SensorLamp {
  if (!enabled) return 'off';
  return detection > 0 ? 'alert' : 'live';
}

/** A thrown enemy's place `progress` (0..1) along the throw from `from` to `to`, with the height of the arc in px. */
export function throwPoint(from: Vec2, to: Vec2, progress: number, arcPx: number): { readonly pos: Vec2; readonly height: number } {
  const t = Math.max(0, Math.min(1, progress));
  return { pos: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }, height: 4 * arcPx * t * (1 - t) };
}

/** Points every `spacing` px along a segment, from its start, for stamping floor markers on a lit line. */
export function stampPoints(from: Vec2, to: Vec2, spacing: number): Vec2[] {
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  if (len === 0 || spacing <= 0) return [{ ...from }];
  const n = Math.max(1, Math.floor(len / spacing));
  return Array.from({ length: n + 1 }, (_, i) => ({ x: from.x + ((to.x - from.x) * i) / n, y: from.y + ((to.y - from.y) * i) / n }));
}

/** The end point of a fan line of length `range` at `angleDeg` from `origin`. */
export function fanEnd(origin: Vec2, angleDeg: number, range: number): Vec2 {
  const a = (angleDeg * Math.PI) / 180;
  return { x: origin.x + Math.cos(a) * range, y: origin.y + Math.sin(a) * range };
}

/** Where Zorp's sign is drawn: held in front of him while up, lying beside him while knocked away. */
export function signPosition(body: Vec2, facingDeg: number, up: boolean): Vec2 {
  if (up) return fanEnd(body, facingDeg, 10);
  return { x: body.x + 9, y: body.y + 6 };
}

/** Where applause marks flicker: `count` points along the arena's top edge. */
export function applausePoints(arena: { readonly x: number; readonly y: number; readonly width: number }, count: number): Vec2[] {
  return Array.from({ length: count }, (_, i) => ({ x: arena.x + ((i + 0.5) * arena.width) / count, y: arena.y - 6 }));
}

/** A looping 0..1 value at `hz`, for pulsing markers. */
export const pulse = (ms: number, hz: number): number => 0.5 + 0.5 * Math.sin((ms / 1000) * hz * Math.PI * 2);
