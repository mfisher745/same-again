/**
 * HUD, commentary and scene dialogue boxes, notices, tutorial prompts and the
 * hangover overlay. docs/style-guide.md sections 4 and 5. Systems start this
 * scene when a chapter begins and stop it on quit to title.
 *
 * Keys handled here: Esc (pause), Tab (the casebook and kit screen), E and left click (advance
 * scene dialogue). The deduction board opens by itself when
 * `source.activeDeduction()` becomes non-null.
 */

import Phaser from 'phaser';
import type { ColourName } from '../../art/palette';
import { format, sequence, text } from '../../content/dialogue';
import { isAlienLine } from '../../content/dialogue/speakers';
import { GameEvents } from '../../core/types';
import type { BarReturnReason, DialogueId, DialogueLine, SpeakerId, TextId, Vec2 } from '../../core/types';
import type { EffectId } from '../../audio';
import { bindFullscreenHotkey } from '../fullscreen';
import type { Label, Pic } from '../gfx';
import {
  PORTRAIT_FALLBACK,
  makeLabel,
  makePortrait,
  portraitFrame,
  rect,
  setLabelColour,
  setLabelText,
  speakerColour,
} from '../gfx';
import { BOSS_BAR, DIALOGUE_BOX, DIALOGUE_TEXT, NOTICE_MS, PORTRAIT, SCREEN } from '../layout';
import { HudStrip } from '../hud/strip';
import { KEY_IDS, keyText } from '../keycaps';
import { PromptStack } from '../hud/prompts';
import { ReturnDirector } from '../returns/director';
import { ThrowPreview } from '../returns/throwPreview';
import { FlatColour } from '../returns/flat';
import { uiTuning } from '../uiTuning';
import { worldCamera } from '../worldCamera';
import { DialogueQueue } from '../model/dialogue';
import type { DialogueView } from '../model/dialogue';
import type { PromptValues } from '../model/promptText';
import { buildHudModel } from '../model/hud';
import type { HudModel } from '../model/hud';
import { wrapText } from '../model/wrap';
import { bindPromptHost } from '../prompts';
import { PROMPT_EVENTS, UiSceneKeys } from '../shared';
import type { UiShared } from '../shared';

const D = { overlay: 0, hud: 10, notice: 20, box: 30, caption: 40, ret: 60 } as const;
const NOTICE_WIDTH_CHARS = 70;

interface Notice {
  readonly bg: Phaser.GameObjects.Rectangle;
  readonly label: Label;
  hideAt: number;
}

export interface PromptRequest {
  readonly textId: TextId;
  /** Fills `{key}` and the like in the prompt text. */
  readonly values?: PromptValues;
}

/** How long the key prompt stays up after a carried-over lesson (as chapter 2 shows it). */
const FALLBACK_PROMPT_MS = 7000;

export class HudScene extends Phaser.Scene {
  private queue!: DialogueQueue;
  private unsubs: Array<() => void> = [];

  private strip!: HudStrip;
  private flat!: FlatColour;
  private throwPreview!: ThrowPreview;
  private returns!: ReturnDirector;
  /** 'live': the world is frozen but running (no pause); 'covered': black or later, the game is paused. */
  private returnPhase: 'none' | 'live' | 'covered' = 'none';
  private lastRefusalSeq = -1;
  private refusalNotice!: Notice;
  private spiritPromptShown = false;
  private bossBacking!: Phaser.GameObjects.Rectangle;
  private bossName!: Label;
  private bossBack!: Phaser.GameObjects.Rectangle;
  private bossFill!: Phaser.GameObjects.Rectangle;

  // Dialogue box
  private boxBg: Phaser.GameObjects.Rectangle[] = [];
  private portrait!: Pic;
  private nameLabel!: Label;
  private directionLabel!: Label;
  private lineLabels: Label[] = [];
  private advanceLabel!: Label;
  private captionBg!: Phaser.GameObjects.Rectangle;
  /** Full-screen black while Myko's call-in blackout caption plays. */
  private blackout!: Phaser.GameObjects.Rectangle;
  private blackoutId: DialogueId | null = null;
  private captionLabels: Label[] = [];

  // Notices
  private saved!: Notice;
  private ability!: Notice;
  private pickup!: Notice;
  private prompts!: PromptStack;

  constructor(private readonly shared: UiShared) {
    super(UiSceneKeys.Hud);
  }

