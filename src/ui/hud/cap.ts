/** A small key cap: the key's letters in a lit box. Used by the HUD, the prompts and the Tab screen. */

import type Phaser from 'phaser';
import { PALETTE } from '../../art/palette';
import type { ColourName } from '../../art/palette';
import type { Label } from '../gfx';
import { makeLabel, rect, setLabelColour, setLabelText } from '../gfx';
import { CELL } from '../layout';

/** Width in pixels of a cap showing `str`. */
export const capWidth = (str: string): number => str.length * CELL.width + 2;

export class Cap {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly label: Label;
  constructor(scene: Phaser.Scene, depth: number) {
    this.bg = rect(scene, 0, 0, 8, CELL.height, 'steel', depth).setVisible(false);
    this.label = makeLabel(scene, 0, 0, '', 'ink', { depth: depth + 1 }).setVisible(false);
  }
  /** Shows `str` with its top-left at (x, y). Returns the width used. */
  show(str: string, x: number, y: number, bg: ColourName = 'steel', fg: ColourName = 'ink'): number {
    const w = capWidth(str);
    this.bg.setPosition(x, y).setSize(w, CELL.height).setFillStyle(PALETTE[bg]).setVisible(true);
    setLabelText(this.label, str);
    setLabelColour(this.label, fg);
    this.label.setPosition(x + 1, y).setVisible(true);
    return w;
  }
  hide(): void {
    this.bg.setVisible(false);
    this.label.setVisible(false);
  }
  destroy(): void {
    this.bg.destroy();
    this.label.destroy();
  }
}
