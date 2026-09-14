#!/usr/bin/env node
/**
 * ad-engine / render / inspiration.js
 * The taste board. Takes a brand's `assets/inspiration/` folder (whatever the person dropped in: ads, thumbnails,
 * posters, screenshots, their own old creative) and produces what the chain and a human need to look at it:
 *   - contact-sheet.png   every image on one page, captioned
 *   - index.md            a table of the files (kept if it already exists; only missing rows are appended)
 *   - (optional) an "Inspiration" page in the brand's Paper file, when Paper Desktop is open — files stay the source
 *     of truth; the Paper page is a mirror so designers see the references next to the artboards.
 *
 * Usage:
 *   node inspiration.js <brand-dir | slug> [--paper[=<fileId>]] [--cols=4]
 *
 * <brand-dir> is the brand folder ({CLIENTS_ROOT}/{slug}); a bare slug resolves against 04-Brand/clients or ./clients.
 * Pulling references from YouTube: `yt-dlp --flat-playlist -J <channel>/videos` → ids → i.ytimg.com/vi/<id>/maxresdefault.jpg
 * (how Remy Gaskell's 24 thumbnails were pulled on 2026-09-14). Links: firecrawl_scrape with formats:["screenshot"].
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function parseArgs(argv) {
  const a = { target: null, paper: false, paperFile: null, cols: 4 };
  for (const x of argv) {
    if (x === '--paper') a.paper = true;
    else if (x.startsWith('--paper=')) { a.paper = true; a.paperFile = x.slice(8); }
    else if (x.startsWith('--cols=')) a.cols = parseInt(x.slice(7), 10) || 4;
    else if (!a.target) a.target = x;
  }
  return a;
}

function resolveBrandDir(t) {
  if (fs.existsSync(t) && fs.statSync(t).isDirectory()) return path.resolve(t);
  for (const root of ['04-Brand/clients', 'clients']) { const p = path.resolve(root, t); if (fs.existsSync(p)) return p; }
  throw new Error(`brand folder not found for "${t}"`);
}

function collectImages(dir) {
  const out = [];
  const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const st = fs.statSync(p); if (st.isDirectory()) walk(p); else if (/\.(jpe?g|png|webp|gif)$/i.test(f) && !/contact-sheet/i.test(f)) out.push(p); } };
  walk(dir); return out.sort();
}

// titles: any index.json in the tree ({file,title} rows) → caption; else the filename
function titlesFor(dir) {
  const map = {};
  const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f === 'index.json') { try { for (const r of JSON.parse(fs.readFileSync(p, 'utf8'))) if (r.file) map[path.join(d, r.file)] = r.title || r.file; } catch (e) {} } } };
  walk(dir); return map;
}

async function contactSheet(files, titles, outPath, cols) {
  const cell = 400, pad = 12, cap = 22;
  const items = files.map(f => `<figure><img src="file://${f}"><figcaption>${(titles[f] || path.basename(f)).replace(/</g, '&lt;').slice(0, 70)}</figcaption></figure>`).join('');
  const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#f5f5f7;font:12px -apple-system,Inter,sans-serif;color:#1d1d1f}.g{display:grid;grid-template-columns:repeat(${cols},${cell}px);gap:${pad}px;padding:${pad}px}figure{margin:0}img{width:${cell}px;display:block;border:1px solid #d2d2d7;background:#fff}figcaption{padding:3px 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}</style><div class="g">${items}</div>`;
  const tmp = outPath.replace(/\.png$/, '.html'); fs.writeFileSync(tmp, html);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.setViewportSize({ width: cols * (cell + pad) + pad, height: 800 });
  await p.goto('file://' + tmp); await p.waitForTimeout(600);
  await p.screenshot({ path: outPath, fullPage: true }); await b.close(); fs.unlinkSync(tmp);
}

async function paperMirror(files, titles, brandName, fileId, brandDir) {
  const { PaperClient } = require('./paper-client');
  const c = new PaperClient();
  await c.connect();
  // the brand's Paper file: brand-kit.md frontmatter `paper_file_id:` first (canonical), then any paper-file.json under the brand
  if (!fileId) { const bk = path.join(brandDir, 'brand-kit.md'); if (fs.existsSync(bk)) { const m = /^paper_file_id:\s*(\S+)/m.exec(fs.readFileSync(bk, 'utf8')); if (m) fileId = m[1]; } }
  if (!fileId) { const memos = [path.join(brandDir, 'paper-file.json'), ...(fs.existsSync(path.join(brandDir, 'batches')) ? fs.readdirSync(path.join(brandDir, 'batches')).map(b => path.join(brandDir, 'batches', b, 'paper-file.json')) : [])].filter(fs.existsSync); if (memos.length) { try { fileId = JSON.parse(fs.readFileSync(memos[memos.length - 1], 'utf8')).file_id; } catch (e) {} } }
  if (!fileId) { const cf = PaperClient.json(await c.call('create_file', { name: `ad-engine · ${brandName}` })) || {}; fileId = cf.fileId; fs.writeFileSync(path.join(brandDir, 'paper-file.json'), JSON.stringify({ file_id: fileId, url: cf.url }, null, 2)); }
  const info = PaperClient.json(await c.call('open_file', { fileId })) || {};
  let page = (info.pages || []).find(p => /inspiration/i.test(p.name));
  if (!page) { const pg = PaperClient.json(await c.call('create_page', { name: 'Inspiration' })); page = { id: pg.pageId || pg.id }; }
  await c.call('open_file', { fileId, pageId: page.id });
  const cols = 4, W = 480, H = 270, gap = 32, cap = 44, pad = 48; const rowsN = Math.ceil(files.length / cols);
  const ab = PaperClient.json(await c.call('create_artboard', { name: `Inspiration · ${new Date().toISOString().slice(0, 10)}`, styles: { width: `${pad * 2 + cols * W + (cols - 1) * gap}px`, height: `${pad * 2 + rowsN * (H + cap) + (rowsN - 1) * gap}px`, backgroundColor: '#F5F5F7' } }));
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const parts = files.map((f, i) => { const x = pad + (i % cols) * (W + gap), y = pad + Math.floor(i / cols) * (H + cap + gap); const t = titles[f] || path.basename(f); return `<img layer-name="${esc(t.slice(0, 50))}" src="paper-asset://${f}" style="position:absolute;left:${x}px;top:${y}px;width:${W}px;height:${H}px;object-fit:cover;border-radius:8px"><div layer-name="caption" style="position:absolute;left:${x}px;top:${y + H + 8}px;width:${W}px;height:32px;font-family:Inter;font-size:15px;line-height:20px;color:#6B6B73;white-space:pre">${esc(t.slice(0, 60))}</div>`; });
  let n = 0; for (let i = 0; i < parts.length; i += 8) { const r = PaperClient.json(await c.call('write_html', { targetNodeId: ab.id, mode: 'insert-children', html: parts.slice(i, i + 8).join('') })) || {}; n += (r.createdNodes || []).length; }
  await c.call('finish_working_on_nodes', { nodeIds: [ab.id] });
  return { fileId, url: info.url, page: page.id, artboard: ab.id, nodes: n };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.target) { console.error('usage: node inspiration.js <brand-dir | slug> [--paper[=<fileId>]] [--cols=4]'); process.exit(1); }
  const brandDir = resolveBrandDir(args.target);
  const dir = path.join(brandDir, 'assets', 'inspiration');
  if (!fs.existsSync(dir)) { console.error(`no ${dir} — ask for references first (ad-onboard Step 2.5)`); process.exit(1); }
  const files = collectImages(dir); const titles = titlesFor(dir);
  if (!files.length) { console.error(`${dir} has no images`); process.exit(1); }
  const sheet = path.join(dir, 'contact-sheet.png');
  await contactSheet(files, titles, sheet, args.cols);
  // index.md: append rows for files not yet listed
  const idx = path.join(dir, 'index.md');
  let md = fs.existsSync(idx) ? fs.readFileSync(idx, 'utf8') : `# Inspiration — ${path.basename(brandDir)}\n\nWhat the person showed us. Fill "what they like about it" from their words (taste.md).\n\n| File | Title | What they like about it |\n|---|---|---|\n`;
  let added = 0; for (const f of files) { const rel = path.relative(dir, f); if (!md.includes('`' + rel + '`')) { md += `| \`${rel}\` | ${(titles[f] || '').replace(/\|/g, '/')} | *(ask)* |\n`; added++; } }
  fs.writeFileSync(idx, md);
  console.log(`\ninspiration · ${path.basename(brandDir)} · ${files.length} image(s) → ${path.relative(process.cwd(), sheet)}${added ? ` · ${added} new row(s) in index.md` : ''}`);
  if (args.paper) {
    try { const r = await paperMirror(files, titles, path.basename(brandDir), args.paperFile, brandDir); console.log(`  · Paper: ${r.nodes} nodes on page ${r.page} of ${r.url || r.fileId}`); }
    catch (e) { console.log(`  ⚠ Paper mirror skipped: ${e.message.split('\n')[0]}`); }
  }
}
main().catch(e => { console.error('inspiration error:', e.message); process.exit(1); });
