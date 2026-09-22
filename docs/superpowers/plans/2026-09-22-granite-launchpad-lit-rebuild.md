# granite-launchpad Lit rebuild – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 2018 Polymer 2 elements with three Lit elements published to npm as `@granite-elements/granite-launchpad` 1.0.0.

**Architecture:** A presentational `<granite-launchpad-pad>` composes into a `<granite-launchpad-board>` (a 9 × 9 CSS Grid less the dead corner), which a `<granite-launchpad>` twin mirrors against real hardware through `launchpad-webmidi`. Pad events are `composed`, so they cross both shadow boundaries on their own – no element re-dispatches another's events. Colour is a string parsed into `{hue, level}` by one shared module.

**Tech Stack:** Lit 3.3.3, `@web/test-runner` 1.0.0 with Playwright Chromium, `@open-wc/testing` 5.0.0, `launchpad-webmidi` 2.0.0. No bundler, no `dist/`.

**Spec:** `docs/superpowers/specs/2026-09-22-granite-launchpad-lit-rebuild-design.md`

## Global Constraints

- Package name `@granite-elements/granite-launchpad`, version `1.0.0`.
- Tags: `<granite-launchpad>` (twin), `<granite-launchpad-board>`, `<granite-launchpad-pad>`.
- Coordinates are `(x, y)`: `x` column 0–8 (`x=8` Scene), `y` row 0–8 (`y=0` top of the 8 × 8, increasing downward, `y=8` Automap drawn above). `(8,8)` does not exist.
- Out-of-range and `(8,8)`: `setColor()` is a no-op, `getColor()` returns `undefined`, both warn only when `debug` is set.
- Canonical colour strings: `off`, `red`, `red medium`, `red low`, and the same for `green`, `amber`, `yellow`. **Full brightness formats as the bare hue.** Any level `0` normalises to `off`. Yellow clamps to full.
- CSS tokens: `--granite-launchpad-<hue>-<low|medium|full>` for red, green and amber, `--granite-launchpad-yellow-full`, plus `--granite-launchpad-off`. 11 in total: yellow has one level because the hardware cannot dim it.
- Events `pad-press` and `pad-release`, both `bubbles: true, composed: true`, `detail: {x, y, color}`.
- ESM only. No Rollup, no `dist/`, no build step. `"type": "module"`.
- Prose in README, CHANGELOG and commit messages uses the spaced en-dash `–`, never `—`.
- Every element module self-registers behind a `customElements.get()` guard.
- Node 20 is the floor. CI matrix 20, 22, 24, 26; releases publish from 24.

---

### Task 1: Scaffolding and the colour module

Clears the Polymer files, stands up the package and the browser test runner, and lands the one pure module everything else depends on.

**Files:**
- Delete: `bower.json`, `polymer.json`, `granite-launchpad.html`, `granite-launchpad-switch.html`, `index.html`, `demo/index.html`, `.eslintrc.json`
- Create: `package.json`, `.gitignore`, `web-test-runner.config.js`, `src/lib/colors.js`, `.github/workflows/ci.yml`
- Test: `spec/colors.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `HUES: string[]` – `['red', 'green', 'amber', 'yellow']`
  - `LEVELS: Record<string, number>` – `{off: 0, low: 1, medium: 2, full: 3}`
  - `parseColor(value, {debug = false} = {}): {hue: string, level: number}` – `hue` is a member of `HUES` or `'off'`; when `hue === 'off'`, `level === 0`
  - `formatColor({hue, level}): string` – the canonical string
  - `normalizeColor(value, {debug} = {}): string` – `formatColor(parseColor(value, opts))`

- [ ] **Step 1: Remove the Polymer files and stop ignoring bower**

```bash
cd /Users/horacio/git/node/granite-multicolor-pad-board
git rm -q bower.json polymer.json granite-launchpad.html \
  granite-launchpad-switch.html index.html demo/index.html .eslintrc.json
printf 'node_modules/\n.DS_Store\n*.tgz\n' > .gitignore
```

- [ ] **Step 2: Write package.json**

`launchpad-webmidi` is a plain dependency, not a peer. Only `twin.js` imports it, so the board never loads MIDI code, but keeping it a normal dependency means `npm install` just works.

```json
{
  "name": "@granite-elements/granite-launchpad",
  "version": "1.0.0",
  "description": "Lit web components mimicking a Novation Launchpad Mini board, with a digital twin of a real one",
  "type": "module",
  "main": "index.js",
  "module": "index.js",
  "exports": {
    ".": "./index.js",
    "./twin.js": "./twin.js",
    "./src/*": "./src/*",
    "./package.json": "./package.json"
  },
  "files": [
    "src",
    "index.js",
    "twin.js",
    "CHANGELOG.md",
    "LICENCE.md",
    "README.md"
  ],
  "scripts": {
    "test": "wtr",
    "test:watch": "wtr --watch"
  },
  "keywords": [
    "launchpad",
    "launchpad-mini",
    "novation",
    "midi",
    "webmidi",
    "web-components",
    "lit",
    "custom-elements",
    "digital-twin"
  ],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/LostInBrittany/granite-launchpad.git"
  },
  "homepage": "https://github.com/LostInBrittany/granite-launchpad#readme",
  "bugs": {
    "url": "https://github.com/LostInBrittany/granite-launchpad/issues"
  },
  "author": "Horacio Gonzalez <horacio.gonzalez@gmail.com>",
  "license": "MIT",
  "engines": {
    "node": ">=20"
  },
  "dependencies": {
    "lit": "^3.3.3",
    "launchpad-webmidi": "^2.0.0"
  },
  "devDependencies": {
    "@open-wc/testing": "^5.0.0",
    "@web/test-runner": "^1.0.0",
    "@web/test-runner-playwright": "^1.0.0",
    "playwright": "^1.63.0"
  }
}
```

- [ ] **Step 3: Write the test runner config**

`nodeResolve` is what lets the specs and the source import `lit` and `launchpad-webmidi` by bare specifier in the browser.

```js
// web-test-runner.config.js
import { playwrightLauncher } from '@web/test-runner-playwright';

export default {
  files: 'spec/**/*.test.js',
  nodeResolve: true,
  browsers: [ playwrightLauncher( { product: 'chromium' } ) ],
};
```

- [ ] **Step 4: Install**

```bash
npm install
npx playwright install chromium
```

- [ ] **Step 5: Write the failing colour test**

```js
// spec/colors.test.js
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
```

- [ ] **Step 6: Run the test and watch it fail**

Run: `npm test`
Expected: FAIL – `Failed to fetch dynamically imported module` / `../src/lib/colors.js` does not exist.

- [ ] **Step 7: Write the colour module**

```js
// src/lib/colors.js

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
```

- [ ] **Step 8: Run the test and watch it pass**

Run: `npm test`
Expected: PASS, 14 tests.

- [ ] **Step 9: Write the CI workflow**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [master]
  pull_request:
  # Weekly, so a browser or Node release breaking the suite surfaces on its own
  # rather than at the moment someone tries to cut a release.
  schedule:
    - cron: '0 6 * * 1'

permissions:
  contents: read

jobs:
  test:
    name: Tests (Node ${{ matrix.node }})
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        # 20 is the floor declared in engines, 22 and 24 are the LTS lines, 26
        # is Current. 24 matters most: it is what publish.yml uses.
        node: ['20', '22', '24', '26']
    steps:
      - uses: actions/checkout@v5

      - uses: actions/setup-node@v5
        with:
          node-version: ${{ matrix.node }}

      - run: npm ci

      # The suite runs in a real browser, so the browser is part of the setup.
      - run: npx playwright install --with-deps chromium

      - run: npm test
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Scaffold the Lit package and add the colour module

The Polymer 2 element set goes: HTML Imports were removed from Chrome 73
and bower.json was the only manifest, so none of it has run in a browser
since 2019.

In its place, the package manifest, a web-test-runner suite on Playwright
Chromium, and src/lib/colors.js – the one module that turns a colour
string into a hue and a brightness level. Full brightness is written as
the bare hue, so every colour string the old element accepted still means
what it meant. Yellow clamps to full because the hardware cannot dim it."
```

