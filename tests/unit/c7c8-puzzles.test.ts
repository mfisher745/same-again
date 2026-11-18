/**
 * Chapter 7 tells puzzle and chapter 8 junction puzzle through the run. The junction data is chapter 8's own layout
 * (`src/chapters/08/maps.ts`), so the puzzle model, the perimeter hazards and the layout cannot drift apart.
 */

import { describe, expect, it } from 'vitest';
import { CORRIDOR_LINES, JUNCTION_BOXES, PATROL_TRUCKS, SENSOR_LINES, THERMAL_MASTS } from '../../src/chapters/08/maps';
import type { ChapterModule } from '../../src/core/chapter';
import { createChapter2Sandbox } from '../../src/core/sandbox2';
import type { PuzzleSectionId, StealthSectionDef, Vec2 } from '../../src/core/types';
import { minToggles } from '../../src/systems/junctions';
import { junctionExaminableId, junctionLayoutFrom, lineSensorId, perimeterHazards } from '../../src/systems/perimeter';
import type { TellsLayout } from '../../src/systems/tells';
import { createKit } from '../../src/systems/kit';
import { advance, frame, makeRun, record } from './helpers';

const TELLS: PuzzleSectionId = 'c7.puzzle.tells';
const JUNC: PuzzleSectionId = 'c8.puzzle.junctions';
const FIGS = ['a', 'b', 'c', 'd', 'e', 'gary'];
const tellsLayout: TellsLayout = {
  figures: FIGS.map((id, i) => ({ id, examinableId: `fig.${id}`, tellTextIds: [`c7.tells.${id}.1`], ...(i === 0 ? {} : {}) })),
  aliens: ['b', 'd', 'gary'],
  promptTextId: 'c7.tells.prompt',
  rightTextId: 'c7.tells.right',
  wrongTextId: 'c7.tells.wrong',
};

const stealthId = 'c2.stealth.bog';
const hazards = perimeterHazards({ lines: SENSOR_LINES, masts: THERMAL_MASTS, trucks: PATROL_TRUCKS });
const juncLayout = junctionLayoutFrom({
  lines: SENSOR_LINES,
  boxes: JUNCTION_BOXES,
  targetLines: CORRIDOR_LINES,
  stealthId,
});

function module(): ChapterModule {
  const base = createChapter2Sandbox();
  const screenId = base.def.startScreenId;
  const stealthSections: StealthSectionDef[] = base.def.stealthSections.map((s) => ({ ...s, guards: [], hazards }));
  const spot = (i: number): Vec2 => ({ x: 100 + i * 60, y: 100 });
  return {
    ...base,
    createScript: undefined,
    def: { ...base.def, stealthSections },
    examinables: [
      ...base.examinables,
      ...FIGS.map((id, i) => ({ id: `fig.${id}`, screenId, position: spot(i) })),
      { id: 'tells.till', screenId, position: { x: 100, y: 140 } },
      ...JUNCTION_BOXES.map((b, i) => ({ id: junctionExaminableId(b.id), screenId, position: spot(i + 8) })),
    ],
    tellsPuzzles: [{ sectionId: TELLS, layout: tellsLayout, accuseExaminableId: 'tells.till' }],
    junctionPuzzles: [{ sectionId: JUNC, layout: juncLayout }],
  };
}

function setup() {
  const h = makeRun({ module: module() });
  h.run.player.setKit(createKit());
  return h;
}
const press = (run: ReturnType<typeof setup>['run'], at: Vec2): void => {
  run.setPlayerPosition(at);
  run.tick(16, frame({ pressed: ['interact'] }));
};
const sensorOn = (run: ReturnType<typeof setup>['run'], line: number): boolean[] =>
  run.stealthHere()[0]!.runner.hazards.filter((h) => h.id.startsWith(`c8.line${line}.`)).map((h) => h.enabled);

