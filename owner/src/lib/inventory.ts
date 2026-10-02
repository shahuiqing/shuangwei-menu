import { supabase } from "./supabase";

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
  created_at?: string;
}

/* ============ 工具 ============ */

export const num = (v: unknown): number => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

const newId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

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
    return [];
  }
  return (data || []) as InventoryItem[];
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

export async function deleteInventoryItem(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("inventory_items")
    .delete()
    .eq("id", id);
  if (error) {
    console.warn("[owner] deleteInventoryItem:", error.message);
    return false;
  }
  return true;
}

/** 盘点/损耗调整：delta 正数入库、负数出库 */
export async function adjustStock(
  item: InventoryItem,
  delta: number,
  type: TxnType = "adjustment",
  notes = "",
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
  const { error: e2 } = await supabase.from("inventory_transactions").insert({
    id: newId("ADJ"),
    item_id: item.id,
    item_name: item.name,
    type,
    quantity: num(delta),
    unit: item.unit,
    unit_cost: num(item.price),
    reference: "",
    notes,
    created_at: new Date().toISOString(),
  });
  if (e2) console.warn("[owner] adjustStock txn:", e2.message);
  return true;
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
    return [];
  }
  return (data || []) as PurchaseOrder[];
}

/**
 * 新建采购单：写 purchase_orders + 库存增加 + purchase_in 流水。
 * 采购单价同时更新 inventory_items.price（作为最新成本价）。
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
}): Promise<boolean> {
  if (!supabase) return false;
  const qty = num(input.quantity);
  const price = num(input.unit_price);
  const id = newId("PO");
  const when = input.purchased_at || new Date().toISOString();

  const { error } = await supabase.from("purchase_orders").insert({
    id,
    supplier: input.supplier || "",
    item_id: input.inventory_item_id,
    item_name: input.item_name,
    quantity: qty,
    unit: input.unit || "kg",
    unit_price: price,
    total_cost: qty * price,
    purchased_at: when,
    notes: input.notes || "",
    created_at: when,
  });
  if (error) {
    console.warn("[owner] createPurchase:", error.message);
    return false;
  }

  const { data: cur } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("id", input.inventory_item_id)
    .maybeSingle();

  if (cur) {
    await supabase
      .from("inventory_items")
      .update({
        stock: num(cur.stock) + qty,
        price: price || num(cur.price),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.inventory_item_id);
  } else {
    await supabase.from("inventory_items").insert({
      id: input.inventory_item_id,
      name: input.item_name,
      category: "食材",
      stock: qty,
      unit: input.unit || "kg",
      safety_stock: 0,
      price,
      updated_at: new Date().toISOString(),
    });
  }

  const { error: e3 } = await supabase.from("inventory_transactions").insert({
    id: newId("TXN"),
    item_id: input.inventory_item_id,
    item_name: input.item_name,
    type: "purchase_in",
    quantity: qty,
    unit: input.unit || "kg",
    unit_cost: price,
    reference: id,
    notes: input.supplier ? `采购 · ${input.supplier}` : "采购入库",
    created_at: when,
  });
  if (e3) console.warn("[owner] createPurchase txn:", e3.message);
  return true;
}

/* ============ 流水 ============ */

export async function fetchTransactions(
  limit = 2000,
  type?: TxnType,
): Promise<InventoryTransaction[]> {
  if (!supabase) return [];
  let q = supabase
    .from("inventory_transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (type) q = q.eq("type", type);
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
