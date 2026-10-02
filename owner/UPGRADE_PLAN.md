# 老板管理端升级方案

> 范围：**P0 实时 + 性能** 与 **P2 运营能力**
> 原则：与顾客端代码完全隔离；能复用现有 Supabase 表/策略就不新增；所有改动可回滚。

---

## 1. 目标

| 优先级 | 目标                         | 成功标准                                                     |
| ------ | ---------------------------- | ------------------------------------------------------------ |
| P0     | 数据「实时」且不为数据量拖垮 | 新订单 2s 内出现在看板；首屏只拉必要数据，不再无条件加载全量 |
| P0     | 稳定性与可维护性             | 类型化、错误边界、骨架屏、无重复工具函数                     |
| P2     | 老板可做运营动作             | 可流转订单状态、可售罄/改库存、可看库存/BOM 预警             |

## 2. 现状事实（已核对源码）

- 入口 `owner/src/App.tsx:24` 每次 `fetchOrders(limit=3000)` 全量拉取，`60s` 轮询（`App.tsx:40`）。
- 数据层 `owner/src/lib/data.ts:8`：`orders.select("*")` 无时间过滤、无分页。
- 登录：`owner/src/lib/auth.ts` 明文存 `localStorage`，默认 `123456`，纯前端比对。
- 状态与库存：顾客端 `src/types/order.ts:1` 定义 `pending|cooking|served|completed|cancelled`；菜品有 `stock` / `isSoldOut`（`src/types/menu.ts:19`）。
- Realtime：顾客端已在频道 `restaurant-sync` 订阅 `public.orders` 与 `public.settings`（`src/api.ts:445`、`src/api.ts:396`），并广播 `orders_changed` / `settings_changed`。
- 数据库：
  - `orders` 已加入 `supabase_realtime` publication，且 anon 可 `SELECT/INSERT/UPDATE/DELETE`（`supabase_schema.sql:194`、`supabase_setup.sql:32`）。
  - `settings` anon 可读写（`supabase_setup.sql:16`）。
  - **BOM/库存四表已存在**（`supabase_schema.sql:61-110`），但 RLS 仅 `authenticated` 可访问（`supabase_schema.sql:201-205`），老板端 anon 读不到。

## 3. 关键约束

1. **老板端没有 Supabase Auth**：全部用 anon key。任何要读 BOM/库存的动作，要么加 anon RLS 策略（沿用既有「内部/低风险」妥协），要么走后端 `service_role`。
2. **不许改顾客端**：实时/广播事件名（`orders_changed`、`settings_changed`）必须与顾客端约定一致。
3. **`settings.categories` 是全量 JSONB**：并发整表写会互相覆盖，改单个菜品库存要谨慎。
4. **无 orders 索引**：`orders.created_at` 无索引，服务端时间区间查询前需补索引。

---

## 4. P0 设计

### P0-1 实时同步（替代 60s 轮询）

新增 `owner/src/lib/realtime.ts`：

- 建立独立频道 `owner-sync`（**不复用** `restaurant-sync`，避免与顾客端监听互相干扰）。
- 订阅 `postgres_changes`：
  - `public.orders`，`event: "*"` → 增量增删改。
  - `public.settings`，`filter: id=eq.global` → 设置/菜单变更。
- 订阅 `broadcast`：`orders_changed`、`settings_changed`（与顾客端同名，跨端兜底）。
- 断线重连：监听 channel 状态，`CLOSED/CHANNEL_ERROR/TIMED_OUT` 时销毁并按退避重建（参考 `src/api.ts:635`）。
- 兜底轮询：保留一个 **5 分钟** 的慢轮询，只在实时连接断开时改为 60s。

增量合并工具 `mergeOrder(list, payload)`：按 `id || _id` 去重，INSERT 置顶、UPDATE 替换、DELETE 移除。

> 验收：顾客端下单后，老板端「实时订单流」≤2s 出现新单且无需刷新；断网恢复后自动补齐。

### P0-2 数据加载与性能

**阶段 A（不做数据库改动，先落地）**

- 首屏加载只取 **近 30 天**：`fetchOrders` 增加 `since` 参数，`.gte("created_at", iso)` + `.limit(2000)`。
- 字段裁剪：只 `select` 看板需要的列，禁用 `select("*")`。
- 订单页服务端分页：`fetchOrdersPage({from,to,status,range})` 用 `.range(offset, offset+49)`，筛选/排序下推到 SQL；列表搜索关键词仍在当前页内过滤（或按需升级为 `.ilike`）。
- 报表/菜单分析：时间区间也下推 `.gte/.lte`，不再全量内存过滤。
- 引入 `rangeToIso(range)` 统一把 `today|7d|30d|all|custom` 转成 ISO。

