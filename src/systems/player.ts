/**
 * Andrew: movement, sneak, aim, facing and flinch, plus the stats that travel
 * with him (the Buzz meter, inventory, abilities). DESIGN.md sections 6, 7.1
 * and 7.2. Plain TypeScript.
 *
 * There is no health: a hit moves the meter by its weight (`hits.ts`) and the
 * meter reaching 0 or the floor sends him back to the bar (`barFlow.ts`).
 * WASD moves at `runSpeed`; Shift sneaks at `runSpeed * sneakSpeedMultiplier`.
 */

import { TUNING } from '../content/tuning';
import { GameEvents } from '../core/types';
import type {
  ChapterNumber,
  DrunkLevel,
  Facing,
  GameEventBus,
  HitInfo,
  InputFrame,
  Kit,
  MeterSnapshot,
  OverhaulDrinkId,
  TileGrid,
  Vec2,
} from '../core/types';
import { decayVelocity } from './combat';
import { angleOf, facingFromAngle, fromAngle, scale, normalize, sub } from './geometry';
import { moveBox } from './grid';
import { applyHit } from './hits';
import { footstepNoiseRadius } from './rewards';
import { createMeter, drink, levelFor, levelTable, setInSun, snapshot, stepMeter } from './meter';
import type { MeterResult, MeterState } from './meter';

export class Player {
  readonly instanceId = 'andrew';
  pos: Vec2 = { x: 0, y: 0 };
  facing: Facing = 'down';
  /** Aim angle, degrees. */
  aimDeg = 90;
  /** Mouse aim point. */
  aimPoint: Vec2 = { x: 0, y: 0 };
  moving = false;
  sneaking = false;
  /** Time standing still, for Act Natural. */
  stillMs = 0;
  /** Set while the return to the bar plays: nothing hurts him and he cannot act. */
  returning = false;
  /** Set by the Myko call-in: nothing can hurt Andrew while Myko works. */
  protected_ = false;

  /** The Buzz meter (DESIGN.md 7.1). Replace through `applyMeter`. */
  meter: MeterState;

  /** A chapter script has hidden the meter (the HUD does not draw it). Survives a return to the bar. */
  private hiddenMeter = false;
  /** A chapter script is holding the drain. Survives a return to the bar. */
  private drainIsHeld = false;

  private invulnMs = 0;
  private kb: Vec2 = { x: 0, y: 0 };
  private heldMs = 0;
  private stunMs = 0;

  /** What he carries (DESIGN.md 7.1 "The kit"). Replace through `setKit`. */
  kit: Kit;

  constructor(
    private readonly bus: GameEventBus,
    kit: Kit,
    readonly chapter: ChapterNumber,
  ) {
    this.meter = createMeter(chapter);
    this.kit = kit;
  }

  get level(): DrunkLevel {
    return levelFor(this.meter.value, levelTable(this.chapter));
  }

  meterSnapshot(): MeterSnapshot {
    return { ...snapshot(this.meter), hidden: this.hiddenMeter, drainHeld: this.drainIsHeld };
  }

  get meterHidden(): boolean {
    return this.hiddenMeter;
  }

  get drainHeld(): boolean {
    return this.drainIsHeld;
  }

  /** Hide or show the meter. Emits `meter:hiddenChanged` on a change. */
  setMeterHidden(hidden: boolean): void {
    if (this.hiddenMeter === hidden) return;
    this.hiddenMeter = hidden;
    this.bus.emit(GameEvents.MeterHiddenChanged, { hidden });
  }

  /** Hold the plain drain (spirit and tea timers still run). */
  holdDrain(held: boolean): void {
    this.drainIsHeld = held;
  }

  get invulnerable(): boolean {
    return this.invulnMs > 0 || this.protected_ || this.returning;
  }

  get held(): boolean {
    return this.heldMs > 0;
  }

  /** Flinching, or on the way back to the bar. */
  get incapacitated(): boolean {
    return this.stunMs > 0 || this.returning;
  }

  get canAct(): boolean {
    return !this.incapacitated && !this.held;
  }

  /** Back in the bar: a fresh meter (bottom of Grand), nothing in flight. */
  resetForBar(meter: MeterState = createMeter(this.chapter)): void {
    this.meter = meter;
    this.returning = false;
    this.invulnMs = 0;
    this.kb = { x: 0, y: 0 };
    this.heldMs = 0;
    this.stunMs = 0;
  }

  /** Adopt a meter result: emit its events. The meter keeps `returnReason` for the run to act on. */
  applyMeter(r: MeterResult): void {
    const before = this.meter.value;
    this.meter = r.state;
    if (r.state.value !== before) this.bus.emit(GameEvents.BuzzChanged, { value: r.state.value, delta: r.state.value - before });
    for (const e of r.events) {
      switch (e.kind) {
        case 'levelChanged':
          this.bus.emit(GameEvents.BuzzLevelChanged, { from: e.from, to: e.to, state: e.state, value: e.value });
          break;
        case 'spiritStarted':
          this.bus.emit(GameEvents.SpiritStarted, { drinkId: e.drinkId, durationMs: e.durationMs });
          break;
        case 'spiritEnded':
          this.bus.emit(GameEvents.SpiritEnded, { drinkId: e.drinkId });
          break;
      }
    }
  }

