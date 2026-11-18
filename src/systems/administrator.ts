/**
 * Chapter 10 boss: the Administrator (`c10.boss.administrator`). He cannot be called in (`NON_CALLABLE_BOSS`). His body
 * stands behind his desk in phases 1 and 2 and walks in phase 3; every attack in his tuning is played by this director
 * (the run sets `BossRunner.directedAttackIds`). Numbers: the attacks and phases are `TUNING.bosses['c10.boss.administrator']`,
 * the rest `TUNING.overhaul.administrator`.
 *
 * - Phase `delegation`: the desk shield (`BossRunner.guard`, front) is up. A pair of `security` comes in
 *   (`administrator.callDelayMs` after the start, and after the shield is back); when both are down the shield drops for
 *   `shieldDownMs`. Stamps: a row of floor (`stampRows`, or Andrew's own row) is lit for the `stamp` telegraph, then a
 *   shockwave crosses it from the desk outward in `stampTravelMs`: a heavy hit if Andrew is on the row as it passes.
 * - Phase `restructuring` (2/3 health): same, and every `gravityFlip` cooldown (10 s, start to start) floor arrows light
 *   toward one of the four walls for the telegraph (1.5 s), then the furniture slides there (heavy hit to Andrew in its
 *   way). E at any of the four switches (or the Glove pulse) puts it back: the furniture returns, and he is thrown against
 *   the far wall and stunned `gravityStunMs`; then he walks back to his desk.
 * - Phase `personally` (1/3 health): the jacket comes off (`setSprite` `.personally`), the shield and guards are gone,
 *   he walks. He cycles `stunPulse` (a ground marker on Andrew's spot; he is held `holdMs`), `teleportStrike` (a marker
 *   behind Andrew, then he is there and strikes) and `beamSweep` (the quarter in front lit, then a beam sweeps it: worst
 *   hit). After every `offerEveryAttacks` attacks he makes an offer (`administrator:changed` `offer` 1 to 3: settlement,
 *   better settlement, job) and pauses `offerPauseMs`. The chapter plays `c10.admin.offer1`, `2`, `3`.
 * - End: `end()` clears everything and emits `sits`; the chapter plays `c10.admin.end`.
 * - A return to the cabinet (`reset()`): phase 1 again, furniture home, nothing is saved.
 *
 * Pure TypeScript.
 */

import { TUNING } from '../content/tuning';
import { GameEvents } from '../core/types';
import type { AttackDef, BossId, CompletionSource, GameEventBus, GravityDir, HitInfo, Vec2 } from '../core/types';
import type { AreaRect } from '../core/chapter';
import type { Random } from '../core/random';
import type { BossRunner } from './boss';
import type { EnemyActor } from './enemies';
import { shapeHits } from './combat';
import { add, angleDiff, angleTo, distance, fromAngle, scale, sub } from './geometry';
import { TILE, tileOf } from './grid';
import { slideBodies } from './gravity';

export interface AdministratorSwitch {
  /** The examinable at the switch (E on it). */
  readonly examinableId: string;
  readonly position: Vec2;
}

export interface AdministratorFurniture {
  readonly id: string;
  /** Where it stands, px (its centre). Slides to a wall and comes back here. */
  readonly position: Vec2;
}

export interface AdministratorPlacement {
  /** Tag of his body (default 'administrator'). */
  readonly tag?: string;
  /** The whole room he fights in, px (36 x 20 tiles). */
  readonly arena: AreaRect;
  /** Where he stands behind the desk, px. */
  readonly desk: Vec2;
  /** Where the pair of guards come in, px (two or more; the pair uses the first two). */
  readonly guardEntrances: readonly Vec2[];
  /** The four gravity switches. */
  readonly switches: readonly AdministratorSwitch[];
  /** Loose furniture that slides. */
  readonly furniture: readonly AdministratorFurniture[];
  /** Tile rows a stamp may mark; absent: the row Andrew is on. */
  readonly stampRows?: readonly number[];
}

export interface AdministratorHost {
  readonly bus: GameEventBus;
  readonly rng: Random;
  playerPosition(): Vec2;
  /** Which way Andrew faces, degrees (for "behind Andrew"). */
  playerFacingDeg(): number;
  playerTargetable(): boolean;
  hitPlayer(hit: Omit<HitInfo, 'targetInstanceId'>): boolean;
  /** Whether a tile is a wall (the screen's grid and solid props). */
  tileBlocked(col: number, row: number): boolean;
}

