import { supabase } from "./supabase";

/* ============ 类型（与顾客端 settings.categories 对齐） ============ */

export interface MenuItem {
  id: string;
  title: string;
  enTitle?: string;
  frTitle?: string;
  arTitle?: string;
  maTitle?: string;
  price: string; // 字符串，如 "75" 或 "MAD75"
  description?: string;
  image?: string;
  allergens?: string[];
  stock?: number | string | null; // null/空 = 不限
  isSoldOut?: boolean;
}

export interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

export const genId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** 从 "MAD75" / "75" 中取数字 */
export function parsePrice(v: unknown): number {
  if (typeof v === "number") return v;
  const m = String(v ?? "").match(/[\d.]+/);
  return m ? Number(m[0]) : 0;
}

/** 保留原有价签货币前缀（若有） */
export function formatPrice(value: string, template?: string): string {
  const prefix = String(template ?? "").replace(/[\d.]+/g, "");
  return `${prefix}${value}`;
}

/* ============ 读取 ============ */

export async function fetchCategories(): Promise<MenuCategory[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("settings")
    .select("categories")
    .eq("id", "global")
    .maybeSingle();
  if (error) {
    console.warn("[owner] fetchCategories:", error.message);
    return [];
  }
  const cats = data?.categories;
  return Array.isArray(cats) ? (cats as MenuCategory[]) : [];
}

/* ============ 写入（整表 categories + 广播） ============ */

async function saveCategories(cats: MenuCategory[]): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("settings")
    .update({ categories: cats })
    .eq("id", "global");
  if (error) {
    console.warn("[owner] saveCategories:", error.message);
    return false;
  }
  // 通知顾客端/其他端刷新菜单
  try {
    const ch = supabase.channel("owner-menu");
    await ch.subscribe();
    await ch.send({
      type: "broadcast",
      event: "settings_changed",
      payload: {},
    });
    supabase.removeChannel(ch);
  } catch {
    /* 广播失败不影响写入 */
  }
  return true;
}

/** 内部：读取-修改-写回，避免整表覆盖丢并发改动 */
async function mutate(
  fn: (cats: MenuCategory[]) => { cats?: MenuCategory[]; deletedId?: string },
): Promise<boolean> {
  const cats = await fetchCategories();
  const { cats: next, deletedId } = fn(cats);
  const result = next ?? cats;
  const ok = await saveCategories(result);
  if (ok && deletedId) await addDeletedId(deletedId);
  return ok;
}

/* ============ 软删除标记（防止顾客端 merge 复活默认菜品） ============ */

async function addDeletedId(idOrTitle: string): Promise<void> {
  if (!supabase || !idOrTitle) return;
  try {
    const { data } = await supabase
      .from("settings")
      .select("deletedItemIds")
      .eq("id", "global")
      .maybeSingle();
    const cur: string[] = Array.isArray(data?.deletedItemIds)
      ? data!.deletedItemIds
      : [];
    if (cur.includes(idOrTitle)) return;
    const next = [...cur, idOrTitle].slice(-500);
    await supabase
      .from("settings")
      .update({ deletedItemIds: next })
      .eq("id", "global");
  } catch {
    /* ignore */
  }
}

/* ============ 分类 CRUD ============ */

export async function addCategory(name: string): Promise<boolean> {
  return mutate((cats) => ({
    cats: [...cats, { id: genId("cat"), name: name.trim(), items: [] }],
  }));
}

export async function renameCategory(
  catId: string,
  name: string,
): Promise<boolean> {
  return mutate((cats) => ({
    cats: cats.map((c) => (c.id === catId ? { ...c, name: name.trim() } : c)),
  }));
}

export async function deleteCategory(catId: string): Promise<boolean> {
  return mutate((cats) => ({
    cats: cats.filter((c) => c.id !== catId),
    deletedId: catId,
  }));
}

/* ============ 菜品 CRUD ============ */

export async function addDish(
  catId: string,
  dish: Partial<MenuItem> & { title: string; price: string },
): Promise<boolean> {
  return mutate((cats) => ({
    cats: cats.map((c) =>
      c.id === catId
        ? { ...c, items: [...(c.items || []), { id: genId("dish"), ...dish }] }
        : c,
    ),
  }));
}

export async function updateDish(
  catId: string,
  dishId: string,
  patch: Partial<MenuItem>,
): Promise<boolean> {
  return mutate((cats) => ({
    cats: cats.map((c) =>
      c.id === catId
        ? {
            ...c,
            items: (c.items || []).map((it) =>
              it.id === dishId ? { ...it, ...patch } : it,
            ),
          }
        : c,
    ),
  }));
}

export async function deleteDish(
  catId: string,
  dishId: string,
): Promise<boolean> {
  return mutate((cats) => ({
    cats: cats.map((c) =>
      c.id === catId
        ? { ...c, items: (c.items || []).filter((it) => it.id !== dishId) }
        : c,
    ),
    deletedId: dishId,
  }));
}
