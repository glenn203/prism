import { expect, test, type Page } from '@playwright/test';
import { axe } from '../../test/axe.js';
import { captureSubmit, mount, submitted } from '../../test/fixture.js';
import {
  animsOn,
  maxStep,
  painted,
  recordFrames,
  wait,
} from '../../test/field.js';

async function setup(page: Page, markup: string, theme = 'light') {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await mount(page, markup);
  await page.addStyleTag({ path: 'src/tokens/tokens.css' });
  await page.addStyleTag({ path: 'src/theme/theme.css' });
  await page.evaluate(
    (t) => document.documentElement.setAttribute('data-prism-theme', t),
    theme,
  );
  await painted(page);
  await wait(page, 500);
  return errors;
}

const FLOAT = `<prism-text-input id="f" label="Email" floating placeholder="name@example.com"></prism-text-input>`;
const host = (page: Page, id = '#f') => page.locator(id);

/** Where the label is drawn: vertical travel (px), scale, patch opacity. */
const labelPose = (page: Page, id = '#f') =>
  host(page, id).evaluate((el) => {
    const label = el.shadowRoot!.querySelector<HTMLElement>('[part="label"]')!;
    const m = new DOMMatrix(getComputedStyle(label).transform);
    return {
      ty: m.f,
      scale: m.a,
      patch: Number(getComputedStyle(label, '::before').opacity),
      height: el
        .shadowRoot!.querySelector('[part="input"]')!
        .getBoundingClientRect().height,
    };
  });

const placeholderOpacity = (page: Page, id = '#f') =>
  host(page, id).evaluate((el) =>
    Number(
      getComputedStyle(
        el.shadowRoot!.querySelector('[part="input"]')!,
        '::placeholder',
      ).opacity,
    ),
  );

