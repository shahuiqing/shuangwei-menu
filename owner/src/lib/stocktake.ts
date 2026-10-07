import { num, type InventoryItem } from "./inventory";

/* ============ 库存盘点（实盘 vs 账面） ============
 * 只在前端比对，不落库；调整时写库存流水（reason=盘点差异）。
 */

export const STOCKTAKE_REASON = "盘点差异";

export interface StocktakeRow {
  id: string;
  name: string;
  unit: string;
  price: number;
  /** 账面数量 */
  book: number;
  /** 实盘数量；未填 / 非法输入为 null */
  actual: number | null;
  /** 实盘 − 账面（未填为 null） */
  diff: number | null;
  /** 差异金额 = diff × 单价 */
  value: number | null;
}

export interface StocktakeSummary {
  total: number;
  counted: number;
  diffCount: number;
  /** 净差异金额（有正有负） */
  diffValue: number;
  /** 盘亏合计（实际少于账面） */
  lossValue: number;
  /** 盘盈合计（实际多于账面） */
  gainValue: number;
}

export interface StocktakeResult {
  rows: StocktakeRow[];
  summary: StocktakeSummary;
}

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

/** 解析输入：空串/非法/负数视为未盘 */
export function parseCount(raw: string | undefined | null): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const v = Number(s);
  if (!Number.isFinite(v) || v < 0) return null;
  return round2(v);
}

export function buildStocktake(
  items: InventoryItem[],
  counts: Record<string, string>,
): StocktakeResult {
  const rows: StocktakeRow[] = (items || []).map((it) => {
    const book = round2(num(it.stock));
    const price = num(it.price);
    const actual = parseCount(counts?.[it.id]);
    const diff = actual === null ? null : round2(actual - book);
    return {
      id: it.id,
      name: it.name,
      unit: it.unit,
      price,
      book,
      actual,
      diff,
      value: diff === null ? null : round2(diff * price),
    };
  });

  const counted = rows.filter((r) => r.actual !== null);
  const diffRows = counted.filter((r) => (r.diff as number) !== 0);
  const diffValue = round2(
    diffRows.reduce((s, r) => s + (r.value as number), 0),
  );
  const lossValue = round2(
    Math.abs(
      diffRows
        .filter((r) => (r.diff as number) < 0)
        .reduce((s, r) => s + (r.value as number), 0),
    ),
  );
  const gainValue = round2(
    diffRows
      .filter((r) => (r.diff as number) > 0)
      .reduce((s, r) => s + (r.value as number), 0),
  );

  return {
    rows,
    summary: {
      total: rows.length,
      counted: counted.length,
      diffCount: diffRows.length,
      diffValue,
      lossValue,
      gainValue,
    },
  };
}

/** 需要写库的差异行（实盘已填且与账面不同） */
export function pendingAdjustments(result: StocktakeResult): StocktakeRow[] {
  return result.rows.filter(
    (r) => r.actual !== null && r.diff !== null && r.diff !== 0,
  );
}

/** 盘点后的库存总额（已盘项用实盘数、未盘项用账面数）——作为成本对账的锚点 */
export function stocktakeValue(result: StocktakeResult): number {
  return result.rows.reduce((s, r) => s + (r.actual ?? r.book) * r.price, 0);
}
