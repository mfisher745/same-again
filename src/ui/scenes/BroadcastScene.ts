/**
 * The broadcast console (chapter 10): five plugs, five sockets, then the big button. Pick a plug, set it in a socket. Two
 * sockets look alike until examined (X, or a click on a socket with no plug in hand): the close-up shows the notch. A plug in
 * the wrong socket costs nothing and plays the line. The fifth plug closes the screen (the chapter plays what follows); the
 * button is its own step, here or at the console in the room.
 *
 * Keys: arrows or WASD move, Enter, Space or E pick up and set down, X looks closer, Esc steps back. Mouse: click. There is
 * no gamepad layer anywhere in the game yet, so there is none here. Opened by `openBroadcastConsole()` through the HUD scene.
 */

import Phaser from 'phaser';
import { PROPS_KEY } from '../../art/keys';
import { PALETTE } from '../../art/palette';
import type { ColourName } from '../../art/palette';
import { PROP } from '../../art/props';
import { format, hasText, sequence, text } from '../../content/dialogue';
import type { ProofId, PuzzleSectionId } from '../../core/types';
import type { BroadcastView } from '../../systems/broadcast';
import { makeLabel, rect, setLabelColour, setLabelText } from '../gfx';
import type { Label } from '../gfx';
import { ConsoleCursor } from '../model/console';
import { wrapText } from '../model/wrap';
import { UiSceneKeys } from '../shared';
import type { UiShared } from '../shared';

/** The one broadcast puzzle of the game. */
export const BROADCAST_PUZZLE: PuzzleSectionId = 'c10.puzzle.broadcast';

const SOCKET = { x0: 80, dx: 80, y: 48, scale: 3 } as const;
const PLUG = { x0: 80, dx: 80, y: 128, scale: 3 } as const;
const BUTTON = { x: 190, y: 206, w: 100, h: 24 } as const;
/** Presentation only: a beat to see the fifth plug seated, and how long the wrong-plug line stays. */
const SOON_MS = 700;
const RESULT_MS = 2400;
const RETORT_WIDTH = 64;

type ProofKey = keyof typeof PROP.plug;
const proofKey = (id: ProofId): ProofKey => id.slice('c9.proof.'.length) as ProofKey;
type SocketShape = keyof typeof PROP.socket;
const isShape = (s: string): s is SocketShape => s in PROP.socket;
const shapeOf = (s: string): SocketShape => (isShape(s) ? s : 'square');

/** An atlas frame, or a coloured square if the art is not there (dev harness). */
class Piece {
  private readonly image: Phaser.GameObjects.Image | null;
  private readonly box: Phaser.GameObjects.Rectangle;
  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly size: number,
  ) {
    this.image = scene.textures.exists(PROPS_KEY) ? scene.add.image(x, y, PROPS_KEY).setOrigin(0, 0).setVisible(false) : null;
    this.box = scene.add.rectangle(x, y, size, size, PALETTE.steel).setOrigin(0, 0);
  }
  set(frame: string, scale: number, fallback: ColourName): void {
    const real = this.image !== null && this.scene.textures.get(PROPS_KEY).has(frame);
    if (real && this.image) this.image.setFrame(frame).setScale(scale).setVisible(true);
    else this.image?.setVisible(false);
    this.box.setVisible(!real).setFillStyle(PALETTE[fallback]).setSize(this.size, this.size);
  }
  setAlpha(a: number): void {
    this.image?.setAlpha(a);
    this.box.setAlpha(a);
  }
  hide(): void {
    this.image?.setVisible(false);
    this.box.setVisible(false);
  }
}

interface SocketUi {
  readonly piece: Piece;
  readonly seated: Piece;
  readonly mark: Phaser.GameObjects.Rectangle;
  readonly label: Label;
}
interface PlugUi {
  readonly piece: Piece;
  readonly mark: Phaser.GameObjects.Rectangle;
}

export class BroadcastScene extends Phaser.Scene {
  private cursor!: ConsoleCursor;
  private sockets: SocketUi[] = [];
  private plugs: PlugUi[] = [];
  private closeup!: Piece;
  private closeupLabel!: Label;
  private buttonBg!: Phaser.GameObjects.Rectangle;
  private buttonLabel!: Label;
  private resultUntil = 0;
  private resultObjects: Phaser.GameObjects.GameObject[] = [];
  private closeAt = 0;
  private sawReady = false;

  constructor(private readonly shared: UiShared) {
    super(UiSceneKeys.Broadcast);
  }

