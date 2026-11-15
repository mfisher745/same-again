/**
 * Dev harness entry. Not part of the game build: load it from a throwaway HTML
 * page through Vite. Exposes `window.__dev` so Playwright can drive the UI.
 */

import Phaser from 'phaser';
import { createAudio, EFFECT_IDS } from '../../audio';
import { scheduleSection, sectionsFor } from '../../audio/music';
import { makeNoiseBuffer, renderEffect } from '../../audio/synth';
import type { EffectId } from '../../audio';
import { PALETTE } from '../../art/palette';
import { registerArt } from '../../art';
import type { EvidenceId, MoveId, RegionId, SpecialLevel, WeaponId } from '../../core/types';
import { TUNING } from '../../content/tuning';
import { createUiScenes, hideTutorialPrompt, openHotDrinkChoice, showSlotPrompt, showTutorialPrompt, UiSceneKeys } from '..';
import { FakeSource } from './fakeSource';

class WorldScene extends Phaser.Scene {
  constructor() {
    super('DevWorld');
  }
  create(): void {
    registerArt(this);
    this.add.rectangle(0, 0, 480, 270, PALETTE.moss).setOrigin(0, 0);
    for (let x = 0; x < 480; x += 16) for (let y = 0; y < 270; y += 16) {
      if ((x / 16 + y / 16) % 2 === 0) this.add.rectangle(x, y, 16, 16, PALETTE.mossDark).setOrigin(0, 0);
    }
  }
}

const source = new FakeSource();
source.saveState = null;
const audio = createAudio(source.bus, () => source.audioSettings());

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#14121a',
  scale: { mode: Phaser.Scale.NONE, width: 480, height: 270, zoom: 2 },
  scene: [WorldScene, ...createUiScenes(source, { play: (e: EffectId) => audio.play(e) })],
});

/** Renders an effect offline and returns the peak sample, to prove it is not silent. */
async function peakOf(kind: 'effect' | 'theme', name: string): Promise<number> {
  if (kind === 'theme') return (await renderThemeSections(name as RegionId, 0))[0]?.peak ?? 0;
  const ctx = new OfflineAudioContext(1, 44100 * 1.2, 44100);
  const noise = makeNoiseBuffer(ctx);
  renderEffect(name as EffectId, { ctx, dest: ctx.destination, noise }, 0.01);
  const out = await ctx.startRendering();
  let peak = 0;
  for (const v of out.getChannelData(0)) peak = Math.max(peak, Math.abs(v));
  return peak;
}

/** Renders every section of a region's theme at a boss level (0 = normal) offline: peak and duration of each. */
async function renderThemeSections(region: RegionId, level: number): Promise<Array<{ id: string; kind: string; seconds: number; peak: number }>> {
  const out: Array<{ id: string; kind: string; seconds: number; peak: number }> = [];
  for (const section of sectionsFor(region, level)) {
    const ctx = new OfflineAudioContext(1, Math.ceil(44100 * (section.durationSec + 2)), 44100);
    const noise = makeNoiseBuffer(ctx);
    scheduleSection(ctx, ctx.destination, noise, section, 0.05);
    const buf = await ctx.startRendering();
    let peak = 0;
    for (const v of buf.getChannelData(0)) peak = Math.max(peak, Math.abs(v));
    out.push({ id: section.id, kind: section.kind, seconds: Math.round(section.durationSec * 10) / 10, peak: Math.round(peak * 1000) / 1000 });
  }
  return out;
}

const ev = (id: string): EvidenceId => id as EvidenceId;

