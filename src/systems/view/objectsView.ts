/**
 * World objects drawn as themselves (DESIGN.md 8: "Things Andrew can pick up
 * or examine are drawn as themselves with a small glint, never as abstract
 * markers"): pickups as their icon with the `fx.pickupGlint` twinkle, the
 * `icon.interact` icon over an examinable only while Andrew is in range,
 * push-puzzle pieces as their prop frame with a faint mark on target cells,
 * and Myko's smoke puff. Reads the run; never changes it.
 */

import Phaser from 'phaser';
import { animKey, fx, icon, PALETTE, PROPS_KEY, PROP, TEX } from '../../art';
import { TUNING } from '../../content/tuning';
import { GameEvents } from '../../core/types';
import type { PickupItem, Vec2 } from '../../core/types';
import { facingFromAngle } from '../geometry';
import { TILE } from '../grid';
import type { ChapterRun } from '../run';

/** Presentation timings (not balance). */
const GLINT_FPS = 2;
/** Myko's smoke: six frames churning at this rate, fading in when he stops and out when he moves. */
const PUFF_FPS = 4;
const PUFF_FADE_MS = 600;
const PUFF_FADE_IN_MS = 500;
/** It drifts up and back by this many pixels, once every `PUFF_DRIFT_MS`. */
const PUFF_DRIFT_PX = 1.5;
const PUFF_DRIFT_MS = 3200;
const PICKUP_BOB_PX = 1;
const FLOOR_DEPTH = -900;
/** A sheep's position is the centre of its 16px sprite; its feet are half that lower (depth sorts by feet). */
const SHEEP_FEET_OFFSET = 8;
/** Above characters, below the night tint. */
const ICON_DEPTH = 8000;
const GLINT_ANIM = 'fx.pickupGlint.loop';
const PUFF_ANIM = 'fx.smokePuff.loop';

interface PickupSprites {
  readonly icon: Phaser.GameObjects.Image;
  readonly glint: Phaser.GameObjects.Sprite;
}

export function pickupIconFrame(item: PickupItem): string {
  switch (item.kind) {
    case 'drink':
      return icon.drink(item.drinkId);
    case 'food':
      return icon.food(item.foodId);
    case 'empties':
      return icon.empty;
  }
}

