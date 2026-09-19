import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../supabase", () => ({
  supabase: null,
  isSupabaseConfigured: false,
  isSupabaseHealthy: false,
}));

vi.mock("../api_modules/client", () => ({
  handleSupabaseReadError: vi.fn(),
  handleSupabaseWriteError: vi.fn(),
  filterPayloadByTable: vi.fn((_table: string, payload: unknown) =>
    Promise.resolve(payload),
  ),
  triggerBroadcast: vi.fn(),
}));

vi.mock("../api_modules/orders", () => ({
  getOrders: vi.fn().mockResolvedValue([]),
  normalizeOrder: vi.fn((o: unknown) => o),
  parseOrderTimestamp: vi.fn((v: unknown) => {
    if (!v) return 0;
    const t = new Date(String(v)).getTime();
    return isNaN(t) ? 0 : t;
  }),
}));

vi.mock("../api_modules/inventory", () => ({
  getInventoryItems: vi.fn().mockResolvedValue([]),
  getRecipeBoms: vi.fn().mockResolvedValue([]),
}));

vi.mock("../utils/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
  ERR: {},
}));

import {
  getPurchaseOrders,
  savePurchaseOrder,
  deletePurchaseOrder,
  addInventoryTransaction,
  getInventoryTransactions,
  getDailySummaries,
  getWasteAnalysis,
  getPeriodTotals,
} from "../api_modules/finance";
import { getOrders } from "../api_modules/orders";
import { getInventoryItems, getRecipeBoms } from "../api_modules/inventory";
import type { PurchaseOrder, InventoryTransaction } from "../types/inventory";

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// ====== 采购管理 ======

describe("getPurchaseOrders", () => {
  it("returns empty array when localStorage is empty", async () => {
    const result = await getPurchaseOrders();
    expect(result).toEqual([]);
  });

  it("returns data from localStorage", async () => {
    const po: PurchaseOrder = {
      id: "PO-TEST",
      supplier: "供应商A",
      item_id: "INV-101",
      item_name: "牛肉",
      quantity: 10,
      unit: "kg",
      unit_price: 50,
      total_cost: 500,
      purchased_at: "2026-09-01",
      created_at: "2026-09-01T00:00:00Z",
    };
    localStorage.setItem("local_purchase_orders", JSON.stringify([po]));
    const result = await getPurchaseOrders();
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("PO-TEST");
    expect(result[0]!.total_cost).toBe(500);
  });
});

describe("savePurchaseOrder", () => {
  it("generates id and total_cost when missing", async () => {
    const po: PurchaseOrder = {
      id: "",
      supplier: "供应商A",
      item_id: "INV-101",
      item_name: "牛肉",
      quantity: 5,
      unit: "kg",
      unit_price: 20,
      total_cost: 0,
      purchased_at: "2026-09-10",
    };
    const result = await savePurchaseOrder(po);
    expect(result.id).toMatch(/^PO-/);
    expect(result.total_cost).toBe(100);
    expect(result.created_at).toBeTruthy();
  });

  it("rounds total_cost to 2 decimals", async () => {
    const po: PurchaseOrder = {
      id: "PO-ROUND",
      supplier: "供应商B",
      item_id: "INV-102",
      item_name: "馅料",
      quantity: 3,
      unit: "kg",
      unit_price: 33.333,
      total_cost: 0,
      purchased_at: "2026-09-10",
    };
    const result = await savePurchaseOrder(po);
    expect(result.total_cost).toBe(100); // 3 * 33.333 = 99.999, .toFixed(2) rounds to 100.00
  });

  it("persists to localStorage", async () => {
    const po: PurchaseOrder = {
      id: "PO-LS",
      supplier: "供应商C",
      item_id: "INV-103",
      item_name: "鸡",
      quantity: 2,
      unit: "kg",
      unit_price: 35,
      total_cost: 70,
      purchased_at: "2026-09-10",
      created_at: "2026-09-10T00:00:00Z",
    };
    await savePurchaseOrder(po);
    const stored = JSON.parse(
      localStorage.getItem("local_purchase_orders") || "[]",
    );
    expect(stored).toHaveLength(1);
    expect(stored[0]!.id).toBe("PO-LS");
  });

  it("updates existing PO in localStorage", async () => {
    const existing: PurchaseOrder = {
      id: "PO-UPD",
      supplier: "供应商D",
      item_id: "INV-104",
      item_name: "面粉",
      quantity: 10,
      unit: "kg",
      unit_price: 8,
      total_cost: 80,
      purchased_at: "2026-09-01",
      created_at: "2026-09-01T00:00:00Z",
    };
    localStorage.setItem("local_purchase_orders", JSON.stringify([existing]));

    const updated = {
      ...existing,
      quantity: 20,
      unit_price: 9,
      total_cost: 180,
    };
    await savePurchaseOrder(updated);

    const stored = JSON.parse(
      localStorage.getItem("local_purchase_orders") || "[]",
    );
    expect(stored).toHaveLength(1);
    expect(stored[0]!.quantity).toBe(20);
    expect(stored[0]!.unit_price).toBe(9);
  });
});