  create(): void {
    this.boardPromptShown = false;
    // The scene object is reused when a chapter restarts (after a death); drop the previous run's objects.
    this.boxBg = [];
    this.lineLabels = [];
    this.captionLabels = [];
    const { source } = this.shared;
    bindFullscreenHotkey(this.game);
    bindPromptHost(this.game);
    this.queue = new DialogueQueue({
      lookup: (id) => sequence(id),
      speakerName: (line) => this.speakerName(line),
      onFinished: (id) => {
        if (id === this.blackoutId) {
          this.blackoutId = null;
          this.blackout.setVisible(false);
        }
        source.dialogueFinished(id);
      },
      onChar: (line) => this.shared.hooks.play?.(blipFor(line)),
      onError: (id, error) => console.error(`Dialogue ${id} failed`, error),
    });

    this.prompts = new PromptStack(this, D.notice);
    this.strip = new HudStrip(this, D.hud, (e) => this.shared.hooks.play?.(e));
    this.flat = new FlatColour(this.game);
    this.throwPreview = new ThrowPreview(this, D.hud - 2);
    this.returnPhase = 'none';
    this.returns = new ReturnDirector(
      this,
      this.flat,
      D.ret,
      () => {
        this.returnPhase = 'none';
        this.shared.overlays.hide('return');
      },
      () => this.onReturnBlack(),
    );
    this.buildBoss();
    this.buildDialogueBox();
    this.buildNotices();
    this.bindEvents();
    this.bindInput();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
  }

  // ---------------------------------------------------------------- building

  private buildBoss(): void {
    this.bossBacking = rect(this, BOSS_BAR.x, BOSS_BAR.y, BOSS_BAR.width, BOSS_BAR.height, 'ink', D.hud - 1);
    this.bossName = makeLabel(this, SCREEN.width / 2, 3, '', 'white', { anchor: 'centre', depth: D.hud });
    this.bossBack = rect(this, 139, 13, 202, 8, 'ink', D.hud);
    this.bossFill = rect(this, 140, 14, 0, 6, 'alarm', D.hud + 1);
  }

  private buildDialogueBox(): void {
    const b = DIALOGUE_BOX;
    this.boxBg = [rect(this, b.x, b.y, b.width, b.height, 'ink', D.box), rect(this, b.x, b.y, b.width, 1, 'slate', D.box + 1)];
    this.portrait = makePortrait(this, PORTRAIT.x, PORTRAIT.y, D.box + 1);
    this.nameLabel = makeLabel(this, DIALOGUE_TEXT.x, DIALOGUE_TEXT.y, '', 'fog', { depth: D.box + 1 });
    this.directionLabel = makeLabel(this, DIALOGUE_TEXT.x, DIALOGUE_TEXT.y, '', 'fog', { depth: D.box + 1 });
    for (let i = 0; i < DIALOGUE_TEXT.maxLines; i++) {
      this.lineLabels.push(makeLabel(this, DIALOGUE_TEXT.x, DIALOGUE_TEXT.y + (i + 1) * DIALOGUE_TEXT.rowHeight, '', 'white', { depth: D.box + 1 }));
    }
    this.advanceLabel = makeLabel(this, SCREEN.width - 4, DIALOGUE_BOX.y + 2, text('ui.prompt.advance'), 'steel', { anchor: 'right', depth: D.box + 1 });
    this.blackoutId = null;
    this.blackout = rect(this, 0, 0, SCREEN.width, SCREEN.height, 'ink', D.caption - 0.5).setVisible(false);
    this.captionBg = rect(this, 0, 96, SCREEN.width, 78, 'ink', D.caption);
    for (let i = 0; i < DIALOGUE_TEXT.maxLines; i++) {
      this.captionLabels.push(makeLabel(this, SCREEN.width / 2, 110 + i * 18, '', 'bone', { anchor: 'centre', depth: D.caption + 1 }));
    }
    this.showBox('none');
  }

  private makeNotice(y: number, colour: ColourName): Notice {
    const bg = rect(this, 0, y, SCREEN.width, 11, 'ink', D.notice).setVisible(false);
    const label = makeLabel(this, SCREEN.width / 2, y + 1, '', colour, { anchor: 'centre', depth: D.notice + 1 }).setVisible(false);
    return { bg, label, hideAt: 0 };
  }

