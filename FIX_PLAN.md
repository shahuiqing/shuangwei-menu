# 修复计划（FIX PLAN）

> 生成日期：2026-10-03
> 状态：待执行（收集问题，后续统一修复）
> 说明：本清单由项目体检产出，按优先级分组；每项标注位置、影响、修复方案与验证方式。

---

## 一、已修复（记录备查）

### 1. `dist` 目录产物堆积

- 现象：根 `dist/`（299 文件/51.4MB）与 `owner/dist/`（153 文件/42.5MB）持续堆积历史 hash 产物。
- 根因：Node `fs.rmSync` 在中文路径 `C:\Users\沙\...` 下静默失败，Vite `emptyOutDir` 失效。
- 修复：新增 `scripts/clean-dist.mjs` / `owner/scripts/clean-dist.mjs`（用 `unlinkSync`+`rmdirSync` 递归清理），并挂到两个 app 的 `build` 脚本前。已提交 `4629a8c`。
- 状态：已完成。

---

## 二、安全类（P1，优先处理）

### 2. 默认管理员密码硬编码且两处不一致（根）

- 位置：`src/api.ts:806`、`src/App.tsx:509`、`src/App.tsx:577`、`src/components/AdminPanel.tsx:119`（`admin123`）；`src/utils/adminAuth.ts:11`（`DEFAULT_PASSWORD = "123456"`，本地鉴权 `verifyAdminPassword` 无 hash 时用它）。
- 影响：两套默认密码不一致（`admin123` 用于 UI/settings，`123456` 用于本地 fallback），首次使用易困惑；且均为广泛知晓的弱默认密码，存在未授权登录风险。
- 修复方案：统一移除硬编码默认值，首次运行强制引导设置密码（无密码时阻止进入后台）；至少收敛为单一「无默认值」策略。
- 验证：`npm run test`（`adminAuth.test.ts` 已有「停止接受默认密码」用例，确认不回归）。

### 3. 老板端默认密码硬编码 `123456`（owner）

- 位置：`owner/src/lib/auth.ts:11-12`（`VITE_OWNER_PASSWORD || "123456"`，首次访问惰性写入本地 hash）。
- 影响：未配置即被广泛知晓的弱默认密码。注：owner 端已存 bcrypt hash（优于根项目明文），但默认值本身仍是风险。
- 修复方案：移除 `123456` 兜底，未配置时首次登录强制设置密码。
- 验证：`owner` 目录 `npm test` + 干净环境首登流程。

### 4. 密码以明文存入 localStorage（根）

- 位置：`src/components/AdminPanel.tsx:620`（`menuAdminPassword` 明文）、`AdminPanel.tsx:605-608` / `CartMenu.tsx:239-249`（`deviceAuthToken` 明文匹配）、`src/App.tsx:420-424`、`src/utils/adminAuth.ts:14-24`（`adminHash` 迁移仅在「下次保存」时转 hash，未完全落地）。
- 影响：localStorage 可被 XSS / 物理访问读取，泄露管理员与服务员密码。
- 修复方案：完成 `adminHash`/`deviceHash` 迁移，存 hash、登录时比较 hash，移除明文读写；服务端验证优先走 Supabase `settings.adminPasswordHash`。
- 验证：`npm run lint`、`npm run test`，干净浏览器会话验证登录/设备解锁。

### 5. 忘记密码时明文回显管理员密码（根）

- 位置：`src/components/AdminPanel.tsx:585-597`（`handleVerifySecurity` 通过 `alert` 明文显示 `adminPassword`）。
- 影响：任何知道安全问题答案的人可看到明文密码；`alert` 可被截图/日志留存。
- 修复方案：改为「重置密码」流程（验证安全问题后引导设置新密码），而非回显旧密码；或一次性遮罩展示。
- 验证：手动走「忘记密码」流程确认不再明文弹出。

### 6. 边缘函数登录校验无频率限制（暴力破解）

- 位置：`functions/api/auth/verify.ts`、`functions/api/auth/verify-owner.ts`。
- 影响：与 Express 版（`server/routes/auth.ts` 有 `rateLimit(60_000, 10)`）不同，边缘函数版无任何限流，部署到 EdgeOne 后可被无限暴力破解。
- 修复方案：在边缘函数侧加入限流（基于 `x-forwarded-for`/`cf-connecting-ip` 的内存或平台级限流），或接入平台 WAF 速率限制。
- 验证：连续错误密码请求应被 429 拦截。

### 7. 默认打印 Worker URL 硬编码（数据外发）

