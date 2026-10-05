/**
 * LLM 客户端（OpenAI 兼容 Chat Completions）。
 * - 配置（Base URL / API Key / 模型）只存本机浏览器，不进备份导出、不上传云端。
 * - 未配置或请求失败一律返回 null，调用方降级到规则版（assistant.ask 等）。
 */
import { localRaw, localSetRaw } from "./localdb";

export const LLM_CFG_KEY = "owner:llm:cfg";

export interface LlmConfig {
  /** OpenAI 兼容服务地址，到 /v1 为止，如 https://api.deepseek.com/v1 */
  baseUrl: string;
  apiKey: string;
  /** 如 deepseek-chat、gpt-4o-mini */
  model: string;
}

const DEFAULT_CFG: LlmConfig = { baseUrl: "", apiKey: "", model: "" };

export function getLlmConfig(): LlmConfig {
  try {
    const raw = localRaw(LLM_CFG_KEY);
    if (!raw) return { ...DEFAULT_CFG };
    const o = JSON.parse(raw) as Partial<LlmConfig>;
    return {
      baseUrl: String(o.baseUrl ?? "")
        .trim()
        .replace(/\/+$/, ""),
      apiKey: String(o.apiKey ?? "").trim(),
      model: String(o.model ?? "").trim(),
    };
  } catch {
    return { ...DEFAULT_CFG };
  }
}

export function setLlmConfig(patch: Partial<LlmConfig>): LlmConfig {
  const next: LlmConfig = { ...getLlmConfig(), ...patch };
  localSetRaw(LLM_CFG_KEY, JSON.stringify(next));
  return next;
}

export function clearLlmConfig(): void {
  localSetRaw(LLM_CFG_KEY, JSON.stringify(DEFAULT_CFG));
}

export function hasLlm(): boolean {
  const c = getLlmConfig();
  return Boolean(c.baseUrl && c.apiKey && c.model);
}

/** 超时/非 2xx/坏响应一律 null → 调用方降级规则版 */
export async function chatLLM(
  system: string,
  user: string,
  opts: { timeoutMs?: number } = {},
): Promise<string | null> {
  const cfg = getLlmConfig();
  if (!cfg.baseUrl || !cfg.apiKey || !cfg.model) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000);
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.4,
        max_tokens: 800,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as {
      choices?: { message?: { content?: unknown } }[];
    } | null;
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function testLlm(): Promise<{ ok: boolean; msg: string }> {
  if (!hasLlm()) {
    return { ok: false, msg: "请先填写 Base URL、API Key 与模型名" };
  }
  const t = await chatLLM("你是连通性测试助手。", "只回复 ok", {
    timeoutMs: 15000,
  });
  return t
    ? { ok: true, msg: `连接成功 · ${t.slice(0, 40)}` }
    : { ok: false, msg: "请求失败：检查地址（到 /v1）、Key 或模型名" };
}
