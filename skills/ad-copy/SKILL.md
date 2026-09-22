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
  Also writes the Meta ad-unit copy per angle (ad-unit.md / ad-unit.json).
  NOT for: long-form (landing pages, emails), angles (/ad-batch Step 1), or
  anything without an onboarded brand.
argument-hint: "[slug] [--concepts a1-v1,a2-v1] [--rewrite]"
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

**2. Their pain, in their words.** Quote the `voc.md` line closest to this angle, verbatim, with its source — and check `## Counts`: if three people said it one way, that is the way. For a most-aware / offer angle, take the line from `## Objections & hesitations` instead: the headline answers the objection they actually raised. When `## Pain overlap` shows a pain both the founder and the customers name, lead with it; a founder-only pain gets at most one variant (it is a hypothesis); a customer-only pain the founder never listed is the batch's wildcard-worthy angle. This is the sentence the headline is going to beat.

**3. Their pain, said better than they can.** Run the So-What chain down from the feature to the thing they actually feel or lose. Quantify it when the inventory allows (`references.md`), make it a scene when it doesn't. Write the one line that makes them think *"that's exactly it."* This line is the seed of every headline variant — not the offer.

**4. Pick the awareness stage** (digest §Awareness). Where is *this* reader for *this* angle? Unaware readers get identity or a scene; problem-aware get the pain named; solution-aware get the mechanism; product-aware get proof or a differentiator; most-aware get the offer, guarantee, price. **The stage decides which headline formula is even eligible.**

**5. Write the on-image copy.**
- **Eyebrow — default OFF.** *(The AI Course review, 2026-09-13: the operator called the corner eyebrow pill "the worst thing ever, not only for this batch but for other batches. No one's going to notice that.")* A 22px label in the corner of a 1080px canvas is invisible in-feed. If the reader needs the context, it belongs **in the headline**. Only fill the eyebrow when `rules.md ## Defaults` explicitly asks for one. When you do: the audience callout or the pain, never the brand's positioning. *"For pool service companies"* / *"Still chasing every lead?"* — not *"Revenue, not rankings."* If it could be the brand's tagline, it's wrong.
- **Headline + two variants** — 3–9 words. Each variant uses a *different* formula from the digest (specificity / question / transformation / contrarian / master-formula / direct statement…), all at the chosen stage. Mark the accent phrase with `<em>` for the hero template. The first is your pick; the other two are for revise and A/B.
- **Subhead** — one line, the mechanism or the proof, never a second headline.
- **CTA** — describes the benefit, not the action (*"See how the phone starts ringing"* beats *"Learn more"*). Fit the template's button: 2–5 words.
- **Template-specific slots** — proof-card numbers, testimonial quote (verbatim, `<mark>` on the payoff phrase, source line), table rows, notes-body paragraphs. Every one of them from the inventory.

**5b. The three cold-reader questions — a strong default, not a straitjacket.** (Zach, 2026-09-18: *"our copywriting has been fine, but a lot of the time it's missing context."* Every AI Course round said it: *"not sure it explains enough"*, *"more context about the AI system in the sub headers"*, *"what's 'it'?"*, *"why this one?"*) For someone who has never heard of the brand: **(a) what is this**, **(b) who is it for**, **(c) why care now**. The *creative as a whole* answers (a) and at least one of (b) or (c) — not every element, and not in every ad.

- **The headline carries the hook** and may answer none of them.
- **(a) usually lands in the subhead**, so write one by default: the product named and the outcome, in plain words ("The AI Course: build a working AI system on your own machine, live, in about two weeks"). It can just as well live in the object, the card, the note, a screenshot of the product, or the image itself when the product is visibly the thing being sold.
- **Skip it deliberately, with a reason, when:** the traffic is warm or retargeting (`rules.md ## Defaults` says so), the brand is already the category name to this reader, the format is a pure-type or brand line where extra words would kill it, or the operator's taste says minimal and they have seen the trade. Write the reason on the concept in `copy.md` (`Context: carried by the object` / `Context: skipped — retargeting`). A deliberate skip is a choice; a forgotten one is the bug.
- **Across the batch**, at least the cold-audience angles must pass. An ad where a stranger cannot tell what is being sold *and* nobody chose that is a picture, not an ad.

**5c. No em dashes. Ever.** (Zach, 2026-09-18: *"an instant dead giveaway when it comes to AI."*) No `—` and no `–` used as punctuation in any line a customer sees: headline, subhead, CTA, note, card text, caption, ad-unit copy. Use a period, a comma, a colon, or a new line. An attribution goes on its own line ("Greg, on Trustpilot"), never "— Greg". A range keeps its en dash ("3–5", "Jan–Aug"); that is typography, not an AI tell. Hyphens inside words ("14-day", "e-comm") are fine. The renderer blocks any creative that carries one.

