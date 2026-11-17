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
