import { describe, it, expect } from "vitest";
import { detectDishDrops, costRateAnomaly } from "../anomaly";

describe("detectDishDrops", () => {
  it("近段日均较前段降幅 >= 50% 判定腰斩", () => {
    const recent = [{ name: "牛肉", qty: 3, revenue: 0 }]; // 近3天 3 份 → 日均 1
    const previous = [{ name: "牛肉", qty: 21, revenue: 0 }]; // 前7天 21 份 → 日均 3
    const drops = detectDishDrops(recent, previous, 3, 7);
    expect(drops).toHaveLength(1);
    expect(drops[0].name).toBe("牛肉");
    expect(drops[0].dropPct).toBe(67); // (3-1)/3 = 66.7%
  });

  it("前段无销量的新菜不判定", () => {
    const recent = [{ name: "新品", qty: 5, revenue: 0 }];
    const drops = detectDishDrops(recent, [], 3, 7);
    expect(drops).toHaveLength(0);
  });

  it("近段完全消失按 100% 降幅", () => {
    const recent = [{ name: "别的菜", qty: 10, revenue: 0 }];
    const previous = [
      { name: "牛肉", qty: 21, revenue: 0 },
      { name: "别的菜", qty: 10, revenue: 0 },
    ];
    const drops = detectDishDrops(recent, previous, 3, 7);
    expect(drops).toHaveLength(1);
    expect(drops[0].name).toBe("牛肉");
    expect(drops[0].dropPct).toBe(100);
  });

  it("降幅不足阈值不判定", () => {
    const recent = [{ name: "牛肉", qty: 15, revenue: 0 }]; // 日均 5
    const previous = [{ name: "牛肉", qty: 35, revenue: 0 }]; // 日均 5
    expect(detectDishDrops(recent, previous, 3, 7)).toHaveLength(0);
  });

  it("结果按降幅降序", () => {
    const recent = [
      { name: "A", qty: 1, revenue: 0 },
      { name: "B", qty: 10, revenue: 0 },
    ];
    const previous = [
      { name: "A", qty: 14, revenue: 0 }, // 降 83%
      { name: "B", qty: 30, revenue: 0 }, // 降 67%
    ];
    const drops = detectDishDrops(recent, previous, 3, 7);
    expect(drops[0].name).toBe("A");
  });
});

describe("costRateAnomaly", () => {
  it("涨幅 >= 5 个百分点判定异常", () => {
    expect(costRateAnomaly(38, 32)).toBe(true);
    expect(costRateAnomaly(35, 32)).toBe(false);
    expect(costRateAnomaly(37, 32, 5)).toBe(true);
  });
});
