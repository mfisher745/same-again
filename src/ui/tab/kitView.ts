/**
 * Kit part of the Tab screen: what Andrew carries (drinks against the carry
 * limit, the hot drink, bottles, weapons, moves), his six slots, and the two
 * things to do with an item: put it in its slot, or drink it straight away.
 * Mouse: click an item, then a slot (or a button). Keys: W/S choose, E or
 * Enter puts it in its slot, Q drinks it. DESIGN.md 7.7.
 */

import Phaser from 'phaser';
import { PALETTE } from '../../art/palette';
import type { ColourName } from '../../art/palette';
import { format, hasText, text } from '../../content/dialogue';
import type { Kit, SpecialSlotIndex, TextId } from '../../core/types';
import type { Label, Pic } from '../gfx';
import { iconFrames, setLabelColour, setLabelText } from '../gfx';
import { KEY_IDS, keyText } from '../keycaps';
import { KIT_SLOTS, SLOT_STATE_TEXT, assignItem, buildKitView, clearSlot, drinkIdOf, isDrink, itemKey, slotContent, slotFor } from '../model/kit';
import type { KitItem, KitSlotRef } from '../model/kit';
import { wrapText } from '../model/wrap';
import type { UiShared } from '../shared';
import { uiTuning } from '../uiTuning';
import { Layer } from './layer';

const ROW = 11;
const COL1 = { x: 12, width: 142, chars: 22 } as const;
const COL2 = { x: 160, width: 150 } as const;
const COL3 = { x: 320, width: 148 } as const;
const TOP = 28;
const DESC = { x: COL2.x, y: 192, chars: 25, lines: 7 } as const;
const SLOT_BOX = { height: 31, gap: 1 } as const;

interface Row {
  readonly bg: Phaser.GameObjects.Rectangle;
  readonly icon: Pic;
  readonly name: Label;
  readonly note: Label;
}

interface SlotBox {
  readonly ref: KitSlotRef;
  readonly bg: Phaser.GameObjects.Rectangle;
  readonly title: Label;
  readonly level: Label;
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

export class KitView {
  private readonly layer: Layer;
  private readonly drinkRows: Row[] = [];
  private readonly hotRow: Row;
  private readonly weaponRows: Row[] = [];
  private readonly moveRows: Row[] = [];
  private readonly slotBoxes: SlotBox[] = [];
  private readonly places: Label;
  private readonly hotNone: Label;
  private readonly bottleLabel: Label;
  private readonly drinksNone: Label;
  private readonly movesNone: Label;
  private readonly desc: Label;
  private readonly message: Label;
  private readonly assignBtn: { bg: Phaser.GameObjects.Rectangle; label: Label };
  private readonly drinkBtn: { bg: Phaser.GameObjects.Rectangle; label: Label };
  private selectedKey: string | null = null;
  private current: readonly KitItem[] = [];
  private messageUntil = 0;
  private now = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly shared: UiShared,
  ) {
    const L = (this.layer = new Layer(scene));
    L.rect(154, TOP, 1, 232, 'fog');
    L.rect(314, TOP, 1, 232, 'fog');
    L.label(COL1.x, TOP, text('ui.kit.drinks'), 'beanie');
    this.places = L.label(COL1.x + COL1.width, TOP, '', 'slate', { anchor: 'right' });
    for (let i = 0; i < 6; i++) this.drinkRows.push(this.makeRow(L, COL1.x, TOP + 12 + i * ROW, COL1.width));
    this.drinksNone = L.label(COL1.x, TOP + 12, text('ui.kit.none'), 'steel');
    this.hotRow = this.makeRow(L, COL1.x, TOP + 12 + 6 * ROW + 2, COL1.width);
    this.hotNone = L.label(COL1.x, TOP + 12 + 6 * ROW + 2, '', 'steel');
    L.icon(COL1.x + 1, TOP + 12 + 6 * ROW + 2 + 2 * ROW + 2).set(iconFrames.drink('bottle'), 'fog');
    this.bottleLabel = L.label(COL1.x + 16, TOP + 12 + 6 * ROW + 2 + 2 * ROW + 4, '', 'ink');
    const wy = TOP + 12 + 6 * ROW + 2 + 2 * ROW + 2 + 16;
    L.label(COL1.x, wy, text('ui.kit.weapons'), 'beanie');
    for (let i = 0; i < 7; i++) this.weaponRows.push(this.makeRow(L, COL1.x, wy + 12 + i * ROW, COL1.width));
    L.label(COL2.x, TOP, text('ui.kit.moves'), 'beanie');
    for (let i = 0; i < 13; i++) this.moveRows.push(this.makeRow(L, COL2.x, TOP + 12 + i * ROW, COL2.width));
    this.movesNone = L.label(COL2.x, TOP + 12, text('ui.kit.none'), 'steel');
    this.desc = L.label(DESC.x, DESC.y, '', 'ink');
    L.label(COL3.x, TOP, text('ui.kit.slots'), 'beanie');
    KIT_SLOTS.forEach((ref, i) => this.slotBoxes.push(this.makeSlot(L, ref, TOP + 12 + i * (SLOT_BOX.height + SLOT_BOX.gap))));
    const by = TOP + 12 + 6 * (SLOT_BOX.height + SLOT_BOX.gap) + 1;
    this.assignBtn = this.makeButton(L, COL3.x, by, 72, text('ui.kit.assign'), () => this.assignSelected());
    this.drinkBtn = this.makeButton(L, COL3.x + 76, by, 72, text('ui.kit.drinkNow'), () => this.drinkSelected());
    this.message = L.label(COL3.x, by + 17, '', 'alarm');
  }

