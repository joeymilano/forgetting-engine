/* =====================================================================
   server.mjs — 本地开发代理(原生 node:http,不装 Express)
   只做一件事:转发到 GLM + 注入 Key + 限流。
   等价于 api/forget.ts(Vercel Function)。
   ===================================================================== */

import http from 'node:http';
import { readFileSync } from 'node:fs';

// 轻量 .env 加载(避免引入 dotenv)
try {
  const txt = readFileSync(new URL('./.env', import.meta.url), 'utf8');
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch {
  /* 无 .env 时静默,靠真实环境变量 */
}

const PORT = Number(process.env.PROXY_PORT || 8787);
const KEY = process.env.ZHIPU_API_KEY;
// 智谱 GLM Coding Plan 端点 + 模型(参考 https://docs.bigmodel.cn/cn/coding-plan/quick-start)
// ⚠ Coding Plan Key 与普通平台 Key 不通用,务必配套使用
// ⚠ 模型选择经过实测权衡:glm-4.6 默认会思考,完整六饮 prompt 常 40–60s,
// 远超服务端超时;glm-4-flash 够快(~12s)但指令遵循弱,几乎总是无法把六层
// 严格递减压缩到位,导致返回被校验拒绝、静默退回本地兜底文案。glm-4.6 关闭
// thinking 后兼具两者优点:~12–13s 返回,且实测多数样本可通过严格递减校验。
const DEFAULT_BASE = 'https://open.bigmodel.cn/api/coding/paas/v4';
const MODEL = process.env.GLM_MODEL || 'glm-4.6';
const BASE = (process.env.GLM_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');

// —— System Prompt(双语,按 body.lang 选择) ——
import {
  echoEnabledFor,
  isRequestBody,
  promptFor,
  upstreamStatusFor,
  userPromptFor,
} from './prompt.js';

// —— 内存限流:每 IP 每小时 10 次 ——
const WINDOW = 60 * 60 * 1000;
const LIMIT = 10;
const rateMap = new Map();
function checkRate(ip) {
  const now = Date.now();
  let rec = rateMap.get(ip);
  if (!rec || now - rec.start > WINDOW) {
    rec = { start: now, count: 0 };
    rateMap.set(ip, rec);
  }
  rec.count += 1;
  return rec.count <= LIMIT;
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });
}

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (req.url !== '/api/forget' || req.method !== 'POST') {
    send(res, 404, { error: 'NOT_FOUND' });
    return;
  }

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown';
  if (!checkRate(ip)) {
    send(res, 429, { error: 'RATE_LIMITED' });
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(await readBody(req));
  } catch {
    send(res, 400, { error: 'BAD_BODY' });
    return;
  }
  if (!isRequestBody(parsed)) {
    send(res, 400, { error: 'BAD_BODY' });
    return;
  }

  const memory = typeof parsed.memory === 'string' ? parsed.memory.trim() : '';
  if (memory.length < 30 || memory.length > 300) {
    send(res, 400, { error: 'BAD_LENGTH', len: memory.length });
    return;
  }
  const lang = parsed.lang === 'zh' ? 'zh' : 'en';
  const echoEnabled = echoEnabledFor(parsed);

  if (!KEY) {
    send(res, 500, { error: 'NO_KEY', hint: '请在 .env 设置 ZHIPU_API_KEY' });
    return;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 18000);
  try {
    const resp = await fetch(
      `${BASE}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.7,
          thinking: { type: 'disabled' },
          messages: [
            { role: 'system', content: promptFor(lang) },
            { role: 'user', content: userPromptFor(memory, echoEnabled) },
          ],
        }),
        signal: ctrl.signal,
      },
    );

    if (!resp.ok) {
      const t = await resp.text();
      send(res, upstreamStatusFor(resp.status), {
        error: 'GLM_ERROR',
        status: resp.status,
        detail: t.slice(0, 200),
      });
      return;
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    send(res, 200, { content });
  } catch (e) {
    if (e?.name === 'AbortError') send(res, 504, { error: 'TIMEOUT' });
    else send(res, 500, { error: 'UPSTREAM_FAIL', detail: String(e).slice(0, 200) });
  } finally {
    clearTimeout(timer);
  }
});

server.listen(PORT, () => {
  console.log(`[遗忘引擎] 本地代理监听 http://localhost:${PORT}  (model=${MODEL})`);
});
