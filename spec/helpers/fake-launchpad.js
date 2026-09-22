import Launchpad from 'launchpad-webmidi';

const palette = new Launchpad();

/**
 * Stands in for a Launchpad. Records every col() call and lets a test push
 * key events as if the hardware had sent them.
 */
export class FakeLaunchpad {
  constructor( { failWith = null } = {} ) {
    this._outputError = null;
    this.red = palette.red;
    this.green = palette.green;
    this.amber = palette.amber;
    this.yellow = palette.yellow;
    this.off = palette.off;
    this.calls = [];
    this.resets = [];
    this.connected = false;
    this._failWith = failWith;
    this._handlers = {};
  }

  connect() {
    if ( this._failWith ) {
      return Promise.reject( this._failWith );
    }
    this.connected = true;
    return Promise.resolve();
  }

  on( event, callback ) {
    ( this._handlers[ event ] = this._handlers[ event ] || [] ).push( callback );
  }

  col( color, buttons ) {
    // MIDIOutput.send() throws synchronously once the port is gone, and
    // launchpad-webmidi's sendRaw() calls it directly, so this is what a
    // Launchpad unplugged mid-session actually looks like to the twin.
    if ( this._outputError ) {
      throw this._outputError;
    }
    this.calls.push( { color, buttons } );
    return Promise.resolve( true );
  }

  /**
   * The real reset() is a single sendRaw(), so it fails exactly as col() does.
   *
   * @param {Number} brightness 0 clears every LED; 1-3 light them all amber.
   */
  reset( brightness ) {
    if ( this._outputError ) {
      throw this._outputError;
    }
    this.resets.push( brightness );
  }

  /** Make every later write throw, as an unplugged Launchpad does. */
  breakOutput( error ) {
    this._outputError = error;
  }

  /** Push a key event as the hardware would. */
  press( x, y, pressed ) {
    for ( const callback of this._handlers.key || [] ) {
      callback( { x, y, pressed } );
    }
  }
}
