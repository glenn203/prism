import { expect, test, type Page } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { captureSubmit, mount, submitted } from '../../test/fixture.js';

async function setup(page: Page, markup: string) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await mount(page, markup);
  await page.addStyleTag({ path: 'src/tokens/tokens.css' });
  await page.addStyleTag({ path: 'src/theme/theme.css' });
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60))),
  );
  // Styling the page starts colour transitions (up to 40ms + 360ms). Let them
  // finish so later reads see rest colours, not a frame of a move.
  await page.evaluate(() => new Promise((r) => setTimeout(r, 480)));
  return errors;
}

const sw = (page: Page, name: string) =>
  page.getByRole('switch', { name, exact: true });
const settle = (page: Page, ms = 600) =>
  page.evaluate((ms) => new Promise((r) => setTimeout(r, ms)), ms);

test.describe('prism-switch: semantics', () => {
  test('role switch, named by its label, aria-checked follows state', async ({
    page,
  }) => {
    const errors = await setup(
      page,
      '<prism-switch label="Auto-refresh"></prism-switch><prism-switch label="Dark preview" checked></prism-switch>',
    );
    expect(errors).toEqual([]);
    await expect(sw(page, 'Auto-refresh')).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await expect(sw(page, 'Dark preview')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(sw(page, 'Auto-refresh')).toHaveAccessibleName('Auto-refresh');
    expect(
      await sw(page, 'Auto-refresh').evaluate((el) =>
        el.hasAttribute('aria-labelledby'),
      ),
    ).toBe(false);
  });

  test('click, Space and Enter toggle; the label click toggles too', async ({
    page,
  }) => {
    await setup(page, '<prism-switch label="Auto-refresh"></prism-switch>');
    const s = sw(page, 'Auto-refresh');
    await s.click();
    await expect(s).toHaveAttribute('aria-checked', 'true');
    await page.getByText('Auto-refresh').click();
    await expect(s).toHaveAttribute('aria-checked', 'false');
    await s.focus();
    await expect(s).toBeFocused();
    await page.keyboard.press('Space');
    await expect(s).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Enter');
    await expect(s).toHaveAttribute('aria-checked', 'false');
  });

  test('fires input and change once per user toggle, not for property changes', async ({
    page,
  }) => {
    await setup(
      page,
      '<prism-switch id="s" label="Auto-refresh"></prism-switch>',
    );
    await page.evaluate(() => {
      const w = window as unknown as { log: string[] };
      w.log = [];
      const el = document.querySelector('#s')!;
      for (const t of ['input', 'change'])
        el.addEventListener(t, () => w.log.push(t));
    });
    await sw(page, 'Auto-refresh').click();
    expect(
      await page.evaluate(() => (window as never as { log: string[] }).log),
    ).toEqual(['input', 'change']);
    await page.evaluate(() => {
      (
        document.querySelector('#s') as HTMLElement & { checked: boolean }
      ).checked = false;
    });
    await settle(page, 50);
    expect(
      await page.evaluate(() => (window as never as { log: string[] }).log),
    ).toHaveLength(2);
  });

  test('host.click() toggles and checked is reflected with :state(checked)', async ({
    page,
  }) => {
    await setup(
      page,
      '<prism-switch id="s" label="Auto-refresh"></prism-switch>',
    );
    const state = () =>
      page.locator('#s').evaluate((el) => ({
        attr: el.hasAttribute('checked'),
        css: el.matches(':state(checked)'),
      }));
    expect(await state()).toEqual({ attr: false, css: false });
    await page.locator('#s').evaluate((el) => (el as HTMLElement).click());
    expect(await state()).toEqual({ attr: true, css: true });
  });

  test('hide-label keeps the name but not the text on screen', async ({
    page,
  }) => {
    await setup(
      page,
      '<prism-switch id="s" label="Dark preview" hide-label></prism-switch>',
    );
    await expect(sw(page, 'Dark preview')).toBeVisible();
    await expect(sw(page, 'Dark preview')).toHaveAccessibleName('Dark preview');
    const box = await page.locator('#s').evaluate((el) => {
      const l = el
        .shadowRoot!.querySelector('[part="label"]')!
        .getBoundingClientRect();
      return { w: l.width, h: l.height };
    });
    expect(box.w).toBeLessThanOrEqual(1);
    expect(box.h).toBeLessThanOrEqual(1);
  });

  test('label-position=start puts the label before the track', async ({
    page,
  }) => {
    await setup(
      page,
      '<prism-switch id="s" label="Auto-refresh" label-position="start"></prism-switch>',
    );
    const order = await page.locator('#s').evaluate((el) => {
      const l = el
        .shadowRoot!.querySelector('[part="label"]')!
        .getBoundingClientRect();
      const b = el
        .shadowRoot!.querySelector('[part="base"]')!
        .getBoundingClientRect();
      return l.left < b.left;
    });
    expect(order).toBe(true);
  });

  test('a missing label is reported', async ({ page }) => {
    const errors = await setup(page, '<prism-switch></prism-switch>');
    expect(errors.join()).toContain('`label` is required');
  });
});

test.describe('prism-switch: disabled', () => {
  test('disabled does not toggle, is not focusable and shows :state(disabled)', async ({
    page,
  }) => {
    await setup(
      page,
      '<prism-switch id="s" label="Sync" disabled></prism-switch>',
    );
    const s = sw(page, 'Sync');
    await expect(s).toBeDisabled();
    await page.locator('#s').click({ force: true });
    await expect(s).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Tab');
    await expect(s).not.toBeFocused();
    expect(
      await page.locator('#s').evaluate((el) => el.matches(':state(disabled)')),
    ).toBe(true);
  });

  test('disabled by an ancestor fieldset', async ({ page }) => {
    await setup(
      page,
      '<form><fieldset disabled><prism-switch label="Sync"></prism-switch></fieldset></form>',
    );
    await expect(sw(page, 'Sync')).toBeDisabled();
  });

  test('a disabled switch gets no hover overlay', async ({ page }) => {
    await setup(
      page,
      '<prism-switch id="s" label="Sync" disabled></prism-switch>',
    );
    await page.locator('#s').hover({ force: true });
    expect(await overlayAlpha(page)).toBe(0);
  });
});

test.describe('prism-switch: forms', () => {
  test('submits value while on, nothing while off', async ({ page }) => {
    await setup(
      page,
      '<form><prism-switch label="A" name="a" checked></prism-switch><prism-switch label="B" name="b" value="yes"></prism-switch><prism-switch label="C" name="c" value="yes"></prism-switch><button>go</button></form>',
    );
    await captureSubmit(page);
    await sw(page, 'C').click();
    await page.getByRole('button', { name: 'go' }).click();
    expect(await submitted(page)).toEqual({ a: 'on', c: 'yes' });
  });

  test('form reset returns to the starting state', async ({ page }) => {
    await setup(
      page,
      '<form><prism-switch label="A" name="a" checked></prism-switch><prism-switch label="B" name="b"></prism-switch></form>',
    );
    await sw(page, 'A').click();
    await sw(page, 'B').click();
    await expect(sw(page, 'A')).toHaveAttribute('aria-checked', 'false');
    await page.locator('form').evaluate((f: HTMLFormElement) => f.reset());
    await expect(sw(page, 'A')).toHaveAttribute('aria-checked', 'true');
    await expect(sw(page, 'B')).toHaveAttribute('aria-checked', 'false');
  });
});

// ---- look and motion ----

const geometry = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => {
    const r = (p: string) =>
      el.shadowRoot!.querySelector(`[part="${p}"]`)!.getBoundingClientRect();
    const base = r('base');
    const thumb = r('thumb');
    return {
      track: { w: base.width, h: base.height, x: base.left },
      thumb: { w: thumb.width, h: thumb.height, x: thumb.left },
    };
  });

