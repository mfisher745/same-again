/**
 * Presentation constants for the UI: pixel positions at the 480 x 270 internal
 * resolution and display timings. None of these are balance numbers (those are
 * in `src/content/tuning.ts`). docs/style-guide.md sections 4 and 5.
 */

export const SCREEN = { width: 480, height: 270 } as const;

/** Bottom HUD strip, 24 px: slots with their keys, the Buzz meter and state word, Myko's calls. */
export const HUD_STRIP = { y: 246, height: 24 } as const;

/** Commentary and scene dialogue box: 480 x 40 above the strip. */
export const DIALOGUE_BOX = { x: 0, y: 206, width: 480, height: 40 } as const;

/** Portrait at the left of the box. */
export const PORTRAIT = { x: 4, y: 210, size: 32 } as const;

/** Text column inside the box. Rows are 9 px: name, then up to 3 lines. */
export const DIALOGUE_TEXT = { x: 42, y: 208, rowHeight: 9, maxLines: 3, maxChars: 64 } as const;

/** Glyph cell, docs/style-guide.md section 5. */
export const CELL = { width: 6, height: 9 } as const;

/**
 * Bottom strip layout, x positions left to right. Each cell is 22 px tall at
 * `cellY`. Left: the drink Q uses, bottles (right click), weapon (R) and the spirit (G). Middle:
 * the Buzz meter, state word over it, in the free space between `buzz.left`
 * and `buzz.right`. Right: the four special slots (keys 1 to 4), then Myko's calls.
 */
export const STRIP = {
  cellY: HUD_STRIP.y + 1,
  cellHeight: 22,
  drink: { x: 4, width: 38 },
  bottles: { x: 44, width: 30 },
  weapon: { x: 76, width: 28 },
  spirit: { x: 106, width: 30 },
  buzz: { left: 140, right: 330 },
  special: { x: 334, width: 24, gap: 1 },
  calls: { x: 438, leafGap: 13 },
} as const;

/** The Buzz meter's length follows the chapter's floor: `pxPerPoint` per point, kept between `minWidth` and `maxWidth`. */
export const METER = { pxPerPoint: 1.5, minWidth: 80, maxWidth: 190, height: 5 } as const;

/** Where the boss bar sits at the top. */
export const BOSS_BAR = { x: 120, y: 0, width: 240, height: 24 } as const;

/** Presentation timings in milliseconds (or characters per second). */
export const DIALOGUE_TIMING = {
  charsPerSecond: 45,
  boxHoldBaseMs: 1400,
  boxHoldPerCharMs: 35,
  captionHoldBaseMs: 1100,
  captionHoldPerCharMs: 30,
} as const;

export const NOTICE_MS = { saved: 1600, pickup: 3200, ability: 3200 } as const;

/** How long a slot that just changed is highlighted. */
export const SLOT_FLASH_MS = 900;
