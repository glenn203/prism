import { expect, test, type Page } from '@playwright/test';
import { axe } from '../../test/axe.js';
import { mount } from '../../test/fixture.js';
import { maxStep, recordFrames, wait } from '../../test/field.js';
import {
  mouseDown,
  releaseFrames,
  scaleAnims,
  scaleOf,
} from '../../test/press.js';

async function setup(page: Page, markup: string, theme = 'light') {
  await mount(page, markup);
  await page.addStyleTag({ path: 'src/tokens/tokens.css' });
  await page.addStyleTag({ path: 'src/theme/theme.css' });
  await page.evaluate(
    (t) => document.documentElement.setAttribute('data-prism-theme', t),
    theme,
  );
  await wait(page, 600);
}

const SIZES = `
  <prism-button id="sm" size="sm">Save</prism-button>
  <prism-button id="md">Save</prism-button>
  <prism-button id="lg" size="lg">Save</prism-button>
  <prism-button id="wide" size="lg" style="display:block;inline-size:420px">Save changes</prism-button>
  <prism-icon-button id="icon" label="Add">+</prism-icon-button>`;

const host = (page: Page, id: string) => page.locator(id);

test.describe('press: depth is proportional to size', () => {
  const cases: [string, number][] = [
    ['#sm', 0.03],
    ['#md', 0.025],
    ['#lg', 0.02],
    ['#wide', 0.015],
    ['#icon', 0.03],
  ];
  for (const [id, depth] of cases)
    test(`${id} shrinks by ${depth * 100}% while held and returns to rest`, async ({
      page,
    }) => {
      await setup(page, SIZES);
      const h = host(page, id);
      expect(await scaleOf(h, 'button')).toBe(1);
      await mouseDown(page, h);
      await wait(page, 350);
      expect(await scaleOf(h, 'button')).toBeCloseTo(1 - depth, 3);
      const { scales, settleMs } = await releaseFrames(page, h, 'button');
      // Eases back without ever passing full size.
      expect(Math.max(...scales)).toBeLessThanOrEqual(1);
      expect(
        scales.every((v, i) => i === 0 || v >= scales[i - 1]! - 1e-6),
      ).toBe(true);
      expect(settleMs).toBeGreaterThan(150);
      expect(settleMs).toBeLessThan(300);
      expect(await scaleOf(h, 'button')).toBe(1);
      expect(
        await h.evaluate(
          (e) => e.shadowRoot!.querySelector('button')!.style.scale,
        ),
      ).toBe('');
      expect(await scaleAnims(h, 'button')).toEqual([]);
    });

  test('the scale is one number (never an uneven squish) and the transform is left alone', async ({
    page,
  }) => {
    await setup(page, SIZES);
    const h = host(page, '#md');
    await mouseDown(page, h);
    await wait(page, 120);
    const r = await h.evaluate((e) => {
      const cs = getComputedStyle(e.shadowRoot!.querySelector('button')!);
      return { scale: cs.scale, transform: cs.transform };
    });
    expect(r.scale.split(' ')).toHaveLength(1);
    expect(r.transform).toBe('none');
    await page.mouse.up();
  });

  test('a wide button is anything over 240px: it presses by less than the same size narrow', async ({
    page,
  }) => {
    await setup(
      page,
      `<prism-button id="a">Save</prism-button><prism-button id="b" style="display:block;inline-size:300px">Save</prism-button>`,
    );
    await mouseDown(page, host(page, '#a'));
    await wait(page, 300);
    const narrow = await scaleOf(host(page, '#a'), 'button');
    await page.mouse.up();
    await wait(page, 400);
    await mouseDown(page, host(page, '#b'));
    await wait(page, 300);
    expect(await scaleOf(host(page, '#b'), 'button')).toBeGreaterThan(narrow);
    await page.mouse.up();
  });
});

