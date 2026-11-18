/**
 * Chapter 8 script: every beat in docs/chapters/08-the-long-road.md, in order. All text is referred to by ID; all
 * numbers come from `TUNING`, the systems or `./maps`. Nothing here guards a start with a saved "started" flag: a fight,
 * puzzle or boss begun by a trigger starts again after a load or a return to the bar, because the trigger tests that the
 * section is not complete and not already under way (never "already started"). After a bar return finished sections stay
 * finished and Andrew walks through them.
 *
 * The beats: the roadhouse (hot drink, the dollar and one beer, the fuel log, the grey car), the sun lesson at the awning's
 * edge, Barred on a lone agent at the end of the wash, the perimeter stealth by day (sensors, masts, trucks; a clean run
 * opens the service gate), the junction puzzle (three toggles, one per box), the fence (the sun goes down, a truck parks
 * with its headlights on, four agents, the clipboard), the deduction board, Pruitt's second round (he is let through, not
 * beaten) and the walk up the service road.
 */

import { PROP } from '../../art/props';
import { hasSequence, pool, sequence } from '../../content/dialogue';
import { TUNING } from '../../content/tuning';
import { GameEvents } from '../../core/types';
import type { SectionId, SpecialSlotIndex, TextId, Vec2 } from '../../core/types';
import type { BossHooks, ChapterContext, ChapterScript, LoneEnemyHandle } from '../../systems';
import { hidePrompt, openHotDrinkChoice, showPrompt, showSlotPrompt } from '../../ui/prompts';
import {
  BARRED_AGENT_SPOT,
  FIGHT_TRUCK_ENTRY_TILE,
  FIGHT_TRUCK_PROP,
  FIGHT_TRUCK_SHADE,
  FIGHT_TRUCK_SHADE_ID,
  GATE_MYKO_START,
  JUNCTION_BOXES,
  MYKO_BAR,
  PATROL_TRUCKS,
  SENSOR_LINES,
  STEALTH_ENTRANCE,
  THERMAL_MASTS,
  artLine,
  boxFrame,
  junctionPropId,
  ownLine,
} from './maps';

const OBJ = {
  station: 'c8.station',
  wash: 'c8.wash',
  perimeter: 'c8.perimeter',
  junctions: 'c8.junctions',
  fence: 'c8.fence',
  board: 'c8.board',
  pruitt: 'c8.pruitt',
} as const;

const STEALTH = 'c8.stealth.perimeter';
const PUZZLE = 'c8.puzzle.junctions';
const FIGHT = 'c8.fight.fence';
const BOARD = 'c8.deduction.gate';
const BOSS = 'c8.boss.pruitt2';

/** Presentation only: how long a prompt may linger when nothing the player does can dismiss it. */
const PROMPT_LINGER_MS = 7000;
/** Presentation only: how long the truck takes to drive in to the fence. */
const TRUCK_DRIVE_MS = 2500;
/** Presentation only: how long Andrew stands in the sun before Myko mentions it. */
const SUN_LINE_EVERY_MS = 30000;
/** Presentation only: the same warning is not repeated inside this time. */
const WARN_COOLDOWN_MS = 6000;
/** Presentation only: a truck this much further out than its cone's range is "coming". */
const TRUCK_WARN_FACTOR = 1.3;

type Flag =
  | 'intro.done'
  | 'beer.bought'
  | 'attendant.n'
  | 'tea.seen'
  | 'clue.schedule'
  | 'clue.car'
  | 'barred.done'
  | 'perimeter.clean'
  | 'clue.shift'
  | 'lanyard'
  | 'sun.n';

