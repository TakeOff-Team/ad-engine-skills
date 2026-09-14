#!/usr/bin/env node
/**
 * ad-engine / render / paper-client.js
 * Minimal JSON-RPC client for the Paper Desktop MCP server (http://127.0.0.1:29979/mcp).
 *
 * Why a direct client instead of the session's MCP tools: Paper's server only exists while
 * Paper Desktop is open, and Claude Code loads MCP tools at session start — a session begun
 * before Paper was open has no Paper tools until it restarts. Talking to the local server
 * over HTTP sidesteps that entirely and makes the Paper path scriptable (paper.js).
 *
 * CLI:  node paper-client.js tools                     → list tools
 *       node paper-client.js call <tool> '<json args>' → call one tool, print result
 *       node paper-client.js info                      → server instructions + basic file info
 */
const http = require('http');

const URL_ = process.env.PAPER_MCP_URL || 'http://127.0.0.1:29979/mcp';

class PaperClient {
  constructor(url = URL_) { this.url = new URL(url); this.session = null; this.id = 0; this.instructions = ''; }

  _post(body, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', 'Content-Length': Buffer.byteLength(data), ...extraHeaders };
      if (this.session) headers['Mcp-Session-Id'] = this.session;
      const req = http.request({ hostname: this.url.hostname, port: this.url.port, path: this.url.pathname, method: 'POST', headers }, res => {
        const sid = res.headers['mcp-session-id']; if (sid) this.session = sid;
        let buf = ''; res.setEncoding('utf8');
        res.on('data', c => buf += c);
        res.on('end', () => {
          if (res.statusCode === 202 || !buf.trim()) return resolve(null);
          // streamable HTTP: either a JSON body or an SSE stream of `data:` lines
          const ct = res.headers['content-type'] || '';
          try {
            if (ct.includes('text/event-stream')) {
              const msgs = buf.split(/\n\n/).map(chunk => chunk.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('')).filter(Boolean).map(s => JSON.parse(s));
              const mine = msgs.find(m => m.id === body.id) || msgs[msgs.length - 1];
              return resolve(mine);
            }
            return resolve(JSON.parse(buf));
          } catch (e) { reject(new Error(`bad response (${res.statusCode}): ${buf.slice(0, 400)}`)); }
        });
      });
      req.on('error', reject); req.setTimeout(120000, () => { req.destroy(new Error('timeout')); });
      req.write(data); req.end();
    });
  }

  async rpc(method, params = {}) {
    const id = ++this.id;
    const r = await this._post({ jsonrpc: '2.0', id, method, params });
    if (r && r.error) throw new Error(`${method}: ${r.error.message || JSON.stringify(r.error)}`);
    return r ? r.result : null;
  }

  async connect() {
    const r = await this.rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'ad-engine-paper', version: '0.1' } });
    this.instructions = (r && r.instructions) || '';
    this.server = r && r.serverInfo;
    await this._post({ jsonrpc: '2.0', method: 'notifications/initialized' });
    return r;
  }

  async tools() { const r = await this.rpc('tools/list'); return (r && r.tools) || []; }

  async call(name, args = {}) {
    const r = await this.rpc('tools/call', { name, arguments: args });
    if (r && r.isError) throw new Error(`${name} failed: ${(r.content || []).map(c => c.text || '').join('\n').slice(0, 2000)}`);
    return r;
  }

  // convenience: the text of a tool result (most Paper tools answer with a single text block)
  static text(result) { return ((result && result.content) || []).filter(c => c.type === 'text').map(c => c.text).join('\n'); }
  static json(result) { try { return JSON.parse(PaperClient.text(result)); } catch (e) { return null; } }
}

module.exports = { PaperClient };

if (require.main === module) {
  (async () => {
    const [cmd, a, b] = process.argv.slice(2);
    const c = new PaperClient();
    await c.connect();
    if (cmd === 'tools') {
      for (const t of await c.tools()) console.log(`- ${t.name}: ${(t.description || '').split('\n')[0].slice(0, 160)}\n    args: ${JSON.stringify(Object.keys((t.inputSchema || {}).properties || {}))}`);
    } else if (cmd === 'info') {
      console.log(`server: ${JSON.stringify(c.server)}\n\n--- instructions ---\n${c.instructions}\n`);
      try { console.log('--- get_basic_info ---\n' + PaperClient.text(await c.call('get_basic_info', {}))); } catch (e) { console.log('get_basic_info: ' + e.message); }
    } else if (cmd === 'call') {
      const args = b ? JSON.parse(b) : {};
      const r = await c.call(a, args);
      const txt = PaperClient.text(r);
      console.log(txt || JSON.stringify(r, null, 2).slice(0, 4000));
      const imgs = (r.content || []).filter(x => x.type === 'image');
      if (imgs.length) console.log(`[${imgs.length} image block(s) omitted]`);
    } else {
      console.log('usage: node paper-client.js tools | info | call <tool> <json>');
    }
  })().catch(e => { console.error('paper-client:', e.message); process.exit(1); });
}
