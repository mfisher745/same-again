/**
 * Chapter 1 script: every beat in the spec, in order. All text is referred to
 * by ID; all numbers that matter come from `TUNING`.
 */

import { hasSequence, sequence } from '../../content/dialogue';
import type { BossHooks, ChapterContext, ChapterScript, FightHooks } from '../../systems';
import { GameEvents } from '../../core/types';
import type { ScreenAmbient } from '../../core/chapter';
import type { Kit, SectionId, SpecialSlotIndex, TextId } from '../../core/types';
import { hidePrompt, onTabOpened, openHotDrinkChoice, showPrompt, showSlotPrompt } from '../../ui/prompts';
import { BOG_LIGHTS_START, CHURCH_GATE, MACHINE_AREA, MYKO_SEAT, ROAD_DARK, TRACTOR, YARD_GATE_AREA } from './maps';

const OBJ = {
  bar: 'c1.bar',
  dympna: 'c1.dympna',
  pint: 'c1.pint',
  machine: 'c1.machine',
  leave: 'c1.leave',
  kegs: 'c1.kegs',
  chipper: 'c1.chipper',
  row: 'c1.row',
  bigTom: 'c1.bigTom',
  road: 'c1.road',
  hotDrink: 'c1.hotDrink',
  kit: 'c1.kit',
  gate: 'c1.gate',
  bins: 'c1.bins',
  hurley: 'c1.hurley',
} as const;

/**
 * Where Dympna's list has got to (flag `pub.step`):
 * 0 not at the bar, 1 at the bar, 2 talked to her, 3 drinking the pint, 4 hot drink, 5 kit, 6 fruit machine, 7 out the back.
 */
const STEP = { atBar: 1, talked: 2, drank: 3, hotDrink: 4, kit: 5, machine: 6, leave: 7 } as const;

/** Presentation only: how long a prompt may linger when nothing the player does can dismiss it. */
const PROMPT_LINGER_MS = 7000;
/** Presentation only: the sighting. The lights drift west over the bog, then sink behind the hill. */
const LIGHTS_DRIFT_MS = 8000;
const LIGHTS_SINK_MS = 4000;
const LIGHTS_DRIFT_TILES = 6;
const LIGHTS_SINK_TILES = 5;
const LIGHTS_TICK_MS = 100;

type Flag =
  | 'pub.step'
  | 'intro.done'
  | 'machine.intro'
  | 'yard.told'
  | 'street.seen'
  | 'chipper.started'
  | 'call.done'
  | 'boss.started'
  | 'jacket.on'
  | 'road.before'
  | 'road.done';

const inRect = (p: { x: number; y: number }, a: { x: number; y: number; width: number; height: number }): boolean =>
  p.x >= a.x && p.x < a.x + a.width && p.y >= a.y && p.y < a.y + a.height;

const inTiles = (c: { col: number; row: number; width: number; height: number }, col: number, row: number): boolean =>
  col >= c.col && col < c.col + c.width && row >= c.row && row < c.row + c.height;