**阶段 B（可选，数据量再大时）**

新增 SQL（`supabase_owner_perf.sql`，幂等）：

```sql
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);

CREATE OR REPLACE FUNCTION public.owner_sales_summary(p_start timestamptz, p_end timestamptz)
RETURNS TABLE (revenue numeric, orders bigint, items bigint)
LANGUAGE sql STABLE AS $$
  SELECT
    COALESCE(SUM(total),0),
    COUNT(*) FILTER (WHERE status <> 'cancelled'),
    COALESCE(SUM((SELECT SUM((i->>'quantity')::numeric) FROM jsonb_array_elements(items) i)),0)
  FROM public.orders
  WHERE created_at >= p_start AND created_at < p_end AND status <> 'cancelled';
$$;
```

KPI 改调 `rpc("owner_sales_summary", ...)`，不再把明细拉到前端求和。

### P0-3 稳定性与可维护性

- 新增 `owner/src/types.ts`：`Order` / `OrderItem` / `AppSettings` / `MenuCategory` / `MenuItem`（从根 `src/types` 复制精简版，owner 保持独立，不跨包引用）。
- 用 zod 校验 `orders` 行（owner 已无 zod 依赖 → 需在 `owner/package.json` 增加 `zod`）。
- 新增 `owner/src/components/ErrorBoundary.tsx`，包住每个 view，单页崩溃不影响导航。
- 加载中统一用已定义的 `Skeleton`（`ui.tsx:100`，目前未被使用）。
- 删除 `format.ts:35` 与 `analytics.ts:14` 重复的 `tableName`，统一到 `analytics`。

---

## 5. P2 设计

### P2-1 订单状态流转

- 在订单详情抽屉增加状态按钮：`制作中 / 已上菜 / 已结账 / 取消`，只显示合法的下一步。
- 状态机：

```
pending -> cooking -> served -> completed
   \---------- cancelled ----------/
```

- 写入：`.from("orders").update({ status }).eq("id", id)`（anon 已有 UPDATE 权限）。
- 乐观更新本地 state，失败回滚并 toast。
- 成功后向 `owner-sync` 广播 `orders_changed { orderId, status }`，让顾客端/后厨即时看到。
- 关键操作（取消/结账）二次确认。

### P2-2 菜品售罄 / 库存（复用 `settings.categories[].items[].stock|isSoldOut`）

- 新增「菜品管理」页：列出分类下菜品，可切换 `isSoldOut`、编辑 `stock`（空 = 不限）。
- 写回两种方案：
  - **推荐**：新增 RPC `owner_set_dish(p_name text, p_stock numeric, p_sold_out boolean)`，用 `jsonb_set` 精确改，避免整表覆盖。
  - 兜底：读最新 `settings.categories` → 定位并补丁 → 整数组回写，随后广播 `settings_changed`。
- 售罄/低库存看板：库存 ≤ 阈值（含 `safety_stock` 概念）高亮。

### P2-3 库存 / BOM 看板（表已存在，缺访问权限）

> 依赖：需二选一开放权限（见 §7 决策点）。

- 新增 SQL `supabase_owner_inventory_rls.sql`（与既有妥协口径一致）：
  - `inventory_items` / `recipe_boms` / `purchase_orders` / `inventory_transactions` 增加 anon SELECT（写权限可只给老板操作的表）。
- 新增 view `Inventory.tsx`：原料库存列表、低于 `safety_stock` 预警、最近流水（`inventory_transactions`）。
- 新增 view `Bom.tsx`：菜品 ↔ 原料配方（`recipe_boms.menu_item_name` + `dosage`），点击菜品反查耗材。
- 说明：**下单自动扣库存**属于顾客端/后端职责，不在老板端范围；本方案只做「查看 + 手工调整」。

### P2-4 导出增强

- 现有 CSV 保留；新增「按当前筛选导出订单明细（含菜品行）」。
- 可选：报表导出 PDF（引 `jspdf`，或先提供打印样式页）。

---

## 6. 数据层与文件改动清单

新增：

```
owner/src/lib/realtime.ts        # owner-sync 频道 + 增量合并 + 重连
owner/src/lib/orders.ts          # fetchOrders(Page)/updateOrderStatus/订阅
owner/src/lib/settings.ts        # 菜品库存/售罄读写
owner/src/lib/inventory.ts       # 库存/BOM 查询（P2-3）
owner/src/types.ts               # 类型定义
owner/src/range.ts               # rangeToIso
owner/src/components/ErrorBoundary.tsx
owner/src/views/Inventory.tsx    # P2-3
owner/src/views/Bom.tsx          # P2-3
owner/src/views/Dishes.tsx       # P2-2
supabase_owner_perf.sql          # 索引 + KPI RPC（阶段 B）
supabase_owner_inventory_rls.sql # 库存表 anon 策略（P2-3）
```

