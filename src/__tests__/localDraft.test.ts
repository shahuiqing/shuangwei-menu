import { describe, it, expect, beforeEach } from "vitest";
import {
  touchLocalDraft,
  clearLocalDraft,
  getLocalDraftTs,
  categoriesDiffer,
} from "../utils/localDraft";

// localStorage polyfill for vitest node env
const _store: Record<string, string> = {};
const ls = {
  getItem: (k: string) => (k in _store ? _store[k] : null),
  setItem: (k: string, v: string) => {
    _store[k] = String(v);
  },
  removeItem: (k: string) => {
    delete _store[k];
  },
} as unknown as Storage;
(globalThis as unknown as { localStorage: Storage }).localStorage = ls;

describe("localDraft —— 本地草稿追踪", () => {
  beforeEach(() => {
    clearLocalDraft();
  });

  it("初始状态无草稿时间戳", () => {
    expect(getLocalDraftTs()).toBe(0);
  });

  it("touchLocalDraft 写入时间戳后可读取", () => {
    const before = Date.now();
    touchLocalDraft();
    const after = Date.now();
    const ts = getLocalDraftTs();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("clearLocalDraft 清除时间戳", () => {
    touchLocalDraft();
    expect(getLocalDraftTs()).toBeGreaterThan(0);
    clearLocalDraft();
    expect(getLocalDraftTs()).toBe(0);
  });
});

describe("categoriesDiffer —— 菜品差异比较", () => {
  it("两边都为空数组时不报差异", () => {
    expect(categoriesDiffer([], [])).toBe(false);
  });

  it("非数组输入不报差异（不误判）", () => {
    expect(categoriesDiffer(null, [])).toBe(false);
    expect(categoriesDiffer([], undefined)).toBe(false);
    expect(categoriesDiffer("abc", {})).toBe(false);
  });

  it("菜品数量不同时报差异", () => {
    const a = [{ id: "c1", items: [{ id: "i1", price: "75" }] }];
    const b = [
      {
        id: "c1",
        items: [
          { id: "i1", price: "75" },
          { id: "i2", price: "50" },
        ],
      },
    ];
    expect(categoriesDiffer(a, b)).toBe(true);
  });

  it("菜品 id 相同但价格不同时报差异", () => {
    const a = [{ id: "c1", items: [{ id: "i1", price: "75" }] }];
    const b = [{ id: "c1", items: [{ id: "i1", price: "80" }] }];
    expect(categoriesDiffer(a, b)).toBe(true);
  });

  it("菜品 id 与价格完全一致时不报差异", () => {
    const a = [{ id: "c1", items: [{ id: "i1", price: "75" }] }];
    const b = [{ id: "c1", items: [{ id: "i1", price: "75" }] }];
    expect(categoriesDiffer(a, b)).toBe(false);
  });

  it("云端有本地没有的菜品时报差异", () => {
    const a = [{ id: "c1", items: [{ id: "i1", price: "75" }] }];
    const b = [
      {
        id: "c1",
        items: [
          { id: "i1", price: "75" },
          { id: "i2", price: "50" },
        ],
      },
    ];
    expect(categoriesDiffer(a, b)).toBe(true);
  });

  it("分类结构不同但菜品一致时不报差异（按菜品比对）", () => {
    const a = [
      { id: "c1", items: [{ id: "i1", price: "75" }] },
      { id: "c2", items: [{ id: "i2", price: "50" }] },
    ];
    const b = [
      {
        id: "merged",
        items: [
          { id: "i1", price: "75" },
          { id: "i2", price: "50" },
        ],
      },
    ];
    expect(categoriesDiffer(a, b)).toBe(false);
  });
});
