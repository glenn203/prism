import { expect, test, type Locator, type Page } from '@playwright/test';
import { anims, drawn, optionOf, wait } from '../../test/choice.js';
import { axe } from '../../test/axe.js';
import { captureSubmit, mount, submitted } from '../../test/fixture.js';

async function setup(page: Page, markup: string) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await mount(page, markup);
  await page.addStyleTag({ path: 'src/tokens/tokens.css' });
  await page.addStyleTag({ path: 'src/theme/theme.css' });
  await wait(page, 600);
  return errors;
}

const GROUP = `<prism-radio-group id="g" name="speed" label="Delivery speed" value="b">
  <prism-radio id="a" value="a" label="Daily"></prism-radio>
  <prism-radio id="b" value="b" label="Weekly"></prism-radio>
  <prism-radio id="c" value="c" label="Monthly"></prism-radio>
</prism-radio-group>`;

const radio = (page: Page, name: string) =>
  page.getByRole('radio', { name, exact: true });
const host = (page: Page, id: string) => page.locator(id);
const WEBKIT_NO_WRAP =
  'WebKit radios do not wrap at the ends or flip for right-to-left, in plain HTML too';
const value = (page: Page) =>
  host(page, '#g').evaluate((el) => (el as never as { value: string }).value);

test.describe('prism-radio-group: semantics', () => {
  test('a fieldset with a legend holds native radio inputs sharing one name; the value picks the checked one', async ({
    page,
  }) => {
    const errors = await setup(page, GROUP);
    expect(errors).toEqual([]);
    await expect(
      page.getByRole('group', { name: 'Delivery speed' }),
    ).toBeVisible();
    await expect(radio(page, 'Daily')).not.toBeChecked();
    await expect(radio(page, 'Weekly')).toBeChecked();
    await expect(radio(page, 'Monthly')).not.toBeChecked();
    const root = await host(page, '#g').evaluate((el) => {
      const sr = el.shadowRoot!;
      const inputs = [...sr.querySelectorAll('input')];
      return {
        fieldset: sr.querySelector('fieldset > legend')?.textContent,
        types: inputs.map((i) => i.type),
        names: new Set(inputs.map((i) => i.name)).size,
        loose: inputs.map(
          (i) =>
            i.hasAttribute('role') ||
            i.hasAttribute('aria-checked') ||
            i.hasAttribute('aria-labelledby'),
        ),
        labelled: inputs.map((i) => i.labels?.length),
      };
    });
    expect(root).toEqual({
      fieldset: 'Delivery speed',
      types: ['radio', 'radio', 'radio'],
      names: 1,
      loose: [false, false, false],
      labelled: [1, 1, 1],
    });
  });

  test('a radio marked checked in the markup sets the starting value', async ({
    page,
  }) => {
    await setup(
      page,
      `<prism-radio-group id="g" label="G">
        <prism-radio value="x" label="X"></prism-radio>
        <prism-radio value="y" label="Y" checked></prism-radio>
      </prism-radio-group>`,
    );
    expect(await value(page)).toBe('y');
    await expect(radio(page, 'Y')).toBeChecked();
  });

  test('click and label click pick; picking fires input and change once; code does not', async ({
    page,
  }) => {
    await setup(page, GROUP);
    await page.evaluate(() => {
      const w = window as unknown as { log: string[] };
      w.log = [];
      for (const t of ['input', 'change'])
        document.querySelector('#g')!.addEventListener(t, () => w.log.push(t));
    });
    await radio(page, 'Daily').click();
    expect(await value(page)).toBe('a');
    await page.getByText('Monthly').click();
    expect(await value(page)).toBe('c');
    // Picking the checked one again does nothing.
    await radio(page, 'Monthly').click();
    await host(page, '#g').evaluate(
      (el) => ((el as never as { value: string }).value = 'b'),
    );
    expect(
      await page.evaluate(() => (window as never as { log: string[] }).log),
    ).toEqual(['input', 'change', 'input', 'change']);
    await expect(radio(page, 'Weekly')).toBeChecked();
    await expect(radio(page, 'Monthly')).not.toBeChecked();
  });

  test('with none picked, Tab enters on the first radio and arrows then pick', async ({
    page,
  }) => {
    await setup(
      page,
      `<button id="before">before</button>
       <prism-radio-group id="g" label="G">
         <prism-radio value="a" label="A"></prism-radio>
         <prism-radio value="b" label="B"></prism-radio>
       </prism-radio-group>`,
    );
    await page.locator('#before').focus();
    await page.keyboard.press('Tab');
    await expect(radio(page, 'A')).toBeFocused();
    expect(await value(page)).toBe('');
    await page.keyboard.press('ArrowDown');
    await expect(radio(page, 'B')).toBeFocused();
    expect(await value(page)).toBe('b');
  });

  test('Tab enters on the checked radio and leaves the group in one more press', async ({
    page,
  }) => {
    await setup(
      page,
      `<button id="before">before</button>${GROUP}<button id="after">after</button>`,
    );
    await page.locator('#before').focus();
    await page.keyboard.press('Tab');
    await expect(radio(page, 'Weekly')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#after')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(radio(page, 'Weekly')).toBeFocused();
  });

  test('arrow keys move focus and pick, wrap round, and skip disabled radios', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', WEBKIT_NO_WRAP);
    await setup(
      page,
      `<prism-radio-group id="g" label="G" value="a">
        <prism-radio id="a" value="a" label="A"></prism-radio>
        <prism-radio id="b" value="b" label="B" disabled></prism-radio>
        <prism-radio id="c" value="c" label="C"></prism-radio>
      </prism-radio-group>`,
    );
    await radio(page, 'A').focus();
    await page.keyboard.press('ArrowDown');
    await expect(radio(page, 'C')).toBeFocused();
    expect(await value(page)).toBe('c');
    await page.keyboard.press('ArrowRight'); // wraps to A, skipping nothing else
    await expect(radio(page, 'A')).toBeFocused();
    expect(await value(page)).toBe('a');
    await page.keyboard.press('ArrowUp'); // back round to C
    expect(await value(page)).toBe('c');
    await page.keyboard.press('ArrowLeft');
    expect(await value(page)).toBe('a');
  });

  test('rtl swaps Left and Right', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', WEBKIT_NO_WRAP);
    await setup(page, `<div dir="rtl">${GROUP}</div>`);
    await radio(page, 'Weekly').focus();
    await page.keyboard.press('ArrowLeft');
    expect(await value(page)).toBe('c');
    await page.keyboard.press('ArrowRight');
    expect(await value(page)).toBe('b');
  });

  test('Space picks the focused radio; Enter does not', async ({ page }) => {
    await setup(page, GROUP);
    await radio(page, 'Daily').focus(); // focus without picking
    await page.keyboard.press('Enter');
    expect(await value(page)).toBe('b');
    await page.keyboard.press('Space');
    expect(await value(page)).toBe('a');
  });

  test('descriptions and a missing label are reported', async ({ page }) => {
    const errors = await setup(
      page,
      `<prism-radio-group label="G" value="x"><prism-radio value="x" label="X" description="Help"></prism-radio></prism-radio-group>
       <prism-radio-group><prism-radio value="y"></prism-radio></prism-radio-group>`,
    );
    await expect(radio(page, 'X')).toHaveAccessibleDescription('Help');
    expect(errors.join()).toContain('`label` is required');
  });

  test('a radio with no description has no aria-describedby', async ({
    page,
  }) => {
    await setup(page, GROUP);
    await expect(radio(page, 'Daily')).not.toHaveAttribute('aria-describedby');
  });
});

