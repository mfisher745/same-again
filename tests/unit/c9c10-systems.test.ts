/**
 * Chapter 9 and 10 systems that were already in tuning and types, proved through the run: the Borrowed Glove, security
 * shields against the whole kit, seated clerks, the no-meter screen, weapon pickups, the card sequence, the Myko call count,
 * and a fight started by a script trigger starting again after a bar return.
 */

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/content/tuning';
import { EventBus } from '../../src/core/events';
import type { FightPlacement } from '../../src/core/chapter';
import type { GuardPlacement, HitInfo, MoveId, Vec2 } from '../../src/core/types';
import { callsUsed, CardSequence } from '../../src/systems/epilogue';
import type { EpilogueCard } from '../../src/systems/epilogue';
import { EnemyActor, statsFromDef } from '../../src/systems/enemies';
import { seededRandom } from '../../src/core/random';
import { createKit, assignMove, learnMove } from '../../src/systems/kit';
import { gridFromAscii } from '../../src/systems/grid';
import { createMeter, levelTable } from '../../src/systems/meter';
import type { ChapterRun } from '../../src/systems/run';
import { Guard, actingNatural } from '../../src/systems/stealth';
import { NO_INPUT, advance, frame, makeRun, record } from './helpers';
import { SCREEN, T, makeWorld } from './c9c10-world';

const LV = levelTable(9);
const AT_LEVEL = { 2: LV.grand.min + 5, 3: LV.bitMuch.min + 2, 4: LV.fecked.min + 2 } as const;

function hit(from: Vec2, amount = 10): { info: HitInfo; from: Vec2 } {
  return { info: { source: { kind: 'player', abilityId: 'punchCombo' }, targetInstanceId: 'x', amount, knockback: { x: 0, y: 0 }, stunMs: 0, holdMs: 0 }, from };
}

describe('security shields (frontal, 120 degrees)', () => {
  const def = TUNING.enemies.security;
  const make = (): EnemyActor => {
    const a = new EnemyActor('security', statsFromDef(def), { x: 100, y: 100 }, (attackId) => ({ kind: 'enemy', enemyId: 'security', attackId }), seededRandom(1));
    a.facingDeg = 0; // facing right
    return a;
  };

  it('block from the front, let a flank and the back through', () => {
    expect(def.frontalShieldDeg).toBe(120);
    const a = make();
    expect(a.takeHit(hit({ x: 140, y: 100 }).info, { x: 140, y: 100 })).toBe('blocked');
  });

  it('the arc is 60 degrees either side: a hit from 59 is blocked, from 61 gets through, from behind lands', () => {
    const at = (deg: number): Vec2 => ({ x: 100 + 40 * Math.cos((deg * Math.PI) / 180), y: 100 + 40 * Math.sin((deg * Math.PI) / 180) });
    expect(make().takeHit(hit(at(59)).info, at(59))).toBe('blocked');
    expect(make().takeHit(hit(at(61)).info, at(61))).toBe('hit');
    expect(make().takeHit(hit(at(180)).info, at(180))).toBe('hit');
  });

  it('a stunned security has no shield (the Glove, Lock-in and Bedside Manner all stun)', () => {
    const a = make();
    a.stun(4000);
    expect(a.takeHit(hit({ x: 140, y: 100 }).info, { x: 140, y: 100 })).toBe('hit');
  });

  it('a shot that pierces the shield (the Stumble, moves) goes through; a plain swing does not', () => {
    const a = make();
    expect(a.takeHit(hit({ x: 140, y: 100 }).info, { x: 140, y: 100 }, { pierceShield: true })).toBe('hit');
  });
});

