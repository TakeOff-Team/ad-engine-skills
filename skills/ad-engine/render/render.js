#!/usr/bin/env node
/**
 * ad-engine / render / render.js
 * Mode-2 renderer for the ad-engine chain: HTML templates → PNG via Playwright.
 * Use for every format whose content is TYPE, DATA, UI, or a QUOTE
 * (typographic hero, proof card, testimonial card, notes screenshot, …).
 * Scenes still go through Higgsfield — see PLAYBOOK "Render modes".
 *
 * Usage:
 *   node render.js <render-spec.json> [--sheet] [--only=id1,id2] [--out=<dir>]
 *
 * render-spec.json:
 * {
 *   "campaign":   "acme-2026-09-04",
 *   "output_dir": "images",                // relative to the spec file (or absolute)
 *   "brand": {                             // tokens → CSS variables on :root
 *     "name": "Acme", "primary": "#173EF5", "accent": "#FFB800",
 *     "ink": "#111111", "paper": "#FFFFFF",
 *     "font_display": "Inter", "font_body": "Inter",
 *     "google_fonts": ["Inter:wght@400;600;800"],   // loaded via fonts.googleapis.com
 *     "logo_url": "https://…/logo.svg"     // optional; templates expose a logo slot
 *   },
 *   "renders": [
 *     { "id": "c01", "template": "typographic-hero", "file": "c01-hero.png",
 *       "aspect": "4:5", "slots": { "headline": "…", "subhead": "…" } }
 *   ]
 * }
 *
 * Slot contract (inside templates):
 *   data-slot="name"       → element.innerHTML = value           (text/HTML)
 *   data-slot-src="name"   → element.src = value                 (images; a path relative to the spec file is resolved for you)
 *   data-slot-style="name" → element.style.cssText += value      (rare)
 *   data-optional          → element hidden when its slot is empty/missing
 *   data-default           → element keeps its template text when the slot is empty/missing
 *   data-fit               → font shrinks until the element fits its box (min via data-fit-min)
 *
 * Every render is verified after the fact: file exists, PNG header parses,
 * dimensions equal the requested canvas. Anything else is reported as a failure
 * — never silently.
 *
 * Results are MERGED into render-results.json next to the spec, keyed by render id —
 * never overwritten — and every run is appended to render-log.jsonl. Warnings are
 * classified: `blocking` (cannot ship: missing capture/photo/screenshot, no source line)
 * vs `warnings` (claim/authenticity/layout checks a human must read). The AI Course run
 * (2026-09-13) lost a "cannot ship" flag to a stdout grep + a file overwrite; this is the fix.
 * Never grep stdout for flags — read the JSON.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const CANVAS = {
  '4:5': [1080, 1350],
  '1:1': [1080, 1080],
  '9:16': [1080, 1920],
  '16:9': [1920, 1080],
};

function parseArgs(argv) {
  const args = { spec: null, sheet: false, only: null, out: null };
  for (const a of argv) {
    if (a === '--sheet') args.sheet = true;
    else if (a.startsWith('--out=')) args.out = a.slice(6);   // re-check a run without touching its images; verdicts still merge into the spec folder
    else if (a.startsWith('--only=')) args.only = a.slice(7).split(',').map(s => s.trim());
    else if (!args.spec) args.spec = a;
  }
  return args;
}

function pngDimensions(file) {
  const buf = Buffer.alloc(24);
  const fd = fs.openSync(file, 'r');
  fs.readSync(fd, buf, 0, 24, 0);
  fs.closeSync(fd);
  const sig = buf.slice(0, 8).toString('hex');
  if (sig !== '89504e470d0a1a0a') return null;
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

function lum(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim()); if (!m) return null;
  const c = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4));
  return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
}
function contrast(a, b) { const la = lum(a), lb = lum(b); if (la == null || lb == null) return null; const [h, l] = la > lb ? [la, lb] : [lb, la]; return (h + .05) / (l + .05); }

function cssTokens(brand = {}, notes = []) {
  const primary = brand.primary || '#173EF5', ink = brand.ink || '#111111', paper = brand.paper || '#FFFFFF';
  // text that sits ON a primary ground: white if it reads better than ink, else ink (neon / pastel primaries)
  const onPrimary = (contrast('#FFFFFF', primary) || 0) >= (contrast(ink, primary) || 0) ? '#FFFFFF' : ink;
  // primary used AS TEXT on paper: only if it actually reads; else fall back to ink
  const primaryText = (contrast(primary, paper) || 0) >= 3 ? primary : ink;
  if (onPrimary !== '#FFFFFF') notes.push(`brand.primary ${primary} is light — text on primary grounds uses ink, not white`);
  if (primaryText !== primary) notes.push(`brand.primary ${primary} does not read as text on paper (${(contrast(primary, paper) || 0).toFixed(1)}:1) — colored headlines fall back to ink`);
  const accent = brand.accent || '#FFB800';
  // accent used as text on an ink ground (proof-card number, ink-theme result lines): fall back to white if it vanishes
  const accentOnInk = (contrast(accent, ink) || 0) >= 3 ? accent : '#FFFFFF';
  if (accentOnInk !== accent) notes.push(`brand.accent ${accent} does not read on the ink ground — accent text on dark themes falls back to white`);
  // highlighter behind <mark> text: needs to be LIGHT — a dark accent (or dark primary) would paint a black bar under black text
  const derivedHighlight = (lum(accent) || 0) > .35 ? accent : (lum(primary) || 0) > .35 ? primary : '#FFE86B';
  // brand.highlight: explicit <mark> ground (e.g. a brand tint like rgba(23,62,245,.15)) — beats the derived fallback
  const highlight = brand.highlight || derivedHighlight;
  if (!brand.highlight && highlight !== accent) notes.push(`brand.accent ${accent} is too dark to highlight text — <mark> uses ${highlight === primary ? 'primary' : 'a soft yellow'} instead`);
  const map = {
    '--brand-highlight': highlight,
    '--brand-on-primary': onPrimary,
    '--brand-primary-text': primaryText,
    '--brand-accent-on-ink': accentOnInk,
    '--brand-name': brand.name ? `"${brand.name}"` : '"Brand"',
    '--brand-primary': brand.primary || '#173EF5',
    '--brand-accent': brand.accent || '#FFB800',
    '--brand-ink': brand.ink || '#111111',
    '--brand-paper': brand.paper || '#FFFFFF',
    '--brand-muted': brand.muted || '#6B6B73',
    '--font-display': brand.font_display ? `"${brand.font_display}", Inter, system-ui, sans-serif` : 'Inter, system-ui, sans-serif',
    '--font-body': brand.font_body ? `"${brand.font_body}", Inter, system-ui, sans-serif` : 'Inter, system-ui, sans-serif',
    '--display-scale': brand.display_scale ? String(brand.display_scale) : '1',   // pixel faces draw small for their em (PP NeueBit ≈1.45)
    '--display-lh': brand.display_line_height ? String(brand.display_line_height) : '.96',   // bitmap faces (PP NeueBit) need ~.62–.7
    '--font-mono': brand.font_mono ? `"${brand.font_mono}", ui-monospace, Menlo, monospace` : 'var(--font-body)',
  };
  return ':root{' + Object.entries(map).map(([k, v]) => `${k}:${v}`).join(';') + '}';
}

// brand.font_faces: [{family, src, weight?, style?}] — self-hosted brand fonts (a commercial face the
// brand serves from its own site, e.g. PP NeueBit). src is resolved relative to the spec file. Declared
// BEFORE the Google Fonts link so a local face wins when both exist.
function fontFacesCss(brand = {}, specDir = process.cwd()) {
  const faces = brand.font_faces || [];
  return faces.map(f => {
    let src = String(f.src || '').trim();
    if (src && !/^(https?:|file:|data:)/i.test(src)) src = 'file://' + (path.isAbsolute(src) ? src : path.resolve(specDir, src));
    const fmt = /\.otf$/i.test(src) ? 'opentype' : /\.ttf$/i.test(src) ? 'truetype' : /\.woff2$/i.test(src) ? 'woff2' : /\.woff$/i.test(src) ? 'woff' : 'opentype';
    return `@font-face{font-family:"${f.family}";src:url("${src}") format("${fmt}");font-weight:${f.weight || 400};font-style:${f.style || 'normal'};font-display:block}`;
  }).join('\n');
}

function googleFontsHref(brand = {}) {
  const fams = new Set(['Inter:wght@400;500;600;700;800;900']);
  for (const f of brand.google_fonts || []) fams.add(f);
  return 'https://fonts.googleapis.com/css2?' +
    [...fams].map(f => 'family=' + encodeURIComponent(f).replace(/%3A/g, ':').replace(/%40/g, '@').replace(/%3B/g, ';')).join('&') +
    '&display=swap';
}

async function injectSlots(page, slots) {
  return page.evaluate((slots) => {
    const report = { filled: [], missing: [], hidden: [] };
    const all = document.querySelectorAll('[data-slot],[data-slot-src],[data-slot-style]');
    all.forEach(el => {
      const key = el.dataset.slot || el.dataset.slotSrc || el.dataset.slotStyle;
      const val = slots[key];
      const has = val !== undefined && val !== null && String(val).trim() !== '';
      if (!has) {
        if (el.hasAttribute('data-optional')) { el.style.display = 'none'; report.hidden.push(key); }
        else if (el.hasAttribute('data-default')) { /* keep the template's default text */ }
        else report.missing.push(key);
        return;
      }
      if (el.dataset.slot !== undefined) el.innerHTML = String(val);
      if (el.dataset.slotSrc !== undefined) el.setAttribute('src', String(val));
      if (el.dataset.slotStyle !== undefined) el.style.cssText += ';' + String(val);
      report.filled.push(key);
    });
    // unknown slots the author passed but the template doesn't have
    const known = new Set([...all].map(el => el.dataset.slot || el.dataset.slotSrc || el.dataset.slotStyle));
    const universal = new Set(['brand-name', 'logo']); // injected for every template; not every template uses them
    report.unknown = Object.keys(slots).filter(k => !known.has(k) && !universal.has(k));
    return report;
  }, slots);
}

