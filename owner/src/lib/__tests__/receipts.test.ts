import { describe, it, expect, beforeEach } from "vitest";
import {
  saveReceiptImage,
  getReceiptImage,
  listReceiptImages,
  deleteReceiptImage,
  linkReceipts,
  receiptsForPurchase,
} from "../receipts";

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

describe("无 IndexedDB 环境优雅降级", () => {
  it("图片存取返回空，不抛错", async () => {
    expect(await saveReceiptImage(new Blob(["x"]))).toBeNull();
    expect(await getReceiptImage("rcpt-x")).toBeNull();
    expect(await listReceiptImages()).toEqual([]);
    expect(await deleteReceiptImage("rcpt-x")).toBe(false);
  });
});

describe("采购单图片索引", () => {
  it("关联与读取往返，且去重", () => {
    expect(receiptsForPurchase("PO-1")).toEqual([]);
    linkReceipts("PO-1", ["a", "b", "a"]);
    expect(receiptsForPurchase("PO-1")).toEqual(["a", "b"]);
  });

  it("覆盖式更新", () => {
    linkReceipts("PO-1", ["a"]);
    linkReceipts("PO-1", ["c"]);
    expect(receiptsForPurchase("PO-1")).toEqual(["c"]);
  });
});
