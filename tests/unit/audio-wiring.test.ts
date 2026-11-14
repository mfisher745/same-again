/** Audio wiring: which effect each game event plays. The synth and music are stubbed; only the routing is under test. */

import { afterEach, describe, expect, it, vi } from 'vitest';

const played: string[] = [];
const silenced: boolean[] = [];
vi.mock('../../src/audio/synth', async (orig) => ({
  ...(await orig<typeof import('../../src/audio/synth')>()),
  makeNoiseBuffer: () => ({}),
  renderEffect: (id: string) => void played.push(id),
}));
vi.mock('../../src/audio/music', () => ({
  MusicPlayer: class {
    setIntensity(): void {}
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

  it('music is cut on a return at 0 Buzz, comes back after the fade, and is left alone for a fall to the floor', () => {
    vi.useFakeTimers();
    try {
      const bus = wire();
      bus.emit('bar:returned', { reason: 'floor' });
      expect(played).toEqual(['fallOver']);
      expect(silenced).not.toContain(true);
      silenced.length = 0;
      bus.emit('bar:returned', { reason: 'sober' });
      expect(silenced).toEqual([true]);
      const u = TUNING.ui?.soberReturn;
      vi.advanceTimersByTime((u ? u.flattenMs + u.fadeMs + u.blackMs : 0) + 50);
      expect(silenced).toEqual([true, false]);
    } finally {
      vi.useRealTimers();
    }
  });
});
