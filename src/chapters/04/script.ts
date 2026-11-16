/**
 * Chapter 4 script: every beat in docs/chapters/04-southie.md, in order. All text
 * is referred to by ID; the foreman's and the brawl's numbers come from `TUNING`.
 */

import { PROP } from '../../art/props';
import { hasSequence, sequence } from '../../content/dialogue';
import { TUNING } from '../../content/tuning';
import type { BossHooks, ChapterContext, ChapterScript, FightHooks } from '../../systems';
import { GameEvents } from '../../core/types';
import type { AttackDef, SectionId, SpecialSlotIndex, TextId } from '../../core/types';
import { hidePrompt, showPrompt, showSlotPrompt } from '../../ui/prompts';
import { BOX_REACH_PX, CRANE_LANES, DAWN, DOCKER_ADDS, FOREMAN_PIN, GATE_SEAT, LUNCHBOX_PICKUP, MYKO_CHAIR, PATRON_TILES, RAILS, T } from './maps';

const OBJ = {
  bar: 'c4.bar',
  manner: 'c4.manner',
  brawl: 'c4.brawl',
  docks: 'c4.docks',
  containers: 'c4.containers',
  board: 'c4.board',
  foreman: 'c4.foreman',
} as const;

/** Presentation only: how long a prompt may linger when nothing the player does can dismiss it. */
const PROMPT_LINGER_MS = 7000;
/** Within this of Kev (px), Bedside Manner counts as said to him. */
const MANNER_REACH_PX = 96;
/** The crane's timings (`TUNING.overhaul.crane`): a pass, the slow pass on foot, the gap before it, the first sweep. */
const CRANE = TUNING.overhaul?.crane ?? { travelMs: 900, slowTravelMs: 2600, slowDelayMs: 3000, firstMs: 1500 };
const CRANE_TRAVEL_MS = CRANE.travelMs;
const CRANE_SLOW_TRAVEL_MS = CRANE.slowTravelMs;
const CRANE_SLOW_DELAY_MS = CRANE.slowDelayMs;
const CRANE_FIRST_MS = CRANE.firstMs;
/** Top and bottom of a crane lane (tiles). */
const LANE_FROM_ROW = 14;
const LANE_TO_ROW = 27;

type Flag =
  | 'intro.done'
  | 'talked.doug'
  | 'talked.barb'
  | 'talked.kev'
  | 'talked.sully'
  | 'clue.roster'
  | 'manner.ready'
  | 'manner.taught'
  | 'manner.done'
  | 'docks.seen'
  | 'docks.clean'
  | 'lunchbox.taken'
  | 'puzzle.intro'
  | 'inside.seen'
  | 'clue.seizure'
  | 'foreman.started'
  | 'foreman.done'
  | 'shillelagh.taken'
  | 'tea.served';

const PATRONS = ['doug', 'barb', 'kev', 'sully'] as const;

