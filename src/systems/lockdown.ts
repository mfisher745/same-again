/**
 * Chapter 9 set piece: the containment hall lockdown (`c9.setpiece.lockdown`). Five bays in a row. The director plays:
 *
 * - Doors: each bay's door closes `door.telegraphMs` after Andrew first enters the bay (the timer is drawn above it). If
 *   it runs out before he has passed it, the door cycles: it shuts, Andrew is back at the bay's start and the timer is
 *   full again. A door that shuts while Andrew is within `lockdown.crushReachPx` of it is a heavy hit (`door.damage`);
 *   one that shuts while he is elsewhere in the bay costs nothing. It is never a restart of the hall.
 * - Guards: each bay's `security` and `clerk`s spawn, leashed to the bay, when he first enters it. They only need passing.
 * - Gravity switches (bays 2 and 4): E (once he has the Borrowed Glove) or a Glove pulse drops the bay's barrier out of
 *   the way and/or slides the bay's guards to the far wall, where they are stunned.
 * - The wall recorder (bay 3): E, then Andrew stays beside it for `lockdown.takeMs`; he gets `c9.proof.footage`.
 *   The proof is evidence (the casebook), so a return to the bar leaves the tape taken.
 * - The lift: E on its panel works only with all five proofs and the lanyard (`lockdown:changed` `liftOpen`, the lift
 *   door stops blocking, the wand is left as a weapon pickup, `wandLeft`); otherwise `liftRefused`. The boss ends when
 *   Andrew reaches the lift (`BossPlacement.exitArea`).
 * - A Myko call (`end('myko')`, also the debug walk): every door open, the barrier gone, the tape given, the wand left.
 * - A return to the bar (`reset()`): the whole hall starts over from bay 1.
 *
 * Numbers: the door timer, damage and weight are `TUNING.bosses['c9.setpiece.lockdown']`'s `door` attack; the rest is
 * `TUNING.overhaul.lockdown`. Plain TypeScript; nothing is saved by the director itself.
 */

import { TUNING } from '../content/tuning';
import { GameEvents } from '../core/types';
import type { AttackDef, BossId, CompletionSource, EnemyId, GameEventBus, HitInfo, ProofId, Vec2, WeaponId } from '../core/types';
import type { AreaRect } from '../core/chapter';
import type { BossRunner } from './boss';
import type { EnemyActor } from './enemies';
import { distance } from './geometry';
import { TILE } from './grid';

export interface LockdownGuard {
  readonly enemyId: EnemyId;
  readonly position: Vec2;
}

/** A gravity switch in a bay. It needs the Glove. Either effect, or both. */
export interface LockdownSwitch {
  /** The examinable at the switch (E on it). */
  readonly examinableId: string;
  readonly position: Vec2;
  /** A barrier standing in the bay, dropped out of the way (`barrierDropped`). */
  readonly barrier?: AreaRect;
  /** The bay's guards slide to this point (the far wall) and are stunned (`guardsSlid`). */
  readonly slideGuardsTo?: Vec2;
}

export interface LockdownBay {
  readonly id: string;
  /** The bay's floor, px. Entering it starts its timer. */
  readonly area: AreaRect;
  /** Where Andrew is put back when the door catches him, px (inside the bay). */
  readonly start: Vec2;
  /** The door at the bay's far end, px (blocks when shut). */
  readonly door: AreaRect;
  readonly guards: readonly LockdownGuard[];
  readonly gravitySwitch?: LockdownSwitch;
  /** Bay 3: the wall recorder. */
  readonly recorder?: { readonly examinableId: string; readonly position: Vec2 };
}

export interface LockdownLift {
  /** E on this panel opens the lift when Andrew has what it needs. */
  readonly examinableId: string;
  /** The lift's own door, px: blocks until it is open. */
  readonly door: AreaRect;
  /** Where the guard's wand is left, px. */
  readonly wandPosition: Vec2;
}