async function fitText(page) {
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll('[data-fit]').forEach(el => {
      const min = parseFloat(el.dataset.fitMin || '28');
      const box = el.parentElement;
      let size = parseFloat(getComputedStyle(el).fontSize);
      let guard = 0;
      const overflows = () => el.scrollHeight > box.clientHeight + 1 || el.scrollWidth > box.clientWidth + 1;
      while (overflows() && size > min && guard < 80) {
        size -= 2; el.style.fontSize = size + 'px'; guard++;
      }
      const why = [el.scrollHeight > box.clientHeight + 1 ? `h ${el.scrollHeight}>${box.clientHeight}` : '', el.scrollWidth > box.clientWidth + 1 ? `w ${el.scrollWidth}>${box.clientWidth}` : ''].filter(Boolean).join(' ');
      out.push({ slot: el.dataset.slot || el.className, size, start: el.dataset.fitStart, clipped: overflows(), reason: why, boxH: box.clientHeight, boxW: box.clientWidth, elH: el.scrollHeight, elW: el.scrollWidth });
    });
    return out;
  });
}

// Post-render QA: the things a file-size/dimension check can never see.
// 1) text overflow / collision  2) image cropping under object-fit:cover  3) contrast of every slot vs its real ground
async function visualQA(page) {
  return page.evaluate(() => {
    const out = [];
    const lum = (r, g, b) => { const c = [r, g, b].map(v => v / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
    const parse = (s) => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(s || ''); return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : null; };
    const contrast = (a, b) => { const la = lum(...a), lb = lum(...b); const [h, l] = la > lb ? [la, lb] : [lb, la]; return (h + .05) / (l + .05); };
    const vis = el => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0; };
    const hasImageGround = el => { for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.backgroundImage && cs.backgroundImage !== 'none' && !/gradient/.test(cs.backgroundImage)) return true; if (n.querySelector && [...n.children].some(c => c.tagName === 'IMG' && vis(c) && getComputedStyle(c).position === 'absolute')) return true; if (n.classList && n.classList.contains('bg-layer') && n.classList.contains('on')) return true; } return false; };
    const groundOf = el => { for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c[3] > .85) return c; } const b = parse(getComputedStyle(document.body).backgroundColor); return b && b[3] > 0 ? b : [255, 255, 255, 1]; };

    // 1) overflow: content that spills past its parent box or off the canvas (not glyph-box descenders from tight line-height)
    const VW = document.documentElement.clientWidth, VH = document.documentElement.clientHeight;
    document.querySelectorAll('[data-slot], td, th').forEach(el => {
      if (!vis(el) || !el.textContent.trim()) return;
      const name = el.dataset.slot || el.tagName.toLowerCase();
      const r = el.getBoundingClientRect(), p = el.parentElement ? el.parentElement.getBoundingClientRect() : r;
      // a visible-overflow container of positioned children (an authored object stack) is not 'clipped' when a child leaves
      // its box — it is clipped when a child leaves the CANVAS. Text elements keep the strict scrollWidth check.
      const cs = getComputedStyle(el); const ownText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      let ow = el.scrollWidth - el.clientWidth;                          // horizontal: nowrap text wider than its cell
      if (cs.overflow === 'visible' && !ownText && el.children.length) {
        const kids = [...el.querySelectorAll('*')].filter(vis).map(k => k.getBoundingClientRect());
        const off = kids.some(k => k.right > VW + 2 || k.left < -2 || k.bottom > VH + 2 || k.top < -2);
        ow = off ? 999 : 0;
        if (off) { out.push(`OVERFLOW: "${name}" has content outside the canvas — the object is too big for the stage`); return; }
      }
      const spillY = Math.max(r.bottom - p.bottom, r.bottom - VH);       // vertical: past the parent box or off the canvas
      const spillX = Math.max(r.right - VW, 0);
      if (ow > 3) out.push(`OVERFLOW: "${name}" is ${ow}px wider than its box — text is clipped or colliding`);
      if (spillY > 4 || spillX > 4) out.push(`OVERFLOW: "${name}" spills ${Math.round(Math.max(spillY, spillX))}px past its container — text is cut off`);
    });
    // 1b) sibling collision inside table rows
    document.querySelectorAll('tr').forEach(tr => {
      const cells = [...tr.children].filter(vis); for (let i = 1; i < cells.length; i++) {
        const a = cells[i - 1].getBoundingClientRect(), b = cells[i].getBoundingClientRect();
        if (a.right - b.left > 2) out.push(`COLLISION: table cells overlap by ${Math.round(a.right - b.left)}px in row "${tr.textContent.trim().slice(0, 40)}"`);
      }
    });
    // 2) image crop under object-fit: cover
    document.querySelectorAll('img[data-slot-src]').forEach(img => {
      if (!vis(img) || !img.naturalWidth || img.hasAttribute('data-crop-ok')) return; // data-crop-ok = full-bleed by design
      const fit = getComputedStyle(img).objectFit; if (fit !== 'cover') return;
      const ia = img.naturalWidth / img.naturalHeight, ca = img.clientWidth / img.clientHeight;
      const lost = ia > ca ? 1 - ca / ia : 1 - ia / ca; // fraction of the wider axis discarded
      if (lost > .10) out.push(`CROP: image "${img.dataset.slotSrc}" loses ${Math.round(lost * 100)}% of its ${ia > ca ? 'width' : 'height'} under object-fit:cover — content may be cut (use a matched crop or fit:contain)`);
    });
    // 3) contrast of every text slot against its real ground (skipped over photos)
    document.querySelectorAll('[data-slot]').forEach(el => {
      if (!vis(el) || !el.textContent.trim() || el.hidden) return;
      if (hasImageGround(el)) return;
      const fg = parse(getComputedStyle(el).color); if (!fg) return;
      const bg = groundOf(el); const c = contrast(fg, bg);
      if (c < 3) out.push(`CONTRAST: "${el.dataset.slot}" reads at ${c.toFixed(1)}:1 against its ground — likely invisible`);
    });
    return out;
  });
}

