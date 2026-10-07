/* ============ 全链路溯源（纯函数 + 查询） ============
 * 正向：订单 → 菜品 → BOM 原料扣减（inventory_transactions reference=order.id）
 *       → 最近采购批次（purchase_orders 供应商/单价）
 * 反向：原料 → 消耗它的订单（order_out 流水）+ 采购入库历史
 * 口径：order_out 记负数，成本取 |quantity| × unit_cost。
 */
import { supabase } from "./supabase";
import {
  num,
  type InventoryTransaction,
  type InventoryItem,
} from "./inventory";

export interface PurchaseRow {
  id: string;
  supplier: string;
  item_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_cost: number;
  purchased_at: string;
  notes?: string;
}

/** 订单维度的溯源行（按 原料×菜品 聚合） */
export interface TraceRow {
  itemId: string;
  itemName: string;
  dish: string;
  qty: number; // 消耗量（正数）
  unit: string;
  unitCost: number;
  cost: number;
}

/** 订单 → 溯源明细（只取 order_out，按 原料×菜品 聚合去重） */
export function orderTraceRows(txns: InventoryTransaction[]): TraceRow[] {
  const map = new Map<string, TraceRow>();
  for (const t of txns) {
    if (t?.type !== "order_out") continue;
    const itemId = String(t.item_id || "");
    if (!itemId) continue;
    const dish = String(t.notes || "").trim() || "未标记菜品";
    const key = `${itemId}|${dish}`;
    const qty = Math.abs(num(t.quantity));
    const unitCost = num(t.unit_cost);
    const row = map.get(key);
    if (row) {
      row.qty += qty;
      row.cost = row.qty * row.unitCost;
    } else {
      map.set(key, {
        itemId,
        itemName: String(t.item_name || ""),
        dish,
        qty,
        unit: String(t.unit || ""),
        unitCost,
        cost: qty * unitCost,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.cost - a.cost);
}

/** 溯源合计 */
export function traceTotals(rows: TraceRow[]): {
  cost: number;
  qty: number;
  items: number;
} {
  const ids = new Set<string>();
  let cost = 0;
  let qty = 0;
  for (const r of rows) {
    cost += r.cost;
    qty += r.qty;
    ids.add(r.itemId);
  }
  return { cost, qty, items: ids.size };
}

/** 每个原料取最近一次采购（输入按 purchased_at 倒序或任意序） */
export function latestPurchases(list: PurchaseRow[]): Map<string, PurchaseRow> {
  const m = new Map<string, PurchaseRow>();
  const sorted = [...list].sort(
    (a, b) =>
      (Date.parse(String(b.purchased_at || "")) || 0) -
      (Date.parse(String(a.purchased_at || "")) || 0),
  );
  for (const p of sorted) {
    const id = String(p.item_id || "");
    if (id && !m.has(id)) m.set(id, p);
  }
  return m;
}

/** 原料反向消耗汇总：给定流水 → 最近消耗它的订单列表（按时间倒序去重，同订单多菜品累加用量） */
export interface OutOrderRow {
  orderId: string;
  dish: string;
  qty: number;
  at: string;
}
export function outOrderRows(
  txns: InventoryTransaction[],
  limit = 20,
): OutOrderRow[] {
  const map = new Map<string, OutOrderRow>();
  for (const t of txns) {
    if (t?.type !== "order_out") continue;
    const id = String(t.reference || "");
    if (!id) continue;
    const qty = Math.abs(num(t.quantity));
    const dish = String(t.notes || "").trim() || "—";
    const existing = map.get(id);
    if (existing) {
      existing.qty += qty;
      if (dish !== "—" && !existing.dish.split("、").includes(dish)) {
        existing.dish += `、${dish}`;
      }
    } else {
      map.set(id, {
        orderId: id,
        dish,
        qty,
        at: String(t.created_at || ""),
      });
    }
  }
  return [...map.values()].slice(0, limit);
}

/** 汇总某原料被哪些订单消耗的次数/总量 */
export function outSummary(rows: OutOrderRow[]): {
  orders: number;
  qty: number;
} {
  const qty = rows.reduce((s, r) => s + r.qty, 0);
  return { orders: rows.length, qty };
}

/* ============ 查询 ============ */

/** 某订单的 BOM 扣减流水 */
export async function fetchOrderTxns(
  orderId: string,
): Promise<InventoryTransaction[]> {
  if (!supabase || !orderId) return [];
  const { data, error } = await supabase
    .from("inventory_transactions")
    .select("*")
    .eq("reference", orderId)
    .eq("type", "order_out")
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[owner] fetchOrderTxns:", error.message);
    return [];
  }
  return (data || []) as InventoryTransaction[];
}

/** 多个原料的采购记录（按时间倒序，客户端再取每原料最近一次） */
export async function fetchPurchasesByItems(
  itemIds: string[],
): Promise<PurchaseRow[]> {
  if (!supabase || !itemIds.length) return [];
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("*")
    .in("item_id", itemIds.slice(0, 50))
    .order("purchased_at", { ascending: false })
    .limit(300);
  if (error) {
    console.warn("[owner] fetchPurchasesByItems:", error.message);
    return [];
  }
  return (data || []) as PurchaseRow[];
}

/** 某原料的出库流水（倒序） */
export async function fetchItemOutflows(
  itemId: string,
  limit = 200,
): Promise<InventoryTransaction[]> {
  if (!supabase || !itemId) return [];
  const { data, error } = await supabase
    .from("inventory_transactions")
    .select("*")
    .eq("item_id", itemId)
    .eq("type", "order_out")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[owner] fetchItemOutflows:", error.message);
    return [];
  }
  return (data || []) as InventoryTransaction[];
}

/** 某原料的采购入库历史（倒序） */
export async function fetchItemPurchases(
  itemId: string,
  limit = 50,
): Promise<PurchaseRow[]> {
  if (!supabase || !itemId) return [];
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("item_id", itemId)
    .order("purchased_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[owner] fetchItemPurchases:", error.message);
    return [];
  }
  return (data || []) as PurchaseRow[];
}

/** 按 id 批量取订单头（用于反向展示消耗订单的桌号/金额） */
export async function fetchOrdersByIds(ids: string[]): Promise<any[]> {
  if (!supabase || !ids.length) return [];
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .in("id", ids.slice(0, 50));
  if (error) {
    console.warn("[owner] fetchOrdersByIds:", error.message);
    return [];
  }
  return data || [];
}

/** 反向链路用：原料档案（取价格/库存展示） */
export function itemNameOf(items: InventoryItem[], itemId: string): string {
  return items.find((i) => String(i.id) === itemId)?.name || "";
}
