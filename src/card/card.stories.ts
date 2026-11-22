import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './define.js';
import '../tag/define.js';
import { iconRefresh } from '../internal/icons.js';

interface Args {
  type: 'default' | 'borderless';
  raised: boolean;
  standalone: boolean;
}

const meta: Meta<Args> = {
  title: 'Components/Card',
  component: 'prism-card',
  args: { type: 'default', raised: false, standalone: false },
  argTypes: {
    type: { control: 'inline-radio', options: ['default', 'borderless'] },
  },
  parameters: { layout: 'padded' },
};
export default meta;

const frame = (inner: unknown, width = 360) =>
  html`<div style="max-inline-size:${width}px">${inner}</div>`;

/** Header, content and footer. The footer takes meta and up to two actions. */
export const Default: StoryObj<Args> = {
  render: ({ type, raised, standalone }) =>
    frame(
      html`<prism-card type=${type} ?raised=${raised} ?standalone=${standalone}>
        <prism-card-title slot="header" level="3"
          >Onboarding guide</prism-card-title
        >
        <prism-card-description slot="header"
          >Steps for welcoming new members.</prism-card-description
        >
        <p style="margin:0">Runs when a new member joins.</p>
        <prism-card-meta slot="footer">Updated 2 min ago</prism-card-meta>
        <prism-card-actions slot="footer">
          <prism-button variant="ghost">View all</prism-button>
        </prism-card-actions>
      </prism-card>`,
    ),
};

/** Replaces Panel: a flat fill, no border and no shadow. */
export const Borderless: StoryObj<Args> = {
  args: { type: 'borderless' },
  render: Default.render!,
};

/** A shadow from the predefined elevation level, plus a transparent border. */
export const Raised: StoryObj<Args> = {
  args: { raised: true },
  render: Default.render!,
};

/** Header parts: icon, title, tag, description and two ghost icon buttons. */
export const HeaderParts: StoryObj<Args> = {
  render: () =>
    frame(
      html`<prism-card>
        <svg
          slot="header"
          data-prism-card-icon
          width="16"
          height="16"
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" />
        </svg>
        <prism-card-title slot="header" level="3"
          >resource-eu-0042</prism-card-title
        >
        <prism-tag slot="header" job="spectrum" tone="danger" emphasis="high"
          >Urgent</prism-tag
        >
        <prism-card-description slot="header"
          >Lumen Board 9, last seen 4 min ago</prism-card-description
        >
        <prism-card-actions slot="header">
          <prism-icon-button label="Refresh resource-eu-0042"
            >${iconRefresh()}</prism-icon-button
          >
          <prism-menu label="More options for resource-eu-0042">
            <prism-menu-item>Pause</prism-menu-item>
            <prism-menu-item>Export</prism-menu-item>
          </prism-menu>
        </prism-card-actions>
        <div>Content is free.</div>
      </prism-card>`,
      420,
    ),
};

/**
 * Content-only (marketing) card: buttons on the right, 8px apart, medium,
 * soft on the right and ghost to its left. No primary, outline or destructive.
 */
export const ContentOnly: StoryObj<Args> = {
  render: () =>
    frame(
      html`<prism-card>
        <p style="margin:0">Add a profile photo so your team can find you.</p>
        <prism-card-actions>
          <prism-button variant="ghost">Later</prism-button>
          <prism-button variant="secondary">Set up</prism-button>
        </prism-card-actions>
      </prism-card>`,
    ),
};

/** A standalone task card may hold one primary footer button. */
export const StandaloneTask: StoryObj<Args> = {
  render: () =>
    frame(
      html`<prism-card standalone>
        <prism-card-title slot="header" level="3"
          >Renew your plan</prism-card-title
        >
        <p style="margin:0">Your trial ends this week.</p>
        <prism-card-actions slot="footer">
          <prism-button variant="ghost">Snooze</prism-button>
          <prism-button>Renew now</prism-button>
        </prism-card-actions>
      </prism-card>`,
    ),
};

/** Cards in a row share a height; footers line up at the bottom. */
export const FootersAlign: StoryObj<Args> = {
  render: () =>
    html`<div
      style="display:flex;gap:16px;align-items:stretch;max-inline-size:760px"
    >
      ${[1, 2].map(
        (n) =>
          html`<prism-card style="flex:1">
            <prism-card-title slot="header" level="3"
              >Card ${n}</prism-card-title
            >
            <p style="margin:0">
              ${n === 2 ? 'A much longer body. '.repeat(8) : 'Short.'}
            </p>
            <prism-card-meta slot="footer">Footer ${n}</prism-card-meta>
          </prism-card>`,
      )}
    </div>`,
};

