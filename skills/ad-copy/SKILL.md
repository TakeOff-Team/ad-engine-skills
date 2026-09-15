---
version: 1.0.0
name: ad-copy
description: |
  The copywriting pass of the ad-engine chain. Runs inside /ad-batch after
  angles and before any render: reads the brand's VoC, pains, proof inventory
  and category findings, then writes copy.md — for every concept, the reader's
  pain in their own words, the awareness stage it's written for, the on-image
  copy (eyebrow, headline + 2 variants, subhead, CTA), and a claims ledger that
  traces every number and quote to assets/references.md. Static-ad copy only:
  what fits in 3-9 words on a 4:5 canvas. Self-contained digest in references/;
  does not read or depend on the general direct-response-copy skill.
  Use when: invoked by /ad-batch Step 1.5, or "write the ad copy for {brand}",
  "rewrite these headlines", "/ad-copy {slug}".
  NOT for: long-form (landing pages, emails), captions/ad-unit copy (/ad-review
  writes those), angles (/ad-batch Step 1), or anything without an onboarded brand.
argument-hint: "[slug] [--concepts c01,c02] [--rewrite]"
allowed-tools: Read, Write, Edit, Grep, Glob
---

# Ad Copy — think like the reader, say their pain better than they can

> **The whole skill, in the operator's words:** "You want to understand their pains and put yourself in their shoes. That way, you can talk in their terms. All copywriting is thinking like the other person and expressing their pains better than they can — and expressing their pains so well and articulately that they assume you have the answer and solution."

Everything below is that sentence, made mechanical. The reader never sees a "concept." They see eight words in a feed and decide in under a second whether those words are *about them*. This pass exists so every concept's words are about them.

Read `references/ad-copy-digest.md` once before writing (headline formulas and why they fail, awareness levels, pain quantification, the So-What chain, testimonials, CTAs, AI tells). Shared chain knowledge: `.claude/skills/ad-engine/PLAYBOOK.md` — **Design principles**, **Context schema**, **Service compliance floor**.

## Inputs (read all, in this order)

| File | What you take from it |
|---|---|
| `voc.md` | **The bank — read it first.** Every verbatim customer line the onboarding mined (calls, reviews, comments, community), tagged pain / desire / objection / trigger / outcome with source and stage, plus `## Their vocabulary` and `## Counts`. The headline's words come from here; `## Counts` decides which pain leads (what most people say, not what the founder says); `## Objections & hesitations` is where the risk-reversal and "but what about…" lines come from. Missing or `voc_confidence: low` → say so at the top of `copy.md` |
| `icp.md` | **The persona + the load-bearing quotes.** Who buys, the trigger, the anti-persona, and every VoC quote. VoC phrasing is the copy; you are arranging their words, not inventing yours |
| `brand-guide.md` | Tone words, what the brand never says, competitor names |
| `rules.md` | `## Rules` (claims floor, banned claims), `## Default visual style` (text-on-image y/n, polish), `## Defaults` (headline variant count, stage preferences) |
| `taste.md` | **The register on the image** — the digest's "voice on the image" line and the feel words. Remy's references are lowercase, casual, ≤ 6 words, one keyword marked; a headline that sounds like a template fails his taste even when the argument is right. Match the register they showed you; mark the ONE keyword with `<em>` for templates that give it the treatment |
| `assets/references.md` | **The only source of numbers and quotes.** Proof inventory: documented results, testimonials with sources, what's confirmed vs derived |
| `real-ads-reference/findings.md` | Category copy patterns (what the guarantee/offer language looks like out there) and **offer gaps** |
| `ad-angles.md` (this run's block) | The concepts you're writing for: angle, persona, trigger, format, render path |

If `icp.md` has no VoC quotes, say so at the top of `copy.md` and write from the pain section — but flag every headline `derived, not customer-language`. Never present invented phrasing as the customer's.

## The method, per concept

**1. Stand where they stand.** One line: who is reading this, at what moment, in what mood. Not a persona label — a person. *"A roofing owner at 9pm, phone face-down, third week the schedule's had holes in it."*

**2. Their pain, in their words.** Quote the `voc.md` line closest to this angle, verbatim, with its source — and check `## Counts`: if three people said it one way, that is the way. For a most-aware / offer angle, take the line from `## Objections & hesitations` instead: the headline answers the objection they actually raised. This is the sentence the headline is going to beat.

**3. Their pain, said better than they can.** Run the So-What chain down from the feature to the thing they actually feel or lose. Quantify it when the inventory allows (`references.md`), make it a scene when it doesn't. Write the one line that makes them think *"that's exactly it."* This line is the seed of every headline variant — not the offer.

**4. Pick the awareness stage** (digest §Awareness). Where is *this* reader for *this* angle? Unaware readers get identity or a scene; problem-aware get the pain named; solution-aware get the mechanism; product-aware get proof or a differentiator; most-aware get the offer, guarantee, price. **The stage decides which headline formula is even eligible.**

**5. Write the on-image copy.**
- **Eyebrow — default OFF.** *(The AI Course review, 2026-09-13: the operator called the corner eyebrow pill "the worst thing ever, not only for this batch but for other batches. No one's going to notice that.")* A 22px label in the corner of a 1080px canvas is invisible in-feed. If the reader needs the context, it belongs **in the headline**. Only fill the eyebrow when `rules.md ## Defaults` explicitly asks for one. When you do: the audience callout or the pain, never the brand's positioning. *"For pool service companies"* / *"Still chasing every lead?"* — not *"Revenue, not rankings."* If it could be the brand's tagline, it's wrong.
- **Headline + two variants** — 3–9 words. Each variant uses a *different* formula from the digest (specificity / question / transformation / contrarian / master-formula / direct statement…), all at the chosen stage. Mark the accent phrase with `<em>` for the hero template. The first is your pick; the other two are for revise and A/B.
- **Subhead** — one line, the mechanism or the proof, never a second headline.
- **CTA** — describes the benefit, not the action (*"See how the phone starts ringing"* beats *"Learn more"*). Fit the template's button: 2–5 words.
- **Template-specific slots** — proof-card numbers, testimonial quote (verbatim, `<mark>` on the payoff phrase, source line), table rows, notes-body paragraphs. Every one of them from the inventory.

**6. Claims ledger.** Every digit, percentage, timeframe, name, and quote in the copy → the line in `assets/references.md` it comes from. **No ledger entry, no claim.** A number you can't trace gets rewritten into a claim you can (*"$124.4K in 30 days"* with no source becomes *"the phone started ringing in week one"* only if *that* is documented — otherwise it's the mechanism, not a result).

