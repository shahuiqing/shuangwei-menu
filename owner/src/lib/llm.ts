/**
 * LLM 客户端（OpenAI 兼容 Chat Completions）。
 * - 支持多个接口，按健康度与延迟调度，失败自动切换。
 * - 配置只存本机浏览器，不进备份导出、不上传云端。
 * - 未配置或全部失败返回 null，调用方降级到规则版。
 */
import { localRaw, localSetRaw } from "./localdb";

export const LLM_CFG_KEY = "owner:llm:cfg";
export const LLM_MAX_ENDPOINTS = 6;

export interface LlmEndpoint {
  id: string;
  name: string;
  /** OpenAI 兼容服务地址，到 /v1 为止 */
  baseUrl: string;
  apiKey: string;
  /** 如 deepseek-chat、gpt-4o-mini */
  model: string;
  enabled: boolean;
}

export interface LlmConfig {
  endpoints: LlmEndpoint[];
}

export interface LlmProbe {
  id: string;
  name: string;
  ok: boolean;
  latencyMs: number;
  msg: string;
}

export interface LlmTestReport {
  ok: boolean;
  msg: string;
  results: LlmProbe[];
}

const DEFAULT_CFG: LlmConfig = { endpoints: [] };
const TEXT_TOTAL_MS = 20000;
const TEXT_ATTEMPT_MS = 10000;
const VISION_TOTAL_MS = 60000;
const VISION_ATTEMPT_MS = 45000;
const PROBE_TIMEOUT_MS = 15000;

interface EndpointHealth {
  attempts: number;
  failures: number;
  cooldownUntil: number;
  avgLatencyMs: number;
}

const health = new Map<string, EndpointHealth>();

export function resetLlmHealth(): void {
  health.clear();
}

let seq = 0;

export function newLlmEndpointId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  seq += 1;
  return `llm-${Date.now()}-${seq}`;
}

function normalizeBaseUrl(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\/+$/, "");
}

function normalizeEndpoint(value: unknown, index: number): LlmEndpoint | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  const baseUrl = normalizeBaseUrl(o.baseUrl);
  const apiKey = String(o.apiKey ?? "").trim();
  const model = String(o.model ?? "").trim();
  if (!baseUrl && !apiKey && !model) return null;
  return {
    id: String(o.id ?? "").trim() || newLlmEndpointId(),
    name:
      String(o.name ?? "")
        .trim()
        .slice(0, 40) || `接口 ${index + 1}`,
    baseUrl,
    apiKey,
    model,
    enabled: o.enabled !== false,
  };
}

function normalizeEndpoints(value: unknown): LlmEndpoint[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: LlmEndpoint[] = [];
  value.slice(0, LLM_MAX_ENDPOINTS).forEach((item, index) => {
    const endpoint = normalizeEndpoint(item, index);
    if (!endpoint) return;
    if (seen.has(endpoint.id)) endpoint.id = newLlmEndpointId();
    seen.add(endpoint.id);
    out.push(endpoint);
  });
  return out;
}

function legacyEndpoints(o: Record<string, unknown>): LlmEndpoint[] {
  const endpoint = normalizeEndpoint(
    {
      id: "llm-legacy",
      name: "默认接口",
      baseUrl: o.baseUrl,
      apiKey: o.apiKey,
      model: o.model,
      enabled: true,
    },
    0,
  );
  return endpoint ? [endpoint] : [];
}

export function getLlmConfig(): LlmConfig {
  try {
    const raw = localRaw(LLM_CFG_KEY);
    if (!raw) return { endpoints: [] };
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (Array.isArray(o.endpoints)) {
      return { endpoints: normalizeEndpoints(o.endpoints) };
    }
    return { endpoints: legacyEndpoints(o) };
  } catch {
    return { ...DEFAULT_CFG };
  }
}