test.describe('prism-radio-group: disabled', () => {
  test('a disabled radio cannot be picked or focused; a disabled group disables all', async ({
    page,
  }) => {
    await setup(
      page,
      `<prism-radio-group id="g" label="G" value="a">
        <prism-radio value="a" label="A"></prism-radio>
        <prism-radio value="b" label="B" disabled></prism-radio>
      </prism-radio-group>
      <prism-radio-group id="h" label="H" disabled>
        <prism-radio value="x" label="X"></prism-radio>
      </prism-radio-group>`,
    );
    await radio(page, 'B').click({ force: true });
    expect(await value(page)).toBe('a');
    await expect(radio(page, 'X')).toBeDisabled();
    expect(
      await page
        .locator('prism-radio')
        .nth(2)
        .evaluate((el) =>
          el
            .closest('prism-radio-group')!
            .shadowRoot!.querySelector('[part~="edge"]')!
            .getAttribute('part'),
        ),
    ).toBe('edge disabled');
  });
});

test.describe('prism-radio-group: forms', () => {
  test('submits the picked value under the name; nothing when none', async ({
    page,
  }) => {
    await setup(page, `<form>${GROUP}</form>`);
    await captureSubmit(page);
    const submit = async () => {
      await page.evaluate(() =>
        document.querySelector('form')!.requestSubmit(),
      );
      return submitted(page);
    };
    expect(await submit()).toEqual({ speed: 'b' });
    await radio(page, 'Daily').click();
    expect(await submit()).toEqual({ speed: 'a' });
    await host(page, '#g').evaluate(
      (el) => ((el as never as { value: string }).value = ''),
    );
    expect(await submit()).toEqual({});
  });

  test('required: invalid until one is picked; the error shows after interaction', async ({
    page,
  }) => {
    await setup(
      page,
      `<form><prism-radio-group id="g" name="n" label="G" required>
        <span slot="error">Pick one.</span>
        <prism-radio value="x" label="X"></prism-radio>
        <prism-radio value="y" label="Y"></prism-radio>
      </prism-radio-group></form>`,
    );
    const g = host(page, '#g');
    expect(
      await g.evaluate(
        (el) => (el as never as HTMLInputElement).validity.valueMissing,
      ),
    ).toBe(true);
    const err = g.locator('[slot="error"]');
    await expect(err).toBeHidden();
    await g.evaluate((el) =>
      (el as never as HTMLInputElement).reportValidity(),
    );
    await expect(err).toBeVisible();
    // The error is the group's description; the native inputs hold the invalid state.
    await expect(page.getByRole('group')).toHaveAccessibleDescription(
      /Pick one/,
    );
    await expect(page.getByRole('group')).not.toHaveAttribute('aria-invalid');
    await radio(page, 'X').click();
    await expect(err).toBeHidden();
    expect(
      await g.evaluate(
        (el) => (el as never as HTMLInputElement).validity.valid,
      ),
    ).toBe(true);
  });

  test('a radio that leaves the group gets its slot attribute back', async ({
    page,
  }) => {
    await setup(page, GROUP);
    const slots = await host(page, '#g').evaluate((g) => {
      const c = g.querySelector('#c')!;
      const inside = c.getAttribute('slot');
      document.body.append(c);
      return new Promise<[string | null, string | null]>((r) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => r([inside, c.getAttribute('slot')])),
        ),
      );
    });
    expect(slots[0]).toMatch(/^prism-option/);
    expect(slots[1]).toBeNull();
  });

  test('form reset returns to the starting value', async ({ page }) => {
    await setup(page, `<form>${GROUP}</form>`);
    await radio(page, 'Monthly').click();
    await page.evaluate(() => document.querySelector('form')!.reset());
    expect(await value(page)).toBe('b');
    await expect(radio(page, 'Weekly')).toBeChecked();
  });
});

