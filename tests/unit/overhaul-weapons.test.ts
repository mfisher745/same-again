/** DESIGN.md 7.2 "Melee": seven weapons, quirks, level multiplier. */

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/content/tuning';
import type { WeaponId } from '../../src/core/types';
import { createWeaponState, meleeMultiplier, swing, switchWeapon, tickWeapon, weaponDamage, weaponDef } from '../../src/systems/weapons';

const O = TUNING.overhaul!;
const IDS = Object.keys(O.weapons) as WeaponId[];

describe('weapons: lookup and multiplier', () => {
  it('has all seven weapons', () => {
    expect(IDS.sort()).toEqual(['clipboard', 'fists', 'hurley', 'inflatableAlien', 'securityWand', 'shillelagh', 'umbrella']);
  });

  it('multiplies damage by level: x1, x1.5, x2, x3', () => {
    const base = weaponDef('hurley').damage;
    expect(weaponDamage('hurley', 1)).toBe(base);
    expect(weaponDamage('hurley', 2)).toBeCloseTo(base * 1.5);
    expect(weaponDamage('hurley', 3)).toBeCloseTo(base * 2);
    expect(weaponDamage('hurley', 4)).toBeCloseTo(base * 3);
    expect(meleeMultiplier(0)).toBe(1);
  });

  it('matches the relative shape in the plan', () => {
    const f = weaponDef('fists');
    expect(weaponDef('hurley').reach).toBeGreaterThan(f.reach);
    expect(weaponDef('hurley').swingMs).toBeGreaterThan(f.swingMs);
    expect(weaponDef('clipboard').swingMs).toBeLessThan(f.swingMs);
    expect(weaponDef('clipboard').damage).toBeLessThan(f.damage);
    expect(weaponDef('umbrella').reach).toBe(Math.max(...IDS.map((i) => weaponDef(i).reach)));
    expect(weaponDef('shillelagh').knockback).toBeGreaterThan(weaponDef('hurley').knockback);
    expect(weaponDef('inflatableAlien').damage).toBeLessThan(f.damage);
  });
});

describe('weapons: swing results', () => {
  it('reports reach, time, level-scaled damage', () => {
    const r = swing(createWeaponState('hurley'), 3).result;
    expect(r.reach).toBe(O.weapons.hurley.reach);
    expect(r.swingMs).toBe(O.weapons.hurley.swingMs);
    expect(r.damage).toBeCloseTo(O.weapons.hurley.damage * 2);
    expect(r.interrupts).toBe(false);
    expect(r.pierceCount).toBe(1);
    expect(r.sweepArcDeg).toBe(0);
  });

  it('fists: third hit is a haymaker with big knockback, then the combo restarts', () => {
    let s = createWeaponState('fists');
    const out = [];
    for (let i = 0; i < 4; i++) {
      const r = swing(s, 1);
      s = r.state;
      out.push(r.result);
    }
    expect(out.map((r) => r.haymaker)).toEqual([false, false, true, false]);
    expect(out.map((r) => r.comboIndex)).toEqual([1, 2, 3, 1]);
    expect(out[2]!.knockback).toBe(O.weapons.fists.knockback * 6);
    expect(out[1]!.knockback).toBe(O.weapons.fists.knockback);
  });

  it('a pause longer than the window resets the combo', () => {
    let s = swing(swing(createWeaponState('fists'), 1).state, 1).state;
    expect(s.swings).toBe(2);
    s = tickWeapon(s, O.weaponComboWindowMs! - 1);
    expect(s.swings).toBe(2);
    s = tickWeapon(s, 2);
    expect(s.swings).toBe(0);
    expect(swing(s, 1).result.comboIndex).toBe(1);
  });

  it('clipboard interrupts on every hit', () => {
    let s = createWeaponState('clipboard');
    for (let i = 0; i < 3; i++) {
      const r = swing(s, 1);
      s = r.state;
      expect(r.result.interrupts).toBe(true);
    }
  });

  it('umbrella pierces two, alien sweeps its arc', () => {
    expect(swing(createWeaponState('umbrella'), 1).result.pierceCount).toBe(2);
    expect(swing(createWeaponState('inflatableAlien'), 1).result.sweepArcDeg).toBe(160);
  });

  it('security wand stuns on every third hit only', () => {
    let s = createWeaponState('securityWand');
    const stuns: number[] = [];
    for (let i = 0; i < 6; i++) {
      const r = swing(s, 2);
      s = r.state;
      stuns.push(r.result.stunMs);
    }
    expect(stuns).toEqual([0, 0, 1500, 0, 0, 1500]);
  });

  it('switching weapon resets the count; same weapon does not', () => {
    const s = swing(createWeaponState('fists'), 1).state;
    expect(switchWeapon(s, 'fists')).toBe(s);
    expect(switchWeapon(s, 'hurley')).toEqual({ weapon: 'hurley', swings: 0, sinceLastMs: 0 });
  });

  it('non-combo weapons never accumulate a count', () => {
    expect(swing(swing(createWeaponState('hurley'), 1).state, 1).state.swings).toBe(0);
  });
});