test.describe('prism-text-input: floating label', () => {
  test('off by default: the label sits above the field, as before', async ({
    page,
  }) => {
    await setup(
      page,
      `<prism-text-input id="f" label="Email"></prism-text-input>`,
    );
    const r = await host(page).evaluate((el) => {
      const root = el.shadowRoot!;
      const label = root.querySelector('[part="label"]')!;
      const control = root.querySelector('[part="control"]')!;
      return {
        attr: el.hasAttribute('data-floating'),
        inside: control.contains(label),
        above:
          label.getBoundingClientRect().bottom <=
          control.getBoundingClientRect().top + 1,
      };
    });
    expect(r).toEqual({ attr: false, inside: false, above: true });
  });

  test('rests inside the field like a placeholder, then floats onto the top edge on focus', async ({
    page,
  }) => {
    await setup(page, FLOAT);
    const rest = await labelPose(page);
    expect(rest.ty).toBeCloseTo(0, 1);
    expect(rest.scale).toBeCloseTo(1, 2);
    expect(rest.patch).toBe(0);
    expect(await placeholderOpacity(page)).toBe(0);
    await page.getByRole('textbox', { name: 'Email' }).focus();
    await wait(page, 700);
    const up = await labelPose(page);
    expect(up.ty).toBeCloseTo(-up.height / 2, 0);
    expect(up.scale).toBeCloseTo(0.857, 2);
    expect(up.patch).toBe(1);
    expect(await placeholderOpacity(page)).toBe(1);
    await page.getByRole('textbox', { name: 'Email' }).blur();
    await wait(page, 700);
    expect((await labelPose(page)).ty).toBeCloseTo(0, 1);
  });

  test('stays floated while there is a value, including one set from code', async ({
    page,
  }) => {
    await setup(page, FLOAT);
    const input = page.getByRole('textbox', { name: 'Email' });
    await input.fill('ada@example.com');
    await input.blur();
    await wait(page, 700);
    expect((await labelPose(page)).patch).toBe(1);
    await host(page).evaluate((el: HTMLElement & { value: string }) => {
      el.value = '';
    });
    await wait(page, 700);
    expect((await labelPose(page)).ty).toBeCloseTo(0, 1);
    await host(page).evaluate((el: HTMLElement & { value: string }) => {
      el.value = 'x';
    });
    // The same move for a change from code: it animates.
    await expect
      .poll(() => animsOn(host(page), 'label').then((a) => a.length))
      .toBeGreaterThan(0);
  });

  test('first paint: nothing moves, with or without a value, or a prefix', async ({
    page,
  }) => {
    await mount(
      page,
      `<prism-text-input id="a" label="A" floating></prism-text-input>
       <prism-text-input id="b" label="B" floating value="hello"></prism-text-input>
       <prism-text-input id="c" label="C" floating><span slot="prefix">$</span></prism-text-input>`,
    );
    await page.addStyleTag({ path: 'src/tokens/tokens.css' });
    await page.addStyleTag({ path: 'src/theme/theme.css' });
    await painted(page);
    for (const id of ['#a', '#b', '#c']) {
      expect(await animsOn(host(page, id), 'label')).toEqual([]);
      expect(await animsOn(host(page, id), 'label', '::before')).toEqual([]);
    }
    expect((await labelPose(page, '#a')).patch).toBe(0);
    expect((await labelPose(page, '#b')).patch).toBe(1);
    expect((await labelPose(page, '#c')).patch).toBe(1);
  });

  test('a move is springs on transform and opacity only, on one clock', async ({
    page,
  }) => {
    await setup(page, FLOAT);
    await page.getByRole('textbox', { name: 'Email' }).focus();
    const label = await animsOn(host(page), 'label');
    const patch = await animsOn(host(page), 'label', '::before');
    expect(label).toHaveLength(1);
    expect(label[0]!.css).toBe(false);
    expect(label[0]!.props).toEqual(['transform']);
    expect(label[0]!.easing).toBe('linear');
    expect(patch[0]!.props).toEqual(['opacity']);
    expect(patch[0]!.ms).toBe(label[0]!.ms);
    expect(label[0]!.ms).toBeGreaterThan(120);
    expect(label[0]!.ms).toBeLessThan(500);
  });

  test('interruptible: focus then blur mid-move never jumps', async ({
    page,
  }) => {
    await setup(page, FLOAT);
    const rows = await recordFrames(
      host(page),
      900,
      (root) => {
        const l = root.querySelector<HTMLElement>('[part="label"]')!;
        const m = new DOMMatrix(getComputedStyle(l).transform);
        return [m.f, m.a];
      },
      [
        { at: 100, run: (h) => h.focus() },
        { at: 190, run: () => (document.activeElement as HTMLElement).blur() },
        { at: 400, run: (h) => h.focus() },
        { at: 450, run: () => (document.activeElement as HTMLElement).blur() },
      ],
    );
    const [dy, ds] = maxStep(rows);
    // The spring's own top speed is ~4px a frame; a jump would be far more.
    expect(dy).toBeLessThan(5.5);
    expect(ds).toBeLessThan(0.05); // of 0.143 in all
    const last = rows.at(-1)!;
    expect(last[0]).toBeCloseTo(0, 1);
    expect(last[1]).toBeCloseTo(1, 2);
  });

  test('the label names the input and a click on it focuses the input', async ({
    page,
  }) => {
    await setup(page, FLOAT);
    await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
    await page.mouse.click(60, 28);
    await expect(page.getByRole('textbox', { name: 'Email' })).toBeFocused();
  });

  test('reduced motion: instant state, no animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(page, FLOAT);
    await page.getByRole('textbox', { name: 'Email' }).focus();
    expect(await animsOn(host(page), 'label')).toEqual([]);
    const up = await labelPose(page);
    expect(up.ty).toBeCloseTo(-up.height / 2, 0);
    expect(up.patch).toBe(1);
  });

  test('works on the password input too; search and text area ignore it', async ({
    page,
  }) => {
    await setup(
      page,
      `<prism-password-input id="p" label="Password" floating></prism-password-input>
       <prism-search-input id="s" label="Search" floating></prism-search-input>
       <prism-text-area id="a" label="Notes" floating></prism-text-area>`,
    );
    expect(
      await host(page, '#p').evaluate((e) => e.hasAttribute('data-floating')),
    ).toBe(true);
    expect(
      await host(page, '#s').evaluate((e) => e.hasAttribute('data-floating')),
    ).toBe(false);
    expect(
      await host(page, '#a').evaluate((e) => e.hasAttribute('data-floating')),
    ).toBe(false);
  });
});

