import {
  LitElement,
  css,
  html,
  nothing,
  type CSSResultGroup,
  type TemplateResult,
} from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { FormAssociated } from './form-associated.js';
import { stateLayer } from './state-layer.js';
import { uniqueId } from './ids.js';
import { controlBox, controlSize, textRole } from './control-styles.js';
import {
  fieldPartsStyles,
  renderDescription,
  renderError,
  renderLabel,
  syncFieldA11y,
} from './field-parts.js';
import { FieldValidityController } from './field-validity.js';
import { canPolishAnimate } from './choice-motion.js';
import {
  LABEL_TUNE,
  NUDGE_TUNE,
  labelLook,
  nudgeLook,
  type LabelPose,
} from './field-motion.js';
import { SpringMotion } from './spring-motion.js';

type NativeControl = HTMLInputElement | HTMLTextAreaElement;

/**
 * Private base for the text input family (TextInput, PasswordInput,
 * SearchInput, OtpInput, TextArea). Owns form association, value/reset/
 * restore, validity mirroring and the label, description and error parts. Each
 * public component only renders its own control via `renderControl()`; there
 * is no type switch here. Not exported from the package.
 */
export abstract class TextControl extends FormAssociated(LitElement) {
  static override shadowRootOptions: ShadowRootInit = {
    ...LitElement.shadowRootOptions,
    delegatesFocus: true,
  };

  static override styles: CSSResultGroup = [
    controlSize,
    fieldPartsStyles,
    css`
      [part='control'] {
        position: relative;
      }
      [part='input'] {
        display: block;
        inline-size: 100%;
        margin: 0;
        background: none;
        color: inherit;
        ${controlBox}
        ${textRole('body')}
      }
      /* Adornment buttons (password toggle, search clear): >=24px target. */
      .adornment {
        position: absolute;
        inset-block: 0;
        inset-inline-end: calc(var(--prism-space-1, 0.25rem) * 1.5);
        display: grid;
        place-items: center;
        margin-block: auto;
        inline-size: 24px;
        block-size: 24px;
        padding: 0;
        border: 0;
        color: inherit;
        cursor: pointer;
        z-index: 2;
      }
      .adornment[hidden] {
        display: none;
      }
      .adornment:disabled {
        cursor: default;
      }
      :host([data-prism-adorned]) [part='input'] {
        padding-inline-end: calc(
          var(--prism-control-padding-inline, 0.75rem) + 24px
        );
      }
    `,
    css`
      /* Floating label: rests inside the field and floats onto the top edge.
         Only where the component turns it on (data-prism-floating). */
      :host([data-prism-floating]) [part='label'] {
        position: absolute;
        z-index: 3;
        inset-block-start: 0;
        inset-inline-start: calc(
          var(--prism-control-padding-inline, 0.75rem) - var(
              --_prism-label-pad,
              4px
            ) +
            var(--prism-border-width, 1px)
        );
        box-sizing: border-box;
        max-inline-size: calc(
          100% - var(--prism-control-padding-inline, 0.75rem) * 2
        );
        margin: 0;
        padding-inline: var(--_prism-label-pad, 4px);
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        pointer-events: none;
        transform-origin: 0 50%;
        ${textRole('body')}
        line-height: var(--_prism-control-height);
      }
      :host([data-prism-floating]:dir(rtl)) [part='label'] {
        transform-origin: 100% 50%;
      }
      /* The patch hides the border where the label sits on it. */
      :host([data-prism-floating]) [part='label']::before {
        content: '';
        position: absolute;
        z-index: -1;
        inset-inline: 0;
        inset-block-start: calc(50% - 0.625rem);
        block-size: 1.25rem;
        opacity: var(--_prism-patch, 0);
      }
      /* The placeholder would overlap the resting label. */
      :host([data-prism-floating]:not(:state(floated)))
        [part='input']::placeholder {
        opacity: 0;
      }
      @media (prefers-reduced-motion: reduce) {
        :host([data-prism-floating]) [part='label'] {
          transition: none;
        }
      }
    `,
    stateLayer('.adornment'),
  ];

