import { describe, it, expect } from "vitest";
import {
  buildPurchasePlan,
  dailyFromConsumption,
  CONSUMPTION_WINDOW_DAYS,
  COVERAGE_DAYS,
} from "../purchasePlan";
import type { InventoryItem } from "../inventory";

const item = (over: Partial<InventoryItem>): InventoryItem => ({
  id: "I1",
  name: "原料",
  category: "蔬菜",
  stock: 0,
  unit: "kg",
  safety_stock: 0,
  price: 0,
  ...over,
});

describe("dailyFromConsumption", () => {
  it("按窗口天数折算日均并按原料名合并", () => {
    const m = dailyFromConsumption(
      [
        { key: "土豆", qty: 30 },
        { key: "土豆", qty: 0 },
        { key: "青菜", qty: 60 },
      ],
      30,
    );
    expect(m.get("土豆")).toBeCloseTo(1);
    expect(m.get("青菜")).toBeCloseTo(2);
  });

  it("天数下限为 1，跳过空名与非正值", () => {
    const m = dailyFromConsumption(
      [
        { key: "", qty: 10 },
        { key: "土豆", qty: -5 },
      ],
      0,
    );
    expect(m.size).toBe(0);
  });

  it("无消耗记录（RPC 未执行）返回空 map，计划退化为安全库存口径", () => {
    expect(dailyFromConsumption([], CONSUMPTION_WINDOW_DAYS).size).toBe(0);
  });
});

describe("buildPurchasePlan", () => {
  it("目标 = 安全库存 + 日均 × 覆盖天数，缺口即建议采购量", () => {
    const plan = buildPurchasePlan({
      items: [
        item({ id: "a", name: "土豆", stock: 10, safety_stock: 5, price: 3 }),
      ],
      daily: new Map([["土豆", 4]]),
      coverageDays: 7,
    });
    const r = plan.rows[0];
    expect(r.target).toBe(33); // 5 + 4*7
    expect(r.gap).toBe(23);
    expect(r.estCost).toBe(69);
    expect(r.daysLeft).toBe(2.5);
    expect(r.reason).toContain("够");
  });

  it("覆盖充足（含刚好达标）的原料不进计划", () => {
    const plan = buildPurchasePlan({
      items: [
        item({ id: "a", name: "土豆", stock: 50, safety_stock: 5 }),
        item({ id: "b", name: "青菜", stock: 5, safety_stock: 5 }),
      ],
      daily: new Map(),
      coverageDays: 7,
    });
    expect(plan.rows).toHaveLength(0);
    expect(plan.totalCost).toBe(0);
  });

  it("参考单价优先用采购中位价基线，缺失才用库存表进价", () => {
    const plan = buildPurchasePlan({
      items: [
        item({ id: "a", name: "土豆", stock: 0, safety_stock: 10, price: 3 }),
        item({ id: "b", name: "青菜", stock: 0, safety_stock: 10, price: 5 }),
      ],
      daily: new Map(),
      coverageDays: 7,
      alerts: [
        {
          itemId: "a",
          baseline: 8,
        } as any,
      ],
    });
    expect(plan.rows.find((r) => r.id === "a")?.refPrice).toBe(8);
    expect(plan.rows.find((r) => r.id === "a")?.estCost).toBe(80);
    expect(plan.rows.find((r) => r.id === "b")?.refPrice).toBe(5);
  });

  it("缺货优先于低于安全库存，同级按金额降序", () => {
    const plan = buildPurchasePlan({
      items: [
        item({ id: "low", name: "青菜", stock: 2, safety_stock: 5, price: 5 }),
        item({ id: "out1", name: "土豆", stock: 0, safety_stock: 5, price: 3 }),
        item({
          id: "out2",
          name: "牛肉",
          stock: 0,
          safety_stock: 5,
          price: 30,
        }),
      ],
      daily: new Map(),
      coverageDays: 7,
    });
    expect(plan.rows.map((r) => r.id)).toEqual(["out2", "out1", "low"]);
    expect(plan.rows[0].priority).toBe("urgent");
    expect(plan.rows[2].priority).toBe("soon");
    expect(plan.rows[2].reason).toBe("低于安全库存");
  });

  it("无消耗记录时 daysLeft 为 null，仍按安全库存给出缺口", () => {
    const plan = buildPurchasePlan({
      items: [item({ id: "a", name: "新原料", stock: 1, safety_stock: 5 })],
      daily: new Map(),
      coverageDays: 7,
    });
    expect(plan.rows[0].daysLeft).toBeNull();
    expect(plan.rows[0].gap).toBe(4);
    expect(plan.rows[0].reason).toBe("低于安全库存");
  });

  it("覆盖天数缺省按 7，非法值兜底，合计为各行金额之和", () => {
    const plan = buildPurchasePlan({
      items: [
        item({ id: "a", name: "土豆", stock: 0, safety_stock: 10, price: 3 }),
      ],
      coverageDays: 0,
    });
    expect(plan.coverageDays).toBe(7);
    expect(plan.rows[0].gap).toBe(10);
    expect(plan.totalCost).toBe(
      Math.round(plan.rows.reduce((s, r) => s + r.estCost, 0) * 100) / 100,
    );
  });

  it("覆盖天数档位固定为 3/7/14", () => {
    expect([...COVERAGE_DAYS]).toEqual([3, 7, 14]);
  });
});