export interface AdministratorView {
  /** The desk shield is up. */
  readonly shield: boolean;
  readonly stamp: { readonly y: number; readonly fromX: number; readonly toX: number; readonly state: 'lit' | 'wave'; readonly frontX: number } | null;
  /** Floor arrows are lit toward `dir` (`lit`), or gravity is flipped toward it (`flipped`). */
  readonly gravity: { readonly dir: GravityDir; readonly state: 'lit' | 'flipped' } | null;
  readonly furniture: readonly { readonly id: string; readonly pos: Vec2; readonly size: number }[];
  readonly pulse: { readonly spot: Vec2; readonly radius: number; readonly state: 'lit' | 'burst' } | null;
  readonly teleport: { readonly spot: Vec2; readonly state: 'lit' } | null;
  readonly beam: { readonly from: Vec2; readonly aimDeg: number; readonly range: number; readonly angleDeg: number; readonly state: 'lit' | 'sweeping'; readonly beamDeg: number } | null;
  readonly switchesLive: boolean;
  readonly jacketOff: boolean;
  readonly sits: boolean;
}

type P3Attack = 'stunPulse' | 'teleportStrike' | 'beamSweep';
const P3_ORDER: readonly P3Attack[] = ['stunPulse', 'teleportStrike', 'beamSweep'];
const DIRS: readonly GravityDir[] = ['up', 'down', 'left', 'right'];
const BURST_SHOWN_MS = 250;
const EDGE = 12;

interface Piece {
  readonly id: string;
  readonly home: Vec2;
  from: Vec2;
  to: Vec2;
  /** ms into the slide; negative when at rest. */
  t: number;
  hit: boolean;
}

export class AdministratorDirector {
  private phaseId = '';
  // Guards and the shield.
  private guardState: 'off' | 'waiting' | 'pair' | 'down' = 'off';
  private guardMs = 0;
  private guards: EnemyActor[] = [];
  // Stamp.
  private stamp = { state: 'idle' as 'idle' | 'lit' | 'wave', ms: 0, cd: 0, y: 0, hit: false };
  // Gravity.
  private grav = { state: 'idle' as 'idle' | 'lit' | 'flipped', dir: 'down' as GravityDir, cd: 0, ms: 0 };
  private pieces: Piece[];
  // He is thrown, then walks home.
  private returning = false;
  // Phase 3.
  private p3 = {
    state: 'idle' as 'idle' | 'pulseLit' | 'pulseBurst' | 'teleportLit' | 'beamLit' | 'beam',
    ms: 0,
    pauseMs: 0,
    recoverMs: 0,
    next: 0,
    done: 0,
    offers: 0,
    cd: { stunPulse: 0, teleportStrike: 0, beamSweep: 0 } as Record<P3Attack, number>,
    spot: { x: 0, y: 0 },
    aimDeg: 0,
    hit: false,
  };
  private sits = false;

  constructor(
    readonly bossId: BossId,
    readonly placement: AdministratorPlacement,
    private readonly host: AdministratorHost,
  ) {
    this.pieces = placement.furniture.map((f) => fresh(f));
  }

  get tag(): string {
    return this.placement.tag ?? 'administrator';
  }

  reset(): void {
    this.phaseId = '';
    this.guardState = 'off';
    this.guardMs = 0;
    this.guards = [];
    this.stamp = { state: 'idle', ms: 0, cd: 0, y: 0, hit: false };
    this.grav = { state: 'idle', dir: 'down', cd: 0, ms: 0 };
    this.pieces = this.placement.furniture.map((f) => fresh(f));
    this.returning = false;
    this.p3 = { state: 'idle', ms: 0, pauseMs: 0, recoverMs: 0, next: 0, done: 0, offers: 0, cd: { stunPulse: 0, teleportStrike: 0, beamSweep: 0 }, spot: { x: 0, y: 0 }, aimDeg: 0, hit: false };
    this.sits = false;
  }

  /** He is beaten: everything stops and he sits down. */
  end(by: CompletionSource): void {
    void by;
    if (this.sits) return;
    const keepGrav = this.grav.state === 'flipped';
    this.stamp = { state: 'idle', ms: 0, cd: 0, y: 0, hit: false };
    this.grav = { state: 'idle', dir: this.grav.dir, cd: 0, ms: 0 };
    this.p3.state = 'idle';
    this.guardState = 'off';
    this.sits = true;
    if (keepGrav) for (const p of this.pieces) rest(p, p.home);
    this.host.bus.emit(GameEvents.AdministratorChanged, { bossId: this.bossId, phase: 'sits' });
  }

