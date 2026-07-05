/* =====================================================================
   llm.ts — 调用 LLM 生成 7 层退化文本
   策略(说明书 §4.1):SEALING 时发起【一次】请求,一次性拿到全部 7 层,
   之后阶段间点击直接从缓存取下一层,转场零等待。
   包含:fetch → 清洗 ```json 包裹 → 校验长度递减 → 失败重试 1 次
        → 再失败返回 fallbackStages()。
   ===================================================================== */

import { fallbackStages } from './fallback';

/** 严格匹配 7 层的 schema */
const STAGE_COUNT = 7;

/** strip 掉模型可能附加的 ```json / ``` 代码块包裹 */
function stripCodeFence(raw: string): string {
  let s = raw.trim();
  // 去首尾 ```json ... ``` 或 ``` ... ```
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

/** 容错解析:标准 JSON.parse 失败时(GLM 偶发返回缺逗号/未转义),用正则提取数组里的字符串 */
function looseParse(raw: string): string[] | null {
  const arrMatch = raw.match(/\[[\s\S]*\]/);
  if (!arrMatch) return null;
  const strs = arrMatch[0].match(/"([^"]*)"/g);
  if (!strs) return null;
  return strs.map((s) => s.replace(/^"|"$/g, ''));
}

/**
 * 校验:必须是长度为 7 的 string[],且长度呈递减趋势
 * (允许个别层持平,但第 5/6/7 层必须显著短于第 1 层)
 */
function validateStages(arr: unknown): arr is string[] {
  if (!Array.isArray(arr) || arr.length !== STAGE_COUNT) return false;
  if (!arr.every((s) => typeof s === 'string' && s.trim().length > 0)) return false;
  const lens = arr.map((s) => s.length);
  // 第 7 层 ≤ 4 字(硬性,自查清单要求)
  if (lens[6] > 4) return false;
  // 第 5/6/7 层必须显著短于第 1 层
  const first = lens[0];
  if (lens[4] > first * 0.5) return false;
  if (lens[5] > first * 0.3) return false;
  // 整体末层必小于首层
  if (lens[6] >= first) return false;
  return true;
}

async function callOnce(memory: string, signal: AbortSignal): Promise<string[]> {
  const resp = await fetch('/api/forget', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memory }),
    signal,
  });

  // 429 / 5xx → 抛错让上层走 fallback
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
    // 兼容两种返回结构:{stages:[...]} 或直接 [...]
    arr = Array.isArray(parsed) ? parsed : (parsed as { stages?: unknown })?.stages;
  } catch {
    // 标准 JSON 解析失败 → 容错提取(GLM 偶发返回缺逗号等瑕疵)
    arr = looseParse(jsonStr);
  }

  if (!validateStages(arr)) throw new Error('VALIDATION_FAILED');
  return arr as string[];
}

/**
 * 主入口:生成 7 层退化文本。
 * 内置 12s 超时 + 失败重试 1 次 + 最终 fallback。
 */
export async function generateStages(memory: string): Promise<string[]> {
  const demoOn = new URLSearchParams(location.search).has('demo');
  if (demoOn) {
    const { pickDemo } = await import('./demo-data');
    return pickDemo();
  }

  const attempt = async (): Promise<string[]> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      return await callOnce(memory, ctrl.signal);
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await attempt();
  } catch (firstErr) {
    // 限流 / 超时 → 不重试,直接 fallback
    if (
      firstErr instanceof Error &&
      (firstErr.message === 'RATE_LIMITED' || firstErr.name === 'AbortError')
    ) {
      console.warn('[遗忘引擎] 限流或超时,启用本地兜底。', firstErr.message);
      return fallbackStages(memory);
    }
    // 其他错误:再试一次
    try {
      return await attempt();
    } catch (secondErr) {
      console.warn('[遗忘引擎] 两次请求均失败,启用本地兜底。', secondErr);
      return fallbackStages(memory);
    }
  }
}