  private buildNotices(): void {
    this.saved = {
      bg: rect(this, SCREEN.width - 60, 0, 60, 14, 'ink', D.notice).setVisible(false),
      label: makeLabel(this, SCREEN.width - 4, 3, text('ui.saved'), 'bone', { anchor: 'right', depth: D.notice + 1 }).setVisible(false),
      hideAt: 0,
    };
    this.ability = this.makeNotice(30, 'amberLight');
    this.pickup = this.makeNotice(DIALOGUE_BOX.y - 13, 'white');
    this.refusalNotice = this.makeNotice(DIALOGUE_BOX.y - 25, 'amberLight');
  }

  // ------------------------------------------------------------------ events

  private bindEvents(): void {
    const { bus } = this.shared.source;
    this.unsubs.push(
      bus.on(GameEvents.DialogueShow, ({ sequenceId }) => this.queue.enqueue(sequenceId)),
      bus.on(GameEvents.MykoBlackout, ({ sequenceId }) => {
        this.blackoutId = sequenceId;
        this.blackout.setVisible(true);
        this.queue.enqueue(sequenceId);
      }),
      bus.on(GameEvents.SaveWritten, () => this.flash(this.saved, NOTICE_MS.saved)),
      bus.on(GameEvents.MoveLearned, ({ moveId }) => {
        this.setNotice(this.ability, format('ability.unlocked', { name: text(`ability.${moveId}.name`) }), NOTICE_MS.ability);
      }),
      bus.on(GameEvents.MoveTaughtByFallback, ({ moveId, slot }) => {
        // A lesson carried over by a call: only the Stumble has a key prompt, and only if it landed in a slot.
        if (slot === null || moveId !== 'stumble') return;
        this.prompts.show('ui.prompt.stumble');
        this.time.delayedCall(FALLBACK_PROMPT_MS, () => this.prompts.hide('ui.prompt.stumble'));
      }),
      bus.on(GameEvents.WeaponGained, ({ weaponId }) => {
        this.setNotice(this.ability, format('ability.unlocked', { name: text(`weapon.${weaponId}.name`) }), NOTICE_MS.ability);
      }),
      bus.on(GameEvents.PickupCollected, ({ item }) => {
        const msg =
          item.kind === 'drink'
            ? text(`drink.${item.drinkId}.pickup`)
            : item.kind === 'food'
              ? text(`food.${item.foodId}.pickup`)
              : format('pickup.empties', { n: item.count });
        this.setNotice(this.pickup, msg, NOTICE_MS.pickup);
        // The first spirit he picks up: say which key drinks it.
        if (item.kind === 'drink' && (item.drinkId === 'whiskey' || item.drinkId === 'tequila') && !this.spiritPromptShown) {
          this.spiritPromptShown = true;
          this.prompts.show('ui.prompt.spirit', { key: keyText(KEY_IDS.spirit) });
          this.time.delayedCall(FALLBACK_PROMPT_MS, () => this.prompts.hide('ui.prompt.spirit'));
        }
      }),
      // The "not yet" refusal before the first pint explains what to do, so it stays up longer than a plain refusal.
      bus.on(GameEvents.KitUseRefused, ({ textId, reason }) =>
        this.setNotice(this.refusalNotice, text(textId), reason === 'meterHidden' ? uiTuning().notYetMs : uiTuning().refusalMs),
      ),
      // A clue went in the casebook. The first one stays up until Tab opens; later ones are a short flash.
      // Prompts stack above the dialogue box, so neither covers a line being said.
      bus.on(GameEvents.EvidenceFound, ({ first }) => {
        if (first) this.prompts.show('ui.casebook.first');
        else {
          this.prompts.show('ui.casebook.noted');
          this.time.delayedCall(NOTICE_MS.pickup, () => this.prompts.hide('ui.casebook.noted'));
        }
      }),
      bus.on(GameEvents.PickupRefused, ({ reason, max }) => this.setNotice(this.pickup, format(`pickup.refused.${reason}`, { max: String(max) }), NOTICE_MS.pickup)),
      bus.on(GameEvents.BarReturning, ({ reason, andrew }) => this.startReturn(reason, andrew)),
      bus.on(GameEvents.BarReturned, ({ reason }) => this.onReturned(reason)),
    );
    const onShow = (req: PromptRequest): void => this.prompts.show(req.textId, req.values);
    const onHide = (textId?: TextId): void => this.prompts.hide(textId);
    this.game.events.on(PROMPT_EVENTS.show, onShow);
    this.game.events.on(PROMPT_EVENTS.hide, onHide);
    const onHotDrink = (): void => this.openHotDrink();
    this.game.events.on(PROMPT_EVENTS.hotDrink, onHotDrink);
    this.unsubs.push(
      () => this.game.events.off(PROMPT_EVENTS.hotDrink, onHotDrink),
      () => this.game.events.off(PROMPT_EVENTS.show, onShow),
      () => this.game.events.off(PROMPT_EVENTS.hide, onHide),
    );
  }

