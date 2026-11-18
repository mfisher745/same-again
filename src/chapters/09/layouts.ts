/**
 * Chapter 9: the plain data in `maps.ts` (`GRAVITY_ROOMS`, `HALL_BAYS`) turned into the shapes the systems take
 * (`GravityLayout` for `gravity.ts`, `LockdownPlacement` for `lockdown.ts`). Nothing here has a rule of its own: the rules
 * are the systems'. The maps' `goal` of a room that has a plate (room 2) is not carried over: the system solves a plate
 * room when its crate rests on the plate, which is what the chapter spec says.
 */

import type { AreaRect } from '../../core/chapter';
import type { Vec2 } from '../../core/types';
import type { GravityLayout, GravityRoomLayout } from '../../systems/gravity';
import type { LockdownBay, LockdownPlacement } from '../../systems/lockdown';
import {
  BAY_ROWS,
  GRAVITY_ROOMS,
  HALL_BAYS,
  LIFT_AREA,
  LIFT_ROOM,
  T,
  WAND_TILE,
  gravityCrateId,
  gravityResetId,
  gravityTile,
  tilesArea,
} from './maps';
import type { GravityRoomDef } from './maps';

/** One room as the system has it: the floor is the box round every open cell, pillars inside it are `fixed`, `H` cells are ledges. */
export function gravityRoomLayout(room: GravityRoomDef): GravityRoomLayout {
  const cells: { col: number; row: number; ch: string }[] = [];
  room.rows.forEach((line, row) => [...line].forEach((ch, col) => cells.push({ col, row, ch })));
  const open = cells.filter((c) => c.ch !== '#');
  const minCol = Math.min(...open.map((c) => c.col));
  const maxCol = Math.max(...open.map((c) => c.col));
  const minRow = Math.min(...open.map((c) => c.row));
  const maxRow = Math.max(...open.map((c) => c.row));
  const at = (c: { col: number; row: number }) => gravityTile(room, c);
  const origin = at({ col: minCol, row: minRow });
  return {
    id: room.id,
    area: { col: origin.col, row: origin.row, width: maxCol - minCol + 1, height: maxRow - minRow + 1 },
    crates: room.crates.map((c, k) => ({ id: gravityCrateId(room, k), ...at(c) })),
    fixed: cells.filter((c) => c.ch === '#' && c.col >= minCol && c.col <= maxCol && c.row >= minRow && c.row <= maxRow).map(at),
    plates: room.plate ? [{ id: `${room.id}.plate`, ...at(room.plate) }] : [],
    ledges: cells.filter((c) => c.ch === 'H').map((c, k) => ({ id: `${room.id}.ledge${k + 1}`, ...at(c) })),
    switches: room.switches.map((s) => ({ id: s.id, examinableId: s.id, dir: s.direction, ...at(s.wall) })),
    andrewStart: at(room.start),
    resetExaminableId: gravityResetId(room),
  };
}

export const GRAVITY_LAYOUT: GravityLayout = { rooms: GRAVITY_ROOMS.map(gravityRoomLayout) };

export const LOCKDOWN_ID = 'c9.setpiece.lockdown' as const;
export const LIFT_PANEL_ID = 'c9.hall.lift';
export const RECORDER_ID = 'c9.hall.recorder';
/** The lift panel is the wall beside the lift's doors, worked from `LIFT_SPOT`. */
export const LIFT_PANEL = T(47, 16);

const px = (r: AreaRect): AreaRect => r;

/** The hall's five bays, the lift and the room beyond, for `lockdown.ts`. */
export function lockdownPlacement(): LockdownPlacement {
  const bays = HALL_BAYS.map((bay): LockdownBay => {
    const rows = BAY_ROWS.to - BAY_ROWS.from + 1;
    const area = tilesArea(bay.cols.from, BAY_ROWS.from, bay.cols.to - bay.cols.from + 1, rows);
    const mid = Math.floor((bay.cols.from + bay.cols.to) / 2);
    const sw = bay.gravity?.switch;
    const slideTo: Vec2 | undefined = sw ? T(mid, sw.direction === 'down' ? BAY_ROWS.to : BAY_ROWS.from) : undefined;
    return {
      id: `c9.hall.bay${bay.index}`,
      area,
      start: bay.start,
      door: px(bay.door.area),
      guards: bay.guards.map((g) => ({ enemyId: g.enemyId, position: T(g.tile.col, g.tile.row) })),
      ...(bay.gravity && sw && slideTo
        ? { gravitySwitch: { examinableId: sw.id, position: T(sw.wall.col, sw.wall.row), barrier: tilesArea(bay.gravity.barrier.col, BAY_ROWS.from, 2, rows), slideGuardsTo: slideTo } }
        : {}),
      ...(bay.recorder ? { recorder: { examinableId: RECORDER_ID, position: T(bay.recorder.tile.col, bay.recorder.tile.row + 1) } } : {}),
    };
  });
  return {
    bays,
    // The lift's door blocks the exit area until the panel opens it.
    lift: { examinableId: LIFT_PANEL_ID, door: LIFT_AREA, wandPosition: T(WAND_TILE.col, WAND_TILE.row) },
    beyondArea: tilesArea(LIFT_ROOM.col, LIFT_ROOM.row, LIFT_ROOM.width, LIFT_ROOM.height),
  };
}