async function waitForAssets(page) {
  await page.evaluate(async () => {
    try { await document.fonts.ready; } catch (e) {}
    const imgs = [...document.images].filter(i => i.src && !i.complete);
    await Promise.all(imgs.map(i => new Promise(res => { i.onload = i.onerror = res; })));
  });
  await page.waitForTimeout(150);
}

// The per-render DOM pipeline, shared by render.js (screenshot) and paper.js (snapshot → Paper):
// template → brand tokens + fonts → slots → __sync → assets → fit → __afterFit → __qa → visual QA.
// `res.warnings` / `res.fit` are filled in place; the page is left at its final, fitted state.
async function prepareRender(page, ctx, r, res) {
  const { spec, specDir, tokens, fontFaces, fontsHref, tpl } = ctx;
  await page.goto(`file://${tpl}`);
  await page.addStyleTag({ content: tokens });
  if (fontFaces) await page.addStyleTag({ content: fontFaces });
  await page.evaluate((href) => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
  }, fontsHref);
  // brand logo + name are universal slots every template may use
  // name_in_header:false suppresses the text wordmark when the logo already IS the wordmark (The AI Course: logo + "The AI Course" read twice)
  const slots = { 'brand-name': spec.brand?.name_in_header === false ? '' : (spec.brand?.name || ''), 'logo': spec.brand?.logo_url || '', ...(r.slots || {}) };
  // image slots may be given as paths relative to the spec file (portable fixtures, downloaded renders)
  for (const [k, v] of Object.entries(slots)) {
    if (typeof v === 'string' && /\.(png|jpe?g|webp|gif|svg)$/i.test(v.trim()) && !/^(https?:|file:|data:)/i.test(v.trim())) {
      const abs = path.isAbsolute(v) ? v : path.resolve(specDir, v);
      if (fs.existsSync(abs)) slots[k] = 'file://' + abs;
      else res.warnings.push(`image for slot "${k}" not found: ${abs}`);
    }
  }
  const report = await injectSlots(page, slots);
  await page.evaluate(() => { if (typeof window.__sync === 'function') window.__sync(); });
  if (report.missing.length) res.warnings.push(`required slots empty: ${report.missing.join(', ')}`);
  if (report.unknown.length) res.warnings.push(`unknown slots ignored: ${report.unknown.join(', ')}`);
  await waitForAssets(page);
  // Fonts: document.fonts.ready resolves immediately for an injected @font-face nobody has requested yet, so measure
  // only after every brand face is explicitly loaded. NOTE (corrected 2026-09-13): this was NOT the cause of The AI
  // Course's small headlines — fit logged size 200, clipped:false. Pixel/bitmap faces (PP NeueBit) simply draw small for
  // their em; that is what brand.display_scale is for. Keep this step for correctness, don't blame it for size.
  await page.evaluate(async (fams) => {
    for (const f of fams) { try { await document.fonts.load(`${f.weight || 400} 100px "${f.family}"`); } catch (e) {} }
    try { await document.fonts.ready; } catch (e) {}
  }, [...(spec.brand?.font_faces || []), ...[spec.brand?.font_display, spec.brand?.font_body, spec.brand?.font_mono].filter(Boolean).map(family => ({ family, weight: 700 }))]);
  await page.waitForTimeout(60);
  // Did the brand faces actually arrive? A Google Font that fails to load (offline, sandboxed, typo in the family name) falls
  // back to Inter/system silently — the PNG still renders, the operator reviews the wrong typeface. Say so.
  // Detection by measurement (a locally installed face never appears in document.fonts): the family renders a probe
  // string at a different width than the generic fallback it is stacked on, or it is not there.
  const fontStatus = await page.evaluate(async (fams) => {
    const probe = (stack) => { const s = document.createElement('span'); s.textContent = 'mmmmmmmmmmlllllllliiiiiiiiWWWWWWW0123456789'; s.style.cssText = `position:absolute;left:-9999px;top:-9999px;font-size:72px;font-family:${stack};white-space:nowrap`; document.body.appendChild(s); const w = s.getBoundingClientRect().width; s.remove(); return w; };
    const out = [];
    for (const f of fams) {
      // a locally installed face loads lazily on first use — ask for it explicitly before measuring, or the probe sees the fallback (flaky on the annotated batch, 2026-09-14)
      try { await document.fonts.load(`400 72px "${f}"`); await document.fonts.load(`700 72px "${f}"`); } catch (e) {}
      await new Promise(r => setTimeout(r, 30));
      const loaded = probe(`"${f}", monospace`) !== probe('monospace') || probe(`"${f}", serif`) !== probe('serif');
      out.push({ family: f, loaded });
    }
    return out;
  }, [...new Set([spec.brand?.font_display, spec.brand?.font_body, spec.brand?.font_mono].filter(Boolean))]);
  for (const f of fontStatus) if (!f.loaded) res.warnings.push(`FONT: "${f.family}" did not load — rendered with a fallback face (check network / google_fonts / font_faces)`);
  const fit = await fitText(page);
  // __afterFit: layout that depends on FINAL fitted sizes (e.g. a table sized to the space the headline left)
  await page.evaluate(() => { if (typeof window.__afterFit === 'function') window.__afterFit(); });
  for (const f of fit) if (f.clipped) res.warnings.push(`text still clipped after fit: ${f.slot} @ ${f.size}px`);
  res.fit = fit.map(f => ({ slot: f.slot, size: f.size, clipped: f.clipped, reason: f.reason }));   // record every fit decision — invisible shrinks cost a review round
  // QUALITY GATE (2026-09-15, Zach: "never spit out a subpar creative"): detect → heal → re-check, up to 3 passes.
  // A template may expose window.__heal(flags) → [] | ['mark dropped', …]: it fixes what it can (drop an optional decoration,
  // move a sticky note, step the headline down) and the renderer re-runs fit + QA. Whatever layout defect survives healing
  // is BLOCKING — it never reaches the gallery as a candidate.
  const LAYOUT = /^(COLLISION|OVERFLOW|CONTRAST|CROP)\b/;
  res.healed = [];
  for (let pass = 0; pass < 4; pass++) {
    const qa = await page.evaluate(() => (typeof window.__qa === 'function' ? window.__qa() : []));
    const vq = await visualQA(page);
    const flags = [...qa, ...vq];
    const layout = flags.filter(x => LAYOUT.test(x));
    if (!layout.length || pass === 3) { for (const x of flags) res.warnings.push(x); break; }
    const actions = await page.evaluate((fl) => (typeof window.__heal === 'function' ? (window.__heal(fl) || []) : []), layout);
    if (!actions.length) { for (const x of flags) res.warnings.push(x); break; }
    res.healed.push(...actions.map(a => `pass ${pass + 1}: ${a}`));
    // re-settle layout after the change
    await page.evaluate(() => { if (typeof window.__sync === 'function') window.__sync(); });
    await page.waitForTimeout(30);
    const refit = await fitText(page);
    await page.evaluate(() => { if (typeof window.__afterFit === 'function') window.__afterFit(); });
    res.fit = refit.map(f => ({ slot: f.slot, size: f.size, clipped: f.clipped, reason: f.reason }));
  }
  for (const h of res.healed) res.warnings.push(`HEALED — ${h}`);
  // anything layout-level still standing after healing cannot ship
  for (const w of res.warnings) if (LAYOUT.test(w)) res.warnings.push(`QUALITY — cannot ship: ${w}`);
  return slots;
}

