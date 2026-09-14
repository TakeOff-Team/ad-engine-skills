#!/usr/bin/env node
/**
 * ad-engine / render / paper.js
 * Mode-3 renderer: the same templates, rendered INTO PAPER (paper.design) as editable design nodes,
 * exported to PNG by Paper, verified against the Playwright render of the identical DOM.
 *
 *   Playwright is the linter. Paper is the canvas.
 *
 * Paper's write_html accepts inline-styled HTML only — no stylesheets, no JavaScript, no rich text,
 * no tables. So nothing in our templates (CSS variables, data-fit, __sync/__afterFit/__qa, the visual
 * QA pass) can run inside Paper. This script runs the whole pipeline in Playwright first
 * (render.js → prepareRender: tokens, fonts, slots, fit, QA), then SNAPSHOTS the fitted DOM as flat,
 * absolutely-positioned nodes — one frame per visible box, one text node per rendered line — and
 * pushes that into a Paper artboard. Every QA verdict (warnings[], blocking[]) travels with it.
 *
 * What you get in Paper: pixel-faithful artboards a designer can open and edit — every line of text
 * is a text node, every colour that matches a brand token references that token, the logo/photo are
 * image nodes. What you don't get (v1): auto-layout. Nodes are positioned, not flexed. Moving the
 * headline does not reflow the subhead. That is the same trade every HTML→design importer makes.
 *
 * Usage:
 *   node paper.js <render-spec.json> [--only=id1,id2] [--file=<paperFileId>] [--out=<dir>] [--no-verify] [--keep-downloads]
 *
 * Paper file: --file, else spec.paper_file_id, else <specDir>/paper-file.json (created on first run and saved).
 * Export: Paper writes to ~/Downloads/<artboard name>.png; the file is moved next to the spec's output_dir under paper/.
 * Verify: the Paper export is pixel-diffed against the Playwright screenshot of the same DOM (<id>.playwright.png);
 *         <id>.diff.png is written when they disagree. diff_pct > 2 is a warning — read it.
 *
 * Results: paper-results.json next to the spec, merged by id (same shape as render-results.json, plus
 * file_id / artboard_id / node ids so a later revise can set_text_content instead of re-pushing), and paper-log.jsonl.
 *
 * Requires Paper Desktop running (its MCP server lives on 127.0.0.1:29979 only while the app is open).
 * Brand fonts must be installed on this machine for Paper to draw them — self-hosted @font-face files
 * that Playwright loads from disk are invisible to Paper. The script checks and prints the install command.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { PaperClient } = require('./paper-client');
const R = require('./render.js');

function parseArgs(argv) {
  const a = { spec: null, only: null, file: null, out: null, verify: true, keepDownloads: false, replace: false };
  for (const x of argv) {
    if (x === '--replace') a.replace = true;   // revise loop: delete the id's previous artboard (from paper-results.json) before pushing the new one
    else if (x.startsWith('--only=')) a.only = x.slice(7).split(',').map(s => s.trim());
    else if (x.startsWith('--file=')) a.file = x.slice(7);
    else if (x.startsWith('--out=')) a.out = x.slice(6);
    else if (x === '--no-verify') a.verify = false;
    else if (x === '--keep-downloads') a.keepDownloads = true;
    else if (!a.spec) a.spec = x;
  }
  return a;
}

const hex = (rgb) => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(rgb || ''); if (!m) return null; if (m[4] != null && +m[4] < 1) return null; return '#' + [m[1], m[2], m[3]].map(v => (+v).toString(16).padStart(2, '0')).join('').toUpperCase(); };

// ---------------------------------------------------------------------------------------------
// In-page snapshot: fitted DOM → flat list of positioned nodes as inline-styled HTML for write_html
// ---------------------------------------------------------------------------------------------
async function snapshotForPaper(page, brandTokens) {
  return page.evaluate((brandTokens) => {
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const VW = document.documentElement.clientWidth, VH = document.documentElement.clientHeight;
    const nodes = []; let count = 0;

    // 0) materialize ::before/::after text (the CTA arrow) as real spans, then switch the pseudos off
    document.querySelectorAll('body *').forEach(el => {
      for (const which of ['::before', '::after']) {
        const c = getComputedStyle(el, which).content;
        if (!c || c === 'none' || c === 'normal' || c === '""' || c === "''") continue;
        const txt = c.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
        if (!txt.trim()) continue;
        const span = document.createElement('span'); span.textContent = txt; span.setAttribute('data-pseudo', which);
        const pcs = getComputedStyle(el, which); span.style.fontWeight = pcs.fontWeight; span.style.fontStyle = pcs.fontStyle; span.style.opacity = pcs.opacity;
        which === '::before' ? el.prepend(span) : el.append(span);
      }
    });
    const kill = document.createElement('style'); kill.textContent = '*::before,*::after{content:none!important}'; document.head.appendChild(kill);

    const px = v => Math.round(v * 100) / 100;
    const vis = el => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < VW && r.top < VH; };
    const effOpacity = el => { let o = 1; for (let n = el; n && n !== document.documentElement; n = n.parentElement) o *= (+getComputedStyle(n).opacity || 1); return o; };
    // computed colours arrive as rgb()/rgba() — or, for anything that went through color-mix() (the eyebrow pill, table
    // rules, highlight tints), as `color(srgb r g b / a)` with 0–1 channels. Both must parse or the frame silently vanishes.
    const toHex = (rgb) => {
      let m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(rgb || '');
      if (m) return { hex: '#' + [m[1], m[2], m[3]].map(v => Math.round(+v).toString(16).padStart(2, '0')).join('').toUpperCase(), a: m[4] == null ? 1 : +m[4] };
      m = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\)/.exec(rgb || '');
      if (m) { const a = m[4] == null ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4]); return { hex: '#' + [m[1], m[2], m[3]].map(v => Math.round(+v * 255).toString(16).padStart(2, '0')).join('').toUpperCase(), a }; }
      return null;
    };
    const toRgba = (rgb) => { const h = toHex(rgb); if (!h) return null; const n = parseInt(h.hex.slice(1), 16); return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.round(h.a * 1000) / 1000})`; };
    // brand token substitution: a colour that equals a brand token becomes var(--color-*) so designers see the token, not a literal
    const tokenFor = (rgb) => { const h = toHex(rgb); if (!h || h.a < 1) return rgb; for (const [name, val] of Object.entries(brandTokens.colors || {})) if (val && val.toUpperCase() === h.hex) return `var(${name})`; return h.hex; };
    const colorOut = (rgb) => { const h = toHex(rgb); if (!h) return null; if (h.a === 0) return null; if (h.a < 1) return toRgba(rgb); return tokenFor(rgb); };
    const fontOut = (fam) => { const first = (fam || '').split(',')[0].trim().replace(/^["']|["']$/g, ''); for (const [name, val] of Object.entries(brandTokens.fonts || {})) if (val && val.toLowerCase() === first.toLowerCase()) return `var(${name})`; return first; };
    const layer = (el, suffix) => { const base = el.dataset && el.dataset.slot ? el.dataset.slot : el.dataset && el.dataset.slotSrc ? el.dataset.slotSrc : (el.className && typeof el.className === 'string' && el.className.trim() ? el.className.trim().split(/\s+/)[0] : el.tagName.toLowerCase()); return esc(base + (suffix ? ' · ' + suffix : '')); };
    const emit = (html) => { nodes.push(html); count++; };

    // a) frame: any element that PAINTS something (background, gradient, border, shadow) becomes a positioned rect
    const frameOf = (el, cs, r) => {
      const st = [];
      const bg = colorOut(cs.backgroundColor); if (bg) st.push(`background-color:${bg}`);
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && /gradient/.test(cs.backgroundImage)) st.push(`background-image:${cs.backgroundImage}`);
      const radii = ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'].map(p => cs.getPropertyValue(p));
      if (radii.some(v => parseFloat(v) > 0)) st.push(`border-radius:${radii.join(' ')}`);
      let border = false;
      for (const side of ['top', 'right', 'bottom', 'left']) {
        const w = parseFloat(cs.getPropertyValue(`border-${side}-width`)); const s = cs.getPropertyValue(`border-${side}-style`); const c = colorOut(cs.getPropertyValue(`border-${side}-color`));
        if (w > 0 && s !== 'none' && c) { st.push(`border-${side}:${px(w)}px ${s} ${c}`); border = true; }
      }
      if (cs.boxShadow && cs.boxShadow !== 'none') st.push(`box-shadow:${cs.boxShadow}`);
      if (!bg && !border && !st.some(s => s.startsWith('background-image')) && !st.some(s => s.startsWith('box-shadow'))) return null;
      const o = effOpacity(el); if (o < 1) st.push(`opacity:${px(o)}`);
      return `<div layer-name="${layer(el)}" style="position:absolute;left:${px(r.left)}px;top:${px(r.top)}px;width:${px(r.width)}px;height:${px(r.height)}px;${st.join(';')}"></div>`;
    };

    // b) text: one node per rendered LINE of each text node (mixed-style runs — <em>, <mark>, <b> — are separate text nodes in the DOM, so they come out as separate runs on the same line, correctly styled)
    const textRuns = (tn) => {
      const el = tn.parentElement; const cs = getComputedStyle(el);
      const raw = tn.nodeValue; if (!raw || !raw.trim()) return;
      const tt = cs.textTransform;
      // measure word by word, group by line
      const words = []; const re = /\S+/g; let m;
      while ((m = re.exec(raw))) { const rg = document.createRange(); rg.setStart(tn, m.index); rg.setEnd(tn, m.index + m[0].length); const rects = [...rg.getClientRects()]; if (!rects.length) continue; const rr = rects[0]; words.push({ w: m[0], left: rr.left, top: rr.top, right: rects[rects.length - 1].right, bottom: rr.bottom, h: rr.height }); }
      if (!words.length) return;
      const lines = []; for (const w of words) { const L = lines[lines.length - 1]; if (L && Math.abs(L.top - w.top) < w.h * 0.5) { L.words.push(w); L.right = Math.max(L.right, w.right); L.bottom = Math.max(L.bottom, w.bottom); } else lines.push({ top: w.top, left: w.left, right: w.right, bottom: w.bottom, words: [w] }); }
      const fam = fontOut(cs.fontFamily); const size = parseFloat(cs.fontSize); const lh = cs.lineHeight === 'normal' ? null : parseFloat(cs.lineHeight);
      const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing);
      const col = colorOut(cs.color) || '#000000'; const o = effOpacity(el);
      const deco = /underline|line-through/.test(cs.textDecorationLine || cs.textDecoration) ? cs.textDecorationLine || 'underline' : null;
      // a <mark> ground: paint its rects behind the text (rich text isn't supported, so the highlight is a frame)
      if (el.tagName === 'MARK') { const mbg = colorOut(cs.backgroundColor); if (mbg) for (const rr of el.getClientRects()) emit(`<div layer-name="${layer(el, 'highlight')}" style="position:absolute;left:${px(rr.left)}px;top:${px(rr.top)}px;width:${px(rr.width)}px;height:${px(rr.height)}px;background-color:${mbg};border-radius:${cs.borderRadius}"></div>`); }
      lines.forEach((L, i) => {
        let text = L.words.map(w => w.w).join(' ');
        if (tt === 'uppercase') text = text.toUpperCase(); else if (tt === 'lowercase') text = text.toLowerCase(); else if (tt === 'capitalize') text = text.replace(/\b\w/g, c => c.toUpperCase());
        const lineH = lh || (L.bottom - L.top); const boxTop = lh ? L.top - (lh - (L.bottom - L.top)) / 2 : L.top;
        const st = [`font-family:${fam}`, `font-size:${px(size)}px`, `font-weight:${cs.fontWeight}`, `line-height:${px(lineH)}px`, `color:${col}`, 'white-space:pre'];
        if (cs.fontStyle !== 'normal') st.push(`font-style:${cs.fontStyle}`);
        if (ls) st.push(`letter-spacing:${px(ls)}px`);
        if (deco) st.push(`text-decoration:${deco}`);
        if (o < 1) st.push(`opacity:${px(o)}`);
        const suffix = lines.length > 1 ? `L${i + 1}` : (el.tagName === 'EM' || el.tagName === 'MARK' || el.tagName === 'B' || el.tagName === 'STRONG' ? el.tagName.toLowerCase() : '');
        emit(`<div layer-name="${layer(el, suffix)}" style="position:absolute;left:${px(L.left)}px;top:${px(boxTop)}px;width:${px(L.right - L.left + 2)}px;height:${px(lineH)}px;${st.join(';')}">${esc(text)}</div>`);
      });
    };

    // c) images
    const imgOf = (el, cs, r) => {
      let src = el.currentSrc || el.getAttribute('src') || ''; if (!src) return null;
      if (src.startsWith('file://')) src = 'paper-asset://' + decodeURIComponent(src.slice(7));
      const st = [`object-fit:${cs.objectFit || 'cover'}`];
      const radii = cs.borderRadius; if (parseFloat(radii) > 0) st.push(`border-radius:${radii}`);
      const o = effOpacity(el); if (o < 1) st.push(`opacity:${px(o)}`);
      // clip to the nearest overflow:hidden ancestor (a cover image inside a rounded frame)
      let clip = null; for (let n = el.parentElement; n; n = n.parentElement) { const pcs = getComputedStyle(n); if (pcs.overflow === 'hidden' || pcs.overflowX === 'hidden') { clip = n.getBoundingClientRect(); break; } }
      let left = r.left, top = r.top, w = r.width, h = r.height;
      if (clip) { left = Math.max(r.left, clip.left); top = Math.max(r.top, clip.top); w = Math.min(r.right, clip.right) - left; h = Math.min(r.bottom, clip.bottom) - top; }
      return `<img layer-name="${layer(el)}" src="${esc(src)}" style="position:absolute;left:${px(left)}px;top:${px(top)}px;width:${px(w)}px;height:${px(h)}px;${st.join(';')}">`;
    };

    const SKIP = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'HEAD', 'TITLE', 'NOSCRIPT', 'BR']);
    const walk = (el) => {
      if (SKIP.has(el.tagName)) return;
      if (el.tagName !== 'BODY' && !vis(el)) return;
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      if (el.tagName === 'IMG') { const h = imgOf(el, cs, r); if (h) emit(h); return; }
      if (el.tagName !== 'BODY' && el.tagName !== 'HTML') { const f = frameOf(el, cs, r); if (f) emit(f); }
      for (const ch of el.childNodes) {
        if (ch.nodeType === 3) textRuns(ch);
        else if (ch.nodeType === 1) walk(ch);
      }
    };
    walk(document.body);
    const bodyBg = colorOut(getComputedStyle(document.body).backgroundColor) || '#FFFFFF';
    return { html: nodes, count, background: bodyBg, width: VW, height: VH };
  }, brandTokens);
}

// ---------------------------------------------------------------------------------------------
// Pixel diff: Paper export vs Playwright screenshot of the same DOM
// ---------------------------------------------------------------------------------------------
async function pixelDiff(browser, aPath, bPath, diffPath) {
  // data: URLs, not file:// — a file:// image taints the canvas and getImageData throws
  const dataUrl = p => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><meta charset="utf-8"><img id=a src="${dataUrl(aPath)}"><img id=b src="${dataUrl(bPath)}"><canvas id=c></canvas>`);
  const out = await page.evaluate(async () => {
    const a = document.getElementById('a'), b = document.getElementById('b');
    await Promise.all([a, b].map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
    if (!a.naturalWidth || !b.naturalWidth) return { error: 'image failed to load' };
    if (a.naturalWidth !== b.naturalWidth || a.naturalHeight !== b.naturalHeight) return { error: `size mismatch ${a.naturalWidth}×${a.naturalHeight} vs ${b.naturalWidth}×${b.naturalHeight}` };
    const W = a.naturalWidth, H = a.naturalHeight; const c = document.getElementById('c'); c.width = W; c.height = H; const ctx = c.getContext('2d');
    ctx.drawImage(a, 0, 0); const A = ctx.getImageData(0, 0, W, H).data; ctx.drawImage(b, 0, 0); const B = ctx.getImageData(0, 0, W, H).data;
    const D = ctx.createImageData(W, H); let diff = 0;
    for (let i = 0; i < A.length; i += 4) { const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]); const hit = d > 90; if (hit) diff++; D.data[i] = hit ? 255 : A[i] * .25 + 190; D.data[i + 1] = hit ? 0 : A[i + 1] * .25 + 190; D.data[i + 2] = hit ? 0 : A[i + 2] * .25 + 190; D.data[i + 3] = 255; }
    ctx.putImageData(D, 0, 0);
    return { pct: Math.round(diff / (W * H) * 10000) / 100, data: diff ? c.toDataURL('image/png') : null };
  });
  await page.close();
  if (out.data) fs.writeFileSync(diffPath, Buffer.from(out.data.split(',')[1], 'base64'));
  return out;
}

async function moveFile(from, to) {
  try { fs.renameSync(from, to); } catch (e) { fs.copyFileSync(from, to); fs.unlinkSync(from); }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.spec) { console.error('\nUsage: node paper.js <render-spec.json> [--only=id1,id2] [--file=<paperFileId>] [--out=<dir>] [--no-verify]\n'); process.exit(1); }
  const specPath = path.resolve(args.spec);
  if (!fs.existsSync(specPath)) { console.error(`spec not found: ${specPath}`); process.exit(1); }
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const specDir = path.dirname(specPath);
  const baseOut = args.out ? path.resolve(args.out) : (path.isAbsolute(spec.output_dir || '') ? spec.output_dir : path.join(specDir, spec.output_dir || 'images'));
  const outDir = path.join(baseOut, 'paper'); fs.mkdirSync(outDir, { recursive: true });

  // --- Paper: connect, open (or create) the brand file ---------------------------------------
  const paper = new PaperClient();
  try { await paper.connect(); } catch (e) { console.error(`\n✗ Paper Desktop is not reachable at ${process.env.PAPER_MCP_URL || 'http://127.0.0.1:29979/mcp'} — open Paper Desktop and run again. (${e.message})\n`); process.exit(3); }
  const fileMemo = path.join(specDir, 'paper-file.json');
  let fileId = args.file || spec.paper_file_id || null;
  if (!fileId && fs.existsSync(fileMemo)) { try { fileId = JSON.parse(fs.readFileSync(fileMemo, 'utf8')).file_id; } catch (e) {} }
  let fileUrl = null;
  if (!fileId) {
    const cf = PaperClient.json(await paper.call('create_file', { name: `ad-engine · ${spec.brand?.name || spec.campaign || 'brand'}` })) || {};
    fileId = cf.fileId; fileUrl = cf.url;
    fs.writeFileSync(fileMemo, JSON.stringify({ file_id: fileId, url: fileUrl, created_at: new Date().toISOString(), campaign: spec.campaign }, null, 2));
    console.log(`  · created Paper file ${fileUrl} (saved to paper-file.json — put paper_file_id in the spec or brand-kit to reuse it)`);
  }
  const info = PaperClient.json(await paper.call('open_file', { fileId })) || {};
  fileUrl = fileUrl || info.url;
  console.log(`\nad-engine paper · ${spec.campaign || 'campaign'} · file "${info.fileName || fileId}" · ${info.url || ''}\n`);

  // --- fonts: Paper draws from the machine / Google Fonts, not from our @font-face files --------
  const fams = [...new Set([spec.brand?.font_display, spec.brand?.font_body, spec.brand?.font_mono, ...(spec.brand?.font_faces || []).map(f => f.family)].filter(Boolean))];
  const fontNotes = [];
  if (fams.length) {
    // shape (Paper 0.5.9): { errors: ['Font family "X" is not available.'], fontsPerFamily: { Inter: [...] } }
    let finfo = null; try { finfo = PaperClient.json(await paper.call('get_font_family_info', { familyNames: fams })); } catch (e) { fontNotes.push(`font check failed: ${e.message}`); }
    const missing = new Set();
    for (const e of (finfo && finfo.errors) || []) { const m = /Font family "([^"]+)"/.exec(e); if (m) missing.add(m[1]); }
    if (finfo && finfo.fontsPerFamily) for (const f of fams) if (!finfo.fontsPerFamily[f] && !missing.has(f)) missing.add(f);
    for (const name of missing) {
      const faces = (spec.brand?.font_faces || []).filter(x => x.family === name);
      const srcs = faces.map(x => path.resolve(specDir, x.src));
      fontNotes.push(`FONT "${name}" is not available to Paper${srcs.length ? ` — install it, then restart Paper Desktop: cp ${srcs.map(s => `"${s}"`).join(' ')} ~/Library/Fonts/` : ' — install it on this machine or pick a Google Font'}`);
    }
  }
  for (const n of fontNotes) console.log(`  ⚠ ${n}`);

  // --- brand tokens in the Paper file ---------------------------------------------------------
  const b = spec.brand || {};
  const colors = { '--color-primary': b.primary, '--color-accent': b.accent, '--color-ink': b.ink, '--color-paper': b.paper, '--color-muted': b.muted };
  const fonts = { '--font-display': b.font_display, '--font-body': b.font_body, '--font-mono': b.font_mono };
  try {
    const existing = PaperClient.json(await paper.call('get_tokens', {})) || {}; const have = new Set(((existing.items || existing.tokens) || []).map(t => t.name));
    const want = [];
    for (const [n, v] of Object.entries(colors)) if (v && !have.has(n)) want.push({ type: 'color', name: n, value: v.toUpperCase(), description: `ad-engine brand token from brand-kit.md` });
    for (const [n, v] of Object.entries(fonts)) if (v && !have.has(n)) want.push({ type: 'fontFamily', name: n, value: v });
    if (want.length) { await paper.call('create_tokens', { tokens: want }); console.log(`  · ${want.length} brand token(s) created in the Paper file`); }
  } catch (e) { console.log(`  ⚠ tokens skipped: ${e.message}`); }
  const brandTokens = { colors: Object.fromEntries(Object.entries(colors).filter(([, v]) => v).map(([k, v]) => [k, v.toUpperCase()])), fonts: Object.fromEntries(Object.entries(fonts).filter(([, v]) => v)) };

  // --- render ---------------------------------------------------------------------------------
  const templatesDir = path.join(__dirname, 'templates');
  const tokenNotes = []; const tokens = R.cssTokens(spec.brand, tokenNotes); for (const n of tokenNotes) console.log(`  ⚠ ${n}`);
  const fontsHref = R.googleFontsHref(spec.brand); const fontFaces = R.fontFacesCss(spec.brand, specDir);
  let renders = spec.renders || []; if (args.only) renders = renders.filter(r => args.only.includes(r.id));
  const browser = await chromium.launch();
  const results = [];
  const downloads = path.join(os.homedir(), 'Downloads');
  // --replace: the revise loop. The id's previous artboard (recorded in paper-results.json) is deleted before the new push,
  // so a revised concept takes the old one's place instead of piling up duplicates in the designer's file.
  let previous = {};
  try { previous = (JSON.parse(fs.readFileSync(path.join(specDir, 'paper-results.json'), 'utf8')) || {}).by_id || {}; } catch (e) {}

  for (const r of renders) {
    const [w, h] = R.CANVAS[r.aspect || '4:5'] || R.CANVAS['4:5'];
    const tpl = path.join(templatesDir, r.template.endsWith('.html') ? r.template : r.template + '.html');
    const base = (r.file || `${r.id}.png`).replace(/\.png$/i, '');
    const outFile = path.join(outDir, base + '.png');
    const pwFile = path.join(outDir, base + '.playwright.png');
    const res = { id: r.id, template: r.template, renderer: 'paper', path: outFile, playwright_path: pwFile, canvas: [w, h], ok: false, warnings: [], file_id: fileId, file_url: fileUrl };
    if (!fs.existsSync(tpl)) { res.error = `template not found: ${tpl}`; results.push(res); console.log(`  ✗ ${r.id}  ${res.error}`); continue; }
    const page = await browser.newPage(); await page.setViewportSize({ width: w, height: h });
    let artboardId = null;
    try {
      await R.prepareRender(page, { spec, specDir, tokens, fontFaces, fontsHref, tpl }, r, res);
      await page.screenshot({ path: pwFile, type: 'png' });
      const snap = await snapshotForPaper(page, brandTokens);
      res.nodes_pushed = snap.count;
      if (args.replace && previous[r.id] && previous[r.id].artboard_id && previous[r.id].file_id === fileId) {
        try { await paper.call('delete_nodes', { nodeIds: [previous[r.id].artboard_id] }); res.replaced_artboard_id = previous[r.id].artboard_id; }
        catch (e) { res.warnings.push(`could not delete previous artboard ${previous[r.id].artboard_id}: ${e.message}`); }
      }
      // artboard: its name is the export filename Paper will use in ~/Downloads
      const abName = `${base}`;
      const ab = PaperClient.json(await paper.call('create_artboard', { name: abName, styles: { width: `${w}px`, height: `${h}px`, backgroundColor: snap.background, overflow: 'hidden' } })) || {};
      artboardId = ab.id || ab.nodeId; res.artboard_id = artboardId;
      if (!artboardId) throw new Error('create_artboard returned no id');
      // push in chunks — write_html is happiest with a few dozen nodes per call
      const CH = 40; res.node_ids = [];
      for (let i = 0; i < snap.html.length; i += CH) {
        const wh = PaperClient.json(await paper.call('write_html', { targetNodeId: artboardId, mode: 'insert-children', html: snap.html.slice(i, i + CH).join('') })) || {};
        for (const n of wh.createdNodes || []) res.node_ids.push({ id: n.id, name: n.name, type: n.component });
      }
      // export → ~/Downloads/<name>.png → move next to the spec.
      // Paper renders the pushed nodes asynchronously: an export fired straight after write_html came back as the bare
      // artboard background (34 KB of solid colour) on the first live run. Let the canvas settle, then export; if the
      // file is implausibly small next to the Playwright PNG of the same DOM, wait and export again (3 tries).
      const pwBytes = fs.statSync(pwFile).size;
      let got = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        await new Promise(r => setTimeout(r, attempt === 1 ? 1500 : 2500));
        const ex = PaperClient.json(await paper.call('export', { nodes: { [artboardId]: [{ format: 'png', scale: '1x' }] } })) || {};
        got = (ex.exports || []).find(x => x.nodeId === artboardId) || (ex.exports || [])[0];
        if (!got || !got.filePath || !fs.existsSync(got.filePath)) throw new Error(`export returned no file (${JSON.stringify(ex).slice(0, 200)})`);
        const bytes = fs.statSync(got.filePath).size;
        if (snap.count === 0 || bytes > pwBytes * 0.2) break;
        res.warnings.push(`export attempt ${attempt} looked empty (${(bytes / 1024).toFixed(0)} KB vs ${(pwBytes / 1024).toFixed(0)} KB from Playwright) — retried`);
        try { fs.unlinkSync(got.filePath); } catch (e) {}
        got = null;
      }
      if (!got) throw new Error('Paper export stayed empty after 3 attempts');
      if (args.keepDownloads) fs.copyFileSync(got.filePath, outFile); else await moveFile(got.filePath, outFile);
      const dims = R.pngDimensions(outFile);
      if (!dims) res.error = 'Paper export is not a valid PNG';
      else if (dims[0] !== w || dims[1] !== h) res.error = `Paper export has wrong dimensions ${dims[0]}×${dims[1]} (wanted ${w}×${h})`;
      else res.ok = true;
      res.bytes = fs.existsSync(outFile) ? fs.statSync(outFile).size : 0;
      // verify against the Playwright render of the identical DOM
      if (res.ok && args.verify) {
        const d = await pixelDiff(browser, pwFile, outFile, path.join(outDir, base + '.diff.png'));
        if (d.error) res.warnings.push(`VERIFY: ${d.error}`);
        else { res.diff_pct = d.pct; if (d.pct > 2) res.warnings.push(`FIDELITY: Paper export differs from the Playwright render on ${d.pct}% of pixels — open ${base}.diff.png (fonts not installed for Paper is the usual cause)`); }
      }
    } catch (e) {
      res.error = e.message;
    } finally {
      await page.close();
      if (artboardId) { try { await paper.call('finish_working_on_nodes', { nodeIds: [artboardId] }); } catch (e) {} }
    }
    res.blocking = res.warnings.filter(x => /cannot ship|REQUIRED —|REQUIRED\b|NO SOURCE/i.test(x));
    results.push(res);
    const flag = res.ok ? (res.blocking.length ? '⛔' : '✓') : '✗';
    console.log(`  ${flag} ${r.id}  ${path.basename(outFile)}  ${res.ok ? `${w}×${h} · ${(res.bytes / 1024).toFixed(0)} KB · ${res.nodes_pushed} nodes${res.diff_pct != null ? ` · diff ${res.diff_pct}%` : ''}` : res.error}`);
    for (const wmsg of res.warnings) console.log(`      ⚠ ${wmsg}`);
  }
  await browser.close();

  const ranAt = new Date().toISOString(); const specName = path.basename(specPath);
  const summary = { campaign: spec.campaign, renderer: 'paper', output_dir: outDir, spec: specName, ran_at: ranAt, file_id: fileId, file_url: fileUrl, rendered: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, blocked: results.filter(r => r.blocking && r.blocking.length).length, font_notes: fontNotes, results };
  const resultsPath = path.join(specDir, 'paper-results.json');
  let merged = { campaign: spec.campaign, renderer: 'paper', by_id: {}, runs: [] };
  try { const prev = JSON.parse(fs.readFileSync(resultsPath, 'utf8')); if (prev && prev.by_id) merged = prev; } catch (e) {}
  for (const r of results) merged.by_id[r.id] = { ...r, spec: specName, ran_at: ranAt };
  merged.runs.push({ spec: specName, ran_at: ranAt, rendered: summary.rendered, failed: summary.failed, blocked: summary.blocked, ids: results.map(r => r.id) });
  merged.campaign = spec.campaign; merged.file_id = fileId; merged.file_url = fileUrl; merged.last = summary;
  merged.blocking_ids = Object.values(merged.by_id).filter(r => r.blocking && r.blocking.length).map(r => r.id);
  fs.writeFileSync(resultsPath, JSON.stringify(merged, null, 2));
  fs.appendFileSync(path.join(specDir, 'paper-log.jsonl'), JSON.stringify(summary) + '\n');
  console.log(`\n${summary.rendered} rendered in Paper · ${summary.failed} failed · ${summary.blocked} BLOCKED · merged → paper-results.json (${Object.keys(merged.by_id).length} ids) · file ${fileUrl || fileId}\n`);
  if (merged.blocking_ids.length) console.log(`  ⛔ blocking (cannot ship without override): ${merged.blocking_ids.join(', ')}\n`);
  process.exit(summary.failed ? 2 : 0);
}

module.exports = { snapshotForPaper, pixelDiff };
if (require.main === module) main().catch(e => { console.error('paper error:', e); process.exit(1); });
