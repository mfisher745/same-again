/**
 * Chapter 3 script: every beat in docs/chapters/03-regional-office.md, in order. All text is referred to by ID; all
 * numbers that matter come from `TUNING`.
 */

import { hasSequence, sequence } from '../../content/dialogue';
import { TUNING } from '../../content/tuning';
import { GameEvents } from '../../core/types';
import type { SectionId, TextId } from '../../core/types';
import type { BossHooks, ChapterContext, ChapterScript } from '../../systems';
import { PROP } from '../../art/props';
import { hidePrompt, onTabOpened, openHotDrinkChoice, showPrompt } from '../../ui/prompts';
import { BAR_ARRIVAL, BAY_BOTTLE_SPOTS, BAY_DARK, BAY_LIT, CABINET_HIT_AREA, MYKO_CHAIR, STACKS, WHISKEY_SPOT, stackTile } from './maps';

const OBJ = {
  yard: 'c3.yard',
  office: 'c3.office',
  cabinet: 'c3.cabinet',
  crates: 'c3.crates',
  manifest: 'c3.manifest',
  bay: 'c3.bay',
  board: 'c3.board',
  halloran: 'c3.halloran',
} as const;

/** Presentation only: how long a prompt may linger when nothing the player does can dismiss it. */
const PROMPT_LINGER_MS = 7000;
/** Within this of the arrival spot, Andrew is at the social club. */
const AT_BAR_PX = 48;

type Flag =
  | 'intro.done'
  | 'open.seen'
  | 'office.seen'
  | 'clue.map'
  | 'clue.brochure'
  | 'cabinet.dented'
  | 'cabinet.open'
  | 'whiskey.taken'
  | 'crates.intro'
  | 'lever.down'
  | 'manifest.found'
  | 'lights.on'
  | 'bay.started'
  | 'board.started'
  | 'ftr.done'
  | 'yard.clean';

type ClueKey = 'map' | 'brochure' | 'certificate' | 'visitors';

const SCENE_FOR: Readonly<Record<ClueKey, string | undefined>> = {
  map: 'c3.office.map',
  brochure: 'c3.office.brochure',
  certificate: 'c3.office.certificate',
  visitors: undefined,
};

