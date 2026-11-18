/**
 * Who is an alien (chapter 7): six figures in alien costumes, all examined. Pick three with the mouse and accuse them.
 * The right three solve the puzzle and the screen closes (the chapter plays the scene). Any other three is
 * embarrassing and costs nothing: the figure's retort shows for a moment and he can try again. Opened by the HUD scene
 * when `source.activeTells()` becomes non-null; Esc steps back.
 */

import Phaser from 'phaser';
import { PALETTE } from '../../art/palette';
import { hasText, sequence, text } from '../../content/dialogue';
import type { TellsView } from '../../systems/tells';
import { makeLabel, rect, setLabelColour } from '../gfx';
import type { Label } from '../gfx';
import { SheetPicks } from '../model/picks';
import { wrapText } from '../model/wrap';
import { UiSceneKeys } from '../shared';
import type { UiShared } from '../shared';

const CARD = { w: 140, h: 78, gapX: 10, gapY: 10, x: 20, y: 34, columns: 3 } as const;
const RESULT_MS = 3200;
/** Presentation only: characters a line of the retort may hold. */
const RETORT_WIDTH = 64;

interface Card {
  readonly id: string;
  readonly examined: boolean;
  readonly bg: Phaser.GameObjects.Rectangle;
  readonly num: Label;
}

export class TellsScene extends Phaser.Scene {
  private view: TellsView | null = null;
  private sel!: SheetPicks;
  private cards: Card[] = [];
  private confirmBg!: Phaser.GameObjects.Rectangle;
  private confirmLabel!: Label;
  private resultUntil = 0;
  private resultObjects: Phaser.GameObjects.GameObject[] = [];

  constructor(private readonly shared: UiShared) {
    super(UiSceneKeys.Tells);
  }

  create(): void {
    this.cards = [];
    this.resultUntil = 0;
    this.resultObjects = [];
    const view = this.shared.source.activeTells();
    this.view = view;
    rect(this, 0, 0, 480, 270, 'ink');
    if (view === null) {
      this.scene.stop();
      return;
    }
    // The game is held while the accuse screen is up, like the Tab screen.
    this.shared.overlays.show('tells');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shared.overlays.hide('tells'));
    this.sel = new SheetPicks(view.figures.filter((f) => f.examined).map((f) => f.id), view.pick);
    makeLabel(this, 240, 12, text(view.promptTextId), 'bone', { anchor: 'centre' });
    view.figures.forEach((fig, i) => {
      const x = CARD.x + (i % CARD.columns) * (CARD.w + CARD.gapX);
      const y = CARD.y + Math.floor(i / CARD.columns) * (CARD.h + CARD.gapY);
      const bg = rect(this, x, y, CARD.w, CARD.h, fig.examined ? 'bone' : 'coal');
      if (fig.examined) {
        bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          if (this.resultUntil === 0 && this.sel.toggle(fig.id)) this.shared.hooks.play?.('uiMove');
        });
      }
      const name = fig.labelTextId !== undefined && hasText(fig.labelTextId) ? wrapText(text(fig.labelTextId), 20).join('\n') : '';
      makeLabel(this, x + CARD.w / 2, y + CARD.h / 2 - 10, name, 'ink', { anchor: 'centre', depth: 5 });
      const num = makeLabel(this, x + 4, y + 4, '', 'amber', { depth: 6 });
      this.cards.push({ id: fig.id, examined: fig.examined, bg, num });
    });
    this.confirmBg = rect(this, 60, 236, 110, 20, 'coal');
    this.confirmBg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.confirm());
    this.confirmLabel = makeLabel(this, 115, 242, text('c7.tells.confirm'), 'steel', { anchor: 'centre' });
    const clear = rect(this, 185, 236, 110, 20, 'coal');
    clear.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (this.resultUntil !== 0) return;
      this.sel.clear();
      this.shared.hooks.play?.('uiMove');
    });
    makeLabel(this, 240, 242, text('ui.deduction.clear'), 'white', { anchor: 'centre' });
    const back = rect(this, 310, 236, 110, 20, 'coal');
    back.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.stepBack());
    makeLabel(this, 365, 242, text('ui.deduction.back'), 'white', { anchor: 'centre' });
    const kb = this.input.keyboard;
    if (kb !== null) {
      const onEsc = (): void => this.stepBack();
      kb.on('keydown-ESC', onEsc);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.off('keydown-ESC', onEsc));
    }
  }

  private stepBack(): void {
    if (this.view === null || this.resultUntil !== 0) return;
    this.shared.hooks.play?.('uiMove');
    this.shared.source.closeTells();
    this.scene.stop();
  }

  private confirm(): void {
    const view = this.view;
    if (view === null || !this.sel.complete || this.resultUntil !== 0) return;
    const tried = this.shared.source.submitTells(view.puzzleId, this.sel.picks());
    if (tried.refused) {
      this.shared.hooks.play?.('refuse');
      this.sel.clear();
      return;
    }
    if (tried.correct) {
      // The chapter plays what follows (the accusation is a scene of its own).
      this.shared.hooks.play?.('uiSelect');
      this.scene.stop();
      return;
    }
    this.shared.hooks.play?.('refuse');
    this.resultUntil = this.time.now + RESULT_MS;
    const panel = rect(this, 0, 150, 480, 76, 'ink', 20);
    const lines = this.retort(tried.textId);
    this.resultObjects = [panel, makeLabel(this, 240, 160, lines, 'fog', { anchor: 'centre', depth: 21 })];
  }

  /** The wrong-accusation lines, as written in the dialogue file (a box of one or two lines). */
  private retort(id: string): string {
    const seq = sequence(id);
    return seq.lines
      .map((l) => {
        const key = `speaker.${l.speaker}`;
        const who = l.speakerName !== undefined && hasText(l.speakerName) ? text(l.speakerName) : hasText(key) ? text(key) : '';
        return wrapText(who === '' ? l.text : `${who}: ${l.text}`, RETORT_WIDTH).join('\n');
      })
      .join('\n');
  }

  update(): void {
    if (this.view === null) return;
    if (this.resultUntil !== 0) {
      if (this.time.now < this.resultUntil) return;
      for (const o of this.resultObjects) o.destroy();
      this.resultObjects = [];
      this.resultUntil = 0;
      this.sel.clear();
    }
    for (const c of this.cards) {
      const order = this.sel.order(c.id);
      if (c.examined) c.bg.setFillStyle(PALETTE[order > 0 ? 'amberLight' : 'bone']);
      c.num.setText(order > 0 ? String(order) : '');
    }
    const ready = this.sel.complete;
    this.confirmBg.setFillStyle(PALETTE[ready ? 'amber' : 'coal']);
    setLabelColour(this.confirmLabel, ready ? 'ink' : 'steel');
  }
}

