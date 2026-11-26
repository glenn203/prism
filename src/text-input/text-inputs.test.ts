import { expect, test, type Page } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { captureSubmit, mount, submitted } from '../../test/fixture.js';

const withTheme = async (page: Page) => {
  await page.addStyleTag({ path: 'src/tokens/tokens.css' });
  await page.addStyleTag({ path: 'src/theme/theme.css' });
};
const native = (page: Page, sel: string) =>
  page.locator(sel).locator('input, textarea').first();

// axe-core ships with the repo via @storybook/addon-a11y (no new dependency).
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
  <prism-text-input label="Email" type="email" name="email" autocomplete="email" required><span slot="description">Receipts only.</span><span slot="error">Enter an email.</span></prism-text-input>
  <prism-password-input label="Password" name="pw" required></prism-password-input>
  <prism-search-input label="Search" name="q"></prism-search-input>
  <prism-otp-input label="Code" name="otp" required><span slot="error">Enter the code.</span></prism-otp-input>
  <prism-text-area label="Bio" name="bio" maxlength="40" counter></prism-text-area>`;

test('axe: no WCAG A/AA violations, valid and invalid', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); // no mid-fade samples
  await mount(page, `<form>${ALL}</form>`);
  await withTheme(page);
  expect(await axe(page)).toEqual([]);
  await page.evaluate(() =>
    document
      .querySelectorAll<HTMLElement & { checkValidity(): boolean }>(
        '[required]',
      )
      .forEach((e) => e.checkValidity()),
  );
  expect(await axe(page)).toEqual([]);
});

test('all: label 2px above, description 4px below, shared error box', async ({
  page,
}) => {
  await mount(
    page,
    ['text-input', 'password-input', 'search-input', 'text-area']
      .map(
        (t) =>
          `<prism-${t} label="L" required><span slot="description">D</span><span slot="error">E</span></prism-${t}>`,
      )
      .join(''),
  );
  await withTheme(page);
  for (const t of [
    'text-input',
    'password-input',
    'search-input',
    'text-area',
  ]) {
    const g = await page.locator(`prism-${t}`).evaluate((el) => {
      const r = el.shadowRoot!;
      const q = (p: string) =>
        r.querySelector(`[part="${p}"]`)!.getBoundingClientRect();
      return {
        label: q('input').top - q('label').bottom,
        desc: q('description').top - q('input').bottom,
      };
    });
    expect(g, t).toEqual({ label: 2, desc: 4 });
    await page
      .locator(`prism-${t}`)
      .evaluate((e: HTMLElement & { checkValidity(): boolean }) =>
        e.checkValidity(),
      );
    const err = await page.locator(`prism-${t}`).evaluate((el) => {
      const s = getComputedStyle(
        el.shadowRoot!.querySelector('[part="message-box"]')!,
      );
      return [
        s.paddingTop,
        s.paddingRight,
        s.paddingBottom,
        s.marginTop,
        s.borderBottomLeftRadius,
      ];
    });
    expect(err, t).toEqual(['7px', '12px', '3px', '-2px', '5px']);
  }
});

test('focus ring grows in on the spring for every input', async ({ page }) => {
  await mount(page, ALL);
  await withTheme(page);
  for (const t of [
    'text-input',
    'password-input',
    'search-input',
    'text-area',
  ]) {
    const tf = await page
      .locator(`prism-${t}`)
      .evaluate(
        (el) =>
          getComputedStyle(el.shadowRoot!.querySelector('[part="input"]')!)
            .transitionTimingFunction,
      );
    expect(tf, t).toContain('linear(');
  }
  await page.emulateMedia({ reducedMotion: 'reduce' }); // read the settled ring
  await native(page, 'prism-text-input').focus();
  const ring = await page
    .locator('prism-text-input')
    .evaluate(
      (el) =>
        getComputedStyle(el.shadowRoot!.querySelector('[part="input"]')!)
          .boxShadow,
    );
  expect(ring).toMatch(/4px/);
});

test('form submit + reset across the family', async ({ page }) => {
  await mount(
    page,
    `<form>
      <prism-text-input label="Name" name="name" value="Ada"></prism-text-input>
      <prism-password-input label="Password" name="pw"></prism-password-input>
      <prism-search-input label="Search" name="q"></prism-search-input>
      <prism-otp-input label="Code" name="otp" required><span slot="error">Enter the code.</span></prism-otp-input>
      <prism-text-area label="Bio" name="bio"></prism-text-area>
      <prism-text-input label="Off" name="off" value="x" disabled></prism-text-input>
      <button>Go</button></form>`,
  );
  await captureSubmit(page);
  await native(page, 'prism-text-input[name="name"]').fill('Grace');
  await native(page, 'prism-password-input').fill('s3cret!');
  await native(page, 'prism-search-input').fill('lit');
  await native(page, 'prism-otp-input').fill('123456');
  await native(page, 'prism-text-area').fill('line 1\nline 2');
  await page.getByRole('button', { name: 'Go' }).click();
  expect(await submitted(page)).toEqual({
    name: 'Grace',
    pw: 's3cret!',
    q: 'lit',
    otp: '123456',
    bio: 'line 1\nline 2',
  });
  await page.evaluate(() => document.querySelector('form')!.reset());
  const vals = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement & { value: string }>('form > *')]
      .filter((e) => 'value' in e && e.localName.startsWith('prism'))
      .map((e) => e.value),
  );
  expect(vals).toEqual(['Ada', '', '', '', '', 'x']);
});

test('required / readonly / disabled behave natively', async ({ page }) => {
  await mount(
    page,
    `<form><prism-text-input label="A" name="a" required></prism-text-input>
     <prism-text-area label="B" name="b" readonly value="ro"></prism-text-area>
     <prism-search-input label="C" name="c" disabled value="dis"></prism-search-input></form>`,
  );
  const ok = await page.evaluate(() =>
    document.querySelector('form')!.checkValidity(),
  );
  expect(ok).toBe(false);
  await expect(native(page, 'prism-text-input')).toHaveAttribute(
    'required',
    '',
  );
  await expect(native(page, 'prism-text-area')).toHaveAttribute('readonly', '');
  await expect(native(page, 'prism-search-input')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Clear search' })).toBeHidden();
  await expect(page.locator('prism-text-input')).toHaveJSProperty(
    'validationMessage',
    'Please fill out this field.',
  );
});

test('TextInput: type, inputmode, pattern, min/maxlength, autocomplete passthrough', async ({
  page,
}) => {
  await mount(
    page,
    `<prism-text-input label="Phone" type="tel" inputmode="tel" autocomplete="tel" pattern="[0-9 ]+" minlength="3" maxlength="12"></prism-text-input>
     <prism-text-input label="Site" type="url"></prism-text-input>
     <prism-text-input label="Plain"></prism-text-input>`,
  );
  const tel = native(page, 'prism-text-input[type="tel"]');
  for (const [k, v] of Object.entries({
    type: 'tel',
    inputmode: 'tel',
    autocomplete: 'tel',
    pattern: '[0-9 ]+',
    minlength: '3',
    maxlength: '12',
  }))
    await expect(tel).toHaveAttribute(k, v);
  await expect(native(page, 'prism-text-input[type="url"]')).toHaveJSProperty(
    'type',
    'url',
  );
  // No autocomplete attribute unless asked for: the browser default applies.
  await expect(
    native(page, 'prism-text-input[label="Plain"]'),
  ).not.toHaveAttribute('autocomplete', /.*/);
  await tel.fill('abc');
  await tel.blur();
  const mismatch = await page
    .locator('prism-text-input[type="tel"]')
    .evaluate(
      (e: HTMLElement & { validity: ValidityState }) =>
        e.validity.patternMismatch,
    );
  expect(mismatch).toBe(true);
});

test('deprecated prism-text-field is a TextInput alias', async ({ page }) => {
  await mount(
    page,
    `<prism-text-field label="Old" value="v"></prism-text-field>`,
  );
  const isTI = await page.evaluate(
    () =>
      document.querySelector('prism-text-field') instanceof
      customElements.get('prism-text-input')!,
  );
  expect(isTI).toBe(true);
  await expect(page.getByRole('textbox', { name: 'Old' })).toHaveValue('v');
});

test('PasswordInput: toggle a11y, keeps caret + selection, autocomplete, no leakage', async ({
  page,
}) => {
  await mount(
    page,
    `<form><prism-password-input label="Password" name="pw" value="hunter22"></prism-password-input>
     <prism-password-input label="New password" autocomplete="new-password"></prism-password-input></form>`,
  );
  const host = page.locator('prism-password-input').first();
  const input = page.getByLabel('Password', { exact: true });
  const toggle = host.getByRole('button', { name: 'Show password' });
  await expect(input).toHaveAttribute('type', 'password');
  await expect(input).toHaveAttribute('autocomplete', 'current-password');
  await expect(input).toHaveAttribute('spellcheck', 'false');
  await expect(
    page.getByLabel('New password', { exact: true }),
  ).toHaveAttribute('autocomplete', 'new-password');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await input.fill('topsecret');
  await expect(host).not.toHaveAttribute('value', 'topsecret');
  await input.focus();
  await input.evaluate((e: HTMLInputElement) => e.setSelectionRange(3, 7));
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(input).toHaveAttribute('type', 'text');
  await expect(input).toBeFocused();
  const sel: (number | null)[] = await input.evaluate((e: HTMLInputElement) => [
    e.selectionStart,
    e.selectionEnd,
  ]);
  expect(sel).toEqual([3, 7]);
  await page.keyboard.press('Tab');
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Space');
  await expect(input).toHaveAttribute('type', 'password');
  await toggle.click();
  await page.evaluate(() => document.querySelector('form')!.reset());
  await expect(input).toHaveAttribute('type', 'password');
});

test('SearchInput: searchbox role, clear button, Escape, search event', async ({
  page,
}) => {
  await mount(
    page,
    `<form><prism-search-input label="Search" name="q"></prism-search-input></form>`,
  );
  await captureSubmit(page);
  const box = page.getByRole('searchbox', { name: 'Search' });
  const clear = page.getByRole('button', { name: 'Clear search' });
  await expect(box).toBeVisible();
  await expect(clear).toBeHidden();
  await box.fill('lit');
  await expect(clear).toBeVisible();
  await clear.click();
  await expect(box).toHaveValue('');
  await expect(box).toBeFocused();
  await expect(clear).toBeHidden();
  await box.fill('again');
  await page.keyboard.press('Escape');
  await expect(box).toHaveValue('');
  await expect(box).toBeFocused();
  await page.evaluate(() =>
    document
      .querySelector('prism-search-input')!
      .addEventListener('search', (e) => {
        (window as unknown as { got: unknown }).got = (e as CustomEvent).detail;
      }),
  );
  await box.fill('query');
  await page.keyboard.press('Enter');
  expect(
    await page.evaluate(() => (window as unknown as { got: unknown }).got),
  ).toEqual({ value: 'query' });
  expect(await submitted(page)).toEqual({ q: 'query' });
});

test('SearchInput: cancelling search skips form submit', async ({ page }) => {
  await mount(
    page,
    `<form><prism-search-input label="Search" name="q"></prism-search-input></form>`,
  );
  await captureSubmit(page);
  await page.evaluate(() =>
    document
      .querySelector('prism-search-input')!
      .addEventListener('search', (e) => e.preventDefault()),
  );
  await page.getByRole('searchbox').fill('x');
  await page.keyboard.press('Enter');
  expect(await submitted(page)).toBeUndefined();
});

test('OtpInput: one real input with autofill attrs, typing, paste, backspace, prism-otp-complete', async ({
  page,
}) => {
  await mount(
    page,
    `<form><prism-otp-input label="Code" name="otp" required></prism-otp-input></form>`,
  );
  const box = page.getByRole('textbox', { name: 'Code' });
  await expect(page.locator('prism-otp-input').locator('input')).toHaveCount(1);
  for (const [k, v] of Object.entries({
    autocomplete: 'one-time-code',
    inputmode: 'numeric',
    maxlength: '6',
    pattern: '\\d{6}',
  }))
    await expect(box).toHaveAttribute(k, v);
  const cells = (): Promise<(string | null)[]> =>
    page
      .locator('prism-otp-input')
      .evaluate((el) =>
        [...el.shadowRoot!.querySelectorAll('[part~="cell"]')].map(
          (c) => c.textContent,
        ),
      );
  expect((await cells()).length).toBe(6);
  await page.evaluate(() =>
    document
      .querySelector('prism-otp-input')!
      .addEventListener('prism-otp-complete', (e) => {
        const w = window as unknown as { done?: unknown[] };
        (w.done ??= []).push((e as CustomEvent).detail);
      }),
  );
  await box.focus();
  await page.keyboard.type('12x3');
  expect(await cells()).toEqual(['1', '2', '3', '', '', '']);
  await expect(page.locator('prism-otp-input')).toHaveJSProperty(
    'validationMessage',
    'Enter all 6 digits.',
  );
  await page.keyboard.press('Backspace');
  await expect(box).toHaveValue('12');
  await box.evaluate((el) => {
    const dt = new DataTransfer();
    dt.setData('text', '987-654');
    el.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(box).toHaveValue('987654');
  expect(await cells()).toEqual(['9', '8', '7', '6', '5', '4']);
  expect(
    await page.evaluate(() => (window as unknown as { done: unknown }).done),
  ).toEqual([{ value: '987654' }]);
  await expect(page.locator('prism-otp-input')).toHaveJSProperty(
    'validationMessage',
    '',
  );
  // Active cell follows the caret.
  await page.keyboard.press('Backspace');
  const active = await page
    .locator('prism-otp-input')
    .evaluate((el) =>
      [...el.shadowRoot!.querySelectorAll('[part~="cell"]')].findIndex((c) =>
        c.getAttribute('part')!.includes('cell-active'),
      ),
    );
  expect(active).toBe(5);
});

test('TextArea: rows, autosize grows, no Enter submit, polite counter', async ({
  page,
}) => {
  await mount(
    page,
    `<form><prism-text-area label="Bio" name="bio" rows="2" autosize counter maxlength="40"></prism-text-area></form>`,
  );
  await captureSubmit(page);
  const ta = page.getByRole('textbox', { name: 'Bio' });
  await expect(ta).toHaveAttribute('rows', '2');
  const h0 = (await ta.boundingBox())!.height;
  await ta.focus();
  await page.keyboard.type('one');
  await page.keyboard.press('Enter');
  await page.keyboard.type('two');
  await page.keyboard.press('Enter');
  await page.keyboard.type('three');
  await page.keyboard.press('Enter');
  await page.keyboard.type('four');
  expect(await submitted(page)).toBeUndefined();
  expect((await ta.boundingBox())!.height).toBeGreaterThan(h0);
  const counter = page.locator('prism-text-area').locator('[part="counter"]');
  await expect(counter).toHaveText('18 / 40');
  await expect(counter).toHaveAttribute('aria-hidden', 'true');
  const status = page.locator('prism-text-area').getByRole('status');
  await expect(status).toHaveText(''); // quiet while plenty remain
  await ta.fill('x'.repeat(35));
  await expect(status).toHaveText('5 characters remaining.');
  await ta.fill('x'.repeat(40));
  await expect(status).toHaveText('Character limit reached, 40 of 40.');
});

test('densities × sizes: every control (and OTP box) matches the control-height token', async ({
  page,
}) => {
  const tags = ['text-input', 'password-input', 'search-input', 'otp-input'];
  await mount(
    page,
    ['compact', 'default', 'comfortable']
      .flatMap((d) =>
        ['sm', 'md', 'lg'].map(
          (s) =>
            `<div data-prism-density="${d}" data-prism-size="${s}">${tags
              .map((t) => `<prism-${t} label="x" size="${s}"></prism-${t}>`)
              .join('')}</div>`,
        ),
      )
      .join(''),
  );
  await withTheme(page);
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-prism-size]')].map(
      (row) => {
        const probe = document.createElement('div');
        probe.style.blockSize = `var(--prism-control-height-${row.dataset.prismSize})`;
        row.append(probe);
        const want = probe.getBoundingClientRect().height;
        probe.remove();
        const got = [...row.children].map((el) => {
          const t = el.shadowRoot!.querySelector(
            '[part="input"], [part~="cell"]',
          )!;
          return t.getBoundingClientRect().height;
        });
        return { want, got };
      },
    ),
  );
  for (const r of rows) for (const h of r.got) expect(h).toBe(r.want);
});

test('OtpInput error is red text only, 5px below the boxes, clears the focus ring', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mount(
    page,
    `<prism-otp-input label="Code" required><span slot="description">Sent to you.</span><span slot="error">Enter the 6-digit code.</span></prism-otp-input>
     <prism-text-input label="Other" required><span slot="error">E</span></prism-text-input>`,
  );
  await withTheme(page);
  await page.evaluate(() =>
    document
      .querySelectorAll<HTMLElement & { checkValidity(): boolean }>(
        '[required]',
      )
      .forEach((e) => e.checkValidity()),
  );
  const box = page.getByRole('textbox', { name: 'Code' });
  await box.focus();
  const g = await page.locator('prism-otp-input').evaluate((el) => {
    const r = el.shadowRoot!;
    const err = r.querySelector<HTMLElement>('[part="message-box"]')!;
    const cs = getComputedStyle(err);
    const before = getComputedStyle(err, '::before').content;
    const cells = r.querySelector('[part~="cells"]')!.getBoundingClientRect();
    const active = r.querySelector('[part~="cell-active"]')!;
    const ring = getComputedStyle(active).boxShadow;
    return {
      bg: cs.backgroundColor,
      padding: cs.padding,
      marginTop: cs.marginTop,
      marginInline: [cs.marginLeft, cs.marginRight],
      radius: cs.borderBottomLeftRadius,
      before,
      color: cs.color,
      font: [cs.fontSize, cs.lineHeight, cs.fontWeight],
      gap: err.getBoundingClientRect().top - cells.bottom,
      ring,
      descHidden: r
        .querySelector('[part="description"]')!
        .hasAttribute('hidden'),
    };
  });
  expect(g.bg).toBe('rgba(0, 0, 0, 0)');
  expect(g.padding).toBe('0px');
  expect(g.marginTop).toBe('5px');
  expect(g.marginInline).toEqual(['0px', '0px']);
  expect(g.radius).toBe('0px');
  expect(g.before).toBe('none');
  expect(g.color).toBe('oklch(0.368 0.147 12)');
  expect(g.font).toEqual(['12px', '16px', '400']);
  expect(g.gap).toBe(5); // ring reaches 4px → clears by 1px
  expect(g.ring).toMatch(/4px/);
  expect(g.descHidden).toBe(true);
  await expect(box).toHaveAccessibleDescription('Enter the 6-digit code.');
  // Other inputs keep the attached box.
  const other = await page
    .locator('prism-text-input')
    .evaluate(
      (el) =>
        getComputedStyle(el.shadowRoot!.querySelector('[part="message-box"]')!)
          .backgroundColor,
    );
  expect(other).not.toBe('rgba(0, 0, 0, 0)');
});

test('OtpInput description sits 4px below the boxes', async ({ page }) => {
  await mount(
    page,
    `<prism-otp-input label="Code"><span slot="description">Sent.</span></prism-otp-input>`,
  );
  await withTheme(page);
  const gap = await page.locator('prism-otp-input').evaluate((el) => {
    const r = el.shadowRoot!;
    return (
      r.querySelector('[part="description"]')!.getBoundingClientRect().top -
      r.querySelector('[part~="cells"]')!.getBoundingClientRect().bottom
    );
  });
  expect(gap).toBe(4);
});