test.describe('prism-switch: shape', () => {
  test('flat, wide track with a pill thumb, three sizes, 24px minimum target', async ({
    page,
  }) => {
    await setup(
      page,
      '<prism-switch id="sm" size="sm" label="S"></prism-switch><prism-switch id="md" label="M"></prism-switch><prism-switch id="lg" size="lg" label="L"></prism-switch>',
    );
    const heights: number[] = [];
    for (const id of ['sm', 'md', 'lg']) {
      const g = await geometry(page, `#${id}`);
      expect(g.track.w).toBeGreaterThanOrEqual(g.track.h * 1.8); // wide
      expect(g.thumb.w).toBeGreaterThan(g.thumb.h); // pill, not a circle
      expect(g.track.h).toBeGreaterThanOrEqual(24);
      heights.push(g.track.h);
    }
    expect(heights[0]).toBeLessThan(heights[1]!);
    expect(heights[1]).toBeLessThan(heights[2]!);
  });

  test('flat: no shadow or gradient on the thumb, the wash or the resting track', async ({
    page,
  }) => {
    await setup(page, '<prism-switch id="s" label="S" checked></prism-switch>');
    const r = await page.locator('#s').evaluate((el) => {
      const cs = (p: string) =>
        getComputedStyle(el.shadowRoot!.querySelector(`[part="${p}"]`)!);
      return {
        thumb: cs('thumb').boxShadow,
        wash: cs('wash').boxShadow,
        // The resting focus ring has zero spread, so it draws nothing.
        base: cs('base')
          .boxShadow.split(/\)\s*,\s*/)
          .every((l) => /0px 0px 0px 0px\s*\)?$/.test(l)),
        images: ['base', 'thumb', 'wash'].map((p) => cs(p).backgroundImage),
      };
    });
    expect(r.thumb).toBe('none');
    expect(r.wash).toBe('none');
    expect(r.base).toBe(true);
    expect(r.images).toEqual(['none', 'none', 'none']);
  });

  test('the thumb sits at the start when off and at the end when on', async ({
    page,
  }) => {
    await setup(page, '<prism-switch id="s" label="S"></prism-switch>');
    const off = await geometry(page, '#s');
    await sw(page, 'S').click();
    await settle(page);
    const on = await geometry(page, '#s');
    expect(off.thumb.x - off.track.x).toBeLessThan(6);
    const gap = on.track.x + on.track.w - (on.thumb.x + on.thumb.w);
    expect(gap).toBeLessThan(6);
    expect(on.thumb.x).toBeGreaterThan(off.thumb.x + 10);
  });

  test('rtl mirrors the travel', async ({ page }) => {
    await setup(
      page,
      '<div dir="rtl"><prism-switch id="s" label="S"></prism-switch></div>',
    );
    const off = await geometry(page, '#s');
    await sw(page, 'S').click();
    await settle(page);
    const on = await geometry(page, '#s');
    expect(on.thumb.x).toBeLessThan(off.thumb.x - 10);
  });
});

