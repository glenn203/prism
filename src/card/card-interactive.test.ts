// Clickable, collapsible, and selectable cards, plus press and the corner check.

import { expect, test, type Page } from '@playwright/test';
import { mount } from '../../test/fixture.js';
import { expected, near, painted, PCT } from '../../test/paint.js';
import { wait, maxStep, recordFrames } from '../../test/field.js';
import {
  mouseDown,
  releaseFrames,
  scaleAnims,
  scaleOf,
} from '../../test/press.js';
import { polishMotion } from '../../test/polish-motion.js';
import { axe } from '../../test/axe.js';

// --- card-clickable.test.ts ---
{
  const settle = (page: Page) =>
    page.evaluate(
      () =>
        new Promise<void>((r) =>
          requestAnimationFrame(() => setTimeout(() => r(), 40)),
        ),
    );
  async function setup(page: Page, markup: string) {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await mount(page, markup);
    await page.addStyleTag({ path: 'src/tokens/tokens.css' });
    await page.addStyleTag({ path: 'src/theme/theme.css' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await settle(page);
    return errors;
  }
  const LINK = `
    <p id="before" tabindex="0">before</p>
    <prism-card id="c" type="clickable" style="width:360px">
      <prism-card-title slot="header" level="3" href="#opened">Onboarding guide</prism-card-title>
      <prism-card-description slot="header">Steps for welcoming new members.</prism-card-description>
      <div id="body">Some content that is not a control.</div>
      <prism-card-actions slot="footer">
        <prism-button id="nested" variant="ghost">Share Onboarding guide</prism-button>
      </prism-card-actions>
    </prism-card>`;
  const box = (page: Page, sel: string) =>
    page.locator(sel).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        r: r.right,
        b: r.bottom,
      };
    });
  const BG = ['var(--prism-color-bg)', 'var(--prism-color-text)'] as const;
  const paint = async (page: Page, state: keyof typeof PCT) => {
    const got = await painted(page.locator('#c'), 'base');
    const want = await expected(page, BG[0], BG[1], PCT[state]);
    return { got, want, ok: near(got, want) };
  };

  test.describe('clickable card (stretched link)', () => {
    test('the title is the one real link; its name is the title only', async ({
      page,
    }) => {
      const errors = await setup(page, LINK);
      expect(errors).toEqual([]);
      const link = page.getByRole('link', { name: 'Onboarding guide' });
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute('href', '#opened');
      // The heading holds the link, so the outline is intact.
      await expect(
        page.getByRole('heading', { level: 3, name: 'Onboarding guide' }),
      ).toHaveCount(1);
      // Not the whole card's text.
      await expect(
        page.getByRole('link', { name: /Steps|content/ }),
      ).toHaveCount(0);
    });

    test('clicking anywhere on the card follows the link', async ({ page }) => {
      await setup(page, LINK);
      const c = await box(page, '#c');
      for (const [dx, dy] of [
        [8, 8],
        [c.w - 8, 8],
        [c.w / 2, c.h / 2],
        [8, c.h - 8],
      ] as const) {
        await page.evaluate(() => (location.hash = ''));
        await page.mouse.click(c.x + dx, c.y + dy);
        expect(await page.evaluate(() => location.hash)).toBe('#opened');
      }
    });

    test('a nested control keeps its own click area and does not follow the link', async ({
      page,
    }) => {
      await setup(page, LINK);
      await page.evaluate(() => {
        location.hash = '';
        document
          .getElementById('nested')!
          .addEventListener('click', () => (document.title = 'nested'));
      });
      await page.locator('#nested').click();
      expect(await page.title()).toBe('nested');
      expect(await page.evaluate(() => location.hash)).toBe('');
    });

    test('tab order: the title, then each nested control. One stop for the title', async ({
      page,
    }) => {
      await setup(page, LINK);
      await page.locator('#before').focus();
      await page.keyboard.press('Tab');
      await expect(
        page.getByRole('link', { name: 'Onboarding guide' }),
      ).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(
        page.getByRole('button', { name: 'Share Onboarding guide' }),
      ).toBeFocused();
    });

    test('Enter follows the link', async ({ page }) => {
      await setup(page, LINK);
      await page.getByRole('link', { name: 'Onboarding guide' }).focus();
      await page.keyboard.press('Enter');
      expect(await page.evaluate(() => location.hash)).toBe('#opened');
    });

    test('a real link: new-tab and context-menu behaviour come from the <a>', async ({
      page,
    }) => {
      await setup(
        page,
        `<prism-card type="clickable"><prism-card-title slot="header" level="3" href="/somewhere" target="_blank" rel="noopener">Out</prism-card-title></prism-card>`,
      );
      const a = page.getByRole('link', { name: 'Out' });
      await expect(a).toHaveAttribute('target', '_blank');
      await expect(a).toHaveAttribute('rel', 'noopener');
    });

    test('action: the title is a button; Enter and Space press it; a click anywhere does', async ({
      page,
    }) => {
      await setup(
        page,
        `<prism-card id="c" type="clickable" style="width:320px"><prism-card-title slot="header" level="3" action>Open details</prism-card-title><div>body</div></prism-card>`,
      );
      await page.evaluate(() => {
        (window as unknown as { n: number }).n = 0;
        document
          .getElementById('c')!
          .addEventListener(
            'click',
            () => (window as unknown as { n: number }).n++,
          );
      });
      const btn = page.getByRole('button', { name: 'Open details' });
      await btn.focus();
      await page.keyboard.press('Enter');
      await page.keyboard.press(' ');
      expect(
        await page.evaluate(() => (window as unknown as { n: number }).n),
      ).toBe(2);
      const c = await box(page, '#c');
      await page.mouse.click(c.x + c.w - 10, c.y + c.h - 10);
      expect(
        await page.evaluate(() => (window as unknown as { n: number }).n),
      ).toBe(3);
    });

    test('the title link does not draw its own ring: the whole card does (>= 2px)', async ({
      page,
    }) => {
      await setup(page, LINK);
      await page.locator('#before').focus();
      await page.keyboard.press('Tab');
      await settle(page);
      const r = await page.locator('#c').evaluate((el) => {
        const base = getComputedStyle(
          el.shadowRoot!.querySelector('[part="base"]')!,
        );
        const link = getComputedStyle(
          el
            .querySelector('prism-card-title')!
            .shadowRoot!.querySelector('[part="link"]')!,
        );
        return {
          ring: el.matches(':state(focus-ring)'),
          shadow: base.boxShadow,
          linkOutline: link.outlineStyle,
        };
      });
      expect(r.ring).toBe(true);
      expect(r.shadow).toMatch(/4px/); // offset 1px + ring 2px + blur layers
      expect(r.linkOutline).toBe('none');
    });

    test('a nested control shows only its own ring, not the card ring', async ({
      page,
    }) => {
      await setup(page, LINK);
      await page.locator('#nested').focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await settle(page);
      expect(
        await page
          .locator('#c')
          .evaluate((el) => el.matches(':state(focus-ring)')),
      ).toBe(false);
    });

    test('hover and pressed: the state layer at 6% and 12% over the card surface', async ({
      page,
    }) => {
      await setup(page, LINK);
      expect((await paint(page, 'rest')).ok).toBe(true);
      const c = await box(page, '#c');
      await page.mouse.move(c.x + c.w / 2, c.y + c.h / 2 - 10);
      const hover = await paint(page, 'hover');
      expect(hover.ok, `${hover.got.join()} vs ${hover.want.join()}`).toBe(
        true,
      );
      await page.mouse.down();
      const pressed = await paint(page, 'pressed');
      expect(
        pressed.ok,
        `${pressed.got.join()} vs ${pressed.want.join()}`,
      ).toBe(true);
      await page.mouse.up();
    });

    test('rule 3: no tint while the pointer is over a nested control', async ({
      page,
    }) => {
      await setup(page, LINK);
      await page.locator('#nested').hover();
      await settle(page);
      const rest = await paint(page, 'rest');
      expect(rest.ok, `${rest.got.join()} vs ${rest.want.join()}`).toBe(true);
      // And it comes back on the card surface.
      const c = await box(page, '#c');
      await page.mouse.move(c.x + 20, c.y + c.h / 2);
      expect((await paint(page, 'hover')).ok).toBe(true);
    });

    test('hover is the tint only: no lift, transform or shadow change', async ({
      page,
    }) => {
      await setup(page, LINK);
      const read = () =>
        page.locator('#c').evaluate((el) => {
          const cs = getComputedStyle(
            el.shadowRoot!.querySelector('[part="base"]')!,
          );
          return {
            transform: cs.transform,
            shadow: cs.boxShadow,
            top: el.getBoundingClientRect().top,
          };
        });
      const before = await read();
      const c = await box(page, '#c');
      await page.mouse.move(c.x + 30, c.y + c.h / 2);
      await settle(page);
      expect(await read()).toEqual(before);
    });

    test('never flat: the edge is the strong border colour (and raised keeps a transparent one)', async ({
      page,
    }) => {
      await setup(
        page,
        `${LINK}<prism-card id="r" type="clickable" raised><prism-card-title slot="header" level="3" href="#x">Raised</prism-card-title></prism-card>`,
      );
      const edge = (id: string) =>
        page.locator(`#${id}`).evaluate((el) => {
          const cs = getComputedStyle(
            el.shadowRoot!.querySelector('[part="base"]')!,
          );
          const probe = document.createElement('div');
          probe.style.color = 'var(--prism-color-border-strong)';
          document.body.append(probe);
          const strong = getComputedStyle(probe).color;
          probe.remove();
          return {
            color: cs.borderTopColor,
            width: cs.borderTopWidth,
            strong,
            shadow: cs.boxShadow,
          };
        });
      const c = await edge('c');
      expect(c.width).toBe('1px');
      expect(c.color).toBe(c.strong);
      const r = await edge('r');
      expect(r.color).toBe('rgba(0, 0, 0, 0)');
      expect(r.shadow).not.toBe('none');
    });

    test('cursor is pointer on a clickable card', async ({ page }) => {
      await setup(page, LINK);
      expect(
        await page
          .locator('#c')
          .evaluate(
            (el) =>
              getComputedStyle(el.shadowRoot!.querySelector('[part="base"]')!)
                .cursor,
          ),
      ).toBe('pointer');
    });

    test('a borderless card is never clickable: plain title and a dev error', async ({
      page,
    }) => {
      const errors = await setup(
        page,
        `<prism-card type="borderless"><prism-card-title slot="header" level="3" href="#x">Flat</prism-card-title></prism-card>`,
      );
      await expect(page.getByRole('link')).toHaveCount(0);
      expect(errors.some((e) => e.includes('never clickable'))).toBe(true);
    });

    test('a clickable card without href or action is a dev error', async ({
      page,
    }) => {
      const errors = await setup(
        page,
        `<prism-card type="clickable"><prism-card-title slot="header" level="3">No target</prism-card-title></prism-card>`,
      );
      expect(errors.some((e) => e.includes('needs a link or button'))).toBe(
        true,
      );
    });

    test('disabled: not focusable, no tint, and the reason must be in the text', async ({
      page,
    }) => {
      const errors = await setup(
        page,
        `<prism-card id="c" type="clickable" disabled style="width:320px"><prism-card-title slot="header" level="3" href="#x">Locked</prism-card-title></prism-card>`,
      );
      expect(errors.some((e) => e.includes('says why'))).toBe(true);
      const a = page.getByRole('link', { name: 'Locked' });
      await expect(a).toHaveAttribute('aria-disabled', 'true');
      await expect(a).not.toHaveAttribute('href', /.+/);
      const c = await box(page, '#c');
      await page.mouse.move(c.x + 20, c.y + c.h / 2);
      await page.mouse.click(c.x + 20, c.y + c.h / 2);
      expect(await page.evaluate(() => location.hash)).toBe('');
      expect((await paint(page, 'rest')).ok).toBe(true);
    });

    test('a disabled card with a description raises no error', async ({
      page,
    }) => {
      const errors = await setup(
        page,
        `<prism-card type="clickable" disabled><prism-card-title slot="header" level="3" href="#x">Locked</prism-card-title><prism-card-description slot="header">Needs an admin role.</prism-card-description></prism-card>`,
      );
      expect(errors).toEqual([]);
    });

    test('rule 6: a nested control names its card (dev error otherwise)', async ({
      page,
    }) => {
      const errors = await setup(
        page,
        `<prism-card type="clickable"><prism-card-title slot="header" level="3" href="#x">Guide</prism-card-title>
          <prism-card-actions slot="header"><prism-menu label="More options"><prism-menu-item>A</prism-menu-item></prism-menu></prism-card-actions></prism-card>
         <prism-card type="clickable"><prism-card-title slot="header" level="3" href="#y">Other</prism-card-title>
          <prism-card-actions slot="header"><prism-menu label="More options for Other"><prism-menu-item>A</prism-menu-item></prism-menu></prism-card-actions></prism-card>`,
      );
      expect(errors.filter((e) => e.includes('names its card')).length).toBe(1);
    });

    test('no limit on nested controls (the cap is not enforced)', async ({
      page,
    }) => {
      const errors = await setup(
        page,
        `<prism-card type="clickable" style="width:420px"><prism-card-title slot="header" level="3" href="#x">Many</prism-card-title>
          <prism-card-actions slot="header"><prism-icon-button label="Pin Many">p</prism-icon-button><prism-icon-button label="Share Many">s</prism-icon-button></prism-card-actions>
          <prism-card-actions slot="footer"><prism-button variant="ghost">One</prism-button><prism-button variant="secondary">Two</prism-button></prism-card-actions></prism-card>`,
      );
      expect(errors).toEqual([]);
    });

    test('forced-colors: the edge stays visible', async ({ page }) => {
      await page.emulateMedia({ forcedColors: 'active' });
      await setup(page, LINK);
      const c = await page
        .locator('#c')
        .evaluate(
          (el) =>
            getComputedStyle(el.shadowRoot!.querySelector('[part="base"]')!)
              .borderTopColor,
        );
      expect(c).not.toBe('rgba(0, 0, 0, 0)');
    });
  });
}

