# ad-engine · render

Mode-2 renderer for the ad-engine chain: **HTML templates → PNG via Playwright.** Every format whose content is type, data, UI, or a quote renders here. Scenes render through Higgsfield. The fork rule and the format table live in `../PLAYBOOK.md` → *Render modes*.

Self-contained on purpose — no dependency on any other skill, so the chain ports to a bare folder.

## Setup (once per machine)

```bash
cd .claude/skills/ad-engine/render && npm run setup
```

Installs `playwright` and the Chromium build it needs. Google Fonts load over the network at render time; every template has a system-font fallback, so an offline render is still legible, just not in the brand face.

## Run

```bash
node .claude/skills/ad-engine/render/render.js <render-spec.json> [--sheet] [--only=c01,c03]
```

- `--sheet` also writes `contact-sheet.png` into the output folder — start pre-QA from it, then zoom.
- `--only` re-renders a subset (the `/ad-review` revise path). With `--sheet` it writes a **subset** sheet (`contact-sheet.only-<ids>.png`) and leaves the full `contact-sheet.png` alone.
- Exit code `2` when any render failed. `render-results.json` is written next to the spec every time.

## render-spec.json

```json
{
  "campaign": "acme-2026-09-04",
  "output_dir": "images",
  "brand": {
    "name": "Acme",
    "primary": "#0B5FFF", "accent": "#FFC531", "ink": "#0E0F14", "paper": "#FFFFFF", "muted": "#6B7280",
    "font_display": "Sora", "font_body": "Inter",
    "google_fonts": ["Sora:wght@600;700;800"],
    "logo_url": "https://…/logo.svg"
  },
  "renders": [
    { "id": "c01", "template": "typographic-hero", "file": "c01-hero.png", "aspect": "4:5",
      "slots": { "eyebrow": "For pool service companies",
                 "headline": "3–5 new accounts a month, <em>or you don't pay.</em>",
                 "subhead": "We run the ads and book the estimates.",
                 "cta": "Book a 15-min call", "footer": "acme.co" } }
  ]
}
```

**Optional `brand` keys (added 2026-09-11, The AI Course):** `font_faces` — `[{family, src, weight?, style?}]` self-hosted fonts (a commercial face the brand serves itself); `src` resolves relative to the spec, declared before the Google Fonts link so the local face wins. `font_mono` → `--font-mono` (eyebrows, labels; falls back to body). `highlight` — explicit `<mark>` ground (a brand tint beats the yellow fallback). `display_scale` — multiplier on every display-font size (pixel faces like PP NeueBit draw ~30% small for their em; 1.45 makes 200px *look* 200px; `data-fit` still caps to the box). `display_line_height` — line-height for the display face (bitmap faces need ~.62–.7). `name_in_header: false` — hides the text wordmark when the logo already *is* the wordmark.

