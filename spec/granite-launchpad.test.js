import { expect, fixture, fixtureSync, html, elementUpdated, oneEvent, aTimeout } from '@open-wc/testing';
import { FakeLaunchpad } from './helpers/fake-launchpad.js';
import '../src/granite-launchpad.js';

const twinWith = async ( fake ) => {
  const el = await fixture( html`<granite-launchpad .launchpad=${ fake }></granite-launchpad>` );
  await elementUpdated( el );
  return el;
};

describe( 'granite-launchpad composition', () => {
  it( 'renders a board of its own when none is slotted', async () => {
    const el = await twinWith( new FakeLaunchpad() );
    expect( el.board ).to.exist;
    expect( el.board.localName ).to.equal( 'granite-launchpad-board' );
  } );

  it( 'uses a slotted board when given one', async () => {
    const el = await fixture( html`
      <granite-launchpad>
        <granite-launchpad-board id="mine"></granite-launchpad-board>
      </granite-launchpad>` );
    await elementUpdated( el );
    expect( el.board.id ).to.equal( 'mine' );
  } );
} );

describe( 'granite-launchpad connection', () => {
  it( 'starts idle', async () => {
    const el = await twinWith( new FakeLaunchpad() );
    expect( el.state ).to.equal( 'idle' );
    expect( el.getAttribute( 'state' ) ).to.equal( 'idle' );
  } );

  it( 'reports a successful connection', async () => {
    const fake = new FakeLaunchpad();
    const el = await twinWith( fake );
    const connected = oneEvent( el, 'launchpad-connect' );
    expect( await el.connect() ).to.be.true;
    await connected;
    expect( el.state ).to.equal( 'connected' );
    expect( fake.connected ).to.be.true;
  } );

  it( 'reports a failure instead of leaving a blank page', async () => {
    const el = await twinWith( new FakeLaunchpad( { failWith: 'no Web MIDI here' } ) );
    const failed = oneEvent( el, 'launchpad-error' );
    expect( await el.connect() ).to.be.false;
    const event = await failed;
    expect( el.state ).to.equal( 'error' );
    expect( el.error ).to.equal( 'no Web MIDI here' );
    expect( event.detail.error ).to.equal( 'no Web MIDI here' );
  } );

  it( 'connects on its own when told to', async () => {
    const fake = new FakeLaunchpad();
    // fixtureSync, not fixture: Lit schedules the first update - and with it
    // firstUpdated, and so the auto-connect - as a microtask. Awaiting
    // fixture() drains that microtask, so a fake that resolves immediately is
    // already connected and the event is long gone by the time a listener
    // could be attached. Taking the element synchronously lets the listener
    // exist before the connection starts, which is the order a real page has.
    const el = fixtureSync( html`<granite-launchpad auto-connect .launchpad=${ fake }></granite-launchpad>` );
    const connected = oneEvent( el, 'launchpad-connect' );
    await connected;
    expect( el.state ).to.equal( 'connected' );
    expect( fake.connected ).to.be.true;
  } );

  it( 'leaves its state readable for a listener that arrives late', async () => {
    const fake = new FakeLaunchpad();
    const el = await fixture( html`<granite-launchpad auto-connect .launchpad=${ fake }></granite-launchpad>` );
    // The connection has already finished here and the event cannot be caught
    // any more. A page in that position reads the state instead.
    expect( el.state ).to.equal( 'connected' );
    expect( el.getAttribute( 'state' ) ).to.equal( 'connected' );
  } );

  it( 'listens to a second instance assigned to launchpad after a reconnect', async () => {
    // #listeningTo tracks which instance was subscribed, not merely whether
    // anything ever was - otherwise reassigning `launchpad` and reconnecting
    // would leave the new instance's key handler unattached.
    const first = new FakeLaunchpad();
    const el = await twinWith( first );
    await el.connect();

    const second = new FakeLaunchpad();
    el.launchpad = second;
    await el.connect();

    setTimeout( () => second.press( 4, 4, true ) );
    const { detail } = await oneEvent( el, 'pad-press' );
    expect( detail.x ).to.equal( 4 );
    expect( detail.y ).to.equal( 4 );
  } );

  it( 'stops listening after disconnect', async () => {
    const fake = new FakeLaunchpad();
    const el = await twinWith( fake );
    await el.connect();
    el.disconnect();
    expect( el.state ).to.equal( 'idle' );
    let events = 0;
    el.addEventListener( 'pad-press', () => { events += 1; } );
    fake.press( 1, 1, true );
    await aTimeout( 0 );
    expect( events ).to.equal( 0 );
  } );
} );

