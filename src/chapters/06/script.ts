/**
 * Chapter 6 script: every beat in docs/chapters/06-flyover-country.md, in order. All text is referred to by ID; all
 * numbers come from `TUNING` or the systems. Nothing here guards a start with a saved "started" flag: a fight or set
 * piece begun by a trigger starts again after a load or a return to the bar because the trigger tests that it is not
 * complete and not already under way.
 */

import { hasSequence, pool, sequence } from '../../content/dialogue';
import { GameEvents } from '../../core/types';
import type { SectionId, SpecialSlotIndex, TextId } from '../../core/types';
import type { BossHooks, ChapterContext, ChapterScript, FightHooks, LoneEnemyHandle } from '../../systems';
import { hidePrompt, openHotDrinkChoice, showPrompt, showSlotPrompt } from '../../ui/prompts';
import { COOLER_SPOTS, FARM_STAND_PICKUP, LESSON_DRONE_SPAWN, MYKO_ICE, MYKO_LANE_END, TOWN_ADMIRE } from './maps';

const OBJ = {
  town: 'c6.town',
  dale: 'c6.dale',
  motel: 'c6.motel',
  fields: 'c6.fields',
  drones: 'c6.drones',
  maze: 'c6.maze',
  board: 'c6.board',
  combine: 'c6.combine',
} as const;

/** Presentation only: how long a prompt may linger when nothing the player does can dismiss it. */
const PROMPT_LINGER_MS = 7000;
/** Presentation only: a pause before an insult follows the beat that earned it, so it never lands on the line before. */
const INSULT_DELAY_MS = 3500;
/** Presentation only: a rustle heard this recently is why a guard turned to look (the corn line). */
const RUSTLE_WINDOW_MS = 1500;

type Flag =
  | 'intro.done'
  | 'coffee.seen'
  | 'town.seen'
  | 'fields.seen'
  | 'ice.seen'
  | 'clue.ledger'
  | 'clue.postcard'
  | 'clue.notice'
  | 'dale.done'
  | 'fields.open'
  | 'fields.clean'
  | 'jar.taken'
  | 'bottles.seen'
  | 'bottles.done'
  | 'maze.intro'
  | 'clue.receipt'
  | `cooler.${number}`;