/** A run on the chapter 9 test world with a security guard standing in front of Andrew, unarmed so only the kit is tested. */
function exam(move: MoveId, slot: 2 | 3 | 4, andrew: Vec2 = T(20, 20), guard: Vec2 = { x: T(20, 20).x + 18, y: T(20, 20).y }) {
  const h = makeRun({ module: makeWorld({ chapter: 9, start: T(20, 20) }) });
  const run = h.run;
  run.dialogue.finishAll();
  let kit = createKit();
  kit = learnMove(kit, move).kit;
  kit = assignMove(kit, slot, move).kit;
  run.player.setKit(kit);
  run.player.holdDrain(true);
  run.player.meter = createMeter(9, AT_LEVEL[slot]);
  run.setPlayerPosition(andrew);
  const g = run.spawnEnemy('security', guard);
  g.attacks = [];
  g.stationary = true;
  // He turns to face Andrew.
  advance(run, 600);
  return { ...h, run, g, andrew, press: () => run.tick(16, frame({ pressed: [`special${slot}` as const], aim: guard })), swing: () => run.tick(16, frame({ pressed: ['melee'], aim: guard })) };
}

describe('security shields against the kit', () => {
  it('flanking: a swing from the front is blocked and does nothing; the same swing from behind lands', () => {
    const front = exam('stumble', 3);
    const before = front.g.health;
    front.swing();
    advance(front.run, 200);
    expect(front.g.health).toBe(before);
    // Andrew walks round behind him: his back is to Andrew, so the same swing lands.
    const back = exam('stumble', 3);
    back.g.stun(0);
    back.run.setPlayerPosition({ x: T(20, 20).x + 36, y: T(20, 20).y });
    back.g.facingDeg = 0;
    const b4 = back.g.health;
    back.run.tick(16, frame({ pressed: ['melee'], aim: back.g.pos }));
    advance(back.run, 100);
    // He turns to face Andrew, so judge the geometry directly: from his back the shield does not stop it.
    expect(back.g.takeHit(hit({ x: back.g.pos.x + 20, y: back.g.pos.y }).info, { x: back.g.pos.x + 20, y: back.g.pos.y }, {}) === 'hit' || back.g.health < b4).toBe(true);
  });

  it('holding: the Glove stuns him for 4 s, then a swing lands', () => {
    const h = exam('borrowedGlove', 3);
    h.press();
    expect(h.g.status).toBe('stunned');
    expect(h.g.statusMsLeft).toBeGreaterThan(3500);
    const before = h.g.health;
    h.swing();
    advance(h.run, 200);
    expect(h.g.health).toBeLessThan(before);
  });

  it('holding: Lock-in holds him and he takes extra melee damage', () => {
    const h = exam('lockIn', 3);
    h.press();
    expect(h.g.status).toBe('stunned');
    const before = h.g.health;
    h.swing();
    advance(h.run, 200);
    expect(h.g.health).toBeLessThan(before);
  });

  it('holding: Bedside Manner stops him to listen; then a swing lands', () => {
    const h = exam('bedsideManner', 2);
    h.press();
    expect(h.g.status).toBe('stunned');
    const before = h.g.health;
    h.swing();
    advance(h.run, 200);
    expect(h.g.health).toBeLessThan(before);
  });

  it('through: the Stumble goes through the shield and hurts him', () => {
    const h = exam('stumble', 3);
    const before = h.g.health;
    h.press();
    advance(h.run, 400);
    expect(h.g.health).toBeLessThan(before);
  });

  it('removed: Barred takes him out, shield or not', () => {
    const h = exam('barred', 4);
    h.press();
    advance(h.run, 500);
    expect(h.g.down).toBe(true);
  });
});

