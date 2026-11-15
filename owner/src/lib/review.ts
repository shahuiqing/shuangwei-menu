import { rangeToIso, salesSummary, dishStats, costSummary } from "./aggregate";
import {
  fetchBoms,
  fetchInventory,
  fetchPurchases,
  fetchTransactions,
  num,
} from "./inventory";
import { dishMargins } from "./cost";
import { loadStocktakeHistory } from "./stocktakeHistory";
import { fetchStaffTasks } from "./staffOps";
import { fmtMoney } from "./format";

/**
 * 周报 / 月报复盘：
 * - 本期 vs 上期经营指标
 * - 热销、毛利、损耗、采购、盘点、员工完成率
 * - 下期重点（由经营顾问建议提供）
 */

export type ReviewPeriod = "week" | "month";

export interface ReviewFacts {
  period: ReviewPeriod;
  label: string;
  range: { start: string; end: string };
  revenue: number;
  prevRevenue: number;
  revenueChangePct: number;
  orders: number;
  prevOrders: number;
  aov: number;
  prevAov: number;
  foodCostRate: number;
  prevFoodCostRate: number;
  topDishes: { name: string; qty: number; revenue: number }[];
  lowMargin: { name: string; margin: number; qty: number }[];
  waste: number;
  wasteRatioPct: number;
  purchaseAmount: number;
  stocktake: { count: number; diffs: number; netValue: number };
  staff: { created: number; done: number; donePct: number };
}

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const pctChange = (cur: number, prev: number) =>
  prev > 0 ? round2(((cur - prev) / prev) * 100) : 0;

/** 内部：区间 → 上一区间（同长度，紧邻） */
export function previousRange(
  startIso: string,
  endIso: string,
): {
  start: string;
  end: string;
} {
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  const span = Math.max(1, e - s);
  return {
    start: new Date(s - span).toISOString(),
    end: new Date(s - 1).toISOString(),
  };
}

export async function loadReviewFacts(
  period: ReviewPeriod,
): Promise<ReviewFacts> {
  const range = rangeToIso(period === "week" ? "7d" : "30d");
  const prev = previousRange(range.start, range.end);

  const [
    cur,
    old,
    dishes,
    curCost,
    oldCost,
    boms,
    inv,
    purchases,
    txns,
    tasks,
  ] = await Promise.all([
    salesSummary(range.start, range.end),
    salesSummary(prev.start, prev.end),
    dishStats(range.start, range.end),
    costSummary(range.start, range.end),
    costSummary(prev.start, prev.end),
    fetchBoms(),
    fetchInventory(),
    fetchPurchases(500),
    fetchTransactions(3000, "waste", range.start),
    fetchStaffTasks(),
  ]);

  const margins = dishMargins(
    dishes.map((d) => ({ name: d.name, qty: d.qty, revenue: d.revenue })),
    boms,
    inv,
  );

  const startMs = new Date(range.start).getTime();
  const endMs = new Date(range.end).getTime();
  const inRange = (iso: string | undefined | null) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= startMs && t <= endMs;
  };

  const wasteTxns = (txns || []).filter((x) => inRange(x.created_at));
  const waste = wasteTxns.reduce(
    (s, x) => s + Math.abs(num(x.quantity)) * num(x.unit_cost),
    0,
  );
  const purchaseAmount = purchases
    .filter((p) => inRange(p.purchased_at || p.created_at))
    .reduce((s, p) => s + num(p.total_cost), 0);

  const history = loadStocktakeHistory().filter(
    (r) => r.at >= startMs && r.at <= endMs,
  );
  const stocktake = {
    count: history.length,
    diffs: history.reduce((s, r) => s + r.diffs, 0),
    netValue: round2(history.reduce((s, r) => s + r.netValue, 0)),
  };

  const periodTasks = tasks.filter((t) => inRange(t.created_at));
  const done = periodTasks.filter(
    (t) => t.status === "approved" || t.status === "submitted",
  ).length;

  return {
    period,
    label: period === "week" ? "近 7 天" : "近 30 天",
    range: { start: range.start, end: range.end },
    revenue: round2(cur.revenue),
    prevRevenue: round2(old.revenue),
    revenueChangePct: pctChange(cur.revenue, old.revenue),
    orders: cur.orders,
    prevOrders: old.orders,
    aov: cur.orders ? round2(cur.revenue / cur.orders) : 0,
    prevAov: old.orders ? round2(old.revenue / old.orders) : 0,
    foodCostRate: cur.revenue
      ? round2(((curCost?.cogs ?? 0) / cur.revenue) * 100)
      : 0,
    prevFoodCostRate: old.revenue
      ? round2(((oldCost?.cogs ?? 0) / old.revenue) * 100)
      : 0,
    topDishes: [...dishes]
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
      .map((d) => ({ name: d.name, qty: d.qty, revenue: round2(d.revenue) })),
    lowMargin: margins
      .filter((d) => d.hasCost && d.qty > 0)
      .sort((a, b) => a.margin - b.margin)
      .slice(0, 3)
      .map((d) => ({ name: d.name, margin: Math.round(d.margin), qty: d.qty })),
    waste: round2(waste),
    wasteRatioPct: cur.revenue ? round2((waste / cur.revenue) * 100) : 0,
    purchaseAmount: round2(purchaseAmount),
    stocktake,
    staff: {
      created: periodTasks.length,
      done,
      donePct: periodTasks.length
        ? Math.round((done / periodTasks.length) * 100)
        : 0,
    },
  };
}

