/**
 * Chapter 5 and 6 set pieces, drawn from the run's state (never changing it): Pruitt's rolling shelves and their lit
 * rails, the combine's dust plume, bale shadows, bales in flight and sensor lights, and the maze's lit marker stones.
 * Frame and position choices are pure helpers in `c56.ts`. The corn is drawn by `WorldView` (it owns the tile images).
 */

import Phaser from 'phaser';
import { PROP, PROPS_KEY } from '../../art';
import type { Vec2 } from '../../core/types';
import { TILE } from '../grid';
import type { ChapterRun } from '../run';
import { baleShadowFrame, isSensorLightBody, loopFrame, plumeSpots, PLUME_FPS, shelfRowFrame } from './c56';

const RAIL_DEPTH = -800;
/** Above characters, below the night tint (as `ObjectsView`'s icons). */
const AIR_DEPTH = 8000;
const PLUME_ALPHA = 0.85;
const SHADOW_ALPHA = 0.7;

export class SetpieceView {
  private readonly images = new Map<string, Phaser.GameObjects.Image>();
  private touched = new Set<string>();
  private screenId = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly run: ChapterRun,
  ) {}

  sync(): void {
    if (!this.scene.textures.exists(PROPS_KEY)) return;
    if (this.run.screenId !== this.screenId) {
      this.destroy();
      this.screenId = this.run.screenId;
    }
    this.touched = new Set();
    this.syncShelves();
    this.syncCombine();
    this.syncMaze();
    for (const [key, img] of this.images) if (!this.touched.has(key)) img.setVisible(false);
  }

  destroy(): void {
    for (const i of this.images.values()) i.destroy();
    this.images.clear();
  }

  // -------------------------------------------------------------------------

  /** The image for `key`, made when first asked for, shown with `frame` at `x, y` (top-left unless `centre`). */
  private put(key: string, frame: string, x: number, y: number, depth: number, centre = false): Phaser.GameObjects.Image | null {
    if (!this.scene.textures.get(PROPS_KEY).has(frame)) return null;
    let img = this.images.get(key);
    if (!img) {
      img = this.scene.add.image(0, 0, PROPS_KEY, frame);
      this.images.set(key, img);
    }
    if (img.frame.name !== frame) img.setFrame(frame);
    img.setOrigin(centre ? 0.5 : 0, centre ? 0.5 : 0).setPosition(Math.round(x), Math.round(y)).setDepth(depth).setVisible(true).setAlpha(1);
    this.touched.add(key);
    return img;
  }

  /** Lit rails for the 1 s before a shelf slides, then the shelf unit sliding across (and shut) its aisle. */
  private syncShelves(): void {
    for (const d of this.run.shelfDirectorsHere()) {
      for (const { lane, state, progress } of d.laneStates()) {
        const a = lane.area;
        const cols = Math.round(a.width / TILE);
        const rows = Math.round(a.height / TILE);
        if (state === 'lit') {
          for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) this.put(`rail:${lane.id}:${c}:${r}`, PROP.floorRail.lit, a.x + c * TILE, a.y + r * TILE, RAIL_DEPTH);
        }
        if (state !== 'closing' && state !== 'closed') continue;
        // The unit lies across the aisle; one 32 x 16 frame per tile-row, top to bottom.
        let x: number;
        if (lane.travel === 'left') x = a.x + a.width - progress * a.width;
        else if (lane.travel === 'right') x = a.x - a.width + progress * a.width;
        else continue; // Up and down travel: no art for a unit turned on its side.
        for (let r = 0; r < rows; r++) this.put(`shelf:${lane.id}:${r}`, PROP.rollingShelf[shelfRowFrame(r, rows)], x, a.y + r * TILE, a.y + a.height);
      }
    }
  }

  private syncCombine(): void {
    const r = this.run;
    const now = this.scene.time.now;
    const actors = r.enemies();
    const harvester = actors.find((a) => a.tag === 'harvester');
    for (const d of r.combineDirectorsHere()) {
      // The dust plume on the lane it will drive next, ahead of the harvester while it is on it.
      const lane = d.plumeLane();
      if (lane && harvester) {
        const along = d.state === 'passing' ? (lane.axis === 'horizontal' ? harvester.pos.x : harvester.pos.y) : lane.from;
        const frame = PROP.dustPlume[loopFrame(now, PLUME_FPS, PROP.dustPlume.length)] as string;
        plumeSpots(lane, along).forEach((p, i) => this.put(`plume:${i}`, frame, p.x, p.y, p.y + TILE, true)?.setAlpha(PLUME_ALPHA));
      }
      // The marker where the next bale will land.
      const marker = d.baleShadow();
      if (marker) this.put('baleMarker', PROP.baleShadow[0], marker.x, marker.y, marker.y - TILE, true)?.setAlpha(SHADOW_ALPHA);
    }
    // Bales in flight, and the shadow at their landing spot.
    for (const p of r.projectiles()) {
      if (p.frame !== 'bale' || p.done) continue;
      if (p.target) {
        const progress = p.totalDistance > 0 ? p.travelled / p.totalDistance : 1;
        this.put(`baleShadow:${p.id}`, PROP.baleShadow[baleShadowFrame(progress)], p.target.x, p.target.y, p.target.y - TILE, true)?.setAlpha(SHADOW_ALPHA);
      }
      this.put(`bale:${p.id}`, PROP.roundBale, p.pos.x, p.pos.y - p.height - 6, AIR_DEPTH, true);
    }
    // The three sensor lights on the cab: lit while up, broken once the body is down.
    for (const a of actors) {
      if (!isSensorLightBody(a.tag, a.spriteKey)) continue;
      const frame = a.down ? PROP.sensorLight.broken : PROP.sensorLight.lit;
      this.put(`light:${a.instanceId}`, frame, a.pos.x, a.pos.y, (harvester?.pos.y ?? a.pos.y) + 1, true);
    }
  }

  /** The maze's stones: the dressing draws them dark, a lit one is drawn over its dark one. */
  private syncMaze(): void {
    for (const { puzzle, placement } of this.run.mazePuzzlesHere()) {
      const lit = new Set(puzzle.litStones());
      for (const s of placement.stones) {
        if (!lit.has(s.id)) continue;
        const pos: Vec2 = s.position;
        this.put(`stone:${placement.sectionId}:${s.id}`, PROP.markerStone.lit, pos.x - TILE / 2, pos.y - TILE / 2, pos.y + TILE / 2 + 0.5);
      }
    }
  }
}