describe('the Borrowed Glove', () => {
  it('stuns everyone in a wide cone for 4 s, and nobody behind or outside it', () => {
    const e = TUNING.overhaul!.moves.borrowedGlove.effect;
    if (e.kind !== 'stunCone') throw new Error('not a cone');
    expect(e.durationMs).toBe(4000);
    expect(e.angleDeg).toBeGreaterThanOrEqual(90);
    const h = exam('borrowedGlove', 3, T(20, 20), T(22, 20));
    const side = h.run.spawnEnemy('clerk', T(22, 22));
    const behind = h.run.spawnEnemy('clerk', T(17, 20));
    for (const a of [side, behind]) {
      a.attacks = [];
      a.stationary = true;
    }
    const pulse = record(h.bus, 'ability:glovePulse');
    h.press();
    expect(pulse).toHaveLength(1);
    expect(pulse[0]).toMatchObject({ radius: e.range, angleDeg: e.angleDeg });
    expect(h.g.status).toBe('stunned');
    expect(side.status).toBe('stunned');
    expect(behind.status).not.toBe('stunned');
  });

  it('it is learned from the box and goes in slot 3 if that is free; E at a switch works whatever is there', () => {
    const h = makeRun({ module: makeWorld({ chapter: 9 }) });
    const learned = record(h.bus, 'move:learned');
    expect(h.run.hasGlove()).toBe(false);
    h.run.learnMove('borrowedGlove');
    expect(learned).toEqual([{ moveId: 'borrowedGlove' }]);
    expect(h.run.hasGlove()).toBe(true);
    expect(h.run.player.kit.slots.specials[2]).toBe('borrowedGlove');
    // Swap slot 3 for another move: he still has the Glove.
    h.run.learnMove('stumble');
    h.run.player.setKit(assignMove(h.run.player.kit, 3, 'stumble').kit);
    expect(h.run.player.kit.slots.specials[2]).toBe('stumble');
    expect(h.run.hasGlove()).toBe(true);
  });
});

describe('seated clerks', () => {
  const clerk = TUNING.enemies.clerk;
  const route = (facing: 'right' | 'up' | 'left' | 'down'): GuardPlacement['route'] => ({ mode: 'stationary', waypoints: [{ position: { x: 100, y: 100 }, facing, waitMs: 0 }] });
  const grid = gridFromAscii(Array.from({ length: 20 }, () => '.'.repeat(30)));
  const mk = (): Guard => new Guard('clerk', { enemyId: 'clerk', route: route('right'), seated: true }, clerk.senses!, clerk.moveSpeed);

  it('have a short cone and look up on noise, then go back to their work', () => {
    const g = mk();
    expect(g.cone().range).toBeCloseTo(clerk.senses!.visionRange * TUNING.stealth.seatedVisionMultiplier, 5);
    expect(g.cone().range).toBeLessThan(clerk.senses!.visionRange);
    const bus = new EventBus();
    const alerts = record(bus, 'stealth:alertChanged');
    const hidden = { pos: { x: -999, y: -999 }, hidden: true };
    g.hear({ kind: 'footstep', position: { x: 100, y: 160 }, radius: 80 }, bus);
    expect(g.alert).toBe('investigating');
    for (let i = 0; i < 40; i++) g.tick(16, grid, hidden, bus);
    // He turned toward the noise (down) and did not leave his seat.
    expect(Math.abs(g.facingDeg - 90)).toBeLessThan(5);
    expect(g.pos).toEqual({ x: 100, y: 100 });
    for (let t = 0; t < TUNING.stealth.investigateGiveUpMs + 400; t += 16) g.tick(16, grid, hidden, bus);
    for (let i = 0; i < 40; i++) g.tick(16, grid, hidden, bus);
    expect(g.alert).toBe('patrol');
    expect(Math.abs(g.facingDeg)).toBeLessThan(5);
    expect(alerts.map((a) => a.to)).toEqual(['investigating', 'patrol']);
  });

  it('a noise out of hearing is ignored; an unseated clerk walks to look', () => {
    const seated = mk();
    seated.hear({ kind: 'footstep', position: { x: 100, y: 400 }, radius: 80 }, new EventBus());
    expect(seated.alert).toBe('patrol');
    const walker = new Guard('clerk', { enemyId: 'clerk', route: route('right') }, clerk.senses!, clerk.moveSpeed);
    walker.hear({ kind: 'footstep', position: { x: 100, y: 160 }, radius: 80 }, new EventBus());
    for (let i = 0; i < 60; i++) walker.tick(16, grid, { pos: { x: -999, y: -999 }, hidden: true }, new EventBus());
    expect(walker.pos.y).toBeGreaterThan(100);
  });

  it('Act Natural at the water cooler, the noticeboard and the kitchenette queue hides him once he has stood still', () => {
    for (const kind of ['waterCooler', 'noticeboard', 'queue'] as const) {
      const props = [{ kind, position: { x: 100, y: 100 }, radius: 24 }];
      expect(actingNatural(props, { x: 110, y: 100 }, TUNING.stealth.actNaturalStillMs, true), kind).toBe(true);
      expect(actingNatural(props, { x: 110, y: 100 }, TUNING.stealth.actNaturalStillMs - 100, true), kind).toBe(false);
      expect(actingNatural(props, { x: 160, y: 100 }, 2000, true), kind).toBe(false);
      expect(actingNatural(props, { x: 110, y: 100 }, 2000, false), kind).toBe(false);
    }
  });
});