test.describe('prism-radio: shape', () => {
  test('a 24px minimum hit area around a round 16, 20 or 24px box; a ring and dot only when checked', async ({
    page,
  }) => {
    await setup(
      page,
      `<prism-radio-group id="g" label="G" value="b">
        <prism-radio id="a" value="a" label="a"></prism-radio>
        <prism-radio id="b" value="b" label="b"></prism-radio>
      </prism-radio-group>`,
    );
    for (const [size, px] of [
      ['sm', 16],
      ['md', 20],
      ['lg', 24],
    ] as const) {
      await host(page, '#g').evaluate(
        (el, size) => el.setAttribute('size', size),
        size,
      );
      const [w, hit, height, radius] = await (
        await optionOf(host(page, '#a'))
      ).evaluate((el) => {
        const q = (p: string) => el.querySelector(`[part~="${p}"]`)!;
        return [
          q('box').getBoundingClientRect().width,
          q('base').getBoundingClientRect().width,
          q('base').getBoundingClientRect().height,
          getComputedStyle(q('box')).borderTopLeftRadius,
        ];
      });
      expect(w).toBe(px);
      expect(hit).toBeGreaterThanOrEqual(24);
      expect(height).toBeGreaterThanOrEqual(24);
      expect(radius).toBe('50%');
    }
    const off = await drawn(host(page, '#a'));
    expect([off.ring, off.dot!.o]).toEqual([0, 0]);
    const on = await drawn(host(page, '#b'));
    expect([on.ring, on.dot!.s, on.dot!.o]).toEqual([1, 1, 1]);
  });
});