  create(): void {
    this.sockets = [];
    this.plugs = [];
    this.resultUntil = 0;
    this.resultObjects = [];
    this.closeAt = 0;
    const view = this.shared.source.activeBroadcast();
    rect(this, 0, 0, 480, 270, 'ink');
    if (view === null) {
      this.scene.stop();
      return;
    }
    this.sawReady = view.ready;
    this.cursor = new ConsoleCursor(view.sockets.length);
    // The game is held while the console is up, like the Tab screen.
    this.shared.overlays.show('broadcast');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shared.overlays.hide('broadcast'));
    makeLabel(this, 240, 12, text('c10.broadcast.prompt'), 'bone', { anchor: 'centre' });
    view.sockets.forEach((_, i) => {
      const x = SOCKET.x0 + i * SOCKET.dx;
      const mark = rect(this, x - 6, SOCKET.y - 6, 60, 60, 'coal');
      mark.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.clickSocket(i));
      const piece = new Piece(this, x, SOCKET.y, 16 * SOCKET.scale);
      const seated = new Piece(this, x, SOCKET.y, 16 * SOCKET.scale);
      const label = makeLabel(this, x + 24, SOCKET.y + 56, format('c10.broadcast.socket', { n: i + 1 }), 'fog', { anchor: 'centre' });
      this.sockets.push({ piece, seated, mark, label });
    });
    view.plugs.forEach((p, i) => {
      const x = PLUG.x0 + i * PLUG.dx;
      const mark = rect(this, x - 6, PLUG.y - 6, 60, 60, 'coal');
      mark.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.clickPlug(i));
      const piece = new Piece(this, x, PLUG.y, 16 * PLUG.scale);
      piece.set(PROP.plug[proofKey(p.proofId)], PLUG.scale, 'amber');
      makeLabel(this, x + 24, PLUG.y + 56, wrapText(text(`${p.proofId}.title`), 12).join('\n'), 'bone', { anchor: 'centre' });
      this.plugs.push({ piece, mark });
    });
    // The close-up of the socket under the cursor, once it has been looked at.
    this.closeup = new Piece(this, 396, 16, 64);
    this.closeup.hide();
    this.closeupLabel = makeLabel(this, 428, 84, '', 'fog', { anchor: 'centre' });
    this.buttonBg = rect(this, BUTTON.x, BUTTON.y, BUTTON.w, BUTTON.h, 'coal');
    this.buttonBg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.clickButton());
    this.buttonLabel = makeLabel(this, BUTTON.x + BUTTON.w / 2, BUTTON.y + 8, text('c10.broadcast.button'), 'steel', { anchor: 'centre' });
    const back = rect(this, 20, 236, 90, 20, 'coal');
    back.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.stepBack());
    makeLabel(this, 65, 242, text('ui.deduction.back'), 'white', { anchor: 'centre' });
    if (hasText('ui.broadcast.help')) makeLabel(this, 240, 258, text('ui.broadcast.help'), 'fog', { anchor: 'centre' });
    this.bindKeys();
  }

  private bindKeys(): void {
    const kb = this.input.keyboard;
    if (kb === null) return;
    const on = (names: readonly string[], fn: () => void): void => {
      for (const n of names) {
        const key = `keydown-${n}`;
        kb.on(key, fn);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.off(key, fn));
      }
    };
    on(['LEFT', 'A'], () => this.move(-1, 0));
    on(['RIGHT', 'D'], () => this.move(1, 0));
    on(['UP', 'W'], () => this.move(0, -1));
    on(['DOWN', 'S'], () => this.move(0, 1));
    on(['ENTER', 'SPACE', 'E'], () => this.activate());
    on(['X'], () => this.examine());
    // Keyup, so the HUD's keydown handler for Esc never sees the same press.
    const esc = (): void => this.stepBack();
    kb.on('keyup-ESC', esc);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.off('keyup-ESC', esc));
  }

  private busy(): boolean {
    return this.resultUntil !== 0 || this.closeAt !== 0;
  }

  private move(dx: -1 | 0 | 1, dy: -1 | 0 | 1): void {
    if (this.busy()) return;
    if (dx !== 0) this.cursor.step(dx);
    if (dy !== 0) this.cursor.rowStep(dy);
    this.shared.hooks.play?.('uiMove');
  }

  private stepBack(): void {
    if (this.closeAt !== 0) return;
    this.shared.hooks.play?.('uiMove');
    this.scene.stop();
  }

  private clickSocket(i: number): void {
    if (this.busy()) return;
    this.cursor.at('sockets', i);
    if (this.cursor.held !== null) this.activate();
    else this.examine();
  }

  private clickPlug(i: number): void {
    if (this.busy()) return;
    this.cursor.at('plugs', i);
    this.activate();
  }

  private clickButton(): void {
    if (this.busy()) return;
    this.cursor.at('button', 0);
    this.activate();
  }

  /** X: look closely at the socket under the cursor. */
  private examine(): void {
    const view = this.shared.source.activeBroadcast();
    if (view === null || this.busy() || this.cursor.row !== 'sockets') return;
    const s = view.sockets[this.cursor.col];
    if (s === undefined) return;
    if (this.shared.source.examineSocket(BROADCAST_PUZZLE, s.id)) this.shared.hooks.play?.('uiSelect');
  }

  private activate(): void {
    const view = this.shared.source.activeBroadcast();
    if (view === null || this.busy()) return;
    const { row, col } = this.cursor;
    if (row === 'plugs') {
      const p = view.plugs[col];
      if (p === undefined || !p.owned || p.placed) {
        this.shared.hooks.play?.('refuse');
        return;
      }
      this.cursor.pick(col);
      this.shared.hooks.play?.('uiSelect');
    } else if (row === 'sockets') {
      const held = this.cursor.held === null ? undefined : view.plugs[this.cursor.held];
      const s = view.sockets[col];
      if (held === undefined || s === undefined) {
        this.examine();
        return;
      }
      const tried = this.shared.source.plugProof(BROADCAST_PUZZLE, held.proofId, s.id);
      if (tried.ok) {
        this.cursor.drop();
        this.cursor.at('plugs', 0);
        this.shared.hooks.play?.('uiSelect');
      } else {
        this.shared.hooks.play?.('refuse');
        if (tried.textId !== undefined) this.showWrong(tried.textId);
      }
    } else if (view.ready && !view.pressed) {
      if (this.shared.source.pressBroadcast(BROADCAST_PUZZLE)) {
        this.shared.hooks.play?.('uiSelect');
        // The chapter plays the rest; leave the console.
        this.scene.stop();
      }
    } else this.shared.hooks.play?.('refuse');
  }

  private showWrong(id: string): void {
    this.resultUntil = this.time.now + RESULT_MS;
    const lines = sequence(id)
      .lines.map((l) => wrapText(l.text, RETORT_WIDTH).join('\n'))
      .join('\n');
    const panel = rect(this, 0, 176, 480, 24, 'ink', 20);
    this.resultObjects = [panel, makeLabel(this, 240, 182, lines, 'fog', { anchor: 'centre', depth: 21 })];
  }

  update(): void {
    const view: BroadcastView | null = this.shared.source.activeBroadcast();
    if (view === null) {
      this.scene.stop();
      return;
    }
    const now = this.time.now;
    if (this.resultUntil !== 0 && now >= this.resultUntil) {
      for (const o of this.resultObjects) o.destroy();
      this.resultObjects = [];
      this.resultUntil = 0;
    }
    const { row, col, held } = this.cursor;
    view.sockets.forEach((s, i) => {
      const ui = this.sockets[i];
      if (ui === undefined) return;
      ui.piece.set(PROP.socket[shapeOf(s.shown)], SOCKET.scale, 'slate');
      if (s.plugged === null) ui.seated.hide();
      else ui.seated.set(PROP.plugSeated[proofKey(s.plugged)], SOCKET.scale, 'teal');
      const on = row === 'sockets' && col === i;
      ui.mark.setFillStyle(PALETTE[on ? (held !== null ? 'amberLight' : 'amber') : 'coal']);
      setLabelColour(ui.label, on ? 'amberLight' : 'fog');
    });
    view.plugs.forEach((p, i) => {
      const ui = this.plugs[i];
      if (ui === undefined) return;
      const on = row === 'plugs' && col === i;
      ui.mark.setFillStyle(PALETTE[held === i ? 'amberLight' : on ? 'amber' : 'coal']);
      ui.piece.setAlpha(p.placed ? 0.25 : p.owned ? 1 : 0.4);
    });
    // The close-up: the socket under the cursor, plainly, once it has been looked at.
    const focus = row === 'sockets' ? view.sockets[col] : undefined;
    if (focus !== undefined && (focus.examined || focus.plugged !== null)) {
      this.closeup.set(PROP.socketCloseup[shapeOf(focus.shown)], 2, 'slate');
      setLabelText(this.closeupLabel, format('c10.broadcast.socket', { n: col + 1 }));
    } else {
      this.closeup.hide();
      setLabelText(this.closeupLabel, '');
    }
    const live = view.ready && !view.pressed;
    this.buttonBg.setFillStyle(PALETTE[live ? (row === 'button' ? 'amberLight' : 'alarm') : row === 'button' ? 'slate' : 'coal']);
    setLabelColour(this.buttonLabel, live ? 'white' : 'steel');
    // The fifth plug: a beat to see it seated, then the console closes and the chapter takes over.
    if (view.ready && !this.sawReady && this.closeAt === 0) this.closeAt = now + SOON_MS;
    if (this.closeAt !== 0 && now >= this.closeAt) {
      this.closeAt = 0;
      this.scene.stop();
    }
  }
}
