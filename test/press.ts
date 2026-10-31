import type { Locator, Page } from '@playwright/test';

/** The `scale` the element is drawn at now (1 when none), read in the page. */
export const SCALE_OF = `(el) => { const s = getComputedStyle(el).scale; return s === 'none' ? 1 : parseFloat(s); }`;

/** Computed scale of a shadow part of `host` (or of the host's own element). */
export const scaleOf = (host: Locator, part: string) =>
  host.evaluate((el, part) => {
    const t = el.shadowRoot!.querySelector(part)!;
    const s = getComputedStyle(t).scale;
    return s === 'none' ? 1 : parseFloat(s);
  }, part);

/** Moves the mouse to the middle of `loc` and presses. */
export async function mouseDown(page: Page, loc: Locator) {
  const b = (await loc.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
}

/** Running animations on `part` of `host`: the properties each one moves. */
export const scaleAnims = (host: Locator, part: string) =>
  host.evaluate((el, part) => {
    const skip = ['offset', 'easing', 'composite', 'computedOffset'];
    const t = el.shadowRoot!.querySelector(part)!;
    return t
      .getAnimations()
      .filter((a) => !(a instanceof CSSTransition))
      .map((a) =>
        [
          ...new Set(
            (a.effect as KeyframeEffect)
              .getKeyframes()
              .flatMap((k) => Object.keys(k))
              .filter((p) => !skip.includes(p)),
          ),
        ].join(','),
      );
  }, part);

/**
 * Lets go of the mouse and returns the scale of `part` on every frame of the
 * next 600ms, plus the ms from release to the last frame more than a tenth of
 * a percent off rest.
 */
export async function releaseFrames(page: Page, host: Locator, part: string) {
  await host.evaluate((el, part) => {
    const t = el.shadowRoot!.querySelector(part)!;
    const w = window as unknown as { __curve: number[]; __on: boolean };
    w.__curve = [];
    w.__on = true;
    const tick = () => {
      const s = getComputedStyle(t).scale;
      w.__curve.push(s === 'none' ? 1 : parseFloat(s));
      if (w.__on) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, part);
  await page.mouse.up();
  await page.waitForTimeout(600);
  return page.evaluate(() => {
    const w = window as unknown as { __curve: number[]; __on: boolean };
    w.__on = false;
    const scales = w.__curve;
    const last = scales.reduce(
      (at, v, i) => (Math.abs(v - 1) > 0.001 ? i : at),
      -1,
    );
    return { scales, settleMs: Math.round((last + 1) * (1000 / 60)) };
  });
}