test.describe('prism-switch: motion', () => {
  /** Everything animating inside the switch, with what each one animates. */
  const anims = (page: Page) =>
    page.locator('#s').evaluate((el) =>
      el
        .shadowRoot!.querySelector('[part="container"]')!
        .getAnimations({ subtree: true })
        .map((a) => {
          const e = a.effect as KeyframeEffect;
          const t = e.getComputedTiming();
          return {
            kind: a instanceof CSSTransition ? 'transition' : 'animation',
            target: (e.target as HTMLElement).getAttribute('part'),
            pseudo: e.pseudoElement,
            duration: Number(t.duration),
            props: [
              ...new Set(
                e
                  .getKeyframes()
                  .flatMap((k) =>
                    Object.keys(k).filter(
                      (n) =>
                        ![
                          'offset',
                          'easing',
                          'composite',
                          'computedOffset',
                        ].includes(n),
                    ),
                  ),
              ),
            ],
          };
        }),
    );

  /** Pauses every animation at `ms` and reads the thumb's edges in the track. */
  const seek = (page: Page, ms: number) =>
    page.locator('#s').evaluate((el, ms) => {
      const q = (p: string) =>
        el.shadowRoot!.querySelector(`[part="${p}"]`) as HTMLElement;
      for (const a of el
        .shadowRoot!.querySelector('[part="container"]')!
        .getAnimations({ subtree: true })) {
        a.pause();
        a.currentTime = ms;
      }
      const b = q('base').getBoundingClientRect();
      const t = q('thumb').getBoundingClientRect();
      const w = q('wash').getBoundingClientRect();
      return {
        l: t.left - b.left,
        r: t.right - b.left,
        w: t.width,
        washW: w.width,
        washC: (w.left + w.right) / 2 - b.left,
        track: b.width,
      };
    }, ms);

  const geo = (page: Page) =>
    page.locator('#s').evaluate((el) => {
      const q = (p: string) =>
        el.shadowRoot!.querySelector(`[part="${p}"]`) as HTMLElement;
      return {
        tw: parseFloat(getComputedStyle(q('thumb')).width),
        inner: q('base').getBoundingClientRect().width,
      };
    });

  test('turning on and off take the same time, about 400ms, and every part shares one clock', async ({
    page,
  }) => {
    await setup(page, '<prism-switch id="s" label="S"></prism-switch>');
    await sw(page, 'S').click();
    const on = await anims(page);
    await settle(page);
    await sw(page, 'S').click();
    const off = await anims(page);
    for (const run of [on, off]) {
      const durs = run.map((a) => a.duration);
      expect(durs.length).toBe(5); // thumb, wash, glint, thumb colour, border
      expect(new Set(durs).size).toBe(1);
      expect(durs[0]).toBeGreaterThanOrEqual(370);
      expect(durs[0]).toBeLessThanOrEqual(430);
    }
    expect(Math.abs(on[0]!.duration - off[0]!.duration)).toBeLessThanOrEqual(1);
  });

  test('only transform, opacity and colour move: no width, left, margin or clip-path', async ({
    page,
  }) => {
    await setup(page, '<prism-switch id="s" label="S"></prism-switch>');
    await sw(page, 'S').click();
    const a = await anims(page);
    const props = new Set(a.flatMap((x) => x.props));
    expect([...props].sort()).toEqual(
      ['backgroundColor', 'borderColor', 'opacity', 'transform'].sort(),
    );
    expect(a.every((x) => x.kind === 'animation')).toBe(true);
    // No CSS transition is left running on the parts.
    const tr = await page
      .locator('#s')
      .evaluate((el) =>
        ['thumb', 'wash'].map(
          (p) =>
            getComputedStyle(el.shadowRoot!.querySelector(`[part="${p}"]`)!)
              .transitionDuration,
        ),
      );
    expect(tr.every((d) => parseFloat(d) === 0)).toBe(true);
  });

  test('nothing animates on first paint, on or off', async ({ page }) => {
    await setup(
      page,
      '<prism-switch id="s" label="S" checked></prism-switch><prism-switch id="t" label="T"></prism-switch>',
    );
    const n = await page.evaluate(() =>
      [...document.querySelectorAll('prism-switch')].map(
        (el) =>
          el
            .shadowRoot!.querySelector('[part="container"]')!
            .getAnimations({ subtree: true }).length,
      ),
    );
    expect(n).toEqual([0, 0]);
    const g = await geometry(page, '#s');
    expect(g.track.x + g.track.w - (g.thumb.x + g.thumb.w)).toBeLessThan(6);
  });

  test('a change from code moves the same way as a click', async ({ page }) => {
    await setup(page, '<prism-switch id="s" label="S"></prism-switch>');
    await page.locator('#s').evaluate((el) => {
      (el as HTMLElement & { checked: boolean }).checked = true;
    });
    await settle(page, 20);
    expect((await anims(page)).length).toBe(5);
  });

  test('the thumb stretches mid-travel (about 25-40% wider) and ends back in shape', async ({
    page,
  }) => {
    await setup(page, '<prism-switch id="s" label="S"></prism-switch>');
    const { tw, inner } = await geo(page);
    await sw(page, 'S').click();
    const dur = (await anims(page))[0]!.duration;
    let peak = 0;
    let peakAt = 0;
    for (let t = 0; t < dur; t += 4) {
      const f = await seek(page, t);
      if (f.w > peak) {
        peak = f.w;
        peakAt = t;
      }
      // Never leaves the track, overshoot included.
      expect(f.l).toBeGreaterThan(0);
      expect(f.r).toBeLessThan(inner + 0.5);
    }
    expect(peak / tw).toBeGreaterThan(1.25);
    expect(peak / tw).toBeLessThan(1.42);
    expect(peakAt).toBeGreaterThan(50);
    expect(peakAt).toBeLessThan(200);
    const end = await seek(page, dur);
    expect(Math.abs(end.w - tw)).toBeLessThan(0.05);
  });

  test('every frame is continuous: speed never jumps, and the move overshoots only slightly', async ({
    page,
  }) => {
    await setup(page, '<prism-switch id="s" label="S"></prism-switch>');
    const { tw } = await geo(page);
    await sw(page, 'S').click();
    const dur = (await anims(page))[0]!.duration;
    const centres: number[] = [];
    const widths: number[] = [];
    for (let t = 0; t <= dur; t += 2) {
      const f = await seek(page, t);
      centres.push((f.l + f.r) / 2);
      widths.push(f.w);
    }
    const end = centres[centres.length - 1]!;
    const start = centres[0]!;
    const travel = end - start;
    // Overshoot at most 8% of the travel past the end.
    expect(Math.max(...centres) - end).toBeLessThan(0.08 * travel);
    // 2ms steps: no step bigger than 1px, no change of step bigger than 0.2px.
    const step = centres.slice(1).map((c, i) => c - centres[i]!);
    expect(Math.max(...step.map(Math.abs))).toBeLessThan(1);
    const jerk = step.slice(1).map((v, i) => v - step[i]!);
    expect(Math.max(...jerk.map(Math.abs))).toBeLessThan(0.2);
    const wstep = widths.slice(1).map((w, i) => w - widths[i]!);
    expect(Math.max(...wstep.map(Math.abs))).toBeLessThan(0.7);
    expect(Math.min(...widths)).toBeGreaterThan(tw * 0.97);
  });

  test('turning round mid-move carries on from where the thumb is: no snap in place or width', async ({
    page,
  }) => {
    await setup(page, '<prism-switch id="s" label="S"></prism-switch>');
    for (const at of [60, 120, 200, 300]) {
      await sw(page, 'S').click();
      // The pose one frame on is where the new move has to start.
      const ahead = await seek(page, at + 16.7);
      await seek(page, at);
      await page.locator('#s').evaluate((el) => (el as HTMLElement).click()); // turn round
      const after = await seek(page, 0);
      expect(Math.abs(after.l - ahead.l)).toBeLessThan(0.8);
      expect(Math.abs(after.r - ahead.r)).toBeLessThan(0.8);
      expect(Math.abs(after.w - ahead.w)).toBeLessThan(0.8);
      await settle(page, 700);
      await sw(page, 'S').click(); // back to the starting state
      await settle(page, 700);
      await sw(page, 'S').click();
      await settle(page, 700);
    }
  });

  test('rapid taps always end at rest in the right place', async ({ page }) => {
    await setup(page, '<prism-switch id="s" label="S"></prism-switch>');
    for (let i = 0; i < 7; i++) {
      await page.locator('#s').evaluate((el) => (el as HTMLElement).click());
      await settle(page, 70);
    }
    await settle(page, 800);
    expect(await sw(page, 'S').getAttribute('aria-checked')).toBe('true');
    expect((await anims(page)).length).toBe(0);
    const g = await geometry(page, '#s');
    expect(g.track.x + g.track.w - (g.thumb.x + g.thumb.w)).toBeLessThan(6);
  });

  test('the colours, the track fill and the glint follow the thumb', async ({
    page,
  }) => {
    await setup(page, '<prism-switch id="s" label="S"></prism-switch>');
    await sw(page, 'S').click();
    const dur = (await anims(page))[0]!.duration;
    const wash0 = await seek(page, 0);
    expect(wash0.washW).toBeLessThan(1);
    const mid = await seek(page, 70);
    // The fill is centred on the thumb all the way.
    expect(Math.abs(mid.washC - (mid.l + mid.r) / 2)).toBeLessThan(0.6);
    expect(mid.washW).toBeGreaterThan(5);
    const end = await seek(page, dur);
    expect(end.washW).toBeGreaterThan(end.track * 1.9);
  });

  test('the move hands back to the stylesheet at rest: no animation left, no stale pixels', async ({
    page,
  }) => {
    await setup(page, '<prism-switch id="s" label="S"></prism-switch>');
    await sw(page, 'S').click();
    await settle(page, 700);
    expect((await anims(page)).length).toBe(0);
    const tr = await page
      .locator('#s')
      .evaluate(
        (el) =>
          getComputedStyle(el.shadowRoot!.querySelector('[part="thumb"]')!)
            .transform,
      );
    expect(tr).not.toBe('none');
    // A size change after a move still lands the thumb on the track's end.
    await page.locator('#s').evaluate((el) => el.setAttribute('size', 'lg'));
    await settle(page, 60);
    const g = await geometry(page, '#s');
    expect(g.track.x + g.track.w - (g.thumb.x + g.thumb.w)).toBeLessThan(6);
  });

  test('press and hold widens the thumb from the side it sits on; letting go outside does nothing', async ({
    page,
  }) => {
    await setup(page, '<prism-switch id="s" label="S"></prism-switch>');
    await page.evaluate(() => {
      const w = window as unknown as { log: string[] };
      w.log = [];
      const el = document.querySelector('#s')!;
      for (const t of ['input', 'change'])
        el.addEventListener(t, () => w.log.push(t));
    });
    const { tw } = await geo(page);
    const box = (await sw(page, 'S').boundingBox())!;
    const rest = await seek(page, 0);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await settle(page, 400);
    const held = await seek(page, 9999);
    expect(held.w / tw).toBeGreaterThan(1.15);
    expect(held.w / tw).toBeLessThan(1.3);
    expect(Math.abs(held.l - rest.l)).toBeLessThan(0.3); // stays anchored
    await page.mouse.move(box.x + box.width / 2, box.y + box.height + 60);
    await page.mouse.up();
    await settle(page, 700);
    const after = await geometry(page, '#s');
    expect(after.thumb.w).toBeCloseTo(tw, 0);
    expect(await sw(page, 'S').getAttribute('aria-checked')).toBe('false');
    expect(
      await page.evaluate(() => (window as never as { log: string[] }).log),
    ).toEqual([]);
  });

  test('a tap with the mouse toggles once (one input, one change) and stretches', async ({
    page,
  }) => {
    await setup(page, '<prism-switch id="s" label="S"></prism-switch>');
    await page.evaluate(() => {
      const w = window as unknown as { log: string[] };
      w.log = [];
      const el = document.querySelector('#s')!;
      for (const t of ['input', 'change', 'click'])
        el.addEventListener(t, () => w.log.push(t));
    });
    await sw(page, 'S').click();
    await settle(page, 700);
    expect(await sw(page, 'S').getAttribute('aria-checked')).toBe('true');
    const log = await page.evaluate(
      () => (window as never as { log: string[] }).log,
    );
    expect(log.filter((l) => l === 'input')).toHaveLength(1);
    expect(log.filter((l) => l === 'change')).toHaveLength(1);
  });

  test('drag past the middle turns it on, once; a short drag does not', async ({
    page,
  }) => {
    await setup(page, '<prism-switch id="s" label="S"></prism-switch>');
    await page.evaluate(() => {
      const w = window as unknown as { log: string[] };
      w.log = [];
      const el = document.querySelector('#s')!;
      for (const t of ['input', 'change'])
        el.addEventListener(t, () => w.log.push(t));
    });
    const box = (await sw(page, 'S').boundingBox())!;
    const y = box.y + box.height / 2;
    // Short drag, stays off.
    await page.mouse.move(box.x + 14, y);
    await page.mouse.down();
    for (let i = 1; i <= 4; i++) await page.mouse.move(box.x + 14 + i * 1.5, y);
    await settle(page, 200);
    await page.mouse.up();
    await settle(page, 700);
    expect(await sw(page, 'S').getAttribute('aria-checked')).toBe('false');
    // Long drag, turns on, and the click after the drop is not a second toggle.
    await page.mouse.move(box.x + 14, y);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++)
      await page.mouse.move(box.x + 14 + (i * (box.width - 26)) / 12, y);
    await settle(page, 200);
    await page.mouse.up();
    await settle(page, 700);
    expect(await sw(page, 'S').getAttribute('aria-checked')).toBe('true');
    expect(
      await page.evaluate(() => (window as never as { log: string[] }).log),
    ).toEqual(['input', 'change']);
    const g = await geometry(page, '#s');
    expect(g.track.x + g.track.w - (g.thumb.x + g.thumb.w)).toBeLessThan(6);
    // And the next plain tap still works.
    await sw(page, 'S').click();
    await expect(sw(page, 'S')).toHaveAttribute('aria-checked', 'false');
  });

  test('dragging back from on turns it off; rtl drags the other way', async ({
    page,
  }) => {
    await setup(
      page,
      '<div dir="rtl"><prism-switch id="s" label="S" checked></prism-switch></div>',
    );
    const box = (await sw(page, 'S').boundingBox())!;
    const y = box.y + box.height / 2;
    // In rtl "on" is at the left; drag to the right to turn it off.
    await page.mouse.move(box.x + 14, y);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++)
      await page.mouse.move(box.x + 14 + (i * (box.width - 26)) / 12, y);
    await settle(page, 150);
    await page.mouse.up();
    await settle(page, 700);
    expect(await sw(page, 'S').getAttribute('aria-checked')).toBe('false');
  });

  test('a disabled switch does not press or drag', async ({ page }) => {
    await setup(
      page,
      '<prism-switch id="s" label="S" disabled></prism-switch>',
    );
    const box = await page.locator('#s').evaluate((el) => {
      const r = el
        .shadowRoot!.querySelector('[part=base]')!
        .getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    await page.mouse.move(box.x + 14, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 40, box.y + box.height / 2);
    await settle(page, 100);
    expect((await anims(page)).length).toBe(0);
    await page.mouse.up();
  });

  test('the token set: motion-switch 400ms and the shared curves are still there', async ({
    page,
  }) => {
    await setup(page, '<prism-switch id="s" label="S"></prism-switch>');
    const v = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return [
        'motion-switch',
        'ease-settle',
        'ease-overshoot',
        'ease-recoil',
      ].map((k) => cs.getPropertyValue(`--prism-${k}`).trim());
    });
    expect(v).toEqual([
      '400ms',
      'cubic-bezier(0.4, 0, 0.2, 1)',
      'cubic-bezier(0.34, 1.2, 0.64, 1)',
      'cubic-bezier(0.34, 1.56, 0.64, 1)',
    ]);
  });

  test('reduced motion: no travel, stretch, press or drag; 120ms colour change; thumb jumps', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(page, '<prism-switch id="s" label="S"></prism-switch>');
    await sw(page, 'S').click();
    const r = await page.locator('#s').evaluate((el) => {
      const q = (p: string) =>
        el.shadowRoot!.querySelector(`[part="${p}"]`) as HTMLElement;
      const cs = (n: Element, pe?: string) => getComputedStyle(n, pe);
      return {
        running: el
          .shadowRoot!.querySelector('[part="container"]')!
          .getAnimations({ subtree: true })
          .filter((a) => !(a instanceof CSSTransition)).length,
        thumbProps: cs(q('thumb')).transitionProperty,
        thumbT: cs(q('thumb')).transitionDuration,
        washProps: cs(q('wash')).transitionProperty,
        washT: cs(q('wash')).transitionDuration,
        washTransform: cs(q('wash')).transform,
        glint: cs(q('base'), '::before').display,
        scale: cs(q('thumb')).scale,
      };
    });
    expect(r.running).toBe(0);
    expect(r.thumbProps).toBe('background-color');
    expect(parseFloat(r.thumbT) * 1000).toBe(120);
    expect(r.washProps).toBe('opacity');
    expect(parseFloat(r.washT) * 1000).toBe(120);
    expect(r.washTransform).toBe('none');
    expect(r.glint).toBe('none');
    expect(r.scale).toBe('none');
    // Press and drag do nothing either.
    const box = (await sw(page, 'S').boundingBox())!;
    await page.mouse.move(box.x + 14, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 30, box.y + box.height / 2);
    await settle(page, 100);
    expect(
      await page.locator('#s').evaluate(
        (el) =>
          el
            .shadowRoot!.querySelector('[part="container"]')!
            .getAnimations({ subtree: true })
            .filter((a) => !(a instanceof CSSTransition)).length,
      ),
    ).toBe(0);
    await page.mouse.up();
  });

  test('the duration can be set with --prism-switch-duration', async ({
    page,
  }) => {
    await setup(
      page,
      '<prism-switch id="s" label="S" style="--prism-switch-duration:200ms"></prism-switch>',
    );
    await sw(page, 'S').click();
    const d = (await anims(page))[0]!.duration;
    expect(d).toBeGreaterThan(170);
    expect(d).toBeLessThan(230);
  });
});

