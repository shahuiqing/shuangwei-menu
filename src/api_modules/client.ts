import { supabase, isSupabaseConfigured, isSupabaseHealthy } from "../supabase";

export const SETTINGS_DOC_ID = "global";

export const KNOWN_COLUMNS: Record<string, string[]> = {
  // T1 对齐 supabase_schema.sql:92 列名，避免 filter 误丢
  settings: [
    "id",
    "categories",
    "promotions",
    "bgUrl",
    "restaurantName",
    "welcomeMessage",
    "logoUrl",
    "adminPasswordHash",
    "devicePasswordsHash",
    "securityQuestion",
    "securityAnswerHash",
    "soundEnabled",
    "layoutStyle",
    "receiptSettings",
    "deletedItemIds",
    "theme",
  ],
  orders: [
    "_id",
    "id",
    "table_no",
    "customerName",
    "customer_name",
    "type",
    "status",
    "total_amount",
    "total",
    "items",
    "timestamp",
    "notes",
    "unprintedNewOrder",
    "unprintedAdditions",
    "createdAt",
    "created_at",
  ],
  tables: ["tableNo", "key", "active", "createdAt"],
  categories: ["id", "name", "sort_order", "created_at"],
  menu_items: [
    "id",
    "category_id",
    "name",
    "price",
    "image_url",
    "description",
    "is_available",
    "created_at",
  ],
  order_items: [
    "id",
    "order_id",
    "menu_item_id",
    "name",
    "quantity",
    "unit_price",
    "subtotal",
  ],
};

export const tableColumnsCache: Record<string, string[] | null> = {};

export async function getTableColumns(
  tableName: string,
): Promise<string[] | null> {
  if (tableColumnsCache[tableName]) return tableColumnsCache[tableName]!;
  if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
    try {
      const { data } = await supabase
        .from(tableName)
        .select("*")
        .limit(1)
        .maybeSingle();
      if (data) {
        const cols = Object.keys(data);
        tableColumnsCache[tableName] = cols;
        return cols;
      }
    } catch (e) {
      console.warn(`[client] discover columns ${tableName} failed:`, e);
    }
  }
  return null;
}

export async function filterPayloadByTable(
  tableName: string,
  payload: any,
): Promise<any> {
  const columns =
    (await getTableColumns(tableName)) || KNOWN_COLUMNS[tableName];
  if (!columns) return payload;
  const filtered: any = {};
  for (const k of Object.keys(payload))
    if (columns.includes(k)) filtered[k] = payload[k];
  return filtered;
}

export function handleSupabaseReadError(err: any, ctx: string) {
  console.warn(`[Supabase read ${ctx}]:`, err);
}
export function handleSupabaseWriteError(err: any, ctx: string) {
  console.warn(`[Supabase write ${ctx}]:`, err?.message || err);
}

export function triggerBroadcast(event: string, payload: any = {}) {
  import("../api")
    .then(({ triggerBroadcast: apiTrigger }) => {
      apiTrigger(event, payload);
    })
    .catch(() => {});
}
