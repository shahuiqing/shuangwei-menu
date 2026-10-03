import { describe, it, expect } from "vitest";
import { buildTodos, namesPreview, type TodoInput } from "../todo";
import type { InventoryItem } from "../inventory";
import type { PriceAlert } from "../priceAlert";

const item = (name: string, stock: number, safety = 2): InventoryItem => ({
  id: name,
  name,
  category: "食材",
  stock,
  unit: "kg",
  safety_stock: safety,
  price: 10,
});

const alert = (
  name: string,
  level: PriceAlert["level"],
  changePct: number,
): PriceAlert => ({
  itemId: name,
  itemName: name,
  unit: "kg",
  current: 20,
  baseline: 15,
  weightedAvg: 16,
  changePct,
  level,
  sampleCount: 5,
  daysSinceLast: 1,
  supplierCount: 1,
  priceMin: 14,
  priceMax: 20,
  spark: [],
  recent: [],
  supplierAvg: [],
});

const base: TodoInput = {
  low: [],
  priceAlerts: [],
  todayWaste: 0,
  pendingOrders: 0,
};

describe("buildTodos", () => {
  it("无异常时返回空数组", () => {
    expect(buildTodos(base)).toEqual([]);
  });

  it("四项都有时按权重倒序：待接单 > 低库存 > 价格异常 > 损耗", () => {
    const list = buildTodos({
      low: [item("牛肉")],
      priceAlerts: [alert("牛肉", "warn", 0.2)],
      todayWaste: 30,
      pendingOrders: 2,
    });
    expect(list.map((t) => t.id)).toEqual([
      "pending",
      "stock",
      "price",
      "waste",
    ]);
    expect(list.every((t) => t.tab && t.badge && t.title && t.desc)).toBe(true);
  });

  it("待接单与断货为 high，断货优先级提示更醒目", () => {
    const list = buildTodos({
      low: [item("盐", 0), item("糖", 0), item("油", 5)],
      pendingOrders: 1,
      priceAlerts: [],
      todayWaste: 0,
    });
    expect(list.find((t) => t.id === "pending")!.level).toBe("high");
    expect(list.find((t) => t.id === "stock")!.level).toBe("high");
    expect(list.find((t) => t.id === "stock")!.desc).toContain("已断货");
    expect(list.find((t) => t.id === "stock")!.weight).toBeGreaterThan(80);
  });

  it("仅低库存未断货时为 warn", () => {
    const list = buildTodos({ ...base, low: [item("牛肉", 1, 2)] });
    expect(list[0].level).toBe("warn");
    expect(list[0].desc).not.toContain("已断货");
  });

  it("价格异常含 high 等级时升级为 high", () => {
    const withHigh = buildTodos({
      ...base,
      priceAlerts: [alert("牛肉", "high", 0.5)],
    });
    expect(withHigh[0].level).toBe("high");
    const withWarn = buildTodos({
      ...base,
      priceAlerts: [alert("牛肉", "warn", 0.2)],
    });
    expect(withWarn[0].level).toBe("warn");
  });

  it("今日损耗为 info 级，金额写进标题", () => {
    const list = buildTodos({ ...base, todayWaste: 128 });
    expect(list).toHaveLength(1);
    expect(list[0].level).toBe("info");
    expect(list[0].title).toContain("128");
    expect(list[0].tab).toBe("waste");
  });
});

describe("namesPreview", () => {
  it("超 3 个折叠为「等 N 个」", () => {
    expect(namesPreview(["a", "b", "c", "d", "e"])).toBe("a、b、c 等 5 个");
    expect(namesPreview(["a", "b"])).toBe("a、b");
    expect(namesPreview([])).toBe("");
  });
});
