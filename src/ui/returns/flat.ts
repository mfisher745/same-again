/**
 * The flat-colour look: a desaturation on the world's camera. Used while Buzz is
 * under the low warning (deepening towards 0) and by the sober return. It needs
 * WebGL (a camera post effect); on the canvas renderer it does nothing.
 */

import Phaser from 'phaser';
import { worldCamera } from '../worldCamera';

export class FlatColour {
  private camera: Phaser.Cameras.Scene2D.Camera | null = null;
  private fx: Phaser.FX.ColorMatrix | null = null;
  private amount = 0;

  constructor(private readonly game: Phaser.Game) {}

  /** 0 normal, 1 grey. */
  set(amount: number): void {
    const a = Math.max(0, Math.min(1, amount));
    if (Math.abs(a - this.amount) < 0.004 && (a > 0) === (this.fx !== null)) return;
    this.amount = a;
    if (a <= 0) {
      this.clear();
      return;
    }
    const cam = worldCamera(this.game);
    if (cam === null || cam.postFX === undefined) return;
    if (this.camera !== cam || this.fx === null) {
      this.clear();
      this.camera = cam;
      this.fx = cam.postFX.addColorMatrix();
    }
    this.fx.reset();
    this.fx.saturate(-a);
  }

  clear(): void {
    if (this.camera !== null && this.fx !== null) // Phaser's typings say remove() wants a Controller; the ColorMatrix it hands out is one at run time.
      this.camera.postFX?.remove(this.fx as unknown as Phaser.FX.Controller);
    this.fx = null;
    this.camera = null;
    this.amount = 0;
  }
}
