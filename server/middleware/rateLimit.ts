import type { Request, Response, NextFunction } from "express";

interface Bucket {
  hits: number[];
  windowMs: number;
}

const map = new Map<string, Bucket>();

// 定期清理过期桶，避免内存无界增长（每个 key 用自身 windowMs 判断）
const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of map) {
    bucket.hits = bucket.hits.filter((t) => now - t < bucket.windowMs);
    if (bucket.hits.length === 0) map.delete(key);
  }
}

/**
 * 解析客户端 IP（防 x-forwarded-for 伪造 - FIX_PLAN #11）。
 *
 * 规则：
 * 1. 默认**只信任 `req.ip`**（即 TCP 对端地址）。此时任何客户端自带的
 *    `x-forwarded-for` 都被忽略，伪造无效。
 * 2. 仅当显式配置 `TRUST_PROXY=true`（表示部署在可信反代/边缘之后）时，
 *    才从 `x-forwarded-for` 取**最右侧**的地址 —— 最右侧由最近一跳可信代理
 *    追加，不可被客户端伪造；最左侧恰恰是客户端可以随意填写的部分。
 * 3. 都取不到时归入 `unknown` 共享桶（宁可误伤也不放开）。
 */
export function resolveClientIp(req: Request): string {
  const trustProxy =
    (process.env.TRUST_PROXY || "").trim().toLowerCase() === "true";

  const directIp = typeof req.ip === "string" ? req.ip.trim() : "";
  if (!trustProxy) return directIp || "unknown";

  // 优先边缘平台注入的不可伪造头
  const cf = (req.headers["cf-connecting-ip"] as string | undefined)?.trim();
  if (cf) return cf;

  const xff = req.headers["x-forwarded-for"];
  const raw = Array.isArray(xff) ? xff.join(",") : (xff as string | undefined);
  if (raw) {
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // 最右侧 = 最近一跳可信代理写入的地址
    const rightmost = parts[parts.length - 1];
    if (rightmost) return rightmost;
  }

  return directIp || "unknown";
}

export function rateLimit(windowMs: number, max: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${resolveClientIp(req)}:${req.path}`;
    const now = Date.now();
    sweep(now);
    const bucket = map.get(key) || { hits: [], windowMs };
    bucket.windowMs = windowMs;
    bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
    bucket.hits.push(now);
    map.set(key, bucket);
    if (bucket.hits.length > max)
      return res.status(429).json({ error: "Too many requests" });
    next();
  };
}

/** 仅供测试：清空限流桶 */
export function __resetRateLimitForTests() {
  map.clear();
  lastSweep = Date.now();
}