export interface LockdownPlacement {
  /** Exactly five. */
  readonly bays: readonly LockdownBay[];
  readonly lift: LockdownLift;
  /** The room beyond bay 5 that counts as having passed it (default: the boss's `exitArea`). */
  readonly beyondArea?: AreaRect;
  /** The lanyard: Pruitt's, from chapter 8. Held if the flag is set or the evidence is in the casebook. Default flag `lanyard`, evidence `c8.clue.shift`. */
  readonly lanyard?: { readonly flag?: string; readonly evidenceId?: string };
}

export interface LockdownHost {
  readonly bus: GameEventBus;
  playerPosition(): Vec2;
  playerTargetable(): boolean;
  hitPlayer(hit: Omit<HitInfo, 'targetInstanceId'>): boolean;
  /** Puts Andrew at `pos` at once. */
  teleportPlayer(pos: Vec2): void;
  /** Andrew has learned the Borrowed Glove. */
  hasGlove(): boolean;
  hasProof(id: ProofId): boolean;
  /** Pruitt's lanyard (`placement.lanyard`). */
  hasLanyard(): boolean;
  /** Puts a proof in the casebook. */
  giveProof(id: ProofId): void;
  /** Leaves a weapon on the floor for Andrew to pick up (not if he already has it). */
  spawnWeaponPickup(weaponId: WeaponId, pos: Vec2): void;
}

export type DoorState = 'idle' | 'running' | 'shut' | 'passed';

export interface LockdownBayView {
  readonly index: number;
  readonly state: DoorState;
  readonly leftMs: number;
  readonly totalMs: number;
  /** 0 (open) to 1 (shut): how far down the door is drawn. */
  readonly closed: number;
  readonly door: AreaRect;
  /** Where the timer is drawn: above the door. */
  readonly timerAt: Vec2;
  readonly barrier: AreaRect | null;
}

export interface LockdownView {
  readonly bays: readonly LockdownBayView[];
  /** The recorder and how much of the take is done (0..1); null if no bay has one. */
  readonly recorder: { readonly position: Vec2; readonly progress: number; readonly taken: boolean } | null;
  readonly lift: { readonly door: AreaRect; readonly open: boolean };
  /** Everything is open (a Myko call). */
  readonly allOpen: boolean;
}

interface BayState {
  state: DoorState;
  leftMs: number;
  spawned: boolean;
  barrierUp: boolean;
  guards: EnemyActor[];
}

interface Slide {
  readonly actor: EnemyActor;
  readonly from: Vec2;
  readonly to: Vec2;
  elapsedMs: number;
}

const inRect = (r: AreaRect, p: Vec2): boolean => p.x >= r.x && p.y >= r.y && p.x < r.x + r.width && p.y < r.y + r.height;
const rectTouchesTile = (r: AreaRect, col: number, row: number): boolean => r.x < (col + 1) * TILE && r.x + r.width > col * TILE && r.y < (row + 1) * TILE && r.y + r.height > row * TILE;

export class LockdownDirector {
  private bays: BayState[];
  private liftOpen = false;
  private allOpenFlag = false;
  private slides: Slide[] = [];
  private takeMs = 0;
  private taking = false;
  private reopenMs = 0;

  constructor(
    readonly bossId: BossId,
    readonly placement: LockdownPlacement,
    private readonly host: LockdownHost,
  ) {
    this.bays = placement.bays.map(() => freshBay());
  }

  /** Back to the start of the hall (the return to the bar). The tape is in the casebook, so it stays taken. */
  reset(): void {
    this.bays = this.placement.bays.map(() => freshBay());
    this.liftOpen = false;
    this.allOpenFlag = false;
    this.slides = [];
    this.takeMs = 0;
    this.taking = false;
    this.reopenMs = 0;
  }

  /** Door timer, damage and weight: the `door` attack. */
  private door(boss: BossRunner | null): AttackDef | undefined {
    return boss?.def.phases.flatMap((p) => p.attacks).find((a) => a.id === 'door');
  }

  private totalMs(boss: BossRunner | null): number {
    return this.door(boss)?.telegraphMs ?? 0;
  }

  // -- Reading ---------------------------------------------------------------

