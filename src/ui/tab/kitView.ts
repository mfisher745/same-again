/**
 * Kit part of the Tab screen, in two groups. Items (beer, spirits, hot drink,
 * bottles, weapons) sit beside the item slots that take them; Moves sit beside
 * the four special slots. Click an entry and the kit does the right thing:
 * a beer or the hot drink becomes Q's pick, a spirit goes in the spirit slot,
 * a weapon is equipped, a move goes in its level's slot. There is no "put it
 * here" step. Keys: W/S move the cursor, E or Enter clicks it. DESIGN.md 7.7.
 */

import Phaser from 'phaser';
import { PALETTE } from '../../art/palette';
import { format, hasText, text } from '../../content/dialogue';
import type { Kit, SpecialSlotIndex, TextId } from '../../core/types';
import type { Label, Pic } from '../gfx';
import { iconFrames, setLabelColour, setLabelText } from '../gfx';
import { KEY_IDS, keyText } from '../keycaps';
import { ITEM_SLOTS, MOVE_SLOTS, SLOT_STATE_TEXT, buildKitView, chooseItem, clearSlot, inUse, itemKey, slotContent, slotFor, slotTakesText, slotTitleText } from '../model/kit';
import type { KitItem, KitSlotRef } from '../model/kit';
import { wrapText } from '../model/wrap';
import type { UiShared } from '../shared';
import { Layer } from './layer';

const ROW = 11;
const COL1 = { x: 12, width: 126, chars: 18 } as const;
const COL2 = { x: 150, width: 126, chars: 18 } as const;
const COL3 = { x: 288, width: 180, chars: 29 } as const;
const TOP = 28;
const SUB = 11;
/** Height of a slot box: the title line, then one line of "what it takes", or two. */
const BOX_H = { one: 21, two: 30 } as const;

interface Row {
  readonly bg: Phaser.GameObjects.Rectangle;
  readonly icon: Pic;
  readonly name: Label;
  readonly note: Label;
}

interface SlotBox {
  readonly ref: KitSlotRef;
  readonly bg: Phaser.GameObjects.Rectangle;
  readonly content: Label;
  readonly icon: Pic;
}

const nameOf = (item: { readonly kind: string; readonly id: string }): string => {
  const id: TextId = item.kind === 'move' ? `ability.${item.id}.name` : item.kind === 'weapon' ? `weapon.${item.id}.name` : `drink.${item.id}.name`;
  return hasText(id) ? text(id) : id;
};

const descOf = (item: KitItem): string => {
  const id: TextId = item.kind === 'move' ? `ability.${item.id}.desc` : item.kind === 'weapon' ? `weapon.${item.id}.desc` : `drink.${item.id}.pickup`;
  return hasText(id) ? text(id) : '';
};

const iconOf = (kind: string, id: string): string =>
  kind === 'move' ? iconFrames.move(id as never) : kind === 'weapon' ? iconFrames.weapon(id as never) : iconFrames.drink(id as never);

/** The key that uses what a slot holds (Q, G, R, or a special's own number). */
const slotKey = (ref: KitSlotRef): string =>
  keyText(ref.kind === 'special' ? KEY_IDS.slot(ref.slot) : ref.kind === 'spirit' ? KEY_IDS.spirit : ref.kind === 'melee' ? KEY_IDS.weapon : KEY_IDS.drink);

const takesLines = (ref: KitSlotRef): string[] => {
  const values = { key: slotKey(ref), n: ref.kind === 'special' ? ref.slot : 0, state: ref.kind === 'special' ? text(SLOT_STATE_TEXT[ref.slot]) : '' };
  return wrapText(format(slotTakesText(ref), values), COL3.chars);
};

export class KitView {
  private readonly layer: Layer;
  private readonly beerRows: Row[] = [];
  private readonly spiritRows: Row[] = [];
  private readonly hotRow: Row;
  private readonly weaponRows: Row[] = [];
  private readonly moveRows: Row[] = [];
  private readonly slotBoxes: SlotBox[] = [];
  private readonly places: Label;
  private readonly beersNone: Label;
  private readonly spiritsNone: Label;
  private readonly hotNone: Label;
  private readonly bottleLabel: Label;
  private readonly movesNone: Label;
  private readonly picked: Label;
  private readonly desc: Label;
  /** The keyboard cursor (and what the description shows). Clicking sets it too. */
  private cursorKey: string | null = null;
  private current: readonly KitItem[] = [];
  private readonly descY: number;

