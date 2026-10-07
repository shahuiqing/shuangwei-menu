import { describe, it, expect, beforeEach } from "vitest";
import {
  toAuditRows,
  toStockRows,
  mergeAudit,
  mergeStocktake,
} from "../cloudSync";
import type { AuditEntry } from "../auditLog";
import type { StocktakeRecord } from "../stocktakeHistory";

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

describe("上云行映射", () => {
  it("audit detail 截断到 500，非法 at 归 0", () => {
    const rows = toAuditRows([
      { at: 3, action: "采购", detail: "x".repeat(600) },
      { at: NaN, action: "盘点", detail: "" },
    ]);
    expect(rows[0].detail.length).toBe(500);
    expect(rows[1].at).toBe(0);
    expect(rows[1].detail).toBe("");
  });

  it("盘点映射 netValue → net_value", () => {
    const rows = toStockRows([
      {
        at: 10,
        day: "2026-10-04",
        items: 5,
        diffs: 2,
        netValue: -3.5,
        stockValue: 1000,
      },
    ]);
    expect(rows).toEqual([
      {
        at: 10,
        day: "2026-10-04",
        items: 5,
        diffs: 2,
        net_value: -3.5,
        stock_value: 1000,
      },
    ]);
  });
});

describe("合并（多设备）", () => {
  const e = (at: number, action: string, detail = ""): AuditEntry => ({
    at,
    action,
    detail,
  });

  it("按复合键去重、新→旧排序、截断 500", () => {
    const local = [e(30, "本地新"), e(10, "老")];
    const cloud = [e(30, "本地新"), e(20, "云端"), e(5, "更老")];
    const merged = mergeAudit(local, cloud);
    expect(merged.map((x) => x.at)).toEqual([30, 20, 10, 5]);
    expect(merged.filter((x) => x.at === 30)).toHaveLength(1);
  });

  it("同 at 不同 detail 视为两条", () => {
    const merged = mergeAudit([e(5, "A", "甲")], [e(5, "A", "乙")]);
    expect(merged).toHaveLength(2);
  });

  it("空云端不破坏本地", () => {
    const merged = mergeAudit([e(1, "x")], []);
    expect(merged).toEqual([{ at: 1, action: "x", detail: "" }]);
  });

  it("盘点按 at 去重，net_value 还原为 netValue", () => {
    const local: StocktakeRecord[] = [
      {
        at: 2,
        day: "2026-10-03",
        items: 1,
        diffs: 0,
        netValue: 1,
        stockValue: 500,
      },
    ];
    const merged = mergeStocktake(local, [
      {
        at: 3,
        day: "2026-10-04",
        items: 2,
        diffs: 1,
        net_value: -4,
        stock_value: 600,
      },
      {
        at: 2,
        day: "2026-10-03",
        items: 1,
        diffs: 0,
        net_value: 1,
        stock_value: 500,
      },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0].netValue).toBe(-4);
    expect(merged[1].netValue).toBe(1);
    expect(merged[0].stockValue).toBe(600);
  });

  it("盘点截断 60 条", () => {
    const many = Array.from({ length: 70 }, (_, i) => ({
      at: 1000 - i,
      day: "d",
      items: 0,
      diffs: 0,
      netValue: 0,
      stockValue: 0,
    }));
    expect(mergeStocktake(many, [])).toHaveLength(60);
  });
});
