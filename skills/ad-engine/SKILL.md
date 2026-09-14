---
version: 2.0.0
name: ad-engine
description: |
  Entry point for the ad-creative chain. Routes to the right stage and gets
  out of the way: brand not onboarded → /ad-onboard (once); onboarded →
  /ad-batch (every run). The full pipeline lives in five focused skills
  (ad-engine → ad-onboard → ad-research → ad-batch (+ ad-copy) → ad-review) sharing one
  PLAYBOOK.md, one gallery UI, and two render paths (Higgsfield for
  scenes, Playwright HTML→PNG for type / data / UI / quote formats).
  Use when: "make ads for {brand}", "run the ad engine", "generate ad
  creatives", "new ad batch", "/ad-engine".
  NOT for: video ads (higgsfield-generate), pre-spend scoring (ad-predictor),
  deep competitor teardowns (meta-ads-analyst).
argument-hint: "[url-or-brand-name] [--slug <name>]"
allowed-tools: Bash, Read, Grep, Glob
---

# Ad Engine — Router

One brand URL in → reviewed, on-brand ad creatives out, getting smarter every run. This skill only decides **where to enter the chain** — it does no work itself. **Read `PLAYBOOK.md` (same folder) in full, once, now** — downstream skills re-read only their sections; a full read here is cheaper than four greps later.

## Step 0 — Doctor (every entry, 20 seconds, no questions)

Resolve the skill folder: `.claude/skills/ad-engine` if it exists in the project, else `~/.claude/skills/ad-engine`. Then:

1. **Renderer** — `node {SKILL_DIR}/render/doctor.js` (Node ≥ 18, `render/node_modules`, the Chromium build this Playwright expects, templates present). It prints the exact fix command for anything missing.
2. **MCP presence, by tool name in this session** (never `claude mcp list` — it health-checks fresh connections and lies about the session): Firecrawl → a tool ending `firecrawl_scrape`; Higgsfield → tools ending `generate_image` and `balance` (make one `balance` call — it proves auth and gives the credit figure for the cost gate); Apify → `call-actor` (optional: named-competitor research); Playwright MCP (optional: Ad Library browsing). **Paper Desktop (optional, mode 3 — editable artboards)** is reported by the doctor in step 1, not by tool name: `render/paper.js` talks to the app directly on localhost, so it works even when no `mcp__paper__*` tools loaded in this session. Fix when wanted: open Paper Desktop.
3. Print one table — `tool · status · what it unlocks · fix` — using the community install pattern for anything missing: `claude mcp add --transport http -s user <name> <url>` (both flags required: `--transport http` for hosted servers, `-s user` so it works in every folder).

**Degrade, don't block**, except: **no Firecrawl and no pasted brand facts → stop** (nothing to onboard from); **no Higgsfield AND renderer not ready → stop** (nothing can render). One dead optional never changes the plan — the PLAYBOOK fallback table covers every stage.

## Route

1. Resolve slug + context root. **Derive the slug deterministically** (PLAYBOOK Context schema — `kodiakcakes.com` → `kodiak-cakes`) and print it before touching any folder; a differing guess between sessions silently forks a duplicate brand. `--slug` always wins.
```bash
if [ -d "04-Brand/clients" ]; then CLIENTS_ROOT="04-Brand/clients"; else CLIENTS_ROOT="clients"; fi
ls $CLIENTS_ROOT/{slug}/ 2>/dev/null
```
2. **All five context files present** (`brand-kit.md`, `brand-guide.md`, `icp.md`, `rules.md`, `assets/references.md`) → print a one-line status (brand · `brand_type` from `rules.md` frontmatter · style default · last batch date · research age) and invoke **/ad-batch**. No questions — Defaults carry the run.
3. **Some or none present** → invoke **/ad-onboard** with whatever was given (URL or name). Onboarding builds only what's missing. `assets/references.md` counts: a brand passing a four-file check without it leaves `/ad-batch` with nothing to ground renders against.
4. User explicitly asked for research/refresh ("what are competitors running", "refresh the ad research") → invoke **/ad-research** directly.
5. User pasted a gallery export JSON (`{"campaign":..., "decisions":[...]}`) → invoke **/ad-review** directly. (This works from a cold session — review doesn't need the batch session.)

## The chain (for orientation, not execution)

```
/ad-onboard   once per brand   scrape + 5-question interview + style pick
/ad-research  once, then      real ads for brand + category → findings
              monthly refresh
/ad-batch     every run       Defaults → angles → /ad-copy → render (Higgsfield | Playwright | hybrid) → pre-QA → gallery
  /ad-copy    inside batch    VoC → pain in their words → stage → headline + variants → claims ledger → copy.md
/ad-review    every run       export JSON → approve (+ 1:1 / 9:16 set) / revise / kill → captions + rules
```

The contract that keeps this seamless: **after onboarding, a run is exactly two user actions** — say "new batch," then click through the gallery and paste the export. Everything else is automatic. Any skill in the chain that finds itself asking a question already answered in the context files is violating the design — fix the skill, not the run.
