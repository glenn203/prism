import { expect, test, type Page } from '@playwright/test';
import { mount } from '../../test/fixture.js';

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
  return errors;
}

test.describe('prism-progress', () => {
  test('a native progress bar named by its label reports max and value', async ({
    page,
  }) => {
    const errors = await setup(
      page,
      '<prism-progress label="Storage used" value="60"></prism-progress>',
    );
    expect(errors).toEqual([]);
    const bar = page.getByRole('progressbar', { name: 'Storage used' });
    await expect(bar).toHaveJSProperty('max', 100);
    await expect(bar).toHaveJSProperty('value', 60);
    await expect(bar).toHaveAttribute('value', '60');
  });

  test('the fill length follows value and max', async ({ page }) => {
    await setup(
      page,
      '<div style="width:200px"><prism-progress id="p" label="Setup" value="3" max="5"></prism-progress></div>',
    );
    const w = await page.locator('#p').evaluate((el) => {
      const track = el.shadowRoot!.querySelector('[part="track"]')!;
      const fill = el.shadowRoot!.querySelector('[part="fill"]')!;
      return (
        fill.getBoundingClientRect().width / track.getBoundingClientRect().width
      );
    });
    expect(w).toBeCloseTo(0.6, 1);
  });

  test('values are clamped to 0..max', async ({ page }) => {
    await setup(
      page,
      '<prism-progress id="a" label="A" value="150"></prism-progress><prism-progress id="b" label="B" value="-5"></prism-progress>',
    );
    await expect(page.getByRole('progressbar', { name: 'A' })).toHaveJSProperty(
      'value',
      100,
    );
    await expect(page.getByRole('progressbar', { name: 'B' })).toHaveJSProperty(
      'value',
      0,
    );
  });

  test('show-value writes the percent, or value-text (also the aria-valuetext)', async ({
    page,
  }) => {
    await setup(
      page,
      '<prism-progress id="a" label="Storage" value="60" show-value></prism-progress><prism-progress id="b" label="Setup" value="3" max="5" value-text="3 of 5 steps" show-value></prism-progress>',
    );
    const text = (id: string) =>
      page
        .locator(`#${id}`)
        .evaluate(
          (el) => el.shadowRoot!.querySelector('[part="value"]')!.textContent,
        );
    expect(await text('a')).toBe('60%');
    expect(await text('b')).toBe('3 of 5 steps');
    await expect(
      page.getByRole('progressbar', { name: 'Setup' }),
    ).toHaveAttribute('aria-valuetext', '3 of 5 steps');
  });

  test('indeterminate: no value, a state, the comet travels, and under reduced motion it pulses instead', async ({
    page,
  }) => {
    await setup(
      page,
      '<prism-progress id="p" label="Loading"></prism-progress>',
    );
    const bar = page.getByRole('progressbar', { name: 'Loading' });
    await expect(bar).not.toHaveAttribute('value');
    const anim = () =>
      page
        .locator('#p')
        .evaluate(
          (el) =>
            getComputedStyle(el.shadowRoot!.querySelector('[part="fill"]')!)
              .animationName,
        );
    expect(await anim()).toBe('prism-progress-slide');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await anim()).toBe('prism-progress-pulse');
  });

  test('the label is visible; hide-label keeps the name but hides it from sight', async ({
    page,
  }) => {
    await setup(
      page,
      '<prism-progress id="a" label="Visible" value="10"></prism-progress><prism-progress id="b" label="Hidden" value="10" hide-label></prism-progress>',
    );
    await expect(page.getByText('Visible')).toBeVisible();
    const w = await page
      .locator('#b')
      .evaluate(
        (el) =>
          el
            .shadowRoot!.querySelector('[part="label"]')!
            .getBoundingClientRect().width,
      );
    expect(w).toBeLessThanOrEqual(1);
    await expect(page.getByRole('progressbar', { name: 'Hidden' })).toHaveCount(
      1,
    );
  });

  test('a bar with no label is a dev error', async ({ page }) => {
    const errors = await setup(
      page,
      '<prism-progress value="5"></prism-progress>',
    );
    expect(errors.some((e) => e.includes('`label` is required'))).toBe(true);
  });

  test('fill and track are painted and differ', async ({ page }) => {
    await setup(
      page,
      '<prism-progress id="p" label="X" value="50" tone="success"></prism-progress>',
    );
    const c = await page.locator('#p').evaluate((el) => {
      const f = getComputedStyle(
        el.shadowRoot!.querySelector('[part="fill"]')!,
      ).backgroundColor;
      const t = getComputedStyle(
        el.shadowRoot!.querySelector('[part="track"]')!,
      ).backgroundColor;
      return { f, t };
    });
    expect(c.f).not.toBe(c.t);
    expect(c.f).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('the track has no border and a faint inset edge shadow over the fill', async ({
    page,
  }) => {
    await setup(
      page,
      '<prism-progress id="p" label="X" value="50"></prism-progress>',
    );
    const r = await page.locator('#p').evaluate((el) => {
      const track = el.shadowRoot!.querySelector('[part="track"]')!;
      const cs = getComputedStyle(track);
      const after = getComputedStyle(track, '::after');
      return {
        border: cs.borderTopWidth,
        shadow: after.boxShadow,
        pos: after.position,
        events: after.pointerEvents,
      };
    });
    expect(r.border).toBe('0px');
    expect(r.shadow).toContain('inset');
    expect(r.shadow).toMatch(/2px 0px/);
    expect(r.pos).toBe('absolute');
    expect(r.events).toBe('none');
  });

  test('the shadow is stronger in dark (a dark edge needs more weight)', async ({
    page,
  }) => {
    await setup(
      page,
      '<prism-progress id="p" label="X" value="50"></prism-progress>',
    );
    const alpha = (theme: string) =>
      page.locator('#p').evaluate((el, t) => {
        document.documentElement.setAttribute('data-prism-theme', t);
        const track = el.shadowRoot!.querySelector('[part="track"]')!;
        const m = /\/ ([\d.]+)\)/.exec(
          getComputedStyle(track, '::after').boxShadow,
        );
        return Number(m?.[1] ?? 1);
      }, theme);
    expect(await alpha('light')).toBeCloseTo(0.06, 2);
    expect(await alpha('dark')).toBeCloseTo(0.3, 2);
  });

  test('the fill is a comet: head, tail and base layers over the filled width', async ({
    page,
  }) => {
    await setup(
      page,
      '<div style="width:300px"><prism-progress id="p" label="X" value="60" tone="success"></prism-progress></div>',
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const g = await page.locator('#p').evaluate((el) => {
      const fill = el.shadowRoot!.querySelector('[part="fill"]') as HTMLElement;
      const cs = getComputedStyle(fill);
      return {
        img: cs.backgroundImage,
        size: cs.backgroundSize,
        pos: cs.backgroundPosition,
        shadow: cs.boxShadow,
        w: fill.getBoundingClientRect().width,
      };
    });
    // Top to bottom: head, tail, base.
    const layers = g.img.match(/(radial|linear)-gradient\(/g);
    expect(layers).toEqual([
      'radial-gradient(',
      'radial-gradient(',
      'linear-gradient(',
    ]);
    expect(g.img).toMatch(/radial-gradient\(14px 120% at 100% 50%/);
    expect(g.img).toMatch(/radial-gradient\(100% 55% at 100% 50%/);
    expect(g.img).toContain('90deg');
    // The tail is as long as the fill (here 180px), the others fill the box.
    expect(g.size.replace(/\s/g, '')).toBe(
      '100%100%,min(100%,280px)100%,100%100%',
    );
    expect(g.pos).toBe('0px 0px, 100% 0px, 0px 0px');
    // Spans the filled width only: the fill box is 60% of the 300px track.
    expect(g.w).toBeGreaterThan(170);
    expect(g.w).toBeLessThan(190);
    // The glow: 4px 0 10px -2px.
    expect(g.shadow).toMatch(/4px 0px 10px -2px/);
  });

  test('the tail is as long as the fill, capped at 280px', async ({ page }) => {
    await setup(
      page,
      '<div style="width:600px"><prism-progress id="p" label="X" value="90"></prism-progress></div>',
    );
    const r = await page.locator('#p').evaluate((el) => {
      const fill = el.shadowRoot!.querySelector('[part="fill"]') as HTMLElement;
      // The tail layer is the middle one: its size is --_tail-w.
      const size = getComputedStyle(fill).backgroundSize;
      return { w: fill.getBoundingClientRect().width, size };
    });
    expect(r.w).toBeGreaterThan(500); // 90% of 600px
    expect(r.size.replace(/\s/g, '')).toBe(
      '100%100%,min(100%,280px)100%,100%100%',
    );
  });

  test('a tiny fill (< 24px) hides the tail; a normal one keeps it', async ({
    page,
  }) => {
    await setup(
      page,
      '<div style="width:300px"><prism-progress id="a" label="A" value="5"></prism-progress><prism-progress id="b" label="B" value="50"></prism-progress></div>',
    );
    const info = (id: string) =>
      page.locator(`#${id}`).evaluate((el) => {
        const fill = el.shadowRoot!.querySelector(
          '[part="fill"]',
        ) as HTMLElement;
        const cs = getComputedStyle(fill);
        return {
          w: fill.getBoundingClientRect().width,
          tail: cs.getPropertyValue('--_tail-layer').replace(/\s+/g, ' '),
          tiny: el.matches(':state(tiny)'),
        };
      });
    const a = await info('a');
    const b = await info('b');
    expect(a.w).toBeLessThan(24);
    expect(a.tiny).toBe(true);
    expect(a.tail).toContain('linear-gradient(transparent');
    expect(b.tiny).toBe(false);
    expect(b.tail).toContain('radial-gradient');
  });

  test('tiny follows the width: it clears when the bar grows', async ({
    page,
  }) => {
    await setup(
      page,
      '<div id="w" style="width:100px"><prism-progress id="p" label="A" value="20"></prism-progress></div>',
    );
    const tiny = () =>
      page.locator('#p').evaluate((el) => el.matches(':state(tiny)'));
    expect(await tiny()).toBe(true); // 20% of 100px is 20px
    await page.locator('#w').evaluate((el) => (el.style.width = '300px'));
    await expect.poll(tiny).toBe(false); // now 60px
  });

  test('a full bar drops the glow; a partial one keeps it; value 0 shows none', async ({
    page,
  }) => {
    await setup(
      page,
      '<prism-progress id="a" label="A" value="100"></prism-progress><prism-progress id="b" label="B" value="99"></prism-progress>',
    );
    const shadow = (id: string) =>
      page
        .locator(`#${id}`)
        .evaluate(
          (el) =>
            getComputedStyle(el.shadowRoot!.querySelector('[part="fill"]')!)
              .boxShadow,
        );
    expect(await shadow('a')).toBe('none');
    expect(await shadow('b')).toMatch(/4px 0px 10px -2px/);
    expect(
      await page.locator('#a').evaluate((el) => el.matches(':state(full)')),
    ).toBe(true);
  });

  test('indeterminate: the comet travels 1.6s on the settle curve', async ({
    page,
  }) => {
    await setup(
      page,
      '<prism-progress id="p" label="Loading"></prism-progress>',
    );
    const t = await page.locator('#p').evaluate((el) => {
      const a = el
        .shadowRoot!.querySelector('[part="fill"]')!
        .getAnimations()[0]!;
      const timing = a.effect!.getComputedTiming();
      const frames = (a.effect as KeyframeEffect).getKeyframes();
      return {
        d: timing.duration,
        e: frames[0]!.easing,
        i: timing.iterations,
      };
    });
    expect(t.d).toBe(1600);
    expect(t.e).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
    expect(t.i).toBe(Infinity);
  });

  test('reduced motion: indeterminate pulses opacity 0.6 to 1 over 2s, no travel', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(
      page,
      '<prism-progress id="p" label="Loading"></prism-progress><prism-progress id="q" label="Q" value="40"></prism-progress>',
    );
    const r = await page.locator('#p').evaluate((el) => {
      const f = el.shadowRoot!.querySelector('[part="fill"]') as HTMLElement;
      const a = f.getAnimations()[0]!;
      const frames = (a.effect as KeyframeEffect).getKeyframes();
      return {
        name: (a as CSSAnimation).animationName,
        d: a.effect!.getComputedTiming().duration,
        opacities: frames.map((k) => k.opacity),
        margin: parseFloat(getComputedStyle(f).marginInlineStart),
        trackW: el
          .shadowRoot!.querySelector('[part="track"]')!
          .getBoundingClientRect().width,
        props: frames
          .flatMap((k) => Object.keys(k))
          .filter((k) => k === 'marginInlineStart'),
      };
    });
    expect(r.name).toBe('prism-progress-pulse');
    expect(r.d).toBe(2000);
    expect(r.opacities).toEqual(['0.6', '1', '0.6']);
    expect(r.margin).toBeCloseTo(r.trackW * 0.3, 0); // parked, not travelling
    expect(r.props).toEqual([]);
    // A value change is instant: no transition on the fill.
    const q = await page.locator('#q').evaluate((el) => {
      const cs = getComputedStyle(
        el.shadowRoot!.querySelector('[part="fill"]')!,
      );
      return cs.transitionDuration;
    });
    expect(parseFloat(q)).toBe(0);
  });

  test('reduced motion: a value change is instant; only the unknown bar animates, by opacity', async ({
    page,
  }) => {
    await setup(
      page,
      '<prism-progress id="a" label="A" value="40"></prism-progress><prism-progress id="b" label="B"></prism-progress>',
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const [id, anim] of [
      ['a', 'none'],
      ['b', 'prism-progress-pulse'],
    ] as const) {
      const r = await page.locator(`#${id}`).evaluate((el) => {
        const cs = getComputedStyle(
          el.shadowRoot!.querySelector('[part="fill"]')!,
        );
        return { a: cs.animationName, t: cs.transitionDuration };
      });
      expect(r.a).toBe(anim);
      expect(r.t).toBe('0s');
    }
  });

  test('forced colors: the track keeps a visible border and the fill is Highlight', async ({
    page,
  }) => {
    await setup(
      page,
      '<prism-progress id="p" label="X" value="50"></prism-progress>',
    );
    await page.emulateMedia({ forcedColors: 'active' });
    const r = await page.locator('#p').evaluate((el) => {
      const cs = getComputedStyle(
        el.shadowRoot!.querySelector('[part="track"]')!,
      );
      const f = getComputedStyle(
        el.shadowRoot!.querySelector('[part="fill"]')!,
      );
      return { w: cs.borderTopWidth, img: f.backgroundImage };
    });
    expect(r.w).toBe('1px');
    expect(r.img).toBe('none');
  });
});
