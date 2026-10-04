import { describe, it, expect, beforeEach } from "vitest";
import {
  pushStocktake,
  loadStocktakeHistory,
  clearStocktakeHistory,
} from "../stocktakeHistory";

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

describe("盘点记录", () => {
  it("落一条并置顶，带营业日", () => {
    const rec = pushStocktake({ items: 12, diffs: 3, netValue: -45.5 });
    expect(rec.items).toBe(12);
    expect(rec.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const list = loadStocktakeHistory();
    expect(list).toHaveLength(1);
    expect(list[0].netValue).toBe(-45.5);
  });

  it("新→旧、上限 60、可清空", () => {
    pushStocktake({ items: 1, diffs: 0, netValue: 0 });
    pushStocktake({ items: 2, diffs: 1, netValue: 5 });
    const list = loadStocktakeHistory();
    expect(list).toHaveLength(2);
    expect(list[0].items).toBe(2);
    for (let i = 0; i < 70; i++)
      pushStocktake({ items: i, diffs: 0, netValue: 0 });
    expect(loadStocktakeHistory()).toHaveLength(60);
    clearStocktakeHistory();
    expect(loadStocktakeHistory()).toEqual([]);
  });

  it("坏数据返回空数组", () => {
    store.set("owner:stocktake:history", "not-json");
    expect(loadStocktakeHistory()).toEqual([]);
  });
});