---

### Task 2: `<granite-launchpad-pad>` – rendering and colour

The pad as a lit rectangle. No interaction yet.

**Files:**
- Create: `src/granite-launchpad-pad.js`
- Test: `spec/granite-launchpad-pad.test.js`

**Interfaces:**
- Consumes: `parseColor`, `formatColor`, `normalizeColor`, `HUES` from `src/lib/colors.js`.
- Produces: class `GraniteLaunchpadPad extends LitElement`, registered as `granite-launchpad-pad`. Properties `color: String` (canonical; the attribute is written in `willUpdate()`, not by Lit's `reflect`), `x: Number`, `y: Number`, `round: Boolean` (reflected by Lit), `disabled: Boolean` (reflected by Lit), `debug: Boolean`, `label: String`. `round` and `disabled` keep `reflect: true` because a boolean's `fromAttribute` is its own fixed point, which is exactly the case Lit's reflection guard was written for.

- [ ] **Step 1: Write the failing test**

```js
// spec/granite-launchpad-pad.test.js
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
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm test`
Expected: FAIL – `src/granite-launchpad-pad.js` does not exist.

- [ ] **Step 3: Write the element**

Colour reaches CSS through attribute selectors on the canonical string rather than an inline custom property: the selectors are static, which means no per-pad inline style work when 80 pads repaint at MIDI rate.

The `color` attribute is written by hand in `willUpdate()` rather than through
Lit's `reflect: true`. Lit suppresses property-to-attribute reflection while it
is processing an attribute-to-property change, which is correct for a property
whose `fromAttribute` is its own fixed point, and wrong for this one: `color`
canonicalises, so `color="red full"` yields the property `'red'` while the
attribute stays `'red full'` and nothing ever reconciles them. The CSS selects
on that attribute, so the pad would render unstyled. Writing it in `willUpdate()`
is public API and converges in one pass – the write re-enters the setter, which
canonicalises to the same value and requests no further update.

```js
// src/granite-launchpad-pad.js
import { LitElement, css, html } from 'lit';
import { parseColor, formatColor } from './lib/colors.js';

/**
 * A single Launchpad pad.
 *
 * @element granite-launchpad-pad
 * @fires pad-press
 * @fires pad-release
 * @cssprop --granite-launchpad-pad-size - Side of the pad, default 2.5rem
 * @cssprop --granite-launchpad-off - Colour of an unlit pad
 * @cssprop --granite-launchpad-red-full - and -medium, -low, and the same for
 *   green, amber and yellow
 * @cssprop --granite-launchpad-glow - Bloom applied at full brightness, unset
 *   by default
 */
export class GraniteLaunchpadPad extends LitElement {
  static properties = {
    color: { type: String },
    x: { type: Number },
    y: { type: Number },
    round: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    debug: { type: Boolean },
    label: { type: String },
  };

  static styles = css`
    /* Every colour default lives in its var() fallback, never as a
       declaration on :host. A declaration on the host sits on the pad itself
       and beats anything inherited into it, so tokens set on a wrapping board,
       twin or body would be silently ignored - the tokens would be themeable
       only by a rule matching granite-launchpad-pad. With the default in the
       fallback there is nothing to beat and the token inherits normally.
       Yellow has no low or medium: parseColor clamps it to full. */
    :host {
      display: block;
      box-sizing: border-box;
      width: var(--granite-launchpad-pad-size, 2.5rem);
      height: var(--granite-launchpad-pad-size, 2.5rem);
      border-radius: 0.2rem;
      background: var(--granite-launchpad-off, #2b2b2f);
      /* Without this the browser claims the gesture for scrolling and the
         pointerup never arrives. */
      touch-action: none;
      cursor: pointer;
      transition: background 60ms linear;
    }

    :host([round]) {
      border-radius: 50%;
    }

    :host([disabled]) {
      cursor: default;
      opacity: 0.4;
    }

    :host(:focus-visible) {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }

    :host([color='red']) { background: var(--granite-launchpad-red-full, #ff3b2f); box-shadow: var(--granite-launchpad-glow, none); }
    :host([color='red medium']) { background: var(--granite-launchpad-red-medium, #9c2a22); }
    :host([color='red low']) { background: var(--granite-launchpad-red-low, #4a1512); }
    :host([color='green']) { background: var(--granite-launchpad-green-full, #35d94f); box-shadow: var(--granite-launchpad-glow, none); }
    :host([color='green medium']) { background: var(--granite-launchpad-green-medium, #227a33); }
    :host([color='green low']) { background: var(--granite-launchpad-green-low, #123f1c); }
    :host([color='amber']) { background: var(--granite-launchpad-amber-full, #ffae2f); box-shadow: var(--granite-launchpad-glow, none); }
    :host([color='amber medium']) { background: var(--granite-launchpad-amber-medium, #9c6c1e); }
    :host([color='amber low']) { background: var(--granite-launchpad-amber-low, #4a3410); }
    :host([color='yellow']) { background: var(--granite-launchpad-yellow-full, #ffe94f); box-shadow: var(--granite-launchpad-glow, none); }
  `;

  #color = 'off';

  constructor() {
    super();
    this.round = false;
    this.disabled = false;
    this.debug = false;
    this.color = 'off';
  }

  /** @param {String} value Any colour string; stored in canonical form. */
  set color( value ) {
    const previous = this.#color;
    this.#color = formatColor( parseColor( value, { debug: this.debug } ) );
    this.requestUpdate( 'color', previous );
  }

  get color() {
    return this.#color;
  }

  willUpdate() {
    // Not `reflect: true`: Lit suppresses reflection while it handles an
    // attribute-to-property change, so a canonicalising property would leave
    // the attribute holding the uncanonicalised string the CSS cannot match.
    if ( this.getAttribute( 'color' ) !== this.#color ) {
      this.setAttribute( 'color', this.#color );
    }
  }

  render() {
    return html``;
  }
}

if ( !customElements.get( 'granite-launchpad-pad' ) ) {
  customElements.define( 'granite-launchpad-pad', GraniteLaunchpadPad );
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npm test`
Expected: PASS, 14 + 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/granite-launchpad-pad.js spec/granite-launchpad-pad.test.js
git commit -m "Add granite-launchpad-pad rendering

The pad stores its colour in canonical form and reflects it, so CSS can
select on it directly. Thirteen static rules cost nothing per repaint,
where an inline custom property would mean per-pad style work every time
eighty pads change at MIDI rate.

Yellow gets one colour at all three levels, matching hardware that cannot
dim it."
```

---

### Task 3: `<granite-launchpad-pad>` – interaction

Pointer, touch, keyboard, ARIA. This is the gap the 2018 element never filled: it listened for `mousedown`, `mouseup` and `mouseout` only.

**Files:**
- Modify: `src/granite-launchpad-pad.js`
- Test: `spec/granite-launchpad-pad.test.js` (append)

**Interfaces:**
- Consumes: `GraniteLaunchpadPad` from Task 2.
- Produces: `pad-press` and `pad-release` `CustomEvent`s, `bubbles: true, composed: true`, `detail: {x, y, color}`.

- [ ] **Step 1: Write the failing tests**

Append to `spec/granite-launchpad-pad.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npm test`
Expected: FAIL – no `pad-press` is ever emitted, and `role` is absent.

- [ ] **Step 3: Add interaction to the element**

`setPointerCapture()` is what makes the 2018 `_onSwitchOut` workaround unnecessary: a pointer released anywhere still delivers `pointerup` to the pad that captured it.

Add to the class body of `src/granite-launchpad-pad.js`:

```js
  #pressed = false;

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener( 'pointerdown', this.#onPointerDown );
    this.addEventListener( 'pointerup', this.#onPointerUp );
    this.addEventListener( 'pointercancel', this.#onPointerUp );
    this.addEventListener( 'keydown', this.#onKeyDown );
    this.addEventListener( 'keyup', this.#onKeyUp );
    this.addEventListener( 'blur', this.#onBlur );
  }

  disconnectedCallback() {
    // A detached pad cannot receive the pointerup or keyup that would release
    // it, so clear the flag here. Otherwise the same element instance,
    // reattached, would emit a pad-release with no matching pad-press and
    // swallow the pointerdown that should have started the next press.
    this.#pressed = false;
    this.removeEventListener( 'pointerdown', this.#onPointerDown );
    this.removeEventListener( 'pointerup', this.#onPointerUp );
    this.removeEventListener( 'pointercancel', this.#onPointerUp );
    this.removeEventListener( 'keydown', this.#onKeyDown );
    this.removeEventListener( 'keyup', this.#onKeyUp );
    this.removeEventListener( 'blur', this.#onBlur );
    super.disconnectedCallback();
  }

  willUpdate() {
    // Task 2 established this method for the colour attribute; the ARIA
    // attributes join it rather than replacing it.
    if ( this.getAttribute( 'color' ) !== this.color ) {
      this.setAttribute( 'color', this.color );
    }
    this.setAttribute( 'role', 'button' );
    this.setAttribute( 'tabindex', this.disabled ? '-1' : '0' );
    this.setAttribute( 'aria-label', this.label ?? this.#positionLabel() );
    if ( this.disabled ) {
      this.setAttribute( 'aria-disabled', 'true' );
    } else {
      this.removeAttribute( 'aria-disabled' );
    }
  }

  #positionLabel() {
    if ( this.x === undefined || this.y === undefined ) {
      return 'Pad';
    }
    if ( this.y === 8 ) {
      return `Automap ${ this.x }`;
    }
    if ( this.x === 8 ) {
      return `Scene ${ this.y }`;
    }
    return `Pad ${ this.x },${ this.y }`;
  }

  #press() {
    if ( this.disabled || this.#pressed ) {
      return;
    }
    this.#pressed = true;
    this.#emit( 'pad-press' );
  }

  #release() {
    if ( !this.#pressed ) {
      return;
    }
    this.#pressed = false;
    this.#emit( 'pad-release' );
  }

  #emit( type ) {
    this.dispatchEvent( new CustomEvent( type, {
      bubbles: true,
      composed: true,
      detail: { x: this.x, y: this.y, color: this.color },
    } ) );
  }

  #onPointerDown = ( event ) => {
    if ( this.disabled ) {
      return;
    }
    // Capture so a pointer released outside this pad still releases it. The
    // 2018 element watched mouseout instead, which missed touch entirely.
    try {
      this.setPointerCapture( event.pointerId );
    } catch {
      // A synthetic PointerEvent has no real pointer to capture.
    }
    this.#press();
  };

  #onPointerUp = ( event ) => {
    if ( this.hasPointerCapture?.( event.pointerId ) ) {
      this.releasePointerCapture( event.pointerId );
    }
    this.#release();
  };

  #onKeyDown = ( event ) => {
    if ( event.key !== ' ' && event.key !== 'Enter' ) {
      return;
    }
    event.preventDefault();
    if ( event.repeat ) {
      return;
    }
    this.#press();
  };

  #onKeyUp = ( event ) => {
    if ( event.key !== ' ' && event.key !== 'Enter' ) {
      return;
    }
    this.#release();
  };

  #onBlur = () => this.#release();
```

Leave `render()` returning an empty template. The host element *is* the pad, so
there is nothing inside it to draw.

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm test`
Expected: PASS, 14 + 7 + 14 tests.

- [ ] **Step 5: Commit**

```bash
git add src/granite-launchpad-pad.js spec/granite-launchpad-pad.test.js
git commit -m "Give the pad pointer, touch and keyboard input

The 2018 element listened for mousedown, mouseup and mouseout, so a twin
of a touch controller did not work on a touch device and could not be
played without a mouse.

Pointer Events cover mouse, touch and pen in one path, and
setPointerCapture makes the old mouseout workaround unnecessary: a
pointer released anywhere still releases the pad that captured it.
touch-action: none stops the browser claiming the gesture for scrolling.

Space and Enter play the pad, blur while held releases it, and the pad
carries role, tabindex and a positional aria-label."
```

---

### Task 4: `<granite-launchpad-board>`

**Files:**
- Create: `src/granite-launchpad-board.js`
- Test: `spec/granite-launchpad-board.test.js`

**Interfaces:**
- Consumes: `granite-launchpad-pad` (Task 2, 3), `normalizeColor` from `src/lib/colors.js`.
- Produces: class `GraniteLaunchpadBoard extends LitElement`, registered as `granite-launchpad-board`, with:
  - `setColor(x: Number, y: Number, color: String): void`
  - `setColors(entries: Array<[Number, Number, String]>): void`
  - `getColor(x: Number, y: Number): String | undefined`
  - `reset(): void`
  - `padAt(x: Number, y: Number): GraniteLaunchpadPad | undefined`
  - property `debug: Boolean`

- [ ] **Step 1: Write the failing test**

```js
// spec/granite-launchpad-board.test.js
import { expect, fixture, html, elementUpdated, oneEvent } from '@open-wc/testing';
import '../src/granite-launchpad-board.js';

const board = () => fixture( html`<granite-launchpad-board></granite-launchpad-board>` );

describe( 'granite-launchpad-board layout', () => {
  it( 'renders eighty pads - nine by nine less the dead corner', async () => {
    const el = await board();
    expect( el.renderRoot.querySelectorAll( 'granite-launchpad-pad' ).length ).to.equal( 80 );
  } );

  it( 'has no pad at the corner', async () => {
    const el = await board();
    expect( el.padAt( 8, 8 ) ).to.be.undefined;
  } );

  it( 'places every coordinate exactly once', async () => {
    const el = await board();
    for ( let y = 0; y <= 8; y += 1 ) {
      for ( let x = 0; x <= 8; x += 1 ) {
        if ( x === 8 && y === 8 ) continue;
        expect( el.padAt( x, y ), `${ x },${ y }` ).to.exist;
      }
    }
  } );

  it( 'rounds the Automap row and the Scene column only', async () => {
    const el = await board();
    expect( el.padAt( 3, 8 ).round ).to.be.true;
    expect( el.padAt( 8, 3 ).round ).to.be.true;
    expect( el.padAt( 3, 3 ).round ).to.be.false;
  } );

  it( 'draws the Automap row above the grid and Scene to its right', async () => {
    const el = await board();
    const topLeft = el.padAt( 0, 8 ).getBoundingClientRect();
    const gridTopLeft = el.padAt( 0, 0 ).getBoundingClientRect();
    const sceneTop = el.padAt( 8, 0 ).getBoundingClientRect();
    expect( topLeft.top ).to.be.below( gridTopLeft.top );
    expect( sceneTop.left ).to.be.above( gridTopLeft.left );
  } );
} );

describe( 'granite-launchpad-board colours', () => {
  it( 'starts entirely off', async () => {
    const el = await board();
    expect( el.getColor( 0, 0 ) ).to.equal( 'off' );
    expect( el.getColor( 8, 0 ) ).to.equal( 'off' );
    expect( el.getColor( 0, 8 ) ).to.equal( 'off' );
  } );

  it( 'round-trips a colour', async () => {
    const el = await board();
    el.setColor( 3, 5, 'amber medium' );
    expect( el.getColor( 3, 5 ) ).to.equal( 'amber medium' );
  } );

  it( 'canonicalises on the way in', async () => {
    const el = await board();
    el.setColor( 0, 0, 'red full' );
    expect( el.getColor( 0, 0 ) ).to.equal( 'red' );
  } );

  it( 'paints the pad it names', async () => {
    const el = await board();
    el.setColor( 3, 5, 'green low' );
    await elementUpdated( el );
    expect( el.padAt( 3, 5 ).color ).to.equal( 'green low' );
    expect( el.padAt( 5, 3 ).color ).to.equal( 'off' );
  } );

  it( 'reaches the Automap row and the Scene column', async () => {
    const el = await board();
    el.setColor( 2, 8, 'red' );
    el.setColor( 8, 2, 'green' );
    await elementUpdated( el );
    expect( el.padAt( 2, 8 ).color ).to.equal( 'red' );
    expect( el.padAt( 8, 2 ).color ).to.equal( 'green' );
  } );

  it( 'applies a batch in the shape launchpad-webmidi uses', async () => {
    const el = await board();
    el.setColors( [ [ 0, 0, 'red' ], [ 1, 1, 'green low' ], [ 8, 8, 'red' ] ] );
    await elementUpdated( el );
    expect( el.getColor( 0, 0 ) ).to.equal( 'red' );
    expect( el.getColor( 1, 1 ) ).to.equal( 'green low' );
  } );

  it( 'clears', async () => {
    const el = await board();
    el.setColors( [ [ 0, 0, 'red' ], [ 4, 4, 'green' ] ] );
    el.reset();
    await elementUpdated( el );
    expect( el.getColor( 0, 0 ) ).to.equal( 'off' );
    expect( el.padAt( 4, 4 ).color ).to.equal( 'off' );
  } );

  it( 'warns on both reads and writes off the board, but only when debug is set', async () => {
    const quiet = await board();
    const loud = await fixture( html`<granite-launchpad-board debug></granite-launchpad-board>` );
    const original = console.warn;
    const warnings = [];
    console.warn = ( ...args ) => warnings.push( args.join( ' ' ) );
    try {
      quiet.setColor( 8, 8, 'red' );
      quiet.getColor( 8, 8 );
      expect( warnings, 'silent without debug' ).to.be.empty;

      loud.setColor( 8, 8, 'red' );
      expect( warnings ).to.have.lengthOf( 1 );
      loud.getColor( 8, 8 );
      expect( warnings, 'a read off the board warns too' ).to.have.lengthOf( 2 );
    } finally {
      console.warn = original;
    }
  } );

  it( 'ignores coordinates that are not on the board', async () => {
    const el = await board();
    for ( const [ x, y ] of [ [ -1, 0 ], [ 0, -1 ], [ 9, 0 ], [ 0, 9 ], [ 8, 8 ] ] ) {
      expect( () => el.setColor( x, y, 'red' ), `${ x },${ y }` ).to.not.throw();
      expect( el.getColor( x, y ), `${ x },${ y }` ).to.be.undefined;
    }
  } );
} );

describe( 'granite-launchpad-board events', () => {
  it( 'lets a pad press through with its coordinates', async () => {
    const el = await board();
    el.setColor( 3, 5, 'red' );
    await elementUpdated( el );
    const pad = el.padAt( 3, 5 );
    setTimeout( () => pad.dispatchEvent(
      new PointerEvent( 'pointerdown', { pointerId: 1, bubbles: true, composed: true } ) ) );
    const { detail } = await oneEvent( el, 'pad-press' );
    expect( detail ).to.deep.equal( { x: 3, y: 5, color: 'red' } );
  } );

  it( 'delivers each press once, not twice', async () => {
    const el = await board();
    await elementUpdated( el );
    let count = 0;
    el.addEventListener( 'pad-press', () => { count += 1; } );
    el.padAt( 0, 0 ).dispatchEvent(
      new PointerEvent( 'pointerdown', { pointerId: 1, bubbles: true, composed: true } ) );
    expect( count ).to.equal( 1 );
  } );
} );
```

The "once, not twice" test is the regression guard for the defect the spec self-review caught: pad events are `composed` and retarget to the board host by themselves, so a board that also re-dispatched them would double every press.

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npm test`
Expected: FAIL – `src/granite-launchpad-board.js` does not exist.

- [ ] **Step 3: Write the element**

```js
// src/granite-launchpad-board.js
import { LitElement, css, html } from 'lit';
import { normalizeColor } from './lib/colors.js';
import './granite-launchpad-pad.js';

/**
 * The cells of the board in render order: the Automap row, the empty corner,
 * then each of the eight rows followed by its Scene button. `null` is the
 * corner, which has no pad.
 *
 * @type {Array<[Number, Number]|null>}
 */
const CELLS = ( () => {
  const cells = [];
  for ( let x = 0; x < 8; x += 1 ) {
    cells.push( [ x, 8 ] );
  }
  cells.push( null );
  for ( let y = 0; y < 8; y += 1 ) {
    for ( let x = 0; x < 8; x += 1 ) {
      cells.push( [ x, y ] );
    }
    cells.push( [ 8, y ] );
  }
  return cells;
} )();

const index = ( x, y ) => y * 9 + x;

const onBoard = ( x, y ) =>
  Number.isInteger( x ) && Number.isInteger( y ) &&
  x >= 0 && x <= 8 && y >= 0 && y <= 8 &&
  !( x === 8 && y === 8 );

/**
 * A Launchpad Mini board: eight by eight pads, the Automap row above and the
 * Scene column to the right.
 *
 * @element granite-launchpad-board
 * @fires pad-press - Retargeted from the pad, never re-dispatched
 * @fires pad-release
 * @cssprop --granite-launchpad-pad-size
 * @cssprop --granite-launchpad-gap - Space between pads, default 0.3rem
 */
export class GraniteLaunchpadBoard extends LitElement {
  static properties = {
    debug: { type: Boolean },
  };

  static styles = css`
    :host {
      display: inline-block;
    }

    #grid {
      display: grid;
      grid-template-columns: repeat(9, auto);
      grid-template-rows: repeat(9, auto);
      gap: var(--granite-launchpad-gap, 0.3rem);
    }

    .corner {
      /* The Launchpad has no button here. */
      visibility: hidden;
    }
  `;

  /** @type {String[]} Canonical colours, indexed y * 9 + x. */
  #colors = new Array( 81 ).fill( 'off' );

  constructor() {
    super();
    this.debug = false;
  }

  render() {
    return html`
      <div id="grid">
        ${ CELLS.map( ( cell ) => cell === null
          ? html`<div class="corner"></div>`
          : html`<granite-launchpad-pad
              data-xy=${ `${ cell[ 0 ] },${ cell[ 1 ] }` }
              .x=${ cell[ 0 ] }
              .y=${ cell[ 1 ] }
              color=${ this.#colors[ index( cell[ 0 ], cell[ 1 ] ) ] }
              ?round=${ cell[ 0 ] === 8 || cell[ 1 ] === 8 }
              ?debug=${ this.debug }
            ></granite-launchpad-pad>` ) }
      </div>
    `;
  }

  /**
   * @param {Number} x Column, 0-8, where 8 is the Scene column
   * @param {Number} y Row, 0-8, where 8 is the Automap row
   * @param {String} color Any colour string
   */
  #warnOffBoard( x, y ) {
    if ( this.debug ) {
      console.warn( `[granite-launchpad-board] no pad at ${ x },${ y }` );
    }
  }

  setColor( x, y, color ) {
    if ( !onBoard( x, y ) ) {
      this.#warnOffBoard( x, y );
      return;
    }
    this.#colors[ index( x, y ) ] = normalizeColor( color, { debug: this.debug } );
    this.requestUpdate();
  }

  /**
   * @param {Array<[Number, Number, String]>} entries The shape
   *   launchpad-webmidi's setColors() takes
   */
  setColors( entries ) {
    for ( const [ x, y, color ] of entries ) {
      this.setColor( x, y, color );
    }
  }

  /**
   * @param {Number} x
   * @param {Number} y
   * @return {String|undefined} The canonical colour, or undefined off the board
   */
  getColor( x, y ) {
    if ( !onBoard( x, y ) ) {
      this.#warnOffBoard( x, y );
      return undefined;
    }
    return this.#colors[ index( x, y ) ];
  }

  /** Turn every pad off. */
  reset() {
    this.#colors.fill( 'off' );
    this.requestUpdate();
  }

  /**
   * @param {Number} x
   * @param {Number} y
   * @return {import('./granite-launchpad-pad.js').GraniteLaunchpadPad|undefined}
   */
  padAt( x, y ) {
    if ( !onBoard( x, y ) ) {
      return undefined;
    }
    return this.renderRoot?.querySelector( `granite-launchpad-pad[data-xy="${ x },${ y }"]` ) ?? undefined;
  }
}

if ( !customElements.get( 'granite-launchpad-board' ) ) {
  customElements.define( 'granite-launchpad-board', GraniteLaunchpadBoard );
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm test`
Expected: PASS, all three spec files.

- [ ] **Step 5: Commit**

```bash
git add src/granite-launchpad-board.js spec/granite-launchpad-board.test.js
git commit -m "Add granite-launchpad-board

One nine by nine CSS Grid with the corner cell left empty, replacing the
three hand-aligned grids of the 2018 element – which is why every
dimension there was frozen at 50px.

Coordinates are (x, y), matching launchpad-webmidi, so setColor(x, y, c)
and pad.col(c, [x, y]) address the same button. The 2018 element took
(row, column) and every integration paid the swap.

Off the board, setColor is a no-op and getColor returns undefined. The
old guard was i == j == 8, which JavaScript reads as (i == j) == 8, so it
never fired.

The board neither listens for nor re-dispatches pad events: they are
composed and retarget to the host on their own. A test guards against
the double delivery that re-dispatching would cause."
```

---

### Task 5: `<granite-launchpad>` – the twin

**Files:**
- Create: `src/granite-launchpad.js`, `spec/helpers/fake-launchpad.js`
- Test: `spec/granite-launchpad.test.js`

**Interfaces:**
- Consumes: `granite-launchpad-board` (Task 4), `parseColor` from `src/lib/colors.js`, `Launchpad` (default export) from `launchpad-webmidi`.
- Produces: class `GraniteLaunchpad extends LitElement`, registered as `granite-launchpad`, with `connect(): Promise<Boolean>`, `disconnect(): void`, `setColor`, `setColors`, `getColor`, `reset`, getter `board`, properties `autoConnect: Boolean` (attribute `auto-connect`), `launchpad: Object`, `state: String` (reflected), `error: *`, `debug: Boolean`.

- [ ] **Step 1: Write the fake**

It mirrors only what the twin touches: the colour objects, `connect()`, `col()` and `on()`.

`launchpad-webmidi` 2.0.0 publishes `dist/` only, so its `lib/colors.js` is not
reachable from an installed copy. The palette comes off a `Launchpad` instance
instead, which exposes `red`, `green`, `amber`, `yellow` and `off` as `Color`
objects – see `launchpad-webmidi.js:72-84`.

```js
// spec/helpers/fake-launchpad.js
import Launchpad from 'launchpad-webmidi';

const palette = new Launchpad();

/**
 * Stands in for a Launchpad. Records every col() call and lets a test push
 * key events as if the hardware had sent them.
 */
export class FakeLaunchpad {
  constructor( { failWith = null } = {} ) {
    this._colError = null;
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
    // MIDIOutput.send() throws synchronously once the port is gone, and
    // launchpad-webmidi's sendRaw() calls it directly, so this is what a
    // Launchpad unplugged mid-session actually looks like to the twin.
    if ( this._colError ) {
      throw this._colError;
    }
    this.calls.push( { color, buttons } );
    return Promise.resolve( true );
  }

  /** Make every later col() throw, as an unplugged Launchpad does. */
  breakOutput( error ) {
    this._colError = error;
  }

  /** Push a key event as the hardware would. */
  press( x, y, pressed ) {
    for ( const callback of this._handlers.key || [] ) {
      callback( { x, y, pressed } );
    }
  }
}
```

- [ ] **Step 2: Write the failing test**

```js
// spec/granite-launchpad.test.js
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

  it( 'clears both sides', async () => {
    const fake = new FakeLaunchpad();
    const el = await twinWith( fake );
    await el.connect();
    el.setColor( 4, 4, 'red' );
    fake.calls.length = 0;
    el.reset();
    await elementUpdated( el );
    expect( el.board.getColor( 4, 4 ) ).to.equal( 'off' );
    expect( fake.calls ).to.have.lengthOf( 80 );
  } );
} );
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `npm test`
Expected: FAIL – `src/granite-launchpad.js` does not exist.

- [ ] **Step 4: Write the twin**

```js
// src/granite-launchpad.js
import { LitElement, css, html } from 'lit';
import Launchpad from 'launchpad-webmidi';
import { parseColor } from './lib/colors.js';
import './granite-launchpad-board.js';

/**
 * A board mirrored against a real Launchpad.
 *
 * The hardware reports presses, never colours, and a press changes no colour on
 * either side - lighting a pad in response is the application's job. So colour
 * only ever travels outward from a method call here, and no mirrored event can
 * feed back on itself.
 *
 * @element granite-launchpad
 * @fires launchpad-connect
 * @fires launchpad-disconnect
 * @fires launchpad-error
 * @fires pad-press - From the board, or raised here for a hardware press
 * @fires pad-release
 */
export class GraniteLaunchpad extends LitElement {
  static properties = {
    autoConnect: { type: Boolean, attribute: 'auto-connect' },
    launchpad: { type: Object },
    state: { type: String, reflect: true },
    error: { type: Object },
    debug: { type: Boolean },
  };

  static styles = css`
    :host {
      display: inline-block;
    }
  `;

  #listening = false;

  constructor() {
    super();
    this.autoConnect = false;
    this.launchpad = null;
    this.state = 'idle';
    this.error = null;
    this.debug = false;
  }

  /**
   * The board being mirrored: the first slotted one, or the fallback rendered
   * inside the slot when nothing is slotted.
   *
   * @return {import('./granite-launchpad-board.js').GraniteLaunchpadBoard|undefined}
   */
  get board() {
    const slot = this.renderRoot?.querySelector( 'slot' );
    const slotted = slot
      ?.assignedElements( { flatten: true } )
      .find( ( el ) => el.localName === 'granite-launchpad-board' );
    return slotted ?? this.renderRoot?.querySelector( 'granite-launchpad-board' ) ?? undefined;
  }

  render() {
    return html`
      <slot>
        <granite-launchpad-board ?debug=${ this.debug }></granite-launchpad-board>
      </slot>
    `;
  }

  firstUpdated() {
    if ( !this.autoConnect ) {
      return;
    }
    // connect() sets `state`, which is reactive. Setting it from inside
    // firstUpdated schedules a second update from within the first, and Lit
    // warns about that in dev builds (lit.dev/msg/change-in-update) - a
    // warning every consumer of this component would see in their console.
    // Waiting for the current update to finish costs nothing: a real
    // connect() is a Web MIDI permission request, orders of magnitude longer
    // than an update cycle.
    this.updateComplete.then( () => this.connect() );
  }

  /**
   * Connect to the hardware. Resolves false rather than rejecting, so a page
   * without Web MIDI, without a board or without permission is a state to
   * render rather than an unhandled rejection.
   *
   * @return {Promise<Boolean>}
   */
  async connect() {
    this.state = 'connecting';
    this.error = null;

    if ( !this.launchpad ) {
      this.launchpad = new Launchpad();
    }

    try {
      await this.launchpad.connect();
    } catch ( error ) {
      this.state = 'error';
      this.error = error;
      if ( this.debug ) {
        console.warn( '[granite-launchpad] could not connect:', error );
      }
      this.#fire( 'launchpad-error', { error } );
      return false;
    }

    if ( !this.#listening ) {
      this.launchpad.on( 'key', this.#onKey );
      this.#listening = true;
    }
    this.state = 'connected';
    this.#fire( 'launchpad-connect', { launchpad: this.launchpad } );
    return true;
  }

  /**
   * Stop mirroring. launchpad-webmidi's Observable has on() and emit() but no
   * off(), so the handler cannot be removed - it is guarded on state instead.
   */
  disconnect() {
    this.state = 'idle';
    this.#fire( 'launchpad-disconnect', {} );
  }

  /**
   * @param {Number} x
   * @param {Number} y
   * @param {String} color
   */
  setColor( x, y, color ) {
    const board = this.board;
    if ( !board ) {
      if ( this.debug ) {
        console.warn( '[granite-launchpad] no board to paint' );
      }
      return;
    }
    // The board warns for itself when debug is set, so this does not repeat it.
    if ( board.getColor( x, y ) === undefined ) {
      return;
    }
    board.setColor( x, y, color );
    this.#send( x, y, color );
  }

  /** @param {Array<[Number, Number, String]>} entries */
  setColors( entries ) {
    for ( const [ x, y, color ] of entries ) {
      this.setColor( x, y, color );
    }
  }

  /**
   * @param {Number} x
   * @param {Number} y
   * @return {String|undefined}
   */
  getColor( x, y ) {
    return this.board?.getColor( x, y );
  }

  /** Turn every pad off, on screen and on the hardware. */
  reset() {
    for ( let y = 0; y <= 8; y += 1 ) {
      for ( let x = 0; x <= 8; x += 1 ) {
        if ( x === 8 && y === 8 ) {
          continue;
        }
        this.setColor( x, y, 'off' );
      }
    }
  }

  #send( x, y, color ) {
    if ( this.state !== 'connected' || !this.launchpad ) {
      return;
    }
    const { hue, level } = parseColor( color, { debug: this.debug } );
    const value = hue === 'off' ? this.launchpad.off : this.launchpad[ hue ].level( level );
    try {
      this.launchpad.col( value, [ x, y ] );
    } catch ( error ) {
      // launchpad-webmidi's sendRaw() is a bare MIDIOutput.send(), which
      // throws synchronously once the port is gone - a Launchpad unplugged
      // mid-session. Without this, every setColor() after that would throw at
      // the page, having already painted the board.
      //
      // The board keeps working on screen, the page is told once, and later
      // writes skip the hardware on their own because #send returns early on
      // any state other than 'connected'.
      this.state = 'error';
      this.error = error;
      if ( this.debug ) {
        console.warn( '[granite-launchpad] lost the Launchpad:', error );
      }
      this.#fire( 'launchpad-error', { error } );
    }
  }

  #onKey = ( key ) => {
    if ( this.state !== 'connected' ) {
      return;
    }
    this.#fire( key.pressed ? 'pad-press' : 'pad-release', {
      x: key.x,
      y: key.y,
      color: this.getColor( key.x, key.y ) ?? 'off',
    } );
  };

  #fire( type, detail ) {
    this.dispatchEvent( new CustomEvent( type, { bubbles: true, composed: true, detail } ) );
  }
}

if ( !customElements.get( 'granite-launchpad' ) ) {
  customElements.define( 'granite-launchpad', GraniteLaunchpad );
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npm test`
Expected: PASS, all four spec files.

- [ ] **Step 6: Commit**

```bash
git add src/granite-launchpad.js spec/granite-launchpad.test.js spec/helpers/fake-launchpad.js
git commit -m "Add the granite-launchpad twin

The board is the slot's fallback content, so <granite-launchpad></…> is a
working twin and the slotted form exists for when the board needs its own
attributes.

Colour travels outward only: setColor paints the board and sends to the
hardware, and a press – from either side – changes nothing. That is what
keeps the mirroring loop-free.

connect() resolves false rather than rejecting, and sets state and error.
In whack-a-launchpad an unhandled connect() rejection left a blank page
and a console warning; a page can render this instead.

Observable has no off(), so disconnect() guards the key handler on state
rather than unsubscribing. The launchpad property lets tests inject a
fake and run the whole twin without hardware."
```

---

### Task 6: Entry points and packaging

**Files:**
- Create: `index.js`, `twin.js`, `.github/workflows/publish.yml`
- Modify: `.github/workflows/ci.yml` (add the package job)

**Interfaces:**
- Consumes: all three elements.
- Produces: `@granite-elements/granite-launchpad` resolving to the board and pad; `@granite-elements/granite-launchpad/twin.js` resolving to all three.

- [ ] **Step 1: Write the entry points**

```js
// index.js
export { GraniteLaunchpadPad } from './src/granite-launchpad-pad.js';
export { GraniteLaunchpadBoard } from './src/granite-launchpad-board.js';
export { parseColor, formatColor, normalizeColor, HUES, LEVELS } from './src/lib/colors.js';
```

```js
// twin.js
export * from './index.js';
export { GraniteLaunchpad } from './src/granite-launchpad.js';
```

- [ ] **Step 2: Add the package job to CI**

Append to the `jobs:` block of `.github/workflows/ci.yml`:

```yaml
  package:
    name: Package contents
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      - uses: actions/setup-node@v5
        with:
          node-version: '24'

      - run: npm ci

      # Both entry points resolve against a real install of the real tarball.
      # There is no build step here, so what breaks is a path in "files" or in
      # "exports", and only an install shows that.
      - name: Install the packed tarball and resolve both entry points
        run: |
          npm pack --pack-destination /tmp
          mkdir -p /tmp/consumer && cd /tmp/consumer
          npm init -y >/dev/null
          npm install /tmp/granite-elements-granite-launchpad-*.tgz
          node -e "
            const { createRequire } = require('node:module');
            const resolve = createRequire('/tmp/consumer/').resolve;
            for (const spec of [
              '@granite-elements/granite-launchpad',
              '@granite-elements/granite-launchpad/twin.js',
            ]) {
              console.log(spec, '->', resolve(spec));
            }
          "
          node --input-type=module -e "
            const m = await import('@granite-elements/granite-launchpad');
            for (const name of ['GraniteLaunchpadPad', 'GraniteLaunchpadBoard', 'parseColor']) {
              if (!m[name]) throw new Error(name + ' missing from the main entry point');
            }
            console.log('main entry point ok');
          "
          node --input-type=module -e "
            const m = await import('@granite-elements/granite-launchpad/twin.js');
            if (!m.GraniteLaunchpad) throw new Error('GraniteLaunchpad missing from twin.js');
            console.log('twin entry point ok');
          "

      # The board must not drag MIDI code in. Only twin.js may mention it.
      - name: The board entry point does not reach launchpad-webmidi
        run: |
          # Match the package name only where it is a module specifier, which
          # means preceded by a quote. This catches static imports, dynamic
          # import(), require() and re-exports alike, and deliberately does not
          # catch prose: these files mention launchpad-webmidi in comments to
          # explain why yellow clamps to full and where setColors' argument
          # shape comes from, and that documentation earns its place.
          if grep -rn -e "'launchpad-webmidi" -e '"launchpad-webmidi' index.js src/granite-launchpad-pad.js src/granite-launchpad-board.js src/lib/; then
            echo "The board entry point imports launchpad-webmidi; only twin.js may." >&2
            exit 1
          fi
          echo "board entry point is MIDI-free"
```

These checks import the modules under Node, which works: `lit` ships
`@lit-labs/ssr-dom-shim`, so `HTMLElement` and `customElements` both exist
outside a browser and `customElements.define()` succeeds. Verified against lit
3.3.3, so no guard beyond the `customElements.get()` one the element modules
already carry is needed.

The `require.resolve` step is separate on purpose: it proves `files` and
`exports` are right without executing anything, so a broken path reports as a
broken path rather than as whatever the first import happens to throw.

- [ ] **Step 3: Verify the tarball locally before trusting CI**

```bash
cd /Users/horacio/git/node/granite-multicolor-pad-board
npm pack --pack-destination /tmp
mkdir -p /tmp/consumer && cd /tmp/consumer && npm init -y >/dev/null
npm install /tmp/granite-elements-granite-launchpad-1.0.0.tgz
node --input-type=module -e "
  const m = await import('@granite-elements/granite-launchpad');
  console.log(Object.keys(m));
"
```
Expected: the three class names and the colour helpers, no error.

- [ ] **Step 4: Write the publish workflow**

Adapted from `launchpad-webmidi`: same trusted publishing over OIDC, minus every step about `dist/`, because there is no build. `--access public` is required – a scoped package is private by default.

```yaml
# .github/workflows/publish.yml
name: Publish to npm

# Publishing is deliberate: it happens when a GitHub release is published,
# never on a plain tag push.
on:
  release:
    types: [published]
  workflow_dispatch:
    inputs:
      dry_run:
        description: 'Skip the actual publish, only report the environment'
        type: boolean
        default: true

permissions:
  contents: read
  id-token: write # required for npm trusted publishing and provenance

jobs:
  publish:
    name: Publish
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      # Deliberately no `registry-url`: it makes setup-node write an .npmrc
      # containing `_authToken=${NODE_AUTH_TOKEN}`, and with no token supplied
      # that expands to a placeholder. npm then authenticates with the bogus
      # token instead of exchanging the OIDC credential, and publishing fails
      # with a 404. Trusted publishing needs no .npmrc at all.
      - uses: actions/setup-node@v5
        with:
          node-version: '24'

      - name: Use an npm that supports trusted publishing
        run: npm install -g npm@latest

      - name: Install
        run: npm ci

      - run: npx playwright install --with-deps chromium

      - run: npm test

      - name: Check the release tag matches package.json
        if: github.event_name == 'release'
        run: |
          tag="${GITHUB_REF_NAME#v}"
          pkg="$(node -p "require('./package.json').version")"
          if [ "$tag" != "$pkg" ]; then
            echo "Release tag ${GITHUB_REF_NAME} does not match package.json version ${pkg}" >&2
            exit 1
          fi
          echo "Publishing ${pkg}"

      # No token: the workflow authenticates to npm over OIDC, which also
      # attaches provenance linking the tarball to this commit and run.
      # --access public because a scoped package is private by default.
      - name: Publish
        if: github.event_name == 'release' || inputs.dry_run == false
        run: npm publish --provenance --access public --loglevel verbose

      - name: Report what npm attempted
        if: failure()
        run: |
          echo "registry: $(npm config get registry)"
          for f in ~/.npm/_logs/*.log; do
            echo "=== $f ==="
            grep -iE 'oidc|trusted|provenance|id-token|audience|http fetch|ENEEDAUTH|401|403' "$f" | head -40
          done
```

- [ ] **Step 5: Run the tests once more**

Run: `npm test`
Expected: PASS, unchanged – the registration guard must not have broken anything in the browser.

- [ ] **Step 6: Commit**

```bash
git add index.js twin.js .github/workflows/
git commit -m "Add entry points and publishing

Two entry points, so importing the board never loads MIDI code: the main
one carries the board, the pad and the colour helpers, and twin.js adds
the twin and with it launchpad-webmidi. A CI job greps for the import to
keep that true.

Element registration is guarded on customElements existing, so the
modules import cleanly under Node – which is what the packed-tarball job
does to check that files and exports actually resolve.

Publishing is trusted publishing over OIDC with provenance, as in
launchpad-webmidi, minus every dist/ step because there is no build.
--access public because a scoped package is private by default."
```

---

### Task 7: Examples

Four pages, each loading the source directly through an import map so they run from a plain static server with no build.

**Files:**
- Create: `examples/single-pad.html`, `examples/board.html`, `examples/board-with-webmidi.html`, `examples/twin.html`
- Modify: `.github/workflows/ci.yml` (add the examples job)

**Interfaces:**
- Consumes: `index.js`, `twin.js`.
- Produces: nothing other code depends on.

- [ ] **Step 1: Write `examples/single-pad.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>granite-launchpad – a single pad</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #17171a; color: #eee; padding: 2rem; }
    granite-launchpad-pad { --granite-launchpad-pad-size: 6rem; }
  </style>
  <script type="importmap">
    {
      "imports": {
        "lit": "../node_modules/lit/index.js",
        "lit/": "../node_modules/lit/",
        "@lit/reactive-element": "../node_modules/@lit/reactive-element/reactive-element.js",
        "@lit/reactive-element/": "../node_modules/@lit/reactive-element/",
        "lit-html": "../node_modules/lit-html/lit-html.js",
        "lit-html/": "../node_modules/lit-html/",
        "lit-element/lit-element.js": "../node_modules/lit-element/lit-element.js"
      }
    }
  </script>
</head>
<body>
  <h1>A single pad</h1>
  <p>Press it: green while held, red once released.</p>

  <granite-launchpad-pad id="pad"></granite-launchpad-pad>

  <script type="module">
    import '../index.js';

    const pad = document.querySelector( '#pad' );
    pad.addEventListener( 'pad-press', () => { pad.color = 'green'; } );
    pad.addEventListener( 'pad-release', () => { pad.color = 'red'; } );
  </script>
</body>
</html>
```

- [ ] **Step 2: Write `examples/board.html`**

Same `<head>` block as Step 1 with the title changed, **except the style rule**,
which must target the light-DOM element that is actually on this page:

```css
    granite-launchpad-board { --granite-launchpad-pad-size: 3rem; }
```

Step 1's `granite-launchpad-pad { … }` is a type selector. It matches only pads
in the page's own light DOM, and this page has none – its 80 pads live inside
the board's shadow root, where a page-level type selector cannot reach them.
Setting the custom property on the board host works because custom properties
inherit through the shadow boundary. 3rem rather than 6rem because nine of them
plus gaps is the width of the whole board: 6rem would make it about 900px wide
and force horizontal scrolling on a laptop.

Body:

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

- [ ] **Step 3: Write `examples/board-with-webmidi.html`**

The board wired to the hardware by hand, which is what the twin does for you – kept as the worked example of the manual path.

Same `<head>` as Step 2, including `granite-launchpad-board { --granite-launchpad-pad-size: 3rem; }`
and with the title changed, plus one import-map entry:
`"launchpad-webmidi": "../node_modules/launchpad-webmidi/dist/launchpad-webmidi.es.js"`.

Body:

```html
  <h1>The board, wired to hardware by hand</h1>
  <p id="status">Connecting…</p>

  <granite-launchpad-board id="board"></granite-launchpad-board>

  <script type="module">
    import '../index.js';
    import Launchpad from 'launchpad-webmidi';

    const board = document.querySelector( '#board' );
    const status = document.querySelector( '#status' );
    const pad = new Launchpad();
    let connected = false;

    const paint = ( x, y, color ) => {
      board.setColor( x, y, color );
      if ( connected ) {
        const { hue, level } = { red: { hue: 'red', level: 3 }, green: { hue: 'green', level: 3 }, off: { hue: 'off', level: 0 } }[ color ];
        pad.col( hue === 'off' ? pad.off : pad[ hue ].level( level ), [ x, y ] );
      }
    };

    board.addEventListener( 'pad-press', ( e ) => paint( e.detail.x, e.detail.y, 'green' ) );
    board.addEventListener( 'pad-release', ( e ) => paint( e.detail.x, e.detail.y, 'red' ) );

    try {
      await pad.connect();
      connected = true;
      status.textContent = 'Launchpad connected.';
      pad.on( 'key', ( k ) => paint( k.x, k.y, k.pressed ? 'green' : 'red' ) );
    } catch ( error ) {
      status.textContent = `No Launchpad: ${ error }. The board still works on screen.`;
    }
  </script>
```

- [ ] **Step 4: Write `examples/twin.html`**

The same behaviour as Step 3, through the twin, to show what it removes.

Its `<head>` needs the **same import map as Step 3**, including the
`launchpad-webmidi` entry, not Step 1's. Its style rule targets the twin, which
is the light-DOM element here:

```css
    granite-launchpad { --granite-launchpad-pad-size: 3rem; }
``` The page imports `../twin.js`, which
re-exports `src/granite-launchpad.js`, which begins
`import Launchpad from 'launchpad-webmidi'`. That bare specifier is part of the
module graph the browser resolves before a line of the page runs, so without the
entry the page dies with a module-resolution error instead of reporting a
missing Launchpad on screen – the precise failure the twin exists to prevent.

```html
  <h1>The digital twin</h1>
  <p id="status">Connecting…</p>

  <granite-launchpad id="twin" auto-connect></granite-launchpad>

  <script type="module">
    import '../twin.js';

    const twin = document.querySelector( '#twin' );
    const status = document.querySelector( '#status' );

    twin.addEventListener( 'launchpad-connect', () => {
      status.textContent = 'Launchpad connected. Press a pad on either side.';
    } );
    twin.addEventListener( 'launchpad-error', ( e ) => {
      status.textContent = `No Launchpad: ${ e.detail.error }. The board still works on screen.`;
    } );

    twin.addEventListener( 'pad-press', ( e ) => twin.setColor( e.detail.x, e.detail.y, 'green' ) );
    twin.addEventListener( 'pad-release', ( e ) => twin.setColor( e.detail.x, e.detail.y, 'red' ) );
  </script>
```

- [ ] **Step 5: Serve them and check each one by hand**

```bash
npx http-server -p 8080 /Users/horacio/git/node/granite-multicolor-pad-board
```
Open `http://localhost:8080/examples/single-pad.html`, `board.html`, `board-with-webmidi.html`, `twin.html`. Each should render with no console errors. With no Launchpad plugged in, the last two must show their failure message and stay usable on screen.

- [ ] **Step 6: Add the examples job to CI**

```yaml
  examples:
    name: Examples resolve
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      - uses: actions/setup-node@v5
        with:
          node-version: '24'

      - run: npm ci

      # The examples are plain HTML importing source and node_modules by
      # relative path. A renamed or dropped file would break them silently.
      - name: Paths in the examples exist
        run: |
          rc=0
          for ref in $(grep -ho '"\.\./[A-Za-z0-9@/._-]*"' examples/*.html | tr -d '"' | sort -u); do
            file="${ref#../}"
            if [ -e "$file" ]; then
              echo "ok      $ref"
            else
              echo "MISSING $ref" >&2
              rc=1
            fi
          done
          exit $rc
```

- [ ] **Step 7: Commit**

```bash
git add examples/ .github/workflows/ci.yml
git commit -m "Add the examples

Four pages: a single pad, the board, the board wired to hardware by hand,
and the twin doing that wiring for you. Each is plain HTML with an import
map, so they run from any static server with no build.

The two hardware pages report a missing Launchpad on the page and stay
usable on screen, rather than failing silently the way the 2018 demo did.

A CI job checks every relative path in them still exists."
```

---

### Task 8: Documentation

**Files:**
- Create: `CHANGELOG.md`, `LICENCE.md`
- Rewrite: `README.md`

**Interfaces:**
- Consumes: the finished API.
- Produces: nothing other code depends on.

- [ ] **Step 1: Copy the licence**

```bash
cp /Users/horacio/git/node/launchpad-webmidi/LICENCE.md \
   /Users/horacio/git/node/granite-multicolor-pad-board/LICENCE.md
```
Check the copyright line names Horacio Gonzalez and update the year if the file carries one.

- [ ] **Step 2: Write the README**

Follow the `launchpad-webmidi` README shape. Prose uses the spaced en-dash `–`, never `—`. Sections, in order:

1. `# granite-launchpad` – one-line description, then what it is: three Lit elements, a board you can play on screen and a twin of a real Launchpad Mini.
2. `## Contents` – a link list of the sections below.
3. `## Requirements` – a modern browser; the twin additionally needs the Web MIDI API and a Launchpad Mini. Link MDN's Web MIDI browser-support table.
4. `## Installation` – `npm install @granite-elements/granite-launchpad`, **and
   the two entry points, stated here rather than left to be discovered**: the
   bare specifier registers `<granite-launchpad-pad>` and
   `<granite-launchpad-board>` only, while `@granite-elements/granite-launchpad/twin.js`
   additionally registers `<granite-launchpad>`. Say why: importing the board
   never loads MIDI code. Say what going wrong looks like, because it is silent
   – an unregistered custom element renders as an empty inline box, raises no
   error, and simply never connects. Then the `esm.sh` import map for a page
   with no build, with **both** keys:

   ```html
   <script type="importmap">
     {"imports": {
       "@granite-elements/granite-launchpad": "https://esm.sh/@granite-elements/granite-launchpad"
     }}
   </script>
   <script type="module">
     import '@granite-elements/granite-launchpad';
   </script>
   ```
   The import map must come before any module script that relies on it.
5. `## The three elements` – the table of tags and roles from the spec, and the
   nesting example. Every code sample that uses `<granite-launchpad>` shows the
   `twin.js` import beside it; every sample that does not, shows the bare
   specifier. A reader copies the nearest import, so the nearest import must be
   the right one.
6. `## Getting started` – the `examples/board.html` body as the worked example.
7. `## Coordinates` – the ASCII diagram from the spec, verbatim, with the three bullets under it.
8. `## Colours` – the canonical strings, the parse table from the spec, the note that full brightness is written as the bare hue, and that yellow clamps to full because the hardware cannot dim it.
9. `## Styling` – the 11 colour tokens, `--granite-launchpad-pad-size`, `--granite-launchpad-gap`, `--granite-launchpad-glow`.
10. `## API` – every property, method and event of all three elements, in three
    tables copied from the spec's element sections. The twin's `error` is the
    reason the connection failed **or** the error thrown when the hardware went
    away mid-session – one field, both causes. Do not describe it as only a
    `connect()` failure.
11. `## The twin` – `auto-connect`, the `state` values, handling
    `launchpad-error`, and the `launchpad` property for injecting a fake. Say
    plainly that with `auto-connect` the connection can finish before a script
    later in the page attaches its listener, so `launchpad-connect` may be
    missed; `state` is reflected as an attribute precisely so a page in that
    position can read the outcome instead of racing for the event.

    Also document losing the device mid-session, which is behaviour the twin
    gained during implementation: `launchpad-webmidi` sends through a bare
    `MIDIOutput.send()`, which throws synchronously once the port is gone. The
    twin catches that, sets `state` to `error`, fires one `launchpad-error`, and
    keeps painting the board – so unplugging a Launchpad degrades the page to
    screen-only instead of throwing out of `setColor()` at the caller. Say that
    the event fires once, not once per write.
12. `## Examples` – one line per file in `examples/`, and the `npx http-server` command.
13. `## Coming from the Polymer element` – the migration table from the spec, verbatim.
14. `## Known limitations` – three, each stated plainly:
    - Double buffering, multiplexing and global brightness are not mirrored: a
      flashing LED on the hardware renders as steady on screen.
    - Every pad is its own tab stop, so tabbing across the board takes 80 stops.
      Arrow-key navigation with a roving tabindex is a candidate for a later
      release.
    - Pads respond to pointer, touch, pen, Space and Enter, but not to a
      synthesised `click`. Assistive technology that activates a `role="button"`
      by dispatching `click` rather than key events will not play a pad. Handling
      it needs care to avoid double-firing alongside the pointer sequence a real
      mouse already produces, so it is deferred rather than guessed at.
15. `## Changelog` – link to `CHANGELOG.md`.
16. `## Licence` – MIT, link to `LICENCE.md`.

- [ ] **Step 3: Write the CHANGELOG**

Keep a Changelog format, as in `whack-a-launchpad`.

```markdown
# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/LostInBrittany/granite-launchpad/compare/1.0.0...HEAD
[1.0.0]: https://github.com/LostInBrittany/granite-launchpad/compare/bf8634e...1.0.0
[0.1.0]: https://github.com/LostInBrittany/granite-launchpad/commit/bf8634e
```

- [ ] **Step 4: Check every link and path in the README resolves**

```bash
cd /Users/horacio/git/node/granite-multicolor-pad-board
grep -o '](\./[^)]*)' README.md CHANGELOG.md | sed 's/.*](\.\///;s/)$//' | sort -u | while read -r f; do
  test -e "$f" && echo "ok      $f" || echo "MISSING $f"
done
```
Expected: every path `ok`.

- [ ] **Step 5: Run the full suite one last time**

Run: `npm test`
Expected: PASS, all four spec files.

- [ ] **Step 6: Commit**

```bash
git add README.md CHANGELOG.md LICENCE.md
git commit -m "Document the rebuild

README covering the three elements, the coordinate system, the colour
strings, the styling tokens, the full API and a migration table for
anyone arriving from the Polymer element.

CHANGELOG starts at 1.0.0 – the scoped package has never been published –
and records the 2018 Polymer elements as 0.1.0 so the rewrite has visible
provenance."
```

---

## After the plan

Not part of the plan, because neither is a code change and both want a human at the keyboard:

1. **Rename the repository** on GitHub from `granite-multicolor-pad-board` to `granite-launchpad`. GitHub redirects the old URL. Then update the local remote:
   ```bash
   git remote set-url origin git@github.com:LostInBrittany/granite-launchpad.git
   ```
2. **Configure npm trusted publishing** for `@granite-elements/granite-launchpad`, linking the package to this repository and `publish.yml`, before cutting the first GitHub release. The package does not exist yet, so the first publish needs the scope's settings to allow it.