export interface ReviewReport {
  summary: string[];
  highlights: string[];
  next: string[];
}

/** 规则版复盘：结论 / 亮点与问题 / 下期重点 */
export function buildReview(
  f: ReviewFacts,
  nextActions: string[] = [],
): ReviewReport {
  const dir = f.revenueChangePct >= 0 ? "增长" : "下降";
  const summary = [
    `${f.label}营业额 ${fmtMoney(f.revenue)}，较上期${dir} ${Math.abs(
      f.revenueChangePct,
    ).toFixed(1)}%（上期 ${fmtMoney(f.prevRevenue)}）。`,
    `订单 ${f.orders} 单（上期 ${f.prevOrders}），客单价 ${fmtMoney(
      f.aov,
    )}；食材成本率 ${f.foodCostRate.toFixed(1)}%（上期 ${f.prevFoodCostRate.toFixed(
      1,
    )}%）。`,
    `损耗 ${fmtMoney(f.waste)}（占营业额 ${f.wasteRatioPct.toFixed(
      1,
    )}%）；采购支出 ${fmtMoney(f.purchaseAmount)}。`,
  ];

  const highlights: string[] = [];
  if (f.topDishes.length) {
    highlights.push(
      `热销：` +
        f.topDishes
          .slice(0, 3)
          .map((d) => `${d.name}（${d.qty} 份）`)
          .join("、") +
        "。",
    );
  }
  if (f.lowMargin.length) {
    highlights.push(
      `毛利偏低：` +
        f.lowMargin.map((d) => `${d.name}（${d.margin}%）`).join("、") +
        "，建议核算配方或调整定价。",
    );
  }
  if (f.wasteRatioPct >= 3) {
    highlights.push(
      `损耗占比 ${f.wasteRatioPct.toFixed(1)}% 偏高，需要按品类排查报损原因。`,
    );
  }
  if (f.stocktake.count > 0) {
    highlights.push(
      `盘点 ${f.stocktake.count} 次，差异 ${f.stocktake.diffs} 项，净差异 ${fmtMoney(
        f.stocktake.netValue,
      )}。`,
    );
  }
  if (f.staff.created > 0) {
    highlights.push(
      `员工任务 ${f.staff.created} 项，完成/提交 ${f.staff.done} 项（${f.staff.donePct}%）。`,
    );
  }
  if (highlights.length === 0) highlights.push("本期没有明显异常。");

  const next =
    nextActions.length > 0
      ? nextActions.slice(0, 3)
      : [
          "保持当前备货与排班节奏",
          "继续维护菜单图片和多语言",
          "下周同一时间再做一次复盘",
        ];

  return { summary, highlights, next };
}

/** AI 复盘提示词 */
export function reviewPrompt(
  f: ReviewFacts,
  nextActions: string[] = [],
): { system: string; user: string } {
  const system = [
    "你是餐厅老板的经营分析师。",
    "根据本期数据写一份简洁复盘，结构固定为三段：",
    "一、本期结论（营收/订单/成本/损耗，带环比）；二、亮点与问题（2-3 条，带具体菜品或品类）；三、下期重点（2-3 条可执行动作）。",
    "总字数 350 字以内，只使用给出的数据，不编造；只输出复盘正文。",
  ].join("\n");
  const user = [
    `周期：${f.label}（${f.range.start.slice(0, 10)} ~ ${f.range.end.slice(0, 10)}）`,
    `营业额 ${fmtMoney(f.revenue)}（环比 ${f.revenueChangePct >= 0 ? "+" : ""}${f.revenueChangePct}%，上期 ${fmtMoney(f.prevRevenue)}）`,
    `订单 ${f.orders}（上期 ${f.prevOrders}），客单价 ${fmtMoney(f.aov)}（上期 ${fmtMoney(f.prevAov)}）`,
    `食材成本率 ${f.foodCostRate.toFixed(1)}%（上期 ${f.prevFoodCostRate.toFixed(1)}%）`,
    `损耗 ${fmtMoney(f.waste)}（占比 ${f.wasteRatioPct.toFixed(1)}%），采购支出 ${fmtMoney(f.purchaseAmount)}`,
    f.topDishes.length
      ? `热销：` + f.topDishes.map((d) => `${d.name} ${d.qty} 份`).join("、")
      : "热销：无数据",
    f.lowMargin.length
      ? `毛利偏低：` +
        f.lowMargin.map((d) => `${d.name} ${d.margin}%`).join("、")
      : "",
    `盘点 ${f.stocktake.count} 次，差异 ${f.stocktake.diffs} 项，净差异 ${fmtMoney(f.stocktake.netValue)}`,
    `员工任务 ${f.staff.created} 项，完成/提交 ${f.staff.done} 项（${f.staff.donePct}%）`,
    nextActions.length
      ? `系统建议的下期重点：\n- ${nextActions.join("\n- ")}`
      : "",
    "",
    "请输出复盘。",
  ]
    .filter(Boolean)
    .join("\n");
  return { system, user };
}
