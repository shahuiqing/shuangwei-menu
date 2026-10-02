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

## 登录

- 默认密码 `123456`（或环境变量 `VITE_OWNER_PASSWORD`）
- 登录后可在「系统设置」里修改密码，密码存本机浏览器，不依赖数据库

## 注意事项

- 老板端**只读**订单/报表；只有「员工管理」「系统设置」会写 `settings`
- 数据与顾客端共用同一个 Supabase 库；顾客端代码不受任何影响
