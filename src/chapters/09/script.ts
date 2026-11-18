/**
 * Chapter 9 script: every beat in docs/chapters/09-level-minus-four.md, in order. All text is referred to by ID; all
 * numbers come from `TUNING`, the systems or `./maps`. Nothing here guards a start with a saved "started" flag: a fight,
 * puzzle or set piece begun by a trigger starts again after a load or a return to the bar, because the trigger tests that the
 * section is not complete and not already under way (never "already started"). After a bar return finished sections stay
 * finished and Andrew walks through them.
 *
 * The beats: the staff social area (the kettle and its steam), the offices stealth (overheard lines, the contract and the
 * directory, a clean run leaves a tequila), the Borrowed Glove in lost property, the three gravity rooms, the hangar window and
 * the records room, the labs fight, the board, the containment hall lockdown (doors, switches, the tape, the lift guard and
 * his wand) and the closing scene in the lift.
 *
 * Where the labs fight starts: the trigger strip at the west of the labs, once the gravity rooms and both labs proofs are in
 * (and straight after the second proof, once its scene is over, so a first run does not have to walk back for it).
 */

import { PROP } from '../../art/props';
import { hasSequence, sequence } from '../../content/dialogue';
import { TUNING } from '../../content/tuning';
import { GameEvents } from '../../core/types';
import type { SectionId, SpecialSlotIndex, TextId, Vec2 } from '../../core/types';
import type { AreaRect } from '../../core/chapter';
import type { BossHooks, ChapterContext, ChapterScript } from '../../systems';
import { hidePrompt, openHotDrinkChoice, showPrompt, showSlotPrompt } from '../../ui/prompts';
import { LOCKDOWN_ID } from './layouts';
import { GRAVITY_ROOMS, HALL_BAYS, LIFT_ROOM, MYKO_BAR, gravityCrateId } from './maps';

const OBJ = {
  offices: 'c9.offices',
  glove: 'c9.glove',
  gravity: 'c9.gravity',
  labs: 'c9.labs',
  fight: 'c9.fight',
  board: 'c9.board',
  lockdown: 'c9.lockdown',
} as const;

const STEALTH = 'c9.stealth.offices';
const GRAVITY = 'c9.puzzle.gravity';
const EXPLORE_LABS = 'c9.explore.labs';
const FIGHT = 'c9.fight.labs';
const BOARD = 'c9.deduction.uplink';
const SETPIECE = LOCKDOWN_ID;

/** Presentation only: how long a prompt may linger when nothing the player does can dismiss it. */
const PROMPT_LINGER_MS = 7000;
/** Presentation only: how long the proof count stays up. */
const COUNT_LINGER_MS = 3500;
/** Presentation only: the gravity switch's "no Glove" line is not repeated inside this time. */
const NO_GLOVE_COOLDOWN_MS = 5000;
/** Presentation only: how often the script checks that no scene is open before starting the next thing. */
const CLEAR_POLL_MS = 200;
const WAND = 'securityWand' as const;

type Flag = 'intro.done' | 'lobby.seen' | 'offices.clean' | 'tequila.taken';
type Proof = 'contract' | 'directory' | 'craft' | 'log';

const inRect = (r: AreaRect, p: Vec2, margin = 0): boolean => p.x >= r.x - margin && p.y >= r.y - margin && p.x <= r.x + r.width + margin && p.y <= r.y + r.height + margin;