/** At 280px or less the icon buttons fold into one overflow menu. */
export const Narrow: StoryObj<Args> = {
  render: () =>
    frame(
      html`<prism-card>
        <prism-card-title slot="header" level="3">Guide</prism-card-title>
        <prism-card-actions slot="header">
          <prism-icon-button label="Refresh Guide"
            >${iconRefresh()}</prism-icon-button
          >
          <prism-icon-button label="Export Guide">E</prism-icon-button>
        </prism-card-actions>
        <p style="margin:0">Body</p>
        <prism-card-meta slot="footer">Updated 2 min ago</prism-card-meta>
        <prism-card-actions slot="footer">
          <prism-button variant="ghost">View all</prism-button>
        </prism-card-actions>
      </prism-card>`,
      260,
    ),
};

const ROW = (v: string, title: string, desc: string) =>
  html`<prism-card type="selectable" kind="choice" value=${v}>
    <prism-card-select slot="header"></prism-card-select>
    <prism-card-title slot="header" level="3">${title}</prism-card-title>
    <prism-card-description slot="header">${desc}</prism-card-description>
    <div>Choose it anywhere on the card.</div>
  </prism-card>`;

/**
 * Clickable (link): the title is the one real link and its click area covers
 * the card. Nested controls sit above it. Hover is the tint only. Pressing
 * shrinks the card by 1% at most, on the same spring, and it stacks with tilt.
 */
export const ClickableLink: StoryObj<Args> = {
  render: () =>
    frame(
      html`<prism-card type="clickable">
        <prism-card-title slot="header" level="3" href="#guide"
          >Onboarding guide</prism-card-title
        >
        <prism-card-description slot="header"
          >Steps for welcoming new members.</prism-card-description
        >
        <prism-card-actions slot="header">
          <prism-menu label="More options for Onboarding guide">
            <prism-menu-item>Duplicate</prism-menu-item>
            <prism-menu-item>Archive</prism-menu-item>
          </prism-menu>
        </prism-card-actions>
        <div>Updated 2 min ago by the Design team.</div>
      </prism-card>`,
    ),
};

/** Clickable (action): the title is a button, for example to open a Drawer. */
export const ClickableAction: StoryObj<Args> = {
  render: () =>
    frame(
      html`<prism-card type="clickable" raised>
        <prism-card-title slot="header" level="3" action
          >resource-eu-0042</prism-card-title
        >
        <div>Opens the details Drawer.</div>
      </prism-card>`,
    ),
};

/** Disabled: no tint, not a link, and the reason is written in the text. */
export const ClickableDisabled: StoryObj<Args> = {
  render: () =>
    frame(
      html`<prism-card type="clickable" disabled>
        <prism-card-title slot="header" level="3" href="#x"
          >Archive report</prism-card-title
        >
        <prism-card-description slot="header"
          >Needs the Editor role.</prism-card-description
        >
      </prism-card>`,
    ),
};

/** Choice cards in a single-select group: a radio group. Arrows move and select. The corner check draws itself in on a spring. */
export const ChoiceCards: StoryObj<Args> = {
  render: () =>
    html`<prism-card-group
      selection="single"
      label="Plan"
      style="display:grid;gap:16px;grid-template-columns:repeat(3,minmax(0,280px))"
    >
      ${ROW('free', 'Free plan', 'For trying it out.')}
      ${ROW('team', 'Team plan', 'Shared dashboards.')}
      ${ROW('ent', 'Enterprise plan', 'Shared dashboards and activity export.')}
    </prism-card-group>`,
};

/**
 * Collection cards in a multi-select group: only the checkbox toggles, the
 * title stays a link, and actions keep working. A polite message says how many
 * are selected. Selection is by id and survives paging.
 */
export const CollectionCards: StoryObj<Args> = {
  render: () =>
    html`<prism-card-group
      selection="multi"
      label="Resources"
      style="display:grid;gap:16px;max-inline-size:360px"
    >
      ${['a', 'b', 'c'].map(
        (v) =>
          html`<prism-card
            type="selectable"
            kind="collection"
            value=${v}
            ?selected=${v === 'b'}
          >
            <prism-card-select slot="header"></prism-card-select>
            <prism-card-title slot="header" level="3" href="#resource-${v}"
              >Resource ${v.toUpperCase()}</prism-card-title
            >
            <prism-card-description slot="header"
              >Lumen Board 9</prism-card-description
            >
            <prism-card-actions slot="header">
              <prism-menu label="More options for Resource ${v.toUpperCase()}">
                <prism-menu-item>Pause</prism-menu-item>
              </prism-menu>
            </prism-card-actions>
            <div>Updated 4 min ago</div>
          </prism-card>`,
      )}
    </prism-card-group>`,
};

