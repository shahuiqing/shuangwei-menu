import { supabase } from "./supabase";
import { saveSnap, snapFallback } from "./snapshot";
import { logAction } from "./auditLog";

/* ============ 类型 ============ */

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  safety_stock: number;
  price: number;
  updated_at?: string;
}

export interface RecipeBom {
  id: string;
  menu_item_name: string;
  inventory_item_id: string;
  dosage: number;
  unit: string;
  station?: string;
}

export interface PurchaseOrder {
  id: string;
  supplier: string;
  item_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_cost: number;
  purchased_at?: string;
  notes?: string;
  created_at?: string;
}

export type TxnType = "purchase_in" | "order_out" | "adjustment" | "waste";

export interface InventoryTransaction {
  id: string;
  item_id: string;
  item_name: string;
  type: TxnType;
  quantity: number;
  unit: string;
  unit_cost: number;
  reference?: string;
  notes?: string;
  reason?: string;
  created_at?: string;
}

/* ============ 工具 ============ */

export const num = (v: unknown): number => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

const newId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** 预生成采购单 id（提交前用于关联本地票据图片） */
export const newPurchaseId = () => newId("PO");

/* ============ 原料档案 ============ */

export async function fetchInventory(): Promise<InventoryItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    console.warn("[owner] fetchInventory:", error.message);
    return snapFallback("inventory", []);
  }
  const rows = (data || []) as InventoryItem[];
  saveSnap("inventory", rows);
  return rows;
}

export async function saveInventoryItem(
  item: Partial<InventoryItem> & { name: string },
): Promise<boolean> {
  if (!supabase) return false;
  const payload = {
    id: item.id || newId("INV"),
    name: item.name.trim(),
    category: item.category || "食材",
    stock: num(item.stock),
    unit: item.unit || "kg",
    safety_stock: num(item.safety_stock),
    price: num(item.price),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("inventory_items").upsert(payload);
  if (error) {
    console.warn("[owner] saveInventoryItem:", error.message);
    return false;
  }
  return true;
}

export interface DeleteResult {
  ok: boolean;
  /** 被配方引用时返回引用数量，供 UI 提示 */
  referencedBoms?: number;
  error?: string;
}

/**
 * 删除原料。
 * 若该原料被 recipe_boms 引用，先解除引用（删除相关配方行）再删除，
 * 避免数据库外键 409（23503）导致删除失败。
 */
export async function deleteInventoryItem(id: string): Promise<DeleteResult> {
  if (!supabase) return { ok: false, error: "未配置数据库" };

  // 先查引用
  const { data: refs } = await supabase
    .from("recipe_boms")
    .select("id")
    .eq("inventory_item_id", id);
  const refCount = Array.isArray(refs) ? refs.length : 0;

  if (refCount > 0) {
    const { error: eBom } = await supabase
      .from("recipe_boms")
      .delete()
      .eq("inventory_item_id", id);
    if (eBom) {
      console.warn("[owner] deleteInventoryItem boms:", eBom.message);
      return { ok: false, referencedBoms: refCount, error: eBom.message };
    }
  }

  const { error } = await supabase
    .from("inventory_items")
    .delete()
    .eq("id", id);
  if (error) {
    console.warn("[owner] deleteInventoryItem:", error.message);
    return {
      ok: false,
      referencedBoms: refCount || undefined,
      error: error.message,
    };
  }
  return { ok: true, referencedBoms: refCount };
}

/** 写流水；reason 列未执行迁移时降级为不含 reason 重试（不阻断业务） */
async function insertTxn(
  row: Partial<InventoryTransaction> & { id: string; item_id: string },
): Promise<void> {
  if (!supabase) return;
  let { error } = await supabase.from("inventory_transactions").insert(row);
  if (error && "reason" in row && /reason/i.test(error.message)) {
    const { reason: _omit, ...rest } = row;
    ({ error } = await supabase.from("inventory_transactions").insert(rest));
  }
  if (error) console.warn("[owner] inventory txn:", error.message);
}

/** 盘点/损耗调整：delta 正数入库、负数出库 */
export async function adjustStock(
  item: InventoryItem,
  delta: number,
  type: TxnType = "adjustment",
  notes = "",
  reason = "",
): Promise<boolean> {
  if (!supabase) return false;
  const next = num(item.stock) + num(delta);
  const { error } = await supabase
    .from("inventory_items")
    .update({ stock: next, updated_at: new Date().toISOString() })
    .eq("id", item.id);
  if (error) {
    console.warn("[owner] adjustStock:", error.message);
    return false;
  }
  await insertTxn({
    id: newId("ADJ"),
    item_id: item.id,
    item_name: item.name,
    type,
    quantity: num(delta),
    unit: item.unit,
    unit_cost: num(item.price),
    reference: "",
    notes,
    reason,
    created_at: new Date().toISOString(),
  });
  return true;
}

/**
 * 报损登记：库存扣减 + 写 waste 流水（按原料现价记成本）
 * @param qty 报损数量（正数，内部转为负 delta）
 */
export async function recordWaste(
  item: InventoryItem,
  qty: number,
  reason = "",
  notes = "",
): Promise<boolean> {
  const amount = Math.abs(num(qty));
  if (amount <= 0) return false;
  if (amount > num(item.stock)) {
    console.warn("[owner] recordWaste: qty exceeds stock");
    return false;
  }
  const ok = await adjustStock(item, -amount, "waste", notes, reason);
  if (ok)
    logAction(
      "报损登记",
      `${item.name} -${amount}${item.unit || ""}${reason ? `（${reason}）` : ""}`,
    );
  return ok;
}

/* ============ 配方 BOM ============ */

export async function fetchBoms(): Promise<RecipeBom[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("recipe_boms")
    .select("*")
    .order("menu_item_name", { ascending: true });
  if (error) {
    console.warn("[owner] fetchBoms:", error.message);
    return [];
  }
  return (data || []) as RecipeBom[];
}

export async function saveBom(
  bom: Partial<RecipeBom> & {
    menu_item_name: string;
    inventory_item_id: string;
  },
): Promise<boolean> {
  if (!supabase) return false;
  const payload = {
    id: bom.id || newId("BOM"),
    menu_item_name: bom.menu_item_name,
    inventory_item_id: bom.inventory_item_id,
    dosage: num(bom.dosage),
    unit: bom.unit || "kg",
    station: bom.station || "",
  };
  const { error } = await supabase.from("recipe_boms").upsert(payload);
  if (error) {
    console.warn("[owner] saveBom:", error.message);
    return false;
  }
  return true;
}

export async function deleteBom(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("recipe_boms").delete().eq("id", id);
  if (error) {
    console.warn("[owner] deleteBom:", error.message);
    return false;
  }
  return true;
}

/* ============ 采购 ============ */

export async function fetchPurchases(limit = 500): Promise<PurchaseOrder[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("*")
    .order("purchased_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[owner] fetchPurchases:", error.message);
    return snapFallback(`purchases:${limit}`, []);
  }
  const rows = (data || []) as PurchaseOrder[];
  saveSnap(`purchases:${limit}`, rows);
  return rows;
}

