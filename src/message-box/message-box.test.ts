import { expect, test, type Page } from '@playwright/test';
import { mount } from '../../test/fixture.js';

async function setup(page: Page, markup: string) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await mount(page, markup);
  await page.addStyleTag({ path: 'src/tokens/tokens.css' });
  await page.addStyleTag({ path: 'src/theme/theme.css' });
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60))),
  );
  return errors;
}

const radii = (page: Page, sel: string) =>
  page.locator(sel).evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      ss: cs.borderStartStartRadius,
      se: cs.borderStartEndRadius,
      es: cs.borderEndStartRadius,
      ee: cs.borderEndEndRadius,
      marginBlockStart: cs.marginBlockStart,
      marginBlockEnd: cs.marginBlockEnd,
      marginInlineStart: cs.marginInlineStart,
      marginInlineEnd: cs.marginInlineEnd,
    };
  });

test.describe('prism-message-box', () => {
  test('placement sets far-corner radii and the tucked-edge overlap', async ({
    page,
  }) => {
    await setup(
      page,
      `<div id="row">
        <prism-message-box id="bottom" placement="bottom">Below the plate</prism-message-box>
        <prism-message-box id="top" placement="top">Above the plate</prism-message-box>
      </div>`,
    );
    const bottom = await radii(page, '#bottom');
    expect(bottom.ss).toBe('0px');
    expect(bottom.se).toBe('0px');
    expect(bottom.es).toBe('5px');
    expect(bottom.ee).toBe('5px');
    expect(bottom.marginBlockStart).toBe('-2px');
    expect(bottom.marginInlineStart).toBe('0px');
    expect(bottom.marginInlineEnd).toBe('0px');

    const top = await radii(page, '#top');
    expect(top.ss).toBe('5px');
    expect(top.se).toBe('5px');
    expect(top.es).toBe('0px');
    expect(top.ee).toBe('0px');
    expect(top.marginBlockEnd).toBe('-2px');
    expect(top.marginInlineStart).toBe('0px');
  });

  test("the box does not reorder its light DOM; reading order is the author's", async ({
    page,
  }) => {
    await setup(
      page,
      `<div id="top-pair">
        <prism-message-box id="a" placement="top">Aperture is wide</prism-message-box>
        <div id="na">Plate</div>
      </div>
      <div id="bottom-pair">
        <div id="nb">Plate</div>
        <prism-message-box id="b" placement="bottom">Focus is soft</prism-message-box>
      </div>`,
    );
    const order = await page.evaluate(() => {
      const ids = (root: string) =>
        [...document.querySelector(root)!.children].map((el) => el.id);
      return {
        top: ids('#top-pair'),
        bottom: ids('#bottom-pair'),
      };
    });
    expect(order.top).toEqual(['a', 'na']);
    expect(order.bottom).toEqual(['nb', 'b']);
  });

  test('intent tokens paint error and info', async ({ page }) => {
    await setup(
      page,
      `<prism-message-box id="e" intent="error">Out of focus</prism-message-box>
       <prism-message-box id="i" intent="info">Index is 1.52</prism-message-box>`,
    );
    const paint = await page.evaluate(() => {
      const read = (id: string) => {
        const cs = getComputedStyle(document.getElementById(id)!);
        return {
          bg: cs.backgroundColor,
          color: cs.color,
          border: cs.borderTopColor,
        };
      };
      const probe = (name: string) => {
        const el = document.createElement('div');
        el.style.color = `var(${name})`;
        document.body.append(el);
        const value = getComputedStyle(el).color;
        el.remove();
        return value;
      };
      return {
        e: read('e'),
        i: read('i'),
        errorSurface: probe('--prism-color-error-surface'),
        onError: probe('--prism-color-on-error-surface'),
        dangerBorder: probe('--prism-color-danger-border'),
        infoText: probe('--prism-color-info-text'),
        infoBorder: probe('--prism-color-info-border'),
        tint: probe('--prism-color-message-box-tint'),
      };
    });
    expect(paint.e.bg).toBe(paint.errorSurface);
    expect(paint.e.color).toBe(paint.onError);
    expect(paint.e.border).toBe(paint.dangerBorder);
    expect(paint.i.color).toBe(paint.infoText);
    expect(paint.i.border).toBe(paint.infoBorder);
    expect(paint.i.bg).toBe(paint.tint);
  });

  test('an empty slot hides the box, and text shows it again', async ({
    page,
  }) => {
    await setup(page, `<prism-message-box id="m"></prism-message-box>`);
    const hidden = await page.locator('#m').evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        display: cs.display,
        empty: (
          el as HTMLElement & { matches: (s: string) => boolean }
        ).matches(':state(empty)'),
        w: el.getBoundingClientRect().width,
      };
    });
    expect(hidden.display).toBe('none');
    expect(hidden.empty).toBe(true);
    expect(hidden.w).toBe(0);

    await page.locator('#m').evaluate((el) => {
      el.textContent = 'The beam is refracted';
    });
    await page.locator('#m').evaluate(async (el) => {
      await (el as HTMLElement & { updateComplete: Promise<unknown> })
        .updateComplete;
    });
    const shown = await page.locator('#m').evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        display: cs.display,
        empty: el.matches(':state(empty)'),
        w: el.getBoundingClientRect().width,
        text: el.textContent,
      };
    });
    expect(shown.display).not.toBe('none');
    expect(shown.empty).toBe(false);
    expect(shown.w).toBeGreaterThan(0);
    expect(shown.text).toContain('The beam is refracted');
  });

  test('announce defaults to a polite live output, and off removes it', async ({
    page,
  }) => {
    await setup(
      page,
      `<prism-message-box id="p">Polite note</prism-message-box>
       <prism-message-box id="a" announce="assertive">Urgent note</prism-message-box>
       <prism-message-box id="o" announce="off">Silent note</prism-message-box>`,
    );
    const a11y = await page.evaluate(() => {
      const read = (id: string) => {
        const el = document.getElementById(id)!;
        const output = el.shadowRoot!.querySelector('output');
        return {
          hasOutput: !!output,
          live: output?.getAttribute('aria-live') ?? null,
          text: output?.textContent ?? '',
        };
      };
      return { p: read('p'), a: read('a'), o: read('o') };
    });
    expect(a11y.p.hasOutput).toBe(true);
    expect(a11y.p.live).toBe('polite');
    expect(a11y.p.text).toContain('Polite note');
    expect(a11y.a.hasOutput).toBe(true);
    expect(a11y.a.live).toBe('assertive');
    expect(a11y.o.hasOutput).toBe(false);
  });

  test('unshipped or unknown intent and placement fall back to the defaults', async ({
    page,
  }) => {
    await setup(
      page,
      `<prism-message-box id="m" intent="warning" placement="start">Fallback</prism-message-box>`,
    );
    const attrs = await page.locator('#m').evaluate((el) => ({
      intent: el.getAttribute('intent'),
      placement: el.getAttribute('placement'),
    }));
    expect(attrs.intent).toBe('error');
    expect(attrs.placement).toBe('bottom');
  });
});
