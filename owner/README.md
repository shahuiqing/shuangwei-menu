# 双味居 · 老板管理端（独立部署）

> 与顾客端**完全独立**：自己的文件、依赖、构建、部署。**不修改顾客端任何代码**，但复用同一套 Supabase 数据库。

## 功能

| 模块     | 说明                                                                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------- |
| 经营看板 | KPI（营收/订单/客单价/销量）+ **环比上一周期**、近 30 天营收趋势、分类营收占比、时段订单分布、热销榜、实时订单流 |
| 订单管理 | 多条件筛选（时间段/状态/关键字）、排序、分页、**导出 CSV**、详情抽屉、打印小票                                   |
| 销售报表 | 按 菜品 / 分类 / 时段 三个维度，支持时间区间、导出                                                               |
| 菜单分析 | **菜单工程四象限**（明星/金牛/问题/瘦狗）+ 销量 × 单价散点矩阵                                                   |
| 员工管理 | 增删改服务员密码，同步云端                                                                                       |
| 系统设置 | 店铺名称（同步云端）、老板端登录密码、数据状态                                                                   |

- 现代化布局：桌面侧边栏 + 顶栏，移动端底部导航；60 秒自动刷新；Toast 通知
- 独立登录：默认密码 `123456`（可改，存本机，不依赖数据库）
- 与顾客端**共用同一个 Supabase 库**，数据互通

## 目录

```
owner/
  index.html
  package.json
  vite.config.ts
  tsconfig.json
  .env.example
  src/
    main.tsx / App.tsx / index.css
    components/  Layout · Toast · ui(KpiCard/ChartCard…)
    lib/         supabase · data · auth · format · analytics · print-lite
    views/       Login · Dashboard · Orders · Reports · MenuAnalysis · Staff · Settings
```

## 本地开发

```bash
cd owner
cp .env.example .env      # 填入与顾客端相同的 Supabase 配置
npm install
npm run dev               # http://localhost:5173
```

`.env` 变量：

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxx
VITE_OWNER_PASSWORD=123456   # 老板端登录密码（存本机，可在页面里改）
VITE_STORE_NAME=炙·双味居
```

## 构建

```bash
cd owner
npm run build             # 产出 owner/dist
```

## 单独部署（EdgeOne Pages 新建一个项目）

1. 在 EdgeOne Pages **新建第二个项目**，指向同一个仓库
2. 配置：
   - **根目录**：`owner`
   - **构建命令**：`npm install && npm run build`
   - **输出目录**：`owner/dist`（相对仓库根；若平台按根目录解析，填 `dist`）
3. 环境变量（EdgeOne 控制台）：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`VITE_OWNER_PASSWORD`、`VITE_STORE_NAME`

> 也可以直接把 `owner/dist` 传到任意静态托管（Vercel / Netlify / 对象存储 + CDN）。

## 登录（bcrypt 后端校验）

- 密码以 **bcrypt 哈希**存于 `settings.ownerPasswordHash`，与顾客端管理员密码**分离**（执行 `supabase_owner_auth.sql`，初始密码 `123456`）。
- 登录时调用后端 `POST /api/auth/verify-owner`（本地 Express 与 EdgeOne Pages Function 同路径，带限流防爆破）。
- 本机只保存**会话令牌**（3 天），不再保存明文密码；后端不可达时回退本机哈希（离线可用）。
- 首次登录后请立即在「系统设置」修改密码；云端改密用 `POST /api/auth/set-owner-password`（需 `ADMIN_SECRET`）。
- 环境变量 `VITE_OWNER_PASSWORD` 仅作为**离线初始密码**回退，生产建议配合后端哈希使用。

## 数据库脚本

**推荐：一次性执行 `supabase_owner_all.sql`**（仓库根目录）

- 在 Supabase Dashboard → SQL Editor 粘贴整个文件运行即可；
- 幂等、可重复执行，自动创建：库存相关表、`orders` 结账字段、RLS 策略、采购原子 RPC、BOM 扣减触发器、全部 `owner_*` 聚合函数，并刷新 PostgREST 缓存；
- 执行后若页面仍提示缺函数，再跑一次 `NOTIFY pgrst, 'reload schema';`。

如需分步（均幂等）：

1. `supabase_schema.sql` → 2. `supabase_setup.sql` → 3. `supabase_inventory_bom.sql` → 4. `supabase_inventory_bom_v2.sql`（对账式扣减，**必执行**）→ 5. `supabase_owner_inventory_rls.sql` → 6. `supabase_owner_quota.sql` → 7. `supabase_owner_auth.sql`

## 注意事项

- 老板端对订单**只读现状**改为可**推进状态**（待接单→制作中→已上菜→结账/取消）；「员工管理」「系统设置」写 `settings`，采购/库存/配方写对应表。
- 数据与顾客端共用同一个 Supabase 库；顾客端代码不受任何影响。
- 免费额度友好：报表走服务端聚合 RPC、订单服务端分页、实时事件聚合防抖、5 分钟兜底轮询。