describe("deletePurchaseOrder", () => {
  it("removes PO from localStorage", async () => {
    const po: PurchaseOrder = {
      id: "PO-DEL",
      supplier: "供应商E",
      item_id: "INV-105",
      item_name: "辣椒",
      quantity: 5,
      unit: "kg",
      unit_price: 25,
      total_cost: 125,
      purchased_at: "2026-09-10",
      created_at: "2026-09-10T00:00:00Z",
    };
    localStorage.setItem("local_purchase_orders", JSON.stringify([po]));
    await deletePurchaseOrder("PO-DEL");
    const stored = JSON.parse(
      localStorage.getItem("local_purchase_orders") || "[]",
    );
    expect(stored).toHaveLength(0);
  });

  it("leaves other POs intact", async () => {
    const po1: PurchaseOrder = {
      id: "PO-1",
      supplier: "A",
      item_id: "INV-101",
      item_name: "牛肉",
      quantity: 1,
      unit: "kg",
      unit_price: 10,
      total_cost: 10,
      purchased_at: "2026-09-10",
      created_at: "2026-09-10T00:00:00Z",
    };
    const po2: PurchaseOrder = { ...po1, id: "PO-2", item_name: "鸡肉" };
    localStorage.setItem("local_purchase_orders", JSON.stringify([po1, po2]));
    await deletePurchaseOrder("PO-1");
    const stored = JSON.parse(
      localStorage.getItem("local_purchase_orders") || "[]",
    );
    expect(stored).toHaveLength(1);
    expect(stored[0]!.id).toBe("PO-2");
  });
});

// ====== 库存流水 ======

describe("getInventoryTransactions", () => {
  it("returns empty array from localStorage", async () => {
    const result = await getInventoryTransactions();
    expect(result).toEqual([]);
  });

  it("returns stored transactions", async () => {
    const tx: InventoryTransaction = {
      id: "TX-1",
      item_id: "INV-101",
      item_name: "牛肉",
      type: "purchase_in",
      quantity: 10,
      unit: "kg",
      unit_cost: 50,
      created_at: "2026-09-10T00:00:00Z",
    };
    localStorage.setItem("local_inventory_transactions", JSON.stringify([tx]));
    const result = await getInventoryTransactions();
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("TX-1");
  });
});