- 位置：`server.ts:192-193`（`PRINT_WORKER_URL || "https://dayin.shahuiqing2024.workers.dev/"`）。
- 影响：未配置 `PRINT_WORKER_URL` 时，所有订单（含顾客信息）默认 POST 到该第三方地址，存在数据泄露风险。
- 修复方案：移除硬编码默认值；未配置时仅记录日志、不外发，或显式报错提示配置。
- 验证：未配置 `PRINT_WORKER_URL` 时观察订单不再外发。

### 8. Webhook 端点无 token 时完全开放

- 位置：`server.ts:232-243`（`/api/webhooks/orders`，仅当 `PRINT_WORKER_TOKEN` 或 `ADMIN_SECRET` 已配置才校验）。
- 影响：两者都未设置时端点对公网开放，任何人可注入订单。
- 修复方案：生产环境强制要求配置 token（fail-closed），未配置时返回 500/禁用端点。
- 验证：生产未配 token 时该端点应拒绝写入。

### 9. 菜单数据丢失风险：本地未同步修改被云端旧数据覆盖

- 位置：`src/api.ts:737-816`（`getSettings` 按「KV → Supabase → localStorage」读，云端命中即返回，不比对本地）；`src/api.ts:1799-1812`（写云端失败仅 localStorage 临时备份）；`src/App.tsx:492-531`（启动即用云端数据 `processSettingsData` 回写本地）。
- 现象：加菜时云端保存失败（额度/网络），新菜只在本机 localStorage；下次启动云端恢复后读到旧数据并覆盖本地，新菜「消失」。
- 影响：用户编辑（加菜/改价）在云端不可达时无可靠持久化，且无冲突检测，易造成数据丢失。
- 修复方案：
  1. 云端写失败时，写入「本地待同步队列」并标记脏数据，下次启动先尝试补同步再决定是否用云端覆盖。
  2. 加载时做本地/云端合并或时间戳比对，存在本地未同步改动时提示用户而非静默覆盖。
  3. 保存失败给出更醒目、可复用的提示（当前仅一次性 `alert`）。
- 验证：模拟云端 503 加菜 → 重启后本地新菜仍保留或明确提示冲突，不被静默覆盖。

### 10. 依赖安全漏洞（根项目，`npm audit` 5 项）

| 包                       | 级别     | 当前                                  | 修复目标 | 来源                                       |
| ------------------------ | -------- | ------------------------------------- | -------- | ------------------------------------------ |
| browserslist             | high     | 4.28.2                                | >4.28.6  | `@vitejs/plugin-react` / `autoprefixer`    |
| brace-expansion          | high     | lock 有漏洞（node_modules 已 5.0.12） | >5.0.11  | eslint → minimatch                         |
| undici                   | high     | lock 有漏洞（node_modules 已 7.30.0） | >7.29.0  | jsdom                                      |
| baseline-browser-mapping | moderate | 2.10.33                               | ≥2.11.0  | browserslist 子依赖                        |
| qs                       | moderate | 6.15.2                                | >6.15.3  | express → body-parser（未启用 urlencoded） |

- 影响：多为构建/工具链传递依赖，运行时风险低；`qs` 因未启用 `urlencoded` 实际不在代码路径。
- 修复方案：`npm audit fix`（不带 `--force`）；若 `qs` 被精确锁定，用 `overrides` 指定 `qs@^6.15.4`。
- 验证：`npm run typecheck && npm run lint && npm run test && npm run build`。

---

## 三、安全加固类（P2）

### 11. 限流可被 `x-forwarded-for` 伪造绕过

- 位置：`server/middleware/rateLimit.ts:25`（`req.ip || x-forwarded-for`）。
- 影响：攻击者伪造 `x-forwarded-for` 头即可绕过 IP 限流（登录/下单/同步端点）。
- 修复方案：配置 `app.set("trust proxy", ...)` 取真实 IP，或用 `cf-connecting-ip`（边缘）；回退方案至少取 `x-forwarded-for` 最左侧可信值。
- 验证：伪造头请求应仍被限流。

---

## 四、构建/依赖类（P2）

### 12. 构建工具误置于 `dependencies`

- 位置：`package.json` 中 `vite`、`@vitejs/plugin-react`、`@tailwindcss/vite` 位于 `dependencies`，与 `tailwindcss`/`tsx`/`typescript` 在 `devDependencies` 不一致。
- 影响：生产安装拉入不必要构建工具，扩大 `npm audit` 暴露面。
- 修复方案：先确认 EdgeOne 部署是否 `--omit=dev`；若完整安装，将三者移至 `devDependencies`。
- 验证：本地 `npm run build` + 部署环境试构建。

