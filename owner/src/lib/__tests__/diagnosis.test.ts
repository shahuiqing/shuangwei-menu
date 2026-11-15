import { describe, it, expect } from "vitest";
import {
  buildRuleDiagnosis,
  diagnosisPrompt,
  type DiagnosisFacts,
} from "../diagnosis";

const base: DiagnosisFacts = {
  revenue: 5000,
  orders: 60,
  aov: 83.3,
  foodCost: 1500,
  foodCostRate: 30,
  profit: 3500,
  waste: 0,
  lowStock: [],
  priceAlerts: [],
  pendingTasks: 0,
  overdueTasks: 0,
  pendingStocktakes: 0,
  pendingRequests: 0,
};

describe("规则版经营诊断", () => {
  it("按优先级排序：补货 → 价格 → 成本 → 损耗 → 业绩 → 员工", () => {
    const lines = buildRuleDiagnosis({
      ...base,
      foodCostRate: 42,
      waste: 88,
      lowStock: [{ name: "牛肉", stock: 1, unit: "kg", safety: 5 }],
      priceAlerts: [{ name: "洋葱", pct: 12.5 }],
      pendingTasks: 4,
      overdueTasks: 2,
      pendingStocktakes: 3,
      pendingRequests: 2,
    });
    const text = lines.join("\n");
    expect(lines[0]).toContain("补货优先");
    expect(lines[0]).toContain("牛肉");
    expect(text).toContain("核对采购价");
    expect(text).toContain("42.0%");
    expect(text).toContain("损耗");
    expect(text).toContain("员工协同");
    expect(text).toContain("逾期 2");
    expect(text).toContain("盘点待提交 3");
    expect(text).toContain("采购申报待审批 2");
    expect(lines.length).toBeLessThanOrEqual(6);
  });

  it("成本率正常时给出正向提示", () => {
    const lines = buildRuleDiagnosis(base);
    expect(lines.join("")).toContain("成本率 30.0% 处于正常区间");
  });

  it("全部正常时给兜底建议，不会返回空", () => {
    const lines = buildRuleDiagnosis({
      ...base,
      revenue: 0,
      orders: 0,
      aov: 0,
      foodCost: 0,
      foodCostRate: 0,
      profit: 0,
    });
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toContain("正常");
  });

  it("最多 6 条", () => {
    const lines = buildRuleDiagnosis({
      ...base,
      foodCostRate: 45,
      waste: 100,
      lowStock: [{ name: "牛肉", stock: 0, unit: "kg", safety: 5 }],
      priceAlerts: [{ name: "洋葱", pct: 20 }],
      pendingTasks: 5,
      overdueTasks: 3,
      pendingStocktakes: 2,
      pendingRequests: 4,
    });
    expect(lines).toHaveLength(6);
  });
});

describe("LLM 诊断提示词", () => {
  it("包含结构化事实与输出格式约束", () => {
    const { system, user } = diagnosisPrompt({
      ...base,
      lowStock: [{ name: "牛肉", stock: 1, unit: "kg", safety: 5 }],
      priceAlerts: [{ name: "洋葱", pct: 12.5 }],
      pendingTasks: 4,
      overdueTasks: 1,
      pendingStocktakes: 2,
      pendingRequests: 3,
    });
    expect(system).toContain("3-5 条");
    expect(system).toContain("动词开头");
    expect(system).toContain("1. ");
    expect(user).toContain("营业额");
    expect(user).toContain("牛肉");
    expect(user).toContain("洋葱+12.5%");
    expect(user).toContain("待完成 4");
    expect(user).toContain("采购申报待审批 3");
  });

  it("库存正常时明确写无缺货", () => {
    const { user } = diagnosisPrompt(base);
    expect(user).toContain("库存正常");
    expect(user).toContain("采购价无异常");
  });
});
