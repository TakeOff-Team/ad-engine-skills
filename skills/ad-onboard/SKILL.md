---
version: 1.0.0
name: ad-onboard
description: |
  One-time brand onboarding for the ad-engine chain: scrape the brand, run
  the 5-question interview (VoC is the load-bearing answer), pull real ads
  via /ad-research, a taste intake (the person's own references + their
  words on why — always asked, never inferred), then a gallery style pick.
  Output: the six context files under {CLIENTS_ROOT}/{slug}/ that make
  every future /ad-batch run zero-question. Builds ONLY what's missing —
  never re-interviews facts; taste is confirmed by the person every time.
  Use when: routed here by /ad-engine for a brand with missing context
  files, or "onboard {brand} for ads", "/ad-onboard {url}".
  NOT for: generating ads (/ad-batch), refreshing research on an onboarded
  brand (/ad-research).
argument-hint: "[url-or-brand-name] [--slug <name>] [--fresh] [--taste-only]"
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
---

# Ad Onboard — once per brand

Everything here happens **once**. The six files this produces are why every later run is seamless — invest the care here, not in re-asking later. **The chain assumes it knows nothing about the person — their facts get found and confirmed, their taste gets asked and shown** (PLAYBOOK principle 10; Charlie and Remy, 2026-09-13). Onboarding is where the interviewing happens; batches stay zero-question because this step was thorough. Shared knowledge: `.claude/skills/ad-engine/PLAYBOOK.md` — read **Context schema**, **Tool fallbacks**, and **Field notes** (compliance floor) before starting.

## Step 0 — Cache check + tool probe (30 seconds)

Resolve `CLIENTS_ROOT` (PLAYBOOK schema section). For each of the five files that already exists: load it, summarize in one line, ask "reuse or refresh?" — build only the gaps. Then probe tool availability (one cheap Firecrawl call, one Higgsfield `balance` call) — MCP dies at session startup, not call time; the PLAYBOOK fallback table covers every stage, so a dead server changes the tool, never the plan.

## Step 0.5 — Context sweep (before any question — find what they already have)

Most operators already have some of this written down: an ICP or persona doc, a brand guide, a voice profile, positioning, sales-call transcripts, review exports, testimonials, case studies, old ad copy. **Never make someone re-create what's already in their vault.** Before the interview, look — bounded, never the whole project:

1. **Where:** the conventional homes first — `{CLIENTS_ROOT}/{slug}/`, `04-Brand/{slug}/`, `04-Brand/clients/{slug}/`, `10-Transcripts/**/{slug}*`, `clients/{slug}/`, then a project-wide filename + frontmatter search (`find`/`grep`, depth ≤ 4, excluding `node_modules`/`.git`/`09-Archive`), capped at ~40 candidates.
2. **What:** filenames or frontmatter matching `icp | persona | customer | audience | brand-guide | brand guide | voice | positioning | messaging | offer | testimonial | review | case-stud | transcript | call | sales | ad | creative | swipe`, **and** files whose first ~30 lines mention the brand name. Transcripts (`.md .txt .vtt .srt`) in transcript folders count even without the name in the filename.
3. **Read only frontmatter + the first ~30 lines** of each candidate to classify it. Print one table: `file · what it looks like · feeds (brand-guide / icp / rules / references / VoC)`. Then one question: **"Use these? (yes by default — say which to skip)."** *This is one of the chain's few permitted questions and it is not optional — printing the table and proceeding (The AI Course, 2026-09-13) is a bug.* **Then actually open what you listed.** A file in the table that fed nothing is a false claim; three 1:1 transcripts were listed and never read. **Transcripts get their bodies read, not their summaries** — the verbatim member/customer lines are the point.
4. **Pre-fill from what was found — then read it back.** Found facts are never silently adopted: print each pre-filled line with its `source:` and ask for a yes / fix in one pass ("here's what your folder says about your customer — correct me"). **Taste is never pre-filled from the sweep**: a found brand guide or old creative is a reference to *show* in Step 2.5, not an answer to skip it. Tag every derived line `source: {path}`: tone words and pillars → `brand-guide.md`; persona, trigger, anti-persona → `icp.md`; **verbatim customer lines from transcripts and reviews → VoC** (the single biggest win — a real sales call has the customer's words in it); results, testimonials, screenshots already on file → `assets/references.md` proof inventory; stated constraints → `rules.md`.
5. **Interview only the gaps.** A question whose answer is already sitting in a found file is exactly the bug principle 1 forbids.
6. Close with **one open question — always, even when the operator IS the brand**: *"Anything that isn't in this folder — a Notion page, a Google Doc, call recordings, a reviews export, a results screenshot? Paste it or drop it in and I'll fold it in."* TakeOff's run skipped this and two of its proof gaps were exactly the things that question surfaces.

Nothing found → say so in one line and go to the interview. Never skip the sweep silently; the operator should see that you looked. **Record the sweep timestamp** in `brand-kit.md` frontmatter (`swept_at:`) — a file written after the sweep is invisible to the chain (a 9/11 call transcript landed at 09:51, after the sweep, and the operator had to point at it). **Re-sweep for anything newer than `swept_at` at Step 4 (before the style pick) and again at every `/ad-batch` Step 0** — transcripts and notes keep arriving while a brand is being onboarded.

## Step 0.7 — VoC mining (the ammo for the copy — before the interview, after the sweep)

The sweep *finds* transcripts; this step *mines* them. Zach, 2026-09-15: *"it should mine sales call transcripts, that should be a massive part… as much ammo as possible to write great fucking copy."* Output is **`voc.md`** — the VoC bank every copy decision draws from. Do this every onboarding, and re-run it at any batch where new sources have appeared since `swept_at`.

**Sources, in order of value (pull every one that exists; say which ones didn't):**
1. **Sales / discovery / onboarding call transcripts** — the vault's transcript folders (found by the sweep), plus ask: *"where do your sales calls live? Fathom, Granola, Zoom cloud, Otter, a folder?"* A Granola / Fathom MCP in the session → pull the last 20 calls with the brand's customers. **Read every body in full**, not summaries — the customer's exact sentence is the asset. Tag each quote with file + timestamp.
2. **Support, DMs, community posts, onboarding replies** — a Skool/Circle/Slack export, a "wall of love" folder, inbox screenshots (only ever quoted, never rendered without permission).
3. **Independent reviews** — Trustpilot / G2 / Capterra / Clutch / Google / Amazon: `firecrawl_search "{brand} reviews"` first, then pull the pages; product brands also the on-page review widget (PLAYBOOK fallbacks). **Pull the low-star and hesitant ones on purpose** — a testimonial wall has zero objections in it, and objections are half the copy.
4. **The founder's own audience** — YouTube comments on their videos (`yt-dlp --write-comments --skip-download <url>` or the Apify YouTube comments actor, ~$0.01 per video), Reddit threads on the category (Apify Reddit scraper), the questions people ask under competitor ads (Ad Library comments aren't scrapable; skip).
5. **Competitor ad copy** — already in `real-ads-reference/ads.json` from `/ad-research`: the category's promises and guarantees, read for *shape*, never lifted.

Cost line before any Apify run (standing rule: over $1 → ask). Typical: 30 YouTube videos + one Reddit pull ≈ $0.40.

**Write `voc.md`** — every entry is a verbatim quote, with source and date, tagged with an awareness stage. Sections:
- `## Pains` (what hurts, in their words) · `## Desires` (what they want instead) · `## Objections & hesitations` (why they didn't buy, what they feared, what they'd need to see — **at least five, or say "none found on any source" explicitly**) · `## Triggers` (the moment they went looking) · `## Outcomes` (what they say after — the testimonial material, with names only where permission exists) · `## Their vocabulary` (the 20–40 phrases they use that the brand doesn't: "AI slop", "half-finished projects", "watch every video") · `## Counts` (how many quotes per theme, per source — the copy leads with what people say most, not what the founder says).
- Frontmatter: `sources:` (each with count), `mined_at:`, `objections_found: N`, `voc_confidence: high (≥40 quotes, ≥2 source types, objections present) | medium | low`.

`icp.md` keeps the persona and the 5–10 *load-bearing* quotes; `voc.md` is the full bank `/ad-copy` reads first. **Never paraphrase into the bank** — a tidied quote is an invented one.

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
3. **VoC: where do the customer's words live?** — *"Where are your sales calls (Fathom / Granola / Zoom / a folder)? Any support inbox, community, or review export? Paste 3–5 quotes you remember if nothing else."* Everything named goes through Step 0.7 mining; pasted quotes go straight into `voc.md` with `source: founder, from memory`. The single highest-leverage input in the pipeline — a scrape sees what the brand claims, never what customers say. Push once; accept "none" gracefully. (No quotes offered? Product brand: review-widget APIs or the browser-pane DOM route per PLAYBOOK. Service/B2B brand: Google reviews, G2/Capterra/Trustpilot/Clutch, LinkedIn recommendations, case-study pages — **actually run one search (`firecrawl_search "{brand} reviews"`) before writing "no independent source exists" into `icp.md`.** Reasoning that a small brand *probably* has no listing is an assumption presented as a finding; one call settles it.) → `icp.md`. **Service brands: also ask for proof assets in the same breath** — "any real result screenshots, testimonials you have permission to use, client headshots?" → `assets/references.md` proof inventory. Real testimonials double as VoC.
4. Who is NOT your customer, even if they'd buy? → `icp.md` (the anti-persona sharpens angles more than the persona)
5. Anything you legally can't claim, or that must always/never appear (logo, disclaimers, licensing)? → `rules.md ## Rules`

**No founder on the call?** Derive from the scrape and flag every file — but **ask the operator once, in one line: "do you have a line to {brand}? A results screenshot, headshot permission, and a stated guarantee are the highest-value things anyone could hand us."** **Operator IS the founder** (their own brand)? Say so and turn it into the same list as a to-do: *"you're the brand, so this is a dig-up list, not an email"* — `proof-gaps.md` then reads as their own checklist. Pneuma's run skipped this to save a turn and left 12 documented client results unusable. Then add the category compliance floor to `rules.md` unprompted — food/supplements/licensed marks per PLAYBOOK field notes, and for **every service brand the PLAYBOOK service compliance floor** (numbers traced, no fabricated people, no generated dashboards, no unconfirmed "as featured in", results disclaimer). No founder available? Derive from the scrape and flag every file `derived, not founder-confirmed` — **this is the default, not a question.** Don't ask "real engagement or spec work?"; derive, flag, and state it once at handoff. The PLAYBOOK already prescribes the behavior, so asking spends a turn to reach the same place.

## Step 2.5 — Taste intake (every brand, every time — go deep; the chain will not batch until this is solid)

Charlie Crozier and Remy, 2026-09-13, via Zach: *"make it interview people as much as possible; assume it knows absolutely nothing, including their tastes and what they like. The AI is not going to do everything for them — it amplifies their thoughts at scale."* Zach, 2026-09-15: *"ask what should feel like an overkill amount of questions. Really get them to describe their style in detail, and highly recommend voice-to-text — the more context the system has, the better it works. It shouldn't recommend running until it has a great idea of the vision."* So this step is long on purpose, never skipped, never inferred from a scrape, never pre-filled from the sweep, and never answered by the operator on the brand's behalf without being flagged `derived, not founder-confirmed`.

**Open by asking them to talk, not type.** Print this, verbatim or close: *"This is the part that decides whether the ads look like you. Talk instead of typing: turn on voice-to-text (Mac: press fn twice · iPhone: the mic key · Wispr Flow / Superwhisper if you have them) and ramble through the questions below in any order. I'd rather have 800 messy words than 40 careful ones. Paste links and drop files as you go."*

Then the questions, in one message, grouped. Accept any order and any length; **keep asking until every group has something real** — one follow-up per empty group, phrased as "you didn't mention X — anything there?", never a form.

- **A. Show me.** 5–15 things you like — ads, YouTube thumbnails, posters, packaging, websites, screenshots, competitors you'd steal from, **your own past creative you're proud of**. Files, links, a folder, a YouTube channel. *For each one, one line: what do you like about it?* Then: three brands whose look you'd borrow, and *which part*.
- **B. Describe the look in your own words, in detail.** Colours you love and colours you hate. Type: pixel, clean sans, serif, handwritten, loud, quiet. Photo, illustration, or type-only. How much white space. Polished or rough. What era or scene it feels like. If a designer nailed a perfect ad for you tomorrow, describe it as if it's in front of you.
- **C. What you hate.** Three or more things you never want to see in your ads. An ad you'd be embarrassed to run. Anything a competitor does that makes you cringe.
- **D. Feel and reader.** Three words for how it should feel. Who is looking at this, where, in what mood. How should they feel after three seconds.
- **E. Assets.** Brand guide (PDF / Notion / Figma — it gets *read*, not summarised away), font files, logo files, headshots with permission, product shots, screenshots of the real product.
- **F. The bar.** The best ad you've ever seen in your category, and why it's the best.

Mechanics: links → `firecrawl_scrape` with `formats: ["screenshot"]` into `assets/inspiration/`; a YouTube channel → `yt-dlp --flat-playlist -J <channel>/videos` then `https://i.ytimg.com/vi/{id}/maxresdefault.jpg` (Remy's 24 thumbnails, 2026-09-14); files dropped anywhere → moved into the folder. Then `node {SKILL_DIR}/render/inspiration.js {slug}` builds `contact-sheet.png` + `index.md`; add `--paper` when Paper Desktop is open to mirror the folder onto an Inspiration page (files stay the source of truth).

Write **`taste.md`** (PLAYBOOK context schema): frontmatter with **`taste_confidence: high | medium | low`** (below) and `status`; **`## Style in their words`** — the transcript, verbatim and unedited (this is the most valuable block in the file; do not tidy it); the references table (file · **their** line · what you see, tagged derived); the grammar (3–5 moves that repeat across their picks, named concretely: "grid-paper ground", "one keyword gets a scribble underline", "a real screenshot floating with a shadow"); anti-taste; feel words + reader + after-feeling; polish; the bar (F) and why; brand-guide pointer; **a five-line taste digest** (ground · type move · hero object · decoration · voice on the image). Their line beats your read every time; nothing the person didn't say goes in unflagged.

**Readiness gate — `taste_confidence`.** `high` = five or more references each with the person's own why-line, a real style paragraph in their words, three or more hates, feel words, and the bar. `medium` = three or more references with why-lines *or* a real style paragraph, plus some hates. `low` = anything less, or a file built by derivation. **`/ad-engine` refuses to run a batch at `low`** — it prints what's missing and asks for it; at `medium` it runs and says so in the plan line. Never write `high` on a derived file. The gate exists because a batch rendered against a thin taste file is a batch the person will kill for reasons they could have told us up front.

No references and no words offered at all → write that at the top, derive from the site + category research, flag every line, set `low`, and say so at hand-off — never present a derived taste as theirs.

## Step 3 — Real ads → invoke /ad-research

Invoke **/ad-research** for this slug now (it pulls the brand's + competitors' live ads and writes findings). Don't duplicate its logic here.

## Step 4 — Style pick (gallery, mode: style)

**Build the options from `taste.md`, not from a default set.** Read the grammar first and pick the templates whose moves match the references (PLAYBOOK **References drive the template choice**): desk / annotated references → `annotated-hero` (with a *real* or *authored* object — never a generated UI); pure type → `typographic-hero`; photo-led → `photo-text-band` / Higgsfield with the reference as a style image. **Mode-2-heavy brand (service, type/quote/data formats)?** Render 6-8 real branded options through `render.js` — the taste-matched templates × the grounds the references use — and make *those* the gallery; **the person's own references go in as `kind: "reference"` items** (so they pick against their taste, not ours), and competitor screenshots likewise (context-only, no verbs). Product brand: build the gallery from the research screenshots + any inspiration images the user has ("got ads or images you already love? drop them in" — always invite). Service brands: make sure the gallery shows both photographic (proxy-subject) and type/proof directions, and both polished and unpolished examples if research found both — **polish level is the operator's pick, never presumed** (PLAYBOOK Render modes). Template + fill instructions: PLAYBOOK **Gallery** section. Write it into `{CLIENTS_ROOT}/{slug}/real-ads-reference/`, `open` it. When the export JSON comes back:
- **Infer match-vs-contrarian from the export and state it** ("both category references killed → contrarian; say otherwise"). Don't pose the question and then answer it yourself — Pneuma's run did exactly that.
- Write `rules.md ## Default visual style` using the PLAYBOOK's **fixed field list** (Strategic call · Composition · Text on image · People · Polish level · Mood · Logo treatment · Approved grounds/formats · Source with notes verbatim) — same fields every brand, one line each
- Seed `rules.md ## Defaults`: batch size (default 6-8), aspect mix, any format/cadence preference stated. **Written once, reused every run.**

## Step 5 — Hand off (no pause)

**The style-gallery export in Step 4 is the one hard stop in onboarding** — nothing renders before the operator has picked. Once it's back: **service brands → write `proof-gaps.md`** (PLAYBOOK context schema): a short, literal, sendable list of what only the client can supply — a real results screenshot for any documented case (unblocks `proof-card`), headshot permission, whether any guarantee/risk-reversal exists (when the category leads with one and the brand states none, that is an **offer gap** to surface, not a silent compliance call), 3-5 quotes from people who *didn't* buy or hesitated. Print: the six files + `voc.md` + one line each (`voc.md`: N quotes · N sources · N objections · confidence; `taste.md`: N references, N with the person's own line, N derived), the style default, anything flagged derived, the proof-gaps list. Then **invoke `/ad-batch` immediately** — do not ask permission.

**`--fresh`:** re-onboard a brand that already exists as if it were new (the cold re-run): move the six context files, `proof-gaps.md` and `real-ads-reference/` to `{slug}/_archive/{YYYY-MM-DD}/`, keep `assets/` (fonts, logo, cutouts, inspiration) and `batches/`, then run every step from Step 0.5 with the sweep pointed at the archive as *facts to confirm*, never as taste. Used for The AI Course, 2026-09-15.

**`--taste-only`:** an already-onboarded brand with no `taste.md` (every brand onboarded before 2026-09-14) runs Step 2.5 alone, rebuilds the style-pick options from the references if the person wants (`--repick`), and hands back to `/ad-batch`.

By this point you hold the style direction, the product, and the Defaults; there is no information the pause buys. The router's contract is *"after onboarding, a run is exactly two user actions — say 'new batch,' then click through the gallery."* An onboarding that stops to ask makes it three, and the correct user reaction is *"have you not generated any actual images yet?"* — which is exactly what happened on Kodiak. `/ad-batch` has its own cost gate; that is the real stop, and it is sufficient.
