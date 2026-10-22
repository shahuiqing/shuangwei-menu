import { getStore } from "@edgeone/pages-blob";

export interface EdgeEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  ADMIN_SECRET?: string;
  [key: string]: any;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** 校验管理员 token：header x-admin-token / Authorization Bearer / body adminToken|adminPassword */
export function checkAdmin(request: Request, env: EdgeEnv): boolean {
  const secret = env.ADMIN_SECRET;
  // fail-closed：未配置 ADMIN_SECRET 时拒绝写入（与 Express requireAdmin 生产行为一致），
  // 避免边缘写接口在无密钥部署下对公网完全开放
  if (!secret) return false;
  const auth =
    request.headers.get("x-admin-token") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  if (auth && auth === secret) return true;
  return false;
}

/**
 * 取客户端 IP（用于限流）。
 * 优先边缘平台注入的不可伪造头 cf-connecting-ip；
 * 其次取 x-forwarded-for **最右侧**地址（最近一跳可信代理写入，客户端无法伪造）；
 * 都取不到时返回 unknown（共享桶，宁可误伤不放开）。
 */
export function clientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const rightmost = parts[parts.length - 1];
    if (rightmost) return rightmost;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

/**
 * 轻量内存限流器（FIX_PLAN #6：边缘鉴权端点此前完全无限流）。
 *
 * 说明：边缘函数实例可能被回收/多实例并存，内存桶只在单实例内精确；
 * 但足以把"无限暴力破解"降级为"有限次尝试"，且不引入 KV 读写的延迟与配额消耗。
 * 生产如需全局精确限流，可在 EdgeOne 控制台叠加 WAF 速率限制。
 */
const rateBuckets = new Map<string, number[]>();

/**
 * @returns true = 允许放行；false = 应返回 429
 */
export function allowRequest(
  request: Request,
  scope: string,
  windowMs: number,
  max: number,
): boolean {
  const now = Date.now();
  const key = `${scope}:${clientIp(request)}`;

  // 顺手清理过期桶，避免内存无界增长
  if (rateBuckets.size > 5000) {
    for (const [k, hits] of rateBuckets) {
      if (hits.every((t) => now - t >= windowMs)) rateBuckets.delete(k);
    }
  }

  const hits = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  rateBuckets.set(key, hits);
  return hits.length <= max;
}

/** 仅供测试：清空边缘限流桶 */
export function __resetEdgeRateLimitForTests() {
  rateBuckets.clear();
}

/** 统一的 429 响应 */
export function tooManyRequests(retryAfterSec = 60): Response {
  return new Response(
    JSON.stringify({ ok: false, error: "too many requests" }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
      },
    },
  );
}

/** EdgeOne KV：优先原生绑定 env.my_kv，回退 pages-blob store */
export async function kvWrite(
  env: EdgeEnv,
  key: string,
  value: unknown,
): Promise<string> {
  const nativeKv = env.my_kv;
  if (nativeKv && typeof nativeKv.put === "function") {
    await nativeKv.put(
      key,
      typeof value === "object" ? JSON.stringify(value) : String(value),
    );
    return "edgeone-native-kv";
  }
  const store = getStore("my-store");
  await store.set(
    key,
    typeof value === "object" ? JSON.stringify(value) : String(value),
  );
  return "pages-blob";
}

export async function kvRead(
  env: EdgeEnv,
  key: string,
  type: string,
): Promise<unknown> {
  const nativeKv = env.my_kv;
  if (nativeKv && typeof nativeKv.get === "function") {
    return nativeKv.get(key, type === "json" ? { type: "json" } : "text");
  }
  const store = getStore("my-store");
  const content = await store.get(key, { consistency: "strong" });
  if (type === "json" && typeof content === "string") {
    try {
      return JSON.parse(content);
    } catch {
      /* keep raw */
    }
  }
  return content ?? null;
}

export async function kvDeleteKey(env: EdgeEnv, key: string): Promise<void> {
  const nativeKv = env.my_kv;
  if (nativeKv && typeof nativeKv.delete === "function") {
    await nativeKv.delete(key);
    return;
  }
  const store = getStore("my-store");
  await store.delete(key);
}

export async function kvListKeys(
  env: EdgeEnv,
  prefix: string,
  limit: number,
  cursor: string,
): Promise<any> {
  const nativeKv = env.my_kv;
  if (nativeKv && typeof nativeKv.list === "function") {
    const res = await nativeKv.list({ prefix, limit, cursor });
    return { ...res, source: "edgeone-native-kv" };
  }
  const store = getStore("my-store");
  const { blobs } = await store.list({ prefix, limit });
  return {
    complete: true,
    cursor: null,
    keys: blobs.map((b) => ({ key: b.key })),
  };
}