// --- card-press.test.ts ---
{
  async function setup(page: Page, markup: string, polish = false) {
    await mount(page, markup);
    await page.addStyleTag({ path: 'src/tokens/tokens.css' });
    await page.addStyleTag({ path: 'src/theme/theme.css' });
    await polishMotion(page);
    if (polish) {
      await page.addStyleTag({ path: 'src/theme/polish.css' });
      await page.evaluate(() =>
        (window as unknown as { __enablePolish: () => void }).__enablePolish(),
      );
    }
    await wait(page, 600);
  }

  const LINK = `<prism-card id="c" type="clickable" style="inline-size:360px">
    <prism-card-title slot="header" level="3" href="#opened">Onboarding guide</prism-card-title>
    <prism-card-description slot="header">Steps for welcoming new members.</prism-card-description>
    <div id="body" style="padding:24px 0">Some content that is not a control.</div>
    <prism-card-actions slot="footer"><prism-button id="nested" variant="ghost">Share Onboarding guide</prism-button></prism-card-actions>
  </prism-card>`;
  const c = (page: Page) => page.locator('#c');
  const body = (page: Page) => page.locator('#body');

  test.describe('clickable card press', () => {
    test('presses by at most about 1%, evenly, and eases back without passing 1.0', async ({
      page,
    }) => {
      await setup(page, LINK);
      await mouseDown(page, body(page));
      expect(await scaleAnims(c(page), '[part="base"]')).toEqual(['scale']);
      await wait(page, 300);
      expect(await scaleOf(c(page), '[part="base"]')).toBeCloseTo(0.99, 3);
      const { scales } = await releaseFrames(page, c(page), '[part="base"]');
      expect(Math.max(...scales)).toBeLessThanOrEqual(1);
      expect(await scaleOf(c(page), '[part="base"]')).toBe(1);
    });

    test('a control inside the card keeps its own press; the card stays still', async ({
      page,
    }) => {
      await setup(page, LINK);
      await mouseDown(page, page.locator('#nested'));
      await wait(page, 250);
      expect(await scaleOf(c(page), '[part="base"]')).toBe(1);
      expect(await scaleOf(page.locator('#nested'), 'button')).toBeLessThan(
        0.99,
      );
      await page.mouse.up();
    });

    test('a plain card and a disabled clickable card do not press', async ({
      page,
    }) => {
      await setup(
        page,
        `<prism-card id="p" style="inline-size:300px"><prism-card-title slot="header" level="3">Plain</prism-card-title><p id="pb">Body</p></prism-card>
         <prism-card id="d" type="clickable" disabled style="inline-size:300px"><prism-card-title slot="header" level="3" href="#x">Off</prism-card-title><prism-card-description slot="header">Not now.</prism-card-description><p id="db">Body</p></prism-card>`,
      );
      for (const [id, inner] of [
        ['#p', '#pb'],
        ['#d', '#db'],
      ] as const) {
        await mouseDown(page, page.locator(inner));
        await wait(page, 150);
        expect(await scaleOf(page.locator(id), '[part="base"]')).toBe(1);
        await page.mouse.up();
      }
    });

    test('keyboard: Enter on the title link gives a brief press', async ({
      page,
    }) => {
      await setup(page, LINK);
      await page.keyboard.press('Tab');
      await page.keyboard.down('Enter');
      await wait(page, 150);
      expect(await scaleOf(c(page), '[part="base"]')).toBeLessThan(0.995);
      await page.keyboard.up('Enter');
      await wait(page, 500);
      expect(await scaleOf(c(page), '[part="base"]')).toBe(1);
    });

    test('coexists with the polish tilt: the host keeps its tilt transform while the base scales', async ({
      page,
    }) => {
      await setup(
        page,
        `<div data-prism-polish="tilt motion" style="padding:40px">${LINK}</div>`,
        true,
      );
      const b = (await body(page).boundingBox())!;
      await page.mouse.move(b.x + b.width - 8, b.y + 8, { steps: 5 });
      await wait(page, 150);
      await page.mouse.down();
      await wait(page, 300);
      const r = await c(page).evaluate((e) => ({
        tilt: getComputedStyle(e).transform,
        scale: getComputedStyle(e.shadowRoot!.querySelector('[part="base"]')!)
          .scale,
        tilting: e.hasAttribute('data-prism-tilting'),
      }));
      expect(r.tilting).toBe(true);
      expect(r.tilt).not.toBe('none');
      expect(parseFloat(r.scale)).toBeCloseTo(0.99, 3);
      await page.mouse.up();
    });

    test('reduced motion: no scale', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await setup(page, LINK);
      await mouseDown(page, body(page));
      await wait(page, 150);
      expect(await scaleOf(c(page), '[part="base"]')).toBe(1);
      await page.mouse.up();
    });
  });

  test.describe('choice card and card toggle press', () => {
    test('a choice card presses by about 1% when pressed anywhere on it', async ({
      page,
    }) => {
      await setup(
        page,
        `<prism-card-group label="Plan"><prism-card id="k" type="selectable" kind="choice" value="a" style="inline-size:300px"><prism-card-select slot="header"></prism-card-select><prism-card-title slot="header" level="3">Starter</prism-card-title><p id="kb">For one person.</p></prism-card></prism-card-group>`,
      );
      await mouseDown(page, page.locator('#kb'));
      await wait(page, 300);
      expect(await scaleOf(page.locator('#k'), '[part="base"]')).toBeCloseTo(
        0.99,
        3,
      );
      await page.mouse.up();
      await wait(page, 500);
      expect(await scaleOf(page.locator('#k'), '[part="base"]')).toBe(1);
    });

    test('the collapsible card toggle presses like a medium button (2.5%) and still opens', async ({
      page,
    }) => {
      await setup(
        page,
        `<prism-card id="w" type="collapsible" style="inline-size:420px"><prism-card-title slot="header" level="3">Advanced settings</prism-card-title><p>Optional detail group.</p></prism-card>`,
      );
      const toggle = page.getByRole('button', { name: 'Advanced settings' });
      await mouseDown(page, toggle);
      await wait(page, 300);
      expect(
        await scaleOf(page.locator('prism-card-title'), '[part="toggle"]'),
      ).toBeCloseTo(0.975, 3);
      await page.mouse.up();
      await wait(page, 400);
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(
        await scaleOf(page.locator('prism-card-title'), '[part="toggle"]'),
      ).toBe(1);
    });
  });
}

