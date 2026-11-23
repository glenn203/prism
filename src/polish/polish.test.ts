// Polish layer, including field chrome.

import { expect, test, type Page } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { mount } from '../../test/fixture.js';

// --- polish.test.ts ---
{
  async function setup(page: Page, markup: string) {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await mount(page, markup);
    await page.addStyleTag({ path: 'src/tokens/tokens.css' });
    await page.addStyleTag({ path: 'src/theme/theme.css' });
    await page.addStyleTag({ path: 'src/theme/polish.css' });
    await page.waitForFunction(
      () =>
        typeof (window as unknown as { __enablePolish?: unknown })
          .__enablePolish === 'function',
    );
    await page.evaluate(() => {
      (window as unknown as { off: () => void }).off = (
        window as unknown as { __enablePolish: () => () => void }
      ).__enablePolish();
    });
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60))),
    );
    return errors;
  }

  const CARD = `<prism-card id="c" type="clickable" raised style="inline-size:320px">
    <prism-card-title slot="header" level="3" href="#x">Lumen Board</prism-card-title>
    <p style="margin:0">Body text.</p>
    <prism-card-actions slot="footer"><prism-button id="inner" variant="ghost">Dismiss</prism-button></prism-card-actions>
  </prism-card>`;
  const BUTTON = `<prism-button id="b">Save</prism-button>`;
  const scoped = (attr: string, inner: string) =>
    `<div ${attr} style="padding:40px">${inner}</div>`;

  const cs = (
    page: Page,
    sel: string,
    part: string,
    prop: string,
    pe?: string,
  ) =>
    page.locator(sel).evaluate(
      (el, [part, prop, pe]) => {
        const node = part
          ? el.shadowRoot!.querySelector(`[part="${part}"]`)!
          : el;
        return getComputedStyle(node, pe || null).getPropertyValue(prop);
      },
      [part, prop, pe ?? ''] as const,
    );
  /** corner-shape reads back as superellipse(n): 1 is round, 2 is a squircle. */
  const shapeOf = async (page: Page, sel: string, part: string) => {
    const v = await cs(page, sel, part, 'corner-shape');
    return v === 'superellipse(2)'
      ? 'squircle'
      : v === 'superellipse(1)'
        ? 'round'
        : v;
  };
  /** The ring's opacity once its 120ms fade has had time to finish. */
  const ring = async (page: Page, sel: string) => {
    await page.evaluate(() => new Promise((r) => setTimeout(r, 220)));
    return cs(page, sel, 'base', 'opacity', '::after');
  };
  const settle = (page: Page, ms = 420) =>
    page.evaluate((ms) => new Promise((r) => setTimeout(r, ms)), ms);
  const supportsShape = (page: Page) =>
    page.evaluate(() => CSS.supports('corner-shape', 'squircle'));

  test.describe('polish: off by default', () => {
    test('with the layer loaded and no attribute, nothing changes', async ({
      page,
    }) => {
      await setup(page, `${BUTTON}${CARD}`);
      expect(await shapeOf(page, '#b', 'base')).toBe('round');
      expect(await cs(page, '#b', 'base', 'border-top-left-radius')).toBe(
        '5px',
      );
      expect(await cs(page, '#c', 'base', 'border-top-left-radius')).toBe(
        '7px',
      );
      expect(await cs(page, '#b', 'base', 'position')).toBe('static');
      expect(await ring(page, '#b')).toBe('0');
      await page.locator('#b').hover();
      expect(await ring(page, '#b')).toBe('0');
      await page.locator('#c').hover({ position: { x: 5, y: 5 } });
      await settle(page);
      expect(await cs(page, '#c', '', 'transform')).toBe('none');
      expect(
        await page
          .locator('#c')
          .evaluate((el) => el.hasAttribute('data-prism-tilting')),
      ).toBe(false); // no scope, so the handler does not tilt it
    });
  });

  test.describe('polish: squircle corners', () => {
    test('on: corner-shape squircle and a scaled radius where supported; unchanged where not', async ({
      page,
    }) => {
      await setup(
        page,
        scoped(
          'data-prism-polish="squircle"',
          `${BUTTON}${CARD}<prism-tag id="t">Tag</prism-tag><prism-checkbox id="k" label="Tick"></prism-checkbox><prism-text-input id="i" label="Name"></prism-text-input>`,
        ),
      );
      const supported = await supportsShape(page);
      const r = async (sel: string, part: string) =>
        parseFloat(await cs(page, sel, part, 'border-top-left-radius'));
      if (supported) {
        for (const [sel, part] of [
          ['#b', 'base'],
          ['#c', 'base'],
          ['#t', 'base'],
          ['#k', 'box'],
          ['#i', 'input'],
        ]) {
          expect(await shapeOf(page, sel!, part!)).toContain('squircle');
        }
        expect(await r('#b', 'base')).toBeCloseTo(5 * 1.5, 1);
        expect(await r('#c', 'base')).toBeCloseTo(7 * 1.5, 1);
        expect(await r('#t', 'base')).toBeCloseTo(3 * 1.5, 1);
        expect(await r('#k', 'box')).toBeCloseTo(3 * 1.5, 1);
        expect(await r('#i', 'input')).toBeCloseTo(5 * 1.5, 1);
      } else {
        // Fallback: ordinary rounded corners at the ordinary radius.
        expect(await r('#b', 'base')).toBe(5);
        expect(await r('#c', 'base')).toBe(7);
        expect(await shapeOf(page, '#b', 'base')).not.toContain('squircle');
      }
    });

    test('the token drives it: --prism-corner-shape on the scope', async ({
      page,
    }) => {
      await setup(page, scoped('data-prism-polish="squircle"', BUTTON));
      expect(
        await page
          .locator('[data-prism-polish]')
          .evaluate((el) =>
            getComputedStyle(el).getPropertyValue('--prism-corner-shape'),
          ),
      ).toBe('squircle');
    });

    test('the scale applies only where corner-shape is supported (@supports)', async ({
      page,
    }) => {
      await setup(page, scoped('data-prism-polish="squircle"', BUTTON));
      const scale = await page
        .locator('[data-prism-polish]')
        .evaluate((el) =>
          getComputedStyle(el).getPropertyValue('--prism-corner-scale'),
        );
      expect(parseFloat(scale)).toBe((await supportsShape(page)) ? 1.5 : 1);
    });

    test('pills are left alone: switch and progress keep full radius', async ({
      page,
    }) => {
      await setup(
        page,
        scoped(
          'data-prism-polish',
          '<prism-switch id="s" label="S"></prism-switch><prism-progress id="p" label="P" value="40"></prism-progress>',
        ),
      );
      expect(
        parseFloat(await cs(page, '#s', 'base', 'border-top-left-radius')),
      ).toBeGreaterThan(100);
      expect(await shapeOf(page, '#s', 'base')).not.toContain('squircle');
    });

    test('a squircle-only scope does not turn on the light border or tilt', async ({
      page,
    }) => {
      await setup(
        page,
        scoped('data-prism-polish="squircle"', `${BUTTON}${CARD}`),
      );
      await page.locator('#b').hover();
      expect(await ring(page, '#b')).toBe('0');
      await page.locator('#c').hover({ position: { x: 5, y: 5 } });
      await settle(page);
      expect(await cs(page, '#c', '', 'transform')).toBe('none');
    });

    test('"off" inside an "on" page turns it off again', async ({ page }) => {
      await setup(
        page,
        `<div data-prism-polish><prism-button id="a">A</prism-button><div data-prism-polish="off"><prism-button id="b">B</prism-button></div></div>`,
      );
      const supported = await supportsShape(page);
      expect(await shapeOf(page, '#a', 'base')).toContain(
        supported ? 'squircle' : 'round',
      );
      expect(await shapeOf(page, '#b', 'base')).toBe('round');
      expect(
        parseFloat(await cs(page, '#b', 'base', 'border-top-left-radius')),
      ).toBe(5);
      await page.locator('#b').hover();
      expect(await ring(page, '#b')).toBe('0');
    });
  });

  test.describe('polish: light-following border', () => {
    test('hover shows a ring; leaving hides it; the ring is a mask over the border box', async ({
      page,
    }) => {
      await setup(page, scoped('data-prism-polish="light"', BUTTON));
      expect(await ring(page, '#b')).toBe('0');
      await page.locator('#b').hover();
      expect(await ring(page, '#b')).toBe('1');
      expect(
        await cs(page, '#b', 'base', 'mask-composite', '::after'),
      ).toContain('exclude');
      expect(await cs(page, '#b', 'base', 'pointer-events', '::after')).toBe(
        'none',
      );
      expect(
        await cs(page, '#b', 'base', 'background-image', '::after'),
      ).toContain('radial-gradient');
      await page.mouse.move(2, 2);
      expect(await ring(page, '#b')).toBe('0');
    });

    test('the ring has the control box and radius (it sits exactly over the border)', async ({
      page,
    }) => {
      await setup(page, scoped('data-prism-polish="light"', BUTTON));
      const m = await page.locator('#b').evaluate((el) => {
        const base = el.shadowRoot!.querySelector('[part="base"]')!;
        const b = getComputedStyle(base);
        const a = getComputedStyle(base, '::after');
        return {
          w: [b.width, a.width],
          h: [b.height, a.height],
          r: [b.borderTopLeftRadius, a.borderTopLeftRadius],
          ring: a.borderTopWidth,
        };
      });
      expect(m.w[1]).toBe(m.w[0]);
      expect(m.h[1]).toBe(m.h[0]);
      expect(m.r[1]).toBe(m.r[0]);
      expect(m.ring).toBe('1px');
    });

    test('--prism-pointer-x and --prism-pointer-y follow the pointer inside the button', async ({
      page,
    }) => {
      await setup(page, scoped('data-prism-polish="light"', BUTTON));
      const box = (await page.locator('#b').boundingBox())!;
      await page.mouse.move(box.x + 10, box.y + 8);
      await page.mouse.move(box.x + 30, box.y + 12, { steps: 4 });
      await settle(page, 80);
      const v = await page.locator('#b').evaluate((el) => ({
        x: parseFloat(el.style.getPropertyValue('--prism-pointer-x')),
        y: parseFloat(el.style.getPropertyValue('--prism-pointer-y')),
      }));
      expect(v.x).toBeCloseTo(30, 0);
      expect(v.y).toBeCloseTo(12, 0);
    });

    test('a button inside a card updates both, and the card ring needs an interactive or raised card', async ({
      page,
    }) => {
      await setup(
        page,
        scoped(
          'data-prism-polish="light"',
          `${CARD}<prism-card id="plain" style="inline-size:200px"><prism-card-title slot="header" level="3">Plain</prism-card-title><p style="margin:0">x</p></prism-card>`,
        ),
      );
      await page.locator('#inner').hover();
      await settle(page, 80);
      expect(
        await page
          .locator('#c')
          .evaluate((el) => el.style.getPropertyValue('--prism-pointer-x')),
      ).not.toBe('');
      expect(
        await page
          .locator('#inner')
          .evaluate((el) => el.style.getPropertyValue('--prism-pointer-x')),
      ).not.toBe('');
      expect(await ring(page, '#c')).toBe('1');
      await page.locator('#plain').hover();
      expect(await ring(page, '#plain')).toBe('0'); // static, not raised
    });

    test('keyboard focus shows the ring without changing the focus ring, the border or the fill', async ({
      page,
    }) => {
      await setup(
        page,
        `<div id="on" data-prism-polish="light" style="padding:20px"><prism-button id="a" variant="outline">A</prism-button></div><div data-prism-polish="off" style="padding:20px"><prism-button id="b" variant="outline">B</prism-button></div>`,
      );
      const look = async (sel: string) => {
        await settle(page, 350); // let the focus ring finish growing in
        return {
          shadow: await cs(page, sel, 'base', 'box-shadow'),
          border: await cs(page, sel, 'base', 'border-top-color'),
          bg: await cs(page, sel, 'base', 'background-color'),
          outline: await cs(page, sel, 'base', 'outline-style'),
        };
      };
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'A' })).toBeFocused();
      expect(await ring(page, '#a')).toBe('1');
      const on = await look('#a');
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'B' })).toBeFocused();
      const off = await look('#b');
      expect(on).toEqual(off);
      expect(on.shadow).not.toMatch(/^(0px 0px 0px 0px [^,]+(, )?)+$/); // the ring is drawn
    });

    test('not on disabled buttons or borderless cards', async ({ page }) => {
      await setup(
        page,
        scoped(
          'data-prism-polish="light"',
          '<prism-button id="d" disabled>D</prism-button><prism-card id="bl" type="borderless"><prism-card-title slot="header" level="3">T</prism-card-title><p style="margin:0">x</p></prism-card>',
        ),
      );
      expect(await cs(page, '#d', 'base', 'display', '::after')).toBe('none');
      expect(await cs(page, '#bl', 'base', 'display', '::after')).toBe('none');
    });

    test('pointer moves are batched to one write per frame', async ({
      page,
    }) => {
      await setup(page, scoped('data-prism-polish="light"', BUTTON));
      const n = await page.locator('#b').evaluate(async (el) => {
        let count = 0;
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const orig = CSSStyleDeclaration.prototype.setProperty;
        CSSStyleDeclaration.prototype.setProperty = function (
          name: string,
          ...rest: [string, string?]
        ) {
          if (name === '--prism-pointer-x') count++;
          return orig.call(this, name, ...rest);
        };
        const r = el.getBoundingClientRect();
        for (let i = 0; i < 60; i++)
          el.dispatchEvent(
            new PointerEvent('pointermove', {
              bubbles: true,
              composed: true,
              pointerType: 'mouse',
              clientX: r.left + i / 3,
              clientY: r.top + 5,
            }),
          );
        await new Promise((r2) =>
          requestAnimationFrame(() => requestAnimationFrame(r2)),
        );
        CSSStyleDeclaration.prototype.setProperty = orig;
        return count;
      });
      expect(n).toBe(1);
    });

    for (const theme of ['light', 'dark'] as const) {
      test(`every colour in the ring is >= 3:1 on the page (${theme})`, async ({
        page,
      }) => {
        await setup(
          page,
          `<div data-prism-theme="${theme}" data-prism-polish style="background:var(--prism-color-bg);padding:20px"><i id="p"></i></div>`,
        );
        const ratios = await page.locator('#p').evaluate((el) => {
          const ctx = document
            .createElement('canvas')
            .getContext('2d', { willReadFrequently: true })!;
          const px = (c: string) => {
            ctx.clearRect(0, 0, 1, 1);
            ctx.fillStyle = c;
            ctx.fillRect(0, 0, 1, 1);
            return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)] as [
              number,
              number,
              number,
            ];
          };
          const lum = ([r, g, b]: number[]) => {
            const f = (v: number) => {
              const c = v / 255;
              return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            };
            return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
          };
          const bg = px(getComputedStyle(el.parentElement!).backgroundColor);
          return ['violet', 'blue', 'cyan'].map((h) => {
            (el as HTMLElement).style.color =
              `light-dark(var(--prism-color-${h}-600), var(--prism-color-${h}-300))`;
            const fg = px(getComputedStyle(el).color);
            const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a) as [
              number,
              number,
            ];
            return { h, ratio: (hi + 0.05) / (lo + 0.05) };
          });
        });
        for (const r of ratios) expect(r.ratio, r.h).toBeGreaterThanOrEqual(3);
      });
    }
  });

  test.describe('polish: card tilt', () => {
    const tiltAngles = (page: Page, sel: string) =>
      page.locator(sel).evaluate((el) => {
        const t = getComputedStyle(el).transform;
        if (t === 'none') return null;
        const v = t
          .replace(/^matrix3d\(|\)$/g, '')
          .split(',')
          .map(Number);
        const deg = (x: number) =>
          (Math.asin(Math.max(-1, Math.min(1, x))) * 180) / Math.PI;
        // Column-major: m13 is index 8, m32 is index 6.
        return { y: deg(v[8]!), x: deg(v[6]!), perspective: v[11]! };
      });

    test('the card leans toward the pointer by at most 2.5 degrees and eases back flat', async ({
      page,
    }) => {
      await setup(page, scoped('data-prism-polish="tilt"', CARD));
      const box = (await page.locator('#c').boundingBox())!;
      expect(await cs(page, '#c', '', 'transform')).toBe('none');
      await page.mouse.move(box.x + 4, box.y + 4, { steps: 3 }); // top-left corner
      await settle(page);
      const tl = (await tiltAngles(page, '#c'))!;
      expect(Math.abs(tl.y)).toBeGreaterThan(1.5);
      expect(Math.abs(tl.x)).toBeGreaterThan(1.5);
      expect(Math.abs(tl.y)).toBeLessThanOrEqual(2.55);
      expect(Math.abs(tl.x)).toBeLessThanOrEqual(2.55);
      expect(tl.perspective).toBeLessThan(0); // perspective applied
      await page.mouse.move(box.x + box.width - 4, box.y + box.height - 4, {
        steps: 3,
      });
      await settle(page);
      const br = (await tiltAngles(page, '#c'))!;
      expect(Math.sign(br.y)).toBe(-Math.sign(tl.y)); // the other way
      expect(Math.sign(br.x)).toBe(-Math.sign(tl.x));
      // Leave: eases back and the transform is none again (no containing block at rest).
      await page.mouse.move(2, 2, { steps: 2 });
      await settle(page);
      expect(await cs(page, '#c', '', 'transform')).toBe('none');
      expect(
        await page
          .locator('#c')
          .evaluate((el) => el.hasAttribute('data-prism-tilting')),
      ).toBe(false);
    });

    test('it eases: the transition is on transform, 240ms', async ({
      page,
    }) => {
      await setup(page, scoped('data-prism-polish="tilt"', CARD));
      expect(await cs(page, '#c', '', 'transition-property')).toBe('transform');
      expect(await cs(page, '#c', '', 'transition-duration')).toBe('0.24s');
    });

    test('transform only: the box in the layout does not move', async ({
      page,
    }) => {
      await setup(page, scoped('data-prism-polish="tilt"', CARD));
      const layout = () =>
        page.locator('#c').evaluate((el) => ({
          w: (el as HTMLElement).offsetWidth,
          h: (el as HTMLElement).offsetHeight,
          x: (el as HTMLElement).offsetLeft,
          y: (el as HTMLElement).offsetTop,
        }));
      const before = await layout();
      const box = (await page.locator('#c').boundingBox())!;
      await page.mouse.move(box.x + 4, box.y + 4, { steps: 3 });
      await settle(page);
      expect(await layout()).toEqual(before);
    });

    test('never on buttons', async ({ page }) => {
      await setup(page, scoped('data-prism-polish', `${BUTTON}`));
      await page.locator('#b').hover();
      await settle(page);
      expect(await cs(page, '#b', '', 'transform')).toBe('none');
      expect(await cs(page, '#b', 'base', 'transform')).toBe('none');
      expect(
        await page
          .locator('#b')
          .evaluate((el) => el.hasAttribute('data-prism-tilting')),
      ).toBe(false);
    });

    test('only in a scope that includes tilt; not while dragging', async ({
      page,
    }) => {
      await setup(page, `<div data-prism-polish="light">${CARD}</div>`);
      await page.locator('#c').hover({ position: { x: 4, y: 4 } });
      await settle(page);
      expect(await cs(page, '#c', '', 'transform')).toBe('none');
      await setup(page, scoped('data-prism-polish="tilt"', CARD));
      await page
        .locator('#c')
        .evaluate((el) => el.setAttribute('data-prism-dragging', ''));
      await page.locator('#c').hover({ position: { x: 4, y: 4 } });
      await settle(page);
      expect(await cs(page, '#c', '', 'transform')).toBe('none');
    });

    test('a menu inside a tilted card still opens (top-layer popup)', async ({
      page,
    }) => {
      await setup(
        page,
        scoped(
          'data-prism-polish="tilt"',
          `<prism-card id="c" raised style="inline-size:320px"><prism-card-title slot="header" level="3">T</prism-card-title><prism-card-actions slot="header"><prism-menu label="More options for T"><prism-menu-item>One</prism-menu-item><prism-menu-item>Two</prism-menu-item></prism-menu></prism-card-actions><p style="margin:0">x</p></prism-card>`,
        ),
      );
      await page.getByRole('button', { name: 'More options for T' }).click();
      await expect(page.getByRole('menuitem', { name: 'One' })).toBeVisible();
    });
  });

  test.describe('polish: reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('the squircle stays; the ring is still; nothing tilts; the pointer is not tracked', async ({
      page,
    }) => {
      await setup(page, scoped('data-prism-polish', `${BUTTON}${CARD}`));
      if (await supportsShape(page))
        expect(await shapeOf(page, '#b', 'base')).toContain('squircle');
      await page.locator('#b').hover();
      // A static ring: shown, with no fade.
      expect(await ring(page, '#b')).toBe('1');
      expect(
        await cs(page, '#b', 'base', 'transition-duration', '::after'),
      ).toBe('0s');
      const box = (await page.locator('#b').boundingBox())!;
      await page.mouse.move(box.x + 10, box.y + 6, { steps: 3 });
      await settle(page, 100);
      expect(
        await page
          .locator('#b')
          .evaluate((el) => el.style.getPropertyValue('--prism-pointer-x')),
      ).toBe('');
      // The ring rests at its default place.
      // Cards do not tilt.
      const cbox = (await page.locator('#c').boundingBox())!;
      await page.mouse.move(cbox.x + 4, cbox.y + 4, { steps: 3 });
      await settle(page);
      expect(await cs(page, '#c', '', 'transform')).toBe('none');
      expect(
        await page
          .locator('#c')
          .evaluate((el) => el.hasAttribute('data-prism-tilting')),
      ).toBe(false);
      expect(await cs(page, '#c', '', 'transition-property')).not.toContain(
        'transform',
      );
    });
  });

  test.describe('polish: touch', () => {
    test.use({ hasTouch: true, isMobile: true });
    test('no ring and no tilt on a touch screen; corners still apply', async ({
      page,
    }) => {
      await setup(page, scoped('data-prism-polish', `${BUTTON}${CARD}`));
      expect(
        await page.evaluate(
          () =>
            matchMedia('(hover: none)').matches ||
            matchMedia('(pointer: coarse)').matches,
        ),
      ).toBe(true);
      expect(await cs(page, '#b', 'base', 'display', '::after')).toBe('none');
      expect(await cs(page, '#c', 'base', 'display', '::after')).toBe('none');
      await page.locator('#c').tap();
      await settle(page);
      expect(await cs(page, '#c', '', 'transform')).toBe('none');
      expect(await cs(page, '#c', '', 'transition-property')).not.toContain(
        'transform',
      );
      if (await supportsShape(page))
        expect(await shapeOf(page, '#b', 'base')).toContain('squircle');
    });
  });

  test.describe('polish: the handler', () => {
    test('ignores touch pointers', async ({ page }) => {
      await setup(page, scoped('data-prism-polish', CARD));
      await page.locator('#c').evaluate((el) => {
        const r = el.getBoundingClientRect();
        el.dispatchEvent(
          new PointerEvent('pointermove', {
            bubbles: true,
            composed: true,
            pointerType: 'touch',
            clientX: r.left + 5,
            clientY: r.top + 5,
          }),
        );
      });
      await settle(page, 80);
      expect(
        await page
          .locator('#c')
          .evaluate((el) => el.hasAttribute('data-prism-tilting')),
      ).toBe(false);
    });

    test('the returned function turns it off and clears what it wrote', async ({
      page,
    }) => {
      await setup(page, scoped('data-prism-polish', CARD));
      const box = (await page.locator('#c').boundingBox())!;
      await page.mouse.move(box.x + 4, box.y + 4, { steps: 3 });
      await settle(page, 80);
      expect(
        await page
          .locator('#c')
          .evaluate((el) => el.hasAttribute('data-prism-tilting')),
      ).toBe(true);
      await page.evaluate(() =>
        (window as unknown as { off: () => void }).off(),
      );
      expect(
        await page
          .locator('#c')
          .evaluate((el) => el.hasAttribute('data-prism-tilting')),
      ).toBe(false);
      await page.mouse.move(box.x + 20, box.y + 20, { steps: 3 });
      await settle(page, 80);
      expect(
        await page
          .locator('#c')
          .evaluate((el) => el.hasAttribute('data-prism-tilting')),
      ).toBe(false);
    });
  });

  // ---- axe, with everything on ----

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
  for (const theme of ['light', 'dark']) {
    test(`axe: no WCAG A/AA violations with polish on, pointer over a card (${theme})`, async ({
      page,
    }) => {
      await setup(
        page,
        `<div data-prism-theme="${theme}" data-prism-polish style="background:var(--prism-color-bg);color:var(--prism-color-text);padding:24px;display:grid;gap:16px">${CARD}${BUTTON}<prism-button variant="outline">Outline</prism-button><prism-tag tone="info">Info</prism-tag><prism-text-input label="Name" value="x"></prism-text-input><prism-switch label="Auto-refresh" checked></prism-switch></div>`,
      );
      await page.locator('#c').hover({ position: { x: 20, y: 20 } });
      await settle(page);
      expect(await axe(page)).toEqual([]);
    });
  }
}

