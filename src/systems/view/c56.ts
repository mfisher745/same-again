/**
 * Pure helpers for drawing the chapter 5 and 6 set pieces (`setpieceView.ts`, `worldView.ts`): which frame, where,
 * which tiles. No Phaser here, so they are unit-testable. Timings are presentation, not balance.
 */

import type { TileCoord, Vec2 } from '../../core/types';
import type { CombineLane } from '../combine';

/** The dust plume loops its three frames at this rate. */
export const PLUME_FPS = 6;
/** One plume every this many pixels along the lane (the art is 32 x 32). */
export const PLUME_SPACING = 32;
/** Plumes alternate this far either side of the lane's centre line. */
export const PLUME_STAGGER = 10;
/** A thrown bale's shadow switches to its second frame for the last part of the flight. */
export const BALE_SHADOW_LATE = 0.6;
/** A harvester this close to the end of the ditch path starts to sink; at the end this much of it is hidden. */
export const DITCH_SINK_START_PX = 40;
export const DITCH_SINK_MAX_PX = 14;
/** The combine's texture key (its boss body texture). */
export const COMBINE_TEXTURE = 'boss.c6.setpiece.combine';

export type ShelfRowFrame = 'top' | 'mid' | 'bottom';

/** The rolling shelf frame for tile-row `row` of a unit `rows` tall: top for the first, bottom for the last. */
export function shelfRowFrame(row: number, rows: number): ShelfRowFrame {
  if (row <= 0) return 'top';
  if (row >= rows - 1) return 'bottom';
  return 'mid';
}

/** Frame index of a looping animation of `frames` frames at `fps`, `ms` after it started. */
export function loopFrame(ms: number, fps: number, frames: number): number {
  if (frames <= 0) return 0;
  return Math.floor((Math.max(0, ms) / 1000) * fps) % frames;
}

/** The tiles of `original` corn that are no longer standing (to draw as stubble). */
export function cutCornTiles(original: readonly TileCoord[], standing: ReadonlySet<string>): TileCoord[] {
  return original.filter((t) => !standing.has(`${t.col},${t.row}`));
}

/** Where to put dust plumes along a lane: from `startAlong` to the lane's far end, staggered across the lane. */
export function plumeSpots(lane: CombineLane, startAlong: number): Vec2[] {
  const dir = lane.to >= lane.from ? 1 : -1;
  const from = dir > 0 ? Math.max(lane.from, startAlong) : Math.min(lane.from, startAlong);
  const out: Vec2[] = [];
  let i = 0;
  for (let a = from + (dir * PLUME_SPACING) / 2; dir > 0 ? a <= lane.to : a >= lane.to; a += dir * PLUME_SPACING) {
    const across = lane.at + (i % 2 === 0 ? -PLUME_STAGGER : PLUME_STAGGER);
    out.push(lane.axis === 'horizontal' ? { x: a, y: across } : { x: across, y: a });
    i++;
  }
  return out;
}

/** 0 as the bale is thrown, 1 just before it lands. `progress` is the share of the flight flown. */
export function baleShadowFrame(progress: number): 0 | 1 {
  return progress >= BALE_SHADOW_LATE ? 1 : 0;
}

/** Pixels of the harvester hidden below the ditch's edge, from how far it still is from the end of its path. */
export function ditchSinkPx(distToEnd: number): number {
  if (distToEnd >= DITCH_SINK_START_PX) return 0;
  const f = 1 - Math.max(0, distToEnd) / DITCH_SINK_START_PX;
  return Math.round(f * DITCH_SINK_MAX_PX);
}

/** A combine's cab light body: the boss body tagged `lightN` on the combine's texture. */
export function isSensorLightBody(tag: string, spriteKey: string): boolean {
  return /^light\d+$/.test(tag) && spriteKey === COMBINE_TEXTURE;
}