  /**
   * `bar:returning`: the fade (sober) or the smoke (floor) over the frozen world. The game must not be paused
   * yet (Myko's walk, the fall and the run's failsafe all run on it), so the input blocks check `returnPhase`.
   */
  private startReturn(reason: BarReturnReason, andrew: Vec2): void {
    if (this.returnPhase !== 'none') return;
    this.returnPhase = 'live';
    this.returns.start(reason, this.onScreen(andrew));
  }

  /** The cover is black: pause the game, then let the run move Andrew to the bar. Called once per return. */
  private onReturnBlack(): void {
    this.returnPhase = 'covered';
    this.shared.overlays.show('return');
    this.shared.source.completeBarReturn();
  }

  /** `bar:returned`: normally our own `completeBarReturn`; otherwise the failsafe (or no sequence at all) got there first. */
  private onReturned(reason: BarReturnReason): void {
    if (this.returnPhase === 'covered') return;
    this.returnPhase = 'covered';
    this.shared.overlays.show('return');
    this.returns.jumpToBlack(reason);
  }

  /** Andrew's world position on this screen, clamped inside it; the middle if the world camera is not reachable. */
  private onScreen(world: Vec2): { x: number; y: number } {
    const cam = worldCamera(this.game, false);
    if (cam === null) return { x: SCREEN.width / 2, y: SCREEN.height / 2 };
    const x = (world.x - cam.worldView.x) * cam.zoom;
    const y = (world.y - cam.worldView.y) * cam.zoom;
    return { x: Math.max(0, Math.min(SCREEN.width, x)), y: Math.max(0, Math.min(SCREEN.height, y)) };
  }

  /** The 'back to the board' prompt is up. */
  private boardPromptShown = false;

  private returnLive(): boolean {
    return this.returnPhase === 'live';
  }

  private bindInput(): void {
    const kb = this.input.keyboard;
    if (kb !== null) {
      const onEsc = (e: KeyboardEvent): void => {
        if (e.repeat || this.returnLive() || this.shared.overlays.isOpen('return') || this.scene.isActive(UiSceneKeys.Settings) || this.scene.isActive(UiSceneKeys.Deduction) || this.scene.isActive(UiSceneKeys.Redaction) || this.scene.isActive(UiSceneKeys.Tells) || this.scene.isActive(UiSceneKeys.HotDrink)) return;
        if (this.shared.overlays.isOpen('tab')) this.closeTab();
        else if (this.shared.overlays.isOpen('pause')) this.closePause();
        else this.openPause();
      };
      const onTab = (e: KeyboardEvent): void => {
        e.preventDefault();
        if (e.repeat || this.returnLive() || this.shared.overlays.isOpen('pause') || this.shared.overlays.isOpen('hotdrink') || this.shared.overlays.isOpen('return') || this.scene.isActive(UiSceneKeys.Deduction) || this.scene.isActive(UiSceneKeys.Redaction) || this.scene.isActive(UiSceneKeys.Tells)) return;
        if (this.shared.overlays.isOpen('tab')) {
          if (this.shared.source.tabMode() === 'toggle') this.closeTab();
        } else if (!this.queue.blocking) this.openTab();
      };
      // Held mode: the screen is open only while Tab is down.
      const onTabUp = (): void => {
        if (this.shared.source.tabMode() === 'hold' && this.shared.overlays.isOpen('tab')) this.closeTab();
      };
      const onE = (): void => {
        if (!this.returnLive()) this.queue.advance();
      };
      kb.on('keydown-ESC', onEsc);
      kb.on('keydown-TAB', onTab);
      kb.on('keyup-TAB', onTabUp);
      kb.on('keydown-E', onE);
      // B: back to a deduction board he stepped away from.
      const onB = (e: KeyboardEvent): void => {
        if (e.repeat || this.returnLive() || this.queue.blocking || this.shared.overlays.any || this.scene.isActive(UiSceneKeys.Deduction) || this.scene.isActive(UiSceneKeys.Redaction) || this.scene.isActive(UiSceneKeys.Tells)) return;
        this.shared.source.reopenDeduction();
      };
      kb.on('keydown-B', onB);
      this.unsubs.push(() => kb.off('keydown-B', onB));
      kb.addCapture('TAB');
      this.unsubs.push(
        () => kb.off('keydown-ESC', onEsc),
        () => kb.off('keydown-TAB', onTab),
        () => kb.off('keyup-TAB', onTabUp),
        () => kb.off('keydown-E', onE),
        () => kb.removeCapture('TAB'),
      );
    }
    const onClick = (p: Phaser.Input.Pointer): void => {
      if (p.leftButtonDown() && !this.returnLive()) this.queue.advance();
    };
    this.input.on('pointerdown', onClick);
    this.unsubs.push(() => this.input.off('pointerdown', onClick));
  }