  // -- Reading ---------------------------------------------------------------

  /** The desk shield is up now. */
  get shieldUp(): boolean {
    return this.guardState === 'waiting' || this.guardState === 'pair';
  }

  /** Gravity is flipped toward a wall and Andrew can flip it back. */
  get flipped(): boolean {
    return this.grav.state === 'flipped';
  }

  get currentGravity(): GravityDir | null {
    return this.grav.state === 'flipped' ? this.grav.dir : null;
  }

  get offersMade(): number {
    return this.p3.offers;
  }

  get guardsAlive(): number {
    return this.guards.filter((g) => !g.down).length;
  }

  private attack(boss: BossRunner | null, id: string): AttackDef | undefined {
    return boss?.phase?.attacks.find((a) => a.id === id) ?? boss?.def.phases.flatMap((p) => p.attacks).find((a) => a.id === id);
  }

  private body(boss: BossRunner | null): EnemyActor | undefined {
    return boss?.body(this.tag);
  }

  view(boss: BossRunner | null): AdministratorView {
    const t = TUNING.overhaul?.administrator;
    const arena = this.placement.arena;
    const stampAtk = this.attack(boss, 'stamp');
    let stamp: AdministratorView['stamp'] = null;
    if (this.stamp.state !== 'idle' && stampAtk && t) {
      const f = this.stamp.state === 'wave' ? Math.min(1, this.stamp.ms / t.stampTravelMs) : 0;
      const half = this.placement.arena.width;
      stamp = { y: this.stamp.y, fromX: arena.x, toX: arena.x + arena.width, state: this.stamp.state, frontX: this.placement.desk.x + half * f };
    }
    const pulseAtk = this.attack(boss, 'stunPulse');
    const pulse = (this.p3.state === 'pulseLit' || this.p3.state === 'pulseBurst') && pulseAtk && pulseAtk.shape.kind === 'circle' ? { spot: this.p3.spot, radius: pulseAtk.shape.radius, state: this.p3.state === 'pulseLit' ? ('lit' as const) : ('burst' as const) } : null;
    const beamAtk = this.attack(boss, 'beamSweep');
    const body = this.body(boss);
    let beam: AdministratorView['beam'] = null;
    if ((this.p3.state === 'beamLit' || this.p3.state === 'beam') && beamAtk && beamAtk.shape.kind === 'cone' && body && t) {
      const f = this.p3.state === 'beam' ? Math.min(1, this.p3.ms / t.beamSweepMs) : 0;
      const half = beamAtk.shape.angleDeg / 2;
      beam = { from: { ...body.pos }, aimDeg: this.p3.aimDeg, range: beamAtk.shape.range, angleDeg: beamAtk.shape.angleDeg, state: this.p3.state === 'beam' ? 'sweeping' : 'lit', beamDeg: this.p3.aimDeg - half + 2 * half * f };
    }
    return {
      shield: this.shieldUp,
      stamp,
      gravity: this.grav.state === 'idle' ? null : { dir: this.grav.dir, state: this.grav.state },
      furniture: this.pieces.map((p) => ({ id: p.id, pos: piecePos(p, t?.furnitureSlideMs ?? 1), size: t?.furnitureSizePx ?? 16 })),
      pulse,
      teleport: this.p3.state === 'teleportLit' ? { spot: this.p3.spot, state: 'lit' } : null,
      beam,
      switchesLive: this.flipped,
      jacketOff: this.phaseId === 'personally',
      sits: this.sits,
    };
  }

  // -- Andrew works a switch -------------------------------------------------

  /** E at one of his four switches. Returns whether it was one. Flips gravity back if it is flipped. */
  interact(examinableId: string, boss: BossRunner | null): boolean {
    if (!this.placement.switches.some((s) => s.examinableId === examinableId)) return false;
    this.flipBack(boss);
    return true;
  }

  /** The Glove's pulse (a cone from `from`) reaching a switch works it. */
  glovePulse(from: Vec2, range: number, aimDeg: number, angleDeg: number, boss: BossRunner | null): void {
    for (const s of this.placement.switches) {
      if (distance(from, s.position) > range) continue;
      if (Math.abs(angleDiff(aimDeg, angleTo(from, s.position))) <= angleDeg / 2) {
        this.flipBack(boss);
        return;
      }
    }
  }

