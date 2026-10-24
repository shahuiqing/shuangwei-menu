import { supabase } from "./supabase";

/* ============ 菜单快照（数据库侧备份 + 一键快速恢复） ============
 * 与顾客端 settings.categories / deletedItemIds 同源，存到 menu_snapshots 表，
 * 不依赖本机 localStorage，换设备/清缓存也不丢。对应 SQL 见 supabase_owner_all.sql。
 */

export interface MenuSnapshot {
  id: string;
  name: string;
  created_at: string;
  item_count: number;
}

export async function snapshotMenu(name = "菜单快照"): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("owner_menu_snapshot", {
    p_name: name,
  });
  if (error) {
    console.warn("[owner] snapshotMenu:", error.message);
    return null;
  }
  return typeof data === "string" ? data : null;
}

export async function listMenuSnapshots(): Promise<MenuSnapshot[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("owner_menu_snapshot_list");
  if (error) {
    console.warn("[owner] listMenuSnapshots:", error.message);
    return [];
  }
  return Array.isArray(data)
    ? (data as MenuSnapshot[]).map((s) => ({
        id: String(s.id || ""),
        name: String(s.name || "菜单快照"),
        created_at: String(s.created_at || ""),
        item_count: Number(s.item_count || 0),
      }))
    : [];
}

export async function restoreMenuSnapshot(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("owner_menu_restore", {
    p_id: id,
  });
  if (error) {
    console.warn("[owner] restoreMenuSnapshot:", error.message);
    return false;
  }
  return !!data;
}

export async function deleteMenuSnapshot(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("owner_menu_snapshot_delete", {
    p_id: id,
  });
  if (error) {
    console.warn("[owner] deleteMenuSnapshot:", error.message);
    return false;
  }
  return !!data;
}
