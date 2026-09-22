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

import { oneEvent } from '@open-wc/testing';

const pointer = ( type, init = {} ) =>
  new PointerEvent( type, { pointerId: 1, bubbles: true, composed: true, ...init } );

describe( 'granite-launchpad-pad interaction', () => {
  it( 'emits pad-press on pointerdown, carrying its coordinates and colour', async () => {
    const el = await fixture( html`<granite-launchpad-pad .x=${ 3 } .y=${ 5 } color="amber low"></granite-launchpad-pad>` );
    setTimeout( () => el.dispatchEvent( pointer( 'pointerdown' ) ) );
    const { detail } = await oneEvent( el, 'pad-press' );
    expect( detail ).to.deep.equal( { x: 3, y: 5, color: 'amber low' } );
  } );

  it( 'emits pad-release on pointerup', async () => {
    const el = await fixture( html`<granite-launchpad-pad .x=${ 1 } .y=${ 2 }></granite-launchpad-pad>` );
    el.dispatchEvent( pointer( 'pointerdown' ) );
    setTimeout( () => el.dispatchEvent( pointer( 'pointerup' ) ) );
    const { detail } = await oneEvent( el, 'pad-release' );
    expect( detail ).to.deep.equal( { x: 1, y: 2, color: 'off' } );
  } );

  it( 'escapes the shadow root, so a host can hear it', async () => {
    const wrapper = await fixture( html`<div><granite-launchpad-pad .x=${ 0 } .y=${ 0 }></granite-launchpad-pad></div>` );
    const el = wrapper.firstElementChild;
    setTimeout( () => el.dispatchEvent( pointer( 'pointerdown' ) ) );
    const event = await oneEvent( wrapper, 'pad-press' );
    expect( event.composed ).to.be.true;
    expect( event.bubbles ).to.be.true;
  } );

  it( 'releases on pointercancel, so a press is never left stuck', async () => {
    const el = await fixture( html`<granite-launchpad-pad></granite-launchpad-pad>` );
    el.dispatchEvent( pointer( 'pointerdown' ) );
    setTimeout( () => el.dispatchEvent( pointer( 'pointercancel' ) ) );
    await oneEvent( el, 'pad-release' );
  } );

  it( 'clears a held press when detached, so a reattached pad starts clean', async () => {
    const el = await fixture( html`<granite-launchpad-pad></granite-launchpad-pad>` );
    const parent = el.parentNode;
    el.dispatchEvent( pointer( 'pointerdown' ) );
    parent.removeChild( el );
    parent.appendChild( el );
    let released = 0;
    el.addEventListener( 'pad-release', () => { released += 1; } );
    el.dispatchEvent( pointer( 'pointerup' ) );
    expect( released ).to.equal( 0 );
  } );

  it( 'ignores a pointerup it never saw a pointerdown for', async () => {
    const el = await fixture( html`<granite-launchpad-pad></granite-launchpad-pad>` );
    let released = 0;
    el.addEventListener( 'pad-release', () => { released += 1; } );
    el.dispatchEvent( pointer( 'pointerup' ) );
    el.dispatchEvent( pointer( 'pointerup' ) );
    expect( released ).to.equal( 0 );
  } );

  it( 'does not repeat a press while the pointer is held', async () => {
    const el = await fixture( html`<granite-launchpad-pad></granite-launchpad-pad>` );
    let pressed = 0;
    el.addEventListener( 'pad-press', () => { pressed += 1; } );
    el.dispatchEvent( pointer( 'pointerdown' ) );
    el.dispatchEvent( pointer( 'pointerdown' ) );
    expect( pressed ).to.equal( 1 );
  } );

  it( 'plays from the keyboard', async () => {
    for ( const key of [ ' ', 'Enter' ] ) {
      const el = await fixture( html`<granite-launchpad-pad .x=${ 4 } .y=${ 4 }></granite-launchpad-pad>` );
      setTimeout( () => el.dispatchEvent( new KeyboardEvent( 'keydown', { key, bubbles: true } ) ) );
      await oneEvent( el, 'pad-press' );
      setTimeout( () => el.dispatchEvent( new KeyboardEvent( 'keyup', { key, bubbles: true } ) ) );
      await oneEvent( el, 'pad-release' );
    }
  } );

  it( 'ignores an auto-repeating key', async () => {
    const el = await fixture( html`<granite-launchpad-pad></granite-launchpad-pad>` );
    let pressed = 0;
    el.addEventListener( 'pad-press', () => { pressed += 1; } );
    el.dispatchEvent( new KeyboardEvent( 'keydown', { key: ' ', bubbles: true } ) );
    el.dispatchEvent( new KeyboardEvent( 'keydown', { key: ' ', repeat: true, bubbles: true } ) );
    expect( pressed ).to.equal( 1 );
  } );

  it( 'releases when focus leaves while held', async () => {
    const el = await fixture( html`<granite-launchpad-pad></granite-launchpad-pad>` );
    el.dispatchEvent( new KeyboardEvent( 'keydown', { key: ' ', bubbles: true } ) );
    setTimeout( () => el.dispatchEvent( new FocusEvent( 'blur' ) ) );
    await oneEvent( el, 'pad-release' );
  } );

  it( 'emits nothing at all when disabled', async () => {
    const el = await fixture( html`<granite-launchpad-pad disabled></granite-launchpad-pad>` );
    let events = 0;
    el.addEventListener( 'pad-press', () => { events += 1; } );
    el.addEventListener( 'pad-release', () => { events += 1; } );
    el.dispatchEvent( pointer( 'pointerdown' ) );
    el.dispatchEvent( pointer( 'pointerup' ) );
    el.dispatchEvent( new KeyboardEvent( 'keydown', { key: ' ', bubbles: true } ) );
    expect( events ).to.equal( 0 );
  } );
} );

