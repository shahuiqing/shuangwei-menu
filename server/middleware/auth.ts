import type { Request, Response, NextFunction } from 'express';
import 'dotenv/config';

function getSecret(): string | undefined { return process.env.ADMIN_SECRET; }

const _startupSecret = getSecret();
if (!_startupSecret) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[Security] P0-6: ADMIN_SECRET missing in production - server will refuse sensitive ops. Set ADMIN_SECRET in .env');
  } else {
    console.warn('[Security] ADMIN_SECRET not set (dev mode) - protected routes will be open. Set it in .env for production parity.');
  }
}
export const ADMIN_SECRET = _startupSecret;
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const secret = getSecret();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') return res.status(500).json({ error: 'Server misconfigured: ADMIN_SECRET not set', code: 'E_CONFIG' });
    return next();
  }
  // P0-6 修复：禁止 query.token（易泄露至日志/Referer），仅允许 header / body
  // 兼容客户端现有字段：api.ts 受保护请求携带 body.adminPassword
  const token = (req.headers['x-admin-token'] as string) || (req.headers['authorization'] as string)?.replace(/^Bearer\s+/i,'') || (req.body as any)?.adminToken || (req.body as any)?.adminPassword;
  if (!token || token !== secret) return res.status(401).json({ error: 'Unauthorized: Invalid admin token', code: 'E_AUTH' });
  next();
}