  private flipBack(boss: BossRunner | null): void {
    if (this.grav.state !== 'flipped' || !boss) return;
    const t = TUNING.overhaul?.administrator;
    const far = opposite(this.grav.dir);
    for (const p of this.pieces) slideHome(p);
    this.grav = { state: 'idle', dir: far, cd: this.gravityCycleMs(boss), ms: 0 };
    this.host.bus.emit(GameEvents.AdministratorChanged, { bossId: this.bossId, phase: 'gravityBack', dir: far });
    const body = this.body(boss);
    if (!body || body.down) return;
    // Thrown against the far wall, stunned; then he walks back.
    const a = this.placement.arena;
    const p = body.pos;
    const to: Vec2 =
      far === 'left' ? { x: a.x + EDGE, y: p.y } : far === 'right' ? { x: a.x + a.width - EDGE, y: p.y } : far === 'up' ? { x: p.x, y: a.y + EDGE } : { x: p.x, y: a.y + a.height - EDGE };
    boss.pin(this.tag, null);
    body.pos = to;
    boss.daze(this.tag, t?.gravityStunMs ?? 0, 1);
    this.returning = true;
  }

  private gravityCycleMs(boss: BossRunner | null): number {
    const atk = this.attack(boss, 'gravityFlip');
    const mult = boss?.phase?.attackSpeedMultiplier ?? 1;
    return Math.max(0, ((atk?.cooldownMs ?? 0) - (atk?.telegraphMs ?? 0)) / mult);
  }

  // -- Tick ------------------------------------------------------------------

  tick(dtMs: number, boss: BossRunner | null, active: boolean): void {
    const t = TUNING.overhaul?.administrator;
    if (!boss || !active || !t || this.sits) return;
    const body = this.body(boss);
    if (!body || body.down) return;
    const phase = boss.phase?.id ?? '';
    if (phase !== this.phaseId) this.enterPhase(phase, boss, body);
    this.tickPieces(dtMs, t);
    const stunned = body.status === 'stunned';
    const mult = boss.phase?.attackSpeedMultiplier ?? 1;
    const player = this.host.playerPosition();
    const targetable = this.host.playerTargetable();
    if (phase !== 'personally') {
      this.tickHome(dtMs, boss, body, stunned, t);
      this.tickGuards(dtMs, boss, t);
      const stampAtk = this.attack(boss, 'stamp');
      if (stampAtk) this.tickStamp(dtMs, stampAtk, t, mult, body, player, targetable, !stunned);
      const flipAtk = this.attack(boss, 'gravityFlip');
      if (phase === 'restructuring' && flipAtk) this.tickGravity(dtMs, flipAtk, t, mult, player, targetable, boss);
    } else {
      this.tickPersonally(dtMs, boss, body, t, mult, player, targetable, stunned);
    }
  }

  private enterPhase(id: string, boss: BossRunner, body: EnemyActor): void {
    const first = this.phaseId === '';
    this.phaseId = id;
    if (id === 'delegation' || first) {
      boss.pin(this.tag, this.placement.desk);
      body.stationary = true;
      this.guardState = 'waiting';
      this.guardMs = TUNING.overhaul?.administrator?.callDelayMs ?? 0;
      boss.guard(this.tag, 'front');
      const stampAtk = this.attack(boss, 'stamp');
      this.stamp.cd = (stampAtk?.cooldownMs ?? 0) / (boss.phase?.attackSpeedMultiplier ?? 1);
    }
    if (id === 'restructuring') {
      this.grav = { state: 'idle', dir: 'down', cd: this.gravityCycleMs(boss), ms: 0 };
    }
    if (id === 'personally') {
      // Gravity goes back, the desk goes dark for good, the jacket is hung up and he walks.
      for (const p of this.pieces) rest(p, p.home);
      this.grav = { state: 'idle', dir: 'down', cd: 0, ms: 0 };
      this.stamp = { state: 'idle', ms: 0, cd: 0, y: 0, hit: false };
      this.guardState = 'off';
      this.returning = false;
      boss.guard(this.tag, null);
      boss.pin(this.tag, null);
      body.stationary = false;
      boss.setSprite(this.tag, `boss.${this.bossId}.personally`);
      for (const k of P3_ORDER) this.p3.cd[k] = (this.attack(boss, k)?.cooldownMs ?? 0) / 2 / (boss.phase?.attackSpeedMultiplier ?? 1);
      this.host.bus.emit(GameEvents.AdministratorChanged, { bossId: this.bossId, phase: 'jacketOff' });
    }
  }

