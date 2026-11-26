import { PrismMessageBox } from './message-box.js';

if (!customElements.get('prism-message-box'))
  customElements.define('prism-message-box', PrismMessageBox);

declare global {
  interface HTMLElementTagNameMap {
    'prism-message-box': PrismMessageBox;
  }
}
