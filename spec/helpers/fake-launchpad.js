import Launchpad from 'launchpad-webmidi';

const palette = new Launchpad();

/**
 * Stands in for a Launchpad. Records every col() call and lets a test push
 * key events as if the hardware had sent them.
 */
export class FakeLaunchpad {
  constructor( { failWith = null } = {} ) {
    this.red = palette.red;
    this.green = palette.green;
    this.amber = palette.amber;
    this.yellow = palette.yellow;
    this.off = palette.off;
    this.calls = [];
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
    this.calls.push( { color, buttons } );
    return Promise.resolve( true );
  }

  /** Push a key event as the hardware would. */
  press( x, y, pressed ) {
    for ( const callback of this._handlers.key || [] ) {
      callback( { x, y, pressed } );
    }
  }
}
