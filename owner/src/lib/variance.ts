import { num } from "./inventory";

/* ============ 库存差异报告 ============
 * 逐原料：理论消耗（销售×配方） vs 实际消耗（期初+采购−期末），
 * 差异金额 = 差异量 × 移动加权平均成本，按金额绝对值降序。
 */

export interface VarianceInput {
  name: string;
  unit: string;
  theoretical: number;
  actual: number;
  avgCost: number;
}

export interface VarianceRow extends VarianceInput {
  /** 差异量 = 理论 − 实际（正=多耗，负=少耗） */
  variance: number;
  /** 差异金额 */
  value: number;
}

export function buildVarianceReport(rows: VarianceInput[]): VarianceRow[] {
  return (rows || [])
    .map((r) => {
      const variance = num(r.theoretical) - num(r.actual);
      return { ...r, variance, value: variance * num(r.avgCost) };
    })
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

/** 汇总：差异总金额、多耗金额、少耗金额 */
export function varianceSummary(rows: VarianceRow[]): {
  total: number;
  over: number;
  under: number;
} {
  let over = 0;
  let under = 0;
  for (const r of rows) {
    if (r.value > 0) over += r.value;
    else under += -r.value;
  }
  return { total: over - under, over, under };
}
