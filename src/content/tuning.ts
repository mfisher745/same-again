/**
 * Every balance number in the game. DESIGN.md section 10: no balance number is
 * written anywhere else. Owner: creative-director.
 *
 * Units: distances in pixels at the internal 480 x 270 resolution (a tile is
 * 16), speeds in pixels per second, times in milliseconds, angles in degrees.
 */

import type {
  AbilityDef,
  AttackDef,
  AttackShape,
  BossDef,
  BuzzStateEffects,
  DrinkDef,
  DrinkId,
  EnemyDef,
  FightDef,
  DrunkLevelTable,
  FoodDef,
  HitWeight,
  LootEntry,
  MoveDef,
  MoveId,
  OverhaulTuning,
  SpecialLevel,
  Tuning,
  WaveDef,
  WeaponDef,
  WeaponId,
} from '../core/types';

// ---------------------------------------------------------------------------
// Helpers (shape the data; no numbers hidden in here)
// ---------------------------------------------------------------------------

const arc = (range: number, arcDeg: number): AttackShape => ({ kind: 'arc', range, arcDeg });
const circle = (radius: number): AttackShape => ({ kind: 'circle', radius });
const cone = (range: number, angleDeg: number): AttackShape => ({ kind: 'cone', range, angleDeg });
const charge = (distance: number, width: number): AttackShape => ({ kind: 'charge', distance, width });
const shot = (
  speed: number,
  range: number,
  opts: { pierce?: number; lobbed?: boolean; deflectable?: boolean; noise?: number } = {},
): AttackShape => ({
  kind: 'projectile',
  speed,
  range,
  pierce: opts.pierce ?? 0,
  lobbed: opts.lobbed ?? false,
  deflectable: opts.deflectable ?? false,
  impactNoiseRadius: opts.noise ?? 0,
});

/**
 * How hard each attack pushes the Buzz meter (DESIGN.md 7.1, docs/chapters/README.md roster).
 * Anything not listed is an ordinary hit.
 */
const HEAVY_ATTACKS: readonly string[] = [
  'shoulder', 'hook', 'tumble', 'bash', 'pulse', 'haymaker', 'bullCharge', 'butt', 'forkCharge', 'palletDrop',
  'containerSwing', 'sweep', 'overhead', 'shelf', 'zipTumble', 'barrier', 'door', 'stamp', 'gravityFlip', 'teleportStrike',
];
const WORST_ATTACKS: readonly string[] = ['pass', 'truckPass', 'beamSweep'];
const weightOf = (id: string): HitWeight => (WORST_ATTACKS.includes(id) ? 'worst' : HEAVY_ATTACKS.includes(id) ? 'heavy' : 'ordinary');

/** attack(id, shape, damage, knockback, telegraphMs, cooldownMs, recoveryMs, extras) */
const attack = (
  id: string,
  shape: AttackShape,
  damage: number,
  knockback: number,
  telegraphMs: number,
  cooldownMs: number,
  recoveryMs: number,
  extra: { burst?: number; holdMs?: number } = {},
): AttackDef => ({ id, shape, damage, knockback, telegraphMs, cooldownMs, recoveryMs, weight: weightOf(id), ...extra });

const wave = (...enemies: WaveDef['enemies'][number][]): WaveDef => ({ enemies });
/** A wave that drops one given drink for certain (from the last to fall) instead of rolling for each enemy. */
const waveDropping = (guaranteedDrop: NonNullable<WaveDef['guaranteedDrop']>, ...enemies: WaveDef['enemies'][number][]): WaveDef => ({ enemies, guaranteedDrop });

// ---------------------------------------------------------------------------
// Buzz
// ---------------------------------------------------------------------------

const sober: BuzzStateEffects = {
  damageMultiplier: 1,
  attackSpeedMultiplier: 1,
  knockbackResistance: 0,
  specialsUnlocked: false,
  aimSwayDeg: 0,
  movementDrift: 0,
  footstepNoiseMultiplier: 1,
  screenWobble: 0,
};

const grand: BuzzStateEffects = {
  ...sober,
  damageMultiplier: 1.5,
  attackSpeedMultiplier: 1.2,
  specialsUnlocked: true,
};

const locked: BuzzStateEffects = {
  damageMultiplier: 2,
  attackSpeedMultiplier: 1.2,
  knockbackResistance: 0.5,
  specialsUnlocked: true,
  aimSwayDeg: 8,
  movementDrift: 0.25,
  footstepNoiseMultiplier: 1.75,
  screenWobble: 0.3,
};

const banjaxed: BuzzStateEffects = {
  ...locked,
  damageMultiplier: 2.5,
  aimSwayDeg: 14,
  movementDrift: 0.4,
  footstepNoiseMultiplier: 2,
  screenWobble: 0.6,
};

// ---------------------------------------------------------------------------
// Drinks and food
// ---------------------------------------------------------------------------

const drink = (id: DrinkDef['id'], effects: DrinkDef['effects'], emptiesLeft = 1): DrinkDef => ({
  id,
  nameTextId: `drink.${id}.name`,
  pickupTextId: `drink.${id}.pickup`,
  effects,
  emptiesLeft,
});

const food = (id: FoodDef['id'], effects: FoodDef['effects']): FoodDef => ({
  id,
  nameTextId: `food.${id}.name`,
  pickupTextId: `food.${id}.pickup`,
  effects,
});

// ---------------------------------------------------------------------------
// Abilities
// ---------------------------------------------------------------------------

