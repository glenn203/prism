import { expect, test, type Page } from '@playwright/test';
import { mount } from '../../test/fixture.js';
import { painted, wait } from '../../test/field.js';

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
    value: 'value',
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
