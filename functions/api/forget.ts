/* =====================================================================
   functions/api/forget.ts — Cloudflare Pages Function
   部署到 Cloudflare Pages 时,functions/ 目录下的文件自动成为边缘端点。
   与 server.mjs / api/forget.ts 等价:转发 GLM + 注入 Key + 限流 + 超时。
   运行在 Workers 运行时(Web 标准 Request/Response,env 通过 binding 注入)。
   ===================================================================== */

interface Env {
  ZHIPU_API_KEY: string;
  GLM_MODEL?: string;
  GLM_BASE_URL?: string;
}

// 智谱 GLM Coding Plan 端点(OpenAI Chat Completion 协议)
// 参考: https://docs.bigmodel.cn/cn/coding-plan/quick-start
// ⚠ Coding Plan Key 与普通平台 Key 不通用,务必配套使用同一套端点与 Key
const DEFAULT_BASE = 'https://open.bigmodel.cn/api/coding/paas/v4';
const DEFAULT_MODEL = 'glm-4.6';

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

import {
  echoEnabledFor,
  isRequestBody,
  promptFor,
  upstreamStatusFor,
  userPromptFor,
} from '../../prompt.js';

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      ...extraHeaders,
    },
  });
}

export const onRequestOptions = async () => json({}, 204);

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;
  const KEY = env.ZHIPU_API_KEY;
  const MODEL = env.GLM_MODEL || DEFAULT_MODEL;
  const BASE = (env.GLM_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (!checkRate(ip)) {
    return json({ error: 'RATE_LIMITED' }, 429);
  }

  let memory = '';
  let lang: 'en' | 'zh' = 'en';
  let echoEnabled = true;
  try {
    const parsed: unknown = await request.json();
    if (!isRequestBody(parsed)) {
      return json({ error: 'BAD_BODY' }, 400);
    }
    const body = parsed as {
      memory?: string;
      lang?: string;
      echoEnabled?: unknown;
    };
    memory = typeof body.memory === 'string' ? body.memory.trim() : '';
    lang = body.lang === 'zh' ? 'zh' : 'en';
    echoEnabled = echoEnabledFor(body);
  } catch {
    return json({ error: 'BAD_BODY' }, 400);
  }

  if (memory.length < 30 || memory.length > 300) {
    return json({ error: 'BAD_LENGTH', len: memory.length }, 400);
  }

  if (!KEY) {
    return json({ error: 'NO_KEY' }, 500);
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
        messages: [
          { role: 'system', content: promptFor(lang) },
          { role: 'user', content: userPromptFor(memory, echoEnabled) },
        ],
      }),
      signal: ctrl.signal,
    });

    if (!resp.ok) {
      const t = await resp.text();
      return json(
        { error: 'GLM_ERROR', status: resp.status, detail: t.slice(0, 200) },
        upstreamStatusFor(resp.status),
      );
    }

    const data: any = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    return json({ content });
  } catch (e: any) {
    if (e?.name === 'AbortError') return json({ error: 'TIMEOUT' }, 504);
    return json({ error: 'UPSTREAM_FAIL', detail: String(e).slice(0, 200) }, 500);
  } finally {
    clearTimeout(timer);
  }
};