  private makeRow(L: Layer, x: number, y: number, width: number): Row {
    const bg = L.rect(x - 2, y, width + 2, ROW, 'bone');
    bg.setInteractive({ useHandCursor: true });
    const icon = L.icon(x, y - 1);
    const name = L.label(x + 15, y + 1, '', 'ink');
    const note = L.label(x + width, y + 1, '', 'slate', { anchor: 'right' });
    return { bg, icon, name, note };
  }

  private makeSlot(L: Layer, ref: KitSlotRef, y: number): SlotBox {
    const bg = L.rect(COL3.x - 2, y, COL3.width + 2, SLOT_BOX.height, 'fog');
    bg.setInteractive({ useHandCursor: true }).on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) this.clear(ref);
      else this.assignTo(ref);
    });
    const title =
      ref.kind === 'drink'
        ? text('ui.kit.slot.drink')
        : ref.kind === 'melee'
          ? text('ui.kit.slot.melee')
          : format('ui.kit.slot.special', { n: ref.slot });
    const t = L.label(COL3.x + 2, y + 2, title, 'ink');
    const level = L.label(COL3.x + 2, y + 11, ref.kind === 'special' ? format('ui.kit.slot.level', { state: text(SLOT_STATE_TEXT[ref.slot]) }) : '', 'slate');
    const content = L.label(COL3.x + 2, y + (ref.kind === 'special' ? 20 : 11), '', 'ink');
    const icon = L.icon(COL3.x + COL3.width - 16, y + 8);
    if (ref.kind === 'special') L.label(COL3.x + COL3.width - 4, y + 2, keyText(KEY_IDS.slot(ref.slot)), 'slate', { anchor: 'right' });
    else if (ref.kind === 'drink') L.label(COL3.x + COL3.width - 4, y + 2, keyText(KEY_IDS.drink), 'slate', { anchor: 'right' });
    else L.label(COL3.x + COL3.width - 4, y + 2, keyText(KEY_IDS.weapon), 'slate', { anchor: 'right' });
    return { ref, bg, title: t, level, content, icon };
  }

  private makeButton(L: Layer, x: number, y: number, w: number, str: string, onClick: () => void): { bg: Phaser.GameObjects.Rectangle; label: Label } {
    const bg = L.rect(x, y, w, 14, 'slate');
    bg.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
    const label = L.label(x + w / 2, y + 3, str, 'white', { anchor: 'centre' });
    return { bg, label };
  }

  setVisible(visible: boolean): void {
    this.layer.setVisible(visible);
  }

  reset(): void {
    this.selectedKey = null;
    this.messageUntil = 0;
  }

  private selected(): KitItem | null {
    return this.current.find((i) => itemKey(i) === this.selectedKey) ?? null;
  }

  private select(item: KitItem): void {
    this.selectedKey = itemKey(item);
    this.shared.hooks.play?.('uiMove');
  }

  /** W/S: move the selection through the lists in the order they are drawn. */
  move(d: 1 | -1): void {
    if (this.current.length === 0) return;
    const i = this.current.findIndex((x) => itemKey(x) === this.selectedKey);
    const next = Phaser.Math.Clamp(i < 0 ? 0 : i + d, 0, this.current.length - 1);
    const item = this.current[next];
    if (item !== undefined) this.select(item);
  }

  assignSelected(): void {
    const item = this.selected();
    if (item !== null) this.assignTo(slotFor(item));
  }

  drinkSelected(): void {
    const item = this.selected();
    const id = item === null ? null : drinkIdOf(item);
    if (id === null) return;
    if (this.shared.source.drinkFromInventory(id)) this.shared.hooks.play?.('uiSelect');
    else this.shared.hooks.play?.('refuse');
  }

  private assignTo(ref: KitSlotRef): void {
    const item = this.selected();
    if (item === null) return;
    const r = assignItem(this.shared.source, item, ref);
    if (r.ok) {
      this.shared.hooks.play?.('uiSelect');
      return;
    }
    this.shared.hooks.play?.('refuse');
    if (r.refusal !== null) {
      setLabelText(this.message, wrapText(r.refusal.n === undefined ? text(r.refusal.textId) : format(r.refusal.textId, { n: r.refusal.n }), 24).join('\n'));
      this.messageUntil = this.now + uiTuning().refusalMs;
    }
  }

  private clear(ref: KitSlotRef): void {
    if (clearSlot(this.shared.source, ref)) this.shared.hooks.play?.('uiMove');
  }

  private paintRow(row: Row, item: KitItem | null, note = ''): void {
    row.bg.setVisible(item !== null);
    row.name.setVisible(item !== null);
    row.note.setVisible(item !== null);
    if (item === null) {
      row.icon.setVisible(false);
      return;
    }
    const sel = itemKey(item) === this.selectedKey;
    row.bg.setFillStyle(PALETTE[sel ? 'fog' : 'bone']);
    row.icon.set(iconOf(item.kind === 'hot' ? 'drink' : item.kind, item.id), item.kind === 'move' ? 'amberLight' : item.kind === 'weapon' ? 'steel' : 'amber');
    setLabelText(row.name, nameOf(item).slice(0, note === '' ? COL1.chars - 1 : COL1.chars - 4));
    setLabelText(row.note, note);
    row.bg.off('pointerdown');
    row.bg.on('pointerdown', () => this.select(item));
  }

  update(now: number): void {
    this.now = now;
    const { source } = this.shared;
    const kit: Kit = source.kit();
    const v = buildKitView(kit);
    this.current = v.items;
    if (this.selectedKey !== null && !v.items.some((i) => itemKey(i) === this.selectedKey)) this.selectedKey = null;
    if (this.selectedKey === null && v.items[0] !== undefined) this.selectedKey = itemKey(v.items[0]);
    setLabelText(this.places, format('ui.kit.places', { n: v.places.n, max: v.places.max }));
    setLabelColour(this.places, v.places.n >= v.places.max ? 'alarm' : 'slate');
    this.drinksNone.setVisible(v.drinks.length === 0);
    this.drinkRows.forEach((r, i) => {
      const item = v.drinks[i] ?? null;
      this.paintRow(r, item, item === null ? '' : `×${item.count}`);
    });
    const hot: KitItem | null = v.hot === null ? null : { kind: 'hot', id: v.hot };
    this.paintRow(this.hotRow, hot);
    setLabelText(this.hotNone, hot === null ? wrapText(text('ui.kit.hotDrink.none'), 24).join('\n') : '');
    this.hotNone.setVisible(hot === null);
    setLabelText(this.bottleLabel, `${text('ui.kit.bottles')} ×${v.bottles}`);
    this.weaponRows.forEach((r, i) => this.paintRow(r, v.weapons[i] ?? null, v.weapons[i]?.id === kit.slots.melee ? keyText(KEY_IDS.weapon) : ''));
    this.movesNone.setVisible(v.moves.length === 0);
    this.moveRows.forEach((r, i) => {
      const m = v.moves[i] ?? null;
      this.paintRow(r, m, m === null ? '' : keyText(KEY_IDS.slot(m.level as SpecialSlotIndex)));
    });
    // Slots.
    for (const box of this.slotBoxes) {
      const c = slotContent(kit, box.ref);
      const sel = this.selected();
      const fits = sel !== null && JSON.stringify(slotFor(sel)) === JSON.stringify(box.ref);
      box.bg.setFillStyle(PALETTE[fits ? 'sand' : 'fog']);
      if (c === null) {
        setLabelText(box.content, text('ui.kit.slot.empty'));
        setLabelColour(box.content, 'steel');
        box.icon.setVisible(false);
      } else {
        setLabelText(box.content, nameOf(c));
        setLabelColour(box.content, 'ink');
        box.icon.set(iconOf(c.kind, c.id), c.kind === 'move' ? 'amberLight' : 'amber');
      }
    }
    // Description of the selected item.
    const sel = this.selected();
    setLabelText(this.desc, sel === null ? '' : wrapText(descOf(sel), DESC.chars).slice(0, DESC.lines).join('\n'));
    // Buttons.
    this.setButton(this.assignBtn, sel !== null);
    this.setButton(this.drinkBtn, sel !== null && isDrink(sel));
    if (now >= this.messageUntil) setLabelText(this.message, '');
  }

  private setButton(b: { bg: Phaser.GameObjects.Rectangle; label: Label }, enabled: boolean): void {
    b.bg.setFillStyle(PALETTE[enabled ? 'slate' : 'coal']);
    setLabelColour(b.label, (enabled ? 'white' : 'steel') as ColourName);
  }
}
