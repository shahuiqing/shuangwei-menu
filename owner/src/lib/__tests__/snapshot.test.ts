import { describe, it, expect, beforeEach } from "vitest";
import {
  saveSnap,
  readSnap,
  snapFallback,
  cacheUsedAt,
  onCacheUse,
} from "../snapshot";

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

describe("快照读写", () => {
  it("写入后可读回，并带写入时间", () => {
    saveSnap("inventory", [{ id: "1", name: "牛肉" }]);
    const s = readSnap<any[]>("inventory");
    expect(s?.data).toEqual([{ id: "1", name: "牛肉" }]);
    expect(s?.at).toBeTruthy();
    expect(Number.isNaN(Date.parse(s!.at))).toBe(false);
  });

  it("未写入的键返回 null，坏数据也不炸", () => {
    expect(readSnap("none")).toBeNull();
    store.set("owner:snap:bad", "not-json");
    expect(readSnap("bad")).toBeNull();
    store.set("owner:snap:null", JSON.stringify({ at: "x", data: null }));
    expect(readSnap("null")).toBeNull();
  });

  it("null/undefined 不写入；超大快照跳过（防打爆配额）", () => {
    saveSnap("a", null);
    saveSnap("b", undefined);
    expect(readSnap("a")).toBeNull();
    expect(readSnap("b")).toBeNull();

    saveSnap("big", "x".repeat(1_600_000));
    expect(readSnap("big")).toBeNull();
  });
});

describe("断网回落", () => {
  it("无快照时返回调用方兜底值，且不标记缓存时间", () => {
    const before = cacheUsedAt();
    expect(snapFallback("orders:30", [])).toEqual([]);
    expect(cacheUsedAt()).toBe(before);
  });

  it("有快照时返回缓存数据并通知订阅者", () => {
    saveSnap("orders:30", [{ id: "o1" }]);
    const seen: string[] = [];
    const off = onCacheUse((at) => seen.push(at));
    expect(snapFallback("orders:30", [])).toEqual([{ id: "o1" }]);
    expect(seen.length).toBe(1);
    expect(seen[0]).toBe(readSnap("orders:30")!.at);
    expect(cacheUsedAt()).toBe(seen[0]);
    off();
    snapFallback("orders:30", []);
    expect(seen.length).toBe(1);
  });
});