export function createChapterScript(ctx: ChapterContext): ChapterScript {
  let disposed = false;
  const unsubs: Array<() => void> = [];
  /** Bumped when the foreman fight starts or is cancelled, so an old crane loop stops. */
  let craneRun = 0;
  let foremanPhaseTwo = false;
  let ending = false;

  const flag = (key: Flag): boolean => ctx.flag(key) === true;
  const setFlag = (key: Flag, value = true): void => ctx.setFlag(key, value);

  // --- Tutorial prompts: one at a time, never over a scene ---

  let wanted: { id: TextId; slot?: SpecialSlotIndex } | null = null;
  let scenesOpen = 0;
  const sync = (): void => {
    if (wanted !== null && scenesOpen === 0) {
      if (wanted.slot !== undefined) showSlotPrompt(wanted.slot);
      else showPrompt(wanted.id);
    } else hidePrompt();
  };
  const setPrompt = (id: TextId, lingerMs?: number, slot?: SpecialSlotIndex): void => {
    wanted = slot === undefined ? { id } : { id, slot };
    sync();
    if (lingerMs !== undefined) ctx.after(lingerMs, () => clearPrompt(id));
  };
  const clearPrompt = (id?: TextId): void => {
    if (id !== undefined && wanted?.id !== id) return;
    wanted = null;
    sync();
  };

  const patronsAllTalked = (): boolean => PATRONS.every((p) => flag(`talked.${p}`));

  /** The objective Andrew should have, from what has happened so far. */
  const restoreObjective = (): void => {
    if (ctx.isComplete('c4.boss.foreman')) ctx.setObjective(null);
    else if (ctx.isComplete('c4.deduction.dc')) ctx.setObjective(OBJ.foreman);
    else if (ctx.isComplete('c4.explore.container') || flag('clue.seizure')) ctx.setObjective(OBJ.board);
    else if (ctx.isComplete('c4.stealth.docks')) ctx.setObjective(OBJ.containers);
    else if (ctx.isComplete('c4.fight.brawl')) ctx.setObjective(OBJ.docks);
    else if (flag('manner.done')) ctx.setObjective(OBJ.brawl);
    else if (flag('manner.ready')) ctx.setObjective(OBJ.manner);
    else if (flag('intro.done')) ctx.setObjective(OBJ.bar);
  };

  const syncSteam = (): void => ctx.setPropVisible('bar.steam', ctx.hotDrinkOffered());

  /** Run-time dressing and locks are not saved. Put them back from what is finished. */
  const restoreWorld = (): void => {
    ctx.setExitLocked('c4.bar.backdoor', !ctx.isComplete('c4.fight.brawl'));
    const gone = ctx.isComplete('c4.fight.brawl') || flag('manner.done');
    ctx.setNpcVisible('doug', !gone);
    ctx.setNpcVisible('kev', !gone);
    ctx.setPropVisible('dockGate', !ctx.isComplete('c4.stealth.docks'));
    ctx.setPropVisible('lunchbox', !flag('lunchbox.taken'));
    const solved = ctx.isComplete('c4.puzzle.containers');
    ctx.setPropVisible('hatch.0', !solved);
    ctx.setPropVisible('hatch.1', !solved);
    ctx.setPropVisible('shillelagh', flag('foreman.done') && !flag('shillelagh.taken'));
    syncSteam();
    if (flag('docks.clean') && !flag('lunchbox.taken')) placeLunchboxWhiskey();
  };

  const placeLunchboxWhiskey = (): void => {
    ctx.spawnPickup({ id: 'c4.pickup.lunchbox', item: { kind: 'drink', drinkId: 'whiskey', count: 1 }, screenId: 'c4.docks', position: LUNCHBOX_PICKUP });
  };

  // --- The bar ---------------------------------------------------------------

  const opening = async (): Promise<void> => {
    // The title card and the airport caption play over the first scene, not before it.
    void ctx.say('c4.caption.title');
    void ctx.say('c4.caption.airport');
    await ctx.say('c4.bar.open');
    if (disposed) return;
    setFlag('intro.done');
    ctx.setObjective(OBJ.bar);
    void ctx.say('c4.caption.bar');
    if (ctx.hotDrinkOffered()) setPrompt('ui.prompt.hotDrink', PROMPT_LINGER_MS);
  };

  let teaBusy = false;
  /** E at the tea. Colleen-Ann asks hot or iced, and it is always hot. One free tea each visit. */
  let teaLineOpen = false;
  const tea = async (): Promise<void> => {
    if (teaBusy) return;
    if (!ctx.hotDrinkOffered()) {
      // None to give: she says why, once at a time however often E is pressed.
      if (teaLineOpen) return;
      teaLineOpen = true;
      void ctx.say(ctx.kit().hotDrink !== null ? 'c4.tea.held' : 'c4.tea.spent', { repeat: true }).finally(() => {
        teaLineOpen = false;
      });
      return;
    }
    teaBusy = true;
    clearPrompt('ui.prompt.hotDrink');
    ctx.completeMark('c4.tea');
    if (!flag('tea.served')) {
      setFlag('tea.served');
      await ctx.say('c4.bar.tea');
    }
    teaBusy = false;
    if (disposed) return;
    ctx.takeHotDrink('tea');
    void ctx.say('c4.bar.hotDrink');
  };

  const checkReady = (): void => {
    if (flag('manner.ready') || !patronsAllTalked() || !flag('clue.roster')) return;
    setFlag('manner.ready');
    ctx.completeSection('c4.explore.bar');
    ctx.setObjective(OBJ.manner);
  };

  const talk = async (who: (typeof PATRONS)[number]): Promise<void> => {
    setFlag(`talked.${who}`);
    await ctx.say(`c4.bar.${who}`);
    if (disposed) return;
    // Sully's jacket: the patch is on it, and the same mark as on the fragment.
    if (who === 'sully') ctx.addEvidence('c4.clue.patch');
    checkReady();
  };

  const roster = (): void => {
    setFlag('clue.roster');
    ctx.completeMark('c4.roster');
    ctx.addEvidence('c4.clue.roster');
    checkReady();
  };

  const stoutPint = async (): Promise<void> => {
    ctx.addEvidence('c4.clue.stout');
    await ctx.say('c4.bar.stout');
  };

  // --- Bedside Manner and the brawl -------------------------------------------

  const mannerLesson = async (): Promise<void> => {
    setFlag('manner.taught');
    await ctx.say('c4.manner.lesson');
    if (disposed) return;
    ctx.learnMove('bedsideManner');
    setPrompt('ui.prompt.kit', PROMPT_LINGER_MS);
  };

  const startBrawl = (): void => {
    ctx.setNpcVisible('doug', false);
    ctx.setNpcVisible('kev', false);
    ctx.setObjective(OBJ.brawl);
    ctx.startSection('c4.fight.brawl');
  };

  const mannerDone = async (): Promise<void> => {
    setFlag('manner.done');
    clearPrompt();
    await ctx.say('c4.manner.done');
    if (disposed) return;
    startBrawl();
  };

  /** Colleen-Ann throws one between waves: it lands at his feet. */
  const colleenThrows = (n: number): void => {
    const at = ctx.playerPosition();
    ctx.spawnPickup({ id: `reward.c4.brawl.stout${n}`, item: { kind: 'drink', drinkId: 'stout', count: 1 }, screenId: 'c4.bar', position: at });
  };

  const brawlHooks: FightHooks = {
    onWaveCleared: (index) => {
      if (index === 0) {
        colleenThrows(1);
        void ctx.say('c4.brawl.wave2');
      } else if (index === 1) {
        colleenThrows(2);
        void ctx.say('c4.brawl.wave3');
      }
    },
  };

  // --- The docks ---------------------------------------------------------------

  const enteredDocks = (): void => {
    clearPrompt();
    ctx.setMykoScripted(ctx.isComplete('c4.stealth.docks') ? null : GATE_SEAT);
    restoreWorld();
    restoreObjective();
    if (!flag('docks.seen')) {
      setFlag('docks.seen');
      void ctx.say('c4.caption.docks');
      void ctx.say('c4.docks.open');
    }
  };

  const enteredBar = (): void => {
    clearPrompt();
    ctx.setMykoScripted(MYKO_CHAIR);
    restoreWorld();
    restoreObjective();
  };

  const stealthActive = (): boolean => ctx.currentScreen() === 'c4.docks' && !ctx.isComplete('c4.stealth.docks');

  const puzzleDone = async (): Promise<void> => {
    ctx.setPropVisible('hatch.0', false);
    ctx.setPropVisible('hatch.1', false);
    await ctx.say('c4.containers.done');
  };

  const seizure = (): void => {
    setFlag('clue.seizure');
    ctx.completeMark('c4.seizure');
    ctx.addEvidence('c4.clue.seizure');
    ctx.completeSection('c4.explore.container');
    if (!ctx.isComplete('c4.deduction.dc')) {
      ctx.setObjective(OBJ.board);
      ctx.openDeduction();
    }
  };

  // --- The foreman -------------------------------------------------------------

  const swing = (): AttackDef | undefined => TUNING.bosses['c4.boss.foreman']?.phases[0]?.attacks.find((a) => a.id === 'containerSwing');

  /** One pass of the crane: the shadow lies along the lane first, then the container comes down it. */
  const sweepLane = async (lane: number, travelMs: number): Promise<void> => {
    const a = swing();
    if (!a || a.shape.kind !== 'charge') return;
    await ctx.sweepHazard({
      from: T(lane, LANE_FROM_ROW),
      to: T(lane, LANE_TO_ROW),
      width: a.shape.width,
      telegraphMs: a.telegraphMs,
      travelMs,
      weight: a.weight ?? 'heavy',
      knockback: a.knockback,
      frame: PROP.craneContainer.box,
      shadowFrame: PROP.craneContainer.shadow,
    });
  };

  /** Phase 1: a pass every `cooldownMs` across a lane chosen in turn, until the foreman is off his box. */
  const craneLoop = (run: number, n: number): void => {
    if (disposed || run !== craneRun || foremanPhaseTwo) return;
    const a = swing();
    const lane = CRANE_LANES[n % CRANE_LANES.length] ?? CRANE_LANES[0];
    void sweepLane(lane, CRANE_TRAVEL_MS).then(() => {
      if (disposed || run !== craneRun || foremanPhaseTwo) return;
      ctx.after(a?.cooldownMs ?? 5000, () => craneLoop(run, n + 1));
    });
  };

  const nearBox = (): boolean => {
    const p = ctx.playerPosition();
    return Math.hypot(p.x - FOREMAN_PIN.x, p.y - FOREMAN_PIN.y) <= BOX_REACH_PX;
  };

  const foremanArrives = async (): Promise<void> => {
    setFlag('foreman.started');
    await ctx.say('c4.foreman.intro');
    if (disposed) return;
    ctx.setObjective(OBJ.foreman);
    ctx.startSection('c4.boss.foreman');
  };

  const foremanHooks: BossHooks = {
    onStart: (boss) => {
      foremanPhaseTwo = false;
      craneRun++;
      boss.pin('foreman', FOREMAN_PIN);
      for (const at of DOCKER_ADDS) boss.spawnAdd('docker', at);
      const run = craneRun;
      ctx.after(CRANE_FIRST_MS, () => craneLoop(run, 0));
    },
    onPhaseChanged: (boss, phase) => {
      if (phase.id !== 'onFoot') return;
      foremanPhaseTwo = true;
      boss.pin('foreman', null);
      void ctx.say('c4.foreman.phase2');
      // The crane keeps making one slow pass on its own.
      const run = craneRun;
      ctx.after(CRANE_SLOW_DELAY_MS, () => {
        if (disposed || run !== craneRun) return;
        void sweepLane(CRANE_LANES[1], CRANE_SLOW_TRAVEL_MS);
      });
    },
    onEnd: (_boss, by) => {
      craneRun++;
      void foremanEnded(by);
    },
  };

  const foremanEnded = async (by: string): Promise<void> => {
    setFlag('foreman.done');
    if (by !== 'myko') await ctx.say('c4.foreman.end');
    if (disposed) return;
    ctx.setPropVisible('shillelagh', true);
    ctx.setObjective(null);
  };

  /** The shillelagh stays on the control box. KISS ME. He takes it, and the night is over. */
  const takeShillelagh = async (): Promise<void> => {
    if (!flag('foreman.done') || flag('shillelagh.taken') || ending) return;
    ending = true;
    setFlag('shillelagh.taken');
    ctx.setPropVisible('shillelagh', false);
    ctx.gainWeapon('shillelagh');
    await ctx.say('c4.weapon.shillelagh');
    if (disposed) return;
    // A bus shelter at dawn.
    ctx.setAmbient(DAWN, 'c4.docks');
    void ctx.say('c4.caption.shelter');
    await ctx.say('c4.closing');
    if (disposed) return;
    ctx.completeChapter();
  };

  return {
    onStart: () => {
      restoreWorld();
      if (ctx.currentScreen() === 'c4.bar') ctx.setMykoScripted(MYKO_CHAIR);
      unsubs.push(
        ctx.bus.on(GameEvents.KitChanged, () => syncSteam()),
        ctx.bus.on(GameEvents.MoveUsed, ({ moveId }) => {
          const p = ctx.playerPosition();
          if (moveId === 'bedsideManner' && flag('manner.taught') && !flag('manner.done') && ctx.currentScreen() === 'c4.bar') {
            const k = T(PATRON_TILES.kev.col, PATRON_TILES.kev.row);
            if (Math.hypot(p.x - k.x, p.y - k.y) <= MANNER_REACH_PX) void mannerDone();
          } else if ((moveId === 'stoutSlam' || moveId === 'shoulder') && ctx.boss('c4.boss.foreman')?.active === true && !foremanPhaseTwo && nearBox()) {
            // Beside the control box, the Slam or the Shoulder knocks him off it.
            ctx.boss('c4.boss.foreman')?.forcePhase('onFoot');
          }
        }),
        ctx.bus.on(GameEvents.PickupCollected, ({ pickupId }) => {
          if (pickupId === 'c4.pickup.lunchbox') {
            setFlag('lunchbox.taken');
            ctx.setPropVisible('lunchbox', false);
          }
        }),
        ctx.bus.on(GameEvents.SlidePulled, () => {
          for (const r of RAILS) ctx.completeMark(r.examinableId);
        }),
        ctx.bus.on(GameEvents.StealthAlarm, ({ sectionId }) => {
          if (sectionId === 'c4.stealth.docks') void ctx.say('c4.docks.caught');
        }),
        ctx.bus.on(GameEvents.StealthCleanRun, ({ sectionId }) => {
          if (sectionId !== 'c4.stealth.docks') return;
          setFlag('docks.clean');
          placeLunchboxWhiskey();
          void ctx.say('c4.docks.clean');
        }),
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
      if (!flag('intro.done')) void opening();
      else restoreObjective();
    },

    /** Andrew is back at the bar. Flags are what the last save held and the unfinished section has started over. */
    onBarReturn: () => {
      scenesOpen = 0;
      craneRun++;
      foremanPhaseTwo = false;
      clearPrompt();
      restoreWorld();
      ctx.setMykoScripted(MYKO_CHAIR);
      if (!flag('intro.done')) {
        void opening();
        return;
      }
      restoreObjective();
      // A brawl that was under way starts again from the beginning.
      if (flag('manner.done') && !ctx.isComplete('c4.fight.brawl')) startBrawl();
      void (async () => {
        await ctx.say('c4.bar.return');
        if (disposed) return;
        if (ctx.hotDrinkOffered()) {
          setPrompt('ui.prompt.hotDrink', PROMPT_LINGER_MS);
          await ctx.say('c4.bar.hotDrink');
        }
      })();
    },

    onScreenEntered: (screenId) => {
      if (screenId === 'c4.bar') enteredBar();
      else if (screenId === 'c4.docks') enteredDocks();
    },

    onTrigger: (id) => {
      switch (id) {
        case 'c4.trig.gate':
          // The side gate is shut until the docks are passed: Myko says the way round, each approach.
          if (!ctx.isComplete('c4.stealth.docks')) void ctx.say('c4.gate.shut', { repeat: true });
          break;
        case 'c4.trig.manner':
          if (flag('manner.ready') && !flag('manner.taught')) void mannerLesson();
          break;
        case 'c4.trig.over1':
          if (stealthActive()) void ctx.say('c4.docks.overheard.1');
          break;
        case 'c4.trig.over2':
          if (stealthActive()) void ctx.say('c4.docks.overheard.2');
          break;
        case 'c4.trig.puzzle':
          if (ctx.isComplete('c4.stealth.docks') && !ctx.isComplete('c4.puzzle.containers') && !flag('puzzle.intro')) {
            setFlag('puzzle.intro');
            ctx.setObjective(OBJ.containers);
            void ctx.say('c4.containers.intro');
          }
          break;
        case 'c4.trig.inside':
          if (ctx.isComplete('c4.puzzle.containers') && !flag('inside.seen')) {
            setFlag('inside.seen');
            void ctx.say('c4.container.inside');
          }
          break;
        case 'c4.trig.foreman':
          if (ctx.isComplete('c4.deduction.dc') && !flag('foreman.started') && !ctx.isComplete('c4.boss.foreman')) void foremanArrives();
          break;
      }
    },

    onExamine: (id) => {
      switch (id) {
        case 'c4.tea':
          void tea();
          return true;
        case 'c4.colleen':
          void ctx.say('c4.bar.colleenHelp');
          return true;
        case 'c4.doug':
          void talk('doug');
          return true;
        case 'c4.barb':
          void talk('barb');
          return true;
        case 'c4.kev':
          void talk('kev');
          return true;
        case 'c4.sully':
          void talk('sully');
          return true;
        case 'c4.roster':
          roster();
          return true;
        case 'c4.stout':
          void stoutPint();
          return true;
        case 'c4.seizure':
          seizure();
          return true;
        case 'c4.foam':
          ctx.addEvidence('c4.clue.foam');
          return true;
        case 'c4.shillelagh':
          void takeShillelagh();
          return true;
      }
      return undefined;
    },

    onSectionCompleted: (sectionId: SectionId, by) => {
      if (sectionId === 'c4.fight.brawl') {
        ctx.setNpcVisible('doug', false);
        ctx.setNpcVisible('kev', false);
        ctx.setExitLocked('c4.bar.backdoor', false);
        ctx.setObjective(OBJ.docks);
        if (by !== 'myko') void ctx.say('c4.brawl.end');
      } else if (sectionId === 'c4.stealth.docks') {
        ctx.setPropVisible('dockGate', false);
        ctx.setMykoScripted(null);
        ctx.setObjective(OBJ.containers);
      } else if (sectionId === 'c4.puzzle.containers') void puzzleDone();
      else if (sectionId === 'c4.deduction.dc') {
        ctx.setObjective(OBJ.foreman);
        if (by !== 'myko') void ctx.say('c4.board.right');
      }
    },

    fightHooks: { 'c4.fight.brawl': brawlHooks },
    bossHooks: { 'c4.boss.foreman': foremanHooks },

    debugWalk: () => {
      setFlag('intro.done');
      setFlag('clue.roster');
      setFlag('docks.seen');
      ctx.setMykoScripted(null);
    },

    dispose: () => {
      disposed = true;
      craneRun++;
      for (const off of unsubs) off();
      hidePrompt();
    },
  };
}
