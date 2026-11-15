/** DESIGN.md 7.6: the version 2 save, return to the bar on load, chapter carry-over, Chapter Select, audio settings. */

import { afterEach, describe, expect, it } from 'vitest';
import { TUNING } from '../../src/content/tuning';
import { clearChapterRegistry, registerChapter } from '../../src/core/chapter';
import { createSandboxModule } from '../../src/core/sandbox';
import { AUDIO_KEY, MemoryStorage, SAVE_KEY, SaveStore, isSaveState } from '../../src/core/save';
import { SAVE_VERSION_OVERHAUL } from '../../src/core/types';
import type { ChapterNumber, OverhaulSaveState } from '../../src/core/types';
import { createKit, gainWeapon, learnMove, pickUpDrink } from '../../src/systems/kit';
import { restValue } from '../../src/systems/meter';
import { GameSession, carryOver, chapterOf, chapterSelectSave, emptyProgress, saveAtChapterStart } from '../../src/systems/session';
import type { SceneDriver } from '../../src/systems/session';
import { NO_INPUT, advanceWithScene, record } from './helpers';

const BAD_KITS = [null, 5, 'x', {}, { drinks: {} }];

const fresh = (chapter: ChapterNumber = 1): OverhaulSaveState => saveAtChapterStart(createSandboxModule(chapter), emptyProgress());

describe('SaveStore', () => {
  it('round-trips a save exactly, kit and all', () => {
    const store = new SaveStore(new MemoryStorage());
    let kit = createKit();
    kit = learnMove(kit, 'shoulder', { autoAssign: true }).kit;
    kit = gainWeapon(kit, 'hurley').kit;
    kit = pickUpDrink(pickUpDrink(kit, 'stout').kit, 'whiskey').kit;
    kit = { ...kit, bottles: 3, hotDrink: 'tea' };
    const s: OverhaulSaveState = {
      ...fresh(3),
      kit,
      mykoCallsLeft: 1,
      casebook: [{ kind: 'evidence', evidenceId: 'c2.clue.ring', chapter: 2 }],
      openedShortcuts: ['c2.gate'],
      settings: { tabMode: 'hold' },
      flags: { 'c3.talked': true, 'c3.n': 4, 'c3.s': 'x' },
    };
    store.write(s);
    expect(store.load()).toEqual(s);
  });

  it('is version 2', () => {
    expect(SAVE_VERSION_OVERHAUL).toBe(2);
    expect(fresh().version).toBe(2);
  });

  it('no save yet is null', () => {
    expect(new SaveStore(new MemoryStorage()).load()).toBeNull();
  });

  it('a different version, broken JSON or wrong shape is ignored, not half-loaded', () => {
    const storage = new MemoryStorage();
    const store = new SaveStore(storage);
    const s = fresh();
    const cases = [
      JSON.stringify({ ...s, version: 3 }),
      JSON.stringify({ ...s, version: 0 }),
      '{not json',
      'null',
      '[]',
      '"hello"',
      JSON.stringify({ ...s, chapter: 11 }),
      JSON.stringify({ ...s, chapter: 0 }),
      JSON.stringify({ ...s, chapter: 2.5 }),
      JSON.stringify({ ...s, casebook: 'nope' }),
      JSON.stringify({ ...s, mykoCallsLeft: '3' }),
      JSON.stringify({ ...s, settings: { tabMode: 'sideways' } }),
      JSON.stringify({ ...s, settings: undefined }),
      JSON.stringify({ ...s, kit: { ...s.kit, slots: { ...s.kit.slots, specials: [null] } } }),
      ...BAD_KITS.map((kit) => JSON.stringify({ ...s, kit })),
    ];
    for (const raw of cases) {
      storage.setItem(SAVE_KEY, raw);
      expect(store.load(), raw.slice(0, 50)).toBeNull();
    }
  });

  it('an old version 1 save (health, buzz, drink slots) is discarded, never migrated', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        chapter: 2,
        player: { buzz: 40, health: 80, empties: 2, drinkSlots: [null, null, null], unlockedAbilities: ['punchCombo'], hangover: { active: false } },
        respawn: { position: { x: 1, y: 1 } },
        completedSectionIds: ['c1.fight.chipper'],
        mykoCallsLeft: 2,
        casebook: [],
        flags: {},
        finishedChapters: [1],
      }),
    );
    const store = new SaveStore(storage);
    expect(store.load()).toBeNull();
  });

  it('clear removes the save', () => {
    const store = new SaveStore(new MemoryStorage());
    store.write(fresh());
    store.clear();
    expect(store.load()).toBeNull();
  });

  it('isSaveState accepts a good save and rejects junk', () => {
    expect(isSaveState(fresh())).toBe(true);
    expect(isSaveState({ ...fresh(), version: 1 })).toBe(false);
    expect(isSaveState(undefined)).toBe(false);
    expect(isSaveState({})).toBe(false);
  });

  it('stores the number of Myko calls left in the save', () => {
    expect(fresh().mykoCallsLeft).toBe(TUNING.myko.callsPerGame);
  });
});

