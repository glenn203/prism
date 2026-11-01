import { expect, test, type Page } from '@playwright/test';
import { axe } from '../../test/axe.js';
import { captureSubmit, mount, submitted } from '../../test/fixture.js';
import { animsOn, maxStep, recordFrames, wait } from '../../test/field.js';
import { mouseDown, scaleOf } from '../../test/press.js';

async function setup(page: Page, markup: string, theme = 'light') {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await mount(page, markup);
  await page.addStyleTag({ path: 'src/tokens/tokens.css' });
  await page.addStyleTag({ path: 'src/theme/theme.css' });
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-prism-theme', t);
    document.body.style.background = 'var(--prism-color-bg)';
    document.body.style.color = 'var(--prism-color-text)';
  }, theme);
  await wait(page, 600);
  return errors;
}

const RANGE = (extra = '', value = 'week') => `
  <prism-segmented-control id="s" label="Range" value="${value}" ${extra}>
    <prism-segment value="day">Day</prism-segment>
    <prism-segment value="week">Week</prism-segment>
    <prism-segment value="month">Month</prism-segment>
    <prism-segment value="year" disabled>Year</prism-segment>
  </prism-segmented-control>`;
const SEVEN = `
  <prism-segmented-control id="s" label="Range" value="a" style="width:520px" full-width>
    <prism-segment value="a">Short</prism-segment>
    <prism-segment value="b">A much longer label</prism-segment>
    <prism-segment value="c">Mid</prism-segment>
  </prism-segmented-control>`;

const WEBKIT_NO_WRAP =
  'WebKit radios do not wrap at the ends or flip for right-to-left, in plain HTML too';

const s = (page: Page) => page.locator('#s');
const seg = (page: Page, v: string) =>
  page.locator(`#s prism-segment[value=${v}]`);
const radio = (page: Page, name: string) =>
  page.getByRole('radio', { name, exact: true });
const value = (page: Page) =>
  s(page).evaluate((e) => (e as unknown as { value: string }).value);

/** Indicator rect and the picked segment's rect, in page pixels. */
const rects = (page: Page, v: string) =>
  s(page).evaluate((e, v) => {
    const i = e
      .shadowRoot!.querySelector('[part="indicator"]')!
      .getBoundingClientRect();
    const g = e
      .querySelector(`prism-segment[value="${v}"]`)!
      .assignedSlot!.parentElement!.getBoundingClientRect();
    return {
      il: i.left,
      ir: i.right,
      sl: g.left,
      sr: g.right,
      opacity: Number(
        getComputedStyle(e.shadowRoot!.querySelector('[part="indicator"]')!)
          .opacity,
      ),
    };
  }, v);

