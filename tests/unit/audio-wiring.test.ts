/** Audio wiring: which effect each game event plays. The synth and music are stubbed; only the routing is under test. */

import { afterEach, describe, expect, it, vi } from 'vitest';

const played: string[] = [];
const silenced: boolean[] = [];
const intensities: number[] = [];
vi.mock('../../src/audio/synth', async (orig) => ({
  ...(await orig<typeof import('../../src/audio/synth')>()),
  makeNoiseBuffer: () => ({}),
  renderEffect: (id: string) => void played.push(id),
}));
vi.mock('../../src/audio/music', () => ({
  MusicPlayer: class {
    setIntensity(level: number): void {
      intensities.push(level);
    }
    setSilent(on: boolean): void {
      silenced.push(on);
    }
    setRegion(): void {}
    resumed(): void {}
    stop(): void {}
    dispose(): void {}
  },
}));

import { createAudio } from '../../src/audio';
import type { Audio } from '../../src/audio';
import { TUNING } from '../../src/content/tuning';
import { EventBus } from '../../src/core/events';
import type { HitInfo } from '../../src/core/types';

const param = () => ({ setTargetAtTime: () => undefined, value: 0 });
const node = () => ({ connect: () => undefined, gain: param() });
const fakeCtx = { state: 'running', currentTime: 0, destination: {}, createGain: node, addEventListener: undefined } as unknown as BaseAudioContext;

let audio: Audio | null = null;
function wire(): EventBus {
  const bus = new EventBus();
  audio = createAudio(bus, () => ({ musicVolume: 1, effectsVolume: 1 }), fakeCtx);
  played.length = 0;
  silenced.length = 0;
  intensities.length = 0;
  return bus;
}
afterEach(() => {
  audio?.dispose();
  audio = null;
});

const hit = (abilityId: 'punchCombo' | 'hurley', knockback = 0): HitInfo =>
  ({ source: { kind: 'player', abilityId }, targetInstanceId: 'e', amount: 1, knockback: { x: knockback, y: 0 }, stunMs: 0, holdMs: 0 }) as unknown as HitInfo;

describe('audio wiring', () => {
  it('AbilityUsed punchCombo plays swing', () => {
    const bus = wire();
    bus.emit('ability:used', { abilityId: 'punchCombo' } as never);
    expect(played).toContain('swing');
  });

  it('EnemyDamaged by a plain punch plays hit; the haymaker plays haymaker', () => {
    const bus = wire();
    bus.emit('enemy:damaged', { hit: hit('punchCombo') } as never);
    expect(played).toEqual(['hit']);
    played.length = 0;
    const last = TUNING.abilities.punchCombo.combo?.at(-1)?.knockback ?? 0;
    bus.emit('enemy:damaged', { hit: hit('punchCombo', last) } as never);
    expect(played).toEqual(['haymaker']);
  });

  it('a move going off, a spirit starting and wearing off, each have a sound', () => {
    const bus = wire();
    bus.emit('move:used', { moveId: 'shoulder', slot: 1 });
    bus.emit('spirit:started', { drinkId: 'whiskey', durationMs: 1000 });
    bus.emit('spirit:ended', { drinkId: 'whiskey' });
    expect(played).toEqual(['moveUsed', 'spiritStart', 'spiritEnd']);
  });

  it('a weapon swap sounds, the first kit announcement and other changes do not', () => {
    const bus = wire();
    const kit = (melee: 'fists' | 'hurley', bottles: number) =>
      ({ drinks: {}, carryLimit: 6, hotDrink: null, bottles, weapons: ['fists', 'hurley'], moves: [], slots: { drink: null, specials: [null, null, null, null], melee } }) as never;
    bus.emit('kit:changed', { kit: kit('fists', 0) });
    bus.emit('kit:changed', { kit: kit('fists', 3) });
    expect(played).toEqual([]);
    bus.emit('kit:changed', { kit: kit('hurley', 3) });
    expect(played).toEqual(['weaponSwap']);
  });

  it('a hot drink has its own sound; other drinks keep the drink sound', () => {
    const bus = wire();
    bus.emit('drink:consumed', { drinkId: 'tea' });
    bus.emit('drink:consumed', { drinkId: 'stout' });
    expect(played).toEqual(['hotDrink', 'drink']);
  });
});