describe('audio settings', () => {
  it('live under their own key, apart from the save', () => {
    const storage = new MemoryStorage();
    const store = new SaveStore(storage);
    store.writeAudio({ musicVolume: 0.3, effectsVolume: 0.6 });
    expect(storage.getItem(AUDIO_KEY)).not.toBeNull();
    expect(AUDIO_KEY).not.toBe(SAVE_KEY);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    expect(store.loadAudio()).toEqual({ musicVolume: 0.3, effectsVolume: 0.6 });
  });

  it('survive clearing the save', () => {
    const store = new SaveStore(new MemoryStorage());
    store.writeAudio({ musicVolume: 0.2, effectsVolume: 0.1 });
    store.write(fresh());
    store.clear();
    expect(store.loadAudio()).toEqual({ musicVolume: 0.2, effectsVolume: 0.1 });
  });

  it('clamp to 0..1 and fall back to defaults on garbage', () => {
    const storage = new MemoryStorage();
    const store = new SaveStore(storage);
    store.writeAudio({ musicVolume: 2, effectsVolume: -1 });
    expect(store.loadAudio()).toEqual({ musicVolume: 1, effectsVolume: 0 });
    storage.setItem(AUDIO_KEY, '{bad');
    const d = store.loadAudio();
    expect(d.musicVolume).toBeGreaterThanOrEqual(0);
    expect(d.musicVolume).toBeLessThanOrEqual(1);
    storage.setItem(AUDIO_KEY, JSON.stringify({ musicVolume: 'loud', effectsVolume: null }));
    expect(store.loadAudio()).toEqual(d);
  });
});

describe('chapter carry-over', () => {
  const at = (chapter: 1 | 2 | 3 | 4 | 5, overrides: Partial<OverhaulSaveState> = {}): OverhaulSaveState => ({ ...fresh(), ...overrides, chapter });
  const next = (n: 2 | 3 | 4 | 5 | 6) => createSandboxModule(n);

  it('positions the save at the next chapter and records the finished one once', () => {
    const s = carryOver(at(2), 'grand', next(3));
    expect(s.chapter).toBe(3);
    expect(s.finishedChapters).toEqual([2]);
    expect(carryOver(at(2, { finishedChapters: [2] }), 'sober', next(3)).finishedChapters).toEqual([2]);
  });

  it('the end state makes no difference: there is no hangover and no Buzz carried', () => {
    for (const end of ['sober', 'buzzed', 'grand', 'bitMuch', 'fecked'] as const) {
      const s = carryOver(at(3), end, next(4));
      expect(JSON.stringify(s), end).toBe(JSON.stringify(carryOver(at(3), 'grand', next(4))));
      expect('player' in s).toBe(false);
    }
  });

  it('the kit, casebook, shortcuts and Myko calls carry', () => {
    let kit = learnMove(createKit(), 'shoulder', { autoAssign: true }).kit;
    kit = gainWeapon(kit, 'hurley').kit;
    kit = { ...pickUpDrink(kit, 'whiskey').kit, bottles: 4 };
    const s = at(4, { kit, mykoCallsLeft: 1, openedShortcuts: ['c3.gate'], casebook: [{ kind: 'evidence', evidenceId: 'c2.clue.ring', chapter: 2 }] });
    const n = carryOver(s, 'grand', next(5));
    // Every chapter start leaves him at least two beers (the whiskey stays, stout tops them up).
    expect(n.kit).toEqual({ ...kit, drinks: { ...kit.drinks, stout: 2 }, slots: { ...kit.slots, drink: 'stout' }, selectedItem: 'stout' });
    expect(n.mykoCallsLeft).toBe(1);
    expect(n.casebook).toEqual(s.casebook);
    expect(n.openedShortcuts).toEqual(['c3.gate']);
  });

  it('the calls count never goes up', () => {
    expect(carryOver(at(2, { mykoCallsLeft: 0 }), 'sober', next(3)).mykoCallsLeft).toBe(0);
  });
});