test.describe('prism-segmented-control: semantics', () => {
  test('a fieldset named by its legend, with a native radio and label per segment, and no role or aria-checked from script', async ({
    page,
  }) => {
    const errors = await setup(page, RANGE());
    expect(errors).toEqual([]);
    await expect(page.getByRole('group', { name: 'Range' })).toHaveCount(1);
    await expect(page.getByRole('radio')).toHaveCount(4);
    await expect(radio(page, 'Week')).toBeChecked();
    await expect(radio(page, 'Day')).not.toBeChecked();
    const dom = await s(page).evaluate((e) => {
      const root = e.shadowRoot!;
      const inputs = [...root.querySelectorAll('input')];
      return {
        fieldset: root.querySelector('fieldset > legend') !== null,
        types: inputs.map((i) => i.type),
        names: new Set(inputs.map((i) => i.name)).size,
        labelled: inputs.every((i) => i.closest('label') !== null),
        scripted: root.querySelectorAll('[role], [aria-checked]').length,
      };
    });
    expect(dom).toEqual({
      fieldset: true,
      types: ['radio', 'radio', 'radio', 'radio'],
      names: 1,
      labelled: true,
      scripted: 0,
    });
  });

  test('hide-label keeps the name for assistive technology and hides it from sight', async ({
    page,
  }) => {
    await setup(page, RANGE('hide-label'));
    await expect(page.getByRole('group', { name: 'Range' })).toHaveCount(1);
    const box = await s(page).evaluate(
      (e) =>
        e.shadowRoot!.querySelector('[part="label"]')!.getBoundingClientRect()
          .width,
    );
    expect(box).toBeLessThanOrEqual(1);
  });

  test('one tab stop: the picked segment, else the first enabled; Tab leaves the group', async ({
    page,
  }) => {
    await setup(
      page,
      `<button id="before">b</button>${RANGE()}<button id="after">a</button>`,
    );
    await page.locator('#before').focus();
    await page.keyboard.press('Tab');
    await expect(radio(page, 'Week')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#after')).toBeFocused();
    await setup(
      page,
      `<button id="before">b</button>${RANGE('', '')}<button id="after">a</button>`,
    );
    await page.locator('#before').focus();
    await page.keyboard.press('Tab');
    await expect(radio(page, 'Day')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#after')).toBeFocused();
  });

  test('arrows move focus and pick', async ({ page }) => {
    await setup(page, RANGE());
    await radio(page, 'Week').focus();
    await page.keyboard.press('ArrowRight');
    await expect(radio(page, 'Month')).toBeFocused();
    expect(await value(page)).toBe('month');
    await page.keyboard.press('ArrowLeft');
    expect(await value(page)).toBe('week');
    await page.keyboard.press('ArrowDown');
    expect(await value(page)).toBe('month');
    await page.keyboard.press('ArrowUp');
    expect(await value(page)).toBe('week');
  });

  test('arrows wrap round the ends and skip a disabled segment', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', WEBKIT_NO_WRAP);
    await setup(page, RANGE());
    await radio(page, 'Month').focus();
    await page.keyboard.press('ArrowDown'); // skips disabled Year, wraps to Day
    await expect(radio(page, 'Day')).toBeFocused();
    expect(await value(page)).toBe('day');
    await page.keyboard.press('ArrowLeft'); // wraps back to Month
    expect(await value(page)).toBe('month');
  });

  test('Space picks the focused segment', async ({ page }) => {
    await setup(page, RANGE());
    await seg(page, 'month').evaluate((e) => (e as HTMLElement).focus());
    await page.keyboard.press(' ');
    expect(await value(page)).toBe('month');
  });

  test('right-to-left: Left and Right swap', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', WEBKIT_NO_WRAP);
    await setup(page, `<div dir="rtl">${RANGE()}</div>`);
    await radio(page, 'Week').focus();
    await page.keyboard.press('ArrowLeft');
    expect(await value(page)).toBe('month');
    await page.keyboard.press('ArrowRight');
    expect(await value(page)).toBe('week');
  });

  test('right-to-left: the order is mirrored', async ({ page }) => {
    await setup(page, `<div dir="rtl">${RANGE()}</div>`);
    const x = await s(page).evaluate((e) =>
      ['day', 'month'].map(
        (v) =>
          e.querySelector(`prism-segment[value=${v}]`)!.getBoundingClientRect()
            .x,
      ),
    );
    expect(x[0]).toBeGreaterThan(x[1]!);
  });

  test('a disabled segment cannot be picked; a disabled control picks nothing and disables its segments', async ({
    page,
  }) => {
    await setup(
      page,
      RANGE() +
        `<prism-segmented-control id="d" label="Off" value="a" disabled><prism-segment value="a">A</prism-segment><prism-segment value="b">B</prism-segment></prism-segmented-control>`,
    );
    await seg(page, 'year').evaluate((e) => (e as HTMLElement).click());
    expect(await value(page)).toBe('week');
    await radio(page, 'B').click({ force: true });
    expect(
      await page
        .locator('#d')
        .evaluate((e) => (e as unknown as { value: string }).value),
    ).toBe('a');
    await expect(radio(page, 'A')).toBeDisabled();
  });

  test('segments take icons and text; an icon-only segment is named by `label`', async ({
    page,
  }) => {
    const errors = await setup(
      page,
      `<prism-segmented-control id="s" label="View" value="list" hide-label>
      <prism-segment value="list" label="List"><svg slot="icon" viewBox="0 0 16 16"><path d="M3 4h10" stroke="currentColor"/></svg></prism-segment>
      <prism-segment value="grid"><svg slot="icon" viewBox="0 0 16 16"><path d="M3 8h10" stroke="currentColor"/></svg>Grid</prism-segment>
    </prism-segmented-control>`,
    );
    expect(errors).toEqual([]);
    await expect(radio(page, 'List')).toHaveCount(1);
    await expect(radio(page, 'Grid')).toHaveCount(1);
    const icons = await s(page).evaluate((e) =>
      [...e.querySelectorAll('prism-segment')].map(
        (g) =>
          g.shadowRoot!.querySelector('[part="icon"]')!.getBoundingClientRect()
            .width,
      ),
    );
    expect(icons.every((w) => w >= 15)).toBe(true);
    const bad = await setup(
      page,
      `<prism-segmented-control label="V"><prism-segment value="a"><svg slot="icon" viewBox="0 0 16 16"></svg></prism-segment></prism-segmented-control>`,
    );
    await wait(page, 100);
    expect(bad.some((m) => m.includes('icon-only segment needs `label`'))).toBe(
      true,
    );
  });

  test('sizes follow the control heights: sm 32, md 36, lg 44', async ({
    page,
  }) => {
    await setup(
      page,
      ['sm', 'md', 'lg']
        .map((z) => RANGE(`size="${z}"`).replace('id="s"', `id="${z}"`))
        .join(''),
    );
    const h = await page.evaluate(() =>
      ['sm', 'md', 'lg'].map(
        (z) =>
          document
            .querySelector(`#${z}`)!
            .shadowRoot!.querySelector('[part="track"]')!
            .getBoundingClientRect().height,
      ),
    );
    expect(h).toEqual([32, 36, 44]);
  });

  test('full-width shares the row equally', async ({ page }) => {
    await setup(page, SEVEN);
    const w = await s(page).evaluate((e) =>
      [...e.shadowRoot!.querySelectorAll('label')].map(
        (l) => l.getBoundingClientRect().width,
      ),
    );
    expect(Math.max(...w) - Math.min(...w)).toBeLessThan(1);
  });
});

