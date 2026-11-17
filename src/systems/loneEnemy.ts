/**
 * Standalone enemies a chapter script spawns on its own (`ChapterContext.spawnLoneEnemy`): not part of any fight wave,
 * stealth section or boss, so they never touch an alarm, a clean run or a wave count. Run-time only: never saved, and
 * dropped with the world on a screen change or a return to the bar. Plain TypeScript.
 */

import type { EnemyActor } from './enemies';

/** What a script holds on to after spawning a lone enemy. */
export interface LoneEnemyHandle {
  /** The actor's `instanceId`, as carried by the `enemy:defeated` event. */
  readonly instanceId: string;
  /** The enemy has been defeated. */
  defeated(): boolean;
  /** Still in the world: not defeated, and neither a screen change nor a bar return has removed it. */
  alive(): boolean;
}

export interface LoneEnemyOptions {
  /** Called once when it is defeated (by Andrew or a script). Never called if the world is cleared first. */
  readonly onDefeated?: () => void;
}

interface Entry {
  readonly onDefeated: (() => void) | undefined;
  defeated: boolean;
  gone: boolean;
}

export class LoneEnemies {
  private readonly entries = new Map<string, Entry>();

  add(actor: EnemyActor, opts?: LoneEnemyOptions): LoneEnemyHandle {
    const entry: Entry = { onDefeated: opts?.onDefeated, defeated: false, gone: false };
    this.entries.set(actor.instanceId, entry);
    return {
      instanceId: actor.instanceId,
      defeated: () => entry.defeated,
      alive: () => !entry.defeated && !entry.gone,
    };
  }

  /** The actor `instanceId` fell. */
  defeated(instanceId: string): void {
    const e = this.entries.get(instanceId);
    if (!e || e.defeated || e.gone) return;
    e.defeated = true;
    e.onDefeated?.();
  }

  /** The world was cleared (screen change, bar return): every lone enemy is gone and calls nothing. */
  clear(): void {
    for (const e of this.entries.values()) e.gone = true;
    this.entries.clear();
  }
}