  /** Whether a tile is closed to Andrew and the guards: a shut door, a standing barrier, a closed lift. */
  blocks(col: number, row: number): boolean {
    if (this.allOpenFlag) return false;
    const p = this.placement;
    for (const [i, bay] of p.bays.entries()) {
      const s = this.bays[i];
      if (!s) continue;
      if (s.state === 'shut' && rectTouchesTile(bay.door, col, row)) return true;
      const barrier = bay.gravitySwitch?.barrier;
      if (barrier && s.barrierUp && rectTouchesTile(barrier, col, row)) return true;
    }
    return !this.liftOpen && rectTouchesTile(p.lift.door, col, row);
  }

  bayIndexAt(pos: Vec2): number {
    return this.placement.bays.findIndex((b) => inRect(b.area, pos));
  }

  doorState(index: number): DoorState {
    return this.bays[index]?.state ?? 'idle';
  }

  leftMs(index: number): number {
    return this.bays[index]?.leftMs ?? 0;
  }

  isLiftOpen(): boolean {
    return this.liftOpen;
  }

  get takeProgress(): number {
    const total = TUNING.overhaul?.lockdown?.takeMs ?? 0;
    return total > 0 ? Math.min(1, this.takeMs / total) : 0;
  }

  view(boss: BossRunner | null): LockdownView {
    const total = this.totalMs(boss);
    const bays = this.placement.bays.map((b, i): LockdownBayView => {
      const s = this.bays[i] ?? freshBay();
      const left = s.state === 'running' ? s.leftMs : s.state === 'shut' ? 0 : total;
      const closed = this.allOpenFlag ? 0 : s.state === 'shut' ? 1 : s.state === 'running' && total > 0 ? 1 - s.leftMs / total : 0;
      return {
        index: i + 1,
        state: s.state,
        leftMs: left,
        totalMs: total,
        closed,
        door: b.door,
        timerAt: { x: b.door.x + b.door.width / 2, y: b.door.y - 6 },
        barrier: b.gravitySwitch?.barrier && s.barrierUp && !this.allOpenFlag ? b.gravitySwitch.barrier : null,
      };
    });
    const rec = this.placement.bays.find((b) => b.recorder)?.recorder;
    return {
      bays,
      recorder: rec ? { position: rec.position, progress: this.takeProgress, taken: this.host.hasProof('c9.proof.footage') } : null,
      lift: { door: this.placement.lift.door, open: this.liftOpen || this.allOpenFlag },
      allOpen: this.allOpenFlag,
    };
  }

  // -- Andrew works things ---------------------------------------------------

  /**
   * E at one of the director's examinables (a gravity switch, the recorder, the lift panel). Returns whether it was one.
   * A switch does nothing without the Glove.
   */
  interact(examinableId: string, boss: BossRunner | null): boolean {
    if (this.allOpenFlag) return this.isMine(examinableId);
    for (const [i, bay] of this.placement.bays.entries()) {
      if (bay.gravitySwitch?.examinableId === examinableId) {
        if (this.host.hasGlove()) this.pullSwitch(i);
        return true;
      }
      if (bay.recorder?.examinableId === examinableId) {
        if (!this.host.hasProof('c9.proof.footage') && !this.taking) {
          this.taking = true;
          this.takeMs = 0;
          this.host.bus.emit(GameEvents.LockdownChanged, { bossId: this.bossId, phase: 'takeStarted', bay: i + 1 });
        }
        return true;
      }
    }
    if (this.placement.lift.examinableId === examinableId) {
      this.tryLift();
      return true;
    }
    void boss;
    return false;
  }

  private isMine(examinableId: string): boolean {
    return this.placement.bays.some((b) => b.gravitySwitch?.examinableId === examinableId || b.recorder?.examinableId === examinableId) || this.placement.lift.examinableId === examinableId;
  }

  /**
   * The Glove's pulse: a switch inside the cone is worked. `aimDeg`/`angleDeg` describe the cone from `from` over
   * `range` px (as `ability:glovePulse`).
   */
  glovePulse(from: Vec2, range: number, aimDeg: number, angleDeg: number): void {
    for (const [i, bay] of this.placement.bays.entries()) {
      const sw = bay.gravitySwitch;
      if (!sw) continue;
      const d = distance(from, sw.position);
      if (d > range) continue;
      const toDeg = (Math.atan2(sw.position.y - from.y, sw.position.x - from.x) * 180) / Math.PI;
      const diff = Math.abs(((toDeg - aimDeg + 540) % 360) - 180);
      if (diff <= angleDeg / 2) this.pullSwitch(i);
    }
  }

