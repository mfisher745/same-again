/**
 * The Tab screen: the casebook and the kit as two parts of one scene. Opened
 * by the HUD scene (Tab, as a toggle or while held, from Settings); the game
 * is paused while it is open. Keys: 1 and 2 (or a click) pick the part;
 * the rest belong to the part showing. DESIGN.md 7.7.
 */

import Phaser from 'phaser';
import { PALETTE } from '../../art/palette';
import { text } from '../../content/dialogue';
import type { Label } from '../gfx';
import { makeLabel, rect, setLabelColour } from '../gfx';
import { KEY_IDS, keyText } from '../keycaps';
import { CasebookView } from '../tab/casebookView';
import { KitView } from '../tab/kitView';
import { UiSceneKeys } from '../shared';
import type { UiShared } from '../shared';

export type TabPart = 'casebook' | 'kit';
/** The part the screen opened on last time; it opens there again. */
let lastPart: TabPart = 'casebook';
const PARTS: readonly TabPart[] = ['casebook', 'kit'];

export class TabScene extends Phaser.Scene {
  private part: TabPart = 'casebook';
  private casebook!: CasebookView;
  private kit!: KitView;
  private tabBg: Phaser.GameObjects.Rectangle[] = [];
  private tabLabels: Label[] = [];
  private cleanups: Array<() => void> = [];

  constructor(private readonly shared: UiShared) {
    super(UiSceneKeys.Tab);
  }

  /** `part` picks which half opens first. */
  init(data: { part?: TabPart }): void {
    this.part = data.part ?? lastPart;
  }

  create(): void {
    this.tabBg = [];
    this.tabLabels = [];
    rect(this, 0, 0, 480, 270, 'ink');
    rect(this, 6, 6, 468, 258, 'bone');
    PARTS.forEach((p, i) => {
      const x = 12 + i * 70;
      const bg = rect(this, x, 8, 66, 14, 'fog');
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.setPart(p));
      this.tabBg.push(bg);
      this.tabLabels.push(makeLabel(this, x + 33, 11, `${keyText(`ui.key.${i + 1}`)} ${text(p === 'casebook' ? 'ui.tab.casebook' : 'ui.tab.kit')}`, 'ink', { anchor: 'centre' }));
    });
    makeLabel(this, 468, 11, keyText(KEY_IDS.tab), 'slate', { anchor: 'right' });
    this.casebook = new CasebookView(this, this.shared);
    this.kit = new KitView(this, this.shared);
    this.casebook.reset();
    this.kit.reset();
    this.applyPart();
    this.bindKeys();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const c of this.cleanups) c();
      this.cleanups = [];
    });
  }

  private on(names: readonly string[], fn: () => void): void {
    const kb = this.input.keyboard;
    if (kb === null) return;
    for (const n of names) {
      const ev = `keydown-${n}`;
      kb.on(ev, fn);
      this.cleanups.push(() => kb.off(ev, fn));
    }
  }

  private bindKeys(): void {
    const casebook = (k: 'left' | 'right' | 'up' | 'down') => (): void => {
      if (this.part === 'casebook') this.casebook.key(k);
    };
    this.on(['LEFT', 'A'], casebook('left'));
    this.on(['RIGHT', 'D'], casebook('right'));
    this.on(['UP', 'W'], () => (this.part === 'casebook' ? this.casebook.key('up') : this.kit.move(-1)));
    this.on(['DOWN', 'S'], () => (this.part === 'casebook' ? this.casebook.key('down') : this.kit.move(1)));
    this.on(['ENTER', 'E'], () => {
      if (this.part === 'kit') this.kit.assignSelected();
    });
    this.on(['Q'], () => {
      if (this.part === 'kit') this.kit.drinkSelected();
    });
    this.on(['ONE'], () => this.setPart('casebook'));
    this.on(['TWO'], () => this.setPart('kit'));
    const wheel = (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number): void => {
      if (this.part === 'casebook') this.casebook.wheel(dy);
      else this.kit.move(dy > 0 ? 1 : -1);
    };
    this.input.on('wheel', wheel);
    this.cleanups.push(() => this.input.off('wheel', wheel));
  }

  private setPart(p: TabPart): void {
    if (p === this.part) return;
    this.part = p;
    lastPart = p;
    this.shared.hooks.play?.('uiMove');
    this.applyPart();
  }

  private applyPart(): void {
    this.casebook.setVisible(this.part === 'casebook');
    this.kit.setVisible(this.part === 'kit');
  }

  update(): void {
    PARTS.forEach((p, i) => {
      const active = p === this.part;
      this.tabBg[i]?.setFillStyle(PALETTE[active ? 'bone' : 'fog']);
      const l = this.tabLabels[i];
      if (l !== undefined) setLabelColour(l, active ? 'beanie' : 'slate');
    });
    if (this.part === 'casebook') this.casebook.update();
    else this.kit.update(this.time.now);
  }
}
