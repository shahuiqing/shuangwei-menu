import { num } from "./inventory";

/* ============ 计算引擎 + 指标字典 ============
 * 全系统统一口径的指标定义与纯计算函数（无副作用，便于测试与复用）。
 */

export interface MetricDef {
  key: string;
  label: string;
  unit: string;
  formula: string;
  desc: string;
}

/** 指标字典：口径唯一来源 */
export const METRIC_DEFS: MetricDef[] = [
  {
    key: "revenue",
    label: "营业额",
    unit: "元",
    formula: "结账金额（finalTotal / total）",
    desc: "实收口径，退菜/折扣订单需先清洗剔除",
  },
  {
    key: "theoreticalConsumption",
    label: "理论消耗",
    unit: "最小单位",
    formula: "Σ(菜品销量 × 配方用量)",
    desc: "按标准配方反推的用料量",
  },
  {
    key: "actualConsumption",
    label: "实际消耗",
    unit: "最小单位",
    formula: "期初 + 采购 − 期末",
    desc: "以盘点为锚的真实用量",
  },
  {
    key: "inventoryVariance",
    label: "库存差异",
    unit: "最小单位",
    formula: "理论消耗 − 实际消耗",
    desc: "正值=多耗（疑似浪费/漏记），负值=少耗",
  },
  {
    key: "movingAverageCost",
    label: "移动加权平均成本",
    unit: "元/最小单位",
    formula: "Σ(采购金额) ÷ Σ(采购数量)",
    desc: "每次采购后自动更新，作为损耗/盘点差异计价基准",
  },
  {
    key: "foodCost",
    label: "食材成本",
    unit: "元",
    formula: "实际消耗 × 移动加权平均成本",
    desc: "真实食材消耗的金额",
  },
  {
    key: "foodCostRate",
    label: "食材成本率",
    unit: "%",
    formula: "食材成本 ÷ 营业额",
    desc: "越低越好；不同业态参考区间不同",
  },
  {
    key: "dishContribution",
    label: "菜品贡献",
    unit: "元",
    formula: "售价 − 理论直接成本",
    desc: "单份毛利（未摊人工房租等间接成本）",
  },
  {
    key: "operatingProfit",
    label: "经营利润",
    unit: "元",
    formula: "营业额 − 食材 − 人工 − 房租 − 水电 − 佣金",
    desc: "日常经营口径净利润（未含折旧/税费）",
  },
];

export function metricDoc(key: string): MetricDef | undefined {
  return METRIC_DEFS.find((m) => m.key === key);
}

/* ---------- 纯计算 ---------- */

export interface PurchaseLine {
  quantity: number;
  total_cost?: number;
  unit_price?: number;
}

/** 移动加权平均成本：Σ金额 ÷ Σ数量 */
export function movingAverageCost(lines: PurchaseLine[]): number {
  let qty = 0;
  let cost = 0;
  for (const l of lines || []) {
    const q = num(l.quantity);
    if (q <= 0) continue;
    qty += q;
    cost += num(l.total_cost ?? 0) || q * num(l.unit_price);
  }
  return qty > 0 ? cost / qty : 0;
}

export interface ItemFlows {
  opening: number;
  purchased: number;
  closing: number;
}

/** 实际消耗 = 期初 + 采购 − 期末 */
export function actualConsumption(f: ItemFlows): number {
  return num(f.opening) + num(f.purchased) - num(f.closing);
}

/** 库存差异 = 理论消耗 − 实际消耗 */
export function inventoryVariance(theoretical: number, actual: number): number {
  return num(theoretical) - num(actual);
}

/** 食材成本 = 实际消耗 × 移动加权平均成本 */
export function foodCost(actual: number, avgCost: number): number {
  return num(actual) * num(avgCost);
}

/** 食材成本率（%） */
export function foodCostRate(cost: number, revenue: number): number {
  return num(revenue) > 0 ? (num(cost) / num(revenue)) * 100 : 0;
}

/** 菜品贡献 = 售价 − 理论直接成本 */
export function dishContribution(price: number, unitCost: number): number {
  return num(price) - num(unitCost);
}

export interface OperatingCosts {
  revenue: number;
  food: number;
  labor: number;
  rent: number;
  utilities: number;
  commission: number;
  other?: number;
}

/** 经营利润 = 营业额 − 各成本项 */
export function operatingProfit(c: OperatingCosts): number {
  return (
    num(c.revenue) -
    num(c.food) -
    num(c.labor) -
    num(c.rent) -
    num(c.utilities) -
    num(c.commission) -
    num(c.other ?? 0)
  );
}
