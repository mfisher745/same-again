/**
 * The bottom strip: drink, bottles, weapon, the Buzz meter, the four special
 * slots and Myko's calls. Drawn from a `HudModel` each frame. docs/style-guide.md
 * section 4. No health: the meter is the whole of Andrew's condition.
 */

import Phaser from 'phaser';
import { PALETTE } from '../../art/palette';
import type { ColourName } from '../../art/palette';
import { text } from '../../content/dialogue';
import type { SpecialSlotIndex } from '../../core/types';
import type { EffectId } from '../../audio';
import { Pic, iconFrames, makeIcon, makeLabel, rect, setLabelColour, setLabelText } from '../gfx';
import type { Label } from '../gfx';
import { HUD_STRIP, METER, SLOT_FLASH_MS, STRIP } from '../layout';
import { KEY_IDS, keyText } from '../keycaps';
import { perimeterSegments } from '../model/hud';
import type { HudModel } from '../model/hud';
import { TUNING } from '../../content/tuning';
import { Cap, capWidth } from './cap';

const BUZZ_COLOUR: Record<HudModel['buzz']['state'], ColourName> = {
  sober: 'fog',
  buzzed: 'sand',
  grand: 'grass',
  bitMuch: 'amber',
  fecked: 'alarm',
};

type CellId = 'drink' | 'bottles' | 'weapon' | 'slot1' | 'slot2' | 'slot3' | 'slot4';

interface SlotWidgets {
  readonly icon: Pic;
  readonly cap: Cap;
  readonly sweep: Phaser.GameObjects.Rectangle;
}

