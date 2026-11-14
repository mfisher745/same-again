/**
 * Casebook part of the Tab screen: tabs for clues, leads and proof; Andrew's
 * entry with Myko's margin note beside it in the Myko colour. Keys (when this
 * part is showing): A/D or arrows switch tab, W/S or arrows choose an entry.
 */

import Phaser from 'phaser';
import { hasText, text, format } from '../../content/dialogue';
import { PALETTE } from '../../art/palette';
import type { Label } from '../gfx';
import { setLabelColour, setLabelText } from '../gfx';
import { CASEBOOK_TABS, groupCasebook, tabTextId } from '../model/casebook';
import type { CasebookItem, CasebookTab } from '../model/casebook';
import { wrapText } from '../model/wrap';
import type { UiShared } from '../shared';
import { Layer } from './layer';

const TOP = 12;
const LIST = { x: 12, y: 34 + TOP, rowHeight: 11, rows: 18, chars: 22 } as const;
const BODY = { x: 160, y: 36 + TOP, chars: 30, maxLines: 19 } as const;
const MARGIN = { x: 358, y: 36 + TOP, chars: 19 } as const;

export class CasebookView {
  private readonly layer: Layer;
  private tab: CasebookTab = 'clues';
  private selected = 0;
  private scroll = 0;
  private readonly tabBg: Phaser.GameObjects.Rectangle[] = [];
  private readonly tabLabels: Label[] = [];
  private readonly rows: Array<{ bg: Phaser.GameObjects.Rectangle; label: Label }> = [];
  private readonly body: Label;
  private readonly margin: Label;
  private readonly empty: Label;
  private lastKey = '';

  constructor(
    scene: Phaser.Scene,
    private readonly shared: UiShared,
  ) {
    const L = (this.layer = new Layer(scene));
    L.rect(154, 30 + TOP, 1, 228 - TOP, 'fog');
    L.rect(350, 30 + TOP, 1, 228 - TOP, 'fog');
    CASEBOOK_TABS.forEach((t, i) => {
      const x = 12 + i * 70;
      const bg = L.rect(x, 24, 66, 13, 'fog');
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.setTab(t));
      this.tabBg.push(bg);
      this.tabLabels.push(L.label(x + 33, 27, text(tabTextId(t)), 'ink', { anchor: 'centre' }));
    });
    L.label(468, 27, text('ui.casebook.title'), 'beanie', { anchor: 'right' });
    for (let i = 0; i < LIST.rows; i++) {
      const y = LIST.y + i * LIST.rowHeight;
      const bg = L.rect(LIST.x - 2, y, 140, LIST.rowHeight - 1, 'bone');
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.selected = this.scroll + i;
        this.shared.hooks.play?.('uiMove');
      });
      this.rows.push({ bg, label: L.label(LIST.x, y + 1, '', 'ink') });
    }
    this.body = L.label(BODY.x, BODY.y, '', 'ink');
    this.margin = L.label(MARGIN.x, MARGIN.y, '', 'beanie');
    this.empty = L.label(LIST.x, LIST.y, text('ui.casebook.empty'), 'steel');
  }

  setVisible(visible: boolean): void {
    this.layer.setVisible(visible);
    this.lastKey = '\0';
  }

  /** Reset to the first tab and entry (the screen was just opened). */
  reset(): void {
    this.tab = 'clues';
    this.selected = 0;
    this.scroll = 0;
    this.lastKey = '\0';
  }

  /** Keys handled by the casebook part: `left`, `right`, `up`, `down`. */
  key(name: 'left' | 'right' | 'up' | 'down'): void {
    if (name === 'left') this.shiftTab(-1);
    else if (name === 'right') this.shiftTab(1);
    else this.moveSel(name === 'up' ? -1 : 1);
  }

  wheel(dy: number): void {
    this.moveSel(dy > 0 ? 1 : -1);
  }

  private items(): CasebookItem[] {
    return groupCasebook(this.shared.source.casebook())[this.tab];
  }

  private setTab(t: CasebookTab): void {
    if (t === this.tab) return;
    this.tab = t;
    this.selected = 0;
    this.scroll = 0;
    this.shared.hooks.play?.('uiMove');
  }

  private shiftTab(d: number): void {
    const i = CASEBOOK_TABS.indexOf(this.tab);
    const next = CASEBOOK_TABS[(i + d + CASEBOOK_TABS.length) % CASEBOOK_TABS.length];
    if (next !== undefined) this.setTab(next);
  }

  private moveSel(d: number): void {
    const n = this.items().length;
    if (n === 0) return;
    this.selected = Phaser.Math.Clamp(this.selected + d, 0, n - 1);
    this.shared.hooks.play?.('uiMove');
  }

  update(): void {
    const items = this.items();
    this.selected = Phaser.Math.Clamp(this.selected, 0, Math.max(0, items.length - 1));
    if (this.selected < this.scroll) this.scroll = this.selected;
    if (this.selected >= this.scroll + LIST.rows) this.scroll = this.selected - LIST.rows + 1;

    CASEBOOK_TABS.forEach((t, i) => {
      const active = t === this.tab;
      this.tabBg[i]?.setFillStyle(PALETTE[active ? 'bone' : 'fog']);
      const l = this.tabLabels[i];
      if (l !== undefined) setLabelColour(l, active ? 'beanie' : 'slate');
    });
    this.empty.setVisible(items.length === 0);
    this.rows.forEach((row, i) => {
      const item = items[this.scroll + i];
      row.bg.setVisible(item !== undefined);
      row.label.setVisible(item !== undefined);
      if (item === undefined) return;
      const sel = this.scroll + i === this.selected;
      row.bg.setFillStyle(PALETTE[sel ? 'fog' : 'bone']);
      setLabelText(row.label, this.titleOf(item).slice(0, LIST.chars));
    });
    const item = items[this.selected];
    const key = item === undefined ? '' : item.key;
    if (key === this.lastKey) return;
    this.lastKey = key;
    if (item === undefined) {
      setLabelText(this.body, '');
      setLabelText(this.margin, '');
      return;
    }
    setLabelText(this.body, hasText(item.bodyId) ? wrapText(text(item.bodyId), BODY.chars).slice(0, BODY.maxLines).join('\n') : '');
    setLabelText(this.margin, hasText(item.marginId) ? wrapText(text(item.marginId), MARGIN.chars).join('\n') : '');
  }

  private titleOf(item: CasebookItem): string {
    if (item.titleId !== null && hasText(item.titleId)) return text(item.titleId);
    return format('ui.chapter.label', { n: item.chapter });
  }
}
