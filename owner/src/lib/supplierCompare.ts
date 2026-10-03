import { num, type PurchaseOrder } from "./inventory";
import { median } from "./priceAlert";

/* ============ 供应商比价 ============
 * 同一原料按供应商聚合：均价 / 中位价 / 次数 / 金额份额，
 * 标出最低与最高价供应商，并估算「换供应商」的每单位节省。
 */

export type SupplierLevel = "best" | "mid" | "worst";

export interface SupplierStat {
  supplier: string;
  /** 采购笔数 */
  count: number;
  qty: number;
  cost: number;
  /** 加权均价 = Σ金额 / Σ数量 */
  avg: number;
  /** 单价中位数（抗极端单） */
  medianUnit: number;
  /** 最近一次采购时间（ISO） */
  lastAt: string;
  /** 金额份额 0~1 */
  share: number;
  level: SupplierLevel;
}

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

const supplierName = (p: PurchaseOrder) =>
  String(p.supplier || "").trim() || "未知供应商";

function pickAt(p: PurchaseOrder): string {
  return String(p.purchased_at || p.created_at || "");
}

/** 同一原料各供应商比价，按均价升序（最低价在前） */
export function supplierCompare(
  purchases: PurchaseOrder[],
  itemId: string,
): SupplierStat[] {
  const groups = new Map<string, PurchaseOrder[]>();
  for (const p of purchases || []) {
    if (String(p.item_id || "").trim() !== itemId) continue;
    const name = supplierName(p);
    const arr = groups.get(name);
    if (arr) arr.push(p);
    else groups.set(name, [p]);
  }

  const stats: SupplierStat[] = [];
  let totalCost = 0;
  for (const [supplier, rows] of groups) {
    const qty = rows.reduce((s, r) => s + num(r.quantity), 0);
    const cost = rows.reduce((s, r) => s + num(r.total_cost), 0);
    const prices = rows.map((r) => num(r.unit_price)).filter((v) => v > 0);
    const lastAt = rows
      .map(pickAt)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] as string;
    totalCost += cost;
    stats.push({
      supplier,
      count: rows.length,
      qty: round2(qty),
      cost: round2(cost),
      avg: qty > 0 ? round2(cost / qty) : 0,
      medianUnit: round2(median(prices)),
      lastAt: lastAt || "",
      share: 0,
      level: "mid",
    });
  }

  for (const s of stats) {
    s.share = totalCost > 0 ? round2(s.cost / totalCost) : 0;
  }

  stats.sort((a, b) => a.avg - b.avg || b.count - a.count);

  if (stats.length >= 2 && stats.some((s) => s.avg > 0)) {
    stats[0].level = "best";
    stats[stats.length - 1].level = "worst";
  }
  return stats;
}

export interface CompareInsight {
  best: SupplierStat;
  worst: SupplierStat;
  /** 每单位可省金额（最高价 − 最低价） */
  savePerUnit: number;
  /** 相对最高价节省比例 0~1 */
  savePct: number;
  /** 按该原料近期均价数量估算的一次采购节省额 */
  savePerBuy: number;
}

/** 至少两家供应商且有均价差时给出「换供应商可省」的结论 */
export function compareInsight(stats: SupplierStat[]): CompareInsight | null {
  const byAvg = stats.filter((s) => s.avg > 0).sort((a, b) => a.avg - b.avg);
  if (byAvg.length < 2) return null;
  const best = byAvg[0];
  const worst = byAvg[byAvg.length - 1];
  const savePerUnit = round2(worst.avg - best.avg);
  if (savePerUnit <= 0) return null;
  const avgQty =
    stats.reduce((s, x) => s + x.qty, 0) / Math.max(1, stats.length);
  return {
    best,
    worst,
    savePerUnit,
    savePct: round2(savePerUnit / worst.avg),
    savePerBuy: round2(savePerUnit * avgQty),
  };
}

/** 可比价的原料（≥2 家供应商），按笔数降序，供选择器用 */
export function rivalItems(
  purchases: PurchaseOrder[],
): { itemId: string; itemName: string; suppliers: number; count: number }[] {
  const map = new Map<
    string,
    { itemName: string; suppliers: Set<string>; count: number }
  >();
  for (const p of purchases || []) {
    const id = String(p.item_id || "").trim();
    if (!id) continue;
    const e = map.get(id) || {
      itemName: p.item_name,
      suppliers: new Set<string>(),
      count: 0,
    };
    e.itemName = e.itemName || p.item_name;
    e.suppliers.add(supplierName(p));
    e.count += 1;
    map.set(id, e);
  }
  return [...map.entries()]
    .filter(([, e]) => e.suppliers.size >= 2)
    .map(([itemId, e]) => ({
      itemId,
      itemName: e.itemName,
      suppliers: e.suppliers.size,
      count: e.count,
    }))
    .sort((a, b) => b.count - a.count || a.itemName.localeCompare(b.itemName));
}