describe( 'granite-launchpad-pad accessibility', () => {
  it( 'is a focusable button', async () => {
    const el = await fixture( html`<granite-launchpad-pad></granite-launchpad-pad>` );
    expect( el.getAttribute( 'role' ) ).to.equal( 'button' );
    expect( el.getAttribute( 'tabindex' ) ).to.equal( '0' );
  } );

  it( 'leaves the tab order and says so when disabled', async () => {
    const el = await fixture( html`<granite-launchpad-pad disabled></granite-launchpad-pad>` );
    await elementUpdated( el );
    expect( el.getAttribute( 'tabindex' ) ).to.equal( '-1' );
    expect( el.getAttribute( 'aria-disabled' ) ).to.equal( 'true' );
  } );

  it( 'names itself by position', async () => {
    const grid = await fixture( html`<granite-launchpad-pad .x=${ 3 } .y=${ 5 }></granite-launchpad-pad>` );
    await elementUpdated( grid );
    expect( grid.getAttribute( 'aria-label' ) ).to.equal( 'Pad 3,5' );

    const automap = await fixture( html`<granite-launchpad-pad .x=${ 3 } .y=${ 8 }></granite-launchpad-pad>` );
    await elementUpdated( automap );
    expect( automap.getAttribute( 'aria-label' ) ).to.equal( 'Automap 3' );

    const scene = await fixture( html`<granite-launchpad-pad .x=${ 8 } .y=${ 5 }></granite-launchpad-pad>` );
    await elementUpdated( scene );
    expect( scene.getAttribute( 'aria-label' ) ).to.equal( 'Scene 5' );
  } );

  it( 'takes an explicit label over the computed one', async () => {
    const el = await fixture( html`<granite-launchpad-pad .x=${ 0 } .y=${ 0 } label="Kick"></granite-launchpad-pad>` );
    await elementUpdated( el );
    expect( el.getAttribute( 'aria-label' ) ).to.equal( 'Kick' );
  } );
} );