  openPause(): void {
    if (this.queue.blocking) return;
    this.shared.overlays.show('pause');
    this.scene.launch(UiSceneKeys.Pause);
    this.scene.bringToTop(UiSceneKeys.Pause);
  }

  closePause(): void {
    this.shared.overlays.hide('pause');
    this.scene.stop(UiSceneKeys.Settings);
    this.scene.stop(UiSceneKeys.Pause);
  }

  /** The coffee-or-tea choice, once per visit to the bar. */
  openHotDrink(): void {
    if (this.returnLive() || this.queue.blocking || this.scene.isActive(UiSceneKeys.HotDrink) || this.shared.overlays.any || !this.shared.source.hotDrinkOffered()) return;
    this.shared.overlays.show('hotdrink');
    this.scene.launch(UiSceneKeys.HotDrink);
    this.scene.bringToTop(UiSceneKeys.HotDrink);
  }

  openTab(): void {
    this.game.events.emit(PROMPT_EVENTS.tabOpened);
    this.prompts.hide('ui.casebook.first');
    this.shared.overlays.show('tab');
    this.scene.launch(UiSceneKeys.Tab);
    this.scene.bringToTop(UiSceneKeys.Tab);
    this.shared.hooks.play?.('uiSelect');
  }

  closeTab(): void {
    this.shared.overlays.hide('tab');
    this.scene.stop(UiSceneKeys.Tab);
    this.shared.hooks.play?.('uiMove');
  }

  private teardown(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
    for (const key of [UiSceneKeys.Pause, UiSceneKeys.Settings, UiSceneKeys.Tab, UiSceneKeys.Deduction, UiSceneKeys.Redaction, UiSceneKeys.Tells, UiSceneKeys.HotDrink]) this.scene.stop(key);
    this.shared.overlays.hide('pause');
    this.shared.overlays.hide('tab');
    this.shared.overlays.hide('hotdrink');
    this.shared.overlays.hide('redaction');
    this.shared.overlays.hide('tells');
    this.shared.overlays.hide('return');
    this.returns.cancel();
    this.returnPhase = 'none';
    this.flat.clear();
    this.throwPreview.destroy();
    this.prompts.destroy();
  }

  // ----------------------------------------------------------------- notices

  private flash(n: Notice, ms: number): void {
    n.hideAt = this.time.now + ms;
    n.bg.setVisible(true);
    n.label.setVisible(true);
  }

  private setNotice(n: Notice, message: string, ms: number): void {
    const lines = wrapText(message, NOTICE_WIDTH_CHARS);
    setLabelText(n.label, lines.join('\n'));
    const h = lines.length * DIALOGUE_TEXT.rowHeight + 2;
    const fromBottom = n === this.pickup ? DIALOGUE_BOX.y - 2 : n === this.refusalNotice ? DIALOGUE_BOX.y - 14 : null;
    const top = fromBottom === null ? n.bg.y : fromBottom - h;
    n.bg.setPosition(0, top).setSize(SCREEN.width, h).setVisible(true);
    n.label.setPosition(SCREEN.width / 2, top + 1).setVisible(true);
    n.hideAt = this.time.now + ms;
  }

  // ------------------------------------------------------------------- frame

