import { describe, it, expect } from "vitest";
import { buildVarianceReport, varianceSummary } from "../variance";

describe("库存差异报告", () => {
  const rows = [
    { name: "牛肉", unit: "kg", theoretical: 100, actual: 90, avgCost: 50 }, // 多耗 10 → 500
    { name: "土豆", unit: "kg", theoretical: 200, actual: 210, avgCost: 2 }, // 少耗 10 → -20
    { name: "油", unit: "L", theoretical: 30, actual: 30, avgCost: 8 }, // 0
  ];

  it("计算差异量/金额并按金额绝对值降序", () => {
    const r = buildVarianceReport(rows);
    expect(r[0].name).toBe("牛肉");
    expect(r[0].variance).toBe(10);
    expect(r[0].value).toBe(500);
    expect(r[1].name).toBe("土豆");
    expect(r[1].variance).toBe(-10);
    expect(r[1].value).toBe(-20);
    expect(r[2].variance).toBe(0);
  });

  it("汇总多耗/少耗金额", () => {
    const r = buildVarianceReport(rows);
    expect(varianceSummary(r)).toEqual({ total: 480, over: 500, under: 20 });
  });
});
