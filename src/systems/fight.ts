/**
 * Fights from `FightDef` waves. DESIGN.md 7.2, docs/chapters/README.md.
 * Plain TypeScript; the world spawns and owns the actors.
 */

import { TUNING } from '../content/tuning';
import { GameEvents } from '../core/types';
import type { AlarmFightId, CarriedDrinkId, CompletionSource, EnemyId, FightDef, FightSectionId, GameEventBus, Reward, Vec2 } from '../core/types';
import type { EnemyActor } from './enemies';
import type { Rect } from './geometry';
import { CompletableSection } from './sections';
import type { SectionHost } from './sections';

/** What a fight needs from the world. */
export interface FightWorld {
  readonly bus: GameEventBus;
  spawnEnemy(enemyId: EnemyId, pos: Vec2): EnemyActor;
  /** Puts an actor down and emits `enemy:defeated` once. */
  defeat(actor: EnemyActor, by: CompletionSource): void;
}

/** Enemies of `enemyId` spawn inside `area` and never leave it (`FightPlacement.zones`). */
export interface FightZone {
  readonly enemyId: EnemyId;
  readonly area: Rect;
}

export interface FightHooks {
  /** After wave `index` (0-based) is cleared and before the next spawns. */
  onWaveCleared?(index: number): void;
  onWaveSpawned?(index: number, actors: readonly EnemyActor[]): void;
}

export class FightRunner extends CompletableSection {
  private started = false;
  private wave = -1;
  private betweenMs = 0;
  private readonly actorsList: EnemyActor[] = [];
  /** The enemies each wave spawned (guards adopted from a stealth section are not in any wave). */
  private readonly waveActors: EnemyActor[][] = [];
  private spawnCursor = 0;
  private readonly zoneSpawned = new Map<EnemyId, number>();
  /** Set during a Myko call-in so no new waves arrive. */
  suspended = false;

  constructor(
    readonly def: FightDef,
    private readonly spawnPoints: readonly Vec2[],
    private readonly world: FightWorld,
    host: SectionHost,
    reward?: Reward,
    private readonly hooks: FightHooks = {},
    private readonly zones: readonly FightZone[] = [],
  ) {
    super(def.id as FightSectionId | AlarmFightId, 'fight', host, reward);
  }

  get active(): boolean {
    return this.started && !this.isComplete();
  }

  get waveIndex(): number {
    return this.wave;
  }

  actors(): readonly EnemyActor[] {
    return this.actorsList;
  }

  aliveActors(): EnemyActor[] {
    return this.actorsList.filter((a) => !a.down);
  }

  start(): void {
    if (this.started || this.isComplete()) return;
    this.started = true;
    this.world.bus.emit(GameEvents.SectionStarted, { sectionId: this.sectionId, kind: 'fight' });
    this.spawnWave(0);
  }

  /** Back to the start (the return to the bar resets the encounter under way). A finished fight stays finished. */
  reset(): void {
    if (this.isComplete()) return;
    this.started = false;
    this.wave = -1;
    this.betweenMs = 0;
    this.actorsList.length = 0;
    this.waveActors.length = 0;
    this.spawnCursor = 0;
    this.zoneSpawned.clear();
    this.suspended = false;
  }

  /**
   * Whether this fight decides the enemy's drop. Null: it does not (roll the usual chance). Otherwise the wave
   * has a guaranteed drop: `drink` is the drink if this is the last of the wave to fall, else null (no drop).
   * Call once the enemy is down.
   */
  guaranteedDropFor(actor: EnemyActor): { readonly drink: CarriedDrinkId | null } | null {
    const index = this.waveActors.findIndex((w) => w.includes(actor));
    const drink = this.def.waves[index]?.guaranteedDrop;
    if (index < 0 || !drink) return null;
    const last = (this.waveActors[index] ?? []).every((a) => a.down);
    return { drink: last ? drink : null };
  }

  /** Adds existing actors (stealth guards joining their alarm fight). */
  adopt(actors: readonly EnemyActor[]): void {
    this.actorsList.push(...actors);
  }

  tick(dtMs: number): void {
    if (!this.active || this.suspended) return;
    if (this.aliveActors().length > 0) return;
    if (this.betweenMs > 0) {
      this.betweenMs -= dtMs;
      if (this.betweenMs <= 0) this.spawnWave(this.wave + 1);
      return;
    }
    if (this.wave + 1 < this.def.waves.length) {
      this.hooks.onWaveCleared?.(this.wave);
      this.betweenMs = TUNING.combat.betweenWavesMs;
      return;
    }
    this.hooks.onWaveCleared?.(this.wave);
    this.finish('player');
  }

  protected forceSolvedState(source: CompletionSource): void {
    this.started = true;
    for (const a of this.aliveActors()) this.world.defeat(a, source);
    this.wave = this.def.waves.length - 1;
  }

  private spawnWave(index: number): void {
    const wave = this.def.waves[index];
    this.wave = index;
    if (!wave) return;
    const spawned: EnemyActor[] = [];
    for (const group of wave.enemies) {
      for (let i = 0; i < group.count; i++) {
        const zone = this.zones.find((z) => z.enemyId === group.enemyId);
        if (zone) {
          // Spread along the zone's width at its middle height, so a row of leashed enemies never stacks.
          const n = this.zoneSpawned.get(group.enemyId) ?? 0;
          this.zoneSpawned.set(group.enemyId, n + 1);
          const a = zone.area;
          const slots = Math.max(1, group.count);
          const pos = { x: a.x + (a.width * ((n % slots) + 0.5)) / slots, y: a.y + a.height / 2 };
          const leashed = this.world.spawnEnemy(group.enemyId, pos);
          leashed.leash = a;
          spawned.push(leashed);
          continue;
        }
        const p = this.spawnPoints.length > 0 ? this.spawnPoints[this.spawnCursor++ % this.spawnPoints.length] : undefined;
        const actor = this.world.spawnEnemy(group.enemyId, p ?? { x: 0, y: 0 });
        spawned.push(actor);
      }
    }
    this.actorsList.push(...spawned);
    this.waveActors[index] = spawned;
    this.hooks.onWaveSpawned?.(index, spawned);
  }
}