describe("addInventoryTransaction", () => {
  it("generates id and created_at", async () => {
    const tx: InventoryTransaction = {
      id: "",
      item_id: "INV-101",
      item_name: "牛肉",
      type: "purchase_in",
      quantity: 5,
      unit: "kg",
      unit_cost: 40,
      created_at: "",
    };
    const result = await addInventoryTransaction(tx);
    expect(result.id).toMatch(/^TX-/);
    expect(result.created_at).toBeTruthy();
  });

  it("prepends to localStorage", async () => {
    const existing: InventoryTransaction = {
      id: "TX-OLD",
      item_id: "INV-102",
      item_name: "馅料",
      type: "order_out",
      quantity: 2,
      unit: "kg",
      unit_cost: 40,
      created_at: "2026-09-01T00:00:00Z",
    };
    localStorage.setItem(
      "local_inventory_transactions",
      JSON.stringify([existing]),
    );

    const tx: InventoryTransaction = {
      id: "TX-NEW",
      item_id: "INV-101",
      item_name: "牛肉",
      type: "purchase_in",
      quantity: 3,
      unit: "kg",
      unit_cost: 50,
      created_at: "2026-09-10T00:00:00Z",
    };
    await addInventoryTransaction(tx);
    const stored = JSON.parse(
      localStorage.getItem("local_inventory_transactions") || "[]",
    );
    expect(stored).toHaveLength(2);
    expect(stored[0]!.id).toBe("TX-NEW");
    expect(stored[1]!.id).toBe("TX-OLD");
  });

  it("caps storage at 2000 items", async () => {
    const arr: InventoryTransaction[] = [];
    for (let i = 0; i < 2000; i++) {
      arr.push({
        id: `TX-${i}`,
        item_id: "INV-101",
        item_name: "牛肉",
        type: "purchase_in",
        quantity: 1,
        unit: "kg",
        unit_cost: 10,
        created_at: "2026-09-01T00:00:00Z",
      });
    }
    localStorage.setItem("local_inventory_transactions", JSON.stringify(arr));

    const tx: InventoryTransaction = {
      id: "TX-NEW",
      item_id: "INV-102",
      item_name: "馅料",
      type: "order_out",
      quantity: 1,
      unit: "kg",
      unit_cost: 20,
      created_at: "2026-09-10T00:00:00Z",
    };
    await addInventoryTransaction(tx);
    const stored = JSON.parse(
      localStorage.getItem("local_inventory_transactions") || "[]",
    );
    expect(stored.length).toBeLessThanOrEqual(2000);
  });
});

// ====== 日盈亏汇总 ======

describe("getDailySummaries", () => {
  it("returns empty summaries when no orders", async () => {
    const result = await getDailySummaries("2026-09-01", "2026-09-03");
    expect(result).toHaveLength(3);
    expect(result[0]!.date).toBe("2026-09-01");
    expect(result[2]!.date).toBe("2026-09-03");
    result.forEach((d) => {
      expect(d.revenue).toBe(0);
      expect(d.food_cost).toBe(0);
      expect(d.order_count).toBe(0);
    });
  });

  it("aggregates revenue from orders", async () => {
    const mockOrders = [
      {
        timestamp: "2026-09-01T10:00:00Z",
        status: "completed",
        total: 100,
        items: [],
      },
      {
        timestamp: "2026-09-01T14:00:00Z",
        status: "completed",
        total: 50,
        items: [],
      },
      {
        timestamp: "2026-09-02T10:00:00Z",
        status: "completed",
        total: 200,
        items: [],
      },
    ];
    vi.mocked(getOrders).mockResolvedValueOnce(mockOrders as never);

    const result = await getDailySummaries("2026-09-01", "2026-09-02");
    const sep1 = result.find((d) => d.date === "2026-09-01")!;
    const sep2 = result.find((d) => d.date === "2026-09-02")!;
    expect(sep1.revenue).toBe(150);
    expect(sep1.order_count).toBe(2);
    expect(sep2.revenue).toBe(200);
    expect(sep2.order_count).toBe(1);
  });

  it("excludes cancelled orders", async () => {
    const mockOrders = [
      {
        timestamp: "2026-09-01T10:00:00Z",
        status: "cancelled",
        total: 100,
        items: [],
      },
      {
        timestamp: "2026-09-01T14:00:00Z",
        status: "completed",
        total: 50,
        items: [],
      },
    ];
    vi.mocked(getOrders).mockResolvedValueOnce(mockOrders as never);

    const result = await getDailySummaries("2026-09-01", "2026-09-01");
    expect(result[0]!.revenue).toBe(50);
    expect(result[0]!.order_count).toBe(2); // orderCount includes cancelled orders
  });

  it("computes gross_margin correctly", async () => {
    const mockOrders = [
      {
        timestamp: "2026-09-01T10:00:00Z",
        status: "completed",
        total: 100,
        items: [],
      },
    ];
    vi.mocked(getOrders).mockResolvedValueOnce(mockOrders as never);

    const result = await getDailySummaries("2026-09-01", "2026-09-01");
    expect(result[0]!.gross_margin).toBe(100); // no food cost → gross_profit = revenue → 100% margin
  });
});

// ====== 损耗分析 ======

