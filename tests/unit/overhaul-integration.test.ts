/**
 * The overhaul through a real ChapterRun (headless, on the dev sandbox): the
 * return to the bar, hits, the kit, the four slots, weapons and the throw.
 * Pure-module rules live in the other overhaul-* files; these check the wiring.
 * Expected meter values come from tuning and `restValue()`, never literals.
 */

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/content/tuning';
import type { HitInfo, Kit, OverhaulSaveState } from '../../src/core/types';
import type { ChapterModule } from '../../src/core/chapter';
import { createSandboxModule } from '../../src/core/sandbox';
import { createKit } from '../../src/systems/kit';
import { createMeter, drink, restValue } from '../../src/systems/meter';
import { advance, frame, makeRun, record, teleport } from './helpers';

const O = TUNING.overhaul!;
const withKit = (patch: Partial<Kit>) => (s: OverhaulSaveState): OverhaulSaveState => ({ ...s, kit: { ...s.kit, ...patch } });
const hazard = (weight: HitInfo['weight'] = 'ordinary'): Omit<HitInfo, 'targetInstanceId'> => ({
  source: { kind: 'hazard', hazardId: 'x' },
  amount: 0,
  knockback: { x: 0, y: 0 },
  stunMs: 0,
  holdMs: 0,
  weight,
});
/** Chapter 1 meter values: Buzzed 1-34, Grand 35-65, Bit much 66-90, Fecked 91-99, floor 100. */
const AT = { buzzed: 20, grand: 50, bitMuch: 75, fecked: 95 } as const;