  update(_time: number, delta: number): void {
    const { source } = this.shared;
    const m = buildHudModel(source);
    this.strip.update(m, this.time.now);
    this.returns.update(delta);
    this.throwPreview.update(source.throwPreview());
    if (!this.returns.active) this.flat.set(m.buzz.flatness);
    this.drawBoss(m);
    this.showRefusal(m);

    if (!this.shared.overlays.isOpen('pause') && !this.shared.overlays.isOpen('tab') && !this.shared.overlays.isOpen('return') && !this.returnLive()) this.queue.update(delta);
    this.drawDialogue(this.queue.view());

    const now = this.time.now;
    for (const n of [this.saved, this.ability, this.pickup, this.refusalNotice]) {
      if (n.hideAt !== 0 && now >= n.hideAt) {
        n.hideAt = 0;
        n.bg.setVisible(false);
        n.label.setVisible(false);
      }
    }

    const boardWaiting = source.pendingDeduction();
    if (boardWaiting !== this.boardPromptShown) {
      this.boardPromptShown = boardWaiting;
      if (boardWaiting) this.prompts.show('ui.deduction.reopen', { key: keyText('ui.key.b') });
      else this.prompts.hide('ui.deduction.reopen');
    }
    if (source.activeDeduction() !== null && !this.scene.isActive(UiSceneKeys.Deduction)) {
      this.scene.launch(UiSceneKeys.Deduction);
      this.scene.bringToTop(UiSceneKeys.Deduction);
    }
    if (source.activeRedaction() !== null && !this.scene.isActive(UiSceneKeys.Redaction) || this.scene.isActive(UiSceneKeys.Tells)) {
      this.scene.launch(UiSceneKeys.Redaction);
      this.scene.bringToTop(UiSceneKeys.Redaction);
    }
    if (source.activeTells() !== null && !this.scene.isActive(UiSceneKeys.Tells)) {
      this.scene.launch(UiSceneKeys.Tells);
      this.scene.bringToTop(UiSceneKeys.Tells);
    }
  }

  /** A refused move shows its line briefly; each refusal has a new `seq`. */
  private showRefusal(m: HudModel): void {
    const r = m.refusal;
    if (r === null || r.seq === this.lastRefusalSeq) return;
    this.lastRefusalSeq = r.seq;
    this.setNotice(this.refusalNotice, text(r.textId), uiTuning().refusalMs);
  }

  private drawBoss(m: HudModel): void {
    const b = m.boss;
    this.bossName.setVisible(b !== null);
    this.bossBacking.setVisible(b !== null);
    this.bossBack.setVisible(b !== null);
    this.bossFill.setVisible(b !== null);
    if (b === null) return;
    setLabelText(this.bossName, text(b.nameTextId));
    this.bossFill.setSize(Math.round(200 * b.fraction), 6);
  }

  // ---------------------------------------------------------------- dialogue

  private speakerName(line: DialogueLine): string | null {
    if (line.speaker === 'narrator') return null;
    if (line.speaker === 'npc') return line.speakerName === undefined ? null : text(line.speakerName);
    return text(`speaker.${line.speaker}`);
  }

  private showBox(mode: 'none' | 'box' | 'caption'): void {
    const box = mode === 'box';
    for (const r of this.boxBg) r.setVisible(box);
    this.nameLabel.setVisible(box);
    this.directionLabel.setVisible(box);
    for (const l of this.lineLabels) l.setVisible(box);
    if (!box) {
      this.portrait.setVisible(false);
      this.advanceLabel.setVisible(false);
    }
    this.captionBg.setVisible(mode === 'caption');
    for (const l of this.captionLabels) l.setVisible(mode === 'caption');
  }

  private drawDialogue(v: DialogueView | null): void {
    if (v === null) {
      this.showBox('none');
      return;
    }
    if (v.delivery === 'caption') {
      this.showBox('caption');
      this.captionLabels.forEach((l, i) => setLabelText(l, (v.shown[i] ?? '').toUpperCase()));
      return;
    }
    this.showBox('box');
    const speaker: SpeakerId = v.speaker;
    this.portrait.set(portraitFrame(speaker), PORTRAIT_FALLBACK[speaker]);
    const name = v.name ?? '';
    setLabelText(this.nameLabel, name);
    setLabelColour(this.nameLabel, speakerColour(speaker));
    setLabelText(this.directionLabel, v.direction === null ? '' : `(${v.direction})`);
    this.directionLabel.setX(DIALOGUE_TEXT.x + (name.length + 1) * 6);
    this.lineLabels.forEach((l, i) => setLabelText(l, v.shown[i] ?? ''));
    this.advanceLabel.setVisible(v.awaitingAdvance && Math.floor(this.time.now / 400) % 2 === 0);
  }
}

/** Effect ID for a speaker's dialogue blip. docs/style-guide.md section 7. */
export function blipFor(line: DialogueLine): EffectId {
  if (isAlienLine(line)) return 'blipAlien';
  if (line.speaker === 'andrew') return 'blipAndrew';
  if (line.speaker === 'myko') return 'blipMyko';
  return 'blipOther';
}