修改：

```
owner/src/App.tsx                # 用 realtime 替代轮询，接错误边界
owner/src/lib/data.ts            # 分页/时间过滤/字段裁剪
owner/src/lib/auth.ts            # 见 §8（安全项，另行评估）
owner/src/components/Layout.tsx  # 新增菜单项
owner/src/views/Orders.tsx       # 状态流转、服务端分页
owner/src/views/Dashboard.tsx    # 接实时增量
owner/src/package.json           # + zod / + jspdf(可选)
```

---

## 7. 里程碑与验收

| #   | 任务                                     | 依赖   | 验收                                      |
| --- | ---------------------------------------- | ------ | ----------------------------------------- |
| M1  | realtime.ts + App 增量接入，轮询降为兜底 | 无     | 新单 ≤2s 上屏；断网恢复补全               |
| M2  | Orders 服务端分页 + 区间下推             | 无     | 首屏请求 ≤30 天/≤2000 行；翻页按需        |
| M3  | 类型化 + ErrorBoundary + 骨架 + 去重     | M1/M2  | `npm run build`（tsc）通过，无 `any` 新增 |
| M4  | 订单状态流转 + 广播                      | M1     | 老板改状态，顾客端实时同步；失败回滚      |
| M5  | 菜品售罄/库存                            | M1     | 改动回流 `settings`，顾客端实时生效       |
| M6  | 库存/BOM 看板                            | M6-SQL | 权限放开后可见预警与配方                  |
| M7  | 阶段 B：索引 + KPI RPC                   | —      | 大时间区间 KPI 查询无卡顿                 |

验收命令（在 `owner/` 下）：

```bash
npm run build      # tsc --noEmit && vite build
npm run preview
```

建议同时给 owner 增加 Vitest，覆盖 `analytics.ts` 纯函数（KPI/区间/菜单工程）。

---

## 8. 风险与回滚

| 风险                                 | 影响       | 对策                                            |
| ------------------------------------ | ---------- | ----------------------------------------------- |
| 实时 channel 与顾客端同名事件冲突    | 重复刷新   | owner 用独立频道名 `owner-sync`，仅复用事件名   |
| `settings.categories` 并发整表写覆盖 | 丢菜单改动 | 优先 RPC/jsonb_set；兜底写前重读                |
| anon 开放库存表                      | 安全面扩大 | 与现有妥协一致；如需更强隔离改后端 service_role |
| 服务端分页改变现有行为               | 老用户困惑 | 保留筛选 UI，默认仍「近 30 天」                 |
| 无 orders 索引时区间查询慢           | 首屏变慢   | 先执行 `supabase_owner_perf.sql` 索引           |

回滚：所有 SQL 均为幂等 `IF NOT EXISTS` / `DROP POLICY IF EXISTS`；前端改动按里程碑独立提交，可单独 revert。

---

## 9. 待确认决策点

1. **登录安全**（本次未列入，建议紧随 P0）：是否把老板端密码改为 `settings.adminPasswordHash` + `/api/auth/verify`（bcrypt），去掉明文 localStorage？——涉及「共享管理员密码」还是「独立老板密码」。
2. **库存表权限**：anon 直连（上线快、安全妥协）还是 service_role 边缘函数（更安全、工作量大）？
3. **KPI 聚合**：是否接受新增 SQL RPC（阶段 B），还是先只做阶段 A？
4. **是否新增 owner 独立 CI**（当前 `.github/workflows/ci.yml` 不覆盖 owner）。

---

## 10. 采购 / 库存 / 成本 / 消耗 模块（重点新增）

> 需求：① 采购管理；② 订单结账后自动扣库存；③ 每种食材/耗材的消耗；④ 成本与利润；⑤ 后厨用料情况。

### 10.1 关键架构决策：扣减放哪里？

结账动作发生在**顾客端**（`src/components/AdminPanel.tsx:1746` → `api.updateOrder(id,{status:"completed"})`），老板端可能并未打开。因此：

| 方案                              | 是否可行 | 说明                                                                                               |
| --------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| A. 数据库触发器（**推荐**）       | ✅       | `orders.status→completed` 时由 Postgres 执行 BOM 扣减，与任何客户端无关，天然覆盖顾客端/老板端结账 |
| B. 老板端前端监听 realtime 后扣减 | ❌       | 老板端没打开就不扣；重复扣；有竞态                                                                 |
| C. 改顾客端结账逻辑               | ❌       | 违反「不改顾客端」原则                                                                             |