  constructor(
    scene: Phaser.Scene,
    private readonly shared: UiShared,
  ) {
    const L = (this.layer = new Layer(scene));
    L.rect(144, TOP, 1, 232, 'fog');
    L.rect(282, TOP, 1, 232, 'fog');
    // Items: the list on the left.
    L.label(COL1.x, TOP, text('ui.kit.section.items'), 'beanie');
    let y = TOP + SUB;
    L.label(COL1.x, y, text('ui.kit.beer'), 'slate');
    this.places = L.label(COL1.x + COL1.width, y, '', 'slate', { anchor: 'right' });
    y += SUB;
    for (let i = 0; i < 4; i++) this.beerRows.push(this.makeRow(L, COL1.x, y + i * ROW, COL1.width));
    this.beersNone = L.label(COL1.x, y, '', 'steel');
    y += 4 * ROW + 3;
    L.label(COL1.x, y, text('ui.kit.spirits'), 'slate');
    y += SUB;
    for (let i = 0; i < 2; i++) this.spiritRows.push(this.makeRow(L, COL1.x, y + i * ROW, COL1.width));
    this.spiritsNone = L.label(COL1.x, y, '', 'steel');
    y += 2 * ROW + 3;
    L.label(COL1.x, y, text('ui.kit.hotDrink'), 'slate');
    y += SUB;
    this.hotRow = this.makeRow(L, COL1.x, y, COL1.width);
    this.hotNone = L.label(COL1.x, y, '', 'steel');
    y += 2 * ROW + 1;
    L.icon(COL1.x + 1, y).set(iconFrames.drink('bottle'), 'fog');
    this.bottleLabel = L.label(COL1.x + 16, y + 2, '', 'ink');
    y += ROW + 3;
    L.label(COL1.x, y, text('ui.kit.weapons'), 'slate');
    y += SUB;
    for (let i = 0; i < 7; i++) this.weaponRows.push(this.makeRow(L, COL1.x, y + i * ROW, COL1.width));
    // Moves: the list in the middle.
    L.label(COL2.x, TOP, text('ui.kit.section.moves'), 'beanie');
    for (let i = 0; i < 13; i++) this.moveRows.push(this.makeRow(L, COL2.x, TOP + SUB + i * ROW, COL2.width));
    this.movesNone = L.label(COL2.x, TOP + SUB, '', 'steel');
    // What is picked, how to use it, and the description of what the cursor is on.
    const iy = TOP + SUB + 13 * ROW + 4;
    this.picked = L.label(COL2.x, iy, '', 'ink');
    const how = wrapText(format('ui.kit.howTo', { key: keyText(KEY_IDS.drink) }), 21);
    L.label(COL2.x, iy + 10, how.join('\n'), 'slate');
    this.descY = iy + 10 + how.length * 9 + 4;
    this.desc = L.label(COL2.x, this.descY, '', 'ink');
    // Slots on the right: item slots, then move slots.
    let sy = TOP;
    L.label(COL3.x, sy, `${text('ui.kit.section.items')} ${text('ui.kit.slots')}`, 'beanie');
    sy += SUB;
    for (const ref of ITEM_SLOTS) sy = this.makeSlot(L, ref, sy);
    sy += 2;
    L.label(COL3.x, sy, `${text('ui.kit.section.moves')} ${text('ui.kit.slots')}`, 'beanie');
    sy += SUB;
    for (const ref of MOVE_SLOTS) sy = this.makeSlot(L, ref, sy);
  }

  private makeRow(L: Layer, x: number, y: number, width: number): Row {
    const bg = L.rect(x - 2, y, width + 2, ROW, 'bone');
    bg.setInteractive({ useHandCursor: true });
    const icon = L.icon(x, y - 1);
    const name = L.label(x + 15, y + 1, '', 'ink');
    const note = L.label(x + width, y + 1, '', 'slate', { anchor: 'right' });
    return { bg, icon, name, note };
  }