const abilities: Tuning['abilities'] = {
  punchCombo: {
    id: 'punchCombo',
    slot: 'melee',
    unlockChapter: 1,
    cost: { kind: 'none' },
    cooldownMs: 180,
    shape: arc(20, 100),
    damage: 8,
    knockback: 20,
    combo: [
      { damage: 8, knockback: 20, windowMs: 450 },
      { damage: 8, knockback: 20, windowMs: 450 },
      { damage: 18, knockback: 120, windowMs: 0 },
    ],
    nameTextId: 'ability.punchCombo.name',
  },
  bottleThrow: {
    id: 'bottleThrow',
    slot: 'ranged',
    unlockChapter: 2,
    cost: { kind: 'empties', amount: 1 },
    cooldownMs: 500,
    shape: shot(220, 150, { lobbed: true, noise: 90 }),
    damage: 15,
    knockback: 30,
    nameTextId: 'ability.bottleThrow.name',
  },
  stumble: {
    id: 'stumble',
    slot: 'dodge',
    unlockChapter: 3,
    cost: { kind: 'none' },
    cooldownMs: 800,
    shape: { kind: 'none' },
    damage: 0,
    knockback: 0,
    invulnerableMs: 350,
    dashDistance: 44,
    nameTextId: 'ability.stumble.name',
  },
  stoutSlam: {
    id: 'stoutSlam',
    slot: 'special',
    unlockChapter: 4,
    cost: { kind: 'buzz', amount: 20 },
    cooldownMs: 1500,
    shape: circle(44),
    damage: 20,
    knockback: 160,
    nameTextId: 'ability.stoutSlam.name',
  },
  actNatural: {
    id: 'actNatural',
    slot: 'passive',
    unlockChapter: 5,
    cost: { kind: 'none' },
    cooldownMs: 0,
    shape: { kind: 'none' },
    damage: 0,
    knockback: 0,
    nameTextId: 'ability.actNatural.name',
  },
  hurley: {
    id: 'hurley',
    slot: 'melee',
    unlockChapter: 6,
    replaces: 'punchCombo',
    cost: { kind: 'none' },
    cooldownMs: 220,
    shape: arc(30, 120),
    damage: 14,
    knockback: 40,
    combo: [
      { damage: 14, knockback: 40, windowMs: 500 },
      { damage: 14, knockback: 40, windowMs: 500 },
      { damage: 28, knockback: 160, windowMs: 0 },
    ],
    deflectWindowMs: 220,
    nameTextId: 'ability.hurley.name',
  },
  sliotarStrike: {
    id: 'sliotarStrike',
    slot: 'ranged',
    unlockChapter: 7,
    requires: 'hurley',
    cost: { kind: 'none' },
    cooldownMs: 900,
    shape: shot(360, 260, { pierce: 99 }),
    damage: 30,
    knockback: 80,
    chargeMs: 600,
    nameTextId: 'ability.sliotarStrike.name',
  },
  poitinBreath: {
    id: 'poitinBreath',
    slot: 'special',
    unlockChapter: 8,
    cost: { kind: 'buzz', amount: 40 },
    cooldownMs: 2000,
    shape: cone(64, 50),
    damage: 45,
    knockback: 30,
    nameTextId: 'ability.poitinBreath.name',
  },
  borrowedGlove: {
    id: 'borrowedGlove',
    slot: 'special',
    unlockChapter: 9,
    cost: { kind: 'recharge', rechargeMs: 8000 },
    cooldownMs: 0,
    shape: circle(60),
    damage: 5,
    knockback: 0,
    stunMs: 3000,
    nameTextId: 'ability.borrowedGlove.name',
  },
} satisfies Record<AbilityDef['id'], AbilityDef>;

// ---------------------------------------------------------------------------
// Enemies (docs/chapters/README.md roster)
// ---------------------------------------------------------------------------

const guardSenses = { visionRange: 88, visionAngleDeg: 70, hearingRadius: 72 };

const enemy = (
  id: EnemyDef['id'],
  faction: EnemyDef['faction'],
  maxHealth: number,
  moveSpeed: number,
  attacks: readonly AttackDef[],
  extra: Partial<EnemyDef> = {},
): EnemyDef => ({
  id,
  faction,
  nameTextId: `enemy.${id}.name`,
  spriteKey: `enemy.${id}`,
  maxHealth,
  moveSpeed,
  knockbackResistance: 0,
  flies: false,
  attacks,
  ...extra,
});

const enemies: Tuning['enemies'] = {
  lad: enemy('lad', 'local', 60, 46, [attack('swing', arc(22, 90), 10, 60, 600, 1200, 500)]),
  cousin: enemy('cousin', 'local', 55, 46, [
    attack('swing', arc(22, 90), 12, 60, 550, 1300, 500),
    attack('shoulder', charge(56, 14), 14, 110, 500, 3000, 700),
  ]),
  suit: enemy(
    'suit',
    'federal',
    50,
    44,
    [attack('baton', arc(24, 80), 9, 40, 450, 1500, 450, { burst: 2 })],
    { senses: guardSenses },
  ),
  worker: enemy('worker', 'local', 35, 40, [
    attack('box', shot(130, 150, { lobbed: true }), 12, 50, 700, 2200, 400),
    attack('shove', arc(18, 90), 5, 70, 400, 1800, 600),
  ]),
  brawler: enemy('brawler', 'local', 60, 54, [
    attack('jab', arc(20, 70), 8, 30, 400, 900, 300),
    attack('grab', arc(18, 60), 6, 0, 550, 3500, 800, { holdMs: 1000 }),
  ]),
  docker: enemy(
    'docker',
    'local',
    80,
    38,
    [attack('hook', arc(36, 110), 16, 90, 650, 1900, 900)],
    { knockbackResistance: 0.3, senses: guardSenses },
  ),
  agent: enemy(
    'agent',
    'federal',
    65,
    50,
    [
      attack('dart', shot(150, 180), 10, 10, 600, 2200, 400),
      attack('cuffs', arc(18, 60), 6, 0, 500, 4000, 800, { holdMs: 900 }),
    ],
    { senses: { visionRange: 100, visionAngleDeg: 70, hearingRadius: 80 } },
  ),
  drone: enemy(
    'drone',
    'machine',
    30,
    60,
    [attack('bolt', shot(110, 200, { deflectable: true }), 12, 20, 700, 2400, 300)],
    { flies: true, dropsToFire: true, senses: { visionRange: 72, visionAngleDeg: 50, hearingRadius: 0 } },
  ),
  mascot: enemy(
    'mascot',
    'alien',
    90,
    44,
    [attack('tumble', charge(80, 20), 16, 120, 700, 2600, 1200)],
    { knockbackResistance: 0.4, disguisedUntilAttack: true },
  ),
  clerk: enemy(
    'clerk',
    'alien',
    45,
    46,
    [attack('ray', shot(170, 190, { deflectable: true }), 7, 10, 600, 2600, 900, { burst: 3 })],
    { senses: { visionRange: 80, visionAngleDeg: 60, hearingRadius: 90 } },
  ),
  security: enemy(
    'security',
    'alien',
    110,
    40,
    [
      attack('bash', arc(22, 90), 14, 100, 550, 1700, 600),
      attack('pulse', shot(140, 160), 12, 30, 650, 3000, 500),
    ],
    { knockbackResistance: 0.6, frontalShieldDeg: 120 },
  ),
};

