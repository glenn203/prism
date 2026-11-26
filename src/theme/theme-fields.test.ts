// Field focus ring, and the invalid label colour.

import { expect, test, type Page } from '@playwright/test';
import { mount } from '../../test/fixture.js';
import { painted, wait } from '../../test/field.js';

// --- field-focus.test.ts ---
{
  const OPTIONS = '<prism-option value="a">Lumen</prism-option>';
  const FIELDS = {
    'text input': {
      markup: `<prism-text-input id="f" label="Email" floating required><span slot="error">Enter an email.</span></prism-text-input>`,
      part: 'input',
    },
    select: {
      markup: `<prism-select id="f" label="Plan" required>${OPTIONS}<span slot="error">Pick one.</span></prism-select>`,
      part: 'trigger',
    },
  };

  async function setup(page: Page, markup: string, theme: string) {
    await mount(page, markup);
    await page.addStyleTag({ path: 'src/tokens/tokens.css' });
    await page.addStyleTag({ path: 'src/theme/theme.css' });
    await page.evaluate(
      (t) => document.documentElement.setAttribute('data-prism-theme', t),
      theme,
    );
    await painted(page);
    await wait(page, 300);
  }

  /** Focuses the field's control and returns what it draws: colours as bytes over the page. */
  async function focusAndMeasure(page: Page, part: string, invalid: boolean) {
    const host = page.locator('#f');
    if (invalid)
      await host.evaluate((el) => (el as HTMLInputElement).reportValidity());
    const measure = () =>
      host.evaluate((el, part) => {
        const node = el.shadowRoot!.querySelector(`[part="${part}"]`)!;
        const cs = getComputedStyle(node);
        const pageBg = getComputedStyle(
          document.documentElement,
        ).getPropertyValue('--prism-color-bg');
        const ctx = document.createElement('canvas').getContext('2d')!;
        const bytes = (colour: string) => {
          ctx.fillStyle = pageBg;
          ctx.fillRect(0, 0, 1, 1);
          ctx.fillStyle = colour;
          ctx.fillRect(0, 0, 1, 1);
          return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
        };
        // A computed box-shadow is "<colour> x y blur spread" per layer, with
        // "inset" first or last; split on the commas outside parentheses.
        const shadows = cs.boxShadow.split(/,\s*(?![^(]*\))/).map((layer) => {
          const colour = layer.match(/\w+\([^)]*\)/)![0];
          const [, , blur, spread] = layer
            .replace(colour, '')
            .match(/[\d.-]+px/g)!
            .map(Number.parseFloat);
          return {
            colour: bytes(colour),
            inset: layer.includes('inset'),
            blur: blur!,
            spread: spread!,
          };
        });
        return {
          page: bytes(pageBg),
          border: bytes(cs.borderTopColor),
          borderWidth: Number.parseFloat(cs.borderTopWidth),
          shadows,
        };
      }, part);
    const rest = await measure();
    await host.evaluate(
      (el, part) =>
        (
          el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLElement
        ).focus(),
      part,
    );
    await wait(page, 500);
    return { rest, focused: await measure() };
  }

  const luminance = (c: number[]) => {
    const [r, g, b] = c.map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const contrast = (a: number[], b: number[]) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi! + 0.05) / (lo! + 0.05);
  };

  for (const theme of ['light', 'dark']) {
    for (const [name, { markup, part }] of Object.entries(FIELDS)) {
      for (const invalid of [false, true]) {
        const state = invalid ? 'invalid' : 'valid';
        test(`${theme} ${name} (${state}): focus is a full-colour border of 2px or more, with a 50% ring outside it`, async ({
          page,
        }) => {
          await setup(page, markup, theme);
          const { rest, focused } = await focusAndMeasure(page, part, invalid);
          const [gap, ring, halo, line] = focused.shadows;
          const numbers = {
            border: contrast(focused.border, focused.page),
            line: contrast(line!.colour, rest.page),
            ring: contrast(ring!.colour, focused.page),
            thickness: focused.borderWidth + line!.spread,
          };
          console.log(
            `  [${theme} ${name} ${state}] border ${numbers.border.toFixed(2)}:1 on the page, ` +
              `added line ${numbers.line.toFixed(2)}:1 against its unfocused pixels, ` +
              `50% ring ${numbers.ring.toFixed(2)}:1 on the page, ${numbers.thickness}px thick`,
          );
          // The border is the indicator: full colour, 3:1 on the page, 2px or more.
          expect(focused.border).not.toEqual(rest.border);
          expect(line!.inset).toBe(true);
          expect(line!.colour).toEqual(focused.border);
          expect(numbers.border).toBeGreaterThanOrEqual(3);
          expect(numbers.thickness).toBeGreaterThanOrEqual(2);
          // The line added on focus replaces page-coloured pixels at 3:1.
          expect(numbers.line).toBeGreaterThanOrEqual(3);
          // The ring sits past a one-pixel page-coloured gap and is translucent:
          // lighter than the border, so it reads as a halo, not a second border.
          expect(gap!.colour).toEqual(focused.page);
          expect(numbers.ring).toBeLessThan(numbers.border);
          expect(halo!.spread).toBe(4);
        });
      }
    }
  }

  test('swapping the focus border recolours the border and the ring together', async ({
    page,
  }) => {
    await setup(page, FIELDS['text input'].markup, 'light');
    await page.evaluate(() =>
      document.documentElement.style.setProperty(
        '--prism-color-focus-border',
        'rgb(0, 128, 0)',
      ),
    );
    const { focused } = await focusAndMeasure(page, 'input', false);
    expect(focused.border).toEqual([0, 128, 0]);
    // 50% of the focus colour over the page: halfway between green and the page.
    const half = focused.page.map((p, i) => (p + [0, 128, 0][i]!) / 2);
    focused.shadows[1]!.colour.forEach((v, i) =>
      expect(Math.abs(v - half[i]!)).toBeLessThanOrEqual(6),
    );
  });

  test('invalid fields use the error colour for the border and the ring, not the accent', async ({
    page,
  }) => {
    await setup(page, FIELDS.select.markup, 'light');
    await page.evaluate(() =>
      document.documentElement.style.setProperty(
        '--prism-color-accent',
        'rgb(0, 128, 0)',
      ),
    );
    const { focused } = await focusAndMeasure(page, 'trigger', true);
    expect(focused.border[1]).toBeLessThan(focused.border[0]!);
    expect(focused.shadows[1]!.colour[0]).toBeGreaterThan(
      focused.shadows[1]!.colour[1]!,
    );
  });
}