  /** Draw one slot box at `y`; returns the y for the next one. */
  private makeSlot(L: Layer, ref: KitSlotRef, y: number): number {
    const lines = takesLines(ref);
    const h = lines.length > 1 ? BOX_H.two : BOX_H.one;
    const bg = L.rect(COL3.x - 2, y, COL3.width + 2, h, 'fog');
    bg.setInteractive({ useHandCursor: true }).on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) this.clear(ref);
    });
    const title = ref.kind === 'special' ? format(slotTitleText(ref), { n: ref.slot }) : text(slotTitleText(ref));
    L.label(COL3.x + 2, y + 2, title, 'slate');
    const content = L.label(COL3.x + 62, y + 2, '', 'ink');
    const icon = L.icon(COL3.x + COL3.width - 14, y + 1);
    L.label(COL3.x + 2, y + 11, lines.join('\n'), 'steel');
    this.slotBoxes.push({ ref, bg, content, icon });
    return y + h + 1;
  }

  setVisible(visible: boolean): void {
    this.layer.setVisible(visible);
  }

  reset(): void {
    this.cursorKey = null;
  }

  private cursor(): KitItem | null {
    return this.current.find((i) => itemKey(i) === this.cursorKey) ?? null;
  }

  private setCursor(item: KitItem): void {
    this.cursorKey = itemKey(item);
    this.shared.hooks.play?.('uiMove');
  }

  /** W/S: move the cursor through the lists in the order they are drawn. */
  move(d: 1 | -1): void {
    if (this.current.length === 0) return;
    const i = this.current.findIndex((x) => itemKey(x) === this.cursorKey);
    const next = Phaser.Math.Clamp(i < 0 ? 0 : i + d, 0, this.current.length - 1);
    const item = this.current[next];
    if (item !== undefined) this.setCursor(item);
  }

  /** E or Enter: the same as a click on the cursor's entry. */
  chooseCursor(): void {
    const item = this.cursor();
    if (item !== null) this.choose(item);
  }

  private choose(item: KitItem): void {
    this.cursorKey = itemKey(item);
    this.shared.hooks.play?.(chooseItem(this.shared.source, item) ? 'uiSelect' : 'uiMove');
  }

  private clear(ref: KitSlotRef): void {
    if (clearSlot(this.shared.source, ref)) this.shared.hooks.play?.('uiMove');
  }

  private paintRow(row: Row, kit: Kit, item: KitItem | null, note = ''): void {
    row.bg.setVisible(item !== null);
    row.name.setVisible(item !== null);
    row.note.setVisible(item !== null);
    if (item === null) {
      row.icon.setVisible(false);
      return;
    }
    row.bg.setFillStyle(PALETTE[inUse(kit, item) ? 'sand' : 'bone']);
    if (itemKey(item) === this.cursorKey) row.bg.setStrokeStyle(1, PALETTE.slate);
    else row.bg.setStrokeStyle();
    row.icon.set(iconOf(item.kind === 'hot' ? 'drink' : item.kind, item.id), item.kind === 'move' ? 'amberLight' : item.kind === 'weapon' ? 'steel' : 'amber');
    setLabelText(row.name, nameOf(item).slice(0, note === '' ? COL1.chars : COL1.chars - 3));
    setLabelText(row.note, note);
    row.bg.off('pointerdown');
    row.bg.on('pointerdown', () => this.choose(item));
  }

  update(): void {
    const { source } = this.shared;
    const kit: Kit = source.kit();
    const v = buildKitView(kit);
    this.current = [...v.beers, ...v.spirits, ...(v.hot === null ? [] : [{ kind: 'hot' as const, id: v.hot }]), ...v.weapons, ...v.moves];
    if (this.cursorKey !== null && !this.current.some((i) => itemKey(i) === this.cursorKey)) this.cursorKey = null;
    if (this.cursorKey === null && this.current[0] !== undefined) this.cursorKey = itemKey(this.current[0]);
    setLabelText(this.places, format('ui.kit.places', { n: v.places.n, max: v.places.max }));
    setLabelColour(this.places, v.places.n >= v.places.max ? 'alarm' : 'slate');
    this.beerRows.forEach((r, i) => {
      const item = v.beers[i] ?? null;
      this.paintRow(r, kit, item, item === null ? '' : `×${item.count}`);
    });
    setLabelText(this.beersNone, v.beers.length === 0 ? wrapText(text('ui.kit.none'), 22).join('\n') : '');
    this.spiritRows.forEach((r, i) => {
      const item = v.spirits[i] ?? null;
      this.paintRow(r, kit, item, item === null ? '' : `×${item.count}`);
    });
    setLabelText(this.spiritsNone, v.spirits.length === 0 ? wrapText(text('ui.kit.spirits.none'), 22).join('\n') : '');
    const hot: KitItem | null = v.hot === null ? null : { kind: 'hot', id: v.hot };
    this.paintRow(this.hotRow, kit, hot);
    setLabelText(this.hotNone, hot === null ? wrapText(text('ui.kit.hotDrink.none'), 22).join('\n') : '');
    setLabelText(this.bottleLabel, `${text('ui.kit.bottles')} ×${v.bottles}`);
    this.weaponRows.forEach((r, i) => this.paintRow(r, kit, v.weapons[i] ?? null, v.weapons[i]?.id === kit.slots.melee ? keyText(KEY_IDS.weapon) : ''));
    setLabelText(this.movesNone, v.moves.length === 0 ? wrapText(text('ui.kit.none'), 21).join('\n') : '');
    this.moveRows.forEach((r, i) => {
      const m = v.moves[i] ?? null;
      this.paintRow(r, kit, m, m === null ? '' : keyText(KEY_IDS.slot(m.level as SpecialSlotIndex)));
    });
    // Slots: the one that takes the cursor's entry is lit.
    const cur = this.cursor();
    for (const box of this.slotBoxes) {
      const c = slotContent(kit, box.ref);
      const fits = cur !== null && JSON.stringify(slotFor(cur)) === JSON.stringify(box.ref);
      box.bg.setFillStyle(PALETTE[fits ? 'sand' : 'fog']);
      if (c === null) {
        setLabelText(box.content, text('ui.kit.slot.empty'));
        setLabelColour(box.content, 'steel');
        box.icon.setVisible(false);
      } else {
        setLabelText(box.content, nameOf(c).slice(0, 18));
        setLabelColour(box.content, 'ink');
        box.icon.set(iconOf(c.kind === 'hot' ? 'drink' : c.kind, c.id), c.kind === 'move' ? 'amberLight' : 'amber');
      }
    }
    // What Q will use, and the description of the cursor's entry.
    const pickedId = kit.selectedItem ?? null;
    setLabelText(this.picked, pickedId === null ? '' : `${text('ui.kit.selected')}: ${nameOf({ kind: 'drink', id: pickedId })}`.slice(0, 21));
    setLabelText(this.desc, cur === null ? '' : wrapText(descOf(cur), 21).slice(0, 5).join('\n'));
  }
}
