import { expect, test, type Page } from '@playwright/test';
import { captureSubmit, mount, submitted } from '../../test/fixture.js';

const OPTIONS = `
  <prism-option value="apricot">Apricot</prism-option>
  <prism-option value="banana">Banana</prism-option>
  <prism-option value="cherry" disabled>Cherry</prism-option>
  <prism-option value="date">Date</prism-option>`;

const withTheme = async (page: Page) => {
  await page.addStyleTag({ path: 'src/tokens/tokens.css' });
  await page.addStyleTag({ path: 'src/theme/theme.css' });
};

const activeText = (page: Page) =>
  page.locator('prism-select').evaluate((el) => {
    const t = el.shadowRoot!.querySelector(
      '[part="trigger"]',
    ) as HTMLElement & {
      ariaActiveDescendantElement: Element | null;
    };
    return t.ariaActiveDescendantElement?.textContent ?? null;
  });

test('combobox is labelled, keyboard opens, navigates (skips disabled) and selects', async ({
  page,
}) => {
  await mount(page, `<prism-select label="Fruit">${OPTIONS}</prism-select>`);
  const box = page.getByRole('combobox', { name: 'Fruit' });
  await box.focus();
  await expect(box).toHaveAttribute('aria-expanded', 'false');
  await box.press('ArrowDown');
  await expect(box).toHaveAttribute('aria-expanded', 'true');
  expect(await activeText(page)).toBe('Apricot');
  await box.press('ArrowDown');
  await box.press('ArrowDown');
  expect(await activeText(page)).toBe('Date'); // Cherry is disabled
  await box.press('Home');
  expect(await activeText(page)).toBe('Apricot');
  await box.press('End');
  await box.press('Enter');
  await expect(box).toHaveAttribute('aria-expanded', 'false');
  await expect(box).toBeFocused();
  expect(
    await page
      .locator('prism-select')
      .evaluate((e: HTMLElement & { value: string }) => e.value),
  ).toBe('date');
  await box.press('ArrowDown');
  await box.press('Escape');
  expect(
    await page
      .locator('prism-select')
      .evaluate((e: HTMLElement & { value: string }) => e.value),
  ).toBe('date');
  await box.press('b'); // typeahead opens on Banana
  expect(await activeText(page)).toBe('Banana');
});

test('pointer: click opens, click option selects and fires change', async ({
  page,
}) => {
  await mount(page, `<prism-select label="Fruit">${OPTIONS}</prism-select>`);
  await page.evaluate(() => {
    document.querySelector('prism-select')!.addEventListener('change', () => {
      (window as unknown as { changed: number }).changed = 1;
    });
  });
  await page.getByRole('combobox', { name: 'Fruit' }).click();
  await page.getByRole('option', { name: 'Banana' }).click();
  expect(
    await page.evaluate(
      () => (window as unknown as { changed?: number }).changed,
    ),
  ).toBe(1);
  await expect(page.getByRole('option', { name: 'Banana' })).toBeHidden();
});

test('form: submits value, required blocks submit, reset restores', async ({
  page,
}) => {
  await mount(
    page,
    `<form><prism-select label="Fruit" name="fruit" required>${OPTIONS}<span slot="error">Pick one</span></prism-select><button>Go</button><button type="reset">Reset</button></form>`,
  );
  await captureSubmit(page);
  await page.getByRole('button', { name: 'Go' }).click();
  expect(await submitted(page)).toBeUndefined();
  const box = page.getByRole('combobox', { name: 'Fruit' });
  await expect(box).toHaveAttribute('aria-invalid', 'true');
  await box.focus();
  await box.press('ArrowDown');
  await box.press('Enter');
  await page.getByRole('button', { name: 'Go' }).click();
  expect(await submitted(page)).toEqual({ fruit: 'apricot' });
  await page.getByRole('button', { name: 'Reset' }).click();
  expect(
    await page
      .locator('prism-select')
      .evaluate((e: HTMLElement & { value: string }) => e.value),
  ).toBe('');
  await expect(box).toHaveAttribute('aria-invalid', 'false');
});

