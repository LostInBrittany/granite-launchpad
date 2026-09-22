import { expect, fixture, html, elementUpdated, oneEvent } from '@open-wc/testing';
import '../src/granite-launchpad-board.js';

const board = () => fixture( html`<granite-launchpad-board></granite-launchpad-board>` );

describe( 'granite-launchpad-board layout', () => {
  it( 'renders eighty pads - nine by nine less the dead corner', async () => {
    const el = await board();
    expect( el.renderRoot.querySelectorAll( 'granite-launchpad-pad' ).length ).to.equal( 80 );
  } );

  it( 'has no pad at the corner', async () => {
    const el = await board();
    expect( el.padAt( 8, 8 ) ).to.be.undefined;
  } );

  it( 'places every coordinate exactly once', async () => {
    const el = await board();
    for ( let y = 0; y <= 8; y += 1 ) {
      for ( let x = 0; x <= 8; x += 1 ) {
        if ( x === 8 && y === 8 ) continue;
        expect( el.padAt( x, y ), `${ x },${ y }` ).to.exist;
      }
    }
  } );

  it( 'rounds the Automap row and the Scene column only', async () => {
    const el = await board();
    expect( el.padAt( 3, 8 ).round ).to.be.true;
    expect( el.padAt( 8, 3 ).round ).to.be.true;
    expect( el.padAt( 3, 3 ).round ).to.be.false;
  } );

  it( 'draws the Automap row above the grid and Scene to its right', async () => {
    const el = await board();
    const topLeft = el.padAt( 0, 8 ).getBoundingClientRect();
    const gridTopLeft = el.padAt( 0, 0 ).getBoundingClientRect();
    const sceneTop = el.padAt( 8, 0 ).getBoundingClientRect();
    expect( topLeft.top ).to.be.below( gridTopLeft.top );
    expect( sceneTop.left ).to.be.above( gridTopLeft.left );
  } );
} );

describe( 'granite-launchpad-board colours', () => {
  it( 'starts entirely off', async () => {
    const el = await board();
    expect( el.getColor( 0, 0 ) ).to.equal( 'off' );
    expect( el.getColor( 8, 0 ) ).to.equal( 'off' );
    expect( el.getColor( 0, 8 ) ).to.equal( 'off' );
  } );

  it( 'round-trips a colour', async () => {
    const el = await board();
    el.setColor( 3, 5, 'amber medium' );
    expect( el.getColor( 3, 5 ) ).to.equal( 'amber medium' );
  } );

  it( 'canonicalises on the way in', async () => {
    const el = await board();
    el.setColor( 0, 0, 'red full' );
    expect( el.getColor( 0, 0 ) ).to.equal( 'red' );
  } );

  it( 'paints the pad it names', async () => {
    const el = await board();
    el.setColor( 3, 5, 'green low' );
    await elementUpdated( el );
    expect( el.padAt( 3, 5 ).color ).to.equal( 'green low' );
    expect( el.padAt( 5, 3 ).color ).to.equal( 'off' );
  } );

  it( 'reaches the Automap row and the Scene column', async () => {
    const el = await board();
    el.setColor( 2, 8, 'red' );
    el.setColor( 8, 2, 'green' );
    await elementUpdated( el );
    expect( el.padAt( 2, 8 ).color ).to.equal( 'red' );
    expect( el.padAt( 8, 2 ).color ).to.equal( 'green' );
  } );

  it( 'applies a batch in the shape launchpad-webmidi uses', async () => {
    const el = await board();
    el.setColors( [ [ 0, 0, 'red' ], [ 1, 1, 'green low' ], [ 8, 8, 'red' ] ] );
    await elementUpdated( el );
    expect( el.getColor( 0, 0 ) ).to.equal( 'red' );
    expect( el.getColor( 1, 1 ) ).to.equal( 'green low' );
  } );

  it( 'clears', async () => {
    const el = await board();
    el.setColors( [ [ 0, 0, 'red' ], [ 4, 4, 'green' ] ] );
    el.reset();
    await elementUpdated( el );
    expect( el.getColor( 0, 0 ) ).to.equal( 'off' );
    expect( el.padAt( 4, 4 ).color ).to.equal( 'off' );
  } );

  it( 'ignores coordinates that are not on the board', async () => {
    const el = await board();
    for ( const [ x, y ] of [ [ -1, 0 ], [ 0, -1 ], [ 9, 0 ], [ 0, 9 ], [ 8, 8 ] ] ) {
      expect( () => el.setColor( x, y, 'red' ), `${ x },${ y }` ).to.not.throw();
      expect( el.getColor( x, y ), `${ x },${ y }` ).to.be.undefined;
    }
  } );
} );

describe( 'granite-launchpad-board events', () => {
  it( 'lets a pad press through with its coordinates', async () => {
    const el = await board();
    el.setColor( 3, 5, 'red' );
    await elementUpdated( el );
    const pad = el.padAt( 3, 5 );
    setTimeout( () => pad.dispatchEvent(
      new PointerEvent( 'pointerdown', { pointerId: 1, bubbles: true, composed: true } ) ) );
    const { detail } = await oneEvent( el, 'pad-press' );
    expect( detail ).to.deep.equal( { x: 3, y: 5, color: 'red' } );
  } );

  it( 'delivers each press once, not twice', async () => {
    const el = await board();
    await elementUpdated( el );
    let count = 0;
    el.addEventListener( 'pad-press', () => { count += 1; } );
    el.padAt( 0, 0 ).dispatchEvent(
      new PointerEvent( 'pointerdown', { pointerId: 1, bubbles: true, composed: true } ) );
    expect( count ).to.equal( 1 );
  } );
} );