export function createChapterScript(ctx: ChapterContext): ChapterScript {
  let disposed = false;
  const unsubs: Array<() => void> = [];
  /** Swings left on Same Again (it is on for the next few). Run-time only. */
  let armed = 0;
  let bossEnding = false;
  /** Halloran's arrival scene is under way or he has been started this attempt. Run-time only: a return to the bar clears it. */
  let hallorannUp = false;

  const flag = (key: Flag): boolean => ctx.flag(key) === true;
  const setFlag = (key: Flag, value = true): void => ctx.setFlag(key, value);
  const officeOpen = (): boolean => flag('clue.map') && flag('clue.brochure') && flag('cabinet.open');
  const yardActive = (): boolean => flag('open.seen') && !ctx.isComplete('c3.stealth.yard');

  // --- Tutorial prompts: one at a time, never over a scene ---

  let wanted: TextId | null = null;
  let scenesOpen = 0;
  const sync = (): void => {
    if (wanted !== null && scenesOpen === 0) showPrompt(wanted);
    else hidePrompt();
  };
  const setPrompt = (id: TextId, lingerMs?: number): void => {
    wanted = id;
    sync();
    if (lingerMs !== undefined) ctx.after(lingerMs, () => clearPrompt(id));
  };
  const clearPrompt = (id?: TextId): void => {
    if (id !== undefined && wanted !== id) return;
    wanted = null;
    sync();
  };

  /** The objective Andrew should have, from what has happened so far. */
  const restoreObjective = (): void => {
    if (ctx.isComplete('c3.boss.halloran')) ctx.setObjective(null);
    else if (ctx.isComplete('c3.deduction.boston')) ctx.setObjective(OBJ.halloran);
    else if (ctx.isComplete('c3.fight.bay')) ctx.setObjective(OBJ.board);
    else if (flag('manifest.found')) ctx.setObjective(OBJ.bay);
    else if (ctx.isComplete('c3.puzzle.crates')) ctx.setObjective(OBJ.manifest);
    else if (flag('cabinet.open')) ctx.setObjective(OBJ.crates);
    else if (flag('clue.map') && flag('clue.brochure')) ctx.setObjective(OBJ.cabinet);
    else if (ctx.isComplete('c3.stealth.yard') || flag('office.seen')) ctx.setObjective(OBJ.office);
    else if (flag('intro.done')) ctx.setObjective(OBJ.yard);
  };

  /** Run-time dressing, locks and lights are not saved. Put them back from what is finished. */
  const restoreWorld = (): void => {
    ctx.setExitLocked('c3.office.bay', !officeOpen());
    ctx.setPropFrame('office.cabinet', flag('cabinet.open') ? PROP.filingCabinet.open : flag('cabinet.dented') ? PROP.filingCabinet.dented : PROP.filingCabinet.shut);
    ctx.setPropFrame('bay.lever', flag('lever.down') ? PROP.lever.down : PROP.lever.up);
    ctx.setPropVisible('yard.logbook', flag('yard.clean'));
    ctx.setAmbient(flag('manifest.found') || flag('lights.on') ? BAY_LIT : BAY_DARK, 'c3.bay');
    if (flag('cabinet.open') && !flag('whiskey.taken')) spawnWhiskey();
    // The parked forklift stands in the bay until Halloran climbs on.
    ctx.setPropVisible('bay.forklift', !ctx.isComplete('c3.boss.halloran') && !hallorannUp);
    syncSteam();
  };

  // --- The social club ------------------------------------------------------

  const opening = async (): Promise<void> => {
    void ctx.say('c3.caption.title');
    await ctx.say('c3.bar.open');
    if (disposed) return;
    setFlag('intro.done');
    ctx.setObjective(OBJ.yard);
    void ctx.say('c3.caption.yard');
    if (ctx.hotDrinkOffered()) setPrompt('ui.prompt.hotDrink', PROMPT_LINGER_MS);
  };

  /** Steam over the kettle while the free hot drink can be taken: the one free charge each visit, shown. */
  const syncSteam = (): void => ctx.setPropVisible('bar.steam', ctx.hotDrinkOffered());

  let kettleLineOpen = false;
  /** The kettle. The free hot drink, each visit. With nothing to give, Myko says why (once at a time). */
  const kettle = (): void => {
    if (!ctx.hotDrinkOffered()) {
      if (kettleLineOpen) return;
      kettleLineOpen = true;
      void ctx.say(ctx.kit().hotDrink !== null ? 'c3.kettle.held' : 'c3.kettle.spent', { repeat: true }).finally(() => {
        kettleLineOpen = false;
      });
      return;
    }
    clearPrompt('ui.prompt.hotDrink');
    openHotDrinkChoice();
    void ctx.say('c3.bar.hotDrink');
  };

  // --- The yard -------------------------------------------------------------

  const yardStarted = (): void => {
    ctx.completeSection('c3.explore.bar');
    if (flag('open.seen')) return;
    setFlag('open.seen');
    ctx.setObjective(OBJ.yard);
    void ctx.say('c3.open');
    setPrompt('ui.prompt.sneak', PROMPT_LINGER_MS);
  };

  const watchman = (n: 1 | 2): void => {
    if (yardActive() && ctx.currentScreen() === 'c3.yard') void ctx.say(`c3.watchman.${n}`);
  };

  // --- The office -----------------------------------------------------------

  const officeProgress = (): void => {
    if (!officeOpen() || ctx.isComplete('c3.explore.office')) return;
    ctx.completeSection('c3.explore.office');
  };

  const examineClue = async (key: ClueKey): Promise<void> => {
    if (key === 'map' || key === 'brochure') setFlag(`clue.${key}`);
    ctx.addEvidence(`c3.clue.${key}`);
    ctx.setExitLocked('c3.office.bay', !officeOpen());
    if (key === 'map' || key === 'brochure') {
      if (flag('clue.map') && flag('clue.brochure') && !flag('cabinet.open')) ctx.setObjective(OBJ.cabinet);
      officeProgress();
    }
    const scene = SCENE_FOR[key];
    if (scene !== undefined) await ctx.say(scene);
  };

  const spawnWhiskey = (): void =>
    ctx.spawnPickup({ id: 'c3.pickup.whiskey', item: { kind: 'drink', drinkId: 'whiskey', count: 1 }, screenId: 'c3.office', position: WHISKEY_SPOT });

  const openCabinet = async (): Promise<void> => {
    setFlag('cabinet.open');
    ctx.setPropFrame('office.cabinet', PROP.filingCabinet.open);
    ctx.completeMark('c3.cabinet');
    ctx.learnMove('sameAgain');
    spawnWhiskey();
    ctx.setExitLocked('c3.office.bay', !officeOpen());
    if (ctx.isComplete('c3.fight.bay') === false && ctx.isComplete('c3.puzzle.crates') === false) ctx.setObjective(OBJ.crates);
    officeProgress();
    await ctx.say('c3.sameAgain.done');
  };

  /** The first swing at the cabinet dents it and Myko explains; a swing with Same Again on opens it. */
  const cabinetHit = async (): Promise<void> => {
    if (flag('cabinet.open')) return;
    if (armed > 0) {
      await openCabinet();
      return;
    }
    if (flag('cabinet.dented')) return;
    setFlag('cabinet.dented');
    ctx.setPropFrame('office.cabinet', PROP.filingCabinet.dented);
    await ctx.say('c3.sameAgain.lesson');
    if (disposed) return;
    ctx.learnMove('sameAgain');
    if (wanted !== 'ui.prompt.kit') setPrompt('ui.prompt.kit', PROMPT_LINGER_MS);
  };

  // --- The bay: crates, manifest, night shift, board ------------------------

  // Playtest 7: empties on the bay floor for the gantry fight. One taken is put back after a while until the fight is won.
  const BOTTLE_PREFIX = 'drop.c3.bay.bottle.';
  const bottleWait = new Map<number, number>();
  const bottlesWanted = (): boolean => flag('manifest.found') && !ctx.isComplete('c3.fight.bay') && ctx.currentScreen() === 'c3.bay';
  const layBottle = (i: number): void => {
    const at = BAY_BOTTLE_SPOTS[i];
    if (at) ctx.spawnPickup({ id: `${BOTTLE_PREFIX}${i}`, item: { kind: 'empties', count: 1 }, screenId: 'c3.bay', position: at });
  };
  const layBottles = (): void => {
    bottleWait.clear();
    if (bottlesWanted()) BAY_BOTTLE_SPOTS.forEach((_, i) => layBottle(i));
  };
  const bottleTaken = (pickupId: string): void => {
    if (!pickupId.startsWith(BOTTLE_PREFIX)) return;
    bottleWait.set(Number(pickupId.slice(BOTTLE_PREFIX.length)), TUNING.overhaul?.fightBottleRespawnMs ?? 4000);
  };
  const tickBottles = (dtMs: number): void => {
    for (const [i, ms] of bottleWait) {
      if (ms - dtMs > 0) {
        bottleWait.set(i, ms - dtMs);
        continue;
      }
      bottleWait.delete(i);
      if (bottlesWanted()) layBottle(i);
    }
  };

  const enteredBay = async (): Promise<void> => {
    ctx.setMykoScripted(null);
    restoreObjective();
    layBottles();
    // A night shift under way when he went back to the bar starts again from the beginning.
    if (flag('manifest.found') && !ctx.isComplete('c3.fight.bay') && ctx.fight('c3.fight.bay')?.active !== true) {
      ctx.setObjective(OBJ.bay);
      ctx.startSection('c3.fight.bay');
      return;
    }
    if (!ctx.isComplete('c3.puzzle.crates')) ctx.startSection('c3.puzzle.crates');
    if (flag('crates.intro') || ctx.isComplete('c3.puzzle.crates')) return;
    setFlag('crates.intro');
    ctx.setObjective(OBJ.crates);
    await ctx.say('c3.crates.intro');
  };

  const cratesDone = async (): Promise<void> => {
    ctx.setObjective(OBJ.manifest);
    await ctx.say('c3.crates.done');
  };

  const lever = (): void => {
    const down = !flag('lever.down');
    setFlag('lever.down', down);
    ctx.setPropFrame('bay.lever', down ? PROP.lever.down : PROP.lever.up);
    if (!ctx.isComplete('c3.puzzle.crates')) void ctx.say('c3.crates.reset', { repeat: true });
  };

  /** The manifest: the lights come on, and the night shift is there. */
  const takeManifest = async (): Promise<void> => {
    if (flag('manifest.found')) return;
    setFlag('manifest.found');
    ctx.addEvidence('c3.clue.manifest');
    ctx.completeMark('c3.manifest');
    ctx.completeSection('c3.explore.bayoffice');
    await ctx.say('c3.manifest.found');
    if (disposed) return;
    setFlag('lights.on');
    ctx.setAmbient(BAY_LIT, 'c3.bay');
    ctx.setObjective(OBJ.bay);
    layBottles();
    await ctx.say('c3.bay.intro');
    if (disposed) return;
    setFlag('bay.started');
    ctx.startSection('c3.fight.bay');
  };

  const fightDone = async (by: string): Promise<void> => {
    if (by === 'debug') return;
    setFlag('lights.on');
    ctx.setAmbient(BAY_LIT, 'c3.bay');
    if (by !== 'myko') await ctx.say('c3.bay.end');
    if (disposed) return;
    ctx.setObjective(OBJ.board);
    await ctx.say('c3.board.tutorial');
    if (disposed) return;
    setFlag('board.started');
    ctx.openDeduction();
  };

  const boardDone = async (by: string): Promise<void> => {
    ctx.setObjective(OBJ.halloran);
    if (by === 'debug') return;
    await ctx.say('c3.board.right');
  };

  // --- One for the Road and Halloran ----------------------------------------

  const roadLesson = async (): Promise<void> => {
    if (flag('ftr.done')) return;
    setFlag('ftr.done');
    await ctx.say('c3.oneForTheRoad.lesson');
    if (disposed) return;
    ctx.learnMove('oneForTheRoad');
  };

  const hallorannArrives = async (): Promise<void> => {
    if (hallorannUp) return;
    hallorannUp = true;
    await roadLesson();
    if (disposed) return;
    await ctx.say('c3.halloran.intro');
    if (disposed) return;
    ctx.setObjective(OBJ.halloran);
    ctx.setPropVisible('bay.forklift', false);
    ctx.startSection('c3.boss.halloran');
  };

  /** How long the forks stay stuck: the charge's recovery, in tuning. */
  const stickMs = (): number => TUNING.bosses['c3.boss.halloran'].phases[0]?.attacks.find((a) => a.id === 'forkCharge')?.recoveryMs ?? 2500;
  const stackTiles = STACKS.map(stackTile);

  const hallorannHooks: BossHooks = {
    onStart: (boss) => {
      // A fresh attempt: no shield, phase 1.
      boss.guard('halloran', null);
      boss.setSprite('halloran', 'boss.c3.boss.halloran');
    },
    onChargeBlocked: (boss, body, col, row) => {
      if (!stackTiles.some((t) => t.col === col && t.row === row)) return;
      boss.daze(body.tag, stickMs());
      void ctx.say('c3.halloran.stuck');
    },
    onPhaseChanged: (boss, phase) => {
      if (phase.id !== 'palletShield') return;
      // The pallet on the forks: hits from the front do nothing. A dazed body is never guarded.
      boss.guard('halloran', 'front');
      boss.setSprite('halloran', 'boss.c3.boss.halloran.shield');
      void ctx.say('c3.halloran.phase2');
    },
    onEnd: (boss, by) => void bossEnded(by, boss),
  };

  const bossEnded = async (by: string, boss: { guard(tag: string, side: 'front' | null): void }): Promise<void> => {
    if (bossEnding || by === 'debug') return;
    bossEnding = true;
    boss.guard('halloran', null);
    ctx.learnMove('oneForTheRoad');
    if (by !== 'myko') await ctx.say('c3.halloran.end');
    if (disposed) return;
    ctx.gainWeapon('clipboard');
    setPrompt('ui.prompt.weapon', PROMPT_LINGER_MS);
    await ctx.say('c3.weapon.clipboard');
    if (disposed) return;
    await ctx.say('c3.closing');
    if (disposed) return;
    ctx.completeChapter();
  };

  return {
    onStart: () => {
      restoreWorld();
      if (ctx.currentScreen() === 'c3.yard') ctx.setMykoScripted(MYKO_CHAIR);
      if (!flag('cabinet.open')) ctx.markObjective({ id: 'c3.cabinet', screenId: 'c3.office', position: { x: 28 * 16 + 8, y: 3 * 16 + 8 } });
      const dent = TUNING.overhaul?.moves.sameAgain?.effect;
      const swings = dent?.kind === 'repeatHits' ? dent.hits : 3;
      unsubs.push(
        ctx.onMeleeHit(CABINET_HIT_AREA, () => void cabinetHit(), 'c3.office'),
        onTabOpened(() => clearPrompt('ui.prompt.kit')),
        ctx.bus.on(GameEvents.MoveUsed, ({ moveId }) => {
          if (moveId === 'sameAgain') {
            armed = swings;
            clearPrompt('ui.prompt.kit');
          }
        }),
        // The swing that touched the cabinet is counted before it is spent.
        ctx.bus.on(GameEvents.AbilityUsed, () => {
          if (armed > 0) armed--;
        }),
        ctx.bus.on(GameEvents.KitChanged, () => syncSteam()),
        ctx.bus.on(GameEvents.PickupCollected, ({ pickupId }) => {
          if (pickupId === 'c3.pickup.whiskey') setFlag('whiskey.taken');
          bottleTaken(pickupId);
        }),
        ctx.bus.on(GameEvents.StealthAlarm, ({ sectionId }) => {
          if (sectionId === 'c3.stealth.yard') void ctx.say('c3.yard.caught');
        }),
        ctx.bus.on(GameEvents.StealthCleanRun, ({ sectionId }) => {
          if (sectionId !== 'c3.stealth.yard') return;
          setFlag('yard.clean');
          ctx.setPropVisible('yard.logbook', true);
          void ctx.say('c3.yard.clean');
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

    /** Andrew is back at the social club. Flags are what the last save held and the unfinished section has started over. */
    onBarReturn: () => {
      scenesOpen = 0;
      armed = 0;
      bossEnding = false;
      hallorannUp = false;
      clearPrompt();
      restoreWorld();
      ctx.setMykoScripted(MYKO_CHAIR);
      if (!flag('intro.done')) {
        void opening();
        return;
      }
      restoreObjective();
      void (async () => {
        await ctx.say('c3.bar.return');
        if (disposed) return;
        if (ctx.hotDrinkOffered()) {
          setPrompt('ui.prompt.hotDrink', PROMPT_LINGER_MS);
          await ctx.say('c3.bar.hotDrink');
        }
      })();
    },

    onScreenEntered: (screenId) => {
      clearPrompt();
      if (screenId === 'c3.yard') {
        const p = ctx.playerPosition();
        ctx.setMykoScripted(Math.hypot(p.x - BAR_ARRIVAL.x, p.y - BAR_ARRIVAL.y) < AT_BAR_PX ? MYKO_CHAIR : null);
        restoreWorld();
        restoreObjective();
      } else if (screenId === 'c3.office') {
        ctx.setMykoScripted(null);
        restoreWorld();
        if (!flag('office.seen')) {
          setFlag('office.seen');
          ctx.setObjective(OBJ.office);
          void ctx.say('c3.office.enter');
        } else restoreObjective();
      } else if (screenId === 'c3.bay') void enteredBay();
    },

    onTrigger: (id) => {
      switch (id) {
        case 'c3.trig.yard':
          if (flag('intro.done') && !ctx.isComplete('c3.stealth.yard')) yardStarted();
          break;
        case 'c3.trig.watch1':
          watchman(1);
          break;
        case 'c3.trig.watch2':
          watchman(2);
          break;
        case 'c3.trig.doors':
          if (ctx.isComplete('c3.deduction.boston') && !ctx.isComplete('c3.boss.halloran') && !ctx.boss('c3.boss.halloran')?.active) void roadLesson();
          break;
        case 'c3.trig.boss':
          if (ctx.isComplete('c3.deduction.boston') && !ctx.isComplete('c3.boss.halloran') && !ctx.boss('c3.boss.halloran')?.active) void hallorannArrives();
          break;
      }
    },

    onExamine: (id) => {
      switch (id) {
        case 'c3.kettle':
          kettle();
          return true;
        case 'c3.map':
          void examineClue('map');
          return true;
        case 'c3.brochure':
          void examineClue('brochure');
          return true;
        case 'c3.certificate':
          void examineClue('certificate');
          return true;
        case 'c3.visitors':
          void examineClue('visitors');
          return true;
        case 'c3.manifest':
          void takeManifest();
          return true;
        case 'c3.board':
          // The string stays put until the night shift is down.
          return ctx.isComplete('c3.fight.bay') ? undefined : true;
        case 'c3.crates.lever':
          // The system puts the crates back; the lever swings and Myko has a word.
          lever();
          return undefined;
      }
      return undefined;
    },

    onSectionStarted: (sectionId: SectionId) => {
      if (sectionId === 'c3.stealth.yard') yardStarted();
      else if (sectionId === 'c3.puzzle.crates') ctx.setObjective(OBJ.crates);
    },

    onSectionCompleted: (sectionId: SectionId, by) => {
      if (sectionId === 'c3.stealth.yard') {
        ctx.completeSection('c3.explore.bar');
        if (!flag('office.seen')) ctx.setObjective(OBJ.office);
      } else if (sectionId === 'c3.puzzle.crates') {
        if (by !== 'debug') void cratesDone();
      } else if (sectionId === 'c3.fight.bay') void fightDone(by);
      else if (sectionId === 'c3.deduction.boston') void boardDone(by);
    },

    onUpdate: (dtMs) => tickBottles(dtMs),

    bossHooks: { 'c3.boss.halloran': hallorannHooks },

    debugWalk: () => {
      for (const f of ['intro.done', 'open.seen', 'office.seen', 'clue.map', 'clue.brochure', 'cabinet.open', 'manifest.found', 'lights.on', 'ftr.done'] as const) setFlag(f);
      ctx.setExitLocked('c3.office.bay', false);
      ctx.setMykoScripted(null);
    },

    dispose: () => {
      disposed = true;
      for (const off of unsubs) off();
      hidePrompt();
    },
  };
}