// ---------------------------------------------------------------------------
// Bosses and set pieces (docs/chapters, "Boss" and "Set piece" sections)
// ---------------------------------------------------------------------------

type BossMotion = Pick<BossDef, 'moveSpeed' | 'dazedMs' | 'dazedDamageMultiplier' | 'noiseStopMs'>;

const boss = (
  id: BossDef['id'],
  kind: BossDef['kind'],
  arena: [number, number],
  motion: BossMotion,
  end: BossDef['end'],
  phases: BossDef['phases'],
  maxHealth?: number,
): BossDef => ({
  id,
  kind,
  nameTextId: `boss.${id}.name`,
  spriteKey: `boss.${id}`,
  ...(maxHealth === undefined ? {} : { maxHealth }),
  phases,
  end,
  arenaTiles: { width: arena[0], height: arena[1] },
  ...motion,
});

const beaten: BossDef['end'] = { kind: 'healthBelow', fraction: 0 };

const bosses: Tuning['bosses'] = {
  'c1.boss.bigtom': boss(
    'c1.boss.bigtom',
    'boss',
    [30, 12],
    // Dazed for the bull charge's 2000 ms recovery and takes double damage (docs/chapters/01).
    { moveSpeed: 58, dazedMs: 2000, dazedDamageMultiplier: 2 },
    beaten,
    [
      {
        id: 'jacketOn',
        trigger: { kind: 'start' },
        attackSpeedMultiplier: 1,
        attacks: [
          attack('haymaker', arc(28, 110), 18, 180, 800, 1700, 900),
          // Dazed for 2000 ms and takes double damage if the charge hits the tractor or gate.
          attack('bullCharge', charge(220, 22), 20, 160, 900, 4500, 2000),
        ],
      },
      {
        id: 'jacketOff',
        trigger: { kind: 'healthBelow', fraction: 0.5 },
        attackSpeedMultiplier: 1.25,
        attacks: [
          attack('haymaker', arc(28, 110), 18, 180, 800, 1500, 800),
          attack('oneTwo', arc(26, 90), 12, 80, 600, 1800, 700, { burst: 2 }),
          attack('bullCharge', charge(220, 22), 20, 160, 900, 4000, 2000),
        ],
      },
    ],
    // Playtested at 220 and found right for chapter 1. Do not raise without another playtest.
    220,
  ),
  // The ram must stay faster than Andrew's runSpeed (100).
  'c2.setpiece.ram': boss('c2.setpiece.ram', 'setpiece', [90, 12], { moveSpeed: 115, noiseStopMs: 1500 }, { kind: 'reachExit' }, [
    {
      id: 'chase',
      trigger: { kind: 'start' },
      attackSpeedMultiplier: 1,
      // The ram runs at 115 against Andrew's 100; a bottle stops it for 1500 ms.
      attacks: [attack('butt', charge(40, 16), 12, 200, 500, 2500, 1500)],
    },
  ]),
  'c3.boss.halloran': boss(
    'c3.boss.halloran',
    'boss',
    [26, 14],
    { moveSpeed: 40 },
    beaten,
    [
      {
        id: 'forks',
        trigger: { kind: 'start' },
        attackSpeedMultiplier: 1,
        attacks: [
          // Forks stick in a crate stack for 2500 ms.
          attack('forkCharge', charge(260, 26), 22, 180, 1000, 3500, 2500),
          attack('palletDrop', circle(30), 18, 80, 1100, 5000, 800),
        ],
      },
      {
        id: 'palletShield',
        trigger: { kind: 'healthBelow', fraction: 0.5 },
        attackSpeedMultiplier: 1.15,
        attacks: [
          attack('forkCharge', charge(260, 26), 22, 180, 900, 3000, 2000, { burst: 2 }),
          attack('palletDrop', circle(30), 18, 80, 1000, 4500, 800),
        ],
      },
    ],
    280,
  ),
  'c4.boss.foreman': boss(
    'c4.boss.foreman',
    'boss',
    [28, 16],
    { moveSpeed: 50 },
    beaten,
    [
      {
        id: 'crane',
        trigger: { kind: 'start' },
        attackSpeedMultiplier: 1,
        attacks: [attack('containerSwing', charge(420, 40), 26, 200, 1200, 5000, 1000)],
      },
      {
        id: 'onFoot',
        trigger: { kind: 'healthBelow', fraction: 0.6 },
        attackSpeedMultiplier: 1,
        attacks: [
          attack('sweep', arc(42, 150), 16, 120, 700, 2200, 900),
          attack('overhead', circle(22), 22, 60, 900, 3200, 1000),
          attack('pull', shot(200, 120), 6, -140, 600, 4500, 900, { holdMs: 400 }),
        ],
      },
    ],
    320,
  ),
  'c5.boss.pruitt1': boss(
    'c5.boss.pruitt1',
    'boss',
    [30, 16],
    { moveSpeed: 55 },
    { kind: 'healthBelow', fraction: 0.15 },
    [
      {
        id: 'oneShelf',
        trigger: { kind: 'start' },
        attackSpeedMultiplier: 1,
        attacks: [
          attack('dart', shot(160, 220), 12, 10, 600, 1800, 400),
          attack('shelf', charge(256, 32), 20, 120, 1000, 4500, 600),
        ],
      },
      {
        id: 'twoShelves',
        trigger: { kind: 'healthBelow', fraction: 0.5 },
        attackSpeedMultiplier: 1.1,
        attacks: [
          attack('dart', shot(160, 220), 12, 10, 600, 1600, 400),
          // The phase multiplier divides this: 1100 / 1.1 keeps the rails lit for 1 s, as in phase 1.
          attack('shelf', charge(256, 32), 20, 120, 1100, 4000, 600, { burst: 2 }),
        ],
      },
    ],
    300,
  ),
  'c6.setpiece.combine': boss(
    'c6.setpiece.combine',
    'setpiece',
    [36, 20],
    // The harvester's crawl between passes; the cab lights are placed stationary.
    { moveSpeed: 30 },
    { kind: 'targetsDestroyed', count: 3 },
    [
      {
        id: 'threeLights',
        trigger: { kind: 'start' },
        attackSpeedMultiplier: 1,
        attacks: [
          // Dust plume marks the lane 1500 ms ahead. Each light has 60 health.
          attack('pass', charge(576, 48), 28, 220, 1500, 5000, 0),
          attack('bale', shot(120, 200, { lobbed: true, deflectable: true }), 14, 80, 800, 2800, 0),
        ],
      },
      {
        id: 'oneLight',
        trigger: { kind: 'targetsLeft', count: 1 },
        attackSpeedMultiplier: 1.3,
        attacks: [
          // The phase multiplier divides this: 1700 / 1.3 gives the plume about 1.3 s, a little quicker than phase 1.
          attack('pass', charge(576, 48), 28, 220, 1700, 4000, 0),
          attack('bale', shot(120, 200, { lobbed: true, deflectable: true }), 14, 80, 800, 2200, 0),
        ],
      },
    ],
    180,
  ),
  'c7.boss.mascots': boss(
    'c7.boss.mascots',
    'boss',
    [30, 14],
    { moveSpeed: 60 },
    { kind: 'targetsDestroyed', count: 3 },
    [
      {
        id: 'three',
        trigger: { kind: 'start' },
        attackSpeedMultiplier: 1,
        attacks: [
          // Zip lies on his back for 2000 ms after a tumble. Each mascot has a third of the health.
          attack('zipTumble', charge(160, 22), 18, 150, 800, 3500, 2000),
          attack('zapFan', shot(150, 220, { deflectable: true }), 9, 20, 700, 2600, 500, { burst: 3 }),
        ],
      },
      {
        id: 'two',
        trigger: { kind: 'targetsLeft', count: 2 },
        attackSpeedMultiplier: 1.2,
        attacks: [
          attack('zipTumble', charge(160, 22), 18, 150, 750, 3000, 1800),
          attack('zapFan', shot(150, 220, { deflectable: true }), 9, 20, 650, 2200, 500, { burst: 3 }),
        ],
      },
      {
        id: 'one',
        trigger: { kind: 'targetsLeft', count: 1 },
        attackSpeedMultiplier: 1.4,
        attacks: [
          attack('zipTumble', charge(160, 22), 18, 150, 700, 2600, 1600),
          attack('zapFan', shot(150, 220, { deflectable: true }), 9, 20, 600, 1900, 500, { burst: 3 }),
        ],
      },
    ],
    360,
  ),
  'c8.boss.pruitt2': boss(
    'c8.boss.pruitt2',
    'boss',
    [30, 14],
    { moveSpeed: 60 },
    { kind: 'healthBelow', fraction: 0.4 },
    [
      {
        id: 'gate',
        trigger: { kind: 'start' },
        attackSpeedMultiplier: 1,
        attacks: [
          attack('darts', shot(170, 220), 12, 10, 600, 1700, 400, { burst: 2 }),
          // Whites out the screen for 1000 ms if Andrew is inside it.
          attack('flashbang', circle(36), 6, 0, 1000, 5000, 600),
          attack('barrier', charge(200, 16), 20, 140, 900, 4500, 700),
        ],
      },
      {
        id: 'truck',
        trigger: { kind: 'healthBelow', fraction: 0.6 },
        attackSpeedMultiplier: 1,
        attacks: [
          attack('darts', shot(170, 220), 12, 10, 600, 1700, 400, { burst: 2 }),
          attack('flashbang', circle(36), 6, 0, 1000, 5000, 600),
          attack('truckPass', charge(480, 36), 30, 220, 1500, 12000, 0),
        ],
      },
    ],
    340,
  ),
  'c9.setpiece.lockdown': boss('c9.setpiece.lockdown', 'setpiece', [50, 30], { moveSpeed: 0 }, { kind: 'reachExit' }, [
    {
      id: 'doors',
      trigger: { kind: 'start' },
      attackSpeedMultiplier: 1,
      // Each of five bay doors closes 14000 ms after Andrew enters its bay.
      // A door that closes on him costs 15 health; taking the tape costs 3000 ms.
      attacks: [attack('door', charge(16, 80), 15, 0, 14000, 0, 0)],
    },
  ]),
  'c10.boss.administrator': boss(
    'c10.boss.administrator',
    'boss',
    [36, 20],
    { moveSpeed: 45 },
    beaten,
    [
      {
        id: 'delegation',
        trigger: { kind: 'start' },
        attackSpeedMultiplier: 1,
        // Desk shield drops for 4000 ms when both guards are down.
        attacks: [attack('stamp', charge(576, 16), 16, 60, 900, 3200, 600)],
      },
      {
        id: 'restructuring',
        trigger: { kind: 'healthBelow', fraction: 0.66 },
        attackSpeedMultiplier: 1,
        attacks: [
          // Floor arrows show the new "down" 1500 ms ahead; flips every 10000 ms.
          attack('gravityFlip', circle(400), 14, 240, 1500, 10000, 0),
          attack('stamp', charge(576, 16), 16, 60, 900, 4000, 600),
        ],
      },
      {
        id: 'personally',
        trigger: { kind: 'healthBelow', fraction: 0.33 },
        attackSpeedMultiplier: 1.15,
        attacks: [
          attack('stunPulse', circle(48), 10, 0, 700, 3500, 700, { holdMs: 1200 }),
          attack('teleportStrike', arc(24, 120), 18, 100, 600, 2800, 800),
          attack('beamSweep', cone(300, 90), 24, 60, 1200, 6000, 1200),
        ],
      },
    ],
    520,
  ),
};