  /** He stands at his desk, or is walking back to it after being thrown. */
  private tickHome(dtMs: number, boss: BossRunner, body: EnemyActor, stunned: boolean, t: NonNullable<NonNullable<typeof TUNING.overhaul>['administrator']>): void {
    if (!this.returning) {
      body.stationary = true;
      return;
    }
    if (stunned) return;
    const d = distance(body.pos, this.placement.desk);
    const step = (t.returnSpeedPx * dtMs) / 1000;
    if (d <= step) {
      this.returning = false;
      boss.pin(this.tag, this.placement.desk);
      return;
    }
    const dir = scale(sub(this.placement.desk, body.pos), 1 / d);
    body.pos = add(body.pos, scale(dir, step));
    body.facingDeg = angleTo(body.pos, this.placement.desk);
  }

  private tickGuards(dtMs: number, boss: BossRunner, t: NonNullable<NonNullable<typeof TUNING.overhaul>['administrator']>): void {
    switch (this.guardState) {
      case 'off':
        return;
      case 'waiting': {
        this.guardMs -= dtMs;
        if (this.guardMs > 0) return;
        const spots = this.placement.guardEntrances;
        this.guards = [0, 1].flatMap((i) => {
          const at = spots[i % Math.max(1, spots.length)];
          return at ? [boss.spawnAdd('security', at)] : [];
        });
        this.guardState = 'pair';
        this.host.bus.emit(GameEvents.AdministratorChanged, { bossId: this.bossId, phase: 'guardsCalled' });
        return;
      }
      case 'pair':
        if (this.guards.length > 0 && this.guards.every((g) => g.down)) {
          this.guardState = 'down';
          this.guardMs = t.shieldDownMs;
          boss.guard(this.tag, null);
          this.host.bus.emit(GameEvents.AdministratorChanged, { bossId: this.bossId, phase: 'shieldDown' });
        }
        return;
      case 'down':
        this.guardMs -= dtMs;
        if (this.guardMs <= 0) {
          this.guardState = 'waiting';
          this.guardMs = t.callDelayMs;
          this.guards = [];
          boss.guard(this.tag, 'front');
          this.host.bus.emit(GameEvents.AdministratorChanged, { bossId: this.bossId, phase: 'shieldUp' });
        }
        return;
    }
  }

  private tickStamp(
    dtMs: number,
    atk: AttackDef,
    t: NonNullable<NonNullable<typeof TUNING.overhaul>['administrator']>,
    mult: number,
    body: EnemyActor,
    player: Vec2,
    targetable: boolean,
    canStart: boolean,
  ): void {
    const s = this.stamp;
    switch (s.state) {
      case 'idle':
        s.cd -= dtMs;
        if (s.cd <= 0 && targetable && canStart) {
          s.state = 'lit';
          s.ms = atk.telegraphMs / mult;
          s.hit = false;
          s.y = this.stampY(player);
          this.host.bus.emit(GameEvents.AdministratorChanged, { bossId: this.bossId, phase: 'stampLit' });
        }
        break;
      case 'lit':
        s.ms -= dtMs;
        if (s.ms <= 0) {
          s.state = 'wave';
          s.ms = 0;
          this.host.bus.emit(GameEvents.AdministratorChanged, { bossId: this.bossId, phase: 'stamp' });
        }
        break;
      case 'wave': {
        s.ms += dtMs;
        const f = Math.min(1, s.ms / t.stampTravelMs);
        const reach = this.placement.arena.width * f;
        const dx = Math.abs(player.x - this.placement.desk.x);
        if (!s.hit && targetable && Math.abs(player.y - s.y) <= t.stampHalfWidthPx + TUNING.combat.characterHitRadius && dx <= reach) {
          s.hit = this.host.hitPlayer({
            source: { kind: 'boss', bossId: this.bossId, attackId: atk.id },
            amount: atk.damage,
            knockback: { x: Math.sign(player.x - body.pos.x || 1) * atk.knockback, y: 0 },
            stunMs: 0,
            holdMs: 0,
            weight: atk.weight ?? 'heavy',
          });
        }
        if (f >= 1) {
          s.state = 'idle';
          s.cd = Math.max(0, (atk.cooldownMs - atk.telegraphMs) / mult - t.stampTravelMs);
        }
        break;
      }
    }
  }

