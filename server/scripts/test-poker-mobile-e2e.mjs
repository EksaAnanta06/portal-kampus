// FILE: server/scripts/test-poker-mobile-e2e.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');

const CHROME_BIN =
  '/home/lenovo/.cache/puppeteer/chrome-headless-shell/linux-144.0.7559.96/chrome-headless-shell-linux64/chrome-headless-shell';

const VIEWPORTS = [
  { name: '320x568', width: 320, height: 568 },
  { name: '360x640', width: 360, height: 640 },
  { name: '375x667', width: 375, height: 667 },
  { name: '390x844', width: 390, height: 844 },
  { name: '412x915', width: 412, height: 915 },
  { name: '640x360', width: 640, height: 360 },
  { name: '844x390', width: 844, height: 390 },
];

const SCREENS = [
  { name: 'lobby', query: 'screen=lobby' },
  { name: 'waiting', query: 'screen=waiting' },
  { name: 'table', query: 'screen=table&mode=holdem&turn=1' },
  { name: 'showdown', query: 'screen=showdown&mode=holdem' },
  { name: 'result', query: 'screen=result' },
];

const EXTREME_CASES = [
  { name: 'long_names', query: 'screen=table&mode=holdem&edge=long&players=4&turn=1' },
  { name: 'big_chips', query: 'screen=table&mode=holdem&edge=bigchips&players=4&turn=1' },
  { name: 'players_2', query: 'screen=table&mode=holdem&players=2&turn=1' },
  { name: 'players_3', query: 'screen=table&mode=holdem&players=3&turn=1' },
  { name: 'waiting_turn', query: 'screen=table&mode=holdem&players=4&turn=0' },
  { name: 'raise_sheet', query: 'screen=table&mode=holdem&players=4&turn=1&raise=1' },
  { name: 'join_keyboard', query: 'screen=lobby&join=1' },
  { name: 'capsa_13_cards', query: 'screen=table&mode=capsa&players=4&turn=1' },
];

const EXTREME_VIEWPORTS = [
  { name: '320x568', width: 320, height: 568 },
  { name: '360x640', width: 360, height: 640 },
  { name: '640x360', width: 640, height: 360 },
  { name: '844x390', width: 844, height: 390 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const getFreePort = () =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

const httpGetJson = (url) =>
  new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      })
      .on('error', reject);
  });

const waitForHttpOk = async (url, timeoutMs = 25000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const ok = await new Promise((resolve) => {
        http
          .get(url, (res) => {
            res.resume();
            resolve(res.statusCode >= 200 && res.statusCode < 400);
          })
          .on('error', () => resolve(false));
      });
      if (ok) return;
    } catch {
      // retry
    }
    await sleep(250);
  }
  throw new Error(`Timeout waiting for ${url}`);
};

const launchChrome = async () => {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'poker-chrome-'));
  const proc = spawn(
    CHROME_BIN,
    [
      '--headless',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--remote-debugging-port=0',
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  const wsUrl = await new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error(`Chrome CDP startup timeout: ${buffer}`)), 15000);
    proc.stderr.on('data', (chunk) => {
      buffer += chunk.toString();
      const match = buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Chrome exited early (${code}): ${buffer}`));
    });
  });

  const parsed = new URL(wsUrl);
  const cdpBase = `http://127.0.0.1:${parsed.port}`;
  const { body: targets } = await httpGetJson(`${cdpBase}/json/list`);
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  if (!pageTarget?.webSocketDebuggerUrl) {
    throw new Error('Could not find Chrome page target');
  }

  return { proc, userDataDir, pageWsUrl: pageTarget.webSocketDebuggerUrl };
};

const createCdpClient = async (pageWsUrl) => {
  const ws = new WebSocket(pageWsUrl);
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });

  let nextId = 1;
  const pending = new Map();

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || 'CDP Error'));
      else resolve(msg.result);
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send('Page.enable');
  await send('Runtime.enable');
  return { send, close: () => ws.close() };
};