  private pullSwitch(i: number): void {
    const bay = this.placement.bays[i];
    const s = this.bays[i];
    const sw = bay?.gravitySwitch;
    if (!bay || !s || !sw) return;
    if (sw.barrier && s.barrierUp) {
      s.barrierUp = false;
      this.host.bus.emit(GameEvents.LockdownChanged, { bossId: this.bossId, phase: 'barrierDropped', bay: i + 1 });
    }
    if (sw.slideGuardsTo) {
      const to = sw.slideGuardsTo;
      let any = false;
      for (const a of s.guards) {
        if (a.down) continue;
        this.slides.push({ actor: a, from: { ...a.pos }, to: { x: to.x, y: to.y }, elapsedMs: 0 });
        any = true;
      }
      if (any) this.host.bus.emit(GameEvents.LockdownChanged, { bossId: this.bossId, phase: 'guardsSlid', bay: i + 1 });
    }
  }

  private tryLift(): void {
    if (this.liftOpen) return;
    const ok = this.allProofs() && this.host.hasLanyard();
    if (!ok) {
      this.host.bus.emit(GameEvents.LockdownChanged, { bossId: this.bossId, phase: 'liftRefused' });
      return;
    }
    this.liftOpen = true;
    this.host.bus.emit(GameEvents.LockdownChanged, { bossId: this.bossId, phase: 'liftOpen' });
    this.leaveWand();
  }

  private allProofs(): boolean {
    return (['c9.proof.craft', 'c9.proof.contract', 'c9.proof.directory', 'c9.proof.log', 'c9.proof.footage'] as const).every((p) => this.host.hasProof(p));
  }

  private leaveWand(): void {
    this.host.spawnWeaponPickup('securityWand', this.placement.lift.wandPosition);
    this.host.bus.emit(GameEvents.LockdownChanged, { bossId: this.bossId, phase: 'wandLeft' });
  }

  /** The set piece ended. A Myko call (or the debug walk) leaves every door open, gives the tape and leaves the wand. */
  end(by: CompletionSource): void {
    if (by === 'player') return;
    this.allOpenFlag = true;
    this.liftOpen = true;
    this.taking = false;
    for (const s of this.bays) s.state = 'passed';
    if (!this.host.hasProof('c9.proof.footage')) this.host.giveProof('c9.proof.footage');
    this.host.bus.emit(GameEvents.LockdownChanged, { bossId: this.bossId, phase: 'allOpen' });
    this.leaveWand();
  }

  // -- Tick ------------------------------------------------------------------

  tick(dtMs: number, boss: BossRunner | null, active: boolean): void {
    if (!boss || !active || this.allOpenFlag) return;
    const total = this.totalMs(boss);
    const atk = this.door(boss);
    const player = this.host.playerPosition();
    const targetable = this.host.playerTargetable();
    this.tickSlides(dtMs);
    if (this.reopenMs > 0) {
      this.reopenMs = Math.max(0, this.reopenMs - dtMs);
      if (this.reopenMs === 0) {
        for (const s of this.bays) {
          if (s.state === 'shut') {
            s.state = 'running';
            s.leftMs = total;
          }
        }
      }
    }
    const here = this.bayIndexAt(player);
    // Bays are entered in order; a bay is passed once Andrew is in a later bay (or beyond the last).
    const beyond = this.placement.beyondArea ? inRect(this.placement.beyondArea, player) : false;
    const furthest = beyond ? this.placement.bays.length : here + 1;
    for (const [i, s] of this.bays.entries()) {
      if (s.state === 'passed') continue;
      if (i + 1 < furthest) {
        s.state = 'passed';
        this.host.bus.emit(GameEvents.LockdownChanged, { bossId: this.bossId, phase: 'bayPassed', bay: i + 1 });
        continue;
      }
      if (s.state === 'idle' && i === here && targetable) this.enterBay(i, total, boss);
    }
    for (const [i, s] of this.bays.entries()) {
      if (s.state !== 'running') continue;
      s.leftMs -= dtMs;
      if (s.leftMs > 0) continue;
      this.shutDoor(i, atk, player, targetable);
    }
    this.tickTake(dtMs, player);
  }

