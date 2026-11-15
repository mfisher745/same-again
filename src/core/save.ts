/**
 * Save storage. DESIGN.md section 7.6.
 *
 * Plain TypeScript: the storage is injected (`localStorage` in the browser,
 * a Map in tests). A save with the wrong version or a broken shape is ignored
 * rather than half-loaded. Audio settings live under their own key and survive
 * New Game.
 */

import { TUNING } from '../content/tuning';
import { SAVE_VERSION_OVERHAUL } from './types';
import type { AudioSettings, OverhaulSaveState } from './types';

/** The subset of `Storage` we use. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SAVE_KEY = 'same-again.save';
export const AUDIO_KEY = 'same-again.audio';

export class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

/** localStorage when available and writable, otherwise memory (private mode, tests). */
export function defaultStorage(): StorageLike {
  try {
    const ls = globalThis.localStorage;
    if (ls) {
      const probe = `${SAVE_KEY}.probe`;
      ls.setItem(probe, '1');
      ls.removeItem(probe);
      return ls;
    }
  } catch {
    // Storage blocked; fall through.
  }
  return new MemoryStorage();
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Light structural check on the kit: enough to refuse garbage, not a full schema. */
function isKit(v: unknown): boolean {
  if (!isObject(v)) return false;
  if (!isObject(v['drinks']) || Object.values(v['drinks']).some((n) => typeof n !== 'number')) return false;
  if (typeof v['carryLimit'] !== 'number' || typeof v['bottles'] !== 'number') return false;
  if (v['hotDrink'] !== null && typeof v['hotDrink'] !== 'string') return false;
  if (!isStringArray(v['weapons']) || !isStringArray(v['moves'])) return false;
  const slots = v['slots'];
  if (!isObject(slots) || typeof slots['melee'] !== 'string') return false;
  if (slots['drink'] !== null && typeof slots['drink'] !== 'string') return false;
  if (slots['spirit'] !== null && typeof slots['spirit'] !== 'string') return false;
  if (v['selectedItem'] !== null && typeof v['selectedItem'] !== 'string') return false;
  const specials = slots['specials'];
  return Array.isArray(specials) && specials.length === 4 && specials.every((x) => x === null || typeof x === 'string');
}

/**
 * Light structural check: enough to refuse garbage, not a full schema. An old
 * (version 1) save fails the version test and is discarded; there is no migration.
 */
export function isSaveState(v: unknown): v is OverhaulSaveState {
  if (!isObject(v)) return false;
  if (v['version'] !== SAVE_VERSION_OVERHAUL) return false;
  const chapter = v['chapter'];
  if (typeof chapter !== 'number' || chapter < 1 || chapter > 10 || !Number.isInteger(chapter)) return false;
  if (!isKit(v['kit'])) return false;
  if (typeof v['mykoCallsLeft'] !== 'number' || typeof v['lootSeed'] !== 'number') return false;
  for (const key of ['mykoCalls', 'finishedChapters', 'completedSectionIds', 'cleanStealthRunIds', 'collectedPickupIds', 'casebook']) {
    if (!Array.isArray(v[key])) return false;
  }
  for (const key of ['openedShortcuts', 'playedDialogue', 'brokenProps']) {
    if (!isStringArray(v[key])) return false;
  }
  if (!isObject(v['hintsGiven']) || !isObject(v['flags'])) return false;
  const settings = v['settings'];
  if (!isObject(settings) || (settings['tabMode'] !== 'toggle' && settings['tabMode'] !== 'hold')) return false;
  return true;
}

const BEERS: readonly string[] = ['stout', 'lager', 'lightBeer', 'craftIpa'];
const SPIRITS: readonly string[] = ['whiskey', 'tequila'];

/**
 * Bring a save written before the use model (no `slots.spirit`, no `selectedItem`, any drink in `slots.drink`)
 * up to date: a spirit in the old drink slot moves to the spirit slot, a hot drink there is dropped, and the
 * selection starts empty. The save version does not change; saves with the new shape pass through untouched.
 */
export function migrateSave(v: unknown): unknown {
  if (!isObject(v) || !isObject(v['kit'])) return v;
  const kit = v['kit'];
  const slots = kit['slots'];
  if (!isObject(slots)) return v;
  const old = slots['drink'];
  const drinks = isObject(kit['drinks']) ? kit['drinks'] : {};
  const held = (id: string): boolean => typeof drinks[id] === 'number' && (drinks[id] as number) > 0;
  const beer = typeof old === 'string' && BEERS.includes(old) ? old : (BEERS.find(held) ?? null);
  const spirit =
    typeof slots['spirit'] === 'string' ? slots['spirit'] : typeof old === 'string' && SPIRITS.includes(old) ? old : (SPIRITS.find(held) ?? null);
  const sel = kit['selectedItem'];
  // Q's selection is a held beer or the held hot drink; anything else (or nothing) falls back to the beer slot.
  const hot = typeof kit['hotDrink'] === 'string' ? kit['hotDrink'] : null;
  const selected = typeof sel === 'string' && ((BEERS.includes(sel) && held(sel)) || sel === hot) ? sel : (beer ?? hot);
  return { ...v, kit: { ...kit, slots: { ...slots, drink: beer, spirit }, selectedItem: selected } };
}

function clamp01(n: unknown, fallback: number): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}

export class SaveStore {
  constructor(private readonly storage: StorageLike = defaultStorage()) {}

  load(): OverhaulSaveState | null {
    const raw = this.storage.getItem(SAVE_KEY);
    if (raw === null) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      const migrated = migrateSave(parsed);
      return isSaveState(migrated) ? migrated : null;
    } catch {
      return null;
    }
  }

  write(state: OverhaulSaveState): void {
    this.storage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  clear(): void {
    this.storage.removeItem(SAVE_KEY);
  }

  loadAudio(): AudioSettings {
    const defaults = TUNING.audioDefaults;
    const raw = this.storage.getItem(AUDIO_KEY);
    if (raw === null) return defaults;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isObject(parsed)) return defaults;
      return {
        musicVolume: clamp01(parsed['musicVolume'], defaults.musicVolume),
        effectsVolume: clamp01(parsed['effectsVolume'], defaults.effectsVolume),
      };
    } catch {
      return defaults;
    }
  }

  writeAudio(settings: AudioSettings): void {
    this.storage.setItem(
      AUDIO_KEY,
      JSON.stringify({ musicVolume: clamp01(settings.musicVolume, 1), effectsVolume: clamp01(settings.effectsVolume, 1) }),
    );
  }
}