// --- card-collapsible.test.ts ---
{
  const settle = (page: Page) =>
    page.evaluate(
      () =>
        new Promise<void>((r) =>
          requestAnimationFrame(() => setTimeout(() => r(), 40)),
        ),
    );
  async function setup(page: Page, markup: string) {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await mount(page, markup);
    await page.addStyleTag({ path: 'src/tokens/tokens.css' });
    await page.addStyleTag({ path: 'src/theme/theme.css' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await settle(page);
    return errors;
  }
  const COLL = (attrs = '') => `
    <button id="before">before</button>
    <prism-card id="c" type="collapsible" ${attrs} style="width:360px">
      <prism-card-title slot="header" level="3">Advanced settings</prism-card-title>
      <prism-card-actions slot="header">
        <prism-icon-button id="act" label="Reset Advanced settings">R</prism-icon-button>
      </prism-card-actions>
      <p id="body">Optional detail group.</p>
      <prism-card-meta slot="footer">Edited yesterday</prism-card-meta>
    </prism-card>`;
  const toggle = (page: Page) =>
    page.getByRole('button', { name: 'Advanced settings', exact: true });

  test.describe('collapsible card', () => {
    test('the title row is the toggle button inside a real heading; header actions sit beside it', async ({
      page,
    }) => {
      const errors = await setup(page, COLL('open'));
      expect(errors).toEqual([]);
      await expect(
        page.getByRole('heading', { level: 3, name: 'Advanced settings' }),
      ).toHaveCount(1);
      await expect(toggle(page)).toHaveCount(1);
      await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
      // No button inside a button, and the action is not part of the toggle.
      const nested = await page
        .locator('prism-card-title')
        .evaluate(
          (el) => el.shadowRoot!.querySelectorAll('button button').length,
        );
      expect(nested).toBe(0);
      const apart = await page.evaluate(() => {
        const t = document.querySelector('prism-card-title')!;
        const b = t.shadowRoot!.querySelector('[part="toggle"]')!;
        const a = document.querySelector('#act')!;
        return !b.contains(a) && !t.contains(a);
      });
      expect(apart).toBe(true);
      await expect(
        page.getByRole('button', { name: 'Reset Advanced settings' }),
      ).toBeVisible();
    });

    test('closed by default: content hidden and out of the tab order; click or keys open it', async ({
      page,
    }) => {
      await setup(
        page,
        COLL() + '<input id="inner" aria-label="inner" style="display:none">',
      );
      await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('#body')).toBeHidden();
      await expect(page.locator('#c')).toHaveJSProperty('open', false);
      await toggle(page).click();
      await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('#body')).toBeVisible();
      await expect(page.locator('#c')).toHaveAttribute('open', '');
      // Keyboard: Enter and Space.
      await toggle(page).focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#body')).toBeHidden();
      await page.keyboard.press('Space');
      await expect(page.locator('#body')).toBeVisible();
    });

    test('controls: aria-controls reaches the content (element reflection)', async ({
      page,
    }) => {
      await setup(page, COLL('open'));
      const r = await page.locator('prism-card-title').evaluate((el) => {
        const b = el.shadowRoot!.querySelector(
          '[part="toggle"]',
        ) as HTMLElement & {
          ariaControlsElements?: Element[] | null;
        };
        return {
          supported: 'ariaControlsElements' in b,
          ids: (b.ariaControlsElements ?? []).map((e) => e.id),
        };
      });
      // Chromium supports it; where it does, it points at the content.
      expect(r.supported).toBe(true);
      expect(r.ids).toContain('body');
    });

    test('a short title fits on one line (the toggle never narrows its own text)', async ({
      page,
    }) => {
      await setup(page, COLL('open'));
      const h = await page.locator('prism-card-title').evaluate((el) => {
        const rg = document.createRange();
        rg.selectNodeContents(el);
        return rg.getBoundingClientRect().height;
      });
      expect(h).toBeLessThanOrEqual(20);
    });

    test('keeps the footer; the closed header has no gap under it', async ({
      page,
    }) => {
      await setup(page, COLL());
      await expect(page.getByText('Edited yesterday')).toBeVisible();
      const gap = await page.locator('#c').evaluate((el) => {
        const h = el.shadowRoot!.querySelector('[part="header"]')!;
        return getComputedStyle(h).marginBottom;
      });
      expect(gap).toBe('0px');
    });

    test('emits prism-card-open-change', async ({ page }) => {
      await setup(page, COLL());
      await page.evaluate(() => {
        const w = window as unknown as { log: boolean[] };
        w.log = [];
        document.addEventListener('prism-card-open-change', (e) =>
          w.log.push((e as CustomEvent<{ open: boolean }>).detail.open),
        );
      });
      await toggle(page).click();
      await toggle(page).click();
      expect(
        await page.evaluate(
          () => (window as unknown as { log: boolean[] }).log,
        ),
      ).toEqual([true, false]);
    });

    test('the toggle is the one tab stop of the title, with a focus ring', async ({
      page,
    }) => {
      await setup(page, COLL('open'));
      await page.locator('#before').focus();
      await page.keyboard.press('Tab');
      await expect(toggle(page)).toBeFocused();
      const ring = await page.locator('prism-card-title').evaluate((el) => {
        const b = el.shadowRoot!.querySelector('[part="toggle"]')!;
        return getComputedStyle(b).boxShadow;
      });
      expect(ring).not.toBe('none');
      await page.keyboard.press('Tab');
      await expect(page.locator('#act')).toBeFocused();
    });

    test('chevron: down when open, rotated when closed, and a 16px icon', async ({
      page,
    }) => {
      await setup(page, COLL());
      const closed = await page.locator('prism-card-title').evaluate((el) => {
        const c = el.shadowRoot!.querySelector('[part="chevron"]')!;
        return getComputedStyle(c).transform;
      });
      await toggle(page).click();
      const open = await page.locator('prism-card-title').evaluate((el) => {
        const c = el.shadowRoot!.querySelector('[part="chevron"]')!;
        return getComputedStyle(c).transform;
      });
      expect(open).toBe('none');
      expect(closed).not.toBe('none');
    });

    test('session memory: storage-key restores the last state after a reload of the element', async ({
      page,
    }) => {
      await setup(page, COLL('storage-key="adv"'));
      await toggle(page).click();
      expect(
        await page.evaluate(() => sessionStorage.getItem('prism-card:adv')),
      ).toBe('1');
      // New element with the same key opens from memory.
      await page.evaluate(() => {
        document.querySelector('#c')!.remove();
        const el = document.createElement('prism-card');
        el.id = 'd';
        el.setAttribute('type', 'collapsible');
        el.setAttribute('storage-key', 'adv');
        el.innerHTML =
          '<prism-card-title slot="header" level="3">Advanced settings</prism-card-title><p id="b2">x</p>';
        document.body.append(el);
      });
      await settle(page);
      await expect(page.locator('#b2')).toBeVisible();
      await toggle(page).click();
      expect(
        await page.evaluate(() => sessionStorage.getItem('prism-card:adv')),
      ).toBe('0');
    });

    test('nesting: two levels are fine, a third is a dev error', async ({
      page,
    }) => {
      const mk = (n: number): string =>
        n === 0
          ? '<p>leaf</p>'
          : `<prism-card type="collapsible" open><prism-card-title slot="header" level="${3 + (3 - n)}">L${4 - n}</prism-card-title>${mk(n - 1)}</prism-card>`;
      const errors = await setup(page, mk(2));
      expect(errors.some((e) => e.includes('more than two levels'))).toBe(
        false,
      );
      const errors3 = await setup(page, mk(3));
      expect(errors3.some((e) => e.includes('more than two levels'))).toBe(
        true,
      );
    });

    test('a nested collapsible toggles on its own', async ({ page }) => {
      await setup(
        page,
        `<prism-card id="o" type="collapsible" open><prism-card-title slot="header" level="3">Outer</prism-card-title>
           <prism-card id="i" type="collapsible"><prism-card-title slot="header" level="4">Inner</prism-card-title><p id="inb">in</p></prism-card>
         </prism-card>`,
      );
      await page.getByRole('button', { name: 'Inner' }).click();
      await expect(page.locator('#inb')).toBeVisible();
      await expect(page.locator('#o')).toHaveJSProperty('open', true);
    });

    test('a link or action on the title is ignored with a dev error', async ({
      page,
    }) => {
      const errors = await setup(
        page,
        `<prism-card type="collapsible"><prism-card-title slot="header" level="3" href="#x">T</prism-card-title><p>b</p></prism-card>`,
      );
      expect(errors.some((e) => e.includes('title is the toggle'))).toBe(true);
      await expect(page.getByRole('link')).toHaveCount(0);
    });

    test('toggle tint: the shared state layer, 6% on hover and 12% pressed', async ({
      page,
    }) => {
      await setup(page, COLL('open'));
      const read = () =>
        page.locator('prism-card-title').evaluate((el) => {
          const b = el.shadowRoot!.querySelector('[part="toggle"]')!;
          return getComputedStyle(b).backgroundImage;
        });
      const rest = await read();
      await toggle(page).hover();
      await settle(page);
      const hover = await read();
      expect(hover).not.toBe(rest);
      expect(hover).toContain('0.06');
    });
  });
}

