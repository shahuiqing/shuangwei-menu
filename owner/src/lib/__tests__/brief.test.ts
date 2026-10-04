import { describe, it, expect } from "vitest";
import { buildDailyBrief } from "../brief";
import { ask, PRESET_QUESTIONS } from "../assistant";

const base = {
  storeName: "双味居",
  dateLabel: "今天",
  revenue: 5000,
  orders: 60,
  aov: 83.3,
  foodCost: 1500,
  foodCostRate: 30,
  waste: 40,
  topProblem: null,
};

describe("每日简报", () => {
  it("模板填充关键指标", () => {
    const lines = buildDailyBrief(base);
    expect(lines[0]).toContain("双味居");
    expect(lines[0]).toContain("简报");
    expect(lines.join("")).toContain("营业额");
    expect(lines.join("")).toContain("成本率 30.0%");
    expect(lines.join("")).toContain("无异常问题");
  });

  it("有损耗与最大问题时体现", () => {
    const lines = buildDailyBrief({
      ...base,
      waste: 120,
      topProblem: "3 笔订单已超时",
    });
    expect(lines.join("")).toContain("损耗");
    expect(lines.join("")).toContain("3 笔订单已超时");
  });
});

describe("经营问答", () => {
  const d = { ...base, profit: 3500, topProblem: "采购价上涨：牛肉" };

  it("按关键词回答对应指标", () => {
    expect(ask("今天营业额多少", d)).toContain("5,000");
    expect(ask("食材成本率如何", d)).toContain("30.0%");
    expect(ask("今天有没有损耗", d)).toContain("40");
    expect(ask("赚了多少利润", d)).toContain("3,500");
    expect(ask("有什么问题", d)).toContain("采购价上涨：牛肉");
  });

  it("未命中时给出引导，空输入有兜底", () => {
    expect(ask("", d)).toContain("问我");
    expect(ask("随便聊点什么", d)).toContain(PRESET_QUESTIONS[0]);
  });
});
