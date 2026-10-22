import { describe, it, expect } from "vitest";
import {
  parseMenuPrice,
  round2,
  addonPrice,
  addonsUnitTotal,
  lineUnitTotal,
  lineSubtotal,
  orderComputedTotal,
  orderStoredTotal,
  resolveOrderTotal,
  auditOrderTotal,
  buildAddonSnapshot,
  normalizeOrderItem,
  buildOrderLineFromMenu,
  describeAddons,
  mergeOrderItems,
  cartLinesToOrderItems,
  removeOneFromLine,
} from "../utils/orderMoney";
import { makeLineKey } from "../utils/cartLine";

const menuWithAddons = {
  id: "rice-bowl",
  title: "牛肉盖饭",
  enTitle: "Beef Rice Bowl",
  price: "MAD75",
  addons: [
    { id: "egg", name: "加蛋", enName: "Extra Egg", price: 5 },
    { id: "cheese", name: "加芝士", price: 8 },
    { id: "free", name: "免加价", price: 0 },
  ],
};

const plainMenu = { id: "cola", title: "可乐", price: "15" };

describe("parseMenuPrice", () => {
  it("extracts the first number from menu price strings", () => {
    expect(parseMenuPrice("MAD75")).toBe(75);
    expect(parseMenuPrice("75")).toBe(75);
    expect(parseMenuPrice("¥28 / 份")).toBe(28);
    expect(parseMenuPrice("75.5")).toBe(75.5);
    expect(parseMenuPrice("  1200  ")).toBe(1200);
  });

  it("returns 0 for empty / illegal / negative input without throwing", () => {
    expect(parseMenuPrice("")).toBe(0);
    expect(parseMenuPrice(null)).toBe(0);
    expect(parseMenuPrice(undefined)).toBe(0);
    expect(parseMenuPrice("abc")).toBe(0);
    expect(parseMenuPrice(NaN)).toBe(0);
    expect(parseMenuPrice(Infinity)).toBe(0);
    expect(parseMenuPrice(-12)).toBe(0);
    expect(parseMenuPrice({})).toBe(0);
  });

  it("keeps numeric input as is (rounded to 2dp)", () => {
    expect(parseMenuPrice(75)).toBe(75);
    expect(parseMenuPrice(75.456)).toBe(75.46);
  });
});

describe("round2", () => {
  it("rounds without float drift", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(-0.0000001)).toBe(0);
  });
});

describe("line money with add-ons", () => {
  it("adds addon unit prices to the dish unit price", () => {
    const line = {
      id: "rice-bowl",
      name: "牛肉盖饭",
      price: 75,
      quantity: 2,
      addons: [
        { id: "egg", name: "加蛋", price: 5 },
        { id: "cheese", name: "加芝士", price: 8 },
      ],
    };
    expect(addonsUnitTotal(line.addons)).toBe(13);
    expect(lineUnitTotal(line)).toBe(88);
    expect(lineSubtotal(line)).toBe(176);
  });

  it("treats addon price 0 as free and keeps the addon name", () => {
    const line = {
      price: 75,
      quantity: 1,
      addons: [{ id: "free", name: "免加价", price: 0 }],
    };
    expect(lineUnitTotal(line)).toBe(75);
    expect(lineSubtotal(line)).toBe(75);
    expect(describeAddons(line)[0]).toBe("+ 免加价");
  });

  it("describes addon prices for the UI", () => {
    expect(
      describeAddons({
        addons: [
          { id: "egg", name: "加蛋", price: 5 },
          { id: "cheese", name: "加芝士", price: 8.5 },
        ],
      }),
    ).toEqual(["+ 加蛋 ¥5.00", "+ 加芝士 ¥8.50"]);
    expect(describeAddons({})).toEqual([]);
  });

  it("is safe for legacy rows without addons", () => {
    expect(lineUnitTotal({ price: 75, quantity: 3 })).toBe(75);
    expect(lineSubtotal({ price: 75, quantity: 3 })).toBe(225);
    expect(lineSubtotal({ name: "旧订单无价格" })).toBe(0);
    expect(lineSubtotal(null)).toBe(0);
    expect(orderComputedTotal(undefined)).toBe(0);
    expect(orderComputedTotal("nope" as any)).toBe(0);
  });

  it("is safe for string / NaN addon prices", () => {
    const messy = {
      price: "MAD75",
      quantity: "2",
      addons: [
        { id: "egg", name: "加蛋", price: "5" },
        { id: "x", name: "坏数据", price: NaN },
        { id: "y", name: "缺价格" },
        null,
      ],
    };
    expect(addonPrice({ price: "MAD5" })).toBe(5);
    expect(addonPrice(null)).toBe(0);
    expect(addonsUnitTotal(messy.addons)).toBe(5);
    expect(lineUnitTotal(messy)).toBe(80);
    expect(lineSubtotal(messy)).toBe(160);
  });

  it("ignores quantity 0 and missing quantity defaults to 1", () => {
    expect(lineSubtotal({ price: 10, quantity: 0 })).toBe(0);
    expect(lineSubtotal({ price: 10 })).toBe(10);
  });
});