// ---- state layer ----

/** Alpha of the state overlay drawn above the track (0 when none). */
const overlayAlpha = (page: Page) =>
  page
    .locator('prism-switch')
    .first()
    .evaluate((el) => {
      const base = el.shadowRoot!.querySelector('[part="base"]')!;
      const ctx = document.createElement('canvas').getContext('2d')!;
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = getComputedStyle(base, '::after').backgroundColor;
      ctx.fillRect(0, 0, 1, 1);
      return ctx.getImageData(0, 0, 1, 1).data[3]! / 255;
    });
const token = (page: Page, name: string) =>
  page.evaluate(
    (name) =>
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(name),
      ) / 100,
    name,
  );

test.describe('prism-switch: state layer (shared 6 / 11 / 15% overlays)', () => {
  test('off: rest none, hover 6%, pressed 12%', async ({ page }) => {
    await setup(page, '<prism-switch id="s" label="S"></prism-switch>');
    expect(await overlayAlpha(page)).toBe(0);
    await sw(page, 'S').hover();
    expect(await overlayAlpha(page)).toBeCloseTo(0.06, 2);
    await page.mouse.down();
    expect(await overlayAlpha(page)).toBeCloseTo(0.12, 2);
    await page.mouse.up();
  });

  test('on: selected 11% at rest, selected and hovered 15%', async ({
    page,
  }) => {
    await setup(page, '<prism-switch id="s" label="S" checked></prism-switch>');
    expect(await overlayAlpha(page)).toBeCloseTo(0.11, 2);
    await sw(page, 'S').hover();
    expect(await overlayAlpha(page)).toBeCloseTo(0.15, 2);
  });

  test('the overlays follow the shared state tokens', async ({ page }) => {
    await setup(page, '<prism-switch id="s" label="S" checked></prism-switch>');
    expect([
      await token(page, '--prism-state-hover'),
      await token(page, '--prism-state-selected'),
      await token(page, '--prism-state-selected-hover'),
    ]).toEqual([0.06, 0.11, 0.15]);
  });
});

