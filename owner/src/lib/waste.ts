import { dayKey, parseTs } from "./format";
import { num, type InventoryTransaction } from "./inventory";
import { wasteStats as wasteByItemRaw, type ConsumptionStat } from "./cost";
import type { Bounds } from "./analytics";

/* ============ 损耗（报损）统计 ============
 * 金额口径：Σ |quantity| × unit_cost（unit_cost 为报损时点的原料单价）
 * 损耗率：金额 ÷ 同期营收（主指标）；金额 ÷ 同期 COGS（辅指标）
 */

/** 报损原因（写入 inventory_transactions.reason，VARCHAR(30)） */
export const REASONS = ["过期", "做坏", "出品不合格", "丢失", "其他"] as const;

export type Reason = (typeof REASONS)[number];

/** 归一化原因：空值/未知值一律归入「其他」，保证分组干净 */
export function normalizeReason(raw: string | undefined | null): Reason {
  const v = String(raw || "").trim();
  if (!v) return "其他";
  return (REASONS as readonly string[]).includes(v) ? (v as Reason) : "其他";
}

const withinTxn = (t: InventoryTransaction, b: Bounds) => {
  const ts = parseTs(t.created_at);
  return ts >= b.start && ts <= b.end;
};

const wasteTxns = (txns: InventoryTransaction[], b: Bounds) =>
  txns.filter((t) => t.type === "waste" && withinTxn(t, b));

export const txnAmount = (t: InventoryTransaction) =>
  Math.abs(num(t.quantity)) * num(t.unit_cost);

/** 区间内的报损流水（按时间倒序），供明细表使用 */
export function wasteRows(
  txns: InventoryTransaction[],
  b: Bounds,
): InventoryTransaction[] {
  return wasteTxns(txns, b).sort((a, c) =>
    String(c.created_at || "").localeCompare(String(a.created_at || "")),
  );
}

export interface WasteSummary {
  /** 损耗总额 */
  amount: number;
  /** 报损笔数 */
  count: number;
  /** 单笔最高金额 */
  maxOne: number;
  /** 损耗额 ÷ 营收（0~n，已乘 100 的百分数由视图格式化） */
  rateOnRevenue: number;
  /** 损耗额 ÷ COGS */
  rateOnCogs: number;
  /** 按原料（金额降序） */
  byItem: ConsumptionStat[];
  /** 按原因 */
  byReason: { name: string; amount: number; count: number }[];
  /** 按天（升序） */
  byDay: { key: string; amount: number; count: number }[];
}

export function wasteSummary(
  txns: InventoryTransaction[],
  b: Bounds,
  revenue = 0,
  cogs = 0,
): WasteSummary {
  const rows = wasteTxns(txns, b);
  const amount = rows.reduce((s, t) => s + txnAmount(t), 0);

  const reasonMap = new Map<string, { amount: number; count: number }>();
  const dayMap = new Map<string, { amount: number; count: number }>();
  let maxOne = 0;

  for (const t of rows) {
    const a = txnAmount(t);
    if (a > maxOne) maxOne = a;

    const r = normalizeReason(t.reason);
    const re = reasonMap.get(r) || { amount: 0, count: 0 };
    re.amount += a;
    re.count += 1;
    reasonMap.set(r, re);

    const k = dayKey(t.created_at);
    if (k) {
      const de = dayMap.get(k) || { amount: 0, count: 0 };
      de.amount += a;
      de.count += 1;
      dayMap.set(k, de);
    }
  }

  const byReason = REASONS.map((name) => ({
    name,
    amount: reasonMap.get(name)?.amount || 0,
    count: reasonMap.get(name)?.count || 0,
  }))
    .filter((r) => r.count > 0)
    .sort((a, c) => c.amount - a.amount);

  return {
    amount,
    count: rows.length,
    maxOne,
    rateOnRevenue: revenue > 0 ? (amount / revenue) * 100 : 0,
    rateOnCogs: cogs > 0 ? (amount / cogs) * 100 : 0,
    byItem: wasteByItemRaw(txns, b),
    byReason,
    byDay: Array.from(dayMap.entries())
      .sort((a, c) => (a[0] < c[0] ? -1 : 1))
      .map(([key, v]) => ({ key, ...v })),
  };
}

/** 今日损耗金额（库存页 KPI 用） */
export function todayWasteAmount(txns: InventoryTransaction[]): number {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return txns
    .filter(
      (t) =>
        t.type === "waste" &&
        withinTxn(t, { start: start.getTime(), end: end.getTime() }),
    )
    .reduce((s, t) => s + txnAmount(t), 0);
}
