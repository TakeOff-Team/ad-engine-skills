---
version: 1.0.0
name: ad-batch
description: |
  The every-run skill of the ad-engine chain: load an onboarded brand's
  context + Defaults, generate angles, render each concept on the right
  path — Higgsfield MCP for scenes, the Playwright HTML→PNG renderer for
  type / data / UI / quote formats — pre-QA every image, open the review
  gallery. Zero re-asking — Defaults carry the run; one compact plan line
  + cost is the only gate. Ends waiting for the gallery export → /ad-review.
  Use when: routed here by /ad-engine, "new ad batch for {brand}",
  "/ad-batch {slug}". Requires the five context files (else /ad-onboard).
  NOT for: onboarding, research refresh, or parsing review exports.
argument-hint: "[slug] [--batch N] [--angles a1,a2]"
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
---

# Ad Batch — the seamless every-run

The contract: **the operator says "new batch" and then does nothing until the gallery opens.** Every question this skill wants to ask should already be answered in `rules.md` — if it isn't, that's an onboarding gap to flag, not a question to ask mid-run. Shared knowledge: `.claude/skills/ad-engine/PLAYBOOK.md` — **Model routing**, **Tool fallbacks**, **QA truths**, **Field notes**.

## Step 0 — Load + freshness (no user interaction)

Read all five context files (`brand-kit`, `brand-guide`, `icp`, `rules`, `assets/references.md`) — `rules.md` frontmatter `brand_type` decides which Block A, which model row, and which QA lines apply; read it first. **Re-sweep** (ad-onboard Step 0.5, files newer than `brand-kit.md` `swept_at:`) — a new transcript or note since the last run feeds VoC before angles are written. Read `rules.md ## Defaults` — batch size, formats, aspect mix, model override all come from there (seed defaults: 6-8 concepts, 1 variant, category-routed model). Check `real-ads-reference/findings.md` date: **30+ days old → one line: "research is N weeks old — refresh first (~5 min) or run on the existing baseline?"** That, plus the cost gate, are the only permitted questions.

## Step 1 — Angles

The framework is a generator, not a cage: **Persona × Trigger × Pain/Desire × Awareness Stage × Angle type** (contrarian / mechanism / transformation / enemy / specificity / social proof — `/positioning-angles` for the deep framework) gets you past the obvious. The ICP's VoC quotes are the raw material — real customer language beats invented benefit lines, and **if a VoC quote hands you an angle the matrix didn't, take it.** Produce 3-5 genuinely distinct angles in `ad-angles.md` (append per-run, dated): name, why it works, visual direction, when to use. **Then assign each concept a format and, from it, a render path** (PLAYBOOK **Render modes**): a scene → `higgsfield`; a guarantee headline, proof card, testimonial, table, or notes screenshot → `playwright`. Service brands normally mix both in one batch; proof-based formats are only assignable when `assets/references.md` holds the real asset (screenshot, quote + source, headshot) — no asset, no concept. Skip angles needing real proof assets (creator faces, testimonials) — never fake those. If the style default says A/B two formats, split the concepts across both.

**Wildcard quota — the anti-sameness valve.** Roughly 1 in 6 concepts (min 1 per batch) must deliberately break a *Default* — a different composition, mood, format, or an angle the brand has never run. It may never break a *Rule* (rules are correctness; defaults are habit). Label it `wildcard` in its gallery `meta` **and set `"wildcard": true` on that concept in `manifest.json`** — `/ad-review` keys its special handling off the manifest, and free-text `meta` is not parseable from a cold review session. The convention only survived Kodiak because one agent wrote both ends. A kept wildcard is the system's only way to learn that the default has drifted — without it, every batch converges on last batch.

## Step 1.5 — Copy pass (invoke `/ad-copy`)

