# ad-engine · render · Paper (mode 3)

**Playwright is the linter. Paper is the canvas.**

`paper.js` renders the same templates as `render.js`, but the output lives in a [Paper](https://paper.design) file as editable design nodes, and Paper exports the PNG. Every verdict the Playwright pipeline produces (fit, overflow, contrast, claim checks, `blocking[]`) travels with it. Built 2026-09-13 because Remy asked for it (2026-09-11: *"Switch static rendering from Playwright to Paper"*) and because a designer cannot open a PNG.

## What it does and does not fix

Be clear about this before promising anything:

- **It does not make the same design look better.** Paper reproduces the template pixel for pixel (1.5 to 6 percent diff on The AI Course batch with the brand fonts installed). A template that reads as generic in Playwright reads as generic in Paper.
- **It makes the design editable.** Every line of text is a text node. Every colour that matches a brand token is `var(--color-primary)`, not a literal. The logo and photo are image nodes. A designer, or Remy, moves the headline, swaps a colour, changes a word, exports, done. The revise loop stops going through `/ad-copy` for taste fixes.
- **It opens the road to better templates.** A master design made *in Paper* (by a designer, or by Claude following Paper's own design guide) can be filled by the chain instead of an HTML template. That is the answer to "the non-product statics look bad", and it is the next build, not this one. See **Fill mode** below.

## Requirements

- **Paper Desktop open.** Its MCP server exists on `127.0.0.1:29979` only while the app is running. `paper.js` talks to it directly over HTTP (`paper-client.js`), so the Claude session does not need Paper's MCP tools loaded and never needs a restart for this. `doctor.js` reports whether the app is open.
- **Brand fonts installed on the machine.** Paper draws from Font Book and Google Fonts. A self-hosted `@font-face` file that Playwright loads from disk is invisible to Paper. `paper.js` checks every family in the spec and prints the exact `cp … ~/Library/Fonts/` command; **restart Paper Desktop after installing** (it does not rescan). The AI Course's PP NeueBit and PP Mondwest were installed on Zach's machine 2026-09-13.
- **Playwright renderer ready** (`npm run setup`), because the pipeline runs there first.

## Run

```bash
node .claude/skills/ad-engine/render/paper.js <render-spec.json> [--only=c01,c03] [--replace] [--file=<paperFileId>] [--out=<dir>] [--no-verify]
```

Same spec as `render.js`. Add `"paper_file_id": "…"` to the spec (or to `brand-kit.md` frontmatter and copy it in) to keep using one Paper file per brand; without it the first run creates `ad-engine · {brand}` and writes `paper-file.json` next to the spec.

Per render it: runs `prepareRender` in Playwright (tokens, fonts, slots, `__sync`, fit, `__afterFit`, `__qa`, visual QA) → screenshots `paper/<id>.playwright.png` → snapshots the fitted DOM → `create_artboard` → `write_html` in chunks → `export` PNG at 1x (Paper writes to `~/Downloads/<artboard>.png`; the file is moved to `paper/<id>.png`) → verifies the PNG header and dimensions → pixel-diffs Paper's PNG against Playwright's → `finish_working_on_nodes`.

`--replace` is the revise loop: the id's previous artboard (from `paper-results.json`) is deleted before the new push, so a revised concept takes the old one's place instead of piling up duplicates in the designer's file.

## Output

- `images/paper/<id>.png` — Paper's export, the file that ships. `<id>.playwright.png` next to it, `<id>.diff.png` when they disagree.
- `paper-results.json` next to the spec — **merged by id**, same contract as `render-results.json` (`ok`, `warnings[]`, `blocking[]`, `fit[]`) plus `file_id`, `file_url`, `artboard_id`, `node_ids[]` (every created node with its layer name, so a later revise can `set_text_content` a headline instead of re-pushing), `diff_pct`, `nodes_pushed`. `paper-log.jsonl` appends every run.
- Brand design tokens in the Paper file: `--color-primary/accent/ink/paper/muted`, `--font-display/body/mono`, created once from the spec's `brand`.

Warnings to read: `FIDELITY` (Paper and Playwright disagree on more than 2 percent of pixels; open the diff; a missing font on either side is the usual cause), `FONT` (from `render.js`: a brand face did not load in Playwright and a fallback was rendered), and everything the templates already raise.

## How the snapshot works, and its limits

Paper's `write_html` takes inline-styled HTML only: no stylesheets, no classes, no JavaScript, no rich text, no `<table>`, no `margin`. So the snapshot is **flat and positioned**: one absolutely positioned frame per box that paints something (background, gradient, border, shadow), one text node per rendered *line* of each text run (measured word by word with `Range.getClientRects`), one image node per `<img>` (local files as `paper-asset:///abs/path`). Mixed-style runs (`<em>`, `<mark>`, `<b>`) come out as separate nodes on the same line, correctly styled; a `<mark>` ground becomes a frame behind the text. `::after` content (the CTA arrow) is materialised as a real span first. `text-transform` is baked into the text. Colours that went through `color-mix()` arrive from Chromium as `color(srgb …)` and are parsed too (the eyebrow pill vanished on the first run because they were not).

Limits, by design in v1:

- **No auto-layout.** Nodes are positioned, not flexed. Moving a headline does not reflow the subhead. Same trade every HTML-to-design importer makes.
- **Text width is Paper's.** Paper sets text nodes to `max-content`. If Paper's copy of a font is wider than Playwright's (different version, or Playwright fell back), a line grows to the right and can collide with its neighbour. The `FIDELITY` diff catches it; the fix is the same font on both sides.
- **Paper renders asynchronously.** An export fired straight after `write_html` returned the bare artboard background on the first live run (34 KB of solid colour). `paper.js` waits, exports, and retries up to three times when the file is implausibly small next to the Playwright PNG.
- **One MCP session, one sticky file.** Every process must `open_file` first; `paper.js` does.

## Verified 2026-09-13

- Fixture (fictional brand, Google fonts): 3 templates pushed, exported at 1080×1350, PNG verified. Diff 11 to 13 percent, all of it Sora and Inter failing to load on the Playwright side in the sandbox (the new `FONT` warning fired correctly); Paper's text was wider and the title collided. With the fonts present on both sides this is the same picture.
- The AI Course (`render-spec.rev1.light.json`, PP NeueBit + Inter installed): 6 concepts pushed into file `01M2EVTDHNYPVJ00N331TS84DH`, diffs 1.49 to 6.14 percent (Inter hinting). c08's `NO SOURCE — cannot ship` came through as `blocking[]` exactly as in `render-results.json`. Table, highlight column, rules, testimonial highlight, initials avatar, wordmark image all reproduced.

## Fill mode (next build, the one that changes how the ads look)

The chain fills a **master artboard designed in Paper** instead of an HTML template:

1. A designer (or Claude with Paper's design guide, which is opinionated and good: Swiss editorial type, one colour moment, restraint) builds one artboard per format in the brand's Paper file: `master · typographic-hero`, `master · testimonial-card`, … with text layers named by slot (`headline`, `subhead`, `cta`) and the brand tokens applied.
2. Per concept: `duplicate_nodes` the master → `descendantIdMap` gives every cloned layer → `set_text_content` on the slot layers from `copy.md` → `update_styles` for theme swaps → `export`.
3. QA still runs: the exported PNG goes through the same visual checks by loading it in Playwright, and the claims ledger is content-level and renderer-independent. Fit becomes `find_nodes` + `get_node_info` size checks against the artboard.

That path needs a design session with Remy's brand in front of a human, not a script written blind. `paper.js` is the plumbing it will reuse (client, file per brand, tokens, export, verify, results contract).

## First live session with Remy (checklist)

1. Paper Desktop open, brand fonts in Font Book, Paper restarted.
2. `node doctor.js` shows Paper open. `paper_file_id` in `brand-kit.md`.
3. Run the current batch through `paper.js`; open the file URL from the hand-off line; show that every artboard is editable and that the tokens panel holds the brand.
4. Ask for one taste fix on one artboard, in Paper, by hand. Export. That is the revise loop designers actually want.
5. Then pick the format that "sucked" most and design its master together. Fill mode gets built against that.
