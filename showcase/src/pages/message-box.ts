import { html } from 'lit';

type Placement = 'top' | 'bottom';
type Intent = 'error' | 'info';

const PLACEMENTS: Placement[] = ['top', 'bottom'];
const INTENTS: Intent[] = ['error', 'info'];

const COPY: Record<Intent, string> = {
  error: 'This beam is out of focus.',
  info: 'The refractive index is 1.52.',
};

const LONG =
  'https://refracted-light.example/beam/collimation/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

const plate = (label: string) => html`
  <div class="mbx-plate">
    <span class="mbx-plate-label">${label}</span>
    <span class="mbx-plate-body">Optical plate</span>
  </div>
`;

const box = (placement: Placement, intent: Intent, text: string) =>
  html`<prism-message-box placement=${placement} intent=${intent}
    >${text}</prism-message-box
  >`;

const pair = (placement: Placement, intent: Intent, text = COPY[intent]) => {
  const neighbor = plate(placement === 'top' ? 'Aperture' : 'Focal length');
  const message = box(placement, intent, text);
  return html`
    <div class="mbx-pair mbx-pair-${placement}">
      ${placement === 'top' ? message : neighbor}
      ${placement === 'top' ? neighbor : message}
    </div>
  `;
};

const showFieldErrors = () => {
  document.querySelectorAll<HTMLElement>('.mbx-field-demo').forEach((el) => {
    (el as HTMLElement & { reportValidity?: () => void }).reportValidity?.();
  });
};

export const messageBoxPage = () => {
  queueMicrotask(showFieldErrors);
  return html`
    <div class="mbx-page">
      <div class="page-head">
        <h1>MessageBox</h1>
        <p>
          A text-only box that tucks against a neighbor on the top or bottom
          edge. Error is the default intent; info uses a neutral tint and muted
          text, with no border. The default inset is 0, so the box is flush with
          the neighbor. Use the appearance control in the header to switch light
          and dark.
        </p>
      </div>

      <section class="section">
        <h2>Placement and intent</h2>
        <p class="mbx-note">
          Top goes before the neighbor in the markup; bottom goes after. Each
          pairing is shown against a plain plate.
        </p>
        <div class="mbx-matrix">
          ${PLACEMENTS.map(
            (placement) => html`
              <div class="mbx-row">
                ${INTENTS.map(
                  (intent) => html`
                    <div class="mbx-cell">
                      <h3>${placement} · ${intent}</h3>
                      ${pair(placement, intent)}
                    </div>
                  `,
                )}
              </div>
            `,
          )}
        </div>
      </section>

      <section class="section">
        <h2>In a field</h2>
        <p class="mbx-note">
          Fields render the MessageBox inside their own shadow, with announce
          off, and point aria-describedby at it.
        </p>
        <div class="mbx-row">
          <div class="mbx-cell">
            <h3>text input</h3>
            <prism-text-input
              class="mbx-field-demo"
              label="Focal length"
              required
            >
              <span slot="error">Enter a focal length.</span>
            </prism-text-input>
          </div>
          <div class="mbx-cell">
            <h3>select</h3>
            <prism-select class="mbx-field-demo" label="Aperture" required>
              <prism-option value="">Choose one</prism-option>
              <prism-option value="f2">f/2</prism-option>
              <prism-option value="f8">f/8</prism-option>
              <span slot="error">Pick an aperture.</span>
            </prism-select>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>Long unbroken text</h2>
        <p class="mbx-note">
          The box wraps anywhere, including a long path with no spaces.
        </p>
        <div class="mbx-long">${pair('bottom', 'info', LONG)}</div>
      </section>
    </div>
  `;
};