describe('audio wiring: the two-phase return', () => {
  const at = { x: 0, y: 0 };
  const blackMs = TUNING.ui!.soberReturn.blackMs;
  const alarmCycleMs = 600;
  /** An alarm ringing, a boss on and a Myko call-in in progress. */
  function busy(bus: EventBus): void {
    bus.emit('stealth:alarm', { sectionId: 'c2.stealth.bog', fightId: 'c1.fight.chipper' } as never);
    bus.emit('section:started', { sectionId: 'c1.boss.bigtom', kind: 'boss' } as never);
    bus.emit('myko:callStarted', { sectionId: 'c1.puzzle.kegs', kind: 'puzzle', callsLeft: 2 } as never);
    played.length = 0;
    silenced.length = 0;
    intensities.length = 0;
  }

  it('bar:returning (floor) stops the alarm, ends the call and the boss, and plays fallOver once; bar:returned does none of it again', () => {
    vi.useFakeTimers();
    try {
      const bus = wire();
      busy(bus);
      bus.emit('bar:returning', { reason: 'floor', andrew: at });
      expect(played).toEqual(['fallOver']);
      expect(intensities).toEqual([0]);
      expect(silenced).toEqual([false]);
      // The alarm is stopped: no more of it however long the scene runs.
      vi.advanceTimersByTime(alarmCycleMs * 10);
      expect(played).toEqual(['fallOver']);
      bus.emit('bar:returned', { reason: 'floor' });
      vi.advanceTimersByTime(5000);
      expect(played).toEqual(['fallOver']);
      expect(intensities).toEqual([0]);
      expect(silenced).toEqual([false]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('control: without a return the alarm keeps ringing', () => {
    vi.useFakeTimers();
    try {
      const bus = wire();
      busy(bus);
      vi.advanceTimersByTime(alarmCycleMs * 3 + 50);
      expect(played.filter((e) => e === 'alarm').length).toBeGreaterThanOrEqual(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('bar:returning (sober) cuts the music at once, stops the alarm and the boss, and plays no fall sound', () => {
    vi.useFakeTimers();
    try {
      const bus = wire();
      busy(bus);
      bus.emit('bar:returning', { reason: 'sober', andrew: at });
      expect(played).toEqual([]);
      expect(intensities).toEqual([0]);
      // The call ends silent (it does not un-silence the music), then the sober cut.
      expect(silenced).toEqual([true]);
      vi.advanceTimersByTime(alarmCycleMs * 10);
      expect(played).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a sober return: music stays cut until bar:returned plus blackMs, however long the first phase runs', () => {
    vi.useFakeTimers();
    try {
      const bus = wire();
      bus.emit('bar:returning', { reason: 'sober', andrew: at });
      expect(silenced).toEqual([true]);
      // The old behaviour restored after flatten + fade + black from the start; now it waits for bar:returned.
      vi.advanceTimersByTime(60_000);
      expect(silenced).toEqual([true]);
      bus.emit('bar:returned', { reason: 'sober' });
      vi.advanceTimersByTime(blackMs - 50);
      expect(silenced).toEqual([true]);
      vi.advanceTimersByTime(100);
      expect(silenced).toEqual([true, false]);
      vi.advanceTimersByTime(60_000);
      expect(silenced).toEqual([true, false]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a sober bar:returned on its own (the failsafe got there first) cuts the music and restores it after blackMs', () => {
    vi.useFakeTimers();
    try {
      const bus = wire();
      bus.emit('bar:returned', { reason: 'sober' });
      expect(silenced).toEqual([true]);
      vi.advanceTimersByTime(blackMs - 50);
      expect(silenced).toEqual([true]);
      vi.advanceTimersByTime(100);
      expect(silenced).toEqual([true, false]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a floor bar:returned on its own touches no music and plays nothing', () => {
    vi.useFakeTimers();
    try {
      const bus = wire();
      bus.emit('bar:returned', { reason: 'floor' });
      vi.advanceTimersByTime(10_000);
      expect(played).toEqual([]);
      expect(silenced).toEqual([]);
      expect(intensities).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a new chapter start during the wait restores the music at once', () => {
    vi.useFakeTimers();
    try {
      const bus = wire();
      bus.emit('bar:returning', { reason: 'sober', andrew: at });
      bus.emit('chapter:started', { chapter: 2 } as never);
      expect(silenced[silenced.length - 1]).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