export class HudStrip {
  private readonly cells = new Map<CellId, Phaser.GameObjects.Rectangle>();
  private readonly sig = new Map<CellId, string>();
  private readonly flashUntil = new Map<CellId, number>();
  private readonly drinkIcon: Pic;
  private readonly drinkCount: Label;
  private readonly drinkCap: Cap;
  private readonly bottleIcon: Pic;
  private readonly bottleCount: Label;
  private readonly bottleMouse: Pic;
  private readonly weaponIcon: Pic;
  private readonly weaponCap: Cap;
  private readonly slots: SlotWidgets[] = [];
  private readonly state: Label;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly back: Phaser.GameObjects.Rectangle;
  private readonly frame: Phaser.GameObjects.Rectangle;
  private readonly marks: Phaser.GameObjects.Rectangle[] = [];
  private readonly sun: Pic;
  private readonly meterY: number;
  private readonly leaves: Pic[] = [];
  private readonly callCap: Cap;
  private readonly ring: Phaser.GameObjects.Graphics;
  /** Per slot: the move and readiness last frame, to hear a slot coming back. */
  private readonly lastReady = new Map<SpecialSlotIndex, { moveId: string | null; ready: boolean }>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
    private readonly play: (effect: EffectId) => void,
  ) {
    const D = depth;
    const y = STRIP.cellY;
    const L = D + 1;
    rect(scene, 0, HUD_STRIP.y, 480, HUD_STRIP.height, 'ink', D - 1);
    rect(scene, 0, HUD_STRIP.y, 480, 1, 'slate', D);
    // Drink: icon, count, Q.
    this.cell('drink', STRIP.drink.x, STRIP.drink.width);
    this.drinkIcon = makeIcon(scene, STRIP.drink.x + 2, y + 5, L);
    this.drinkCount = makeLabel(scene, STRIP.drink.x + 16, y + 2, '', 'white', { depth: L });
    this.drinkCap = new Cap(scene, L);
    // Bottles: bottle, count, right mouse button.
    this.cell('bottles', STRIP.bottles.x, STRIP.bottles.width);
    this.bottleIcon = makeIcon(scene, STRIP.bottles.x + 2, y + 5, L).set(iconFrames.drink('bottle'), 'fog');
    this.bottleCount = makeLabel(scene, STRIP.bottles.x + 16, y + 1, '', 'white', { depth: L });
    this.bottleMouse = makeIcon(scene, STRIP.bottles.x + 16, y + 10, L).set(iconFrames.mouseRight, 'fog');
    // Weapon: icon and R.
    this.cell('weapon', STRIP.weapon.x, STRIP.weapon.width);
    this.weaponIcon = makeIcon(scene, STRIP.weapon.x + 2, y + 5, L);
    this.weaponCap = new Cap(scene, L);
    // Four specials.
    for (let i = 0; i < 4; i++) {
      const x = this.slotX(i);
      this.cell(`slot${i + 1}` as CellId, x, STRIP.special.width);
      this.slots.push({
        icon: makeIcon(scene, x + 6, y + 2, L),
        cap: new Cap(scene, L),
        sweep: rect(scene, x + 6, y + 2, 12, 0, 'ink', L + 2).setAlpha(0.75),
      });
    }
    // Buzz: state word at double size over the meter, level marks on it.
    const cx = (STRIP.buzz.left + STRIP.buzz.right) / 2;
    const my = HUD_STRIP.y + HUD_STRIP.height - METER.height - 2;
    this.meterY = my;
    this.state = makeLabel(scene, cx, y - 1, '', 'white', { anchor: 'centre', depth: L });
    this.state.setScale(2);
    this.frame = rect(scene, cx - METER.maxWidth / 2 - 1, my - 1, METER.maxWidth + 2, METER.height + 2, 'slate', D);
    this.back = rect(scene, cx - METER.maxWidth / 2, my, METER.maxWidth, METER.height, 'coal', D + 1);
    this.fill = rect(scene, cx - METER.maxWidth / 2, my, 0, METER.height, 'fog', D + 2);
    for (let i = 0; i < 3; i++) this.marks.push(rect(scene, 0, my, 1, METER.height, 'white', D + 3));
    this.sun = makeIcon(scene, 0, my - 4, L);
    // Myko's calls (leaves) and the M key.
    for (let i = 0; i < TUNING.myko.callsPerGame; i++) this.leaves.push(makeIcon(scene, STRIP.calls.x + i * STRIP.calls.leafGap, y + 3, L));
    this.callCap = new Cap(scene, L);
    this.ring = scene.add.graphics().setDepth(D + 4);
  }

  private slotX(i: number): number {
    return STRIP.special.x + i * (STRIP.special.width + STRIP.special.gap);
  }

  private cell(id: CellId, x: number, width: number): void {
    this.cells.set(id, rect(this.scene, x, STRIP.cellY, width, STRIP.cellHeight, 'coal', this.depth));
  }

  /** Highlights a cell for a moment whenever what it shows changes (not on the first frame). */
  private watch(id: CellId, signature: string, now: number): void {
    const before = this.sig.get(id);
    this.sig.set(id, signature);
    if (before !== undefined && before !== signature) this.flashUntil.set(id, now + SLOT_FLASH_MS);
  }

  private paint(id: CellId, now: number, dark = false): void {
    const c = this.cells.get(id);
    if (c === undefined) return;
    const on = now < (this.flashUntil.get(id) ?? 0) && Math.floor(now / 130) % 2 === 0;
    c.setFillStyle(PALETTE[on ? 'steel' : dark ? 'ink' : 'coal']);
    if (on) c.setStrokeStyle(1, PALETTE.white);
    else c.setStrokeStyle();
  }

  update(m: HudModel, now: number): void {
    const y = STRIP.cellY;
    // Drink.
    const d = m.drink;
    this.watch('drink', `${d.drinkId ?? '-'}:${d.count}`, now);
    this.paint('drink', now);
    if (d.drinkId === null) {
      this.drinkIcon.setVisible(false);
      setLabelText(this.drinkCount, '');
    } else {
      this.drinkIcon.set(iconFrames.drink(d.drinkId), 'amber');
      setLabelText(this.drinkCount, `×${d.count}`);
    }
    this.drinkCap.show(keyText(KEY_IDS.drink), STRIP.drink.x + 16, y + 12, d.drinkId === null ? 'slate' : 'amberLight', d.drinkId === null ? 'fog' : 'ink');
    // Bottles.
    this.watch('bottles', String(m.bottles), now);
    this.paint('bottles', now);
    this.bottleIcon.setDim(m.bottles === 0);
    this.bottleMouse.setDim(m.bottles === 0);
    setLabelText(this.bottleCount, `×${m.bottles}`);
    setLabelColour(this.bottleCount, m.bottles === 0 ? 'steel' : 'white');
    // Weapon.
    this.watch('weapon', m.weapon, now);
    this.paint('weapon', now);
    this.weaponIcon.set(iconFrames.weapon(m.weapon), 'steel');
    this.weaponCap.show(keyText(KEY_IDS.weapon), STRIP.weapon.x + 16, y + 12, 'steel');
    // Specials: icon, key, a wipe while recharging, dark when the level is too low.
    m.specials.forEach((s, i) => {
      const w = this.slots[i];
      if (w === undefined) return;
      const id = `slot${s.slot}` as CellId;
      this.watch(id, `${s.moveId ?? '-'}:${s.lit}`, now);
      this.paint(id, now, s.moveId !== null && !s.lit);
      const x = this.slotX(i);
      if (s.moveId === null) w.icon.setVisible(false);
      else w.icon.set(iconFrames.move(s.moveId), 'amberLight').setDim(!s.lit);
      const key = keyText(KEY_IDS.slot(s.slot));
      w.cap.show(key, x + Math.floor((STRIP.special.width - capWidth(key)) / 2), y + 12, s.ready ? 'bone' : 'slate', s.ready ? 'ink' : 'fog');
      const h = s.moveId !== null && s.lit ? Math.round(12 * s.cooldownFraction) : 0;
      w.sweep.setPosition(x + 6, y + 2).setSize(12, h).setVisible(h > 0);
      const last = this.lastReady.get(s.slot);
      if (last !== undefined && last.moveId === s.moveId && !last.ready && s.ready) {
        this.flashUntil.set(id, now + SLOT_FLASH_MS);
        this.play('slotReady');
      }
      this.lastReady.set(s.slot, { moveId: s.moveId, ready: s.ready });
    });
    // Buzz.
    const b = m.buzz;
    const cx = (STRIP.buzz.left + STRIP.buzz.right) / 2;
    const mx = Math.round(cx - b.widthPx / 2);
    const parts = [this.frame, this.back, this.fill, this.state, ...this.marks];
    for (const part of parts) part.setVisible(!b.hidden);
    if (b.hidden) this.sun.setVisible(false);
    const flash = b.flashing && Math.floor(now / 160) % 2 === 0;
    this.frame.setPosition(mx - 1, this.frame.y).setSize(b.widthPx + 2, METER.height + 2);
    this.back.setPosition(mx, this.back.y).setSize(b.widthPx, METER.height);
    this.fill.setPosition(mx, this.fill.y).setSize(Math.round(b.widthPx * b.fraction), METER.height);
    this.fill.setFillStyle(PALETTE[flash ? 'white' : BUZZ_COLOUR[b.state]]);
    b.marks.forEach((f, i) => this.marks[i]?.setX(mx + Math.round(b.widthPx * f)));
    setLabelText(this.state, text(b.stateTextId));
    setLabelColour(this.state, flash ? 'white' : BUZZ_COLOUR[b.state]);
    if (b.inSun && !b.hidden) this.sun.setPosition(mx - 14, this.meterY - 4).set(iconFrames.sun, 'amberLight');
    else this.sun.setVisible(false);
    // Myko's calls.
    this.leaves.forEach((pic, i) => {
      const available = m.calls[i] === true;
      pic.set(available ? iconFrames.leaf : iconFrames.leafSpent, available ? 'bone' : 'coal');
    });
    this.callCap.show(keyText(KEY_IDS.call), STRIP.calls.x, y + 13, 'slate', 'fog');
    this.ring.clear();
    if (m.callHold > 0) {
      this.ring.lineStyle(2, PALETTE.amberLight, 1);
      for (const [x1, y1, x2, y2] of perimeterSegments(m.callHold, 42, 20)) {
        this.ring.lineBetween(STRIP.calls.x - 3 + x1, y + 1 + y1, STRIP.calls.x - 3 + x2, y + 1 + y2);
      }
    }
  }
}
