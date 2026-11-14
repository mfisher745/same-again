/** Keeps track of what one panel of the Tab screen made, so the panel can be shown and hidden as a whole. */

import type Phaser from 'phaser';
import type { ColourName } from '../../art/palette';
import type { Label, LabelOptions } from '../gfx';
import { Pic, makeIcon, makeLabel, rect } from '../gfx';

interface Showable {
  setVisible(visible: boolean): unknown;
}

export class Layer {
  private readonly objs: Showable[] = [];
  constructor(readonly scene: Phaser.Scene) {}

  rect(x: number, y: number, w: number, h: number, colour: ColourName): Phaser.GameObjects.Rectangle {
    const r = rect(this.scene, x, y, w, h, colour);
    this.objs.push(r);
    return r;
  }

  label(x: number, y: number, str: string, colour: ColourName, opts?: LabelOptions): Label {
    const l = makeLabel(this.scene, x, y, str, colour, opts);
    this.objs.push(l);
    return l;
  }

  icon(x: number, y: number): Pic {
    const p = makeIcon(this.scene, x, y);
    this.objs.push(p);
    return p;
  }

  /** Show every object (a panel then hides the ones it does not need this frame) or hide them all. */
  setVisible(visible: boolean): void {
    for (const o of this.objs) o.setVisible(visible);
  }
}