/** One patrol truck's motion, mirroring the stealth hazard (constant speed, ping-pong, a wait at each end) so the script can warn of it. */
class TruckSim {
  pos: Vec2;
  facingX = 1;
  private wp = 0;
  private dir: 1 | -1 = 1;
  private waitMs = 0;
  constructor(private readonly route: (typeof PATROL_TRUCKS)[number]['route']) {
    this.pos = route.waypoints[0]?.position ?? { x: 0, y: 0 };
  }
  tick(dtMs: number): void {
    const wps = this.route.waypoints;
    const target = wps[this.wp];
    if (!target) return;
    const dx = target.position.x - this.pos.x;
    const dy = target.position.y - this.pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 2) {
      const step = Math.min((TUNING.overhaul?.perimeter?.truckSpeed ?? 0) * dtMs / 1000, dist);
      this.pos = { x: this.pos.x + (dx / dist) * step, y: this.pos.y + (dy / dist) * step };
      if (dx !== 0) this.facingX = Math.sign(dx);
      return;
    }
    this.waitMs -= dtMs;
    if (this.waitMs > 0) return;
    const next = this.wp + this.dir;
    if (next < 0 || next >= wps.length) this.dir = this.dir === 1 ? -1 : 1;
    this.wp = this.wp + this.dir;
    this.waitMs = wps[this.wp]?.waitMs ?? 0;
  }
}