test('disabled: excluded from submit and does not open', async ({ page }) => {
  await mount(
    page,
    `<form><prism-select label="Fruit" name="fruit" value="apricot" disabled>${OPTIONS}</prism-select><button>Go</button></form>`,
  );
  await captureSubmit(page);
  await page.getByRole('button', { name: 'Go' }).click();
  expect(await submitted(page)).toEqual({});
  await page.getByRole('combobox', { name: 'Fruit' }).click({ force: true });
  await expect(page.getByRole('combobox', { name: 'Fruit' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});

test('error replaces helper text', async ({ page }) => {
  await mount(
    page,
    `<prism-select label="Fruit" required>${OPTIONS}<span slot="description">Ships Mondays</span><span slot="error">Pick one</span></prism-select>`,
  );
  const box = page.getByRole('combobox', { name: 'Fruit' });
  await expect(box).toHaveAccessibleDescription('Ships Mondays');
  await expect(page.getByText('Ships Mondays')).toBeVisible();
  await page
    .locator('prism-select')
    .evaluate((e: HTMLElement & { reportValidity(): boolean }) =>
      e.reportValidity(),
    );
  await expect(page.getByText('Pick one')).toBeVisible();
  await expect(page.getByText('Ships Mondays')).toBeHidden();
  await expect(box).toHaveAccessibleDescription('Pick one');
});

const errorAnimations = (page: Page) =>
  page
    .locator('prism-select')
    .evaluate(
      (el) =>
        el.shadowRoot!.querySelector('[part="error"]')!.getAnimations().length,
    );

test('error animation runs on invalid only, never on focus', async ({
  page,
}) => {
  await mount(
    page,
    `<prism-select label="Fruit" required>${OPTIONS}<span slot="error">Pick one</span></prism-select>`,
  );
  await withTheme(page);
  await page.getByRole('combobox', { name: 'Fruit' }).focus();
  expect(await errorAnimations(page)).toBe(0);
  await page
    .locator('prism-select')
    .evaluate((e: HTMLElement & { reportValidity(): boolean }) =>
      e.reportValidity(),
    );
  expect(await errorAnimations(page)).toBe(1);
  await page.waitForTimeout(400);
  await page.getByRole('combobox', { name: 'Fruit' }).blur();
  await page.getByRole('combobox', { name: 'Fruit' }).focus();
  expect(await errorAnimations(page)).toBe(0);
});

test('reduced motion: error has no animation; menu is an opacity-only ~0ms fade', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mount(
    page,
    `<prism-select label="Fruit" required>${OPTIONS}<span slot="error">Pick one</span></prism-select>`,
  );
  await withTheme(page);
  await page
    .locator('prism-select')
    .evaluate((e: HTMLElement & { reportValidity(): boolean }) =>
      e.reportValidity(),
    );
  expect(await errorAnimations(page)).toBe(0);
  await page.getByRole('combobox', { name: 'Fruit' }).click();
  const anims = await page.locator('prism-select').evaluate((el) =>
    el
      .shadowRoot!.querySelector('[part="listbox"]')!
      .getAnimations()
      .map((a) => {
        const fx = a.effect as KeyframeEffect;
        return {
          props: [
            ...new Set(
              fx
                .getKeyframes()
                .flatMap((k) =>
                  Object.keys(k).filter(
                    (p) =>
                      ![
                        'offset',
                        'easing',
                        'composite',
                        'computedOffset',
                      ].includes(p),
                  ),
                ),
            ),
          ],
          ms: Number(fx.getTiming().duration),
        };
      }),
  );
  // Motion tokens collapse to 0.01ms; nothing moves, only opacity.
  for (const a of anims) {
    expect(a.props).toEqual(['opacity']);
    expect(a.ms).toBeLessThan(1);
  }
});

test('menu uses elevation tokens and plays no CSS animation with motion allowed', async ({
  page,
}) => {
  await mount(page, `<prism-select label="Fruit">${OPTIONS}</prism-select>`);
  await withTheme(page);
  await page.getByRole('combobox', { name: 'Fruit' }).click();
  const r = await page.locator('prism-select').evaluate((el) => {
    const lb = el.shadowRoot!.querySelector('[part="listbox"]')!;
    return {
      css: lb.getAnimations().filter((a) => a instanceof CSSAnimation).length,
      shadow: getComputedStyle(lb).boxShadow,
    };
  });
  expect(r.css).toBe(0);
  expect(r.shadow).not.toBe('none');
});

test('attached error box is inset 8px on each side of the control', async ({
  page,
}) => {
  await mount(
    page,
    `<prism-select label="Fruit" required>${OPTIONS}<span slot="error">Pick one</span></prism-select>`,
  );
  await withTheme(page);
  const r = await page.locator('prism-select').evaluate(async (el) => {
    (el as HTMLElement & { reportValidity(): boolean }).reportValidity();
    await (el as HTMLElement & { updateComplete: Promise<unknown> })
      .updateComplete;
    const t = el
      .shadowRoot!.querySelector('[part="trigger"]')!
      .getBoundingClientRect();
    const e = el
      .shadowRoot!.querySelector('[part="error"]')!
      .getBoundingClientRect();
    return {
      left: e.left - t.left,
      right: t.right - e.right,
      tuck: t.bottom - e.top,
    };
  });
  expect(r.left).toBeCloseTo(8, 0);
  expect(r.right).toBeCloseTo(8, 0);
  // Attached: starts under the control's bottom edge, no gap.
  expect(r.tuck).toBeGreaterThan(0);
});

const errorBox = (page: Page, tag: string) =>
  page.locator(tag).evaluate(async (el) => {
    const host = el as HTMLElement & {
      reportValidity(): boolean;
      updateComplete: Promise<unknown>;
    };
    host.reportValidity();
    await host.updateComplete;
    const ctl = el.shadowRoot!.querySelector(
      '[part="trigger"], [part="input"]',
    )!;
    const box = el.shadowRoot!.querySelector('[part="error"]')!;
    const desc = el.shadowRoot!.querySelector('[part="description"]')!;
    const t = ctl.getBoundingClientRect();
    const e = box.getBoundingClientRect();
    const cs = getComputedStyle(box);
    return {
      shadow: cs.boxShadow,
      bg: cs.backgroundColor,
      fontSize: cs.fontSize,
      left: e.left - t.left,
      right: t.right - e.right,
      tuck: t.bottom - e.top,
      helperHidden: desc.hasAttribute('hidden'),
      letterSpacing: cs.letterSpacing,
      weight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      radii: [
        cs.borderTopLeftRadius,
        cs.borderTopRightRadius,
        cs.borderBottomRightRadius,
        cs.borderBottomLeftRadius,
      ],
      padding: [
        cs.paddingTop,
        cs.paddingRight,
        cs.paddingBottom,
        cs.paddingLeft,
      ],
      overlap: cs.marginTop,
    };
  });

for (const tag of ['prism-select', 'prism-text-field']) {
  test(`${tag}: flat attached error box (no shadow, inset 8px, tucked, replaces helper)`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const inner = tag === 'prism-select' ? OPTIONS : '';
    await mount(
      page,
      `<${tag} label="Fruit" required>${inner}<span slot="description">Help</span><span slot="error">Pick one</span></${tag}>`,
    );
    await withTheme(page);
    const r = await errorBox(page, tag);
    expect(r.shadow).toBe('none');
    expect(r.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(r.fontSize).toBe('12px');
    expect(r.left).toBeCloseTo(8, 0);
    expect(r.right).toBeCloseTo(8, 0);
    expect(r.tuck).toBeGreaterThan(0);
    expect(r.helperHidden).toBe(true);
    // Attached error box values.
    expect(r.letterSpacing).toBe('normal');
    expect(r.weight).toBe('400');
    expect(r.lineHeight).toBe('16px');
    expect(r.radii).toEqual(['0px', '0px', '8px', '8px']);
    expect(r.padding).toEqual(['7px', '8px', '3px', '8px']);
    expect(r.overlap).toBe('-2px');
  });
}

test('select focus matches text field focus (outer ring), incl. invalid', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mount(
    page,
    `<prism-text-field label="Name" required></prism-text-field><prism-select label="Fruit" required>${OPTIONS}</prism-select>`,
  );
  await withTheme(page);
  const shadow = async (focus: () => Promise<void>, sel: string) => {
    await focus();
    return page.evaluate(
      (s) =>
        getComputedStyle(
          document
            .querySelector(s.split('|')[0]!)!
            .shadowRoot!.querySelector(s.split('|')[1]!)!,
        ).boxShadow,
      sel,
    );
  };
  const tf = await shadow(
    () => page.getByRole('textbox', { name: 'Name' }).focus(),
    'prism-text-field|[part="input"]',
  );
  const se = await shadow(
    () => page.getByRole('combobox', { name: 'Fruit' }).focus(),
    'prism-select|[part="trigger"]',
  );
  // The ring is outside the border; the one inset layer is the border line.
  expect(tf.match(/inset/g)).toHaveLength(1);
  expect(se).toBe(tf);
  await page.evaluate(() =>
    document
      .querySelectorAll('prism-text-field, prism-select')
      .forEach((e) =>
        (e as HTMLElement & { reportValidity(): boolean }).reportValidity(),
      ),
  );
  const tfi = await shadow(
    () => page.getByRole('textbox', { name: 'Name' }).focus(),
    'prism-text-field|[part="input"]',
  );
  const sei = await shadow(
    () => page.getByRole('combobox', { name: 'Fruit' }).focus(),
    'prism-select|[part="trigger"]',
  );
  expect(sei).toBe(tfi);
  expect(sei).not.toBe(se);
});

for (const tag of ['prism-select', 'prism-text-field']) {
  test(`${tag}: 2px label gap, 4px description gap, focus reach clears error text`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const inner = tag === 'prism-select' ? OPTIONS : '';
    await mount(
      page,
      `<${tag} label="Fruit" required>${inner}<span slot="description">Help</span><span slot="error">Pick one</span></${tag}>`,
    );
    await withTheme(page);
    const g = await page.locator(tag).evaluate(async (el) => {
      const root = el.shadowRoot!;
      const q = (s: string) => root.querySelector(s)!.getBoundingClientRect();
      const ctl = q('[part="trigger"], [part="input"]');
      const reach =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            '--prism-focus-ring-offset',
          ),
        ) +
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            '--prism-focus-ring-width',
          ),
        ) +
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            '--prism-focus-halo-width',
          ),
        );
      const label = q('[part="label"]');
      const desc = q('[part="description"]');
      const host = el as HTMLElement & {
        reportValidity(): boolean;
        updateComplete: Promise<unknown>;
      };
      host.reportValidity();
      await host.updateComplete;
      // Top of the error text's line box (box top + padding-top).
      const errBox = root.querySelector('[part="error"]')!;
      const errTop =
        errBox.getBoundingClientRect().top +
        parseFloat(getComputedStyle(errBox).paddingTop);
      return {
        reach,
        labelGap: ctl.top - label.bottom,
        descGap: desc.top - ctl.bottom,
        errGap: errTop - ctl.bottom,
      };
    });
    expect(g.reach).toBeLessThanOrEqual(4);
    expect(g.labelGap).toBeCloseTo(2, 0);
    expect(g.descGap).toBeCloseTo(4, 0);
    // Mock spec: 2px label gap, so the 4px ring overlaps 2px into the
    // label's line box (accepted; glyphs sit lower in the 20px line).
    expect(g.descGap).toBeGreaterThanOrEqual(g.reach);
    expect(g.errGap).toBeGreaterThan(g.reach);
    expect(g.errGap).toBeLessThanOrEqual(6.5);
  });
}

