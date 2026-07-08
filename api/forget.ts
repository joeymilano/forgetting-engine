/* =====================================================================
   api/forget.ts — Vercel Serverless Function
   与 server.mjs 等价:转发到 GLM + 注入 Key + 限流 + 超时。
   Vercel 会自动把 api/ 目录下的文件暴露为 /api/<name>。
   ===================================================================== */

// Vercel 运行时自带类型;开发期避免引入 @vercel/node,用最小签名
interface Req {
  method?: string;
  headers: Record<string, string | string[]>;
  body?: {
    memory?: string;
    lang?: string;
    echoEnabled?: unknown;
  } | string;
}
interface Res {
  status(code: number): Res;
  setHeader(k: string, v: string): Res;
  end(body?: string): void;
}

// ⚠ 模型选择经过实测权衡:glm-4.6 默认会思考,完整六饮 prompt 常 40–60s,
// 远超服务端超时;glm-4-flash 够快(~12s)但指令遵循弱,几乎总是无法把六层
// 严格递减压缩到位,导致返回被校验拒绝、静默退回本地兜底文案。glm-4.6 关闭
// thinking 后兼具两者优点:~12–13s 返回,且实测多数样本可通过严格递减校验。
const DEFAULT_BASE = 'https://open.bigmodel.cn/api/coding/paas/v4';
const MODEL = process.env.GLM_MODEL || 'glm-4.6';
const KEY = process.env.ZHIPU_API_KEY;
const BASE = (process.env.GLM_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');

import {
  echoEnabledFor,
  isRequestBody,
  promptFor,
  upstreamStatusFor,
  userPromptFor,
} from '../prompt.js';

const WINDOW = 60 * 60 * 1000;
const LIMIT = 10;
const rateMap = new Map<string, { start: number; count: number }>();

function checkRate(ip: string): boolean {
  const now = Date.now();
  let rec = rateMap.get(ip);
  if (!rec || now - rec.start > WINDOW) {
    rec = { start: now, count: 0 };
    rateMap.set(ip, rec);
  }
  rec.count += 1;
  return rec.count <= LIMIT;
}

function json(res: Res, status: number, body: unknown) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).end(JSON.stringify(body));
}

export default async function handler(req: Req, res: Res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    json(res, 404, { error: 'NOT_FOUND' });
    return;
  }

  const xff = req.headers['x-forwarded-for'];
  const ip =
    (Array.isArray(xff) ? xff[0] : xff || '').split(',')[0].trim() || 'unknown';
  if (!checkRate(ip)) {
    json(res, 429, { error: 'RATE_LIMITED' });
    return;
  }

  let parsedBody: unknown;
  try {
    parsedBody =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : req.body === undefined
          ? {}
          : req.body;
  } catch {
    json(res, 400, { error: 'BAD_BODY' });
    return;
  }
  if (!isRequestBody(parsedBody)) {
    json(res, 400, { error: 'BAD_BODY' });
    return;
  }
  const body = parsedBody as {
    memory?: string;
    lang?: string;
    echoEnabled?: unknown;
  };
  const memory = typeof body.memory === 'string' ? body.memory.trim() : '';
  const lang: 'en' | 'zh' = body.lang === 'zh' ? 'zh' : 'en';
  const echoEnabled = echoEnabledFor(body);
  if (memory.length < 30 || memory.length > 300) {
    json(res, 400, { error: 'BAD_LENGTH', len: memory.length });
    return;
  }

  if (!KEY) {
    json(res, 500, { error: 'NO_KEY' });
    return;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 18000);
  try {
    const resp = await fetch(`${BASE}/chat/completions`, {
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
    });

    if (!resp.ok) {
      const t = await resp.text();
      json(res, upstreamStatusFor(resp.status), {
        error: 'GLM_ERROR',
        status: resp.status,
        detail: t.slice(0, 200),
      });
      return;
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    json(res, 200, { content });
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') {
      json(res, 504, { error: 'TIMEOUT' });
    } else {
      json(res, 500, { error: 'UPSTREAM_FAIL', detail: String(e).slice(0, 200) });
    }
  } finally {
    clearTimeout(timer);
  }
}
