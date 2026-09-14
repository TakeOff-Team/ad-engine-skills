# Ad Engine: what you need connected

One brand URL in, a reviewed set of finished ad creatives out. Six skills, one command to learn: `/ad-engine {url}`. This page is everything the chain needs on your machine and in your Claude Code session. Run `/ad-engine` and its doctor step checks all of it and prints the fix for anything missing.

## Required

**Claude Code** with the six skill folders in `~/.claude/skills/`:
`ad-engine` `ad-onboard` `ad-research` `ad-batch` `ad-review` `ad-copy`

**Node 18 or newer** (for the Playwright renderer that makes every type, proof, testimonial, table and screenshot format).
```
node --version
```

**Renderer setup, once per machine** (installs Playwright and its Chromium builds, about 500 MB on disk):
```
cd ~/.claude/skills/ad-engine/render && npm run setup
```

**Firecrawl MCP** (brand scrape and category research). Free tier works. Get a key at https://firecrawl.dev, then:
```
claude mcp add --transport http -s user firecrawl https://mcp.firecrawl.dev/YOUR_API_KEY/v2/mcp
```

**Higgsfield MCP** (photographic renders: product shots and proxy-subject scenes). Connect it through the Higgsfield connector in your Claude settings, then confirm with any cheap call (the doctor uses `balance`). Credits: a full product batch was 18 credits (Kodiak, 9 renders); a service batch was 4 (Pneuma, 1 scene + 7 free Playwright renders).

## Optional

**Apify MCP** (named-competitor ad pulls from the Meta Ad Library; about $0.10 per brand). Without it the chain researches by category keyword instead.
```
claude mcp add --transport http -s user apify https://mcp.apify.com
```

**Playwright MCP** (browsing the Ad Library directly). Without it the chain uses Apify or keyword search.

**Paper Desktop** (https://paper.design, free tier). With the app open, every type, proof, testimonial, table and screenshot render also lands in a Paper file as an editable artboard, with your brand colours as design tokens, and Paper exports the PNG. Nothing to configure: the renderer finds the app on localhost. Install your brand's font files in Font Book first and restart Paper. Details: `skills/ad-engine/render/PAPER.md`.

## Notes on the two flags

`--transport http` is required for hosted MCP servers. `-s user` makes the server available in every folder, not only the one you ran the command in. Both flags go before the server name and URL.

## See it work in sixty seconds

No brand, no API keys, no credits. Renders every template on a fictional brand and opens a contact sheet:
```
cd ~/.claude/skills/ad-engine/render
node render.js examples/render-spec.example.json --sheet
open examples/out/contact-sheet.png
```

## What the doctor checks

| Check | What it unlocks | If missing |
|---|---|---|
| Node 18+ | the renderer | install Node |
| `render/node_modules` + Chromium | every type/proof/table/screenshot format, free | `npm run setup` |
| Firecrawl MCP | onboarding a brand from its URL | add the MCP, or paste brand facts by hand |
| Higgsfield MCP | photographic renders | add the connector; type formats still render |
| Apify MCP | named-competitor research | optional |
| Paper Desktop open | editable artboards of every rendered concept | optional |

The chain stops only when it has nothing to work with: no Firecrawl and no pasted brand facts, or no Higgsfield and no working renderer. Anything else degrades to a documented fallback.