for (const tag of ['prism-select', 'prism-text-field']) {
  test(`${tag}: error text is centered in the visible 24px box and clears the ring`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const inner = tag === 'prism-select' ? OPTIONS : '';
    await mount(
      page,
      `<${tag} label="Fruit" required>${inner}<span slot="error">Enter an email address.</span></${tag}>`,
    );
    await withTheme(page);
    const m = await page.locator(tag).evaluate(async (el) => {
      await document.fonts.ready;
      const host = el as HTMLElement & {
        reportValidity(): boolean;
        updateComplete: Promise<unknown>;
      };
      host.reportValidity();
      await host.updateComplete;
      const root = el.shadowRoot!;
      const ctl = root
        .querySelector('[part="trigger"], [part="input"]')!
        .getBoundingClientRect();
      const box = root.querySelector('[part="error"]')!.getBoundingClientRect();
      const span = el.querySelector('[slot="error"]')!;
      const range = document.createRange();
      range.selectNodeContents(span);
      const g = range.getBoundingClientRect();
      return {
        total: box.height,
        visible: box.bottom - ctl.bottom,
        glyphTop: g.top - ctl.bottom,
        glyphBottom: box.bottom - g.bottom,
      };
    });
    expect(m.total).toBeCloseTo(26, 0);
    expect(m.visible).toBeCloseTo(24, 0);
    expect(m.glyphTop).toBeGreaterThanOrEqual(5); // clears the 4px focus reach by 1px
    expect(Math.abs(m.glyphTop - m.glyphBottom)).toBeLessThanOrEqual(1.5);
  });
}