export function setLlmConfig(patch: Partial<LlmConfig>): LlmConfig {
  const current = getLlmConfig();
  const next: LlmConfig = {
    endpoints: normalizeEndpoints(patch.endpoints ?? current.endpoints),
  };
  localSetRaw(LLM_CFG_KEY, JSON.stringify(next));
  resetLlmHealth();
  return next;
}

export function clearLlmConfig(): void {
  localSetRaw(LLM_CFG_KEY, JSON.stringify(DEFAULT_CFG));
  resetLlmHealth();
}

export function isLlmEndpointComplete(endpoint: LlmEndpoint): boolean {
  return Boolean(endpoint.baseUrl && endpoint.apiKey && endpoint.model);
}

function activeEndpoints(): LlmEndpoint[] {
  return getLlmConfig().endpoints.filter(
    (endpoint) => endpoint.enabled && isLlmEndpointComplete(endpoint),
  );
}

export function hasLlm(): boolean {
  return activeEndpoints().length > 0;
}

function messageText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const text = (part as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .join("")
    .trim();
}

function cooldownFor(status?: number): number {
  if (status === 401 || status === 403 || status === 404) return 10 * 60_000;
  if (status === 429) return 60_000;
  if (status && status >= 500) return 60_000;
  if (status && status >= 400) return 60_000;
  return 30_000;
}

function recordSuccess(id: string, latencyMs: number): void {
  const prev = health.get(id);
  const avg = prev?.avgLatencyMs
    ? prev.avgLatencyMs * 0.7 + latencyMs * 0.3
    : latencyMs;
  health.set(id, {
    attempts: (prev?.attempts ?? 0) + 1,
    failures: 0,
    cooldownUntil: 0,
    avgLatencyMs: Math.round(avg),
  });
}

function recordFailure(id: string, status?: number): void {
  const prev = health.get(id);
  health.set(id, {
    attempts: (prev?.attempts ?? 0) + 1,
    failures: (prev?.failures ?? 0) + 1,
    cooldownUntil: Date.now() + cooldownFor(status),
    avgLatencyMs: prev?.avgLatencyMs ?? 0,
  });
}

function scheduleOrder(): LlmEndpoint[] {
  const now = Date.now();
  const rows = activeEndpoints().map((endpoint, index) => ({
    endpoint,
    index,
    h: health.get(endpoint.id),
  }));
  const byHealth = (
    a: (typeof rows)[number],
    b: (typeof rows)[number],
  ): number => {
    const aNew = !a.h || a.h.attempts === 0;
    const bNew = !b.h || b.h.attempts === 0;
    if (aNew !== bNew) return aNew ? -1 : 1;
    const aFail = a.h?.failures ?? 0;
    const bFail = b.h?.failures ?? 0;
    if (aFail !== bFail) return aFail - bFail;
    const aLatency = a.h?.avgLatencyMs ?? 0;
    const bLatency = b.h?.avgLatencyMs ?? 0;
    if (aLatency !== bLatency) return aLatency - bLatency;
    return a.index - b.index;
  };
  const available = rows.filter((row) => !row.h || row.h.cooldownUntil <= now);
  const cooling = rows.filter((row) => row.h && row.h.cooldownUntil > now);
  available.sort(byHealth);
  cooling.sort((a, b) => {
    const cooldown = (a.h?.cooldownUntil ?? 0) - (b.h?.cooldownUntil ?? 0);
    return cooldown || byHealth(a, b);
  });
  return [...available, ...cooling].map((row) => row.endpoint);
}

interface AttemptResult {
  ok: boolean;
  text?: string;
  status?: number;
  latencyMs: number;
  error?: string;
}