test.describe('prism-segmented-control: form participation', () => {
  const FORM = `<form><prism-segmented-control id="s" name="range" label="Range" required><prism-segment value="day">Day</prism-segment><prism-segment value="week" checked>Week</prism-segment><prism-segment value="month">Month</prism-segment></prism-segmented-control><button>Go</button></form>`;

  test('a segment marked checked sets the starting value, which is submitted', async ({
    page,
  }) => {
    await setup(page, FORM);
    await captureSubmit(page);
    expect(await value(page)).toBe('week');
    await page.getByRole('button', { name: 'Go' }).click();
    expect(await submitted(page)).toEqual({ range: 'week' });
    await radio(page, 'Month').click();
    await page.getByRole('button', { name: 'Go' }).click();
    expect(await submitted(page)).toEqual({ range: 'month' });
  });

  test('required: invalid with nothing picked, valid after a pick; error shown only once touched', async ({
    page,
  }) => {
    await setup(
      page,
      FORM.replace(' checked', '').replace(
        '</prism-segmented-control>',
        '<span slot="error">Pick a range.</span></prism-segmented-control>',
      ),
    );
    expect(
      await s(page).evaluate(
        (e) => (e as unknown as { validity: ValidityState }).validity.valid,
      ),
    ).toBe(false);
    await expect(page.getByText('Pick a range.')).toBeHidden();
    await s(page).evaluate((e) =>
      (e as unknown as { reportValidity(): boolean }).reportValidity(),
    );
    await expect(page.getByText('Pick a range.')).toBeVisible();
    await expect(page.getByRole('group')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await radio(page, 'Day').click();
    expect(
      await s(page).evaluate((e) =>
        (e as unknown as { checkValidity(): boolean }).checkValidity(),
      ),
    ).toBe(true);
  });

  test('form reset goes back to the starting value; input and change fire on user picks only', async ({
    page,
  }) => {
    await setup(page, FORM);
    await page.evaluate(() => {
      const w = window as unknown as { ev: string[] };
      w.ev = [];
      for (const t of ['input', 'change'])
        document.querySelector('#s')!.addEventListener(t, () => w.ev.push(t));
    });
    await radio(page, 'Day').click();
    await s(page).evaluate(
      (e) => ((e as unknown as { value: string }).value = 'month'),
    );
    expect(
      await page.evaluate(() => (window as unknown as { ev: string[] }).ev),
    ).toEqual(['input', 'change']);
    await page.evaluate(() =>
      (document.querySelector('form') as HTMLFormElement).reset(),
    );
    await wait(page, 100);
    expect(await value(page)).toBe('week');
  });
});

test.describe('prism-segmented-control: motion', () => {
  test('first paint: the indicator already sits on the picked segment and nothing animates', async ({
    page,
  }) => {
    await mount(page, RANGE());
    await wait(page, 30);
    expect(await animsOn(s(page), 'indicator')).toEqual([]);
    await page.addStyleTag({ path: 'src/tokens/tokens.css' });
    await page.addStyleTag({ path: 'src/theme/theme.css' });
    await wait(page, 500);
    const r = await rects(page, 'week');
    expect(Math.abs(r.il - r.sl)).toBeLessThan(0.6);
    expect(Math.abs(r.ir - r.sr)).toBeLessThan(0.6);
    expect(r.opacity).toBe(1);
  });

  test('no value: no indicator; the first pick fades it in on the segment without sliding', async ({
    page,
  }) => {
    await setup(page, RANGE('', ''));
    expect((await rects(page, 'day')).opacity).toBe(0);
    const rows = await recordFrames(
      s(page),
      700,
      (root) => {
        const i = root
          .querySelector('[part="indicator"]')!
          .getBoundingClientRect();
        return [
          i.left,
          i.right,
          Number(
            getComputedStyle(root.querySelector('[part="indicator"]')!).opacity,
          ),
        ];
      },
      [
        {
          at: 100,
          run: (h) =>
            h.querySelector<HTMLElement>('prism-segment[value=month]')!.click(),
        },
      ],
    );
    const m = await rects(page, 'month');
    // From the first frame it is where it ends; only the opacity moves.
    const after = rows.filter((r) => r[2]! > 0.02);
    expect(after.length).toBeGreaterThan(3);
    for (const r of after) {
      expect(Math.abs(r[0]! - m.sl)).toBeLessThan(1);
      expect(Math.abs(r[1]! - m.sr)).toBeLessThan(1);
    }
    expect(rows.at(-1)![2]).toBe(1);
  });

  test('a pick slides it on springs: transform and opacity only, ending exactly on the segment', async ({
    page,
  }) => {
    await setup(page, RANGE());
    await radio(page, 'Month').click();
    const a = await animsOn(s(page), 'indicator');
    expect(a).toHaveLength(1);
    expect(a[0]!.props).toEqual(['opacity', 'transform']);
    expect(a[0]!.css).toBe(false);
    await wait(page, 900);
    const r = await rects(page, 'month');
    expect(Math.abs(r.il - r.sl)).toBeLessThan(0.6);
    expect(Math.abs(r.ir - r.sr)).toBeLessThan(0.6);
    expect(await animsOn(s(page), 'indicator')).toEqual([]);
  });

  test('it morphs: the width stretches between the two segment widths on the way, in about 300ms', async ({
    page,
  }) => {
    await setup(page, SEVEN.replace('full-width', ''));
    const rows = await recordFrames(
      s(page),
      900,
      (root) => {
        const i = root
          .querySelector('[part="indicator"]')!
          .getBoundingClientRect();
        return [i.left, i.right];
      },
      [
        {
          at: 100,
          run: (h) =>
            h.querySelector<HTMLElement>('prism-segment[value=b]')!.click(),
        },
      ],
    );
    const widths = rows.map((r) => r[1]! - r[0]!);
    const a = widths[0]!;
    const b = widths.at(-1)!;
    expect(b).toBeGreaterThan(a * 1.5);
    // Stretches past the start width and reaches the end width in between.
    expect(widths.filter((w) => w > a + 3 && w < b - 3).length).toBeGreaterThan(
      2,
    );
    const lefts = rows.map((r) => r[0]!);
    const moveStart = lefts.findIndex((l) => Math.abs(l - lefts[0]!) > 0.5);
    const settleAt = rows.map((r, i) =>
      Math.abs(r[0]! - lefts.at(-1)!) > 0.5 ||
      Math.abs(r[1]! - rows.at(-1)![1]!) > 0.5
        ? i
        : -1,
    );
    const ms = (Math.max(...settleAt) - moveStart) * 16.7;
    expect(ms).toBeGreaterThan(150);
    expect(ms).toBeLessThan(550);
  });

  test('every frame is continuous and the bounce never leaves the track', async ({
    page,
  }) => {
    await setup(page, SEVEN);
    const track = await s(page).evaluate((e) => {
      const t = e.shadowRoot!.querySelector('[part="track"]')!;
      const r = t.getBoundingClientRect();
      return {
        left: r.left + t.clientLeft,
        right: r.left + t.clientLeft + t.clientWidth,
      };
    });
    const rows = await recordFrames(
      s(page),
      1400,
      (root) => {
        const i = root
          .querySelector('[part="indicator"]')!
          .getBoundingClientRect();
        return [i.left, i.right];
      },
      [
        {
          at: 100,
          run: (h) =>
            h.querySelector<HTMLElement>('prism-segment[value=c]')!.click(),
        },
        {
          at: 700,
          run: (h) =>
            h.querySelector<HTMLElement>('prism-segment[value=a]')!.click(),
        },
      ],
    );
    for (const r of rows) {
      expect(r[0]!).toBeGreaterThanOrEqual(track.left - 0.5);
      expect(r[1]!).toBeLessThanOrEqual(track.right + 0.5);
    }
    // 350px of travel: no edge takes a third of it in one frame.
    for (const step of maxStep(rows)) expect(step).toBeLessThan(120);
    const lefts = rows.map((r) => r[0]!);
    const accel = lefts
      .slice(2)
      .map((v, i) => Math.abs(v - 2 * lefts[i + 1]! + lefts[i]!));
    expect(Math.max(...accel)).toBeLessThan(80);
  });

  test('interruptible: a new pick mid-slide turns it round from where it is, with no jump', async ({
    page,
  }) => {
    await setup(page, SEVEN);
    const rows = await recordFrames(
      s(page),
      1100,
      (root) => {
        const i = root
          .querySelector('[part="indicator"]')!
          .getBoundingClientRect();
        return [i.left, i.right];
      },
      [
        {
          at: 100,
          run: (h) =>
            h.querySelector<HTMLElement>('prism-segment[value=c]')!.click(),
        },
        {
          at: 190,
          run: (h) =>
            h.querySelector<HTMLElement>('prism-segment[value=b]')!.click(),
        },
      ],
    );
    const lefts = rows.map((r) => r[0]!);
    const t = Math.round(190 / 16.7);
    // The frame after the interruption is within one normal frame of the one before.
    const before = lefts[t - 1]! - lefts[t - 2]!;
    const around = lefts[t + 1]! - lefts[t]!;
    expect(Math.abs(around - before)).toBeLessThan(40);
    expect(maxStep(rows)[0]).toBeLessThan(110);
    await wait(page, 600);
    const r2 = await rects(page, 'b');
    expect(Math.abs(r2.il - r2.sl)).toBeLessThan(0.6);
  });

  test('a change from code slides the same way as a click', async ({
    page,
  }) => {
    await setup(page, RANGE());
    await s(page).evaluate(
      (e) => ((e as unknown as { value: string }).value = 'day'),
    );
    await wait(page, 16);
    expect(await animsOn(s(page), 'indicator')).toHaveLength(1);
    await wait(page, 900);
    const r = await rects(page, 'day');
    expect(Math.abs(r.il - r.sl)).toBeLessThan(0.6);
  });

  test('a resize does not animate: the indicator just follows', async ({
    page,
  }) => {
    await setup(page, SEVEN);
    await s(page).evaluate((e) => ((e as HTMLElement).style.width = '360px'));
    await wait(page, 150);
    expect(await animsOn(s(page), 'indicator')).toEqual([]);
    const r = await rects(page, 'a');
    expect(Math.abs(r.il - r.sl)).toBeLessThan(0.6);
    expect(Math.abs(r.ir - r.sr)).toBeLessThan(0.6);
  });

  test('inside a scaled ancestor (a pressed card) the indicator is still on its segment', async ({
    page,
  }) => {
    await setup(
      page,
      `<div style="scale:0.9;transform-origin:0 0">${RANGE()}</div>`,
    );
    await radio(page, 'Month').click();
    await wait(page, 900);
    const r = await rects(page, 'month');
    expect(Math.abs(r.il - r.sl)).toBeLessThan(0.8);
    expect(Math.abs(r.ir - r.sr)).toBeLessThan(0.8);
  });

  test('reduced motion: it jumps, with no animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(page, RANGE());
    await radio(page, 'Month').click();
    expect(await animsOn(s(page), 'indicator')).toEqual([]);
    await wait(page, 30);
    const r = await rects(page, 'month');
    expect(Math.abs(r.il - r.sl)).toBeLessThan(0.6);
  });

  test('pressing a segment squishes it evenly by about 3% and it springs back; reduced motion keeps only the colour', async ({
    page,
  }) => {
    await setup(page, RANGE());
    await mouseDown(page, seg(page, 'day'));
    await wait(page, 300);
    expect(await scaleOf(s(page), 'label:nth-of-type(1)')).toBeCloseTo(0.97, 3);
    await page.mouse.up();
    await wait(page, 500);
    expect(await scaleOf(s(page), 'label:nth-of-type(1)')).toBe(1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mouseDown(page, seg(page, 'month'));
    await wait(page, 150);
    expect(await scaleOf(s(page), 'label:nth-of-type(3)')).toBe(1);
    await page.mouse.up();
  });
});

test.describe('prism-segmented-control: contrast and forced colors', () => {
  const MIX =
    RANGE() +
    `<prism-segmented-control label="Plan" value="b" size="sm"><prism-segment value="a">One</prism-segment><prism-segment value="b">Two</prism-segment></prism-segmented-control><prism-segmented-control label="Off" value="b" disabled><prism-segment value="a">One</prism-segment><prism-segment value="b">Two</prism-segment></prism-segmented-control>`;
  for (const theme of ['light', 'dark'])
    test(`axe: rest, focused and invalid (${theme})`, async ({ page }) => {
      await setup(
        page,
        MIX +
          `<prism-segmented-control id="r" label="Needed" required><prism-segment value="a">One</prism-segment><prism-segment value="b">Two</prism-segment><span slot="error">Pick one.</span></prism-segmented-control>`,
        theme,
      );
      expect(await axe(page)).toEqual([]);
      await radio(page, 'Week').focus();
      expect(await axe(page)).toEqual([]);
      await page
        .locator('#r')
        .evaluate((e) =>
          (e as unknown as { reportValidity(): boolean }).reportValidity(),
        );
      expect(await axe(page)).toEqual([]);
    });

  test('the picked label is the on-accent colour on the accent indicator', async ({
    page,
  }) => {
    await setup(page, RANGE());
    const c = await s(page).evaluate((e) => ({
      ind: getComputedStyle(e.shadowRoot!.querySelector('[part="indicator"]')!)
        .backgroundColor,
      on: getComputedStyle(
        e.querySelector('prism-segment[value=week]')!.assignedSlot!
          .parentElement!,
      ).color,
      off: getComputedStyle(
        e.querySelector('prism-segment[value=day]')!.assignedSlot!
          .parentElement!,
      ).color,
    }));
    expect(c.on).not.toBe(c.off);
    expect(c.ind).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('the picked segment takes no hover or press fill: the indicator is its fill', async ({
    page,
  }) => {
    await setup(page, RANGE());
    // The invisible input lies over the segment, so move the mouse, not a click target.
    const moveOver = async (page: Page, v: string) => {
      const b = (await seg(page, v).boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    };
    const fill = (v: string) =>
      s(page).evaluate((e, v) => {
        const l = e.querySelector(`prism-segment[value=${v}]`)!.assignedSlot!
          .parentElement!;
        return getComputedStyle(l).backgroundImage;
      }, v);
    await moveOver(page, 'day');
    expect(await fill('day')).not.toBe(await fill('week'));
    await moveOver(page, 'week');
    expect(await fill('week')).toBe(
      'linear-gradient(rgba(0, 0, 0, 0), rgba(0, 0, 0, 0))',
    );
    await mouseDown(page, seg(page, 'week'));
    expect(await fill('week')).toBe(
      'linear-gradient(rgba(0, 0, 0, 0), rgba(0, 0, 0, 0))',
    );
    await page.mouse.up();
  });

  test('forced colors: Highlight indicator, HighlightText label, and a focus outline only while focused', async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await setup(page, RANGE());
    const read = () =>
      s(page).evaluate((e) => {
        const b = (
          e.querySelector('prism-segment[value=week]') as unknown as {
            input: HTMLInputElement;
          }
        ).input;
        return {
          ind: getComputedStyle(
            e.shadowRoot!.querySelector('[part="indicator"]')!,
          ).backgroundColor,
          text: getComputedStyle(b).color,
          outline: getComputedStyle(b).outlineStyle,
          track: getComputedStyle(
            e.shadowRoot!.querySelector('[part="track"]')!,
          ).borderTopColor,
        };
      });
    const rest = await read();
    expect(rest.outline).toBe('none');
    expect(rest.ind).not.toBe(rest.text);
    await radio(page, 'Week').focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    expect((await read()).outline).toBe('solid');
  });
});
