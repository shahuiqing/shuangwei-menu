-- =============================================================
-- 老板端登录：独立密码哈希（与顾客端管理员密码分离）
-- 适用：supabase_schema.sql / supabase_setup.sql 之后执行。
-- 幂等，可安全重复执行。
--
-- 背景：
--   老板端此前密码明文存浏览器 localStorage（默认 123456），安全性弱。
--   本方案改为：密码以 bcrypt 哈希存于 settings.ownerPasswordHash，
--   老板端通过后端 /api/auth/verify-owner（service_role / anon）验密，
--   浏览器只保存会话令牌（非密码）。
--
-- 说明：
--   · 该列不在 settings_public 视图内，anon 直读表也仅能拿到哈希、拿不到明文。
--   · 初始哈希对应密码 "123456"（bcrypt, cost 10），首次登录后应立即修改。
--   · 修改密码走 /api/auth/set-owner-password（需 ADMIN_SECRET）或老板端设置页（后端）。
--
-- 执行：Supabase Dashboard → SQL Editor → 粘贴 → Run
-- =============================================================

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS "ownerPasswordHash" TEXT DEFAULT '';

-- 初始密码 123456 的 bcrypt 哈希（bcryptjs，cost 10）
UPDATE public.settings
SET "ownerPasswordHash" = '$2b$10$HZU6z.ZHMcY46zBQM9R/kedujlwguLBtKzG4g8II9doyRQF5AOhP.'
WHERE id = 'global' AND COALESCE("ownerPasswordHash", '') = '';

-- ─── 校验 ───
SELECT id, LEFT("ownerPasswordHash", 7) AS hash_prefix
FROM public.settings WHERE id = 'global';

-- =============================================================
-- 回滚
-- =============================================================
-- ALTER TABLE public.settings DROP COLUMN IF EXISTS "ownerPasswordHash";