**采用方案 A**：新增 `SECURITY DEFINER` 触发器函数，绕过 RLS 直接操作库存；同时对同一订单 `reference` 做幂等保护。

### 10.2 数据模型（复用现有表，最小新增）

| 表                              | 用途                                                                     | 现状                |
| ------------------------------- | ------------------------------------------------------------------------ | ------------------- |
| `inventory_items`               | 原料/耗材档案：名称、分类、现存量、单位、安全库存、单价(成本)            | 已存在，RLS 锁 anon |
| `recipe_boms`                   | 菜品↔原料配方：`menu_item_name` + `inventory_item_id` + `dosage`         | 已存在，RLS 锁 anon |
| `purchase_orders`               | 采购单：供应商、数量、单价、总成本、时间                                 | 已存在，RLS 锁 anon |
| `inventory_transactions`        | 库存流水：`purchase_in`/`order_out`/`adjustment`/`waste`，含 `unit_cost` | 已存在，RLS 锁 anon |
| `settings.categories[].items[]` | 菜品售价（`price` 字符串需解析）、售罄/库存                              | 已存在，anon 可读写 |

新增（可选，按需）：

```sql
-- 后厨档口维度（用于「后厨用料」按档口统计），可空
ALTER TABLE public.recipe_boms ADD COLUMN IF NOT EXISTS station VARCHAR(50) DEFAULT '';
-- 库存索引
CREATE INDEX IF NOT EXISTS idx_inv_txn_created ON public.inventory_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_txn_item ON public.inventory_transactions (item_id, type);
CREATE INDEX IF NOT EXISTS idx_inv_txn_ref ON public.inventory_transactions (reference);
CREATE INDEX IF NOT EXISTS idx_bom_name ON public.recipe_boms (menu_item_name);
```

**符号约定**：`inventory_transactions.quantity` 有符号 —— 入库为正（`purchase_in`），出库为负（`order_out`）；`stock` 变更一律 `stock = stock + delta`。

### 10.3 结账自动扣减（核心 SQL）

```sql
CREATE OR REPLACE FUNCTION public.apply_order_bom()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it jsonb; v_name text; v_qty numeric; b record; v_deduct numeric;
BEGIN
  -- 首次进入 completed：按配方出库
  IF NEW.status = 'completed' AND COALESCE(OLD.status,'') <> 'completed' THEN
    IF EXISTS (SELECT 1 FROM inventory_transactions
               WHERE reference = NEW.id AND type = 'order_out') THEN
      RETURN NEW;                          -- 幂等
    END IF;
    FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.items,'[]'::jsonb)) LOOP
      v_name := it->>'name';
      v_qty  := COALESCE((it->>'quantity')::numeric, 0);
      CONTINUE WHEN v_name IS NULL OR v_qty = 0;
      FOR b IN
        SELECT rb.inventory_item_id AS id, rb.dosage, rb.unit, ii.name AS inv_name, ii.price
        FROM recipe_boms rb JOIN inventory_items ii ON ii.id = rb.inventory_item_id
        WHERE rb.menu_item_name = v_name
      LOOP
        v_deduct := COALESCE(b.dosage,0) * v_qty;
        UPDATE inventory_items SET stock = stock - v_deduct, updated_at = now() WHERE id = b.id;
        INSERT INTO inventory_transactions
          (id,item_id,item_name,type,quantity,unit,unit_cost,reference,notes,created_at)
        VALUES ('TXN-'||NEW.id||'-'||b.id, b.id, b.inv_name, 'order_out',
                -v_deduct, b.unit, b.price, NEW.id, v_name, now());
      END LOOP;
    END LOOP;
  END IF;

  -- 已结账后被取消：回补（写入反向流水 + 加回库存）
  IF NEW.status = 'cancelled' AND OLD.status = 'completed' THEN
    INSERT INTO inventory_transactions
      (id,item_id,item_name,type,quantity,unit,unit_cost,reference,notes,created_at)
    SELECT 'REV-'||NEW.id||'-'||t.item_id, t.item_id, t.item_name, 'adjustment',
           -t.quantity, t.unit, t.unit_cost, NEW.id, '结账后取消回补', now()
    FROM inventory_transactions t WHERE t.reference = NEW.id AND t.type = 'order_out';
    UPDATE inventory_items ii SET stock = ii.stock - x.qty, updated_at = now()
    FROM (SELECT item_id, SUM(quantity) qty FROM inventory_transactions
          WHERE reference = NEW.id AND type='order_out' GROUP BY item_id) x
    WHERE ii.id = x.item_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_order_bom ON public.orders;
CREATE TRIGGER trg_order_bom AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.apply_order_bom();
```

