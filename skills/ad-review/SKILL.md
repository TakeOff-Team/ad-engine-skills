---
version: 1.0.0
name: ad-review
description: |
  Closes the ad-engine loop: parse a gallery export JSON — keeps become
  approved creatives with paired captions, changes become targeted
  re-renders, kills become permanent rules.md constraints, standing
  preferences land in Defaults. This is where the system gets smarter
  per brand. Works cold: a pasted export is enough, no batch session
  needed.
  Use when: the user pastes a gallery export JSON ({"campaign":...,
  "decisions":[...]}), or "process my review", "/ad-review".
  NOT for: generating creatives (/ad-batch) or the style-pick export
  during onboarding (/ad-onboard handles that one).
argument-hint: "[paste the export JSON]"
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
---

# Ad Review — where the loop closes

The 30 seconds the operator spent clicking is the most valuable data in the pipeline. Parse it three ways — ship, fix, learn — and never waste a note. Shared knowledge: `.claude/skills/ad-engine/PLAYBOOK.md` — principles 5-7, **QA truths**, **Gallery**.

Locate the campaign from the export's `campaign` field. Look, in order: `04-Brand/clients/{slug}/batches/{campaign}/` (the vault convention — CLAUDE.md puts client deliverables under the client), `05-Content/Ads/{campaign}/` (runs before 2026-09-13), `./ads/{campaign}/` (portable); if none match, `grep -rl '"campaign": "{campaign}"' --include=manifest.json` from the project root. `manifest.json` is the source of truth to update.

**Read the renderer's verdicts before you read the operator's.** `render-results.json` in the run folder is *merged by id* (never overwritten) — `by_id[<id>].warnings` and `by_id[<id>].blocking`. **Any concept with a non-empty `blocking` list cannot become `approved`**, whatever the export says, until the manifest carries `override_reason` for it (a real sentence from the operator, dated). Print the blocking ids first, before per-decision work. The AI Course (2026-09-13) approved a table whose "NO SOURCE — cannot ship" flag had been lost to a stdout grep; this is the rule that makes that impossible.

## Per decision

**Real captures ship through the Meta policy floor:** any screenshot on a keeper (proof-card, social-proof-capture) is checked at *every* aspect for unmasked profanity, names/handles, or content the 4:5 crop hid — TakeOff's 9:16 placement exposed profanity the 4:5 had cropped away. Mask or re-crop before the set ships.

**Before any decision:** read the run's `copy.md` (from `/ad-copy`) — the caption for a keeper must be the same message as its on-image line, and the claims ledger is the only source of numbers.

**`keep`** → `status: approved` in the manifest (blocked ids: see above). **Produce the placement set from the approved concept's own spec** — the exact `brand` tokens, `display_scale`, slots and template *as rendered for the 4:5 the operator saw*. Copy that render's spec entry into `render-spec.placements.json` and change only `aspect`. If templates or tokens changed since the 4:5 was rendered (check `by_id[<id>].ran_at` against template mtimes), **re-render the 4:5 too and put it back in front of the operator** — never ship a set that doesn't match what was approved (The AI Course c03: set at scale 1.45, approved original at 1.0). Playwright concept → `render.js` for the same slots at `1:1` and `9:16` (free); Higgsfield concept → re-render the same prompt at `1:1` and `9:16` (credits go to winners only), download, verify; hybrid → both. Files land next to the 4:5 as `{id}-1x1.png` / `{id}-9x16.png`, manifest lists the set. `rules.md ## Defaults` can narrow the set. Then write a paired caption per keeper in `captions.md` — primary text + headline + CTA, in brand voice (`brand-guide.md` tone + `icp.md` language; VoC phrasing beats invented copy), claims from on-pack/verified facts only. Real ads carry copy in the caption in most categories — the caption IS part of the deliverable. A keep note that flags a defect ("approved but the flavor strip reads STRAWBEDOY") → mark `approved-with-fix`, list it in the hand-off — don't let it silently ship.

**`revise`** → right concept, wrong execution. The note is the fix instruction. **Playwright concept:** a copy note ("shorter headline", "wrong stage") → `/ad-copy --rewrite <id>` with the note. **"Make the headline bigger"** — check the cause before touching copy: (1) read `by_id[<id>].fit` in `render-results.json` — if the headline was *not* shrunk (`size` == template base, `clipped:false`), the face draws small for its em (pixel/bitmap fonts like PP NeueBit) → set `brand.display_scale` (1.3–1.5) in the spec, re-render; (2) if it *was* shrunk to fit, the copy is too long → `/ad-copy --rewrite` shorter. The AI Course lost a review round treating a metrics problem as a copy problem. Then: paste the rewritten slots into `render-spec.json`, re-run `render.js --only=<id>` — free, seconds, no model variance; a layout note may be a template edit (then test-render before re-running). **Higgsfield concept:** re-render **just that concept** with the note folded explicitly into the prompt (same reference, same model unless the note implicates it). Mark the original `superseded`, download the new render, pre-QA it (PLAYBOOK QA truths — zoom the exact thing the note complained about), then show it inline or in a mini-gallery for a final keep/kill. No note in the export? Ask for the one line — never guess the fix.

**`kill`** → the note becomes a constraint, **generalized** ("clear cup reads as absence of color" → "color presence is a scroll-stop requirement — never build a composition whose subject is an absence") — but **classify it before filing it**:
- **Defect** (objectively wrong — pack geometry, spelling, logo placement, compliance; for mode 2: an untraceable number, an unsourced quote, a generated dashboard) → `rules.md ## Rules`, permanent, never broken.
- **Taste** (subjective — "too little color," "feels stock," "not our vibe") → `rules.md ## Defaults`, a strong default the wildcard is still allowed to test against. One person's reaction to one image is a preference, not a law; two consecutive batches saying the same thing promotes it.
Tag each with its source (`from c03, 2026-08-24`) so a rule can be traced and revisited. **A kill with NO note is data, not a rule** (principle 7): record it in the manifest, look for a pattern across the batch, and *ask* before hardening — Bloom's two reasonless kills nearly deleted a working format when the real causes were color and pack geometry.

**Wildcards** (concepts tagged `wildcard` in the manifest) get the opposite treatment: a **kept** wildcard is the release valve — say so explicitly ("the wildcard won — want to update your default toward this?") and update `## Defaults` only on a yes. A killed wildcard writes nothing; it did its job by being tested.

**Standing preferences** → any decision revealing a lasting default goes to `rules.md ## Defaults` — and **every one is confirmed in one line before it's written** ("noting that as your default — say 'just this once' to keep it per-batch"); six Defaults written silently is six decisions the operator never made (The AI Course). Then: (a) explicit language — "always", "every week", "never", "from now on"; (b) the same format mix, batch size, or kill-pattern in two consecutive reviews. Confirm in one line ("noting that as your default — say 'just this once' to keep it per-batch"), then write it.

## Hand off

Print compact: **N approved (+ N with fixes pending) · N superseded · N killed · rules added this run** (quote them — the operator should see the system learning) · folder path. Then the next actions, pick-one style: next `/ad-batch` (say when) · `/ad-predictor` for pre-spend scoring · Meta Ads connector push as paused ads (needs user auth in claude.ai settings). Don't build those here.
