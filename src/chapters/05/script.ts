/**
 * Chapter 5 script: every beat in docs/chapters/05-the-paper-trail.md, in order. All text is referred to by ID; the
 * fight's, the boss's and the shelves' numbers come from `TUNING`.
 *
 * The reload trap: nothing here guards a start with a saved "started" flag. The copier (the cubicle fight) and the
 * Pruitt trigger start their section when it is not complete and not already under way, so a load, or a return to
 * the bar, lets Andrew start it again by the same trigger.
 */

import { PROP } from '../../art/props';
import { hasSequence, sequence } from '../../content/dialogue';
import { TUNING } from '../../content/tuning';
import { GameEvents } from '../../core/types';
import type { ScreenAmbient } from '../../core/chapter';
import type { MoveId, SectionId, SpecialSlotIndex, TextId } from '../../core/types';
import type { BossHooks, ChapterContext, ChapterScript, FightHooks } from '../../systems';
import { hidePrompt, openHotDrinkChoice, showPrompt, showSlotPrompt } from '../../ui/prompts';
import { FLOOR_MYKO_SPOT, LANES, LOBBY_MYKO_SPOT, MYKO_CHAIR, PRUITT_ADDS, PRUITT_ENTRANCE, SHELF_ROWS, SHELF_ROW_COUNT, SHELF_UNIT_COLS, shelfPropId } from './maps';

const OBJ = {
  lobby: 'c5.lobby',
  floor: 'c5.floor',
  files: 'c5.files',
  redacted: 'c5.redacted',
  fight: 'c5.fight',
  board: 'c5.board',
  pruitt: 'c5.pruitt',
} as const;

const PUZZLE = 'c5.puzzle.redacted';
const FIGHT = 'c5.fight.floor';
const BOARD = 'c5.deduction.ohio';
const BOSS = 'c5.boss.pruitt1';
const STEALTH_LOBBY = 'c5.stealth.lobby';
const STEALTH_FLOOR = 'c5.stealth.floor';

/** Presentation only: how long a prompt may linger when nothing the player does can dismiss it. */
const PROMPT_LINGER_MS = 7000;
/** The fallback for the Act Natural lesson: Andrew is past the queue's ropes (north of this row, tiles). */
const LESSON_ROW = 12;
/** How long a shelf takes to slide back and open its lane again (presentation only). */
const SHELF_REOPEN_MS = 400;
/** Tiles a unit slides to close the lane beside it. */
const SHELF_SLIDE_TILES = -2;
/** A light along a lit lane, so the rails glow along their whole length (presentation only). */
const RAIL_LIGHTS_PER_LANE = 4;
const RAIL_LIGHT_RADIUS = 30;
/** The stacks at the end of the day (the closing scene's evening). */
const DUSK: ScreenAmbient = { tint: 'navyDark', strength: 0.3 };

const SHEET_COUNT = 5;
const SHEET_IDS = [1, 2, 3, 4, 5] as const;

type Flag =
  | 'intro.done'
  | 'actNatural.taught'
  | 'actNatural.done'
  | 'clue.retirement'
  | 'clue.requisition'
  | 'clue.busticket'
  | 'floor.clean'
  | 'memo.taken'
  | 'lockIn.taught'
  | 'lockIn.done';