test.describe('prism-text-input: prefix, suffix and clear', () => {
  const FULL = `<form><prism-text-input id="f" name="amount" label="Amount" floating clearable value="42"><span slot="prefix">$</span><span slot="suffix">USD</span></prism-text-input><button>Go</button></form>`;

  test('affixes sit inside the field and the text clears them', async ({
    page,
  }) => {
    await setup(page, FULL);
    const r = await host(page).evaluate(async (el) => {
      await (el as HTMLElement & { updateComplete: Promise<unknown> })
        .updateComplete;
      const root = el.shadowRoot!;
      const rect = (p: string) =>
        root.querySelector(`[part="${p}"]`)!.getBoundingClientRect();
      const input = root.querySelector('[part="input"]') as HTMLInputElement;
      const pad = (s: string) =>
        parseFloat(getComputedStyle(input)[s as 'paddingLeft']);
      return {
        prefix: rect('prefix'),
        suffix: rect('suffix'),
        clear: rect('clear'),
        input: rect('input'),
        padL: pad('paddingLeft'),
        padR: pad('paddingRight'),
      };
    });
    // Everything is inside the box; the text starts after the prefix and ends before the clear button.
    expect(r.prefix.left).toBeGreaterThanOrEqual(r.input.left);
    expect(r.suffix.right).toBeLessThanOrEqual(r.input.right);
    expect(r.input.left + r.padL).toBeGreaterThanOrEqual(r.prefix.right);
    expect(r.input.right - r.padR).toBeLessThanOrEqual(r.clear.left + 0.5);
    expect(r.clear.right).toBeLessThanOrEqual(r.suffix.left);
  });

  test('the clear button shows only with an editable value, clears, fires input and change, and returns focus', async ({
    page,
  }) => {
    await setup(page, FULL);
    await page.evaluate(() => {
      const w = window as unknown as { log: string[] };
      w.log = [];
      const el = document.querySelector('#f')!;
      for (const t of ['input', 'change'])
        el.addEventListener(t, () => w.log.push(t));
    });
    const clear = page.getByRole('button', { name: 'Clear' });
    await expect(clear).toBeVisible();
    await clear.click();
    await expect(page.getByRole('textbox', { name: 'Amount' })).toBeFocused();
    await expect(page.getByRole('textbox', { name: 'Amount' })).toHaveValue('');
    await expect(clear).toBeHidden();
    expect(
      await page.evaluate(() => (window as unknown as { log: string[] }).log),
    ).toEqual(['input', 'change']);
    await captureSubmit(page);
    await page.getByRole('button', { name: 'Go' }).click();
    expect(await submitted(page)).toEqual({ amount: '' });
  });

  test('hidden when empty, read-only or disabled; the name can be set', async ({
    page,
  }) => {
    await setup(
      page,
      `<prism-text-input id="a" label="A" clearable></prism-text-input>
       <prism-text-input id="b" label="B" clearable readonly value="x"></prism-text-input>
       <prism-text-input id="c" label="C" clearable disabled value="x"></prism-text-input>
       <prism-text-input id="d" label="D" clearable value="x" clear-label="Empty this field"></prism-text-input>`,
    );
    const shown = (id: string) =>
      host(page, id).evaluate(
        (el) =>
          !el.shadowRoot!.querySelector<HTMLElement>('[part="clear"]')!.hidden,
      );
    expect(await shown('#a')).toBe(false);
    expect(await shown('#b')).toBe(false);
    expect(await shown('#c')).toBe(false);
    expect(await shown('#d')).toBe(true);
    await expect(
      page.getByRole('button', { name: 'Empty this field' }),
    ).toBeVisible();
    await page.getByRole('textbox', { name: 'A' }).fill('typed');
    expect(await shown('#a')).toBe(true);
  });

  test('the clear button pops in on a spring, from scale and opacity', async ({
    page,
  }) => {
    await setup(
      page,
      `<prism-text-input id="f" label="A" clearable></prism-text-input>`,
    );
    await page.getByRole('textbox', { name: 'A' }).fill('t');
    const a = await animsOn(host(page), 'clear');
    expect(a).toHaveLength(1);
    expect(a[0]!.props).toEqual(['opacity', 'transform']);
    expect(a[0]!.css).toBe(false);
  });

  test('form reset puts the label back to rest', async ({ page }) => {
    await setup(
      page,
      `<form><prism-text-input id="f" label="A" floating></prism-text-input></form>`,
    );
    await page.getByRole('textbox', { name: 'A' }).fill('typed');
    await page.getByRole('textbox', { name: 'A' }).blur();
    await wait(page, 600);
    expect((await labelPose(page)).patch).toBe(1);
    await page.evaluate(() => document.querySelector('form')!.reset());
    await wait(page, 700);
    expect((await labelPose(page)).ty).toBeCloseTo(0, 1);
  });
});

