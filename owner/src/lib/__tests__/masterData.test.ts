import { describe, it, expect, beforeEach } from "vitest";
import {
  getItemMeta,
  saveItemMeta,
  addConversion,
  removeConversion,
  unitFactor,
  toMinQuantity,
  loadMetaMap,
  DEFAULT_META,
} from "../masterData";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
});

describe("默认值", () => {
  it("未设置时返回默认（可盘、非A类、无换算）", () => {
    expect(getItemMeta("x")).toEqual(DEFAULT_META);
    expect(loadMetaMap()).toEqual({});
  });
});

describe("字段保存", () => {
  it("保存可盘/A类并可读回", () => {
    saveItemMeta("a", { countable: false, classA: true });
    expect(getItemMeta("a")).toMatchObject({ countable: false, classA: true });
    expect(loadMetaMap()["a"]).toBeTruthy();
  });

  it("部分更新不影响其它字段", () => {
    saveItemMeta("b", { classA: true });
    saveItemMeta("b", { countable: false });
    expect(getItemMeta("b")).toMatchObject({ classA: true, countable: false });
  });
});

describe("单位换算", () => {
  it("新增/删除换算并正确换算数量", () => {
    addConversion("c", "箱", 10);
    expect(getItemMeta("c").conversions).toEqual({ 箱: 10 });
    expect(unitFactor(getItemMeta("c"), "箱")).toBe(10);
    expect(toMinQuantity(getItemMeta("c"), "箱", 3)).toBe(30);
    // 无换算的采购单位按 1 处理
    expect(toMinQuantity(getItemMeta("c"), "袋", 3)).toBe(3);

    removeConversion("c", "箱");
    expect(getItemMeta("c").conversions).toEqual({});
  });

  it("非法换算被忽略（空单位/系数<=0）", () => {
    addConversion("d", "", 10);
    addConversion("d", "箱", 0);
    addConversion("d", "箱", -5);
    expect(getItemMeta("d").conversions).toEqual({});
  });
});

describe("坏数据容错", () => {
  it("localStorage 里是坏 JSON 也不炸", () => {
    store.set("owner:item:meta", "{oops");
    expect(getItemMeta("e")).toEqual(DEFAULT_META);
    expect(loadMetaMap()).toEqual({});
  });
});
