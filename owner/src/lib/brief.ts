import { fmtMoney } from "./format";

/* ============ 每日经营简报（模板 + 数据填充，纯函数） ============ */

export interface BriefInput {
  storeName: string;
  dateLabel: string;
  revenue: number;
  orders: number;
  aov: number;
  foodCost: number;
  foodCostRate: number;
  waste: number;
  topProblem: string | null;
  topDish?: { name: string; qty: number } | null;
}

export function buildDailyBrief(i: BriefInput): string[] {
  const lines: string[] = [];
  lines.push(`【${i.storeName}】${i.dateLabel}经营简报`);
  lines.push(
    `营业额 ${fmtMoney(i.revenue)}，${i.orders} 单，客单价 ${fmtMoney(i.aov)}`,
  );
  if (i.topDish && i.topDish.qty > 0) {
    lines.push(`热销「${i.topDish.name}」${i.topDish.qty} 份`);
  }
  lines.push(
    `食材成本 ${fmtMoney(i.foodCost)}（成本率 ${i.foodCostRate.toFixed(1)}%）`,
  );
  if (i.waste > 0) lines.push(`今日损耗 ${fmtMoney(i.waste)}`);
  lines.push(
    i.topProblem ? `⚠️ 最大问题：${i.topProblem}` : "✅ 今日无异常问题",
  );
  return lines;
}
