import { describe, it, expect } from "vitest";
import {
  orderSchema,
  orderItemSchema,
  appSettingsSchema,
  menuCategorySchema,
  receiptSettingsSchema,
} from "../types/schemas";

describe("order schema bounds", () => {
  const base = {
    table_no: "A1",
    total: 10,
    items: [{ name: "X", quantity: 1, price: 5 }],
  };

  it("accepts a valid order and defaults status", () => {
    const r = orderSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe("pending");
  });

  it("requires at least one item", () => {
    expect(orderSchema.safeParse({ ...base, items: [] }).success).toBe(false);
  });

  it("rejects missing table_no", () => {
    expect(orderSchema.safeParse({ total: 1, items: base.items }).success).toBe(
      false,
    );
  });

  it("rejects invalid status values", () => {
    expect(orderSchema.safeParse({ ...base, status: "foo" }).success).toBe(
      false,
    );
  });

  it("enforces item quantity 1..99", () => {
    expect(
      orderItemSchema.safeParse({ name: "X", quantity: 0, price: 1 }).success,
    ).toBe(false);
    expect(
      orderItemSchema.safeParse({ name: "X", quantity: 100, price: 1 }).success,
    ).toBe(false);
    expect(
      orderItemSchema.safeParse({ name: "X", quantity: 99, price: 1 }).success,
    ).toBe(true);
  });

  it("rejects negative price", () => {
    expect(
      orderItemSchema.safeParse({ name: "X", quantity: 1, price: -1 }).success,
    ).toBe(false);
  });
});

describe("appSettings schema", () => {
  const base = {
    categories: [],
    restaurantName: "Store",
    adminPassword: "1234",
  };

  it("accepts a minimal settings object and defaults id", () => {
    const r = appSettingsSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.id).toBe("global");
  });

  it("rejects a short admin password", () => {
    expect(
      appSettingsSchema.safeParse({ ...base, adminPassword: "12" }).success,
    ).toBe(false);
  });

  it("rejects empty restaurant name", () => {
    expect(
      appSettingsSchema.safeParse({ ...base, restaurantName: "" }).success,
    ).toBe(false);
  });

  it("rejects an invalid layoutStyle", () => {
    expect(
      appSettingsSchema.safeParse({ ...base, layoutStyle: "weird" }).success,
    ).toBe(false);
  });

  it("caps deletedItemIds at 500", () => {
    const ids = Array.from({ length: 501 }, (_, i) => String(i));
    expect(
      appSettingsSchema.safeParse({ ...base, deletedItemIds: ids }).success,
    ).toBe(false);
  });
});

describe("menu/receipt schema guards", () => {
  it("caps category items at 200", () => {
    const items = Array.from({ length: 201 }, (_, i) => ({
      id: String(i),
      title: "T",
      price: "1",
    }));
    expect(
      menuCategorySchema.safeParse({ id: "c", name: "C", items }).success,
    ).toBe(false);
  });

  it("receipt settings passthrough keeps unknown fields", () => {
    const r = receiptSettingsSchema.safeParse({
      storeName: "S",
      showStoreName: true,
      showDate: true,
      showQrCode: true,
      fontSize: "12",
      columnWidth: "80",
      footerText1: "",
      footerText2: "",
      extraField: "kept",
    });
    expect(r.success).toBe(true);
    if (r.success) expect((r.data as any).extraField).toBe("kept");
  });
});