export function createChapterScript(ctx: ChapterContext): ChapterScript {
  let disposed = false;
  let clock = 0;
  const unsubs: Array<() => void> = [];
  const timers: Array<{ at: number; run: () => void }> = [];
  let lightsTimer: ReturnType<typeof setInterval> | null = null;
  /** The kit as the last `kit:changed` reported it. Null until something changes it. */
  let kit: Kit | null = null;
  /** Andrew's drunk level, 0 to 4. He starts every chapter at the bottom of Grand. */
  let level = 2;

  const flag = (key: Flag): boolean => ctx.flag(key) === true;
  const setFlag = (key: Flag, value = true): void => ctx.setFlag(key, value);
  const step = (): number => Number(ctx.flag('pub.step') ?? 0);
  const setStep = (n: number): void => ctx.setFlag('pub.step', n);
  const after = (ms: number, run: () => void): void => void timers.push({ at: clock + ms, run });
  const gateOpen = (): boolean => ctx.isComplete('c1.explore.yard');
  const hasHurley = (): boolean => ctx.kit().weapons.includes('hurley');
  /** The east road opens for Big Tom beaten and the hurley in hand; the exit's own boss lock is replaced by this. */
  const syncEastExit = (): void => ctx.setExitLocked('c1.street.east', !(ctx.isComplete('c1.boss.bigtom') && hasHurley()));

  // --- Tutorial prompts: one at a time, never over a scene, gone when the player has done the thing ---

  let wanted: { id: TextId; slot?: SpecialSlotIndex } | null = null;
  let scenesOpen = 0;
  let moveFrom: { x: number; y: number } | null = null;
  const sync = (): void => {
    if (wanted !== null && scenesOpen === 0) {
      if (wanted.slot !== undefined) showSlotPrompt(wanted.slot);
      else showPrompt(wanted.id);
    } else hidePrompt();
  };
  const setPrompt = (id: TextId, lingerMs?: number, slot?: SpecialSlotIndex): void => {
    wanted = slot === undefined ? { id } : { id, slot };
    moveFrom = id === 'ui.prompt.move' ? { ...ctx.playerPosition() } : null;
    sync();
    if (lingerMs !== undefined) after(lingerMs, () => clearPrompt(id));
  };
  const clearPrompt = (id?: TextId): void => {
    if (id !== undefined && wanted?.id !== id) return;
    wanted = null;
    moveFrom = null;
    sync();
  };

  /** The objective Andrew should have, from what has happened so far. */
  const restoreObjective = (): void => {
    if (ctx.isComplete('c1.boss.bigtom')) ctx.setObjective(hasHurley() ? OBJ.road : OBJ.hurley);
    else if (ctx.isComplete('c1.fight.chipper')) ctx.setObjective(OBJ.bigTom);
    else if (flag('chipper.started')) ctx.setObjective(OBJ.row);
    else if (gateOpen()) ctx.setObjective(OBJ.chipper);
    else if (ctx.isComplete('c1.puzzle.kegs')) ctx.setObjective(OBJ.gate);
    else if (flag('yard.told')) ctx.setObjective(OBJ.kegs);
    else if (step() >= STEP.leave) ctx.setObjective(OBJ.leave);
    else if (step() === STEP.machine) ctx.setObjective(OBJ.machine);
    else if (step() === STEP.kit) ctx.setObjective(OBJ.kit);
    else if (step() === STEP.hotDrink) ctx.setObjective(OBJ.hotDrink);
    else if (step() >= STEP.talked) ctx.setObjective(OBJ.pint);
    else if (step() === STEP.atBar) ctx.setObjective(OBJ.dympna);
    else if (flag('intro.done')) ctx.setObjective(OBJ.bar);
  };

  /** Run-time dressing and locks are not saved. Put them back from what is finished. */
  const restoreWorld = (): void => {
    ctx.setExitLocked('c1.pub.backdoor', step() < STEP.leave);
    ctx.setPropVisible('yardGate', !gateOpen());
    ctx.setPropVisible('jacket', false);
    syncEastExit();
    ctx.setPropVisible('hurley', ctx.isComplete('c1.boss.bigtom') && !hasHurley());
    // The lad who took the last spice bag stays in the queue until the row starts.
    ctx.setNpcVisible('queue3', !flag('chipper.started'));
  };

  // --- Pub ----------------------------------------------------------------

  const opening = async (): Promise<void> => {
    // The title card plays over the first scene, not before it.
    void ctx.say('c1.caption.title');
    await ctx.say('c1.pub.open');
    if (disposed) return;
    setFlag('intro.done');
    ctx.setObjective(OBJ.bar);
    setPrompt('ui.prompt.move');
    void ctx.say('c1.caption.pub');
  };

  const reachedBar = async (): Promise<void> => {
    setStep(STEP.atBar);
    clearPrompt('ui.prompt.move');
    await ctx.say('c1.pub.stool');
    if (disposed) return;
    ctx.setObjective(OBJ.dympna);
  };

  const talkedToDympna = async (): Promise<void> => {
    setStep(STEP.talked);
    await ctx.say('c1.pub.thursday');
    await ctx.say('c1.pub.pint');
    if (disposed) return;
    ctx.give({ kind: 'drink', drinkId: 'stout', count: 1 });
    ctx.setObjective(OBJ.pint);
    setPrompt('ui.prompt.drink');
  };

  const drankThePint = async (): Promise<void> => {
    clearPrompt('ui.prompt.drink');
    await ctx.say('c1.pub.buzz');
    if (disposed) return;
    // Item four: the hot drink, the one thing that is not on the slate.
    setStep(STEP.hotDrink);
    ctx.setObjective(OBJ.hotDrink);
    setPrompt('ui.prompt.hotDrink');
    await ctx.say('c1.pub.hotDrink');
  };

  /** The hot drink is in the kit: now the kit itself. One stout in the drink slot and two bottles. */
  const tookTheHotDrink = async (): Promise<void> => {
    setStep(STEP.kit);
    clearPrompt('ui.prompt.hotDrink');
    ctx.give({ kind: 'drink', drinkId: 'stout', count: 1 });
    ctx.setObjective(OBJ.kit);
    setPrompt('ui.prompt.kit');
    await ctx.say('c1.pub.kit');
  };

  const openedTheKit = async (): Promise<void> => {
    setStep(STEP.machine);
    clearPrompt('ui.prompt.kit');
    await ctx.say('c1.pub.listEnd');
    if (disposed) return;
    ctx.setObjective(OBJ.machine);
  };

  const machineIntro = async (): Promise<void> => {
    setFlag('machine.intro');
    await ctx.say('c1.machine.intro');
    if (disposed) return;
    setPrompt('ui.prompt.punch');
  };

  const machinePays = async (): Promise<void> => {
    setStep(STEP.leave);
    clearPrompt('ui.prompt.punch');
    await ctx.say('c1.machine.payout');
    await ctx.say('c1.lockin.door');
    if (disposed) return;
    ctx.setExitLocked('c1.pub.backdoor', false);
    ctx.setObjective(OBJ.leave);
  };

  /** The free hot drink, from the urn. Only once Dympna has got to it on the list, or on any later visit. */
  const urn = (): void => {
    if (step() < STEP.hotDrink) return;
    if (ctx.hotDrinkOffered()) openHotDrinkChoice();
  };

  // --- Yard and street ----------------------------------------------------

  const enteredPub = (): void => {
    // Myko sits at the corner table, apart from everyone, until Andrew leaves.
    ctx.setMykoScripted(MYKO_SEAT);
    restoreObjective();
  };

  const enteredYard = (): void => {
    clearPrompt();
    ctx.setMykoScripted(null);
    // The first time he leaves the pub the drain is released, and it is never held again.
    ctx.holdDrain(false);
    ctx.setPropVisible('yardGate', !gateOpen());
    ctx.completeSection('c1.explore.pub');
    if (ctx.isComplete('c1.puzzle.kegs')) {
      restoreObjective();
      return;
    }
    ctx.startSection('c1.puzzle.kegs');
    ctx.setObjective(OBJ.kegs);
    if (!flag('yard.told')) {
      setFlag('yard.told');
      void ctx.say('c1.yard.kegs');
    }
    setPrompt('ui.prompt.push', PROMPT_LINGER_MS);
  };

  /** The kegs are clear. The gate is stuck, and the move that shifts it goes into slot 1. */
  const kegsCleared = async (): Promise<void> => {
    clearPrompt('ui.prompt.push');
    ctx.setObjective(OBJ.gate);
    await ctx.say('c1.yard.done');
    await ctx.say('c1.shoulder.lesson');
    if (disposed) return;
    ctx.learnMove('shoulder');
    if (!gateOpen()) setPrompt('ui.prompt.slot', undefined, 1);
  };

  const gateShoved = async (): Promise<void> => {
    clearPrompt('ui.prompt.slot');
    ctx.setPropVisible('yardGate', false);
    ctx.setObjective(OBJ.chipper);
    // Finishing the section is what keeps the gate open after a return to the bar.
    ctx.completeSection('c1.explore.yard');
    await ctx.say('c1.shoulder.done');
  };

  const enteredStreet = (): void => {
    clearPrompt();
    ctx.setMykoScripted(null);
    if (flag('street.seen')) {
      restoreObjective();
      return;
    }
    setFlag('street.seen');
    void ctx.say('c1.caption.street');
    ctx.setObjective(OBJ.chipper);
  };

  /** Bins across the alley mouth, a whiskey behind them. A bottle goes where the player aims it. */
  const binsAhead = async (): Promise<void> => {
    if (flag('chipper.started')) return;
    ctx.setObjective(OBJ.bins);
    setPrompt('ui.prompt.throw', PROMPT_LINGER_MS);
    await ctx.say('c1.throw.lesson');
  };

  const binsBroken = (): void => {
    clearPrompt('ui.prompt.throw');
    if (ctx.objective() === OBJ.bins) ctx.setObjective(OBJ.chipper);
  };

  const chipperRow = async (): Promise<void> => {
    setFlag('chipper.started');
    clearPrompt('ui.prompt.throw');
    await ctx.say('c1.chipper.intro');
    if (disposed) return;
    ctx.completeSection('c1.explore.street');
    ctx.setObjective(OBJ.row);
    // The lad who took the last spice bag steps out of the queue and into the fight.
    ctx.setNpcVisible('queue3', false);
    ctx.startSection('c1.fight.chipper');
  };

  /** Stout Slam, taught before the pair arrive. It works from Grand up. */
  const slamLesson = async (): Promise<void> => {
    await ctx.say('c1.slam.lesson');
    if (disposed) return;
    ctx.learnMove('stoutSlam');
    if (level < 2) void ctx.say('c1.slam.needDrink');
    else setPrompt('ui.prompt.slot', PROMPT_LINGER_MS, 2);
    void ctx.say('c1.chipper.wave2');
  };

  const atCall = async (): Promise<void> => {
    setFlag('call.done');
    await ctx.say('c1.call.prompt');
    if (disposed) return;
    setPrompt('ui.prompt.callMyko', PROMPT_LINGER_MS);
  };

  const bigTomArrives = async (): Promise<void> => {
    setFlag('boss.started');
    clearPrompt();
    await ctx.say('c1.bigTom.intro');
    if (disposed) return;
    ctx.setObjective(OBJ.bigTom);
    ctx.startSection('c1.boss.bigtom');
  };

  /** Tom has sat down. His hurley is against the tractor, and he has asked Andrew to mind it. */
  const hurleyLeft = async (): Promise<void> => {
    await ctx.say('c1.bigTom.end');
    if (disposed) return;
    ctx.setPropVisible('hurley', true);
    ctx.setObjective(OBJ.hurley);
  };

  const takeHurley = async (): Promise<void> => {
    ctx.setPropVisible('hurley', false);
    ctx.gainWeapon('hurley');
    syncEastExit();
    ctx.setObjective(OBJ.road);
    setPrompt('ui.prompt.weapon', PROMPT_LINGER_MS);
    await ctx.say('c1.weapon.hurley');
  };

  // --- Bog road -----------------------------------------------------------

  const stopLights = (): void => {
    if (lightsTimer !== null) clearInterval(lightsTimer);
    lightsTimer = null;
  };

  /** Three lights over the bog: drift, sink behind the hill, and take their glow with them. */
  const lightsAppear = (): void => {
    ctx.setPropVisible('bogLights', true);
    const t0 = performance.now();
    stopLights();
    lightsTimer = setInterval(() => {
      const t = performance.now() - t0;
      const drift = Math.min(1, t / LIGHTS_DRIFT_MS);
      const sink = Math.max(0, Math.min(1, (t - LIGHTS_DRIFT_MS) / LIGHTS_SINK_MS));
      const col = Math.round(BOG_LIGHTS_START.col - LIGHTS_DRIFT_TILES * drift);
      const row = Math.round(BOG_LIGHTS_START.row + LIGHTS_SINK_TILES * sink);
      if (sink >= 1) {
        ctx.setPropVisible('bogLights', false);
        ctx.setAmbient(ROAD_DARK, 'c1.road');
        stopLights();
        return;
      }
      ctx.setPropTile('bogLights', col, row);
      const glow: ScreenAmbient = { ...ROAD_DARK, lights: [{ x: (col + 1.5) * 16, y: (row + 0.5) * 16, radius: 72, colour: 'fluoro' }] };
      ctx.setAmbient(glow, 'c1.road');
    }, LIGHTS_TICK_MS);
  };

  const enteredRoad = async (): Promise<void> => {
    clearPrompt();
    ctx.setMykoScripted(null);
    if (flag('road.before')) return;
    setFlag('road.before');
    ctx.setObjective(OBJ.road);
    void ctx.say('c1.caption.road');
    await ctx.say('c1.lights.before');
  };

  const theLights = async (): Promise<void> => {
    setFlag('road.done');
    lightsAppear();
    await ctx.say('c1.lights.seen');
    await ctx.say('c1.closing');
    if (disposed) return;
    stopLights();
    ctx.completeSection('c1.explore.road');
    ctx.completeChapter();
  };

  // --- Hooks --------------------------------------------------------------

  const fightHooks: FightHooks = {
    onWaveCleared: (index) => {
      if (index === 0) void slamLesson();
    },
  };

  const bigTomHooks: BossHooks = {
    onStart: () => {
      // A fresh attempt: jacket back on.
      setFlag('jacket.on', false);
      ctx.setPropVisible('jacket', false);
    },
    onChargeBlocked: (boss, body, col, row) => {
      if (!inTiles(TRACTOR, col, row) && !inTiles(CHURCH_GATE, col, row)) return;
      boss.daze(body.tag);
      void ctx.say('c1.bigTom.dazed');
    },
    onPhaseChanged: (boss, phase) => {
      if (phase.id !== 'jacketOff') return;
      boss.setSprite('bigtom', 'boss.c1.boss.bigtom.jacketOff');
      setFlag('jacket.on');
      ctx.setPropVisible('jacket', true);
      void ctx.say('c1.bigTom.phase2');
    },
    onEnd: () => void hurleyLeft(),
  };

  return {
    onStart: () => {
      // A fresh game only: both flags are saved, so a load or a return to the bar leaves them as they were.
      if (step() === 0 && !flag('intro.done')) {
        ctx.setMeterHidden(true);
        ctx.holdDrain(true);
      }
      restoreWorld();
      // Run-time dressing state is not saved; put it back from flags.
      if (flag('jacket.on')) ctx.setPropVisible('jacket', true);
      if (ctx.currentScreen() === 'c1.pub') ctx.setMykoScripted(MYKO_SEAT);
      unsubs.push(
        ctx.onMeleeHit(
          MACHINE_AREA,
          (hit) => {
            if (hit.haymaker && step() === STEP.machine && flag('machine.intro')) void machinePays();
          },
          'c1.pub',
        ),
        onTabOpened(() => {
          if (step() === STEP.kit) void openedTheKit();
        }),
        ctx.bus.on(GameEvents.KitChanged, ({ kit: next }) => {
          const hadHot = kit?.hotDrink ?? null;
          kit = next;
          if (step() === STEP.hotDrink && hadHot === null && next.hotDrink !== null) void tookTheHotDrink();
        }),
        ctx.bus.on(GameEvents.WeaponGained, () => syncEastExit()),
        ctx.bus.on(GameEvents.BuzzLevelChanged, ({ to }) => {
          level = to;
        }),
        ctx.bus.on(GameEvents.DrinkConsumed, () => {
          clearPrompt('ui.prompt.drink');
          if (step() === STEP.talked) {
            ctx.setMeterHidden(false);
            setStep(STEP.drank);
            after(900, () => void drankThePint());
          }
        }),
        ctx.bus.on(GameEvents.MoveUsed, ({ moveId, slot }) => {
          if (moveId === 'shoulder') {
            clearPrompt('ui.prompt.slot');
            if (!gateOpen() && ctx.isComplete('c1.puzzle.kegs') && inRect(ctx.playerPosition(), YARD_GATE_AREA)) void gateShoved();
          } else if (moveId === 'stoutSlam' && slot === 2) clearPrompt('ui.prompt.slot');
        }),
        ctx.bus.on(GameEvents.PropBroken, ({ propId }) => {
          if (propId.startsWith('bins')) binsBroken();
        }),
        // The first hit Andrew takes in the row brings Myko's line on what a hit does to the meter.
        ctx.bus.on(GameEvents.PlayerHit, () => {
          if (flag('chipper.started') && !flag('boss.started')) void ctx.say('c1.hit.lesson');
        }),
        ctx.bus.on(GameEvents.MykoCallStarted, () => clearPrompt('ui.prompt.callMyko')),
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
      if (step() === 0 && !flag('intro.done')) void opening();
      else restoreObjective();
    },

    /**
     * Andrew is back in the bar (the run has released Myko just before this). Flags are what the last save held, the
     * unfinished section has started over, and Buzz is at the bottom of Grand. Dympna does not look up.
     */
    onBarReturn: () => {
      level = 2;
      scenesOpen = 0;
      clearPrompt();
      restoreWorld();
      ctx.setMykoScripted(MYKO_SEAT);
      if (step() === 0 && !flag('intro.done')) {
        void opening();
        return;
      }
      restoreObjective();
      void (async () => {
        await ctx.say('c1.bar.return');
        if (disposed) return;
        if (ctx.hotDrinkOffered()) {
          setPrompt('ui.prompt.hotDrink', PROMPT_LINGER_MS);
          await ctx.say('c1.bar.hotDrink');
        }
      })();
    },

    onScreenEntered: (screenId) => {
      if (screenId === 'c1.pub') enteredPub();
      else if (screenId === 'c1.yard') enteredYard();
      else if (screenId === 'c1.street') enteredStreet();
      else if (screenId === 'c1.road') void enteredRoad();
    },

    onTrigger: (id) => {
      switch (id) {
        case 'c1.trig.bar':
          if (step() === 0 && flag('intro.done')) void reachedBar();
          break;
        case 'c1.trig.machine':
          if (step() === STEP.machine && !flag('machine.intro')) void machineIntro();
          break;
        case 'c1.trig.bins':
          if (!flag('chipper.started')) void binsAhead();
          break;
        case 'c1.trig.chipper':
          if (!flag('chipper.started')) void chipperRow();
          break;
        case 'c1.trig.call':
          if (ctx.isComplete('c1.fight.chipper') && !flag('call.done')) void atCall();
          break;
        case 'c1.trig.boss':
          if (ctx.isComplete('c1.fight.chipper') && !flag('boss.started') && !ctx.isComplete('c1.boss.bigtom')) void bigTomArrives();
          break;
        case 'c1.trig.eastexit':
          // Locked for want of the hurley only: Big Tom is down. The trigger fires once per approach.
          if (ctx.isComplete('c1.boss.bigtom') && !hasHurley()) void ctx.say('c1.exit.needHurley', { repeat: true });
          break;
        case 'c1.trig.lights':
          if (flag('road.before') && !flag('road.done')) void theLights();
          break;
      }
    },

    onExamine: (id) => {
      if (id === 'c1.dympna') {
        if (step() === STEP.atBar) void talkedToDympna();
        return true;
      }
      if (id === 'c1.urn') {
        urn();
        return true;
      }
      if (id === 'c1.hurley') {
        if (ctx.isComplete('c1.boss.bigtom') && !hasHurley()) void takeHurley();
        return true;
      }
      return undefined;
    },

    onSectionCompleted: (sectionId: SectionId) => {
      if (sectionId === 'c1.puzzle.kegs') void kegsCleared();
      else if (sectionId === 'c1.fight.chipper') {
        void ctx.say('c1.chipper.end');
        ctx.setObjective(OBJ.bigTom);
      }
    },

    onUpdate: (dtMs) => {
      clock += dtMs;
      if (moveFrom !== null) {
        const p = ctx.playerPosition();
        if (Math.hypot(p.x - moveFrom.x, p.y - moveFrom.y) > 3) clearPrompt('ui.prompt.move');
      }
      for (let i = timers.length - 1; i >= 0; i--) {
        const t = timers[i];
        if (t && t.at <= clock) {
          timers.splice(i, 1);
          t.run();
        }
      }
    },

    fightHooks: { 'c1.fight.chipper': fightHooks },
    bossHooks: { 'c1.boss.bigtom': bigTomHooks },

    debugWalk: () => {
      setStep(STEP.leave);
      ctx.setMykoScripted(null);
    },

    dispose: () => {
      disposed = true;
      stopLights();
      for (const off of unsubs) off();
      hidePrompt();
    },
  };
}