**7. The test.** Read the headline aloud as **a cold reader who has never heard of the brand** — the default audience for paid social. **Every pronoun needs a referent inside the creative.** "If *it* doesn't deliver", "why *this one* is different" and "a *system* that runs" all failed review on The AI Course because a scroller has no idea what *it*, *this one* or *system* means. Name the category ("an AI system", "The AI Course"). Then read it aloud as the reader. Ask: is this *about me*, or about them? Would I say this sentence to a friend about my own problem? Does it pass the AI-tells list? Would a competitor's name fit in this headline unchanged (then it isn't specific enough)?

## Batch-level rules

- **Stage spread — but check the audience first.** If `rules.md ## Defaults` says the traffic is cold / the reader is not product-aware, product- and most-aware concepts are allowed **only when the headline also introduces the product** (The AI Course, 2026-09-13). Otherwise: across the batch, at least one concept at each end (unaware/problem-aware *and* product/most-aware) unless `rules.md ## Defaults` narrows it. A batch where every concept sits at problem-aware (Pneuma, 2026-09-04) tests one hypothesis eight times.
- **Guarantee / risk reversal is the top of the type hierarchy when the brand has one.** When `findings.md` shows the category leads with guarantees and the brand states none, write **one line at the top of `copy.md`**: *"Offer gap: every competitor pulled leads with a guarantee; {brand} states none. Worth a conversation — the copy below stays inside what's documented."* Then write nothing that implies one. That line is for the operator; it is not a reason to invent an offer.
- **Never lift a competitor's line.** Findings tell you what *shape* works; the words come from this brand's customers.
- **Never reword the brand's own homepage headline and call it a concept.** It can be one of the three variants, labelled `house line`, never the pick.
- **Service compliance floor applies to every word** (PLAYBOOK): no number without a trace, no fabricated person, no implied endorsement, results disclaimer where a result is stated.
- **Voice**: the brand's tone words from `brand-guide.md`, but the *reader's* vocabulary from `icp.md`. When they conflict, the reader wins — a luxury brand still says "the phone isn't ringing" if that's what its customers say.

## Output — `copy.md` in the run folder

```
# Copy — {brand} · {campaign} · {date}

Offer gap: {one line, or "none found"}
VoC basis: {N quotes from icp.md} | {"derived — no customer language on file"}
Stage spread: unaware {n} · problem {n} · solution {n} · product {n} · most-aware {n}

## c01 · {angle name} · {format} · {render_path}
Reader:        {one line, a person at a moment}
Their words:   "{VoC quote}" — icp.md §{ref}
Said better:   {the articulated pain line}
Stage:         {unaware|problem|solution|product|most-aware}
Eyebrow:       {…}
Headline:      {pick}           [{formula}]
  v2:          {…}              [{formula}]
  v3:          {…}              [{formula}]  {house line, if applicable}
Subhead:       {…}
CTA:           {…}
Slots:         {template-specific: quote / numbers / rows / body — verbatim, ready to paste}
Claims:        "{claim}" → references.md §{ref} · "{claim}" → §{ref}   {or: none}
Ad-unit copy:  (written in /ad-review on keep — not here)
```

One block per variant, **grouped under an `## Angle a{n} · {name}` header** (angle-first batches, PLAYBOOK principle 11). Inside an angle, the variants differ on the one axis `ad-angles.md` says they test — when it is `headline`, the pick / v2 / v3 lines *are* the variants and all of them render; when it is `subhead` or `object`, the headline is identical across the angle and only that slot moves. Reserve one line per angle for ad-unit copy (`Primary texts: (deferred)`) so Remy's 3 primary texts × 3 headlines have a home when it is switched on. `/ad-batch` fills Block B and every Playwright slot **from this file**; `/ad-review` reads it before writing captions so the caption and the creative are one message.

## `--rewrite` mode

Given concept ids and a review note ("shorter", "more specific", "wrong stage"), rewrite only those blocks, append `(rev N — {note})` to the block header, keep the ledger current. Used by `/ad-review` revise on Playwright concepts before `render.js --only`.

## Hand off

Print: stage spread · offer gap (if any) · concepts written · any `derived` flags · claims that had to be softened because they couldn't be traced (name them — the operator may have the source).
