/**
 * Chapter 8 junction puzzle (`c8.puzzle.junctions`): three boxes each toggle two of five sensor lines. Each line is a
 * row of real ground sensors of the perimeter stealth section; a line that is switched off disables its sensors. The
 * goal is for the target lines to be off (the three between Andrew and the fence). Solvable in four toggles from every
 * line on. `completeNow()` switches the target lines off. Plain TypeScript.
 *
 * The puzzle does not own the sensors: it calls `setLine` (the run wires that to `StealthControl.setHazardEnabled`
 * for every sensor of the line). Line state is saved by the run as a flag so a return to the bar keeps it.
 */

import { GameEvents } from '../core/types';
import type { GameEventBus, PuzzleDef, Reward } from '../core/types';
import { PuzzleBase } from './investigation';
import type { SectionHost } from './sections';

export interface JunctionBox {
  readonly id: string;
  /** The examinable that toggles this box (E on it). */
  readonly examinableId: string;
  /** The two line ids it toggles. */
  readonly toggles: readonly [string, string];
}

export interface JunctionLine {
  readonly id: string;
  /** Ids of the `groundSensor` hazards (in the stealth section) that belong to this line. */
  readonly sensorIds: readonly string[];
}

export interface JunctionLayout {
  /** Exactly five lines. */
  readonly lines: readonly JunctionLine[];
  /** Exactly three boxes. */
  readonly boxes: readonly JunctionBox[];
  /** The stealth section whose sensors the lines disable. */
  readonly stealthId: string;
  /** Lines that must be off (the three between Andrew and the fence). */
  readonly targetOff: readonly string[];
}

/** For the view: one box and the state of what it toggles. */
export interface JunctionView {
  readonly boxId: string;
  readonly toggles: readonly [string, string];
}

/** The smallest number of toggles that solves a layout from all lines on (BFS), or null. Used by tests and the doc. */
export function minToggles(layout: JunctionLayout): number | null {
  const n = layout.lines.length;
  const bit = (id: string): number => layout.lines.findIndex((l) => l.id === id);
  const masks = layout.boxes.map((b) => (1 << bit(b.toggles[0])) | (1 << bit(b.toggles[1])));
  const target = layout.targetOff.reduce((m, id) => m | (1 << bit(id)), 0);
  // State: bit set = line OFF. Solved when every target line is off.
  const seen = new Map<number, number>([[0, 0]]);
  let frontier = [0];
  for (let d = 0; frontier.length > 0 && d < 12; d++) {
    const next: number[] = [];
    for (const s of frontier) {
      if ((s & target) === target) return d;
      for (const m of masks) {
        const t = s ^ m;
        if (!seen.has(t)) {
          seen.set(t, d + 1);
          next.push(t);
        }
      }
    }
    frontier = next;
  }
  void n;
  return null;
}

export class JunctionPuzzle extends PuzzleBase {
  private off = new Set<string>();
  toggles = 0;
  /** Switches a line's sensors on or off. Set by the run. */
  setLine: (line: JunctionLine, on: boolean) => void = () => undefined;

  constructor(
    def: PuzzleDef,
    readonly layout: JunctionLayout,
    host: SectionHost,
    private readonly events: GameEventBus,
    reward?: Reward,
  ) {
    super(def, host, events, reward);
  }

  boxForExaminable(examinableId: string): JunctionBox | undefined {
    return this.layout.boxes.find((b) => b.examinableId === examinableId);
  }

  /** Lines now off. */
  linesOff(): readonly string[] {
    return this.layout.lines.filter((l) => this.off.has(l.id)).map((l) => l.id);
  }

  isLineOff(lineId: string): boolean {
    return this.off.has(lineId);
  }

  views(): readonly JunctionView[] {
    return this.layout.boxes.map((b) => ({ boxId: b.id, toggles: b.toggles }));
  }

  /** Restores which lines are off (from the saved flag) without counting a toggle. */
  restoreOff(lineIds: readonly string[]): void {
    this.off = new Set(lineIds.filter((id) => this.layout.lines.some((l) => l.id === id)));
    this.apply();
  }

  /** Andrew works a box: both its lines flip. Returns false for an unknown box or a solved puzzle. */
  toggle(boxId: string): boolean {
    const box = this.layout.boxes.find((b) => b.id === boxId);
    if (!box || this.isComplete()) return false;
    this.start();
    for (const id of box.toggles) {
      if (this.off.has(id)) this.off.delete(id);
      else this.off.add(id);
    }
    this.toggles += 1;
    this.apply();
    this.events.emit(GameEvents.JunctionsToggled, { puzzleId: this.def.id, boxId, off: this.linesOff() });
    if (this.layout.targetOff.every((id) => this.off.has(id))) this.solved();
    return true;
  }

  /** Re-applies every line to its sensors (after a stealth section's hazards were rebuilt). */
  apply(): void {
    for (const l of this.layout.lines) this.setLine(l, !this.off.has(l.id));
  }

  protected applySolution(): void {
    for (const id of this.layout.targetOff) this.off.add(id);
    this.apply();
  }
}