// ---- contrast ----

type RGB = [number, number, number];
const lum = ([r, g, b]: RGB) => {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: RGB, b: RGB) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * What the eye sees, as sRGB: the page bg, the track (resting fill, or the
 * wash when on, or the border colour), the state overlay over it, the thumb.
 */
async function looks(page: Page, state: 'rest' | 'hover' | 'pressed') {
  if (state !== 'rest') {
    await sw(page, 'S').hover();
    if (state === 'pressed') await page.mouse.down();
  }
  const out = await page.locator('#s').evaluate((el) => {
    const q = (p: string) =>
      el.shadowRoot!.querySelector(`[part="${p}"]`) as HTMLElement;
    const ctx = document
      .createElement('canvas')
      .getContext('2d', { willReadFrequently: true })!;
    const px = (layers: string[]): number[] => {
      ctx.clearRect(0, 0, 1, 1);
      for (const c of layers) {
        ctx.fillStyle = c;
        ctx.fillRect(0, 0, 1, 1);
      }
      return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    };
    const host = el.parentElement!;
    const bg = getComputedStyle(host).backgroundColor;
    const base = q('base');
    const on = base.getAttribute('aria-checked') === 'true';
    const cs = (n: Element, pe?: string) => getComputedStyle(n, pe);
    const fill = on ? cs(q('wash')).backgroundColor : cs(base).backgroundColor;
    const overlay = cs(base, '::after').backgroundColor;
    return {
      bg: px([bg]),
      border: px([bg, cs(base).borderTopColor]),
      track: px([bg, fill, overlay]),
      thumb: px([bg, fill, overlay, cs(q('thumb')).backgroundColor]),
      on,
    };
  });
  if (state === 'pressed') await page.mouse.up();
  return out;
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`prism-switch: AA non-text contrast (${theme})`, () => {
    for (const checked of [false, true]) {
      for (const state of ['rest', 'hover', 'pressed'] as const) {
        test(`${checked ? 'on' : 'off'}, ${state}: track vs page, thumb vs track >= 3:1`, async ({
          page,
        }) => {
          await setup(
            page,
            `<div data-prism-theme="${theme}" style="background:var(--prism-color-bg);padding:24px"><prism-switch id="s" label="S" ${checked ? 'checked' : ''}></prism-switch></div>`,
          );
          const l = await looks(page, state);
          expect(l.on).toBe(checked);
          // The edge of the control: its border when off, its fill when on.
          const edge = checked ? l.track : l.border;
          expect(ratio(edge as RGB, l.bg as RGB)).toBeGreaterThanOrEqual(3);
          // The thumb against the track it sits on.
          expect(ratio(l.thumb as RGB, l.track as RGB)).toBeGreaterThanOrEqual(
            3,
          );
          // The label text.
        });
      }
    }

    test('label text is 4.5:1 on the page', async ({ page }) => {
      await setup(
        page,
        `<div data-prism-theme="${theme}" style="background:var(--prism-color-bg);padding:24px"><prism-switch id="s" label="Auto-refresh"></prism-switch></div>`,
      );
      const r = await page.locator('#s').evaluate((el) => {
        const ctx = document
          .createElement('canvas')
          .getContext('2d', { willReadFrequently: true })!;
        const px = (c: string) => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = c;
          ctx.fillRect(0, 0, 1, 1);
          return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
        };
        return {
          fg: px(
            getComputedStyle(el.shadowRoot!.querySelector('[part="label"]')!)
              .color,
          ),
          bg: px(getComputedStyle(el.parentElement!).backgroundColor),
        };
      });
      expect(ratio(r.fg as RGB, r.bg as RGB)).toBeGreaterThanOrEqual(4.5);
    });
  });
}

