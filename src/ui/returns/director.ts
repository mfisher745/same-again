/**
 * Plays the return to the bar. The game has already put Andrew in the bar by
 * the time `bar:returned` arrives, so the sequence is staged over the bar: a
 * dark backdrop with Andrew falling and Myko hurrying over (floor), or the
 * colours going flat (sober), then black, then the fade up. The game is paused
 * while it plays (the HUD scene's overlay tracker), and the dialogue waits.
 */

import Phaser from 'phaser';
import { PALETTE } from '../../art/palette';
import { TEX, animKey, fx as fxFrames } from '../../art/keys';
import type { BarReturnReason } from '../../core/types';
import { SCREEN } from '../layout';
import { returnFrame } from '../model/returns';
import type { ReturnFrame } from '../model/returns';
import { uiTuning } from '../uiTuning';
import type { FlatColour } from './flat';

const SCALE = 3;
const CLOUD_FPS = 6;

export class ReturnDirector {
  private reason: BarReturnReason | null = null;
  private elapsed = 0;
  private readonly cover: Phaser.GameObjects.Rectangle;
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly andrew: Phaser.GameObjects.Sprite | null;
  private readonly myko: Phaser.GameObjects.Sprite | null;
  private readonly cloud: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
  private lastFrame: ReturnFrame | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly flat: FlatColour,
    depth: number,
    private readonly onDone: () => void,
  ) {
    this.backdrop = scene.add.rectangle(0, 0, SCREEN.width, SCREEN.height, PALETTE.ink).setOrigin(0, 0).setDepth(depth).setVisible(false);
    this.andrew = this.makeSprite(TEX.andrew, depth + 1);
    this.myko = this.makeSprite(TEX.myko, depth + 1);
    this.cloud = this.makeCloud(depth + 2);
    this.cover = scene.add.rectangle(0, 0, SCREEN.width, SCREEN.height, PALETTE.ink).setOrigin(0, 0).setDepth(depth + 3).setVisible(false);
  }

  private makeSprite(key: string, depth: number): Phaser.GameObjects.Sprite | null {
    if (!this.scene.textures.exists(key)) return null;
    return this.scene.add.sprite(0, 0, key).setScale(SCALE).setDepth(depth).setVisible(false);
  }

  private makeCloud(depth: number): Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse {
    const tex = this.scene.textures.exists(TEX.fx) ? this.scene.textures.get(TEX.fx) : null;
    if (tex !== null && tex.has(fxFrames.smokeCloud[0])) return this.scene.add.image(0, 0, TEX.fx, fxFrames.smokeCloud[0]).setDepth(depth).setVisible(false);
    // The art for the cloud is not in yet: a grey disc grows the same way.
    return this.scene.add.ellipse(0, 0, 16, 16, PALETTE.fog).setDepth(depth).setVisible(false);
  }

  get active(): boolean {
    return this.reason !== null;
  }

  /** What the last frame said (for tests and the harness). */
  get frame(): ReturnFrame | null {
    return this.lastFrame;
  }

  start(reason: BarReturnReason): void {
    this.reason = reason;
    this.elapsed = 0;
    if (reason === 'floor') {
      this.play(this.andrew, TEX.andrew, 'fall', 'down');
      this.play(this.myko, TEX.myko, 'hurry', 'right');
    }
    this.draw(returnFrame(reason, 0, uiTuning()));
  }

  private play(sprite: Phaser.GameObjects.Sprite | null, tex: string, anim: string, facing: 'down' | 'right'): void {
    if (sprite === null) return;
    const wanted = animKey(tex, anim, facing);
    const fallback = animKey(tex, 'walk', facing);
    const key = this.scene.anims.exists(wanted) ? wanted : this.scene.anims.exists(fallback) ? fallback : null;
    if (key !== null) sprite.play(key);
  }

  update(deltaMs: number): void {
    if (this.reason === null) return;
    this.elapsed += deltaMs;
    const f = returnFrame(this.reason, this.elapsed, uiTuning());
    this.draw(f);
    if (f.done) this.finish();
  }

  private draw(f: ReturnFrame): void {
    this.lastFrame = f;
    this.flat.set(f.flat);
    this.cover.setVisible(f.cover > 0).setAlpha(f.cover);
    const staged = this.reason === 'floor' && f.stage !== 'black' && f.stage !== 'reveal' && f.stage !== 'done';
    this.backdrop.setVisible(this.reason === 'floor' && f.backdrop > 0).setAlpha(f.backdrop);
    const cx = SCREEN.width / 2;
    const cy = SCREEN.height / 2 + 10;
    this.andrew?.setVisible(staged).setPosition(cx, cy);
    const offset = uiTuning().floorReturn.mykoStartOffset;
    const fromX = -offset;
    const toX = cx - 34;
    this.myko?.setVisible(staged && f.hurry > 0).setPosition(fromX + (toX - fromX) * f.hurry, cy);
    const showCloud = this.reason === 'floor' && f.smoke > 0 && f.stage !== 'black' && f.stage !== 'reveal' && f.stage !== 'done';
    this.cloud.setVisible(showCloud).setPosition(cx, cy);
    if (showCloud) {
      // 16 px puff up to a cloud that covers the corners from the middle of the screen.
      const full = (Math.hypot(SCREEN.width, SCREEN.height) / 16) * 0.75;
      const scale = 1 + (full - 1) * f.smoke * f.smoke;
      this.cloud.setScale(scale);
      if (this.cloud instanceof Phaser.GameObjects.Image) {
        const frames = fxFrames.smokeCloud;
        this.cloud.setFrame(frames[Math.floor((this.elapsed / 1000) * CLOUD_FPS) % frames.length] ?? frames[0]);
      }
    }
  }

  private finish(): void {
    this.reason = null;
    this.flat.set(0);
    for (const o of [this.cover, this.backdrop, this.andrew, this.myko, this.cloud]) o?.setVisible(false);
    this.onDone();
  }

  /** Stop at once, without the fade (the scene is going away). */
  cancel(): void {
    if (this.reason === null) return;
    this.reason = null;
    this.flat.set(0);
    for (const o of [this.cover, this.backdrop, this.andrew, this.myko, this.cloud]) o?.setVisible(false);
  }
}
