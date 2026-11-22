import { html } from 'lit';
import { href } from '../layout.js';

export const homePage = () => html`
  <div class="hero">
    <h1>Theme showcase</h1>
    <p class="lede">
      The same components as the Storybook reference, wearing the opt-in look:
      tokens, the default theme, the spectral accent, and polish. Use the
      controls in the header to switch a neutral default and the accent, light
      and dark, and polish on or off.
    </p>
  </div>
  <div class="preview-row">
    <prism-button>Save plate</prism-button>
    <prism-button variant="secondary">Export</prism-button>
    <prism-button variant="outline">Preview</prism-button>
    <prism-tag tone="accent">Accent</prism-tag>
    <prism-tag tone="success" emphasis="high">Online</prism-tag>
    <prism-badge job="status" status="live"></prism-badge>
  </div>
  <nav class="cards" aria-label="Showcase sections">
    <prism-card type="clickable">
      <prism-card-title slot="header" level="2" href=${href('polish')}
        >Polish</prism-card-title
      >
      <prism-card-description slot="header"
        >Squircle corners, a light-following border, card tilt, and a running
        job.</prism-card-description
      >
    </prism-card>
    <prism-card type="clickable">
      <prism-card-title slot="header" level="2" href=${href('recipes')}
        >Recipes</prism-card-title
      >
      <prism-card-description slot="header"
        >Eight composed screens: a dashboard, pricing, a kanban board, an
        activity feed, settings and more.</prism-card-description
      >
    </prism-card>
    <prism-card type="clickable">
      <prism-card-title slot="header" level="2" href=${href('accent')}
        >Accent</prism-card-title
      >
      <prism-card-description slot="header"
        >The spectral (violet) accent next to the neutral band, and a beam split
        into hues.</prism-card-description
      >
    </prism-card>
    <prism-card type="clickable">
      <prism-card-title slot="header" level="2" href=${href('motion')}
        >Motion</prism-card-title
      >
      <prism-card-description slot="header"
        >Press, springs and draws that only run when polish motion is
        on.</prism-card-description
      >
    </prism-card>
  </nav>
`;
