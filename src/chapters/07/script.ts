/**
 * Chapter 7 script: every beat in docs/chapters/07-gift-shop.md, in order. All text is referred to by ID; all numbers
 * come from `TUNING` or the systems. Nothing here guards a start with a saved "started" flag: the yard fight, the
 * stockroom and the mascots start again after a load or a return to the bar because each start tests that the section
 * is not complete and not already under way. After a return to the bar finished sections stay finished and Andrew walks
 * through them.
 */

import { PROP } from '../../art/props';
import { hasSequence, sequence } from '../../content/dialogue';
import { GameEvents } from '../../core/types';
import type { MoveId, SectionId, SpecialSlotIndex, TextId, Vec2 } from '../../core/types';
import type { BossHooks, ChapterContext, ChapterScript } from '../../systems';
import { hidePrompt, openHotDrinkChoice, showPrompt, showSlotPrompt } from '../../ui/prompts';
import {
  CLOSING_SPOT,
  FIGURES,
  LAMP_IDS,
  MASCOT_ARENA_AREA,
  MYKO_BAR,
  SHOP_CLOSING_EXIT,
  STOCK_ENTRANCE,
  STOUT_PICKUP_SPOT,
  T,
  TOURIST_FIGURES,
} from './maps';

const OBJ = {
  strip: 'c7.strip',
  tells: 'c7.tells',
  gary: 'c7.gary',
  stock: 'c7.stock',
  yard: 'c7.yard',
  van: 'c7.van',
  board: 'c7.board',
  mascots: 'c7.mascots',
} as const;

const TELLS = 'c7.puzzle.tells';
const STEALTH = 'c7.stealth.stock';
const YARD = 'c7.fight.yard';
const BOARD = 'c7.deduction.nevada';
const BOSS = 'c7.boss.mascots';
const GARY_TELLS_ID = 'gary';

/** Presentation only: how long a prompt may linger when nothing the player does can dismiss it. */
const PROMPT_LINGER_MS = 7000;
/** Presentation only: the tourists walk out of the shop door this long after Gary says it. */
const CLOSE_DELAY_MS = 1800;
const CLOSE_WALK_MS = 2400;
const CLOSE_STEP_MS = 50;
/** Presentation only: how often the strip is checked for Andrew walking into the arena or out of the bar. */
const STRIP_POLL_MS = 250;
/** Presentation only: Myko leaves his bar corner once Andrew is this far east of the bar (px). */
const BAR_LEAVE_X = 224;
/** Presentation only: the accuse screen waits for a line to finish, but never more than this many polls. */
const TELLS_OPEN_POLL_MS = 300;
const TELLS_OPEN_POLLS = 10;
/** Presentation only: a beat between the prize and the night. */
const BEFORE_CLOSING_MS = 1200;

type Flag =
  | 'intro.done'
  | 'tequila.given'
  | 'lastOrders.done'
  | 'stock.clean'
  | 'stout.taken'
  | 'clue.route';