export function createChapterScript(ctx: ChapterContext): ChapterScript {
  let disposed = false;
  const unsubs: Array<() => void> = [];
  /** Run-time only (never saved, so a load or a return to the bar clears them). */
  let fightStarting = false;
  let pruittStarting = false;
  let lessonBusy = false;
  let lightboxBusy = false;
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

  /** A new move: say press its key if it landed in its slot, else go to the Tab to put it there. */
  const movePrompt = (moveId: MoveId, slot: SpecialSlotIndex): void => {
    if (ctx.kit().slots.specials[slot - 1] === moveId) setPrompt('ui.prompt.slot', PROMPT_LINGER_MS, slot);
    else setPrompt('ui.prompt.kit', PROMPT_LINGER_MS);
  };

  // --- What has been found ---

  const redaction = () => ctx.redaction(PUZZLE);
  const sheetsHeld = (): number => redaction()?.collected().length ?? 0;
  const puzzleDone = (): boolean => ctx.isComplete(PUZZLE);
  const filesDone = (): boolean => sheetsHeld() >= SHEET_COUNT && flag('clue.requisition') && flag('clue.busticket');
  /** The three clues the board links: the line from the file, the corn order and the bus claim. */
  const boardReady = (): boolean => puzzleDone() && flag('clue.requisition') && flag('clue.busticket');
  const floorActive = (): boolean => ctx.currentScreen() === 'c5.floor' && !ctx.isComplete(STEALTH_FLOOR);
  const lobbyActive = (): boolean => ctx.currentScreen() === 'c5.lobby' && !ctx.isComplete(STEALTH_LOBBY);

  /** The objective Andrew should have, from what has happened so far. */
  const restoreObjective = (): void => {
    if (ctx.isComplete(BOSS)) ctx.setObjective(null);
    else if (ctx.isComplete(BOARD)) ctx.setObjective(OBJ.pruitt);
    else if (ctx.isComplete(FIGHT)) ctx.setObjective(boardReady() ? OBJ.board : OBJ.files);
    else if (puzzleDone()) ctx.setObjective(null);
    else if (ctx.isComplete('c5.explore.files')) ctx.setObjective(OBJ.redacted);
    else if (ctx.isComplete(STEALTH_FLOOR)) ctx.setObjective(OBJ.files);
    else if (ctx.isComplete(STEALTH_LOBBY)) ctx.setObjective(OBJ.floor);
    else if (flag('intro.done')) ctx.setObjective(OBJ.lobby);
  };

  const syncSteam = (): void => ctx.setPropVisible('bar.steam', ctx.hotDrinkOffered());

  // --- The shelves of the stacks: each unit slides west across the lane beside it ---

  /** Where each unit is now, in tiles from its start (0, or -2 when it has closed a lane). */
  const unitOffset: number[] = SHELF_UNIT_COLS.map(() => 0);
  const slides = new Map<number, { from: number; to: number; ms: number; dur: number }>();
  const litLanes = new Set<number>();
  const slideMs = (): number => TUNING.overhaul?.shelves?.slideMs ?? 600;

  const placeUnit = (unit: number): void => {
    const col = (SHELF_UNIT_COLS[unit] ?? 0) + (unitOffset[unit] ?? 0);
    for (let r = 0; r < SHELF_ROW_COUNT; r++) ctx.setPropTile(shelfPropId(unit, r), col, SHELF_ROWS.from + r);
  };

  /** The floor rails of a lit lane glow through the screen's tint. */
  const drawRails = (): void => {
    if (litLanes.size === 0) {
      ctx.setAmbient(null, 'c5.stacks');
      return;
    }
    const lights = [...litLanes].flatMap((k) => {
      const a = LANES[k]?.area;
      if (a === undefined) return [];
      return Array.from({ length: RAIL_LIGHTS_PER_LANE }, (_, i) => ({
        x: a.x + a.width / 2,
        y: a.y + ((i + 0.5) * a.height) / RAIL_LIGHTS_PER_LANE,
        radius: RAIL_LIGHT_RADIUS,
        colour: 'amberLight' as const,
        glow: 0.4,
      }));
    });
    ctx.setAmbient({ tint: 'navyDark', strength: 0.25, lights }, 'c5.stacks');
  };

  const resetShelves = (): void => {
    slides.clear();
    litLanes.clear();
    unitOffset.fill(0);
    for (let u = 0; u < SHELF_UNIT_COLS.length; u++) placeUnit(u);
    ctx.setPropFrame('crank', PROP.lever.up);
    drawRails();
  };

  const slideUnit = (unit: number, to: number, dur: number): void => {
    slides.set(unit, { from: unitOffset[unit] ?? 0, to, ms: 0, dur });
  };

  const laneIndex = (laneId: string): number => Number(laneId.replace('lane', ''));

  const onShelves = (phase: 'lit' | 'closing' | 'closed' | 'open' | 'caught', laneIds: readonly string[]): void => {
    for (const id of laneIds) {
      const k = laneIndex(id);
      const lane = LANES[k];
      if (lane === undefined) continue;
      if (phase === 'lit') litLanes.add(k);
      else if (phase === 'closing') {
        litLanes.delete(k);
        slideUnit(lane.closingUnit, SHELF_SLIDE_TILES, slideMs());
      } else if (phase === 'closed') {
        slides.delete(lane.closingUnit);
        unitOffset[lane.closingUnit] = SHELF_SLIDE_TILES;
        placeUnit(lane.closingUnit);
      } else if (phase === 'open') slideUnit(lane.closingUnit, 0, SHELF_REOPEN_MS);
    }
    if (phase === 'lit') ctx.setPropFrame('crank', PROP.lever.down);
    else if (phase === 'open') ctx.setPropFrame('crank', PROP.lever.up);
    if (phase === 'lit' || phase === 'closing') drawRails();
  };

  const stepSlides = (dtMs: number): void => {
    for (const [unit, s] of slides) {
      s.ms += dtMs;
      const t = Math.min(1, s.ms / s.dur);
      unitOffset[unit] = s.from + (s.to - s.from) * t;
      placeUnit(unit);
      if (t >= 1) slides.delete(unit);
    }
  };

  // --- Run-time dressing and locks are not saved: put them back from what is finished ---

  const restoreWorld = (): void => {
    syncSteam();
    for (const n of SHEET_IDS) ctx.setPropVisible(`sheet.${n}`, redaction()?.collected().includes(`sheet${n}`) !== true);
    ctx.setPropVisible('memo', flag('floor.clean') && !flag('memo.taken'));
    const fight = ctx.fight(FIGHT);
    ctx.setPropFrame('copier', fight?.active === true || ctx.isComplete(FIGHT) ? PROP.filingCabinet.open : PROP.filingCabinet.shut);
    ctx.setExitLocked('c5.floor.doors', !ctx.isComplete(BOARD));
    ctx.setPropVisible('umbrella', ctx.isComplete(BOSS) && !ctx.kit().weapons.includes('umbrella'));
    resetShelves();
  };

  const parkMyko = (): void => {
    const here = ctx.currentScreen();
    if (here === 'c5.bar') ctx.setMykoScripted(MYKO_CHAIR);
    else if (here === 'c5.lobby') ctx.setMykoScripted(LOBBY_MYKO_SPOT);
    else if (here === 'c5.floor') ctx.setMykoScripted(ctx.isComplete(STEALTH_FLOOR) ? null : FLOOR_MYKO_SPOT);
    // Pruitt speaks to Andrew alone: Myko keeps to the far end of the stacks, on the phone.
    else ctx.setMykoScripted(PRUITT_ENTRANCE);
  };

  // --- The bar ---

  const opening = async (): Promise<void> => {
    void ctx.say('c5.caption.title');
    void ctx.say('c5.caption.bar');
    await ctx.say('c5.bar.open');
    if (disposed) return;
    setFlag('intro.done');
    ctx.setObjective(OBJ.lobby);
    if (ctx.hotDrinkOffered()) setPrompt('ui.prompt.hotDrink', PROMPT_LINGER_MS);
  };

  let barmanLineOpen = false;
  /** E at the barman: the hot drink offer, once each visit. With nothing to give he says his line again (once at a time). */
  const barman = (): void => {
    if (!ctx.hotDrinkOffered()) {
      if (barmanLineOpen) return;
      barmanLineOpen = true;
      void ctx.say('c5.bar.hotDrink', { repeat: true }).finally(() => {
        barmanLineOpen = false;
      });
      return;
    }
    clearPrompt('ui.prompt.hotDrink');
    ctx.completeMark('c5.tea');
    openHotDrinkChoice();
    void ctx.say('c5.bar.hotDrink');
  };

  // --- The lobby ---

  const lobbyEntered = (): void => {
    if (!ctx.isComplete('c5.explore.bar')) ctx.completeSection('c5.explore.bar');
    if (flag('intro.done') && !ctx.isComplete(STEALTH_LOBBY)) ctx.setObjective(OBJ.lobby);
  };

  const actNaturalLesson = async (): Promise<void> => {
    if (flag('actNatural.taught') || lessonBusy) return;
    lessonBusy = true;
    setFlag('actNatural.taught');
    await ctx.say('c5.actNatural.lesson');
    lessonBusy = false;
    if (disposed) return;
    ctx.learnMove('actNatural');
    movePrompt('actNatural', 1);
  };

  /** The lesson must come before the guard matters: if Andrew walks past the queue or on to the floor without it, it plays then. */
  const lessonFallback = (): void => {
    if (flag('actNatural.taught') || lessonBusy) return;
    const here = ctx.currentScreen();
    if (here === 'c5.floor' || (here === 'c5.lobby' && ctx.playerPosition().y < LESSON_ROW * 16)) void actNaturalLesson();
  };

  // --- Files, the lightbox, the copier ---

  const filesProgress = (): void => {
    if (!filesDone() || ctx.isComplete('c5.explore.files')) return;
    ctx.completeSection('c5.explore.files');
    if (!puzzleDone()) ctx.setObjective(OBJ.redacted);
  };

  const collectSheet = async (n: number): Promise<void> => {
    if (!ctx.collectSheet(PUZZLE, `sheet${n}`)) return;
    ctx.setPropVisible(`sheet.${n}`, false);
    ctx.completeMark(`c5.sheet.${n}`);
    filesProgress();
    await ctx.say('c5.files.sheet');
  };

  const requisition = (): void => {
    setFlag('clue.requisition');
    ctx.completeMark('c5.requisition');
    ctx.addEvidence('c5.clue.requisition');
    void ctx.say('c5.files.requisition');
    filesProgress();
    boardCheck();
  };

  const busticket = (): void => {
    setFlag('clue.busticket');
    ctx.completeMark('c5.busticket');
    ctx.addEvidence('c5.clue.busticket');
    filesProgress();
    boardCheck();
  };

  /** Standing at the lightbox with all five sheets starts the puzzle (so Myko can be called on it) and plays the line once. */
  const lightboxIntro = async (): Promise<void> => {
    const r = redaction();
    if (r === null || puzzleDone() || !r.allCollected() || lightboxBusy) return;
    lightboxBusy = true;
    ctx.startSection(PUZZLE);
    ctx.setObjective(OBJ.redacted);
    await ctx.say('c5.redacted.intro');
    lightboxBusy = false;
  };

  const lightbox = async (): Promise<void> => {
    const r = redaction();
    if (r === null || lightboxBusy) return;
    if (puzzleDone() || !r.allCollected()) {
      lightboxBusy = true;
      await ctx.say('c5.examine.lightbox', { repeat: true });
      lightboxBusy = false;
      return;
    }
    await lightboxIntro();
    if (disposed || puzzleDone()) return;
    ctx.openRedaction(PUZZLE);
  };

  /** The copier: the page copied, the jam, and the building alarm (the cubicle fight), once the redaction is solved. */
  const copier = async (): Promise<void> => {
    if (!puzzleDone() || ctx.isComplete(FIGHT) || ctx.fight(FIGHT)?.active === true || fightStarting) return;
    fightStarting = true;
    ctx.completeMark('c5.copier');
    ctx.setPropFrame('copier', PROP.filingCabinet.open);
    await ctx.say('c5.copier');
    if (disposed) return;
    if (!flag('lockIn.taught')) {
      setFlag('lockIn.taught');
      await ctx.say('c5.lockIn.lesson');
      if (disposed) return;
      ctx.learnMove('lockIn');
      movePrompt('lockIn', 3);
    }
    await ctx.say('c5.fight.intro');
    if (disposed) return;
    ctx.setObjective(OBJ.fight);
    ctx.startSection(FIGHT);
    fightStarting = false;
  };

  const fightHooks: FightHooks = {
    onWaveSpawned: (index) => {
      if (index === 1) void ctx.say('c5.fight.wave2');
    },
  };

  /** Opens the board when the fight is won and all three clues are held; otherwise points Andrew back to what is missing. */
  const boardCheck = (): void => {
    if (!ctx.isComplete(FIGHT) || ctx.isComplete(BOARD)) return;
    if (boardReady()) {
      ctx.setObjective(OBJ.board);
      ctx.openDeduction();
    } else ctx.setObjective(OBJ.files);
  };

  const fightEnded = async (by: string): Promise<void> => {
    clearPrompt();
    if (by !== 'myko') await ctx.say('c5.fight.end');
    if (disposed) return;
    boardCheck();
  };

  // --- Pruitt ---

  const pruittArrives = async (): Promise<void> => {
    pruittStarting = true;
    await ctx.say('c5.pruitt.intro');
    if (disposed) return;
    ctx.setObjective(OBJ.pruitt);
    ctx.startSection(BOSS);
    pruittStarting = false;
  };

  const pruittHooks: BossHooks = {
    onStart: () => {
      resetShelves();
    },
    onPhaseChanged: (boss, phase) => {
      if (phase.id !== 'twoShelves') return;
      for (const at of PRUITT_ADDS) boss.spawnAdd('agent', at);
      void ctx.say('c5.pruitt.phase2');
    },
    onEnd: (_boss, by) => {
      resetShelves();
      ctx.setPropVisible('umbrella', true);
      ctx.setObjective(null);
      if (by !== 'myko') void ctx.say('c5.pruitt.end');
    },
  };

  /** The umbrella stand: before the boss it is only an umbrella stand; after, the umbrella is his to take and the day ends. */
  const umbrella = async (): Promise<void> => {
    if (!ctx.isComplete(BOSS)) {
      void ctx.say('c5.examine.umbrellaStand', { repeat: true });
      return;
    }
    if (ending) return;
    ending = true;
    ctx.setPropVisible('umbrella', false);
    if (!ctx.kit().weapons.includes('umbrella')) {
      ctx.gainWeapon('umbrella');
      await ctx.say('c5.weapon.umbrella');
      if (disposed) return;
    }
    // The bus station, in the evening.
    ctx.setAmbient(DUSK, ctx.currentScreen());
    await ctx.say('c5.closing');
    if (disposed) return;
    ctx.completeChapter();
  };

  return {
    onStart: () => {
      restoreWorld();
      parkMyko();
      unsubs.push(
        ctx.bus.on(GameEvents.KitChanged, () => syncSteam()),
        ctx.bus.on(GameEvents.BuzzLevelChanged, ({ to }) => {
          // Louder footsteps at Bit much matter here more than anywhere.
          if (to >= 3 && floorActive()) void ctx.say('c5.floor.loud');
        }),
        ctx.bus.on(GameEvents.MoveUsed, ({ moveId }) => {
          if (moveId === 'actNatural') {
            clearPrompt();
            if (flag('actNatural.taught') && !flag('actNatural.done') && lobbyActive()) {
              setFlag('actNatural.done');
              void ctx.say('c5.actNatural.done');
            }
          } else if (moveId === 'lockIn') {
            clearPrompt();
            if (flag('lockIn.taught') && !flag('lockIn.done') && ctx.fight(FIGHT)?.active === true) {
              setFlag('lockIn.done');
              void ctx.say('c5.lockIn.done');
            }
          }
        }),
        ctx.bus.on(GameEvents.ShelvesChanged, ({ bossId, phase, laneIds }) => {
          if (bossId === BOSS) onShelves(phase, laneIds);
        }),
        ctx.bus.on(GameEvents.StealthAlarm, ({ sectionId }) => {
          if (sectionId === STEALTH_LOBBY) void ctx.say('c5.lobby.caught');
          else if (sectionId === STEALTH_FLOOR) void ctx.say('c5.floor.caught');
        }),
        ctx.bus.on(GameEvents.StealthCleanRun, ({ sectionId }) => {
          if (sectionId !== STEALTH_FLOOR) return;
          // The clean-run reward: a memo on the desk in the third top cubicle.
          setFlag('floor.clean');
          ctx.setPropVisible('memo', !flag('memo.taken'));
          void ctx.say('c5.floor.clean');
        }),
        ctx.bus.on(GameEvents.RedactionTried, ({ puzzleId, correct }) => {
          if (puzzleId === PUZZLE && !correct) void ctx.say('c5.redacted.wrongLine', { repeat: true });
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
        ctx.every(400, lessonFallback),
      );
      if (!flag('intro.done')) void opening();
      else restoreObjective();
    },

    /** Andrew is back at the bar. Flags are what the last save held and the unfinished section has started over. */
    onBarReturn: () => {
      scenesOpen = 0;
      fightStarting = false;
      pruittStarting = false;
      lessonBusy = false;
      lightboxBusy = false;
      clearPrompt();
      restoreWorld();
      ctx.setMykoScripted(MYKO_CHAIR);
      if (!flag('intro.done')) {
        void opening();
        return;
      }
      restoreObjective();
      void (async () => {
        await ctx.say('c5.bar.return');
        if (disposed) return;
        if (ctx.hotDrinkOffered()) {
          setPrompt('ui.prompt.hotDrink', PROMPT_LINGER_MS);
          await ctx.say('c5.bar.hotDrink');
        }
      })();
    },

    onScreenEntered: (screenId) => {
      clearPrompt();
      parkMyko();
      restoreWorld();
      if (screenId === 'c5.lobby') lobbyEntered();
      else if (screenId === 'c5.floor') restoreObjective();
    },

    onUpdate: (dtMs) => {
      if (slides.size > 0) stepSlides(dtMs);
    },

    onTrigger: (id) => {
      switch (id) {
        case 'c5.trig.lobby':
          void ctx.say('c5.caption.lobby');
          void ctx.say('c5.open');
          break;
        case 'c5.trig.actNatural':
          void actNaturalLesson();
          break;
        case 'c5.trig.over1':
        case 'c5.trig.over2':
        case 'c5.trig.over3':
        case 'c5.trig.over4':
        case 'c5.trig.over5':
          if (floorActive()) void ctx.say(`c5.floor.overheard.${id.slice(-1)}`);
          break;
        case 'c5.trig.lightbox':
          void lightboxIntro();
          break;
        case 'c5.trig.pruitt':
          if (ctx.isComplete(BOARD) && !ctx.isComplete(BOSS) && ctx.boss(BOSS)?.active !== true && !pruittStarting) void pruittArrives();
          break;
      }
    },

    onExamine: (id) => {
      switch (id) {
        case 'c5.tea':
          barman();
          return true;
        case 'c5.ticket':
          void ctx.say('c5.examine.ticket', { repeat: true });
          return true;
        case 'c5.retirement':
          setFlag('clue.retirement');
          ctx.completeMark('c5.retirement');
          ctx.addEvidence('c5.clue.retirement');
          return true;
        case 'c5.sheet.1':
        case 'c5.sheet.2':
        case 'c5.sheet.3':
        case 'c5.sheet.4':
        case 'c5.sheet.5':
          void collectSheet(Number(id.slice(-1)));
          return true;
        case 'c5.requisition':
          requisition();
          return true;
        case 'c5.busticket':
          busticket();
          return true;
        case 'c5.memo':
          // Only a clean run puts the memo within reach.
          if (flag('floor.clean') && !flag('memo.taken')) {
            setFlag('memo.taken');
            ctx.setPropVisible('memo', false);
            ctx.addEvidence('c5.clue.memo');
          }
          return true;
        case 'c5.lightbox':
          void lightbox();
          return true;
        case 'c5.copier':
          void copier();
          return true;
        case 'c5.umbrella':
          void umbrella();
          return true;
      }
      return undefined;
    },

    onSectionCompleted: (sectionId: SectionId, by) => {
      switch (sectionId) {
        case STEALTH_LOBBY:
          ctx.completeSection('c5.explore.lobby');
          ctx.setObjective(OBJ.floor);
          parkMyko();
          break;
        case STEALTH_FLOOR:
          ctx.setMykoScripted(null);
          ctx.setObjective(filesDone() ? OBJ.redacted : OBJ.files);
          break;
        case PUZZLE:
          ctx.setObjective(null);
          if (by !== 'myko') void ctx.say('c5.redacted.solved');
          break;
        case FIGHT:
          void fightEnded(by);
          break;
        case BOARD:
          ctx.setExitLocked('c5.floor.doors', false);
          ctx.setObjective(OBJ.pruitt);
          if (by !== 'myko') void ctx.say('c5.board.right');
          break;
      }
    },

    fightHooks: { [FIGHT]: fightHooks },
    bossHooks: { [BOSS]: pruittHooks },

    debugWalk: () => {
      setFlag('intro.done');
      ctx.setMykoScripted(null);
    },

    dispose: () => {
      disposed = true;
      for (const off of unsubs) off();
      hidePrompt();
    },
  };
}
