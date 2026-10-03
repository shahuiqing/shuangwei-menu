import { fmtMoney } from "./format";
import { num, type PurchaseOrder } from "./inventory";

/* ============ 采购价异常检测 ============
 * 基线 = 除最近一笔之外的历史单价中位数（抗单笔异常值），
 * 最近一笔与基线比较得出涨跌幅度，用于下单时实时提示与采购页汇总。
 */

/** 判定所需的最小历史样本数（不含最近一笔） */
export const SAMPLE_MIN = 3;
/** 参与比价的最近采购笔数 */
export const MAX_SAMPLES = 12;
/** 涨价预警阈值（+15%），超过升级为严重（+30%） */
export const WARN_PCT = 0.15;
export const HIGH_PCT = 0.3;
/** 异常低价阈值（-15%，可能是数量填错或品质问题） */
export const LOW_PCT = -0.15;

export type AlertLevel = "high" | "warn" | "sample" | "ok";

export interface PriceAlert {
  itemId: string;
  itemName: string;
  unit: string;
  /** 最近一笔单价 */
  current: number;
  /** 历史中位价基线 */
  baseline: number;
  /** 加权均价 Σtotal_cost / Σquantity */
  weightedAvg: number;
  /** (current - baseline) / baseline，无基线时为 0 */
  changePct: number;
  level: AlertLevel;
  /** 用于判定基线的历史笔数 */
  sampleCount: number;
  /** 距今天数 */
  daysSinceLast: number;
  supplierCount: number;
  priceMin: number;
  priceMax: number;
  /** 升序（旧→新），供 sparkline 用 */
  spark: { at: string; price: number }[];
  recent: {
    id: string;
    at: string;
    supplier: string;
    unitPrice: number;
    quantity: number;
  }[];
  supplierAvg: { supplier: string; avg: number; count: number }[];
}

export interface PriceCheck {
  level: "ok" | "warn" | "high";
  message: string;
}