test('hover and keyboard-active are one sliding marker in the shared hover tint, no shadow; the option paints nothing of its own', async ({
  page,
}) => {
  await mount(page, `<prism-select label="Fruit">${OPTIONS}</prism-select>`);
  await withTheme(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const read = (v: string) =>
    page.locator('prism-select').evaluate((el, v) => {
      const o = el.querySelector(`prism-option[value="${v}"]`)!;
      const base = getComputedStyle(
        o.shadowRoot!.querySelector('[part="base"]')!,
      );
      const marker = el.shadowRoot!.querySelector('[part="highlight"]')!;
      const m = getComputedStyle(marker);
      const probe = document.createElement('div');
      probe.style.color =
        'color-mix(in srgb, var(--prism-color-text) var(--prism-state-hover), transparent)';
      document.body.append(probe);
      const want = getComputedStyle(probe).color;
      probe.remove();
      const mr = marker.getBoundingClientRect();
      const or = o.getBoundingClientRect();
      return {
        shadow: m.boxShadow,
        marker: m.backgroundColor,
        want,
        own: base.backgroundImage,
        dy: Math.abs(mr.top - or.top),
        dh: Math.abs(mr.height - or.height),
        opacity: m.opacity,
      };
    }, v);
  await page.getByRole('combobox', { name: 'Fruit' }).click();
  await page.locator('prism-option[value="banana"]').hover();
  const hover = await read('banana');
  expect(hover.shadow).toBe('none');
  expect(hover.marker).toBe(hover.want);
  expect(hover.own).toBe('linear-gradient(rgba(0, 0, 0, 0), rgba(0, 0, 0, 0))');
  expect(hover.dy).toBeLessThan(1);
  expect(hover.dh).toBeLessThan(1);
  expect(hover.opacity).toBe('1');
  await page.mouse.move(0, 0);
  await page.getByRole('combobox', { name: 'Fruit' }).press('End');
  const active = await read('date');
  expect(active.marker).toBe(active.want);
  expect(active.dy).toBeLessThan(1);
});

test('select error box matches the text field error box exactly', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mount(
    page,
    `<div style="display:grid;grid-template-columns:240px 240px;gap:40px">
      <prism-text-field label="Fruit" required><span slot="description">Help</span><span slot="error">Pick one</span></prism-text-field>
      <prism-select label="Fruit" required>${OPTIONS}<span slot="description">Help</span><span slot="error">Pick one</span></prism-select>
    </div>`,
  );
  await withTheme(page);
  const measure = (tag: string) =>
    page.locator(tag).evaluate(async (el) => {
      await document.fonts.ready;
      const host = el as HTMLElement & {
        reportValidity(): boolean;
        updateComplete: Promise<unknown>;
      };
      host.reportValidity();
      await host.updateComplete;
      const root = el.shadowRoot!;
      const ctlEl = root.querySelector('[part="trigger"], [part="input"]')!;
      const ctl = ctlEl.getBoundingClientRect();
      const boxEl = root.querySelector('[part="error"]')!;
      const b = boxEl.getBoundingClientRect();
      const cs = getComputedStyle(boxEl);
      const range = document.createRange();
      range.selectNodeContents(el.querySelector('[slot="error"]')!);
      const g = range.getBoundingClientRect();
      const props = [
        'background-color',
        'color',
        'font-size',
        'font-weight',
        'line-height',
        'letter-spacing',
        'padding-top',
        'padding-right',
        'padding-bottom',
        'padding-left',
        'margin-top',
        'border-top-left-radius',
        'border-top-right-radius',
        'border-bottom-left-radius',
        'border-bottom-right-radius',
        'box-shadow',
      ];
      return {
        rect: {
          left: b.left - ctl.left,
          right: ctl.right - b.right,
          top: b.top - ctl.bottom,
          height: b.height,
          visible: b.bottom - ctl.bottom,
          glyphTop: g.top - ctl.bottom,
        },
        ctlBottomRadius: getComputedStyle(ctlEl).borderBottomLeftRadius,
        styles: Object.fromEntries(
          props.map((p) => [p, cs.getPropertyValue(p)]),
        ),
      };
    });
  const tf = await measure('prism-text-field');
  const se = await measure('prism-select');
  expect(se).toEqual(tf);
  // reportValidity() focuses the control; compare unfocused boxes.
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.mouse.move(0, 0);
  const shot = async (tag: string) =>
    (await page.locator(tag).locator('[part="error"]').screenshot()).toString(
      'base64',
    );
  // Pixel diff in a canvas; allow 2/255 per channel for corner anti-aliasing.
  const diff = await page.evaluate(
    async ([a, b]) => {
      const load = async (src: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${src}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        return {
          w: img.width,
          h: img.height,
          d: ctx.getImageData(0, 0, img.width, img.height).data,
        };
      };
      const [x, y] = [await load(a!), await load(b!)];
      if (x.w !== y.w || x.h !== y.h) return { size: false, over: -1, max: -1 };
      let over = 0;
      let max = 0;
      for (let i = 0; i < x.d.length; i++) {
        const v = Math.abs(x.d[i]! - y.d[i]!);
        max = Math.max(max, v);
        if (v > 2) over++;
      }
      return { size: true, over, max };
    },
    [await shot('prism-select'), await shot('prism-text-field')],
  );
  expect(diff.size).toBe(true);
  expect(diff.over).toBe(0);
});

