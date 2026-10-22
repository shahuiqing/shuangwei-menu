import { describe, it, expect } from "vitest";
import {
  buildMenuAddonMap,
  categoryStats,
  dishStats,
  itemAddons,
  itemRevenue,
  itemUnitTotal,
  lineRevenue,
  orderComputedTotal,
  parsePrice,
} from "../analytics";

/* 老板反馈回归：加口味后单据/报表不显示配菜加价。
 * 口径：(菜品单价 + Σ 配菜单价) × 数量，配菜单价以订单行 addons 快照为准。
 */

const order = (items: any[], total?: number) => ({
  id: "o1",
  status: "completed",
  orderTag: "normal",
  items,
  total:
    total ??
    items.reduce(
      (s, it) => s + (Number(it.price) || 0) * (it.quantity || 1),
      0,
    ),
});

const beverage = {
  id: "d1",
  name: "柠檬薄荷茶",
  quantity: 2,
  price: 20,
  addons: [{ id: "a1", name: "大杯", price: 5 }],
};

describe("parsePrice", () => {
  it("数字/价签字符串/空值都能归一化", () => {
    expect(parsePrice(75)).toBe(75);
    expect(parsePrice("MAD75")).toBe(75);
    expect(parsePrice("12.5")).toBe(12.5);
    expect(parsePrice("")).toBe(0);
    expect(parsePrice(undefined)).toBe(0);
    expect(parsePrice("abc")).toBe(0);
    expect(parsePrice(NaN)).toBe(0);
  });
});

describe("配菜金额口径", () => {
  it("无配菜：按菜品单价 × 数量", () => {
    const it1 = { name: "沙拉", quantity: 3, price: 30 };
    expect(itemAddons(it1)).toEqual([]);
    expect(itemUnitTotal(it1)).toBe(30);
    expect(itemRevenue(it1)).toBe(90);
  });

  it("有配菜：单价含配菜，行金额再乘数量", () => {
    expect(itemUnitTotal(beverage)).toBe(25);
    expect(itemRevenue(beverage)).toBe(50);
  });

  it("多个配菜累加", () => {
    const it1 = {
      name: "牛肉面",
      quantity: 1,
      price: 60,
      addons: [
        { id: "a", name: "加面", price: 5 },
        { id: "b", name: "加蛋", price: 3 },
      ],
    };
    expect(itemUnitTotal(it1)).toBe(68);
    expect(itemRevenue(it1)).toBe(68);
  });

  it("配菜 price=0 不改变金额", () => {
    const it1 = {
      name: "咖啡",
      quantity: 1,
      price: 18,
      addons: [{ id: "a", name: "少冰", price: 0 }],
    };
    expect(itemRevenue(it1)).toBe(18);
  });

  it("老订单没有 addons 字段 / 字段非数组都安全", () => {
    expect(itemRevenue({ name: "老菜", quantity: 2, price: 15 })).toBe(30);
    expect(
      itemRevenue({ name: "老菜", quantity: 2, price: 15, addons: null }),
    ).toBe(30);
    expect(
      itemRevenue({ name: "老菜", quantity: 2, price: 15, addons: "x" }),
    ).toBe(30);
    expect(itemRevenue({ name: "老菜", quantity: 2, price: "MAD15" })).toBe(30);
    expect(itemRevenue({})).toBe(0);
    expect(itemRevenue(null)).toBe(0);
  });

  it("legacy 字符串价格的配菜也能解析", () => {
    const it1 = {
      name: "茶",
      quantity: 1,
      price: "MAD20",
      addons: [{ id: "a", name: "大杯", price: "MAD5" }],
    };
    expect(itemRevenue(it1)).toBe(25);
  });
});

describe("菜单定义回退", () => {
  const settings = {
    categories: [
      {
        id: "c1",
        name: "饮品",
        items: [
          {
            id: "d1",
            title: "柠檬薄荷茶",
            price: "MAD20",
            addons: [{ id: "a1", name: "大杯", price: 5 }],
          },
          { id: "d2", title: "沙拉", price: "MAD30" },
        ],
      },
    ],
  };
  const map = buildMenuAddonMap(settings);

  it("快照优先于菜单定义", () => {
    const it1 = {
      name: "柠檬薄荷茶",
      quantity: 1,
      price: 20,
      addons: [{ id: "a2", name: "小杯", price: 2 }],
    };
    expect(lineRevenue(it1, map)).toBe(22);
  });

  it("老订单缺快照时回退菜单定义", () => {
    const legacy = { name: "柠檬薄荷茶", quantity: 2, price: 20 };
    expect(lineRevenue(legacy, map)).toBe(50);
    // 没有配菜的菜不受影响
    expect(lineRevenue({ name: "沙拉", quantity: 1, price: 30 }, map)).toBe(30);
    // 菜单里没有的菜按原价
    expect(lineRevenue({ name: "未知菜", quantity: 1, price: 10 }, map)).toBe(
      10,
    );
  });

  it("没有菜单映射时等同于 itemRevenue", () => {
    const legacy = { name: "柠檬薄荷茶", quantity: 2, price: 20 };
    expect(lineRevenue(legacy)).toBe(40);
    expect(lineRevenue(legacy)).toBe(itemRevenue(legacy));
  });

  it("settings 缺失/畸形时返回空映射", () => {
    expect(buildMenuAddonMap(null).size).toBe(0);
    expect(buildMenuAddonMap({}).size).toBe(0);
    expect(buildMenuAddonMap({ categories: "x" }).size).toBe(0);
  });
});

describe("订单/菜品汇总", () => {
  it("逐行累加 == 含配菜的整单金额", () => {
    const o = order([beverage, { name: "沙拉", quantity: 1, price: 30 }], 80);
    expect(orderComputedTotal(o)).toBe(80);
  });

  it("dishStats 营收含配菜加价", () => {
    const stats = dishStats([order([beverage], 50)]);
    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({ name: "柠檬薄荷茶", qty: 2, revenue: 50 });
  });

  it("dishStats 非营收订单（退菜/赠送）不计入", () => {
    const o = { ...order([beverage], 50), orderTag: "refund" };
    expect(dishStats([o])).toEqual([]);
  });

  it("categoryStats 营收含配菜加价", () => {
    const catMap = new Map([["柠檬薄荷茶", "饮品"]]);
    const stats = categoryStats([order([beverage], 50)], catMap);
    expect(stats[0]).toMatchObject({ name: "饮品", qty: 2, revenue: 50 });
  });
});
