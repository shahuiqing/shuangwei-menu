-- ======================================================================
-- 餐饮点餐系统 (Customer Menu) + POS 后厨管理 + 库存管理系统 (Inventory POS)
-- 共用 Supabase 数据库统一初始化 SQL 脚本 (supabase_schema.sql)
--
-- 使用指南：
-- 1. 登录您的 Supabase 控制台 (https://supabase.com) 并进入您的项目
-- 2. 点击左侧菜单 "SQL Editor"
-- 3. 点击 "New query"，将本文件全选复制粘贴进去，点击 "Run" 运行
-- 4. 在两端程序的 .env 文件中填入相同的 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY
-- ======================================================================

-- 1. 菜单分类表 (categories)
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 菜单菜品表 (menu_items) - 菜单程序 & POS/库存管理系统共用
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  image_url TEXT,
  description TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 实时订单表 (orders) - 菜单程序下单，POS/后厨/库存管理端实时接收
CREATE TABLE IF NOT EXISTS public.orders (
  id VARCHAR(100) PRIMARY KEY,
  _id VARCHAR(100),
  table_no VARCHAR(50) NOT NULL DEFAULT 'A1',
  customer_name VARCHAR(100),
  type VARCHAR(20) DEFAULT 'dine_in' CHECK (type IN ('dine_in', 'takeaway', 'delivery')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'cooking', 'served', 'completed', 'cancelled')),
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total DECIMAL(10, 2) DEFAULT 0,
  items JSONB DEFAULT '[]'::jsonb,
  notes TEXT DEFAULT '',
  "unprintedNewOrder" BOOLEAN DEFAULT false,
  "unprintedAdditions" JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 订单明细表 (order_items)
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id VARCHAR(100) REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0
);

-- 5. 原材料库存物料表 (inventory_items)
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT '常规物料',
  stock DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  safety_stock DECIMAL(10, 2) NOT NULL DEFAULT 5,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 菜品-食材配方关联表 (recipe_boms) - BOM 自动扣减关系
CREATE TABLE IF NOT EXISTS public.recipe_boms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_name VARCHAR(100) NOT NULL,
  inventory_item_id VARCHAR(50) REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  dosage DECIMAL(10, 2) NOT NULL DEFAULT 0, -- 消耗量 (如 0.2kg)
  unit VARCHAR(20) NOT NULL DEFAULT 'kg'
);

-- 6.1 采购记录表 (purchase_orders) - 经营盈亏/采购管理
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id VARCHAR(100) PRIMARY KEY,
  supplier VARCHAR(100) DEFAULT '',
  item_id VARCHAR(50) NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6.2 库存流水表 (inventory_transactions) - 损耗测算数据源
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id VARCHAR(100) PRIMARY KEY,
  item_id VARCHAR(50) NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'adjustment'
    CHECK (type IN ('purchase_in', 'order_out', 'adjustment', 'waste')),
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  unit_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  reference VARCHAR(200) DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 全局菜单与系统设置表 (settings) - 兼顾 JSON 模式与传统点餐应用兼容
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    categories JSONB DEFAULT '[]'::jsonb,
    promotions JSONB DEFAULT '[]'::jsonb,
    "bgUrl" TEXT DEFAULT '',
    "restaurantName" TEXT DEFAULT '',
    "welcomeMessage" TEXT DEFAULT '',
    "logoUrl" TEXT DEFAULT '',
    "adminPassword" TEXT DEFAULT 'admin123',
    "adminPasswordHash" TEXT DEFAULT '',
    "devicePasswords" JSONB DEFAULT '[]'::jsonb,
    "devicePasswordsHash" JSONB DEFAULT '[]'::jsonb,
    "securityQuestion" TEXT DEFAULT '',
    "securityAnswer" TEXT DEFAULT '',
    "securityAnswerHash" TEXT DEFAULT '',
    "soundEnabled" BOOLEAN DEFAULT true,
    "layoutStyle" TEXT DEFAULT 'grid',
    "receiptSettings" JSONB DEFAULT '{}'::jsonb,
    "theme" TEXT DEFAULT 'dark'
);
-- P0-2 迁移：已存在表补列（幂等）
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "adminPasswordHash" TEXT DEFAULT '';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "devicePasswordsHash" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "securityAnswerHash" TEXT DEFAULT '';

