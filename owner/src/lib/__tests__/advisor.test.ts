import { describe, it, expect } from "vitest";
import { buildAdvice, advisorPrompt, AREA_LABEL } from "../advisor";
import { snapshotToPrompt, type BusinessSnapshot } from "../aiContext";

const base: BusinessSnapshot = {
  generatedAt: "2026-11-15T12:00:00.000Z",
  today: "2026-11-15",
  sales: {
    today: { revenue: 5000, orders: 60, aov: 83.3 },
    week: { revenue: 35000, orders: 420, aov: 83.3 },
  },
  menu: {
    top: [{ name: "羊肉串", qty: 120, revenue: 2400 }],
    slow: [{ name: "凉拌黄瓜", qty: 2, revenue: 30 }],
    lowMargin: [{ name: "羊肉串", margin: 18, qty: 120, revenue: 2400 }],
  },
  cost: { foodCostRate: 31, foodCost: 1550, profit: 3450 },
  inventory: {
    low: [{ name: "牛肉", stock: 1, unit: "kg", safety: 5 }],
    expiring: [{ name: "生菜", daysLeft: 1 }],
    totalValue: 12000,
  },
  purchasing: {
    weekAmount: 8000,
    rising: [{ name: "洋葱", pct: 12.5 }],
    suppliers: 3,
  },
  waste: { today: 40, week: 260, ratioPct: 0.8 },
  stocktake: {
    last: { day: "2026-11-14", items: 12, diffs: 2, netValue: -45.5 },
    pendingToday: 3,
  },
  staff: { pendingTasks: 4, overdueTasks: 1, pendingRequests: 2 },
};

describe("经营顾问建议 · 规则版", () => {
  it("按紧急度排序：断货与临期最前", () => {
    const advice = buildAdvice(base, new Date("2026-11-15T12:00:00").getTime());
    expect(advice[0]!.area).toBe("inventory");
    expect(advice[0]!.priority).toBeLessThanOrEqual(advice[1]!.priority);
    expect(advice[0]!.title).toContain("补断货");
    expect(advice.map((a) => a.area)).toContain("menu");
    expect(advice.map((a) => a.area)).toContain("purchase");
    expect(advice.map((a) => a.area)).toContain("stocktake");
    expect(advice.map((a) => a.area)).toContain("staff");
  });

  it("每条建议包含发现、动作和跳转目标", () => {
    const advice = buildAdvice(base);
    for (const a of advice) {
      expect(a.finding.length).toBeGreaterThan(0);
      expect(a.actions.length).toBeGreaterThan(0);
      expect(a.tab.length).toBeGreaterThan(0);
      expect(AREA_LABEL[a.area]).toBeTruthy();
    }
  });

  it("成本率过高时给出成本板块建议", () => {
    const advice = buildAdvice({
      ...base,
      cost: { ...base.cost, foodCostRate: 45 },
    });
    const cost = advice.find((a) => a.area === "cost");
    expect(cost).toBeDefined();
    expect(cost!.finding).toContain("45.0%");
    expect(cost!.actions.join("")).toContain("配方");
  });

  it("损耗率过高时提示查损耗原因", () => {
    const advice = buildAdvice({
      ...base,
      waste: { today: 100, week: 1200, ratioPct: 4.2 },
    });
    const waste = advice.find((a) => a.area === "waste");
    expect(waste).toBeDefined();
    expect(waste!.finding).toContain("4.2%");
  });

  it("临近收档且营业额明显偏低才提示销售问题", () => {
    const quiet: BusinessSnapshot = {
      ...base,
      inventory: { ...base.inventory, low: [], expiring: [] },
      menu: { top: [], slow: [], lowMargin: [] },
      purchasing: { ...base.purchasing, rising: [] },
      stocktake: { last: null, pendingToday: 0 },
      staff: { pendingTasks: 0, overdueTasks: 0, pendingRequests: 0 },
      cost: { ...base.cost, foodCostRate: 31 },
      waste: { today: 0, week: 0, ratioPct: 0 },
      sales: {
        ...base.sales,
        today: { revenue: 500, orders: 6, aov: 83 },
      },
    };
    const night = new Date("2026-11-15T21:00:00").getTime();
    expect(buildAdvice(quiet, night).some((a) => a.area === "sales")).toBe(
      true,
    );

    const noon = new Date("2026-11-15T12:00:00").getTime();
    expect(buildAdvice(quiet, noon).some((a) => a.area === "sales")).toBe(
      false,
    );
  });

  it("最多 7 条", () => {
    const advice = buildAdvice(
      {
        ...base,
        cost: { ...base.cost, foodCostRate: 45 },
        waste: { today: 100, week: 1200, ratioPct: 4.2 },
        staff: { pendingTasks: 5, overdueTasks: 3, pendingRequests: 2 },
      },
      new Date("2026-11-15T21:00:00").getTime(),
    );
    expect(advice.length).toBeLessThanOrEqual(7);
  });
});

describe("经营顾问建议 · AI 提示词", () => {
  it("要求按板块输出结论、动作与影响", () => {
    const { system, user } = advisorPrompt(base);
    expect(system).toContain("经营顾问");
    expect(system).toContain("按板块分段");
    expect(system).toContain("预期影响");
    expect(system).toContain("400 字");
    expect(user).toContain(snapshotToPrompt(base).split("\n")[0]!);
    expect(user).toContain("牛肉");
  });
});
