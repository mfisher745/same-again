/** DESIGN.md 7.3: a footstep is heard by its own noise radius alone; every other noise also needs the guard's hearing. */

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/content/tuning';
import { EventBus } from '../../src/core/events';
import type { NoiseEvent, Vec2 } from '../../src/core/types';
import { Guard, canHear } from '../../src/systems/stealth';
import { footstepNoiseRadius } from '../../src/systems/rewards';

const O = TUNING.overhaul!;
const HEARING = TUNING.enemies.suit.senses!.hearingRadius;
const at = (x: number): Vec2 => ({ x, y: 0 });
const still = { mode: 'stationary' as const, waypoints: [{ position: at(0), waitMs: 0, facing: 'right' as const }] };

function guard(hearingRadius: number): Guard {
  const senses = { ...TUNING.enemies.suit.senses!, hearingRadius };
  return new Guard('suit', { enemyId: 'suit', route: still }, senses, TUNING.enemies.suit.moveSpeed);
}

describe('footsteps are heard by noise radius alone', () => {
  it('the suit hears out to 72, and the Bit much and Fecked footsteps carry past it', () => {
    expect(HEARING).toBe(72);
    expect(O.footstepNoiseRadiusByLevel![3]).toBe(98);
    expect(O.footstepNoiseRadiusByLevel![4]).toBe(112);
    expect(footstepNoiseRadius(3, false)).toBe(98);
    expect(footstepNoiseRadius(4, false)).toBe(112);
  });

  it.each([
    [98, 'a Bit much footstep'],
    [112, 'a Fecked footstep'],
  ])('%i px: %s is heard at its full radius although the guard hears only 72', (radius) => {
    const noise: NoiseEvent = { kind: 'footstep', position: at(radius - 1), radius };
    expect(canHear(at(0), HEARING, noise)).toBe(true);
    const g = guard(HEARING);
    g.hear(noise, new EventBus());
    expect(g.alert).toBe('investigating');
    expect(g.investigateTarget).toEqual(noise.position);
  });

  it('a footstep is not heard beyond its own radius', () => {
    expect(canHear(at(0), HEARING, { kind: 'footstep', position: at(99), radius: 98 })).toBe(false);
    expect(canHear(at(0), HEARING, { kind: 'footstep', position: at(113), radius: 112 })).toBe(false);
  });

  it('a sneaking footstep follows the same rule', () => {
    const noise: NoiseEvent = { kind: 'sneakFootstep', position: at(27), radius: O.sneakNoiseRadiusByLevel![4]! };
    expect(canHear(at(0), HEARING, noise)).toBe(true);
    expect(canHear(at(0), HEARING, { ...noise, position: at(29) })).toBe(false);
  });

  it.each([98, 112])('a bottle at %i px with the same radius is not heard: the guard must also be within 72', (d) => {
    const bottle: NoiseEvent = { kind: 'bottle', position: at(d - 1), radius: d };
    expect(canHear(at(0), HEARING, bottle)).toBe(false);
    const g = guard(HEARING);
    g.hear(bottle, new EventBus());
    expect(g.alert).not.toBe('investigating');
  });

  it('a bottle within 72 and within its radius is heard', () => {
    const g = guard(HEARING);
    g.hear({ kind: 'bottle', position: at(60), radius: 90 }, new EventBus());
    expect(g.alert).toBe('investigating');
  });

  it('a guard with hearing radius 0 is deaf, footsteps included', () => {
    const g = guard(0);
    for (const kind of ['footstep', 'sneakFootstep', 'bottle', 'breakable'] as const) {
      expect(canHear(at(0), 0, { kind, position: at(1), radius: 112 })).toBe(false);
      g.hear({ kind, position: at(1), radius: 112 }, new EventBus());
      expect(g.alert).not.toBe('investigating');
    }
  });
});
