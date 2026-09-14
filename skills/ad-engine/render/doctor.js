#!/usr/bin/env node
/**
 * ad-engine / render / doctor.js
 * Local-environment preflight for the ad-engine chain. Checks the things a NEW machine
 * gets wrong: Node version, the renderer's dependencies, the Chromium build Playwright
 * expects. MCP connectivity (Firecrawl, Higgsfield, Apify) cannot be checked from Node —
 * /ad-engine Step 0 checks those from inside the Claude session by tool presence.
 *
 * Usage:  node doctor.js [--json]
 * Exit 0 = renderer ready · 1 = something missing (fix commands printed)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const here = __dirname;
const out = { node: null, node_ok: false, deps_ok: false, chromium_ok: false, chromium_path: null, fixes: [] };

// Node version
const major = parseInt(process.versions.node.split('.')[0], 10);
out.node = process.versions.node; out.node_ok = major >= 18;
if (!out.node_ok) out.fixes.push('Node 18 or newer is required: https://nodejs.org (or `brew install node`).');

// Dependencies
const pw = path.join(here, 'node_modules', 'playwright', 'package.json');
out.deps_ok = fs.existsSync(pw);
if (!out.deps_ok) out.fixes.push(`Renderer dependencies missing. Run:\n    cd ${here} && npm run setup`);

// Chromium build that THIS playwright version expects
if (out.deps_ok) {
  try {
    const { chromium } = require(path.join(here, 'node_modules', 'playwright'));
    const exe = chromium.executablePath();
    out.chromium_path = exe; out.chromium_ok = !!exe && fs.existsSync(exe);
  } catch (e) { out.chromium_ok = false; }
  if (!out.chromium_ok) out.fixes.push(`Chromium for this Playwright version is not installed. Run:\n    cd ${here} && npx playwright install chromium`);
}

// Templates present
const tdir = path.join(here, 'templates');
out.templates = fs.existsSync(tdir) ? fs.readdirSync(tdir).filter(f => f.endsWith('.html')).map(f => f.replace('.html', '')) : [];
if (!out.templates.length) out.fixes.push('No templates found next to render.js — the bundle is incomplete.');

out.ready = out.node_ok && out.deps_ok && out.chromium_ok && out.templates.length > 0;

// Paper Desktop (optional — mode 3, editable artboards). Its MCP server only exists while the app is open; paper.js talks
// to it directly over localhost, so this is an app-is-open check, not an MCP-tools-in-session check.
function probePaper() {
  return new Promise(resolve => {
    const http = require('http');
    const req = http.get({ host: '127.0.0.1', port: 29979, path: '/mcp', timeout: 1500 }, res => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false)); req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

(async () => {
  out.paper_ok = await probePaper();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(out, null, 2)); process.exit(out.ready ? 0 : 1); }

  const tick = b => (b ? '✓' : '✗');
  console.log('\nad-engine renderer doctor');
  console.log(`  ${tick(out.node_ok)} Node ${out.node}${out.node_ok ? '' : '  (need ≥ 18)'}`);
  console.log(`  ${tick(out.deps_ok)} playwright installed in render/node_modules`);
  console.log(`  ${tick(out.chromium_ok)} Chromium build present${out.chromium_path ? '  ' + out.chromium_path.replace(process.env.HOME || '', '~') : ''}`);
  console.log(`  ${tick(out.templates.length > 0)} ${out.templates.length} templates: ${out.templates.join(', ')}`);
  console.log(`  ${out.paper_ok ? '✓' : '○'} Paper Desktop ${out.paper_ok ? 'open — mode 3 (editable artboards via paper.js) available' : 'not open — optional; open the app to render into Paper (render/PAPER.md)'}`);
  if (out.fixes.length) { console.log('\nFix:'); out.fixes.forEach(f => console.log('  - ' + f)); }
  console.log(out.ready ? '\nRenderer ready.\n' : '\nRenderer NOT ready.\n');
  process.exit(out.ready ? 0 : 1);
})();
