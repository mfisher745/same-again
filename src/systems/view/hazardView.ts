/**
 * Chapter 7 and 8 drawing, from the run's state (never changing it): shade areas, the perimeter's sensors, masts and
 * patrol trucks, the fence fight's parked truck and its headlights, the mascot boss (marked tumble line, Zap's fan,
 * Zorp's sign, applause), Pruitt round two (flashbang marker and white-out, the barrier line, the lit truck path and its
 * truck), and the flashbang's white overlay. Uses existing art where it exists (the patrol truck sprite, the ground
 * marker, the lit floor rail, the sun) and simple shapes for the rest; `docs/build/c7c8.md` lists the frames wanted.
 */

import Phaser from 'phaser';
import { animKey, fx, PALETTE, PROP, PROPS_KEY, TEX } from '../../art';
import type { Vec2 } from '../../core/types';
import { facingFromAngle, toRad } from '../geometry';
import type { ChapterRun } from '../run';
import { applausePoints, fanEnd, pulse, sensorLamp, signPosition, stampPoints } from './c78';

const TRUCK_KEY = 'hazard.patrolTruck';
const GROUND_DEPTH = -900;
const OVER_DEPTH = 9000;
const WHITE_DEPTH = 20000;

export class HazardView {
  private readonly under: Phaser.GameObjects.Graphics;
  private readonly over: Phaser.GameObjects.Graphics;
  private readonly white: Phaser.GameObjects.Rectangle;
  private readonly sprites = new Map<string, Phaser.GameObjects.Sprite | Phaser.GameObjects.Image>();
  private touched = new Set<string>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly run: ChapterRun,
  ) {
    this.under = scene.add.graphics().setDepth(GROUND_DEPTH);
    this.over = scene.add.graphics().setDepth(OVER_DEPTH);
    this.white = scene.add.rectangle(0, 0, 4096, 4096, PALETTE.white).setOrigin(0.5).setScrollFactor(0).setDepth(WHITE_DEPTH).setVisible(false);
  }

  destroy(): void {
    this.under.destroy();
    this.over.destroy();
    this.white.destroy();
    for (const s of this.sprites.values()) s.destroy();
    this.sprites.clear();
  }

  sync(): void {
    const r = this.run;
    this.under.clear();
    this.over.clear();
    this.touched = new Set();
    const now = this.scene.time.now;

    // Shade: a soft dark patch under the characters while the heat is on.
    if (r.heat().active && r.heat().sunnyScreen) for (const a of r.shadeAreasHere()) this.under.fillStyle(PALETTE.ink, 0.22).fillRect(a.x, a.y, a.width, a.height);

    // Perimeter hardware.
    for (const { runner } of r.stealthHere()) {
      if (runner.isFinished) continue;
      for (const h of runner.hazards) {
        const d = h.def;
        if (d.kind === 'groundSensor') {
          const lamp = sensorLamp(h.enabled, h.detection);
          const colour = lamp === 'off' ? PALETTE.steel : lamp === 'alert' ? PALETTE.white : PALETTE.alarm;
          const alpha = lamp === 'live' ? 0.5 + 0.5 * pulse(now, 1) : 1;
          this.over.fillStyle(PALETTE.coal, 1).fillRect(d.position.x - 2, d.position.y - 3, 4, 4);
          this.over.fillStyle(colour, alpha).fillRect(d.position.x - 1, d.position.y - 2, 2, 2);
        } else if (d.kind === 'thermalMast') {
          const hot = h.detection > 0;
          this.over.fillStyle(hot ? PALETTE.alarm : PALETTE.amber, 0.6 + 0.4 * pulse(now, 0.7)).fillRect(d.position.x - 2, d.position.y - 12, 4, 2);
        } else if (d.kind === 'patrolTruck') {
          this.truck(`truck:${d.id}`, h.pos, h.facingDeg);
        }
      }
    }

    // The fence fight's parked truck and its headlight cone.
    r.headlightsHere().forEach((hl, i) => {
      this.truck(`parked:${i}`, hl.position, hl.facingDeg);
      this.over.fillStyle(PALETTE.amberLight, 0.18);
      this.over.slice(hl.position.x, hl.position.y, hl.cone.range, toRad(hl.facingDeg - hl.cone.angleDeg / 2), toRad(hl.facingDeg + hl.cone.angleDeg / 2), false);
      this.over.fillPath();
    });

    this.drawMascots(now);
    this.drawPruitt(now);

    const w = r.whiteoutAlpha();
    const cam = this.scene.cameras.main;
    this.white.setPosition(cam.width / 2, cam.height / 2).setAlpha(w).setVisible(w > 0);
    for (const [key, s] of this.sprites) if (!this.touched.has(key)) s.setVisible(false);
  }

  // -------------------------------------------------------------------------

  private drawMascots(now: number): void {
    const g = this.over;
    for (const { director, boss } of this.run.mascotsHere()) {
      const v = director.view(boss);
      if (v.tumble) {
        const { from, to, width, state } = v.tumble;
        const a = state === 'lit' ? 0.25 + 0.2 * pulse(now, 4) : 0.45;
        g.lineStyle(width, PALETTE.alarm, a).lineBetween(from.x, from.y, to.x, to.y);
        for (const p of stampPoints(from, to, 24)) this.put(`tumble:${Math.round(p.x)}:${Math.round(p.y)}`, TEX.fx, fx.groundMarker, p, -800, 0.7);
      }
      if (v.fan) for (const ang of v.fan.anglesDeg) {
        const end = fanEnd(v.fan.origin, ang, v.fan.range);
        g.lineStyle(2, PALETTE.magenta, 0.35 + 0.35 * pulse(now, 6)).lineBetween(v.fan.origin.x, v.fan.origin.y, end.x, end.y);
      }
      const zorp = boss?.body('zorp');
      if (zorp && !zorp.down) {
        // Stand-in sign (a board on a stick): the frame wanted is listed in docs/build/c7c8.md.
        const p = signPosition(zorp.pos, zorp.facingDeg, v.signUp);
        g.fillStyle(PALETTE.ink, 1).fillRect(p.x - 6, p.y - 12, 12, 9);
        g.fillStyle(PALETTE.bone, 1).fillRect(p.x - 5, p.y - 11, 10, 7);
        g.fillStyle(PALETTE.alarm, 1).fillRect(p.x - 3, p.y - 9, 6, 2);
      }
      if (v.applauding) {
        const arena = director.placement.arena;
        for (const [i, p] of applausePoints(arena, 10).entries()) {
          const up = pulse(now + i * 90, 5);
          g.fillStyle(PALETTE.amberLight, 0.5 + 0.5 * up).fillRect(p.x - 1, p.y - up * 6, 2, 2);
        }
      }
    }
  }

  private drawPruitt(now: number): void {
    const g = this.over;
    for (const { director, boss } of this.run.pruittHere()) {
      const v = director.view(boss);
      if (v.flash) {
        const { spot, radius, state } = v.flash;
        if (state === 'burst') g.fillStyle(PALETTE.white, 0.8).fillCircle(spot.x, spot.y, radius);
        else {
          this.put('flash', TEX.fx, fx.groundMarker, spot, -800, (radius * 2) / 16, 0.6 + 0.4 * pulse(now, 5));
          g.lineStyle(1, PALETTE.alarm, 0.6).strokeCircle(spot.x, spot.y, radius);
        }
      }
      if (v.barrier) {
        const { line, width, state } = v.barrier;
        if (state === 'lit') {
          g.lineStyle(width, PALETTE.amberLight, 0.25 + 0.2 * pulse(now, 5)).lineBetween(line.from.x, line.from.y, line.to.x, line.to.y);
          for (const p of stampPoints(line.from, line.to, 16)) this.put(`bar:${Math.round(p.x)}:${Math.round(p.y)}`, TEX.fx, fx.groundMarker, p, -800, 0.6);
        } else {
          // Stand-in barrier arm: a striped bar lying across the line.
          g.lineStyle(width, PALETTE.ink, 1).lineBetween(line.from.x, line.from.y, line.to.x, line.to.y);
          g.lineStyle(width - 4, PALETTE.alarm, 1).lineBetween(line.from.x, line.from.y, line.to.x, line.to.y);
        }
      }
      if (v.truck) {
        const { path, state, pos, angleDeg } = v.truck;
        if (state === 'lit') {
          g.lineStyle(path.width, PALETTE.amberLight, 0.18 + 0.15 * pulse(now, 4)).lineBetween(path.from.x, path.from.y, path.to.x, path.to.y);
          for (const p of stampPoints(path.from, path.to, 16)) this.put(`path:${Math.round(p.x)}:${Math.round(p.y)}`, PROPS_KEY, PROP.floorRail.lit, p, -800, 1);
        } else this.truck('pruittTruck', pos, angleDeg);
      }
    }
  }

  /** The patrol truck sprite at `pos` (its feet), walking along `angleDeg`; a box when the art is not loaded. */
  private truck(key: string, pos: Vec2, angleDeg: number): void {
    const facing = facingFromAngle(angleDeg);
    let s = this.sprites.get(key);
    if (!s) {
      s = this.scene.textures.exists(TRUCK_KEY) ? this.scene.add.sprite(0, 0, TRUCK_KEY).setOrigin(0.5, 1) : this.scene.add.rectangle(0, 0, 40, 18, PALETTE.sand).setOrigin(0.5, 1).setStrokeStyle(1, PALETTE.ink) as unknown as Phaser.GameObjects.Sprite;
      this.sprites.set(key, s);
    }
    s.setPosition(Math.round(pos.x), Math.round(pos.y + 8)).setDepth(pos.y).setVisible(true);
    if (s instanceof Phaser.GameObjects.Sprite) {
      const anim = animKey(TRUCK_KEY, 'walk', facing);
      if (this.scene.anims.exists(anim) && s.anims.currentAnim?.key !== anim) s.play(anim);
    }
    this.touched.add(key);
  }

  /** A stamped frame (ground marker, lit floor rail). */
  private put(key: string, texture: string, frame: string, at: Vec2, depth: number, scale: number, alpha = 0.8): void {
    if (!this.scene.textures.exists(texture) || !this.scene.textures.get(texture).has(frame)) return;
    let s = this.sprites.get(key);
    if (!s) {
      s = this.scene.add.image(0, 0, texture, frame);
      this.sprites.set(key, s);
    }
    s.setPosition(Math.round(at.x), Math.round(at.y)).setDepth(depth).setScale(scale).setAlpha(alpha).setVisible(true);
    this.touched.add(key);
  }
}

