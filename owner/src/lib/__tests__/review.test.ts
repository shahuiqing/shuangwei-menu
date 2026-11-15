import { describe, it, expect } from "vitest";
import {
  previousRange,
  buildReview,
  reviewPrompt,
  type ReviewFacts,
} from "../review";

const base: ReviewFacts = {
  period: "week",
  label: "近 7 天",
  range: {
    start: "2026-11-09T03:00:00.000Z",
    end: "2026-11-16T03:00:00.000Z",
  },
  revenue: 32000,
  prevRevenue: 30000,
  revenueChangePct: 6.67,
  orders: 400,
  prevOrders: 390,
  aov: 80,
  prevAov: 76.9,
  foodCostRate: 31.5,
  prevFoodCostRate: 33,
  topDishes: [
    { name: "羊肉串", qty: 320, revenue: 6400 },
    { name: "烤鱼", qty: 90, revenue: 4500 },
  ],
  lowMargin: [{ name: "羊肉串", margin: 18, qty: 320 }],
  waste: 260,
  wasteRatioPct: 0.8,
  purchaseAmount: 8000,
  stocktake: { count: 3, diffs: 5, netValue: -120 },
  staff: { created: 12, done: 10, donePct: 83 },
};

describe("周期区间", () => {
  it("上一区间与本期等长且紧邻", () => {
    const prev = previousRange(base.range.start, base.range.end);
    const span =
      new Date(base.range.end).getTime() - new Date(base.range.start).getTime();
    const prevSpan =
      new Date(prev.end).getTime() - new Date(prev.start).getTime();
    expect(Math.abs(prevSpan - span)).toBeLessThanOrEqual(1);
    expect(new Date(prev.end).getTime()).toBe(
      new Date(base.range.start).getTime() - 1,
    );
  });
});

describe("规则版复盘", () => {
  it("结论包含营收环比、成本率、损耗与采购", () => {
    const r = buildReview(base);
    const text = r.summary.join("");
    expect(text).toContain("32,000");
    expect(text).toContain("增长");
    expect(text).toContain("6.7%");
    expect(text).toContain("31.5%");
    expect(text).toContain("损耗");
    expect(text).toContain("8,000");
  });

  it("亮点包含热销、毛利、盘点与员工完成率", () => {
    const r = buildReview(base);
    const text = r.highlights.join("");
    expect(text).toContain("羊肉串");
    expect(text).toContain("毛利偏低");
    expect(text).toContain("盘点 3 次");
    expect(text).toContain("83%");
  });

  it("有下期动作时直接采用，最多 3 条", () => {
    const r = buildReview(base, ["a", "b", "c", "d"]);
    expect(r.next).toEqual(["a", "b", "c"]);
  });

  it("没有异常时也有兜底亮点", () => {
    const r = buildReview({
      ...base,
      topDishes: [],
      lowMargin: [],
      wasteRatioPct: 0,
      stocktake: { count: 0, diffs: 0, netValue: 0 },
      staff: { created: 0, done: 0, donePct: 0 },
    });
    expect(r.highlights[0]).toContain("没有明显异常");
  });
});

describe("AI 复盘提示词", () => {
  it("包含三段结构与本期数据", () => {
    const { system, user } = reviewPrompt(base, ["先补牛肉"]);
    expect(system).toContain("本期结论");
    expect(system).toContain("下期重点");
    expect(system).toContain("350 字");
    expect(user).toContain("近 7 天");
    expect(user).toContain("32,000");
    expect(user).toContain("羊肉串");
    expect(user).toContain("先补牛肉");
  });
});
