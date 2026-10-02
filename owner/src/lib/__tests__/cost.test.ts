import { describe, it, expect } from "vitest";
import { buildDishCostMap, dishMargins, sumCost } from "../cost";
import type { InventoryItem, RecipeBom } from "../inventory";

const inv: InventoryItem[] = [
  {
    id: "beef",
    name: "牛肉",
    category: "食材",
    stock: 10,
    unit: "kg",
    safety_stock: 2,
    price: 60,
  },
  {
    id: "salt",
    name: "盐",
    category: "调料",
    stock: 5,
    unit: "kg",
    safety_stock: 0,
    price: 4,
  },
  {
    id: "box",
    name: "打包盒",
    category: "耗材",
    stock: 100,
    unit: "个",
    safety_stock: 20,
    price: 0.5,
  },
];

const boms: RecipeBom[] = [
  {
    id: "1",
    menu_item_name: "炭烤牛排",
    inventory_item_id: "beef",
    dosage: 0.25,
    unit: "kg",
  },
  {
    id: "2",
    menu_item_name: "炭烤牛排",
    inventory_item_id: "salt",
    dosage: 0.01,
    unit: "kg",
  },
  {
    id: "3",
    menu_item_name: "外卖套餐",
    inventory_item_id: "beef",
    dosage: 0.2,
    unit: "kg",
  },
  {
    id: "4",
    menu_item_name: "外卖套餐",
    inventory_item_id: "box",
    dosage: 1,
    unit: "个",
  },
];

describe("buildDishCostMap", () => {
  it("按配方累加多原料成本", () => {
    const m = buildDishCostMap(boms, inv);
    // 0.25*60 + 0.01*4 = 15 + 0.04
    expect(m.get("炭烤牛排")).toBeCloseTo(15.04, 4);
    // 0.2*60 + 1*0.5 = 12.5
    expect(m.get("外卖套餐")).toBeCloseTo(12.5, 4);
  });

  it("未知原料单价按 0 计", () => {
    const m = buildDishCostMap(
      [
        {
          id: "x",
          menu_item_name: "神秘菜",
          inventory_item_id: "ghost",
          dosage: 2,
          unit: "kg",
        },
      ],
      inv,
    );
    expect(m.get("神秘菜")).toBe(0);
  });
});

describe("dishMargins", () => {
  it("计算毛利与毛利率，并标记未配配方", () => {
    const margins = dishMargins(
      [
        { name: "炭烤牛排", qty: 2, revenue: 200 },
        { name: "神秘菜", qty: 1, revenue: 30 },
      ],
      boms,
      inv,
    );
    const steak = margins.find((d) => d.name === "炭烤牛排")!;
    expect(steak.cost).toBeCloseTo(30.08, 4);
    expect(steak.profit).toBeCloseTo(169.92, 2);
    expect(steak.margin).toBeCloseTo(84.96, 1);
    expect(steak.hasCost).toBe(true);

    const unknown = margins.find((d) => d.name === "神秘菜")!;
    expect(unknown.hasCost).toBe(false);
    expect(unknown.cost).toBe(0);
    expect(unknown.profit).toBe(30);

    // 排行按毛利降序
    expect(margins[0]!.name).toBe("炭烤牛排");
  });

  it("sumCost 汇总总成本", () => {
    const margins = dishMargins(
      [{ name: "炭烤牛排", qty: 2, revenue: 200 }],
      boms,
      inv,
    );
    expect(sumCost(margins)).toBeCloseTo(30.08, 4);
  });
});
