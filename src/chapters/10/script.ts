/**
 * Chapter 10 script: every beat in docs/chapters/10-disclosure.md, in order. All text is referred to by ID; all numbers
 * come from `TUNING`, the systems or `./maps`. Nothing here guards a start with a saved "started" flag: the anteroom fight
 * (the ticket), the Administrator (walking into the control room) and the broadcast (the dais) start again after a load or a
 * return to the cabinet, because each tests that the section is not complete and not already under way. Finished sections
 * stay finished.
 *
 * The beats: the cabinet, ticket 848 and the anteroom fight (the door to control is locked until it is won), the
 * Administrator (three phases, three offers, his end), the broadcast console (five plugs, one button), the world's reaction
 * as cards, the cut to Feeney's (no meter), the stool, Dympna, the epilogue (two versions of the calls remark, chosen only
 * by `ctx.mykoCallsUsed()`, nothing drawn) and the credits.
 */

import { PROP } from '../../art/props';
import { GameEvents } from '../../core/types';
import type { SectionId, TextId } from '../../core/types';
import type { BossHooks, ChapterContext, ChapterScript, EpilogueCard, FightHooks } from '../../systems';
import { hidePrompt, openBroadcastConsole, openHotDrinkChoice, showPrompt } from '../../ui/prompts';
import { CONTROL_TO_PUB, MYKO_BAR, MYKO_CONTROL, MYKO_PUB, PUB_STOOL } from './maps';

const OBJ = {
  anteroom: 'c10.anteroom',
  administrator: 'c10.administrator',
  broadcast: 'c10.broadcast',
  button: 'c10.button',
  pub: 'c10.pub',
  sit: 'c10.sit',
} as const;

const FIGHT = 'c10.fight.anteroom';
const BOSS = 'c10.boss.administrator';
const PUZZLE = 'c10.puzzle.broadcast';
const EXPLORE_BAR = 'c10.explore.bar';
const EXPLORE_PUB = 'c10.explore.pub';

/** Presentation only: how long a prompt may linger when nothing the player does can dismiss it. */
const PROMPT_LINGER_MS = 7000;
/** Presentation only: how long a caption card stays on screen, and how long the credits roll. */
const CARD_CAPTION_MS = 4000;
const CARD_SHORT_MS = 2500;
const CREDITS_MS = 12000;

/** The world's reaction (docs beat 5): governments, the news, Andrew's video, Colleen-Ann, Pruitt, and a week on. */
const REACTION: readonly EpilogueCard[] = [
  { id: 'governments', kind: 'caption', textId: 'c10.reaction.governments', durationMs: CARD_CAPTION_MS },
  { id: 'statement', kind: 'caption', textId: 'c10.reaction.statement', durationMs: CARD_CAPTION_MS },
  { id: 'news', kind: 'scene', sceneId: 'c10.reaction.news', durationMs: 0 },
  { id: 'views', kind: 'caption', textId: 'c10.reaction.views', durationMs: CARD_SHORT_MS },
  { id: 'comment', kind: 'scene', sceneId: 'c10.reaction.comment', durationMs: 0 },
  { id: 'colleen', kind: 'scene', sceneId: 'c10.reaction.colleen', durationMs: 0 },
  { id: 'lake', kind: 'caption', textId: 'c10.reaction.lake', durationMs: CARD_CAPTION_MS },
  { id: 'week', kind: 'caption', textId: 'c10.reaction.week', durationMs: CARD_SHORT_MS },
];

/** The title card (waits for a key) and the credits. */
const ENDING: readonly EpilogueCard[] = [
  { id: 'title', kind: 'title', textId: 'c10.credits.title', durationMs: 0 },
  { id: 'credits', kind: 'credits', lines: ['c10.credits.line1', 'c10.credits.line2', 'c10.credits.line3', 'c10.credits.thanks'], durationMs: CREDITS_MS },
];

type Flag = 'intro.done';

