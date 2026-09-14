# Ad Engine

One brand URL in. A reviewed set of finished ad creatives out. Every run makes the next one better.

Six Claude Code skills that work as one command. You learn `/ad-engine`. It onboards a brand from its website, pulls the real ads already running in that category, writes copy in the customer's own words, renders every format at every Meta aspect, and opens a gallery where you keep, change, or kill. Your kills become permanent rules for that brand. Your keeps ship.

Built for the AI Course workshop by Zach Geleott. Proven on physical-product brands (Rhoback, BUILT, Bloom, Kodiak Cakes) and service brands (Pneuma Media). Photographic formats render through Higgsfield. Type, proof, testimonial, table and screenshot formats render locally through Playwright for free.

## Install

```bash
git clone https://github.com/TakeOff-Team/ad-engine-skills.git
cd ad-engine-skills
./install.sh
```

That copies the six skills into `~/.claude/skills/`, installs the renderer, and runs a doctor that tells you exactly what is still missing. Then connect the two tools the chain needs and run it:

```bash
claude mcp add --transport http -s user firecrawl https://mcp.firecrawl.dev/YOUR_API_KEY/v2/mcp
```

Higgsfield connects through the connector in your Claude settings. Full list of what is required and what is optional: [REQUIREMENTS.md](REQUIREMENTS.md).

## See it work in sixty seconds

No brand, no keys, no credits. Renders every template on a fictional brand:

```bash
cd ~/.claude/skills/ad-engine/render
node render.js examples/render-spec.example.json --sheet
open examples/out/contact-sheet.png
```

## Run it

In Claude Code, in any project folder:

```
/ad-engine https://the-brand.com
```

First run for a brand: the chain scrapes the site, asks five questions, pulls real ads from the category, and shows you a style gallery. You pick a direction. From then on a run is two actions: say "new batch," then click through the review gallery and paste the export.

## What you get per brand

- `clients/{brand}/` with five context files the chain reuses forever: brand kit, brand guide, ICP with real customer language, rules that compound, reference and proof inventory
- `ads/{brand}-{date}/` per run: every concept rendered at 4:5 for review, `copy.md` with the reader's pain in their words and headline variants, `manifest.json`, the review gallery
- For everything you keep: the full placement set at 4:5, 1:1 and 9:16, plus a paired caption
- Kills become rules. Standing preferences become defaults. The wildcard in every batch keeps the system from converging on last batch.

## The eight formats

| Format | Renders through |
|---|---|
| Product or proxy-subject photography | Higgsfield |
| Typographic hero (the guarantee headline) | Playwright, free |
| Result / proof card with a real screenshot | Playwright, free |
| Testimonial card | Playwright, free |
| Comparison table | Playwright, free |
| Real social-proof capture, framed | Playwright, free |
| Notes-app screenshot | Playwright, free |
| Photo plus text band | Higgsfield, then Playwright |

Every one renders at 4:5, 1:1 and 9:16. Templates that state a result refuse to render without the evidence: no screenshot means a red block, not a fabricated dashboard.

## The six skills

| Skill | When it runs |
|---|---|
| `ad-engine` | every time; the router and the doctor |
| `ad-onboard` | once per brand |
| `ad-research` | once, then monthly |
| `ad-batch` | every run |
| `ad-copy` | inside every batch |
| `ad-review` | every run, on your gallery export |

Shared knowledge lives in `skills/ad-engine/PLAYBOOK.md`. Every rule in it was earned from a real failure on a real brand. Read it once.

## What it will never do

Invent a number. Generate a face and attach a name and a quote to it. Render a dashboard that does not exist. Lift a competitor's line. Ship a claim it cannot trace to your proof inventory.

## Not in v1 (ideas on the list, in rough order)

- Publishing the approved set to Meta as a campaign. Today the chain stops at reviewed, placement-ready PNGs plus captions. Publishing is a separate skill.
- A live-ads dashboard: every creative that is currently running, with its Meta numbers (spend, CTR, CPA, frequency) shown next to the image, so the review loop closes on performance instead of taste. Suggested by a community member. Depends on the publishing skill, since it keys off the same creative ids the gallery already uses.
- Ad-unit copy (primary text, headline, description) written inside the copy pass instead of at review time.

If one of these matters to you, open an issue and say which brand you would run it on.
