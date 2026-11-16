import { describe, it, expect } from "vitest";
import { replenishSummary, replenishNotes, replenishText } from "../replenish";
import type { PurchasePlan } from "../purchasePlan";

const plan = (over: Partial<PurchasePlan> = {}): PurchasePlan => ({
  coverageDays: 7,
  rows: [
    {
      id: "a",
      name: "牛肉",
      unit: "kg",
      stock: 0,
      safety: 5,
      dailyAvg: 3,
      daysLeft: 0,
      target: 26,
      gap: 26,
      refPrice: 40,
      estCost: 1040,
      priority: "urgent",
      reason: "缺货",
    },
    {
      id: "b",
      name: "洋葱",
      unit: "kg",
      stock: 4,
      safety: 5,
      dailyAvg: 2,
      daysLeft: 2,
      target: 19,
      gap: 15,
      refPrice: 2,
      estCost: 30,
      priority: "soon",
      reason: "低于安全库存",
      requestIds: ["r1", "r2"],
    },
    {
      id: "c",
      name: "大米",
      unit: "袋",
      stock: 10,
      safety: 4,
      dailyAvg: 1,
      daysLeft: 10,
      target: 11,
      gap: 1,
      refPrice: 60,
      estCost: 60,
      priority: "normal",
      reason: "备货",
    },
  ],
  totalCost: 1130,
  ...over,
});

describe("replenishSummary", () => {
  it("统计优先级与总成本", () => {
    const s = replenishSummary(plan());
    expect(s.total).toBe(3);
    expect(s.urgent).toBe(1);
    expect(s.soon).toBe(1);
    expect(s.normal).toBe(1);
    expect(s.totalCost).toBe(1130);
    expect(s.top[0]).toMatchObject({ name: "牛肉", priority: "紧急" });
  });

  it("统计并入与未匹配申报", () => {
    const s = replenishSummary(plan(), 2);
    expect(s.mergedRequests).toBe(2);
    expect(s.unmatchedRequests).toBe(2);
  });
});

describe("replenishNotes", () => {
  it("备注包含覆盖天数", () => {
    expect(replenishNotes(7)).toBe("AI 补货 · 覆盖 7 天");
    expect(replenishNotes(0)).toBe("AI 补货 · 覆盖 1 天");
  });
});

describe("replenishText", () => {
  it("清单包含标题、金额与逐项内容", () => {
    const t = replenishText(plan());
    expect(t).toContain("覆盖 7 天，共 3 项，预估 1,130 元");
    expect(t).toContain("1. 牛肉 26kg（紧急，约 1,040 元，缺货）");
    expect(t).toContain("洋葱");
  });
});
