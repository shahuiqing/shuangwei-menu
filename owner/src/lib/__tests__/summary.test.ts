import { describe, it, expect } from "vitest";
import { buildSummary, summaryLines, type SummaryInput } from "../summary";

const BASE: SummaryInput = {
  rangeLabel: "今天",
  compareLabel: "昨天",
  revenue: 1280,
  orders: 18,
  aov: 71.1,
  revenueChange: 12.4,
  topDish: { name: "宫保鸡丁", qty: 12 },
  lowCount: 3,
  priceAlertCount: 1,
  waste: 40,
  pending: 2,
  lateCount: 2,
};

describe("buildSummary 完整小结", () => {
  it("包含区间营收、环比、单量与客单价", () => {
    const s = buildSummary(BASE);
    expect(s).toContain("今天营业");
    expect(s).toContain("较昨天 +12%");
    expect(s).toContain("18 单");
    expect(s).toContain("客单价");
  });

  it("带上热销、关注项（超时/库存/采购价/损耗）", () => {
    const s = buildSummary(BASE);
    expect(s).toContain("「宫保鸡丁」12 份");
    expect(s).toContain("2 笔订单已超时");
    expect(s).toContain("3 种原料低于安全库存");
    expect(s).toContain("1 个采购价异常");
    expect(s).toContain("损耗");
    expect(s).not.toContain("暂无异常事项");
  });

  it("下降时带负号", () => {
    const s = buildSummary({ ...BASE, revenueChange: -8.6 });
    expect(s).toContain("-9%");
  });
});

describe("边界情况", () => {
  it("无异常时给出正向结论", () => {
    const s = buildSummary({
      ...BASE,
      lowCount: 0,
      priceAlertCount: 0,
      waste: 0,
      pending: 0,
      lateCount: 0,
      topDish: null,
    });
    expect(s).toContain("暂无异常事项");
    expect(s).not.toContain("热销");
  });

  it("无环比数据时不出现「较」，零营收零单量不报错", () => {
    const s = buildSummary({
      ...BASE,
      revenue: 0,
      orders: 0,
      aov: 0,
      revenueChange: null,
      topDish: null,
    });
    expect(s).not.toContain("较");
    expect(s).toContain("0 单");
  });
});

describe("summaryLines", () => {
  it("按句拆行且每行都有句号", () => {
    const lines = summaryLines(BASE);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines.every((l) => l.endsWith("。"))).toBe(true);
    expect(lines.join("")).toBe(buildSummary(BASE));
  });
});
