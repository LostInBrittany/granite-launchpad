/** The four hues a Launchpad Mini LED can show. */
export const HUES = [ 'red', 'green', 'amber', 'yellow' ];

/** Brightness level names, matching the Color getters in launchpad-webmidi. */
export const LEVELS = { off: 0, low: 1, medium: 2, full: 3 };

const OFF = { hue: 'off', level: 0 };
const LEVEL_NAMES = [ 'off', 'low', 'medium', 'full' ];

/**
 * Parse a colour string into a hue and a brightness level.
 *
 * Accepts `off`, a bare hue meaning full brightness, or a hue followed by a
 * level as a name or as 0-3. Anything else becomes off.
 *
 * @param {String} value
 * @param {{debug?: Boolean}} [options]
 * @return {{hue: String, level: Number}}
 */
export function parseColor( value, { debug = false } = {} ) {
  const reject = ( why ) => {
    if ( debug ) {
      console.warn( `[granite-launchpad] ${ why }:`, value );
    }
    return { ...OFF };
  };

  if ( typeof value !== 'string' ) {
    return reject( 'colour is not a string' );
  }

  const parts = value.trim().toLowerCase().split( /\s+/ ).filter( Boolean );

  if ( parts.length === 0 || parts.length > 2 ) {
    return reject( 'unrecognised colour' );
  }
  if ( parts[ 0 ] === 'off' && parts.length === 1 ) {
    return { ...OFF };
  }

  const hue = parts[ 0 ];
  if ( !HUES.includes( hue ) ) {
    return reject( 'unknown hue' );
  }

  let level = 3;
  if ( parts.length === 2 ) {
    const token = parts[ 1 ];
    if ( token in LEVELS ) {
      level = LEVELS[ token ];
    } else if ( /^[0-3]$/.test( token ) ) {
      level = Number( token );
    } else {
      return reject( 'unknown brightness level' );
    }
  }

  if ( level === 0 ) {
    return { ...OFF };
  }

  // The hardware cannot dim yellow - see the note on Launchpad#yellow in
  // launchpad-webmidi. Showing a dim yellow on screen would be showing
  // something the board being mirrored cannot do.
  if ( hue === 'yellow' && level !== 3 ) {
    if ( debug ) {
      console.warn( '[granite-launchpad] yellow has only full brightness, clamping:', value );
    }
    level = 3;
  }

  return { hue, level };
}

/**
 * The canonical string for a parsed colour. Full brightness is the bare hue,
 * so every string the 2018 element accepted still means what it meant.
 *
 * @param {{hue: String, level: Number}} color
 * @return {String}
 */
export function formatColor( { hue, level } ) {
  if ( hue === 'off' || level === 0 ) {
    return 'off';
  }
  return level === 3 ? hue : `${ hue } ${ LEVEL_NAMES[ level ] }`;
}

/**
 * Parse and re-emit in canonical form.
 *
 * @param {String} value
 * @param {{debug?: Boolean}} [options]
 * @return {String}
 */
export function normalizeColor( value, options ) {
  return formatColor( parseColor( value, options ) );
}