describe('return to the bar through the run', () => {
  it('at 0: fires bar:returned with reason sober, meter at rest, Andrew in the bar', () => {
    const { run, bus, returns } = makeRun();
    const events = record(bus, 'bar:returned');
    run.setPlayerPosition({ x: 300, y: 100 });
    run.player.meter = createMeter(1, 0.01);
    advance(run, 200);
    expect(events).toEqual([{ reason: 'sober' }]);
    expect(returns).toEqual(['sober']);
    expect(run.lastBarReturn?.reason).toBe('sober');
    expect(run.player.meter.value).toBeCloseTo(restValue(1), 0);
    expect(run.player.meter.returnReason).toBeNull();
    expect(run.player.pos).toEqual(run.screenLayout.playerStart);
  });

  it('at the floor: a hit that takes him to the top fires reason floor', () => {
    const { run, returns } = makeRun();
    run.player.meter = createMeter(1, AT.fecked);
    run.hitPlayer(hazard('worst'));
    run.tick(16, frame());
    expect(returns).toEqual(['floor']);
    expect(run.player.meter.value).toBeCloseTo(restValue(1), 0);
  });

  it('a beer that takes him over the top also returns him', () => {
    const { run, returns } = makeRun({ save: withKit({ drinks: { craftIpa: 1 }, slots: { ...createKit().slots, drink: 'craftIpa' } }) });
    run.player.meter = createMeter(1, 90);
    run.tick(16, frame({ pressed: ['drink'] }));
    run.tick(16, frame());
    expect(returns).toEqual(['floor']);
  });

  it('keeps finished sections and resets the one under way', () => {
    const { run, returns } = makeRun();
    run.completeSection('c1.puzzle.kegs');
    teleport(run, 22, 13);
    expect(run.fight('c1.fight.chipper')?.active).toBe(true);
    expect(run.enemies().length).toBeGreaterThan(0);
    run.player.meter = createMeter(1, 0.01);
    advance(run, 200);
    expect(returns).toEqual(['sober']);
    expect(run.fight('c1.fight.chipper')?.active).toBe(false);
    expect(run.enemies()).toHaveLength(0);
    const done = run.snapshot().completedSectionIds;
    expect(done).toContain('c1.puzzle.kegs');
    expect(done).not.toContain('c1.fight.chipper');
  });

  it('the section that was under way can be started again after the return', () => {
    const { run } = makeRun();
    teleport(run, 22, 13);
    run.player.meter = createMeter(1, 0.01);
    advance(run, 200);
    teleport(run, 22, 13);
    expect(run.fight('c1.fight.chipper')?.active).toBe(true);
  });

  it('tops bottles up to the minimum, and never takes any away', () => {
    const min = O.carry.minBottlesOnLeavingBar;
    const low = makeRun({ save: withKit({ bottles: 0 }) });
    low.run.player.meter = createMeter(1, 0.01);
    advance(low.run, 200);
    expect(low.run.player.kit.bottles).toBe(min);
    const rich = makeRun({ save: withKit({ bottles: min + 3 }) });
    rich.run.player.meter = createMeter(1, 0.01);
    advance(rich.run, 200);
    expect(rich.run.player.kit.bottles).toBe(min + 3);
  });

  it('offers the free hot drink again, once per visit', () => {
    const { run } = makeRun();
    expect(run.hotDrinkOffered()).toBe(true);
    expect(run.takeHotDrink('coffee')).toBe(true);
    expect(run.hotDrinkOffered()).toBe(false);
    expect(run.takeHotDrink('tea')).toBe(false); // one at a time
    expect(run.drinkFromInventory('coffee')).toBe(true);
    expect(run.hotDrinkOffered()).toBe(false); // this visit's offer is spent
    run.player.meter = createMeter(1, 0.01);
    advance(run, 200);
    expect(run.hotDrinkOffered()).toBe(true);
    expect(run.takeHotDrink('tea')).toBe(true);
  });

  it('a hot drink still held is not offered a second one', () => {
    const { run } = makeRun();
    run.takeHotDrink('coffee');
    run.player.meter = createMeter(1, 0.01);
    advance(run, 200);
    expect(run.hotDrinkOffered()).toBe(false);
    expect(run.player.kit.hotDrink).toBe('coffee');
  });

  it('script flags revert to the last save', () => {
    const { run } = makeRun();
    run.setFlag('sandbox.test', true);
    expect(run.flag('sandbox.test')).toBe(true);
    run.player.meter = createMeter(1, 0.01);
    advance(run, 200);
    expect(run.flag('sandbox.test')).toBeUndefined();
  });

  it('two returns in a row each fire an event and count up', () => {
    const { run, returns } = makeRun();
    for (let i = 0; i < 2; i++) {
      run.player.meter = createMeter(1, 0.01);
      advance(run, 200);
    }
    expect(returns).toEqual(['sober', 'sober']);
    expect(run.lastBarReturn?.count).toBe(2);
  });

  it('a return never emits the retired death, checkpoint, hangover or heat events', () => {
    // The names still sit in the contract until phase 5 removes them; the run must not fire them.
    const { run, bus } = makeRun();
    const seen: string[] = [];
    const on = bus.on.bind(bus) as unknown as (n: string, f: () => void) => void;
    for (const name of ['player:died', 'checkpoint:reached', 'hangover:changed', 'heat:changed', 'buzz:banjaxedPhase']) on(name, () => void seen.push(name));
    teleport(run, 22, 13);
    run.player.meter = createMeter(1, 0.01);
    advance(run, 200);
    run.player.meter = createMeter(1, AT.fecked);
    run.hitPlayer(hazard('worst'));
    advance(run, 200);
    expect(seen).toEqual([]);
  });
});

describe('hits through the real player', () => {
  const hitAt = (value: number) => {
    const h = makeRun();
    h.run.player.meter = createMeter(1, value);
    const hits = record(h.bus, 'player:hit');
    const before = h.run.player.meter.value;
    h.run.hitPlayer(hazard('ordinary'));
    return { hits, before, after: h.run.player.meter.value };
  };

  it.each([['buzzed', AT.buzzed], ['grand', AT.grand]])('lowers the meter at %s', (_n, v) => {
    const r = hitAt(v);
    expect(r.hits[0]?.direction).toBe('down');
    expect(r.after).toBeCloseTo(r.before - O.hitWeights.ordinary, 5);
  });

  it.each([['bit much', AT.bitMuch], ['fecked', AT.fecked]])('raises the meter at %s', (_n, v) => {
    const r = hitAt(v);
    expect(r.hits[0]?.direction).toBe('up');
    expect(r.after).toBeCloseTo(r.before + O.hitWeights.ordinary, 5);
  });

  it('weights move it by 5, 10 and 15 from tuning', () => {
    for (const w of ['ordinary', 'heavy', 'worst'] as const) {
      const h = makeRun();
      h.run.player.meter = createMeter(1, AT.grand);
      h.run.hitPlayer(hazard(w));
      expect(h.run.player.meter.value).toBeCloseTo(AT.grand - O.hitWeights[w], 5);
    }
  });

  it('in a spirit window a hit lowers the meter at double, even at Fecked', () => {
    const h = makeRun();
    h.run.player.meter = createMeter(1, AT.grand);
    h.run.player.drinkDrink('whiskey');
    expect(h.run.player.meter.spirit).not.toBeNull();
    const hits = record(h.bus, 'player:hit');
    const before = h.run.player.meter.value;
    h.run.hitPlayer(hazard('heavy'));
    expect(hits[0]?.direction).toBe('down');
    expect(h.run.player.meter.value).toBeCloseTo(before - O.hitWeights.heavy * 2, 5);
  });

  it('a second hit inside the flinch invulnerability does nothing', () => {
    const h = makeRun();
    h.run.player.meter = createMeter(1, AT.grand);
    expect(h.run.hitPlayer(hazard())).toBe(true);
    const v = h.run.player.meter.value;
    expect(h.run.hitPlayer(hazard())).toBe(false);
    expect(h.run.player.meter.value).toBe(v);
  });
});

