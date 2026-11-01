import type { Locator, Page } from '@playwright/test';

/** Where the parts of a checkbox or radio are drawn, read from computed style. */
export interface Drawn {
  /** Box squish: scale across and down. */
  sx: number;
  sy: number;
  /** Checkbox fill (scale, opacity) and its two mark arms (visible length, opacity, angle in degrees, corner x and y). */
  fill?: { s: number; o: number };
  arms?: { len: number; o: number; angle: number; x: number; y: number }[];
  /** Radio ring opacity and dot (scale, opacity). */
  ring?: number;
  dot?: { s: number; o: number };
}

/**
 * Where a control draws itself: its `container` part, or for a radio the
 * `option` its group draws for it (the inputs live in the group's shadow root).
 */
const scopeOf = (el: Element): Element =>
  el.localName === 'prism-radio'
    ? el
        .closest('prism-radio-group')!
        .shadowRoot!.getElementById(el.slot)!
        .closest('[part~="option"]')!
    : el.shadowRoot!.querySelector('[part="container"]')!;

/** The element holding everything a control (or one radio) draws, to read parts from. */
export const optionOf = (host: Locator) => host.evaluateHandle(scopeOf);

/** The pose drawn right now (or, with `ms`, with every animation paused there). */
export async function drawn(host: Locator, ms?: number): Promise<Drawn> {
  const scope = await host.evaluateHandle(scopeOf);
  return scope.evaluate((root, ms) => {
    if (ms !== undefined)
      for (const a of root.getAnimations({ subtree: true })) {
        a.pause();
        a.currentTime = ms;
      }
    const part = (p: string) =>
      root.querySelector<HTMLElement>(`[part~="${p}"]`);
    const cs = (n: Element) => getComputedStyle(n);
    const box = new DOMMatrix(cs(part('box')!).transform);
    const out: Record<string, unknown> = { sx: box.a, sy: box.d };
    const fill = part('fill');
    if (fill)
      out.fill = {
        s: new DOMMatrix(cs(fill).transform).a,
        o: Number(cs(fill).opacity),
      };
    const lines = [...root.querySelectorAll('[part="mark"] line')];
    if (lines.length)
      out.arms = lines.map((l) => {
        const m = new DOMMatrix(cs(l).transform);
        return {
          len: 10.6 - parseFloat(cs(l).strokeDashoffset),
          o: Number(cs(l).opacity),
          angle: (Math.atan2(m.b, m.a) * 180) / Math.PI,
          x: m.e,
          y: m.f,
        };
      });
    const ring = part('ring');
    if (ring) out.ring = Number(cs(ring).opacity);
    const dot = part('dot');
    if (dot)
      out.dot = {
        s: new DOMMatrix(cs(dot).transform).a,
        o: Number(cs(dot).opacity),
      };
    return out as unknown as Drawn;
  }, ms);
}

/** Every running animation (not transition) inside the control, with what it animates. */
export async function anims(host: Locator) {
  return (await optionOf(host)).evaluate((root) =>
    root
      .getAnimations({ subtree: true })
      .filter((a) => !(a instanceof CSSTransition))
      .map((a) => {
        const e = a.effect as KeyframeEffect;
        const t = e.getComputedTiming();
        return {
          target: (e.target as HTMLElement).getAttribute('part') ?? 'arm',
          pseudo: e.pseudoElement,
          duration: Number(t.duration),
          start: a.startTime === null ? null : Number(a.startTime),
          props: [
            ...new Set(
              e
                .getKeyframes()
                .flatMap((k) => Object.keys(k))
                .filter(
                  (n) =>
                    ![
                      'offset',
                      'easing',
                      'composite',
                      'computedOffset',
                    ].includes(n),
                ),
            ),
          ],
        };
      }),
  );
}

export const wait = (page: Page, ms: number) =>
  page.evaluate((ms) => new Promise((r) => setTimeout(r, ms)), ms);
