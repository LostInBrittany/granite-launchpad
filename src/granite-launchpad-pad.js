import { LitElement, css, html } from 'lit';
import { parseColor, formatColor } from './lib/colors.js';

/**
 * A single Launchpad pad.
 *
 * @element granite-launchpad-pad
 * @fires pad-press
 * @fires pad-release
 * @cssprop --granite-launchpad-pad-size - Side of the pad, default 2.5rem
 * @cssprop --granite-launchpad-off - Colour of an unlit pad
 * @cssprop --granite-launchpad-red-full - and -medium, -low, and the same for
 *   green, amber and yellow
 * @cssprop --granite-launchpad-glow - Bloom applied at full brightness, unset
 *   by default
 */
export class GraniteLaunchpadPad extends LitElement {
  static properties = {
    color: { type: String },
    x: { type: Number },
    y: { type: Number },
    round: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    debug: { type: Boolean },
    label: { type: String },
  };

  static styles = css`
    :host {
      --granite-launchpad-off: #2b2b2f;
      --granite-launchpad-red-low: #4a1512;
      --granite-launchpad-red-medium: #9c2a22;
      --granite-launchpad-red-full: #ff3b2f;
      --granite-launchpad-green-low: #123f1c;
      --granite-launchpad-green-medium: #227a33;
      --granite-launchpad-green-full: #35d94f;
      --granite-launchpad-amber-low: #4a3410;
      --granite-launchpad-amber-medium: #9c6c1e;
      --granite-launchpad-amber-full: #ffae2f;
      /* Yellow has no low or medium: parseColor clamps it to full, so a
         token for either would be dead. */
      --granite-launchpad-yellow-full: #ffe94f;

      display: block;
      box-sizing: border-box;
      width: var(--granite-launchpad-pad-size, 2.5rem);
      height: var(--granite-launchpad-pad-size, 2.5rem);
      border-radius: 0.2rem;
      background: var(--granite-launchpad-off);
      /* Without this the browser claims the gesture for scrolling and the
         pointerup never arrives. */
      touch-action: none;
      cursor: pointer;
      transition: background 60ms linear;
    }

    :host([round]) {
      border-radius: 50%;
    }

    :host([disabled]) {
      cursor: default;
      opacity: 0.4;
    }

    :host(:focus-visible) {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }

    :host([color='red']) { background: var(--granite-launchpad-red-full); box-shadow: var(--granite-launchpad-glow, none); }
    :host([color='red medium']) { background: var(--granite-launchpad-red-medium); }
    :host([color='red low']) { background: var(--granite-launchpad-red-low); }
    :host([color='green']) { background: var(--granite-launchpad-green-full); box-shadow: var(--granite-launchpad-glow, none); }
    :host([color='green medium']) { background: var(--granite-launchpad-green-medium); }
    :host([color='green low']) { background: var(--granite-launchpad-green-low); }
    :host([color='amber']) { background: var(--granite-launchpad-amber-full); box-shadow: var(--granite-launchpad-glow, none); }
    :host([color='amber medium']) { background: var(--granite-launchpad-amber-medium); }
    :host([color='amber low']) { background: var(--granite-launchpad-amber-low); }
    :host([color='yellow']) { background: var(--granite-launchpad-yellow-full); box-shadow: var(--granite-launchpad-glow, none); }
  `;

  #color = 'off';

  constructor() {
    super();
    this.round = false;
    this.disabled = false;
    this.debug = false;
    this.color = 'off';
  }

  /** @param {String} value Any colour string; stored in canonical form. */
  set color( value ) {
    const previous = this.#color;
    this.#color = formatColor( parseColor( value, { debug: this.debug } ) );
    this.requestUpdate( 'color', previous );
  }

  get color() {
    return this.#color;
  }

  willUpdate() {
    // Not `reflect: true`: Lit suppresses reflection while it handles an
    // attribute-to-property change, so a canonicalising property would leave
    // the attribute holding the uncanonicalised string the CSS cannot match.
    if ( this.getAttribute( 'color' ) !== this.#color ) {
      this.setAttribute( 'color', this.#color );
    }
  }

  render() {
    return html``;
  }
}

if ( !customElements.get( 'granite-launchpad-pad' ) ) {
  customElements.define( 'granite-launchpad-pad', GraniteLaunchpadPad );
}