test.describe('press: motion', () => {
  test('nothing animates at rest or on first paint', async ({ page }) => {
    await mount(page, SIZES);
    for (const id of ['#sm', '#md', '#lg', '#wide', '#icon'])
      expect(await scaleAnims(host(page, id), 'button')).toEqual([]);
  });

  test('only the scale moves, on springs', async ({ page }) => {
    await setup(page, SIZES);
    const h = host(page, '#md');
    await mouseDown(page, h);
    expect(await scaleAnims(h, 'button')).toEqual(['scale']);
    await page.mouse.up();
  });

  test('release eases back to full size: never past 1.0, settled in about 250ms', async ({
    page,
  }) => {
    await setup(page, SIZES);
    const h = host(page, '#md');
    const rows = await recordFrames(
      h,
      900,
      (root) => {
        const s = getComputedStyle(root.querySelector('button')!).scale;
        return [s === 'none' ? 1 : parseFloat(s)];
      },
      [
        {
          at: 100,
          run: (e) =>
            e.shadowRoot!.querySelector('button')!.dispatchEvent(
              new PointerEvent('pointerdown', {
                bubbles: true,
                composed: true,
                button: 0,
                isPrimary: true,
              }),
            ),
        },
        {
          at: 500,
          run: (e) =>
            e.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })),
        },
      ],
    );
    const s = rows.map((r) => r[0]!);
    const t0 = rows.findIndex(
      (_, i) => i > 0 && s[i]! > s[i - 1]! + 1e-4 && i * 16.7 > 480,
    );
    expect(Math.min(...s)).toBeCloseTo(0.975, 3);
    // The whole run, press and release, never goes above full size.
    expect(Math.max(...s)).toBeLessThanOrEqual(1);
    // Last frame that is visibly off rest (more than a tenth of a percent).
    const off = s.map((v, i) => (Math.abs(v - 1) > 0.001 && i >= t0 ? i : -1));
    const settled = (Math.max(...off) - t0) * 16.7;
    expect(settled).toBeGreaterThan(150);
    expect(settled).toBeLessThan(300);
    expect(s.at(-1)).toBe(1);
  });

  test('every frame moves a little: no jumps going in, out, or when taken over', async ({
    page,
  }) => {
    await setup(page, SIZES);
    const h = host(page, '#md');
    const rows = await recordFrames(
      h,
      1100,
      (root) => {
        const s = getComputedStyle(root.querySelector('button')!).scale;
        return [s === 'none' ? 1 : parseFloat(s)];
      },
      [
        {
          at: 100,
          run: (e) =>
            e.shadowRoot!.querySelector('button')!.dispatchEvent(
              new PointerEvent('pointerdown', {
                bubbles: true,
                composed: true,
                button: 0,
                isPrimary: true,
              }),
            ),
        },
        {
          at: 400,
          run: (e) =>
            e.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })),
        },
        // Pressed again while it is still springing back.
        {
          at: 480,
          run: (e) =>
            e.shadowRoot!.querySelector('button')!.dispatchEvent(
              new PointerEvent('pointerdown', {
                bubbles: true,
                composed: true,
                button: 0,
                isPrimary: true,
              }),
            ),
        },
        {
          at: 700,
          run: (e) =>
            e.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })),
        },
      ],
    );
    const s = rows.map((r) => r[0]!);
    // The whole move is 2.5% in and 2.5% back: no frame takes half of it,
    // and the speed itself never changes abruptly.
    expect(maxStep(rows)[0]).toBeLessThan(0.0175);
    const accel = s.slice(2).map((v, i) => Math.abs(v - 2 * s[i + 1]! + s[i]!));
    expect(Math.max(...accel)).toBeLessThan(0.014);
    expect(Math.min(...s)).toBeGreaterThan(0.97);
    expect(Math.max(...s)).toBeLessThanOrEqual(1);
    expect(s.at(-1)).toBe(1);
  });
});

test.describe('press: keyboard', () => {
  for (const key of ['Enter', ' ']) {
    test(`${key === ' ' ? 'Space' : key} shows a brief press, at least 90ms, and still activates`, async ({
      page,
    }) => {
      await setup(page, `<prism-button id="b">Save</prism-button>`);
      await page.evaluate(() => {
        (window as unknown as { clicks: number }).clicks = 0;
        document
          .querySelector('#b')!
          .addEventListener(
            'click',
            () => (window as unknown as { clicks: number }).clicks++,
          );
      });
      await page.keyboard.press('Tab');
      const rec = recordFrames(host(page, '#b'), 700, (root) => {
        const s = getComputedStyle(root.querySelector('button')!).scale;
        return [s === 'none' ? 1 : parseFloat(s)];
      });
      await wait(page, 100);
      await page.keyboard.press(key);
      const s = (await rec).map((r) => r[0]!);
      const frames = s.filter((v) => v < 0.99).length;
      expect(Math.min(...s)).toBeLessThan(0.98);
      expect(frames * 16.7).toBeGreaterThan(80);
      expect(s.at(-1)).toBe(1);
      expect(
        await page.evaluate(
          () => (window as unknown as { clicks: number }).clicks,
        ),
      ).toBe(1);
    });
  }

  test('holding Space keeps it pressed until the key is released', async ({
    page,
  }) => {
    await setup(page, `<prism-button id="b">Save</prism-button>`);
    await page.keyboard.press('Tab');
    await page.keyboard.down(' ');
    await wait(page, 400);
    expect(await scaleOf(host(page, '#b'), 'button')).toBeCloseTo(0.975, 3);
    await page.keyboard.up(' ');
    await wait(page, 500);
    expect(await scaleOf(host(page, '#b'), 'button')).toBe(1);
  });

  test('icon button presses on Enter too', async ({ page }) => {
    await setup(
      page,
      `<prism-icon-button id="i" label="Add">+</prism-icon-button>`,
    );
    await page.keyboard.press('Tab');
    await page.keyboard.down('Enter');
    await wait(page, 200);
    expect(await scaleOf(host(page, '#i'), 'button')).toBeCloseTo(0.97, 3);
    await page.keyboard.up('Enter');
  });
});