  private enterBay(i: number, total: number, boss: BossRunner): void {
    const s = this.bays[i];
    const bay = this.placement.bays[i];
    if (!s || !bay) return;
    s.state = 'running';
    s.leftMs = total;
    this.host.bus.emit(GameEvents.LockdownChanged, { bossId: this.bossId, phase: 'bayEntered', bay: i + 1 });
    this.host.bus.emit(GameEvents.LockdownChanged, { bossId: this.bossId, phase: 'doorLit', bay: i + 1 });
    if (s.spawned) return;
    s.spawned = true;
    for (const g of bay.guards) {
      const a = boss.spawnAdd(g.enemyId, g.position);
      a.leash = bay.area;
      s.guards.push(a);
    }
  }

  private shutDoor(i: number, atk: AttackDef | undefined, player: Vec2, targetable: boolean): void {
    const bay = this.placement.bays[i];
    const s = this.bays[i];
    if (!bay || !s) return;
    s.state = 'shut';
    s.leftMs = 0;
    this.reopenMs = TUNING.overhaul?.lockdown?.doorReopenMs ?? 0;
    this.host.bus.emit(GameEvents.LockdownChanged, { bossId: this.bossId, phase: 'doorShut', bay: i + 1 });
    const reach = TUNING.overhaul?.lockdown?.crushReachPx ?? 0;
    const d = bay.door;
    const near = player.x >= d.x - reach && player.x <= d.x + d.width + reach && player.y >= d.y - reach && player.y <= d.y + d.height + reach;
    // Andrew is back at the bay's start; the door reopens with a full timer (see `tick`).
    if (near && targetable && atk) {
      this.host.bus.emit(GameEvents.LockdownChanged, { bossId: this.bossId, phase: 'crushed', bay: i + 1 });
      this.host.hitPlayer({
        source: { kind: 'boss', bossId: this.bossId, attackId: atk.id },
        amount: atk.damage,
        knockback: { x: 0, y: 0 },
        stunMs: 0,
        holdMs: 0,
        weight: atk.weight ?? 'heavy',
      });
    }
    if (this.bayIndexAt(player) === i || near) this.host.teleportPlayer({ ...bay.start });
  }

  private tickSlides(dtMs: number): void {
    if (this.slides.length === 0) return;
    const slideMs = Math.max(1, TUNING.overhaul?.lockdown?.guardSlideMs ?? 1);
    for (const sl of this.slides) {
      sl.elapsedMs += dtMs;
      const t = Math.min(1, sl.elapsedMs / slideMs);
      sl.actor.pos = { x: sl.from.x + (sl.to.x - sl.from.x) * t, y: sl.from.y + (sl.to.y - sl.from.y) * t };
      if (t >= 1 && !sl.actor.down) sl.actor.stun(TUNING.overhaul?.lockdown?.guardSlideStunMs ?? 0);
    }
    this.slides = this.slides.filter((s) => s.elapsedMs < slideMs && !s.actor.down);
  }

  private tickTake(dtMs: number, player: Vec2): void {
    if (!this.taking) return;
    const rec = this.placement.bays.find((b) => b.recorder)?.recorder;
    const t = TUNING.overhaul?.lockdown;
    if (!rec || !t) return;
    if (distance(player, rec.position) > t.takeReachPx) {
      // Stepping away from the wall stops the take.
      this.taking = false;
      this.takeMs = 0;
      return;
    }
    this.takeMs += dtMs;
    if (this.takeMs < t.takeMs) return;
    this.taking = false;
    this.takeMs = 0;
    this.host.giveProof('c9.proof.footage');
    this.host.bus.emit(GameEvents.LockdownChanged, { bossId: this.bossId, phase: 'takeDone', bay: this.placement.bays.findIndex((b) => b.recorder) + 1 });
  }
}

function freshBay(): BayState {
  return { state: 'idle', leftMs: 0, spawned: false, barrierUp: true, guards: [] };
}
