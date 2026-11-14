/**
 * A prompt that starts with a key ("R to change weapon", "Tab for the kit")
 * draws that key as a keycap. Plain TypeScript.
 */

import { format, text } from '../../content/dialogue';
import type { TextId } from '../../core/types';

export interface PromptParts {
  /** The leading key, or null when the prompt does not start with one. */
  readonly key: string | null;
  readonly rest: string;
}

export type PromptValues = Readonly<Record<string, string | number>>;

const KEY_FIRST = /^(Tab|Space|Shift|WASD|[A-Z0-9])\s+(\S.*)$/;

export function promptParts(textId: TextId, values?: PromptValues): PromptParts {
  const full = values === undefined ? text(textId) : format(textId, values);
  const m = KEY_FIRST.exec(full);
  return m === null ? { key: null, rest: full } : { key: m[1] ?? null, rest: m[2] ?? full };
}

/** Identity of a prompt on screen: the same text with the same values is the same prompt. */
export const promptKey = (textId: TextId, values?: PromptValues): string => (values === undefined ? textId : `${textId}|${JSON.stringify(values)}`);