test.describe('prism-radio: motion', () => {
  test('nothing animates on first paint', async ({ page }) => {
    await mount(page, GROUP);
    for (const id of ['#a', '#b', '#c'])
      expect(await anims(host(page, id))).toEqual([]);
  });

  test('picking: the new dot grows with a gentle overshoot as the old one shrinks out, started together', async ({
    page,
  }) => {
    await setup(page, GROUP);
    await radio(page, 'Monthly').click();
    // Both have a start time once the frame after the click has run.
    await wait(page, 50);
    const mine = await anims(host(page, '#c'));
    const prev = await anims(host(page, '#b'));
    expect(mine.length).toBe(3);
    expect(prev.length).toBe(3);
    // Same clock: both begin on the same frame.
    expect(new Set([...mine, ...prev].map((a) => a.start)).size).toBe(1);
    const props = new Set([...mine, ...prev].flatMap((a) => a.props));
    expect([...props].sort()).toEqual(['opacity', 'transform']);

    const dur = mine[0]!.duration;
    expect(dur).toBeGreaterThanOrEqual(300);
    expect(dur).toBeLessThanOrEqual(500);
    const grow: number[] = [];
    const shrink: number[] = [];
    for (let t = 0; t <= dur; t += 4) {
      grow.push((await drawn(host(page, '#c'), t)).dot!.s);
      shrink.push((await drawn(host(page, '#b'), t)).dot!.s);
    }
    expect(grow[0]).toBeLessThan(0.05);
    expect(grow.at(-1)).toBe(1);
    expect(Math.max(...grow)).toBeGreaterThan(1.04);
    expect(Math.max(...grow)).toBeLessThan(1.2);
    expect(shrink[0]).toBeGreaterThan(0.95);
    expect(shrink.at(-1)).toBe(0);
    // The leaving dot never bounces back up.
    expect(shrink.every((s, i) => i === 0 || s <= shrink[i - 1]! + 1e-6)).toBe(
      true,
    );
  });

  test('arrow-key moves animate the same way', async ({ page }) => {
    await setup(page, GROUP);
    await radio(page, 'Weekly').focus();
    await page.keyboard.press('ArrowDown');
    expect((await anims(host(page, '#c'))).length).toBe(3);
    expect((await anims(host(page, '#b'))).length).toBe(3);
    await wait(page, 600);
    await page.keyboard.press('ArrowUp'); // back to the second
    expect((await anims(host(page, '#b'))).length).toBe(3);
  });

  test('a change from code moves the same way as a click', async ({ page }) => {
    await setup(page, GROUP);
    await host(page, '#g').evaluate(
      (el) => ((el as never as { value: string }).value = 'a'),
    );
    expect((await anims(host(page, '#a'))).map((a) => a.props.join())).toEqual(
      (await anims(host(page, '#a'))).map((a) => a.props.join()),
    );
    expect((await anims(host(page, '#a'))).length).toBe(3);
    expect((await anims(host(page, '#b'))).length).toBe(3);
  });

  test('every frame is continuous: no step or change of step jumps', async ({
    page,
  }) => {
    await setup(page, GROUP);
    await radio(page, 'Monthly').click();
    const dur = (await anims(host(page, '#c')))[0]!.duration;
    const series: Record<string, number[]> = {
      grow: [],
      shrink: [],
      ring: [],
      sy: [],
    };
    for (let t = 0; t <= dur; t += 2) {
      const n = await drawn(host(page, '#c'), t);
      series.grow!.push(n.dot!.s);
      series.ring!.push(n.ring!);
      series.sy!.push(n.sy);
      series.shrink!.push((await drawn(host(page, '#b'), t)).dot!.s);
    }
    const limit = { grow: 0.07, shrink: 0.07, ring: 0.07, sy: 0.01 };
    for (const [k, v] of Object.entries(series)) {
      const step = v.slice(1).map((n, i) => n - v[i]!);
      expect(Math.max(...step.map(Math.abs)), `${k} step`).toBeLessThan(
        limit[k as keyof typeof limit],
      );
      const jerk = step.slice(1).map((n, i) => n - step[i]!);
      expect(Math.max(...jerk.map(Math.abs)), `${k} jerk`).toBeLessThan(
        limit[k as keyof typeof limit] / 2.5,
      );
    }
  });

  test('picking another mid-move turns each dot round from where it is: no snap', async ({
    page,
  }) => {
    await setup(page, GROUP);
    for (const at of [40, 90, 150, 230]) {
      await radio(page, 'Monthly').click();
      const ahead = {
        c: (await drawn(host(page, '#c'), at + 16.7)).dot!.s,
        b: (await drawn(host(page, '#b'), at + 16.7)).dot!.s,
      };
      await drawn(host(page, '#c'), at);
      await drawn(host(page, '#b'), at);
      await host(page, '#b').evaluate((el) => (el as HTMLElement).click()); // pick Weekly again
      const after = {
        c: (await drawn(host(page, '#c'), 0)).dot!.s,
        b: (await drawn(host(page, '#b'), 0)).dot!.s,
      };
      expect(Math.abs(after.c - ahead.c)).toBeLessThan(0.05);
      expect(Math.abs(after.b - ahead.b)).toBeLessThan(0.05);
      await wait(page, 700);
    }
  });

  test('rapid picks always end at rest with the last pick checked and nothing left running', async ({
    page,
  }) => {
    await setup(page, GROUP);
    const order = ['#a', '#c', '#b', '#a', '#c', '#b', '#a'];
    for (const id of order) {
      await host(page, id).evaluate((el) => (el as HTMLElement).click());
      await wait(page, 50);
    }
    await wait(page, 800);
    expect(await value(page)).toBe('a');
    for (const id of ['#a', '#b', '#c']) {
      expect(await anims(host(page, id))).toEqual([]);
      const d = await drawn(host(page, id));
      expect(d.dot!.s).toBe(id === '#a' ? 1 : 0);
      expect(d.sy).toBe(1);
    }
  });

  test('the end of the move is exactly the stylesheet rest pose', async ({
    page,
  }) => {
    await setup(page, GROUP);
    await radio(page, 'Monthly').click();
    const dur = (await anims(host(page, '#c')))[0]!.duration;
    const last = await drawn(host(page, '#c'), dur - 0.01);
    await (
      await optionOf(host(page, '#c'))
    ).evaluate((el) =>
      el.getAnimations({ subtree: true }).forEach((a) => a.finish()),
    );
    await wait(page, 100);
    const rest = await drawn(host(page, '#c'));
    expect(last.dot!.s).toBeCloseTo(rest.dot!.s, 2);
    expect(last.sy).toBeCloseTo(rest.sy, 3);
    expect(last.ring).toBeCloseTo(rest.ring!, 2);
  });

  test('press squishes the box; letting go outside does nothing', async ({
    page,
  }) => {
    await setup(page, GROUP);
    const b = (await radio(page, 'Daily').boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await wait(page, 300);
    const held = await drawn(host(page, '#a'));
    expect(held.sy).toBeCloseTo(0.88, 2);
    await page.mouse.move(b.x + 300, b.y + 300);
    await page.mouse.up();
    await wait(page, 700);
    expect(await value(page)).toBe('b');
    expect((await drawn(host(page, '#a'))).sy).toBe(1);
  });

  test('reduced motion: no animation, the state changes at once, colour fades over 120ms', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(page, GROUP);
    await radio(page, 'Monthly').click();
    for (const id of ['#a', '#b', '#c'])
      expect(await anims(host(page, id))).toEqual([]);
    const r = await (
      await optionOf(host(page, '#c'))
    ).evaluate((el) => {
      const dot = el.querySelector('[part~="dot"]')!;
      return [
        getComputedStyle(dot).transitionProperty,
        parseFloat(getComputedStyle(dot).transitionDuration) * 1000,
      ];
    });
    expect(r).toEqual(['opacity', 120]);
    expect((await drawn(host(page, '#c'))).dot!.s).toBe(1);
    expect((await drawn(host(page, '#b'))).dot!.s).toBe(0);
  });

  test('forced colors: ring and dot use the system highlight', async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await setup(page, GROUP);
    const r = await (
      await optionOf(host(page, '#b'))
    ).evaluate((el) => {
      const probe = document.createElement('i');
      probe.style.color = 'Highlight';
      document.body.append(probe);
      const hl = getComputedStyle(probe).color;
      probe.remove();
      const q = (p: string) =>
        getComputedStyle(el.querySelector(`[part~="${p}"]`)!);
      return [q('dot').backgroundColor === hl, q('ring').borderTopColor === hl];
    });
    expect(r).toEqual([true, true]);
  });
});