async function renderContactSheet(browser, files, outPath, cols = 4) {
  const cell = 360, pad = 12, label = 22;
  const rows = Math.ceil(files.length / cols);
  const W = cols * (cell + pad) + pad, H = rows * (cell * 1.25 + pad + label) + pad;
  const items = files.map(f => `
    <figure><img src="file://${f.path}"><figcaption>${f.id} · ${f.template}${f.ok ? '' : ' · <b style="color:#D00">FAILED</b>'}</figcaption></figure>`).join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#F5F5F7;font:13px/1.3 -apple-system,Inter,sans-serif;color:#1D1D1F}
    .grid{display:grid;grid-template-columns:repeat(${cols},${cell}px);gap:${pad}px;padding:${pad}px}
    figure{margin:0}img{width:${cell}px;display:block;border:1px solid #D2D2D7;background:#fff}
    figcaption{padding:4px 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}</style>
    <div class="grid">${items}</div>`;
  // a setContent() page is about:blank and cannot load file:// images — write the sheet to disk and navigate to it
  const sheetHtml = outPath.replace(/\.png$/, '.html');
  fs.writeFileSync(sheetHtml, html);
  const page = await browser.newPage();
  await page.setViewportSize({ width: W, height: Math.min(Math.ceil(H), 16000) });
  await page.goto(`file://${sheetHtml}`);
  await waitForAssets(page);
  await page.screenshot({ path: outPath, fullPage: true });
  await page.close();
  fs.unlinkSync(sheetHtml);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.spec) {
    console.error('\nUsage: node render.js <render-spec.json> [--sheet] [--only=id1,id2]\n');
    process.exit(1);
  }
  const specPath = path.resolve(args.spec);
  if (!fs.existsSync(specPath)) { console.error(`spec not found: ${specPath}`); process.exit(1); }
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const specDir = path.dirname(specPath);
  const outDir = args.out ? path.resolve(args.out) : (path.isAbsolute(spec.output_dir || '') ? spec.output_dir : path.join(specDir, spec.output_dir || 'images'));
  fs.mkdirSync(outDir, { recursive: true });

  const templatesDir = path.join(__dirname, 'templates');
  const tokenNotes = [];
  const tokens = cssTokens(spec.brand, tokenNotes);
  for (const n of tokenNotes) console.log(`  ⚠ ${n}`);
  const fontsHref = googleFontsHref(spec.brand);
  const fontFaces = fontFacesCss(spec.brand, specDir);
  if (fontFaces) console.log(`  · ${(spec.brand.font_faces||[]).length} self-hosted @font-face(s) declared from spec`);
  let renders = spec.renders || [];
  if (args.only) renders = renders.filter(r => args.only.includes(r.id));

  console.log(`\nad-engine render · ${spec.campaign || 'campaign'} · ${renders.length} render(s) → ${outDir}\n`);

  const browser = await chromium.launch();
  const results = [];

  for (const r of renders) {
    const [w, h] = CANVAS[r.aspect || '4:5'] || CANVAS['4:5'];
    const tpl = path.join(templatesDir, r.template.endsWith('.html') ? r.template : r.template + '.html');
    const outFile = path.join(outDir, r.file || `${r.id}.png`);
    const res = { id: r.id, template: r.template, path: outFile, canvas: [w, h], ok: false, warnings: [] };

    if (!fs.existsSync(tpl)) { res.error = `template not found: ${tpl}`; results.push(res); console.log(`  ✗ ${r.id}  ${res.error}`); continue; }

    const page = await browser.newPage();
    await page.setViewportSize({ width: w, height: h });
    try {
      await prepareRender(page, { spec, specDir, tokens, fontFaces, fontsHref, tpl }, r, res);
      await page.screenshot({ path: outFile, type: 'png' });

      // verify — never trust the write
      const dims = fs.existsSync(outFile) ? pngDimensions(outFile) : null;
      if (!dims) res.error = 'output is not a valid PNG';
      else if (dims[0] !== w || dims[1] !== h) res.error = `wrong dimensions ${dims[0]}×${dims[1]} (wanted ${w}×${h})`;
      else res.ok = true;
      res.bytes = fs.existsSync(outFile) ? fs.statSync(outFile).size : 0;
    } catch (e) {
      res.error = e.message;
    } finally {
      await page.close();
    }
    // classify: blocking = the template says it cannot ship without a real asset / a source line
    res.blocking = res.warnings.filter(w => /cannot ship|REQUIRED —|REQUIRED\b|NO SOURCE/i.test(w));
    res.quality = res.blocking.some(b => /^QUALITY/.test(b)) ? 'fail' : (res.healed && res.healed.length ? 'healed' : 'pass');
    results.push(res);
    const flag = res.ok ? (res.blocking.length ? '⛔' : '✓') : '✗';
    console.log(`  ${flag} ${r.id}  ${path.basename(outFile)}  ${res.ok ? `${w}×${h} · ${(res.bytes / 1024).toFixed(0)} KB` : res.error}`);
    for (const wmsg of res.warnings) console.log(`      ${/^HEALED/.test(wmsg) ? '✚' : '⚠'} ${wmsg}`);
  }

  let sheet = null;
  if (args.sheet && results.some(r => r.ok)) {
    // a --only run writes a SUBSET sheet under its own name so the full sheet is never clobbered
    sheet = path.join(outDir, args.only ? `contact-sheet.only-${args.only.join('-').replace(/[^\w-]/g, '_').slice(0, 60)}.png` : 'contact-sheet.png');
    await renderContactSheet(browser, results.filter(r => r.ok), sheet);
    console.log(`\n  ▦ contact sheet → ${sheet}`);
  }

  await browser.close();

  const ranAt = new Date().toISOString();
  const specName = path.basename(specPath);
  const summary = { campaign: spec.campaign, output_dir: outDir, spec: specName, ran_at: ranAt, rendered: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, blocked: results.filter(r => r.blocking && r.blocking.length).length, contact_sheet: sheet, results };

  // MERGE, never overwrite: results.json keeps the latest result per render id across every spec/run in this folder,
  // plus a runs[] history. A --only re-render updates one id and leaves the rest intact.
  const resultsPath = path.join(specDir, 'render-results.json');
  let merged = { campaign: spec.campaign, output_dir: outDir, by_id: {}, runs: [] };
  try { const prev = JSON.parse(fs.readFileSync(resultsPath, 'utf8')); if (prev && prev.by_id) merged = prev; } catch (e) {}
  for (const r of results) merged.by_id[r.id] = { ...r, spec: specName, ran_at: ranAt };
  merged.runs.push({ spec: specName, ran_at: ranAt, rendered: summary.rendered, failed: summary.failed, blocked: summary.blocked, ids: results.map(r => r.id) });
  merged.campaign = spec.campaign; merged.output_dir = outDir; merged.last = summary;
  merged.blocking_ids = Object.values(merged.by_id).filter(r => r.blocking && r.blocking.length).map(r => r.id);
  fs.writeFileSync(resultsPath, JSON.stringify(merged, null, 2));
  fs.appendFileSync(path.join(specDir, 'render-log.jsonl'), JSON.stringify(summary) + '\n');

  console.log(`\n${summary.rendered} rendered · ${summary.failed} failed · ${summary.blocked} BLOCKED · merged → render-results.json (by_id, ${Object.keys(merged.by_id).length} ids) · appended → render-log.jsonl\n`);
  if (merged.blocking_ids.length) console.log(`  ⛔ blocking (cannot ship without override): ${merged.blocking_ids.join(', ')}\n`);
  process.exit(summary.failed ? 2 : 0);
}

// paper.js (mode 3) reuses the per-render DOM pipeline — same tokens, fonts, slots, fit, QA — then snapshots the fitted DOM
module.exports = { CANVAS, cssTokens, fontFacesCss, googleFontsHref, injectSlots, fitText, visualQA, waitForAssets, pngDimensions, prepareRender };

if (require.main === module) main().catch(e => { console.error('render error:', e); process.exit(1); });