const evaluatePageMetrics = async (cdp) => {
  const res = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const docEl = document.documentElement;
      const bodyEl = document.body;
      if (!docEl || !bodyEl) return { hasShell: false };
      const iw = window.innerWidth;
      const ih = window.innerHeight;
      const sh = docEl.scrollHeight;
      const sw = docEl.scrollWidth;

      const shell = document.querySelector('.poker-viewport-shell');
      const zones = Array.from(document.querySelectorAll('.poker-table-zones > *'));
      const clippedZones = zones
        .map((z) => {
          const r = z.getBoundingClientRect();
          return {
            tag: z.tagName,
            bottom: Math.round(r.bottom),
            right: Math.round(r.right),
            overflowBottom: r.bottom > ih + 1.5,
            overflowRight: r.right > iw + 1.5,
          };
        })
        .filter((z) => z.overflowBottom || z.overflowRight);

      // Hitung elemen yang keluar dari batas viewport (kecuali sr-only / offscreen)
      const visibleControls = Array.from(
        document.querySelectorAll('.poker-viewport-shell button, .poker-viewport-shell input, .MuiDrawer-paper button, .MuiDrawer-paper input')
      ).filter((el) => {
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
      });

      const outOfBoundsControls = visibleControls
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            label: el.getAttribute('aria-label') || el.textContent?.trim() || el.tagName,
            left: Math.round(r.left),
            top: Math.round(r.top),
            right: Math.round(r.right),
            bottom: Math.round(r.bottom),
            width: Math.round(r.width),
            height: Math.round(r.height),
          };
        })
        .filter((r) => r.left < -1 || r.top < -1 || r.right > iw + 1.5 || r.bottom > ih + 1.5);

      const smallTouchTargets = visibleControls
        .filter((el) => {
          const sliderRoot = el.type === 'range' ? el.closest('.MuiSlider-root') : null;
          const targetEl = sliderRoot || el;
          const r = targetEl.getBoundingClientRect();
          const isButtonOrInput =
            el.tagName === 'INPUT' ||
            el.classList.contains('MuiButton-root') ||
            el.classList.contains('MuiIconButton-root');
          return isButtonOrInput && (r.height < 43.5 || (!sliderRoot && r.width < 43.5));
        })
        .map((el) => {
          const targetEl = (el.type === 'range' && el.closest('.MuiSlider-root')) || el;
          const r = targetEl.getBoundingClientRect();
          return {
            label: el.getAttribute('aria-label') || el.textContent?.trim(),
            w: Math.round(r.width),
            h: Math.round(r.height),
          };
        });

      // Cek font size terkecil pada elemen teks terlihat di dalam shell
      let minFontSize = 999;
      let minFontSample = '';
      if (shell) {
        const walker = document.createTreeWalker(shell, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          if (!node.nodeValue || !node.nodeValue.trim()) continue;
          const parent = node.parentElement;
          if (!parent || parent.classList.contains('sr-only')) continue;
          if (parent.closest('[aria-hidden="true"]')) continue;
          const flipInner = parent.closest('.poker-flip-inner');
          if (flipInner) {
            const isFaceDown = flipInner.classList.contains('is-facedown');
            if (isFaceDown && parent.closest('.poker-flip-front')) continue;
            if (!isFaceDown && parent.closest('.poker-flip-back')) continue;
          }
          const st = window.getComputedStyle(parent);
          if (st.display === 'none' || st.visibility === 'hidden') continue;
          const fsPx = parseFloat(st.fontSize);
          if (fsPx > 0 && fsPx < minFontSize) {
            minFontSize = fsPx;
            minFontSample = node.nodeValue.trim().slice(0, 24);
          }
        }
      }

      // Hitung jumlah elemen visual utama pada layar meja saat bermain (target <= 25)
      let tableVisualCount = null;
      if (document.querySelector('.poker-table-zones')) {
        const headerItems = document.querySelectorAll('.poker-table-zones > header button, .poker-table-zones > header > span').length;
        const opponentItems = document.querySelectorAll('section[aria-label="Zona pemain lawan"] > div').length * 3;
        const boardItems = document.querySelectorAll('section[aria-label="Zona kartu tengah dan pot"] [aria-label="Kartu komunitas meja"] > div').length + 1;
        const playerCardItems = document.querySelectorAll('section[aria-label="Zona kartu dan chip Anda"] [aria-label="Kartu di tangan Anda"] > div').length;
        const playerChipBar = document.querySelectorAll('section[aria-label="Zona kartu dan chip Anda"] > div:last-child').length;
        const actionItems = Math.max(1, document.querySelectorAll('.poker-zone-action button').length);
        tableVisualCount = headerItems + opponentItems + boardItems + playerCardItems + playerChipBar + actionItems;
      }

      return {
        iw,
        ih,
        sh,
        sw,
        bodyOverflowY: bodyEl ? window.getComputedStyle(bodyEl).overflowY : '',
        clippedZones,
        outOfBoundsControls,
        smallTouchTargets,
        minFontSize,
        minFontSample,
        tableVisualCount,
        hasShell: Boolean(shell),
        href: window.location.href,
        bodyText: (bodyEl.innerText || '').trim().slice(0, 220),
      };
    })()`,
  });

  if (res.exceptionDetails) {
    throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
  }
  return res.result.value;
};

const run = async () => {
  const projectRoot = process.cwd();
  const vitePort = await getFreePort();
  const baseUrl = `http://127.0.0.1:${vitePort}`;

  const viteProc = spawn(
    'npx',
    ['vite', '--port', String(vitePort), '--strictPort', '--host', '127.0.0.1'],
    { cwd: path.join(projectRoot, 'client'), stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let chrome = null;
  let cdp = null;

  try {
    await waitForHttpOk(baseUrl);
    chrome = await launchChrome();
    cdp = await createCdpClient(chrome.pageWsUrl);

    let totalChecks = 0;
    let maxTableElementCount = 0;

    const verifyUrlAtViewport = async (label, query, vp) => {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 2,
        mobile: true,
        fitWindow: false,
      });

      const targetUrl = `${baseUrl}/poker/_preview?${query}`;
      await cdp.send('Page.navigate', { url: targetUrl });

      // Tunggu sampai PokerViewportShell selesai di-mount (hingga 18s pada cold compile Vite)
      for (let i = 0; i < 120; i++) {
        const probe = await evaluatePageMetrics(cdp);
        if (probe.hasShell) break;
        await sleep(150);
      }
      await sleep(260);

      const m = await evaluatePageMetrics(cdp);
      assert.equal(
        m.hasShell,
        true,
        `[${label} @ ${vp.name}] Shell tidak ter-render (href=${m.href}, body=${JSON.stringify(m.bodyText)})`
      );
      assert.ok(
        m.sh <= m.ih,
        `[${label} @ ${vp.name}] Scroll vertikal terdeteksi: scrollHeight=${m.sh} > innerHeight=${m.ih}`
      );
      assert.ok(
        m.sw <= m.iw,
        `[${label} @ ${vp.name}] Scroll horizontal terdeteksi: scrollWidth=${m.sw} > innerWidth=${m.iw}`
      );
      assert.deepEqual(
        m.clippedZones,
        [],
        `[${label} @ ${vp.name}] Zona melewati batas viewport: ${JSON.stringify(m.clippedZones)}`
      );
      assert.deepEqual(
        m.outOfBoundsControls,
        [],
        `[${label} @ ${vp.name}] Kontrol melewati batas viewport: ${JSON.stringify(m.outOfBoundsControls)}`
      );
      assert.deepEqual(
        m.smallTouchTargets,
        [],
        `[${label} @ ${vp.name}] Target sentuh < 44px: ${JSON.stringify(m.smallTouchTargets)}`
      );
      assert.ok(
        m.minFontSize >= 11.5,
        `[${label} @ ${vp.name}] Font < 12px terdeteksi (${m.minFontSize}px pada "${m.minFontSample}")`
      );
      if (m.tableVisualCount !== null) {
        if (label === 'table' && m.tableVisualCount > maxTableElementCount) {
          maxTableElementCount = m.tableVisualCount;
        }
        if (label !== 'capsa_13_cards') {
          assert.ok(
            m.tableVisualCount <= 25,
            `[${label} @ ${vp.name}] Anggaran elemen meja terlampaui: ${m.tableVisualCount} > 25`
          );
        }
      }
      totalChecks += 1;
    };

    // 1. Uji semua 5 layar pada SEMUA 7 ukuran viewport (35 kombinasi)
    for (const vp of VIEWPORTS) {
      for (const scr of SCREENS) {
        await verifyUrlAtViewport(scr.name, scr.query, vp);
      }
      console.log(`PASS VIEWPORT ${vp.name}: All 5 screens zero-scroll & valid`);
    }

    // 2. Uji semua kasus ekstrem pada viewport mobile & landscape kritis
    for (const vp of EXTREME_VIEWPORTS) {
      for (const ec of EXTREME_CASES) {
        await verifyUrlAtViewport(ec.name, ec.query, vp);
      }
      console.log(`PASS EXTREME CASES @ ${vp.name}: 8 edge cases zero-scroll & valid`);
    }

    console.log(
      `\nALL ${totalChecks} MOBILE E2E MATRIX CHECKS PASSED! Max Hold'em table elements observed: ${maxTableElementCount} (<= 25 limit)`
    );
  } finally {
    if (cdp) cdp.close();
    if (chrome?.proc) {
      chrome.proc.kill('SIGKILL');
      await fs.rm(chrome.userDataDir, { recursive: true, force: true }).catch(() => {});
    }
    viteProc.kill('SIGKILL');
  }
};

run().catch((err) => {
  console.error('MOBILE E2E TEST FAILED:', err);
  process.exit(1);
});