// ---------------------------------------------------------------------------
// Fights (docs/chapters, "Beats")
// ---------------------------------------------------------------------------

const fight = (id: FightDef['id'], ...waves: WaveDef[]): [FightDef['id'], FightDef] => [id, { id, waves }];
const n = (enemyId: EnemyDef['id'], count: number) => ({ enemyId, count });

const fights: Tuning['fights'] = Object.fromEntries([
  // The pair of lads drop exactly one stout between them (owner ruling).
  fight('c1.fight.chipper', wave(n('lad', 1)), waveDropping('stout', n('lad', 2))),
  fight('c2.fight.yard', wave(n('cousin', 2), n('lad', 1))),
  // Caught in the bog: the three patrolling suits plus one reinforcement (owner ruling).
  fight('c2.stealth.bog.alarm', wave(n('suit', 1))),
  fight('c3.fight.bay', wave(n('worker', 4), n('lad', 2))),
  fight('c3.stealth.yard.alarm', wave(n('suit', 3))),
  fight('c4.fight.brawl', wave(n('brawler', 2)), wave(n('brawler', 2)), wave(n('brawler', 2))),
  fight('c4.stealth.docks.alarm', wave(n('docker', 4))),
  fight('c5.fight.floor', wave(n('agent', 3)), wave(n('agent', 3)), wave(n('agent', 3))),
  // The lobby is the Act Natural lesson: caught, it is the lobby guard plus one agent from the staff door.
  fight('c5.stealth.lobby.alarm', wave(n('agent', 1))),
  fight('c5.stealth.floor.alarm', wave(n('agent', 3)), wave(n('agent', 3))),
  fight('c6.fight.drones', wave(n('drone', 3), n('agent', 1)), wave(n('drone', 3), n('agent', 1))),
  fight('c6.stealth.fields.alarm', wave(n('drone', 3)), wave(n('drone', 2))),
  fight('c7.fight.yard', wave(n('mascot', 3), n('clerk', 3))),
  fight('c7.stealth.stock.alarm', wave(n('clerk', 4))),
  fight('c8.fight.fence', wave(n('agent', 4))),
  fight('c8.stealth.perimeter.alarm', wave(n('agent', 3))),
  fight('c9.fight.labs', wave(n('security', 2), n('clerk', 2)), wave(n('security', 2), n('clerk', 2))),
  fight('c9.stealth.offices.alarm', wave(n('clerk', 4)), wave(n('security', 2))),
  fight(
    'c10.fight.anteroom',
    wave(n('security', 2), n('clerk', 2)),
    wave(n('security', 2), n('clerk', 1)),
    wave(n('security', 2), n('clerk', 1)),
  ),
]);

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Breakable loot helpers
// ---------------------------------------------------------------------------