Invoke **`/ad-copy`** for this slug and run. It reads `icp.md` VoC, the proof inventory, `findings.md` and this run's `ad-angles.md`, and writes **`copy.md`** into the run folder: per concept — the reader at a moment, their pain in their own words, the pain said better than they can, the awareness stage, eyebrow, headline **+ 2 variants**, subhead, CTA, template slots, and a **claims ledger** tracing every number and quote to `references.md`. Batch-level: a stage spread and an offer-gap line if research found one. **Block B and every Playwright slot are filled from `copy.md` from here on — never written ad hoc.** Manifest gains `stage` and `headline_variants` per concept.

## Step 2 — Assemble prompts

Two blocks per concept, deliberately decoupled — **rigid where it protects correctness, free where it makes the image**:

**Choose Block A by `brand_type`** — product brands use the packaging/garment block; service brands use the proxy-subject variant below it. Then:

**Block A — product fidelity (verbatim, every prompt, never paraphrased away):**
```
Match the exact {packaging/garment} colors, LAYOUT and {logo/wordmark} from the
reference image — do not substitute a different color, layout or pattern. The
{brand} {logo type} must render clean, legible, correctly spelled, in its real
position. {physical product: "the pack is a {exact shape} — do not substitute a
different container shape"} If any small text cannot be rendered legibly, omit it
entirely rather than producing garbled lettering. {brand tail: name, primary hex,
voice one-liner}
```

The omit-over-garble line is load-bearing, not decoration — micro-text garbled on **8 of 8** first-pass Kodiak renders, and that line cleaned up the re-render. Never paraphrase it away.

**Block B — the creative (written fresh for each concept, no template):** write it the way an art director briefs a photographer — the scene, the light, the moment, the feeling, what the eye lands on first. Vivid and specific beats safe and generic; the fidelity block already has correctness covered, so this block's only job is to be *good*. Honor `rules.md ## Default visual style` (composition, mood, text-on-image y/n, single vs. multi-panel) for standard concepts; the wildcard breaks it on purpose. If text is on the image, quote the exact headline copy.

**Block A — proxy-subject variant (service brands, no product to be faithful to):** replace the packaging/garment lines with: *"The subject is {proxy: the client's world / the outcome / a person}. No invented logos, storefront names, screens, dashboards, or text of any kind in frame. No fabricated faces presented as clients. {polish level verbatim from `rules.md ## Default visual style`} {brand tail}"* — the fidelity job here is *absence of fabrication*, not exactness. Polish is whatever the style pick recorded; never presume raw.

**Proxy-subject scenes have no reference image** — skip `media_import_url`, render text-to-image on the proxy-subject model row. Fill the `disclaimer` slot on any template whose headline or result line carries a number.

**Playwright concepts get slots, not prompts** — paste them from `copy.md` (headline pick + eyebrow + subhead + CTA + template slots). Proof numbers, quotes, table rows only as the claims ledger traces them.

**Hybrid concepts (`render_path: hybrid` — the `photo-text-band` format):** Higgsfield renders the scene first (Block A proxy-subject variant + Block B, **no text in frame**), the downloaded PNG goes into the template's `photo` slot, Playwright renders the band with the `copy.md` headline. Manifest carries both `job_id` and `template`. Brand tokens come from `brand-kit.md` (hex + font names) — if hex is missing, fix `brand-kit.md`, don't hand-type colors into the spec.

Digest, don't dump: a few bullets from the context files — never whole files. Check every prompt **and every slot** against `rules.md ## Rules` (pass/fail) before rendering — for mode 2 that means the claim, testimonial, and screenshot rules (PLAYBOOK service compliance floor).

## Step 3 — Render (two paths, one manifest)

**Output folder:** `04-Brand/clients/{slug}/batches/{YYYY-MM-DD}-{short-name}/` in this vault (CLAUDE.md: client deliverables live under the client — runs before 2026-09-13 sit in `05-Content/Ads/`), `./ads/{slug}-{date}/` portable. `manifest.json` is the campaign's root of truth; `/ad-review` finds it by `campaign` in either location.

