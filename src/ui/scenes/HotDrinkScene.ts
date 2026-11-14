/**
 * The bar's free hot drink: coffee or tea, once per visit. Opened by
 * `openHotDrinkChoice()` (a chapter script at the urn). The pick goes through
 * `source.takeHotDrink`; Esc backs out and leaves the offer open.
 */

import Phaser from 'phaser';
import { text } from '../../content/dialogue';
import type { HotDrinkId } from '../../core/types';
import { makeLabel, rect } from '../gfx';
import { SCREEN } from '../layout';
import { UiSceneKeys } from '../shared';
import type { UiShared } from '../shared';
import { Menu } from '../widgets';

export class HotDrinkScene extends Phaser.Scene {
  private menu: Menu | null = null;

  constructor(private readonly shared: UiShared) {
    super(UiSceneKeys.HotDrink);
  }

  create(): void {
    const w = 140;
    const x = (SCREEN.width - w) / 2;
    rect(this, x - 8, 84, w + 16, 78, 'coal');
    rect(this, x - 8, 84, w + 16, 1, 'slate');
    makeLabel(this, SCREEN.width / 2, 92, text('ui.bar.choose'), 'bone', { anchor: 'centre' });
    const pick = (id: HotDrinkId): void => {
      if (this.shared.source.takeHotDrink(id)) this.shared.hooks.play?.('hotDrink');
      this.close();
    };
    this.menu = new Menu(
      this,
      [
        { kind: 'button', label: () => text('ui.bar.coffee'), onSelect: () => pick('coffee') },
        { kind: 'button', label: () => text('ui.bar.tea'), onSelect: () => pick('tea') },
      ],
      { x, y: 108, width: w, hooks: this.shared.hooks },
    );
    // Keyup, so the HUD's keydown handler for Esc never sees the same press.
    this.input.keyboard?.on('keyup-ESC', () => this.close());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.menu?.destroy();
      this.menu = null;
    });
  }

  private close(): void {
    this.shared.overlays.hide('hotdrink');
    this.scene.stop();
  }
}
