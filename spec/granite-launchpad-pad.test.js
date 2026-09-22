import { expect, fixture, html, elementUpdated } from '@open-wc/testing';
import { HUES } from '../src/lib/colors.js';
import '../src/granite-launchpad-pad.js';

const cssColor = ( el ) => getComputedStyle( el ).backgroundColor;

describe( 'granite-launchpad-pad rendering', () => {
  it( 'is off by default', async () => {
    const el = await fixture( html`<granite-launchpad-pad></granite-launchpad-pad>` );
    expect( el.color ).to.equal( 'off' );
    expect( el.getAttribute( 'color' ) ).to.equal( 'off' );
  } );

  it( 'canonicalises the colour it is given', async () => {
    const el = await fixture( html`<granite-launchpad-pad color="red full"></granite-launchpad-pad>` );
    await elementUpdated( el );
    expect( el.color ).to.equal( 'red' );
    expect( el.getAttribute( 'color' ) ).to.equal( 'red' );
  } );

  it( 'falls back to off for an unknown colour', async () => {
    const el = await fixture( html`<granite-launchpad-pad color="purple"></granite-launchpad-pad>` );
    await elementUpdated( el );
    expect( el.color ).to.equal( 'off' );
  } );

  it( 'paints a different background for each hue', async () => {
    const seen = new Set();
    for ( const hue of HUES ) {
      const el = await fixture( html`<granite-launchpad-pad color=${ hue }></granite-launchpad-pad>` );
      await elementUpdated( el );
      seen.add( cssColor( el ) );
    }
    expect( seen.size ).to.equal( HUES.length );
  } );

  it( 'paints a different background for each level of a hue', async () => {
    const seen = new Set();
    for ( const value of [ 'red', 'red medium', 'red low', 'off' ] ) {
      const el = await fixture( html`<granite-launchpad-pad color=${ value }></granite-launchpad-pad>` );
      await elementUpdated( el );
      seen.add( cssColor( el ) );
    }
    expect( seen.size ).to.equal( 4 );
  } );

  it( 'honours an overridden colour token', async () => {
    const el = await fixture( html`
      <granite-launchpad-pad color="red" style="--granite-launchpad-red-full: rgb(1, 2, 3)">
      </granite-launchpad-pad>` );
    await elementUpdated( el );
    expect( cssColor( el ) ).to.equal( 'rgb(1, 2, 3)' );
  } );

  it( 'is square and rounds fully when asked', async () => {
    const square = await fixture( html`<granite-launchpad-pad></granite-launchpad-pad>` );
    const round = await fixture( html`<granite-launchpad-pad round></granite-launchpad-pad>` );
    expect( getComputedStyle( square ).borderRadius )
      .to.not.equal( getComputedStyle( round ).borderRadius );
  } );
} );