test('focus ring shows on keyboard focus', async ({ page }) => {
  await setup(page, '<prism-switch id="s" label="S"></prism-switch>');
  await page.keyboard.press('Tab');
  const sh = await page
    .locator('#s')
    .evaluate(
      (el) =>
        getComputedStyle(el.shadowRoot!.querySelector('[part="base"]')!)
          .boxShadow,
    );
  expect(sh).not.toMatch(/^(0px 0px 0px 0px [^,]+(, )?)+$/);
});

// ---- axe ----

const AXE = (() => {
  const dir = readdirSync('node_modules/.pnpm').find((d) =>
    d.startsWith('axe-core@'),
  );
  return `node_modules/.pnpm/${dir}/node_modules/axe-core/axe.min.js`;
})();
async function axe(page: Page) {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => {
    const r = await (
      window as unknown as {
        axe: {
          run(
            c: Element,
            o: object,
          ): Promise<{ violations: { id: string; nodes: unknown[] }[] }>;
        };
      }
    ).axe.run(document.querySelector('#root')!, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
    });
    return r.violations.map(
      (v) =>
        `${v.id} (${v.nodes.length}) ${JSON.stringify(v.nodes).slice(0, 600)}`,
    );
  });
}

const ALL = `
  <prism-switch label="Off"></prism-switch>
  <prism-switch label="On" checked></prism-switch>
  <prism-switch label="Small" size="sm"></prism-switch>
  <prism-switch label="Large" size="lg" checked></prism-switch>
  <prism-switch label="Disabled off" disabled></prism-switch>
  <prism-switch label="Disabled on" checked disabled></prism-switch>
  <prism-switch label="Hidden label" hide-label></prism-switch>
  <prism-switch label="Label first" label-position="start"></prism-switch>`;

for (const theme of ['light', 'dark']) {
  test(`axe: no WCAG A/AA violations (${theme})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(
      page,
      `<div data-prism-theme="${theme}" style="background:var(--prism-color-bg);color:var(--prism-color-text);padding:16px">${ALL}</div>`,
    );
    expect(await axe(page)).toEqual([]);
  });
}