  /** Control height: sm, md or lg. Follows density. */
  @property({ reflect: true }) size: 'sm' | 'md' | 'lg' = 'md';
  /** Visible label text. Required for an accessible name. */
  @property() label = '';
  /** Current value. The `value` attribute sets the initial (and reset) value; it is never reflected back. */
  @property() value = '';
  @property() placeholder = '';
  @property({ type: Boolean, reflect: true }) required = false;
  @property({ type: Boolean, reflect: true }) readonly = false;
  /** Passed through to the native control (omitted when empty). */
  @property() autocomplete = '';
  @property({ type: Number }) minlength?: number;
  @property({ type: Number }) maxlength?: number;
  /**
   * The label rests inside the field and floats onto its top edge on focus or
   * once there is a value. Only the components that support it use it.
   */
  @property({ type: Boolean, reflect: true }) floating = false;

  /** Whether this component can float its label. */
  protected supportsFloating = false;
  /** Keeps the label floated, e.g. when something sits where it would rest. */
  protected labelPinned = false;

  protected readonly validityCtl = new FieldValidityController(this);
  protected readonly fieldId = uniqueId('prism-field');
  #defaultValue = '';
  #focused = false;
  #wasInvalid = false;
  /** Set a frame after the first render: until then, changes are not moves. */
  #painted = false;

  readonly #label = new SpringMotion<'l', 'label' | 'patch'>(
    ['l'],
    {
      label: { el: () => this.#labelEl },
      patch: { el: () => this.#labelEl, pseudo: '::before' },
    },
    (pose) => {
      const { transform, patch } = labelLook(pose);
      return { label: { transform }, patch: { opacity: String(patch) } };
    },
  );
  readonly #nudge = new SpringMotion<'n', 'field'>(
    ['n'],
    { field: { el: () => this.renderRoot?.querySelector('[part="control"]') } },
    (pose) => ({ field: { transform: nudgeLook(pose) } }),
  );

