# Ad Engine

One brand URL in. A reviewed set of finished ad creatives out. Every run makes the next one better.

Six Claude Code skills that work as one command. You learn `/ad-engine`. It onboards a brand from its website, pulls the real ads already running in that category, writes copy in the customer's own words, renders every format at every Meta aspect, and opens a gallery where you keep, change, or kill. Your kills become permanent rules for that brand. Your keeps ship.

Built for the AI Course workshop by Zach Geleott. Proven on physical-product brands (Rhoback, BUILT, Bloom, Kodiak Cakes) and service brands (Pneuma Media). Photographic formats render through Higgsfield. Type, proof, testimonial, table and screenshot formats render locally through Playwright for free.

## Install

The easiest way: open Claude Code and paste this. Claude runs the commands, tells you what is still missing, and starts on your brand.

```
Install the ad engine: clone https://github.com/TakeOff-Team/ad-engine-skills.git into a folder next to this project, run its install.sh, and show me what the doctor says. If it says Firecrawl or Higgsfield is missing, give me the exact fix and wait for me to do it. When the doctor is happy, run /ad-engine https://your-brand.com and take me through onboarding. I will answer with voice-to-text. Explain each step in plain language as we go.
```

Replace the URL at the end with your brand's website. That is the whole setup.

If you would rather type it yourself:

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

Then, in Claude Code, from the folder you want your ad work to live in:

```
/ad-engine https://your-brand.com
```

That is the whole thing. It checks your setup, makes the brand folder, interviews you, asks to see what you like, looks at the ads already running in your category, and opens a gallery. Expect the first run to take a while and to ask you real questions; the runs after it take two actions.

## See it work in sixty seconds

No brand, no keys, no credits. Renders every template on a fictional brand:

```bash
cd ~/.claude/skills/ad-engine/render
node render.js examples/render-spec.example.json --sheet
open examples/out/contact-sheet.png
```

## Where everything lives

One folder per brand, made for you on the first run: `ad-engine/{brand}/` in whatever project you are working in (or `04-Brand/clients/{brand}/` if your vault already uses that). Inside it: the context files the engine learns from, your references, and a `batches/` folder with one folder per run holding the images, the copy, the Meta ad text and the review page. A plain-language `README.md` in there says what each file is. Nothing is written anywhere else.

First run for a brand: it scrapes the site, shows you a first look built from your site's own colours and headline so you have something to react to, reads back what it found for you to confirm, interviews you (your customer, their words, what you cannot claim), asks you to show it what you like and why, pulls the ads already running in your category, and renders a style gallery in the grammar of your references. You pick a direction. From then on a run is two actions: say "new batch", then click through the review gallery and paste the export. One thing wrong? Skip the export and type it: `revise a2-v1: shorter headline`.

## What you get per brand

- Six context files the chain reuses forever: brand kit, brand guide, ICP with real customer language, rules that compound, reference and proof inventory, and a taste file built from references you show it and your own words about why you like them. The engine assumes it knows nothing about your taste until you show it.
- One folder per run: every concept rendered at 4:5 for review, the copy with the reader's pain in their own words and headline variants, the Meta ad text, and the review gallery
- For everything you keep: the full placement set at 4:5, 1:1 and 9:16, plus the Meta ad text (primary texts, headlines, description, button) written per angle and editable right in the review page
- With Paper Desktop open: every rendered concept also lands in a Paper file as an editable artboard, brand colours as design tokens, so a designer can fix taste by hand and export
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

## If something goes wrong

| What you see | What it means | Fix |
|---|---|---|
| Claude says it does not know `/ad-engine` | The skills are not in `~/.claude/skills/` yet, or Claude Code has not reloaded | Run `./install.sh`, then fully quit and reopen Claude Code |
| The doctor says the renderer is missing | Playwright and its browser were never installed | `cd ~/.claude/skills/ad-engine/render && npm run setup` |
| The doctor says Firecrawl is missing | The Firecrawl MCP is not connected | Get a free key at firecrawl.dev, run the `claude mcp add` line above, restart Claude Code |
| The doctor says Higgsfield is missing | The Higgsfield connector is not on | Claude settings, Connectors, add Higgsfield, then restart. Without it you still get every type, proof, table and screenshot format, just no photography |
| The scrape found the wrong colours | The site's summary disagreed with its stylesheet | Say so; the chain rereads the stylesheet, and the stylesheet always wins |
| A creative has a red block instead of an image | It needed a real screenshot or quote you have not provided | Add the file to `assets/` and say where it is, or kill the concept. It will never fabricate the proof |
| The gallery says a creative is blocked | The renderer could not fix a layout defect or found a claim it cannot trace | It will not ship. Change the copy, add the source, or kill it |
| Onboarding feels long | It is. Twenty or so questions, by design | Use voice-to-text and ramble. The runs after the first one take two actions |
| Nothing renders in Paper | Paper Desktop is closed or has no file open | Open Paper with a file, then rerun. Paper is optional |

## What it will never do

Invent a number. Generate a face and attach a name and a quote to it. Render a dashboard that does not exist. Lift a competitor's line. Ship a claim it cannot trace to your proof inventory.

## Not in v1 (ideas on the list, in rough order)

- Publishing the approved set to Meta as a campaign. Today the chain stops at reviewed, placement-ready PNGs plus captions. Publishing is a separate skill.
- A live-ads dashboard: every creative that is currently running, with its Meta numbers (spend, CTR, CPA, frequency) shown next to the image, so the review loop closes on performance instead of taste. Suggested by a community member. Depends on the publishing skill, since it keys off the same creative ids the gallery already uses.

If one of these matters to you, open an issue and say which brand you would run it on.