describe('c7.puzzle.tells', () => {
  it('examining by E records the figure once, emits, and saves it in a flag', () => {
    const { run, bus } = setup();
    const seen = record(bus, 'tells:examined');
    press(run, { x: 100, y: 100 });
    press(run, { x: 100, y: 100 });
    expect(seen).toEqual([{ puzzleId: TELLS, figureId: 'a' }]);
    expect(run.tells(TELLS)!.examined()).toEqual(['a']);
    expect(run.flag('tells.c7.puzzle.tells')).toBe('a');
  });

  it('the accuse screen stays shut until every figure is examined', () => {
    const { run } = setup();
    expect(run.openTells(TELLS)).toBe(false);
    FIGS.forEach((id) => run.examineFigure(TELLS, id));
    expect(run.openTells(TELLS)).toBe(true);
    expect(run.activeTells()?.view().figures.every((f) => f.examined)).toBe(true);
  });

  it('E at the till opens the accuse screen once all are examined', () => {
    const { run } = setup();
    press(run, { x: 100, y: 140 });
    expect(run.activeTells()).toBeNull();
    FIGS.forEach((id) => run.examineFigure(TELLS, id));
    press(run, { x: 100, y: 140 });
    expect(run.activeTells()).not.toBeNull();
  });

  it('a wrong accusation costs nothing and can be repeated; the right three solve it', () => {
    const { run, bus } = setup();
    FIGS.forEach((id) => run.examineFigure(TELLS, id));
    run.openTells(TELLS);
    const accused = record(bus, 'tells:accused');
    const done = record(bus, 'section:completed');
    const meter = run.player.meter.value;
    const wrong = run.submitTells(TELLS, ['a', 'b', 'c']);
    expect(wrong).toEqual({ correct: false, textId: 'c7.tells.wrong', refused: false });
    expect(run.isComplete(TELLS)).toBe(false);
    expect(run.activeTells()).not.toBeNull();
    expect(run.player.meter.value).toBe(meter);
    expect(run.submitTells(TELLS, ['b', 'd']).refused).toBe(true);
    expect(run.submitTells(TELLS, ['b', 'b', 'd']).refused).toBe(true);
    const right = run.submitTells(TELLS, ['gary', 'd', 'b']);
    expect(right.correct).toBe(true);
    expect(right.textId).toBe('c7.tells.right');
    expect(run.isComplete(TELLS)).toBe(true);
    expect(accused.map((a) => a.correct)).toEqual([false, true]);
    expect(done.filter((d) => d.sectionId === TELLS)).toHaveLength(1);
  });

  it('one-at-a-time accusing: the third tick accuses', () => {
    const { run } = setup();
    FIGS.forEach((id) => run.examineFigure(TELLS, id));
    run.openTells(TELLS);
    const t = run.tells(TELLS)!;
    expect(t.select('b')).toBeNull();
    expect(t.select('d')).toBeNull();
    expect(t.select('d')).toBeNull();
    expect(t.selection()).toEqual(['b']);
    expect(t.select('d')).toBeNull();
    expect(t.select('gary')?.correct).toBe(true);
  });

  it('completeNow solves it with every figure examined', () => {
    const { run } = setup();
    run.tells(TELLS)!.completeNow('myko');
    expect(run.isComplete(TELLS)).toBe(true);
    expect(run.tells(TELLS)!.allExamined()).toBe(true);
  });

  it('examined figures come back from a save', () => {
    const { run } = setup();
    run.examineFigure(TELLS, 'b');
    run.examineFigure(TELLS, 'd');
    const flags = run.snapshot().flags;
    const again = makeRun({ module: module(), save: (s) => ({ ...s, flags }) });
    expect(again.run.tells(TELLS)!.examined()).toEqual(['b', 'd']);
  });
});

