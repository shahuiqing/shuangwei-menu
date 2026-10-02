import { describe, it, expect } from "vitest";
import {
  restockSuggestions,
  costImpactForPriceChange,
  lowStockItems,
  inventoryValue,
  type InventoryItem,
  type RecipeBom,
} from "../inventory";

const item = (
  id: string,
  stock: number,
  safety: number,
  price: number,
): InventoryItem => ({
  id,
  name: id,
  category: "食材",
  stock,
  unit: "kg",
  safety_stock: safety,
  price,
});

describe("stock helpers", () => {
  const list = [
    item("牛肉", 2, 5, 60),
    item("盐", 10, 5, 4),
    item("米", 0, 0, 8),
  ];

  it("lowStockItems 仅含设置安全库存且低于者", () => {
    const low = lowStockItems(list);
    expect(low.map((i) => i.id)).toEqual(["牛肉"]);
  });

  it("restockSuggestions 计算缺口与预估金额并按金额降序", () => {
    const s = restockSuggestions(list);
    expect(s).toHaveLength(1);
    expect(s[0]!.gap).toBe(3);
    expect(s[0]!.estCost).toBe(180);
  });

  it("inventoryValue 汇总库存金额", () => {
    expect(inventoryValue(list)).toBe(2 * 60 + 10 * 4 + 0);
  });
});

describe("costImpactForPriceChange", () => {
  const inv = [item("牛肉", 10, 2, 60)];
  const boms: RecipeBom[] = [
    {
      id: "1",
      menu_item_name: "牛排",
      inventory_item_id: "牛肉",
      dosage: 0.25,
      unit: "kg",
    },
    {
      id: "2",
      menu_item_name: "牛汤",
      inventory_item_id: "牛肉",
      dosage: 0.1,
      unit: "kg",
    },
    {
      id: "3",
      menu_item_name: "别的菜",
      inventory_item_id: "盐",
      dosage: 1,
      unit: "kg",
    },
  ];

  it("按用量计算各菜品成本增量", () => {
    const impact = costImpactForPriceChange("牛肉", 70, boms, inv);
    const map = Object.fromEntries(impact.map((c) => [c.dish, c.delta]));
    expect(map["牛排"]).toBeCloseTo(2.5, 4); // 0.25 * 10
    expect(map["牛汤"]).toBeCloseTo(1, 4); // 0.1 * 10
    expect(map["别的菜"]).toBeUndefined();
  });

  it("价格未变或未配配方返回空", () => {
    expect(costImpactForPriceChange("牛肉", 60, boms, inv)).toEqual([]);
    // 库存中不存在、也无配方引用的原料
    expect(costImpactForPriceChange("幽灵", 99, boms, inv)).toEqual([]);
  });
});
