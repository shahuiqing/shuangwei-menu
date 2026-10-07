/* ============ 智能预警（异常检测） ============
 * 把已有经营数据变主动：主动识别「菜品销量腰斩」「成本率突增」等异常，
 * 在看板提示老板，而不是等老板自己去翻。
 */
import type { DishStat } from "./aggregate";

export interface DishDrop {
  name: string;
  recentQty: number;
  prevQty: number;
  /** 降幅百分比（100 = 归零） */
  dropPct: number;
}

/**
 * 菜品销量腰斩：近段日均销量 vs 前段日均销量，降幅 ≥ 阈值（默认 50%）。
 * 前段无销量的（新菜/刚上架）不判定；近段完全消失的按 100% 降幅计。
 */
export function detectDishDrops(
  recent: DishStat[],
  previous: DishStat[],
  recentDays: number,
  prevDays: number,
  threshold = 0.5,
): DishDrop[] {
  const prev = new Map(previous.map((d) => [d.name, d.qty]));
  const recentNames = new Set(recent.map((d) => d.name));
  const out: DishDrop[] = [];

  for (const d of recent) {
    const p = prev.get(d.name);
    if (!p || p <= 0) continue; // 前段无销量（新菜）
    const prevAvg = p / Math.max(prevDays, 1);
    const recentAvg = d.qty / Math.max(recentDays, 1);
    const drop = (prevAvg - recentAvg) / prevAvg;
    if (drop >= threshold) {
      out.push({
        name: d.name,
        recentQty: d.qty,
        prevQty: p,
        dropPct: Math.round(drop * 100),
      });
    }
  }

  // 前段有销量、近段完全没有 → 归零
  for (const d of previous) {
    if (d.qty <= 0 || recentNames.has(d.name)) continue;
    out.push({ name: d.name, recentQty: 0, prevQty: d.qty, dropPct: 100 });
  }

  return out.sort((a, b) => b.dropPct - a.dropPct);
}

/** 成本率突增：当前成本率 − 基线成本率 ≥ 阈值（默认 5 个百分点） */
export function costRateAnomaly(
  current: number,
  baseline: number,
  thresholdPct = 5,
): boolean {
  return current - baseline >= thresholdPct;
}