  /** Adopt a kit; emits `kit:changed` if it differs. */
  setKit(kit: Kit): void {
    if (kit === this.kit) return;
    this.kit = kit;
    this.bus.emit(GameEvents.KitChanged, { kit });
  }

  setInSun(inSun: boolean): void {
    this.meter = setInSun(this.meter, inSun);
  }

  /** Constant drain, spirit window and tea (DESIGN.md 7.1). */
  tickMeter(dtMs: number): void {
    if (this.returning) return;
    this.applyMeter(stepMeter(this.meter, dtMs, undefined, this.drainIsHeld));
  }

  /** Drink through the meter (the kit has already given the drink up). */
  drinkDrink(id: OverhaulDrinkId): void {
    this.applyMeter(drink(this.meter, id));
  }

  /** Movement and aim for one tick. Returns the distance moved. */
  move(dtMs: number, input: InputFrame, grid: TileGrid, extraBlocked?: (c: number, r: number) => boolean, speedMultiplier = 1): number {
    this.invulnMs = Math.max(0, this.invulnMs - dtMs);
    this.heldMs = Math.max(0, this.heldMs - dtMs);
    this.stunMs = Math.max(0, this.stunMs - dtMs);

    const rawAim = angleOf(sub(input.aim, this.pos));
    this.aimDeg = rawAim;
    this.aimPoint = input.aim;

    const w = TUNING.player.bodyWidth;
    const h = TUNING.player.bodyHeight;
    let delta: Vec2 = { x: 0, y: 0 };
    this.sneaking = input.held.has('sneak');

    if (!this.incapacitated && !this.held) {
      const dir = normalize(input.move);
      if (dir.x !== 0 || dir.y !== 0) {
        let speed = TUNING.player.runSpeed;
        if (this.sneaking) speed *= TUNING.player.sneakSpeedMultiplier;
        speed *= speedMultiplier;
        delta = scale(scale(dir, speed), dtMs / 1000);
        this.facing = facingFromAngle(angleOf(dir));
      }
    }
    if (this.kb.x !== 0 || this.kb.y !== 0) {
      delta = { x: delta.x + (this.kb.x * dtMs) / 1000, y: delta.y + (this.kb.y * dtMs) / 1000 };
      this.kb = decayVelocity(this.kb, TUNING.combat.knockbackDecayPerSecond, dtMs);
    }
    const before = this.pos;
    const res = moveBox(grid, this.pos, w, h, delta, extraBlocked);
    this.pos = res.position;
    const moved = Math.hypot(this.pos.x - before.x, this.pos.y - before.y);
    const tryingToMove = input.move.x !== 0 || input.move.y !== 0;
    this.moving = moved > 0.01 && tryingToMove;
    this.stillMs = tryingToMove ? 0 : this.stillMs + dtMs;
    return moved;
  }

  /** A short lurch along `angleDeg` (the Shoulder, the Stumble): up to `distance`, stopping at walls and anything `extraBlocked` (checked along the whole path, in `moveBox` steps). */
  lurch(distance: number, angleDeg: number, grid: TileGrid, extraBlocked?: (c: number, r: number) => boolean): void {
    const d = fromAngle(angleDeg, distance);
    this.pos = moveBox(grid, this.pos, TUNING.player.bodyWidth, TUNING.player.bodyHeight, d, extraBlocked).position;
  }

  /** Faces the aim (used when attacking). */
  faceAim(): void {
    this.facing = facingFromAngle(this.aimDeg);
  }

  /**
   * A hit from an enemy or boss: moves the meter by its weight, then flinch
   * and knockback. Returns true if it landed. DESIGN.md 7.1 "Being hit".
   */
  takeHit(hit: HitInfo): boolean {
    if (this.invulnerable || this.meter.returnReason) return false;
    const r = applyHit(this.meter, hit.weight ?? 'ordinary');
    this.applyMeter(r);
    if (r.direction === null) return false;
    this.kb = hit.knockback;
    if (hit.holdMs > 0) this.heldMs = hit.holdMs;
    if (hit.stunMs > 0) this.stunMs = hit.stunMs;
    this.invulnMs = TUNING.player.hurtInvulnerableMs;
    this.bus.emit(GameEvents.PlayerHit, { source: hit.source, weight: hit.weight ?? 'ordinary', direction: r.direction, amount: r.amount });
    return true;
  }

  /** Noise radius of Andrew's footsteps right now; 0 when silent. DESIGN.md 7.3. */
  footstepNoiseRadius(): number {
    if (!this.moving) return 0;
    return footstepNoiseRadius(this.level, this.sneaking);
  }
}
