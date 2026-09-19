import { supabase, isSupabaseConfigured, isSupabaseHealthy } from "../supabase";
import { kvCache } from "../services/kvCache";
import {
  handleSupabaseReadError,
  handleSupabaseWriteError,
  filterPayloadByTable,
  triggerBroadcast,
} from "./client";
import { inventoryItemSchema, recipeBomSchema } from "../types/schemas";
import type { InventoryItem, RecipeBom } from "../types/inventory";
import { logger, ERR } from "../utils/logger";
import { readLocalJSON } from "../utils/safeParse";

let inventoryListeners: (() => void)[] = [];
export const triggerLocalInventoryChange = () =>
  inventoryListeners.forEach((cb) => cb());
export const subscribeToInventory = (cb: () => void) => {
  inventoryListeners.push(cb);
  return () => {
    inventoryListeners = inventoryListeners.filter((l) => l !== cb);
  };
};

const DEFAULT_INVENTORY: InventoryItem[] = [
  {
    id: "INV-101",
    name: "特级雪花牛肉",
    category: "肉类与海鲜",
    stock: 50,
    unit: "kg",
    safety_stock: 5,
    price: 80,
    updated_at: new Date().toISOString(),
  },
  {
    id: "INV-102",
    name: "精选清真牛肉馅",
    category: "肉类与海鲜",
    stock: 40,
    unit: "kg",
    safety_stock: 4,
    price: 40,
    updated_at: new Date().toISOString(),
  },
  {
    id: "INV-103",
    name: "农家鲜土鸡",
    category: "肉类与海鲜",
    stock: 30,
    unit: "kg",
    safety_stock: 3,
    price: 35,
    updated_at: new Date().toISOString(),
  },
  {
    id: "INV-104",
    name: "饺子皮面粉",
    category: "粮油面粉",
    stock: 80,
    unit: "kg",
    safety_stock: 8,
    price: 8,
    updated_at: new Date().toISOString(),
  },
  {
    id: "INV-105",
    name: "重庆特级朝天椒",
    category: "调料香料",
    stock: 15,
    unit: "kg",
    safety_stock: 2,
    price: 25,
    updated_at: new Date().toISOString(),
  },
  {
    id: "INV-106",
    name: "香浓高汤原汁",
    category: "汤底底料",
    stock: 60,
    unit: "L",
    safety_stock: 10,
    price: 12,
    updated_at: new Date().toISOString(),
  },
];
const DEFAULT_BOMS: RecipeBom[] = [
  {
    id: "BOM-101",
    menu_item_name: "清汤锅底",
    inventory_item_id: "INV-103",
    dosage: 0.3,
    unit: "kg",
  },
  {
    id: "BOM-102",
    menu_item_name: "清汤锅底",
    inventory_item_id: "INV-106",
    dosage: 1.5,
    unit: "L",
  },
];

export async function getInventoryItems(): Promise<InventoryItem[]> {
  const cached = await kvCache.get<InventoryItem[]>("inventory_items");
  if (cached) return cached;
  try {
    if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .order("id");
      if (error) throw error;
      if (data && data.length) {
        await kvCache.set("inventory_items", data, 300);
        return data as InventoryItem[];
      }
    }
  } catch (e) {
    handleSupabaseReadError(e, "getInventory");
  }
  const ls = localStorage.getItem("local_inventory_items");
  if (ls)
    return readLocalJSON<InventoryItem[]>(
      "local_inventory_items",
      DEFAULT_INVENTORY,
    );
  localStorage.setItem(
    "local_inventory_items",
    JSON.stringify(DEFAULT_INVENTORY),
  );
  return DEFAULT_INVENTORY;
}

export async function saveInventoryItem(item: InventoryItem) {
  const parsed = inventoryItemSchema.safeParse(item);
  if (!parsed.success)
    console.warn("[inventory] zod", parsed.error.issues.slice(0, 2));
  const payload = await filterPayloadByTable("inventory_items", {
    ...item,
    updated_at: new Date().toISOString(),
  });
  try {
    if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
      const { error } = await supabase
        .from("inventory_items")
        .upsert(payload, { onConflict: "id" });
      if (error) throw error;
      triggerBroadcast("inventory_changed");
    }
  } catch (e) {
    handleSupabaseWriteError(e, "saveInventory");
  }
  const arr = readLocalJSON<InventoryItem[]>("local_inventory_items", [
    ...DEFAULT_INVENTORY,
  ]);
  const idx = arr.findIndex((x: any) => x.id === item.id);
  if (idx !== -1) arr[idx] = { ...arr[idx], ...payload };
  else arr.push(payload);
  localStorage.setItem("local_inventory_items", JSON.stringify(arr));
  await kvCache.invalidate("inventory_items");
  triggerLocalInventoryChange();
  triggerBroadcast("inventory_changed");
}

export async function deleteInventoryItem(id: string) {
  try {
    if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
      const { error } = await supabase
        .from("inventory_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
      triggerBroadcast("inventory_changed");
    }
  } catch (e) {
    handleSupabaseWriteError(e, "deleteInventory");
  }
  await kvCache.invalidate("inventory_items");
  const arr = readLocalJSON<InventoryItem[]>(
    "local_inventory_items",
    [],
  ).filter((x) => x.id !== id);
  localStorage.setItem("local_inventory_items", JSON.stringify(arr));
  triggerLocalInventoryChange();
  triggerBroadcast("inventory_changed");
}

