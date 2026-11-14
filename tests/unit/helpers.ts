/**
 * Shared builders for the unit suite. Not a test file. Everything here is
 * deterministic: seeded random, explicit time deltas, in-memory storage.
 */

import { hasSequence, pool as dialoguePool, sequence } from '../../src/content/dialogue';
import { EventBus } from '../../src/core/events';
import { NO_INPUT } from '../../src/core/input';
import { seededRandom } from '../../src/core/random';
import { createSandboxModule } from '../../src/core/sandbox';
import type { ChapterModule } from '../../src/core/chapter';
import type {
  GameEventBus,
  GameEventName,
  GameEventPayloads,
  InputAction,
  InputFrame,
  BarReturnReason,
  SaveReason,
  OverhaulSaveState,
  Vec2,
} from '../../src/core/types';
import { gridFromAscii } from '../../src/systems/grid';
import { ChapterRun } from '../../src/systems/run';
import type { RunEffect } from '../../src/systems/run';
import { emptyProgress, saveAtChapterStart } from '../../src/systems/session';

export { NO_INPUT };

/** Records every payload of the listed events, in order. */
export function record<K extends GameEventName>(bus: GameEventBus, event: K): GameEventPayloads[K][] {
  const seen: GameEventPayloads[K][] = [];
  bus.on(event, (p) => {
    seen.push(p);
  });
  return seen;
}

/** An input frame with the given actions pressed (and so held) this tick. */
export function frame(
  opts: {
    pressed?: InputAction[];
    held?: InputAction[];
    released?: InputAction[];
    holdMs?: Partial<Record<InputAction, number>>;
    move?: Vec2;
    aim?: Vec2;
  } = {},
): InputFrame {
  const pressed = opts.pressed ?? [];
  return {
    move: opts.move ?? { x: 0, y: 0 },
    aim: opts.aim ?? { x: 100, y: 0 },
    pressed: new Set(pressed),
    held: new Set([...(opts.held ?? []), ...pressed]),
    released: new Set(opts.released ?? []),
    holdMs: opts.holdMs ?? {},
  };
}

/** Wide-open grid, 20 x 12 tiles. */
export const openGrid = () =>
  gridFromAscii(Array.from({ length: 12 }, (_, r) => (r === 0 || r === 11 ? '#'.repeat(20) : `#${'.'.repeat(18)}#`)));

export interface RunHarness {
  readonly run: ChapterRun;
  readonly bus: EventBus;
  readonly saves: { state: OverhaulSaveState; reason: SaveReason }[];
  readonly returns: BarReturnReason[];
  readonly completions: { endState: string; snapshot: OverhaulSaveState }[];
  readonly module: ChapterModule;
}

/** A headless chapter run on the dev sandbox, capturing every save the run writes. */
export function makeRun(
  opts: { chapter?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10; save?: (base: OverhaulSaveState) => OverhaulSaveState; seed?: number; module?: ChapterModule; playEffect?: (id: RunEffect) => void; manualReturn?: boolean } = {},
): RunHarness {
  const module = opts.module ?? createSandboxModule(opts.chapter ?? 1);
  const base = saveAtChapterStart(module, emptyProgress());
  const save = opts.save ? opts.save(base) : base;
  const bus = new EventBus();
  const saves: RunHarness['saves'] = [];
  const returns: BarReturnReason[] = [];
  bus.on('bar:returned', ({ reason }) => void returns.push(reason));
  const completions: RunHarness['completions'] = [];
  const run = new ChapterRun({
    module,
    save,
    bus,
    rng: seededRandom(opts.seed ?? 7),
    dialogue: { delivery: (id) => (hasSequence(id) ? sequence(id).delivery : null) },
    pool: (id) => {
      try {
        return dialoguePool(id);
      } catch {
        return [];
      }
    },
    resumed: false,
    ...(opts.playEffect ? { playEffect: opts.playEffect } : {}),
    writeSave: (state, reason) => {
      saves.push({ state, reason });
    },
    onChapterComplete: (endState, snapshot) => {
      completions.push({ endState, snapshot });
    },
  });
  // The return is two-phase (bar:returning, then the scene calls completeBarReturn); here the scene is instant.
  if (!opts.manualReturn) bus.on('bar:returning', () => run.completeBarReturn());
  run.tick(16, NO_INPUT);
  return { run, bus, saves, returns, completions, module };
}

/**
 * Ticks `ms` of game time in `step` ms slices with no input. Never completes a waiting bar return: a run from
 * `makeRun` does it itself (unless `manualReturn`), and a `GameSession` run needs `advanceWithScene`.
 */
export function advance(run: ChapterRun, ms: number, step = 16): void {
  for (let t = 0; t < ms; t += step) run.tick(step, NO_INPUT);
}

/** Like `advance`, but plays the part of an instant scene: completes any waiting bar return after each tick. */
export function advanceWithScene(run: ChapterRun, ms: number, step = 16): void {
  for (let t = 0; t < ms; t += step) {
    run.tick(step, NO_INPUT);
    run.completeBarReturn();
  }
}

/** Moves Andrew to a tile centre of the sandbox and ticks once so triggers fire. */
export function teleport(run: ChapterRun, col: number, row: number): void {
  run.setPlayerPosition({ x: col * 16 + 8, y: row * 16 + 8 });
  run.tick(16, NO_INPUT);
}

/** Holds M for `ms`, delivering it as the input tracker would, one tick at a time. */
export function holdM(run: ChapterRun, ms: number, step = 100): void {
  for (let t = step; t <= ms; t += step) {
    run.tick(step, { ...NO_INPUT, held: new Set(['callMyko']), pressed: t === step ? new Set(['callMyko']) : new Set(), holdMs: { callMyko: t } });
  }
}
