---
version: 1.0.0
name: ad-research
description: |
  Real-ads reality check for the ad-engine chain: what the brand and its
  category actually run on Meta right now. Screenshots + structured
  findings into {CLIENTS_ROOT}/{slug}/real-ads-reference/. Called by
  /ad-onboard at setup; re-run monthly (staleness checked by /ad-batch).
  Findings are OPTIONS the style pick decides on — never silent decisions.
  Use when: chained from /ad-onboard, "refresh the ad research for
  {brand}", "what are {brand}'s competitors running", "/ad-research".
  NOT for: deep per-competitor teardowns with LP scrapes (meta-ads-analyst),
  style decisions (/ad-onboard's gallery does that).
argument-hint: "[slug] [--competitors a,b,c]"
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
---

# Ad Research

**Two rules earned the hard way (TakeOff, 2026-09-06):** (1) the brand's *own* ad presence is read from its **Page transparency** line in the Ad Library ("This Page isn't currently running ads" / the active count) — never from a keyword search on the brand name, which matches ad *copy* and returns noise (a search on `takeoff.llc` matched every ad containing "LLC"). (2) Named competitors come from `brand-guide.md` — onboarding now requires 2-3 names, so the Apify page-URL path is reachable; if names are still missing, ask for them here rather than silently downgrading to category keywords. — reality before rendering

Never render until someone has looked at real ads for this brand and category (PLAYBOOK principle 3 — Rhoback batch 1 failed exactly here). This skill produces **evidence, not decisions**: the style pick and the operator decide what to do with it. Shared knowledge: `.claude/skills/ad-engine/PLAYBOOK.md` — **Tool fallbacks** and **Field notes**.

## Pull — Apify first, at scale (about $0.10 per brand); Playwright screenshots are the fallback

Competitor names come from `brand-guide.md` (2-3) plus the brand itself. **Default path (2026-09-15, Zach: "it's so cheap to pull ads at scale, and we can use them as inspiration too"):** `curious_coder/facebook-ads-library-scraper` through the Apify MCP, ~$0.00075 per ad.

1. **Named advertisers** — the Facebook *page URL* of each competitor (never a keyword search on a brand name, see the rules above), `count: 60–100` per brand, active ads, `country: US` unless the brand says otherwise. **Category** — one keyword run on the category term (`search_type=keyword_unordered`), `count: 100`, to see what the *rest* of the feed looks like.
2. **Cost line before the run:** `N advertisers × ~80 ads + 1 category × 100 ≈ N×$0.06 + $0.08`. Under $1: state it and go. Over $1: ask (the standing rule).
3. **Download every creative** (`snapshot.images[].original_image_url` / `videos[].video_preview_image_url`) into `real-ads-reference/ads/{advertiser}/` — CDN URLs expire; verify the byte count. Keep the JSON (`ads.json`) with advertiser, start date, copy, landing URL, platform mix — that is the copy-pattern corpus `/ad-copy` reads for the guarantee/offer language.
4. `node {SKILL_DIR}/../ad-engine/render/inspiration.js --dir real-ads-reference/ads` builds `real-ads-reference/contact-sheet.png` — the *category* at a glance, next to the person's own `assets/inspiration/` sheet.
5. **The brand's own presence** still comes from the Page transparency line, not from a search.

The scale is the point: two screenshots per competitor showed *a* style; a hundred ads show the distribution — what dominates, what nobody runs (white space), what the copy leans on. These ads go into the style-pick gallery as `kind: "reference"` items (competitor context, no verbs) and are never copied — the person's own references in `taste.md` decide the look; the category tells you what to be different from.

**Apify not connected?** Playwright MCP: load each search, screenshot the grid + 1-2 ad details per brand → `real-ads-reference/`. Say in `findings.md` that the sample is thin (2 ads per brand), so the style pick knows what it's looking at.

## Read the evidence

Answer, with screenshots as proof: product-forward or lifestyle? text baked on image or caption-only? logo treatment? one converged category style, or a split? What formats dominate (statics / video / dynamic catalog)?

Calibration from tested categories: apparel converged on one style across 4 brands; snacks split into two valid opposites; hydration ran ~0% designed statics and a text-on-image static still won the A/B — **a zero-statics category is white space to test into, not a prohibition**. When two styles survive, recommend an in-batch A/B rather than picking.

## Write findings

`real-ads-reference/findings.md`: date, brands checked, the answers above, 2-4 candidate style directions (each pointing at its screenshot), and a one-line "what changed" if this is a refresh. If `rules.md ## Default visual style` exists and the category has visibly moved since it was set, **flag the drift — don't edit the style**; the operator re-picks via gallery if they want.

## Cadence + hand off

Full pull at onboarding, refresh **monthly** — this is a baseline, not a live feed (`/ad-batch` checks the findings date and offers a refresh at 30+ days). Deep teardown wanted (every creative downloaded, LPs scraped, patterns clustered)? Chain `/meta-ads-analyst` — don't rebuild it here.

End: chained from /ad-onboard → return to it (style pick is next). Standalone → print findings summary + "run /ad-batch when ready."