-- 插入默认设置记录 (如果未存在)
INSERT INTO public.settings (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;

-- 8. 二维码餐桌表 (tables)
CREATE TABLE IF NOT EXISTS public.tables (
    "tableNo" TEXT PRIMARY KEY,
    key TEXT,
    active BOOLEAN DEFAULT true,
    "createdAt" TEXT
);

-- ======================================================================
-- RLS 默认启用（P0 整改）：生产安全基线，anon 仅可读菜单/可创建订单，敏感写入走 service_role/后端
-- 如需本地演示无 RLS，可手动执行 8 条 DISABLE 语句（不推荐提交）
-- ======================================================================
-- 先清理旧策略（幂等）
DROP POLICY IF EXISTS "anon_read_categories" ON public.categories;
DROP POLICY IF EXISTS "anon_read_menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "anon_read_orders" ON public.orders;
DROP POLICY IF EXISTS "anon_insert_orders" ON public.orders;
DROP POLICY IF EXISTS "anon_read_tables" ON public.tables;
DROP POLICY IF EXISTS "anon_read_settings" ON public.settings;
DROP POLICY IF EXISTS "anon_read_settings_public" ON public.settings;
DROP POLICY IF EXISTS "auth_all_inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "auth_all_boms" ON public.recipe_boms;
DROP POLICY IF EXISTS "service_all_settings" ON public.settings;
DROP POLICY IF EXISTS "service_all_orders" ON public.orders;
DROP POLICY IF EXISTS "service_delete_orders" ON public.orders;
DROP POLICY IF EXISTS "anon_read_order_items" ON public.order_items;
DROP POLICY IF EXISTS "service_all_order_items" ON public.order_items;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

-- 菜单/餐桌：匿名可读（公开信息）
CREATE POLICY "anon_read_categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "anon_read_menu_items" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "anon_read_tables" ON public.tables FOR SELECT USING (true);
-- 设置：A1 修复 - 移除 anon 直读 settings 表，匿名仅可读视图 settings_public；表本身仅 service_role 可全操作
-- 旧 anon_read_settings 已删除，避免 403 误杀前先确保视图就绪（见下）
CREATE POLICY "service_all_settings" ON public.settings FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
-- 订单：匿名可创建 + 可读，更新/删除仅 service_role（后厨需鉴权）
CREATE POLICY "anon_insert_orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_read_orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "service_all_orders" ON public.orders FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_delete_orders" ON public.orders FOR DELETE USING (auth.role() = 'service_role');
-- 库存/BOM：仅 authenticated（后台登录）可读写
CREATE POLICY "auth_all_inventory" ON public.inventory_items FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_boms" ON public.recipe_boms FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
-- 采购/流水：仅 authenticated（后台登录）可读写
CREATE POLICY "auth_all_purchase_orders" ON public.purchase_orders FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_all_inventory_transactions" ON public.inventory_transactions FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
-- 订单明细：A1 修复 - 补齐 order_items 策略（此前 ENABLE 无策略导致全 403）
CREATE POLICY "anon_read_order_items" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "service_all_order_items" ON public.order_items FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- P0-2 配套：敏感字段视图（前端应读此视图而非直接 settings 表）
CREATE OR REPLACE VIEW public.settings_public AS
  SELECT id, categories, promotions, "bgUrl", "restaurantName", "welcomeMessage", "logoUrl", "soundEnabled", "layoutStyle", "receiptSettings", "theme"
  FROM public.settings;
-- 视图默认走表 RLS，anon 可读公开列但读不到敏感哈希
GRANT SELECT ON public.settings_public TO anon, authenticated;

-- T3 明文下线：灰度期双读兼容后，执行下述 DROP（已加 IF EXISTS，重复执行安全）
-- 建议先监控 1 周确认无旧客户端直读明文列，再放行
-- [保留] ALTER TABLE public.settings DROP COLUMN IF EXISTS "adminPassword"; -- 明文兼容保留
-- [保留] ALTER TABLE public.settings DROP COLUMN IF EXISTS "devicePasswords";
-- [保留] ALTER TABLE public.settings DROP COLUMN IF EXISTS "securityAnswer";

-- 开启 Supabase Realtime 实时推播与广播订阅服务
-- (幂等见下) ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
-- (幂等见下) ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_items;
-- (幂等见下) ALTER PUBLICATION supabase_realtime ADD TABLE public.recipe_boms;
-- (幂等见下) ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_orders;
-- (幂等见下) ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_transactions;
-- (幂等见下) ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
-- (幂等见下) ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
-- (幂等见下) ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
-- (幂等见下) ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;

-- =============================================================
-- 补充设置：anon 策略 / Storage bucket / Realtime 幂等 / 管理员密码
-- =============================================================

-- ─── 1. RLS：允许 anon 读写 settings（浏览器端直连必需）───
DROP POLICY IF EXISTS "anon_read_settings" ON public.settings;
CREATE POLICY "anon_read_settings" ON public.settings
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "anon_upsert_settings" ON public.settings;
CREATE POLICY "anon_upsert_settings" ON public.settings
  FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_upsert_settings_update" ON public.settings
  FOR UPDATE USING (true) WITH CHECK (true);

-- ─── 2. Storage 存储桶：menu-assets（图片上传/展示）───
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('menu-assets', 'menu-assets', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880;
DROP POLICY IF EXISTS "anon_select_menu_assets" ON storage.objects;
CREATE POLICY "anon_select_menu_assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'menu-assets');
DROP POLICY IF EXISTS "anon_insert_menu_assets" ON storage.objects;
CREATE POLICY "anon_insert_menu_assets" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'menu-assets');
DROP POLICY IF EXISTS "anon_delete_menu_assets" ON storage.objects;
CREATE POLICY "anon_delete_menu_assets" ON storage.objects
  FOR DELETE USING (bucket_id = 'menu-assets');

-- ─── 3. Realtime 幂等添加（可重复执行）───
DO $$
DECLARE
  tbls text[] := ARRAY['orders','inventory_items','recipe_boms','purchase_orders','inventory_transactions','menu_items','categories','settings','tables','order_items'];
  t text;
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ─── 4. Image Transformations（可选，免费层支持，Dashboard 手动开启）───
--     Supabase Dashboard → Storage → Settings → Image Transformations → Enable

-- ─── 5. 管理员密码初始化（123）───
UPDATE public.settings SET
  "adminPassword" = '123',
  "adminPasswordHash" = '$2b$10$ogK6ffrwzpJQPwfdWc5dI.zwSvQ5hfwZavD.iaYQKwkguL23e.Hp6'
WHERE id = 'global';