for (const tag of ['prism-text-field', 'prism-select']) {
  test(`${tag}: error box flares out from under the control (concave top fillets)`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const inner = tag === 'prism-select' ? OPTIONS : '';
    await mount(
      page,
      `<div style="padding:20px;inline-size:240px"><${tag} label="Fruit" required>${inner}<span slot="error">Pick one</span></${tag}></div>`,
    );
    await withTheme(page);
    const geo = await page.locator(tag).evaluate(async (el) => {
      const host = el as HTMLElement & {
        reportValidity(): boolean;
        updateComplete: Promise<unknown>;
      };
      host.reportValidity();
      await host.updateComplete;
      (document.activeElement as HTMLElement | null)?.blur();
      const root = el.shadowRoot!;
      const ctl = root
        .querySelector('[part="trigger"], [part="input"]')!
        .getBoundingClientRect();
      const box = root.querySelector('[part="error"]')!;
      const before = getComputedStyle(box, '::before');
      const after = getComputedStyle(box, '::after');
      return {
        ctlBottom: ctl.bottom,
        boxLeft: box.getBoundingClientRect().left,
        boxRight: box.getBoundingClientRect().right,
        pseudo: [before, after].map((p) => ({
          content: p.content,
          bg: p.backgroundColor,
          size: [p.width, p.height],
          mask: p.maskImage.startsWith('radial-gradient'),
        })),
        fill: getComputedStyle(box).backgroundColor,
      };
    });
    for (const p of geo.pseudo) {
      expect(p.content).toBe('""');
      expect(p.bg).toBe(geo.fill);
      expect(p.size).toEqual(['5px', '5px']);
      expect(p.mask).toBe(true);
    }
    // Pixels: tinted right under the control edge just outside the box side,
    // white 4px lower (the fillet curves back into the box).
    await page.mouse.move(0, 0);
    const shot = await page.screenshot({
      clip: { x: 0, y: 0, width: 300, height: 200 },
    });
    const px = await page.evaluate(
      async ([b64, pts]) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        return (pts as unknown as number[][]).map(([x, y]) => [
          ...ctx.getImageData(x!, y!, 1, 1).data,
        ]);
      },
      [
        shot.toString('base64'),
        [
          [Math.floor(geo.boxLeft) - 1, Math.ceil(geo.ctlBottom)],
          [Math.floor(geo.boxLeft) - 1, Math.ceil(geo.ctlBottom) + 4],
          [Math.ceil(geo.boxRight), Math.ceil(geo.ctlBottom)],
        ],
      ] as const,
    );
    expect(px[0]![1]).toBeLessThan(250); // tinted (green channel drops)
    expect(px[1]!.slice(0, 3)).toEqual([255, 255, 255]);
    expect(px[2]![1]).toBeLessThan(250);
  });
}