export function createChapterScript(ctx: ChapterContext): ChapterScript {
  let disposed = false;
  const unsubs: Array<() => void> = [];
  /** Run-time only (a return to the bar clears them). */
  let garyBusy = false;
  let yardStarting = false;
  let mascotsStarting = false;
  let tellsOpening = false;
  let ending = false;
  let dialogueOpen = 0;
  let mykoAtBar = false;
  /** Who finished the mascots, for the lines that follow. */
  let mascotsBy = 'player';
  /** The tourists walking out of the shop: where each started, and how far through the walk they are, ms. */
  let leaving: { id: string; from: Vec2; ms: number }[] | null = null;

  const flag = (key: Flag): boolean => ctx.flag(key) === true;
  const setFlag = (key: Flag, value = true): void => ctx.setFlag(key, value);
  const garyStep = (): number => {
    const v = ctx.flag('garyStep');
    return typeof v === 'number' ? v : 0;
  };

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
  const knows = (move: MoveId): boolean => ctx.kit().moves.includes(move);
  /** A new move: say press its key if it landed in its slot, else go to the Tab to put it there. */
  const movePrompt = (moveId: MoveId, slot: SpecialSlotIndex): void => {
    if (ctx.kit().slots.specials[slot - 1] === moveId) setPrompt('ui.prompt.slot', PROMPT_LINGER_MS, slot);
    else setPrompt('ui.prompt.kit', PROMPT_LINGER_MS);
  };

  // --- What has happened ---

  const tells = () => ctx.tells(TELLS);
  const stockActive = (): boolean => ctx.currentScreen() === 'c7.stock' && !ctx.isComplete(STEALTH);

  /** The objective Andrew should have, from what has happened so far. */
  const restoreObjective = (): void => {
    if (ctx.isComplete(BOSS)) ctx.setObjective(null);
    else if (ctx.isComplete(BOARD)) ctx.setObjective(OBJ.mascots);
    else if (ctx.isComplete('c7.explore.van')) ctx.setObjective(OBJ.board);
    else if (ctx.isComplete(YARD)) ctx.setObjective(OBJ.van);
    else if (ctx.isComplete(STEALTH)) ctx.setObjective(OBJ.yard);
    else if (flag('lastOrders.done')) ctx.setObjective(OBJ.stock);
    else if (ctx.isComplete(TELLS)) ctx.setObjective(OBJ.gary);
    else if (ctx.isComplete('c7.explore.strip')) ctx.setObjective(OBJ.tells);
    else if (flag('intro.done')) ctx.setObjective(OBJ.strip);
  };

  const syncSteam = (): void => ctx.setPropVisible('bar.steam', ctx.hotDrinkOffered());

  const placeStout = (): void => {
    ctx.spawnPickup({ id: 'c7.pickup.stout', item: { kind: 'drink', drinkId: 'stout', count: 1 }, screenId: 'c7.stock', position: STOUT_PICKUP_SPOT });
  };

  /** Run-time dressing and locks are not saved. Put them back from what is finished. */
  const restoreWorld = (): void => {
    syncSteam();
    // The shop's back door stays shut until Gary has closed the shop.
    ctx.setExitLocked('c7.shop.stock', !flag('lastOrders.done'));
    // The tourists are gone once the shop has closed.
    for (const f of FIGURES) if (TOURIST_FIGURES.includes(f.key)) ctx.setNpcVisible(f.npcId, !flag('lastOrders.done') && leaving === null);
    // The clean-run reward in the staff fridge.
    const clean = flag('stock.clean');
    ctx.setPropFrame('stock.fridge', clean ? PROP.staffFridge.open : PROP.staffFridge.shut);
    ctx.setPropVisible('stock.stout', clean && !flag('stout.taken'));
    if (clean && !flag('stout.taken')) placeStout();
    // The rack: the prize is gone once taken. The lamps light at night.
    ctx.setPropFrame('strip.rack', ctx.kit().weapons.includes('inflatableAlien') ? PROP.inflatableRack.taken : PROP.inflatableRack.full);
    for (const id of LAMP_IDS) ctx.setPropFrame(id, ctx.isNight() ? PROP.eyeLamp.night : PROP.eyeLamp.day);
    ctx.setPropVisible('mascot.sign', false);
    ctx.setNpcVisible('closing.gary', false);
    ctx.setHeatActive(!ctx.isNight());
  };

  /** Myko keeps to the bar's corner, apart from the tables, until Andrew leaves it. */
  const parkMyko = (): void => {
    const here = ctx.currentScreen();
    if (here === 'c7.strip') {
      mykoAtBar = ctx.playerPosition().x < BAR_LEAVE_X;
      ctx.setMykoScripted(mykoAtBar ? MYKO_BAR : null);
    } else if (here === 'c7.stock') ctx.setMykoScripted(ctx.isComplete(STEALTH) ? null : STOCK_ENTRANCE);
    else ctx.setMykoScripted(null);
  };

  // --- The bar ---

  const opening = async (): Promise<void> => {
    void ctx.say('c7.caption.title');
    void ctx.say('c7.caption.strip');
    await ctx.say('c7.bar.open');
    if (disposed) return;
    setFlag('intro.done');
    ctx.setObjective(OBJ.strip);
    if (ctx.hotDrinkOffered()) setPrompt('ui.prompt.hotDrink', PROMPT_LINGER_MS);
  };

  const barDone = (): void => {
    if (!ctx.isComplete('c7.explore.bar')) ctx.completeSection('c7.explore.bar');
  };

  let barLineOpen = false;
  /** E at the counter: the hot drink, once each visit. With nothing to give the bartender says his line again (once at a time). */
  const hotDrink = (): void => {
    barDone();
    if (!ctx.hotDrinkOffered()) {
      if (barLineOpen) return;
      barLineOpen = true;
      void ctx.say('c7.bar.hotDrink', { repeat: true }).finally(() => {
        barLineOpen = false;
      });
      return;
    }
    clearPrompt('ui.prompt.hotDrink');
    ctx.completeMark('c7.bar.hotDrink');
    openHotDrinkChoice();
    void ctx.say('c7.bar.hotDrink');
  };

  /** E at the bartender: the first tequila is on the house; after that he has only the hot drink to offer. */
  const bartender = (): void => {
    barDone();
    if (flag('tequila.given')) {
      hotDrink();
      return;
    }
    setFlag('tequila.given');
    ctx.give({ kind: 'drink', drinkId: 'tequila', count: 1 });
    void ctx.say('c7.bar.tequila');
  };

  // --- The shop: who is an alien, Gary, Last Orders ---

  /** Opens the accuse screen when every figure is examined, once no line is showing (or after a short wait). */
  const openTellsSoon = (): void => {
    if (tellsOpening || ctx.isComplete(TELLS)) return;
    tellsOpening = true;
    let polls = 0;
    const attempt = (): void => {
      if (disposed) return;
      polls++;
      if (dialogueOpen > 0 && polls < TELLS_OPEN_POLLS) {
        ctx.after(TELLS_OPEN_POLL_MS, attempt);
        return;
      }
      tellsOpening = false;
      if (tells()?.allExamined() === true) ctx.openTells(TELLS);
    };
    ctx.after(TELLS_OPEN_POLL_MS, attempt);
  };

  const shopEntered = (): void => {
    void ctx.say('c7.caption.shop');
    if (ctx.isComplete(TELLS)) return;
    if (!ctx.isComplete('c7.explore.strip')) ctx.completeSection('c7.explore.strip');
    ctx.setObjective(OBJ.tells);
    ctx.startSection(TELLS);
    void ctx.say('c7.tells.intro');
  };

  /** Gary: before the accusation he is a figure to examine (silently: his tell is that he gives none away). */
  const garyExamined = (): void => {
    if (!ctx.isComplete(TELLS)) {
      ctx.examineFigure(TELLS, GARY_TELLS_ID);
      if (tells()?.allExamined() === true) openTellsSoon();
      // TODO(cd): Gary has no tells line of his own (`c7.tells.gary`); Myko's first hint stands in until he has.
      else void ctx.say('c7.hint.tells.1', { repeat: true });
      return;
    }
    void garyTalk();
  };

  /** E at the till after the accusation: one exchange each time; the payslip is the last, and Gary closes the shop. */
  const garyTalk = async (): Promise<void> => {
    if (garyBusy) return;
    garyBusy = true;
    const step = garyStep();
    if (step === 0) {
      ctx.setFlag('garyStep', 1);
      await ctx.say('c7.gary.intro');
    } else if (step === 1) {
      ctx.setFlag('garyStep', 2);
      await ctx.say('c7.gary.nineteen');
    } else if (step === 2) {
      ctx.setFlag('garyStep', 3);
      await ctx.say('c7.gary.payslip');
      if (!disposed) ctx.addEvidence('c7.clue.payslip');
    }
    garyBusy = false;
    if (disposed) return;
    // The payslip is in hand and the shop has not closed (also after a load between the two): it is six o'clock.
    if (garyStep() >= 3 && !flag('lastOrders.done')) await lastOrders();
    else if (step >= 3) void ctx.say('c7.gary.nineteen', { repeat: true });
  };

  /** Six o'clock. Gary closes the shop; the tourists leave, and Last Orders is in the kit. */
  const lastOrders = async (): Promise<void> => {
    garyBusy = true;
    // The tourists walk out of the front door while the scene plays (the timers run through it).
    ctx.after(CLOSE_DELAY_MS, startLeaving);
    await ctx.say('c7.lastOrders.lesson');
    garyBusy = false;
    if (disposed) return;
    finishLeaving();
    if (!knows('lastOrders')) ctx.learnMove('lastOrders');
    movePrompt('lastOrders', 4);
    setFlag('lastOrders.done');
    ctx.setExitLocked('c7.shop.stock', false);
    ctx.setObjective(OBJ.stock);
    ctx.completeSection('c7.explore.gary');
  };

  const startLeaving = (): void => {
    if (disposed || leaving !== null || flag('lastOrders.done')) return;
    leaving = FIGURES.filter((f) => TOURIST_FIGURES.includes(f.key)).map((f) => ({ id: f.npcId, from: T(f.col, f.row), ms: 0 }));
  };

  const stepLeaving = (): void => {
    if (leaving === null) return;
    for (const l of leaving) {
      l.ms += CLOSE_STEP_MS;
      const t = Math.min(1, l.ms / CLOSE_WALK_MS);
      ctx.setNpcPosition(l.id, { x: l.from.x + (SHOP_CLOSING_EXIT.x - l.from.x) * t, y: l.from.y + (SHOP_CLOSING_EXIT.y - l.from.y) * t });
    }
    if (leaving.every((l) => l.ms >= CLOSE_WALK_MS)) finishLeaving();
  };

  const finishLeaving = (): void => {
    if (leaving === null && !flag('lastOrders.done')) startLeaving();
    leaving = null;
    for (const f of FIGURES) if (TOURIST_FIGURES.includes(f.key)) ctx.setNpcVisible(f.npcId, false);
  };

  // --- The yard ---

  const startYard = async (): Promise<void> => {
    if (!ctx.isComplete(STEALTH) || ctx.isComplete(YARD)) return;
    if (ctx.fight(YARD)?.active === true || yardStarting) return;
    yardStarting = true;
    await ctx.say('c7.yard.intro');
    yardStarting = false;
    if (disposed || ctx.isComplete(YARD) || ctx.fight(YARD)?.active === true) return;
    ctx.setObjective(OBJ.yard);
    ctx.startSection(YARD);
  };

  // --- The van and the board ---

  const routeClue = (): void => {
    if (!flag('clue.route')) {
      setFlag('clue.route');
      ctx.completeMark('c7.clue.route');
      if (!ctx.isComplete('c7.explore.van')) ctx.completeSection('c7.explore.van');
      ctx.setObjective(OBJ.board);
    }
    // The log in hand and the board still open: the board opens again (after a load it does not by itself).
    if (ctx.isComplete(YARD) && !ctx.isComplete(BOARD)) ctx.openDeduction();
  };

  // --- The mascots ---

  const startMascots = async (): Promise<void> => {
    if (!ctx.isComplete(BOARD) || ctx.isComplete(BOSS)) return;
    if (ctx.boss(BOSS)?.active === true || mascotsStarting) return;
    mascotsStarting = true;
    await ctx.say('c7.mascots.intro');
    mascotsStarting = false;
    if (disposed || ctx.isComplete(BOSS) || ctx.boss(BOSS)?.active === true) return;
    ctx.setObjective(OBJ.mascots);
    ctx.startSection(BOSS);
  };

  /** Andrew in the arena with the board done and the mascots not beaten: they come out. */
  const stripPoll = (): void => {
    if (disposed || ctx.currentScreen() !== 'c7.strip') return;
    const p = ctx.playerPosition();
    if (mykoAtBar && p.x >= BAR_LEAVE_X) {
      mykoAtBar = false;
      ctx.setMykoScripted(null);
    }
    const a = MASCOT_ARENA_AREA;
    if (p.x >= a.x && p.x < a.x + a.width && p.y >= a.y && p.y < a.y + a.height) void startMascots();
  };

  const mascotHooks: BossHooks = {
    onStart: () => {
      ctx.setPropVisible('mascot.sign', false);
    },
    onEnd: (_boss, by) => {
      mascotsBy = by;
      ctx.setPropVisible('mascot.sign', false);
      void finale();
    },
  };

  /** Zorp's sign lies where he stood for the few seconds it is out of his hands. */
  const dropSign = (): void => {
    const zorp = ctx.boss(BOSS)?.body('zorp');
    if (zorp === undefined) return;
    ctx.setPropTile('mascot.sign', Math.floor(zorp.pos.x / 16), Math.floor(zorp.pos.y / 16));
    ctx.setPropVisible('mascot.sign', true);
  };

  /** The applause, the dollar, the prize, and then the night outside the shop. */
  const finale = async (): Promise<void> => {
    if (ending) return;
    ending = true;
    ctx.setObjective(null);
    // The crowd turns to him and claps; the one who tips comes over.
    const here = ctx.playerPosition();
    for (let i = 0; i < 4; i++) ctx.setNpcFacing(`crowd${i + 1}`, here.x < 480 ? 'left' : 'right');
    ctx.setNpcPosition('tipper', { x: here.x + 24, y: here.y });
    ctx.setNpcFacing('tipper', 'left');
    if (mascotsBy !== 'myko') await ctx.say('c7.mascots.end');
    if (disposed) return;
    if (!ctx.kit().weapons.includes('inflatableAlien')) {
      ctx.gainWeapon('inflatableAlien');
      ctx.setPropFrame('strip.rack', PROP.inflatableRack.taken);
      await ctx.say('c7.weapon.inflatable');
      if (disposed) return;
    }
    await new Promise<void>((resolve) => ctx.after(BEFORE_CLOSING_MS, resolve));
    if (disposed) return;
    await closing();
  };

  /** Outside the shop at night. Gary sees Andrew off. */
  const closing = async (): Promise<void> => {
    ctx.sunset();
    for (const id of LAMP_IDS) ctx.setPropFrame(id, PROP.eyeLamp.night);
    ctx.setMykoScripted(null);
    ctx.setPlayerPosition(CLOSING_SPOT);
    ctx.setNpcVisible('closing.gary', true);
    ctx.setNpcFacing('closing.gary', 'left');
    await ctx.say('c7.closing');
    if (disposed) return;
    ctx.completeChapter();
  };

  /** A load or a return to the bar with the mascots already beaten: the finale plays again from the prize. */
  const resumeEnding = (): void => {
    if (ctx.isComplete(BOSS) && !ending) {
      mascotsBy = 'player';
      ctx.after(0, () => void finale());
    }
  };

  const enteredScreen = (screenId: string): void => {
    parkMyko();
    restoreWorld();
    restoreObjective();
    if (screenId === 'c7.shop') shopEntered();
  };

  return {
    onStart: () => {
      restoreWorld();
      parkMyko();
      unsubs.push(
        ctx.bus.on(GameEvents.KitChanged, () => syncSteam()),
        ctx.bus.on(GameEvents.PickupCollected, ({ pickupId }) => {
          if (pickupId !== 'c7.pickup.stout') return;
          setFlag('stout.taken');
          ctx.setPropVisible('stock.stout', false);
        }),
        ctx.bus.on(GameEvents.SectionStarted, ({ sectionId }) => {
          if (sectionId === STEALTH) void ctx.say('c7.stock.open');
        }),
        ctx.bus.on(GameEvents.StealthAlarm, ({ sectionId }) => {
          if (sectionId === STEALTH) void ctx.say('c7.stock.caught');
        }),
        ctx.bus.on(GameEvents.StealthCleanRun, ({ sectionId }) => {
          if (sectionId !== STEALTH) return;
          // The clean-run reward: a can of stout in the staff fridge, with Gary's name on it.
          setFlag('stock.clean');
          restoreWorld();
          void ctx.say('c7.stock.clean');
        }),
        ctx.bus.on(GameEvents.TellsExamined, ({ puzzleId }) => {
          if (puzzleId === TELLS && tells()?.allExamined() === true) openTellsSoon();
        }),
        ctx.bus.on(GameEvents.MascotsChanged, ({ bossId, phase, tag }) => {
          if (bossId !== BOSS) return;
          if (phase === 'signKnocked') dropSign();
          else if (phase === 'signBack') ctx.setPropVisible('mascot.sign', false);
          else if (phase === 'fell') {
            const left = ctx.boss(BOSS)?.aliveActors().length ?? 0;
            // `fell` fires as the body goes down, so the count of the others still up tells which one it was.
            if (tag !== undefined && left === 2) void ctx.say('c7.mascots.first');
            else if (tag !== undefined && left === 1) void ctx.say('c7.mascots.second');
          }
        }),
        ctx.bus.on(GameEvents.DialogueShow, ({ sequenceId }) => {
          if (!hasSequence(sequenceId)) return;
          const delivery = sequence(sequenceId).delivery;
          if (delivery !== 'caption') dialogueOpen++;
          if (delivery === 'scene') {
            scenesOpen++;
            sync();
          }
        }),
        ctx.bus.on(GameEvents.DialogueFinished, ({ sequenceId }) => {
          if (!hasSequence(sequenceId)) return;
          const delivery = sequence(sequenceId).delivery;
          if (delivery !== 'caption') dialogueOpen = Math.max(0, dialogueOpen - 1);
          if (delivery === 'scene') {
            scenesOpen = Math.max(0, scenesOpen - 1);
            sync();
          }
        }),
        ctx.every(STRIP_POLL_MS, stripPoll),
        ctx.every(CLOSE_STEP_MS, stepLeaving),
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
      dialogueOpen = 0;
      garyBusy = false;
      yardStarting = false;
      mascotsStarting = false;
      tellsOpening = false;
      leaving = null;
      clearPrompt();
      restoreWorld();
      mykoAtBar = true;
      ctx.setMykoScripted(MYKO_BAR);
      if (!flag('intro.done')) {
        void opening();
        return;
      }
      restoreObjective();
      resumeEnding();
      void (async () => {
        await ctx.say('c7.bar.return');
        if (disposed) return;
        if (ctx.hotDrinkOffered()) {
          setPrompt('ui.prompt.hotDrink', PROMPT_LINGER_MS);
          await ctx.say('c7.bar.hotDrink');
        }
      })();
    },

    onScreenEntered: (screenId) => {
      clearPrompt();
      enteredScreen(screenId);
    },

    onTrigger: (id) => {
      switch (id) {
        case 'c7.trig.shopDoor':
          // Walking up to the shop's door: the strip is done.
          if (!ctx.isComplete('c7.explore.strip')) {
            ctx.completeSection('c7.explore.strip');
            if (!ctx.isComplete(TELLS)) ctx.setObjective(OBJ.tells);
          }
          break;
        case 'c7.trig.shop':
          shopEntered();
          break;
        case 'c7.trig.yard':
          void startYard();
          break;
        case 'c7.trig.mascots':
          void startMascots();
          break;
        case 'c7.trig.overheard.1':
        case 'c7.trig.overheard.2':
        case 'c7.trig.overheard.3':
        case 'c7.trig.overheard.4':
          if (stockActive()) void ctx.say(`c7.stock.overheard.${id.slice(-1)}`);
          break;
      }
    },

    onExamine: (id) => {
      switch (id) {
        case 'c7.bar.hotDrink':
          hotDrink();
          return true;
        case 'c7.bar.tequila':
          bartender();
          return true;
        case 'c7.clue.leaflet':
          return undefined;
        case 'c7.tells.a':
        case 'c7.tells.b':
        case 'c7.tells.c':
        case 'c7.tells.d':
        case 'c7.tells.e':
          // The line plays and the puzzle records it; a figure looked at again, with all six seen, opens the accuse screen again.
          if (tells()?.allExamined() === true) openTellsSoon();
          return undefined;
        case 'c7.gary':
          garyExamined();
          return true;
        case 'c7.stock.fridge':
          // Only a clean run puts anything in the fridge; its line plays then.
          return !flag('stock.clean');
        case 'c7.clue.route':
          routeClue();
          return undefined;
      }
      return undefined;
    },

    onSectionCompleted: (sectionId: SectionId, by) => {
      switch (sectionId) {
        case TELLS:
          ctx.setObjective(OBJ.gary);
          if (by !== 'myko') void ctx.say('c7.tells.right');
          break;
        case STEALTH:
          ctx.setMykoScripted(null);
          ctx.setObjective(OBJ.yard);
          break;
        case YARD:
          ctx.setObjective(OBJ.van);
          if (by !== 'myko') void ctx.say('c7.yard.end');
          break;
        case BOARD:
          ctx.setObjective(OBJ.mascots);
          if (by !== 'myko') void ctx.say('c7.board.right');
          break;
      }
    },

    bossHooks: { [BOSS]: mascotHooks },

    debugWalk: () => {
      setFlag('intro.done');
      setFlag('lastOrders.done');
      ctx.setFlag('garyStep', 3);
      ctx.setMykoScripted(null);
    },

    dispose: () => {
      disposed = true;
      for (const off of unsubs) off();
      hidePrompt();
    },
  };
}