const loot = (item: LootEntry['item'], weight: number): LootEntry => ({ item, weight });
const drinkItem = (drinkId: DrinkId): LootEntry['item'] => ({ kind: 'drink', drinkId, count: 1 });
const crisps: LootEntry['item'] = { kind: 'food', foodId: 'crisps' };
const anEmpty: LootEntry['item'] = { kind: 'empties', count: 1 };

// ---------------------------------------------------------------------------
// Overhaul (DESIGN.md 7.1 and 7.2).
// First guesses, to be changed after chapter 1 has been played.
// ---------------------------------------------------------------------------

/** Bit much is always 25 wide and Fecked 9, with the floor one above. Only Buzzed and Grand grow. */
const levels = (buzzedMax: number, grandMax: number): DrunkLevelTable => ({
  buzzed: { min: 1, max: buzzedMax },
  grand: { min: buzzedMax + 1, max: grandMax },
  bitMuch: { min: grandMax + 1, max: grandMax + 25 },
  fecked: { min: grandMax + 26, max: grandMax + 34 },
  floor: grandMax + 35,
});

const moveCooldownMsByLevel: Record<SpecialLevel, number> = { 1: 5000, 2: 12000, 3: 25000, 4: 60000 };

const move = (id: MoveId, level: SpecialLevel, learnedInChapter: MoveDef['learnedInChapter'], effect: MoveDef['effect']): MoveDef => ({
  id,
  level,
  learnedInChapter,
  cooldownMs: moveCooldownMsByLevel[level],
  effect,
  nameTextId: `ability.${id}.name`,
  descTextId: `ability.${id}.desc`,
});

/** weapon(id, chapter, reach, swingMs, damage, knockback, quirk). Fists are the yardstick. */
const weapon = (
  id: WeaponId,
  gainedInChapter: WeaponDef['gainedInChapter'],
  reach: number,
  swingMs: number,
  damage: number,
  knockback: number,
  quirk: WeaponDef['quirk'],
): WeaponDef => ({ id, gainedInChapter, reach, swingMs, damage, knockback, quirk, nameTextId: `weapon.${id}.name`, descTextId: `weapon.${id}.desc` });