describe("order level totals", () => {
  const items = [
    { id: "a", price: 75, quantity: 2, addons: [{ id: "egg", price: 5 }] },
    { id: "b", price: 15, quantity: 3 },
  ];

  it("sums lines including add-ons", () => {
    // (75+5)*2 + 15*3 = 160 + 45
    expect(orderComputedTotal(items)).toBe(205);
  });

  it("audits stored total against computed total", () => {
    const ok = auditOrderTotal({ items, total: 205 });
    expect(ok).toMatchObject({
      computed: 205,
      stored: 205,
      resolved: 205,
      mismatch: false,
    });

    // 后台加菜曾只按 item.price 记账，配菜加价丢失
    const bad = auditOrderTotal({ items, total: 195 });
    expect(bad).toMatchObject({
      computed: 205,
      stored: 195,
      resolved: 205,
      mismatch: true,
    });
    expect(bad.diff).toBe(-10);
  });

  it("trusts stored total for legacy orders without items", () => {
    expect(orderComputedTotal([])).toBe(0);
    expect(orderStoredTotal({ total_amount: 88 })).toBe(88);
    expect(resolveOrderTotal({ total: 88 })).toBe(88);
    // 没有明细无法核对，不报警，也不改动金额
    const legacy = auditOrderTotal({ total: 88 });
    expect(legacy.resolved).toBe(88);
    expect(legacy.computed).toBe(0);
    expect(resolveOrderTotal({ items, total: 195 })).toBe(205);
  });
});

describe("normalizeOrderItem / buildAddonSnapshot", () => {
  it("rebuilds addon snapshot from the menu (menu price wins)", () => {
    const row = normalizeOrderItem(
      {
        id: "rice-bowl",
        name: "牛肉盖饭",
        price: 70,
        quantity: 2,
        addons: [{ id: "egg", name: "加蛋", price: 3 }],
      },
      menuWithAddons,
    );
    expect(row.price).toBe(75);
    expect(row.addons).toEqual([{ id: "egg", name: "加蛋", price: 5 }]);
    expect(row.subtotal).toBe(160);
    expect(orderComputedTotal([row])).toBe(160);
  });

  it("keeps the legacy row addons when the menu is missing the addon", () => {
    const addons = buildAddonSnapshot(["deleted-addon"], plainMenu, [
      { id: "deleted-addon", name: "已下架口味", price: 4 },
    ]);
    expect(addons).toEqual([
      { id: "deleted-addon", name: "已下架口味", price: 4 },
    ]);
  });

  it("never invents addons for rows without them (legacy orders)", () => {
    const row = normalizeOrderItem(
      { id: "cola", name: "可乐", price: 15, quantity: 2 },
      plainMenu,
    );
    expect(row.addons).toBeUndefined();
    expect(row.subtotal).toBe(30);
    expect(JSON.parse(JSON.stringify(row)).addons).toBeUndefined();
  });
});

describe("buildOrderLineFromMenu (后台加菜)", () => {
  it("keeps the addon snapshot and includes add-on price in the line", () => {
    const line = buildOrderLineFromMenu(menuWithAddons, 2, ["cheese", "egg"]);
    expect(line.id).toBe("rice-bowl");
    expect(line.name).toBe("牛肉盖饭");
    expect(line.price).toBe(75);
    expect(line.quantity).toBe(2);
    expect(line.isAdded).toBe(true);
    // 快照按 id 排序，保证行键稳定
    expect(line.addons).toEqual([
      { id: "cheese", name: "加芝士", price: 8 },
      { id: "egg", name: "加蛋", price: 5 },
    ]);
    expect(lineSubtotal(line)).toBe(176);
  });

  it("omits the addons field when no flavour is selected", () => {
    const line = buildOrderLineFromMenu(plainMenu, 1);
    expect(line.addons).toBeUndefined();
    expect(lineSubtotal(line)).toBe(15);
  });
});

