/**
 * Pure helpers for drawing the chapter 9 and 10 systems (`c910View.ts`, `worldView.ts`): where the floor arrows go, how
 * many segments of a door timer are lit, where a wedge's edge is. No Phaser here, so they are unit-testable. Sizes are
 * presentation, not balance.
 */

import type { GravityDir, Vec2 } from '../../core/types';
import { fromAngle } from '../geometry';

/** The angle (degrees, 0 = right, clockwise) a direction points. */
export function dirAngle(dir: GravityDir): number {
  return dir === 'right' ? 0 : dir === 'down' ? 90 : dir === 'left' ? 180 : 270;
}

/** Arrow centres every `spacing` px across an arena (`x`, `y`, `width`, `height`), for the floor arrows that mark a flip. */
export function arrowGrid(arena: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }, spacing: number): Vec2[] {
  const out: Vec2[] = [];
  for (let y = arena.y + spacing / 2; y < arena.y + arena.height; y += spacing) {
    for (let x = arena.x + spacing / 2; x < arena.x + arena.width; x += spacing) out.push({ x, y });
  }
  return out;
}

/** The three corners of an arrow head at `at` pointing `dir`, `size` px long. */
export function arrowHead(at: Vec2, dir: GravityDir, size: number): readonly [Vec2, Vec2, Vec2] {
  const a = dirAngle(dir);
  const tip = { x: at.x + fromAngle(a, size / 2).x, y: at.y + fromAngle(a, size / 2).y };
  const l = { x: at.x + fromAngle(a + 140, size / 2).x, y: at.y + fromAngle(a + 140, size / 2).y };
  const r = { x: at.x + fromAngle(a - 140, size / 2).x, y: at.y + fromAngle(a - 140, size / 2).y };
  return [tip, l, r];
}

/** How many of `segments` stay lit for a door timer with `leftMs` of `totalMs` left (0 when the door is shut, all when it has not started). */
export function timerSegments(leftMs: number, totalMs: number, segments: number): number {
  if (totalMs <= 0) return 0;
  return Math.max(0, Math.min(segments, Math.ceil((leftMs / totalMs) * segments - 1e-9)));
}

/** A timer is urgent (drawn red) in its last `fraction`. */
export const timerUrgent = (leftMs: number, totalMs: number, fraction = 0.25): boolean => totalMs > 0 && leftMs / totalMs <= fraction;

/** Points of a wedge from `from` over `range`, centred on `aimDeg`, `angleDeg` wide, as an arc polyline starting at the apex. */
export function wedgePoints(from: Vec2, aimDeg: number, range: number, angleDeg: number, steps = 8): Vec2[] {
  const pts: Vec2[] = [{ ...from }];
  for (let i = 0; i <= steps; i++) {
    const a = aimDeg - angleDeg / 2 + (angleDeg * i) / steps;
    const p = fromAngle(a, range);
    pts.push({ x: from.x + p.x, y: from.y + p.y });
  }
  return pts;
}

/** The end of a beam from `from` at `deg` over `range`. */
export function beamEnd(from: Vec2, deg: number, range: number): Vec2 {
  const p = fromAngle(deg, range);
  return { x: from.x + p.x, y: from.y + p.y };
}

/** The horizontal band a stamp's shockwave has covered: from `deskX - reach` to `deskX + reach`, clipped to the arena. */
export function stampSpan(arenaX: number, arenaWidth: number, deskX: number, frontX: number): { readonly x0: number; readonly x1: number } {
  const reach = Math.max(0, frontX - deskX);
  return { x0: Math.max(arenaX, deskX - reach), x1: Math.min(arenaX + arenaWidth, deskX + reach) };
}
