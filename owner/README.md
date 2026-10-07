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
- **经营小结**：看板自动生成一段可复制的区间小结（营收/环比/热销/风险），一键复制发群
- 采购与库存：**采购价异常检测**、**采购计划**（安全库存 + 近 30 天日均消耗 × 覆盖天数自动算缺口，可一键下单入库）、**供应商比价**、**库存盘点**（实盘 vs 账面一键调账，流水原因「盘点差异」）、报损登记与损耗率分析
- 消息通知：**新订单系统通知**（零后端，仅在应用打开时弹；「系统设置」里开关）
- **漏单提醒**：待接单/制作中超过阈值（默认 10/20 分钟，可改）→ 看板待办置顶标红、订单页标红、弹系统通知
- PWA：可安装到主屏幕、断网可打开缓存页；顶栏显示**离线提示**，恢复联网自动刷新
- **离线数据兜底**：库存/采购/订单/设置在请求成功时写本地快照，断网或请求失败自动回落上次数据并标注快照时间
- 独立登录：**无内置默认密码**（首次登录强制设置，≥6 位，存本机 bcrypt 哈希）
- **统一本地存储层** `lib/localdb.ts`：本机暂存数据（订单标记/任务/定额/换算/盘点/阈值…）统一走一个读写入口，带数据格式版本、变更事件（供将来增量同步）、「设置 → 数据导出」一键备份/还原
- **语音录入**：订单搜索 / 库存搜索 / AI 助手输入框旁的麦克风（Web Speech，浏览器支持才显示）
- **行业基准**：设置里选餐饮业态 → 看板食材成本率、损耗页损耗率自动对比行业参考区间
- **菜品多语言名称**：中/英/法/阿菜名映射（存本机，菜品列表管理），可导出 CSV 供之后同步顾客端
- **操作日志**：盘点/报损/采购/任务流转/定额/阈值/导入导出等关键动作记本机（上限 500 条，设置页可查可清）
- **盘点记录**：每次盘点落本机历史（实盘项/差异数/净差异，上限 60 次），库存页可回溯
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

- **无内置默认密码**：本机无哈希且未配 `VITE_OWNER_PASSWORD` 时，登录页进入「设置密码」模式（≥6 位，存本机 bcrypt 哈希）；之后每次登录用本机哈希校验，后端 `POST /api/auth/verify-owner` 可达时优先走后端（带限流防爆破）。
- 密码以 **bcrypt 哈希**存于本机（`ownerPasswordHash`），与顾客端管理员密码**分离**；云端哈希可用 `supabase_owner_all.sql` 初始化、`POST /api/auth/set-owner-password`（需 `ADMIN_SECRET`）修改，前端拿不到该密钥，因此**首次设密只写本机**。
- 本机只保存**会话令牌**（3 天），不保存明文密码；后端不可达时回退本机哈希（离线可用）。
- 「系统设置」里可随时改密（需先验当前密码）；环境变量 `VITE_OWNER_PASSWORD` 只在本机无哈希时作为离线初始密码惰性写入。

## 数据库脚本

**推荐：按顺序执行 3 个文件**（仓库根目录，均幂等可重复执行）

1. `supabase_schema.sql` — 顾客端基础表 + 基础 RLS（菜单 / 订单 / 库存 / settings）
2. `supabase_setup.sql` — 顾客端补充（settings/orders 的 anon 策略、Storage 桶、Realtime、管理员密码哈希）
3. `supabase_owner_all.sql` — 老板端一键：库存四表、`orders` 结账字段、RLS 策略、采购原子 RPC、BOM v2 扣减触发器、全部 `owner_*` 聚合函数、操作日志/盘点历史上云表、历史补录表、订单 CSV 导入 RPC，并刷新 PostgREST 缓存

- 均在 Supabase Dashboard → SQL Editor 粘贴运行；
- 执行后若页面仍提示缺函数，再跑一次 `NOTIFY pgrst, 'reload schema';`。

> 历史分步脚本已归档到 `sql-archive/`（含 `inventory_bom` v1/v2、`owner_quota`、`owner_auth`、`owner_inventory_rls`、`owner_waste`、`owner_cloudsync`、`owner_backfill`、`owner_import`、`migration_orders_rls`、`full_setup` 等），仅供排查历史用途参考，不再作为初始化入口。它们的内容均已并入上述 3 个文件。

## PWA（添加到主屏幕）

- 手机浏览器打开管理端 → 菜单选「**添加到主屏幕**」；Chrome/Edge 也会在「全部功能」面板里显示橙色「把 xx 装到主屏幕」按钮，桌面 Chrome 侧栏同样可装。
- 安装后为独立窗口（无地址栏）、图标即应用图标，**断网也能打开**外壳页，静态资源走 Service Worker 缓存（`public/sw.js`）。**每次构建自动盖新版本号**（`scripts/stamp-sw.mjs`），旧缓存与过期哈希文件在新版本激活时自动清理；检测到新版本接管后页面会提示「刷新加载最新界面」，代码分割出的懒加载页面同样走缓存、离线可开。
- 图标由 `npm run icons` 生成到 `public/icons/`（`scripts/gen-icons.mjs`，零依赖手写 PNG），改设计后重新执行即可。
- 相关文件：`public/manifest.webmanifest`、`public/sw.js`、`index.html`（manifest / apple meta）、`src/main.tsx`（注册，仅 PROD）；回归测试见 `src/lib/__tests__/pwa.test.ts`。
- 注意：Service Worker 与安装提示**仅在 HTTPS（或 localhost）生效**；本地用 `npm run build && npm run preview` 验证。

## 注意事项

- 老板端对订单**只读现状**改为可**推进状态**（待接单→制作中→已上菜→结账/取消）；「员工管理」「系统设置」写 `settings`，采购/库存/配方写对应表。
- 数据与顾客端共用同一个 Supabase 库；顾客端代码不受任何影响。
- 免费额度友好：报表走服务端聚合 RPC、订单服务端分页、实时事件聚合防抖、5 分钟兜底轮询。