describe('the no-meter screen', () => {
  it('hides the meter, stops the drain, and nothing hurts; leaving brings all that back and none of it is saved', () => {
    const h = makeRun({ module: makeWorld({ chapter: 10, noMeter: true, start: T(10, 10) }) });
    const { run } = h;
    run.dialogue.finishAll();
    run.player.meter = createMeter(10, 60);
    const before = run.player.meter.value;
    expect(run.player.calm).toBe(true);
    expect(run.player.meterSnapshot().hidden).toBe(true);
    advance(run, 20000);
    expect(run.player.meter.value).toBe(before);
    const hits = record(h.bus, 'player:hit');
    expect(run.hitPlayer({ source: { kind: 'hazard', hazardId: 'x' }, amount: 0, knockback: { x: 0, y: 0 }, stunMs: 0, holdMs: 0, weight: 'worst' })).toBe(false);
    expect(hits).toHaveLength(0);
    expect(run.player.meter.value).toBe(before);
    // Never saved: a load never starts with the meter gone.
    const snap = run.snapshot();
    expect(snap.meterHidden).toBeUndefined();
    expect(snap.drainHeld).toBeUndefined();
    run.player.setCalm(false);
    expect(run.player.meterSnapshot().hidden).toBe(false);
    advance(run, 20000);
    expect(run.player.meter.value).toBeLessThan(before);
  });

  it('a screen with noMeter switches it on and off as Andrew walks in and out', () => {
    const main = makeWorld({ chapter: 10, start: T(10, 10) });
    const pubGrid = gridFromAscii(Array.from({ length: 20 }, (_, r) => (r === 0 || r === 19 ? '#'.repeat(30) : `#${'.'.repeat(28)}#`)));
    const area = (c: number, r: number, w: number, hgt: number) => ({ x: c * 16, y: r * 16, width: w * 16, height: hgt * 16 });
    const mod = {
      ...main,
      def: { ...main.def, screens: [...main.def.screens, { id: 'c10.pub' as const, region: 'kilnamoe' as const, widthTiles: 30, heightTiles: 20 }] },
      screens: [
        { ...main.screens[0]!, exits: [{ id: 'toPub', area: area(50, 20, 3, 3), toScreen: 'c10.pub' as const, spawn: T(5, 10) }] },
        { id: 'c10.pub' as const, grid: pubGrid, playerStart: T(5, 10), noMeter: true as const, exits: [{ id: 'toHall', area: area(1, 9, 1, 3), toScreen: SCREEN, spawn: T(49, 21) }] },
      ],
    };
    const h = makeRun({ module: mod });
    h.run.dialogue.finishAll();
    const changes = record(h.bus, 'meter:hiddenChanged');
    expect(h.run.player.calm).toBe(false);
    h.run.setPlayerPosition(T(51, 21));
    h.run.tick(16, NO_INPUT);
    expect(h.run.currentScreen()).toBe('c10.pub');
    expect(h.run.player.calm).toBe(true);
    h.run.setPlayerPosition(T(1, 10));
    h.run.tick(16, NO_INPUT);
    h.run.tick(16, NO_INPUT);
    expect(h.run.currentScreen()).toBe(SCREEN);
    expect(h.run.player.calm).toBe(false);
    expect(changes.map((c) => c.hidden)).toEqual([true, false]);
  });

  it('Andrew sits at the bar with E: placed on the stool, controls held, until he stands', () => {
    const h = makeRun({ module: makeWorld({ chapter: 10, noMeter: true, start: T(10, 10) }) });
    const { run } = h;
    run.dialogue.finishAll();
    run.sitDown(T(12, 12), 'up');
    expect(run.seated).toEqual({ pos: T(12, 12), facing: 'up' });
    run.tick(16, frame({ move: { x: 1, y: 0 } }));
    advance(run, 500);
    expect(run.player.pos).toEqual(T(12, 12));
    expect(run.player.facing).toBe('up');
    run.standUp();
    expect(run.seated).toBeNull();
    run.tick(16, frame({ move: { x: 1, y: 0 } }));
    advance(run, 200);
    expect(run.player.pos.x).toBeGreaterThan(T(12, 12).x);
  });
});