要点：

- 以 `reference = order.id` 幂等，重复结账不会重复扣。
- `unit_cost` 快照当时 `inventory_items.price`，保证历史成本准确。
- 未配置配方的菜品：不扣、记 `unknown` 待补（另可在 `Consumption` 页提示「未配配方菜品」）。

### 10.4 RLS 放开（老板端 anon 访问）

新增 `supabase_owner_inventory_rls.sql`（与 `settings`/`orders` 既有妥协口径一致）：

```sql
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['inventory_items','recipe_boms','purchase_orders','inventory_transactions'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_all_%1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "anon_all_%1$s" ON public.%1$s FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
```

> 更安全的替代：老板端写操作走 `service_role` 边缘函数（工作量大）。触发器本身 `SECURITY DEFINER`，不受此策略影响。

### 10.5 成本与利润模型

- **菜品成本** `dishCost(name) = Σ (recipe_boms.dosage × inventory_items.price)`。
- **订单 COGS**（历史口径）：`Σ inventory_transactions WHERE type='order_out' AND reference=orderId (quantity × unit_cost)`，或实时口径 `Σ 菜品成本 × 数量`。
- **营收**：优先 `orders.finalTotal`（结账写入），回退 `total`。
- **毛利** = 营收 − COGS；**毛利率** = 毛利 / 营收。
- 现有「菜单工程矩阵」由「销量×营收」升级为「销量×毛利」，四象限变成真实盈利分析（明星/金牛/问题/瘦狗更准）。

报表：

- 成本毛利总览：营收 / COGS / 毛利 / 毛利率 + 日趋势 + 环比。
- 按菜品毛利排行；按分类毛利；低毛利预警。
- 采购支出趋势（`purchase_orders`）与实际销售成本对比。

### 10.6 采购管理

流程：建采购单 → 入库。

- 选择供应商、原料、数量、单价 → 写入 `purchase_orders`（`total_cost = quantity × unit_price`）。
- 同步 `inventory_items.stock += quantity`、写入 `inventory_transactions(type='purchase_in', unit_cost=unit_price)`。
- 页面：采购记录列表/筛选/导出、供应商汇总、月度采购支出、单品价格趋势、一键「补货建议」（低于 `safety_stock`）。

### 10.7 消耗 / 后厨用料

- 按原料：区间内 `order_out` 汇总数量/金额，含「其他东西」（`inventory_items.category != 食材` 的耗材）。
- 按时间：日消耗趋势。
- 按菜品：各菜品消耗的原料明细（`reference`/`notes` 关联）。
- 损耗：`waste` 类型单独统计。
- 后厨档口：若启用 `recipe_boms.station`，按档口/灶台汇总用料。
- 库存预警：`stock <= safety_stock` 列表 + 库存金额（`stock × price`）。

### 10.8 老板端新增页面与数据层

```
owner/src/views/Procurement.tsx    # 采购管理
owner/src/views/Inventory.tsx      # 库存总览 / 盘点调整
owner/src/views/Recipe.tsx         # 配方 BOM 与菜品成本
owner/src/views/CostReport.tsx     # 成本与毛利
owner/src/views/Consumption.tsx    # 食材/耗材消耗 · 后厨用料
owner/src/lib/inventory.ts         # 库存 CRUD + 流水
owner/src/lib/procurement.ts       # 采购单
owner/src/lib/bom.ts               # 配方
owner/src/lib/cost.ts              # 成本/毛利计算
```

`Layout.tsx` 导航新增：`采购`、`库存`、`配方`、`成本`、`消耗`（可归入「经营」分组）。

### 10.9 里程碑

| #   | 任务                                               | 依赖  | 验收                                                             |
| --- | -------------------------------------------------- | ----- | ---------------------------------------------------------------- |
| C0  | `supabase_inventory_bom.sql`：索引 + 触发器 + 回补 | —     | 顾客端结账后 `inventory_transactions` 出现 `order_out`，库存减少 |
| C1  | RLS 放开脚本                                       | C0    | 老板端 anon 能读写四表                                           |
| C2  | 采购管理页                                         | C1    | 建采购单 → 库存增加 + `purchase_in` 流水                         |
| C3  | 库存 + 配方页                                      | C1    | 维护原料/配方/安全库存                                           |
| C4  | 成本毛利页                                         | C1/C3 | 营收−COGS=毛利，口径可追溯                                       |
| C5  | 消耗/后厨用料页                                    | C0    | 按原料/菜品/时间/耗材统计消耗                                    |
| C6  | 菜单工程并入成本                                   | C4    | 四象限按毛利重算                                                 |