/**
 * 新建采购单（原子 RPC）：一次事务内完成
 *   ① 写 purchase_orders ② 库存增加并更新成本价 ③ 写 purchase_in 流水
 * 对应 SQL 函数 owner_create_purchase（见 supabase_owner_all.sql）。
 */
export async function createPurchase(input: {
  supplier: string;
  inventory_item_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  notes?: string;
  purchased_at?: string;
  /** 可选：由调用方预生成采购单 id（用于关联本地票据图片） */
  id?: string;
}): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc("owner_create_purchase", {
    p_id: input.id || newId("PO"),
    p_supplier: input.supplier || "",
    p_item_id: input.inventory_item_id,
    p_item_name: input.item_name,
    p_qty: num(input.quantity),
    p_unit: input.unit || "kg",
    p_unit_price: num(input.unit_price),
    p_notes: input.notes || "",
    p_purchased_at: input.purchased_at || new Date().toISOString(),
  });
  if (error) {
    console.warn("[owner] createPurchase:", error.message);
    return false;
  }
  logAction(
    "采购入库",
    `${input.item_name} ×${input.quantity}${input.unit || ""}${
      input.supplier ? ` · ${input.supplier}` : ""
    }`,
  );
  return true;
}

/* ============ 流水 ============ */

export async function fetchTransactions(
  limit = 2000,
  type?: TxnType,
  sinceIso?: string,
): Promise<InventoryTransaction[]> {
  if (!supabase) return [];
  let q = supabase
    .from("inventory_transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (type) q = q.eq("type", type);
  if (sinceIso) q = q.gte("created_at", sinceIso);
  const { data, error } = await q;
  if (error) {
    console.warn("[owner] fetchTransactions:", error.message);
    return [];
  }
  return (data || []) as InventoryTransaction[];
}

/* ============ 派生统计 ============ */

export function lowStockItems(list: InventoryItem[]): InventoryItem[] {
  return list.filter(
    (i) => num(i.safety_stock) > 0 && num(i.stock) <= num(i.safety_stock),
  );
}

export function inventoryValue(list: InventoryItem[]): number {
  return list.reduce((s, i) => s + num(i.stock) * num(i.price), 0);
}

/** 补货建议：建议补至安全库存的差距与预估金额 */
export interface RestockSuggestion extends InventoryItem {
  gap: number;
  estCost: number;
}

export function restockSuggestions(list: InventoryItem[]): RestockSuggestion[] {
  return lowStockItems(list)
    .map((i) => {
      const gap = Math.max(0, num(i.safety_stock) - num(i.stock));
      return { ...i, gap, estCost: gap * num(i.price) };
    })
    .sort((a, b) => b.estCost - a.estCost);
}

/** 采购价变动影响的菜品成本差额（用于采购前预览成本变化） */
export interface CostImpact {
  dish: string;
  delta: number;
}

export function costImpactForPriceChange(
  itemId: string,
  newPrice: number,
  boms: RecipeBom[],
  inventory: InventoryItem[],
): CostImpact[] {
  const oldPrice = num(inventory.find((i) => i.id === itemId)?.price);
  const diff = num(newPrice) - oldPrice;
  if (!diff) return [];
  const map = new Map<string, number>();
  boms
    .filter((b) => b.inventory_item_id === itemId)
    .forEach((b) => {
      const d = num(b.dosage) * diff;
      map.set(b.menu_item_name, (map.get(b.menu_item_name) || 0) + d);
    });
  return Array.from(map.entries())
    .map(([dish, delta]) => ({ dish, delta }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}