describe("getWasteAnalysis", () => {
  it("returns empty array when no inventory items", async () => {
    vi.mocked(getInventoryItems).mockResolvedValueOnce([]);
    vi.mocked(getRecipeBoms).mockResolvedValueOnce([]);
    vi.mocked(getOrders).mockResolvedValueOnce([]);

    const result = await getWasteAnalysis("2026-09-01", "2026-09-07");
    expect(result).toEqual([]);
  });

  it("computes waste metrics for inventory items", async () => {
    vi.mocked(getInventoryItems).mockResolvedValueOnce([
      {
        id: "INV-101",
        name: "牛肉",
        category: "肉类",
        stock: 40,
        unit: "kg",
        safety_stock: 5,
        price: 50,
        updated_at: "",
      },
    ]);
    vi.mocked(getRecipeBoms).mockResolvedValueOnce([
      {
        id: "BOM-1",
        menu_item_name: "牛肉面",
        inventory_item_id: "INV-101",
        dosage: 0.5,
        unit: "kg",
      },
    ]);
    vi.mocked(getOrders).mockResolvedValueOnce([
      {
        timestamp: "2026-09-02T10:00:00Z",
        status: "completed",
        items: [{ id: "dish-1", title: "牛肉面", quantity: 10 }],
      },
    ] as never);

    const result = await getWasteAnalysis("2026-09-01", "2026-09-07");
    expect(result).toHaveLength(1);
    expect(result[0]!.item_id).toBe("INV-101");
    expect(result[0]!.theoretical_consumption).toBe(5); // 10 orders * 0.5 dosage
    expect(result[0]!.period_start).toBe("2026-09-01");
    expect(result[0]!.period_end).toBe("2026-09-07");
  });

  it("excludes cancelled orders from theoretical consumption", async () => {
    vi.mocked(getInventoryItems).mockResolvedValueOnce([
      {
        id: "INV-101",
        name: "牛肉",
        category: "肉类",
        stock: 50,
        unit: "kg",
        safety_stock: 5,
        price: 50,
        updated_at: "",
      },
    ]);
    vi.mocked(getRecipeBoms).mockResolvedValueOnce([
      {
        id: "BOM-1",
        menu_item_name: "牛肉面",
        inventory_item_id: "INV-101",
        dosage: 0.5,
        unit: "kg",
      },
    ]);
    vi.mocked(getOrders).mockResolvedValueOnce([
      {
        timestamp: "2026-09-02T10:00:00Z",
        status: "cancelled",
        items: [{ id: "dish-1", title: "牛肉面", quantity: 10 }],
      },
    ] as never);

    const result = await getWasteAnalysis("2026-09-01", "2026-09-07");
    expect(result[0]!.theoretical_consumption).toBe(0);
  });
});

// ====== 周期汇总 ======

describe("getPeriodTotals", () => {
  it("returns zeros when no data", async () => {
    vi.mocked(getOrders).mockResolvedValueOnce([]);
    vi.mocked(getInventoryItems).mockResolvedValueOnce([]);
    vi.mocked(getRecipeBoms).mockResolvedValueOnce([]);

    const result = await getPeriodTotals("2026-09-01", "2026-09-07");
    expect(result.revenue).toBe(0);
    expect(result.food_cost).toBe(0);
    expect(result.gross_profit).toBe(0);
    expect(result.waste_cost).toBe(0);
    expect(result.order_count).toBe(0);
  });

  it("computes correct period totals", async () => {
    vi.mocked(getOrders).mockResolvedValueOnce([
      {
        timestamp: "2026-09-01T10:00:00Z",
        status: "completed",
        total: 200,
        items: [],
      },
      {
        timestamp: "2026-09-02T10:00:00Z",
        status: "completed",
        total: 300,
        items: [],
      },
    ] as never);
    vi.mocked(getInventoryItems).mockResolvedValueOnce([]);
    vi.mocked(getRecipeBoms).mockResolvedValueOnce([]);

    const result = await getPeriodTotals("2026-09-01", "2026-09-02");
    expect(result.revenue).toBe(500);
    expect(result.order_count).toBe(2);
    expect(result.gross_profit).toBe(500); // no food cost
    expect(result.gross_margin).toBe(100); // 100%
  });
});
