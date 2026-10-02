-- =============================================================
-- 增量迁移：orders 的 anon 更新/删除 RLS 策略（P0 修复）
-- 用途：修复前端改单/删单/清空在云端不持久化的问题。
-- 特点：幂等、仅动策略，不删列、不改密码、不动数据，可安全重复执行。
--
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴本文件 → Run
-- 回滚方式：执行文件末尾「回滚」段的两条 DROP POLICY。
-- =============================================================

-- ⚠️ 安全提示：将 orders 的 UPDATE/DELETE 放开给 anon 是
--    「纯静态前端 + Supabase 直连」架构下的妥协，任何持有 anon key 的客户端
--    都能改/删订单，仅适用于内部/低风险场景。
--    更安全方案：订单写操作改由后端（service_role）边缘函数执行，前端只读。

DROP POLICY IF EXISTS "anon_update_orders" ON public.orders;
CREATE POLICY "anon_update_orders" ON public.orders
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_orders" ON public.orders;
CREATE POLICY "anon_delete_orders" ON public.orders
  FOR DELETE USING (true);

-- 校验：应返回 anon_update_orders / anon_delete_orders 两行
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'orders'
ORDER BY policyname;

-- =============================================================
-- 回滚（需要时取消注释执行，恢复到「anon 不能改/删订单」）
-- =============================================================
-- DROP POLICY IF EXISTS "anon_update_orders" ON public.orders;
-- DROP POLICY IF EXISTS "anon_delete_orders" ON public.orders;
