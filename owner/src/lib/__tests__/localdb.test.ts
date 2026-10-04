import { describe, it, expect, beforeEach } from "vitest";
import {
  exportLocalData,
  importLocalData,
  LOCAL_KEYS,
  localGet,
  localSet,
  localRemove,
  localDataStats,
  dbSubscribe,
} from "../localdb";

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

describe("本地数据备份", () => {
  it("导出仅包含已知键，可再导入还原", () => {
    store.set("owner:tasks", "[1]");
    store.set("owner:order:tag", '{"a":"refund"}');
    store.set("not-related", "x");

    const json = exportLocalData();
    const o = JSON.parse(json);
    expect(o.data["owner:tasks"]).toBe("[1]");
    expect(o.data["not-related"]).toBeUndefined();

    store.clear();
    expect(importLocalData(json)).toBe(2);
    expect(store.get("owner:tasks")).toBe("[1]");
    expect(store.get("owner:order:tag")).toBe('{"a":"refund"}');
  });

  it("坏 JSON 抛错，不写入", () => {
    expect(() => importLocalData("{oops")).toThrow();
  });

  it("白名单覆盖本地数据键", () => {
    expect(LOCAL_KEYS).toContain("owner:tasks");
    expect(LOCAL_KEYS).toContain("owner:item:meta");
    expect(LOCAL_KEYS).toContain("owner:biz:type");
    expect(LOCAL_KEYS).toContain("owner:dish:lang");
  });
});

describe("统一读写 + 变更通知", () => {
  it("localSet/localGet 往返 + 坏数据返回 null", () => {
    localSet("owner:test:x", { a: 1, b: "中" });
    expect(localGet<{ a: number }>("owner:test:x")).toEqual({ a: 1, b: "中" });
    store.set("owner:test:bad", "{oops");
    expect(localGet("owner:test:bad")).toBeNull();
    expect(localGet("owner:test:missing")).toBeNull();
  });

  it("变更事件广播 set/remove", () => {
    const seen: string[] = [];
    const off = dbSubscribe((c) => seen.push(`${c.op}:${c.key}`));
    localSet("owner:test:k", 1);
    localRemove("owner:test:k");
    off();
    localSet("owner:test:k", 2);
    expect(seen).toEqual(["set:owner:test:k", "remove:owner:test:k"]);
  });

  it("localDataStats 只统计白名单键", () => {
    expect(localDataStats()).toEqual({ count: 0, bytes: 0 });
    localSet("owner:tasks", [{ id: "t1" }]);
    store.set("not-related", "x".repeat(1000));
    const s = localDataStats();
    expect(s.count).toBe(1);
    expect(s.bytes).toBeLessThan(1000);
  });
});
