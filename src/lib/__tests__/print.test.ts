import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import {
  TOTALS_TOLERANCE,
  buildLines,
  computedTotal,
  formatAmount,
  normalizeAddons,
  printReceipt,
  renderReceiptHtml,
  resolveOrderTotals,
  resolveTicketLayout,
  toAmount,
} from "../print";
import { buildOrderTicket, buildTestTicket, ticketToText } from "../escpos";

const receiptSettings = {
  storeName: "炙·双味居",
  showStoreName: true,
  showDate: false,
  showQrCode: false,
  fontSize: "14px",
  columnWidth: "58mm",
  footerText1: "",
  footerText2: "",
  topLogoUrl: "",
  bottomLogoUrl: "",
  printLanguages: ["zh"],
};

const addon = (name: string, price: unknown) => ({
  id: `addon-${name}`,
  name,
  price,
});

const html = (
  order: any,
  extra: Partial<Parameters<typeof renderReceiptHtml>[2]> = {},
) => renderReceiptHtml(order, receiptSettings, { currency: "MAD", ...extra });

describe("toAmount / formatAmount：价格归一化", () => {
  it("接受数字、带前缀的字符串、空值与 NaN", () => {
    expect(toAmount(75)).toBe(75);
    expect(toAmount("75")).toBe(75);
    expect(toAmount("MAD75")).toBe(75);
    expect(toAmount("MAD 75.50")).toBe(75.5);
    expect(toAmount("¥1,250")).toBe(1250);
    expect(toAmount(undefined)).toBe(0);
    expect(toAmount(null)).toBe(0);
    expect(toAmount("")).toBe(0);
    expect(toAmount("MAD")).toBe(0);
    expect(toAmount(Number.NaN)).toBe(0);
    expect(toAmount(Infinity)).toBe(0);
  });

  it("展示金额不出现浮点长尾", () => {
    expect(formatAmount(0.1 + 0.2)).toBe("0.3");
    expect(formatAmount(50)).toBe("50");
    expect(formatAmount("MAD75")).toBe("75");
  });
});

describe("normalizeAddons：老订单与脏数据兜底", () => {
  it("addons 缺失（老订单）时返回空数组", () => {
    expect(normalizeAddons(undefined)).toEqual([]);
    expect(normalizeAddons(null)).toEqual([]);
  });

  it("addons 不是数组时不抛错", () => {
    expect(normalizeAddons("x" as any)).toEqual([]);
    expect(normalizeAddons({} as any)).toEqual([]);
  });

  it("price 为字符串 / NaN / null 时安全归一", () => {
    const list = normalizeAddons([
      { id: "a", name: "加辣", price: "MAD10" as any },
      { id: "b", name: "加芝士", price: Number.NaN as any },
      { id: "c", name: "免费", price: null as any },
    ]);
    expect(list).toEqual([
      { id: "a", name: "加辣", price: 10 },
      { id: "b", name: "加芝士", price: 0 },
      { id: "c", name: "免费", price: 0 },
    ]);
  });
});