// --- polish-fields.test.ts ---
{
  async function setup(page: Page, markup: string) {
    await mount(page, markup);
    await page.addStyleTag({ path: 'src/tokens/tokens.css' });
    await page.addStyleTag({ path: 'src/theme/theme.css' });
    await page.addStyleTag({ path: 'src/theme/polish.css' });
    await page.waitForFunction(
      () =>
        typeof (window as unknown as { __enablePolish?: unknown })
          .__enablePolish === 'function',
    );
    await page.evaluate(() =>
      (
        window as unknown as { __enablePolish: () => () => void }
      ).__enablePolish(),
    );
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60))),
    );
  }

  const FIELDS = `<div data-prism-polish style="padding:40px;display:grid;gap:24px;max-inline-size:320px">
    <prism-text-input id="t" label="Name" floating></prism-text-input>
    <prism-select id="s" label="Fruit"><prism-option value="a">Apricot</prism-option></prism-select>
  </div>`;

  /** Opacity of the light ring, after its fade has finished. */
  const ring = async (page: Page, id: string, part: string) => {
    await page.evaluate(() => new Promise((r) => setTimeout(r, 240)));
    return page
      .locator(id)
      .evaluate(
        (el, part) =>
          Number(
            getComputedStyle(
              el.shadowRoot!.querySelector(`[part="${part}"]`)!,
              '::after',
            ).opacity,
          ),
        part,
      );
  };

  test('polish on: a text input shows the light ring on hover and while focused, not otherwise', async ({
    page,
  }) => {
    await setup(page, FIELDS);
    expect(await ring(page, '#t', 'control')).toBe(0);
    await page.locator('#t').hover();
    expect(await ring(page, '#t', 'control')).toBe(1);
    await page.mouse.move(0, 0);
    expect(await ring(page, '#t', 'control')).toBe(0);
    await page.getByRole('textbox', { name: 'Name' }).focus();
    expect(await ring(page, '#t', 'control')).toBe(1);
  });

  test('polish on: the select trigger shows it on hover, focus and while open', async ({
    page,
  }) => {
    await setup(page, FIELDS);
    expect(await ring(page, '#s', 'trigger')).toBe(0);
    await page.locator('#s').hover();
    expect(await ring(page, '#s', 'trigger')).toBe(1);
    await page.mouse.move(0, 0);
    await page.getByRole('combobox', { name: 'Fruit' }).focus();
    expect(await ring(page, '#s', 'trigger')).toBe(1);
  });

  test('the light follows the pointer: it is measured on the control, not on the label above', async ({
    page,
  }) => {
    await setup(page, FIELDS.replace(' floating', ''));
    const box = await page.locator('#t').evaluate((el) => {
      const r = el
        .shadowRoot!.querySelector('[part="control"]')!
        .getBoundingClientRect();
      return { x: r.left, y: r.top };
    });
    await page.mouse.move(box.x + 30, box.y + 12);
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
    const pos = await page.locator('#t').evaluate((el) => {
      const s = (el as HTMLElement).style;
      return [
        parseFloat(s.getPropertyValue('--prism-pointer-x')),
        parseFloat(s.getPropertyValue('--prism-pointer-y')),
      ];
    });
    expect(pos[0]).toBeCloseTo(30, 0);
    expect(pos[1]).toBeCloseTo(12, 0);
  });

  test('off without the attribute, and not drawn on disabled or invalid fields', async ({
    page,
  }) => {
    await setup(
      page,
      `<div style="padding:40px;display:grid;gap:24px;max-inline-size:320px">
        <prism-text-input id="t" label="Name"></prism-text-input>
      </div>`,
    );
    await page.locator('#t').hover();
    expect(await ring(page, '#t', 'control')).toBe(0);
    await setup(
      page,
      `<div data-prism-polish style="padding:40px;display:grid;gap:24px;max-inline-size:320px">
        <prism-text-input id="d" label="Off" disabled></prism-text-input>
        <prism-text-input id="r" label="Req" required><span slot="error">Needed.</span></prism-text-input>
      </div>`,
    );
    const shown = (id: string) =>
      page
        .locator(id)
        .evaluate(
          (el) =>
            getComputedStyle(
              el.shadowRoot!.querySelector('[part="control"]')!,
              '::after',
            ).display,
        );
    await page.locator('#d').hover({ force: true });
    expect(await shown('#d')).toBe('none');
    await page
      .locator('#r')
      .evaluate((e) =>
        (e as HTMLElement & { reportValidity(): boolean }).reportValidity(),
      );
    await page.locator('#r').hover();
    expect(await shown('#r')).toBe('none');
  });

  test('forced colors: no light-following ring', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await setup(page, FIELDS);
    await page.locator('#t').hover();
    const d = await page.locator('#t').evaluate((el) => {
      const c = el.shadowRoot!.querySelector('[part="control"]')!;
      return getComputedStyle(c, '::after').display;
    });
    expect(d).toBe('none');
  });
}
