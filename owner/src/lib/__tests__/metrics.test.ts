import { describe, it, expect } from "vitest";
import {
  movingAverageCost,
  actualConsumption,
  inventoryVariance,
  foodCost,
  foodCostRate,
  dishContribution,
  operatingProfit,
  metricDoc,
  METRIC_DEFS,
} from "../metrics";

describe("指标字典", () => {
  it("包含计划里的核心指标，且 key 唯一", () => {
    const keys = new Set(METRIC_DEFS.map((m) => m.key));
    for (const k of [
      "revenue",
      "theoreticalConsumption",
      "actualConsumption",
      "inventoryVariance",
      "movingAverageCost",
      "foodCost",
      "foodCostRate",
      "dishContribution",
      "operatingProfit",
    ]) {
      expect(keys.has(k)).toBe(true);
    }
    expect(METRIC_DEFS.length).toBe(keys.size);
    expect(metricDoc("revenue")?.label).toBe("营业额");
    expect(metricDoc("nope")).toBeUndefined();
  });
});

describe("移动加权平均成本", () => {
  it("Σ金额÷Σ数量", () => {
    const c = movingAverageCost([
      { quantity: 10, total_cost: 30 }, // 3
      { quantity: 10, total_cost: 50 }, // 5
    ]);
    expect(c).toBe(4);
  });

  it("缺金额用 数量×单价；无有效数量返回 0", () => {
    expect(movingAverageCost([{ quantity: 2, unit_price: 7 }])).toBe(7);
    expect(movingAverageCost([])).toBe(0);
    expect(movingAverageCost([{ quantity: 0, total_cost: 5 }])).toBe(0);
  });
});

describe("实际消耗 / 差异 / 食材成本", () => {
  it("期初 + 采购 − 期末", () => {
    expect(
      actualConsumption({ opening: 100, purchased: 40, closing: 60 }),
    ).toBe(80);
  });

  it("差异 = 理论 − 实际", () => {
    expect(inventoryVariance(90, 80)).toBe(10);
    expect(inventoryVariance(80, 90)).toBe(-10);
  });

  it("食材成本 = 实际 × 均价", () => {
    expect(foodCost(80, 4)).toBe(320);
  });
});

describe("食材成本率 / 菜品贡献 / 经营利润", () => {
  it("成本率按营业额", () => {
    expect(foodCostRate(320, 1600)).toBe(20);
    expect(foodCostRate(100, 0)).toBe(0);
  });

  it("菜品贡献 = 售价 − 成本", () => {
    expect(dishContribution(38, 12)).toBe(26);
  });

  it("经营利润扣减全部成本项", () => {
    expect(
      operatingProfit({
        revenue: 5000,
        food: 1500,
        labor: 1000,
        rent: 800,
        utilities: 200,
        commission: 100,
      }),
    ).toBe(1400);
  });
});
