/**
 * Tutorial prompts stacked above the pickup line. A prompt that starts with a
 * key shows it as a keycap. Several can be up at once; each goes away by ID.
 */

import type Phaser from 'phaser';
import type { TextId } from '../../core/types';
import type { Label } from '../gfx';
import { makeLabel, rect, setLabelText } from '../gfx';
import { CELL, DIALOGUE_BOX, SCREEN } from '../layout';
import { promptKey, promptParts } from '../model/promptText';
import type { PromptValues } from '../model/promptText';
import { Cap, capWidth } from './cap';

interface Entry {
  readonly key: string;
  readonly textId: TextId;
  readonly bg: Phaser.GameObjects.Rectangle;
  readonly cap: Cap;
  readonly label: Label;
  readonly keyStr: string | null;
  readonly width: number;
}

export class PromptStack {
  private entries: Entry[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
  ) {}

  show(textId: TextId, values?: PromptValues): void {
    const key = promptKey(textId, values);
    if (this.entries.some((e) => e.key === key)) return;
    const parts = promptParts(textId, values);
    const bg = rect(this.scene, 0, 0, SCREEN.width, 11, 'ink', this.depth);
    const cap = new Cap(this.scene, this.depth + 1);
    const label = makeLabel(this.scene, 0, 0, '', 'amberLight', { depth: this.depth + 1 });
    setLabelText(label, parts.rest);
    const width = (parts.key === null ? 0 : capWidth(parts.key) + 4) + parts.rest.length * CELL.width;
    const entry: Entry = { key, textId, bg, cap, label, keyStr: parts.key, width };
    this.entries.push(entry);
    this.layout();
  }

  /** Hide every prompt of this text ID, or all of them when no ID is given. */
  hide(textId?: TextId): void {
    const keep: Entry[] = [];
    for (const e of this.entries) {
      if (textId === undefined || e.textId === textId) {
        e.bg.destroy();
        e.cap.destroy();
        e.label.destroy();
      } else keep.push(e);
    }
    this.entries = keep;
    this.layout();
  }

  private layout(): void {
    // Above the pickup and refusal lines, stacked upwards.
    let y = DIALOGUE_BOX.y - 40;
    for (const e of this.entries) {
      e.bg.setPosition(0, y);
      let x = Math.round((SCREEN.width - e.width) / 2);
      if (e.keyStr !== null) x += e.cap.show(e.keyStr, x, y + 1, 'amberLight') + 4;
      e.label.setPosition(x, y + 1);
      y -= 12;
    }
  }

  destroy(): void {
    this.hide();
  }
}