// --- card-selectable.test.ts ---
{
  interface Win {
    events?: { selected: string[]; count: number }[];
  }
  const settle = (page: Page) =>
    page.evaluate(
      () =>
        new Promise<void>((r) =>
          requestAnimationFrame(() => setTimeout(() => r(), 40)),
        ),
    );
  async function setup(page: Page, markup: string) {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await mount(page, markup);
    await page.addStyleTag({ path: 'src/tokens/tokens.css' });
    await page.addStyleTag({ path: 'src/theme/theme.css' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => {
      const w = window as unknown as Win;
      w.events = [];
      document.addEventListener('prism-selection-change', (e) =>
        w.events!.push(
          (e as CustomEvent<{ selected: string[]; count: number }>).detail,
        ),
      );
    });
    await settle(page);
    return errors;
  }
  const PLANS = (extra = '') => `
    <button id="before">before</button>
    <prism-card-group id="g" selection="single" label="Plan" ${extra}>
      ${['free', 'team', 'enterprise']
        .map(
          (
            v,
          ) => `<prism-card id="${v}" type="selectable" kind="choice" value="${v}" style="width:260px;margin-block-end:8px">
          <prism-card-select slot="header"></prism-card-select>
          <prism-card-title slot="header" level="3">${v[0]!.toUpperCase() + v.slice(1)} plan</prism-card-title>
          <prism-card-description slot="header">Description of ${v}.</prism-card-description>
          <div>${v} details</div>
        </prism-card>`,
        )
        .join('')}
    </prism-card-group>
    <button id="after">after</button>`;
  const RESOURCES = (attrs = '') => `
    <button id="before">before</button>
    <prism-card-group id="g" selection="multi" label="Resources" ${attrs}>
      ${['a', 'b', 'c']
        .map(
          (
            v,
          ) => `<prism-card id="${v}" type="selectable" kind="collection" value="${v}" style="width:320px;margin-block-end:8px">
          <prism-card-select slot="header"></prism-card-select>
          <prism-card-title slot="header" level="3" href="#resource-${v}">Resource ${v.toUpperCase()}</prism-card-title>
          <prism-card-description slot="header">Lumen server ${v}.</prism-card-description>
          <prism-card-actions slot="header"><prism-menu label="More options for Resource ${v.toUpperCase()}"><prism-menu-item>Pause</prism-menu-item></prism-menu></prism-card-actions>
          <div>content ${v}</div>
        </prism-card>`,
        )
        .join('')}
    </prism-card-group>
    <button id="after">after</button>`;
  const selected = (page: Page) =>
    page
      .locator('#g')
      .evaluate((el) => (el as unknown as { selected: string[] }).selected);
  const isSel = (page: Page, id: string) =>
    page.locator(`#${id}`).evaluate((el) => el.matches(':state(selected)'));
  const box = (page: Page, sel: string) =>
    page.locator(sel).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });

  test.describe('collection card (multi): toggles only through its checkbox', () => {
    test('the checkbox is always visible, named by the title, described by the description', async ({
      page,
    }) => {
      const errors = await setup(page, RESOURCES());
      expect(errors).toEqual([]);
      const cb = page.getByRole('checkbox', { name: 'Resource A' });
      await expect(cb).toBeVisible();
      await expect(cb).toHaveAccessibleDescription('Lumen server a.');
      // 24 by 24px target at least.
      const t = await page.locator('#a prism-card-select').evaluate((el) => {
        const r = el
          .shadowRoot!.querySelector('[part="base"]')!
          .getBoundingClientRect();
        return [r.width, r.height];
      });
      expect(t[0]).toBeGreaterThanOrEqual(24);
      expect(t[1]).toBeGreaterThanOrEqual(24);
    });

    test('clicking the checkbox selects; clicking elsewhere on the card does not', async ({
      page,
    }) => {
      await setup(page, RESOURCES());
      await page.getByRole('checkbox', { name: 'Resource A' }).click();
      expect(await selected(page)).toEqual(['a']);
      await page.locator('#b').getByText('content b').click();
      expect(await selected(page)).toEqual(['a']);
      expect(await isSel(page, 'a')).toBe(true);
      expect(await isSel(page, 'b')).toBe(false);
      await page.getByRole('checkbox', { name: 'Resource A' }).click();
      expect(await selected(page)).toEqual([]);
    });

    test('the title stays a link and is its own tab stop; order is checkbox, title, actions', async ({
      page,
    }) => {
      await setup(page, RESOURCES());
      await page.locator('#before').focus();
      await page.keyboard.press('Tab');
      await expect(
        page.getByRole('checkbox', { name: 'Resource A' }),
      ).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(
        page.getByRole('link', { name: 'Resource A' }),
      ).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(
        page.getByRole('button', { name: 'More options for Resource A' }),
      ).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(
        page.getByRole('checkbox', { name: 'Resource B' }),
      ).toBeFocused();
    });

    test('Space toggles; a polite message says how many are selected', async ({
      page,
    }) => {
      await setup(page, RESOURCES());
      await page.getByRole('checkbox', { name: 'Resource A' }).focus();
      await page.keyboard.press(' ');
      await page.getByRole('checkbox', { name: 'Resource B' }).focus();
      await page.keyboard.press(' ');
      expect(await selected(page)).toEqual(['a', 'b']);
      const status = page.locator('#g').locator('[role="status"]');
      await expect(status).toHaveText('2 selected');
      await expect(status).toHaveAttribute('aria-live', 'polite');
      await page
        .locator('#g')
        .evaluate((el) => (el as unknown as { clear(): void }).clear());
      await expect(status).toHaveText('None selected');
    });

    test('selection-change event carries the ids and count', async ({
      page,
    }) => {
      await setup(page, RESOURCES());
      await page.getByRole('checkbox', { name: 'Resource C' }).click();
      await page.getByRole('checkbox', { name: 'Resource A' }).click();
      const events = await page.evaluate(
        () => (window as unknown as Win).events,
      );
      expect(events).toEqual([
        { selected: ['c'], count: 1 },
        { selected: ['c', 'a'], count: 2 },
      ]);
    });

    test('selected look: 11% overlay, 15% on hover, 2px inside ring, checked control', async ({
      page,
    }) => {
      await setup(page, RESOURCES());
      await page.getByRole('checkbox', { name: 'Resource A' }).click();
      await page.mouse.move(0, 0);
      await settle(page);
      const bg = ['var(--prism-color-bg)', 'var(--prism-color-text)'] as const;
      const check = async (id: string, state: keyof typeof PCT) => {
        const got = await painted(page.locator(`#${id}`), 'base');
        const want = await expected(page, bg[0], bg[1], PCT[state]);
        expect(
          near(got, want),
          `${id} ${state}: ${got.join()} vs ${want.join()}`,
        ).toBe(true);
      };
      await check('a', 'selected');
      await check('b', 'rest');
      const c = await box(page, '#a');
      await page.mouse.move(c.x + c.w / 2, c.y + c.h - 12);
      await settle(page);
      await check('a', 'selected+hover');
      // Unselected collection card: no hover tint at all (it is not operable).
      const b = await box(page, '#b');
      await page.mouse.move(b.x + b.w / 2, b.y + b.h - 12);
      await settle(page);
      await check('b', 'rest');
      const ring = await page
        .locator('#a')
        .evaluate(
          (el) =>
            getComputedStyle(el.shadowRoot!.querySelector('[part="base"]')!)
              .boxShadow,
        );
      expect(ring).toMatch(/inset/);
      expect(ring).toMatch(/ 2px/);
      await expect(
        page.getByRole('checkbox', { name: 'Resource A' }),
      ).toBeChecked();
    });

    test('a nested control keeps the selected overlay but adds no hover on it', async ({
      page,
    }) => {
      await setup(page, RESOURCES());
      await page.getByRole('checkbox', { name: 'Resource A' }).click();
      await page
        .getByRole('button', { name: 'More options for Resource A' })
        .hover();
      await settle(page);
      const got = await painted(page.locator('#a'), 'base');
      const want = await expected(
        page,
        'var(--prism-color-bg)',
        'var(--prism-color-text)',
        PCT.selected,
      );
      expect(near(got, want)).toBe(true);
    });

    test('initial selected attributes are read once; ids not on screen stay selected', async ({
      page,
    }) => {
      await setup(page, RESOURCES().replace('value="b"', 'value="b" selected'));
      expect(await selected(page)).toEqual(['b']);
      await page.locator('#g').evaluate((el) => {
        (el as unknown as { selected: string[] }).selected = ['b', 'zz'];
      });
      await settle(page);
      expect(await selected(page)).toEqual(['b', 'zz']);
      // Append the card that was already selected by id (a later page).
      await page.locator('#g').evaluate((el) => {
        const card = document.createElement('prism-card');
        card.id = 'zz';
        card.setAttribute('type', 'selectable');
        card.setAttribute('kind', 'collection');
        card.setAttribute('value', 'zz');
        card.innerHTML =
          '<prism-card-select slot="header"></prism-card-select><prism-card-title slot="header" level="3">Resource ZZ</prism-card-title><p>x</p>';
        el.append(card);
      });
      await settle(page);
      expect(await isSel(page, 'zz')).toBe(true);
      await expect(
        page.getByRole('checkbox', { name: 'Resource ZZ' }),
      ).toBeChecked();
      // Removing a card (paging away) keeps its id.
      await page.locator('#zz').evaluate((el) => el.remove());
      await settle(page);
      expect(await selected(page)).toEqual(['b', 'zz']);
    });

    test('disabled: control disabled, no overlay, reason is in the text', async ({
      page,
    }) => {
      const errors = await setup(
        page,
        `<prism-card-group id="g" label="Resources"><prism-card id="d" type="selectable" kind="collection" value="d" disabled style="width:320px"><prism-card-select slot="header"></prism-card-select><prism-card-title slot="header" level="3">Resource D</prism-card-title><prism-card-description slot="header">Offline: cannot be selected.</prism-card-description></prism-card></prism-card-group>`,
      );
      expect(errors).toEqual([]);
      await expect(
        page.getByRole('checkbox', { name: 'Resource D' }),
      ).toBeDisabled();
      await page
        .getByRole('checkbox', { name: 'Resource D' })
        .click({ force: true });
      expect(await selected(page)).toEqual([]);
      const got = await painted(page.locator('#d'), 'base');
      const want = await expected(
        page,
        'var(--prism-color-bg)',
        'var(--prism-color-text)',
        PCT.rest,
      );
      expect(near(got, want)).toBe(true);
    });

    test('the card does not nest controls inside the control: the checkbox is a real input', async ({
      page,
    }) => {
      await setup(page, RESOURCES());
      const tag = await page
        .locator('#a prism-card-select')
        .evaluate((el) => el.shadowRoot!.querySelector('input')!.type);
      expect(tag).toBe('checkbox');
    });
  });

  test.describe('choice card (single): a radio group', () => {
    test('semantics: radiogroup with radios named by the title, position and size set', async ({
      page,
    }) => {
      const errors = await setup(page, PLANS());
      expect(errors).toEqual([]);
      await expect(page.getByRole('radiogroup', { name: 'Plan' })).toHaveCount(
        1,
      );
      const r = page.getByRole('radio', { name: 'Team plan' });
      await expect(r).toHaveAttribute('aria-posinset', '2');
      await expect(r).toHaveAttribute('aria-setsize', '3');
      await expect(r).toHaveAccessibleDescription('Description of team.');
      await expect(page.getByRole('radio')).toHaveCount(3);
    });

    test('clicking anywhere on the card chooses it; choosing one clears the others; it cannot be cleared', async ({
      page,
    }) => {
      await setup(page, PLANS());
      await page.locator('#team').getByText('team details').click();
      expect(await selected(page)).toEqual(['team']);
      await page.locator('#enterprise').getByText('enterprise details').click();
      expect(await selected(page)).toEqual(['enterprise']);
      expect(await isSel(page, 'team')).toBe(false);
      await page.locator('#enterprise').getByText('enterprise details').click();
      expect(await selected(page)).toEqual(['enterprise']);
      await expect(
        page.getByRole('radio', { name: 'Enterprise plan' }),
      ).toBeChecked();
    });

    test('one tab stop: Tab enters on the first card, then on the selected one', async ({
      page,
    }) => {
      await setup(page, PLANS());
      await page.locator('#before').focus();
      await page.keyboard.press('Tab');
      await expect(
        page.getByRole('radio', { name: 'Free plan' }),
      ).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.locator('#after')).toBeFocused();
      await page.locator('#team').getByText('team details').click();
      await settle(page);
      await page.locator('#before').focus();
      await page.keyboard.press('Tab');
      await expect(
        page.getByRole('radio', { name: 'Team plan' }),
      ).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.locator('#after')).toBeFocused();
    });

    test('arrow keys move focus and select, and wrap', async ({ page }) => {
      await setup(page, PLANS());
      await page.getByRole('radio', { name: 'Free plan' }).focus();
      await page.keyboard.press('ArrowDown');
      await expect(
        page.getByRole('radio', { name: 'Team plan' }),
      ).toBeFocused();
      expect(await selected(page)).toEqual(['team']);
      await page.keyboard.press('ArrowRight');
      await expect(
        page.getByRole('radio', { name: 'Enterprise plan' }),
      ).toBeFocused();
      await page.keyboard.press('ArrowDown'); // wraps
      await expect(
        page.getByRole('radio', { name: 'Free plan' }),
      ).toBeFocused();
      expect(await selected(page)).toEqual(['free']);
      await page.keyboard.press('ArrowUp'); // wraps back
      await expect(
        page.getByRole('radio', { name: 'Enterprise plan' }),
      ).toBeFocused();
      await page.keyboard.press('ArrowLeft');
      await expect(
        page.getByRole('radio', { name: 'Team plan' }),
      ).toBeFocused();
      expect(await selected(page)).toEqual(['team']);
    });

    test('right-to-left flips the horizontal arrows', async ({ page }) => {
      await setup(page, `<div dir="rtl">${PLANS()}</div>`);
      await page.getByRole('radio', { name: 'Free plan' }).focus();
      await page.keyboard.press('ArrowLeft');
      await expect(
        page.getByRole('radio', { name: 'Team plan' }),
      ).toBeFocused();
    });

    test('a disabled card is skipped by the arrows', async ({ page }) => {
      await setup(
        page,
        PLANS().replace(
          'id="team" type="selectable"',
          'id="team" disabled type="selectable"',
        ),
      );
      await page.getByRole('radio', { name: 'Free plan' }).focus();
      await page.keyboard.press('ArrowDown');
      await expect(
        page.getByRole('radio', { name: 'Enterprise plan' }),
      ).toBeFocused();
    });

    test('Space on a focused, unchosen radio chooses it', async ({ page }) => {
      await setup(page, PLANS());
      await page.getByRole('radio', { name: 'Free plan' }).focus();
      await page.keyboard.press(' ');
      expect(await selected(page)).toEqual(['free']);
    });

    test('no live "N selected" message for a radio group (the radio announces itself)', async ({
      page,
    }) => {
      await setup(page, PLANS());
      await page.locator('#team').getByText('team details').click();
      await expect(page.locator('#g').locator('[role="status"]')).toHaveText(
        '',
      );
    });

    test('the whole card shows the focus ring, not the radio', async ({
      page,
    }) => {
      await setup(page, PLANS());
      await page.locator('#before').focus();
      await page.keyboard.press('Tab');
      await settle(page);
      const r = await page.locator('#free').evaluate((el) => ({
        ring: el.matches(':state(focus-ring)'),
        shadow: getComputedStyle(el.shadowRoot!.querySelector('[part="base"]')!)
          .boxShadow,
        outline: getComputedStyle(
          el
            .querySelector('prism-card-select')!
            .shadowRoot!.querySelector('input')!,
        ).outlineStyle,
      }));
      expect(r.ring).toBe(true);
      expect(r.shadow).toMatch(/4px/);
      expect(r.outline).toBe('none');
    });

    test('choice card hover tints (it is operable) and the control hover does too', async ({
      page,
    }) => {
      await setup(page, PLANS());
      const c = await box(page, '#free');
      await page.mouse.move(c.x + c.w / 2, c.y + c.h - 10);
      await settle(page);
      const got = await painted(page.locator('#free'), 'base');
      const want = await expected(
        page,
        'var(--prism-color-bg)',
        'var(--prism-color-text)',
        PCT.hover,
      );
      expect(near(got, want)).toBe(true);
      await page.getByRole('radio', { name: 'Free plan' }).hover();
      await settle(page);
      const got2 = await painted(page.locator('#free'), 'base');
      expect(near(got2, want)).toBe(true);
    });

    test('selected choice card: ring plus a checked radio, never colour alone', async ({
      page,
    }) => {
      await setup(page, PLANS());
      await page.locator('#team').getByText('team details').click();
      await expect(
        page.getByRole('radio', { name: 'Team plan' }),
      ).toBeChecked();
      const ring = await page
        .locator('#team')
        .evaluate(
          (el) =>
            getComputedStyle(el.shadowRoot!.querySelector('[part="base"]')!)
              .boxShadow,
        );
      expect(ring).toMatch(/inset/);
    });
  });

  test.describe('selection rules and errors', () => {
    test('a selectable card needs kind, a visible control and a value in a group', async ({
      page,
    }) => {
      const errors = await setup(
        page,
        `<prism-card-group label="x"><prism-card type="selectable"><prism-card-title slot="header" level="3">Bare</prism-card-title></prism-card></prism-card-group>`,
      );
      expect(errors.some((e) => e.includes('`kind="choice"`'))).toBe(true);
      expect(errors.some((e) => e.includes('visible prism-card-select'))).toBe(
        true,
      );
      expect(errors.some((e) => e.includes('needs a `value`'))).toBe(true);
    });

    test('a choice card has no other controls', async ({ page }) => {
      const errors = await setup(
        page,
        `<prism-card-group label="x"><prism-card type="selectable" kind="choice" value="1"><prism-card-select slot="header"></prism-card-select><prism-card-title slot="header" level="3">Choice</prism-card-title><prism-button>Extra</prism-button></prism-card></prism-card-group>`,
      );
      expect(errors.some((e) => e.includes('no other controls'))).toBe(true);
    });

    test('a group without a label is a dev error', async ({ page }) => {
      const errors = await setup(
        page,
        `<prism-card-group><prism-card type="selectable" kind="choice" value="1"><prism-card-select slot="header"></prism-card-select><prism-card-title slot="header" level="3">C</prism-card-title></prism-card></prism-card-group>`,
      );
      expect(errors.some((e) => e.includes('needs a `label`'))).toBe(true);
    });

    test('a selection control is refused on a non-selectable card', async ({
      page,
    }) => {
      await setup(
        page,
        `<prism-card><prism-card-title slot="header" level="3">T</prism-card-title><prism-card-select slot="header" id="s"></prism-card-select></prism-card>`,
      );
      expect(
        await page.locator('#s').evaluate((el) => getComputedStyle(el).display),
      ).toBe('none');
    });

    test('one selection control per card', async ({ page }) => {
      await setup(
        page,
        `<prism-card type="selectable" kind="collection"><prism-card-select slot="header" id="s1"></prism-card-select><prism-card-select slot="header" id="s2"></prism-card-select><prism-card-title slot="header" level="3">T</prism-card-title></prism-card>`,
      );
      expect(
        await page
          .locator('#s2')
          .evaluate((el) => getComputedStyle(el).display),
      ).toBe('none');
    });

    test('a standalone selectable card (no group) toggles its own checkbox', async ({
      page,
    }) => {
      await setup(
        page,
        `<prism-card id="s" type="selectable" kind="choice" style="width:260px"><prism-card-select slot="header"></prism-card-select><prism-card-title slot="header" level="3">Solo</prism-card-title><p>click me</p></prism-card>`,
      );
      await page.getByText('click me').click();
      await expect(page.getByRole('checkbox', { name: 'Solo' })).toBeChecked();
      await page.getByText('click me').click();
      await expect(
        page.getByRole('checkbox', { name: 'Solo' }),
      ).not.toBeChecked();
    });

    test('forced-colors: the selected ring is an outline that stays visible', async ({
      page,
    }) => {
      await page.emulateMedia({ forcedColors: 'active' });
      await setup(page, RESOURCES());
      await page.getByRole('checkbox', { name: 'Resource A' }).click();
      const o = await page.locator('#a').evaluate((el) => {
        const cs = getComputedStyle(
          el.shadowRoot!.querySelector('[part="base"]')!,
        );
        return [cs.outlineStyle, cs.outlineWidth];
      });
      expect(o).toEqual(['solid', '2px']);
    });
  });

  test.describe('menu trigger inside a selected card', () => {
    test('stays transparent so the selected tint shows through', async ({
      page,
    }) => {
      await setup(
        page,
        `<prism-card id="c" type="selectable" kind="collection" value="x" selected>
          <prism-card-header>
            <prism-card-title slot="title" level="3">Resource</prism-card-title>
            <prism-menu slot="actions" label="More options for Resource">
              <prism-menu-item>Rename</prism-menu-item>
            </prism-menu>
          </prism-card-header>
          <prism-card-content>Body</prism-card-content>
        </prism-card>`,
      );
      const bg = await page.evaluate(() => {
        const m = document.querySelector('prism-menu')!;
        const ib = m.shadowRoot!.querySelector('prism-icon-button')!;
        return getComputedStyle(ib.shadowRoot!.querySelector('[part=base]')!)
          .backgroundColor;
      });
      expect(['transparent', 'rgba(0, 0, 0, 0)']).toContain(bg);
    });
  });

  test.describe('SelectionController', () => {
    type SC = typeof import('./selection-controller.js').SelectionController;
    test('multi mode toggles, keeps order and counts ids', async ({ page }) => {
      await mount(page, '');
      const r = await page.evaluate(async () => {
        const { SelectionController } = (await import(
          /* @vite-ignore */ '/src/card/' + 'selection-controller.ts'
        )) as { SelectionController: SC };
        const s = new SelectionController();
        s.toggle('a');
        s.toggle('b');
        s.toggle('a');
        s.select('c');
        return { values: s.values, size: s.size, has: s.has('b') };
      });
      expect(r).toEqual({ values: ['b', 'c'], size: 2, has: true });
    });

    test('single mode holds one id and a repeat select reports no change', async ({
      page,
    }) => {
      await mount(page, '');
      const r = await page.evaluate(async () => {
        const { SelectionController } = (await import(
          /* @vite-ignore */ '/src/card/' + 'selection-controller.ts'
        )) as { SelectionController: SC };
        const s = new SelectionController(undefined, { mode: 'single' });
        const first = s.select('a');
        const again = s.select('a');
        s.toggle('b');
        return { first, again, values: s.values };
      });
      expect(r).toEqual({ first: true, again: false, values: ['b'] });
    });

    test('set keeps ids that are not on screen and clear empties', async ({
      page,
    }) => {
      await mount(page, '');
      const r = await page.evaluate(async () => {
        const { SelectionController } = (await import(
          /* @vite-ignore */ '/src/card/' + 'selection-controller.ts'
        )) as { SelectionController: SC };
        const s = new SelectionController();
        s.set(['a', 'b', 'a']);
        const same = s.set(['a', 'b']);
        const size = s.size;
        const cleared = s.clear();
        return { same, size, cleared, after: s.size };
      });
      expect(r).toEqual({ same: false, size: 2, cleared: true, after: 0 });
    });
  });
}