### 10.10 本模块决策（已于评审确认）

> ✅ 触发器扣减 · 单价快照 · anon 直连 · 菜品名匹配。以下为已确认口径，作为实现依据：

1. **自动扣减口径**：确认「结账(completed)才扣」；是否也要在 `served` 时预扣？（默认只在结账扣）
2. **成本价来源**：`inventory_items.price` 直接作为单价，还是按采购单做**移动加权平均**？（默认先用单价快照）
3. **配方匹配键**：用菜品名（`menu_item_name`）匹配 `order.items[].name`；是否需同时支持按 `menu_item_id`（更稳，但要顾客端写入 id）？（默认按名）
4. **「其他东西」**：用 `inventory_items.category` 区分「食材 / 耗材 / 包装」即可吗？
5. **后厨档口**：是否需要 `recipe_boms.station` 档口维度，还是只按原料/菜品统计？
6. **未配配方菜品**：是否允许其成本记为 0 并在报表标红提示？
7. **库存表 RLS**：anon 直连（快）还是 service_role 边缘函数（安全）？

---

## 11. 免费额度优化（已实现）

### 11.1 额度约束（Supabase Free，2026 官方）

| 项目     | 额度                                    | 对本项目的影响                     |
| -------- | --------------------------------------- | ---------------------------------- |
| 数据库   | 500 MB                                  | 订单/流水长期增长需清理            |
| Egress   | 5 GB/月（+5GB cached）                  | **头号风险**：全量拉订单会迅速耗尽 |
| Storage  | 1 GB                                    | 菜单图片                           |
| Realtime | 200 万条/月、峰值 200 连接              | 订阅消息成本                       |
| 其它     | 闲置 7 天暂停；**免费层不支持图片转换** | 不要用 `?width=` 变换              |

### 11.2 问题与对策

| 问题         | 原状                                               | 对策                                                  |
| ------------ | -------------------------------------------------- | ----------------------------------------------------- |
| 全量拉订单   | `fetchOrders(limit=3000).select("*")` 每 60s       | 各页改走 **Postgres 聚合 RPC**，只回传几十行          |
| 拉全量流水   | 消耗页 `fetchTransactions(5000)`                   | 改 `owner_consumption*` 聚合 RPC                      |
| 轮询过密     | 60s 固定                                           | 5 分钟兜底 + 页面隐藏暂停                             |
| 订单列表全量 | 前端内存过滤                                       | **服务端分页** `range + count + ilike`                |
| 结账字段丢失 | orders 缺列，`finalTotal/paymentMethod` 被静默丢弃 | 补列，营收/支付口径恢复准确                           |
| DB 增长      | 无监控                                             | `owner_table_stats` 用量面板 + `owner_prune` 手动清理 |

> 效果：仪表盘/报表每次刷新从「数 MB」降到「数 KB」，egress 数量级下降。

### 11.3 新增 SQL：`supabase_owner_quota.sql`

- `orders` 补列：`paymentMethod / discountAmount / receivedAmount / finalTotal / completedAt` + `created_at` 索引。
- 聚合函数：`owner_sales_summary`、`owner_daily`、`owner_dish_stats`、`owner_hourly`、`owner_consumption(_dish/_daily)`、`owner_daily_profit`。
- 运维：`owner_table_stats`（用量）、`owner_prune(orders_days, txns_days)`（清理）。

### 11.4 新增/改动代码

- 新增 `owner/src/lib/aggregate.ts`：RPC 封装 + `rangeToIso`（含上一周期）。
- `App.tsx`：只拉近况 30 单 + 设置，5 分钟轮询、隐藏暂停。
- `Dashboard / Reports / MenuAnalysis / CostReport / Consumption` 全部改走 RPC。
- `Orders` 服务端分页（每页 50，搜索/筛选/排序下推，导出上限 1000）。
- `Settings` 增加数据库用量面板与清理入口。

### 11.5 部署顺序（全部幂等）

1. `supabase_schema.sql` → 2. `supabase_setup.sql` → 3. `supabase_inventory_bom.sql` → 4. `supabase_inventory_bom_v2.sql`（**对账式修复，必执行**）→ 5. `supabase_owner_inventory_rls.sql` → 6. `supabase_owner_quota.sql`