  /** The pixel y of the row a stamp marks: the nearest `stampRows` row to Andrew, or his own. */
  private stampY(player: Vec2): number {
    const rows = this.placement.stampRows;
    const row = rows && rows.length > 0 ? [...rows].sort((a, b) => Math.abs(a - tileOf(player).row) - Math.abs(b - tileOf(player).row))[0] ?? tileOf(player).row : tileOf(player).row;
    return row * TILE + TILE / 2;
  }

  private tickGravity(dtMs: number, atk: AttackDef, t: NonNullable<NonNullable<typeof TUNING.overhaul>['administrator']>, mult: number, player: Vec2, targetable: boolean, boss: BossRunner): void {
    const g = this.grav;
    const cycle = this.gravityCycleMs(boss);
    switch (g.state) {
      case 'idle':
        g.cd -= dtMs;
        if (g.cd <= 0 && targetable) {
          const others = DIRS.filter((d) => d !== g.dir);
          g.dir = others[Math.floor(this.host.rng.next() * others.length)] ?? 'down';
          g.state = 'lit';
          g.ms = atk.telegraphMs / mult;
          this.host.bus.emit(GameEvents.AdministratorChanged, { bossId: this.bossId, phase: 'gravityLit', dir: g.dir });
        }
        break;
      case 'lit':
        g.ms -= dtMs;
        if (g.ms <= 0) this.flip(atk, t, cycle);
        break;
      case 'flipped': {
        // Left flipped, the next flip comes round on the same beat.
        g.cd -= dtMs;
        if (g.cd <= 0 && targetable) {
          const others = DIRS.filter((d) => d !== g.dir);
          g.dir = others[Math.floor(this.host.rng.next() * others.length)] ?? 'down';
          g.state = 'lit';
          g.ms = atk.telegraphMs / mult;
          this.host.bus.emit(GameEvents.AdministratorChanged, { bossId: this.bossId, phase: 'gravityLit', dir: g.dir });
        }
        break;
      }
    }
    this.hitByFurniture(atk, t, player, targetable);
  }

  private flip(atk: AttackDef, t: NonNullable<NonNullable<typeof TUNING.overhaul>['administrator']>, cycle: number): void {
    void t;
    const g = this.grav;
    const a = this.placement.arena;
    const c0 = Math.floor(a.x / TILE);
    const r0 = Math.floor(a.y / TILE);
    const c1 = Math.floor((a.x + a.width - 1) / TILE);
    const r1 = Math.floor((a.y + a.height - 1) / TILE);
    const wall = (c: number, r: number): boolean => c < c0 || r < r0 || c > c1 || r > r1 || this.host.tileBlocked(c, r);
    const bodies = this.pieces.map((p) => {
      const tile = tileOf(p.to);
      return { id: p.id, col: tile.col, row: tile.row };
    });
    slideBodies(bodies, g.dir, wall);
    for (const b of bodies) {
      const p = this.pieces.find((x) => x.id === b.id);
      if (!p) continue;
      p.from = { ...p.to };
      p.to = { x: b.col * TILE + TILE / 2, y: b.row * TILE + TILE / 2 };
      p.t = 0;
      p.hit = false;
    }
    g.state = 'flipped';
    g.cd = Math.max(0, cycle);
    void atk;
    this.host.bus.emit(GameEvents.AdministratorChanged, { bossId: this.bossId, phase: 'gravityFlip', dir: g.dir });
  }

  private tickPieces(dtMs: number, t: NonNullable<NonNullable<typeof TUNING.overhaul>['administrator']>): void {
    for (const p of this.pieces) if (p.t >= 0) p.t = p.t + dtMs >= t.furnitureSlideMs ? -1 : p.t + dtMs;
  }

  private hitByFurniture(atk: AttackDef, t: NonNullable<NonNullable<typeof TUNING.overhaul>['administrator']>, player: Vec2, targetable: boolean): void {
    if (!targetable) return;
    for (const p of this.pieces) {
      if (p.t < 0 || p.hit) continue;
      const pos = piecePos(p, t.furnitureSlideMs);
      if (distance(pos, player) > t.furnitureSizePx / 2 + TUNING.combat.characterHitRadius) continue;
      const dir = sub(p.to, p.from);
      const len = Math.hypot(dir.x, dir.y) || 1;
      p.hit = this.host.hitPlayer({
        source: { kind: 'boss', bossId: this.bossId, attackId: atk.id },
        amount: atk.damage,
        knockback: scale({ x: dir.x / len, y: dir.y / len }, atk.knockback),
        stunMs: 0,
        holdMs: 0,
        weight: atk.weight ?? 'heavy',
      });
    }
  }