**The cost line is printed BEFORE anything is submitted, not after** (The AI Course: `get_cost` ran silently, the job was submitted, and the credits were stated afterwards). One line: `N concepts · N Higgsfield (model · N credits) · N Playwright ($0)` — under the gate, then go.

**Playwright path (`render_path: playwright`, $0):** write `render-spec.json` into the run folder — `brand` tokens + `renders[]` of `{id, template, file, aspect, slots}` (contract: `.claude/skills/ad-engine/render/README.md`) — then `node .claude/skills/ad-engine/render/render.js <spec> --sheet`. First run on a machine: `npm run setup` in that folder. Read `render-results.json` — it is **merged by id** (`by_id[<id>]`), never overwritten, so multi-spec runs (light/dark/placements) keep every verdict. Any `ok:false` is a failed concept (record, continue). Copy `by_id[<id>].warnings` verbatim into that concept's manifest `qa`, and `by_id[<id>].blocking` into manifest `blocking` **and** into the gallery item as `blocking: [...]` (the card shows a red BLOCKED badge). **Never grep the renderer's stdout for flags** — filtering it to `OVERFLOW|CONTRAST` is exactly how a "cannot ship" disappeared on The AI Course. Read the JSON. The contact sheet it writes is your pre-QA starting point.

**Higgsfield path (`render_path: higgsfield`; fallback per PLAYBOOK):** model per the PLAYBOOK routing table (Defaults override wins). Mechanics: `media_import_url` each reference once (reuse `media_id`) → `generate_image_batch` (≤12/submit) → `jobs_wait` groups → `show_generation_by_ids` once. Cost: preflight `get_cost:true` × count; >100 credits or >10% of balance → ask; otherwise state the number and go. Download every image (`curl -sSLo`) to `05-Content/Ads/{slug}-{date}/images/` (vault) or `./ads/{slug}-{date}/images/` (portable) — CDN URLs are ephemeral. Write `manifest.json` as you go (concept, angle, `format`, `render_path`, `model_requested`/`model_served` **or** `template`, `wildcard`, prompt **or** slots, reference, job_id, local path, status) — the resumability source of truth. **Read `model` back off each `jobs_wait` response**: the service can serve a different model than requested (Kodiak: asked `nano_banana_pro`, got `nano_banana_2` ×9). **Verify every download** — `curl -sSLo` exits 0 on a truncated file; check the byte count against `Content-Length` before the image reaches the gallery. One failure never aborts the batch: record, continue.

## Step 4 — Pre-QA (before the human sees anything)

**Build one contact sheet, then zoom** — targeted ~1300px crops of pack / logo / claim regions. Do NOT read every image full-size: at batch size that is unaffordable *and* less accurate (the Kodiak contact-sheet pass caught a mirrored brand mark and a wrong net weight that a full-size skim would have missed). Mode-2 renders: the PLAYBOOK mode-2 QA lines (numbers traced, quotes sourced, screenshot real, nothing clipped, tokens applied) — the template warnings are the checklist. Higgsfield renders, per PLAYBOOK **QA truths**: logo placement plausibility + spelling; **zoom small text regions** (flavor strips, claims — headlines render fine, small text garbles); **pack silhouette/geometry**, not just artwork; color vs reference; artifacts (blend smears, warped hands); every `rules.md ## Rules` line. Write findings into each gallery card's `meta` — the human decides with your flags visible, not after your silent pass.

## Step 5 — Gallery + hand off

Build the review gallery (PLAYBOOK **Gallery** section; `mode:"review"`) next to the images, `open` it. Print one compact line — N concepts · angles · N Higgsfield (model · credits) + N Playwright ($0) — then:

**"Gallery's open. Keep / Change / Kill each one, add notes, hit Export, and paste the JSON back here — /ad-review takes it from there."**

Review renders at **4:5 only** (one image per concept — cheaper to judge, and credits only go to winners). The full placement set (4:5 + 1:1 + 9:16) is produced by `/ad-review` for keepers. `rules.md ## Defaults` can change the review aspect or the set.