test.describe('prism-text-input: error', () => {
  const REQ = `<prism-text-input id="f" label="Name" floating required><span slot="description">As on your card.</span><span slot="error">Enter a name.</span></prism-text-input>`;

  test('a nudge on becoming invalid: sideways, small, rings out, back to rest', async ({
    page,
  }) => {
    await setup(page, REQ);
    const rows = await recordFrames(
      host(page),
      900,
      (root) => {
        const c = root.querySelector<HTMLElement>('[part="control"]')!;
        return [new DOMMatrix(getComputedStyle(c).transform).e];
      },
      [
        {
          at: 100,
          run: (h) =>
            (h as HTMLElement & { reportValidity(): boolean }).reportValidity(),
        },
      ],
    );
    const xs = rows.map((r) => r[0]!);
    expect(Math.max(...xs.map(Math.abs))).toBeGreaterThan(1.5);
    expect(Math.max(...xs.map(Math.abs))).toBeLessThanOrEqual(5);
    expect(xs.some((x) => x > 0.5) && xs.some((x) => x < -0.5)).toBe(true);
    expect(xs.at(-1)).toBeCloseTo(0, 1);
    expect(maxStep(rows)[0]).toBeLessThan(3.5); // the swing's own top speed is ~2.5px a frame
  });

  test('only on the change to invalid: not on focus, not on typing while invalid', async ({
    page,
  }) => {
    await setup(page, REQ);
    await page.getByRole('textbox', { name: 'Name' }).focus();
    expect(await animsOn(host(page), 'control')).toEqual([]);
    await host(page).evaluate((e) =>
      (e as HTMLElement & { reportValidity(): boolean }).reportValidity(),
    );
    await wait(page, 700);
    await page.getByRole('textbox', { name: 'Name' }).focus();
    expect(await animsOn(host(page), 'control')).toEqual([]);
    const a = await animsOn(host(page), 'control');
    expect(a).toEqual([]);
  });

  test('the nudge is transform only; error text is wired and visible', async ({
    page,
  }) => {
    await setup(page, REQ);
    await host(page).evaluate((e) =>
      (e as HTMLElement & { reportValidity(): boolean }).reportValidity(),
    );
    const a = await animsOn(host(page), 'control');
    expect(a).toHaveLength(1);
    expect(a[0]!.props).toEqual(['transform']);
    const input = page.getByRole('textbox', { name: 'Name' });
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toHaveAccessibleDescription('Enter a name.');
    await expect(page.getByText('Enter a name.')).toBeVisible();
  });

  test('reduced motion: no nudge, the error still appears', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(page, REQ);
    await host(page).evaluate((e) =>
      (e as HTMLElement & { reportValidity(): boolean }).reportValidity(),
    );
    expect(await animsOn(host(page), 'control')).toEqual([]);
    await expect(page.getByText('Enter a name.')).toBeVisible();
  });
});

