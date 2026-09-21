#!/usr/bin/env node
// brand-gallery.js — ONE review page for every creative a brand has, not one page per batch.
// (Zach, 2026-09-18: "Can we put all of them into the same preview gallery, like all the creatives we have so far?")
//
// usage: node brand-gallery.js <client-dir>
// reads  <client-dir>/gallery.json   { title?, batches: [folder, ...], earlier?: [{batch, ids:[...], label?}] }
//        each batch's gallery.html DATA (items + angle objects) and manifest.json (status + review note)
// writes <client-dir>/gallery.html   — serve the client folder; paths are relative to it
//
// Items already reviewed arrive pre-decided (approved → keep, killed → kill, note carried) and stay changeable;
// the export tags every decision with its `campaign` and marks untouched ones `prior: true`, so /ad-review
// routes each decision to its own batch manifest and skips what was already decided.
// Superseded concepts are left out. `earlier` batches show as a collapsed, context-only group.
const fs = require('fs'), path = require('path');

const dir = path.resolve(process.argv[2] || '.');
const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'gallery.json'), 'utf8'));
const tpl = fs.readFileSync(path.join(__dirname, '..', 'templates', 'gallery.html'), 'utf8');

function batchData(b) {
  const html = fs.readFileSync(path.join(dir, 'batches', b, 'gallery.html'), 'utf8');
  const m = html.match(/const DATA = (\{[\s\S]*?\});\n/);
  if (!m) throw new Error(`no DATA in batches/${b}/gallery.html`);
  return JSON.parse(m[1]);
}
function manifest(b) {
  try { const m = JSON.parse(fs.readFileSync(path.join(dir, 'batches', b, 'manifest.json'), 'utf8'));
    return Object.fromEntries((m.concepts || []).map(c => [c.id, c])); } catch (_) { return {}; }
}
const DEC = { approved: 'keep', 'approved-with-fix': 'keep', killed: 'kill', revise: 'revise' };

const items = [];
for (const b of cfg.batches) {
  const data = batchData(b), man = manifest(b);
  for (const it of data.items) {
    if (it.kind === 'reference') continue;
    const c = man[it.id] || {};
    if (c.status === 'superseded') continue;
    const out = { ...it, src: `batches/${b}/${it.src}`, campaign: data.campaign || b };
    const d = DEC[c.status];
    if (d) { const r = c.review || {}; out.decided = { d, n: (r.note || '').trim() };
      out.meta = `Reviewed ${r.date || ''}: ${d === 'keep' ? 'kept' : d === 'kill' ? 'killed' : 'change'}${out.meta ? '  ·  ' + out.meta : ''}`; }
    items.push(out);
  }
}
// angles where every variant is killed sink below the live ones
const dead = new Set(), live = new Set();
items.forEach(it => { const a = it.angle && (it.angle.id || it.angle); if (!a) return; (it.decided && it.decided.d === 'kill') ? dead.add(a) : live.add(a); });
const isDead = it => { const a = it.angle && (it.angle.id || it.angle); return a && dead.has(a) && !live.has(a); };
const ordered = [...items.filter(it => !isDead(it)), ...items.filter(isDead)];

for (const e of cfg.earlier || []) {
  const data = (() => { try { return batchData(e.batch); } catch (_) { return { items: [] }; } })();
  for (const id of e.ids) {
    const src = fs.existsSync(path.join(dir, 'batches', e.batch, 'images', `${id}.png`)) ? `images/${id}.png`
      : ((data.items.find(x => x.id === id) || {}).src);
    if (!src) { console.warn(`  ⚠ earlier: no image for ${e.batch}/${id}`); continue; }
    ordered.push({ id: `${e.label || e.batch} · ${id}`, src: `batches/${e.batch}/${src}`, label: id, meta: `From ${e.batch}. Context only.`, kind: 'reference', campaign: e.batch });
  }
}

const DATA = { campaign: cfg.campaign || `${path.basename(dir)}-all`, mode: 'review', title: cfg.title || `${path.basename(dir)}: every creative`,
  references_label: cfg.references_label || 'Earlier runs · context only', items: ordered };
fs.writeFileSync(path.join(dir, 'gallery.html'), tpl.replace('{{GALLERY_DATA}}', JSON.stringify(DATA).replace(/<\//g, '<\\/')));
const n = ordered.filter(i => i.kind !== 'reference');
console.log(`brand gallery → ${path.join(dir, 'gallery.html')}\n  ${n.length} creatives (${n.filter(i => i.decided).length} already reviewed) · ${ordered.length - n.length} earlier, context only`);
