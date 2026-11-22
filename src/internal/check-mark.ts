import { css, html, svg, type TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { canPolishAnimate } from './choice-motion.js';
import {
  CHECK_OFF_TUNE,
  CHECK_ON_TUNE,
  checkLook,
  type CheckPose,
} from './field-motion.js';
import { SpringMotion } from './spring-motion.js';

/**
 * Private. A check mark that draws itself in and out on springs: the stroke
 * runs along the path and the box pops a little. Shared by the select option,
 * the checkable menu item and the selectable card's corner check, so a tick
 * looks and moves the same everywhere. The host puts `checkMarkStyles` in its
 * styles and `check.render()` where the mark goes; `check.set(on)` moves it.
 *
 * Nothing animates on first paint, while the host is off screen, without
 * polish motion, or under reduced motion: the mark just is, or is not, there.
 */
export const checkMarkStyles = css`
  [part='check'] {
    display: grid;
    place-items: center;
    inline-size: 1em;
    block-size: 1em;
    pointer-events: none;
  }
  [part='check'] svg {
    inline-size: 100%;
    block-size: 100%;
    overflow: visible;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.75;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  [part='mark'] {
    stroke-dasharray: 1 1;
  }
`;

export class CheckMark {
  #on = false;
  readonly #motion: SpringMotion<'c', 'mark' | 'box'>;

  constructor(private readonly host: HTMLElement & { renderRoot: Node }) {
    const root = () => this.host.renderRoot as ParentNode | undefined;
    this.#motion = new SpringMotion(
      ['c'],
      {
        mark: { el: () => root()?.querySelector('[part="mark"]') },
        box: { el: () => root()?.querySelector('[part="check"] svg') },
      },
      (pose) => checkLook(pose),
    );
  }

  get on(): boolean {
    return this.#on;
  }

  /** Draws in or out. Snaps on the first call, when hidden, or with reduced motion. */
  set(on: boolean): void {
    if (on === this.#on && this.#motion.target) return;
    this.#on = on;
    const to: CheckPose = { c: on ? 1 : 0 };
    const box = (this.host.renderRoot as ParentNode | undefined)?.querySelector(
      '[part="check"] svg',
    );
    if (
      !this.#motion.target ||
      !canPolishAnimate(this.host, box ?? null) ||
      !this.host.checkVisibility?.()
    )
      this.#motion.snap(to);
    else this.#motion.go(to, () => (on ? CHECK_ON_TUNE : CHECK_OFF_TUNE));
  }

  /** Call from the host's `firstUpdated`: a mark never set starts as it is. */
  ready(): void {
    if (!this.#motion.target) this.#motion.snap({ c: this.#on ? 1 : 0 });
  }

  stop(): void {
    this.#motion.stop();
  }

  render(): TemplateResult {
    const { mark, box } = checkLook({ c: this.#on ? 1 : 0 });
    return html`<span part="check" aria-hidden="true"
      ><svg viewBox="0 0 16 16" style=${styleMap({ transform: box.transform })}>
        ${svg`<path
          part="mark"
          pathLength="1"
          d="M3.5 8.5 6.6 11.6 12.5 4.6"
          style=${styleMap({ 'stroke-dashoffset': mark.strokeDashoffset, opacity: mark.opacity })}
        />`}
      </svg></span
    >`;
  }
}
