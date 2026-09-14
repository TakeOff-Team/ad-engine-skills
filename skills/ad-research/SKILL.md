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

## Pull (5-10 minutes, ~$0)

Competitor names come from `brand-guide.md` (2-3) plus the brand itself. Meta Ad Library is public, no login:
`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q={name}&search_type=keyword_unordered`

- Playwright MCP: load each search, screenshot the grid + 1-2 ad details per brand → `{CLIENTS_ROOT}/{slug}/real-ads-reference/`. Playwright dead? Apify fallback per PLAYBOOK (~$0.11/brand, structured JSON + creative URLs).
- **Check the brand's own page-transparency line.** "This Page isn't currently running ads" is a *finding* (growth may be TikTok/influencer/retail — Bloom), not a dead end.

## Read the evidence

Answer, with screenshots as proof: product-forward or lifestyle? text baked on image or caption-only? logo treatment? one converged category style, or a split? What formats dominate (statics / video / dynamic catalog)?

Calibration from tested categories: apparel converged on one style across 4 brands; snacks split into two valid opposites; hydration ran ~0% designed statics and a text-on-image static still won the A/B — **a zero-statics category is white space to test into, not a prohibition**. When two styles survive, recommend an in-batch A/B rather than picking.

## Write findings

`real-ads-reference/findings.md`: date, brands checked, the answers above, 2-4 candidate style directions (each pointing at its screenshot), and a one-line "what changed" if this is a refresh. If `rules.md ## Default visual style` exists and the category has visibly moved since it was set, **flag the drift — don't edit the style**; the operator re-picks via gallery if they want.

## Cadence + hand off

Full pull at onboarding, refresh **monthly** — this is a baseline, not a live feed (`/ad-batch` checks the findings date and offers a refresh at 30+ days). Deep teardown wanted (every creative downloaded, LPs scraped, patterns clustered)? Chain `/meta-ads-analyst` — don't rebuild it here.

End: chained from /ad-onboard → return to it (style pick is next). Standalone → print findings summary + "run /ad-batch when ready."