  // -- Phase 3 ---------------------------------------------------------------

  private tickPersonally(dtMs: number, boss: BossRunner, body: EnemyActor, t: NonNullable<NonNullable<typeof TUNING.overhaul>['administrator']>, mult: number, player: Vec2, targetable: boolean, stunned: boolean): void {
    const s = this.p3;
    for (const k of P3_ORDER) s.cd[k] = Math.max(0, s.cd[k] - dtMs);
    const pulse = this.attack(boss, 'stunPulse');
    const tele = this.attack(boss, 'teleportStrike');
    const beam = this.attack(boss, 'beamSweep');
    switch (s.state) {
      case 'idle': {
        if (s.pauseMs > 0) {
          s.pauseMs = Math.max(0, s.pauseMs - dtMs);
          return;
        }
        if (s.recoverMs > 0) {
          s.recoverMs = Math.max(0, s.recoverMs - dtMs);
          return;
        }
        if (stunned || !targetable) return;
        for (let i = 0; i < P3_ORDER.length; i++) {
          const k = P3_ORDER[(s.next + i) % P3_ORDER.length] as P3Attack;
          if (s.cd[k] > 0) continue;
          const atk = k === 'stunPulse' ? pulse : k === 'teleportStrike' ? tele : beam;
          if (!atk) continue;
          s.next = (s.next + i + 1) % P3_ORDER.length;
          this.beginP3(k, atk, mult, body, player);
          break;
        }
        return;
      }
      case 'pulseLit':
        s.ms -= dtMs;
        if (s.ms <= 0 && pulse) {
          s.state = 'pulseBurst';
          s.ms = BURST_SHOWN_MS;
          this.host.bus.emit(GameEvents.AdministratorChanged, { bossId: this.bossId, phase: 'pulse' });
          const radius = pulse.shape.kind === 'circle' ? pulse.shape.radius : 0;
          if (targetable && distance(player, s.spot) <= radius + TUNING.combat.characterHitRadius) {
            this.host.hitPlayer({ source: { kind: 'boss', bossId: this.bossId, attackId: pulse.id }, amount: pulse.damage, knockback: { x: 0, y: 0 }, stunMs: 0, holdMs: pulse.holdMs ?? 0, weight: pulse.weight ?? 'ordinary' });
          }
        }
        return;
      case 'pulseBurst':
        s.ms -= dtMs;
        if (s.ms <= 0 && pulse) this.finishP3('stunPulse', pulse, mult, t);
        return;
      case 'teleportLit':
        s.ms -= dtMs;
        if (s.ms <= 0 && tele) {
          body.pos = { ...s.spot };
          body.facingDeg = angleTo(body.pos, player);
          this.host.bus.emit(GameEvents.AdministratorChanged, { bossId: this.bossId, phase: 'teleport' });
          if (targetable && shapeHits(tele.shape, body.pos, body.facingDeg, player, TUNING.combat.characterHitRadius)) {
            this.host.hitPlayer({ source: { kind: 'boss', bossId: this.bossId, attackId: tele.id }, amount: tele.damage, knockback: scale(fromAngle(body.facingDeg), tele.knockback), stunMs: 0, holdMs: 0, weight: tele.weight ?? 'heavy' });
          }
          this.finishP3('teleportStrike', tele, mult, t);
        }
        return;
      case 'beamLit':
        s.ms -= dtMs;
        if (s.ms <= 0) {
          s.state = 'beam';
          s.ms = 0;
          s.hit = false;
          this.host.bus.emit(GameEvents.AdministratorChanged, { bossId: this.bossId, phase: 'beam' });
        }
        return;
      case 'beam': {
        s.ms += dtMs;
        if (!beam || beam.shape.kind !== 'cone') return;
        const f = Math.min(1, s.ms / t.beamSweepMs);
        const half = beam.shape.angleDeg / 2;
        const beamDeg = s.aimDeg - half + 2 * half * f;
        if (!s.hit && targetable) {
          const rel = sub(player, body.pos);
          const along = rel.x * Math.cos((beamDeg * Math.PI) / 180) + rel.y * Math.sin((beamDeg * Math.PI) / 180);
          const across = Math.abs(-rel.x * Math.sin((beamDeg * Math.PI) / 180) + rel.y * Math.cos((beamDeg * Math.PI) / 180));
          if (along >= 0 && along <= beam.shape.range && across <= t.beamHalfWidthPx + TUNING.combat.characterHitRadius) {
            s.hit = this.host.hitPlayer({ source: { kind: 'boss', bossId: this.bossId, attackId: beam.id }, amount: beam.damage, knockback: scale(fromAngle(beamDeg), beam.knockback), stunMs: 0, holdMs: 0, weight: beam.weight ?? 'worst' });
          }
        }
        if (f >= 1) this.finishP3('beamSweep', beam, mult, t);
        return;
      }
    }
  }

