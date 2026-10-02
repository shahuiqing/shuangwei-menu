-- =============================================================
-- Supabase 完整功能设置（在 supabase_schema.sql 执行后补充）
-- =============================================================

-- ─── 0. 补列：前端会写入 deletedItemIds（软删除菜品）───
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "deletedItemIds" JSONB DEFAULT '[]'::jsonb;

-- ─── 1. RLS 调整：允许 anon 读写 settings（浏览器端直连必需）───
-- ⚠️ 安全提示：以下策略会让任何持有 anon key 的客户端读取并改写 settings 全表，
--    包括 adminPasswordHash / devicePasswordsHash / securityAnswerHash 等哈希字段。
--    这是「纯静态前端 + Supabase 直连」架构下的妥协，仅适用于内部/低风险场景。
--    更安全方案：settings 写入改由后端（service_role）执行，前端只读 settings_public 视图。
-- 注意：敏感字段虽可被读取，但前端不渲染。

-- 允许匿名读取 settings（菜单/分类/外观等公开数据）
DROP POLICY IF EXISTS "anon_read_settings" ON public.settings;
CREATE POLICY "anon_read_settings" ON public.settings
  FOR SELECT USING (true);

-- 允许匿名写入 settings（后台保存菜单/外观等设置）
DROP POLICY IF EXISTS "anon_upsert_settings" ON public.settings;
CREATE POLICY "anon_upsert_settings" ON public.settings
  FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_upsert_settings_update" ON public.settings
  FOR UPDATE USING (true) WITH CHECK (true);

-- ─── 1.5. RLS 调整：允许 anon 更新/删除 orders（后厨改单/删单直连必需）───
-- ⚠️ 安全提示：同 settings，UPDATE/DELETE 放开给 anon 是「纯静态前端 + Supabase 直连」
--    架构下的妥协，任何持有 anon key 的客户端都能改/删订单，仅适用于内部/低风险场景。
--    更安全方案：订单写操作改由后端（service_role）执行，前端只读。
--    未加此策略时，前端改单/删单会被 RLS 静默过滤（0 行命中且不报错），导致云端状态不更新。
DROP POLICY IF EXISTS "anon_update_orders" ON public.orders;
CREATE POLICY "anon_update_orders" ON public.orders
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_orders" ON public.orders;
CREATE POLICY "anon_delete_orders" ON public.orders
  FOR DELETE USING (true);

-- ─── 2. Storage 存储桶：menu-assets（图片上传/展示）───
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('menu-assets', 'menu-assets', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880;

-- 允许匿名读取存储桶中的文件（顾客浏览菜品图）
DROP POLICY IF EXISTS "anon_select_menu_assets" ON storage.objects;
CREATE POLICY "anon_select_menu_assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'menu-assets');

-- 允许匿名上传/删除（管理员上传菜品图/背景图）
DROP POLICY IF EXISTS "anon_insert_menu_assets" ON storage.objects;
CREATE POLICY "anon_insert_menu_assets" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'menu-assets');

DROP POLICY IF EXISTS "anon_delete_menu_assets" ON storage.objects;
CREATE POLICY "anon_delete_menu_assets" ON storage.objects
  FOR DELETE USING (bucket_id = 'menu-assets');

-- ─── 3. Realtime 确认（supabase_schema.sql 已含，再执行确保）───
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recipe_boms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;

-- ─── 4. Realtime 广播频道已在客户端代码中创建（restaurant-sync），无需额外配置 ───
--     Supabase 免费层默认支持 broadcast 功能，无需改动

-- ─── 5. Image Transformations 缩略图（可选，免费层支持） ───
--     在 Supabase Dashboard → Storage → Settings → Image Transformations
--     开启 "Enable image transformations"（免费层有 500k 图像/月配额）
--     然后在代码中已实现 ?width=&quality=80 参数

-- ─── 6. 更新管理员密码哈希（初始密码 123） ───
-- 注意：明文列 "adminPassword" 已在 supabase_schema.sql 中删除，此处只写哈希，避免报 column does not exist
UPDATE public.settings SET
  "adminPasswordHash" = '$2b$10$ogK6ffrwzpJQPwfdWc5dI.zwSvQ5hfwZavD.iaYQKwkguL23e.Hp6'
WHERE id = 'global';