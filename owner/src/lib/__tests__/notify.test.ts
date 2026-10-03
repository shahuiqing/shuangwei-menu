import { describe, it, expect } from "vitest";
import {
  notifySupported,
  notifyPermission,
  notifyEnabled,
  setNotifyEnabled,
  requestNotifyPermission,
  showNotify,
  shouldNotifyOrder,
  orderId,
  orderNotice,
} from "../notify";

describe("通知能力探测（无 DOM 环境）", () => {
  it("不支持时优雅降级，不抛错", async () => {
    expect(notifySupported()).toBe(false);
    expect(notifyPermission()).toBe("unsupported");
    setNotifyEnabled(true);
    expect(notifyEnabled()).toBe(false);
    expect(await requestNotifyPermission()).toBe("unsupported");
    expect(await showNotify("标题", "内容")).toBe(false);
  });
});

describe("shouldNotifyOrder", () => {
  const seen = new Set<string>(["A1"]);

  it("仅「待接单且未见过」需要通知", () => {
    expect(shouldNotifyOrder({ id: "B2", status: "pending" }, seen)).toBe(true);
    expect(shouldNotifyOrder({ id: "A1", status: "pending" }, seen)).toBe(
      false,
    );
    expect(shouldNotifyOrder({ id: "B2", status: "cooking" }, seen)).toBe(
      false,
    );
    expect(shouldNotifyOrder({ id: "B2", status: "completed" }, seen)).toBe(
      false,
    );
  });

  it("无 id / 空订单不通知", () => {
    expect(shouldNotifyOrder({ status: "pending" }, seen)).toBe(false);
    expect(shouldNotifyOrder(null, seen)).toBe(false);
    expect(shouldNotifyOrder(undefined, seen)).toBe(false);
  });

  it("兼容 _id 字段", () => {
    expect(shouldNotifyOrder({ _id: "X9", status: "pending" }, seen)).toBe(
      true,
    );
    expect(orderId({ _id: "X9" })).toBe("X9");
    expect(orderId(null)).toBe("");
  });
});

describe("orderNotice 文案", () => {
  it("标题含店名与桌号，正文含金额与状态", () => {
    const n = orderNotice(
      { id: "1", status: "pending", table_no: "A12", total: 128 },
      "双味居",
    );
    expect(n.title).toBe("双味居 · 新订单 A12");
    expect(n.body).toContain("128");
    expect(n.body).toContain("待接单");
  });

  it("缺金额字段按 0 处理", () => {
    const n = orderNotice({ id: "1", status: "pending" }, "双味居");
    expect(n.body).toContain("0");
  });
});
