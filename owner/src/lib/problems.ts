import { fmtMoney } from "./format";
import { num, type InventoryItem } from "./inventory";
import type { PriceAlert } from "./priceAlert";
import type { LateOrder } from "./lateOrders";

/* ============ 问题池 ============
 * 把各模块的异常（采购价/低库存/损耗/漏单/盘点）聚合成统一问题，
 * 按「影响金额 × 可执行性 × 紧急度」排序，首页只推最大的一个。
 */

export type ProblemLevel = "high" | "warn" | "info";
export type ProblemKind = "price" | "waste" | "late" | "low" | "stocktake";

export interface EvidenceItem {
  label: string;
  value: string;
}

export interface Problem {
  id: string;
  kind: ProblemKind;
  title: string;
  desc: string;
  /** 影响金额（元），不可量化传 0 */
  impact: number;
  level: ProblemLevel;
  urgency: number;
  actionable: number;
  evidence: EvidenceItem[];
  suggestion: string;
  tab: string;
  score: number;
}

export interface ProblemsInput {
  priceAlerts: PriceAlert[];
  low: InventoryItem[];
  todayWaste: number;
  late: LateOrder[];
  stocktakeDue: boolean;
}

/** 金额对数化 + 1，避免单一巨额问题完全压过其它问题 */
const moneyScore = (impact: number) =>
  impact > 0 ? Math.log10(impact + 1) : 0;

export function problemScore(
  impact: number,
  urgency: number,
  actionable: number,
): number {
  return (moneyScore(impact) + 1) * urgency * actionable;
}

export function buildProblems(input: ProblemsInput): Problem[] {
  const out: Omit<Problem, "score">[] = [];

  if (input.late.length > 0) {
    const total = input.late.reduce((s, l) => s + num(l.total), 0);
    const maxOver = Math.max(...input.late.map((l) => l.overdueMin));
    out.push({
      id: "late",
      kind: "late",
      title: `${input.late.length} 笔订单已超时`,
      desc: `最久超时 ${maxOver} 分钟，影响出餐与口碑`,
      impact: total,
      level: "high",
      urgency: 0.95,
      actionable: 0.9,
      evidence: input.late.slice(0, 3).map((l) => ({
        label: l.label,
        value: `${l.kindLabel} ${l.elapsedMin}分 · ${fmtMoney(l.total)}`,
      })),
      suggestion: "立即接单并推进出餐",
      tab: "orders",
    });
  }

  for (const a of input.priceAlerts) {
    if (a.level !== "high" && a.level !== "warn") continue;
    const lastQty = num(a.recent[a.recent.length - 1]?.quantity ?? 0);
    const diff = num(a.current) - num(a.baseline);
    const impact = Math.abs(diff) * (lastQty || 1);
    out.push({
      id: `price:${a.itemId}`,
      kind: "price",
      title: `采购价${diff >= 0 ? "上涨" : "下降"}：${a.itemName}`,
      desc: `${fmtMoney(a.baseline)}/${a.unit} → ${fmtMoney(a.current)}/${a.unit}`,
      impact,
      level: a.level === "high" ? "high" : "warn",
      urgency: diff > 0 ? 0.7 : 0.4,
      actionable: 0.8,
      evidence: [
        { label: "现价", value: fmtMoney(a.current) },
        { label: "历史中位", value: fmtMoney(a.baseline) },
        {
          label: "幅度",
          value: `${a.changePct >= 0 ? "+" : ""}${Math.round(a.changePct * 100)}%`,
        },
      ],
      suggestion:
        diff > 0
          ? "比价换供应商，或与供应商议价"
          : "价格异常偏低，核对数量与品质",
      tab: "procurement",
    });
  }

  if (input.low.length > 0) {
    const outOfStock = input.low.filter((i) => num(i.stock) <= 0);
    const gap = input.low.reduce(
      (s, i) =>
        s + Math.max(0, num(i.safety_stock) - num(i.stock)) * num(i.price),
      0,
    );
    out.push({
      id: "low",
      kind: "low",
      title: `${input.low.length} 种原料低于安全库存`,
      desc: outOfStock.length
        ? `其中 ${outOfStock.length} 种已断货`
        : "按安全库存测算缺口",
      impact: gap,
      level: outOfStock.length ? "high" : "warn",
      urgency: outOfStock.length ? 0.9 : 0.5,
      actionable: 0.9,
      evidence: input.low.slice(0, 5).map((i) => ({
        label: i.name,
        value: `${num(i.stock)}${i.unit}（安全 ${num(i.safety_stock)}）`,
      })),
      suggestion: "到采购页按采购计划一键补货",
      tab: "inventory",
    });
  }

  if (input.todayWaste > 0) {
    out.push({
      id: "waste",
      kind: "waste",
      title: `今日已损耗 ${fmtMoney(input.todayWaste)}`,
      desc: "损耗计入食材成本，超出每日定额即异常",
      impact: input.todayWaste,
      level: "warn",
      urgency: 0.5,
      actionable: 0.6,
      evidence: [{ label: "今日损耗", value: fmtMoney(input.todayWaste) }],
      suggestion: "到损耗分析查看原因分布",
      tab: "waste",
    });
  }

  if (input.stocktakeDue) {
    out.push({
      id: "stocktake",
      kind: "stocktake",
      title: "该盘点了",
      desc: "距上次盘点已超周期，差异无法归因",
      impact: 0,
      level: "info",
      urgency: 0.4,
      actionable: 0.8,
      evidence: [{ label: "周期", value: "7 天" }],
      suggestion: "A 类食材优先盘点",
      tab: "inventory",
    });
  }

  return out
    .map((p) => ({
      ...p,
      score: problemScore(p.impact, p.urgency, p.actionable),
    }))
    .sort((a, b) => b.score - a.score);
}

export function topProblem(problems: Problem[]): Problem | null {
  return problems[0] ?? null;
}