describe( 'granite-launchpad mirroring', () => {
  it( 'sends a colour to the hardware and to the board together', async () => {
    const fake = new FakeLaunchpad();
    const el = await twinWith( fake );
    await el.connect();
    el.setColor( 3, 5, 'amber medium' );
    await elementUpdated( el );
    expect( el.board.getColor( 3, 5 ) ).to.equal( 'amber medium' );
    expect( fake.calls ).to.have.lengthOf( 1 );
    expect( fake.calls[ 0 ].buttons ).to.deep.equal( [ 3, 5 ] );
    expect( fake.calls[ 0 ].color.code ).to.equal( fake.amber.level( 2 ).code );
  } );

  it( 'translates off', async () => {
    const fake = new FakeLaunchpad();
    const el = await twinWith( fake );
    await el.connect();
    el.setColor( 0, 0, 'off' );
    expect( fake.calls[ 0 ].color.code ).to.equal( fake.off.code );
  } );

  it( 'paints the board even with no hardware attached', async () => {
    const el = await twinWith( new FakeLaunchpad() );
    el.setColor( 1, 1, 'green' );
    await elementUpdated( el );
    expect( el.board.getColor( 1, 1 ) ).to.equal( 'green' );
  } );

  it( 'reports a hardware press as an ordinary pad-press', async () => {
    const fake = new FakeLaunchpad();
    const el = await twinWith( fake );
    await el.connect();
    el.setColor( 2, 6, 'red' );
    await elementUpdated( el );
    setTimeout( () => fake.press( 2, 6, true ) );
    const { detail } = await oneEvent( el, 'pad-press' );
    expect( detail ).to.deep.equal( { x: 2, y: 6, color: 'red' } );
  } );

  it( 'reports a hardware release too', async () => {
    const fake = new FakeLaunchpad();
    const el = await twinWith( fake );
    await el.connect();
    setTimeout( () => fake.press( 2, 6, false ) );
    const { detail } = await oneEvent( el, 'pad-release' );
    expect( detail.x ).to.equal( 2 );
    expect( detail.y ).to.equal( 6 );
  } );

  it( 'sends a screen press nowhere - a press changes no colour', async () => {
    const fake = new FakeLaunchpad();
    const el = await twinWith( fake );
    await el.connect();
    el.board.padAt( 0, 0 ).dispatchEvent(
      new PointerEvent( 'pointerdown', { pointerId: 1, bubbles: true, composed: true } ) );
    await aTimeout( 0 );
    expect( fake.calls ).to.be.empty;
  } );

  it( 'delivers a screen press once through both shadow boundaries', async () => {
    // pad-press is composed, so it crosses the board's shadow root and the
    // twin's on its own - nothing here re-dispatches it. If anything ever
    // did, every press would arrive twice.
    const el = await twinWith( new FakeLaunchpad() );
    await elementUpdated( el );
    let count = 0;
    el.addEventListener( 'pad-press', () => { count += 1; } );
    el.board.padAt( 0, 0 ).dispatchEvent(
      new PointerEvent( 'pointerdown', { pointerId: 1, bubbles: true, composed: true } ) );
    expect( count ).to.equal( 1 );
  } );

  it( 'survives the Launchpad being unplugged mid-session', async () => {
    const fake = new FakeLaunchpad();
    const el = await twinWith( fake );
    await el.connect();

    const boom = new Error( 'port is gone' );
    fake.breakOutput( boom );

    const failed = oneEvent( el, 'launchpad-error' );
    el.setColor( 3, 5, 'red' );
    const event = await failed;
    await elementUpdated( el );

    expect( el.board.getColor( 3, 5 ), 'the board still paints' ).to.equal( 'red' );
    expect( el.state ).to.equal( 'error' );
    expect( el.error ).to.equal( boom );
    expect( event.detail.error ).to.equal( boom );
  } );

  it( 'reports a lost Launchpad once, not once per write', async () => {
    const fake = new FakeLaunchpad();
    const el = await twinWith( fake );
    await el.connect();
    fake.breakOutput( new Error( 'port is gone' ) );

    let errors = 0;
    el.addEventListener( 'launchpad-error', () => { errors += 1; } );
    el.setColor( 0, 0, 'red' );
    el.setColor( 1, 1, 'green' );
    await elementUpdated( el );

    expect( errors ).to.equal( 1 );
    expect( el.board.getColor( 1, 1 ), 'the screen keeps working' ).to.equal( 'green' );
  } );

  it( 'clears both sides, in one message rather than eighty', async () => {
    const fake = new FakeLaunchpad();
    const el = await twinWith( fake );
    await el.connect();
    el.setColor( 4, 4, 'red' );
    fake.calls.length = 0;
    el.reset();
    await elementUpdated( el );
    expect( el.board.getColor( 4, 4 ) ).to.equal( 'off' );
    // One Reset command, not eighty colour writes - on a real board the
    // difference is an instant clear rather than a sweep across the grid.
    expect( fake.resets, 'one Reset command' ).to.deep.equal( [ 0 ] );
    expect( fake.calls, 'and no per-pad writes' ).to.be.empty;
  } );

  it( 'survives the Launchpad being unplugged during a reset', async () => {
    const fake = new FakeLaunchpad();
    const el = await twinWith( fake );
    await el.connect();
    el.setColor( 4, 4, 'red' );
    await elementUpdated( el );

    const boom = new Error( 'port is gone' );
    fake.breakOutput( boom );

    const failed = oneEvent( el, 'launchpad-error' );
    el.reset();
    const event = await failed;
    await elementUpdated( el );

    expect( el.board.getColor( 4, 4 ), 'the screen still clears' ).to.equal( 'off' );
    expect( el.state ).to.equal( 'error' );
    expect( el.error ).to.equal( boom );
    expect( event.detail.error ).to.equal( boom );
  } );
} );
