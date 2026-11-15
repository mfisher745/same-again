/** The camera that draws the world, for the UI effects that sit over it (flat colour, the throw preview). */

import Phaser from 'phaser';

/** Scene keys that draw the world, tried in order: the game, then the dev harness. */
const WORLD_SCENES = ['Game', 'DevWorld'] as const;

export function worldScene(game: Phaser.Game): Phaser.Scene | null {
  for (const key of WORLD_SCENES) {
    // `getScene` answers null for a key that was never added, whatever its type says.
    const scene = game.scene.getScene(key) as Phaser.Scene | null;
    if (scene !== null && (game.scene.isActive(key) || game.scene.isPaused(key))) return scene;
  }
  return null;
}

/** The world camera, or null when no world scene is running or the renderer is not WebGL and `needWebGl` is set. */
export function worldCamera(game: Phaser.Game, needWebGl = true): Phaser.Cameras.Scene2D.Camera | null {
  if (needWebGl && game.renderer.type !== Phaser.WEBGL) return null;
  return worldScene(game)?.cameras.main ?? null;
}
