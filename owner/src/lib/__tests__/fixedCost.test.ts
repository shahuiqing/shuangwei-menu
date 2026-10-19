import { describe, it, expect } from "vitest";
import {
  dailyFixedCost,
  fixedCostForRange,
  breakEvenRevenue,
  netProfit,
  newFixedCost,
  type FixedCost,
} from "../fixedCost";

const fc = (p: Partial<FixedCost>): FixedCost => ({
  id: "fc1",
  name: "房租",
  category: "房租",
  amount: 3000,
  startDate: "2026-01",
  note: "",
  ...p,
});

describe("dailyFixedCost", () => {
  it("月金额按当月天数摊到每日", () => {
    // 2026-10 有 31 天
    const d = new Date(2026, 9, 15);
    expect(dailyFixedCost([fc({ amount: 3100 })], d)).toBeCloseTo(100);
  });

  it("二月按实际天数摊（28 天）", () => {
    const d = new Date(2026, 1, 10); // 2026-02
    expect(dailyFixedCost([fc({ amount: 2800 })], d)).toBeCloseTo(100);
  });

  it("生效月之后才计入（未来月份不计）", () => {
    const d = new Date(2026, 9, 15); // 2026-10
    const costs = [
      fc({ id: "a", startDate: "2026-01", amount: 3100 }),
      fc({ id: "b", startDate: "2026-11", amount: 3100 }), // 未来月
    ];
    expect(dailyFixedCost(costs, d)).toBeCloseTo(100);
  });

  it("多个成本项累加", () => {
    const d = new Date(2026, 9, 15);
    const costs = [
      fc({ id: "a", amount: 3100 }),
      fc({ id: "b", category: "人工", amount: 3100 }),
    ];
    expect(dailyFixedCost(costs, d)).toBeCloseTo(200);
  });

  it("忽略非正金额", () => {
    const d = new Date(2026, 9, 15);
    expect(dailyFixedCost([fc({ amount: 0 })], d)).toBe(0);
  });
});

describe("fixedCostForRange", () => {
  it("7 天闭区间 = 7 天摊派", () => {
    const start = new Date(2026, 9, 1).getTime();
    const end = new Date(2026, 9, 7, 23, 59).getTime();
    expect(fixedCostForRange([fc({ amount: 3100 })], start, end)).toBeCloseTo(
      700,
    );
  });

  it("当天只到一半也按 1 天计（与「今天」区间一致）", () => {
    const start = new Date(2026, 9, 15, 0, 0).getTime();
    const end = new Date(2026, 9, 15, 14, 30).getTime();
    expect(fixedCostForRange([fc({ amount: 3100 })], start, end)).toBeCloseTo(
      100,
    );
  });

  it("跨月时各月按自己的天数摊派", () => {
    const start = new Date(2026, 8, 1).getTime();
    const end = new Date(2026, 9, 2, 23, 59).getTime();
    const expected = 30 * (3000 / 30) + 2 * (3000 / 31);
    expect(
      fixedCostForRange(
        [fc({ amount: 3000, startDate: "2026-09" })],
        start,
        end,
      ),
    ).toBeCloseTo(expected, 4);
  });

  it("生效月之前的区间不计入", () => {
    const start = new Date(2026, 8, 1).getTime();
    const end = new Date(2026, 8, 30, 23, 59).getTime();
    expect(fixedCostForRange([fc({ startDate: "2026-10" })], start, end)).toBe(
      0,
    );
  });

  it("无成本项或非法区间返回 0", () => {
    expect(fixedCostForRange([], 0, Date.now())).toBe(0);
    expect(fixedCostForRange([fc({})], 100, 99)).toBe(0);
  });
});

describe("breakEvenRevenue", () => {
  it("固定成本 ÷ (1 − 成本率)", () => {
    expect(breakEvenRevenue(3000, 0.5)).toBeCloseTo(6000);
  });

  it("成本率 0 时为固定成本本身", () => {
    expect(breakEvenRevenue(3000, 0)).toBeCloseTo(3000);
  });

  it("成本率过高时钳制，不出现负数/除零", () => {
    expect(breakEvenRevenue(3000, 1.2)).toBeGreaterThan(0);
    expect(Number.isFinite(breakEvenRevenue(3000, 1))).toBe(true);
  });
});

describe("netProfit", () => {
  it("营收 − 食材 − 损耗 − 固定成本", () => {
    expect(netProfit(10000, 3200, 180, 200)).toBeCloseTo(6420);
  });
});

describe("newFixedCost", () => {
  it("默认分类「其他」、生效月为当前月", () => {
    const c = newFixedCost();
    expect(c.category).toBe("其他");
    expect(/^\d{4}-\d{2}$/.test(c.startDate)).toBe(true);
  });
});
