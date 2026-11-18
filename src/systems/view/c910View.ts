/**
 * Chapter 9 and 10 drawing, from the run's state (never changing it): the gravity rooms (plates, ledges, switches,
 * crates), the lockdown hall (doors coming down, timers above them, the barrier, the wall recorder and its progress, the
 * lift door), the Administrator fight (desk shield, the stamp's marked row and its shockwave, the floor arrows and the
 * sliding furniture, the stun pulse and teleport markers, the beam), and weapons lying on the floor. Uses existing art
 * where it exists (the crate and the ground marker, the weapon icons) and simple shapes for the rest; `docs/build/c9c10.md`
 * lists the frames wanted.
 */

import Phaser from 'phaser';
import { fx, icon, PALETTE, PROP, PROPS_KEY, TEX } from '../../art';
import type { Vec2 } from '../../core/types';
import type { ChapterRun } from '../run';
import { TILE } from '../grid';
import { stampPoints } from './c78';
import { pulse } from './c78';
import { arrowGrid, arrowHead, beamEnd, stampSpan, timerSegments, timerUrgent, wedgePoints } from './c910';

const GROUND_DEPTH = -900;
const OVER_DEPTH = 9000;
const SEGMENTS = 14;

export class C910View {
  private readonly under: Phaser.GameObjects.Graphics;
  private readonly over: Phaser.GameObjects.Graphics;
  private readonly sprites = new Map<string, Phaser.GameObjects.Image>();
  private touched = new Set<string>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly run: ChapterRun,
  ) {
    this.under = scene.add.graphics().setDepth(GROUND_DEPTH);
    this.over = scene.add.graphics().setDepth(OVER_DEPTH);
  }

  destroy(): void {
    this.under.destroy();
    this.over.destroy();
    for (const s of this.sprites.values()) s.destroy();
    this.sprites.clear();
  }

  sync(): void {
    this.under.clear();
    this.over.clear();
    this.touched = new Set();
    const now = this.scene.time.now;
    this.drawGravity(now);
    this.drawLockdown(now);
    this.drawAdministrator(now);
    for (const w of this.run.weaponPickupsHere()) {
      this.put(`weapon:${w.id}`, TEX.icons, icon.weapon(w.weaponId), { x: w.position.x, y: w.position.y - 4 + 2 * pulse(now, 1.2) }, w.position.y + 8, 1, 1);
    }
    for (const [key, s] of this.sprites) if (!this.touched.has(key)) s.setVisible(false);
  }

  // -------------------------------------------------------------------------

  private drawGravity(now: number): void {
    const g = this.under;
    for (const { puzzle } of this.run.gravityHere()) {
      for (const room of puzzle.views()) {
        const a = room.area;
        // The room's floor edge, teal once it is solved.
        g.lineStyle(1, room.solved ? PALETTE.teal : PALETTE.violet, 0.8).strokeRect(a.col * TILE, a.row * TILE, a.width * TILE, a.height * TILE);
        for (const p of room.plates) {
          g.fillStyle(p.covered ? PALETTE.teal : PALETTE.amber, p.covered ? 0.5 : 0.35).fillRect(p.col * TILE + 2, p.row * TILE + 2, TILE - 4, TILE - 4);
          g.lineStyle(1, p.covered ? PALETTE.teal : PALETTE.amberLight, 0.9).strokeRect(p.col * TILE + 2, p.row * TILE + 2, TILE - 4, TILE - 4);
        }
        for (const l of room.ledges) {
          g.lineStyle(1, PALETTE.fluoro, 0.5 + 0.4 * pulse(now, 1.5)).strokeRect(l.col * TILE + 1, l.row * TILE + 1, TILE - 2, TILE - 2);
        }
        for (const sw of room.switches) {
          const at = { x: sw.col * TILE + TILE / 2, y: sw.row * TILE + TILE / 2 };
          g.fillStyle(PALETTE.ink, 1).fillRect(at.x - 5, at.y - 5, 10, 10);
          g.fillStyle(room.solved ? PALETTE.steel : PALETTE.violet, 1).fillRect(at.x - 4, at.y - 4, 8, 8);
          const [tip, l, r] = arrowHead(at, sw.dir, 8);
          g.fillStyle(PALETTE.fluoro, 1).fillTriangle(tip.x, tip.y, l.x, l.y, r.x, r.y);
        }
        if (room.gravity) {
          const at = { x: (a.col + a.width) * TILE - 6, y: a.row * TILE + 6 };
          const [tip, l, r] = arrowHead(at, room.gravity, 8);
          g.fillStyle(PALETTE.amberLight, 0.9).fillTriangle(tip.x, tip.y, l.x, l.y, r.x, r.y);
        }
      }
      for (const c of puzzle.crateDrawPositions()) this.put(`crate:${c.roomId}:${c.id}`, PROPS_KEY, PROP.crate, c.pos, c.pos.y + TILE / 2, 1, 1);
    }
  }

  private drawLockdown(now: number): void {
    const g = this.over;
    for (const { director, boss } of this.run.lockdownHere()) {
      const v = director.view(boss);
      for (const b of v.bays) {
        const d = b.door;
        // Stand-in blast door: it comes down from the top as the timer runs, and is full height when shut.
        const h = d.height * b.closed;
        if (h > 0) {
          g.fillStyle(PALETTE.tealDark, 1).fillRect(d.x, d.y, d.width, h);
          g.fillStyle(b.state === 'shut' ? PALETTE.alarm : PALETTE.amber, 1).fillRect(d.x, d.y + Math.max(0, h - 2), d.width, 2);
        }
        g.lineStyle(1, PALETTE.steel, 0.5).strokeRect(d.x, d.y, d.width, d.height);
        if (b.state === 'running' || b.state === 'shut') {
          // The timer above the door: a row of segments that go out one by one.
          const lit = timerSegments(b.leftMs, b.totalMs, SEGMENTS);
          const urgent = timerUrgent(b.leftMs, b.totalMs);
          const w = 2;
          const x0 = b.timerAt.x - (SEGMENTS * (w + 1)) / 2;
          for (let i = 0; i < SEGMENTS; i++) {
            const on = i < lit;
            g.fillStyle(on ? (urgent ? PALETTE.alarm : PALETTE.amberLight) : PALETTE.coal, on && urgent ? 0.6 + 0.4 * pulse(now, 6) : 1).fillRect(x0 + i * (w + 1), b.timerAt.y - 3, w, 3);
          }
        }
        if (b.barrier) {
          g.fillStyle(PALETTE.ink, 1).fillRect(b.barrier.x, b.barrier.y, b.barrier.width, b.barrier.height);
          g.fillStyle(PALETTE.alarm, 1).fillRect(b.barrier.x + 1, b.barrier.y + 1, b.barrier.width - 2, b.barrier.height - 2);
        }
      }
      if (v.recorder) {
        const r = v.recorder;
        g.fillStyle(PALETTE.ink, 1).fillRect(r.position.x - 5, r.position.y - 6, 10, 8);
        g.fillStyle(r.taken ? PALETTE.steel : PALETTE.amberLight, 1).fillRect(r.position.x - 4, r.position.y - 5, 8, 4);
        if (!r.taken && r.progress > 0) g.fillStyle(PALETTE.fluoro, 1).fillRect(r.position.x - 6, r.position.y - 10, 12 * r.progress, 2);
      }
      if (!v.lift.open) {
        const d = v.lift.door;
        g.fillStyle(PALETTE.violetDark, 1).fillRect(d.x, d.y, d.width, d.height);
        g.lineStyle(1, PALETTE.violet, 1).strokeRect(d.x, d.y, d.width, d.height);
      }
    }
  }

  private drawAdministrator(now: number): void {
    const g = this.over;
    for (const { director, boss } of this.run.administratorHere()) {
      const v = director.view(boss);
      const arena = director.placement.arena;
      const desk = director.placement.desk;
      if (v.shield) {
        g.lineStyle(2, PALETTE.violet, 0.5 + 0.3 * pulse(now, 2)).strokeCircle(desk.x, desk.y, 22);
        g.fillStyle(PALETTE.violet, 0.12).fillCircle(desk.x, desk.y, 22);
      }
      if (v.stamp) {
        const band = (TILE / 2) * 1;
        if (v.stamp.state === 'lit') {
          g.fillStyle(PALETTE.alarm, 0.2 + 0.2 * pulse(now, 5)).fillRect(v.stamp.fromX, v.stamp.y - band / 2, v.stamp.toX - v.stamp.fromX, band);
          for (const p of stampPoints({ x: v.stamp.fromX, y: v.stamp.y }, { x: v.stamp.toX, y: v.stamp.y }, 24)) this.put(`stamp:${Math.round(p.x)}`, TEX.fx, fx.groundMarker, p, -800, 0.6, 0.6);
        } else {
          const span = stampSpan(arena.x, arena.width, desk.x, v.stamp.frontX);
          g.fillStyle(PALETTE.white, 0.7).fillRect(span.x0, v.stamp.y - band / 2, span.x1 - span.x0, band);
        }
      }
      if (v.gravity) {
        const dim = v.gravity.state === 'lit' ? 0.4 + 0.4 * pulse(now, 5) : 0.25;
        for (const at of arrowGrid(arena, 40)) {
          const [tip, l, r] = arrowHead(at, v.gravity.dir, 14);
          g.fillStyle(PALETTE.amberLight, dim).fillTriangle(tip.x, tip.y, l.x, l.y, r.x, r.y);
        }
      }
      for (const f of v.furniture) {
        this.put(`furn:${f.id}`, PROPS_KEY, PROP.crate, f.pos, f.pos.y + f.size / 2, f.size / TILE, 1);
      }
      for (const sw of director.placement.switches) {
        g.fillStyle(PALETTE.ink, 1).fillRect(sw.position.x - 5, sw.position.y - 5, 10, 10);
        g.fillStyle(v.switchesLive ? PALETTE.amberLight : PALETTE.steel, v.switchesLive ? 0.6 + 0.4 * pulse(now, 4) : 1).fillRect(sw.position.x - 4, sw.position.y - 4, 8, 8);
      }
      if (v.pulse) {
        const { spot, radius, state } = v.pulse;
        if (state === 'burst') g.fillStyle(PALETTE.fluoro, 0.5).fillCircle(spot.x, spot.y, radius);
        else {
          this.put('pulse', TEX.fx, fx.groundMarker, spot, -800, (radius * 2) / 16, 0.6 + 0.4 * pulse(now, 5));
          g.lineStyle(1, PALETTE.alarm, 0.6).strokeCircle(spot.x, spot.y, radius);
        }
      }
      if (v.teleport) this.put('teleport', TEX.fx, fx.groundMarker, v.teleport.spot, -800, 1.5, 0.6 + 0.4 * pulse(now, 7));
      if (v.beam) {
        const b = v.beam;
        const pts = wedgePoints(b.from, b.aimDeg, b.range, b.angleDeg);
        g.fillStyle(PALETTE.alarm, b.state === 'lit' ? 0.12 + 0.1 * pulse(now, 6) : 0.1).fillPoints(pts.map((p) => new Phaser.Geom.Point(p.x, p.y)), true);
        if (b.state === 'sweeping') {
          const e = beamEnd(b.from, b.beamDeg, b.range);
          g.lineStyle(3, PALETTE.white, 0.9).lineBetween(b.from.x, b.from.y, e.x, e.y);
        }
      }
    }
  }

  /** An image at `at` (centre), stamped from an atlas frame. */
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
