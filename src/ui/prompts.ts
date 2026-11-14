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

export function bindPromptHost(game: Phaser.Game): void {
  host = game;
}

/**
 * Shows a prompt until hidden, replacing any other. Returns a function that hides it.
 * `values` fills the text's placeholders, for example `showPrompt('ui.prompt.slot', { key: keyText('ui.key.2') })`.
 */
export function showPrompt(textId: TextId, values?: PromptValues): () => void {
  const req: PromptRequest = values === undefined ? { textId } : { textId, values };
  host?.events.emit(PROMPT_EVENTS.hide, undefined);
  host?.events.emit(PROMPT_EVENTS.show, req);
  return () => hidePrompt(textId);
}

export function hidePrompt(textId?: TextId): void {
  host?.events.emit(PROMPT_EVENTS.hide, textId);
}

/**
 * Open the coffee-or-tea choice at the bar. Does nothing unless the bar is
 * offering one and Andrew carries none (`hotDrinkOffered`); the offer stays
 * open if he backs out, and comes back with the next visit.
 */
export function openHotDrinkChoice(): void {
  host?.events.emit(PROMPT_EVENTS.hotDrink);
}

/** "2 to use it": the prompt for a special slot's key. */
export function showSlotPrompt(slot: SpecialSlotIndex): () => void {
  return showPrompt('ui.prompt.slot', { key: keyText(KEY_IDS.slot(slot)) });
}