test.describe('press: reduced motion, disabled, still rows', () => {
  test('reduced motion: no scale and no animation, only the pressed colour', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(page, SIZES);
    const h = host(page, '#md');
    await mouseDown(page, h);
    await wait(page, 200);
    expect(await scaleOf(h, 'button')).toBe(1);
    expect(await scaleAnims(h, 'button')).toEqual([]);
    expect(
      await h.evaluate((e) =>
        e.shadowRoot!.querySelector('button')!.hasAttribute('data-pressed'),
      ),
    ).toBe(true);
    const overlay = await h.evaluate(
      (e) =>
        getComputedStyle(e.shadowRoot!.querySelector('button')!)
          .backgroundImage,
    );
    expect(overlay).not.toBe('none');
    await page.mouse.up();
    await wait(page, 100);
    expect(
      await h.evaluate((e) =>
        e.shadowRoot!.querySelector('button')!.hasAttribute('data-pressed'),
      ),
    ).toBe(false);
  });

  test('reduced motion: a key press shows the colour too', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(page, `<prism-button id="b">Save</prism-button>`);
    await page.keyboard.press('Tab');
    await page.keyboard.down('Enter');
    await wait(page, 50);
    expect(
      await host(page, '#b').evaluate((e) =>
        e.shadowRoot!.querySelector('button')!.hasAttribute('data-pressed'),
      ),
    ).toBe(true);
    await page.keyboard.up('Enter');
    expect(await scaleOf(host(page, '#b'), 'button')).toBe(1);
  });

  test('a disabled button and icon button do not press', async ({ page }) => {
    await setup(
      page,
      `<prism-button id="b" disabled>Save</prism-button><prism-icon-button id="i" label="Add" disabled>+</prism-icon-button>`,
    );
    for (const id of ['#b', '#i']) {
      await mouseDown(page, host(page, id));
      await wait(page, 150);
      expect(await scaleOf(host(page, id), 'button')).toBe(1);
      expect(await scaleAnims(host(page, id), 'button')).toEqual([]);
      await page.mouse.up();
    }
  });

  test('buttons inside [data-prism-still] (dense rows) keep still but show the press colour', async ({
    page,
  }) => {
    await setup(
      page,
      `<div data-prism-still><prism-button id="b" size="sm">Edit</prism-button></div>`,
    );
    await mouseDown(page, host(page, '#b'));
    await wait(page, 150);
    expect(await scaleOf(host(page, '#b'), 'button')).toBe(1);
    expect(await scaleAnims(host(page, '#b'), 'button')).toEqual([]);
    await page.mouse.up();
  });
});

test.describe('press: the click still lands', () => {
  test('a press that ends on the very edge of a wide button still clicks it, once', async ({
    page,
  }) => {
    await setup(
      page,
      `<prism-button id="w" size="lg" style="display:block;inline-size:420px">Save changes</prism-button>`,
    );
    await page.evaluate(() => {
      (window as unknown as { clicks: number }).clicks = 0;
      document
        .querySelector('#w')!
        .addEventListener(
          'click',
          () => (window as unknown as { clicks: number }).clicks++,
        );
    });
    const b = (await host(page, '#w').boundingBox())!;
    // 1px inside the left edge: the pressed button has shrunk by ~3px there.
    await page.mouse.move(b.x + 1, b.y + b.height / 2);
    await page.mouse.down();
    await wait(page, 200);
    await page.mouse.up();
    await wait(page, 50);
    expect(
      await page.evaluate(
        () => (window as unknown as { clicks: number }).clicks,
      ),
    ).toBe(1);
  });

  test('a form submit button still submits; a toggle still toggles', async ({
    page,
  }) => {
    await setup(
      page,
      `<form id="f"><prism-button id="s" name="go" value="1">Go</prism-button></form><prism-button id="t" type="button" pressed>Bold</prism-button>`,
    );
    await page.evaluate(() => {
      const f = document.querySelector('#f') as HTMLFormElement;
      (window as unknown as { sent: number }).sent = 0;
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        (window as unknown as { sent: number }).sent++;
      });
    });
    await host(page, '#s').click();
    await host(page, '#t').click();
    await wait(page, 300);
    expect(
      await page.evaluate(() => (window as unknown as { sent: number }).sent),
    ).toBe(1);
    await expect(host(page, '#t')).toHaveJSProperty('pressed', false);
  });
});

for (const theme of ['light', 'dark'])
  test(`axe: buttons at rest and while pressed (${theme})`, async ({
    page,
  }) => {
    await setup(
      page,
      SIZES + `<prism-button variant="outline">Cancel</prism-button>`,
      theme,
    );
    expect(await axe(page)).toEqual([]);
    await mouseDown(page, host(page, '#md'));
    await wait(page, 300);
    expect(await axe(page)).toEqual([]);
    await page.mouse.up();
  });