describe("buildLines：逐行口径 = (菜品单价 + 配菜单价) × 数量", () => {
  it("无配菜订单", () => {
    const lines = buildLines([
      { id: "d1", name: "羊肉串", price: 50, quantity: 2 },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.lineSubtotal).toBe(100);
    expect(lines[0]!.addonUnitTotal).toBe(0);
  });

  it("有配菜订单：单价 + 配菜再乘数量", () => {
    const lines = buildLines([
      {
        id: "d1",
        name: "牛肉饭",
        price: 60,
        quantity: 2,
        addons: [addon("加辣", 5), addon("加芝士", "MAD3" as any)],
      },
    ]);
    expect(lines[0]!.addonUnitTotal).toBe(8);
    expect(lines[0]!.lineSubtotal).toBe((60 + 8) * 2);
  });

  it("同菜品不同口味是两行；同口味才合并", () => {
    const lines = buildLines([
      {
        id: "d1",
        name: "牛肉饭",
        price: 60,
        quantity: 1,
        addons: [addon("加辣", 5)],
      },
      {
        id: "d1",
        name: "牛肉饭",
        price: 60,
        quantity: 1,
        addons: [addon("加辣", 5)],
      },
      {
        id: "d1",
        name: "牛肉饭",
        price: 60,
        quantity: 1,
        addons: [addon("加芝士", 3)],
      },
      { id: "d1", name: "牛肉饭", price: 60, quantity: 1 },
    ]);
    expect(lines).toHaveLength(3);
    const spicy = lines.find((l) => l.addons.some((a) => a.name === "加辣"))!;
    expect(spicy.quantity).toBe(2);
    expect(spicy.lineSubtotal).toBe(65 * 2);
  });

  it("脏数据（null / 字符串条目 / 负数量）不抛错", () => {
    expect(() =>
      buildLines([
        null,
        undefined,
        "x",
        0,
        { name: "", price: "MAD", quantity: -3 },
      ]),
    ).not.toThrow();
    expect(buildLines("not-an-array" as any)).toEqual([]);
  });
});

describe("resolveOrderTotals：金额口径裁决", () => {
  // (60 + 5) × 2 = 130，羊肉串 50 × 1 = 50 → 逐菜合计 180
  const items = [
    {
      id: "d1",
      name: "牛肉饭",
      price: 60,
      quantity: 2,
      addons: [addon("加辣", 5)],
    },
    { id: "d2", name: "羊肉串", price: 50, quantity: 1 },
  ];
  const COMPUTED = 180;

  it("order.total 一致时采用 order.total", () => {
    const r = resolveOrderTotals({ items, total: COMPUTED });
    expect(r.computedTotal).toBe(COMPUTED);
    // 逐菜合计 == 声明的 total → 无差异
    expect(r.mismatch).toBe(false);
    expect(r.total).toBe(COMPUTED);
  });

  it("order.total 与逐菜一致时沿用（容差内）", () => {
    const r = resolveOrderTotals({ items, total: COMPUTED });
    expect(r.computedTotal).toBe(COMPUTED);
    const ok = resolveOrderTotals({
      items,
      total: COMPUTED + TOTALS_TOLERANCE / 2,
    });
    expect(ok.mismatch).toBe(false);
    expect(ok.total).toBeCloseTo(COMPUTED + TOTALS_TOLERANCE / 2);
    expect(r.declaredTotal).toBe(COMPUTED);
  });

  it("order.total 存在差异时以逐菜为准并标记 mismatch", () => {
    const r = resolveOrderTotals({ items, total: 100 });
    expect(r.mismatch).toBe(true);
    expect(r.total).toBe(r.computedTotal);
    expect(r.total).toBe(COMPUTED);
  });

  it("order.total 缺失 / 空字符串时用逐菜值且不算 mismatch", () => {
    for (const total of [undefined, null, ""]) {
      const r = resolveOrderTotals({ items, total });
      expect(r.total).toBe(COMPUTED);
      expect(r.mismatch).toBe(false);
      expect(r.declaredTotal).toBeNull();
    }
  });

  it("部分单据（加菜单只传加菜行）不会被判 mismatch", () => {
    const addition = {
      items: [
        { id: "d3", name: "加菜", price: 20, quantity: 1, isAdded: true },
      ],
      total: 20,
    };
    const r = resolveOrderTotals(addition, { itemCount: 3 });
    expect(r.isPartial).toBe(true);
    expect(r.mismatch).toBe(false);
    expect(r.total).toBe(20);
  });

  it("computedTotal 是逐行小计之和", () => {
    expect(computedTotal(items)).toBe(COMPUTED);
  });
});

describe("resolveTicketLayout：加菜单 / 厨房单 / 结账单", () => {
  it("加菜单即使被标记为厨房单也必须显示金额", () => {
    const layout = resolveTicketLayout(true, "addition");
    expect(layout.isAddition).toBe(true);
    expect(layout.showAmounts).toBe(true);
  });

  it("厨房单不显示金额", () => {
    expect(resolveTicketLayout(true, undefined).showAmounts).toBe(false);
    expect(resolveTicketLayout(false, "kitchen").showAmounts).toBe(false);
    expect(resolveTicketLayout(true, "kitchen").showAmounts).toBe(false);
  });

  it("结账单显示金额", () => {
    expect(resolveTicketLayout(false, undefined).showAmounts).toBe(true);
    expect(resolveTicketLayout(undefined, "receipt").showAmounts).toBe(true);
  });
});

describe("renderReceiptHtml 结账单（receipt）", () => {
  const order = {
    customerName: "桌号_3",
    orderNumber: "ORD-1",
    items: [
      {
        id: "d1",
        name: "牛肉饭",
        price: 60,
        quantity: 2,
        addons: [addon("加辣", 5), addon("免费香菜", 0)],
      },
      { id: "d2", name: "羊肉串", price: 50, quantity: 1 },
    ],
    total: 180,
  };

  it("逐菜显示小计（含配菜），配菜行显示 +¥单价", () => {
    const { html: out, totals } = html(order);
    expect(out).toContain("牛肉饭");
    // 行小计 = (60+5+0) * 2
    expect(out).toContain("MAD130");
    expect(out).toContain("MAD50");
    expect(out).toContain("+ 加辣 +MAD5");
    expect(totals.total).toBe(180);
  });

  it("addon.price = 0（免费）不显示 +¥0", () => {
    const { html: out } = html(order);
    expect(out).toContain("+ 免费香菜");
    expect(out).not.toContain("+MAD0");
    expect(out).not.toMatch(/免费香菜[^<]*\+MAD0/);
  });

  it("逐菜小计之和 == 底部合计（total 不一致时以逐菜为准）", () => {
    const { html: out, totals } = html(order);
    expect(totals.computedTotal).toBe(180);
    expect(totals.mismatch).toBe(false);
    expect(out).toContain("原价 (Original):</strong> MAD180");

    const bad = html({ ...order, total: 999 });
    expect(bad.totals.mismatch).toBe(true);
    expect(bad.totals.total).toBe(180);
    // 底部不打印错误的 999
    expect(bad.html).toContain("原价 (Original):</strong> MAD180");
    expect(bad.html).not.toContain("MAD999");
  });

  it("老订单无 addons 字段不抛错且金额正确", () => {
    const legacy = {
      customerName: "老订单",
      items: [
        { name: "旧菜1", price: "MAD50" as any, quantity: 2 },
        { name: "旧菜2", price: 30, quantity: 1 },
      ],
      total: 130,
    };
    let out = "";
    expect(() => {
      out = html(legacy).html;
    }).not.toThrow();
    expect(out).toContain("MAD100");
    expect(out).toContain("MAD30");
    expect(out).toContain("原价 (Original):</strong> MAD130");
  });

  it("addons 里 price 是字符串 / NaN 时不产生 NaN 金额", () => {
    const dirty = {
      items: [
        {
          name: "脏数据菜",
          price: 40,
          quantity: 1,
          addons: [
            { id: "a", name: "字符串价", price: "MAD7" as any },
            { id: "b", name: "坏价", price: Number.NaN as any },
          ],
        },
      ],
      total: 47,
    };
    const r = html(dirty);
    expect(r.html).not.toContain("NaN");
    expect(r.totals.total).toBe(47);
    expect(r.html).toContain("+ 字符串价 +MAD7");
  });

  it("无 cusomerName / 空 items 不抛错", () => {
    expect(() => html({})).not.toThrow();
    expect(html({}).totals.total).toBe(0);
  });
});

describe("renderReceiptHtml 加菜单（addition）—— 本次修复的核心", () => {
  const addition = {
    customerName: "桌号_3",
    orderNumber: "ORD-1",
    items: [
      {
        id: "d1",
        name: "牛肉饭",
        price: 60,
        quantity: 2,
        isAdded: true,
        addons: [addon("加辣", 5)],
      },
      {
        id: "d2",
        name: "烤鸡翅",
        price: 30,
        quantity: 1,
        isAdded: true,
        addons: [addon("加蜜", 4)],
      },
    ],
    total: 159,
  };

  it("加菜单显示配菜 +价格、行数量与行小计（不再被当厨房单隐藏）", () => {
    const {
      html: out,
      layout,
      totals,
    } = html(addition, { ticketType: "addition" });
    expect(layout.isAddition).toBe(true);
    expect(layout.showAmounts).toBe(true);

    expect(out).toContain("+ 加辣 +MAD5");
    expect(out).toContain("+ 加蜜 +MAD4");
    // 行小计 (60+5)*2 = 130、(30+4)*1 = 34
    expect(out).toContain("MAD130");
    expect(out).toContain("MAD34");
    expect(out).toContain("x2");
    expect(totals.computedTotal).toBe(164);
    expect(totals.total).toBe(164);
  });

  it("加菜单底部显示「加菜小计 ADDITION TOTAL」", () => {
    const { html: out, totalLabel } = html(addition, {
      ticketType: "addition",
    });
    expect(totalLabel).toContain("加菜小计");
    expect(out).toContain("加菜小计 (Addition Total)");
    expect(out).toContain("加菜小计 (Addition Total):</strong> MAD164");
  });

  it("被标记为厨房单 + addition 时仍然显示金额（回归点）", () => {
    const { html: out, layout } = html(addition, {
      ticketType: "addition",
      isKitchenTicket: true,
    });
    expect(layout.showAmounts).toBe(true);
    expect(out).toContain("+ 加辣 +MAD5");
    expect(out).toContain("加菜小计");
  });

  it("加菜单 header 显示「加菜单 / Additions」", () => {
    expect(html(addition, { ticketType: "addition" }).html).toContain(
      "加菜单 / Additions",
    );
  });

  it("加菜单里免费配菜不显示 +MAD0", () => {
    const freeAddition = {
      items: [
        {
          name: "牛肉饭",
          price: 60,
          quantity: 1,
          isAdded: true,
          addons: [addon("免费香菜", 0)],
        },
      ],
      total: 60,
    };
    const { html: out } = html(freeAddition, { ticketType: "addition" });
    expect(out).toContain("+ 免费香菜");
    expect(out).not.toContain("+MAD0");
  });

  it("加菜单 total 是加菜金额时不被误判 mismatch", () => {
    // 调用方把「整单 total」误传给加菜单（历史值），逐菜口径仍以加菜行为准
    const { totals } = html(addition, {
      ticketType: "addition",
      itemCount: 5,
      partial: true,
    });
    expect(totals.total).toBe(164);
  });
});

describe("renderReceiptHtml 厨房单（kitchen）", () => {
  const order = {
    items: [
      {
        id: "d1",
        name: "牛肉饭",
        price: 60,
        quantity: 2,
        addons: [addon("加辣", 5)],
      },
      {
        id: "d2",
        name: "加菜羊肉串",
        price: 50,
        quantity: 1,
        isAdded: true,
      },
    ],
    total: 180,
  };

  it("厨房单不显示任何金额（保留后厨特性）", () => {
    const {
      html: out,
      layout,
      totals,
    } = html(order, { isKitchenTicket: true });
    expect(layout.isKitchen).toBe(true);
    expect(layout.showAmounts).toBe(false);
    expect(out).not.toContain("原价 (Original)");
    expect(out).not.toContain("MAD");
    expect(out).not.toContain("+MAD5");
    expect(out).toContain("厨房单 / Kitchen Ticket");
    // 配菜仍要打印（后厨要知道口味），只是不带价格
    expect(out).toContain("+ 加辣");
    expect(totals.total).toBe(180);
  });

  it("厨房单 ticketType=kitchen 与 isKitchenTicket=true 等价", () => {
    expect(html(order, { ticketType: "kitchen" }).layout.isKitchen).toBe(true);
  });

  it("整单厨房单区分「加菜」分段，不影响加菜单", () => {
    const { html: out } = html(order, { isKitchenTicket: true });
    expect(out).toContain("--- 加菜 / Additions ---");
  });
});

describe("printReceipt：写入 iframe 并调用打印（jsdom）", () => {
  let printMock: ReturnType<typeof vi.fn>;
  const originalPrint = window.print;

  beforeEach(() => {
    vi.useFakeTimers();
    printMock = vi.fn();
    window.print = printMock as any;
  });

  afterEach(() => {
    window.print = originalPrint;
    vi.useRealTimers();
  });

  it("加菜单写入的 HTML 含配菜加价与加菜小计", () => {
    printReceipt(
      {
        items: [
          {
            name: "牛肉饭",
            price: 60,
            quantity: 1,
            isAdded: true,
            addons: [addon("加辣", 5)],
          },
        ],
        total: 65,
      },
      "MAD",
      receiptSettings,
      false,
      "addition",
    );

    const iframe = document.getElementById(
      "print-receipt-iframe",
    ) as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    const written =
      iframe.contentWindow?.document.documentElement.innerHTML || "";
    expect(written).toContain("+ 加辣 +MAD5");
    expect(written).toContain("加菜小计");

    // 触发 iframe 内的打印（替换 contentWindow.print）
    if (iframe.contentWindow) iframe.contentWindow.print = printMock as any;
    vi.runOnlyPendingTimers();
    expect(printMock).toHaveBeenCalledTimes(1);
  });
});

describe("escpos.buildOrderTicket：USB/POS 打印同口径", () => {
  const addition = {
    customerName: "桌号_3",
    orderNumber: "ORD-1",
    items: [
      {
        id: "d1",
        name: "牛肉饭",
        price: 60,
        quantity: 2,
        isAdded: true,
        addons: [{ id: "a", name: "加辣", price: 5 }],
      },
    ],
    total: 130,
  };

  const text = (order: any, ticketType: "kitchen" | "addition" | "receipt") =>
    ticketToText(
      buildOrderTicket(order, receiptSettings as any, ticketType, "MAD"),
    );

  it("加菜单显示行小计、配菜 +价与「加菜小计」", () => {
    const out = text(addition, "addition");
    expect(out).toContain("加菜单 / Additions");
    expect(out).toContain("MAD130");
    expect(out).toContain("+MAD5");
    expect(out).toContain("加菜小计: MAD130");
  });

  it("厨房单不显示金额（含配菜价格）", () => {
    const out = text(addition, "kitchen");
    expect(out).toContain("厨房单 / Kitchen");
    expect(out).toContain("+ 加辣");
    expect(out).not.toContain("MAD");
    expect(out).not.toContain("原价");
  });

  it("结账单显示逐菜小计（含配菜）且底部与逐菜一致", () => {
    const out = text(addition, "receipt");
    expect(out).toContain("MAD130");
    expect(out).toContain("+MAD5");
    expect(out).toContain("原价: MAD130");
  });

  it("total 与逐菜不一致时，底部以逐菜为准", () => {
    const out = text({ ...addition, total: 999 }, "receipt");
    expect(out).not.toContain("MAD999");
    expect(out).toContain("原价: MAD130");
  });

  it("addon.price = 0 不打印 +0", () => {
    const out = text(
      {
        items: [
          {
            name: "牛肉饭",
            price: 60,
            quantity: 1,
            isAdded: true,
            addons: [{ id: "z", name: "免费香菜", price: 0 }],
          },
        ],
        total: 60,
      },
      "addition",
    );
    expect(out).toContain("+ 免费香菜");
    expect(out).not.toContain("+MAD0");
  });

  it("老订单无 addons / 脏 addons 不抛错", () => {
    expect(() =>
      text(
        {
          items: [
            { name: "旧菜", price: "MAD50", quantity: 2 },
            {
              name: "坏菜",
              price: 10,
              quantity: 1,
              addons: [{ name: "坏价", price: NaN }],
            },
          ],
        },
        "receipt",
      ),
    ).not.toThrow();
    expect(
      text(
        { items: [{ name: "旧菜", price: "MAD50", quantity: 2 }] },
        "receipt",
      ),
    ).toContain("MAD100");
  });

  it("buildTestTicket 仍然可用", () => {
    const out = ticketToText(buildTestTicket(receiptSettings as any));
    expect(out).toContain("原价: MAD180");
  });
});
