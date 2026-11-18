/**
 * Tutorial prompts for chapter scripts, which have no handle on the Phaser
 * game. The HUD scene binds the game when it starts; scripts then call
 * `showPrompt` / `hidePrompt` with a `ui.prompt.*` text ID. Only one prompt is
 * on screen at a time: showing a new one replaces the old.
 */

import type Phaser from 'phaser';
import type { SpecialSlotIndex, TextId } from '../core/types';
import { KEY_IDS, keyText } from './keycaps';
import { PROMPT_EVENTS } from './shared';
import type { PromptValues } from './model/promptText';
import type { PromptRequest } from './scenes/HudScene';

let host: Phaser.Game | null = null;
/** The script prompt on screen. Scripts only ever clear this one, so HUD notices (the casebook line) are left alone. */
let current: TextId | null = null;

export function bindPromptHost(game: Phaser.Game): void {
  host = game;
  current = null;
}

/**
 * Shows a prompt until hidden, replacing any other. Returns a function that hides it.
 * `values` fills the text's placeholders, for example `showPrompt('ui.prompt.slot', { key: keyText('ui.key.2') })`.
 */
export function showPrompt(textId: TextId, values?: PromptValues): () => void {
  const req: PromptRequest = values === undefined ? { textId } : { textId, values };
  hidePrompt();
  current = textId;
  host?.events.emit(PROMPT_EVENTS.show, req);
  return () => hidePrompt(textId);
}

/** Hides the given script prompt, or the current one when no ID is given. Never touches HUD notices. */
export function hidePrompt(textId?: TextId): void {
  const id = textId ?? current;
  if (id === null) return;
  if (id === current) current = null;
  host?.events.emit(PROMPT_EVENTS.hide, id);
}

/**
 * Open the coffee-or-tea choice at the bar. Does nothing unless the bar is
 * offering one and Andrew carries none (`hotDrinkOffered`); the offer stays
 * open if he backs out, and comes back with the next visit.
 */
export function openHotDrinkChoice(): void {
  host?.events.emit(PROMPT_EVENTS.hotDrink);
}

/**
 * Open the chapter 10 broadcast console (five plugs, five sockets, the button). Does nothing unless the screen has a console
 * (`activeBroadcast()` is not null) or it is already open.
 */
export function openBroadcastConsole(): void {
  host?.events.emit(PROMPT_EVENTS.broadcast);
}

/** "2 to use it": the prompt for a special slot's key. */
export function showSlotPrompt(slot: SpecialSlotIndex): () => void {
  return showPrompt('ui.prompt.slot', { key: keyText(KEY_IDS.slot(slot)) });
}

/** Calls `fn` each time the Tab screen opens (the kit step of chapter 1's list). Returns a function that stops listening. */
export function onTabOpened(fn: () => void): () => void {
  const game = host;
  if (!game) return () => undefined;
  game.events.on(PROMPT_EVENTS.tabOpened, fn);
  return () => game.events.off(PROMPT_EVENTS.tabOpened, fn);
}
