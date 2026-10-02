import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * P0 回归：订单「更新 / 删除 / 清空」的云端持久化。
 *
 * 修复前：orders 的 UPDATE/DELETE 仅授予 service_role，前端 anon 直连被 RLS 静默过滤
 *         （PostgREST 返回 { data: null, error: null }），代码打印 "success" 但云端未变。
 * 修复后：
 *   1) supabase_*.sql 增加 anon_update_orders / anon_delete_orders 策略 → 正常落库；
 *   2) 客户端改为 .select() 取受影响行，0 行时告警（RLS 再被拦也不会静默）。
 *
 * 本文件用「忠实模拟 PostgREST + RLS」的 supabase mock 覆盖上述行为。
 */

type Row = Record<string, any>;
type Filter = [string, "eq" | "neq", any];

const h = vi.hoisted(() => {
  const remote = { orders: [] as Row[], settings: [] as Row[] };
  // 模拟线上部署的 RLS：默认已放开（修复后）
  const rls = { ordersUpdate: true, ordersDelete: true };

  function rowsOf(name: string): Row[] {
    return name === "settings" ? remote.settings : remote.orders;
  }
  function match(rows: Row[], filters: Filter[]): Row[] {
    return rows.filter((r) =>
      filters.every(([c, op, v]) => (op === "eq" ? r[c] === v : r[c] !== v)),
    );
  }

  function makeBuilder(table: string) {
    let op: "select" | "update" | "delete" | "insert" = "select";
    let payload: any = null;
    const filters: Filter[] = [];

    const builder: any = {
      select() {
        return builder;
      },
      update(p: any) {
        op = "update";
        payload = p;
        return builder;
      },
      delete() {
        op = "delete";
        return builder;
      },
      insert(p: any) {
        op = "insert";
        payload = p;
        return builder;
      },
      eq(col: string, val: any) {
        filters.push([col, "eq", val]);
        return builder;
      },
      neq(col: string, val: any) {
        filters.push([col, "neq", val]);
        return builder;
      },
      lt() {
        return builder;
      },
      in() {
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        return builder;
      },
      maybeSingle() {
        const rows = match(rowsOf(table), filters);
        return Promise.resolve({ data: rows[0] ?? null, error: null });
      },
      then(resolve: any, reject: any) {
        const rows = rowsOf(table);
        if (op === "select") {
          return Promise.resolve({
            data: match(rows, filters),
            error: null,
          }).then(resolve, reject);
        }
        if (op === "insert") {
          rows.push(payload);
          return Promise.resolve({ data: [payload], error: null }).then(
            resolve,
            reject,
          );
        }
        if (op === "update") {
          if (table === "orders" && !rls.ordersUpdate) {
            return Promise.resolve({ data: [], error: null }).then(
              resolve,
              reject,
            );
          }
          const hit = match(rows, filters);
          hit.forEach((r) => Object.assign(r, payload));
          return Promise.resolve({ data: hit, error: null }).then(
            resolve,
            reject,
          );
        }
        // delete
        if (table === "orders" && !rls.ordersDelete) {
          return Promise.resolve({ data: [], error: null }).then(
            resolve,
            reject,
          );
        }
        const hit = match(rows, filters);
        const keep = rows.filter((r) => !hit.includes(r));
        rows.length = 0;
        rows.push(...keep);
        return Promise.resolve({ data: hit, error: null }).then(
          resolve,
          reject,
        );
      },
    };
    return builder;
  }

  const supabase = { from: (table: string) => makeBuilder(table) };
  return { remote, rls, supabase };
});

vi.mock("../supabase", () => ({
  supabase: h.supabase,
  isSupabaseConfigured: true,
  isSupabaseHealthy: true,
}));

vi.mock("../api", () => ({ triggerBroadcast: vi.fn(), api: {} }));

import { updateOrder, deleteOrder, clearOrders } from "../api_modules/orders";
import { readLocalJSON } from "../utils/safeParse";
import { logger } from "../utils/logger";

function seed(order: Row) {
  h.remote.orders.push({ ...order });
  const local = readLocalJSON<Row[]>("local_orders", []);
  local.push({ ...order });
  localStorage.setItem("local_orders", JSON.stringify(local));
}
function localOrder(id: string): Row | undefined {
  return readLocalJSON<Row[]>("local_orders", []).find((o) => o._id === id);
}

describe("orders cloud persistence (P0)", () => {
  beforeEach(() => {
    h.remote.orders.length = 0;
    h.remote.settings.length = 0;
    h.rls.ordersUpdate = true;
    h.rls.ordersDelete = true;
    localStorage.clear();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updateOrder persists the status change to the cloud", async () => {
    seed({ _id: "upd-1", id: "upd-1", status: "pending", total: 10 });

    await updateOrder("upd-1", { status: "cooking" });

    expect(h.remote.orders[0]!.status).toBe("cooking");
    expect(localOrder("upd-1")!.status).toBe("cooking");
  });

  it("updateOrder warns instead of silently succeeding when RLS blocks", async () => {
    h.rls.ordersUpdate = false;
    seed({ _id: "upd-2", id: "upd-2", status: "pending", total: 10 });
    const warnSpy = vi.spyOn(logger, "warn");

    await updateOrder("upd-2", { status: "cooking" });

    expect(h.remote.orders[0]!.status).toBe("pending");
    expect(localOrder("upd-2")!.status).toBe("cooking");
    expect(warnSpy).toHaveBeenCalledWith(
      "orders",
      expect.stringContaining("0 rows"),
      expect.objectContaining({ id: "upd-2" }),
      "E_ORDERS_WRITE",
    );
  });

  it("deleteOrder removes the cloud row", async () => {
    seed({ _id: "del-1", id: "del-1", status: "completed", total: 5 });

    await deleteOrder("del-1");

    expect(h.remote.orders).toHaveLength(0);
    expect(localOrder("del-1")).toBeUndefined();
  });

  it("deleteOrder warns when RLS blocks deletion", async () => {
    h.rls.ordersDelete = false;
    seed({ _id: "del-2", id: "del-2", status: "completed", total: 5 });
    const warnSpy = vi.spyOn(logger, "warn");

    await deleteOrder("del-2");

    expect(h.remote.orders).toHaveLength(1);
    expect(localOrder("del-2")).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      "orders",
      expect.stringContaining("0 rows"),
      expect.objectContaining({ id: "del-2" }),
      "E_ORDERS_WRITE",
    );
  });

  it("clearOrders clears the cloud table", async () => {
    seed({ _id: "clr-1", id: "clr-1", status: "completed", total: 5 });
    seed({ _id: "clr-2", id: "clr-2", status: "pending", total: 6 });

    await clearOrders();

    expect(h.remote.orders).toHaveLength(0);
    expect(readLocalJSON<Row[]>("local_orders", [])).toHaveLength(0);
  });

  it("clearOrders warns when RLS blocks deletion", async () => {
    h.rls.ordersDelete = false;
    seed({ _id: "clr-3", id: "clr-3", status: "pending", total: 6 });
    const warnSpy = vi.spyOn(logger, "warn");

    await clearOrders();

    expect(h.remote.orders).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledWith(
      "orders",
      expect.stringContaining("0 rows"),
      expect.objectContaining({ status: undefined }),
      "E_ORDERS_WRITE",
    );
  });
});