describe('c8.puzzle.junctions', () => {
  it('the layout data gives the spec model: three toggles, one per box, any order', () => {
    expect(minToggles(juncLayout)).toBe(3);
    expect(juncLayout.lines).toHaveLength(5);
    expect(juncLayout.boxes.map((b) => b.toggles)).toEqual([['1', '2'], ['3', '5'], ['4', '5']]);
    expect(juncLayout.targetOff).toEqual(['2', '3', '4']);
  });

  it('every sensor of every line is a real ground sensor of the section', () => {
    const { run } = setup();
    const ids = new Set(run.stealthHere()[0]!.runner.hazards.map((h) => h.id));
    for (const l of SENSOR_LINES) l.sensors.forEach((_, i) => expect(ids.has(lineSensorId(l.line, i))).toBe(true));
    for (const l of juncLayout.lines) for (const s of l.sensorIds) expect(ids.has(s)).toBe(true);
  });

  it('a box flips its two lines and disables exactly their sensors', () => {
    const { run, bus } = setup();
    const toggled = record(bus, 'junctions:toggled');
    const [near] = JUNCTION_BOXES;
    press(run, { x: 100 + 8 * 60, y: 100 });
    expect(near!.id).toBe('near');
    expect(toggled[0]).toMatchObject({ boxId: 'near', off: ['1', '2'] });
    expect(sensorOn(run, 1).every((e) => !e)).toBe(true);
    expect(sensorOn(run, 2).every((e) => !e)).toBe(true);
    expect(sensorOn(run, 3).every((e) => e)).toBe(true);
    press(run, { x: 100 + 8 * 60, y: 100 });
    expect(sensorOn(run, 2).every((e) => e)).toBe(true);
  });

  it('three presses, in any order, open the corridor: lines 2, 3, 4 off, 5 on again', () => {
    for (const order of [[0, 1, 2], [2, 1, 0], [1, 0, 2]]) {
      const { run } = setup();
      for (const i of order) press(run, { x: 100 + (i + 8) * 60, y: 100 });
      expect(run.isComplete(JUNC)).toBe(true);
      for (const l of CORRIDOR_LINES) expect(sensorOn(run, l).every((e) => !e)).toBe(true);
      expect(sensorOn(run, 5).every((e) => e)).toBe(true);
    }
  });

  it('sneaking is safe and running is not, until the corridor lines are off', () => {
    const { run } = setup();
    const runner = run.stealthHere()[0]!.runner;
    const sensor = runner.hazards.find((h) => h.def.kind === 'groundSensor')!;
    const at = { x: sensor.pos.x, y: sensor.pos.y };
    const per = { pos: at, hidden: false, thermalVisible: false };
    expect(sensor.detects(run.grid, { ...per, running: true })).toBe(true);
    expect(sensor.detects(run.grid, { ...per, running: false })).toBe(false);
  });

  it('a section that starts over (return to the bar) keeps the lines Andrew switched off', () => {
    const { run, returns } = setup();
    press(run, { x: 100 + 8 * 60, y: 100 });
    run.stealthHere()[0]!.runner.start();
    run.player.meter = { ...run.player.meter, value: 0.01 };
    advance(run, 300);
    expect(returns.length).toBeGreaterThan(0);
    expect(sensorOn(run, 1).every((e) => !e)).toBe(true);
    expect(sensorOn(run, 3).every((e) => e)).toBe(true);
  });

  it('completeNow switches the corridor lines off', () => {
    const { run } = setup();
    run.junctions(JUNC)!.completeNow('myko');
    expect(run.isComplete(JUNC)).toBe(true);
    for (const l of CORRIDOR_LINES) expect(sensorOn(run, l).every((e) => !e)).toBe(true);
  });

  it('a save with the puzzle solved starts with the lines off', () => {
    const { run } = setup();
    run.junctions(JUNC)!.completeNow('myko');
    const snap = run.snapshot();
    const again = makeRun({ module: module(), save: () => snap });
    for (const l of CORRIDOR_LINES) expect(sensorOn(again.run, l).every((e) => !e)).toBe(true);
  });
});