async function requestEndpoint(
  endpoint: LlmEndpoint,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<AttemptResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(1, timeoutMs));
  const started = Date.now();
  try {
    const res = await fetch(`${endpoint.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${endpoint.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        latencyMs,
        error: `HTTP ${res.status}`,
      };
    }
    const data = (await res.json().catch(() => null)) as {
      choices?: { message?: { content?: unknown } }[];
    } | null;
    const text = messageText(data?.choices?.[0]?.message?.content);
    if (!text) {
      return { ok: false, latencyMs, error: "空响应" };
    }
    return { ok: true, text, latencyMs };
  } catch (e) {
    const name = (e as { name?: string } | null)?.name;
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: name === "AbortError" ? "超时" : "网络错误",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function requestWithFailover(
  buildBody: (model: string) => Record<string, unknown>,
  totalMs: number,
  attemptMs: number,
): Promise<string | null> {
  const endpoints = scheduleOrder();
  if (!endpoints.length) return null;
  const deadline = Date.now() + totalMs;
  for (let index = 0; index < endpoints.length; index += 1) {
    const endpoint = endpoints[index];
    const remaining = deadline - Date.now();
    if (remaining <= 500) break;
    const share = Math.max(
      3000,
      Math.floor(remaining / (endpoints.length - index)),
    );
    const result = await requestEndpoint(
      endpoint,
      buildBody(endpoint.model),
      Math.min(attemptMs, remaining, share),
    );
    if (result.ok && result.text) {
      recordSuccess(endpoint.id, result.latencyMs);
      return result.text;
    }
    recordFailure(endpoint.id, result.status);
  }
  return null;
}

export async function chatLLM(
  system: string,
  user: string,
  opts: { timeoutMs?: number } = {},
): Promise<string | null> {
  if (!hasLlm()) return null;
  return requestWithFailover(
    (model) => ({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      max_tokens: 800,
    }),
    opts.timeoutMs ?? TEXT_TOTAL_MS,
    TEXT_ATTEMPT_MS,
  );
}

export async function chatLLMVision(
  system: string,
  user: string,
  images: string[],
  opts: { timeoutMs?: number; maxTokens?: number } = {},
): Promise<string | null> {
  if (!images.length || !hasLlm()) return null;
  return requestWithFailover(
    (model) => ({
      model,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: user },
            ...images.map((url) => ({
              type: "image_url",
              image_url: { url },
            })),
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: opts.maxTokens ?? 3000,
    }),
    opts.timeoutMs ?? VISION_TOTAL_MS,
    VISION_ATTEMPT_MS,
  );
}

export async function testLlmEndpoints(): Promise<LlmTestReport> {
  const endpoints = getLlmConfig().endpoints.filter(isLlmEndpointComplete);
  if (!endpoints.length) {
    return {
      ok: false,
      msg: "请先填写至少一个完整接口（Base URL、Key、模型）",
      results: [],
    };
  }
  const results = await Promise.all(
    endpoints.map(async (endpoint): Promise<LlmProbe> => {
      const result = await requestEndpoint(
        endpoint,
        {
          model: endpoint.model,
          messages: [
            { role: "system", content: "你是连通性测试助手。" },
            { role: "user", content: "只回复 ok" },
          ],
          temperature: 0,
          max_tokens: 8,
        },
        PROBE_TIMEOUT_MS,
      );
      if (result.ok) recordSuccess(endpoint.id, result.latencyMs);
      else recordFailure(endpoint.id, result.status);
      return {
        id: endpoint.id,
        name: endpoint.name,
        ok: result.ok,
        latencyMs: result.latencyMs,
        msg: result.ok
          ? `可用 · ${(result.latencyMs / 1000).toFixed(1)}s`
          : result.error || "请求失败",
      };
    }),
  );
  const okCount = results.filter((result) => result.ok).length;
  return {
    ok: okCount > 0,
    msg:
      okCount === results.length
        ? `${okCount} 个接口均可用`
        : `${okCount}/${results.length} 个接口可用`,
    results,
  };
}

export async function testLlm(): Promise<{ ok: boolean; msg: string }> {
  const report = await testLlmEndpoints();
  return { ok: report.ok, msg: report.msg };
}