export function createChapterScript(ctx: ChapterContext): ChapterScript {
  let disposed = false;
  const unsubs: Array<() => void> = [];
  /** Bumped by a return to the bar and by dispose: an async chain from an older run stops. */
  let epoch = 0;
  /** Run-time only (a return to the bar clears them). */
  let fenceStarting = false;
  let pruittStarting = false;
  let barredLesson = false;
  let ending = false;
  let barredUsed = false;
  let lone: LoneEnemyHandle | null = null;
  let stealthRunning = false;
  let buzz = 0;
  let sunMs = 0;
  let warnCooldown = 0;
  let sims: TruckSim[] = [];
  let lastPos: Vec2 | null = null;
  let speed = 0;
  /** The truck driving in: elapsed ms, and a resolver for the drive. */
  let drive: { ms: number; done: () => void } | null = null;
  let driveCol = -1;

  const flag = (key: Flag): boolean => ctx.flag(key) === true;
  const setFlag = (key: Flag, value: boolean | number = true): void => ctx.setFlag(key, value);
  const count = (key: Flag): number => {
    const v = ctx.flag(key);
    return typeof v === 'number' ? v : 0;
  };

  // --- Tutorial prompts: one at a time, never over a scene ---

  let wanted: { id: TextId; values?: Record<string, string | number>; slot?: SpecialSlotIndex } | null = null;
  let scenesOpen = 0;
  const sync = (): void => {
    if (wanted !== null && scenesOpen === 0) {
      if (wanted.slot !== undefined) showSlotPrompt(wanted.slot);
      else if (wanted.values !== undefined) showPrompt(wanted.id, wanted.values);
      else showPrompt(wanted.id);
    } else hidePrompt();
  };
  const setPrompt = (id: TextId, lingerMs?: number, values?: Record<string, string | number>): void => {
    wanted = values === undefined ? { id } : { id, values };
    sync();
    if (lingerMs !== undefined) ctx.after(lingerMs, () => clearPrompt(id));
  };
  const setSlotPrompt = (slot: SpecialSlotIndex, lingerMs: number): void => {
    wanted = { id: 'ui.prompt.slot', slot };
    sync();
    ctx.after(lingerMs, () => clearPrompt('ui.prompt.slot'));
  };
  const clearPrompt = (id?: TextId): void => {
    if (id !== undefined && wanted?.id !== id) return;
    wanted = null;
    sync();
  };

  // --- What is done ---

  const exploreRoadDone = (): boolean => ctx.isComplete('c8.explore.road');
  const stealthDone = (): boolean => ctx.isComplete(STEALTH);
  const puzzleDone = (): boolean => ctx.isComplete(PUZZLE);
  const fightDone = (): boolean => ctx.isComplete(FIGHT);
  const boardDone = (): boolean => ctx.isComplete(BOARD);
  const bossDone = (): boolean => ctx.isComplete(BOSS);
  const perimeterPuzzle = () => ctx.junctions(PUZZLE);

  /** The objective Andrew should have, from what has happened so far. */
  const restoreObjective = (): void => {
    if (bossDone()) ctx.setObjective(null);
    else if (boardDone()) ctx.setObjective(OBJ.pruitt);
    else if (fightDone()) ctx.setObjective(OBJ.board);
    else if (puzzleDone()) ctx.setObjective(OBJ.fence);
    else if (stealthDone()) ctx.setObjective(OBJ.junctions);
    else if (!flag('intro.done')) return;
    else if (!exploreRoadDone()) ctx.setObjective(OBJ.station);
    else if (ctx.currentScreen() === 'c8.perimeter' || flag('perimeter.clean')) ctx.setObjective(OBJ.perimeter);
    else ctx.setObjective(OBJ.wash);
  };

  const syncSteam = (): void => ctx.setPropVisible('bar.steam', ctx.hotDrinkOffered());

  /** A box's lever is thrown when the one line only it touches is off (or the puzzle is solved). */
  const syncBoxes = (): void => {
    const puzzle = perimeterPuzzle();
    for (const b of JUNCTION_BOXES) {
      const thrown = puzzleDone() || (puzzle?.isLineOff(String(ownLine(b))) ?? false);
      ctx.setPropFrame(junctionPropId(b.id), boxFrame(b, thrown));
    }
  };

  const truckShade = (): void => {
    const parked = fightDone();
    ctx.setShadeArea(
      FIGHT_TRUCK_SHADE_ID,
      parked ? { x: FIGHT_TRUCK_SHADE.col * 16, y: FIGHT_TRUCK_SHADE.row * 16, width: FIGHT_TRUCK_SHADE.width * 16, height: FIGHT_TRUCK_SHADE.height * 16 } : null,
      'c8.perimeter',
    );
  };

  /** Run-time dressing, locks and shade are not saved. Put them back from what is finished. */
  const restoreWorld = (): void => {
    // The service gate opens only from a clean run; the fence gate once the fight is over. The way on to Gate C needs the plan.
    const clean = flag('perimeter.clean');
    ctx.setPropVisible('fence.service', !clean);
    ctx.setPropVisible('fence.service.open', clean);
    ctx.setExitLocked('c8.perimeter.service', !clean);
    ctx.setPropVisible('fence.gate', !fightDone());
    ctx.setPropVisible('fence.gate.open', fightDone());
    ctx.setExitLocked('c8.perimeter.gate', !boardDone());
    // The truck is parked once the fight is over (while it is under way the script shows it as it arrives).
    const fight = ctx.fight(FIGHT);
    const parked = fightDone() || (fight?.active === true && !fenceStarting);
    ctx.setPropVisible('fight.truck', parked);
    if (drive === null) ctx.setPropVisible('fight.truckDrive', false);
    truckShade();
    ctx.setPropVisible('fence.clipboard', fightDone() && !flag('clue.shift'));
    syncBoxes();
    syncSteam();
    // Night: the floodlights and the hut's window, Pruitt's chair, the barrier.
    const night = ctx.isNight();
    for (let i = 1; i <= 4; i++) ctx.setPropFrame(`gate.flood${i}`, night ? PROP.gateFloodlight.on : PROP.gateFloodlight.off);
    ctx.setPropFrame('gate.hut', night ? PROP.guardHut.night : PROP.guardHut.day);
    ctx.setPropFrame('gate.barrier', PROP.barrierArm.up);
    ctx.setNpcVisible('gate.pruitt', ctx.boss(BOSS)?.body('pruitt') === undefined);
    // The night was saved with a section; a fight finished (or begun) in it is night even if the flag was lost.
    if (fightDone()) ctx.sunset();
  };

  const parkMyko = (): void => {
    const here = ctx.currentScreen();
    if (here === 'c8.road') ctx.setMykoScripted(MYKO_BAR);
    else if (here === 'c8.perimeter') ctx.setMykoScripted(stealthDone() ? null : STEALTH_ENTRANCE);
    // Pruitt speaks to Andrew alone: Myko keeps to the far end of the arena, on the phone, until he is through.
    else ctx.setMykoScripted(bossDone() ? null : GATE_MYKO_START);
  };

  // --- The roadhouse ---

  const opening = async (): Promise<void> => {
    void ctx.say('c8.caption.title');
    void ctx.say('c8.caption.road');
    await ctx.say('c8.bar.open');
    if (disposed) return;
    setFlag('intro.done');
    ctx.setObjective(OBJ.station);
    if (ctx.hotDrinkOffered()) setPrompt('ui.prompt.hotDrink', PROMPT_LINGER_MS);
  };

  /** E at the counter: the hot drink. The first time it is also the bar section. */
  const tea = (): void => {
    if (!ctx.isComplete('c8.explore.bar')) ctx.completeSection('c8.explore.bar');
    if (ctx.hotDrinkOffered()) {
      clearPrompt('ui.prompt.hotDrink');
      void ctx.say('c8.bar.hotDrink', { repeat: true });
      openHotDrinkChoice();
    } else void ctx.say('c8.bar.hotDrink', { repeat: true });
  };

  /** E at the attendant: the dollar and one beer, then his four lines in turn. */
  const attendant = async (): Promise<void> => {
    if (!flag('beer.bought')) {
      setFlag('beer.bought');
      ctx.give({ kind: 'drink', drinkId: 'lightBeer', count: 1 });
      await ctx.say('c8.bar.dollar');
      return;
    }
    const n = count('attendant.n');
    setFlag('attendant.n', n + 1);
    void ctx.say(`c8.attendant.${(n % 4) + 1}`, { repeat: true });
  };

  const roadProgress = (): void => {
    if (flag('clue.schedule') && flag('clue.car') && !exploreRoadDone()) {
      ctx.completeSection('c8.explore.road');
      restoreObjective();
    }
  };

  // --- The sun ---

  const sunLesson = (): void => {
    void ctx.say('c8.sun.lesson');
  };

  /** While Andrew stands in the sun Myko mentions it now and then: the pool in turn, once each. */
  const sunLine = (dtMs: number): void => {
    const heat = ctx.heat();
    if (!heat.active || !heat.inSun || scenesOpen > 0 || sectionBusy()) {
      sunMs = 0;
      return;
    }
    sunMs += dtMs;
    if (sunMs < SUN_LINE_EVERY_MS) return;
    sunMs = 0;
    const lines = pool('c8.sun');
    const n = count('sun.n');
    const id = lines[n % lines.length];
    if (id === undefined) return;
    setFlag('sun.n', n + 1);
    void ctx.say(id, { repeat: true });
  };

  /** A fight, stealth section or boss is on: no asides. */
  const sectionBusy = (): boolean => ctx.fight(FIGHT)?.active === true || ctx.boss(BOSS)?.active === true || stealthRunning;

  // --- Barred ---

  const loneFell = (): void => {
    if (flag('barred.done')) return;
    setFlag('barred.done');
    if (barredUsed) void ctx.say('c8.barred.done');
  };

  /** Walking in at the wash's mouth: the lone agent is at the end of it, and the lesson plays (once per save). */
  const barredTrigger = async (): Promise<void> => {
    if (flag('barred.done')) return;
    if (lone?.alive() !== true) lone = ctx.spawnLoneEnemy('agent', BARRED_AGENT_SPOT, { onDefeated: loneFell });
    if (ctx.kit().moves.includes('barred') || barredLesson) return;
    barredLesson = true;
    const mine = epoch;
    await ctx.say('c8.barred.lesson');
    barredLesson = false;
    if (disposed || mine !== epoch) return;
    ctx.learnMove('barred');
    setSlotPrompt(4, PROMPT_LINGER_MS);
  };

  // --- The perimeter ---

  const startTrucks = (): void => {
    sims = PATROL_TRUCKS.map((t) => new TruckSim(t.route));
    warnCooldown = 0;
  };

  const warn = (id: TextId): void => {
    if (warnCooldown > 0) return;
    warnCooldown = WARN_COOLDOWN_MS;
    void ctx.say(id, { repeat: true });
  };

  /** What the hazards would have given away: a tramp near a live sensor, a hot Andrew in the sun near a mast, a truck coming. */
  const hazardWarnings = (dtMs: number): void => {
    warnCooldown = Math.max(0, warnCooldown - dtMs);
    if (!stealthRunning || ctx.currentScreen() !== 'c8.perimeter' || stealthDone()) return;
    const p = ctx.playerPosition();
    const t = TUNING.overhaul?.perimeter;
    if (!t) return;
    for (const s of sims) s.tick(dtMs);
    const puzzle = perimeterPuzzle();
    const running = speed > TUNING.player.runSpeed * 0.75;
    if (running) {
      for (const l of SENSOR_LINES) {
        if (puzzle?.isLineOff(String(l.line)) === true) continue;
        if (l.sensors.some((s) => Math.hypot(s.x - p.x, s.y - p.y) <= t.sensorRadiusPx * 2)) {
          warn('c8.perimeter.ground');
          return;
        }
      }
    }
    if (buzz >= 3 && ctx.heat().inSun && THERMAL_MASTS.some((m) => Math.hypot(m.x - p.x, m.y - p.y) <= t.mastRangePx)) {
      warn('c8.perimeter.thermal');
      return;
    }
    for (const s of sims) {
      const d = Math.hypot(s.pos.x - p.x, s.pos.y - p.y);
      if (d <= t.truckCone.range * TRUCK_WARN_FACTOR && (p.x - s.pos.x) * s.facingX > 0) {
        warn('c8.perimeter.truck');
        return;
      }
    }
  };

  /** Back to the start with fresh trucks: the section starts over. */
  const stealthStopped = (): void => {
    stealthRunning = false;
    sims = [];
  };

  /** The puzzle is the current section as soon as the way across is behind him, so Myko can be called in on it. */
  const armPuzzle = (): void => {
    if (!stealthDone() || puzzleDone()) return;
    ctx.startSection(PUZZLE);
    ctx.setObjective(OBJ.junctions);
  };

  const junctionsIntro = (): void => {
    void ctx.say('c8.junctions.intro');
    armPuzzle();
  };

  /** The diagram on a box's door: the two lines it toggles, numbered as the art numbers them (north to south). */
  const showDiagram = (boxId: string): void => {
    const box = JUNCTION_BOXES.find((b) => b.id === boxId);
    if (!box) return;
    const [a, b] = [artLine(box.lines[0]), artLine(box.lines[1])].sort((x, y) => x - y);
    setPrompt('c8.junction.diagram', PROMPT_LINGER_MS, { a: a ?? 0, b: b ?? 0 });
  };

  /** A box was worked: the lever moves, and one that turned a live line back on gets the "hobby" line. */
  const onToggled = (boxId: string, before: readonly string[]): void => {
    syncBoxes();
    const box = JUNCTION_BOXES.find((b) => b.id === boxId);
    if (!box) return;
    // One of its lines was off and the other on: it turned one off and one back on.
    const wasOff = box.lines.filter((l) => before.includes(String(l))).length;
    if (wasOff === 1 && !puzzleDone()) void ctx.say('c8.junctions.wrong', { repeat: true });
  };
  let linesBefore: readonly string[] = [];

  // --- The fence ---

  const startFence = async (): Promise<void> => {
    if (!puzzleDone() || fightDone() || fenceStarting || ctx.fight(FIGHT)?.active === true) {
      // The sun is down for good once he has been here; this is a no-op when it already is.
      if (fightDone() || ctx.fight(FIGHT)?.active === true) ctx.sunset();
      return;
    }
    fenceStarting = true;
    const mine = epoch;
    ctx.sunset();
    ctx.setObjective(OBJ.fence);
    await ctx.say('c8.fence.intro');
    if (disposed || mine !== epoch) return;
    // The truck drives in along row 8 and parks with its nose to the fence zone.
    ctx.setPropVisible('fight.truckDrive', true);
    driveCol = -1;
    await new Promise<void>((done) => {
      drive = { ms: 0, done };
    });
    drive = null;
    if (disposed || mine !== epoch) return;
    ctx.setPropVisible('fight.truckDrive', false);
    ctx.setPropVisible('fight.truck', true);
    ctx.setShadeArea(
      FIGHT_TRUCK_SHADE_ID,
      { x: FIGHT_TRUCK_SHADE.col * 16, y: FIGHT_TRUCK_SHADE.row * 16, width: FIGHT_TRUCK_SHADE.width * 16, height: FIGHT_TRUCK_SHADE.height * 16 },
      'c8.perimeter',
    );
    fenceStarting = false;
    if (!fightDone() && ctx.fight(FIGHT)?.active !== true) ctx.startSection(FIGHT);
  };

  const stepDrive = (dtMs: number): void => {
    if (drive === null) return;
    drive.ms += dtMs;
    const t = Math.min(1, drive.ms / TRUCK_DRIVE_MS);
    const from = FIGHT_TRUCK_ENTRY_TILE.col;
    const to = FIGHT_TRUCK_PROP.col;
    const col = Math.round(from + (to - from) * t);
    if (col !== driveCol) {
      driveCol = col;
      ctx.setPropTile('fight.truckDrive', col, FIGHT_TRUCK_PROP.row);
    }
    if (t >= 1) {
      const d = drive;
      drive = null;
      d.done();
    }
  };

  const fenceEnded = async (by: string): Promise<void> => {
    restoreWorld();
    ctx.setObjective(OBJ.board);
    if (by !== 'myko') await ctx.say('c8.fence.end');
  };

  /** The clipboard: the clue, and with it the board. */
  const clipboard = (): void => {
    if (!fightDone()) return;
    if (!flag('clue.shift')) {
      setFlag('clue.shift');
      ctx.completeMark('c8.clue.shift');
      ctx.addEvidence('c8.clue.shift');
      ctx.setPropVisible('fence.clipboard', false);
    }
    ctx.after(0, () => {
      if (!disposed && !boardDone()) ctx.openDeduction();
    });
  };

  // --- Pruitt ---

  const pruittArrives = async (): Promise<void> => {
    pruittStarting = true;
    const mine = epoch;
    await ctx.say('c8.pruitt.intro');
    pruittStarting = false;
    if (disposed || mine !== epoch) return;
    if (bossDone() || ctx.boss(BOSS)?.active === true) return;
    ctx.setObjective(OBJ.pruitt);
    ctx.setNpcVisible('gate.pruitt', false);
    ctx.startSection(BOSS);
  };

  const pruittHooks: BossHooks = {
    onStart: () => {
      ctx.setNpcVisible('gate.pruitt', false);
    },
    onPhaseChanged: (_boss, phase) => {
      if (phase.id === 'truck') void ctx.say('c8.pruitt.phase2');
    },
    onEnd: (_boss, by) => {
      ctx.setObjective(null);
      // He raises the barrier and gives Andrew his lanyard. A Myko call has its own scene, which says the same.
      ctx.setPropFrame('gate.barrier', PROP.barrierArm.up);
      setFlag('lanyard');
      if (by !== 'myko') void ctx.say('c8.pruitt.end');
    },
  };

  const onPruitt = (phase: string): void => {
    if (phase === 'barrierLit' || phase === 'barrierDown') ctx.setPropFrame('gate.barrier', PROP.barrierArm.down);
    else if (phase === 'barrierUp') ctx.setPropFrame('gate.barrier', PROP.barrierArm.up);
  };

  /** The walk up the service road in the dark. */
  const closing = async (): Promise<void> => {
    if (ending || !bossDone()) return;
    ending = true;
    ctx.setObjective(null);
    ctx.setMykoScripted(null);
    await ctx.say('c8.closing');
    if (disposed) return;
    ctx.completeChapter();
  };

  // --- Entering a screen ---

  const entered = (screenId: string): void => {
    clearPrompt();
    parkMyko();
    restoreWorld();
    restoreObjective();
    if (screenId === 'c8.perimeter') {
      void ctx.say('c8.caption.perimeter');
      armPuzzle();
      // A load or a return puts a fight that was on again: walking in at the fence starts it.
    } else if (screenId === 'c8.gate') void ctx.say('c8.caption.gate');
    else if (screenId === 'c8.road') void ctx.say('c8.caption.road');
  };

  return {
    onStart: () => {
      restoreWorld();
      parkMyko();
      lastPos = ctx.playerPosition();
      unsubs.push(
        ctx.bus.on(GameEvents.KitChanged, () => syncSteam()),
        ctx.bus.on(GameEvents.BuzzLevelChanged, ({ to }) => {
          buzz = to;
        }),
        ctx.bus.on(GameEvents.MoveUsed, ({ moveId }) => {
          if (moveId === 'barred') {
            barredUsed = true;
            clearPrompt('ui.prompt.slot');
          }
        }),
        ctx.bus.on(GameEvents.SectionStarted, ({ sectionId }) => {
          if (sectionId !== STEALTH) return;
          stealthRunning = true;
          startTrucks();
          setPrompt('ui.prompt.sneak', PROMPT_LINGER_MS);
        }),
        ctx.bus.on(GameEvents.StealthAlarm, ({ sectionId }) => {
          if (sectionId !== STEALTH) return;
          stealthStopped();
          void ctx.say('c8.perimeter.caught');
        }),
        ctx.bus.on(GameEvents.StealthCleanRun, ({ sectionId }) => {
          if (sectionId !== STEALTH) return;
          stealthStopped();
          setFlag('perimeter.clean');
          restoreWorld();
          void ctx.say('c8.perimeter.clean');
        }),
        ctx.bus.on(GameEvents.JunctionsToggled, ({ puzzleId, boxId, off }) => {
          if (puzzleId !== PUZZLE) return;
          onToggled(boxId, linesBefore);
          linesBefore = off;
        }),
        ctx.bus.on(GameEvents.PruittChanged, ({ phase }) => onPruitt(phase)),
        ctx.bus.on(GameEvents.DialogueShow, ({ sequenceId }) => {
          if (hasSequence(sequenceId) && sequence(sequenceId).delivery === 'scene') {
            scenesOpen++;
            sync();
          }
        }),
        ctx.bus.on(GameEvents.DialogueFinished, ({ sequenceId }) => {
          if (hasSequence(sequenceId) && sequence(sequenceId).delivery === 'scene') {
            scenesOpen = Math.max(0, scenesOpen - 1);
            sync();
          }
        }),
      );
      linesBefore = perimeterPuzzle()?.linesOff() ?? [];
      if (!flag('intro.done')) void opening();
      else {
        restoreObjective();
        if (ctx.currentScreen() === 'c8.perimeter') armPuzzle();
      }
    },

    /** Andrew is back at the bar. Flags are what the last save held and the unfinished section has started over. */
    onBarReturn: () => {
      epoch++;
      scenesOpen = 0;
      fenceStarting = false;
      pruittStarting = false;
      barredLesson = false;
      stealthStopped();
      drive = null;
      lone = null;
      sunMs = 0;
      lastPos = null;
      clearPrompt();
      restoreWorld();
      parkMyko();
      linesBefore = perimeterPuzzle()?.linesOff() ?? [];
      if (!flag('intro.done')) {
        void opening();
        return;
      }
      restoreObjective();
      void (async () => {
        await ctx.say('c8.bar.return');
        if (disposed) return;
        if (ctx.hotDrinkOffered()) {
          setPrompt('ui.prompt.hotDrink', PROMPT_LINGER_MS);
          await ctx.say('c8.bar.hotDrink');
        }
      })();
    },

    onScreenEntered: (screenId) => {
      // A screen change takes the lone agent and any truck on its way with it.
      lone = null;
      entered(screenId);
    },

    onUpdate: (dtMs) => {
      const p = ctx.playerPosition();
      speed = lastPos === null || dtMs <= 0 ? 0 : (Math.hypot(p.x - lastPos.x, p.y - lastPos.y) * 1000) / dtMs;
      lastPos = p;
      stepDrive(dtMs);
      hazardWarnings(dtMs);
      sunLine(dtMs);
    },

    onTrigger: (id) => {
      switch (id) {
        case 'c8.trig.sun':
          sunLesson();
          break;
        case 'c8.trig.barred':
          void barredTrigger();
          break;
        case 'c8.trig.perimeter':
          void ctx.say('c8.perimeter.open');
          if (!stealthDone()) ctx.setObjective(OBJ.perimeter);
          break;
        case 'c8.trig.junctions':
          if (stealthDone() || puzzleDone()) junctionsIntro();
          break;
        case 'c8.trig.fence':
          void startFence();
          break;
        case 'c8.trig.gate':
          if (!bossDone()) ctx.setObjective(boardDone() ? OBJ.pruitt : OBJ.board);
          break;
        case 'c8.trig.pruitt':
          if (boardDone() && !bossDone() && ctx.boss(BOSS)?.active !== true && !pruittStarting) void pruittArrives();
          break;
        case 'c8.trig.closing':
          void closing();
          break;
      }
    },

    onExamine: (id) => {
      switch (id) {
        case 'c8.tea':
          tea();
          return true;
        case 'c8.attendant':
          void attendant();
          return true;
        case 'c8.clue.schedule':
          setFlag('clue.schedule');
          ctx.completeMark('c8.clue.schedule');
          roadProgress();
          return undefined;
        case 'c8.clue.car':
          setFlag('clue.car');
          ctx.completeMark('c8.clue.car');
          roadProgress();
          return undefined;
        case 'c8.clue.shift':
          // Only a finished fight puts the clipboard on the ground.
          clipboard();
          return true;
      }
      if (id.startsWith('c8.junction.')) {
        showDiagram(id.slice('c8.junction.'.length));
        linesBefore = perimeterPuzzle()?.linesOff() ?? linesBefore;
      }
      return undefined;
    },

    onSectionCompleted: (sectionId: SectionId, by) => {
      switch (sectionId) {
        case STEALTH:
          stealthStopped();
          parkMyko();
          armPuzzle();
          break;
        case PUZZLE:
          syncBoxes();
          ctx.setObjective(OBJ.fence);
          if (by !== 'myko') void ctx.say('c8.junctions.done');
          break;
        case FIGHT:
          void fenceEnded(by);
          break;
        case BOARD:
          restoreWorld();
          ctx.setObjective(OBJ.pruitt);
          if (by !== 'myko') void ctx.say('c8.board.right');
          break;
        case BOSS:
          ctx.setObjective(null);
          break;
      }
    },

    bossHooks: { [BOSS]: pruittHooks },

    debugWalk: () => {
      setFlag('intro.done');
      setFlag('perimeter.clean');
      ctx.setMykoScripted(null);
    },

    dispose: () => {
      disposed = true;
      epoch++;
      for (const off of unsubs) off();
      hidePrompt();
    },
  };
}
