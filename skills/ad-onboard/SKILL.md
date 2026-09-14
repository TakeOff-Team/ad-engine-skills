---
version: 1.0.0
name: ad-onboard
description: |
  One-time brand onboarding for the ad-engine chain: scrape the brand, run
  the 5-question interview (VoC is the load-bearing answer), pull real ads
  via /ad-research, then a gallery style pick. Output: the five context
  files under {CLIENTS_ROOT}/{slug}/ that make every future /ad-batch run
  zero-question. Builds ONLY what's missing — never re-interviews.
  Use when: routed here by /ad-engine for a brand with missing context
  files, or "onboard {brand} for ads", "/ad-onboard {url}".
  NOT for: generating ads (/ad-batch), refreshing research on an onboarded
  brand (/ad-research).
argument-hint: "[url-or-brand-name] [--slug <name>]"
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
---

# Ad Onboard — once per brand

Everything here happens **once**. The five files this produces are why every later run is seamless — invest the care here, not in re-asking later. Shared knowledge: `.claude/skills/ad-engine/PLAYBOOK.md` — read **Context schema**, **Tool fallbacks**, and **Field notes** (compliance floor) before starting.

## Step 0 — Cache check + tool probe (30 seconds)

Resolve `CLIENTS_ROOT` (PLAYBOOK schema section). For each of the five files that already exists: load it, summarize in one line, ask "reuse or refresh?" — build only the gaps. Then probe tool availability (one cheap Firecrawl call, one Higgsfield `balance` call) — MCP dies at session startup, not call time; the PLAYBOOK fallback table covers every stage, so a dead server changes the tool, never the plan.

## Step 0.5 — Context sweep (before any question — find what they already have)

Most operators already have some of this written down: an ICP or persona doc, a brand guide, a voice profile, positioning, sales-call transcripts, review exports, testimonials, case studies, old ad copy. **Never make someone re-create what's already in their vault.** Before the interview, look — bounded, never the whole project:

1. **Where:** the conventional homes first — `{CLIENTS_ROOT}/{slug}/`, `04-Brand/{slug}/`, `04-Brand/clients/{slug}/`, `10-Transcripts/**/{slug}*`, `clients/{slug}/`, then a project-wide filename + frontmatter search (`find`/`grep`, depth ≤ 4, excluding `node_modules`/`.git`/`09-Archive`), capped at ~40 candidates.
2. **What:** filenames or frontmatter matching `icp | persona | customer | audience | brand-guide | brand guide | voice | positioning | messaging | offer | testimonial | review | case-stud | transcript | call | sales | ad | creative | swipe`, **and** files whose first ~30 lines mention the brand name. Transcripts (`.md .txt .vtt .srt`) in transcript folders count even without the name in the filename.
3. **Read only frontmatter + the first ~30 lines** of each candidate to classify it. Print one table: `file · what it looks like · feeds (brand-guide / icp / rules / references / VoC)`. Then one question: **"Use these? (yes by default — say which to skip)."** *This is one of the chain's few permitted questions and it is not optional — printing the table and proceeding (The AI Course, 2026-09-13) is a bug.* **Then actually open what you listed.** A file in the table that fed nothing is a false claim; three 1:1 transcripts were listed and never read. **Transcripts get their bodies read, not their summaries** — the verbatim member/customer lines are the point.
4. **Pre-fill from what was found**, tagging every derived line `source: {path}`: tone words and pillars → `brand-guide.md`; persona, trigger, anti-persona → `icp.md`; **verbatim customer lines from transcripts and reviews → VoC** (the single biggest win — a real sales call has the customer's words in it); results, testimonials, screenshots already on file → `assets/references.md` proof inventory; stated constraints → `rules.md`.
5. **Interview only the gaps.** A question whose answer is already sitting in a found file is exactly the bug principle 1 forbids.
6. Close with **one open question — always, even when the operator IS the brand**: *"Anything that isn't in this folder — a Notion page, a Google Doc, call recordings, a reviews export, a results screenshot? Paste it or drop it in and I'll fold it in."* TakeOff's run skipped this and two of its proof gaps were exactly the things that question surfaces.

Nothing found → say so in one line and go to the interview. Never skip the sweep silently; the operator should see that you looked. **Record the sweep timestamp** in `brand-kit.md` frontmatter (`swept_at:`) — a file written after the sweep is invisible to the chain (a 9/11 call transcript landed at 09:51, after the sweep, and the operator had to point at it). **Re-sweep for anything newer than `swept_at` at Step 4 (before the style pick) and again at every `/ad-batch` Step 0** — transcripts and notes keep arriving while a brand is being onboarded.

## Step 1 — Scrape (no questions yet)

Firecrawl `firecrawl_scrape` with `formats: ["branding","markdown","links"]` (or `/brand-kit-builder` if installed; fallback per PLAYBOOK). **Then pull the brand's OWN stylesheet — mandatory, before writing a single token (earned on The AI Course, 2026-09-11).** Firecrawl's `branding` block is an LLM summary, not the source: on The AI Course it invented a red `secondary` that exists nowhere on the site and the run shipped red creatives the operator killed on sight. The site's `styles.css` had the canon in a header comment (*"White brand canon · #173EF5 · PP NeueBit / Mondwest"*) plus four self-hosted `@font-face` files. Do this every time:
1. From the scraped HTML, collect every `<link rel="stylesheet" href>` and `curl` each one.
2. Extract **`@font-face` declarations** (family · `src` URL · weight), **`:root` custom properties** (the palette as the brand defines it), and any **header comment** (designers write the canon there).
3. **The stylesheet outranks `branding` wherever they disagree.** A colour in Firecrawl's summary that is not a `:root` token or a repeated rule is suspect — flag it in `brand-kit.md`, do not adopt it.
4. **Self-hosted fonts get downloaded** to `assets/fonts/` and declared via `brand.font_faces` in every render spec. Never write "font unavailable" for a face the site serves itself — check `@font-face` first. A commercial face on Google Fonts' blacklist (PP NeueBit, Mondwest, etc.) is usually self-hosted precisely because it isn't on Google.
5. **Wordmark logos → `name_in_header: false`.** If the logo file *is* the brand name set in type (alt text = brand name, or aspect wider than ~4:1), the templates must not print the name again beside it — "logo + The AI Course written again looks really stupid" (operator).
6. **Never infer visual direction from a transcript into `brand-kit.md`.** A line like "the old look screams developer" is a question for the style-pick gallery, not a brand-kit decision — the run wrote "lean plain Inter" from one call and the operator's actual instruction was the opposite ("lean into the techy font").

Write `brand-kit.md`: colors **as hex** and fonts **by name** (they become the mode-2 CSS tokens — a missing hex renders default blue; a **light or neon primary is fine** — the renderer derives readable on-primary and text tokens and says so), logo URL **or `logo: none — wordmark is set type`** (a brand with no logo file is valid; the templates show the name), tagline, pricing, voice read. Then `assets/references.md`:
- **Product brand:** 5-10 real product image URLs + per-SKU geometry notes.
- **Decide `brand_type` here at Step 1 — before the interview, not while writing files after it — and announce it** ("Pneuma Media → service brand, no product to photograph — routing on that"). Write it into `rules.md` YAML frontmatter (`brand_type: service | product`) — it is a structured field three forks depend on, never a sentence in prose.
- **Service brand**: proxy-subject references — the client's world, the outcome, the people — plus a **proof inventory**: real result screenshots (source + date range), real testimonials (quote, name, source), headshots with permission. Ask for these in the interview (Step 2, Q3); what isn't in the inventory cannot be rendered by the proof/testimonial templates, by design.

## Step 2 — Interview (5 questions, ONE pass, framed by what the sweep + scrape found — ask only what's still missing)

1. Your brand in one line + how you want to sound (2-3 words) + **your top 2-3 competitors, by name** → `brand-guide.md`. Names are required, not optional: `/ad-research`'s named-competitor path (Apify page pull, the higher-quality one) is unreachable without them. Categories alone leave research on keyword search.
2. Best customer today — describe a real person. What actually makes them buy? → `icp.md`
3. **VoC: paste 3-5 real customer quotes** (reviews, DMs, support tickets). The single highest-leverage input in the pipeline — a scrape sees what the brand claims, never what customers say. Push once; accept "none" gracefully. (No quotes offered? Product brand: review-widget APIs or the browser-pane DOM route per PLAYBOOK. Service/B2B brand: Google reviews, G2/Capterra/Trustpilot/Clutch, LinkedIn recommendations, case-study pages — **actually run one search (`firecrawl_search "{brand} reviews"`) before writing "no independent source exists" into `icp.md`.** Reasoning that a small brand *probably* has no listing is an assumption presented as a finding; one call settles it.) → `icp.md`. **Service brands: also ask for proof assets in the same breath** — "any real result screenshots, testimonials you have permission to use, client headshots?" → `assets/references.md` proof inventory. Real testimonials double as VoC.
4. Who is NOT your customer, even if they'd buy? → `icp.md` (the anti-persona sharpens angles more than the persona)
5. Anything you legally can't claim, or that must always/never appear (logo, disclaimers, licensing)? → `rules.md ## Rules`

**No founder on the call?** Derive from the scrape and flag every file — but **ask the operator once, in one line: "do you have a line to {brand}? A results screenshot, headshot permission, and a stated guarantee are the highest-value things anyone could hand us."** **Operator IS the founder** (their own brand)? Say so and turn it into the same list as a to-do: *"you're the brand, so this is a dig-up list, not an email"* — `proof-gaps.md` then reads as their own checklist. Pneuma's run skipped this to save a turn and left 12 documented client results unusable. Then add the category compliance floor to `rules.md` unprompted — food/supplements/licensed marks per PLAYBOOK field notes, and for **every service brand the PLAYBOOK service compliance floor** (numbers traced, no fabricated people, no generated dashboards, no unconfirmed "as featured in", results disclaimer). No founder available? Derive from the scrape and flag every file `derived, not founder-confirmed` — **this is the default, not a question.** Don't ask "real engagement or spec work?"; derive, flag, and state it once at handoff. The PLAYBOOK already prescribes the behavior, so asking spends a turn to reach the same place.

## Step 3 — Real ads → invoke /ad-research

Invoke **/ad-research** for this slug now (it pulls the brand's + competitors' live ads and writes findings). Don't duplicate its logic here.

## Step 4 — Style pick (gallery, mode: style)

**Mode-2-heavy brand (service, type/quote/data formats)?** Render 6-8 real branded options through `render.js` — three grounds × the formats the research supports — and make *those* the gallery; competitor screenshots go in as `kind: "reference"` items (context-only, no verbs). Product brand: build the gallery from the research screenshots + any inspiration images the user has ("got ads or images you already love? drop them in" — always invite). Service brands: make sure the gallery shows both photographic (proxy-subject) and type/proof directions, and both polished and unpolished examples if research found both — **polish level is the operator's pick, never presumed** (PLAYBOOK Render modes). Template + fill instructions: PLAYBOOK **Gallery** section. Write it into `{CLIENTS_ROOT}/{slug}/real-ads-reference/`, `open` it. When the export JSON comes back:
- **Infer match-vs-contrarian from the export and state it** ("both category references killed → contrarian; say otherwise"). Don't pose the question and then answer it yourself — Pneuma's run did exactly that.
- Write `rules.md ## Default visual style` using the PLAYBOOK's **fixed field list** (Strategic call · Composition · Text on image · People · Polish level · Mood · Logo treatment · Approved grounds/formats · Source with notes verbatim) — same fields every brand, one line each
- Seed `rules.md ## Defaults`: batch size (default 6-8), aspect mix, any format/cadence preference stated. **Written once, reused every run.**

## Step 5 — Hand off (no pause)

**The style-gallery export in Step 4 is the one hard stop in onboarding** — nothing renders before the operator has picked. Once it's back: **service brands → write `proof-gaps.md`** (PLAYBOOK context schema): a short, literal, sendable list of what only the client can supply — a real results screenshot for any documented case (unblocks `proof-card`), headshot permission, whether any guarantee/risk-reversal exists (when the category leads with one and the brand states none, that is an **offer gap** to surface, not a silent compliance call), 3-5 quotes from people who *didn't* buy or hesitated. Print: the files + one line each, the style default, anything flagged derived, the proof-gaps list. Then **invoke `/ad-batch` immediately** — do not ask permission.

By this point you hold the style direction, the product, and the Defaults; there is no information the pause buys. The router's contract is *"after onboarding, a run is exactly two user actions — say 'new batch,' then click through the gallery."* An onboarding that stops to ask makes it three, and the correct user reaction is *"have you not generated any actual images yet?"* — which is exactly what happened on Kodiak. `/ad-batch` has its own cost gate; that is the real stop, and it is sufficient.
