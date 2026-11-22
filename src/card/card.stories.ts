import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './define.js';
import '../tag/define.js';
import { iconRefresh } from '../internal/icons.js';

interface Args {
  type:
    | 'default'
    | 'borderless'
    | 'clickable'
    | 'selectable'
    | 'widget'
    | 'collapsible';
  raised: boolean;
  standalone: boolean;
  disabled: boolean;
}

const reference = { parameters: { controls: { disable: true } } };

const meta: Meta<Args> = {
  title: 'Components/Card',
  component: 'prism-card',
  args: { type: 'default', raised: false, standalone: false, disabled: false },
  argTypes: {
    type: {
      control: 'select',
      options: [
        'default',
        'borderless',
        'clickable',
        'selectable',
        'widget',
        'collapsible',
      ],
    },
  },
  parameters: { layout: 'padded' },
  render: ({ type, raised, standalone, disabled }) =>
    frame(
      html`<prism-card
        type=${type}
        ?raised=${raised}
        ?standalone=${standalone}
        ?disabled=${disabled}
      >
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
export default meta;
type Story = StoryObj<Args>;

const frame = (inner: unknown, width = 360) =>
  html`<div style="max-inline-size:${width}px">${inner}</div>`;

/** Header, content and footer. The footer takes meta and up to two actions. */
export const Default: Story = { ...reference };

/** Surface variants: default, borderless, raised, and a standalone task. */
export const Variants: Story = {
  ...reference,
  render: () =>
    html`<div
      style="display:grid;gap:16px;grid-template-columns:repeat(2,minmax(0,320px))"
    >
      <prism-card>
        <prism-card-title slot="header" level="3">Default</prism-card-title>
        <p style="margin:0">Bordered surface.</p>
      </prism-card>
      <prism-card type="borderless">
        <prism-card-title slot="header" level="3">Borderless</prism-card-title>
        <p style="margin:0">A flat fill, no border and no shadow.</p>
      </prism-card>
      <prism-card raised>
        <prism-card-title slot="header" level="3">Raised</prism-card-title>
        <p style="margin:0">A shadow plus a transparent border.</p>
      </prism-card>
      <prism-card standalone>
        <prism-card-title slot="header" level="3"
          >Renew your plan</prism-card-title
        >
        <p style="margin:0">
          A standalone task may hold one primary footer button.
        </p>
        <prism-card-actions slot="footer">
          <prism-button variant="ghost">Snooze</prism-button>
          <prism-button>Renew now</prism-button>
        </prism-card-actions>
      </prism-card>
    </div>`,
};

/** Header parts: icon, title, tag, description and actions. */
export const HeaderParts: Story = {
  ...reference,
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
 * Clickable: the title is the one real control (a link or a button) and its
 * click area covers the card. Nested controls sit above it. A disabled card
 * is not a link, and the reason is written in the text.
 */
export const Clickable: Story = {
  ...reference,
  render: () =>
    html`<div style="display:grid;gap:16px;max-inline-size:360px">
      <prism-card type="clickable">
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
      </prism-card>
      <prism-card type="clickable" raised>
        <prism-card-title slot="header" level="3" action
          >resource-eu-0042</prism-card-title
        >
        <div>The title is a button, for example to open a detail view.</div>
      </prism-card>
      <prism-card type="clickable" disabled>
        <prism-card-title slot="header" level="3" href="#x"
          >Archive report</prism-card-title
        >
        <prism-card-description slot="header"
          >Needs the Editor role.</prism-card-description
        >
      </prism-card>
    </div>`,
};

const ROW = (v: string, title: string, desc: string) =>
  html`<prism-card type="selectable" kind="choice" value=${v}>
    <prism-card-select slot="header"></prism-card-select>
    <prism-card-title slot="header" level="3">${title}</prism-card-title>
    <prism-card-description slot="header">${desc}</prism-card-description>
    <div>Choose it anywhere on the card.</div>
  </prism-card>`;

/** Choice cards in a single-select group: a radio group. Arrows move and select. */
export const ChoiceCards: Story = {
  ...reference,
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
export const CollectionCards: Story = {
  ...reference,
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

/** Widget states stay inside the widget; the header and footer stay put. */
export const WidgetStates: Story = {
  ...reference,
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
export const Collapsible: Story = {
  ...reference,
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
export const CardList: Story = {
  ...reference,
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

/** Loading, no matches, error. */
export const CardListStates: Story = {
  ...reference,
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

const REORDER_NAMES = [
  'Onboarding guide',
  'Release review',
  'Account setup',
  'Data export',
];
const reorderCard = (name: string) => `
  <prism-card value="${name}">
    <prism-card-handle slot="header"></prism-card-handle>
    <prism-card-title slot="header" level="3">${name}</prism-card-title>
    <prism-card-description slot="header">Runs on request</prism-card-description>
    <prism-card-actions slot="header"><prism-menu label="More options for ${name}"><prism-menu-item>Rename</prism-menu-item></prism-menu></prism-card-actions>
    <p style="margin:0">Steps for ${name.toLowerCase()}.</p>
    <prism-card-meta slot="footer">Updated 2 min ago</prism-card-meta>
  </prism-card>`;

/**
 * Drag a card by its handle (touch: press and hold). Or open the card's menu
 * and use Move to top, up, down, bottom: no drag needed. A polite message says
 * what moved. Escape cancels a drag.
 */
export const Reorderable: Story = {
  ...reference,
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

export const Playground: Story = {};