export function createChapterScript(ctx: ChapterContext): ChapterScript {
  let disposed = false;
  const unsubs: Array<() => void> = [];
  /** Run-time only (a return to the bar clears them): the combine's intro is playing, the closing has begun. */
  let combineStarting = false;
  let ending = false;
  /** Who finished the combine, for the line that follows the ditch. */
  let combineBy = 'player';
  /** The fields stealth section is running (started, no alarm, not finished). Run-time only. */
  let stealthRunning = false;
  /** Time since a rustle noise was last made, ms. */
  let sinceRustleMs = Number.POSITIVE_INFINITY;
  let lightsOut = 0;

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
  const setPrompt = (id: TextId, lingerMs?: number): void => {
    wanted = { id };
    sync();
    if (lingerMs !== undefined) ctx.after(lingerMs, () => clearPrompt(id));
  };
  const clearPrompt = (id?: TextId): void => {
    if (id !== undefined && wanted?.id !== id) return;
    wanted = null;
    sync();
  };

  const motelDone = (): boolean => ctx.isComplete('c6.explore.motel');
  const townDone = (): boolean => ctx.isComplete('c6.explore.town');

  /** The objective Andrew should have, from what has happened so far. */
  const restoreObjective = (): void => {
    if (ctx.isComplete('c6.setpiece.combine')) ctx.setObjective(null);
    else if (ctx.isComplete('c6.deduction.roswell')) ctx.setObjective(OBJ.combine);
    else if (flag('clue.receipt') || ctx.isComplete('c6.explore.centre')) ctx.setObjective(OBJ.board);
    else if (ctx.isComplete('c6.fight.drones')) ctx.setObjective(OBJ.maze);
    else if (ctx.isComplete('c6.stealth.fields')) ctx.setObjective(OBJ.drones);
    else if (motelDone() && townDone()) ctx.setObjective(OBJ.fields);
    else if (!flag('intro.done')) return;
    else if (!motelDone()) ctx.setObjective(OBJ.motel);
    else if (!flag('clue.notice')) ctx.setObjective(OBJ.town);
    else ctx.setObjective(OBJ.dale);
  };

  const syncSteam = (): void => ctx.setPropVisible('bar.steam', ctx.hotDrinkOffered());

  const placeJar = (): void => {
    ctx.spawnPickup({ id: 'c6.pickup.jar', item: { kind: 'drink', drinkId: 'whiskey', count: 1 }, screenId: 'c6.fields', position: FARM_STAND_PICKUP });
  };

  /** Run-time dressing and locks are not saved. Put them back from what is finished. */
  const restoreWorld = (): void => {
    // The farm track is shut until Andrew has the postcard and the notice, and has been to Dale's.
    ctx.setExitLocked('c6.town.track', !(motelDone() && townDone()));
    const solved = ctx.isComplete('c6.puzzle.maze');
    ctx.setPropVisible('maze.gate', !solved);
    ctx.setPropVisible('maze.hatch', solved);
    COOLER_SPOTS.forEach((_, i) => ctx.setPropVisible(`fields.cooler${i + 1}`, !flag(`cooler.${i + 1}`)));
    if (flag('fields.clean') && !flag('jar.taken')) placeJar();
    syncSteam();
  };

  // --- The Ohio rule ---

  /** An insult, a moment after the beat that earned it. Each of the three is said once. */
  const insult = (n: number): void => {
    const id = pool('c6.insults')[n];
    if (id === undefined) return;
    ctx.after(INSULT_DELAY_MS, () => {
      if (!disposed) void ctx.say(id);
    });
  };

  // --- The Starlite ---

  const opening = async (): Promise<void> => {
    void ctx.say('c6.caption.title');
    await ctx.say('c6.bar.open');
    if (disposed) return;
    setFlag('intro.done');
    ctx.setObjective(OBJ.motel);
    void ctx.say('c6.caption.motel');
    if (ctx.hotDrinkOffered()) setPrompt('ui.prompt.hotDrink', PROMPT_LINGER_MS);
  };

  /** E at the counter: the coffee scene the first time, then the free hot drink each visit. */
  const coffee = async (): Promise<void> => {
    ctx.addEvidence('c6.clue.coffee');
    if (!ctx.isComplete('c6.explore.bar')) ctx.completeSection('c6.explore.bar');
    if (!flag('coffee.seen')) {
      setFlag('coffee.seen');
      await ctx.say('c6.bar.coffee');
      if (disposed) return;
    } else if (ctx.hotDrinkOffered()) {
      void ctx.say('c6.bar.hotDrink', { repeat: true });
    }
    if (ctx.hotDrinkOffered()) {
      clearPrompt('ui.prompt.hotDrink');
      openHotDrinkChoice();
    }
  };

  const motelProgress = (): void => {
    if (flag('clue.ledger') && flag('clue.postcard') && !motelDone()) {
      ctx.completeSection('c6.explore.motel');
    }
  };

  // --- Main Street and Dale's ---

  const townProgress = (): void => {
    if (flag('clue.notice') && flag('dale.done') && !townDone()) ctx.completeSection('c6.explore.town');
  };

  /** Dale's shoulder, and Second Opinion with it. */
  const daleLesson = async (): Promise<void> => {
    if (flag('dale.done')) return;
    setFlag('dale.done');
    ctx.completeMark('c6.dale.shoulder');
    await ctx.say('c6.dale.shoulder');
    if (disposed) return;
    await ctx.say('c6.secondOpinion.lesson');
    if (disposed) return;
    ctx.learnMove('secondOpinion');
    // The slot may be taken by Lock-in: the player puts the move there from the Tab screen.
    setPrompt('ui.prompt.kit', PROMPT_LINGER_MS);
    if (!flag('clue.notice')) ctx.setObjective(OBJ.town);
    townProgress();
    restoreWorld();
    restoreObjective();
  };

  // --- The fields ---

  const stealthUnderway = (): boolean => stealthRunning && ctx.currentScreen() === 'c6.fields' && !ctx.isComplete('c6.stealth.fields');

  /** The lesson drone, if one is in the world. Run-time only: a screen change or return to the bar removes it. */
  let lessonDrone: LoneEnemyHandle | null = null;

  /** One drone, outside the stealth alarm. Andrew brings it down with a bottle; that finishes the lesson. */
  const bottlesLesson = async (): Promise<void> => {
    if (flag('bottles.done') || lessonDrone?.alive()) return;
    setFlag('bottles.seen');
    lessonDrone = ctx.spawnLoneEnemy('drone', LESSON_DRONE_SPAWN, { onDefeated: lessonDroneFell });
    await ctx.say('c6.bottles.lesson');
  };

  const lessonDroneFell = (): void => {
    if (flag('bottles.done')) return;
    setFlag('bottles.done');
    void ctx.say('c6.bottles.done');
  };
  const droneHooks: FightHooks = {
    onWaveCleared: (index) => {
      if (index === 0) void ctx.say('c6.drones.wave2');
    },
  };

  /** The fight starts when Andrew walks into the yard, whenever the fight is neither done nor under way. */
  const startDrones = (): void => {
    if (!ctx.isComplete('c6.stealth.fields') || ctx.isComplete('c6.fight.drones')) return;
    if (ctx.fight('c6.fight.drones')?.active === true) return;
    ctx.setObjective(OBJ.drones);
    ctx.startSection('c6.fight.drones');
  };

  // --- The maze and the centre ---

  const mazeIntro = (): void => {
    if (!ctx.isComplete('c6.fight.drones') || ctx.isComplete('c6.puzzle.maze')) return;
    // Reaching the formation makes the maze the current section, so Myko can be called in on it.
    ctx.startSection('c6.puzzle.maze');
    ctx.setObjective(OBJ.maze);
    if (!flag('maze.intro')) {
      setFlag('maze.intro');
      void ctx.say('c6.maze.intro');
    }
  };

  const mazeSolved = async (by: string): Promise<void> => {
    ctx.setPropVisible('maze.gate', false);
    ctx.setPropVisible('maze.hatch', true);
    insult(2);
    if (by === 'player') await ctx.say('c6.maze.done');
  };

  /** The receipt under the hatch: the centre is done and the board opens. */
  const receipt = async (): Promise<void> => {
    if (!ctx.isComplete('c6.puzzle.maze')) return;
    if (!flag('clue.receipt')) {
      setFlag('clue.receipt');
      ctx.completeMark('c6.clue.receipt');
      ctx.addEvidence('c6.clue.receipt');
      ctx.completeSection('c6.explore.centre');
      ctx.setObjective(OBJ.board);
      await ctx.say('c6.centre');
      if (disposed) return;
    }
    if (!ctx.isComplete('c6.deduction.roswell')) ctx.openDeduction();
  };

  // --- The combine ---

  const combineArrives = async (): Promise<void> => {
    combineStarting = true;
    lightsOut = 0;
    await ctx.say('c6.combine.intro');
    combineStarting = false;
    if (disposed) return;
    // A return to the bar while the scene played leaves the section for the next walk in.
    if (ctx.isComplete('c6.setpiece.combine') || ctx.boss('c6.setpiece.combine')?.active === true) return;
    ctx.setObjective(OBJ.combine);
    ctx.startSection('c6.setpiece.combine');
  };

  const startCombine = (): void => {
    if (!ctx.isComplete('c6.deduction.roswell') || ctx.isComplete('c6.setpiece.combine')) return;
    if (combineStarting || ctx.boss('c6.setpiece.combine')?.active === true) return;
    void combineArrives();
  };

  const combineHooks: BossHooks = {
    onStart: () => {
      lightsOut = 0;
    },
    onEnd: (_boss, by) => {
      combineBy = by;
    },
  };

  /** The harvester is in the ditch. Back to the bus station for the closing scene. */
  const closing = async (): Promise<void> => {
    if (ending) return;
    ending = true;
    ctx.setObjective(null);
    if (combineBy === 'player') await ctx.say('c6.combine.end');
    if (disposed) return;
    ctx.setMykoScripted(null);
    ctx.goToScreen('c6.town', TOWN_ADMIRE.busStation);
    await ctx.say('c6.closing');
    if (disposed) return;
    ctx.completeChapter();
  };

  // --- Entering a screen ---

  const enteredMotel = (): void => {
    clearPrompt();
    ctx.setMykoScripted(MYKO_ICE);
    restoreWorld();
    restoreObjective();
  };

  const enteredTown = (): void => {
    ctx.setMykoScripted(null);
    restoreWorld();
    restoreObjective();
    if (!flag('town.seen')) {
      setFlag('town.seen');
      void ctx.say('c6.caption.town');
    }
  };

  const enteredFields = (): void => {
    // Myko waits at the lane's end, by phone, until the stealth section is passed.
    ctx.setMykoScripted(ctx.isComplete('c6.stealth.fields') ? null : MYKO_LANE_END);
    restoreWorld();
    restoreObjective();
    if (!flag('fields.seen')) {
      setFlag('fields.seen');
      void ctx.say('c6.caption.fields');
    }
  };

  /** A load or a return to the bar with the combine already done: the closing plays. */
  const resumeEnding = (): void => {
    if (ctx.isComplete('c6.setpiece.combine') && !ending) {
      combineBy = 'player';
      ctx.after(0, () => void closing());
    }
  };

  return {
    onStart: () => {
      restoreWorld();
      if (ctx.currentScreen() === 'c6.motel') ctx.setMykoScripted(MYKO_ICE);
      unsubs.push(
        ctx.bus.on(GameEvents.KitChanged, () => syncSteam()),
        ctx.bus.on(GameEvents.PickupCollected, ({ pickupId }) => {
          if (pickupId === 'c6.pickup.jar') setFlag('jar.taken');
          const m = /^c6\.pickup\.cooler(\d+)$/.exec(pickupId);
          if (m) {
            setFlag(`cooler.${Number(m[1])}`);
            ctx.setPropVisible(`fields.cooler${m[1]}`, false);
          }
        }),
        ctx.bus.on(GameEvents.SectionStarted, ({ sectionId }) => {
          if (sectionId === 'c6.stealth.fields') stealthRunning = true;
        }),
        ctx.bus.on(GameEvents.StealthNoise, (n) => {
          if (n.kind === 'rustle') sinceRustleMs = 0;
        }),
        ctx.bus.on(GameEvents.StealthAlertChanged, ({ to }) => {
          // A guard that turns to look just after the corn rustled: the corn gave him away.
          if (to === 'investigating' && stealthUnderway() && sinceRustleMs <= RUSTLE_WINDOW_MS) void ctx.say('c6.fields.rustle');
        }),
        ctx.bus.on(GameEvents.StealthAlarm, ({ sectionId }) => {
          if (sectionId !== 'c6.stealth.fields') return;
          stealthRunning = false;
          void ctx.say('c6.fields.caught');
        }),
        ctx.bus.on(GameEvents.StealthCleanRun, ({ sectionId }) => {
          if (sectionId !== 'c6.stealth.fields') return;
          stealthRunning = false;
          setFlag('fields.clean');
          placeJar();
          void ctx.say('c6.fields.clean');
        }),
        ctx.bus.on(GameEvents.CombineChanged, ({ phase }) => {
          if (phase === 'lightOut') {
            lightsOut++;
            if (lightsOut === 1) void ctx.say('c6.combine.light1');
            else if (lightsOut === 2) void ctx.say('c6.combine.light2');
          } else if (phase === 'ditched') void closing();
        }),
        ctx.bus.on(GameEvents.MazeStone, ({ outcome }) => {
          if (outcome === 'wrong') void ctx.say('c6.maze.wrong', { repeat: true });
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
      else {
        restoreObjective();
        resumeEnding();
      }
    },

    /** Andrew is back at the bar. Flags are what the last save held and the unfinished section has started over. */
    onBarReturn: () => {
      scenesOpen = 0;
      combineStarting = false;
      stealthRunning = false;
      lightsOut = 0;
      clearPrompt();
      restoreWorld();
      ctx.setMykoScripted(MYKO_ICE);
      if (!flag('intro.done')) {
        void opening();
        return;
      }
      restoreObjective();
      resumeEnding();
      void (async () => {
        await ctx.say('c6.bar.return');
        if (disposed) return;
        if (ctx.hotDrinkOffered()) {
          setPrompt('ui.prompt.hotDrink', PROMPT_LINGER_MS);
          await ctx.say('c6.bar.hotDrink');
        }
      })();
    },

    onScreenEntered: (screenId) => {
      if (screenId === 'c6.motel') enteredMotel();
      else if (screenId === 'c6.town') enteredTown();
      else if (screenId === 'c6.fields') enteredFields();
    },

    onUpdate: (dtMs) => {
      sinceRustleMs += dtMs;
    },

    onTrigger: (id) => {
      switch (id) {
        case 'c6.trig.dale':
          void daleLesson();
          break;
        case 'c6.trig.fieldsOpen':
          if (!flag('fields.open')) {
            setFlag('fields.open');
            ctx.setObjective(OBJ.fields);
            void ctx.say('c6.fields.open');
            setPrompt('ui.prompt.sneak', PROMPT_LINGER_MS);
          }
          break;
        case 'c6.trig.spotted':
          if (stealthUnderway()) void bottlesLesson();
          break;
        case 'c6.trig.yard':
          // Out to the yard the fight starts; back west through it with the board done, the combine.
          if (ctx.isComplete('c6.deduction.roswell')) startCombine();
          else startDrones();
          break;
        case 'c6.trig.maze':
          mazeIntro();
          break;
      }
    },

    onExamine: (id) => {
      switch (id) {
        case 'c6.coffee':
          void coffee();
          return true;
        case 'c6.clue.ledger':
          setFlag('clue.ledger');
          ctx.completeMark('c6.clue.ledger');
          motelProgress();
          return undefined;
        case 'c6.clue.postcard':
          setFlag('clue.postcard');
          ctx.completeMark('c6.clue.postcard');
          motelProgress();
          return undefined;
        case 'c6.clue.noticeboard':
          setFlag('clue.notice');
          ctx.completeMark('c6.clue.noticeboard');
          if (flag('dale.done')) townProgress();
          return undefined;
        case 'c6.dale.shoulder':
          void daleLesson();
          return true;
        case 'c6.ohio.iceMachine':
          // The second time he is at the ice machine he is not finished.
          if (flag('ice.seen')) {
            void ctx.say('c6.ohio.iceMachine.again', { repeat: true });
            return true;
          }
          setFlag('ice.seen');
          return undefined;
        case 'c6.clue.receipt':
          void receipt();
          return true;
      }
      return undefined;
    },

    onSectionCompleted: (sectionId: SectionId, by) => {
      switch (sectionId) {
        case 'c6.explore.motel':
        case 'c6.explore.town':
          restoreWorld();
          restoreObjective();
          if (sectionId === 'c6.explore.town') insult(0);
          break;
        case 'c6.stealth.fields':
          stealthRunning = false;
          ctx.setMykoScripted(null);
          ctx.setObjective(OBJ.drones);
          insult(1);
          break;
        case 'c6.fight.drones':
          ctx.setObjective(OBJ.maze);
          if (by === 'player') void ctx.say('c6.drones.end');
          break;
        case 'c6.puzzle.maze':
          void mazeSolved(by);
          break;
        case 'c6.deduction.roswell':
          ctx.setObjective(OBJ.combine);
          if (by === 'player') void ctx.say('c6.board.right');
          break;
      }
    },

    fightHooks: { 'c6.fight.drones': droneHooks },
    bossHooks: { 'c6.setpiece.combine': combineHooks },

    debugWalk: () => {
      setFlag('intro.done');
      setFlag('fields.open');
      setFlag('bottles.seen');
      setFlag('bottles.done');
      ctx.setMykoScripted(null);
    },

    dispose: () => {
      disposed = true;
      for (const off of unsubs) off();
      hidePrompt();
    },
  };
}