// Andrew carries up to `bottleLimit` empties; the bar tops him up to `minBottlesOnLeavingBar`.
// Declared apart from `overhaul` so `bottleLimit` can land before systems-dev adds it to `CarryTuning`
// (src/core/types.ts); once the field is there this can go back inline.
const overhaul: OverhaulTuning = {
  drainPerSecond: 1 / 3,
  sun: { drainMultiplier: 2, beerMultiplier: 1.5, spiritWindowMultiplier: 1.5 },
  restLevel: 2,
  // About 9 s of Grand after a reset (first guess).
  restMargin: 3,
  // First guesses, carried over from the old abilities: single-target reach, melee arc.
  moveRange: 220,
  meleeArcDeg: 100,
  hitWeights: { ordinary: 5, heavy: 10, worst: 15 },
  meleeMultiplierByLevel: { 1: 1, 2: 1.5, 3: 2, 4: 3 },
  lowWarningBelow: 10,
  levels: {
    1: levels(34, 65),
    2: levels(36, 69),
    3: levels(38, 73),
    4: levels(40, 77),
    5: levels(42, 81),
    6: levels(44, 85),
    7: levels(46, 89),
    8: levels(48, 93),
    9: levels(50, 97),
    10: levels(51, 98),
  },
  drinks: {
    stout: { kind: 'beer', id: 'stout', nameTextId: 'drink.stout.name', pickupTextId: 'drink.stout.pickup', points: 15, bottlesLeft: 1 },
    lager: { kind: 'beer', id: 'lager', nameTextId: 'drink.lager.name', pickupTextId: 'drink.lager.pickup', points: 10, bottlesLeft: 1 },
    lightBeer: { kind: 'beer', id: 'lightBeer', nameTextId: 'drink.lightBeer.name', pickupTextId: 'drink.lightBeer.pickup', points: 10, bottlesLeft: 1 },
    craftIpa: { kind: 'beer', id: 'craftIpa', nameTextId: 'drink.craftIpa.name', pickupTextId: 'drink.craftIpa.pickup', points: 20, bottlesLeft: 1 },
    whiskey: {
      kind: 'spirit',
      id: 'whiskey',
      nameTextId: 'drink.whiskey.name',
      pickupTextId: 'drink.whiskey.pickup',
      jump: { kind: 'topOfNextLevel' },
      windowMs: 8000,
      hitMultiplier: 2,
    },
    tequila: {
      kind: 'spirit',
      id: 'tequila',
      nameTextId: 'drink.tequila.name',
      pickupTextId: 'drink.tequila.pickup',
      jump: { kind: 'middleOfLevel', level: 4 },
      windowMs: 8000,
      hitMultiplier: 2,
      dropAfterWindow: 30,
    },
    coffee: { kind: 'hot', id: 'coffee', nameTextId: 'drink.coffee.name', pickupTextId: 'drink.coffee.pickup', reset: { kind: 'instant' } },
    tea: { kind: 'hot', id: 'tea', nameTextId: 'drink.tea.name', pickupTextId: 'drink.tea.pickup', reset: { kind: 'ease', easeMs: 10000, holdMs: 20000 } },
  },
  // Playtest 6: six beers and, apart from them, two spirits.
  // Playtest 7: every beer drunk leaves an empty to throw, up to six (playtest 5 had a cap of 1).
  carry: { limit: 6, spiritLimit: 2, hotDrinkLimit: 1, bottleLimit: 6, minBottlesOnLeavingBar: 1, minBeersOnLeavingBar: 2 },
  moveCooldownMsByLevel,
  moves: {
    shoulder: move('shoulder', 1, 1, { kind: 'charge', distance: 40, knockback: 140 }),
    reflexTest: move('reflexTest', 1, 2, { kind: 'stagger', durationMs: 2000 }),
    actNatural: move('actNatural', 1, 5, { kind: 'hideBesideProp', propRadius: 20 }),
    stoutSlam: move('stoutSlam', 2, 1, { kind: 'knockdownAround', radius: 44, knockback: 160 }),
    sameAgain: move('sameAgain', 2, 3, { kind: 'repeatHits', hits: 3, times: 2 }),
    bedsideManner: move('bedsideManner', 2, 4, { kind: 'calmAround', radius: 64, durationMs: 3000 }),
    stumble: move('stumble', 3, 2, { kind: 'lurch', distance: 88, width: 20 }),
    lockIn: move('lockIn', 3, 5, { kind: 'holdAround', radius: 64, durationMs: 4000, damageMultiplier: 2 }),
    secondOpinion: move('secondOpinion', 3, 6, { kind: 'markTarget', damageMultiplier: 4 }),
    borrowedGlove: move('borrowedGlove', 3, 9, { kind: 'stunCone', range: 96, angleDeg: 100, durationMs: 4000 }),
    oneForTheRoad: move('oneForTheRoad', 4, 3, { kind: 'finisher', bossFraction: 1 / 3 }),
    lastOrders: move('lastOrders', 4, 7, { kind: 'screenWipe', leaveHealthFraction: 0.05, stunMs: 3000, bossFraction: 0.2 }),
    barred: move('barred', 4, 8, { kind: 'throwOut', landingDamage: 60, landingRadius: 40, bossDamage: 80 }),
  },
  weapons: {
    fists: weapon('fists', 1, 20, 180, 8, 20, { kind: 'combo', hits: 3, finisherKnockbackMultiplier: 6 }),
    hurley: weapon('hurley', 1, 30, 250, 13, 40, { kind: 'none' }),
    clipboard: weapon('clipboard', 3, 20, 90, 4, 5, { kind: 'interrupts' }),
    shillelagh: weapon('shillelagh', 4, 26, 320, 18, 160, { kind: 'none' }),
    umbrella: weapon('umbrella', 5, 40, 220, 10, 30, { kind: 'pierce', count: 2 }),
    inflatableAlien: weapon('inflatableAlien', 7, 32, 235, 2, 220, { kind: 'sweep', arcDeg: 160 }),
    securityWand: weapon('securityWand', 9, 24, 145, 14, 40, { kind: 'nthHitStuns', everyHits: 3, stunMs: 1500 }),
  },
  // Degrees of aim sway. None until Bit much (DESIGN.md 7.2, thrown bottles).
  swayByLevel: { 0: 0, 1: 0, 2: 0, 3: 8, 4: 18 },
  // Playtest 4 (owner): too much beer rather than too little. These are the floor for every chapter;
  // `dropBeerBonusByChapter` adds to the beer chance in the early chapters.
  drops: {
    breakable: { beer: 0.5, whiskey: 0.04 },
    enemy: { beer: 0.4, whiskey: 0.03, tequila: 0.01, tequilaFromChapter: 7 },
  },
  // Same gap as the old `myko.commentCooldownMs`. For creative-director review.
  mykoLineCooldownMs: 12000,
  // The old fists combo window.
  weaponComboWindowMs: 450,
  // Floor return total (900 + 1100 + 1800 + 500) plus 2 s.
  barReturnFailsafeMs: 6300,
  // stand-in: creative director to set
  ramGatePauseMs: 1000,
  // Chapter 4: the crane's container crosses the arena in `travelMs`; on foot, the foreman's crane makes a slow pass
  // (`slowTravelMs`) `slowDelayMs` after he steps down. `firstMs` is the first sweep after his intro. First guesses.
  crane: { travelMs: 900, slowTravelMs: 2600, slowDelayMs: 3000, firstMs: 1500 },
  // Playtest 7: chapter 3's gantry fight keeps bottles on the bay floor; one taken comes back after this long.
  fightBottleRespawnMs: 4000,
  // stand-in: creative director to set
  forcedLurchMs: 220,
  // Carried over from the old bottle throw (range 220, noise 90). Playtest 7: damage 10 -> 15 (a worker in 3, a suit in 4).
  throw: { range: 220, speed: 150, damage: 15, knockback: 30, noiseRadius: 90, previewPoints: 12, swayPeriodMs: 1700 },
  // Walking: the old 56, x1.75 at Bit much, x2 at Fecked. Sneaking is silent until Fecked.
  footstepNoiseRadiusByLevel: { 0: 56, 1: 56, 2: 56, 3: 98, 4: 112 },
  sneakNoiseRadiusByLevel: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 28 },
  // stand-in: creative director to set. Puddles in the ram lane (chapter 2): Andrew at three quarters speed.
  slowGroundMultiplier: 0.75,
  // Chapter 6: moving through standing corn rustles at this radius (sneaking: less).
  corn: { rustleRadius: 56, sneakRustleRadius: 28 },
  // Chapter 5 rolling shelves; the 1 s rail light is the `shelf` attack's telegraph.
  // Phase 2 closes pairs of lanes, so two shelves in five lanes leave one safe lane.
  shelves: { slideMs: 600, closedMs: 1500, pushOutPx: 24, lanesPerShelfByPhase: { oneShelf: 1, twoShelves: 2 } },
  // stand-in: creative director to set. The camera looks this far ahead of Andrew down the ram lane.
  cameraLeadPx: 96,
  // stand-in: creative director to set. The chapter 2 sheep: slower than Andrew, shy of him at about two tiles.
  sheep: {
    speed: 60,
    fleeRadius: 40,
    bodySize: 10,
    settleMs: 600,
  },
  // Playtest 4 (creative director, DESIGN.md 7.4). The chapter 2 sheep, outside the flee radius: a fresh random wait
  // per sheep, then a short walk at a random angle. Fleeing wins; a wander never leaves the sheep's pen.
  sheepWander: { intervalMsMin: 2500, intervalMsMax: 5000, speed: 30, walkMsMin: 500, walkMsMax: 900 },
  // Seen only within `radiusTiles`; `faint` is for clues marked hard to see (the chapter 2 ring clues).
  glint: {
    radiusTiles: 4,
    intervalMsMin: 3500,
    intervalMsMax: 6000,
    durationMs: 450,
    faint: { radiusTiles: 6, intervalMsMin: 2000, intervalMsMax: 3500 },
  },
  // Added to `drops.breakable.beer` and `drops.enemy.beer` in that chapter; absent is 0.
  dropBeerBonusByChapter: { 1: 0.25, 2: 0.2, 3: 0.1, 4: 0.05 },
};

