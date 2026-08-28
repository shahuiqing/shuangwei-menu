import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { queryD1, isD1Configured } from '../services/d1';
import { supabase } from '../../src/supabase';

const router = Router();

// POST /api/auth/verify { password } -> { ok: boolean }
// 优先校验 Supabase settings.adminPasswordHash，其次 D1，再次明文兼容
router.post('/verify', async (req, res) => {
  const { password } = req.body as { password?: string };
  if (!password) return res.status(400).json({ ok: false, error: 'password required' });
  try {
    // 1) Supabase
    if (process.env.VITE_SUPABASE_URL) {
      try {
        const { data } = await (supabase as any).from('settings').select('adminPassword, adminPasswordHash').eq('id','global').maybeSingle();
        if (data) {
          const hash = data.adminPasswordHash || '';
          if (hash && hash.startsWith('$2')) {
            const ok = await bcrypt.compare(password, hash);
            return res.json({ ok });
          }
          if (data.adminPassword) {
            // 明文兼容期：比对后若成功，后台异步升级为 hash
            const ok = password === data.adminPassword;
            if (ok && !hash) {
              const newHash = await bcrypt.hash(password, 10);
              (supabase as any).from('settings').update({ adminPasswordHash: newHash }).eq('id','global').then(()=>{});
            }
            return res.json({ ok });
          }
        }
      } catch {}
    }
    // 2) D1 fallback
    if (isD1Configured()) {
      try {
        const r = await queryD1('SELECT data FROM settings WHERE id=?', ['global']);
        const data = r.results?.[0]?.data ? JSON.parse(r.results[0].data) : null;
        if (data) {
          const hash = data.adminPasswordHash || '';
          if (hash.startsWith('$2')) {
            const ok = await bcrypt.compare(password, hash);
            return res.json({ ok });
          }
          if (data.adminPassword) return res.json({ ok: password === data.adminPassword });
        }
      } catch {}
    }
    // 3) 最后对比 ADMIN_SECRET（若设置）
    if (process.env.ADMIN_SECRET) return res.json({ ok: password === process.env.ADMIN_SECRET });
    return res.json({ ok: false });
  } catch (e:any) {
    console.error('[auth] verify error', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/auth/hash { password } -> { hash }  需 ADMIN_SECRET 鉴权，用于迁移
import { requireAdmin } from '../middleware/auth';
router.post('/hash', requireAdmin, async (req,res)=>{
  const { password } = req.body;
  if(!password) return res.status(400).json({error:'password required'});
  const hash = await bcrypt.hash(String(password), 10);
  res.json({ hash });
});

export default router;
