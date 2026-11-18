/**
 * The card sequence (chapter 10): the world's reaction, the title card and the credits. Draws `source.activeCard()`:
 * a caption under a small picture, a scene card (the picture while its dialogue plays in the HUD's box), the title, the
 * credits. Any key or a click skips a timed or waiting card (`advanceCard`); a scene card ends by itself. Nothing here
 * says what Andrew did or how many calls he used: the cards are the same for everyone. Opened by the HUD scene while a
 * card is on view, and stops itself when there is none.
 */

import Phaser from 'phaser';
import { PROPS_KEY } from '../../art/keys';
import { PROP } from '../../art/props';
import { text } from '../../content/dialogue';
import type { EpilogueCard } from '../../systems/epilogue';
import { makeLabel, rect } from '../gfx';
import type { Label } from '../gfx';
import { wrapText } from '../model/wrap';
import { UiSceneKeys } from '../shared';
import type { UiShared } from '../shared';

/** Which reaction picture goes with which card id (the art has five pictures for eight cards). */
const PICTURE: Readonly<Record<string, keyof typeof PROP.reactionCard>> = {
  governments: 'governments',
  statement: 'governments',
  news: 'news',
  views: 'video',
  comment: 'video',
  colleen: 'colleenAnn',
  lake: 'lake',
};

const PICTURE_SCALE = 3;
const CAPTION_CHARS = 48;
const CREDITS_LINE = 20;
/** Presentation only: a card cannot be skipped in its first half second. */
const SKIP_AFTER_MS = 500;

export class CardScene extends Phaser.Scene {
  private shownId: string | null = null;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private startedAt = Number.POSITIVE_INFINITY;
  private credits: Phaser.GameObjects.GameObject[] = [];
  private creditsHeight = 0;
  private durationMs = 0;
  private cardKind: EpilogueCard['kind'] | null = null;

  constructor(private readonly shared: UiShared) {
    super(UiSceneKeys.Cards);
  }

  create(): void {
    this.shownId = null;
    this.objects = [];
    this.credits = [];
    // A key that was already down (the press that finished the last line) must not skip the card that has just come up.
    const skip = (): void => {
      if (this.time.now - this.startedAt >= SKIP_AFTER_MS) this.shared.source.advanceCard();
    };
    const kb = this.input.keyboard;
    if (kb !== null) {
      const onKey = (e: KeyboardEvent): void => {
        if (!e.repeat) skip();
      };
      kb.on('keydown', onKey);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.off('keydown', onKey));
    }
    this.input.on('pointerdown', skip);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.off('pointerdown', skip));
  }

  private clear(): void {
    for (const o of this.objects) o.destroy();
    this.objects = [];
    this.credits = [];
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objects.push(o);
    return o;
  }

  private draw(card: EpilogueCard): void {
    this.clear();
    this.startedAt = this.time.now;
    this.durationMs = card.durationMs;
    this.cardKind = card.kind;
    this.keep(rect(this, 0, 0, 480, 270, 'ink'));
    // Title and credits cover the HUD; the reaction sits below it so the dialogue box of a scene card shows.
    if (card.kind === 'title' || card.kind === 'credits') this.scene.bringToTop();
    else this.scene.moveBelow(UiSceneKeys.Hud);
    const key = PICTURE[card.id];
    let y = 40;
    if (key !== undefined) {
      const w = 64 * PICTURE_SCALE;
      const h = 40 * PICTURE_SCALE;
      const frame = PROP.reactionCard[key];
      if (this.textures.exists(PROPS_KEY) && this.textures.get(PROPS_KEY).has(frame)) {
        this.keep(this.add.image(240 - w / 2, 20, PROPS_KEY, frame).setOrigin(0, 0).setScale(PICTURE_SCALE));
      } else this.keep(rect(this, 240 - w / 2, 20, w, h, 'slate'));
      y = 20 + h + 12;
    }
    if (card.kind === 'caption' && card.textId !== undefined) {
      const lines = wrapText(text(card.textId), CAPTION_CHARS).join('\n');
      this.keep(makeLabel(this, 240, key === undefined ? 120 : y, lines, 'bone', { anchor: 'centre' }));
    } else if (card.kind === 'title' && card.textId !== undefined) {
      const label = makeLabel(this, 240, 110, text(card.textId), 'white', { anchor: 'centre' });
      label.setScale(3);
      this.keep(label);
    } else if (card.kind === 'credits') {
      const lines = card.lines ?? [];
      lines.forEach((id, i) => {
        const l = makeLabel(this, 240, 270 + i * CREDITS_LINE, wrapText(text(id), 60).join('\n'), i === lines.length - 1 ? 'amberLight' : 'bone', { anchor: 'centre' });
        this.credits.push(l);
        this.keep(l);
      });
      this.creditsHeight = lines.length * CREDITS_LINE;
    }
  }

  update(): void {
    const view = this.shared.source.activeCard();
    if (view === null) {
      this.scene.stop();
      return;
    }
    if (this.shownId !== `${view.index}:${view.card.id}`) {
      this.shownId = `${view.index}:${view.card.id}`;
      this.draw(view.card);
    }
    // The credits roll up the screen over their time (a held title or a scene card needs no motion).
    if (this.cardKind === 'credits' && this.durationMs > 0) {
      const t = Math.min(1, (this.time.now - this.startedAt) / this.durationMs);
      const rise = t * (270 + this.creditsHeight - 120);
      this.credits.forEach((o, i) => {
        (o as Label).setY(270 + i * CREDITS_LINE - rise);
      });
    }
  }
}
