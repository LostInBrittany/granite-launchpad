import { expect } from '@open-wc/testing';
import { parseColor, formatColor, normalizeColor, HUES, LEVELS } from '../src/lib/colors.js';

describe( 'parseColor', () => {
  it( 'reads off', () => {
    expect( parseColor( 'off' ) ).to.deep.equal( { hue: 'off', level: 0 } );
  } );

  it( 'reads a bare hue as full brightness', () => {
    for ( const hue of HUES ) {
      expect( parseColor( hue ) ).to.deep.equal( { hue, level: 3 } );
    }
  } );

  it( 'reads a named level', () => {
    expect( parseColor( 'amber medium' ) ).to.deep.equal( { hue: 'amber', level: 2 } );
    expect( parseColor( 'green low' ) ).to.deep.equal( { hue: 'green', level: 1 } );
    expect( parseColor( 'red full' ) ).to.deep.equal( { hue: 'red', level: 3 } );
  } );

  it( 'reads a numeric level', () => {
    expect( parseColor( 'amber 2' ) ).to.deep.equal( { hue: 'amber', level: 2 } );
  } );

  it( 'normalises any level 0 to off', () => {
    expect( parseColor( 'red off' ) ).to.deep.equal( { hue: 'off', level: 0 } );
    expect( parseColor( 'red 0' ) ).to.deep.equal( { hue: 'off', level: 0 } );
  } );

  it( 'clamps yellow to full, which is all the hardware has', () => {
    expect( parseColor( 'yellow low' ) ).to.deep.equal( { hue: 'yellow', level: 3 } );
    expect( parseColor( 'yellow 2' ) ).to.deep.equal( { hue: 'yellow', level: 3 } );
  } );

  it( 'still turns yellow off', () => {
    expect( parseColor( 'yellow off' ) ).to.deep.equal( { hue: 'off', level: 0 } );
  } );

  it( 'tolerates case and surrounding whitespace', () => {
    expect( parseColor( '  RED   Low ' ) ).to.deep.equal( { hue: 'red', level: 1 } );
  } );

  it( 'falls back to off for anything it does not understand', () => {
    for ( const bad of [ 'purple', 'red brighter', 'red 9', '', '   ', 'red low full', null, undefined, 42, {} ] ) {
      expect( parseColor( bad ), String( bad ) ).to.deep.equal( { hue: 'off', level: 0 } );
    }
  } );
} );

describe( 'formatColor', () => {
  it( 'writes full brightness as the bare hue', () => {
    expect( formatColor( { hue: 'red', level: 3 } ) ).to.equal( 'red' );
  } );

  it( 'writes the other levels by name', () => {
    expect( formatColor( { hue: 'amber', level: 2 } ) ).to.equal( 'amber medium' );
    expect( formatColor( { hue: 'green', level: 1 } ) ).to.equal( 'green low' );
  } );

  it( 'writes off as off', () => {
    expect( formatColor( { hue: 'off', level: 0 } ) ).to.equal( 'off' );
  } );

  it( 'round-trips every canonical string', () => {
    const canonical = [ 'off' ];
    for ( const hue of HUES ) {
      canonical.push( hue, `${ hue } medium`, `${ hue } low` );
    }
    for ( const value of canonical ) {
      expect( normalizeColor( value ), value ).to.equal( normalizeColor( normalizeColor( value ) ) );
    }
  } );
} );

describe( 'LEVELS', () => {
  it( 'names the four hardware brightness levels', () => {
    expect( LEVELS ).to.deep.equal( { off: 0, low: 1, medium: 2, full: 3 } );
  } );
} );