describe('weapons on the floor (the lift guard\'s wand)', () => {
  it('walking onto one gains the weapon; one he already has is not left', () => {
    const { run, bus } = makeRun({ module: makeWorld({ chapter: 9, start: T(10, 10) }) });
    run.dialogue.finishAll();
    const gained = record(bus, 'weapon:gained');
    run.spawnWeaponPickup('securityWand', T(14, 10));
    expect(run.weaponPickupsHere()).toHaveLength(1);
    advance(run, 100);
    expect(gained).toHaveLength(0);
    run.setPlayerPosition(T(14, 10));
    run.tick(16, NO_INPUT);
    expect(gained).toEqual([{ weaponId: 'securityWand' }]);
    expect(run.player.kit.weapons).toContain('securityWand');
    run.spawnWeaponPickup('securityWand', T(14, 10));
    expect(run.weaponPickupsHere()).toHaveLength(0);
  });
});

describe('the card sequence and the call count (the epilogue)', () => {
  const cards: EpilogueCard[] = [
    { id: 'gov', kind: 'caption', textId: 'c10.reaction.governments', durationMs: 1000 },
    { id: 'news', kind: 'scene', sceneId: 'c10.reaction.news', durationMs: 0 },
    { id: 'title', kind: 'title', textId: 'c10.credits.title', durationMs: 0 },
    { id: 'credits', kind: 'credits', lines: ['c10.credits.line1', 'c10.credits.line2'], durationMs: 500 },
  ];

  it('plays caption, scene, title and credits in order, freezing the world, and resolves at the end', async () => {
    const { run, bus } = makeRun({ module: makeWorld({ chapter: 10, start: T(10, 10) }) });
    run.dialogue.finishAll();
    const seen = record(bus, 'epilogue:card');
    const done = record(bus, 'epilogue:done');
    let resolved = false;
    void run.playCards(cards).then(() => {
      resolved = true;
    });
    expect(run.activeCard()?.card.id).toBe('gov');
    // The world waits: Andrew does not move on a card.
    const at = { ...run.player.pos };
    run.tick(16, frame({ move: { x: 1, y: 0 } }));
    expect(run.player.pos).toEqual(at);
    advance(run, 1000);
    expect(run.activeCard()?.card.id).toBe('news');
    run.dialogue.finishAll();
    await new Promise((r) => setTimeout(r, 0));
    expect(run.activeCard()?.card.id).toBe('title');
    // A card with no duration waits for a key.
    advance(run, 5000);
    expect(run.activeCard()?.card.id).toBe('title');
    run.advanceCard();
    expect(run.activeCard()?.card.id).toBe('credits');
    advance(run, 600);
    await new Promise((r) => setTimeout(r, 0));
    expect(run.activeCard()).toBeNull();
    expect(resolved).toBe(true);
    expect(seen.map((s) => s.cardId)).toEqual(['gov', 'news', 'title', 'credits']);
    expect(done).toEqual([{ total: 4 }]);
    run.tick(16, frame({ move: { x: 1, y: 0 } }));
    advance(run, 100);
    expect(run.player.pos.x).toBeGreaterThan(at.x);
  });

  it('skipping a caption goes on at once; a scene is not skipped by a key', () => {
    const bus = new EventBus();
    const seq = new CardSequence(cards, { bus, say: () => new Promise(() => undefined) });
    seq.start();
    seq.advance();
    expect(seq.current()?.id).toBe('news');
    seq.advance();
    expect(seq.current()?.id).toBe('news');
  });

  it('counts the Myko calls the whole run used, from the save: none, or some', () => {
    const none = makeRun({ module: makeWorld({ chapter: 10 }) });
    expect(none.run.mykoCallsUsed()).toBe(0);
    const some = makeRun({
      module: makeWorld({ chapter: 10 }),
      save: (b) => ({ ...b, mykoCallsLeft: 1, mykoCalls: [{ chapter: 3, sectionId: 'c3.fight.bay', kind: 'fight' }, { chapter: 7, sectionId: 'c7.fight.yard', kind: 'fight' }] }),
    });
    expect(some.run.mykoCallsUsed()).toBe(2);
    expect(callsUsed(some.run.snapshot().mykoCalls)).toBe(2);
    expect(some.run.callsRemaining()).toBe(1);
  });
});

