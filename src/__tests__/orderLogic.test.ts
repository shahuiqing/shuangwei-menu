import { describe, it, expect } from "vitest";
import {
  validateStatusTransition,
  normalizeTableString,
  isOrderMatchingTable,
  parseOrderTimestamp,
  normalizeOrder,
  isOrderActive,
} from "../api_modules/orders";

describe("order status state machine", () => {
  it("allows valid forward transitions", () => {
    expect(() => validateStatusTransition("pending", "cooking")).not.toThrow();
    expect(() => validateStatusTransition("cooking", "served")).not.toThrow();
    expect(() => validateStatusTransition("served", "completed")).not.toThrow();
  });

  it("allows cancel from any active state", () => {
    expect(() =>
      validateStatusTransition("pending", "cancelled"),
    ).not.toThrow();
    expect(() =>
      validateStatusTransition("cooking", "cancelled"),
    ).not.toThrow();
    expect(() => validateStatusTransition("served", "cancelled")).not.toThrow();
  });

  it("rejects skipping states", () => {
    expect(() => validateStatusTransition("pending", "served")).toThrow();
    expect(() => validateStatusTransition("pending", "completed")).toThrow();
    expect(() => validateStatusTransition("cooking", "completed")).toThrow();
  });

  it("rejects transitions out of terminal states", () => {
    expect(() => validateStatusTransition("completed", "cooking")).toThrow();
    expect(() => validateStatusTransition("cancelled", "pending")).toThrow();
  });

  it("is a no-op when status is unchanged", () => {
    expect(() => validateStatusTransition("pending", "pending")).not.toThrow();
    expect(() =>
      validateStatusTransition("completed", "completed"),
    ).not.toThrow();
  });

  it("defaults missing from-status to pending and rejects unknown states", () => {
    expect(() => validateStatusTransition("", "cooking")).not.toThrow();
    expect(() => validateStatusTransition("garbage", "cooking")).toThrow();
  });
});

describe("normalizeTableString", () => {
  it("strips table prefixes/suffixes and lowercases", () => {
    expect(normalizeTableString("桌号A1")).toBe("a1");
    expect(normalizeTableString("A1号桌")).toBe("a1");
    expect(normalizeTableString("Table 5")).toBe("5");
    expect(normalizeTableString("  B2  ")).toBe("b2");
    expect(normalizeTableString(null)).toBe("");
    expect(normalizeTableString(undefined)).toBe("");
  });
});

describe("isOrderMatchingTable", () => {
  it("matches with normalization and rejects mismatches", () => {
    const o = { customerName: "A1", table_no: "a1" };
    expect(isOrderMatchingTable(o, "A1")).toBe(true);
    expect(isOrderMatchingTable(o, "桌号A1")).toBe(true);
    expect(isOrderMatchingTable(o, "A2")).toBe(false);
    expect(isOrderMatchingTable(o, "")).toBe(false);
    expect(isOrderMatchingTable(null, "A1")).toBe(false);
  });
});

describe("parseOrderTimestamp", () => {
  it("parses space-separated and ISO timestamps as UTC", () => {
    const a = parseOrderTimestamp("2026-08-10 07:00:00");
    expect(a).toBeGreaterThan(0);
    expect(parseOrderTimestamp("2026-08-10T07:00:00Z")).toBe(a);
  });

  it("honours explicit timezone offsets", () => {
    const utc = parseOrderTimestamp("2026-08-10T07:00:00Z");
    const plus2 = parseOrderTimestamp("2026-08-10T07:00:00+02:00");
    expect(plus2).toBe(utc - 2 * 3600 * 1000);
  });

  it("tolerates multiple whitespace between date and time", () => {
    const a = parseOrderTimestamp("2026-08-10 07:00:00");
    expect(parseOrderTimestamp("2026-08-10  07:00:00")).toBe(a);
    expect(parseOrderTimestamp("2026-08-10\t07:00:00")).toBe(a);
  });

  it("passes numbers through and returns 0 for bad input", () => {
    expect(parseOrderTimestamp(1000)).toBe(1000);
    expect(parseOrderTimestamp(null)).toBe(0);
    expect(parseOrderTimestamp("")).toBe(0);
    expect(parseOrderTimestamp("not-a-date")).toBe(0);
  });
});

describe("normalizeOrder", () => {
  it("fills defaults and mirrors total/total_amount", () => {
    const o = normalizeOrder({
      id: "X",
      total_amount: 33,
      customer_name: "B3",
    });
    expect(o._id).toBe("X");
    expect(o.id).toBe("X");
    expect(o.total).toBe(33);
    expect(o.total_amount).toBe(33);
    expect(o.table_no).toBe("B3");
    expect(o.status).toBe("pending");
    expect(Array.isArray(o.items)).toBe(true);
    expect(o.timestamp).toBeTruthy();
  });

  it("generates id/table when missing", () => {
    const o = normalizeOrder({});
    expect(String(o._id).length).toBeGreaterThan(0);
    expect(o.table_no).toBe("A1");
  });

  it("returns falsy input unchanged", () => {
    expect(normalizeOrder(null)).toBeFalsy();
    expect(normalizeOrder(undefined)).toBeFalsy();
  });
});

describe("isOrderActive", () => {
  it("treats non-terminal statuses as active", () => {
    expect(isOrderActive({ status: "cooking" })).toBe(true);
    expect(isOrderActive({ status: "COMPLETED" })).toBe(false);
    expect(isOrderActive({ status: "cancelled" })).toBe(false);
    expect(isOrderActive({})).toBe(true);
  });
});