test.describe('prism-text-input: focus ring and forced colors', () => {
  test('focus shows only the tight ring: no bloom, reach of 4px, and no blur past 1px', async ({
    page,
  }) => {
    await setup(page, FLOAT);
    await page.getByRole('textbox', { name: 'Email' }).focus();
    await wait(page, 500);
    const { bloom, input } = await host(page).evaluate((el) => {
      const part = (name: string) =>
        el.shadowRoot!.querySelector(`[part="${name}"]`)!;
      return {
        bloom: getComputedStyle(part('control'), '::before').boxShadow,
        input: getComputedStyle(part('input')).boxShadow,
      };
    });
    expect(bloom).toBe('none');
    // Each layer is "<colour> x y blur spread": read the four lengths of each.
    const lengths = input.replace(/\w+\([^)]*\)/g, '').match(/[\d.-]+px/g)!;
    const layers = Array.from({ length: lengths.length / 4 }, (_, i) =>
      lengths.slice(i * 4, i * 4 + 4).map(Number.parseFloat),
    );
    expect(layers).toHaveLength(3);
    for (const [, , blur, spread] of layers) {
      expect(blur).toBeLessThanOrEqual(1);
      expect(spread).toBeLessThanOrEqual(4);
    }
  });

  for (const theme of ['light', 'dark']) {
    test(`${theme}: the focus ring stays visible (2px thick, 3:1 against the page)`, async ({
      page,
    }) => {
      await setup(page, FLOAT, theme);
      await page.getByRole('textbox', { name: 'Email' }).focus();
      await wait(page, 500);
      const { ratio, thickness } = await page.evaluate(() => {
        const css = (v: string) =>
          getComputedStyle(document.documentElement).getPropertyValue(v);
        const rgb = (colour: string) => {
          const ctx = document.createElement('canvas').getContext('2d')!;
          ctx.fillStyle = colour;
          ctx.fillRect(0, 0, 1, 1);
          return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
        };
        const luminance = (c: number[]) => {
          const [r, g, b] = c.map((v) => {
            const x = v / 255;
            return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
        };
        const [hi, lo] = [
          luminance(rgb(css('--prism-color-focus-ring'))),
          luminance(rgb(css('--prism-color-bg'))),
        ].sort((a, b) => b - a);
        return {
          ratio: (hi! + 0.05) / (lo! + 0.05),
          thickness: Number.parseFloat(css('--prism-focus-ring-width')),
        };
      });
      expect(ratio).toBeGreaterThanOrEqual(3);
      expect(thickness).toBeGreaterThanOrEqual(2);
    });
  }

  test('forced colors: no stray outline at rest, an outline while focused', async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await setup(page, FLOAT);
    const outline = () =>
      host(page).evaluate(
        (el) =>
          getComputedStyle(el.shadowRoot!.querySelector('[part="input"]')!)
            .outlineStyle,
      );
    expect(await outline()).toBe('none');
    await page.getByRole('textbox', { name: 'Email' }).focus();
    expect(await outline()).toBe('solid');
    // The label's patch is the canvas colour, so the edge is cleanly cut.
    const patch = await host(page).evaluate(
      (el) =>
        getComputedStyle(
          el.shadowRoot!.querySelector('[part="label"]')!,
          '::before',
        ).backgroundColor,
    );
    expect(patch).not.toBe('rgba(0, 0, 0, 0)');
  });
});

test.describe('prism-text-input: read-only and disabled', () => {
  test('read-only is focusable, selectable, not editable, and floated with a value', async ({
    page,
  }) => {
    await setup(
      page,
      `<prism-text-input id="f" label="Plan" floating readonly value="Team"></prism-text-input>`,
    );
    const input = page.getByRole('textbox', { name: 'Plan' });
    await input.focus();
    await expect(input).toBeFocused();
    await page.keyboard.type('x');
    await expect(input).toHaveValue('Team');
    expect((await labelPose(page)).patch).toBe(1);
  });

  test('disabled: not focusable, not submitted, label stays muted', async ({
    page,
  }) => {
    await setup(
      page,
      `<form><prism-text-input id="f" name="n" label="Plan" floating disabled value="Team"></prism-text-input><button>Go</button></form>`,
    );
    await expect(page.getByRole('textbox', { name: 'Plan' })).toBeDisabled();
    await captureSubmit(page);
    await page.getByRole('button', { name: 'Go' }).click();
    expect(await submitted(page)).toEqual({});
  });
});

for (const theme of ['light', 'dark']) {
  test(`axe: floating, affixes, clear, error, read-only (${theme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(
      page,
      `<div style="background:var(--prism-color-bg);color:var(--prism-color-text);padding:16px;display:grid;gap:20px">
        <prism-text-input label="Rest" floating></prism-text-input>
        <prism-text-input label="Floated" floating value="ada@example.com" clearable></prism-text-input>
        <prism-text-input label="Amount" floating value="42"><span slot="prefix">$</span><span slot="suffix">USD</span><span slot="description">Before tax.</span></prism-text-input>
        <prism-text-input id="bad" label="Name" floating required><span slot="error">Enter a name.</span></prism-text-input>
        <prism-text-input label="Read only" floating readonly value="Team"></prism-text-input>
        <prism-text-input label="Disabled" floating disabled value="Team"></prism-text-input>
      </div>`,
      theme,
    );
    await page.evaluate(() =>
      (document.querySelector('#bad') as HTMLInputElement).reportValidity(),
    );
    await wait(page, 300);
    expect(await axe(page)).toEqual([]);
  });
}
