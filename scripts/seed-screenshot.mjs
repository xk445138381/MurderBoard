import WebSocket from 'ws';
import fs from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const WS_URL = process.argv[2] || 'ws://127.0.0.1:9222/devtools/page/AAB5E3712B07AE4C26F42DBAB4A7D9CB';

const ws = new WebSocket(WS_URL);
let id = 1;

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const msgId = id++;
    const timeout = setTimeout(() => reject(new Error(`Timeout: ${method}`)), 15000);
    const handler = (data) => {
      try {
        const text = typeof data === 'string' ? data : data.toString();
        const msg = JSON.parse(text);
        if (msg.id === msgId) {
          clearTimeout(timeout);
          ws.removeListener('message', handler);
          resolve(msg);
        }
      } catch (e) {
        // Ignore parse errors for non-JSON messages
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  console.log('Connected to Chrome');

  await send('Page.enable');
  await send('Runtime.enable');

  // Navigate
  await send('Page.navigate', { url: 'http://127.0.0.1:5174/board' });
  await sleep(3000);

  // Inject sample data
  const js = `
    (async () => {
      try {
        const mod = await import('/src/storage/default-repository.ts');
        const repo = mod.defaultMurderBoardRepository;

        // Delete existing workspace if any (handle cascade)
        const oldWs = await repo.listWorkspaces();
        for (const w of oldWs) {
          const cases = await repo.listCases(w.id, { includeDeleted: true });
          for (const c of cases) {
            try { await repo.purgeCase(c.id); } catch(e) {
              try { await repo.softDeleteCase(c.id); } catch(e2) {}
              try { await repo.purgeCase(c.id); } catch(e3) {}
            }
          }
        }
        for (const w of oldWs) {
          try { await repo.purgeWorkspace(w.id); } catch(e) {
            try { await repo.softDeleteWorkspace(w.id); } catch(e2) {}
            try { await repo.purgeWorkspace(w.id); } catch(e3) {}
          }
        }

        const ws = await repo.createWorkspace({ name: '渡鸦宅邸谜案' });
        const c = await repo.createCase(ws.id, { name: '第一幕：晚宴疑云', status: 'active' });

        const lin = await repo.createCharacter(c.id, { name: '林乔', role: '目击者', notes: '主动提到怀表。回避最后一轮投票。' });
        const chen = await repo.createCharacter(c.id, { name: '陈维', role: '嫌疑人', notes: '接触过书房钥匙。' });
        const wang = await repo.createCharacter(c.id, { name: '王律', role: '侦探玩家', notes: '第一个发现尸体。' });

        const watch = await repo.createClue(c.id, { title: '停摆怀表', content: '停在 23:48。', source: '书房地板' });
        const key = await repo.createClue(c.id, { title: '书房钥匙', content: '在花盆下找到。', source: '花园' });
        const letter = await repo.createClue(c.id, { title: '匿名信', content: '"今晚书房见"。', source: '门缝' });
        const glass = await repo.createClue(c.id, { title: '碎酒杯', content: '从门外方向砸向门内。', source: '书房门口' });

        const dinner = await repo.createEvent(c.id, { title: '晚宴开始', description: '7 位客人到齐。', occurredAt: '2026-06-07T19:00:00.000Z' });
        const arg = await repo.createEvent(c.id, { title: '书房争吵', description: '书房附近争吵约 5 分钟。', occurredAt: '2026-06-07T23:40:00.000Z' });
        const found = await repo.createEvent(c.id, { title: '发现尸体', description: '窗户从内侧锁住。', occurredAt: '2026-06-08T00:15:00.000Z' });

        const staged = await repo.createHypothesis(c.id, { title: '现场被提前布置', body: '怀表停摆早于争吵。', status: 'plausible', confidence: 70 });
        const insider = await repo.createHypothesis(c.id, { title: '内鬼作案', body: '凶手是客人之一。', status: 'unverified', confidence: 45 });
        const coverup = await repo.createHypothesis(c.id, { title: '林乔在隐瞒', body: '主动提怀表转移注意。', status: 'refuted', confidence: 30 });

        await repo.createBoardRelation(c.id, { fromNodeType: 'clue', fromNodeId: watch.id, toNodeType: 'hypothesis', toNodeId: staged.id, type: 'supports', note: '停摆时间支持提前布置。' });
        await repo.createBoardRelation(c.id, { fromNodeType: 'event', fromNodeId: arg.id, toNodeType: 'hypothesis', toNodeId: staged.id, type: 'refutes', note: '争吵削弱伪造时间线。' });
        await repo.createBoardRelation(c.id, { fromNodeType: 'person', fromNodeId: chen.id, toNodeType: 'hypothesis', toNodeId: staged.id, type: 'suspect', note: '钥匙接触让陈维有关。' });
        await repo.createBoardRelation(c.id, { fromNodeType: 'clue', fromNodeId: watch.id, toNodeType: 'event', toNodeId: arg.id, type: 'sequence', note: '怀表时间关联争吵窗口。' });
        await repo.createBoardRelation(c.id, { fromNodeType: 'person', fromNodeId: lin.id, toNodeType: 'clue', toNodeId: watch.id, type: 'related', note: '林乔最早提到怀表。' });
        await repo.createBoardRelation(c.id, { fromNodeType: 'clue', fromNodeId: key.id, toNodeType: 'clue', toNodeId: letter.id, type: 'related', note: '钥匙和匿名信线索关联。' });
        await repo.createBoardRelation(c.id, { fromNodeType: 'clue', fromNodeId: glass.id, toNodeType: 'event', toNodeId: arg.id, type: 'supports', note: '碎玻璃确认争吵来自内部。' });
        await repo.createBoardRelation(c.id, { fromNodeType: 'hypothesis', fromNodeId: insider.id, toNodeType: 'hypothesis', toNodeId: coverup.id, type: 'refutes', note: '内鬼成立则隐瞒是自保。' });
        await repo.createBoardRelation(c.id, { fromNodeType: 'person', fromNodeId: wang.id, toNodeType: 'event', toNodeId: found.id, type: 'sequence', note: '王律最先到现场。' });

        await repo.saveBoardNodePosition(c.id, { nodeType: 'person', nodeId: lin.id, x: 86, y: 94 });
        await repo.saveBoardNodePosition(c.id, { nodeType: 'clue', nodeId: watch.id, x: 372, y: 68 });
        await repo.saveBoardNodePosition(c.id, { nodeType: 'event', nodeId: arg.id, x: 676, y: 182 });
        await repo.saveBoardNodePosition(c.id, { nodeType: 'hypothesis', nodeId: staged.id, x: 410, y: 344 });
        await repo.saveBoardNodePosition(c.id, { nodeType: 'person', nodeId: chen.id, x: 104, y: 420 });
        await repo.saveBoardNodePosition(c.id, { nodeType: 'clue', nodeId: key.id, x: 86, y: 560 });
        await repo.saveBoardNodePosition(c.id, { nodeType: 'clue', nodeId: letter.id, x: 372, y: 540 });
        await repo.saveBoardNodePosition(c.id, { nodeType: 'clue', nodeId: glass.id, x: 676, y: 520 });
        await repo.saveBoardNodePosition(c.id, { nodeType: 'event', nodeId: dinner.id, x: 86, y: 700 });
        await repo.saveBoardNodePosition(c.id, { nodeType: 'event', nodeId: found.id, x: 676, y: 700 });
        await repo.saveBoardNodePosition(c.id, { nodeType: 'hypothesis', nodeId: insider.id, x: 104, y: 200 });
        await repo.saveBoardNodePosition(c.id, { nodeType: 'hypothesis', nodeId: coverup.id, x: 676, y: 410 });
        await repo.saveBoardNodePosition(c.id, { nodeType: 'person', nodeId: wang.id, x: 410, y: 560 });

        return 'OK';
      } catch (e) {
        return 'ERROR: ' + e.message;
      }
    })();
  `;

  const result = await send('Runtime.evaluate', {
    expression: js,
    awaitPromise: true,
  });

  const value = result.result?.result?.value || 'unknown';
  console.log('Seed result:', value);

  // Reload to show fresh data
  await send('Page.reload');
  await sleep(3000);

  // Take screenshot
  const ss = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const data = ss?.result?.data;
  if (data) {
    const dir = join(tmpdir(), 'murderboard-ss');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = join(dir, 'board-sample.png');
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
    console.log('Screenshot:', filePath, fs.statSync(filePath).size, 'bytes');
  } else {
    console.log('Screenshot FAILED:', JSON.stringify(ss).slice(0, 500));
  }

  ws.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
