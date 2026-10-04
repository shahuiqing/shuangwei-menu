import { describe, it, expect, beforeEach } from "vitest";
import {
  getOrderTag,
  setOrderTag,
  loadOrderTags,
  isExcludedTag,
  ORDER_TAG_LABEL,
} from "../orderTags";

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

describe("订单标记", () => {
  it("默认正常，设置后可读回", () => {
    expect(getOrderTag("o1")).toBe("normal");
    setOrderTag("o1", "refund");
    expect(getOrderTag("o1")).toBe("refund");
    expect(loadOrderTags()["o1"]).toBe("refund");
  });

  it("设为 normal 即清除记录", () => {
    setOrderTag("o2", "gift");
    setOrderTag("o2", "normal");
    expect(loadOrderTags()["o2"]).toBeUndefined();
  });

  it("退菜/赠送/员工餐/试菜 均视为不参与理论消耗", () => {
    expect(isExcludedTag("refund")).toBe(true);
    expect(isExcludedTag("gift")).toBe(true);
    expect(isExcludedTag("staff")).toBe(true);
    expect(isExcludedTag("trial")).toBe(true);
    expect(isExcludedTag("normal")).toBe(false);
    expect(ORDER_TAG_LABEL.staff).toBe("员工餐");
  });
});