> ⚠️ v2 修复：顾客端「加菜/合并」只追加 `orders.items` 不改 status，v1 触发器（`AFTER UPDATE OF status` + 按订单幂等）会**漏扣已结账订单的加菜**。v2 改为 `INSERT OR UPDATE` + 独立函数 `deduct_order_bom(order_id, items)` 对账式补差，兼容加菜/改单/合并/取消。见 §13。

---

## 12. 实时同步 + 订单状态流转 + 错误边界（已实现）

### 12.1 Realtime

- 新增 `owner/src/lib/realtime.ts`：独立频道 `owner-sync`，只订阅 `public.orders`、`public.settings` 的 `postgres_changes`；断线 3s 退避重建。
- `App.tsx`：
  - 订单事件实时合并进「近况列表」（INSERT 置顶 / UPDATE 替换 / DELETE 移除），无需重新拉取；
  - 设置变更即时重载；
  - 实时事件触发聚合刷新，但**20s 防抖合并**，避免每单一次 RPC（兼顾免费额度）；
  - 保留 5 分钟兜底轮询 + 页面隐藏暂停；顶栏显示「实时同步中 / 更新于 …」。
- 成本：每单 Realtime 消息约 1–2KB，远低于 5GB egress 与 200 万条/月上限。

### 12.2 订单状态流转（老板端可操作）

- `aggregate.ts` 新增 `NEXT_STATUS` 状态机与 `updateOrderStatus`：
  `pending → cooking → served → completed`，`pending/cooking/served → cancelled`。
- `Orders.tsx` 详情抽屉新增「推进订单状态」按钮，取消/结账二次确认，失败回滚，成功后本地即时更新。
- 状态写入 DB 后，顾客端 `postgres_changes(orders)` 自动感知，无需额外广播。
- ⚠️ 老板端把订单改为 `completed` 会触发 `apply_order_bom` 扣库存（与顾客端结账一致）。

### 12.3 健壮性

- 新增 `components/ErrorBoundary.tsx`，按 tab 包裹（`key={tab}`），单页崩溃不影响导航，可「重试」。
- 各页接入 `version` 依赖：实时聚合刷新与手动刷新统一触发。

### 12.4 仍待完善

- 列表虚拟滚动（数据极大时）。

---

## 17. 登录安全升级（bcrypt 后端校验，已实现）

### 17.1 问题

老板端密码明文存 `localStorage`、默认 `123456`、纯前端比对，任何人清缓存即失守。

### 17.2 方案

- **独立密码**：新增 `settings.ownerPasswordHash`（bcrypt），与顾客端 `adminPasswordHash` 分离（见 `supabase_owner_auth.sql`，初始密码 `123456`）。
- **后端校验**：
  - 本地：`server/routes/auth.ts` 新增 `POST /api/auth/verify-owner`（rate limit 10/min，防爆破）与 `POST /api/auth/set-owner-password`（需 `ADMIN_SECRET`）。
  - 生产边缘：`functions/api/auth/verify-owner.ts`（EdgeOne Pages Function，同路径）。
- **前端**：`owner/src/lib/auth.ts`
  - `verifyOwnerPassword` 改为 async：优先请求 `/api/auth/verify-owner`，**后端不可达时回退本地哈希**（离线/纯本地可用）；
  - 本机只保存**会话令牌** `ownerAuthedUntil`（3 天），不再保存明文密码；
  - 本地降级改密用 `setOwnerPasswordLocal`（bcrypt 哈希）。
- `Login.tsx` 支持 async + 「验证中…」；`Settings.tsx` 改密提示「本机降级，云端请用 set-owner-password」。

### 17.3 部署

1. 执行 `supabase_owner_auth.sql`（写入初始哈希）。
2. 确保 EdgeOne Pages 配置 `SUPABASE_SERVICE_ROLE_KEY` 或 `VITE_SUPABASE_*`（验密需读 settings）。
3. 首次登录后立即在「设置」改密（或用 `POST /api/auth/set-owner-password` 写云端哈希）。

---

## 18. 缺陷修复轮（自审）

