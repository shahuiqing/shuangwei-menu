import { describe, it, expect } from "vitest";
import {
  buildPriceAlerts,
  checkUnitPrice,
  flaggedAlerts,
  median,
  MAX_SAMPLES,
  SAMPLE_MIN,
} from "../priceAlert";
import type { PurchaseOrder } from "../inventory";

const NOW = Date.parse("2026-01-10T00:00:00Z");

const po = (
  unit_price: number,
  day: number,
  extra: Partial<PurchaseOrder> = {},
): PurchaseOrder => ({
  id: `po-${day}`,
  supplier: "老王蔬菜",
  item_id: "beef",
  item_name: "牛腩",
  quantity: 10,
  unit: "kg",
  unit_price,
  total_cost: unit_price * 10,
  purchased_at: `2026-01-${String(day).padStart(2, "0")}T08:00:00Z`,
  ...extra,
});

describe("median", () => {
  it("奇数个取中间值", () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it("偶数个取中间平均", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("空数组返回 0", () => {
    expect(median([])).toBe(0);
  });
});

describe("buildPriceAlerts", () => {
  it("涨价超 30% 标记为 high", () => {
    const alerts = buildPriceAlerts(
      [po(20, 1), po(20, 3), po(20, 5), po(20, 7), po(30, 9)],
      NOW,
    );
    expect(alerts).toHaveLength(1);
    const a = alerts[0];
    expect(a.baseline).toBe(20);
    expect(a.current).toBe(30);
    expect(a.changePct).toBeCloseTo(0.5, 5);
    expect(a.level).toBe("high");
    expect(a.sampleCount).toBeGreaterThanOrEqual(SAMPLE_MIN);
    expect(a.spark.length).toBe(5);
    expect(flaggedAlerts(alerts)).toHaveLength(1);
  });

  it("涨价 15%~30% 标记为 warn", () => {
    const alerts = buildPriceAlerts(
      [po(20, 1), po(20, 3), po(20, 5), po(24, 9)],
      NOW,
    );
    expect(alerts[0].level).toBe("warn");
    expect(alerts[0].changePct).toBeCloseTo(0.2, 5);
  });

  it("降价超 15% 也标记为 warn（异常低价）", () => {
    const alerts = buildPriceAlerts(
      [po(20, 1), po(20, 3), po(20, 5), po(16, 9)],
      NOW,
    );
    expect(alerts[0].level).toBe("warn");
    expect(alerts[0].changePct).toBeCloseTo(-0.2, 5);
  });

  it("样本不足时不判定，也不进入异常列表", () => {
    const alerts = buildPriceAlerts([po(20, 1), po(40, 9)], NOW);
    expect(alerts[0].sampleCount).toBeLessThan(SAMPLE_MIN);
    expect(alerts[0].level).toBe("sample");
    expect(flaggedAlerts(alerts)).toHaveLength(0);
  });

  it("按原料分组，只统计最近 N 笔", () => {
    const many = Array.from({ length: 20 }, (_, i) => po(20, 1));
    const other = po(30, 2, { item_id: "salt", item_name: "盐" });
    const alerts = buildPriceAlerts([...many, other], NOW);
    expect(alerts).toHaveLength(2);
    const beef = alerts.find((a) => a.itemId === "beef")!;
    expect(beef.recent.length).toBeLessThanOrEqual(MAX_SAMPLES + 1);
  });

  it("按偏离幅度排序，异常大的排在前", () => {
    const alerts = buildPriceAlerts(
      [
        po(20, 1),
        po(20, 3),
        po(20, 5),
        po(21, 7),
        po(20, 1, { item_id: "salt", item_name: "盐" }),
        po(20, 3, { item_id: "salt", item_name: "盐" }),
        po(20, 5, { item_id: "salt", item_name: "盐" }),
        po(60, 9, { item_id: "salt", item_name: "盐" }),
      ],
      NOW,
    );
    expect(alerts[0].itemId).toBe("salt");
    expect(alerts[0].changePct).toBeCloseTo(2, 5);
  });
});

describe("checkUnitPrice", () => {
  const alert = buildPriceAlerts(
    [po(20, 1), po(20, 3), po(20, 5), po(20, 7), po(20, 9)],
    NOW,
  )[0];

  it("明显高于基线给出 high 提示", () => {
    const r = checkUnitPrice(alert, 30);
    expect(r.level).toBe("high");
    expect(r.message).toContain("高出");
  });

  it("温和上涨给出 warn 提示", () => {
    const r = checkUnitPrice(alert, 24);
    expect(r.level).toBe("warn");
    expect(r.message).toContain("中位价");
  });

  it("明显低于基线提示可能填错数量", () => {
    const r = checkUnitPrice(alert, 15);
    expect(r.level).toBe("warn");
    expect(r.message).toContain("填错");
  });

  it("正常价格或无样本时不提示", () => {
    expect(checkUnitPrice(alert, 20).level).toBe("ok");
    expect(checkUnitPrice(alert, 0).message).toBe("");
    expect(checkUnitPrice(undefined, 99).level).toBe("ok");
  });
});