test('open listbox tucks 3px under the trigger (trigger on top), inset 6px', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mount(
    page,
    `<div style="inline-size:280px"><prism-select label="Fruit">${OPTIONS}<span slot="description">Help</span></prism-select></div>`,
  );
  await withTheme(page);
  await page.getByRole('combobox', { name: 'Fruit' }).click();
  const g = await page.locator('prism-select').evaluate((el) => {
    const r = el.shadowRoot!;
    const trig = r.querySelector('[part="trigger"]')!;
    const lb = r.querySelector('[part="listbox"]')!;
    const t = trig.getBoundingClientRect();
    const l = lb.getBoundingClientRect();
    const cs = getComputedStyle(lb);
    const probe = document.createElement('div');
    probe.style.color = 'var(--prism-color-slate-400)';
    document.body.append(probe);
    const slate400 = getComputedStyle(probe).color;
    probe.remove();
    const hit = r.elementFromPoint(t.left + t.width / 2, t.bottom - 1.5);
    return {
      overlap: t.bottom - l.top,
      left: l.left - t.left,
      right: t.right - l.right,
      trigZ: Number(getComputedStyle(trig).zIndex),
      lbZ: Number(cs.zIndex),
      radii: [
        cs.borderTopLeftRadius,
        cs.borderTopRightRadius,
        cs.borderBottomRightRadius,
        cs.borderBottomLeftRadius,
      ],
      padding: [
        cs.paddingTop,
        cs.paddingRight,
        cs.paddingBottom,
        cs.paddingLeft,
      ],
      border: cs.borderTopColor,
      slate400,
      shadow: cs.boxShadow,
      trigBg: getComputedStyle(trig).backgroundColor,
      topHit: hit === trig,
      popover: lb.hasAttribute('popover'),
    };
  });
  expect(g.overlap).toBeCloseTo(3, 0);
  expect(g.left).toBeCloseTo(6, 0);
  expect(g.right).toBeCloseTo(6, 0);
  expect(g.trigZ).toBeGreaterThan(g.lbZ);
  expect(g.topHit).toBe(true);
  expect(g.radii).toEqual(['0px', '0px', '7px', '7px']);
  expect(g.padding).toEqual(['4px', '2px', '4px', '2px']);
  expect(g.border).toBe(g.slate400);
  expect(g.shadow).not.toBe('none');
  expect(g.trigBg).toBe('oklch(1 0 260)'); // opaque white (color-bg)
  expect(g.popover).toBe(false); // in-page, not top layer
});