export const TUNING: Tuning = {
  audioDefaults: { musicVolume: 0.7, effectsVolume: 0.8 },
  buzz: {
    max: 100,
    thresholds: { grand: 20, locked: 60, banjaxed: 90 },
    drainPerSecond: 0.6,
    drainDelayAfterDrinkMs: 12000,
    effects: { sober, grand, locked, banjaxed },
    banjaxedPeakMs: 8000,
    banjaxedFallenMs: 2000,
    banjaxedResetTo: 30,
  },
  hangover: {
    triggerState: 'locked',
    carryOverFromChapterEnd: 3,
    forcedAtChapterStart: [4],
    maxHealthMultiplier: 0.75,
    brightness: 0.25,
  },
  player: {
    maxHealth: 100,
    // There is no separate walk. WASD moves at runSpeed; Shift sneaks.
    runSpeed: 100,
    sneakSpeedMultiplier: 0.5,
    footstepNoiseRadius: 56,
    sneakNoiseRadius: 0,
    drinkSlotCap: 3,
    maxEmpties: 12,
    bodyWidth: 10,
    bodyHeight: 8,
    hurtInvulnerableMs: 500,
    stumbleDashMs: 220,
    swayPeriodMs: 1700,
    driftPeriodMs: 2300,
    deathRespawnDelayMs: 1200,
    soberRemarkMinMsAbove: 20000,
  },
  combat: {
    knockbackDecayPerSecond: 7,
    chargeSpeed: 260,
    burstIntervalMs: 160,
    characterHitRadius: 6,
    lobSplashRadius: 14,
    lobPeakHeight: 24,
    projectileRadius: 3,
    aggroRange: 400,
    disguiseRevealRange: 40,
    backOffMs: 700,
    separationRadius: 14,
    flankOffset: 40,
    rangedPreferredFraction: 0.6,
    betweenWavesMs: 900,
    repathMs: 500,
    bottleStunMs: 0,
  },
  world: {
    checkpointRadius: 16,
    pushHoldMs: 180,
    pushSlideMs: 160,
  },
  stealth: {
    detectionFillMs: 1000,
    detectionDrainPerSecond: 0.8,
    investigateGiveUpMs: 4000,
    actNaturalStillMs: 600,
    seatedVisionMultiplier: 0.6,
    turnDegPerSecond: 240,
    lookAroundMs: 1500,
    lockedSneakNoiseFactor: 1,
    footstepIntervalMs: 350,
    patrolSpeedFraction: 0.7,
  },
  heat: {
    max: 100,
    risePerSecondInSun: 2.5,
    runningRiseMultiplier: 1.8,
    fallPerSecondInShade: 6,
    fullHeatDamagePerSecond: 3,
    thermalDetectFraction: 0.5,
  },
  myko: {
    callsPerGame: 3,
    callHoldMs: 1000,
    // Deprecated and unused (the call-in is a blackout now); delete with MykoTuning.fightClearMs.
    fightClearMs: 3000,
    idleCommentMs: 45000,
    ohioTangentShare: 0.66,
    followDistance: 22,
    walkSpeed: 78,
    strollSpeed: 60,
    commentCooldownMs: 12000,
    drinkCommentChance: 0.35,
    heatWarnFraction: 0.75,
    tangentChance: 0.5,
    commentStaleMs: 6000,
    blackoutTimeoutMs: 8000,
    // Playtest 8: a medium amount. 60 s +- 8 s was too rare, 20 s +- 5 s read as constant. He still lights up on every
    // new area, for a shorter while.
    smokeIntervalMs: 38000,
    smokeJitterMs: 8000,
    arrivalSmokeMs: 3500,
  },
  investigation: {
    interactRadius: 20,
  },
  chapterSelect: {
    startingDrinks: [{ drinkId: 'stout', count: 3 }, null, null],
  },
  // Roughly 45% drink, 20% food, 15% an empty, 20% nothing in every region.
  breakables: {
    defaultHits: 1,
    noiseRadius: 72,
    hitFlashMs: 100,
    loot: {
      kilnamoe: [loot(drinkItem('stout'), 30), loot(drinkItem('whiskey'), 15), loot(crisps, 20), loot(anEmpty, 15), loot(null, 20)],
      cities: [loot(drinkItem('lightBeer'), 20), loot(drinkItem('bourbon'), 10), loot(drinkItem('craftIpa'), 15), loot(crisps, 20), loot(anEmpty, 15), loot(null, 20)],
      ohio: [loot(drinkItem('lightBeer'), 30), loot(drinkItem('bourbon'), 15), loot(crisps, 20), loot(anEmpty, 15), loot(null, 20)],
      roswell: [loot(drinkItem('tequila'), 20), loot(drinkItem('lightBeer'), 25), loot(crisps, 20), loot(anEmpty, 15), loot(null, 20)],
      nevada: [loot(drinkItem('water'), 25), loot(drinkItem('bourbon'), 20), loot(crisps, 20), loot(anEmpty, 15), loot(null, 20)],
      // Tea is not carried, so the base drops light beer.
      base: [loot(drinkItem('lightBeer'), 45), loot(crisps, 20), loot(anEmpty, 15), loot(null, 20)],
    },
  },
  drinks: {
    stout: drink('stout', [
      { kind: 'buzz', amount: 20 },
      { kind: 'heal', amount: 15 },
    ]),
    whiskey: drink('whiskey', [{ kind: 'buzz', amount: 30 }]),
    poitin: drink('poitin', [{ kind: 'buzz', amount: 60 }]),
    lightBeer: drink('lightBeer', [{ kind: 'buzz', amount: 10 }]),
    bourbon: drink('bourbon', [
      { kind: 'buzz', amount: 30 },
      { kind: 'timed', effect: 'speedBoost', durationMs: 6000, magnitude: 1.35 },
    ]),
    craftIpa: drink('craftIpa', [{ kind: 'buzz', amount: 15 }]),
    tequila: drink('tequila', [
      { kind: 'buzz', amount: 40 },
      { kind: 'timed', effect: 'extraSway', durationMs: 10000, magnitude: 1.6 },
    ]),
    water: drink('water', [{ kind: 'resetHeat' }], 0),
  },
  food: {
    crisps: food('crisps', [{ kind: 'heal', amount: 10 }]),
    chickenFilletRoll: food('chickenFilletRoll', [{ kind: 'heal', amount: 40 }, { kind: 'cureHangover' }]),
    breakfastRoll: food('breakfastRoll', [{ kind: 'heal', amount: 40 }, { kind: 'cureHangover' }]),
    spiceBag: food('spiceBag', [{ kind: 'healFull' }]),
    tea: food('tea', [
      { kind: 'buzz', amount: -25 },
      { kind: 'cureHangover' },
      { kind: 'timed', effect: 'steadyAim', durationMs: 20000, magnitude: 1 },
    ]),
  },
  abilities,
  enemies,
  bosses,
  fights,
  overhaul,
  ui: {
    soberReturn: { flattenMs: 900, fadeMs: 1100, blackMs: 500 },
    floorReturn: { fallMs: 900, hurryMs: 1100, smokeMs: 1800, blackMs: 500, mykoStartOffset: 24 },
    revealMs: 700,
    refusalMs: 1600,
    notYetMs: 3200,
    flatAtZero: 0.9,
    throwDotEndAlpha: 0.25,
    throwDotScale: 2,
  },
};