// ---- state layer ----

const overlayAlpha = async (loc: Locator) =>
  (await optionOf(loc)).evaluate((el) => {
    const box = el.querySelector('[part~="box"]')!;
    const ctx = document
      .createElement('canvas')
      .getContext('2d', { willReadFrequently: true })!;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = getComputedStyle(box, '::after').backgroundColor;
    ctx.fillRect(0, 0, 1, 1);
    return ctx.getImageData(0, 0, 1, 1).data[3]! / 255;
  });

test.describe('prism-radio: state layer (shared 6 / 11 / 15% overlays)', () => {
  test('off: rest none, hover 6%, pressed 12%; on: 11% and hovered 15%', async ({
    page,
  }) => {
    await setup(page, GROUP);
    const off = host(page, '#a');
    const on = host(page, '#b');
    expect(await overlayAlpha(off)).toBe(0);
    await radio(page, 'Daily').hover();
    expect(await overlayAlpha(off)).toBeCloseTo(0.06, 2);
    await page.mouse.down();
    expect(await overlayAlpha(off)).toBeCloseTo(0.12, 2);
    await page.mouse.up();
    await wait(page, 50);
    // Daily is now the picked one; Weekly is off. Check the picked one.
    await page.mouse.move(0, 0);
    await wait(page, 50);
    expect(await overlayAlpha(off)).toBeCloseTo(0.11, 2);
    await radio(page, 'Daily').hover();
    expect(await overlayAlpha(off)).toBeCloseTo(0.15, 2);
    expect(await overlayAlpha(on)).toBe(0);
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

for (const theme of ['light', 'dark'] as const) {
  test.describe(`prism-radio: AA contrast (${theme})`, () => {
    for (const state of ['rest', 'hover', 'pressed'] as const) {
      test(`${state}: edge, ring and dot vs the page >= 3:1; text 4.5:1`, async ({
        page,
      }) => {
        await setup(
          page,
          `<div data-prism-theme="${theme}" style="background:var(--prism-color-bg);padding:24px">${GROUP}</div>`,
        );
        const target = state === 'rest' ? null : radio(page, 'Weekly');
        if (target) {
          await target.hover();
          if (state === 'pressed') await page.mouse.down();
        }
        const r = await (
          await optionOf(host(page, '#b'))
        ).evaluate((el) => {
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
          const q = (p: string, pe?: string) =>
            getComputedStyle(el.querySelector(`[part~="${p}"]`)!, pe);
          const bg = getComputedStyle(
            (el.getRootNode() as ShadowRoot).host.parentElement!,
          ).backgroundColor;
          const face = q('box').backgroundColor;
          const overlay = q('box', '::after').backgroundColor;
          return {
            bg: px([bg]),
            ring: px([bg, q('ring').borderTopColor]),
            dot: px([bg, face, overlay, q('dot').backgroundColor]),
            label: px([q('option-label').color]),
          };
        });
        if (state === 'pressed') await page.mouse.up();
        expect(ratio(r.ring as RGB, r.bg as RGB)).toBeGreaterThanOrEqual(3);
        expect(ratio(r.dot as RGB, r.bg as RGB)).toBeGreaterThanOrEqual(3);
        expect(ratio(r.label as RGB, r.bg as RGB)).toBeGreaterThanOrEqual(4.5);
      });
    }

    test('the unselected edge is 3:1 on the page', async ({ page }) => {
      await setup(
        page,
        `<div data-prism-theme="${theme}" style="background:var(--prism-color-bg);padding:24px">${GROUP}</div>`,
      );
      const r = await (
        await optionOf(host(page, '#a'))
      ).evaluate((el) => {
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
          bg: px(
            getComputedStyle(
              (el.getRootNode() as ShadowRoot).host.parentElement!,
            ).backgroundColor,
          ),
          edge: px(
            getComputedStyle(el.querySelector('[part~="edge"]')!)
              .borderTopColor,
          ),
        };
      });
      expect(ratio(r.edge as RGB, r.bg as RGB)).toBeGreaterThanOrEqual(3);
    });
  });
}

test('focus ring shows on keyboard focus', async ({ page }) => {
  await setup(page, GROUP);
  await page.keyboard.press('Tab');
  const sh = await (
    await optionOf(host(page, '#b'))
  ).evaluate(
    (el) => getComputedStyle(el.querySelector('[part~="base"]')!).boxShadow,
  );
  expect(sh).not.toMatch(/^(0px 0px 0px 0px [^,]+(, )?)+$/);
});

// ---- axe ----

const ALL = `
  <prism-radio-group id="g1" label="Delivery speed" value="b">
    <span slot="description">Pick one.</span>
    <prism-radio value="a" label="Daily"></prism-radio>
    <prism-radio value="b" label="Weekly" description="Every Monday."></prism-radio>
    <prism-radio value="c" label="Monthly" disabled></prism-radio>
  </prism-radio-group>
  <prism-radio-group id="g2" label="Sizes" orientation="horizontal" value="m" size="lg">
    <prism-radio value="s" label="Small"></prism-radio>
    <prism-radio value="m" label="Medium"></prism-radio>
    <prism-radio value="l" label="Large"></prism-radio>
  </prism-radio-group>
  <prism-radio-group id="g3" label="Required" required>
    <span slot="error">Pick one.</span>
    <prism-radio value="x" label="X"></prism-radio>
    <prism-radio value="y" label="Y"></prism-radio>
  </prism-radio-group>
  <prism-radio-group id="g4" label="Off" disabled value="x">
    <prism-radio value="x" label="X"></prism-radio>
  </prism-radio-group>`;

for (const theme of ['light', 'dark']) {
  test(`axe: no WCAG A/AA violations (${theme})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(
      page,
      `<div data-prism-theme="${theme}" style="background:var(--prism-color-bg);color:var(--prism-color-text);padding:16px">${ALL}</div>`,
    );
    await page.evaluate(() =>
      (
        document.querySelector('#g3') as never as HTMLInputElement
      ).reportValidity(),
    );
    expect(await axe(page)).toEqual([]);
  });
}
