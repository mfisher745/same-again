/**
 * Cursor for the broadcast console screen, so the keyboard and the mouse do the same thing. Three rows: the five sockets,
 * the five plugs, the big button. A plug is picked up from the plug row and set down on a socket. Plain TypeScript.
 */

export type ConsoleRow = 'sockets' | 'plugs' | 'button';
const ROWS: readonly ConsoleRow[] = ['sockets', 'plugs', 'button'];

export class ConsoleCursor {
  row: ConsoleRow = 'plugs';
  /** Index within the row (always 0 on the button row). */
  col = 0;
  /** The plug in hand (index into the plug list), or null. */
  held: number | null = null;

  constructor(private readonly count: number) {}

  /** Left or right within the row, wrapping. */
  step(dx: -1 | 1): void {
    if (this.row === 'button') return;
    this.col = (this.col + dx + this.count) % this.count;
  }

  /** Up or down between rows, wrapping. */
  rowStep(dy: -1 | 1): void {
    const i = ROWS.indexOf(this.row);
    this.row = ROWS[(i + dy + ROWS.length) % ROWS.length] ?? 'plugs';
    if (this.row === 'button') this.col = 0;
    else if (this.col >= this.count) this.col = this.count - 1;
  }

  at(row: ConsoleRow, col: number): void {
    this.row = row;
    this.col = row === 'button' ? 0 : Math.max(0, Math.min(this.count - 1, col));
  }

  /** Pick up a plug (or put it back if it is the one in hand); the cursor goes to the sockets. */
  pick(plug: number): void {
    this.held = this.held === plug ? null : plug;
    if (this.held !== null) this.row = 'sockets';
  }

  drop(): void {
    this.held = null;
  }
}
