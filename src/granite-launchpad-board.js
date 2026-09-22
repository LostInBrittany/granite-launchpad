import { LitElement, css, html } from 'lit';
import { normalizeColor } from './lib/colors.js';
import './granite-launchpad-pad.js';

/**
 * The cells of the board in render order: the Automap row, the empty corner,
 * then each of the eight rows followed by its Scene button. `null` is the
 * corner, which has no pad.
 *
 * @type {Array<[Number, Number]|null>}
 */
const CELLS = ( () => {
  const cells = [];
  for ( let x = 0; x < 8; x += 1 ) {
    cells.push( [ x, 8 ] );
  }
  cells.push( null );
  for ( let y = 0; y < 8; y += 1 ) {
    for ( let x = 0; x < 8; x += 1 ) {
      cells.push( [ x, y ] );
    }
    cells.push( [ 8, y ] );
  }
  return cells;
} )();

const index = ( x, y ) => y * 9 + x;

const onBoard = ( x, y ) =>
  Number.isInteger( x ) && Number.isInteger( y ) &&
  x >= 0 && x <= 8 && y >= 0 && y <= 8 &&
  !( x === 8 && y === 8 );

/**
 * A Launchpad Mini board: eight by eight pads, the Automap row above and the
 * Scene column to the right.
 *
 * @element granite-launchpad-board
 * @fires pad-press - Retargeted from the pad, never re-dispatched
 * @fires pad-release
 * @cssprop --granite-launchpad-pad-size
 * @cssprop --granite-launchpad-gap - Space between pads, default 0.3rem
 */
export class GraniteLaunchpadBoard extends LitElement {
  static properties = {
    debug: { type: Boolean },
  };

  static styles = css`
    :host {
      display: inline-block;
    }

    #grid {
      display: grid;
      grid-template-columns: repeat(9, auto);
      grid-template-rows: repeat(9, auto);
      gap: var(--granite-launchpad-gap, 0.3rem);
    }

    .corner {
      /* The Launchpad has no button here. */
      visibility: hidden;
    }
  `;

  /** @type {String[]} Canonical colours, indexed y * 9 + x. */
  #colors = new Array( 81 ).fill( 'off' );

  constructor() {
    super();
    this.debug = false;
  }

  render() {
    return html`
      <div id="grid">
        ${ CELLS.map( ( cell ) => cell === null
          ? html`<div class="corner"></div>`
          : html`<granite-launchpad-pad
              data-xy=${ `${ cell[ 0 ] },${ cell[ 1 ] }` }
              .x=${ cell[ 0 ] }
              .y=${ cell[ 1 ] }
              color=${ this.#colors[ index( cell[ 0 ], cell[ 1 ] ) ] }
              ?round=${ cell[ 0 ] === 8 || cell[ 1 ] === 8 }
              ?debug=${ this.debug }
            ></granite-launchpad-pad>` ) }
      </div>
    `;
  }

  #warnOffBoard( x, y ) {
    if ( this.debug ) {
      console.warn( `[granite-launchpad-board] no pad at ${ x },${ y }` );
    }
  }

  /**
   * @param {Number} x Column, 0-8, where 8 is the Scene column
   * @param {Number} y Row, 0-8, where 8 is the Automap row
   * @param {String} color Any colour string
   */
  setColor( x, y, color ) {
    if ( !onBoard( x, y ) ) {
      this.#warnOffBoard( x, y );
      return;
    }
    this.#colors[ index( x, y ) ] = normalizeColor( color, { debug: this.debug } );
    this.requestUpdate();
  }

  /**
   * @param {Array<[Number, Number, String]>} entries The shape
   *   launchpad-webmidi's setColors() takes
   */
  setColors( entries ) {
    for ( const [ x, y, color ] of entries ) {
      this.setColor( x, y, color );
    }
  }

  /**
   * @param {Number} x
   * @param {Number} y
   * @return {String|undefined} The canonical colour, or undefined off the board
   */
  getColor( x, y ) {
    if ( !onBoard( x, y ) ) {
      this.#warnOffBoard( x, y );
      return undefined;
    }
    return this.#colors[ index( x, y ) ];
  }

  /** Turn every pad off. */
  reset() {
    this.#colors.fill( 'off' );
    this.requestUpdate();
  }

  /**
   * @param {Number} x
   * @param {Number} y
   * @return {import('./granite-launchpad-pad.js').GraniteLaunchpadPad|undefined}
   */
  padAt( x, y ) {
    if ( !onBoard( x, y ) ) {
      return undefined;
    }
    return this.renderRoot?.querySelector( `granite-launchpad-pad[data-xy="${ x },${ y }"]` ) ?? undefined;
  }
}

if ( !customElements.get( 'granite-launchpad-board' ) ) {
  customElements.define( 'granite-launchpad-board', GraniteLaunchpadBoard );
}
