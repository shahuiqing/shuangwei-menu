# 双味居 · 老板管理端（独立部署）

> 与顾客端**完全独立**：自己的文件、依赖、构建、部署。**不修改顾客端任何代码**，但复用同一套 Supabase 数据库。

## 功能

| 模块     | 说明                                                                       |
| -------- | -------------------------------------------------------------------------- |
| 经营看板 | 今日营收 / 订单数 / 客单价、近 7 日营收趋势、今日热销榜                    |
| 订单查询 | 只读；按 今天/近7天/全部 + 状态 + 关键字（桌号/单号/顾客）筛选，点开看明细 |
| 销售报表 | 菜品销售排行（销量、营收、占比）                                           |
| 员工管理 | 增删改服务员密码（同步到云端 settings，用于顾客端「服务员模式」）          |

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
    lib/      supabase / data / auth / format
    views/    Login / Dashboard / Orders / Reports / Staff
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
   - **输出目录**：`owner/dist`（相对仓库根）
3. 环境变量（EdgeOne 控制台）：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`VITE_OWNER_PASSWORD`、`VITE_STORE_NAME`

> 也可以直接把 `owner/dist` 传到任意静态托管（Vercel / Netlify / 对象存储 + CDN）。

## 登录

- 默认密码 `123456`（或环境变量 `VITE_OWNER_PASSWORD`）
- 登录后可在页面里「修改密码」，密码存本机浏览器，不依赖数据库

## 注意事项

- 老板端**只读**订单/报表；只有「员工管理」会写 `settings.devicePasswordsHash`
- 数据与顾客端共用同一个 Supabase 库；顾客端代码不受任何影响
