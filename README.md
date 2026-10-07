# 炙·双味居 · 数字菜单 / POS

> 高端炭烤 + 火锅双味，支持扫码点餐、多语言、实时同步、库存 BOM 自动扣减

## 架构

```
src/
  types/        强类型 + zod 校验 (menu/order/inventory)
  api_modules/  模块化 API (client/settings/orders/tables/inventory/storage/sync)
  stores/       zustand (menuStore/authStore)
  features/     按域拆 (menu/ orders/ inventory/ qrcode)
  components/   通用 UI (AdminPanel 逐步迁移中)
  services/     kvCache/blobStorage
  utils/        image/loc/audio
server/
  middleware/   auth / rateLimit
  services/     d1 / cartHub (持久化)
  routes/       orders
```

## 快速开始

```bash
cp .env.example .env
# 填 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / ADMIN_SECRET
npm install
npm run dev      # http://localhost:3000  (本地 dev：Express + Vite，/api/* 可用)
npm run build    # vite build → dist/（纯静态，供 EdgeOne Pages 部署）
npm run lint     # tsc --noEmit && eslint
npm run test     # vitest
```

## 部署（EdgeOne Pages + Supabase）

- **前端**：`npm run build` 产出 `dist/`，部署到 EdgeOne Pages 静态托管
- **边缘函数**：`functions/` 目录随项目部署，自动映射：
  - `functions/api/auth/verify.ts` → `POST /api/auth/verify`（读 `settings.adminPasswordHash` + bcrypt 验密）
  - `functions/api/edgeone-kv/*`、`functions/api/edgeone-blob/*` → KV/Blob 持久化
- **数据/登录**：全部走 Supabase（RLS 保护），前端匿名 key 直连；管理员密码哈希存 `settings.adminPasswordHash`
- **实时同步**：购物车/管理员通知走 Supabase Realtime broadcast（已替代原 WebSocket cartHub）
- **环境变量**（EdgeOne Pages 控制台配置）：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`（或 `VITE_SUPABASE_*`）、`ADMIN_SECRET`；可选 KV 绑定 `my_kv`
- **数据库初始化**：在 Supabase SQL Editor 按顺序执行三个脚本（均幂等）：`supabase_schema.sql`（建表 + 基础 RLS）→ `supabase_setup.sql`（anon 策略 / Storage 桶 / 初始密码哈希）→ `supabase_owner_all.sql`（老板端一键：库存 + BOM 触发器 + 聚合 RPC + 采购 + 上云/补录/导入）。顺序不可颠倒。
- ⚠️ **安全须知**：为支持纯静态前端直连，`supabase_setup.sql` 会放开 `settings` 表的匿名读写（含 `adminPasswordHash` 等哈希字段）。这是"纯静态前端 + Supabase 直连"架构下的妥协，仅适用于内部/低风险场景；如需更强隔离，应将 settings 写入改由后端（service_role）执行，前端只读 `settings_public` 视图。

## AI Studio

https://ai.studio/apps/98168766-f8af-4830-80dc-34427d528657