describe('the kit through the run', () => {
  it('a pickup is refused when the kit is full and stays on the ground', () => {
    const { run, bus } = makeRun({ save: withKit({ drinks: { stout: 6 } }) });
    const refused = record(bus, 'pickup:refused');
    teleport(run, 3, 2);
    expect(refused).toEqual([expect.objectContaining({ pickupId: 'sandbox.stout', reason: 'kitFull' })]);
    expect(run.pickups().some((p) => p.def.id === 'sandbox.stout')).toBe(true);
    expect(run.player.kit.drinks.stout).toBe(6);
  });

  it('a pickup that half fits takes what fits and leaves the rest', () => {
    const { run } = makeRun({ save: withKit({ drinks: { lager: 5 } }) });
    teleport(run, 3, 2);
    expect(run.player.kit.drinks.stout).toBe(1);
    expect(run.pickups().find((p) => p.def.id === 'sandbox.stout')?.item).toEqual({ kind: 'drink', drinkId: 'stout', count: 1 });
  });

  it('a refused pickup is offered again after he walks away and back', () => {
    const { run } = makeRun({ save: withKit({ drinks: { stout: 6 } }) });
    teleport(run, 3, 2);
    run.player.setKit({ ...run.player.kit, drinks: { stout: 4 } });
    teleport(run, 3, 2);
    expect(run.player.kit.drinks.stout).toBe(4);
    teleport(run, 20, 8);
    teleport(run, 3, 2);
    expect(run.player.kit.drinks.stout).toBe(6);
  });

  it('empties are bottles and food is not a thing', () => {
    const { run } = makeRun({ save: withKit({ bottles: 0 }) });
    teleport(run, 9, 2);
    expect(run.player.kit.bottles).toBe(4);
    teleport(run, 7, 2);
    expect(run.pickups().some((p) => p.def.id === 'sandbox.crisps')).toBe(false);
  });

  it('a placed pickup is collected for good', () => {
    const { run, bus } = makeRun();
    const got = record(bus, 'pickup:collected');
    teleport(run, 3, 2);
    expect(got.map((g) => g.pickupId)).toEqual(['sandbox.stout']);
    expect(run.snapshot().collectedPickupIds).toContain('sandbox.stout');
    expect(run.player.kit.drinks.stout).toBe(2);
  });

  it('Q drinks the selected drink: meter moves, one drink fewer, a bottle left', () => {
    const { run, bus } = makeRun({ save: withKit({ drinks: { stout: 2 }, slots: { ...createKit().slots, drink: 'stout' }, bottles: 0 }) });
    const drunk = record(bus, 'drink:consumed');
    const expected = drink(run.player.meter, 'stout').state.value;
    run.tick(16, frame({ pressed: ['drink'] }));
    expect(drunk).toEqual([{ drinkId: 'stout' }]);
    expect(run.player.kit.drinks.stout).toBe(1);
    expect(run.player.kit.bottles).toBe(1);
    expect(run.player.meter.value).toBeCloseTo(expected, 1);
  });

  it('drinking from the inventory moves the meter and leaves a bottle', () => {
    const { run } = makeRun({ save: withKit({ drinks: { lager: 1, stout: 1 }, bottles: 0 }) });
    const expected = drink(run.player.meter, 'lager').state.value;
    expect(run.drinkFromInventory('lager')).toBe(true);
    expect(run.player.meter.value).toBeCloseTo(expected, 5);
    expect(run.player.kit.drinks.lager ?? 0).toBe(0);
    expect(run.player.kit.drinks.stout).toBe(1);
    expect(run.player.kit.bottles).toBe(1);
  });

  it('drinking something he does not hold does nothing', () => {
    const { run } = makeRun();
    const before = run.player.meter.value;
    expect(run.drinkFromInventory('tequila')).toBe(false);
    expect(run.player.meter.value).toBe(before);
    expect(run.player.kit.bottles).toBe(0);
  });

  it('a hot drink leaves no bottle', () => {
    const { run } = makeRun();
    run.takeHotDrink('coffee');
    run.drinkFromInventory('coffee');
    expect(run.player.kit.bottles).toBe(0);
  });

  it('the wheel steps the selected drink', () => {
    const { run } = makeRun({ save: withKit({ drinks: { stout: 1, lager: 1 }, slots: { ...createKit().slots, drink: 'stout' } }) });
    run.tick(16, { ...frame({ pressed: ['cycleDrink'] }), wheelDir: 1 });
    expect(run.player.kit.slots.drink).toBe('lager');
    run.tick(16, { ...frame({ pressed: ['cycleDrink'] }), wheelDir: -1 });
    expect(run.player.kit.slots.drink).toBe('stout');
  });
});