export function createChapterScript(ctx: ChapterContext): ChapterScript {
  let disposed = false;
  const unsubs: Array<() => void> = [];
  /** Bumped by a return to the bar and by dispose: an async chain from an older run stops. */
  let epoch = 0;
  /** Run-time only (a return to the bar clears them). */
  let fightStarting = false;
  let lockStarting = false;
  let gloveTaking = false;
  let ending = false;
  let noGloveMs = 0;
  /** What the hall's props show now, so a tick only touches what changed. */
  let shownDoors: boolean[] = [];
  let shownBarriers: boolean[] = [];
  let shownLift: boolean | null = null;
  let shownTape: boolean | null = null;

  const flag = (key: Flag): boolean => ctx.flag(key) === true;
  const setFlag = (key: Flag, value = true): void => ctx.setFlag(key, value);

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

  /** Runs `fn` once no scene is open (a proof's scene, a fight's end line). Dropped by a return to the bar. */
  const afterScenes = (fn: () => void): void => {
    const mine = epoch;
    const stop = ctx.every(CLEAR_POLL_MS, () => {
      if (disposed || mine !== epoch) {
        stop();
        return;
      }
      if (scenesOpen > 0) return;
      stop();
      fn();
    });
  };

  // --- What is done ---

  const stealthDone = (): boolean => ctx.isComplete(STEALTH);
  const gravityDone = (): boolean => ctx.isComplete(GRAVITY);
  const labsDone = (): boolean => ctx.isComplete(EXPLORE_LABS);
  const fightDone = (): boolean => ctx.isComplete(FIGHT);
  const boardDone = (): boolean => ctx.isComplete(BOARD);
  const lockDone = (): boolean => ctx.isComplete(SETPIECE);
  const hasWand = (): boolean => ctx.kit().weapons.includes(WAND);

  /** A proof is in the casebook once its examinable's glint is done (the casebook is what the mark reads). */
  const proofTaken = (key: Proof): boolean => !ctx.objectiveMarks().some((m) => m.id === `c9.proof.${key}`);
  const footageTaken = (): boolean => ctx.lockdown(SETPIECE)?.view(ctx.boss(SETPIECE)).recorder?.taken === true;
  const officesDone = (): boolean => proofTaken('contract') && proofTaken('directory');
  const proofCount = (): number => (['contract', 'directory', 'craft', 'log'] as const).filter(proofTaken).length + (footageTaken() ? 1 : 0);

  /** The objective Andrew should have, from what has happened so far. */
  const restoreObjective = (): void => {
    if (!flag('intro.done')) return;
    if (lockDone()) ctx.setObjective(null);
    else if (boardDone()) ctx.setObjective(OBJ.lockdown);
    else if (fightDone()) ctx.setObjective(OBJ.board);
    else if (labsDone()) ctx.setObjective(OBJ.fight);
    else if (gravityDone()) ctx.setObjective(OBJ.labs);
    else if (!ctx.hasGlove()) ctx.setObjective(officesDone() || flag('lobby.seen') ? OBJ.glove : OBJ.offices);
    else if (!officesDone()) ctx.setObjective(OBJ.offices);
    else ctx.setObjective(OBJ.gravity);
  };

  const syncSteam = (): void => ctx.setPropVisible('bar.steam', ctx.hotDrinkOffered());

  // --- The hall's props, from the director's state ---

  const syncHall = (): void => {
    const dir = ctx.lockdown(SETPIECE);
    const boss = ctx.boss(SETPIECE);
    const done = lockDone();
    const view = dir?.view(boss) ?? null;
    HALL_BAYS.forEach((bay, i) => {
      const shut = !done && view?.bays[i]?.state === 'shut';
      if (shownDoors[i] !== shut) {
        shownDoors[i] = shut;
        for (const id of bay.door.propIds) ctx.setPropVisible(id, shut);
      }
      if (bay.gravity) {
        const up = !done && (view === null || view.bays[i]?.barrier !== null);
        if (shownBarriers[i] !== up) {
          shownBarriers[i] = up;
          for (const id of bay.gravity.barrier.propIds) ctx.setPropVisible(id, up);
        }
      }
    });
    const open = done || view?.lift.open === true;
    if (shownLift !== open) {
      shownLift = open;
      for (const id of ['hall.lift.a', 'hall.lift.b']) ctx.setPropFrame(id, open ? PROP.liftDoors.open : PROP.liftDoors.shut);
      ctx.setPropFrame('hall.guardChair', open ? PROP.liftGuardChair.onBreak : PROP.liftGuardChair.chair);
      ctx.setNpcVisible('hall.guard', !open);
    }
    const taken = done || footageTaken();
    if (shownTape !== taken) {
      shownTape = taken;
      if (taken) ctx.setPropFrame('hall.recorder', PROP.wallRecorder.empty, []);
      else ctx.setPropFrame('hall.recorder', PROP.wallRecorder.tape[0] ?? PROP.wallRecorder.empty, PROP.wallRecorder.tape);
    }
  };

  /** Run-time dressing, locks and pickups are not saved. Put them back from what is finished. */
  const restoreWorld = (): void => {
    // The offices.
    ctx.setPropFrame('offices.lostProperty', ctx.hasGlove() ? PROP.lostPropertyBox.empty : PROP.lostPropertyBox.withGlove);
    ctx.setPropFrame('offices.cabinet', proofTaken('contract') ? PROP.baseFilingCabinet.open : PROP.baseFilingCabinet.shut);
    ctx.setPropFrame('offices.board', proofTaken('directory') ? PROP.staffNoticeboard.taken : PROP.staffNoticeboard.full);
    ctx.setPropVisible('offices.tequila', flag('offices.clean') && !flag('tequila.taken'));
    syncSteam();
    // The labs: the world view draws the live crates, so the starting-place props go; one box is gone from the shelves after the log.
    for (const room of GRAVITY_ROOMS) room.crates.forEach((_, k) => ctx.setPropVisible(gravityCrateId(room, k), false));
    ctx.setPropFrame('records.shelves', proofTaken('log') ? PROP.recordsShelves.taken : PROP.recordsShelves.full);
    // The hall is shut to Andrew until the board names the lift.
    ctx.setExitLocked('c9.labs.hall', !boardDone());
    // The hall: restart the cache so everything is set again, from the director's state.
    shownDoors = [];
    shownBarriers = [];
    shownLift = null;
    shownTape = null;
    syncHall();
    // The wand is run-time only: with the set piece done and no wand in the kit it is left again.
    if (lockDone() && !hasWand()) ctx.spawnWeaponPickup(WAND, wandPosition());
  };

  const wandPosition = (): Vec2 => ctx.lockdown(SETPIECE)?.placement.lift.wandPosition ?? { x: 0, y: 0 };

  const parkMyko = (): void => {
    // The offices are his phone call until the clerks are passed; after that he follows.
    ctx.setMykoScripted(ctx.currentScreen() === 'c9.offices' && !stealthDone() ? MYKO_BAR : null);
  };

  // --- The staff social area ---

  const opening = async (): Promise<void> => {
    void ctx.say('c9.caption.title');
    void ctx.say('c9.caption.offices');
    await ctx.say('c9.bar.open');
    if (disposed) return;
    setFlag('intro.done');
    ctx.setObjective(OBJ.offices);
    if (ctx.hotDrinkOffered()) setPrompt('ui.prompt.hotDrink', PROMPT_LINGER_MS);
  };

  /** E at the kettle: the free hot drink. The first time it is also the bar section. */
  const tea = (): void => {
    if (!ctx.isComplete('c9.explore.bar')) ctx.completeSection('c9.explore.bar');
    if (ctx.hotDrinkOffered()) {
      clearPrompt('ui.prompt.hotDrink');
      void ctx.say('c9.bar.hotDrink', { repeat: true });
      openHotDrinkChoice();
    } else void ctx.say('c9.bar.hotDrink', { repeat: true });
  };

  // --- The Glove ---

  const takeGlove = (): void => {
    if (gloveTaking) return;
    gloveTaking = true;
    const mine = epoch;
    void (async () => {
      await ctx.say('c9.glove.find');
      gloveTaking = false;
      if (disposed || mine !== epoch) return;
      ctx.learnMove('borrowedGlove');
      ctx.completeMark('c9.glove.box');
      ctx.setPropFrame('offices.lostProperty', PROP.lostPropertyBox.empty);
      // Slot 3 may hold another move: then the player puts the Glove there from the Tab screen.
      if (ctx.kit().slots.specials[2] === 'borrowedGlove') setSlotPrompt(3, PROMPT_LINGER_MS);
      else setPrompt('ui.prompt.kit', PROMPT_LINGER_MS);
      restoreObjective();
    })();
  };

  // --- The offices ---

  /** The clean-run tequila, taken from the counter. Nothing there until the run was clean. */
  const takeTequila = (): boolean => {
    if (!flag('offices.clean') || flag('tequila.taken')) return true;
    setFlag('tequila.taken');
    ctx.give({ kind: 'drink', drinkId: 'tequila', count: 1 });
    ctx.setPropVisible('offices.tequila', false);
    void ctx.say('c9.offices.clean', { repeat: true });
    return true;
  };

  // --- The gravity rooms ---

  /** Walking up to a room starts the section, so Myko can be called in on it. */
  const armGravity = (): void => {
    if (gravityDone()) return;
    ctx.startSection(GRAVITY);
  };

  const noGlove = (): void => {
    if (noGloveMs > 0) return;
    noGloveMs = NO_GLOVE_COOLDOWN_MS;
    void ctx.say('c9.gravity.noGlove', { repeat: true });
  };

  // --- The labs ---

  const labsProgress = (): void => {
    if (labsDone() || !proofTaken('craft') || !proofTaken('log')) return;
    ctx.completeSection(EXPLORE_LABS);
    restoreObjective();
    afterScenes(() => void startLabsFight());
  };

  // TODO(cd): confirm the labs fight starts after both labs proofs (the spec order), not on first entry; the strip is at the west.
  /** The fight: the gravity rooms and both proofs are in. Starts from the strip at the labs' west or straight after the last proof. */
  const startLabsFight = async (): Promise<void> => {
    if (!gravityDone() || !labsDone() || fightDone() || fightStarting || ctx.fight(FIGHT)?.active === true) return;
    fightStarting = true;
    const mine = epoch;
    ctx.setObjective(OBJ.fight);
    await ctx.say('c9.fight.intro');
    fightStarting = false;
    if (disposed || mine !== epoch) return;
    if (fightDone() || ctx.fight(FIGHT)?.active === true) return;
    ctx.startSection(FIGHT);
  };

  const fightEnded = (by: string): void => {
    restoreObjective();
    if (by === 'debug') return;
    if (by !== 'myko') void ctx.say('c9.fight.end');
    // The board opens when the line is over (after a load it opens again at the labs' east door).
    afterScenes(() => {
      if (!boardDone()) ctx.openDeduction();
    });
  };

  // --- The lockdown ---

  const startLockdown = async (): Promise<void> => {
    if (!boardDone() || lockDone() || lockStarting || ctx.boss(SETPIECE)?.active === true) return;
    lockStarting = true;
    const mine = epoch;
    ctx.setObjective(OBJ.lockdown);
    await ctx.say('c9.lockdown.intro');
    lockStarting = false;
    if (disposed || mine !== epoch) return;
    if (lockDone() || ctx.boss(SETPIECE)?.active === true) return;
    ctx.startSection(SETPIECE);
  };

  const onLockdown = (phase: string, bay: number | undefined): void => {
    const k = bay ?? 0;
    switch (phase) {
      case 'bayEntered':
        if (k >= 1 && k <= 4) void ctx.say(`c9.lockdown.announce.${k}`);
        if (k >= 2 && k <= 5) void ctx.say(`c9.lockdown.myko.${k - 1}`);
        break;
      case 'doorShut': {
        // The door catches him when he is at it or anywhere in its bay: back to the bay's start.
        const def = HALL_BAYS[k - 1];
        if (!def) break;
        const p = ctx.playerPosition();
        const reach = TUNING.overhaul?.lockdown?.crushReachPx ?? 0;
        const inBay = p.x >= def.cols.from * 16 && p.x < (def.cols.to + 1) * 16;
        if (inBay || inRect(def.door.area, p, reach)) void ctx.say('c9.lockdown.shut');
        break;
      }
      case 'takeStarted':
        void ctx.say('c9.lockdown.takeStarted');
        break;
      case 'takeDone':
        syncHall();
        setPrompt('c9.proof.count', COUNT_LINGER_MS, { n: proofCount() });
        break;
      case 'liftRefused':
        void ctx.say('c9.lockdown.liftRefused', { repeat: true });
        break;
      case 'liftOpen':
        syncHall();
        void ctx.say('c9.weapon.wand');
        break;
      case 'allOpen':
        syncHall();
        break;
    }
  };

  const setpieceHooks: BossHooks = {
    onStart: () => {
      ctx.setObjective(OBJ.lockdown);
      syncHall();
    },
    onEnd: () => {
      syncHall();
      ctx.setObjective(null);
      if (!hasWand()) ctx.spawnWeaponPickup(WAND, wandPosition());
    },
  };

  const inLiftRoom = (p: Vec2): boolean => p.x >= LIFT_ROOM.col * 16 && p.x < (LIFT_ROOM.col + LIFT_ROOM.width) * 16 && p.y >= LIFT_ROOM.row * 16 && p.y < (LIFT_ROOM.row + LIFT_ROOM.height) * 16;

  /** The closing scene in the lift: the set piece is over and the wand is in his hand. */
  const tryClose = async (): Promise<void> => {
    if (ending || !lockDone() || !hasWand() || ctx.currentScreen() !== 'c9.hall' || !inLiftRoom(ctx.playerPosition())) return;
    ending = true;
    const mine = epoch;
    ctx.setObjective(null);
    ctx.setMykoScripted(null);
    await ctx.say('c9.closing');
    if (disposed || mine !== epoch) return;
    ctx.completeChapter();
  };

  // --- Entering a screen ---

  const entered = (screenId: string): void => {
    clearPrompt();
    parkMyko();
    restoreWorld();
    restoreObjective();
    if (screenId === 'c9.offices') void ctx.say('c9.caption.offices');
    else if (screenId === 'c9.labs') void ctx.say('c9.caption.labs');
    else if (screenId === 'c9.hall') void ctx.say('c9.caption.hall');
  };

  return {
    onStart: () => {
      restoreWorld();
      parkMyko();
      unsubs.push(
        ctx.bus.on(GameEvents.KitChanged, ({ kit }) => {
          syncSteam();
          if (kit.hotDrink === 'tea') void ctx.say('c9.bar.tea');
        }),
        ctx.bus.on(GameEvents.MoveUsed, ({ moveId }) => {
          if (moveId !== 'borrowedGlove') return;
          clearPrompt('ui.prompt.slot');
          void ctx.say('c9.glove.done');
        }),
        ctx.bus.on(GameEvents.SectionStarted, ({ sectionId }) => {
          if (sectionId !== STEALTH) return;
          void ctx.say('c9.open');
          setPrompt('ui.prompt.sneak', PROMPT_LINGER_MS);
        }),
        ctx.bus.on(GameEvents.StealthAlarm, ({ sectionId }) => {
          if (sectionId !== STEALTH) return;
          void ctx.say('c9.offices.caught');
        }),
        ctx.bus.on(GameEvents.StealthCleanRun, ({ sectionId }) => {
          if (sectionId !== STEALTH) return;
          setFlag('offices.clean');
          restoreWorld();
        }),
        ctx.bus.on(GameEvents.EvidenceFound, ({ evidenceId }) => {
          if (!evidenceId.startsWith('c9.proof.')) return;
          restoreWorld();
          restoreObjective();
          setPrompt('c9.proof.count', COUNT_LINGER_MS, { n: proofCount() });
          labsProgress();
        }),
        ctx.bus.on(GameEvents.GravityChanged, ({ puzzleId, phase }) => {
          if (puzzleId === GRAVITY && phase === 'refused') noGlove();
        }),
        ctx.bus.on(GameEvents.LockdownChanged, ({ bossId, phase, bay }) => {
          if (bossId === SETPIECE) onLockdown(phase, bay);
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
      epoch++;
      scenesOpen = 0;
      fightStarting = false;
      lockStarting = false;
      gloveTaking = false;
      ending = false;
      noGloveMs = 0;
      clearPrompt();
      restoreWorld();
      parkMyko();
      if (!flag('intro.done')) {
        void opening();
        return;
      }
      restoreObjective();
      void (async () => {
        await ctx.say('c9.bar.return');
        if (disposed) return;
        if (ctx.hotDrinkOffered()) {
          setPrompt('ui.prompt.hotDrink', PROMPT_LINGER_MS);
          await ctx.say('c9.bar.hotDrink');
        }
      })();
    },

    onScreenEntered: (screenId) => {
      entered(screenId);
    },

    onUpdate: (dtMs) => {
      noGloveMs = Math.max(0, noGloveMs - dtMs);
      syncHall();
      if (lockDone() && !ending) void tryClose();
    },

    onTrigger: (id) => {
      if (id.startsWith('c9.trig.overheard.')) {
        void ctx.say(`c9.offices.overheard.${id.slice('c9.trig.overheard.'.length)}`);
        return;
      }
      if (id.startsWith('c9.trig.gravity.')) {
        const n = Number(id.slice('c9.trig.gravity.'.length));
        const room = GRAVITY_ROOMS[n - 1];
        if (room) void ctx.say(room.promptDialogueId);
        armGravity();
        return;
      }
      switch (id) {
        case 'c9.trig.lobby':
          setFlag('lobby.seen');
          restoreObjective();
          break;
        case 'c9.trig.hangar':
        case 'c9.trig.records':
          restoreObjective();
          break;
        case 'c9.trig.labsFight':
          void startLabsFight();
          break;
        case 'c9.trig.labsExit':
          // The way on to the hall opens with the board: it opens again here after a load.
          if (fightDone() && !boardDone()) ctx.openDeduction();
          break;
        case 'c9.trig.lockdown':
          void startLockdown();
          break;
        case 'c9.trig.lift':
          void tryClose();
          break;
      }
    },

    onExamine: (id) => {
      switch (id) {
        case 'c9.bar.hotDrink':
          tea();
          return true;
        case 'c9.glove.box':
          if (ctx.hasGlove()) return undefined;
          takeGlove();
          return true;
        case 'c9.offices.tequila':
          return takeTequila();
        case 'c9.proof.craft':
          // The photograph needs the way to the window open: the gravity rooms first.
          return gravityDone() ? undefined : true;
      }
      // A bay switch without the Glove does nothing in the director; the line is ours.
      if (HALL_BAYS.some((b) => b.gravity?.switch.id === id) && !ctx.hasGlove()) noGlove();
      // A reset panel of a room that is solved has nothing to put back.
      const room = GRAVITY_ROOMS.find((r) => id === `c9.gravity.reset${r.id.slice(-1)}`);
      if (room && ctx.gravity(GRAVITY)?.isRoomSolved(room.id) === true) return true;
      return undefined;
    },

    onSectionCompleted: (sectionId: SectionId, by) => {
      switch (sectionId) {
        case STEALTH:
          parkMyko();
          restoreObjective();
          break;
        case GRAVITY:
          restoreWorld();
          restoreObjective();
          if (by !== 'myko' && by !== 'debug') void ctx.say('c9.gravity.done');
          break;
        case EXPLORE_LABS:
          restoreObjective();
          break;
        case FIGHT:
          fightEnded(by);
          break;
        case BOARD:
          restoreWorld();
          restoreObjective();
          if (by !== 'myko' && by !== 'debug') void ctx.say('c9.board.right');
          break;
        case SETPIECE:
          restoreWorld();
          break;
      }
    },

    bossHooks: { [SETPIECE]: setpieceHooks },

    debugWalk: () => {
      setFlag('intro.done');
      setFlag('offices.clean');
      ctx.learnMove('borrowedGlove');
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
