# granite-launchpad – Lit rebuild

- **Status:** approved, awaiting implementation plan
- **Date:** 2026-09-22
- **Supersedes:** the Polymer 2 elements in this repository (February 2018)

## Context

This repository holds a custom element mimicking a Novation Launchpad Mini
board, written in February 2018 against Polymer 2. It is the third and oldest
of three related projects, after
[`launchpad-webmidi`](https://github.com/LostInBrittany/launchpad-webmidi) 2.0.0
and [`whack-a-launchpad`](https://github.com/LostInBrittany/whack-a-launchpad)
1.1.0, both brought up to date in September 2026.

The existing code cannot run in any current browser:

- Every file begins with `<link rel="import">`. HTML Imports were removed from
  Chrome in version 73, in 2019.
- `bower.json` is the only manifest. There is no `package.json`, and Bower is
  retired.
- `Polymer.Element`, `<dom-module>`, `dom-repeat`, path-based `this.set()` and
  `updateStyles()` are Polymer 2 runtime machinery with no direct Lit
  equivalent.

The whole element set is roughly 350 lines across two files. Rewriting is
cheaper than porting, and the rewrite is an opportunity to fix defects and gaps
that a faithful port would carry forward.

### Defects in the current code

1. `granite-launchpad.html:96` binds `id="[[row]-8"` – a single opening bracket,
   never closed. Ids in the Scene column were never generated correctly.
2. `setColor()` and `getColor()` guard the non-existent corner button with
   `i == j == 8`, which JavaScript parses as `(i == j) == 8`. That is
   `false == 8` or `true == 8`, so the guard never fires.
3. Input is `mousedown` / `mouseup` / `mouseout` only. There is no touch, no
   pen, no keyboard and no ARIA, so a twin of a touch controller does not work
   on a tablet and cannot be played without a mouse.
4. The colour vocabulary is five flat strings. The hardware has four hues at up
   to four brightness levels, and `launchpad-webmidi` 2.0.0 exposes them through
   `Color.level()`. A mirrored board therefore cannot match the real one.
5. The board is built from three independent CSS grids kept in alignment by
   repeated hardcoded pixel values (`granite-launchpad.html:11-66`), which is
   why every dimension is frozen at 50px.

## Goals

- A Lit rewrite that runs in current browsers, installed from npm.
- Full colour fidelity with the hardware: four hues, four brightness levels.
- Input parity with a touch device: pointer, touch, pen and keyboard.
- One coordinate vocabulary shared with `launchpad-webmidi`.
- A board usable on its own, with no MIDI code loaded.
- Hardware mirroring available as a component rather than as copied glue.

## Non-goals

- Backward compatibility with the Polymer elements. Nothing can depend on them,
  because they have not run in a browser since 2019.
- Double buffering, flashing and global brightness. See Known limitations.
- A general theming system beyond CSS custom properties.

## Naming and packaging

| | |
|---|---|
| Repository | `LostInBrittany/granite-launchpad` (renamed from `granite-multicolor-pad-board`; GitHub redirects the old URL) |
| npm package | `@granite-elements/granite-launchpad` |
| Version | `1.0.0` |

The 2018 name avoided "Launchpad" out of concern about the Novation product
name. Publishing under the `@granite-elements` scope addresses that more
directly: the package does not claim the unscoped `launchpad` name, and
`granite-launchpad` reads as a Launchpad component by granite rather than as a
Novation product.

### Element names

| Tag | Role |
|---|---|
| `<granite-launchpad>` | The twin: a board connected to real hardware |
| `<granite-launchpad-board>` | The board on its own, no MIDI |
| `<granite-launchpad-pad>` | A single pad, usable alone |

```html
<granite-launchpad>
  <granite-launchpad-board></granite-launchpad-board>
</granite-launchpad>
```

## Coordinate system

`x` is the column, `y` is the row, matching `launchpad-webmidi`, so
`board.setColor(x, y, c)` and `pad.col(c, [x, y])` address the same button.

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

- `y = 0` is the top row of the 8×8 grid and `y` increases downward.
- `y = 8` is the Automap row, drawn above `y = 0`.
- `x = 8` is the Scene column, drawn to the right.
- `(8, 8)` does not exist.

This is the hardware's own numbering, visible in `launchpad-webmidi.js:57-58`,
where `cmd` switches on `y >= 8` and the key for the main grid is
`0x10 * y + x`.

Out-of-range coordinates and `(8, 8)` are handled rather than thrown:
`setColor()` is a no-op, `getColor()` returns `undefined`, and both warn on the
console when `debug` is set. Silent tolerance keeps loops over a 9×9 range
simple, which is how callers actually address the board.

## Colour model

### Parsing

`parseColor(value)` in `src/lib/colors.js` returns `{hue, level}`.

| Input | Result |
|---|---|
| `'off'` | `{hue: 'off', level: 0}` |
| `'red'`, `'green'`, `'amber'`, `'yellow'` | that hue at `level: 3` |
| `'amber medium'` | `{hue: 'amber', level: 2}` |
| `'amber 2'` | `{hue: 'amber', level: 2}` |
| anything else | `{hue: 'off', level: 0}`, warns when `debug` |

Level names are `off`, `low`, `medium`, `full` for `0`–`3`, matching the
`Color` getters in `launchpad-webmidi/lib/colors.js`. A bare hue meaning full
brightness keeps every colour string the 2018 element accepted meaning what it
meant.

Yellow is clamped to `level: 3`. The hardware cannot dim it – see the comment at
`launchpad-webmidi.js:76-79` – so a twin that dimmed it on screen would show
something the board it mirrors cannot do. The clamp warns when `debug` is set.

### Rendering

A pad sets `background: var(--granite-launchpad-<hue>-<level>)`, giving 13
tokens: `off`, plus `low`/`medium`/`full` for each of `red`, `green`, `amber`
and `yellow`. Defaults approximate Launchpad Mini LEDs; all are overridable.

A brightness bloom is available through `--granite-launchpad-glow`, unset by
default. Flat rectangles do not read as lit LEDs, but the effect is opt-in
rather than imposed.

## Elements

### `<granite-launchpad-pad>`

**Properties**

| Name | Type | Default | Notes |
|---|---|---|---|
| `color` | String | `'off'` | Reflected attribute |
| `x`, `y` | Number | – | Set by the board; also settable alone |
| `round` | Boolean | `false` | The Automap and Scene capsules |
| `disabled` | Boolean | `false` | |
| `debug` | Boolean | `false` | |

**Events:** `pad-press` and `pad-release`, both `bubbles` and `composed`, with
`detail: {x, y, color}`.

**Input.** Pointer Events with `setPointerCapture()` on `pointerdown`. Capture
removes the need for the `_onSwitchOut` workaround in
`granite-launchpad-switch.html:129-140`: a pointer released anywhere still
delivers `pointerup` to the pad that captured it, so a press can never be left
stuck. Touch and pen work without extra code.

**Accessibility.** `role="button"`, `tabindex="0"` when not disabled,
`aria-label` of the form `Pad 3,5` – or `Automap 3` and `Scene 5` for the outer
controls – and Space or Enter producing the same press and release pair as a
pointer.

### `<granite-launchpad-board>`

**Properties:** `debug`.

**Methods**

| Signature | Behaviour |
|---|---|
| `setColor(x, y, color)` | Sets one pad |
| `setColors(entries)` | `[[x, y, color], ...]`, the shape `launchpad-webmidi`'s `setColors()` takes |
| `getColor(x, y)` | Returns the colour string, or `undefined` off the board |
| `reset()` | All pads to `'off'` |
| `padAt(x, y)` | The `<granite-launchpad-pad>` element, or `undefined` |

**Events:** none of its own. Pad events are `composed`, so they cross the
board's shadow boundary on their own and are retargeted to the board host, then
continue to the twin. The board neither listens nor re-dispatches – doing both
would deliver every press twice.

**State.** One flat `Array(81)` indexed `y * 9 + x`, with the corner slot
unused. Mutated in place followed by `requestUpdate()`; Lit coalesces a burst of
MIDI-driven changes into a single render.

**Layout.** A single 9 × 9 CSS Grid with the corner cell left empty, replacing
the three hand-aligned grids of the current element. The board sizes itself to
its container with `aspect-ratio: 1`, and `--granite-launchpad-pad-size`
overrides the pad dimension for a fixed-size board.

### `<granite-launchpad>` (the twin)

**Properties**

| Name | Type | Default | Notes |
|---|---|---|---|
| `autoConnect` | Boolean | `false` | Connect on first update |
| `launchpad` | Object | – | An existing `Launchpad`; one is constructed when unset |
| `state` | String | `'idle'` | Reflected: `idle`, `connecting`, `connected`, `error` |
| `error` | Object | `null` | The reason `connect()` rejected |
| `debug` | Boolean | `false` | |

**Methods:** `connect()`, `disconnect()`, plus the board's colour methods
forwarded so that a call paints the screen and the hardware together.

**Events:** `launchpad-connect`, `launchpad-disconnect`, `launchpad-error`, and
the board's `pad-press` and `pad-release` regardless of which side originated
them.

**Composition.** The twin renders a `<slot>` and uses the first slotted
`<granite-launchpad-board>`. When nothing is slotted it renders a board of its
own, so `<granite-launchpad></granite-launchpad>` is a working twin and the
slotted form exists for when the board needs its own attributes or styling.

**Mirroring.** Hardware to screen: `launchpad.on('key', …)` sets the board.
Screen to hardware: a `pad-press` on the board sends `col()`. Colour
translation is string to `Color` – `parseColor()` yields `{hue, level}`, and the
twin calls `launchpad[hue].level(level)`, all public API.

**Errors.** `state` and `error` are set and `launchpad-error` fires when
`connect()` rejects, so a browser without Web MIDI, a missing board or a denied
permission is visible to the page. This is the lesson recorded in the
whack-a-launchpad 1.1.0 changelog, where an unhandled rejection left a blank
page and a console warning.

**Injection.** The `launchpad` property exists so tests can supply a fake and
run the twin without hardware.

## Repository layout

```
granite-launchpad/
├── src/
│   ├── granite-launchpad-pad.js
│   ├── granite-launchpad-board.js
│   ├── granite-launchpad.js
│   └── lib/colors.js
├── index.js            board + pad
├── twin.js             twin + board + pad
├── examples/
│   ├── single-pad.html
│   ├── board.html
│   ├── board-with-webmidi.html
│   └── twin.html
├── spec/
├── .github/workflows/{ci,publish}.yml
├── package.json
├── CHANGELOG.md
├── README.md
└── LICENCE.md
```

Removed: `bower.json`, `polymer.json`, `granite-launchpad.html`,
`granite-launchpad-switch.html`, `demo/`, `index.html`, `.eslintrc.json`.

### Entry points

`lit` is a dependency of the package. `launchpad-webmidi@^2.0.0` is reached only
through `twin.js`, so importing the board never loads MIDI code.

```json
"exports": {
  ".": "./index.js",
  "./twin.js": "./twin.js",
  "./src/*": "./src/*",
  "./package.json": "./package.json"
}
```

### Build and publishing

Published as unbundled ES modules with bare specifiers. No Rollup, no `dist/`.
Consumers resolve `lit` through a bundler or an import map, the pattern
whack-a-launchpad moved to in 1.1.0.

`launchpad-webmidi` ships UMD and IIFE builds because it has a decade of
`<script src>` consumers. This package has none, so it does not inherit that
cost. Single-file demos are covered by documenting the CDN route, which resolves
the dependency graph without a build step here:

```html
<script type="importmap">
  {"imports": {
    "@granite-elements/granite-launchpad":
      "https://esm.sh/@granite-elements/granite-launchpad"
  }}
</script>
<script type="module">
  import '@granite-elements/granite-launchpad';
</script>
```

## Testing

`@web/test-runner` with Playwright on Chromium. The deliverable is shadow DOM
and pointer interaction, so the tests run in a real browser rather than under a
DOM shim.

**`src/lib/colors.js`** – the parse table, including bare hues, level names,
numeric levels, the yellow clamp and invalid input.

**`<granite-launchpad-pad>`** – renders; `color` maps to the expected custom
property; an invalid colour falls back to `off`; `pointerdown` and `pointerup`
emit press and release; a pointer released outside the pad still releases it;
touch input behaves as pointer input; Space and Enter emit the same pair;
`disabled` suppresses all of it; ARIA attributes are present and correct.

**`<granite-launchpad-board>`** – renders 81 pads with no pad at `(8, 8)`;
`setColor()` and `getColor()` round-trip; out-of-range coordinates are no-ops;
`setColors()` applies a batch; `reset()` clears; press and release carry the
right `x` and `y`; `padAt()` resolves.

**`<granite-launchpad>`** – with a fake `Launchpad` injected: a `key` event
paints the board; a board press sends `col()` with the translated `Color`; a
rejected `connect()` sets `state` and `error` and fires `launchpad-error`;
`autoConnect` connects on first update.

## Migration from the Polymer element

Recorded in the README and CHANGELOG for anyone arriving from the 2018 code.

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

`launchpad-webmidi` supports double buffering, multiplexing and global
brightness. The twin ignores all three: a flashing LED on the hardware renders
as steady on screen, and `brightness()` does not dim the twin. Documented rather
than half-implemented.

## Repository work

The rewrite happens on a branch. History is kept – the Polymer files are removed
by commit, not by starting a fresh repository. The GitHub rename follows the
merge.

`CHANGELOG.md` starts at `1.0.0` for this rewrite, because
`@granite-elements/granite-launchpad` has never been published, and records the
2018 Polymer element as a historical `0.1.0` entry so the rewrite has visible
provenance.