describe('the four slots', () => {
  const learned = (...ids: Parameters<ReturnType<typeof makeRun>['run']['learnMove']>[0][]) => {
    const h = makeRun();
    // The sandbox script hands out the old abilities on the first tick; start from a bare kit.
    h.run.player.setKit(createKit());
    for (const id of ids) h.run.learnMove(id);
    return h;
  };

  it('learning a move puts it in its slot', () => {
    const { run } = learned('shoulder', 'stoutSlam');
    expect(run.player.kit.slots.specials[0]).toBe('shoulder');
    expect(run.player.kit.slots.specials[1]).toBe('stoutSlam');
  });

  it('a slot is dark below its level and refuses with no cooldown spent', () => {
    const { run } = learned('stoutSlam');
    run.player.meter = createMeter(1, AT.buzzed);
    run.tick(16, frame({ pressed: ['special2'] }));
    expect(run.combat.lastRefusal?.textId).toBe('ui.move.dark');
    expect(run.combat.slotViews()[1]).toMatchObject({ lit: false, cooldownLeftMs: 0 });
  });

  it('it works at its level and goes on cooldown', () => {
    const { run, bus } = learned('stoutSlam');
    const used = record(bus, 'move:used');
    run.player.meter = createMeter(1, AT.grand);
    run.tick(16, frame({ pressed: ['special2'] }));
    expect(used).toEqual([{ moveId: 'stoutSlam', slot: 2 }]);
    expect(run.combat.slotViews()[1]?.cooldownLeftMs).toBeGreaterThan(0);
    run.tick(16, frame({ pressed: ['special2'] }));
    expect(run.combat.lastRefusal?.textId).toBe('ui.move.cooldown');
    expect(used).toHaveLength(1);
  });

  it('the cooldown keeps ticking while the slot is dark', () => {
    const { run } = learned('stoutSlam');
    run.player.meter = createMeter(1, AT.grand);
    run.tick(16, frame({ pressed: ['special2'] }));
    const left0 = run.combat.slotViews()[1]?.cooldownLeftMs ?? 0;
    run.player.meter = createMeter(1, AT.buzzed);
    // Stay at Buzzed for 3 s by topping the meter up each tick (drain would otherwise end the test early).
    for (let i = 0; i < 188; i++) {
      run.player.meter = createMeter(1, AT.buzzed);
      run.tick(16, frame());
    }
    const view = run.combat.slotViews()[1];
    expect(view?.lit).toBe(false);
    expect(view?.cooldownLeftMs).toBeLessThan(left0 - 2900);
  });

  it('an empty slot refuses', () => {
    const { run } = makeRun();
    run.player.meter = createMeter(1, AT.fecked);
    run.tick(16, frame({ pressed: ['special4'] }));
    expect(run.combat.lastRefusal?.textId).toBe('ui.move.empty');
  });

  it('a move that needs a target refuses with none and spends nothing', () => {
    const { run } = learned('reflexTest');
    run.player.meter = createMeter(1, AT.grand);
    run.tick(16, frame({ pressed: ['special1'] }));
    expect(run.combat.lastRefusal?.textId).toBe('ui.move.noTarget');
    expect(run.combat.slotViews()[0]?.cooldownLeftMs).toBe(0);
  });

  it('Barred throws out the nearest and hurts everyone within the landing radius, no one beyond', () => {
    const { run } = learned('barred');
    const mv = O.moves.barred.effect;
    if (mv.kind !== 'throwOut') throw new Error('barred is not a throwOut');
    run.player.meter = createMeter(1, AT.fecked);
    run.setPlayerPosition({ x: 100, y: 100 });
    const a = run.spawnEnemy('lad', { x: 130, y: 100 });
    const near = run.spawnEnemy('lad', { x: 130 + mv.landingRadius - 5, y: 100 });
    const far = run.spawnEnemy('lad', { x: 130 + mv.landingRadius + 30, y: 100 });
    const max = near.stats.maxHealth;
    run.tick(16, frame({ pressed: ['special4'], aim: { x: 300, y: 100 } }));
    expect(a.down).toBe(true);
    expect(near.health).toBeLessThan(max);
    expect(near.health).toBe(Math.max(0, max - mv.landingDamage));
    expect(far.health).toBe(far.stats.maxHealth);
  });

  it('weapons: R cycles owned weapons only, and wraps', () => {
    const { run } = makeRun();
    run.player.setKit(createKit());
    run.gainWeapon('hurley');
    run.gainWeapon('umbrella');
    expect(run.player.kit.weapons).toEqual(expect.arrayContaining(['fists', 'hurley', 'umbrella']));
    const seen: string[] = [run.player.kit.slots.melee];
    for (let i = 0; i < 3; i++) {
      run.tick(16, frame({ pressed: ['cycleWeapon'] }));
      seen.push(run.player.kit.slots.melee);
    }
    expect(new Set(seen)).toEqual(new Set(['fists', 'hurley', 'umbrella']));
    expect(seen[3]).toBe(seen[0]);
    expect(run.player.kit.weapons).toContain(seen[1]);
  });

  it('R with only fists changes nothing', () => {
    const { run } = makeRun();
    run.player.setKit(createKit());
    run.tick(16, frame({ pressed: ['cycleWeapon'] }));
    expect(run.player.kit.slots.melee).toBe('fists');
  });
});

