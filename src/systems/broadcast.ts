/**
 * Chapter 10 broadcast console (`c10.puzzle.broadcast`). Five proofs, five channels. Each proof has a plug shape and each
 * channel a socket of the same shape, so it is a short matching puzzle with one trick: two sockets share a `look` (they
 * are drawn the same) until Andrew examines them, and only then does the notch show. Then a large button.
 *
 * - The section completes when all five proofs are plugged in (`broadcast:changed` `ready`; the chapter plays
 *   `c10.broadcast.ready` from `onSectionCompleted`). `completeNow()` (the Myko call, the debug walk) plugs all five and
 *   completes it, and leaves the button.
 * - The button is a separate step: `press()` works once the five are in, emits `broadcast:changed` `pressed` and the run
 *   saves it in the chapter flags. The chapter plays the reaction after it.
 * - A proof can be plugged only if it is in the casebook (`BroadcastHost.hasProof`). A wrong socket plays
 *   `layout.wrongTextId` (the chapter's `c10.broadcast.wrong`) and costs nothing.
 *
 * The UI scene (or the chapter, with E) calls `plug`, `unplug`, `examine`, `press`; `views()` is what to draw.
 * Plain TypeScript.
 */

import { GameEvents, PROOFS } from '../core/types';
import type { GameEventBus, ProofId, PuzzleDef, Reward, TextId } from '../core/types';
import { PuzzleBase } from './investigation';
import type { SectionHost } from './sections';

export interface BroadcastSocket {
  readonly id: string;
  /** E on this examines the socket (shows its notch). */
  readonly examinableId: string;
  /** The shape of plug that goes in. Unique among the five. */
  readonly shape: string;
  /** What it looks like before it is examined. Two sockets share one, and their shapes differ. */
  readonly look: string;
}

export interface BroadcastPlug {
  readonly proofId: ProofId;
  /** One of the sockets' `shape`s. */
  readonly shape: string;
}

export interface BroadcastLayout {
  /** Exactly five. */
  readonly sockets: readonly BroadcastSocket[];
  /** Exactly five, one per proof. */
  readonly plugs: readonly BroadcastPlug[];
  /** E on this presses the button once the five are in. */
  readonly buttonExaminableId: string;
  /** Played when a plug does not fit (`c10.broadcast.wrong`). */
  readonly wrongTextId: TextId;
}

export interface BroadcastHost {
  hasProof(id: ProofId): boolean;
}

export type PlugRefusal = 'noProof' | 'wrongShape' | 'occupied' | 'unknown' | 'alreadyPlugged' | 'solved';

export interface PlugTry {
  readonly ok: boolean;
  readonly refusal?: PlugRefusal;
  /** The line to play for a plug that does not fit. */
  readonly textId?: TextId;
}

export interface BroadcastSocketView {
  readonly id: string;
  readonly examinableId: string;
  /** The shape to draw: the real one once examined or plugged (or if no other socket looks like it), else the `look`. */
  readonly shown: string;
  readonly examined: boolean;
  /** Looks like another socket until examined. */
  readonly ambiguous: boolean;
  readonly plugged: ProofId | null;
}

export interface BroadcastView {
  readonly sockets: readonly BroadcastSocketView[];
  readonly plugs: readonly { readonly proofId: ProofId; readonly shape: string; readonly owned: boolean; readonly placed: boolean }[];
  /** All five are in. */
  readonly ready: boolean;
  readonly pressed: boolean;
}

/** Problems with a layout, empty when it is sound: five sockets, five plugs, one plug per proof, shapes matching one to one, exactly two look-alike sockets. */
export function validateBroadcast(layout: BroadcastLayout): string[] {
  const out: string[] = [];
  if (layout.sockets.length !== 5) out.push('needs five sockets');
  if (layout.plugs.length !== 5) out.push('needs five plugs');
  for (const p of PROOFS) if (layout.plugs.filter((x) => x.proofId === p).length !== 1) out.push(`needs exactly one plug for ${p}`);
  const shapes = layout.sockets.map((s) => s.shape);
  if (new Set(shapes).size !== shapes.length) out.push('socket shapes must be unique');
  for (const p of layout.plugs) if (!shapes.includes(p.shape)) out.push(`plug ${p.proofId} fits no socket`);
  if (new Set(layout.plugs.map((p) => p.shape)).size !== layout.plugs.length) out.push('plug shapes must be unique');
  const looks = new Map<string, number>();
  for (const s of layout.sockets) looks.set(s.look, (looks.get(s.look) ?? 0) + 1);
  const twins = [...looks.values()].filter((n) => n > 1);
  if (twins.length !== 1 || twins[0] !== 2) out.push('exactly two sockets must share a look');
  return out;
}

export class BroadcastPuzzle extends PuzzleBase {
  private plugged = new Map<string, ProofId>();
  private examined = new Set<string>();
  private pressedFlag = false;
  /** Called when the plugged set changes, with `socketId:proofId` pairs (the run saves it). */
  onChanged: ((pairs: readonly string[]) => void) | null = null;