// --- field-label-error.test.ts ---
{
  const OPTIONS = '<prism-option value="a">Lumen</prism-option>';
  const ERROR = '<span slot="error">Required.</span>';
  const FIELDS = {
    'floating text input': {
      markup: `<prism-text-input id="f" label="Email" floating required>${ERROR}</prism-text-input>`,
      value: 'input',
    },
    'text input': {
      markup: `<prism-text-input id="f" label="Email" required>${ERROR}</prism-text-input>`,
      value: 'input',
    },
    'password input': {
      markup: `<prism-password-input id="f" label="Password" required>${ERROR}</prism-password-input>`,
      value: 'input',
    },
    'text area': {
      markup: `<prism-text-area id="f" label="Notes" required>${ERROR}</prism-text-area>`,
      value: 'input',
    },
    select: {
      markup: `<prism-select id="f" label="Plan" required>${OPTIONS}${ERROR}</prism-select>`,
      value: 'trigger',
    },
  };

  async function setup(page: Page, markup: string, theme: string) {
    await mount(page, markup);
    await page.addStyleTag({ path: 'src/tokens/tokens.css' });
    await page.addStyleTag({ path: 'src/theme/theme.css' });
    await page.evaluate(
      (t) => document.documentElement.setAttribute('data-prism-theme', t),
      theme,
    );
    await painted(page);
    await wait(page, 300);
  }

  /** Label colour and value colour as bytes, plus the fill behind the label. */
  const read = (page: Page, valuePart: string) =>
    page.locator('#f').evaluate((el, valuePart) => {
      const root = el.shadowRoot!;
      const ctx = document.createElement('canvas').getContext('2d')!;
      const bytes = (colour: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = colour;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
      };
      const label = root.querySelector('[part="label"]')!;
      const patch = getComputedStyle(label, '::before').backgroundColor;
      const behind =
        patch === 'rgba(0, 0, 0, 0)'
          ? getComputedStyle(
              root.querySelector('[part="input"], [part="trigger"]')!,
            ).backgroundColor
          : patch;
      return {
        label: bytes(getComputedStyle(label).color),
        value: bytes(
          getComputedStyle(root.querySelector(`[part="${valuePart}"]`)!).color,
        ),
        behind: bytes(behind),
        errorText: bytes(
          getComputedStyle(document.documentElement).getPropertyValue(
            '--prism-color-error-text',
          ),
        ),
      };
    }, valuePart);

  const invalidate = (page: Page) =>
    page
      .locator('#f')
      .evaluate((el) => (el as HTMLInputElement).reportValidity());

  const luminance = (c: number[]) => {
    const [r, g, b] = c.map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const contrast = (a: number[], b: number[]) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi! + 0.05) / (lo! + 0.05);
  };

  for (const theme of ['light', 'dark']) {
    for (const [name, { markup, value }] of Object.entries(FIELDS)) {
      test(`${theme} ${name}: an invalid label is the error text colour at 4.5:1 and the value text is unchanged`, async ({
        page,
      }) => {
        await setup(page, markup, theme);
        const valid = await read(page, value);
        expect(valid.label).not.toEqual(valid.errorText);
        await invalidate(page);
        await wait(page, 300);
        const invalid = await read(page, value);
        expect(invalid.label).toEqual(invalid.errorText);
        expect(invalid.value).toEqual(valid.value);
        const ratio = contrast(invalid.label, invalid.behind);
        console.log(`  [${theme} ${name}] invalid label ${ratio.toFixed(2)}:1`);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    }

    test(`${theme} floating label: red resting, focused and floated by a value, 4.5:1 on its patch`, async ({
      page,
    }) => {
      await setup(page, FIELDS['floating text input'].markup, theme);
      await invalidate(page);
      await wait(page, 300);
      const resting = await read(page, 'input');
      await page.getByRole('textbox', { name: 'Email' }).focus();
      await wait(page, 500);
      const focused = await read(page, 'input');
      // A value that fails its type keeps the field invalid with the label floated.
      await setup(
        page,
        `<prism-text-input id="f" label="Email" type="email" value="not an email" floating>${ERROR}</prism-text-input>`,
        theme,
      );
      await invalidate(page);
      await wait(page, 500);
      const floated = await read(page, 'input');
      for (const pose of [resting, focused, floated]) {
        expect(pose.label).toEqual(pose.errorText);
        expect(contrast(pose.label, pose.behind)).toBeGreaterThanOrEqual(4.5);
      }
      console.log(
        `  [${theme} floating label] resting ${contrast(resting.label, resting.behind).toFixed(2)}:1, ` +
          `focused ${contrast(focused.label, focused.behind).toFixed(2)}:1, ` +
          `floated ${contrast(floated.label, floated.behind).toFixed(2)}:1`,
      );
    });
  }

  test('forced colors: an invalid label takes the system text colour, like a valid one', async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await setup(page, FIELDS['floating text input'].markup, 'light');
    const valid = await read(page, 'input');
    await invalidate(page);
    await wait(page, 300);
    expect((await read(page, 'input')).label).toEqual(valid.label);
  });
}