describe('the throw', () => {
  const aim = { x: 200, y: 100 };
  const hold = (run: ReturnType<typeof makeRun>['run']) => {
    run.setPlayerPosition({ x: 100, y: 100 });
    run.tick(16, frame({ pressed: ['aimHold'], aim }));
  };

  it('with no bottle it refuses with ui.throw.noBottle and nothing is aimed', () => {
    const { run } = makeRun({ save: withKit({ bottles: 0 }) });
    hold(run);
    expect(run.combat.lastRefusal?.textId).toBe('ui.throw.noBottle');
    expect(run.combat.throwPreview()).toBeNull();
    run.tick(16, frame({ released: ['aimHold'], aim }));
    expect(run.projectiles()).toHaveLength(0);
  });

  it('holding shows a preview; releasing spends one bottle and throws to the preview point', () => {
    const { run } = makeRun({ save: withKit({ bottles: 3 }) });
    run.player.meter = createMeter(1, AT.grand);
    hold(run);
    run.tick(16, frame({ held: ['aimHold'], aim }));
    const preview = run.combat.throwPreview();
    expect(preview).not.toBeNull();
    run.tick(16, frame({ released: ['aimHold'], aim }));
    expect(run.player.kit.bottles).toBe(2);
    expect(run.combat.throwPreview()).toBeNull();
    const bottle = run.projectiles().find((p) => p.owner === 'player');
    expect(bottle).toBeDefined();
    expect(bottle?.target?.x).toBeCloseTo(preview?.landing.x ?? NaN, 5);
    expect(bottle?.target?.y).toBeCloseTo(preview?.landing.y ?? NaN, 5);
  });

  it('the throw makes noise where it lands', () => {
    const { run, bus } = makeRun({ save: withKit({ bottles: 1 }) });
    const noise = record(bus, 'stealth:noise');
    run.player.meter = createMeter(1, AT.grand);
    hold(run);
    run.tick(16, frame({ released: ['aimHold'], aim }));
    advance(run, 2000);
    expect(noise.some((n) => n.kind === 'bottle')).toBe(true);
  });

  it('a hit while aiming cancels the aim and keeps the bottle', () => {
    const { run } = makeRun({ save: withKit({ bottles: 2 }) });
    run.player.meter = createMeter(1, AT.grand);
    hold(run);
    run.hitPlayer({ ...hazard(), stunMs: 400 });
    run.tick(16, frame({ held: ['aimHold'], aim }));
    expect(run.combat.throwPreview()).toBeNull();
    run.tick(16, frame({ released: ['aimHold'], aim }));
    expect(run.player.kit.bottles).toBe(2);
  });

  it('rapid hold and release spends exactly one bottle per throw', () => {
    const { run } = makeRun({ save: withKit({ bottles: 5 }) });
    run.player.meter = createMeter(1, AT.grand);
    run.setPlayerPosition({ x: 100, y: 100 });
    for (let i = 0; i < 3; i++) {
      run.tick(16, frame({ pressed: ['aimHold'], aim }));
      run.tick(16, frame({ released: ['aimHold'], aim }));
    }
    expect(run.player.kit.bottles).toBe(2);
  });
});