### 13. SQL 文件冗余（11 个，含版本重复）

- 位置：根目录 `supabase_*.sql`（`supabase_inventory_bom.sql` vs `_v2.sql`、`supabase_full_setup.sql` vs `schema.sql`+`setup.sql` 重叠）。
- 影响：初始化顺序易混淆、重复执行可能冲突；README 仅明确 `schema`→`setup` 顺序，其余定位不清。
- 修复方案：为每个文件标注用途与执行顺序（README/文件头）；归档或删除过时版本。
- 验证：核对内容不冲突，保留脚本可在空库按序执行通过。

### 14. `zustand` 残留依赖（未使用）

- 位置：`package.json` 的 `dependencies` 含 `zustand`，但全项目无任何 `import ... from "zustand"`。
- 影响：README 曾描述 `src/stores/`（zustand）架构，实际目录已不存在，依赖沦为无用包。
- 修复方案：移除 `zustand` 依赖（`npm uninstall zustand`）。
- 验证：`npm run typecheck && npm run lint && npm run build`。

---

## 五、代码质量类（P3）

### 15. 大量 `any` 类型，削弱类型安全

- 位置：`src/api.ts`（100+ 处）、`src/App.tsx`、`src/initialData.ts`、`src/api_modules/orders.ts` 等（eslint 已关闭 `no-explicit-any`）。
- 影响：`strict`/`noUncheckedIndexedAccess` 被 `any` 绕过，易引入运行时类型错误；`(q as any).eq(...)` 等绕过 Supabase 类型。
- 修复方案：渐进式收敛——优先为订单/设置/库存等核心数据结构补类型，逐步替换 `any`；开启 `no-explicit-any` 为 warn。
- 验证：`npm run typecheck` 逐步收紧不报错。

---

## 六、维护/清理类（P3）

### 16. 根目录散落数据/日志文件

- 位置：`local-orders.json`、`cart-hub.json`、`metadata.json`、`dev-server.log`、`dev-server.out.log`、`dev-server.err.log`、`双味居.zip`。
- 影响：本地数据混入仓库目录，易误提交（部分已 `gitignore`）。
- 修复方案：确认需保留项（`metadata.json` 供 AI Studio），其余移入 `workspace/` 或删除；补充 `.gitignore`。
- 验证：`git status` 干净。

### 17. `eslint-disable` 注释（5 处）

- 位置：`src/App.tsx:616,1241,1477`、`src/components/CartMenu.tsx:154,244`。
- 影响：抑制 `react-hooks` 规则，存在隐藏依赖数组/副作用风险。
- 修复方案：逐处评估，能用正确依赖数组或重构消除的优先消除；确属必要的加注释说明。
- 验证：`npm run lint -- --max-warnings=0`。

### 18. README 架构描述与实际代码结构不一致

- 位置：`README.md` 描述 `src/stores/`（zustand）、`features/ (menu/ orders/ inventory/ qrcode)`，实际 `src/stores/` 不存在、`features/` 无 `inventory`、另有 `src/lib/` 未提及。
- 影响：误导新读者理解架构。
- 修复方案：更新 README 架构图以匹配当前目录。
- 验证：人工核对。

---

## 七、观察类（不立即处理）

### 19. owner 并行开发中的功能

- 位置：`owner/src/lib/offline.ts`（`useOnline`）、`owner/src/lib/purchasePlan.ts`（采购计划），及 `App.tsx`/`Layout.tsx`/`Procurement.tsx` 接入改动（进行中，未提交）。
- 影响：暂无，类型检查已通过。
- 后续：待功能完成提交后，补 `purchasePlan` 单测（当前 owner 尚无覆盖），并确认 `Procurement.tsx` 集成无回归。
- 验证：`owner` 目录 `npm test`、`npm run build`。

---

## 执行顺序建议

1. 安全类（第 2–10 项）：默认密码、明文存储/回显、数据丢失、边缘限流、打印外发、webhook 鉴权、依赖升级。
2. 安全加固（第 11 项）：限流防伪造。
3. 构建/依赖类（第 12–14 项）：依赖分类 + SQL 整理 + 移除残留依赖。
4. 代码质量（第 15 项）：`any` 收敛。
5. 维护类（第 16–18 项）：清理散落文件、lint 抑制、README 校准。
6. 观察类（第 19 项）：待并行开发收尾后验证。