  constructor(
    def: PuzzleDef,
    readonly layout: BroadcastLayout,
    private readonly broadcastHost: BroadcastHost,
    host: SectionHost,
    private readonly events: GameEventBus,
    reward?: Reward,
  ) {
    super(def, host, events, reward);
  }

  // -- Reading ---------------------------------------------------------------

  socketForExaminable(examinableId: string): BroadcastSocket | undefined {
    return this.layout.sockets.find((s) => s.examinableId === examinableId);
  }

  isButton(examinableId: string): boolean {
    return this.layout.buttonExaminableId === examinableId;
  }

  pluggedIn(socketId: string): ProofId | null {
    return this.plugged.get(socketId) ?? null;
  }

  pluggedCount(): number {
    return this.plugged.size;
  }

  /** All five are in. */
  get ready(): boolean {
    return this.plugged.size === this.layout.sockets.length;
  }

  get pressed(): boolean {
    return this.pressedFlag;
  }

  /** `socketId:proofId` for every plug in, for saving. */
  pairs(): string[] {
    return [...this.plugged].map(([s, p]) => `${s}:${p}`);
  }

  private ambiguous(s: BroadcastSocket): boolean {
    return this.layout.sockets.some((o) => o !== s && o.look === s.look);
  }

  views(): BroadcastView {
    return {
      sockets: this.layout.sockets.map((s) => {
        const ambiguous = this.ambiguous(s);
        const revealed = this.examined.has(s.id) || this.plugged.has(s.id) || !ambiguous;
        return { id: s.id, examinableId: s.examinableId, shown: revealed ? s.shape : s.look, examined: this.examined.has(s.id), ambiguous, plugged: this.plugged.get(s.id) ?? null };
      }),
      plugs: this.layout.plugs.map((p) => ({ proofId: p.proofId, shape: p.shape, owned: this.broadcastHost.hasProof(p.proofId), placed: [...this.plugged.values()].includes(p.proofId) })),
      ready: this.ready,
      pressed: this.pressedFlag,
    };
  }

  // -- Andrew works it -------------------------------------------------------

  /** Looks closely at a socket: its notch shows. */
  examine(socketId: string): boolean {
    const s = this.layout.sockets.find((x) => x.id === socketId);
    if (!s || this.examined.has(socketId)) return false;
    this.start();
    this.examined.add(socketId);
    this.events.emit(GameEvents.BroadcastChanged, { puzzleId: this.def.id, phase: 'examined', channelId: socketId });
    return true;
  }

  /** Plugs a proof into a channel. */
  plug(proofId: ProofId, socketId: string): PlugTry {
    if (this.isComplete()) return { ok: false, refusal: 'solved' };
    const socket = this.layout.sockets.find((x) => x.id === socketId);
    const plug = this.layout.plugs.find((x) => x.proofId === proofId);
    if (!socket || !plug) return { ok: false, refusal: 'unknown' };
    if (!this.broadcastHost.hasProof(proofId)) return { ok: false, refusal: 'noProof' };
    if (this.plugged.has(socketId)) return { ok: false, refusal: 'occupied' };
    if ([...this.plugged.values()].includes(proofId)) return { ok: false, refusal: 'alreadyPlugged' };
    this.start();
    if (plug.shape !== socket.shape) {
      this.events.emit(GameEvents.BroadcastChanged, { puzzleId: this.def.id, phase: 'wrong', channelId: socketId, proofId });
      return { ok: false, refusal: 'wrongShape', textId: this.layout.wrongTextId };
    }
    this.plugged.set(socketId, proofId);
    this.events.emit(GameEvents.BroadcastChanged, { puzzleId: this.def.id, phase: 'plugged', channelId: socketId, proofId });
    this.onChanged?.(this.pairs());
    if (this.ready) {
      this.events.emit(GameEvents.BroadcastChanged, { puzzleId: this.def.id, phase: 'ready' });
      this.solved();
    }
    return { ok: true };
  }

  /** Takes a plug out (before the five are in). */
  unplug(socketId: string): boolean {
    if (this.isComplete() || !this.plugged.has(socketId)) return false;
    this.plugged.delete(socketId);
    this.onChanged?.(this.pairs());
    return true;
  }

  /** Andrew presses the button. Works once, once all five are in. */
  press(): boolean {
    if (!this.ready || this.pressedFlag) return false;
    this.pressedFlag = true;
    this.events.emit(GameEvents.BroadcastChanged, { puzzleId: this.def.id, phase: 'pressed' });
    return true;
  }

  /** Restores a saved state without events: `pairs` as from `pairs()`, and whether the button was pressed. */
  restore(pairs: readonly string[], pressed: boolean): void {
    this.plugged.clear();
    for (const pair of pairs) {
      const [socketId, proofId] = pair.split(':');
      if (socketId && proofId && this.layout.sockets.some((s) => s.id === socketId) && (PROOFS as readonly string[]).includes(proofId)) this.plugged.set(socketId, proofId as ProofId);
    }
    this.pressedFlag = pressed;
  }

  protected applySolution(): void {
    for (const p of this.layout.plugs) {
      const socket = this.layout.sockets.find((s) => s.shape === p.shape);
      if (socket) this.plugged.set(socket.id, p.proofId);
    }
    this.onChanged?.(this.pairs());
  }
}
