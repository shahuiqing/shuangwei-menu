import { describe, it, expect } from "vitest";
import {
  matchRequestToItem,
  requestsByItem,
  mergeRequestsIntoPlan,
  buildPurchasePlan,
  type RequestLike,
} from "../purchasePlan";

const items = [
  {
    id: "i1",
    name: "洋葱",
    category: "蔬菜",
    stock: 2,
    safety_stock: 5,
    unit: "kg",
    price: 3,
  },
  {
    id: "i2",
    name: "冷冻牛肉",
    category: "肉类",
    stock: 10,
    safety_stock: 3,
    unit: "kg",
    price: 60,
  },
  {
    id: "i3",
    name: "洗手液",
    category: "耗材",
    stock: 1,
    safety_stock: 2,
    unit: "瓶",
    price: 15,
  },
];

describe("matchRequestToItem · 申报名称匹配库存", () => {
  it("精确匹配", () => {
    expect(matchRequestToItem("洋葱", items)).toBe("i1");
  });

  it("忽略空格与大小写", () => {
    expect(matchRequestToItem(" 冷冻牛肉 ", items)).toBe("i2");
  });

  it("申报名是物品名的一部分（包含匹配）", () => {
    expect(matchRequestToItem("牛肉", items)).toBe("i2");
    expect(matchRequestToItem("冷冻牛", items)).toBe("i2");
  });

  it("匹配不到返回 null（待确认）", () => {
    expect(matchRequestToItem("松露", items)).toBeNull();
    expect(matchRequestToItem("", items)).toBeNull();
  });

  it("包含匹配取最短名（最贴近）候选", () => {
    const more = [
      ...items,
      {
        id: "i4",
        name: "牛肉面底汤",
        category: "调料",
        stock: 0,
        safety_stock: 1,
        unit: "L",
        price: 5,
      },
    ];
    // 「牛肉」同时命中 冷冻牛肉(4字) 与 牛肉面底汤(5字) → 取更短的
    expect(matchRequestToItem("牛肉", more)).toBe("i2");
  });
});

describe("requestsByItem · 申报聚合", () => {
  const reqs: RequestLike[] = [
    {
      id: "r1",
      item_name: "洋葱",
      quantity: 10,
      unit: "kg",
      urgency: "normal",
      staff_name: "张三",
    },
    {
      id: "r2",
      item_name: "洋葱",
      quantity: 5,
      unit: "kg",
      urgency: "urgent",
      staff_name: "李四",
    },
    {
      id: "r3",
      item_name: "松露",
      quantity: 1,
      unit: "kg",
      urgency: "normal",
      staff_name: "王五",
    },
  ];

  it("同物品合并数量/申报人/紧急标记/id 列表", () => {
    const { byItem, unmatched } = requestsByItem(reqs, items);
    const info = byItem.get("i1")!;
    expect(info.qty).toBe(15);
    expect(info.staff).toEqual(["张三", "李四"]);
    expect(info.urgent).toBe(true);
    expect(info.requestIds).toEqual(["r1", "r2"]);
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].id).toBe("r3");
  });

  it("老板手动关联的库存物品优先于名称匹配", () => {
    // 「松露」名称匹配不到，但手动关联到 i3（洗手液）后应进该项
    const { byItem, unmatched } = requestsByItem(
      [
        {
          id: "r5",
          item_name: "松露",
          quantity: 2,
          unit: "瓶",
          urgency: "normal",
          staff_name: "王五",
          inventory_item_id: "i3",
        },
      ],
      items,
    );
    expect(unmatched).toHaveLength(0);
    expect(byItem.get("i3")!.requestIds).toEqual(["r5"]);
  });
});

describe("mergeRequestsIntoPlan · 申报并入计划", () => {
  it("建议采购量取 max(缺口, 申报量)，紧急申报提优先级", () => {
    // 洋葱: target=5+0*7=5, stock=2 → gap=3；申报 15 → 建议 15
    const plan = buildPurchasePlan({ items, coverageDays: 7 });
    const { byItem } = requestsByItem(
      [
        {
          id: "r1",
          item_name: "洋葱",
          quantity: 15,
          unit: "kg",
          urgency: "urgent",
          staff_name: "张三",
        },
      ],
      items,
    );
    const merged = mergeRequestsIntoPlan(plan, byItem);
    const onion = merged.rows.find((r) => r.id === "i1")!;
    expect(onion.gap).toBe(15);
    expect(onion.requestQty).toBe(15);
    expect(onion.requestUrgent).toBe(true);
    expect(onion.requestIds).toEqual(["r1"]);
    expect(onion.priority).toBe("urgent");
    expect(onion.reason).toContain("员工申报");
    // 总成本按新 gap 重算
    expect(merged.totalCost).toBeCloseTo(
      merged.rows.reduce((s, r) => s + r.estCost, 0),
      2,
    );
  });

  it("无申报的行保持不变；申报量小于缺口时不顶替缺口", () => {
    const plan = buildPurchasePlan({ items, coverageDays: 7 });
    const { byItem } = requestsByItem(
      [
        {
          id: "r1",
          item_name: "洋葱",
          quantity: 1,
          unit: "kg",
          urgency: "normal",
          staff_name: "张三",
        },
      ],
      items,
    );
    const merged = mergeRequestsIntoPlan(plan, byItem);
    const onion = merged.rows.find((r) => r.id === "i1")!;
    expect(onion.gap).toBe(3); // max(3, 1)
    expect(onion.reason).not.toContain("员工申报");
    // 冷冻牛肉 stock=10 > target=3 → 不在计划里；无申报也不会出现
    const beef = merged.rows.find((r) => r.id === "i2");
    expect(beef).toBeUndefined();
  });

  it("申报物品库存充足、本不在计划 → 补一行进计划", () => {
    // 冷冻牛肉 stock=10 > target=3，原本不采购；员工申报 8kg 后必须进计划
    const plan = buildPurchasePlan({ items, coverageDays: 7 });
    const { byItem } = requestsByItem(
      [
        {
          id: "r9",
          item_name: "冷冻牛肉",
          quantity: 8,
          unit: "kg",
          urgency: "normal",
          staff_name: "张三",
        },
      ],
      items,
    );
    const merged = mergeRequestsIntoPlan(plan, byItem, items);
    const beef = merged.rows.find((r) => r.id === "i2")!;
    expect(beef).toBeDefined();
    expect(beef.gap).toBe(8);
    expect(beef.requestQty).toBe(8);
    expect(beef.requestIds).toEqual(["r9"]);
    expect(beef.reason).toContain("员工申报");
  });
});
