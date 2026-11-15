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
  /** 建议采购量（补到目标库存，含员工申报时取更大值） */
  gap: number;
  /** 参考单价：采购中位价优先，否则库存表进价 */
  refPrice: number;
  estCost: number;
  priority: PlanPriority;
  reason: string;
  /** ── 员工申报并入的字段（无申报时不出现） ── */
  /** 申报合计数量 */
  requestQty?: number;
  /** 申报人名单 */
  requestStaff?: string[];
  /** 是否有紧急申报 */
  requestUrgent?: boolean;
  /** 关联的申报 id（入库成功后回写用） */
  requestIds?: string[];
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
  rows: { key: string; item_id?: string; qty: number }[],
  days: number,
): Map<string, number> {
  const d = Math.max(1, days);
  const out = new Map<string, number>();
  for (const r of rows) {
    const id = String(r.item_id ?? "").trim();
    const name = String(r.key ?? "").trim();
    const k = id || name;
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
    const daily = Math.max(
      0,
      num(opts.daily?.get(it.id) ?? opts.daily?.get(String(it.name).trim())),
    );
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

/* ============ 员工申报并入采购计划 ============ */

/** 申报的最小字段（来自 staffOps.PurchaseRequest，避免循环依赖只留需要的） */
export interface RequestLike {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
  urgency: "normal" | "urgent";
  staff_name: string;
  /** 老板手动关联的库存物品（优先于名称匹配） */
  inventory_item_id?: string;
}

export interface PlanRequestInfo {
  /** 申报合计数量 */
  qty: number;
  /** 申报人名单 */
  staff: string[];
  /** 是否有紧急申报 */
  urgent: boolean;
  /** 申报 id 列表（入库成功后回写用） */
  requestIds: string[];
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "");

/**
 * 申报名称 → 库存物品 id。
 * 精确匹配优先；否则按去空格包含匹配，取名称最短（最贴近）的候选。
 * 匹配不到返回 null → 页面提示"待确认"，由老板手动关联。
 */
export function matchRequestToItem(
  itemName: string,
  items: Pick<InventoryItem, "id" | "name">[],
): string | null {
  const q = norm(itemName);
  if (!q) return null;
  for (const it of items) if (norm(it.name) === q) return it.id;
  const cands = items.filter((it) => {
    const n = norm(it.name);
    return (n.includes(q) || q.includes(n)) && n.length > 0;
  });
  if (cands.length === 0) return null;
  return cands.sort((a, b) => norm(a.name).length - norm(b.name).length)[0].id;
}

/** 把已审批申报按库存物品聚合；匹配不到的进 unmatched（待确认） */
export function requestsByItem(
  requests: RequestLike[],
  items: Pick<InventoryItem, "id" | "name">[],
): { byItem: Map<string, PlanRequestInfo>; unmatched: RequestLike[] } {
  const byItem = new Map<string, PlanRequestInfo>();
  const unmatched: RequestLike[] = [];
  const itemIds = new Set(items.map((i) => i.id));
  for (const r of requests) {
    // 老板手动关联的优先；否则按名称自动匹配
    const linked = r.inventory_item_id?.trim() || "";
    const itemId =
      linked && itemIds.has(linked)
        ? linked
        : matchRequestToItem(r.item_name, items);
    if (!itemId) {
      unmatched.push(r);
      continue;
    }
    const cur = byItem.get(itemId) || {
      qty: 0,
      staff: [],
      urgent: false,
      requestIds: [],
    };
    cur.qty += num(r.quantity);
    cur.urgent = cur.urgent || r.urgency === "urgent";
    if (r.staff_name && !cur.staff.includes(r.staff_name))
      cur.staff.push(r.staff_name);
    cur.requestIds.push(r.id);
    byItem.set(itemId, cur);
  }
  return { byItem, unmatched };
}

/**
 * 申报并入计划：建议采购量取 max(库存缺口, 申报合计)；
 * 有紧急申报的行优先级提到 urgent；总成本重算。
 * items 传入后，申报物品即使库存充足（原本不在计划里）也会补一行进来。
 */
export function mergeRequestsIntoPlan(
  plan: PurchasePlan,
  byItem: Map<string, PlanRequestInfo>,
  items: InventoryItem[] = [],
): PurchasePlan {
  const rows = plan.rows.map((r) => {
    const info = byItem.get(r.id);
    if (!info || info.qty <= 0) return r;
    const gap = Math.max(r.gap, info.qty);
    const priority: PlanPriority =
      info.urgent && r.priority !== "urgent" ? "urgent" : r.priority;
    return {
      ...r,
      gap: round2(gap),
      estCost: round2(gap * r.refPrice),
      priority,
      reason:
        info.qty > r.gap
          ? `含员工申报 ${round2(info.qty)} ${r.unit}`
          : r.reason,
      requestQty: round2(info.qty),
      requestStaff: info.staff,
      requestUrgent: info.urgent,
      requestIds: info.requestIds,
    };
  });

  // 申报物品库存充足、本不在计划 → 补一行（老板申报了就该买）
  const present = new Set(rows.map((r) => r.id));
  for (const [itemId, info] of byItem) {
    if (present.has(itemId) || info.qty <= 0) continue;
    const it = items.find((i) => i.id === itemId);
    if (!it) continue;
    const refPrice = num(it.price);
    rows.push({
      id: it.id,
      name: it.name,
      unit: it.unit,
      stock: round2(num(it.stock)),
      safety: round2(num(it.safety_stock)),
      dailyAvg: 0,
      daysLeft: null,
      target: 0,
      gap: round2(info.qty),
      refPrice,
      estCost: round2(info.qty * refPrice),
      priority: info.urgent ? "urgent" : "normal",
      reason: `员工申报 ${round2(info.qty)} ${it.unit}`,
      requestQty: round2(info.qty),
      requestStaff: info.staff,
      requestUrgent: info.urgent,
      requestIds: info.requestIds,
    });
  }

  rows.sort(
    (a, b) => RANK[a.priority] - RANK[b.priority] || b.estCost - a.estCost,
  );
  return {
    coverageDays: plan.coverageDays,
    rows,
    totalCost: round2(rows.reduce((s, r) => s + r.estCost, 0)),
  };
}
