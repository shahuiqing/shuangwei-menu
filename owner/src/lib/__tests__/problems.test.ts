import { describe, it, expect } from "vitest";
import { buildProblems, topProblem, problemScore } from "../problems";
import type { PriceAlert } from "../priceAlert";
import type { LateOrder } from "../lateOrders";

const late = (total: number, overdueMin: number): LateOrder => ({
  id: String(overdueMin),
  label: "A12",
  status: "pending",
  kindLabel: "待接单",
  thresholdMin: 10,
  elapsedMin: 10 + overdueMin,
  overdueMin,
  total,
});

const alert = (over: Partial<PriceAlert>): PriceAlert =>
  ({
    itemId: "a",
    itemName: "牛肉",
    unit: "kg",
    current: 60,
    baseline: 50,
    weightedAvg: 52,
    changePct: 0.2,
    level: "warn",
    sampleCount: 5,
    daysSinceLast: 1,
    supplierCount: 2,
    priceMin: 40,
    priceMax: 60,
    spark: [],
    recent: [{ id: "p", at: "x", supplier: "A", unitPrice: 60, quantity: 10 }],
    supplierAvg: [],
    ...over,
  }) as PriceAlert;

const empty = {
  priceAlerts: [],
  low: [],
  todayWaste: 0,
  late: [],
  stocktakeDue: false,
};

describe("buildProblems", () => {
  it("无信号时为空", () => {
    expect(buildProblems(empty)).toEqual([]);
    expect(topProblem(buildProblems(empty))).toBeNull();
  });

  it("漏单排最前（高影响高紧急）", () => {
    const p = buildProblems({ ...empty, late: [late(300, 20)] });
    expect(topProblem(p)!.kind).toBe("late");
    expect(topProblem(p)!.impact).toBe(300);
  });

  it("采购价异常带证据与建议", () => {
    const p = buildProblems({ ...empty, priceAlerts: [alert({})] });
    const top = topProblem(p)!;
    expect(top.kind).toBe("price");
    expect(top.evidence.length).toBe(3);
    expect(top.suggestion).toBeTruthy();
    expect(top.impact).toBe(100); // |60-50| * 10
  });

  it("低库存与损耗也能生成问题", () => {
    const p = buildProblems({
      ...empty,
      low: [
        {
          id: "i",
          name: "土豆",
          category: "食材",
          stock: 0,
          unit: "kg",
          safety_stock: 20,
          price: 2,
        },
      ],
      todayWaste: 40,
    });
    const kinds = p.map((x) => x.kind);
    expect(kinds).toContain("low");
    expect(kinds).toContain("waste");
  });

  it("盘点提醒为 info 级、零影响", () => {
    const p = buildProblems({ ...empty, stocktakeDue: true });
    expect(topProblem(p)!.kind).toBe("stocktake");
    expect(topProblem(p)!.impact).toBe(0);
  });
});

describe("problemScore", () => {
  it("影响越大、越紧急、越可执行则越高", () => {
    expect(problemScore(1000, 0.9, 0.9)).toBeGreaterThan(
      problemScore(10, 0.9, 0.9),
    );
    expect(problemScore(100, 0.9, 0.9)).toBeGreaterThan(
      problemScore(100, 0.1, 0.9),
    );
  });
});
