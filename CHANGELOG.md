# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.1] – 2026-09-22

### Fixed

- `<granite-launchpad>`'s `reset()` clears the hardware with one Launchpad
  Reset command instead of eighty colour writes. On a real board the old
  behaviour was visible: the grid cleared as a sweep rather than at once, and
  a program calling `reset()` on a timer spent most of its MIDI budget on it.

  The Reset command also clears state this component does not manage – the
  display buffers, flashing and the duty cycle – which is a change only for a
  page reaching past the twin to `launchpad` directly.

### Changed

- The handling that keeps an unplugged Launchpad from throwing at the caller
  moved out of the colour-writing path into one place both it and `reset()`
  use. `launchpad-webmidi` sends through a bare `MIDIOutput.send()`, which
  throws synchronously once the port is gone, so every hardware write needs
  that treatment and not just `col()`.

## [1.0.0] – 2026-09-22

A rewrite in [Lit](https://lit.dev). The 2018 Polymer 2 elements this replaces
had not run in a browser since Chrome 73 removed HTML Imports in 2019, and
`bower.json` was the only manifest they had. Published to npm for the first time,
as `@granite-elements/granite-launchpad`.

### Added

- `<granite-launchpad-pad>`, `<granite-launchpad-board>` and
  `<granite-launchpad>`, the twin.
- Brightness levels. The hardware has four hues at up to four levels and the
  Polymer element knew five flat strings, so a mirrored board could not match the
  real one. Colours are now `red`, `red medium`, `red low` and `off`, with full
  brightness written as the bare hue – every string the old element accepted
  still means what it meant. Yellow is clamped to full, which is all the
  hardware has.
- Pointer, touch, pen and keyboard input. The old element listened for
  `mousedown`, `mouseup` and `mouseout`, so a twin of a touch controller did not
  work on a touch device and could not be played without a mouse. Pads carry
  `role`, `tabindex` and a positional `aria-label`.
- The twin reports connection failures through `state`, `error` and a
  `launchpad-error` event, so a browser without Web MIDI, a missing board or a
  denied permission is something a page can render.
- Four examples, and a test suite running in Chromium under
  [`@web/test-runner`](https://modern-web.dev/docs/test-runner/overview/).

### Changed

- Coordinates are `(x, y)` – column then row – matching
  [`launchpad-webmidi`](https://github.com/LostInBrittany/launchpad-webmidi).
  The old element took `(row, column)`, so every integration with the library
  paid a swap on every call, including the demo shipped with it.
- Events are `pad-press` and `pad-release` with `detail: {x, y, color}`,
  replacing `pressed` and `released` with `detail: {name, i, j}`.
- Custom properties are namespaced: `--granite-launchpad-red-full` rather than
  `--switch-color-red`, `--granite-launchpad-pad-size` rather than
  `--switch-size`.
- The board is one 9 × 9 CSS Grid with the corner cell empty, replacing three
  grids kept in alignment by repeated hardcoded pixel values – which is why every
  dimension used to be frozen at 50px.
- Distributed as unbundled ES modules with bare specifiers. There is no build
  step and no `dist/`.

### Fixed

- The Scene column's ids were never generated. The binding read
  `id="[[row]-8"` – one opening bracket, never closed.
- The guard excluding the non-existent corner button never fired. It was
  written `i == j == 8`, which JavaScript reads as `(i == j) == 8`.
- A pad released outside itself no longer sticks. Pointer capture replaces the
  `mouseout` workaround, and covers touch, which the workaround never did.

## [0.1.0] – 2018-02-21

The original Polymer 2 elements, `granite-launchpad` and
`granite-launchpad-switch`, distributed through Bower. Never published to npm.

[Unreleased]: https://github.com/LostInBrittany/granite-launchpad/compare/1.0.1...HEAD
[1.0.1]: https://github.com/LostInBrittany/granite-launchpad/compare/1.0.0...1.0.1
[1.0.0]: https://github.com/LostInBrittany/granite-launchpad/compare/bf8634e...1.0.0
[0.1.0]: https://github.com/LostInBrittany/granite-launchpad/commit/bf8634e
