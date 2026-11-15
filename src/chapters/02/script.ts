/**
 * Chapter 2 script: every beat in docs/chapters/02-the-bog.md, in order. All
 * text is referred to by ID; all numbers that matter come from `TUNING`.
 */

import { hasSequence, sequence } from '../../content/dialogue';
import type { BossHooks, ChapterContext, ChapterScript, FightHooks } from '../../systems';
import { GameEvents } from '../../core/types';
import type { SectionId, SpecialSlotIndex, TextId } from '../../core/types';
import { hidePrompt, onTabOpened, openHotDrinkChoice, showPrompt, showSlotPrompt } from '../../ui/prompts';
import { PROP } from '../../art/props';
import { BAR_ARRIVAL, BUCKETS_AREA, KEY_CLUES, PRACTICE_BUCKETS_AREA, LANE_GATE_COL, LANE_GATE_OPEN_ROW, LANE_GATE_ROW, LANE_GATE_SEAT, MYKO_CHAIR } from './maps';

const OBJ = {
  ring: 'c2.ring',
  cross: 'c2.cross',
  sheep: 'c2.sheep',
  shed: 'c2.shed',
  yard: 'c2.yard',
  ram: 'c2.ram',
} as const;

/** Presentation only: how long a prompt may linger when nothing the player does can dismiss it. */
const PROMPT_LINGER_MS = 7000;
/** Presentation only: a beat between the first cousin squaring up and Myko's question. */
const SQUARE_UP_MS = 900;
/** Within this of the arrival spot, Andrew is at the lean-to. */
const AT_BAR_PX = 48;
/** Buzz level 3 is Bit much. */
const BIT_MUCH = 3;

type Flag =
  | 'intro.done'
  | 'ring.seen'
  | 'clue.ring'
  | 'clue.fragment'
  | 'clue.tracks'
  | 'farm.seen'
  | 'cousins.started'
  | 'concluded'
  | 'stumble.taught'
  | 'stack1.broken'
  | 'stumble.done'
  | 'reflex.done'
  | 'ram.started'
  | 'finished';

/** The accidental lurch aims at the bucket stack from between these distances (px): far enough to look like a stumble, near enough to land. */
const LURCH_MIN_PX = 32;
const LURCH_MAX_PX = 112;
/** The lurch carries this far past the middle of the stack. */
const LURCH_PAST_PX = 12;
/** No lurch from the yard's far south end: the practice stack and the gate are there. */
const LURCH_SOUTH_LIMIT_PX = 25 * 16;

