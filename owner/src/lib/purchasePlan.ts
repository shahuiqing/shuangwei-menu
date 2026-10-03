import { num, type InventoryItem } from "./inventory";
import type { PriceAlert } from "./priceAlert";

/* ============ 采购计划 ============
 * 目标库存 = 安全库存 + 近期日均消耗 × 覆盖天数，
 * 建议采购量 = 目标库存 − 现有库存（>0 才进计划）。
 * 参考单价优先取采购历史中位价（priceAlert 基线），缺失回落到库存表进价。
 */

/** 可选的覆盖天数（天） */
export const COVERAGE_DAYS = [3, 7, 14] as const;
export type CoverageDays = (typeof COVERAGE_DAYS)[number];

/** 计算日均消耗所用的历史窗口（天） */
export const CONSUMPTION_WINDOW_DAYS = 30;

export type PlanPriority = "urgent" | "soon" | "normal";

const RANK: Record<PlanPriority, number> = { urgent: 0, soon: 1, normal: 2 };

export interface PlanRow {
  id: string;
  name: string;
  unit: string;
  stock: number;
  safety: number;
  /** 近期日均消耗（件/天），无记录为 0 */
  dailyAvg: number;
  /** 现有库存还能撑几天；无消耗记录为 null */
  daysLeft: number | null;
  /** 覆盖天数下的目标库存 */
  target: number;
  /** 建议采购量（补到目标库存） */
  gap: number;
  /** 参考单价：采购中位价优先，否则库存表进价 */
  refPrice: number;
  estCost: number;
  priority: PlanPriority;
  reason: string;
}

export interface PurchasePlan {
  coverageDays: number;
  rows: PlanRow[];
  totalCost: number;
}

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

/**
 * 把 owner_consumption 聚合结果折算成日均消耗（key = 原料名）。
 * RPC 缺失时传 [] → 空 map，计划退化为「安全库存」口径。
 */
export function dailyFromConsumption(
  rows: { key: string; qty: number }[],
  days: number,
): Map<string, number> {
  const d = Math.max(1, days);
  const out = new Map<string, number>();
  for (const r of rows) {
    const k = String(r.key ?? "").trim();
    const qty = num(r.qty);
    if (!k || qty <= 0) continue;
    out.set(k, (out.get(k) || 0) + qty / d);
  }
  return out;
}

export function buildPurchasePlan(opts: {
  items: InventoryItem[];
  daily?: Map<string, number>;
  alerts?: PriceAlert[];
  coverageDays?: number;
}): PurchasePlan {
  const coverage = Math.max(1, Math.round(num(opts.coverageDays) || 7));
  const priceById = new Map<string, number>();
  for (const a of opts.alerts || []) {
    if (a.baseline > 0) priceById.set(a.itemId, a.baseline);
  }

  const rows: PlanRow[] = [];
  for (const it of opts.items || []) {
    const stock = num(it.stock);
    const safety = num(it.safety_stock);
    const daily = Math.max(0, num(opts.daily?.get(String(it.name).trim())));
    const target = safety + daily * coverage;
    const gap = target - stock;
    if (gap <= 0.001) continue; // 覆盖充足，无需采购

    const daysLeft = daily > 0 ? stock / daily : null;
    const out = stock <= 0;
    const below = safety > 0 && stock <= safety;
    const priority: PlanPriority = out ? "urgent" : below ? "soon" : "normal";
    const refPrice = priceById.get(it.id) || num(it.price);

    rows.push({
      id: it.id,
      name: it.name,
      unit: it.unit,
      stock: round2(stock),
      safety: round2(safety),
      dailyAvg: round2(daily),
      daysLeft: daysLeft === null ? null : round2(daysLeft),
      target: round2(target),
      gap: round2(gap),
      refPrice,
      estCost: round2(gap * refPrice),
      priority,
      reason: out
        ? "已缺货"
        : below
          ? "低于安全库存"
          : daysLeft !== null
            ? `库存约够 ${daysLeft.toFixed(1)} 天`
            : "低于计划目标",
    });
  }

  rows.sort(
    (a, b) => RANK[a.priority] - RANK[b.priority] || b.estCost - a.estCost,
  );
  return {
    coverageDays: coverage,
    rows,
    totalCost: round2(rows.reduce((s, r) => s + r.estCost, 0)),
  };
}
