/** What counts as a press beyond the pointer and Space. */
export interface PressOptions {
  /** Enter presses too (a button, unlike a native checkbox). */
  enter?: boolean;
  /**
   * A key that is released sooner than this (ms) is held until then, so a quick
   * tap on a key still shows a press.
   */
  keyHold?: number;
}

/**
 * Private. Tracks "held down" for a control's press squish: a primary pointer
 * press, or Space. Letting go is reported at once; the click that follows then
 * takes over the move from where the release left it.
 */
export class Press {
  held = false;
  #since = 0;
  #byKey = false;
  #timer = 0;

  constructor(
    private readonly host: { requestUpdate(): void },
    private readonly canPress: () => boolean,
    private readonly onChange: () => void,
    private readonly options: PressOptions = {},
  ) {}

  down = (e: PointerEvent | KeyboardEvent): void => {
    const isKey = e instanceof KeyboardEvent;
    if (
      isKey
        ? (e.key !== ' ' && !(this.options.enter && e.key === 'Enter')) ||
          e.repeat
        : e.button !== 0 || !e.isPrimary
    )
      return;
    if (!this.canPress()) return;
    this.#byKey = isKey;
    this.#since = performance.now();
    clearTimeout(this.#timer);
    this.#set(true);
  };

  up = (): void => {
    const wait = this.#byKey
      ? (this.options.keyHold ?? 0) - (performance.now() - this.#since)
      : 0;
    clearTimeout(this.#timer);
    if (this.held && wait > 0) this.#timer = window.setTimeout(this.up, wait);
    else this.#set(false);
  };

  /** Drops the press at once (disconnect, disabled). */
  clear(): void {
    clearTimeout(this.#timer);
    this.held = false;
  }

  #set(held: boolean): void {
    if (this.held === held) return;
    this.held = held;
    this.onChange();
    // Re-render so the rest style matches the pose the move ends on.
    this.host.requestUpdate();
  }
}