// ---- Milestone 3: widget, collapsible, card list (names provisional) ----

const widget = (
  title: string,
  value: string,
  extra: { range?: string; state?: string; message?: string } = {},
) =>
  html`<prism-card
    type="widget"
    range=${extra.range ?? ''}
    state=${extra.state ?? ''}
    state-message=${extra.message ?? ''}
  >
    <prism-card-title slot="header" level="3">${title}</prism-card-title>
    <prism-card-description slot="header">Aperture Labs</prism-card-description>
    <prism-card-actions slot="header">
      <prism-icon-button label="Refresh ${title}"
        >${iconRefresh()}</prism-icon-button
      >
      <prism-menu label="More options for ${title}">
        <prism-menu-item>Configure</prism-menu-item>
        <prism-menu-item>Export</prism-menu-item>
        <prism-menu-item>Remove</prism-menu-item>
      </prism-menu>
    </prism-card-actions>
    <prism-card-metric label="Items">${value}</prism-card-metric>
    <prism-card-meta slot="footer">Updated 2 min ago</prism-card-meta>
    <prism-card-actions slot="footer">
      <prism-button variant="ghost" size="sm">View all</prism-button>
    </prism-card-actions>
  </prism-card>`;

/**
 * Widgets follow the page's time range (`data-prism-time-range` on the Toolbar
 * or page). The second widget overrides it: its range shows in the header with
 * the word "Overridden". Change the page range with the select.
 */
export const WidgetTimeRange: StoryObj<Args> = {
  render: () =>
    html`<section
      id="widget-page"
      data-prism-time-range="Last 24 hours"
      style="display:grid;gap:16px;grid-template-columns:repeat(2,minmax(0,340px))"
    >
      <label style="grid-column:1/-1;font:14px var(--prism-font-family-sans)"
        >Page time range
        <select
          @change=${(e: Event) =>
            (e.target as HTMLElement)
              .closest('section')
              ?.setAttribute(
                'data-prism-time-range',
                (e.target as HTMLSelectElement).value,
              )}
        >
          <option>Last 24 hours</option>
          <option>Last 7 days</option>
        </select>
      </label>
      ${widget('Items over time', '1,284')}
      ${widget('Items, 30 days', '9,402', { range: 'Last 30 days' })}
    </section>`,
};

/** States stay inside the widget; the header and footer stay put. */
export const WidgetStates: StoryObj<Args> = {
  render: () =>
    html`<div
      style="display:grid;gap:16px;grid-template-columns:repeat(3,minmax(0,300px))"
    >
      ${widget('Loading', '0', { state: 'loading' })}
      ${widget('Error', '0', {
        state: 'error',
        message: 'The items service timed out.',
      })}
      ${widget('Empty', '0', { state: 'empty' })}
    </div>`,
};

/** The title row is the toggle. Closed by default; actions sit beside it. */
export const Collapsible: StoryObj<Args> = {
  render: () =>
    frame(
      html`<div style="display:grid;gap:16px">
        <prism-card type="collapsible" storage-key="story-adv">
          <prism-card-title slot="header" level="3"
            >Advanced settings</prism-card-title
          >
          <prism-card-actions slot="header">
            <prism-icon-button label="Reset Advanced settings"
              >${iconRefresh()}</prism-icon-button
            >
          </prism-card-actions>
          <p style="margin:0">Optional detail group.</p>
          <prism-card-meta slot="footer">Edited yesterday</prism-card-meta>
        </prism-card>
        <prism-card type="collapsible" open>
          <prism-card-title slot="header" level="3"
            >Open by default</prism-card-title
          >
          <p style="margin:0">Open because people need it on first view.</p>
        </prism-card>
      </div>`,
      420,
    ),
};

const RESOURCE_PAGES = 5;
const resourceCards = (page: number, size: number): string =>
  Array.from({ length: Math.min(size, 6) }, (_, i) => {
    const id = `resource-${(page - 1) * 6 + i + 1}`;
    return `<prism-card type="selectable" kind="collection" value="${id}">
      <prism-card-select slot="header"></prism-card-select>
      <prism-card-title slot="header" level="3" href="#${id}">Resource ${id.slice(5)}</prism-card-title>
      <prism-card-description slot="header">Lumen Board 9</prism-card-description>
      <div>Updated ${i + 1} min ago</div>
      <prism-card-meta slot="footer">Page ${page}</prism-card-meta>
    </prism-card>`;
  }).join('');

/**
 * A paged list of collection cards. "Next" swaps in the next page's cards (as a
 * server would); selected ids stay selected and "N selected" keeps counting.
 */
