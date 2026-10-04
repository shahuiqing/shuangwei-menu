/* ============ 菜品趋势（纯函数） ============
 * 对比本期与上期销量，把菜品分成 增长 / 稳定 / 下降 / 新品 / 消失。
 */

export type DishTrendKind = "up" | "steady" | "down" | "new" | "gone";

export interface DishTrend {
  name: string;
  currentQty: number;
  prevQty: number;
  changePct: number;
  kind: DishTrendKind;
}

export const TREND_LABEL: Record<
  DishTrendKind,
  { label: string; color: string }
> = {
  up: { label: "增长", color: "#22c55e" },
  steady: { label: "稳定", color: "#38bdf8" },
  down: { label: "下降", color: "#f43f5e" },
  new: { label: "新品", color: "#a78bfa" },
  gone: { label: "消失", color: "#71717a" },
};

export function buildDishTrends(
  current: { name: string; qty: number }[],
  prev: { name: string; qty: number }[],
  threshold = 0.2,
): DishTrend[] {
  const prevMap = new Map((prev || []).map((d) => [d.name, d.qty]));
  const out: DishTrend[] = (current || []).map((d) => {
    const pq = prevMap.get(d.name);
    if (pq === undefined || pq <= 0) {
      return {
        name: d.name,
        currentQty: d.qty,
        prevQty: pq || 0,
        changePct: d.qty > 0 ? 100 : 0,
        kind: "new" as DishTrendKind,
      };
    }
    const changePct = ((d.qty - pq) / pq) * 100;
    const kind: DishTrendKind =
      changePct > threshold * 100
        ? "up"
        : changePct < -threshold * 100
          ? "down"
          : "steady";
    return { name: d.name, currentQty: d.qty, prevQty: pq, changePct, kind };
  });

  const curNames = new Set((current || []).map((d) => d.name));
  for (const d of prev || []) {
    if (!curNames.has(d.name)) {
      out.push({
        name: d.name,
        currentQty: 0,
        prevQty: d.qty,
        changePct: -100,
        kind: "gone",
      });
    }
  }
  return out.sort((a, b) => b.changePct - a.changePct);
}
