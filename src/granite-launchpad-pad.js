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
    /* Every colour default lives in its var() fallback, never as a
       declaration on :host. A declaration on the host sits on the pad itself
       and beats anything inherited into it, so tokens set on a wrapping board,
       twin or body would be silently ignored - the tokens would be themeable
       only by a rule matching granite-launchpad-pad. With the default in the
       fallback there is nothing to beat and the token inherits normally.
       Yellow has no low or medium: parseColor clamps it to full. */
    :host {
      display: block;
      box-sizing: border-box;
      width: var(--granite-launchpad-pad-size, 2.5rem);
      height: var(--granite-launchpad-pad-size, 2.5rem);
      border-radius: 0.2rem;
      background: var(--granite-launchpad-off, #2b2b2f);
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

    :host([color='red']) { background: var(--granite-launchpad-red-full, #ff3b2f); box-shadow: var(--granite-launchpad-glow, none); }
    :host([color='red medium']) { background: var(--granite-launchpad-red-medium, #9c2a22); }
    :host([color='red low']) { background: var(--granite-launchpad-red-low, #4a1512); }
    :host([color='green']) { background: var(--granite-launchpad-green-full, #35d94f); box-shadow: var(--granite-launchpad-glow, none); }
    :host([color='green medium']) { background: var(--granite-launchpad-green-medium, #227a33); }
    :host([color='green low']) { background: var(--granite-launchpad-green-low, #123f1c); }
    :host([color='amber']) { background: var(--granite-launchpad-amber-full, #ffae2f); box-shadow: var(--granite-launchpad-glow, none); }
    :host([color='amber medium']) { background: var(--granite-launchpad-amber-medium, #9c6c1e); }
    :host([color='amber low']) { background: var(--granite-launchpad-amber-low, #4a3410); }
    :host([color='yellow']) { background: var(--granite-launchpad-yellow-full, #ffe94f); box-shadow: var(--granite-launchpad-glow, none); }
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

  #pressed = false;

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener( 'pointerdown', this.#onPointerDown );
    this.addEventListener( 'pointerup', this.#onPointerUp );
    this.addEventListener( 'pointercancel', this.#onPointerUp );
    this.addEventListener( 'keydown', this.#onKeyDown );
    this.addEventListener( 'keyup', this.#onKeyUp );
    this.addEventListener( 'blur', this.#onBlur );
  }

  disconnectedCallback() {
    // A detached pad cannot receive the pointerup or keyup that would release
    // it, so clear the flag here. Otherwise the same element instance,
    // reattached, would emit a pad-release with no matching pad-press and
    // swallow the pointerdown that should have started the next press.
    this.#pressed = false;
    this.removeEventListener( 'pointerdown', this.#onPointerDown );
    this.removeEventListener( 'pointerup', this.#onPointerUp );
    this.removeEventListener( 'pointercancel', this.#onPointerUp );
    this.removeEventListener( 'keydown', this.#onKeyDown );
    this.removeEventListener( 'keyup', this.#onKeyUp );
    this.removeEventListener( 'blur', this.#onBlur );
    super.disconnectedCallback();
  }

  willUpdate() {
    // Not `reflect: true`: Lit suppresses reflection while it handles an
    // attribute-to-property change, so a canonicalising property would leave
    // the attribute holding the uncanonicalised string the CSS cannot match.
    if ( this.getAttribute( 'color' ) !== this.#color ) {
      this.setAttribute( 'color', this.#color );
    }
    this.setAttribute( 'role', 'button' );
    this.setAttribute( 'tabindex', this.disabled ? '-1' : '0' );
    this.setAttribute( 'aria-label', this.label ?? this.#positionLabel() );
    if ( this.disabled ) {
      this.setAttribute( 'aria-disabled', 'true' );
    } else {
      this.removeAttribute( 'aria-disabled' );
    }
  }

  #positionLabel() {
    if ( this.x === undefined || this.y === undefined ) {
      return 'Pad';
    }
    if ( this.y === 8 ) {
      return `Automap ${ this.x }`;
    }
    if ( this.x === 8 ) {
      return `Scene ${ this.y }`;
    }
    return `Pad ${ this.x },${ this.y }`;
  }

  #press() {
    if ( this.disabled || this.#pressed ) {
      return;
    }
    this.#pressed = true;
    this.#emit( 'pad-press' );
  }

  #release() {
    if ( !this.#pressed ) {
      return;
    }
    this.#pressed = false;
    this.#emit( 'pad-release' );
  }

  #emit( type ) {
    this.dispatchEvent( new CustomEvent( type, {
      bubbles: true,
      composed: true,
      detail: { x: this.x, y: this.y, color: this.color },
    } ) );
  }

  #onPointerDown = ( event ) => {
    if ( this.disabled ) {
      return;
    }
    // Capture so a pointer released outside this pad still releases it. The
    // 2018 element watched mouseout instead, which missed touch entirely.
    try {
      this.setPointerCapture( event.pointerId );
    } catch {
      // A synthetic PointerEvent has no real pointer to capture.
    }
    this.#press();
  };

  #onPointerUp = ( event ) => {
    if ( this.hasPointerCapture?.( event.pointerId ) ) {
      this.releasePointerCapture( event.pointerId );
    }
    this.#release();
  };

  #onKeyDown = ( event ) => {
    if ( event.key !== ' ' && event.key !== 'Enter' ) {
      return;
    }
    event.preventDefault();
    if ( event.repeat ) {
      return;
    }
    this.#press();
  };

  #onKeyUp = ( event ) => {
    if ( event.key !== ' ' && event.key !== 'Enter' ) {
      return;
    }
    this.#release();
  };

  #onBlur = () => this.#release();

  render() {
    return html``;
  }
}

if ( !customElements.get( 'granite-launchpad-pad' ) ) {
  customElements.define( 'granite-launchpad-pad', GraniteLaunchpadPad );
}
