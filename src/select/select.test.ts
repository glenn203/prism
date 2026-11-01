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

const valueOf = (page: Page) =>
  page
    .locator('prism-select')
    .evaluate((e: HTMLElement & { value: string }) => e.value);

const isOpen = (page: Page) =>
  page
    .locator('prism-select')
    .evaluate((el) =>
      el.shadowRoot!.querySelector('[part="trigger"]')!.matches(':open'),
    );

test('is a native select: labelled combobox, arrow keys open, skip disabled, Enter picks', async ({
  page,
}) => {
  await mount(page, `<prism-select label="Fruit">${OPTIONS}</prism-select>`);
  const box = page.getByRole('combobox', { name: 'Fruit' });
  expect(
    await page
      .locator('prism-select')
      .evaluate((el) => el.shadowRoot!.querySelector('select')?.id),
  ).toBe('control');
  await box.focus();
  expect(await isOpen(page)).toBe(false);
  await box.press('ArrowDown');
  expect(await isOpen(page)).toBe(true);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown'); // Cherry is disabled
  await page.keyboard.press('Enter');
  expect(await isOpen(page)).toBe(false);
  await expect(box).toBeFocused();
  expect(await valueOf(page)).toBe('date');
  await box.press('b'); // type-ahead picks Banana without opening
  expect(await valueOf(page)).toBe('banana');
});

test('pointer: click opens, click option selects and fires input and change once', async ({
  page,
}) => {
  await mount(page, `<prism-select label="Fruit">${OPTIONS}</prism-select>`);
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { seen: string[] }).seen = seen;
    for (const type of ['input', 'change'])
      document
        .querySelector('prism-select')!
        .addEventListener(type, (e) =>
          seen.push(`${type}:${e.target === e.currentTarget}`),
        );
  });
  await page.getByRole('combobox', { name: 'Fruit' }).click();
  expect(await isOpen(page)).toBe(true);
  await page.getByRole('option', { name: 'Banana' }).click();
  expect(await isOpen(page)).toBe(false);
  expect(
    await page.evaluate(() => (window as unknown as { seen: string[] }).seen),
  ).toEqual(['input:true', 'change:true']);
  expect(await valueOf(page)).toBe('banana');
});

test('showPicker() opens the popup', async ({ page }) => {
  await mount(page, `<prism-select label="Fruit">${OPTIONS}</prism-select>`);
  await page.getByRole('combobox', { name: 'Fruit' }).focus();
  await page
    .locator('prism-select')
    .evaluate((e: HTMLElement & { showPicker(): void }) => e.showPicker());
  expect(await isOpen(page)).toBe(true);
});

test('the placeholder shows while empty and can never be picked', async ({
  page,
}) => {
  await mount(
    page,
    `<prism-select label="Fruit" placeholder="Pick fruit">${OPTIONS}</prism-select>`,
  );
  const box = page.getByRole('combobox', { name: 'Fruit' });
  await expect(box).toHaveText(/Pick fruit/);
  await box.press('ArrowDown');
  await page.keyboard.press('Enter');
  expect(await valueOf(page)).toBe('apricot');
  await expect(box).not.toHaveText(/Pick fruit/);
});

test('options follow the prism-option children: added, disabled and renamed', async ({
  page,
}) => {
  await mount(page, `<prism-select label="Fruit">${OPTIONS}</prism-select>`);
  const names = () =>
    page
      .locator('prism-select')
      .evaluate((el) =>
        [
          ...el.shadowRoot!.querySelectorAll<HTMLOptionElement>(
            'option:not([hidden])',
          ),
        ].map((o) => `${o.text.trim()}${o.disabled ? ' (off)' : ''}`),
      );
  expect(await names()).toEqual(['Apricot', 'Banana', 'Cherry (off)', 'Date']);
  await page.evaluate(() => {
    const select = document.querySelector('prism-select')!;
    select
      .querySelector('[value="cherry"]')!
      .toggleAttribute('disabled', false);
    select.querySelector('[value="date"]')!.textContent = 'Dates';
    const fig = document.createElement('prism-option');
    fig.setAttribute('value', 'fig');
    fig.textContent = 'Fig';
    select.append(fig);
  });
  await expect
    .poll(names)
    .toEqual(['Apricot', 'Banana', 'Cherry', 'Dates', 'Fig']);
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
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Go' }).click();
  expect(await submitted(page)).toEqual({ fruit: 'apricot' });
  await page.getByRole('button', { name: 'Reset' }).click();
  expect(await valueOf(page)).toBe('');
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
  const box = page.getByRole('combobox', { name: 'Fruit' });
  await box.click({ force: true });
  expect(await isOpen(page)).toBe(false);
  await expect(box).toBeDisabled();
});

test('focus stays on the select after Escape, Enter and a click pick; Tab leaves it', async ({
  page,
}) => {
  await mount(
    page,
    `<prism-select label="Fruit">${OPTIONS}</prism-select><button id="next">next</button>`,
  );
  const box = page.getByRole('combobox', { name: 'Fruit' });
  await box.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(box).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(box).toBeFocused();
  await box.click();
  await page.getByRole('option', { name: 'Date' }).click();
  await expect(box).toBeFocused();
  expect(await valueOf(page)).toBe('date');
  await page.keyboard.press('Tab');
  await expect(page.locator('#next')).toBeFocused();
  expect(await isOpen(page)).toBe(false);
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

test('popup: elevated, and with reduced motion it only fades, in under a frame', async ({
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
  const popup = await page.locator('prism-select').evaluate((el) => {
    const s = getComputedStyle(
      el.shadowRoot!.querySelector('[part="trigger"]')!,
      '::picker(select)',
    );
    return {
      shadow: s.boxShadow,
      props: s.transitionProperty.split(', '),
      ms: s.transitionDuration.split(', ').map((d) => parseFloat(d)),
    };
  });
  expect(popup.shadow).not.toBe('none');
  expect(popup.props).toContain('opacity');
  // Motion tokens collapse to 0.01ms: the popup does not travel.
  for (const ms of popup.ms) expect(ms).toBeLessThan(0.001);
});

test('with motion allowed the popup grows out of the trigger on a transition', async ({
  page,
}) => {
  await mount(page, `<prism-select label="Fruit">${OPTIONS}</prism-select>`);
  await withTheme(page);
  await page.getByRole('combobox', { name: 'Fruit' }).click();
  const props = await page
    .locator('prism-select')
    .evaluate(
      (el) =>
        getComputedStyle(
          el.shadowRoot!.querySelector('[part="trigger"]')!,
          '::picker(select)',
        ).transitionProperty,
    );
  expect(props).toContain('transform');
  expect(props).toContain('opacity');
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
