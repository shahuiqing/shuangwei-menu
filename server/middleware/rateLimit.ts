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

export function rateLimit(windowMs: number, max: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip =
      req.ip || (req.headers["x-forwarded-for"] as string) || "unknown";
    const key = `${ip}:${req.path}`;
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