test('description is hidden (space kept) while open, shown on close', async ({
  page,
}) => {
  await mount(
    page,
    `<prism-select label="Fruit">${OPTIONS}<span slot="description">We ship on Mondays.</span></prism-select><p id="after">x</p>`,
  );
  await withTheme(page);
  const read = () =>
    page.locator('prism-select').evaluate((el) => {
      const d = el.shadowRoot!.querySelector('[part="description"]')!;
      return {
        vis: getComputedStyle(d).visibility,
        h: d.getBoundingClientRect().height,
        after: document.querySelector('#after')!.getBoundingClientRect().top,
      };
    });
  const before = await read();
  expect(before.vis).toBe('visible');
  const cb = page.getByRole('combobox', { name: 'Fruit' });
  await expect(cb).toHaveAccessibleDescription('We ship on Mondays.');
  await cb.click();
  const open = await read();
  expect(open.vis).toBe('hidden');
  expect(open.h).toBe(before.h);
  expect(open.after).toBe(before.after);
  await expect(cb).toHaveAccessibleDescription('We ship on Mondays.');
  await page.keyboard.press('Escape');
  expect((await read()).vis).toBe('visible');
});

const ERR_SELECT = `<prism-select label="Fruit" required placeholder="Pick">${OPTIONS}<span slot="description">We ship on Mondays.</span><span slot="error">Choose a fruit.</span></prism-select><button id="next">next</button>`;
async function erroredOpen(page: Page, density = 'default', size = 'md') {
  await mount(
    page,
    `<div data-prism-density="${density}">${ERR_SELECT.replace('<prism-select', `<prism-select size="${size}"`)}</div>`,
  );
  await withTheme(page);
  await page
    .locator('prism-select')
    .evaluate((e: HTMLElement & { reportValidity(): boolean }) =>
      e.reportValidity(),
    );
}
const geom = (page: Page) =>
  page.locator('prism-select').evaluate((el) => {
    const r = el.shadowRoot!;
    const q = (p: string) => r.querySelector(`[part="${p}"]`)!;
    const t = q('trigger').getBoundingClientRect();
    const l = q('listbox').getBoundingClientRect();
    const e = q('error').getBoundingClientRect();
    return {
      gap: t.bottom - l.top,
      left: l.left - t.left,
      errVis: getComputedStyle(q('error')).visibility,
      errH: e.height,
      errTop: e.top,
      coversErr: l.top <= e.top && l.bottom >= e.bottom,
      hitInErr:
        r.elementFromPoint(e.left + e.width / 2, e.top + e.height / 2) ===
        q('error'),
    };
  });