export function createChapterScript(ctx: ChapterContext): ChapterScript {
  let disposed = false;
  const unsubs: Array<() => void> = [];
  /** Andrew's drunk level, 0 to 4. He starts every chapter at the bottom of Grand. */
  let level = 2;
  let ramStarting = false;
  /** The lane gate: shut, opened with E, or battered through by the ram (the system hides it). Run-time only. */
  let laneGate: 'shut' | 'open' | 'battered' = 'shut';
  /** The accidental lurch is under way: its bucket hits are not the player's own Stumble. */
  let lurching = false;

  const flag = (key: Flag): boolean => ctx.flag(key) === true;
  const setFlag = (key: Flag, value = true): void => ctx.setFlag(key, value);
  const keyCluesFound = (): boolean => KEY_CLUES.every((k) => flag(`clue.${k}`));
  const crossingOpen = (): boolean => keyCluesFound() && !ctx.isComplete('c2.stealth.bog');

  // --- The lane gate: one prop, 1 x 3 and solid when shut, swung flat against the hedge when open ---

  const shutGate = (visible: boolean): void => {
    laneGate = 'shut';
    ctx.setPropFrame('lane.gate', PROP.fieldGate.along3);
    ctx.setPropTile('lane.gate', LANE_GATE_COL, LANE_GATE_ROW);
    ctx.setPropVisible('lane.gate', visible);
  };
  const openGate = (): void => {
    if (laneGate !== 'shut') return;
    laneGate = 'open';
    // The prop's solid is 1 x 3 whatever its frame, so the open gate lies against the hedge, where those tiles are walls already.
    ctx.setPropFrame('lane.gate', PROP.fieldGate.across3);
    ctx.setPropTile('lane.gate', LANE_GATE_COL, LANE_GATE_OPEN_ROW);
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

  /** The objective Andrew should have, from what has happened so far. */
  const restoreObjective = (): void => {
    if (flag('concluded')) ctx.setObjective(OBJ.ram);
    else if (ctx.isComplete('c2.explore.shed') || flag('cousins.started')) ctx.setObjective(OBJ.yard);
    else if (ctx.isComplete('c2.puzzle.sheep')) ctx.setObjective(OBJ.shed);
    else if (ctx.isComplete('c2.stealth.bog')) ctx.setObjective(OBJ.sheep);
    else if (keyCluesFound()) ctx.setObjective(OBJ.cross);
    else if (flag('intro.done')) ctx.setObjective(OBJ.ring);
  };

  /** Run-time dressing and locks are not saved. Put them back from what is finished. */
  const restoreWorld = (): void => {
    ctx.setExitLocked('c2.farm.gate', !flag('concluded'));
    ctx.setPropVisible('shed.door', !ctx.isComplete('c2.puzzle.sheep'));
    ctx.setPropVisible('van', crossingOpen());
    shutGate(!ctx.isComplete('c2.setpiece.ram'));
  };

  // --- The lean-to ---------------------------------------------------------

  const opening = async (): Promise<void> => {
    // The title card plays over the first scene, not before it.
    void ctx.say('c2.caption.title');
    await ctx.say('c2.bar.open');
    if (disposed) return;
    setFlag('intro.done');
    ctx.setObjective(OBJ.ring);
    void ctx.say('c2.caption.bog');
    if (ctx.hotDrinkOffered()) setPrompt('ui.prompt.hotDrink', PROMPT_LINGER_MS);
  };

  /** The flask. The free hot drink, each visit. */
  const flask = (): void => {
    if (!ctx.hotDrinkOffered()) return;
    clearPrompt('ui.prompt.hotDrink');
    openHotDrinkChoice();
    void ctx.say('c2.bar.hotDrink');
  };

  // --- The ring and the casebook --------------------------------------------

  const reachedRing = async (): Promise<void> => {
    ctx.completeSection('c2.explore.bar');
    if (flag('ring.seen')) return;
    setFlag('ring.seen');
    await ctx.say('c2.open');
  };

  const SCENE_FOR: Readonly<Record<string, string | undefined>> = {
    ring: 'c2.ring.found',
    fragment: 'c2.fragment.found',
    tracks: 'c2.tracks.found',
  };

  /** A clue examined. The flag goes in before the evidence, because finding a clue saves. */
  const examineClue = async (key: 'ring' | 'fragment' | 'tracks' | 'frog' | 'welly'): Promise<void> => {
    const first = key === 'frog' || key === 'welly' ? false : !flag(`clue.${key}`);
    if (key !== 'frog' && key !== 'welly') setFlag(`clue.${key}`);
    ctx.addEvidence(`c2.clue.${key}`);
    const scene = SCENE_FOR[key];
    if (scene !== undefined) await ctx.say(scene);
    if (disposed) return;
    if (key === 'ring' && first) setPrompt('ui.prompt.casebook', PROMPT_LINGER_MS);
    if (first && keyCluesFound()) await vanArrives();
  };

  /** All three key clues are in. The Department men arrive and the bog crossing begins. */
  const vanArrives = async (): Promise<void> => {
    ctx.completeSection('c2.explore.ring');
    ctx.setPropVisible('van', true);
    ctx.setObjective(OBJ.cross);
    await ctx.say('c2.suits.arrive');
    await ctx.say('c2.throw.reminder');
    if (disposed) return;
    ctx.startSection('c2.stealth.bog');
    setPrompt('ui.prompt.sneak', PROMPT_LINGER_MS);
  };

  const overheard = (n: 1 | 2 | 3): void => {
    if (crossingOpen()) void ctx.say(`c2.suits.overheard.${n}`);
  };

  // --- The farm -------------------------------------------------------------

  const enteredFarm = (): void => {
    clearPrompt();
    ctx.setMykoScripted(null);
    restoreWorld();
    if (!flag('farm.seen')) {
      setFlag('farm.seen');
      void ctx.say('c2.caption.farm');
      if (!ctx.isComplete('c2.puzzle.sheep')) void ctx.say('c2.sheep.intro');
    }
    restoreObjective();
  };

  const sheepDone = async (): Promise<void> => {
    ctx.setPropVisible('shed.door', false);
    ctx.setObjective(OBJ.shed);
    await ctx.say('c2.sheep.done');
  };

  /** The docket on the bench. That is the shed. */
  const takeDocket = async (): Promise<void> => {
    const first = !ctx.isComplete('c2.explore.shed');
    ctx.addEvidence('c2.clue.docket');
    if (!first) return;
    ctx.completeSection('c2.explore.shed');
    ctx.setObjective(OBJ.yard);
    await ctx.say('c2.shed.docket');
  };

  /** The first time Andrew is at Bit much after the shed. */
  const stumbleLesson = async (lurch: { angleDeg: number; distance: number } | null): Promise<void> => {
    if (flag('stumble.taught')) return;
    setFlag('stumble.taught');
    // He lurches through the stack by accident; then Myko explains. With the stack already gone there is no lurch.
    if (lurch) {
      lurching = true;
      await ctx.forceLurch(lurch.angleDeg, { distance: lurch.distance });
      lurching = false;
      if (disposed) return;
    }
    await ctx.say('c2.stumble.lesson');
    if (disposed) return;
    ctx.learnMove('stumble');
    setPrompt('ui.prompt.stumble', PROMPT_LINGER_MS);
  };

  /** The shed is done: the lesson is promised for the next time he is at Bit much, in this chapter or a later one. */
  const shedDone = (): void => {
    if (!flag('stumble.taught')) ctx.oweMove('stumble', 'c2.stumble.lesson');
    maybeStumbleLesson();
  };

  /**
   * At Bit much in the yard with the bucket stack close by, and nothing else going on, he lurches into it.
   * Anywhere else the lesson waits (and the owed-move fallback covers a chapter that ends first).
   */
  const maybeStumbleLesson = (): void => {
    if (!ctx.isComplete('c2.explore.shed') || level < BIT_MUCH || flag('stumble.taught') || lurching) return;
    if (ctx.currentScreen() !== 'c2.farm' || scenesOpen > 0) return;
    // Never into the cousins' fight.
    if (flag('cousins.started') && !ctx.isComplete('c2.fight.yard')) return;
    // The first stack is already broken: no lurch, and no distance to keep.
    if (flag('stack1.broken')) {
      void stumbleLesson(null);
      return;
    }
    const p = ctx.playerPosition();
    const dx = BUCKETS_AREA.x + BUCKETS_AREA.width / 2 - p.x;
    const dy = BUCKETS_AREA.y + BUCKETS_AREA.height / 2 - p.y;
    const d = Math.hypot(dx, dy);
    if (d < LURCH_MIN_PX || d > LURCH_MAX_PX || p.y > LURCH_SOUTH_LIMIT_PX) return;
    void stumbleLesson({ angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI, distance: d + LURCH_PAST_PX });
  };

  // --- The cousins ----------------------------------------------------------

  const cousinsArrive = async (): Promise<void> => {
    setFlag('cousins.started');
    ctx.setObjective(OBJ.yard);
    await ctx.say('c2.cousins.intro');
    if (disposed) return;
    ctx.startSection('c2.fight.yard');
  };

  /** As the first one squares up: where does a man fold? Reflex Test goes into the kit. */
  const reflexLesson = async (): Promise<void> => {
    await ctx.say('c2.reflex.lesson');
    if (disposed) return;
    ctx.learnMove('reflexTest');
  };

  const fightHooks: FightHooks = {
    onWaveSpawned: (index) => {
      if (index === 0) ctx.after(SQUARE_UP_MS, () => void reflexLesson());
    },
  };

  /** The yard is quiet. Andrew writes the conclusion himself. */
  const cousinsDone = async (): Promise<void> => {
    // A Myko call skips the lesson; Reflex Test comes to him all the same.
    ctx.learnMove('reflexTest');
    await ctx.say('c2.cousins.end');
    await ctx.say('c2.conclusion');
    if (disposed) return;
    // The flag first: finding a clue saves.
    setFlag('concluded');
    ctx.addEvidence('c2.clue.conclusion');
    ctx.setExitLocked('c2.farm.gate', false);
    ctx.setObjective(OBJ.ram);
    maybeStumbleLesson();
  };

  // --- The ram --------------------------------------------------------------

  const enteredLane = async (): Promise<void> => {
    clearPrompt();
    shutGate(true);
    if (ctx.isComplete('c2.setpiece.ram') || ramStarting) return;
    ramStarting = true;
    ctx.setMykoScripted(LANE_GATE_SEAT);
    ctx.setObjective(OBJ.ram);
    await ctx.say('c2.ram.intro');
    if (disposed) return;
    setFlag('ram.started');
    ctx.setCameraLead('right');
    ctx.startSection('c2.setpiece.ram');
    ramStarting = false;
  };

  const ramEnded = async (by: string): Promise<void> => {
    if (flag('finished')) return;
    setFlag('finished');
    ctx.setCameraLead(null);
    // A call skips the ram's own ending; Myko's call is the beat, then the closing.
    if (by !== 'myko') await ctx.say('c2.ram.end');
    await ctx.say('c2.closing');
    if (disposed) return;
    ctx.completeChapter();
  };

  const ramHooks: BossHooks = {
    onAttackLanded: () => void ctx.say('c2.ram.hit'),
    onEnd: (_boss, by) => void ramEnded(by),
  };

  /** The mid-run phone lines only make sense while the ram is behind him. */
  const ramHasStarted = (): boolean => ctx.boss('c2.setpiece.ram')?.active === true;

  return {
    onStart: () => {
      restoreWorld();
      if (ctx.currentScreen() === 'c2.bog') ctx.setMykoScripted(MYKO_CHAIR);
      // The guards exist only while their section is started: after a load, put them back on their routes.
      if (crossingOpen()) ctx.startSection('c2.stealth.bog');
      unsubs.push(
        ctx.onMoveHit(
          PRACTICE_BUCKETS_AREA,
          (hit) => {
            if (hit.moveId !== 'stumble' || lurching || !flag('stumble.taught') || flag('stumble.done')) return;
            setFlag('stumble.done');
            clearPrompt('ui.prompt.stumble');
            void ctx.say('c2.stumble.done');
          },
          'c2.farm',
        ),
        // The flock has gone back to the first pen, the one Andrew must walk through to reach the shed.
        ctx.onFlockSettled('c2.puzzle.sheep', (pen) => {
          if (pen === 'pen1' && !ctx.isComplete('c2.puzzle.sheep')) void ctx.say('c2.sheep.wrong');
        }),
        onTabOpened(() => clearPrompt('ui.prompt.casebook')),
        ctx.bus.on(GameEvents.BuzzLevelChanged, ({ to }) => {
          level = to;
          maybeStumbleLesson();
        }),
        ctx.bus.on(GameEvents.MoveUsed, ({ moveId, slot }) => {
          if (moveId === 'reflexTest' && !flag('reflex.done')) {
            setFlag('reflex.done');
            void ctx.say('c2.reflex.done');
          } else if (moveId === 'stumble' && slot === 3) clearPrompt('ui.prompt.stumble');
        }),
        ctx.bus.on(GameEvents.PropBroken, ({ propId }) => {
          if (propId.startsWith('yard.bucket')) setFlag('stack1.broken');
        }),
        ctx.bus.on(GameEvents.PropBrokenByBoss, ({ propId }) => {
          // The ram has battered the gate: the system hides it (the sound is the audio layer's).
          if (propId === 'lane.gate') laneGate = 'battered';
        }),
        ctx.bus.on(GameEvents.StealthNoise, ({ kind }) => {
          if (kind === 'bottle' && crossingOpen() && ctx.currentScreen() === 'c2.bog') void ctx.say('c2.suits.distracted');
        }),
        ctx.bus.on(GameEvents.StealthAlarm, ({ sectionId }) => {
          if (sectionId === 'c2.stealth.bog') void ctx.say('c2.stealth.caught');
        }),
        ctx.bus.on(GameEvents.StealthCleanRun, ({ sectionId }) => {
          if (sectionId === 'c2.stealth.bog') void ctx.say('c2.stealth.clean');
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

    /**
     * Andrew is back at the lean-to. Flags are what the last save held and the unfinished section has started over.
     * A bog crossing under way puts its guards back on their routes; the sheep stay as he left them.
     */
    onBarReturn: () => {
      level = 2;
      scenesOpen = 0;
      ramStarting = false;
      clearPrompt();
      ctx.setCameraLead(null);
      restoreWorld();
      ctx.setMykoScripted(MYKO_CHAIR);
      if (crossingOpen()) ctx.startSection('c2.stealth.bog');
      if (!flag('intro.done')) {
        void opening();
        return;
      }
      restoreObjective();
      void (async () => {
        await ctx.say('c2.bar.return');
        if (disposed) return;
        if (ctx.hotDrinkOffered()) {
          setPrompt('ui.prompt.hotDrink', PROMPT_LINGER_MS);
          await ctx.say('c2.bar.hotDrink');
        }
      })();
    },

    onScreenEntered: (screenId) => {
      if (screenId === 'c2.bog') {
        clearPrompt();
        // Myko keeps his chair while Andrew is at the lean-to; out in the bog he follows.
        const p = ctx.playerPosition();
        ctx.setMykoScripted(Math.hypot(p.x - BAR_ARRIVAL.x, p.y - BAR_ARRIVAL.y) < AT_BAR_PX ? MYKO_CHAIR : null);
        restoreObjective();
      } else if (screenId === 'c2.farm') enteredFarm();
      else if (screenId === 'c2.lane') void enteredLane();
    },

    onTrigger: (id) => {
      switch (id) {
        case 'c2.trig.ring':
          if (flag('intro.done')) void reachedRing();
          break;
        case 'c2.trig.over1':
          overheard(1);
          break;
        case 'c2.trig.over2':
          overheard(2);
          break;
        case 'c2.trig.over3':
          overheard(3);
          break;
        case 'c2.trig.buckets':
          maybeStumbleLesson();
          break;
        case 'c2.trig.cousins':
          if (ctx.isComplete('c2.explore.shed') && !ctx.isComplete('c2.fight.yard') && !flag('cousins.started')) void cousinsArrive();
          break;
        case 'c2.trig.ram1':
          if (ramHasStarted()) void ctx.say('c2.ram.mid.1');
          break;
        case 'c2.trig.ram2':
          if (ramHasStarted()) void ctx.say('c2.ram.mid.2');
          break;
        case 'c2.trig.ram3':
          if (ramHasStarted()) void ctx.say('c2.ram.mid.3');
          break;
      }
    },

    onExamine: (id) => {
      switch (id) {
        case 'c2.flask':
          flask();
          return true;
        case 'c2.ring':
          void examineClue('ring');
          return true;
        case 'c2.fragment':
          void examineClue('fragment');
          return true;
        case 'c2.tracks':
          void examineClue('tracks');
          return true;
        case 'c2.frog':
          void examineClue('frog');
          return true;
        case 'c2.welly':
          void examineClue('welly');
          return true;
        case 'c2.docket':
          void takeDocket();
          return true;
        case 'c2.lane.gate':
          openGate();
          return true;
      }
      return undefined;
    },

    onSectionStarted: (sectionId: SectionId) => {
      if (sectionId === 'c2.puzzle.sheep') ctx.setObjective(OBJ.sheep);
    },

    onSectionCompleted: (sectionId: SectionId) => {
      if (sectionId === 'c2.stealth.bog') {
        ctx.setPropVisible('van', false);
        if (!ctx.isComplete('c2.puzzle.sheep')) ctx.setObjective(OBJ.sheep);
      } else if (sectionId === 'c2.puzzle.sheep') void sheepDone();
      else if (sectionId === 'c2.explore.shed') shedDone();
      else if (sectionId === 'c2.fight.yard') void cousinsDone();
    },

    fightHooks: { 'c2.fight.yard': fightHooks },
    bossHooks: { 'c2.setpiece.ram': ramHooks },

    debugWalk: () => {
      for (const k of KEY_CLUES) setFlag(`clue.${k}`);
      setFlag('intro.done');
      setFlag('farm.seen');
      setFlag('cousins.started');
      setFlag('concluded');
      ctx.setExitLocked('c2.farm.gate', false);
      ctx.setMykoScripted(null);
    },

    dispose: () => {
      disposed = true;
      for (const off of unsubs) off();
      hidePrompt();
    },
  };

}
