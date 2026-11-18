/**
 * Chapter 8 perimeter hardware, built from the layout's own data so the stealth section's hazards and the junction
 * puzzle agree on ids (`src/chapters/08/maps.ts`: `SENSOR_LINES`, `THERMAL_MASTS`, `PATROL_TRUCKS`, `JUNCTION_BOXES`,
 * `CORRIDOR_LINES`). Plain TypeScript; the shapes below are structural, so the chapter's data passes straight in.
 *
 * - `perimeterHazards` gives the `StealthHazardDef[]` of `c8.stealth.perimeter`: a `groundSensor` per sensor of every line
 *   (ids from `lineSensorId`), a `thermalMast` per mast, a `patrolTruck` per route (its spotter cone is
 *   `TUNING.overhaul.perimeter.truckCone`; outcrops that block sight block it).
 * - `junctionLayoutFrom` gives the `JunctionLayout` for `JunctionPlacement`: lines as strings '1'..'5', each box's `lines`
 *   as the two it toggles, `targetOff` the corridor lines.
 */

import { TUNING } from '../content/tuning';
import type { PatrolRoute, StealthHazardDef, StealthSectionId, Vec2 } from '../core/types';
import type { JunctionLayout } from './junctions';

export interface PerimeterLineData {
  readonly line: number;
  readonly sensors: readonly Vec2[];
}

export interface PerimeterBoxData {
  readonly id: string;
  readonly lines: readonly [number, number];
}

export interface PerimeterTruckData {
  readonly id: string;
  readonly route: PatrolRoute;
}

/** The hazard id of sensor `index` (0-based) of line `line` (1-based). */
export const lineSensorId = (line: number, index: number): string => `c8.line${line}.s${index}`;

/** The default examinable id of a junction box (`c8.junction.near`); the chapter places one there for E. */
export const junctionExaminableId = (boxId: string): string => `c8.junction.${boxId}`;

export function perimeterHazards(data: {
  readonly lines: readonly PerimeterLineData[];
  readonly masts: readonly Vec2[];
  readonly trucks: readonly PerimeterTruckData[];
}): StealthHazardDef[] {
  const t = TUNING.overhaul?.perimeter;
  if (!t) throw new Error('TUNING.overhaul.perimeter is missing');
  const out: StealthHazardDef[] = [];
  for (const l of data.lines) l.sensors.forEach((position, i) => out.push({ kind: 'groundSensor', id: lineSensorId(l.line, i), position, radius: t.sensorRadiusPx }));
  data.masts.forEach((position, i) => out.push({ kind: 'thermalMast', id: `c8.mast${i}`, position, range: t.mastRangePx }));
  for (const k of data.trucks) out.push({ kind: 'patrolTruck', id: k.id, route: k.route, speed: t.truckSpeed, headlights: t.truckCone });
  return out;
}

export function junctionLayoutFrom(data: {
  readonly lines: readonly PerimeterLineData[];
  readonly boxes: readonly PerimeterBoxData[];
  readonly targetLines: readonly number[];
  readonly stealthId: StealthSectionId;
  readonly examinableId?: (boxId: string) => string;
}): JunctionLayout {
  const name = data.examinableId ?? junctionExaminableId;
  return {
    stealthId: data.stealthId,
    lines: data.lines.map((l) => ({ id: String(l.line), sensorIds: l.sensors.map((_, i) => lineSensorId(l.line, i)) })),
    boxes: data.boxes.map((b) => ({ id: b.id, examinableId: name(b.id), toggles: [String(b.lines[0]), String(b.lines[1])] as const })),
    targetOff: data.targetLines.map(String),
  };
}