describe('Myko and the meter', () => {
  it('is silent at 0: no trigger plays a line at any meter value of 0 or less', async () => {
    const { MykoMeterVoice } = await import('../../src/systems/mykoMeter');
    const said: string[] = [];
    const voice = new MykoMeterVoice({ rng: { next: () => 0 } as never, pool: (id) => [`${id}.1`, `${id}.2`], say: (id) => void said.push(id) });
    const triggers = [
      { kind: 'barReturn', reason: 'sober' },
      { kind: 'barReturn', reason: 'floor' },
      { kind: 'levelChanged', from: 2, to: 3 },
      { kind: 'spiritStarted', drinkId: 'whiskey' },
      { kind: 'hotDrink' },
      { kind: 'chapterStart', chapter: 3 },
      { kind: 'meterValue' },
    ] as const;
    for (const t of triggers) voice.trigger(t, 0);
    expect(said).toEqual([]);
    voice.trigger({ kind: 'hotDrink' }, 30);
    expect(said).toHaveLength(1);
  });

  it('in the run, the return from 0 is followed by a bar.sober line, not a low-meter one', () => {
    const { run, bus } = makeRun();
    run.player.meter = createMeter(1, 5);
    run.tick(16, frame()); // the low-Buzz remark fires once, on the way down
    run.dialogue.finishAll();
    const shown = record(bus, 'dialogue:show');
    run.player.meter = createMeter(1, 0.01);
    advance(run, 200);
    const lines = shown.map((x) => x.sequenceId).filter((id) => id.startsWith('myko.'));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((id) => id.startsWith('myko.bar.sober'))).toBe(true);
  });
});

describe('thermal masts through the run (level 3 or 4 and in the sun)', () => {
  const mastModule = (sun: boolean): ChapterModule => {
    const base = createSandboxModule(1);
    const stealthSections = base.def.stealthSections.map((s) => ({
      ...s,
      guards: [],
      hazards: [{ kind: 'thermalMast' as const, id: 'mast', position: { x: 15 * 16 + 8, y: 3 * 16 + 8 }, range: 200 }],
    }));
    return { ...base, def: { ...base.def, stealthSections, screens: base.def.screens.map((sc) => ({ ...sc, sun })) } };
  };
  const detection = (sun: boolean, meter: number): number => {
    const { run } = makeRun({ module: mastModule(sun) });
    run.setPlayerPosition({ x: 15 * 16 + 8, y: 6 * 16 + 8 });
    for (let i = 0; i < 20; i++) {
      run.player.meter = createMeter(1, meter);
      run.tick(16, frame());
    }
    return run.stealthHere()[0]?.runner.hazards[0]?.detection ?? -1;
  };

  it('sees him at Bit much in the sun', () => {
    expect(detection(true, AT.bitMuch)).toBeGreaterThan(0);
  });

  it('sees him at Fecked in the sun', () => {
    expect(detection(true, AT.fecked)).toBeGreaterThan(0);
  });

  it('does not see him in the shade, or below Bit much', () => {
    expect(detection(false, AT.bitMuch)).toBe(0);
    expect(detection(true, AT.grand)).toBe(0);
    expect(detection(true, AT.buzzed)).toBe(0);
  });
});