/** 升序中位数 */
export function median(values: number[]): number {
  const a = values
    .filter((v) => Number.isFinite(v))
    .slice()
    .sort((x, y) => x - y);
  if (!a.length) return 0;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

const pct = (v: number) => `${v >= 0 ? "+" : ""}${Math.round(v * 100)}%`;

function levelOf(changePct: number): AlertLevel {
  if (changePct >= HIGH_PCT) return "high";
  if (changePct >= WARN_PCT) return "warn";
  if (changePct <= LOW_PCT) return "warn";
  return "ok";
}

const daysBetween = (fromTs: number, toTs: number) =>
  Math.max(0, Math.floor((toTs - fromTs) / 86400000));

/** 按原料分组，生成价格基线与异常等级 */
export function buildPriceAlerts(
  purchases: PurchaseOrder[],
  now: number = Date.now(),
): PriceAlert[] {
  const groups = new Map<string, PurchaseOrder[]>();
  for (const p of purchases) {
    const key = String(p.item_id || "").trim();
    if (!key) continue;
    const arr = groups.get(key);
    if (arr) arr.push(p);
    else groups.set(key, [p]);
  }

  const alerts: PriceAlert[] = [];
  for (const [itemId, rows] of groups) {
    const sorted = rows
      .slice()
      .sort(
        (a, b) =>
          String(b.purchased_at || b.created_at || "").localeCompare(
            String(a.purchased_at || a.created_at || ""),
          ) || 0,
      )
      .slice(0, MAX_SAMPLES + 1);

    const latest = sorted[0];
    if (!latest) continue;
    const history = sorted.slice(1);
    const prices = history.map((r) => num(r.unit_price)).filter((v) => v > 0);
    const baseline = prices.length ? median(prices) : 0;
    const current = num(latest.unit_price);

    const allQty = sorted.reduce((s, r) => s + num(r.quantity), 0);
    const allCost = sorted.reduce((s, r) => s + num(r.total_cost), 0);
    const weightedAvg = allQty > 0 ? allCost / allQty : baseline;

    const sampleCount = prices.length;
    const changePct =
      baseline > 0 && current > 0 ? (current - baseline) / baseline : 0;
    const level: AlertLevel =
      sampleCount < SAMPLE_MIN ? "sample" : levelOf(changePct);

    const supplierAvgMap = new Map<
      string,
      { cost: number; qty: number; n: number }
    >();
    for (const r of sorted) {
      const name = String(r.supplier || "").trim() || "未知供应商";
      const cur = supplierAvgMap.get(name) || { cost: 0, qty: 0, n: 0 };
      cur.cost += num(r.total_cost);
      cur.qty += num(r.quantity);
      cur.n += 1;
      supplierAvgMap.set(name, cur);
    }

    const sparkAsc = sorted
      .slice()
      .reverse()
      .map((r) => ({
        at: String(r.purchased_at || r.created_at || ""),
        price: num(r.unit_price),
      }));

    alerts.push({
      itemId,
      itemName: latest.item_name,
      unit: latest.unit,
      current,
      baseline,
      weightedAvg,
      changePct,
      level,
      sampleCount,
      daysSinceLast: daysBetween(
        parseAt(latest.purchased_at || latest.created_at),
        now,
      ),
      supplierCount: supplierAvgMap.size,
      priceMin: sparkAsc.length ? Math.min(...sparkAsc.map((s) => s.price)) : 0,
      priceMax: sparkAsc.length ? Math.max(...sparkAsc.map((s) => s.price)) : 0,
      spark: sparkAsc,
      recent: sorted.map((r) => ({
        id: String(r.id),
        at: String(r.purchased_at || r.created_at || ""),
        supplier: String(r.supplier || ""),
        unitPrice: num(r.unit_price),
        quantity: num(r.quantity),
      })),
      supplierAvg: [...supplierAvgMap.entries()]
        .map(([supplier, v]) => ({
          supplier,
          avg: v.qty > 0 ? v.cost / v.qty : 0,
          count: v.n,
        }))
        .sort((a, b) => b.avg - a.avg),
    });
  }

  return alerts.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
}

function parseAt(v: string | undefined): number {
  if (!v) return 0;
  const t = Date.parse(String(v).trim().replace(" ", "T"));
  return Number.isFinite(t) ? t : 0;
}

export const alertMap = (alerts: PriceAlert[]) =>
  new Map(alerts.map((a) => [a.itemId, a]));

/** 下单时实时校验：给定原料基线与本次单价，返回提示文案 */
export function checkUnitPrice(
  alert: PriceAlert | undefined,
  unitPrice: number,
): PriceCheck {
  if (!unitPrice || unitPrice <= 0) return { level: "ok", message: "" };
  if (!alert || alert.sampleCount < SAMPLE_MIN || alert.baseline <= 0)
    return { level: "ok", message: "" };

  const diff = (unitPrice - alert.baseline) / alert.baseline;
  const ref = `参考中位价 ${fmtMoney(alert.baseline)}/${alert.unit}`;

  if (diff >= HIGH_PCT)
    return {
      level: "high",
      message: `高出近 ${MAX_SAMPLES} 次中位价 ${pct(diff)}（${ref}），请确认供应商报价`,
    };
  if (diff >= WARN_PCT)
    return {
      level: "warn",
      message: `高出近 ${MAX_SAMPLES} 次中位价 ${pct(diff)}（${ref}）`,
    };
  if (diff <= LOW_PCT)
    return {
      level: "warn",
      message: `低于近 ${MAX_SAMPLES} 次中位价 ${pct(diff)}（${ref}），注意数量是否填错或品质问题`,
    };
  return { level: "ok", message: "" };
}

/** 需要在采购页展示的异常（涨价/异常低价），样本不足不展示 */
export function flaggedAlerts(alerts: PriceAlert[]): PriceAlert[] {
  return alerts.filter((a) => a.level === "high" || a.level === "warn");
}