**6. Claims ledger.** Every digit, percentage, timeframe, name, and quote in the copy → the line in `assets/references.md` it comes from. **No ledger entry, no claim.** A number you can't trace gets rewritten into a claim you can (*"$124.4K in 30 days"* with no source becomes *"the phone started ringing in week one"* only if *that* is documented — otherwise it's the mechanism, not a result).

**7. The test — write the cold read down.** For every concept, add one line to `copy.md`: `Cold read: "{what a stranger would say this ad is selling, after two seconds}"`. Vague ("something about AI") is a flag, not an automatic fail: either add the missing context, or write the reason it is fine (warm traffic, the object carries it, the operator wants it bare). The line always gets written; the judgment stays with the person. This is the check the operator was doing by hand on every review round. Then read the headline aloud as **a cold reader who has never heard of the brand** — the default audience for paid social. **Every pronoun needs a referent inside the creative.** "If *it* doesn't deliver", "why *this one* is different" and "a *system* that runs" all failed review on The AI Course because a scroller has no idea what *it*, *this one* or *system* means. Name the category ("an AI system", "The AI Course"). Then read it aloud as the reader. Ask: is this *about me*, or about them? Would I say this sentence to a friend about my own problem? Does it pass the AI-tells list? Would a competitor's name fit in this headline unchanged (then it isn't specific enough)?

**8. Ad-unit copy — per ANGLE, the text that ships with the image.** (Zach, 2026-09-18; field research with sources: `06-Projects/ad-creative-workshop/meta-ad-unit-research.md`.) Meta takes up to five options each for primary text, headline and description and **mixes them per viewer**, so every headline has to read correctly next to every primary text. That is Remy's "3 primary texts × 3 headlines, any pairing" rule, and it is why this is written per angle, not per image. For each angle write:
- **3 to 5 primary texts**, three shapes: one that lands in **40 characters** (Reels truncates there), one at **~125** (the feed's "see more" line), one longer story or proof version.
- **3 to 5 headlines**, **40 characters max**, the strongest under **27** (mobile truncation).
- **1 to 2 descriptions**, **25 characters**. Often hidden; support only, never the message.
- **One CTA button** from Meta's fixed list, matched to the objective, plus one alternate.
- **Display link** and the UTM template `utm_source=meta&utm_medium=paid&utm_campaign={campaign}&utm_content={angle}-{variant}`.
Write the character count next to every line. Run the pairing check: read each headline against each primary text and fix any pair that repeats itself or contradicts. Every line obeys the claims ledger and rule 5c (no em dashes). Output `ad-unit.md` (human-readable, one paste-ready block per angle) **and** `ad-unit.json` (`{angle_id: {primary_texts, headlines, descriptions, cta, cta_alt, display_link, url}}`) in the run folder — `/ad-batch` feeds the JSON into the gallery, where the operator edits it in place.

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
VoC basis: {N quotes from voc.md, N sources} | {"derived: no customer language on file"}
Stage spread: unaware {n} · problem {n} · solution {n} · product {n} · most-aware {n}

## a1-v1 · {angle name} · {format} · {render_path}   (ids are angle-variant; older runs used c01…)
Reader:        {one line, a person at a moment}
Their words:   "{VoC quote}" — icp.md §{ref}
Said better:   {the articulated pain line}
Stage:         {unaware|problem|solution|product|most-aware}
Eyebrow:       (omit unless rules.md Defaults ask for one)
Headline:      {pick}           [{formula}]
  v2:          {…}              [{formula}]
  v3:          {…}              [{formula}]  {house line, if applicable}
Subhead:       {…}   default: names the product and the outcome; if empty, say where the context lives
CTA:           {…}
Cold read:     "{what a stranger would say this is selling}"   {+ Context: where it's carried, or why it's skipped}
Slots:         {template-specific: quote / numbers / rows / body — verbatim, ready to paste}
Claims:        "{claim}" → references.md §{ref} · "{claim}" → §{ref}   {or: none}
Ad-unit copy:  see `ad-unit.md` — written per ANGLE, not per concept (step 8)
```

One block per variant, **grouped under an `## Angle a{n} · {name}` header** (angle-first batches, PLAYBOOK principle 11). Inside an angle, the variants differ on the one axis `ad-angles.md` says they test — when it is `headline`, the pick / v2 / v3 lines *are* the variants and all of them render; when it is `subhead` or `object`, the headline is identical across the angle and only that slot moves. Reserve one line per angle for ad-unit copy (`Primary texts: (deferred)`) so Remy's 3 primary texts × 3 headlines have a home when it is switched on. `/ad-batch` fills Block B and every Playwright slot **from this file**; `/ad-review` reads it before writing captions so the caption and the creative are one message.

## `--rewrite` mode

Given concept ids and a review note ("shorter", "more specific", "wrong stage"), rewrite only those blocks, append `(rev N — {note})` to the block header, keep the ledger current. Used by `/ad-review` revise on Playwright concepts before `render.js --only`.

## Hand off

Print: stage spread · offer gap (if any) · concepts written · any `derived` flags · claims that had to be softened because they couldn't be traced (name them — the operator may have the source).