  constructor() {
    super();
    this.addEventListener('focusin', () => this.#trackFocus(true));
    this.addEventListener('focusout', () =>
      queueMicrotask(() => this.#trackFocus(this.matches(':focus-within'))),
    );
  }

  /** Focus only changes what is drawn when the label floats. */
  #trackFocus(focused: boolean): void {
    this.#focused = focused;
    if (this.#isFloating) this.requestUpdate();
  }

  get #labelEl(): HTMLElement | null {
    return this.renderRoot?.querySelector('[part="label"]') ?? null;
  }
  get #isFloating(): boolean {
    return this.floating && this.supportsFloating;
  }
  /** Whether the floating label sits on the edge (focus, a value, or pinned). */
  get #lifted(): boolean {
    return this.#focused || this.value !== '' || this.labelPinned;
  }

  /** Render the native control. It must carry id `${fieldId}-input`. */
  protected abstract renderControl(): TemplateResult;

  /** Message for an empty required field. */
  protected requiredMessage = 'Please fill out this field.';

  /** Component-specific constraint beyond native validity. */
  protected validate(): [ValidityStateFlags, string] | null {
    return null;
  }

  /** Single-line controls submit their form on Enter. */
  protected implicitSubmit = true;

  protected get control(): NativeControl | null {
    return this.renderRoot?.querySelector<NativeControl>(
      `#${this.fieldId}-input`,
    );
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#defaultValue = this.getAttribute('value') ?? '';
  }

  get validity(): ValidityState {
    return this.internals.validity;
  }
  get validationMessage(): string {
    return this.internals.validationMessage;
  }
  checkValidity(): boolean {
    return this.internals.checkValidity();
  }
  reportValidity(): boolean {
    this.validityCtl.touch();
    return this.internals.reportValidity();
  }
  /** Custom error, like the native setCustomValidity(). */
  setCustomValidity(message: string): void {
    this.#custom = message;
    this.requestUpdate();
  }
  #custom = '';

  override focus(options?: FocusOptions): void {
    this.control?.focus(options);
  }
  select(): void {
    this.control?.select();
  }

  formResetCallback(): void {
    this.value = this.#defaultValue;
    this.validityCtl.reset();
  }
  formStateRestoreCallback(state: string | File | FormData | null): void {
    if (typeof state === 'string') this.value = state;
  }

  /** Value submitted with the form (subclasses may normalise). */
  protected formValue(): string {
    return this.value;
  }

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    super.willUpdate(changed);
    this.toggleAttribute('data-prism-floating', this.#isFloating);
    this.setState('floated', this.#isFloating && this.#lifted);
    this.internals.setFormValue(
      this.isDisabled ? null : this.formValue(),
      this.value,
    );
  }

  protected override firstUpdated(changed: Map<PropertyKey, unknown>): void {
    super.firstUpdated(changed);
    this.#nudge.snap({ n: 0 });
    requestAnimationFrame(() => (this.#painted = true));
  }

  protected override updated(changed: Map<PropertyKey, unknown>): void {
    super.updated(changed);
    const el = this.control;
    if (!el) return;
    if (this.#custom) {
      this.internals.setValidity({ customError: true }, this.#custom, el);
    } else if (this.required && !this.isDisabled && this.value === '') {
      this.internals.setValidity(
        { valueMissing: true },
        this.requiredMessage,
        el,
      );
    } else if (this.validate()) {
      const [flags, message] = this.validate()!;
      this.internals.setValidity(flags, message, el);
    } else if (!el.validity.valid) {
      this.internals.setValidity(el.validity, el.validationMessage, el);
    } else {
      this.internals.setValidity({});
    }
    const invalid = this.validityCtl.sync();
    syncFieldA11y(this.renderRoot, el, this.fieldId, invalid, {
      hideDescriptionWhenInvalid: true,
    });
    this.renderRoot
      .querySelector('[part="description"]')
      ?.toggleAttribute('hidden', invalid);
    this.#moveLabel();
    if (invalid && !this.#wasInvalid && canPolishAnimate(this, el))
      this.#nudge.go({ n: 0 }, () => NUDGE_TUNE);
    this.#wasInvalid = invalid;
  }

  /** Floats or rests the label: on springs, from where it is, never on first paint. */
  #moveLabel(): void {
    const el = this.#labelEl;
    if (!this.#isFloating || !el) {
      this.#label.stop();
      return;
    }
    const to: LabelPose = { l: this.#lifted ? 1 : 0 };
    if (!this.#painted || !this.#label.target || !canPolishAnimate(this, el))
      this.#label.snap(to);
    else this.#label.go(to, () => LABEL_TUNE);
  }

  protected onInput = (event: Event): void => {
    this.value = (event.target as NativeControl).value;
  };
  protected onChange = (): void => {
    this.validityCtl.touch();
    this.dispatchEvent(new Event('change', { bubbles: true }));
  };
  protected onBlur = (): void => this.validityCtl.touch();
  /** A shadow input can't reach the outer form: do implicit submission. */
  protected onKeydown = (event: KeyboardEvent): void => {
    if (
      this.implicitSubmit &&
      event.key === 'Enter' &&
      !event.isComposing &&
      this.form
    ) {
      event.preventDefault();
      this.form.requestSubmit();
    }
  };

  /** Shared attributes for the native control. */
  protected get a11yAttrs() {
    return {
      autocomplete: this.autocomplete || nothing,
      minlength: this.minlength ?? nothing,
      maxlength: this.maxlength ?? nothing,
    };
  }

  /** Extra content rendered after the error box (e.g. a counter). */
  protected renderAfter(): TemplateResult | typeof nothing {
    return nothing;
  }

  override render() {
    const id = this.fieldId;
    const label = renderLabel(
      id,
      this.label,
      `${id}-input`,
      this.#isFloating ? this.#labelRest() : undefined,
    );
    return html`
      ${this.#isFloating ? nothing : label}
      <div part="control">
        ${this.renderControl()} ${this.#isFloating ? label : nothing}
      </div>
      ${renderDescription(id)} ${renderError(id)} ${this.renderAfter()}
    `;
  }

  /** The label's inline rest style: the pose it is moving to. */
  #labelRest() {
    const pose: LabelPose = { l: this.#lifted ? 1 : 0 };
    const { transform, patch } = labelLook(pose);
    return styleMap({ transform, '--_prism-patch': String(patch) });
  }
}