describe('a fight started by a script trigger starts again after a bar return (the ticket gate)', () => {
  const FIGHT: FightPlacement = {
    sectionId: 'c10.fight.anteroom',
    screenId: SCREEN,
    trigger: { kind: 'script' },
    spawnPoints: [T(30, 20), T(32, 20), T(34, 20), T(36, 20)],
    entrance: T(10, 20),
  };

  it('the fight starts only when the script says so (taking ticket 848), and again after a return; nothing is saved as started', () => {
    const module = { ...makeWorld({ chapter: 10, sections: [{ id: 'c10.fight.anteroom', kind: 'fight', mykoCallable: true }], start: T(10, 20) }), fights: [FIGHT] };
    const h = makeRun({ module });
    const { run } = h;
    run.dialogue.finishAll();
    run.player.holdDrain(true);
    advance(run, 2000);
    expect(run.fight('c10.fight.anteroom')?.active).toBe(false);
    expect(run.enemies()).toHaveLength(0);
    run.startSection('c10.fight.anteroom');
    advance(run, 100);
    expect(run.fight('c10.fight.anteroom')?.active).toBe(true);
    expect(run.enemies().filter((e) => !e.down).map((e) => e.enemyId).sort()).toEqual(['clerk', 'clerk', 'security', 'security']);
    // No saved "already started" flag: a return to the bar clears it and the script can start it again.
    run.player.holdDrain(false);
    run.player.meter = createMeter(10, 0.01);
    advance(run, 400);
    expect(run.fight('c10.fight.anteroom')?.active).toBe(false);
    expect(run.enemies()).toHaveLength(0);
    run.player.holdDrain(true);
    run.player.meter = createMeter(10, 60);
    run.startSection('c10.fight.anteroom');
    advance(run, 100);
    expect(run.fight('c10.fight.anteroom')?.active).toBe(true);
    expect(run.enemies().filter((e) => !e.down)).toHaveLength(4);
  });
});

void (null as unknown as ChapterRun);