describe('Chapter Select start state (README)', () => {
  it("gives earlier moves and weapons, three stout, the minimum bottles, and keeps the save's calls", () => {
    const existing: OverhaulSaveState = { ...fresh(), mykoCallsLeft: 1 };
    const s = chapterSelectSave(createSandboxModule(5), existing, []);
    expect(s.chapter).toBe(5);
    const o = TUNING.overhaul!;
    const earlier = Object.values(o.moves).filter((m) => m.learnedInChapter < 5).map((m) => m.id);
    expect([...s.kit.moves].sort()).toEqual([...earlier].sort());
    const weapons = Object.values(o.weapons).filter((w) => w.gainedInChapter < 5).map((w) => w.id);
    expect(s.kit.weapons).toEqual(expect.arrayContaining(['fists', ...weapons]));
    expect(s.kit.drinks.stout).toBe(3);
    expect(s.kit.hotDrink).toBeNull();
    expect(s.kit.bottles).toBeGreaterThanOrEqual(o.carry.minBottlesOnLeavingBar);
    expect(s.mykoCallsLeft).toBe(1);
  });

  it('chapter 1 gives no starting drinks (Dympna hands over the first pint)', () => {
    const s = chapterSelectSave(createSandboxModule(1), null, []);
    expect(s.kit.drinks.stout ?? 0).toBe(0);
  });

  it('a move learned in its own chapter is not given by Chapter Select of that chapter', () => {
    const o = TUNING.overhaul!;
    const m = Object.values(o.moves).find((x) => x.learnedInChapter === 3);
    if (!m) return;
    expect(chapterSelectSave(createSandboxModule(3), null, []).kit.moves).not.toContain(m.id);
    expect(chapterSelectSave(createSandboxModule(4), null, []).kit.moves).toContain(m.id);
  });

  it('starts with the evidence of earlier chapters', () => {
    const s = chapterSelectSave(createSandboxModule(4), null, ['c2.clue.ring', 'c3.clue.map']);
    expect(s.casebook.map((e) => (e.kind === 'evidence' ? e.evidenceId : ''))).toEqual(['c2.clue.ring', 'c3.clue.map']);
  });

it('files each earlier clue under its own chapter', () => {
    const s = chapterSelectSave(createSandboxModule(4), null, ['c2.clue.ring', 'c3.clue.map']);
    expect(s.casebook.map((e) => (e.kind === 'evidence' ? e.chapter : 0))).toEqual([2, 3]);
  });

  it('a chapter select does not keep completed sections of this or later chapters', () => {
    const s = chapterSelectSave(createSandboxModule(2), { ...fresh(), completedSectionIds: ['c1.fight.chipper', 'c2.fight.yard', 'c3.fight.bay'] }, []);
    expect(s.completedSectionIds).toEqual(['c1.fight.chipper']);
  });

  it('chapterOf reads the ID prefix', () => {
    expect(chapterOf('c10.boss.administrator')).toBe(10);
    expect(chapterOf('c3.deduction.boston')).toBe(3);
    expect(chapterOf('nothing')).toBe(0);
  });
});

