import { describe, it, expect } from "vitest";
import { buildTicketHtml } from "../print-lite";

/* 老板反馈回归：加菜单/结账单必须显示配菜 +价格与逐菜小计。 */

const orderWithAddons = {
  id: "o1",
  orderNumber: "ORD-1",
  table_no: "5",
  customerName: "桌5",
  timestamp: "2026-10-20T12:00:00.000Z",
  total: 110,
  items: [
    {
      id: "d1",
      name: "柠檬薄荷茶",
      quantity: 2,
      price: 20,
      addons: [{ id: "a1", name: "大杯", price: 5 }],
    },
    { id: "d2", name: "鸡肉沙拉", quantity: 1, price: 60 },
    {
      id: "d3",
      name: "加菜：薯条",
      quantity: 1,
      price: 5,
      isAdded: true,
      addons: [{ id: "a2", name: "加芝士", price: 5 }],
    },
  ],
};

const stripHtml = (html: string) =>
  html
    .replace(/<style>[\s\S]*?<\/style>/g, "")
    .replace(/<script>[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

describe("结账单 buildTicketHtml('receipt')", () => {
  const text = stripHtml(buildTicketHtml(orderWithAddons, "receipt"));

  it("逐菜行小计含配菜：(20+5)*2 = 50", () => {
    expect(text).toContain("柠檬薄荷茶");
    expect(text).toContain("x2");
    expect(text).toContain("50");
  });

  it("配菜行显示 +价格", () => {
    expect(text).toContain("大杯");
    expect(text).toContain("+5");
  });

  it("无配菜菜品只显示菜品单价小计", () => {
    expect(text).toContain("鸡肉沙拉");
    expect(text).toContain("60");
  });

  it("底部合计取整单金额", () => {
    expect(text).toContain("合计");
    expect(text).toContain("110");
  });

  it("标题标记为结账单", () => {
    expect(text).toContain("结账单");
  });
});

describe("加菜单 buildTicketHtml('addition')", () => {
  const text = stripHtml(buildTicketHtml(orderWithAddons, "addition"));

  it("只列后加的菜", () => {
    expect(text).toContain("薯条");
    expect(text).not.toContain("鸡肉沙拉");
  });

  it("加菜单也显示配菜 +价格与行小计（含配菜）", () => {
    expect(text).toContain("加芝士");
    expect(text).toContain("+5");
    // (5 + 5) * 1
    expect(text).toContain("10");
  });

  it("底部显示加菜小计", () => {
    expect(text).toContain("加菜小计");
    expect(text).toContain("ADDITION TOTAL");
  });

  it("默认 ticketType 是结账单（向后兼容 printOrder(order)）", () => {
    expect(stripHtml(buildTicketHtml(orderWithAddons))).toContain("结账单");
  });
});

describe("加菜单：只有 additions 记录时", () => {
  it("按 additions[].items 菜名匹配加菜行", () => {
    const o = {
      id: "o2",
      items: [
        { name: "主菜A", quantity: 1, price: 40 },
        { name: "主菜B", quantity: 1, price: 30 },
      ],
      additions: [{ items: [{ name: "主菜B", quantity: 1 }], timestamp: "" }],
      total: 70,
    };
    const text = stripHtml(buildTicketHtml(o, "addition"));
    expect(text).toContain("主菜B");
    expect(text).not.toContain("主菜A");
  });

  it("没有任何加菜记录时退化为整单（不印空白纸）", () => {
    const o = {
      id: "o3",
      items: [{ name: "主菜A", quantity: 1, price: 40 }],
      total: 40,
    };
    const text = stripHtml(buildTicketHtml(o, "addition"));
    expect(text).toContain("主菜A");
    expect(text).toContain("加菜小计");
  });
});

describe("老订单只读兼容", () => {
  it("没有 addons 字段不抛错，按原价出单", () => {
    const o = {
      id: "old",
      items: [{ name: "老菜", quantity: 2, price: 15 }],
      total: 30,
    };
    expect(() => buildTicketHtml(o, "receipt")).not.toThrow();
    const text = stripHtml(buildTicketHtml(o, "receipt"));
    expect(text).toContain("老菜");
    expect(text).toContain("30");
  });

  it("items 缺失也不抛错", () => {
    expect(() => buildTicketHtml({ id: "x" }, "receipt")).not.toThrow();
    expect(stripHtml(buildTicketHtml({ id: "x" }, "receipt"))).toContain(
      "本单没有菜品明细",
    );
  });

  it("配菜 price=0 不显示 +0（免费配菜只显示名字）", () => {
    const o = {
      id: "free",
      items: [
        {
          name: "咖啡",
          quantity: 1,
          price: 18,
          addons: [{ id: "a", name: "少冰", price: 0 }],
        },
      ],
      total: 18,
    };
    const text = stripHtml(buildTicketHtml(o, "receipt"));
    expect(text).toContain("少冰");
    expect(text).not.toContain("+0");
  });
});