for (const density of ['compact', 'default', 'comfortable'])
  for (const size of ['sm', 'md', 'lg'])
    test(`error + open (${density}/${size}): listbox tucks 3px under trigger, covers the hidden error`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await erroredOpen(page, density, size);
      const closed = await geom(page);
      expect(closed.errVis).toBe('visible');
      const cb = page.getByRole('combobox', { name: 'Fruit' });
      await cb.click();
      const g = await geom(page);
      expect(g.gap).toBeCloseTo(3, 0);
      expect(g.left).toBeCloseTo(6, 0);
      expect(g.coversErr).toBe(true);
      expect(g.hitInErr).toBe(false);
      expect(g.errVis).toBe('hidden');
      expect(g.errH).toBe(closed.errH); // space kept
      expect(g.errTop).toBe(closed.errTop);
      await expect(cb).toHaveAccessibleDescription('Choose a fruit.');
      await page.keyboard.press('Escape');
      expect((await geom(page)).errVis).toBe('visible');
    });

test('no error: listbox still tucks 3px under trigger with and without description', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const desc of ['<span slot="description">Help</span>', '']) {
    await mount(
      page,
      `<prism-select label="Fruit">${OPTIONS}${desc}</prism-select>`,
    );
    await withTheme(page);
    await page.getByRole('combobox', { name: 'Fruit' }).click();
    expect((await geom(page)).gap).toBeCloseTo(3, 0);
  }
});

const focusState = (page: Page) =>
  page.locator('prism-select').evaluate((el) => {
    const t = el.shadowRoot!.querySelector<HTMLElement>('[part="trigger"]')!;
    return {
      onTrigger: el.shadowRoot!.activeElement === t,
      ring: getComputedStyle(t).boxShadow,
      open: el.hasAttribute('open'),
    };
  });

test('focus returns to the trigger with the ring on Escape, Enter and click selection', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mount(
    page,
    `<prism-select label="Fruit">${OPTIONS}</prism-select><button id="next">next</button>`,
  );
  await withTheme(page);
  const cb = page.getByRole('combobox', { name: 'Fruit' });
  const restRing = await focusState(page).then((s) => s.ring);
  // Keyboard: Escape
  await cb.focus();
  await page.keyboard.press('ArrowDown');
  expect((await focusState(page)).open).toBe(true);
  await page.keyboard.press('Escape');
  let s = await focusState(page);
  expect(s).toMatchObject({ onTrigger: true, open: false });
  expect(s.ring).not.toBe(restRing);
  // Keyboard: Enter selects
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  s = await focusState(page);
  expect(s).toMatchObject({ onTrigger: true, open: false });
  expect(s.ring).not.toBe(restRing);
  // Mouse: option pointerdown never takes focus; selection leaves it on trigger.
  await cb.click();
  await page.locator('prism-option[value="banana"]').click();
  s = await focusState(page);
  expect(s).toMatchObject({ onTrigger: true, open: false });
  expect(s.ring).not.toBe(restRing); // ring shows after click selection too (:focus)
  await expect(page.locator('prism-select')).toHaveJSProperty(
    'value',
    'banana',
  );
});

test('Tab out closes and moves on; outside click does not steal focus back', async ({
  page,
}) => {
  await mount(
    page,
    `<prism-select label="Fruit">${OPTIONS}</prism-select><button id="next">next</button>`,
  );
  await withTheme(page);
  const cb = page.getByRole('combobox', { name: 'Fruit' });
  await cb.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Tab');
  await expect(page.locator('#next')).toBeFocused();
  expect((await focusState(page)).open).toBe(false);
  await cb.click();
  await page.mouse.click(5, 400);
  const s = await focusState(page);
  expect(s).toMatchObject({ onTrigger: false, open: false });
  expect(await page.evaluate(() => document.activeElement?.localName)).toBe(
    'body',
  );
});