`brand` values become CSS variables on `:root` (`--brand-primary`, `--brand-accent`, `--brand-ink`, `--brand-paper`, `--brand-muted`, `--font-display`, `--font-body`), plus three **derived** tokens the templates use so any palette reads: `--brand-on-primary` (text on a primary ground: white, or ink when the primary is light), `--brand-primary-text` (primary as text on paper, or ink when it can't read), `--brand-accent-on-ink` (accent as text on dark, or white). A neon or pastel primary is fine; the log says what was substituted. **Image slot values may be paths relative to the spec file** (`test-capture.png`, `../images/c08.png`); absolute paths and `http(s)`/`file:` URLs pass through. Take hex + font names from `brand-kit.md`; if they're missing there, fix the brand kit rather than hand-typing colors into a spec. `output_dir` is relative to the spec file unless absolute. `aspect`: `4:5` (default, 1080×1350) · `1:1` · `9:16` · `16:9`.

## Templates

| Template | Format | Slots | Hard rule baked in |
|---|---|---|---|
| `typographic-hero` | guarantee / big-promise headline | `eyebrow` `headline` (use `<em>` for the accent phrase) `subhead` `cta` `footer` `disclaimer` `bg` (img) `theme` (`""` primary · `paper` · `ink`) | >12-word headline flagged; accent contrast guard |
| `proof-card` | big number + real screenshot + metrics + named client | `eyebrow` `big-number` `big-label` `screenshot` (img) `fit` (`contain` default · `cover`) `frame` (`browser` default · `phone` · `none`) `screenshot-caption` `metric-1..3-value/-label` `client-photo` (img) `client-initials` `client-name` `client-role` `cta` `disclaimer` | **empty `screenshot` renders a red REAL SCREENSHOT REQUIRED block**; claim check flagged every render |
| `testimonial-card` | result headline + highlighted quote + attributed person | `result` `quote` (use `<mark>` on the payoff phrase) `stars` (1–5) `client-photo` (img) `client-initials` `client-name` `client-role` `source` `disclaimer` `cta` `theme` (`""` paper · `ink`) | initials avatar when no photo — never needs a generated face; authenticity check flagged with the source |
| `notes-screenshot` | the brand's own pitch as a plain note | `title` `body` (`<p>` paragraphs, `<b>` allowed) `date` `time` `theme` (`""` light · `dark`) | generic phone chrome, no platform marks; claim check flagged |
| `comparison-table` | them-vs-us / before-vs-after table | `eyebrow` `title` `subtitle` `col-1` `col-2` `col-3` `rows` (`<tr><td>…</td>×3</tr>`) `highlight` (1–3, default 2) `source` `disclaimer` `cta` `theme` (`""` paper · `ink`) | numeric cells listed as claims; missing `source` flagged cannot ship |
| `social-proof-capture` | a real post / DM / review, framed | `capture` (img, REAL) `headline` `caption` `source` `disclaimer` `cta` `theme` (`""` · `ink` · `primary`) | **empty `capture` renders a red REAL CAPTURE REQUIRED block**; never fabricates a post |
| `photo-text-band` | Higgsfield scene + headline band (hybrid) | `photo` (img) `eyebrow` `headline` (`<em>` accent) `subhead` `cta` `band` (`bottom` · `top`) `band-theme` (`""` primary · `ink` · `paper`) `disclaimer` | empty `photo` renders a red PHOTO REQUIRED block |

Every template is fixture-tested at `4:5`, `1:1`, and `9:16` — `examples/render-spec.aspects.json` → `examples/out-aspects/contact-sheet.png`. `doctor.js` checks the local environment (`node doctor.js`).

`brand-name` and `logo` are injected into every template from `spec.brand` — you never set them per render.

Worked example with every template and theme: `examples/render-spec.example.json` → `examples/out/contact-sheet.png`. The example brand is fictional.

## Slot contract (for writing a new template)

| Attribute | Behaviour |
|---|---|
| `data-slot="name"` | `innerHTML = value` |
| `data-slot-src="name"` | `src = value` (images) |
| `data-slot-style="name"` | appends inline CSS |
| `data-optional` | element hidden when the slot is empty or absent |
| `data-default` | element keeps its template text when the slot is empty or absent (use for compliance lines) |
| `data-fit` / `data-fit-min="N"` | font shrinks in 2px steps until the element fits its parent; still-clipped text is reported as a warning |

Three optional hooks a template may define (`__afterFit` added 2026-09-13):

- `window.__sync()` — called once after slots are injected. Do theme/class wiring here. **Do not use a `MutationObserver` that writes to the DOM** — a callback that sets `className` or `textContent`, even to the same value, fires another mutation and `load` never settles (cost the first test run of this renderer).
- `window.__afterFit()` — called once after `data-fit` has settled and brand fonts are loaded. Put any layout that depends on *final* text sizes here (the comparison table sizes itself to the space the fitted title leaves). Must reset its own inline styles first.
- `window.__qa()` → `string[]` — flags the renderer copies into `render-results.json` warnings and `/ad-batch` copies into the manifest. Use it for anything a human must see before the creative ships (claim checks, authenticity checks, missing evidence).

Every new template gets a fixture in `examples/render-spec.example.json` and a look at the contact sheet before it goes in the PLAYBOOK table.

## Verification the renderer does for you

For each render: the output file exists, the PNG header parses, the dimensions equal the requested canvas. Anything else is reported as a failure, never silently. Then a **visual QA pass** on the live DOM: `OVERFLOW` (text wider than its cell, or spilling past its container / off the canvas), `COLLISION` (table cells overlapping), `CROP` (an `object-fit: cover` image losing more than 10% of an axis; mark intentionally full-bleed images `data-crop-ok`), `CONTRAST` (every text slot against its real ground, below 3:1). A render can *succeed* and still carry warnings — read them; they are the pre-QA flags. `examples/render-spec.qa-test.json` is the fixture that makes each check fire on purpose.

`render-results.json` shape (the per-render boolean is **`ok`** — there is no `status` field):

```json
{ "campaign": "…", "output_dir": "…", "rendered": 8, "failed": 0, "contact_sheet": "…/contact-sheet.png",
  "results": [ { "id": "c01", "template": "typographic-hero", "path": "…/c01.png", "canvas": [1080,1350],
                 "ok": true, "bytes": 88123, "warnings": ["…"] },
               { "id": "c05", "ok": false, "error": "wrong dimensions …", "warnings": [] } ] }
```

Known guard: `typographic-hero` checks the `<em>` accent's contrast against the chosen ground and swaps to a readable fallback below 2.5:1 (with a warning). A brand whose accent equals its primary otherwise renders the accent phrase invisibly and nothing machine-detectable fires.
