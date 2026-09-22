# granite-launchpad

Lit web components mimicking a Novation Launchpad Mini board, with a digital
twin of a real one.

`granite-launchpad` is three custom elements: a single pad, a board of 80 of
them arranged the way the hardware is, and a twin that connects that board to
a real Launchpad Mini so the two stay in step. Use the board alone for a
screen-only Launchpad, or the twin to mirror the physical device – pressing
either side reaches the page as the same event, and painting either side
paints both.

## Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [The three elements](#the-three-elements)
- [Getting started](#getting-started)
- [Coordinates](#coordinates)
- [Colours](#colours)
- [Styling](#styling)
- [API](#api)
- [The twin](#the-twin)
- [Examples](#examples)
- [Coming from the Polymer element](#coming-from-the-polymer-element)
- [Known limitations](#known-limitations)
- [Changelog](#changelog)
- [Licence](#licence)

## Requirements

A modern browser. `<granite-launchpad-board>` and `<granite-launchpad-pad>`
need nothing beyond what any Lit element needs.

The twin, `<granite-launchpad>`, additionally needs the
[Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API)
and a Novation Launchpad Mini plugged in. See MDN's
[browser support table](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API#browser_compatibility)
before relying on it – Safari does not implement Web MIDI at all, and the page
must be a secure context (HTTPS or `localhost`).

## Installation

```bash
npm install @granite-elements/granite-launchpad
```

There are two entry points, and which one to import depends on what you need:

```js
import '@granite-elements/granite-launchpad';       // pad + board, no MIDI
import '@granite-elements/granite-launchpad/twin.js'; // + the twin
```

The bare specifier registers `<granite-launchpad-pad>` and
`<granite-launchpad-board>` only. `<granite-launchpad>`, the twin, is
registered solely by the `/twin.js` subpath – that split is what keeps
`launchpad-webmidi` out of a page that only ever imports the board. Get this
wrong and it fails silently: an unregistered custom element does not throw, it
just renders as an empty inline box, `auto-connect` never fires, and no
`launchpad-connect` or `launchpad-error` ever arrives. If `<granite-launchpad>`
sits on the page doing nothing, this is the first thing to check.

For a page with no build step, resolve both specifiers with an import map
pointing at [esm.sh](https://esm.sh):

```html
<script type="importmap">
  {"imports": {
    "@granite-elements/granite-launchpad": "https://esm.sh/@granite-elements/granite-launchpad",
    "@granite-elements/granite-launchpad/twin.js": "https://esm.sh/@granite-elements/granite-launchpad/twin.js"
  }}
</script>
<script type="module">
  import '@granite-elements/granite-launchpad/twin.js';
</script>
```

The import map must come before any module script that relies on it.

## The three elements

| Tag | Role |
|---|---|
| `<granite-launchpad>` | The twin: a board connected to real hardware |
| `<granite-launchpad-board>` | The board on its own, no MIDI |
| `<granite-launchpad-pad>` | A single pad, usable alone |

The twin renders a board itself, so it works with no children:

```js
import '@granite-elements/granite-launchpad/twin.js';
```

```html
<granite-launchpad></granite-launchpad>
```

Give it an explicit `<granite-launchpad-board>` child only when the board
needs its own attributes or styling. The twin renders that child as its
`<slot>`'s fallback content, and fallback content is built whether or not
anything is slotted, so the plain form above avoids constructing a second,
unused board:

```html
<granite-launchpad>
  <granite-launchpad-board></granite-launchpad-board>
</granite-launchpad>
```

Note the import: `<granite-launchpad>` needs `/twin.js`, not the bare
specifier – see [Installation](#installation).

## Getting started

This is the body of [`examples/board.html`](examples/board.html), the board on
its own with no hardware involved. Each press cycles the pad through four
colours:

```html
<h1>The board</h1>
<p>Press a pad to cycle it: off, green, amber, red, and back.</p>

<granite-launchpad-board id="board"></granite-launchpad-board>

<script type="module">
  import '../index.js';

  const CYCLE = [ 'off', 'green', 'amber', 'red' ];
  const board = document.querySelector( '#board' );

  board.addEventListener( 'pad-press', ( event ) => {
    const { x, y } = event.detail;
    const next = CYCLE[ ( CYCLE.indexOf( board.getColor( x, y ) ) + 1 ) % CYCLE.length ];
    board.setColor( x, y, next );
  } );
</script>
```

The example imports `../index.js` directly, so it runs straight from the
repository with no install step – see [Examples](#examples). Installed from
npm, replace that import with `@granite-elements/granite-launchpad`, as in
[Installation](#installation).

## Coordinates

Every pad is addressed as `(x, y)`. `x` is the column, `y` is the row – the
same vocabulary `launchpad-webmidi` uses, so `board.setColor(x, y, c)` and
`pad.col(c, [x, y])` address the same button.

```
         x=0   1     2     3     4     5     6     7    x=8

y=8    (  )  (  )  (  )  (  )  (  )  (  )  (  )  (  )          Automap row
       ┌────┬────┬────┬────┬────┬────┬────┬────┐
y=0    │    │    │    │    │    │    │    │    │        (  )
y=1    │    │    │    │    │    │    │    │    │        (  )
y=2    │    │    │    │    │    │    │    │    │        (  )
y=3    │    │    │    │    │    │    │    │    │        (  )   Scene
y=4    │    │    │    │    │    │    │    │    │        (  )   column
y=5    │    │    │    │    │    │    │    │    │        (  )
y=6    │    │    │    │    │    │    │    │    │        (  )
y=7    │    │    │    │    │    │    │    │    │        (  )
       └────┴────┴────┴────┴────┴────┴────┴────┘
```

- `x` is the column, `0`–`8`, where `x = 8` is the Scene column on the right.
- `y` is the row, `0`–`8`, where `y = 0` is the top of the 8×8 grid, `y`
  increases downward, and `y = 8` is the Automap row above it.
- `(8, 8)` does not exist – the corner where the Automap row and the Scene
  column would meet has no button on the hardware.

## Colours

Colours are strings. The canonical forms are `off`, `red`, `red medium`,
`red low`, and the same three levels for `green` and `amber`. `yellow` only
has a full-brightness form – see below.

`parseColor()`, used everywhere a colour is accepted, is forgiving about what
it takes in:

| Input | Result |
|---|---|
| `'off'` | `{hue: 'off', level: 0}` |
| `'red'`, `'green'`, `'amber'`, `'yellow'` | that hue at full brightness |
| `'amber medium'` | `{hue: 'amber', level: 2}` |
| `'amber 2'` | `{hue: 'amber', level: 2}` |
| anything else | `{hue: 'off', level: 0}`, with a console warning when `debug` is set |

Full brightness is written as the bare hue – `'red'`, not `'red full'`.

Yellow is clamped to full brightness. The Launchpad Mini's yellow LED is a
fixed red/green pair with no room to encode a level, so a dimmer yellow could
never be shown on the hardware this twin mirrors; asking for one on screen
would show something the real board cannot do.

## Styling

Eleven custom properties carry the colours, one per hue/level pair the
hardware can actually show:

```
--granite-launchpad-off
--granite-launchpad-red-low
--granite-launchpad-red-medium
--granite-launchpad-red-full
--granite-launchpad-green-low
--granite-launchpad-green-medium
--granite-launchpad-green-full
--granite-launchpad-amber-low
--granite-launchpad-amber-medium
--granite-launchpad-amber-full
--granite-launchpad-yellow-full
```

There is no `-yellow-low` or `-yellow-medium` – yellow clamps to full, so
those tokens would never be read.

Two more properties control layout and one an optional effect:

- `--granite-launchpad-pad-size` – the side of one pad, default `2.5rem`.
- `--granite-launchpad-gap` – the space between pads on the board, default
  `0.3rem`.
- `--granite-launchpad-glow` – a `box-shadow` applied to a pad lit at full
  brightness, unset by default. Flat rectangles do not read as lit LEDs; the
  bloom is opt-in rather than imposed.

## API

### `<granite-launchpad-pad>`

**Properties**

| Name | Type | Default | Notes |
|---|---|---|---|
| `color` | String | `'off'` | Behaves as a reflected attribute; any accepted colour string is normalised to its canonical form on write |
| `x`, `y` | Number | – | Set by the board when nested in one; also settable directly on a standalone pad |
| `round` | Boolean | `false` | Renders the Automap/Scene capsule shape instead of a square |
| `disabled` | Boolean | `false` | Suppresses all input and sets `aria-disabled` |
| `label` | String | – | Overrides the generated `aria-label` |
| `debug` | Boolean | `false` | Logs a console warning for an unrecognised colour |

**Methods:** none.

**Events**

| Name | `detail` | Fired on |
|---|---|---|
| `pad-press` | `{x, y, color}` | Pointer, touch or pen down, or Space/Enter down |
| `pad-release` | `{x, y, color}` | Pointer, touch or pen up or cancel, Space/Enter up, or losing focus while held |

Both bubble and are composed, so they cross the pad's shadow boundary on their
own.

### `<granite-launchpad-board>`

**Properties**

| Name | Type | Default | Notes |
|---|---|---|---|
| `debug` | Boolean | `false` | Logs a console warning for an off-board coordinate |

**Methods**

| Signature | Behaviour |
|---|---|
| `setColor(x, y, color)` | Sets one pad; a no-op off the board |
| `setColors(entries)` | `[[x, y, color], …]`, the shape `launchpad-webmidi`'s `setColors()` takes |
| `getColor(x, y)` | Returns the canonical colour string, or `undefined` off the board |
| `reset()` | All pads to `'off'` |
| `padAt(x, y)` | The `<granite-launchpad-pad>` element at that position, or `undefined` |

**Events:** `pad-press` and `pad-release`, retargeted from whichever pad fired
them. The board neither listens for its own pad events nor re-dispatches them
– doing both would deliver every press twice.

### `<granite-launchpad>` (the twin)

**Properties**

| Name | Type | Default | Notes |
|---|---|---|---|
| `autoConnect` | Boolean | `false` | Attribute `auto-connect`; connects on first update |
| `launchpad` | Object | `null` | An existing `Launchpad` instance to mirror; a new one is constructed on `connect()` when unset |
| `state` | String | `'idle'` | Reflected attribute: `idle`, `connecting`, `connected`, `error` |
| `error` | Object | `null` | The reason `connect()` failed, or the error thrown when a connected Launchpad went away mid-session |
| `debug` | Boolean | `false` | |

**Methods**

| Signature | Behaviour |
|---|---|
| `connect()` | Connects to the hardware. Resolves `true` or `false` – it never rejects |
| `disconnect()` | Stops mirroring and returns `state` to `'idle'` |
| `setColor(x, y, color)` | Paints the board and sends to the hardware in one call |
| `setColors(entries)` | Batch form of `setColor()` |
| `getColor(x, y)` | Reads the board's colour at `x, y` |
| `reset()` | Every pad to `'off'`, on screen and on the hardware. See the note below |

**Events:** `launchpad-connect`, `launchpad-disconnect`, `launchpad-error`
(`detail: {error}`), and the board's `pad-press` and `pad-release`, regardless
of which side – screen or hardware – originated them.

## The twin

Set `auto-connect` to have the twin connect as soon as it first updates,
without calling `connect()` yourself:

```js
import '@granite-elements/granite-launchpad/twin.js';
```

```html
<granite-launchpad auto-connect></granite-launchpad>
```

`state` tracks the connection: `idle` before anything has happened,
`connecting` while `connect()` is in flight, `connected` once mirroring is
live, and `error` when it is not. Because `state` is a reflected attribute,
`document.querySelector('granite-launchpad').getAttribute('state')` always
tells you where things stand.

That matters because of a race `auto-connect` can lose: connecting is a Web
MIDI permission prompt, and a script further down the page may not attach its
`launchpad-connect` listener until after that prompt has already been
answered and the connection has already finished. A listener added too late
simply misses the event. `state` is reflected precisely so a page in that
position has something to read instead of racing the event – check
`state === 'connected'` (or the attribute) on load rather than assuming the
event will still be coming.

Listen for `launchpad-error` to learn when `connect()` failed – no Web MIDI
support, no Launchpad found, or a declined permission prompt:

```js
twin.addEventListener( 'launchpad-error', ( event ) => {
  console.warn( 'No Launchpad:', event.detail.error );
} );
```

**Losing the device mid-session** is handled too, not just a failed initial
connect. `launchpad-webmidi` sends through a bare `MIDIOutput.send()`, which
throws synchronously once the MIDI port is gone – unplugging the Launchpad
while it is connected. The twin catches that throw, sets `state` to `'error'`,
fires one `launchpad-error`, and keeps painting the board. Unplugging a
Launchpad therefore degrades the page to screen-only instead of throwing out
of `setColor()` at the caller, and the event fires once for the disconnection,
not once per write that would otherwise have failed.

**Injecting a fake.** The `launchpad` property exists so a page – or a test –
can supply an object matching `launchpad-webmidi`'s `Launchpad` interface and
run the twin with no hardware:

```js
twin.launchpad = fakeLaunchpad;
await twin.connect();
```

### Resetting

`reset()` clears the hardware with a single Launchpad Reset command rather
than eighty individual colour writes, so a real board clears at once instead
of sweeping across the grid.

That command also clears device state this component does not manage – the
display buffers, flashing and the duty cycle. It only matters if you have been
reaching past the twin to `twin.launchpad` to set those yourself; if you have
not, there is nothing to notice.

## Examples

Runnable pages live in [`examples/`](examples/):

| Example | What it shows |
|---|---|
| [`single-pad.html`](examples/single-pad.html) | One `<granite-launchpad-pad>`, green while held and red once released |
| [`board.html`](examples/board.html) | The full board, played on screen, cycling each pad through a colour sequence |
| [`board-with-webmidi.html`](examples/board-with-webmidi.html) | The board wired to hardware by hand, without the twin |
| [`twin.html`](examples/twin.html) | The twin, with `auto-connect` |

Serve the repository over HTTP and open one – `file://` will not work, and the
twin examples need a secure context for Web MIDI:

```bash
npx http-server
```

## Coming from the Polymer element

| 2018 | 1.0.0 |
|---|---|
| `<granite-launchpad>` | `<granite-launchpad-board>` |
| `<granite-launchpad-switch>` | `<granite-launchpad-pad>` |
| `setColor(i, j, c)` – row, column | `setColor(x, y, c)` – column, row |
| `pressed` / `released` | `pad-press` / `pad-release` |
| `detail: {name, i, j}` | `detail: {x, y, color}` |
| `'red'`, `'green'`, `'amber'`, `'yellow'`, `'off'` | unchanged, plus `'red low'` and the other levels |
| `--switch-color-red` | `--granite-launchpad-red-full` |
| `--switch-size` | `--granite-launchpad-pad-size` |

## Known limitations

- **Double buffering, multiplexing and global brightness are not mirrored.**
  `launchpad-webmidi` supports all three, but the twin ignores them: a
  flashing LED on the hardware renders as steady on screen.
- **Every pad is its own tab stop**, so tabbing across the board takes 80
  stops. Arrow-key navigation with a roving tabindex is a candidate for a
  later release.
- **Pads respond to pointer, touch, pen, Space and Enter, but not to a
  synthesised `click`.** Assistive technology that activates a `role="button"`
  by dispatching `click` rather than key events will not play a pad. Handling
  it needs care to avoid double-firing alongside the pointer sequence a real
  mouse already produces, so it is deferred rather than guessed at.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## Licence

[MIT](./LICENCE.md)