export function createChapterScript(ctx: ChapterContext): ChapterScript {
  let disposed = false;
  const unsubs: Array<() => void> = [];
  /** Bumped by a return to the bar and by dispose: an async chain from an older run stops. */
  let epoch = 0;
  /** Run-time only (a return to the bar clears them). */
  let ticketBusy = false;
  let bossStarting = false;
  let consoleShown = false;
  let aftermath = false;
  let epilogue = false;

  const flag = (key: Flag): boolean => ctx.flag(key) === true;
  const setFlag = (key: Flag, value = true): void => ctx.setFlag(key, value);

  // --- What is done ---

  const fightDone = (): boolean => ctx.isComplete(FIGHT);
  const bossDone = (): boolean => ctx.isComplete(BOSS);
  const puzzleDone = (): boolean => ctx.isComplete(PUZZLE);
  const pressed = (): boolean => ctx.broadcast(PUZZLE)?.pressed === true;
  const pubDone = (): boolean => ctx.isComplete(EXPLORE_PUB);
  const fightActive = (): boolean => ctx.fight(FIGHT)?.active === true;
  const bossActive = (): boolean => ctx.boss(BOSS)?.active === true;

  /** The objective Andrew should have, from what has happened so far. */
  const restoreObjective = (): void => {
    if (!flag('intro.done')) return;
    if (pubDone()) ctx.setObjective(null);
    else if (ctx.currentScreen() === 'c10.pub') ctx.setObjective(OBJ.sit);
    else if (pressed()) ctx.setObjective(OBJ.pub);
    else if (puzzleDone()) ctx.setObjective(OBJ.button);
    else if (bossDone()) ctx.setObjective(OBJ.broadcast);
    else if (fightDone()) ctx.setObjective(OBJ.administrator);
    else ctx.setObjective(OBJ.anteroom);
  };

  const syncSteam = (): void => ctx.setPropVisible('bar.steam', ctx.hotDrinkOffered());

  /** Run-time dressing and locks are not saved. Put them back from what is finished. */
  const restoreWorld = (): void => {
    // The door to control stays locked until reception is cleared: a director ruling.
    ctx.setExitLocked('c10.ante.control', !fightDone());
    syncSteam();
    // The desk shield is up until he is beaten; the jacket is on its hook once it is off him.
    ctx.setPropVisible('control.shield', !bossDone());
    ctx.setPropFrame('control.hook', bossDone() ? PROP.coatHook.jacket : PROP.coatHook.empty);
    ctx.setPropFrame('control.button', pressed() ? PROP.bigButton.pressed : puzzleDone() ? PROP.bigButton.ready : PROP.bigButton.covered);
  };

  const parkMyko = (): void => {
    const here = ctx.currentScreen();
    if (here === 'c10.anteroom') ctx.setMykoScripted(MYKO_BAR);
    else if (here === 'c10.control') ctx.setMykoScripted(bossDone() ? null : MYKO_CONTROL);
    else ctx.setMykoScripted(MYKO_PUB);
  };

  // --- Prompts: one at a time ---

  const setPrompt = (id: TextId, lingerMs: number): void => {
    showPrompt(id);
    ctx.after(lingerMs, () => hidePrompt(id));
  };

  // --- The cabinet ---

  const opening = async (): Promise<void> => {
    void ctx.say('c10.caption.title');
    void ctx.say('c10.caption.anteroom');
    await ctx.say('c10.bar.open');
    if (disposed) return;
    setFlag('intro.done');
    ctx.setObjective(OBJ.anteroom);
    if (ctx.hotDrinkOffered()) setPrompt('ui.prompt.hotDrink', PROMPT_LINGER_MS);
  };

  const barSection = (): void => {
    if (!ctx.isComplete(EXPLORE_BAR)) ctx.completeSection(EXPLORE_BAR);
  };

  /** E at the trolley: the hot drink. The first time it is also the bar section. */
  const tea = (): void => {
    barSection();
    if (ctx.hotDrinkOffered()) {
      hidePrompt('ui.prompt.hotDrink');
      void ctx.say('c10.bar.hotDrink', { repeat: true });
      openHotDrinkChoice();
    } else void ctx.say('c10.bar.hotDrink', { repeat: true });
  };

  // --- The anteroom ---

  /** E at the ticket machine: number 848, and the fight starts. Taking it again after a return starts it again. */
  const ticket = async (): Promise<void> => {
    if (fightDone() || fightActive() || ticketBusy) return;
    ticketBusy = true;
    const mine = epoch;
    barSection();
    await ctx.say('c10.open');
    ticketBusy = false;
    if (disposed || mine !== epoch) return;
    if (!fightDone() && !fightActive()) ctx.startSection(FIGHT);
    ctx.setObjective(OBJ.anteroom);
  };

  const fightHooks: FightHooks = {
    onWaveSpawned: (index) => {
      if (index === 1) void ctx.say('c10.anteroom.wave2');
    },
  };

  const fightEnded = (by: string): void => {
    restoreWorld();
    ctx.setObjective(OBJ.administrator);
    if (by !== 'myko') void ctx.say('c10.anteroom.end');
  };

  // --- The Administrator ---

  /** Walking in (or arriving, or loading in) with reception cleared: his intro, then the boss. No flag: not done and not under way. */
  const startBoss = async (): Promise<void> => {
    if (!fightDone() || bossDone() || bossActive() || bossStarting) return;
    bossStarting = true;
    const mine = epoch;
    ctx.setObjective(OBJ.administrator);
    await ctx.say('c10.admin.intro');
    bossStarting = false;
    if (disposed || mine !== epoch) return;
    if (!bossDone() && !bossActive()) ctx.startSection(BOSS);
  };

  const bossHooks: BossHooks = {
    onStart: () => {
      ctx.setPropVisible('control.shield', true);
      ctx.setPropFrame('control.hook', PROP.coatHook.empty);
    },
    onPhaseChanged: (_boss, phase) => {
      if (phase.id === 'restructuring') void ctx.say('c10.admin.phase2');
      else if (phase.id === 'personally') void ctx.say('c10.admin.phase3');
    },
    onEnd: () => {
      restoreWorld();
      parkMyko();
      ctx.setObjective(OBJ.broadcast);
      void ctx.say('c10.admin.end');
    },
  };

  const onAdministrator = (phase: string, offer: number | undefined): void => {
    if (phase === 'shieldDown') ctx.setPropVisible('control.shield', false);
    else if (phase === 'shieldUp') ctx.setPropVisible('control.shield', true);
    else if (phase === 'jacketOff') {
      ctx.setPropVisible('control.shield', false);
      ctx.setPropFrame('control.hook', PROP.coatHook.jacket);
    } else if (phase === 'sits') ctx.setPropVisible('control.shield', false);
    else if (phase === 'offer' && offer !== undefined) void ctx.say(`c10.admin.offer${offer}`);
  };

  // --- The broadcast ---

  /** The puzzle is the current section as soon as the boss is down, so Myko can be called in on it. */
  const armPuzzle = (): void => {
    if (!bossDone() || puzzleDone()) return;
    ctx.startSection(PUZZLE);
    ctx.setObjective(OBJ.broadcast);
  };

  /** Walking onto the dais: the intro (once per save) and the console. */
  const consoleTrigger = async (): Promise<void> => {
    if (!bossDone() || puzzleDone() || consoleShown) return;
    consoleShown = true;
    const mine = epoch;
    armPuzzle();
    await ctx.say('c10.broadcast.intro');
    if (disposed || mine !== epoch) return;
    if (!puzzleDone()) openBroadcastConsole();
  };

  const broadcastReady = (by: string): void => {
    restoreWorld();
    ctx.setObjective(OBJ.button);
    if (by !== 'myko') void ctx.say('c10.broadcast.ready');
  };

  /**
   * The button was pressed: the broadcast is sent, the world reacts, and Andrew is home. No flag says it ran: pressed and not
   * yet home (a load starts at the cabinet, so the cards play from wherever he is).
   */
  const afterPress = async (): Promise<void> => {
    if (aftermath || !pressed() || pubDone() || ctx.currentScreen() === 'c10.pub') return;
    aftermath = true;
    const mine = epoch;
    restoreWorld();
    ctx.setObjective(OBJ.pub);
    if (ctx.currentScreen() === 'c10.control') {
      await ctx.say('c10.broadcast.sent', { repeat: true });
      if (disposed || mine !== epoch) return;
    }
    await ctx.playCards(REACTION);
    aftermath = false;
    if (disposed || mine !== epoch) return;
    ctx.goToScreen(CONTROL_TO_PUB.screenId, CONTROL_TO_PUB.spawn);
  };

  // --- Feeney's ---

  const pubArrival = (): void => {
    parkMyko();
    ctx.setObjective(pubDone() ? null : OBJ.sit);
    void ctx.say('c10.caption.pub');
    if (!pubDone()) void ctx.say('c10.pub.enter');
    // Back here after he had sat (a load): the epilogue plays again from the stool, and the chapter still ends.
    else void sit();
  };

  /** E at the stool: he sits, Dympna, the epilogue, the title card and the credits, then the chapter is done. */
  const sit = async (): Promise<void> => {
    if (epilogue) return;
    epilogue = true;
    const mine = epoch;
    ctx.sitDown(PUB_STOOL, 'up');
    if (!pubDone()) ctx.completeSection(EXPLORE_PUB);
    ctx.setObjective(null);
    const play = async (id: string): Promise<boolean> => {
      await ctx.say(id, { repeat: true });
      return !disposed && mine === epoch;
    };
    if (!(await play('c10.pub.dympna'))) return;
    if (!(await play('c10.epilogue.1'))) return;
    if (!(await play('c10.epilogue.2'))) return;
    // The two versions of the calls remark: nothing is drawn, nothing else changes, and Dympna never says how many.
    if (ctx.mykoCallsUsed() === 0 && !(await play('c10.epilogue.calls.unused'))) return;
    if (!(await play('c10.epilogue.3'))) return;
    if (!(await play('c10.epilogue.ohio'))) return;
    await ctx.playCards(ENDING);
    if (disposed || mine !== epoch) return;
    ctx.completeChapter();
  };

  // --- Entering a screen ---

  const entered = (screenId: string): void => {
    hidePrompt();
    parkMyko();
    restoreWorld();
    restoreObjective();
    if (screenId === 'c10.anteroom') void ctx.say('c10.caption.anteroom');
    else if (screenId === 'c10.control') {
      void ctx.say('c10.caption.control');
      consoleShown = false;
      // A load or a return puts a section that was on again: coming in starts it, with no flag to say it ran before.
      ctx.after(0, () => {
        if (disposed || ctx.currentScreen() !== 'c10.control') return;
        if (pressed()) void afterPress();
        else {
          void startBoss();
          armPuzzle();
        }
      });
    } else if (screenId === 'c10.pub') pubArrival();
  };

  return {
    onStart: () => {
      restoreWorld();
      parkMyko();
      unsubs.push(
        ctx.bus.on(GameEvents.KitChanged, () => syncSteam()),
        ctx.bus.on(GameEvents.AdministratorChanged, (e) => {
          if (e.bossId === BOSS) onAdministrator(e.phase, e.offer);
        }),
        ctx.bus.on(GameEvents.BroadcastChanged, (e) => {
          if (e.puzzleId !== PUZZLE) return;
          if (e.phase === 'pressed') {
            restoreWorld();
            void afterPress();
          }
        }),
      );
      if (!flag('intro.done')) void opening();
      else {
        restoreObjective();
        // A load starts at the cabinet. Home already (he had sat down): back to Feeney's for the epilogue. Pressed and not yet
        // home: the world reacts. Otherwise what is on the screen starts again as he walks in.
        if (pubDone()) ctx.goToScreen(CONTROL_TO_PUB.screenId, CONTROL_TO_PUB.spawn);
        else if (pressed()) void afterPress();
        else if (ctx.currentScreen() === 'c10.control') entered('c10.control');
      }
    },

    /** Andrew is back at the cabinet. Flags are what the last save held and the unfinished section has started over. */
    onBarReturn: () => {
      epoch++;
      ticketBusy = false;
      bossStarting = false;
      consoleShown = false;
      aftermath = false;
      epilogue = false;
      hidePrompt();
      restoreWorld();
      parkMyko();
      if (!flag('intro.done')) {
        void opening();
        return;
      }
      restoreObjective();
      void (async () => {
        await ctx.say('c10.bar.return');
        if (disposed) return;
        if (ctx.hotDrinkOffered()) {
          setPrompt('ui.prompt.hotDrink', PROMPT_LINGER_MS);
          await ctx.say('c10.bar.hotDrink');
        }
      })();
    },

    onScreenEntered: (screenId) => entered(screenId),

    onTrigger: (id) => {
      switch (id) {
        case 'c10.trig.control':
          void startBoss();
          break;
        case 'c10.trig.console':
          void consoleTrigger();
          break;
      }
    },

    onExamine: (id) => {
      switch (id) {
        case 'c10.bar.hotDrink':
          tea();
          return true;
        case 'c10.ticket':
          void ticket();
          return true;
        case 'c10.pub.stool':
          void sit();
          return true;
      }
      // E at a channel socket opens the console (the run examines the socket itself); E at the button presses it once all five are in.
      if (id.startsWith('c10.channel.') && bossDone() && !puzzleDone()) openBroadcastConsole();
      return undefined;
    },

    onSectionCompleted: (sectionId: SectionId, by) => {
      switch (sectionId) {
        case FIGHT:
          fightEnded(by);
          break;
        case BOSS:
          restoreWorld();
          parkMyko();
          armPuzzle();
          break;
        case PUZZLE:
          broadcastReady(by);
          break;
      }
    },

    fightHooks: { [FIGHT]: fightHooks },
    bossHooks: { [BOSS]: bossHooks },

    debugWalk: () => {
      setFlag('intro.done');
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
