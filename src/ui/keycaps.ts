/**
 * Text for the key caps on the HUD. Every label is a text ID in
 * `src/content/dialogue/` (the creative director owns that directory). If an ID
 * is missing, `keyText` returns the ID itself, so a gap shows up on screen as
 * an obvious `ui.key.q` rather than a wrong letter.
 */

import { hasText, text } from '../content/dialogue';
import type { SpecialSlotIndex, TextId } from '../core/types';

export const KEY_IDS = {
  drink: 'ui.key.q',
  spirit: 'ui.key.g',
  weapon: 'ui.key.r',
  call: 'ui.key.m',
  tab: 'ui.key.tab',
  slot: (n: SpecialSlotIndex): TextId => `ui.key.${n}`,
} as const;

export const keyText = (id: TextId): string => (hasText(id) ? text(id) : id);