describe('GameSession flow', () => {
  afterEach(() => clearChapterRegistry());
  const setup = () => {
    registerChapter(createSandboxModule(1));
    const store = new SaveStore(new MemoryStorage());
    const session = new GameSession({ store });
    const started: number[] = [];
    const driver: SceneDriver = { showTitle: () => undefined, startGame: () => void started.push(1), pauseGame: () => undefined, resumeGame: () => undefined };
    session.setDriver(driver);
    return { session, store, started };
  };

  it('New Game writes a fresh save and keeps the audio settings', () => {
    const { session, store, started } = setup();
    session.setAudioSettings({ musicVolume: 0.1, effectsVolume: 0.9 });
    store.write({ ...fresh(), mykoCallsLeft: 0 });
    session.newGame();
    expect(started).toHaveLength(1);
    expect(store.load()?.mykoCallsLeft).toBe(TUNING.myko.callsPerGame);
    expect(store.loadAudio()).toEqual({ musicVolume: 0.1, effectsVolume: 0.9 });
    expect(session.audioSettings()).toEqual({ musicVolume: 0.1, effectsVolume: 0.9 });
  });

  it('Continue with no save starts a new game', () => {
    const { session, store } = setup();
    session.continueGame();
    expect(store.load()).not.toBeNull();
  });

  it('Continue resumes a saved game with its calls and kit, and puts Andrew in the bar at rest', () => {
    const { session, store } = setup();
    const s = fresh();
    const kit = { ...pickUpDrink(s.kit, 'stout').kit, bottles: 4 };
    store.write({ ...s, kit, mykoCallsLeft: 1 });
    session.continueGame();
    const run = session.createRun();
    expect(run?.callsRemaining()).toBe(1);
    expect(run?.player.kit.drinks.stout).toBe(1);
    expect(run?.player.kit.bottles).toBe(4);
    expect(run?.player.meter.value).toBe(restValue(1));
    expect(run?.player.pos).toEqual(run?.screenLayout.playerStart);
  });

  it('the save does not remember where Andrew stood or what his meter was', () => {
    const { session, store } = setup();
    session.newGame();
    const run = session.createRun();
    if (!run) throw new Error('no run');
    run.tick(16, NO_INPUT);
    run.setPlayerPosition({ x: 400, y: 100 });
    run.completeSection('c1.puzzle.kegs');
    const saved = store.load();
    expect(saved).not.toBeNull();
    expect(saved).not.toHaveProperty('respawn');
    expect(saved).not.toHaveProperty('player');
    expect(JSON.stringify(saved)).not.toContain('400');
  });

  it('saves when a section is finished, a Myko call is made and a chapter is completed', () => {
    const { session, store } = setup();
    session.newGame();
    const run = session.createRun();
    if (!run) throw new Error('no run');
    run.tick(16, NO_INPUT);
    expect(store.load()?.completedSectionIds).toEqual([]);
    run.completeSection('c1.puzzle.kegs');
    expect(store.load()?.completedSectionIds).toContain('c1.puzzle.kegs');
    run.setPlayerPosition({ x: 22 * 16 + 8, y: 13 * 16 + 8 });
    run.tick(16, NO_INPUT);
    for (let t = 100; t <= 1000; t += 100) run.tick(100, { ...NO_INPUT, held: new Set(['callMyko']), holdMs: { callMyko: t } });
    expect(store.load()?.mykoCallsLeft).toBe(TUNING.myko.callsPerGame - 1);
  });

  it('a return to the bar does not write a save, and the save still holds the earlier finished sections', () => {
    const { session, store } = setup();
    session.newGame();
    const run = session.createRun();
    if (!run) throw new Error('no run');
    run.tick(16, NO_INPUT);
    run.completeSection('c1.puzzle.kegs');
    const before = JSON.stringify(store.load());
    run.setPlayerPosition({ x: 22 * 16 + 8, y: 13 * 16 + 8 });
    run.tick(16, NO_INPUT);
    const returns = record(session.bus, 'bar:returned');
    run.setFlag('c1.later', true);
    run.player.meter = { ...run.player.meter, value: 0.01 };
    advanceWithScene(run, 300);
    expect(returns).toEqual([{ reason: 'sober' }]);
    expect(JSON.stringify(store.load())).toBe(before);
    expect(run.flag('c1.later')).toBeUndefined();
  });

  it('there is no game over: the session never restarts the scene after a return', () => {
    const { session, started } = setup();
    session.newGame();
    const run = session.createRun();
    if (!run) throw new Error('no run');
    run.tick(16, NO_INPUT);
    run.player.meter = { ...run.player.meter, value: 0.01 };
    advanceWithScene(run, 300);
    expect(started).toHaveLength(1);
    expect(session.run).toBe(run);
  });

  it('completing a chapter hands the carry-over to the next one (or the title after the last)', () => {
    registerChapter(createSandboxModule(1));
    registerChapter(createSandboxModule(2));
    const store = new SaveStore(new MemoryStorage());
    const session = new GameSession({ store });
    let titles = 0;
    session.setDriver({ showTitle: () => void titles++, startGame: () => undefined, pauseGame: () => undefined, resumeGame: () => undefined });
    const completed = record(session.bus, 'chapter:completed');
    session.newGame();
    const run = session.createRun();
    if (!run) throw new Error('no run');
    run.tick(16, NO_INPUT);
    run.walkChapter();
    expect(completed).toHaveLength(1);
    expect(completed[0]?.chapter).toBe(1);
    expect(completed[0]?.endState).toBeDefined();
    const saved = store.load();
    expect(saved?.chapter).toBe(2);
    expect(saved?.finishedChapters).toEqual([1]);
    expect(titles).toBe(0);
    const run2 = session.createRun();
    expect(run2?.chapter).toBe(2);
    run2?.tick(16, NO_INPUT);
    run2?.walkChapter();
    expect(titles).toBe(1); // chapter 3 not built: back to the title with the finish recorded
    expect(store.load()?.finishedChapters).toEqual([1, 2]);
  });

  it('pause and resume are idempotent and emit once; pausing with no run does nothing', () => {
    const { session } = setup();
    const paused = record(session.bus, 'game:paused');
    const resumed = record(session.bus, 'game:resumed');
    session.pause();
    expect(paused).toHaveLength(0);
    session.newGame();
    session.createRun();
    session.pause();
    session.pause();
    session.resume();
    session.resume();
    expect(paused).toHaveLength(1);
    expect(resumed).toHaveLength(1);
    expect(session.isPaused).toBe(false);
  });
});
