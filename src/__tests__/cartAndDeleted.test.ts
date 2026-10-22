import { describe, it, expect } from "vitest";
import {
  makeLineKey,
  applyCartDelta,
  dishQtyIn,
  type Cart,
} from "../utils/cartLine";
import { deriveDeletedItemIds } from "../utils/deletedItems";
import type { MenuCategory, MenuItem } from "../types/menu";

describe("applyCartDelta —— 购物车按口味分行（P1-1 回归）", () => {
  it("不同口味的同一菜品是两行，互不覆盖", () => {
    const plain = makeLineKey("dish-1", []);
    const spicy = makeLineKey("dish-1", ["a1"]);

    let cart: Cart = {};
    cart = applyCartDelta(cart, plain, 1);
    cart = applyCartDelta(cart, spicy, 1);

    // 修复前：两次都会写 cart["dish-1"]，结果只剩 1 行
    expect(Object.keys(cart)).toHaveLength(2);
    expect(cart[plain]).toBe(1);
    expect(cart[spicy]).toBe(1);
    expect(dishQtyIn(cart, "dish-1")).toBe(2);
  });

  it("从加项行减数量不会误减主行（P1-1 核心回归）", () => {
    const plain = makeLineKey("dish-1", []);
    const spicy = makeLineKey("dish-1", ["a1"]);
    let cart: Cart = { [plain]: 1, [spicy]: 1 };

    cart = applyCartDelta(cart, spicy, -1);

    expect(cart[plain]).toBe(1); // 主行不受影响
    expect(cart[spicy]).toBeUndefined(); // 加项行被移除
    expect(dishQtyIn(cart, "dish-1")).toBe(1);
  });

  it("数量减到 0 时移除该行，不清空其他行", () => {
    const a = makeLineKey("dish-1", []);
    const b = makeLineKey("dish-2", []);
    let cart: Cart = { [a]: 2, [b]: 3 };

    cart = applyCartDelta(cart, a, -2);
    expect(cart[a]).toBeUndefined();
    expect(cart[b]).toBe(3);
  });

  it("不修改入参（纯函数）", () => {
    const cart: Cart = { "dish-1": 1 };
    const next = applyCartDelta(cart, "dish-1", 1);
    expect(cart["dish-1"]).toBe(1);
    expect(next["dish-1"]).toBe(2);
  });

  it("加项顺序不影响行键（同一口味只占一行）", () => {
    expect(makeLineKey("d", ["a2", "a1"])).toBe(makeLineKey("d", ["a1", "a2"]));
    let cart: Cart = {};
    cart = applyCartDelta(cart, makeLineKey("d", ["a1", "a2"]), 1);
    cart = applyCartDelta(cart, makeLineKey("d", ["a2", "a1"]), 1);
    expect(Object.keys(cart)).toHaveLength(1);
    expect(dishQtyIn(cart, "d")).toBe(2);
  });
});

describe("deriveDeletedItemIds —— 内置菜品删除标记（P1-4 回归）", () => {
  // MenuItem 必填 title / image；用 title 作为显示名（真实数据里 name 常常为空）
  const item = (id: string, title: string): MenuItem =>
    ({ id, title, price: "1", image: "" }) as MenuItem;
  const cat = (id: string, name: string, items: MenuItem[]): MenuCategory =>
    ({ id, name, items }) as MenuCategory;

  const initial = [
    cat("c1", "烤串", [item("i1", "羊肉串"), item("i2", "牛肉串")]),
  ];

  it("分类未动时不产生任何删除标记（幂等）", () => {
    const current = [
      cat("c1", "烤串", [item("i1", "羊肉串"), item("i2", "牛肉串")]),
    ];
    expect(deriveDeletedItemIds(initial, current, [])).toEqual([]);
  });

  it("删掉一个菜品时只标记该菜品", () => {
    const current = [cat("c1", "烤串", [item("i1", "羊肉串")])];
    const ids = deriveDeletedItemIds(initial, current, []);
    expect(ids).toContain("i2");
    expect(ids).not.toContain("i1");
  });

  it("两个条目都没有 name 字段时不会互相误判为同一项（回归）", () => {
    // 曾因 undefined === undefined 恒真而漏标被删菜品
    const ids = deriveDeletedItemIds(
      [cat("c1", "烤串", [item("i1", "羊肉串"), item("i2", "牛肉串")])],
      [cat("c1", "烤串", [item("i1", "羊肉串")])],
      [],
    );
    expect(ids).toContain("i2");
  });

  it("删掉整个分类时标记分类及其下所有菜品", () => {
    const ids = deriveDeletedItemIds(initial, [], []);
    expect(ids).toEqual(expect.arrayContaining(["c1", "烤串", "i1", "i2"]));
  });

  it("保留已有标记且不重复（幂等）", () => {
    const current = [cat("c1", "烤串", [item("i1", "羊肉串")])];
    const once = deriveDeletedItemIds(initial, current, ["legacy"]);
    const twice = deriveDeletedItemIds(initial, current, once);
    expect(twice).toEqual(once);
    expect(twice).toContain("legacy");
    expect(twice.filter((x) => x === "i2")).toHaveLength(1);
  });

  it("按 name 匹配能识别被改过 id 的同一分类，不误标", () => {
    const current = [
      cat("c1-renamed-id", "烤串", [
        item("i1", "羊肉串"),
        item("i2", "牛肉串"),
      ]),
    ];
    // id 变了但 name 一致 → 视为同一分类，不应整批标记
    expect(deriveDeletedItemIds(initial, current, [])).toEqual([]);
  });
});
