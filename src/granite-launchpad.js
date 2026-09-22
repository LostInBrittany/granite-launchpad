import { LitElement, css, html } from 'lit';
import Launchpad from 'launchpad-webmidi';
import { parseColor } from './lib/colors.js';
import './granite-launchpad-board.js';

/**
 * A board mirrored against a real Launchpad.
 *
 * The hardware reports presses, never colours, and a press changes no colour on
 * either side - lighting a pad in response is the application's job. So colour
 * only ever travels outward from a method call here, and no mirrored event can
 * feed back on itself.
 *
 * @element granite-launchpad
 * @fires launchpad-connect
 * @fires launchpad-disconnect
 * @fires launchpad-error
 * @fires pad-press - From the board, or raised here for a hardware press
 * @fires pad-release
 */
export class GraniteLaunchpad extends LitElement {
  static properties = {
    autoConnect: { type: Boolean, attribute: 'auto-connect' },
    launchpad: { type: Object },
    state: { type: String, reflect: true },
    error: { type: Object },
    debug: { type: Boolean },
  };

  static styles = css`
    :host {
      display: inline-block;
    }
  `;

  #listening = false;

  constructor() {
    super();
    this.autoConnect = false;
    this.launchpad = null;
    this.state = 'idle';
    this.error = null;
    this.debug = false;
  }

  /**
   * The board being mirrored: the first slotted one, or the fallback rendered
   * inside the slot when nothing is slotted.
   *
   * @return {import('./granite-launchpad-board.js').GraniteLaunchpadBoard|undefined}
   */
  get board() {
    const slot = this.renderRoot?.querySelector( 'slot' );
    const slotted = slot
      ?.assignedElements( { flatten: true } )
      .find( ( el ) => el.localName === 'granite-launchpad-board' );
    return slotted ?? this.renderRoot?.querySelector( 'granite-launchpad-board' ) ?? undefined;
  }

  render() {
    return html`
      <slot>
        <granite-launchpad-board ?debug=${ this.debug }></granite-launchpad-board>
      </slot>
    `;
  }

  firstUpdated() {
    if ( !this.autoConnect ) {
      return;
    }
    // connect() sets `state`, which is reactive. Setting it from inside
    // firstUpdated schedules a second update from within the first, and Lit
    // warns about that in dev builds (lit.dev/msg/change-in-update) - a
    // warning every consumer of this component would see in their console.
    // Waiting for the current update to finish costs nothing: a real
    // connect() is a Web MIDI permission request, orders of magnitude longer
    // than an update cycle.
    this.updateComplete.then( () => this.connect() );
  }

  /**
   * Connect to the hardware. Resolves false rather than rejecting, so a page
   * without Web MIDI, without a board or without permission is a state to
   * render rather than an unhandled rejection.
   *
   * @return {Promise<Boolean>}
   */
  async connect() {
    this.state = 'connecting';
    this.error = null;

    if ( !this.launchpad ) {
      this.launchpad = new Launchpad();
    }

    try {
      await this.launchpad.connect();
    } catch ( error ) {
      this.state = 'error';
      this.error = error;
      if ( this.debug ) {
        console.warn( '[granite-launchpad] could not connect:', error );
      }
      this.#fire( 'launchpad-error', { error } );
      return false;
    }

    if ( !this.#listening ) {
      this.launchpad.on( 'key', this.#onKey );
      this.#listening = true;
    }
    this.state = 'connected';
    this.#fire( 'launchpad-connect', { launchpad: this.launchpad } );
    return true;
  }

  /**
   * Stop mirroring. launchpad-webmidi's Observable has on() and emit() but no
   * off(), so the handler cannot be removed - it is guarded on state instead.
   */
  disconnect() {
    this.state = 'idle';
    this.#fire( 'launchpad-disconnect', {} );
  }

  /**
   * @param {Number} x
   * @param {Number} y
   * @param {String} color
   */
  setColor( x, y, color ) {
    const board = this.board;
    if ( !board ) {
      if ( this.debug ) {
        console.warn( '[granite-launchpad] no board to paint' );
      }
      return;
    }
    // The board warns for itself when debug is set, so this does not repeat it.
    if ( board.getColor( x, y ) === undefined ) {
      return;
    }
    board.setColor( x, y, color );
    this.#send( x, y, color );
  }

  /** @param {Array<[Number, Number, String]>} entries */
  setColors( entries ) {
    for ( const [ x, y, color ] of entries ) {
      this.setColor( x, y, color );
    }
  }

  /**
   * @param {Number} x
   * @param {Number} y
   * @return {String|undefined}
   */
  getColor( x, y ) {
    return this.board?.getColor( x, y );
  }

  /** Turn every pad off, on screen and on the hardware. */
  reset() {
    for ( let y = 0; y <= 8; y += 1 ) {
      for ( let x = 0; x <= 8; x += 1 ) {
        if ( x === 8 && y === 8 ) {
          continue;
        }
        this.setColor( x, y, 'off' );
      }
    }
  }

  #send( x, y, color ) {
    if ( this.state !== 'connected' || !this.launchpad ) {
      return;
    }
    const { hue, level } = parseColor( color, { debug: this.debug } );
    const value = hue === 'off' ? this.launchpad.off : this.launchpad[ hue ].level( level );
    this.launchpad.col( value, [ x, y ] );
  }

  #onKey = ( key ) => {
    if ( this.state !== 'connected' ) {
      return;
    }
    this.#fire( key.pressed ? 'pad-press' : 'pad-release', {
      x: key.x,
      y: key.y,
      color: this.getColor( key.x, key.y ) ?? 'off',
    } );
  };

  #fire( type, detail ) {
    this.dispatchEvent( new CustomEvent( type, { bubbles: true, composed: true, detail } ) );
  }
}

if ( !customElements.get( 'granite-launchpad' ) ) {
  customElements.define( 'granite-launchpad', GraniteLaunchpad );
}
