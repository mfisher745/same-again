/**
 * Which sheets (by position, 0 to 4) black out each of the sentence's words, by word index. The right three are
 * the first, third and fourth: no word is hidden on all three, but every other three share a hidden word.
 */
export const REDACTED_ON: readonly (readonly number[])[] = [
  [0, 1, 2, 4],
  [0, 1, 3, 4],
  [1, 2, 3, 4],
  [0, 1],
  [2, 4],
  [3, 1],
  [0, 4],
  [2],
  [3, 4],
  [0, 2],
  [1, 4],
  [2, 3],
];
/** The two with the coffee rings (the second and the fifth). */
export const RINGED_SHEETS: readonly number[] = [1, 4];


/** The sheets picked at the lightbox: up to `limit` ids, in the order they were picked. Plain TypeScript. */
export class SheetPicks {
  private chosen: string[] = [];

  constructor(
    private readonly candidates: readonly string[],
    readonly limit = 3,
  ) {}

  /** Adds an unpicked candidate (up to the limit) or removes a picked one. Returns whether anything changed. */
  toggle(id: string): boolean {
    if (!this.candidates.includes(id)) return false;
    const at = this.chosen.indexOf(id);
    if (at >= 0) {
      this.chosen.splice(at, 1);
      return true;
    }
    if (this.chosen.length >= this.limit) return false;
    this.chosen.push(id);
    return true;
  }

  /** 1-based position of a picked sheet, or 0 when not picked. */
  order(id: string): number {
    return this.chosen.indexOf(id) + 1;
  }

  picks(): readonly string[] {
    return [...this.chosen];
  }

  get complete(): boolean {
    return this.chosen.length === this.limit;
  }

  clear(): void {
    this.chosen = [];
  }
}
