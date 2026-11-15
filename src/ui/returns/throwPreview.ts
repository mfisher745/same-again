/**
 * The throw preview drawn on the HUD layer: one `fx.throwDot` sprite per point
 * of the aim's path, fading towards the end. The world view's own dotted draw
 * (src/systems/view/worldView.ts) is the stand-in this replaces.
 */

import Phaser from 'phaser';
import { TEX, fx } from '../../art/keys';
import { PALETTE } from '../../art/palette';
import type { ThrowAim } from '../../core/types';
import { uiTuning } from '../uiTuning';
import { worldCamera } from '../worldCamera';

type Dot = Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

export class ThrowPreview {
  private readonly dots: Dot[] = [];
  private readonly haveFrame: boolean;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
  ) {
    this.haveFrame = scene.textures.exists(TEX.fx) && scene.textures.get(TEX.fx).has(fx.throwDot);
  }

  private dot(i: number): Dot {
    let d = this.dots[i];
    if (d === undefined) {
      d = this.haveFrame
        ? this.scene.add.image(0, 0, TEX.fx, fx.throwDot).setDepth(this.depth)
        : this.scene.add.rectangle(0, 0, 2, 2, PALETTE.white).setDepth(this.depth);
      this.dots[i] = d;
    }
    return d;
  }

  /** Draw `aim` (world positions) over the world camera, or hide everything when it is null. */
  update(aim: ThrowAim | null): void {
    const cam = aim === null ? null : worldCamera(this.scene.game, false);
    const path = aim !== null && cam !== null ? aim.path : [];
    const { throwDotEndAlpha, throwDotScale } = uiTuning();
    const n = path.length;
    path.forEach((p, i) => {
      const d = this.dot(i);
      const f = n <= 1 ? 0 : i / (n - 1);
      if (cam === null) return;
      d.setPosition(Math.round((p.x - cam.worldView.x) * cam.zoom), Math.round((p.y - cam.worldView.y) * cam.zoom));
      d.setScale(throwDotScale).setAlpha(1 - (1 - throwDotEndAlpha) * f).setVisible(true);
    });
    for (let i = n; i < this.dots.length; i++) this.dots[i]?.setVisible(false);
  }

  destroy(): void {
    for (const d of this.dots) d.destroy();
    this.dots.length = 0;
  }
}
