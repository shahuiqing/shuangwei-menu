import { describe, it, expect, beforeEach } from "vitest";
import { exportLocalData, importLocalData, LOCAL_KEYS } from "../backup";

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
  });
});