const dev = {
  game,
  source,
  audio,
  keys: UiSceneKeys,
  peakOf,
  renderThemeSections,
  effectIds: EFFECT_IDS,
  errors: [] as string[],
  start(key: string): void {
    for (const k of Object.values(UiSceneKeys)) game.scene.stop(k);
    game.scene.start(key);
    if (key === UiSceneKeys.Hud) game.scene.bringToTop(key);
  },
  say(id: string): void {
    source.bus.emit('dialogue:show', { sequenceId: id });
  },
  fillCasebook(): void {
    source.entries = [
      { kind: 'evidence', evidenceId: ev('c3.clue.map'), chapter: 3 },
      { kind: 'evidence', evidenceId: ev('c3.clue.brochure'), chapter: 3 },
      { kind: 'evidence', evidenceId: ev('c3.clue.manifest'), chapter: 3 },
      { kind: 'lead', deductionId: 'c3.deduction.boston', chapter: 3 },
      { kind: 'mykoCall', sectionId: 'c3.fight.bay', callKind: 'fight', chapter: 3 },
    ];
  },
  openBoard(): void {
    source.board = {
      id: 'c3.deduction.boston',
      chapter: 3,
      candidateIds: ['c3.clue.map', 'c3.clue.brochure', 'c3.clue.certificate', 'c3.clue.visitors', 'c3.clue.manifest'].map(ev),
      solution: [ev('c3.clue.map'), ev('c3.clue.brochure'), ev('c3.clue.manifest')],
      leadTextId: 'c3.deduction.boston.lead.body',
      leadMarginTextId: 'c3.deduction.boston.lead.margin',
      wrongAnswerDialogueIds: ['dev.box.myko'],
    };
  },
  prompt(id: string): void {
    showTutorialPrompt(game, id);
  },
  unprompt(): void {
    hideTutorialPrompt(game);
  },
  /** Both ways back to the bar, as the game fires them. */
  returnSober(): void {
    source.returnToBar('sober');
  },
  returnFloor(): void {
    source.returnToBar('floor');
  },
  /** The middle of a level (1 Buzzed .. 4 Fecked). */
  level(n: SpecialLevel): void {
    source.setLevelMiddle(n);
  },
  /** Set the meter to a raw value (the flat-colour look is under 10). */
  buzz(v: number): void {
    source.buzzValue = v;
    source.syncSlots();
  },
  /** Learn a move, light its slot and fire it. */
  move(id: MoveId): void {
    source.fire(id);
  },
  /** Gain a weapon and select it. */
  weapon(id: WeaponId): void {
    source.gain(id, true);
  },
  openTab(): void {
    // The HUD scene opens the Tab screen; its method is public for this.
    (game.scene.getScene(UiSceneKeys.Hud) as unknown as { openTab(): void }).openTab();
  },
  hotDrink(): void {
    openHotDrinkChoice();
  },
  /** Show a throw preview arcing across the middle of the screen, or clear it. */
  aim(on: boolean): void {
    if (!on) {
      source.aim = null;
      return;
    }
    const path = Array.from({ length: 18 }, (_, i) => ({ x: 120 + i * 14, y: 170 - Math.sin((i / 17) * Math.PI) * 50 }));
    source.aim = { origin: path[0]!, landing: path[17]!, path, swayAmount: 0 };
  },
  sun(on: boolean): void {
    source.inSun = on;
  },
  spirit(on: boolean): void {
    source.spiritActive = on;
    source.bus.emit(on ? 'spirit:started' : 'spirit:ended', on ? { drinkId: 'whiskey', durationMs: 8000 } : { drinkId: 'whiskey' });
  },
  refuse(): void {
    source.lastRefusal = { textId: 'ui.move.dark', seq: (source.lastRefusal?.seq ?? 0) + 1 };
  },
  /** Everything at once: all moves learned, all weapons, a full set of drinks. */
  fullKit(): void {
    for (const id of Object.keys(TUNING.overhaul?.moves ?? {}) as MoveId[]) source.learn(id);
    for (const id of ['hurley', 'clipboard', 'shillelagh', 'umbrella', 'inflatableAlien', 'securityWand'] as WeaponId[]) source.gain(id, false);
    source.kitState = { ...source.kitState, drinks: { stout: 2, lager: 1, whiskey: 1, tequila: 1 }, hotDrink: 'tea', bottles: 5 };
    source.syncSlots();
  },
};

// The fake's cooldowns run in real time.
let lastTick = performance.now();
setInterval(() => {
  const now = performance.now();
  source.advance(now - lastTick);
  lastTick = now;
}, 50);

/** A panel of buttons under the game, so none of this needs a full playthrough. */
function buildPanel(): void {
  const panel = document.getElementById('panel');
  if (panel === null) return;
  const add = (label: string, fn: () => void): void => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'margin:2px;font:12px monospace';
    b.onclick = fn;
    panel.appendChild(b);
  };
  const row = (title: string): void => {
    const d = document.createElement('div');
    d.textContent = title;
    d.style.cssText = 'font:12px monospace;color:#aaa;margin-top:6px';
    panel.appendChild(d);
  };
  row('screens');
  add('HUD', () => dev.start(UiSceneKeys.Hud));
  add('Tab screen', () => dev.openTab());
  add('Hot drink', () => dev.hotDrink());
  add('Full kit', () => dev.fullKit());
  add('Casebook entries', () => dev.fillCasebook());
  add('Tab mode', () => source.setTabMode(source.tabMode() === 'toggle' ? 'hold' : 'toggle'));
  row('returns');
  add('Sober return', () => dev.returnSober());
  add('Floor return', () => dev.returnFloor());
  add('Buzz 8 (flat)', () => dev.buzz(8));
  row('levels (middle of each)');
  for (const n of [1, 2, 3, 4] as const) add(`Level ${n}`, () => dev.level(n));
  row('moves (learn and fire)');
  for (const id of Object.keys(TUNING.overhaul?.moves ?? {}) as MoveId[]) add(id, () => dev.move(id));
  row('weapons (gain and select)');
  for (const id of ['fists', 'hurley', 'clipboard', 'shillelagh', 'umbrella', 'inflatableAlien', 'securityWand'] as WeaponId[]) add(id, () => dev.weapon(id));
  row('other');
  add('Aim on', () => dev.aim(true));
  add('Aim off', () => dev.aim(false));
  add('Sun on', () => dev.sun(true));
  add('Sun off', () => dev.sun(false));
  add('Spirit on', () => dev.spirit(true));
  add('Spirit off', () => dev.spirit(false));
  add('Refusal', () => dev.refuse());
  add('Prompt: slot 2', () => showSlotPrompt(2));
  add('Prompt: weapon', () => dev.prompt('ui.prompt.weapon'));
  add('Prompt: kit', () => dev.prompt('ui.prompt.kit'));
  add('Prompt: throw', () => dev.prompt('ui.prompt.throw'));
  add('Clear prompts', () => dev.unprompt());
}
buildPanel();
if (new URLSearchParams(window.location.search).has('hud')) game.events.once('ready', () => dev.start(UiSceneKeys.Hud));

window.addEventListener('error', (e) => dev.errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => dev.errors.push(String(e.reason)));
(window as unknown as { __dev: typeof dev }).__dev = dev;