  private beginP3(k: P3Attack, atk: AttackDef, mult: number, body: EnemyActor, player: Vec2): void {
    const s = this.p3;
    s.ms = atk.telegraphMs / mult;
    s.hit = false;
    if (k === 'stunPulse') {
      s.state = 'pulseLit';
      s.spot = { ...player };
      this.host.bus.emit(GameEvents.AdministratorChanged, { bossId: this.bossId, phase: 'pulseLit' });
    } else if (k === 'teleportStrike') {
      s.state = 'teleportLit';
      s.spot = this.behind(player);
      this.host.bus.emit(GameEvents.AdministratorChanged, { bossId: this.bossId, phase: 'teleportLit' });
    } else {
      s.state = 'beamLit';
      s.aimDeg = angleTo(body.pos, player);
      this.host.bus.emit(GameEvents.AdministratorChanged, { bossId: this.bossId, phase: 'beamLit' });
    }
  }

  /** The spot behind Andrew (opposite the way he faces) that is not a wall; the nearest open one if that is. */
  private behind(player: Vec2): Vec2 {
    const t = TUNING.overhaul?.administrator;
    const reach = t?.teleportBehindPx ?? 24;
    const facing = this.host.playerFacingDeg();
    const a = this.placement.arena;
    for (const turn of [0, 45, -45, 90, -90, 135, -135, 180]) {
      const p = add(player, fromAngle(facing + 180 + turn, reach));
      const tile = tileOf(p);
      if (p.x < a.x || p.y < a.y || p.x > a.x + a.width || p.y > a.y + a.height || this.host.tileBlocked(tile.col, tile.row)) continue;
      return p;
    }
    return { ...player };
  }

  private finishP3(k: P3Attack, atk: AttackDef, mult: number, t: NonNullable<NonNullable<typeof TUNING.overhaul>['administrator']>): void {
    const s = this.p3;
    s.state = 'idle';
    s.cd[k] = atk.cooldownMs / mult;
    s.recoverMs = atk.recoveryMs / mult;
    s.done += 1;
    if (s.offers < 3 && s.done % Math.max(1, t.offerEveryAttacks) === 0) {
      s.offers += 1;
      s.pauseMs = t.offerPauseMs;
      this.host.bus.emit(GameEvents.AdministratorChanged, { bossId: this.bossId, phase: 'offer', offer: s.offers as 1 | 2 | 3 });
    }
  }
}

function fresh(f: AdministratorFurniture): Piece {
  return { id: f.id, home: { ...f.position }, from: { ...f.position }, to: { ...f.position }, t: -1, hit: false };
}

/** Sends a piece back to where it started, sliding (no hit). */
function slideHome(p: Piece): void {
  p.from = { ...p.to };
  p.to = { ...p.home };
  p.t = 0;
  p.hit = true;
}

/** Puts a piece at `to` at rest. */
function rest(p: Piece, to: Vec2): void {
  p.from = { ...p.to };
  p.to = { ...to };
  p.t = -1;
  p.hit = true;
}

function piecePos(p: Piece, slideMs: number): Vec2 {
  if (p.t < 0) return p.to;
  const f = Math.min(1, p.t / Math.max(1, slideMs));
  return { x: p.from.x + (p.to.x - p.from.x) * f, y: p.from.y + (p.to.y - p.from.y) * f };
}

function opposite(d: GravityDir): GravityDir {
  return d === 'up' ? 'down' : d === 'down' ? 'up' : d === 'left' ? 'right' : 'left';
}