export const CardList: StoryObj<Args> = {
  render: () => {
    const list = document.createElement('prism-card-list');
    list.setAttribute('label', 'Resources');
    list.setAttribute('total', String(RESOURCE_PAGES * 6));
    list.setAttribute('page-size', '12');
    list.innerHTML = resourceCards(1, 12);
    list.addEventListener('prism-card-list-page', (e) => {
      const { page, pageSize } = (
        e as CustomEvent<{ page: number; pageSize: number }>
      ).detail;
      for (const c of [...list.children])
        if (c.localName === 'prism-card') c.remove();
      list.insertAdjacentHTML('afterbegin', resourceCards(page, pageSize));
    });
    return list;
  },
};

/** Loading, refreshing, empty, no matches, error. */
export const CardListStates: StoryObj<Args> = {
  render: () =>
    html`<div style="display:grid;gap:32px">
      <prism-card-list
        label="Loading resources"
        state="loading"
        skeleton-count="4"
      ></prism-card-list>
      <prism-card-list label="No matches" state="no-matches"></prism-card-list>
      <prism-card-list
        label="Error"
        state="error"
        state-message="The resources service is down."
      ></prism-card-list>
    </div>`,
};

/** One column in an Aside, Drawer or Modal. */
export const CardListOneColumn: StoryObj<Args> = {
  render: () => {
    const list = document.createElement('prism-card-list');
    list.setAttribute('label', 'Resources');
    list.setAttribute('columns', '1');
    list.innerHTML = resourceCards(1, 3);
    list.style.maxInlineSize = '420px';
    return list;
  },
};

// ---- Milestone 4: reorderable lists (names provisional) ----

const REORDER_NAMES = [
  'Onboarding guide',
  'Release review',
  'Account setup',
  'Data export',
];
const reorderCard = (name: string, menu = true) => `
  <prism-card value="${name}">
    <prism-card-handle slot="header"></prism-card-handle>
    <prism-card-title slot="header" level="3">${name}</prism-card-title>
    <prism-card-description slot="header">Runs on request</prism-card-description>
    ${
      menu
        ? `<prism-card-actions slot="header"><prism-menu label="More options for ${name}"><prism-menu-item>Rename</prism-menu-item></prism-menu></prism-card-actions>`
        : ''
    }
    <p style="margin:0">Steps for ${name.toLowerCase()}.</p>
    <prism-card-meta slot="footer">Updated 2 min ago</prism-card-meta>
  </prism-card>`;

/**
 * Drag a card by its handle (touch: press and hold). Or open the card's menu
 * and use Move to top, up, down, bottom: no drag needed. A polite message says
 * what moved. Escape cancels a drag.
 */
export const ReorderableList: StoryObj<Args> = {
  render: () => {
    const list = document.createElement('prism-card-list');
    list.setAttribute('label', 'Guides');
    list.setAttribute('reorderable', '');
    list.setAttribute('columns', '1');
    list.style.maxInlineSize = '420px';
    list.innerHTML = REORDER_NAMES.map((n) => reorderCard(n)).join('');
    return list;
  },
};

/** In a grid the line is vertical and the Move items read start, earlier, later, end. */
export const ReorderableGrid: StoryObj<Args> = {
  render: () => {
    const list = document.createElement('prism-card-list');
    list.setAttribute('label', 'Guides');
    list.setAttribute('reorderable', '');
    list.style.maxInlineSize = '760px';
    list.innerHTML = REORDER_NAMES.map((n) => reorderCard(n)).join('');
    return list;
  },
};

/** No overflow menu: the handle is the menu button, named "Reorder {title}". */
export const ReorderableHandleMenu: StoryObj<Args> = {
  render: () => {
    const list = document.createElement('prism-card-list');
    list.setAttribute('label', 'Guides');
    list.setAttribute('reorderable', '');
    list.setAttribute('columns', '1');
    list.style.maxInlineSize = '420px';
    list.innerHTML = REORDER_NAMES.map((n) => reorderCard(n, false)).join('');
    return list;
  },
};

/** Two lists in one group: drag a card from Draft to Active. */
export const ReorderBetweenLists: StoryObj<Args> = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.cssText =
      'display:grid;grid-template-columns:repeat(2,minmax(0,320px));gap:32px';
    const mk = (label: string, names: string[]) =>
      `<prism-card-list label="${label}" reorderable columns="1" reorder-group="guides">${names.map((n) => reorderCard(n)).join('')}</prism-card-list>`;
    wrap.innerHTML =
      mk('Draft', REORDER_NAMES.slice(0, 2)) +
      mk('Active', REORDER_NAMES.slice(2));
    return wrap;
  },
};
