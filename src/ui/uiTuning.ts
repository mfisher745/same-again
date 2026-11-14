/** The UI's numbers from `TUNING.ui` (optional in the type until the overhaul is the only mode). */

import { TUNING } from '../content/tuning';
import type { UiTuning } from '../core/types';

export function uiTuning(): UiTuning {
  const u = TUNING.ui;
  if (!u) throw new Error('TUNING.ui is missing');
  return u;
}
