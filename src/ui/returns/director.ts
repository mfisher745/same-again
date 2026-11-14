/**
 * Plays the return to the bar over the real world. It starts on `bar:returning`:
 * the world is frozen where Andrew stands and still on screen, so nothing is
 * staged here. Sober: the colours go flat and fade to black. Floor: the world
 * shows Andrew's fall and Myko hurrying over, then a smoke cloud grows from
 * Andrew's spot to fill the screen, then black. The first time the cover is
 * fully black `onBlack` fires once (the scene completes the return there); then
 * black holds, the reveal fades up on the bar and `onDone` fires. If the return
 * was completed without us (the run's failsafe), `jumpToBlack` skips to black and
 * `onBlack` never fires.
 */

import Phaser from 'phaser';
import { PALETTE } from '../../art/palette';
import { TEX, fx as fxFrames } from '../../art/keys';
import type { BarReturnReason } from '../../core/types';
import { SCREEN } from '../layout';
import { blackStartMs, returnFrame } from '../model/returns';
import type { ReturnFrame } from '../model/returns';
import { uiTuning } from '../uiTuning';
import type { FlatColour } from './flat';

const CLOUD_FPS = 6;

export class ReturnDirector {
  private reason: BarReturnReason | null = null;
  private elapsed = 0;
  private readonly cover: Phaser.GameObjects.Rectangle;
  private readonly cloud: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
  private lastFrame: ReturnFrame | null = null;
  /** Where the smoke is centred, in screen pixels. */
  private smokeAt = { x: SCREEN.width / 2, y: SCREEN.height / 2 };
  private blackFired = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly flat: FlatColour,
    depth: number,
    private readonly onDone: () => void,
    private readonly onBlack: () => void = () => {},
  ) {
    this.cloud = this.makeCloud(depth);
    this.cover = scene.add.rectangle(0, 0, SCREEN.width, SCREEN.height, PALETTE.ink).setOrigin(0, 0).setDepth(depth + 1).setVisible(false);
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

  /** `andrewOnScreen` is where he stands on the screen (null: the middle); the smoke grows from there. */
  start(reason: BarReturnReason, andrewOnScreen: { x: number; y: number } | null = null): void {
    this.reason = reason;
    this.elapsed = 0;
    this.blackFired = false;
    this.smokeAt = andrewOnScreen === null ? { x: SCREEN.width / 2, y: SCREEN.height / 2 } : { x: andrewOnScreen.x, y: andrewOnScreen.y };
    this.draw(returnFrame(reason, 0, uiTuning()));
  }

  /** The return was completed without the scene: go straight to black and carry on with the reveal. `onBlack` will not fire. */
  jumpToBlack(reason: BarReturnReason): void {
    if (this.reason === null) this.start(reason);
    const reasonNow = this.reason ?? reason;
    this.blackFired = true;
    this.elapsed = Math.max(this.elapsed, blackStartMs(reasonNow, uiTuning()));
    this.draw(returnFrame(reasonNow, this.elapsed, uiTuning()));
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
    const showCloud = this.reason === 'floor' && f.smoke > 0 && f.stage !== 'black' && f.stage !== 'reveal' && f.stage !== 'done';
    this.cloud.setVisible(showCloud).setPosition(this.smokeAt.x, this.smokeAt.y);
    if (showCloud) {
      // 16 px puff up to a cloud that reaches the farthest corner from where Andrew stands (the old full size from the middle).
      const reach = Math.hypot(Math.max(this.smokeAt.x, SCREEN.width - this.smokeAt.x), Math.max(this.smokeAt.y, SCREEN.height - this.smokeAt.y));
      const full = (reach * 2 * 0.75) / 16;
      const scale = 1 + (full - 1) * f.smoke * f.smoke;
      this.cloud.setScale(scale);
      if (this.cloud instanceof Phaser.GameObjects.Image) {
        const frames = fxFrames.smokeCloud;
        this.cloud.setFrame(frames[Math.floor((this.elapsed / 1000) * CLOUD_FPS) % frames.length] ?? frames[0]);
      }
    }
    if (!this.blackFired && (f.stage === 'black' || f.stage === 'reveal' || f.stage === 'done')) {
      this.blackFired = true;
      this.onBlack();
    }
  }

  private finish(): void {
    this.reason = null;
    this.flat.set(0);
    for (const o of [this.cover, this.cloud]) o.setVisible(false);
    this.onDone();
  }

  /** Stop at once, without the fade (the scene is going away). */
  cancel(): void {
    if (this.reason === null) return;
    this.reason = null;
    this.flat.set(0);
    for (const o of [this.cover, this.cloud]) o.setVisible(false);
  }
}
