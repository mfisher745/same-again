/**
 * Chapter 8 heat (DESIGN.md 7.1 "Heat"). There is no heat meter: while Andrew is out in the sun the Buzz drain doubles
 * and drink goes half as far again (`meter.ts`, `TUNING.overhaul.sun`). This file only decides WHERE he is in the sun:
 * a screen is sunny (`ScreenDef.sun`) unless he stands in shade. Shade is a shade tile (`TileGrid.shade`), a static
 * shade area of the layout (`ScreenLayout.shadeAreas`: outcrops, the roadhouse awning) or a shade area a script moves
 * (`ChapterContext.setShadeArea`: a parked truck's shadow). After sunset the chapter switches heat off. Plain TypeScript.
 */

import type { ScreenId, Vec2 } from '../core/types';

export interface ShadeRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const inside = (r: ShadeRect, p: Vec2): boolean => p.x >= r.x && p.y >= r.y && p.x < r.x + r.width && p.y < r.y + r.height;

export class ShadeField {
  private readonly fixed = new Map<ScreenId, readonly ShadeRect[]>();
  private readonly moving = new Map<string, { readonly screenId: ScreenId; readonly area: ShadeRect }>();

  /** Declares a screen's static shade areas. */
  mark(screenId: ScreenId, areas: readonly ShadeRect[]): void {
    this.fixed.set(screenId, areas);
  }

  /** Puts a named shade area on a screen, or takes it away with `null`. Setting an id again moves it. */
  set(id: string, screenId: ScreenId, area: ShadeRect | null): void {
    if (area === null) this.moving.delete(id);
    else this.moving.set(id, { screenId, area });
  }

  /** Every shade area on a screen now, static first (for drawing). */
  areas(screenId: ScreenId): readonly ShadeRect[] {
    const out = [...(this.fixed.get(screenId) ?? [])];
    for (const m of this.moving.values()) if (m.screenId === screenId) out.push(m.area);
    return out;
  }

  inShade(screenId: ScreenId, p: Vec2): boolean {
    return this.areas(screenId).some((r) => inside(r, p));
  }

  /** Run-time shade areas go with the world (a return to the bar, a reload); the script puts them back. */
  clearMoving(): void {
    this.moving.clear();
  }
}

/** What the HUD and the view read. */
export interface HeatState {
  /** The chapter's heat switch: false after sunset. */
  readonly active: boolean;
  /** The current screen is a sunny one. */
  readonly sunnyScreen: boolean;
  /** Andrew is out in the sun right now (the HUD's sun mark; `MeterSnapshot.inSun`). */
  readonly inSun: boolean;
}
