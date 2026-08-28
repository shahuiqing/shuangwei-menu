import type { Request, Response, NextFunction } from 'express';
const map = new Map<string, number[]>();
export function rateLimit(windowMs: number, max: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
    const key = `${ip}:${req.path}`;
    const now = Date.now();
    const hits = (map.get(key) || []).filter(t => now - t < windowMs);
    hits.push(now); map.set(key, hits);
    if (hits.length > max) return res.status(429).json({ error: 'Too many requests' });
    next();
  };
}