export async function getRecipeBoms(): Promise<RecipeBom[]> {
  const cached = await kvCache.get<RecipeBom[]>("recipe_boms");
  if (cached) return cached;
  try {
    if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
      const { data, error } = await supabase.from("recipe_boms").select("*");
      if (error) throw error;
      if (data && data.length) {
        await kvCache.set("recipe_boms", data, 300);
        return data as RecipeBom[];
      }
    }
  } catch (e) {
    handleSupabaseReadError(e, "getBoms");
  }
  const ls = localStorage.getItem("local_recipe_boms");
  if (ls) return readLocalJSON<RecipeBom[]>("local_recipe_boms", DEFAULT_BOMS);
  localStorage.setItem("local_recipe_boms", JSON.stringify(DEFAULT_BOMS));
  return DEFAULT_BOMS;
}

export async function saveRecipeBom(bom: RecipeBom) {
  const payload = await filterPayloadByTable("recipe_boms", {
    ...bom,
    id: bom.id || "BOM-" + Math.random().toString(36).slice(2, 9),
  });
  const parsed = recipeBomSchema.safeParse(payload);
  if (!parsed.success)
    console.warn("[bom] zod", parsed.error.issues.slice(0, 2));
  try {
    if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
      const { error } = await supabase
        .from("recipe_boms")
        .upsert(payload, { onConflict: "id" });
      if (error) throw error;
      triggerBroadcast("inventory_changed");
    }
  } catch (e) {
    handleSupabaseWriteError(e, "saveBom");
  }
  await kvCache.invalidate("recipe_boms");
  const arr = readLocalJSON<RecipeBom[]>("local_recipe_boms", [
    ...DEFAULT_BOMS,
  ]);
  const idx = arr.findIndex((x: any) => x.id === payload.id);
  if (idx !== -1) arr[idx] = { ...arr[idx], ...payload };
  else arr.push(payload);
  localStorage.setItem("local_recipe_boms", JSON.stringify(arr));
  triggerLocalInventoryChange();
  triggerBroadcast("inventory_changed");
}

export async function deleteRecipeBom(id: string) {
  try {
    if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
      const { error } = await supabase
        .from("recipe_boms")
        .delete()
        .eq("id", id);
      if (error) throw error;
      triggerBroadcast("inventory_changed");
    }
  } catch (e) {
    handleSupabaseWriteError(e, "deleteBom");
  }
  await kvCache.invalidate("recipe_boms");
  const arr = readLocalJSON<RecipeBom[]>("local_recipe_boms", []).filter(
    (x) => x.id !== id,
  );
  localStorage.setItem("local_recipe_boms", JSON.stringify(arr));
  triggerLocalInventoryChange();
  triggerBroadcast("inventory_changed");
}

export async function deductInventoryForOrderItems(items: any[]) {
  if (!items?.length) return;
  try {
    const inv = await getInventoryItems();
    const boms = await getRecipeBoms();
    if (!inv.length || !boms.length) return;
    const map = new Map<string, InventoryItem>();
    inv.forEach((i) => map.set(i.id, { ...i }));
    let changed = false;
    const unmatched: string[] = [];
    for (const oi of items) {
      // 高风险4修复：优先按 id 匹配，其次按名称（兼容旧数据），避免改名后扣减失败
      const id = String(oi.id || "");
      const name = String(oi.title || oi.name || "").trim();
      const qty = Number(oi.quantity || oi.count || 1);
      if ((!id && !name) || isNaN(qty) || qty <= 0) continue;
      let matched: typeof boms = [];
      if (id)
        matched = boms.filter(
          (b) =>
            String((b as any).menu_item_id || "").toLowerCase() ===
              id.toLowerCase() ||
            b.menu_item_name.trim().toLowerCase() === name.toLowerCase(),
        );
      else
        matched = boms.filter(
          (b) => b.menu_item_name.trim().toLowerCase() === name.toLowerCase(),
        );
      if (matched.length === 0 && name) unmatched.push(name);
      for (const bom of matched) {
        const target = map.get(bom.inventory_item_id);
        if (target) {
          const before = Number(target.stock || 0);
          const after = Math.max(
            0,
            Number((before - Number(bom.dosage) * qty).toFixed(2)),
          );
          if (after !== before) {
            target.stock = after;
            target.updated_at = new Date().toISOString();
            map.set(bom.inventory_item_id, target);
            changed = true;
            logger.info(
              "inventory",
              `deduct ${target.name} -${(Number(bom.dosage) * qty).toFixed(2)}${target.unit} => ${after}`,
            );
          }
        } else {
          logger.warn(
            "inventory",
            `bom target not found ${bom.inventory_item_id} for ${name}`,
            null,
            ERR.INVENTORY_WRITE,
          );
        }
      }
    }
    if (unmatched.length)
      logger.warn(
        "inventory",
        `deduct unmatched items (no BOM)`,
        unmatched,
        ERR.INVENTORY_WRITE,
      );
    if (changed) {
      // 批量保存改为并发限 3，避免 N+1 全串行
      const entries = Array.from(map.values());
      const tasks: Promise<void>[] = [];
      for (const v of entries) {
        // 仅保存被改动的
        const orig = inv.find((i) => i.id === v.id);
        if (orig && orig.stock !== v.stock) tasks.push(saveInventoryItem(v));
        if (tasks.length >= 3) {
          await Promise.all(tasks.splice(0, 3));
        }
      }
      await Promise.all(tasks);
    }
  } catch (e) {
    logger.error("inventory", "deduct failed", e, ERR.INVENTORY_WRITE);
  }
}