| #   | 问题                                                           | 影响                              | 修复                                                                                   |
| --- | -------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | `owner` 未声明 `bcryptjs` 依赖，仅靠根 `node_modules` 构建通过 | **owner 独立 CI `npm ci` 必失败** | `owner/package.json` + lock 增加 `bcryptjs@^3.0.3`；`npm install` 落地                 |
| 2   | `auth.ts` 在模块加载时 `bcrypt.hashSync`（cost 10）            | 首屏阻塞几十毫秒                  | 改惰性 `getDefaultHash()` 记忆化                                                       |
| 3   | BOM 事务 ID `LEFT(...,100)` 截断 md5                           | 订单 ID 较长时主键碰撞、扣减错乱  | v2 SQL 改为 `'TXN-'                                                                    |     | md5(order | item | dish)`（36 字符，唯一） |
| 4   | 采购入库 3 次独立写库                                          | 中途失败 → 采购单/库存/流水不一致 | 新增原子 RPC `owner_create_purchase`，前端改调 RPC                                     |
| 5   | 未执行聚合 SQL 时页面静默空白                                  | 用户无从排查                      | `aggregate.ts` 检测 `PGRST202`/函数缺失，App 弹提示「请执行 supabase_owner_quota.sql」 |
| 6   | owner README 登录/脚本说明过期                                 | 部署困惑                          | 更新登录说明与 7 步 SQL 顺序                                                           |

验证：owner `npm run build` 通过、`npm test` 18/18；根项目 `npm run lint`（tsc + eslint）通过。

---

## 16. 采购 ↔ 库存/成本联动（已实现）

- **补货建议**：`restockSuggestions` 按安全库存缺口生成建议（数量、预估金额，按金额降序），采购页顶部展示，一键「补货」预填采购单。
- **成本影响预览**：采购弹窗内根据 `recipe_boms.dosage` 实时预览「本次采购价变动」对相关菜品成本的影响（+/- 金额），避免拍脑袋定价。
- 纯函数 `costImpactForPriceChange` 抽到 `lib/inventory.ts`，新增 `inventory.test.ts` 覆盖（补货建议、库存金额、成本影响、边界）。
- 测试总数 18 项，全过。

---

## 15. 菜单工程矩阵升级为成本/毛利口径（已实现）

- 原矩阵「销量 × 单价 × 营收」→ 现支持 **按毛利 / 按营收** 一键切换：
  - 按毛利：横轴销量、纵轴单位毛利、气泡毛利额；
  - 按营收：横轴销量、纵轴单价、气泡营收。
- 四象限（明星/金牛/问题/瘦狗）按「销量均值 × 单位贡献均值」自动分类，统一走纯函数 `buildMenuPoints`（`lib/cost.ts`，可测）。
- 未配配方菜品在按毛利口径下高亮提示，并给出「去配方 BOM 补全」引导。
- 新增 `menuPoints.test.ts` 覆盖四象限分类、口径切换、零销量过滤。测试 13 项全过。

---

## 14. 测试与 CI（已实现）

- owner 引入 Vitest（`vitest.config.ts`，node 环境，`src/**/*.test.ts`）。
- 单测覆盖关键纯逻辑：
  - `cost.test.ts`：多原料成本累加、未知配方按 0、毛利/毛利率、未配配方标记、总成本汇总。
  - `aggregate.test.ts`：`rangeToIso` 环比区间等长紧邻、`all` 起点、自定义区间本地日界；状态机 `NEXT_STATUS`。
- `owner/package.json`：`npm test` = `vitest run --passWithNoTests`。
- `owner/tsconfig.json` 排除测试文件，构建（`tsc --noEmit`）不受影响。
- 新增 `.github/workflows/owner-ci.yml`：仅当 `owner/**` 或相关 SQL 变更时触发，执行 `npm ci` → `npm run build` → `npm test`。

---

## 13. BOM 扣减 v2（对账式，修复加菜漏扣）

### 13.1 缺陷

顾客端加菜/合并把菜品追加进 `orders.items`，**status 不变**（`src/api.ts:1250`、`OrderBoard.tsx:143,166`）。v1 触发器 `AFTER UPDATE OF status` + 按订单幂等 → 已结账订单加菜**永不扣库存**。

### 13.2 方案（`supabase_inventory_bom_v2.sql`）

- 抽出纯函数 `deduct_order_bom(p_order_id, p_items)`：
  - 以「应扣量 vs 已扣量」对账，只把差额写回库存；
  - 重写该订单的 `order_out` 明细（按 原料×菜品 维度，保留按菜品消耗统计）。
- 触发器 `AFTER INSERT OR UPDATE ON orders`，仅在：
  - 进入 `completed` 且 `items` 变化（首次结账 / 加菜改单），或
  - 从 `completed` 离开（作废，传空 items 全额回补）
    时调用。
- 特性：幂等、兼容加菜/改单/合并/取消回补/重复结账；同订单行锁天然串行。
- 附历史回填（幂等，默认注释）：`SELECT deduct_order_bom(id, items) FROM orders WHERE status='completed';`

### 13.3 影响

- 无需改顾客端；老板端「成本毛利/用料消耗」自动反映加菜。