export class ObjectsView {
  private readonly pickups = new Map<string, PickupSprites>();
  private readonly pieces = new Map<string, Phaser.GameObjects.Image>();
  private readonly fixed: Phaser.GameObjects.Image[] = [];
  private readonly floor: Phaser.GameObjects.Graphics;
  /** The sheep puzzle's flock, by `${sectionId}:${sheepId}`. */
  private readonly sheepSprites = new Map<string, Phaser.GameObjects.Sprite>();
  /** The sheep puzzle's gates: the images drawn for a gate's current position, by `${sectionId}:${gateId}`. */
  private readonly gateImages = new Map<string, { pos: 0 | 1; images: Phaser.GameObjects.Image[] }>();
  /** The slide puzzle's pieces, by `${sectionId}:${railId}`. */
  private readonly slideImages = new Map<string, Phaser.GameObjects.Image>();
  /** Sweep hazards: the shadow and the moving thing, by sweep index on this screen. */
  private readonly sweepImages = new Map<number, { shadow: Phaser.GameObjects.Image; body: Phaser.GameObjects.Image }>();
  private examineIcon: Phaser.GameObjects.Image | null = null;
  private puff: Phaser.GameObjects.Sprite | null = null;
  private puffFadeMs = 0;
  private puffInMs = 0;
  private puffClock = 0;
  private screenId = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly run: ChapterRun,
  ) {
    this.floor = scene.add.graphics().setDepth(FLOOR_DEPTH);
    this.ensureAnims();
    this.offGlint = run.bus.on(GameEvents.ObjectiveGlint, (g) => this.sparkle(g.position, g.faint === true));
  }

  private readonly offGlint: () => void;

  /** One soft sparkle on an unfinished objective: a pickup-glint frame that fades out. Subtle by design. */
  private sparkle(at: Vec2, faint: boolean): void {
    if (!this.scene.textures.exists(TEX.fx)) return;
    const ms = TUNING.overhaul?.glint?.durationMs ?? 450;
    const spark = this.scene.add.sprite(at.x, at.y, TEX.fx, fx.pickupGlint[0]).setDepth(ICON_DEPTH).setAlpha(faint ? 0.9 : 0.6);
    this.scene.tweens.add({ targets: spark, alpha: 0, scale: faint ? 1.4 : 1.1, duration: ms, onComplete: () => spark.destroy() });
  }

  /** `mykoHead` is the top of Myko's sprite, for the puff. */
  sync(dtMs: number, mykoHead: Vec2): void {
    if (this.run.screenId !== this.screenId) this.rebuild();
    this.syncPickups();
    this.syncPuzzles();
    this.syncSheep();
    this.syncSlides();
    this.syncSweeps();
    this.syncExamine();
    this.syncPuff(dtMs, mykoHead);
  }

  destroy(): void {
    this.offGlint();
    this.clear();
    this.floor.destroy();
    this.examineIcon?.destroy();
    this.puff?.destroy();
  }

  // -------------------------------------------------------------------------

  private ensureAnims(): void {
    const anims = this.scene.anims;
    if (!this.scene.textures.exists(TEX.fx)) return;
    if (!anims.exists(GLINT_ANIM)) anims.create({ key: GLINT_ANIM, frames: fx.pickupGlint.map((frame) => ({ key: TEX.fx, frame })), frameRate: GLINT_FPS, repeat: -1 });
    if (!anims.exists(PUFF_ANIM)) anims.create({ key: PUFF_ANIM, frames: fx.smokePuff.map((frame) => ({ key: TEX.fx, frame })), frameRate: PUFF_FPS, repeat: -1 });
  }

  private clear(): void {
    for (const p of this.pickups.values()) {
      p.icon.destroy();
      p.glint.destroy();
    }
    this.pickups.clear();
    for (const p of this.pieces.values()) p.destroy();
    this.pieces.clear();
    for (const f of this.fixed) f.destroy();
    this.fixed.length = 0;
    for (const s of this.sheepSprites.values()) s.destroy();
    this.sheepSprites.clear();
    for (const g of this.gateImages.values()) for (const i of g.images) i.destroy();
    this.gateImages.clear();
    for (const i of this.slideImages.values()) i.destroy();
    this.slideImages.clear();
    this.destroySweeps();
    this.floor.clear();
  }

  private rebuild(): void {
    this.clear();
    this.screenId = this.run.screenId;
    const props = this.scene.textures.exists(PROPS_KEY);
    for (const { placement } of this.run.pushPuzzlesHere()) {
      // A faint floor mark on the cells the pieces must clear or fill, or on where Andrew must get to.
      const goal = placement.layout.goal;
      for (const c of goal.kind === 'reach' ? [goal.to] : goal.cells) this.floor.fillStyle(PALETTE.ink, 0.18).fillRect(c.col * TILE + 2, c.row * TILE + 2, TILE - 4, TILE - 4);
      if (!props) continue;
      for (const f of placement.layout.fixed) {
        this.fixed.push(this.scene.add.image(f.col * TILE, f.row * TILE, PROPS_KEY, PROP.crate).setOrigin(0, 0).setDepth(f.row * TILE + TILE));
      }
    }
  }

  private syncPickups(): void {
    const seen = new Set<string>();
    const t = this.scene.time.now;
    for (const p of this.run.pickups()) {
      const id = p.def.id;
      seen.add(id);
      let s = this.pickups.get(id);
      const frame = pickupIconFrame(p.item);
      if (!s) {
        const iconImg = this.scene.add.image(0, 0, TEX.icons, frame).setOrigin(0.5, 1);
        const glint = this.scene.add.sprite(0, 0, TEX.fx, fx.pickupGlint[0]).setOrigin(0.5, 0.5);
        if (this.scene.anims.exists(GLINT_ANIM)) glint.play({ key: GLINT_ANIM, startFrame: id.length % fx.pickupGlint.length });
        s = { icon: iconImg, glint };
        this.pickups.set(id, s);
      }
      if (s.icon.frame.name !== frame && this.scene.textures.get(TEX.icons).has(frame)) s.icon.setFrame(frame);
      const bob = Math.round(Math.sin(t / 400 + id.length) * PICKUP_BOB_PX);
      const x = Math.round(p.def.position.x);
      const y = Math.round(p.def.position.y + 4);
      s.icon.setPosition(x, y + bob).setDepth(p.def.position.y);
      s.glint.setPosition(x + 3, y - 9 + bob).setDepth(p.def.position.y + 0.5);
    }
    for (const [id, s] of this.pickups) {
      if (seen.has(id)) continue;
      s.icon.destroy();
      s.glint.destroy();
      this.pickups.delete(id);
    }
  }

  /** Sheep as their sprite, depth-sorted by their feet; each gate as one image per tile it blocks in its current position. */
  private syncSheep(): void {
    const sheepArt = this.scene.textures.exists(TEX.sheep);
    const props = this.scene.textures.exists(PROPS_KEY);
    for (const { puzzle, placement } of this.run.sheepPuzzlesHere()) {
      if (props) {
        for (const gate of placement.layout.gates) {
          const key = `${placement.sectionId}:${gate.id}`;
          const pos = puzzle.gatePosition(gate.id) ?? 0;
          const have = this.gateImages.get(key);
          if (have && have.pos === pos) continue;
          for (const img of have?.images ?? []) img.destroy();
          const tiles = gate.positions[pos];
          // A gate whose tiles share a column hangs along it; otherwise it lies across.
          const along = tiles.length > 0 && tiles.every((t) => t.col === (tiles[0] as { col: number }).col);
          const frame = along ? PROP.fieldGate.along : PROP.fieldGate.across;
          const images = tiles.map((t) => this.scene.add.image(t.col * TILE, t.row * TILE, PROPS_KEY, frame).setOrigin(0, 0).setDepth(t.row * TILE + TILE));
          this.gateImages.set(key, { pos, images });
        }
      }
      if (!sheepArt) continue;
      for (const s of puzzle.sheep()) {
        const key = `${placement.sectionId}:${s.id}`;
        let sprite = this.sheepSprites.get(key);
        if (!sprite) {
          sprite = this.scene.add.sprite(0, 0, TEX.sheep).setOrigin(0.5, 0.5);
          this.sheepSprites.set(key, sprite);
        }
        sprite.setPosition(Math.round(s.pos.x), Math.round(s.pos.y)).setDepth(s.pos.y + SHEEP_FEET_OFFSET);
        const anim = animKey(TEX.sheep, s.moving ? 'walk' : 'idle', facingFromAngle(s.facingDeg));
        if (this.scene.anims.exists(anim) && sprite.anims.currentAnim?.key !== anim) sprite.play(anim);
      }
    }
  }

  /** Slide-puzzle pieces as their prop frame at the interpolated position, depth-sorted by their bottom edge. */
  private syncSlides(): void {
    if (!this.scene.textures.exists(PROPS_KEY)) return;
    const frames = this.scene.textures.get(PROPS_KEY);
    for (const { puzzle, placement } of this.run.slidePuzzlesHere()) {
      for (const piece of puzzle.pieceDraw()) {
        const key = `${placement.sectionId}:${piece.railId}`;
        let img = this.slideImages.get(key);
        if (!img) {
          if (!frames.has(piece.frame)) continue;
          img = this.scene.add.image(0, 0, PROPS_KEY, piece.frame).setOrigin(0, 0);
          this.slideImages.set(key, img);
        }
        img.setPosition(Math.round(piece.pos.x), Math.round(piece.pos.y)).setDepth(piece.pos.y + piece.height);
      }
    }
  }

  /**
   * Sweep hazards (`ChapterContext.sweepHazard`): the shadow frame stretched along the whole path while it telegraphs
   * and as it travels, and the moving frame centred on its position, drawn above everything on the ground.
   */
  private syncSweeps(): void {
    const sweeps = this.run.sweepsHere();
    if (sweeps.length === 0 && this.sweepImages.size === 0) return;
    if (!this.scene.textures.exists(PROPS_KEY)) return;
    const frames = this.scene.textures.get(PROPS_KEY);
    for (const [i, img] of [...this.sweepImages]) {
      if (i < sweeps.length) continue;
      img.shadow.destroy();
      img.body.destroy();
      this.sweepImages.delete(i);
    }
    sweeps.forEach((sw, i) => {
      const o = sw.opts;
      let imgs = this.sweepImages.get(i);
      if (!imgs) {
        if (!frames.has(o.frame) || !frames.has(o.shadowFrame)) return;
        imgs = {
          shadow: this.scene.add.image(0, 0, PROPS_KEY, o.shadowFrame).setOrigin(0.5, 0.5).setAlpha(0.55).setDepth(FLOOR_DEPTH + 1),
          body: this.scene.add.image(0, 0, PROPS_KEY, o.frame).setOrigin(0.5, 0.5),
        };
        this.sweepImages.set(i, imgs);
      }
      const dx = o.to.x - o.from.x;
      const dy = o.to.y - o.from.y;
      if (frames.has(o.frame)) imgs.body.setFrame(o.frame);
      if (frames.has(o.shadowFrame)) imgs.shadow.setFrame(o.shadowFrame);
      imgs.shadow
        .setPosition(Math.round((o.from.x + o.to.x) / 2), Math.round((o.from.y + o.to.y) / 2))
        .setDisplaySize(Math.hypot(dx, dy) + o.width, o.width)
        .setRotation(Math.atan2(dy, dx));
      imgs.body.setPosition(Math.round(sw.pos.x), Math.round(sw.pos.y)).setDepth(ICON_DEPTH - 1).setVisible(sw.moving);
    });
  }

  private destroySweeps(): void {
    for (const img of this.sweepImages.values()) {
      img.shadow.destroy();
      img.body.destroy();
    }
    this.sweepImages.clear();
  }

  private syncPuzzles(): void {
    if (!this.scene.textures.exists(PROPS_KEY)) return;
    for (const { puzzle, placement } of this.run.pushPuzzlesHere()) {
      const frame = this.scene.textures.get(PROPS_KEY).has(placement.pieceKind) ? placement.pieceKind : PROP.keg;
      for (const piece of puzzle.pieceDrawPositions()) {
        const key = `${placement.sectionId}:${piece.id}`;
        let img = this.pieces.get(key);
        if (!img) {
          img = this.scene.add.image(0, 0, PROPS_KEY, frame).setOrigin(0.5, 0.5);
          this.pieces.set(key, img);
        }
        img.setPosition(Math.round(piece.pos.x), Math.round(piece.pos.y)).setDepth(piece.pos.y + TILE / 2);
      }
    }
  }

  /** The interact icon floats over a plain examinable while Andrew is in range (NPCs show the talk label instead). */
  private syncExamine(): void {
    const target = this.run.interactTarget();
    if (!target || target.kind !== 'examine' || !this.scene.textures.exists(TEX.icons)) {
      this.examineIcon?.setVisible(false);
      return;
    }
    if (!this.examineIcon) this.examineIcon = this.scene.add.image(0, 0, TEX.icons, icon.interact).setOrigin(0.5, 1).setDepth(ICON_DEPTH);
    this.examineIcon.setPosition(Math.round(target.position.x), Math.round(target.position.y - 10)).setVisible(true);
  }

  /** A puff that hangs round Myko's head while he smokes and fades once he moves. */
  private syncPuff(dtMs: number, head: Vec2): void {
    const smoking = this.run.myko.smoking;
    this.puffClock += dtMs;
    if (smoking) {
      if (!this.puff) {
        this.puff = this.scene.add.sprite(0, 0, TEX.fx, fx.smokePuff[0]).setOrigin(0.5, 0.5);
        if (this.scene.anims.exists(PUFF_ANIM)) this.puff.play(PUFF_ANIM);
        this.puffInMs = 0;
      }
      this.puffFadeMs = PUFF_FADE_MS;
      this.puffInMs = Math.min(PUFF_FADE_IN_MS, this.puffInMs + dtMs);
      this.puff.setAlpha(0.85 * (this.puffInMs / PUFF_FADE_IN_MS)).setVisible(true);
    } else if (this.puff) {
      this.puffFadeMs = Math.max(0, this.puffFadeMs - dtMs);
      this.puff.setAlpha(0.85 * (this.puffFadeMs / PUFF_FADE_MS));
      if (this.puffFadeMs === 0) {
        this.puff.destroy();
        this.puff = null;
      }
    }
    // Hanging round his head, drifting up and back a little; it rises a few pixels more as it fades.
    const drift = Math.sin((this.puffClock / PUFF_DRIFT_MS) * Math.PI * 2) * PUFF_DRIFT_PX;
    const rise = smoking ? 0 : 4 * (1 - this.puffFadeMs / PUFF_FADE_MS);
    this.puff?.setPosition(Math.round(head.x + 4 + drift * 0.5), Math.round(head.y + 6 + drift - rise)).setDepth(this.run.myko.pos.y + 1);
  }
}
