/* =====================================================================
   llm.ts — 调用 LLM 生成 7 层退化文本(双语)
   策略:SEALING 时发起【一次】请求,一次性拿到全部 7 层。
   包含:fetch → 清洗 ```json 包裹 → 按语言校验长度递减 → 失败重试 1 次
        → 再失败返回 fallbackStages()。
   ===================================================================== */

import { fallbackStages } from './fallback';
import type { Lang } from './i18n';

/** 严格匹配 7 层的 schema */
const STAGE_COUNT = 7;

/** strip 掉模型可能附加的 ```json / ``` 代码块包裹 */
function stripCodeFence(raw: string): string {
  let s = raw.trim();
  const fenceStart = /^```(?:json|JSON)?\s*/;
  if (fenceStart.test(s)) s = s.replace(fenceStart, '');
  if (/```$/.test(s)) s = s.replace(/```\s*$/, '');
  return s.trim();
}

/** 从一段可能含杂质的文本里抽出第一个 JSON 对象(容错) */
function extractJson(raw: string): string {
  const cleaned = stripCodeFence(raw);
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return cleaned;
  return cleaned.slice(start, end + 1);
}

/** 容错解析:标准 JSON.parse 失败时用正则提取数组里的字符串 */
function looseParse(raw: string): string[] | null {
  const arrMatch = raw.match(/\[[\s\S]*\]/);
  if (!arrMatch) return null;
  const strs = arrMatch[0].match(/"([^"]*)"/g);
  if (!strs) return null;
  return strs.map((s) => s.replace(/^"|"$/g, ''));
}

/**
 * 校验:长度为 7 的 string[],且长度呈递减趋势。
 * 中英文末层硬上限不同(中文 ≤ 4 字,英文 ≤ 6 字符容短词)。
 */
function validateStages(arr: unknown, lang: Lang): arr is string[] {
  if (!Array.isArray(arr) || arr.length !== STAGE_COUNT) return false;
  if (!arr.every((s) => typeof s === 'string' && s.trim().length > 0)) return false;
  const lens = arr.map((s) => s.length);
  const lastMax = lang === 'zh' ? 4 : 6;
  if (lens[6] > lastMax) return false;
  const first = lens[0];
  if (lens[4] > first * 0.5) return false;
  if (lens[5] > first * 0.3) return false;
  if (lens[6] >= first) return false;
  return true;
}

async function callOnce(
  memory: string,
  lang: Lang,
  signal: AbortSignal,
): Promise<string[]> {
  const resp = await fetch('/api/forget', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memory, lang }),
    signal,
  });

  if (resp.status === 429) {
    throw new Error('RATE_LIMITED');
  }
  if (!resp.ok) {
    throw new Error('API_ERROR_' + resp.status);
  }

  const data = await resp.json();
  const raw: string = data?.stages_raw ?? data?.content ?? '';
  if (!raw) throw new Error('EMPTY_RESPONSE');

  const jsonStr = extractJson(raw);
  let arr: unknown;
  try {
    const parsed: unknown = JSON.parse(jsonStr);
    arr = Array.isArray(parsed) ? parsed : (parsed as { stages?: unknown })?.stages;
  } catch {
    arr = looseParse(jsonStr);
  }

  if (!validateStages(arr, lang)) throw new Error('VALIDATION_FAILED');
  return arr as string[];
}

/** 判定是否"不可重试"的致命错误——重试无益,直接退化本地算法,避免 SEALING 长时间空等 */
function isFatal(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.message === 'RATE_LIMITED') return true;
  if (err.name === 'AbortError') return true; // 超时
  const m = err.message.match(/^API_ERROR_(\d{3})$/);
  if (m) {
    const s = Number(m[1]);
    // 4xx(鉴权失败 / 请求格式 / 限流)重试无益 —— 端点或 Key 配错时立即退化
    if (s === 400 || s === 401 || s === 403 || s === 404 || s === 429) return true;
  }
  return false;
}

/**
 * 主入口:生成 7 层退化文本。
 * 内置 12s 超时 + 致命错误立即退化 + 偶发错误重试 1 次 + 最终 fallback。
 */
export async function generateStages(memory: string, lang: Lang): Promise<string[]> {
  const demoOn = new URLSearchParams(location.search).has('demo');
  if (demoOn) {
    const { pickDemo } = await import('./demo-data');
    return pickDemo(lang);
  }

  const attempt = async (): Promise<string[]> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      return await callOnce(memory, lang, ctrl.signal);
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await attempt();
  } catch (firstErr) {
    if (isFatal(firstErr)) {
      console.warn('[Forgetting] fatal upstream error → local fallback.', firstErr);
      return fallbackStages(memory, lang);
    }
    // 偶发错误(网络抖动 / 5xx / 空响应 / 校验失败)重试一次
    try {
      return await attempt();
    } catch (secondErr) {
      console.warn('[Forgetting] both attempts failed → local fallback.', secondErr);
      return fallbackStages(memory, lang);
    }
  }
}