// --- card-select-check.test.ts ---
{
  async function setup(page: Page, theme = 'light') {
    await mount(
      page,
      `<prism-card-group label="Resources" mode="multi">
        <prism-card id="a" type="selectable" value="a" style="inline-size:300px"><prism-card-select slot="header"></prism-card-select><prism-card-title slot="header" level="3" href="#a">Resource A</prism-card-title><prism-card-description slot="header">Alpha.</prism-card-description></prism-card>
        <prism-card id="b" type="selectable" value="b" selected style="inline-size:300px"><prism-card-select slot="header"></prism-card-select><prism-card-title slot="header" level="3" href="#b">Resource B</prism-card-title><prism-card-description slot="header">Beta.</prism-card-description></prism-card>
      </prism-card-group>`,
    );
    await page.addStyleTag({ path: 'src/tokens/tokens.css' });
    await page.addStyleTag({ path: 'src/theme/theme.css' });
    await page.evaluate(
      (t) => document.documentElement.setAttribute('data-prism-theme', t),
      theme,
    );
    await wait(page, 600);
  }

  const mark = (id: string) => `#${id} prism-card-select`;
  const state = (page: Page, id: string) =>
    page.locator(mark(id)).evaluate((e) => {
      const m = e.shadowRoot!.querySelector('[part="mark"]')!;
      const cs = getComputedStyle(m);
      const input = e.shadowRoot!.querySelector('input')!;
      return {
        offset: parseFloat(cs.strokeDashoffset),
        opacity: Number(cs.opacity),
        anims: m.getAnimations().length,
        appearance: getComputedStyle(input).appearance,
        checked: input.checked,
      };
    });

  test.describe('selectable card corner check', () => {
    test('it is still a real, labelled checkbox; the tick is drawn on top', async ({
      page,
    }) => {
      await setup(page);
      const cb = page.getByRole('checkbox', { name: 'Resource A' });
      await expect(cb).not.toBeChecked();
      expect(await state(page, 'a')).toMatchObject({
        offset: 1,
        opacity: 0,
        appearance: 'none',
      });
      expect(await state(page, 'b')).toMatchObject({
        offset: 0,
        opacity: 1,
        anims: 0,
        checked: true,
      });
    });

    test('first paint: a card that starts selected shows its tick with no animation', async ({
      page,
    }) => {
      await setup(page);
      expect((await state(page, 'b')).anims).toBe(0);
    });

    test('ticking draws the tick in over several frames; unticking draws it out; no jumps', async ({
      page,
    }) => {
      await setup(page);
      await polishMotion(page);
      const rows = await recordFrames(
        page.locator(mark('a')),
        1000,
        (root) => {
          const cs = getComputedStyle(root.querySelector('[part="mark"]')!);
          return [parseFloat(cs.strokeDashoffset)];
        },
        [
          {
            at: 100,
            run: (h) => h.shadowRoot!.querySelector('input')!.click(),
          },
          {
            at: 550,
            run: (h) => h.shadowRoot!.querySelector('input')!.click(),
          },
        ],
      );
      const off = rows.map((r) => r[0]!);
      expect(off[0]).toBe(1);
      expect(Math.min(...off)).toBeLessThan(0.02);
      expect(off.at(-1)).toBeCloseTo(1, 2);
      expect(off.filter((v) => v > 0.05 && v < 0.95).length).toBeGreaterThan(4);
      expect(maxStep(rows)[0]).toBeLessThan(0.34);
    });

    test('reduced motion: the tick is there at once', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await setup(page);
      await page.getByRole('checkbox', { name: 'Resource A' }).click();
      await wait(page, 30);
      expect(await state(page, 'a')).toMatchObject({
        offset: 0,
        opacity: 1,
        anims: 0,
      });
    });

    test('a card taken out of the selection by code is not animated while hidden', async ({
      page,
    }) => {
      await setup(page);
      await page
        .locator('#a')
        .evaluate(
          (e) => ((e as unknown as { selected: boolean }).selected = true),
        );
      await wait(page, 600);
      expect(await state(page, 'a')).toMatchObject({ offset: 0, opacity: 1 });
    });

    test('forced colors: box and tick use system colours', async ({ page }) => {
      await page.emulateMedia({ forcedColors: 'active' });
      await setup(page);
      const r = await page.locator(mark('b')).evaluate((e) => {
        const input = e.shadowRoot!.querySelector('input')!;
        const check = e.shadowRoot!.querySelector('[part="check"]')!;
        return {
          bg: getComputedStyle(input).backgroundColor,
          tick: getComputedStyle(check).color,
        };
      });
      expect(r.bg).not.toBe('rgba(0, 0, 0, 0)');
      expect(r.bg).not.toBe(r.tick);
    });

    for (const theme of ['light', 'dark'])
      test(`axe (${theme})`, async ({ page }) => {
        await setup(page, theme);
        expect(await axe(page)).toEqual([]);
      });
  });
}