describe("cartLinesToOrderItems (同一菜不同口味 = 独立行)", () => {
  const cart = {
    [makeLineKey("rice-bowl", ["egg"])]: 1,
    [makeLineKey("rice-bowl", ["cheese"])]: 2,
    [makeLineKey("rice-bowl", [])]: 1,
    "missing-dish": 3,
  };

  it("produces one order line per flavour combination", () => {
    const lines = cartLinesToOrderItems(cart, [menuWithAddons]);
    expect(lines).toHaveLength(3);
    expect(
      lines.map((l) => l.addons?.map((a) => a.id).join(",") || ""),
    ).toEqual(["egg", "cheese", ""]);
    expect(orderComputedTotal(lines)).toBe(80 + 166 + 75);
  });

  it("skips stale cart keys and non-positive quantities", () => {
    // 后写的合法行键覆盖前面的脏行键
    const lines = cartLinesToOrderItems(
      { "missing-dish": 3, [makeLineKey("cola", [])]: 2 },
      [plainMenu],
    );
    expect(lines).toHaveLength(1);
    expect(orderComputedTotal(lines)).toBe(30);
    expect(
      cartLinesToOrderItems({ [makeLineKey("cola", [])]: 0 }, [plainMenu]),
    ).toEqual([]);
  });

  it("returns an empty list for invalid input", () => {
    expect(cartLinesToOrderItems(null as any, [plainMenu])).toEqual([]);
  });
});

describe("mergeOrderItems (合并订单逐行重算)", () => {
  it("merges identical flavour lines and keeps different flavours apart", () => {
    const merged = mergeOrderItems([
      {
        id: "rice-bowl",
        name: "牛肉盖饭",
        price: 75,
        quantity: 1,
        addons: [{ id: "egg", name: "加蛋", price: 5 }],
      },
      {
        id: "rice-bowl",
        name: "牛肉盖饭",
        price: 75,
        quantity: 2,
        addons: [{ id: "egg", name: "加蛋", price: 5 }],
      },
      {
        id: "rice-bowl",
        name: "牛肉盖饭",
        price: 75,
        quantity: 1,
        addons: [{ id: "cheese", name: "加芝士", price: 8 }],
      },
      { id: "cola", name: "可乐", price: 15, quantity: 2 },
    ]);
    expect(merged).toHaveLength(3);
    expect(merged[0]!.quantity).toBe(3);
    expect(merged[0]!.subtotal).toBe(240);
    expect(merged[1]!.subtotal).toBe(83);
    expect(merged[2]!.subtotal).toBe(30);
    expect(orderComputedTotal(merged)).toBe(353);
  });

  it("is resilient to garbage rows", () => {
    expect(mergeOrderItems([null, undefined, 1])).toEqual([]);
    expect(mergeOrderItems(undefined)).toEqual([]);
  });
});

describe("removeOneFromLine (退菜扣减配菜钱)", () => {
  const items = [
    {
      id: "rice-bowl",
      name: "牛肉盖饭",
      price: 75,
      quantity: 2,
      addons: [{ id: "egg", name: "加蛋", price: 5 }],
    },
    { id: "cola", name: "可乐", price: 15, quantity: 1 },
  ];

  it("deducts the full line unit price including add-ons", () => {
    const res = removeOneFromLine(items, 0, 175);
    expect(res).not.toBeNull();
    expect(res!.removedAmount).toBe(80);
    expect(res!.items[0]!.quantity).toBe(1);
    expect(res!.total).toBe(95);
  });

  it("removes the row entirely when the quantity hits 0", () => {
    const res = removeOneFromLine(items, 1, 175);
    expect(res!.items).toHaveLength(1);
    expect(res!.total).toBe(160);
  });

  it("returns null for an invalid row index", () => {
    expect(removeOneFromLine(items, 5, 175)).toBeNull();
    expect(removeOneFromLine(null, 0, 0)).toBeNull();
  });

  it("re-computes instead of blindly subtracting, so legacy wrong totals heal", () => {
    // 订单 total 曾经少算了配菜（150），退掉一份配菜行后应以逐项为准
    const res = removeOneFromLine(items, 0, 150);
    expect(res!.total).toBe(95);
    expect(res!.removedAmount).toBe(80);
  });
});
