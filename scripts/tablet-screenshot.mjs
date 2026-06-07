import WebSocket from 'ws';
import fs from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const WS_URL = 'ws://127.0.0.1:9222/devtools/page/AAB5E3712B07AE4C26F42DBAB4A7D9CB';

const ws = new WebSocket(WS_URL);
let id = 1;

function send(method, params = {}) {
  return new Promise((resolve) => {
    const mid = id++;
    const h = (data) => {
      try {
        const msg = JSON.parse(typeof data === 'string' ? data : data.toString());
        if (msg.id === mid) { ws.removeListener('message', h); resolve(msg); }
      } catch(e) {}
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  console.log('Connected');

  // Set 900px tablet viewport
  await send('Emulation.setDeviceMetricsOverride', {
    width: 900, height: 1200, deviceScaleFactor: 1, mobile: false
  });
  await sleep(1000);

  // Screenshot
  const ss = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const data = ss?.result?.data;
  if (data) {
    const dir = join(tmpdir(), 'murderboard-ss');
    const filePath = join(dir, 'board-tablet.png');
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
    console.log('Tablet screenshot:', filePath, fs.statSync(filePath).size, 'bytes');
  }

  ws.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
