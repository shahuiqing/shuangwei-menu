-- =============================================================
-- Supabase 完整功能设置（在 supabase_schema.sql 执行后补充）
-- =============================================================

-- ─── 1. RLS 调整：允许 anon 读写 settings（浏览器端直连必需）───
-- 注意：adminPasswordHash 等敏感字段虽可读，但前端不渲染；如需更强隔离可改读视图

-- 允许匿名读取 settings（菜单/分类/外观等公开数据）
DROP POLICY IF EXISTS "anon_read_settings" ON public.settings;
CREATE POLICY "anon_read_settings" ON public.settings
  FOR SELECT USING (true);

-- 允许匿名写入 settings（后台保存菜单/外观/库存设置）
DROP POLICY IF EXISTS "anon_upsert_settings" ON public.settings;
CREATE POLICY "anon_upsert_settings" ON public.settings
  FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_upsert_settings_update" ON public.settings
  FOR UPDATE USING (true) WITH CHECK (true);

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
UPDATE public.settings SET
  "adminPassword" = '123',
  "adminPasswordHash" = '$2b$10$ogK6ffrwzpJQPwfdWc5dI.zwSvQ5hfwZavD.iaYQKwkguL23e.Hp6'
WHERE id = 'global';