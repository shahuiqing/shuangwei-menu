import { supabase, isSupabaseConfigured, isSupabaseHealthy } from "./supabase";
import {
  INITIAL_MENU_CATEGORIES,
  mergeAndOrderCategories,
} from "./initialData";
import { kvCache } from "./services/kvCache";
import { blobStorage } from "./services/blobStorage";
import { compressBase64Image } from "./utils/image";
import { readLocalJSON } from "./utils/safeParse";
import type { Order } from "./types/order";
import type { InventoryItem, RecipeBom } from "./types/inventory";

const SETTINGS_DOC_ID = "global";

const handleSupabaseReadError = (err: unknown, context: string) => {
  console.warn(`Supabase read notice [${context}]:`, err);
};

const handleSupabaseWriteError = (err: unknown, context: string) => {
  console.warn(
    `[Supabase Write Fallback] Notice in [${context}]:`,
    (err as Error)?.message || err,
  );
};

const handleSupabaseError = handleSupabaseWriteError;

const KNOWN_COLUMNS: Record<string, string[]> = {
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
  inventory_items: [
    "id",
    "name",
    "category",
    "stock",
    "unit",
    "safety_stock",
    "price",
    "updated_at",
  ],
  recipe_boms: ["id", "menu_item_name", "inventory_item_id", "dosage", "unit"],
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

const tableColumnsCache: Record<string, string[] | null> = {};

async function getTableColumns(tableName: string): Promise<string[] | null> {
  if (tableColumnsCache[tableName]) {
    return tableColumnsCache[tableName];
  }
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
      console.warn(`Failed to discover table columns for ${tableName}:`, e);
    }
  }
  return null;
}

async function filterPayloadByTable(
  tableName: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const columns =
    (await getTableColumns(tableName)) || KNOWN_COLUMNS[tableName];
  if (!columns) return payload;

  const filtered: Record<string, unknown> = {};
  for (const key of Object.keys(payload)) {
    if (columns.includes(key)) {
      filtered[key] = payload[key];
    }
  }
  return filtered;
}

let quotaExceededListeners: (() => void)[] = [];
export let isQuotaExceeded = false;

export const setQuotaExceeded = (val: boolean) => {
  if (isQuotaExceeded !== val) {
    isQuotaExceeded = val;
    quotaExceededListeners.forEach((cb) => cb());
  }
};

export const onQuotaExceededChange = (cb: () => void) => {
  quotaExceededListeners.push(cb);
  return () => {
    quotaExceededListeners = quotaExceededListeners.filter(
      (listener) => listener !== cb,
    );
  };
};

export const normalizeOrder = (o: any): Order => {
  if (!o) return o as never;
  const normalizedId = String(o.id || o._id || o.orderNumber || Math.random());
  const custName = o.customerName || o.customer_name || "";
  const totalVal =
    o.total !== undefined
      ? Number(o.total)
      : o.total_amount !== undefined
        ? Number(o.total_amount)
        : 0;
  const itemsList = Array.isArray(o.items) ? o.items : [];
  return {
    ...o,
    _id: normalizedId,
    id: normalizedId,
    customerName: custName,
    customer_name: custName,
    table_no: o.table_no || o.tableNo || custName || "A1",
    total: totalVal,
    total_amount: totalVal,
    items: itemsList,
    status: o.status || "pending",
    timestamp:
      o.timestamp || o.created_at || o.createdAt || new Date().toISOString(),
    unprintedNewOrder:
      o.unprintedNewOrder !== undefined ? o.unprintedNewOrder : false,
    unprintedAdditions: Array.isArray(o.unprintedAdditions)
      ? o.unprintedAdditions
      : [],
  } as Order;
};

export const normalizeTableString = (str: unknown): string => {
  if (!str) return "";
  return String(str)
    .replace(/^(桌号|table|号桌|桌)s*/i, "")
    .replace(/s*(桌号|table|号桌|桌)$/i, "")
    .trim()
    .toLowerCase();
};
// P1-9 转义 PostgREST or 值
function escOrVal(v: string): string {
  const s = String(v).replace(/"/g, '\\"');
  if (/[,()\"\s]/.test(s)) return `"${s}"`;
  return s;
}

export function checkAndTriggerMoroccoDailyClear() {
  // Automatic auto-clearing is disabled to prevent unexpected order loss.
  // Orders are preserved until explicitly cleared or managed by the administrator.
}

export const parseOrderTimestamp = (timeVal: unknown): number => {
  if (!timeVal) return 0;
  if (typeof timeVal === "number") return timeVal;
  let str = String(timeVal).trim();
  if (!str) return 0;
  if (/^\d+$/.test(str)) {
    return parseInt(str, 10);
  }

  // Convert space to 'T' if present (e.g., "2026-08-10 07:00:00" -> "2026-08-10T07:00:00")
  str = str.replace(" ", "T");

  // If no timezone offset is present, treat as UTC ISO string ('Z')
  const hasTimeZone = /Z$/i.test(str) || /[+-]\d{2}(:?\d{2})?$/.test(str);
  if (!hasTimeZone) {
    str += "Z";
  }

  const t = new Date(str).getTime();
  if (!isNaN(t) && t > 0) {
    return t;
  }

  const fallback = new Date(String(timeVal)).getTime();
  return isNaN(fallback) ? 0 : fallback;
};

export const isOrderActive = (o: unknown): boolean => {
  if (!o) return false;
  const status = String(
    (o as Record<string, unknown>).status || "pending",
  ).toLowerCase();
  if (status === "completed" || status === "cancelled") return false;
  return true;
};

export const isOrderMatchingTable = (
  o: unknown,
  nameOrTable: string,
): boolean => {
  if (!o || !nameOrTable) return false;
  const rec = o as Record<string, unknown>;
  const targetNorm = normalizeTableString(nameOrTable);
  const rawTarget = String(nameOrTable).trim().toLowerCase();
  if (!targetNorm && !rawTarget) return false;

  const orderCust = String(rec.customerName || rec.customer_name || "")
    .trim()
    .toLowerCase();
  const orderTable = String(rec.table_no || rec.tableNo || "")
    .trim()
    .toLowerCase();
  const orderCustNorm = normalizeTableString(orderCust);
  const orderTableNorm = normalizeTableString(orderTable);

  return (
    (rawTarget !== "" &&
      (orderCust === rawTarget || orderTable === rawTarget)) ||
    (targetNorm !== "" &&
      (orderCustNorm === targetNorm || orderTableNorm === targetNorm))
  );
};

let ordersListeners: ((orders: Order[]) => void)[] = [];
let settingsListeners: ((data: Record<string, unknown>) => void)[] = [];
const broadcastOrdersMemoryCache = new Map<string, Order>();

const triggerLocalOrdersChange = async () => {
  if (ordersListeners.length === 0) {
    return;
  }
  let remoteOrders: any[] = [];
  try {
    if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
      const { data, error } = await supabase.from("orders").select("*");
      if (error) handleSupabaseReadError(error, "triggerLocalOrdersChange");
      if (data) {
        remoteOrders = data.map(normalizeOrder);
      }
    }
  } catch (e) {
    handleSupabaseReadError(e, "triggerLocalOrdersChange");
  }

  const localOrders = readLocalJSON<any[]>("local_orders", []);

  const mergedMap = new Map<string, any>();

  // 1. Remote DB orders
  remoteOrders.forEach((ro) => {
    const norm = normalizeOrder(ro);
    if (norm._id) mergedMap.set(String(norm._id), norm);
  });

  // 2. Realtime broadcast orders held in memory
  broadcastOrdersMemoryCache.forEach((bo) => {
    const norm = normalizeOrder(bo);
    if (norm._id) {
      const existing = mergedMap.get(String(norm._id));
      if (!existing) {
        mergedMap.set(String(norm._id), norm);
      } else {
        const existingTime = parseOrderTimestamp(existing.timestamp);
        const normTime = parseOrderTimestamp(norm.timestamp);
        if (normTime >= existingTime) {
          mergedMap.set(String(norm._id), norm);
        }
      }
    }
  });

  // 3. Local storage orders
  localOrders.forEach((lo: Record<string, unknown>) => {
    const norm = normalizeOrder(lo);
    if (norm._id) {
      const existing = mergedMap.get(String(norm._id));
      if (!existing) {
        mergedMap.set(String(norm._id), norm);
      } else {
        const existingTime = parseOrderTimestamp(existing.timestamp);
        const normTime = parseOrderTimestamp(norm.timestamp);
        if (normTime >= existingTime) {
          mergedMap.set(String(norm._id), norm);
        }
      }
    }
  });

  const sorted = Array.from(mergedMap.values()).sort(
    (a: Order, b: Order) =>
      parseOrderTimestamp(a.timestamp) - parseOrderTimestamp(b.timestamp),
  );

  ordersListeners.forEach((cb) => cb(sorted));
};

let tablesListeners: ((tables: any[]) => void)[] = [];

const triggerLocalTablesChange = async () => {
  if (tablesListeners.length === 0) {
    return;
  }
  let remoteTables: any[] = [];
  try {
    if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
      const { data, error } = await supabase.from("tables").select("*");
      if (error) throw error;
      if (data) {
        remoteTables = data;
      }
    }
  } catch (e) {
    handleSupabaseReadError(e, "triggerLocalTablesChange");
  }

  const localTables = readLocalJSON<any[]>("local_tables", []);

  const merged = [...remoteTables];
  localTables.forEach((lt: any) => {
    if (!merged.some((rt) => rt.tableNo === lt.tableNo)) {
      merged.push(lt);
    }
  });

  tablesListeners.forEach((cb) => cb(merged));
};

let customerOrderListeners: {
  customerName: string;
  callback: (order: any) => void;
  fetchAndCallback: () => void;
}[] = [];
let inventoryListeners: (() => void)[] = [];

// EdgeOne 部署：购物车实时同步 + 管理员通知（Supabase Realtime broadcast，替代原 WebSocket cartHub）
let cartListeners: {
  table: string;
  callback: (cart: Record<string, number>) => void;
}[] = [];
let adminNotificationListeners: ((payload: any) => void)[] = [];

export const triggerLocalInventoryChange = () => {
  inventoryListeners.forEach((cb) => cb());
};

let globalSyncChannel: any = null;
let syncChannelRetryTimer: ReturnType<typeof setTimeout> | null = null;

let isRealtimeConnected = false;
export const getIsRealtimeConnected = () => isRealtimeConnected;

export const ensureSyncChannel = () => {
  if (supabase && isSupabaseConfigured && !globalSyncChannel) {
    globalSyncChannel = supabase.channel("restaurant-sync", {
      config: {
        broadcast: { self: true },
      },
    });

    globalSyncChannel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "settings",
          filter: `id=eq.${SETTINGS_DOC_ID}`,
        },
        (payload: any) => {
          if (payload.new) {
            if (
              payload.new.categories &&
              Array.isArray(payload.new.categories)
            ) {
              payload.new.categories = mergeAndOrderCategories(
                payload.new.categories,
                INITIAL_MENU_CATEGORIES,
                payload.new.deletedItemIds || [],
              );
            }
            kvCache.set("app_settings", payload.new, 600);
            settingsListeners.forEach((cb) => cb(payload.new));
          }
        },
      )
      .on("broadcast", { event: "settings_changed" }, () => {
        kvCache.invalidate("app_settings");
        api.getSettings().then((data) => {
          if (data) settingsListeners.forEach((cb) => cb(data));
        });
      })
      .on("broadcast", { event: "dish_deleted" }, (evtPayload: any) => {
        const payload = evtPayload?.payload || evtPayload;
        console.log(
          "[Supabase Broadcast] Dish deleted event received:",
          payload,
        );
        kvCache.invalidate("app_settings");
        if (payload?.deletedItemIds && Array.isArray(payload.deletedItemIds)) {
          const localDel = readLocalJSON<string[]>("menuDeletedItemIds", []);
          const mergedDel = Array.from(
            new Set([...localDel, ...payload.deletedItemIds]),
          );
          localStorage.setItem("menuDeletedItemIds", JSON.stringify(mergedDel));
        }
        api.getSettings().then((data) => {
          if (data) settingsListeners.forEach((cb) => cb(data));
        });
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload: any) => {
          if (payload.eventType === "DELETE" && payload.old) {
            const delId = String(payload.old._id || payload.old.id);
            if (delId) {
              broadcastOrdersMemoryCache.delete(delId);
              const localOrdersStr = localStorage.getItem("local_orders");
              if (localOrdersStr) {
                let localOrders = readLocalJSON<any[]>("local_orders", []);
                localOrders = localOrders.filter(
                  (o: any) => String(o._id) !== delId && String(o.id) !== delId,
                );
                localStorage.setItem(
                  "local_orders",
                  JSON.stringify(localOrders),
                );
              }
            }
          }
          if (ordersListeners.length > 0) {
            triggerLocalOrdersChange();
          }

          if (
            payload.eventType === "INSERT" &&
            payload.new &&
            payload.new.items
          ) {
            api.deductInventoryForOrderItems(payload.new.items);
          }

          customerOrderListeners.forEach((listener) => {
            const newRecord = payload.new;
            const oldRecord = payload.old;
            const affectedCustomer =
              (newRecord &&
                (newRecord.customerName ||
                  newRecord.customer_name ||
                  newRecord.table_no ||
                  newRecord.tableNo)) ||
              (oldRecord &&
                (oldRecord.customerName ||
                  oldRecord.customer_name ||
                  oldRecord.table_no ||
                  oldRecord.tableNo));

            if (
              !affectedCustomer ||
              affectedCustomer === listener.customerName
            ) {
              listener.fetchAndCallback();
            }
          });
        },
      )
      .on("broadcast", { event: "orders_changed" }, (evtPayload: any) => {
        const payload = evtPayload?.payload || evtPayload;
        if (payload) {
          if (payload.action === "delete" && payload.orderId) {
            const delId = String(payload.orderId);
            broadcastOrdersMemoryCache.delete(delId);
            broadcastOrdersMemoryCache.forEach((v, k) => {
              if (String(v._id) === delId || String(v.id) === delId) {
                broadcastOrdersMemoryCache.delete(k);
              }
            });
            const localOrdersStr = localStorage.getItem("local_orders");
            if (localOrdersStr) {
              let localOrders = readLocalJSON<any[]>("local_orders", []);
              localOrders = localOrders.filter(
                (o: any) => String(o._id) !== delId && String(o.id) !== delId,
              );
              localStorage.setItem("local_orders", JSON.stringify(localOrders));
            }
          } else if (payload.action === "clear") {
            if (payload.status) {
              broadcastOrdersMemoryCache.forEach((v, k) => {
                if (v.status === payload.status)
                  broadcastOrdersMemoryCache.delete(k);
              });
              const localOrdersStr = localStorage.getItem("local_orders");
              if (localOrdersStr) {
                let localOrders = readLocalJSON<any[]>("local_orders", []);
                localOrders = localOrders.filter(
                  (o: any) => o.status !== payload.status,
                );
                localStorage.setItem(
                  "local_orders",
                  JSON.stringify(localOrders),
                );
              }
            } else {
              broadcastOrdersMemoryCache.clear();
              localStorage.setItem("local_orders", JSON.stringify([]));
            }
          } else if (payload.order) {
            const norm = normalizeOrder(payload.order);
            if (norm && norm._id) {
              broadcastOrdersMemoryCache.set(String(norm._id), norm);
              const localOrders = readLocalJSON<any[]>("local_orders", []);
              const idx = localOrders.findIndex(
                (o: any) =>
                  String(o._id) === String(norm._id) ||
                  String(o.id) === String(norm._id),
              );
              if (idx !== -1) {
                localOrders[idx] = norm;
              } else {
                localOrders.push(norm);
              }
              localStorage.setItem("local_orders", JSON.stringify(localOrders));
            }
          } else if (payload.orderId) {
            const sId = String(payload.orderId);
            let prev = broadcastOrdersMemoryCache.get(sId);
            if (!prev) {
              const localOrdersStr = localStorage.getItem("local_orders");
              if (localOrdersStr) {
                try {
                  const localOrders = JSON.parse(localOrdersStr);
                  prev = localOrders.find(
                    (o: any) => String(o._id) === sId || String(o.id) === sId,
                  );
                } catch {}
              }
            }
            if (prev) {
              const updated = normalizeOrder({
                ...prev,
                ...payload,
                timestamp: payload.timestamp || new Date().toISOString(),
              });
              broadcastOrdersMemoryCache.set(sId, updated);
              const localOrders = readLocalJSON<any[]>("local_orders", []);
              const idx = localOrders.findIndex(
                (o: any) => String(o._id) === sId || String(o.id) === sId,
              );
              if (idx !== -1) {
                localOrders[idx] = updated;
              } else {
                localOrders.push(updated);
              }
              localStorage.setItem("local_orders", JSON.stringify(localOrders));
            }
          }
        }
        if (ordersListeners.length > 0) {
          triggerLocalOrdersChange();
        }
        customerOrderListeners.forEach((listener) => {
          listener.fetchAndCallback();
        });
      })
      .on("broadcast", { event: "tables_changed" }, () => {
        if (tablesListeners.length > 0) {
          triggerLocalTablesChange();
        }
      })
      .on("broadcast", { event: "inventory_changed" }, () => {
        kvCache.invalidate("inventory_items");
        kvCache.invalidate("recipe_boms");
        triggerLocalInventoryChange();
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tables" },
        () => {
          if (tablesListeners.length > 0) {
            triggerLocalTablesChange();
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory_items" },
        () => {
          kvCache.invalidate("inventory_items");
          triggerLocalInventoryChange();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recipe_boms" },
        () => {
          kvCache.invalidate("recipe_boms");
          triggerLocalInventoryChange();
        },
      )
      // ——— EdgeOne 部署：购物车实时同步（替代原 WebSocket cartHub） ———
      .on("broadcast", { event: "cart_changed" }, (evtPayload: any) => {
        const p = evtPayload?.payload || evtPayload;
        if (p?.table) {
          cartListeners.forEach((l) => {
            if (l.table === p.table) l.callback(p.cart || {});
          });
        }
      })
      .on("broadcast", { event: "cart_cleared" }, (evtPayload: any) => {
        const p = evtPayload?.payload || evtPayload;
        if (p?.table) {
          cartListeners.forEach((l) => {
            if (l.table === p.table) l.callback({});
          });
        }
      })
      .on("broadcast", { event: "admin_notification" }, (evtPayload: any) => {
        const p = evtPayload?.payload || evtPayload;
        adminNotificationListeners.forEach((l) => l(p));
      })
      .subscribe((status: string) => {
        console.log(`Supabase unified sync channel status: ${status}`);
        if (status === "SUBSCRIBED") {
          isRealtimeConnected = true;
          if (syncChannelRetryTimer) {
            clearTimeout(syncChannelRetryTimer);
            syncChannelRetryTimer = null;
          }
        } else if (
          status === "CLOSED" ||
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT"
        ) {
          isRealtimeConnected = false;
          // 终端状态不会自动恢复订阅，丢弃旧 channel 并定时重建，恢复实时同步
          globalSyncChannel = null;
          if (!syncChannelRetryTimer) {
            syncChannelRetryTimer = setTimeout(() => {
              syncChannelRetryTimer = null;
              ensureSyncChannel();
            }, 3000);
          }
        }
      });
  }
};

// Start connection immediately on module load
ensureSyncChannel();

// 自动检测并补全 Supabase 生产环境数据库空表
setTimeout(() => {
  api.seedProductionDatabase(false).catch((err) => {
    console.warn("[Auto-Seed] Startup check notice:", err);
  });
}, 1000);

export const triggerBroadcast = (
  event: string,
  payload: Record<string, unknown> = {},
) => {
  ensureSyncChannel();
  if (globalSyncChannel) {
    globalSyncChannel
      .send({
        type: "broadcast",
        event,
        payload,
      })
      .catch((err: any) => {
        console.warn(`Failed to send broadcast for ${event}:`, err);
      });
  }
};

async function ensureNoBase64Image(
  imageUrl: string | undefined,
  folder: string,
): Promise<string> {
  if (!imageUrl || typeof imageUrl !== "string") return "";
  // 已是外链直接返回，避免二次上传
  if (!imageUrl.startsWith("data:image/")) return imageUrl;
  // 校验体积：原始 base64 > 4MB 拒绝直接上传，强制压缩
  if (imageUrl.length > 4 * 1024 * 1024) {
    console.warn(
      `[Upload] Image too large (${(imageUrl.length / 1024 / 1024).toFixed(2)}MB) in ${folder}, compressing...`,
    );
  }
  try {
    const uploaded = await api.uploadBlob(imageUrl, folder);
    // 若 uploadBlob 回退仍是 base64，检查是否已压缩到 300KB 以内，否则丢弃防止 DB 膨胀
    if (uploaded.startsWith("data:image/") && uploaded.length > 500 * 1024) {
      console.warn(
        `[Upload] Fallback base64 still too large (${(uploaded.length / 1024).toFixed(1)}KB), discarding to protect DB`,
      );
      return "";
    }
    return uploaded;
  } catch (e) {
    console.warn(
      `[Supabase Storage] Failed to upload base64 image to ${folder}:`,
      e,
    );
    // 降级：尝试本地压缩到 400x400，再失败则丢弃
    try {
      const tiny = await compressBase64Image(imageUrl, 400, 400, 0.6);
      if (tiny.length < 300 * 1024) return tiny;
    } catch {}
    return ""; // 宁可丢图也不让 3MB base64 进 JSON
  }
}

export const api = {
  getSettings: async () => {
    // 1. 尝试从腾讯云 / 本地 KV 缓存快速读取
    const cachedKvSettings = await kvCache.get<any>("app_settings");
    if (cachedKvSettings) {
      if (cachedKvSettings.categories) {
        cachedKvSettings.categories = mergeAndOrderCategories(
          cachedKvSettings.categories,
          INITIAL_MENU_CATEGORIES,
          cachedKvSettings.deletedItemIds || [],
        );
      }
      return cachedKvSettings;
    }

    try {
      if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
        const { data, error } = await supabase
          .from("settings")
          .select("*")
          .eq("id", SETTINGS_DOC_ID)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          tableColumnsCache["settings"] = Object.keys(data);
          if (data.categories) {
            data.categories = mergeAndOrderCategories(
              data.categories,
              INITIAL_MENU_CATEGORIES,
              data.deletedItemIds || [],
            );
          }
          // 写入 KV 缓存
          kvCache.set("app_settings", data, 600);
          return data;
        }
      }
    } catch (e) {
      handleSupabaseReadError(e, "getSettings");
    }

    // Local fallback
    const cachedBgUrl = localStorage.getItem("menuBgUrl");
    const cachedRestaurantName = localStorage.getItem("menuRestaurantName");
    const cachedWelcomeMessage = localStorage.getItem("menuWelcomeMessage");
    const cachedLogoUrl = localStorage.getItem("menuLogoUrl");
    const cachedAdminPassword = localStorage.getItem("menuAdminPassword");
    const cachedSecurityQuestion = localStorage.getItem("menuSecurityQuestion");
    const cachedSecurityAnswer = localStorage.getItem("menuSecurityAnswer");
    const cachedSoundEnabled = localStorage.getItem("menuSoundEnabled");
    const cachedLayoutStyle = localStorage.getItem("menuLayoutStyle");
    const cachedThemeMode = localStorage.getItem("menuThemeMode");

    const parsedDeletedIds = readLocalJSON<string[]>("menuDeletedItemIds", []);
    const cachedCategories = readLocalJSON<any[]>("menuCategories", []);

    return {
      categories: cachedCategories.length
        ? mergeAndOrderCategories(
            cachedCategories,
            INITIAL_MENU_CATEGORIES,
            parsedDeletedIds,
          )
        : INITIAL_MENU_CATEGORIES,
      promotions: readLocalJSON<any[]>("menuPromotions", []),
      bgUrl: cachedBgUrl || "",
      restaurantName: cachedRestaurantName || "炙·双味居",
      welcomeMessage: cachedWelcomeMessage || "Premium Charcoal BBQ",
      logoUrl: cachedLogoUrl || "",
      adminPassword: cachedAdminPassword || "admin123",
      devicePasswords: readLocalJSON<any[]>("menuDevicePasswords", []),
      securityQuestion: cachedSecurityQuestion || "",
      securityAnswer: cachedSecurityAnswer || "",
      soundEnabled: cachedSoundEnabled ? cachedSoundEnabled === "true" : true,
      layoutStyle: cachedLayoutStyle || "grid",
      receiptSettings: readLocalJSON<Record<string, unknown>>(
        "menuReceiptSettings",
        {},
      ),
      deletedItemIds: parsedDeletedIds,
      theme: (cachedThemeMode as "midnight" | "light") || "midnight",
    };
  },

  subscribeToSettings: (callback: (data: Record<string, unknown>) => void) => {
    settingsListeners.push(callback);

    let lastJson = "";
    const handleData = (data: Record<string, unknown>) => {
      if (!data) return;
      const currentJson = JSON.stringify(data);
      if (currentJson !== lastJson) {
        lastJson = currentJson;
        callback(data);
        // Sync to other local listeners
        settingsListeners.forEach((cb) => {
          if (cb !== callback) cb(data);
        });
      }
    };

    // Immediately fetch
    api
      .getSettings()
      .then(handleData)
      .catch(() => {});

    // Ensure the unified channel is running
    ensureSyncChannel();

    // Active polling fallback (ONLY polls if Supabase is unhealthy or unconfigured to sync local tabs)
    // Avoids polling the database if Supabase is connected and healthy
    const pollInterval = setInterval(() => {
      if (!isSupabaseConfigured || !isSupabaseHealthy || !isRealtimeConnected) {
        api
          .getSettings()
          .then(handleData)
          .catch(() => {});
      }
    }, 5000);

    // Passive refresh on window focus / tab visible (extremely cheap, only runs when user actively opens the app)
    let lastFetchTime = 0;
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFetchTime < 30000) return; // 30s throttle
      if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
        lastFetchTime = now;
        api
          .getSettings()
          .then(handleData)
          .catch(() => {});
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      settingsListeners = settingsListeners.filter((l) => l !== callback);
      clearInterval(pollInterval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  },

  getOrders: async () => {
    checkAndTriggerMoroccoDailyClear();
    try {
      let remoteOrders: any[] = [];
      if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
        const { data, error } = await supabase.from("orders").select("*");
        if (error) throw error;
        if (data) {
          remoteOrders = data.map(normalizeOrder);
        }
      }

      let localOrders = readLocalJSON<any[]>("local_orders", []);
      let needsSave = false;
      localOrders = localOrders.map((lo: Record<string, unknown>) => {
        if (!lo._id && !lo.id) needsSave = true;
        return normalizeOrder(lo);
      });
      if (needsSave) {
        localStorage.setItem("local_orders", JSON.stringify(localOrders));
      }

      const mergedMap = new Map<string, Order>();
      remoteOrders.forEach((ro) => {
        const norm = normalizeOrder(ro);
        if (norm._id) mergedMap.set(String(norm._id), norm);
      });
      localOrders.forEach((lo: Record<string, unknown>) => {
        const norm = normalizeOrder(lo);
        if (norm._id) {
          const existing = mergedMap.get(String(norm._id));
          if (!existing) {
            mergedMap.set(String(norm._id), norm);
          } else {
            const existingTime = new Date(existing.timestamp || 0).getTime();
            const normTime = new Date(norm.timestamp || 0).getTime();
            if (normTime > existingTime) {
              mergedMap.set(String(norm._id), norm);
            }
          }
        }
      });

      return Array.from(mergedMap.values()).sort(
        (a: Order, b: Order) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
    } catch (e) {
      handleSupabaseReadError(e, "getOrders");
      let localOrders = readLocalJSON<any[]>("local_orders", []);
      let needsSave = false;
      localOrders = localOrders.map((lo: Record<string, unknown>) => {
        if (!lo._id && !lo.id) needsSave = true;
        return normalizeOrder(lo);
      });
      if (needsSave) {
        localStorage.setItem("local_orders", JSON.stringify(localOrders));
      }
      return localOrders.sort(
        (a: Record<string, unknown>, b: Record<string, unknown>) =>
          new Date(a.timestamp as string).getTime() -
          new Date(b.timestamp as string).getTime(),
      );
    }
  },

  subscribeToOrders: (callback: (orders: Order[]) => void) => {
    ordersListeners.push(callback);

    let lastJson = "";
    const fetchAndTrigger = async () => {
      try {
        const currentOrders = await api.getOrders();
        const currentJson = JSON.stringify(currentOrders);
        if (currentJson !== lastJson) {
          lastJson = currentJson;
          callback(currentOrders);
          ordersListeners.forEach((cb) => {
            if (cb !== callback) cb(currentOrders);
          });
        }
      } catch (e) {
        console.warn("Failed to fetch orders in fallback:", e);
      }
    };

    fetchAndTrigger();
    ensureSyncChannel();

    let lastFetchTime = 0;

    const pollInterval = setInterval(() => {
      // 智能自适应策略（额度防护）：
      // 1. 如果页面处于后台 (document.hidden)，彻底不进行 API 轮询
      // 2. 如果 WebSocket 已稳定连通 (isRealtimeConnected === true)，通过长连接实时推送，减少 95%+ 数据库轮询，仅保留 60 秒极低频安全心跳
      // 3. 只有当 WebSocket 断线 (isRealtimeConnected === false) 时，才启动 10 秒兜底轮询
      if (document.hidden) return;

      if (!isRealtimeConnected) {
        fetchAndTrigger();
      } else {
        const now = Date.now();
        if (now - lastFetchTime > 60000) {
          lastFetchTime = now;
          fetchAndTrigger();
        }
      }
    }, 10000);

    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFetchTime < 10000) return;
      if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
        lastFetchTime = now;
        fetchAndTrigger();
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      ordersListeners = ordersListeners.filter((l) => l !== callback);
      clearInterval(pollInterval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  },

  verifyOrderValidity: async (
    customerNameOrTable: string,
  ): Promise<{ hasActiveOrder: boolean; activeOrder: Order | null }> => {
    const custName = customerNameOrTable || "A1";

    // 1. Check local storage
    const localOrders = readLocalJSON<any[]>("local_orders", []);
    const localActive = localOrders
      .map(normalizeOrder)
      .find((o: any) => isOrderMatchingTable(o, custName) && isOrderActive(o));

    // 2. Check memory cache
    const memActive = Array.from(broadcastOrdersMemoryCache.values())
      .map(normalizeOrder)
      .find((o: any) => isOrderMatchingTable(o, custName) && isOrderActive(o));

    // 3. Check DB
    let dbActive: Order | null = null;
    if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
      try {
        const cols =
          (await getTableColumns("orders")) || KNOWN_COLUMNS["orders"] || [];
        let query = supabase
          .from("orders")
          .select("*")
          .neq("status", "completed")
          .neq("status", "cancelled");

        const validMatchCols = [
          "table_no",
          "customer_name",
          "customerName",
          "tableNo",
        ].filter((c) => cols.includes(c));
        const targetNorm = normalizeTableString(custName);
        if (validMatchCols.length > 0) {
          const matchValues = Array.from(
            new Set([
              custName,
              targetNorm,
              `桌号 ${custName}`,
              `桌号 ${targetNorm}`,
              `${targetNorm}号桌`,
            ]),
          ).filter(Boolean) as string[];
          const conditions: string[] = [];
          validMatchCols.forEach((col) => {
            matchValues.forEach((val) => {
              conditions.push(`${col}.eq.${escOrVal(val)}`);
            });
          });
          if (conditions.length > 0) {
            query = query.or(conditions.join(","));
          }
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const sorted = data
            .map(normalizeOrder)
            .sort(
              (a: any, b: any) =>
                parseOrderTimestamp(b.timestamp) -
                parseOrderTimestamp(a.timestamp),
            );
          dbActive = sorted[0] ?? null;
        }
      } catch (e) {
        console.warn("[verifyOrderValidity] server verification failed:", e);
      }
    }

    const candidates = [localActive, memActive, dbActive].filter(
      (x): x is Order => x != null,
    );
    if (candidates.length > 0) {
      candidates.sort(
        (a, b) =>
          parseOrderTimestamp(b.timestamp) - parseOrderTimestamp(a.timestamp),
      );
      return { hasActiveOrder: true, activeOrder: candidates[0] ?? null };
    }

    return { hasActiveOrder: false, activeOrder: null };
  },

  addOrder: async (order: Record<string, unknown>) => {
    const custName = order.customerName || order.customer_name || "A1";
    const tableNo = order.tableNo || order.table_no || custName || "A1";

    const newId =
      order.id ||
      order._id ||
      "ORD-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    const sanitizedItems = [];
    if (order.items && Array.isArray(order.items)) {
      for (const item of order.items) {
        const cleanImage = await ensureNoBase64Image(
          item.image,
          "order_dishes",
        );
        sanitizedItems.push({ ...item, image: cleanImage });
      }
    }

    const localOrders = readLocalJSON<any[]>("local_orders", []);

    // Always create a brand-new independent order so new orders are never mixed up with previous orders
    const fullOrder = normalizeOrder({
      id: newId,
      _id: newId,
      orderNumber:
        order.orderNumber || "ORD-" + Math.floor(Math.random() * 1000000),
      customerName: custName,
      customer_name: custName,
      table_no: tableNo,
      tableNo: tableNo,
      status: order.status || "pending",
      items: sanitizedItems,
      total: Number(order.total || 0),
      total_amount: Number(order.total || 0),
      timestamp: order.timestamp || new Date().toISOString(),
      created_at: order.timestamp || new Date().toISOString(),
      createdAt: order.timestamp || new Date().toISOString(),
      notes: order.notes || "",
      unprintedNewOrder: true,
      unprintedAdditions: order.unprintedAdditions || [],
    });

    localOrders.push(fullOrder);
    localStorage.setItem("local_orders", JSON.stringify(localOrders));
    broadcastOrdersMemoryCache.set(String(fullOrder._id), fullOrder);

    if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
      try {
        const dbPayload = await filterPayloadByTable(
          "orders",
          fullOrder as unknown as Record<string, unknown>,
        );
        const { error: insertError } = await supabase
          .from("orders")
          .insert(dbPayload);
        if (insertError)
          console.warn("[addOrder] Supabase insert error:", insertError);
      } catch (dbErr) {
        console.warn("[addOrder] Supabase insert sync failed:", dbErr);
      }
    }

    triggerLocalOrdersChange();
    triggerBroadcast("orders_changed", { action: "upsert", order: fullOrder });
    api.deductInventoryForOrderItems(order.items as Record<string, unknown>[]);
    return fullOrder;
  },

  appendDishesToOrder: async (
    targetOrderId: string,
    orderData: Record<string, unknown>,
  ) => {
    const sId = String(targetOrderId);

    // Find base order
    const localOrders = readLocalJSON<any[]>("local_orders", []);
    let baseOrder =
      broadcastOrdersMemoryCache.get(sId) ||
      localOrders
        .map(normalizeOrder)
        .find((o: any) => String(o._id) === sId || String(o.id) === sId);

    if (!baseOrder && supabase && isSupabaseConfigured && isSupabaseHealthy) {
      try {
        const cols =
          (await getTableColumns("orders")) || KNOWN_COLUMNS["orders"] || [];
        const matchCol = cols.includes("_id") ? "_id" : "id";
        const { data } = await supabase
          .from("orders")
          .select("*")
          .eq(matchCol, sId);
        if (data && data.length > 0) baseOrder = normalizeOrder(data[0]);
      } catch (e) {
        console.warn("[appendDishesToOrder] DB fetch error:", e);
      }
    }

    if (!baseOrder) {
      return await api.addOrder(orderData);
    }

    const sanitizedItems = [];
    if (orderData.items && Array.isArray(orderData.items)) {
      for (const item of orderData.items) {
        const cleanImage = await ensureNoBase64Image(
          item.image,
          "order_dishes",
        );
        sanitizedItems.push({ ...item, image: cleanImage, isAdded: true });
      }
    }

    const existingItems = baseOrder.items || [];
    const updatedItems = [...existingItems, ...sanitizedItems];
    const currentUnprinted = baseOrder.unprintedAdditions || [];
    const updatedUnprinted = [
      ...currentUnprinted,
      { items: sanitizedItems, timestamp: new Date().toISOString() },
    ];
    const addedTotal = Number(orderData.total || 0);
    const updatedTotal = Number(
      (
        Number(baseOrder.total || baseOrder.total_amount || 0) + addedTotal
      ).toFixed(2),
    );

    const updatePayload = {
      items: updatedItems,
      unprintedAdditions: updatedUnprinted,
      total: updatedTotal,
      total_amount: updatedTotal,
      timestamp: new Date().toISOString(),
    };

    const fullOrder = normalizeOrder({
      ...baseOrder,
      ...updatePayload,
    });

    await api.updateOrder(sId, updatePayload, fullOrder);
    api.deductInventoryForOrderItems(
      orderData.items as Record<string, unknown>[],
    );

    return fullOrder;
  },

  updateOrder: async (
    orderId: string,
    updatePayload: Record<string, unknown>,
    fullOrderOverride?: Order,
  ) => {
    const sId = String(orderId);

    let prev: Order | undefined =
      fullOrderOverride || broadcastOrdersMemoryCache.get(sId);
    if (!prev) {
      const localOrdersStr = localStorage.getItem("local_orders");
      if (localOrdersStr) {
        try {
          const localOrders = JSON.parse(localOrdersStr);
          prev = localOrders.find(
            (o: any) => String(o._id) === sId || String(o.id) === sId,
          );
        } catch {}
      }
    }

    const updatedOrder = normalizeOrder({
      ...(prev || {}),
      ...updatePayload,
      _id: sId,
      id: sId,
      timestamp: updatePayload.timestamp || new Date().toISOString(),
    });

    broadcastOrdersMemoryCache.set(sId, updatedOrder);

    try {
      if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
        const cols =
          (await getTableColumns("orders")) || KNOWN_COLUMNS["orders"] || [];
        const dbPayload = await filterPayloadByTable("orders", updatePayload);
        let queryBuilder = supabase.from("orders").update(dbPayload);
        if (cols.includes("_id")) {
          queryBuilder = queryBuilder.eq("_id", orderId);
        } else {
          queryBuilder = queryBuilder.eq("id", orderId);
        }
        const { error } = await queryBuilder;
        if (error) handleSupabaseError(error, "updateOrder");
      }
    } catch (e) {
      handleSupabaseError(e, "updateOrder");
    }

    const localOrders = readLocalJSON<any[]>("local_orders", []);
    const idx = localOrders.findIndex(
      (o: any) => String(o._id) === sId || String(o.id) === sId,
    );
    if (idx !== -1) {
      localOrders[idx] = updatedOrder;
    } else {
      localOrders.push(updatedOrder);
    }
    localStorage.setItem("local_orders", JSON.stringify(localOrders));

    triggerLocalOrdersChange();
    triggerBroadcast("orders_changed", {
      action: "upsert",
      order: updatedOrder,
      orderId: sId,
      ...updatePayload,
    });
  },

  clearOrders: async (status?: string) => {
    if (status) {
      broadcastOrdersMemoryCache.forEach((v, k) => {
        if (v.status === status) broadcastOrdersMemoryCache.delete(k);
      });
    } else {
      broadcastOrdersMemoryCache.clear();
    }

    try {
      if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
        const cols =
          (await getTableColumns("orders")) || KNOWN_COLUMNS["orders"] || [];
        let queryBuilder = supabase.from("orders").delete();
        if (status) {
          queryBuilder = queryBuilder.eq("status", status);
        } else {
          if (cols.includes("id")) {
            queryBuilder = queryBuilder.neq("id", "keep-none");
          } else if (cols.includes("_id")) {
            queryBuilder = queryBuilder.neq("_id", "keep-none");
          }
        }
        const { error } = await queryBuilder;
        if (error) handleSupabaseError(error, "clearOrders");
      }
    } catch (e) {
      handleSupabaseError(e, "clearOrders");
    }

    const localOrdersStr = localStorage.getItem("local_orders");
    if (localOrdersStr) {
      let localOrders = readLocalJSON<any[]>("local_orders", []);
      if (status) {
        localOrders = localOrders.filter((o: any) => o.status !== status);
      } else {
        localOrders = [];
      }
      localStorage.setItem("local_orders", JSON.stringify(localOrders));
    }
    triggerLocalOrdersChange();
    triggerBroadcast("orders_changed", { action: "clear", status });
  },

  // 自动归档清理：删除超过 N 天的已完成订单，控制 DB 存储（Supabase 免费层配额保护）
  cleanupOldOrders: async (days = 30) => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let removed = 0;
    if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
      try {
        const cols =
          (await getTableColumns("orders")) || KNOWN_COLUMNS["orders"] || [];
        const tsCol = cols.includes("timestamp")
          ? "timestamp"
          : cols.includes("created_at")
            ? "created_at"
            : null;
        let q = supabase.from("orders").delete().eq("status", "completed");
        if (tsCol) {
          q = q.lt(tsCol, new Date(cutoff).toISOString());
        } else {
          // 无时间列：拉到内存过滤（仅在极端旧表时触发）
          const { data } = await supabase
            .from("orders")
            .select("id,_id,timestamp,created_at,status")
            .eq("status", "completed");
          if (data) {
            const ids = data
              .filter((o: any) => {
                const ts = o.timestamp || o.created_at;
                return ts && new Date(ts).getTime() < cutoff;
              })
              .map((o: any) => o.id || o._id);
            if (ids.length)
              await supabase.from("orders").delete().in("id", ids);
            removed = ids.length;
          }
        }
        if (tsCol) {
          const { error, count } = await q;
          if (error) handleSupabaseError(error, "cleanupOldOrders");
          removed = count ?? 0;
        }
      } catch (e) {
        handleSupabaseError(e, "cleanupOldOrders");
      }
    }

    // 清理本地缓存中的过期已完成订单
    const localOrdersStr = localStorage.getItem("local_orders");
    if (localOrdersStr) {
      try {
        const localOrders = JSON.parse(localOrdersStr);
        const kept = localOrders.filter((o: any) => {
          if (o.status !== "completed") return true;
          const ts = o.timestamp || o.created_at;
          return !ts || new Date(ts).getTime() >= cutoff;
        });
        if (kept.length !== localOrders.length) {
          localStorage.setItem("local_orders", JSON.stringify(kept));
          triggerLocalOrdersChange();
        }
      } catch {}
    }
    triggerBroadcast("orders_changed", {
      action: "clear",
      status: "completed",
    });
    return removed;
  },

  deleteOrder: async (orderId: string) => {
    const sId = String(orderId);
    broadcastOrdersMemoryCache.delete(sId);
    broadcastOrdersMemoryCache.forEach((v, k) => {
      if (String(v._id) === sId || String(v.id) === sId) {
        broadcastOrdersMemoryCache.delete(k);
      }
    });

    try {
      if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
        const cols =
          (await getTableColumns("orders")) || KNOWN_COLUMNS["orders"] || [];
        let queryBuilder = supabase.from("orders").delete();
        if (cols.includes("_id")) {
          queryBuilder = queryBuilder.eq("_id", orderId);
        } else {
          queryBuilder = queryBuilder.eq("id", orderId);
        }
        const { error } = await queryBuilder;
        if (error) handleSupabaseError(error, "deleteOrder");
      }
    } catch (e) {
      handleSupabaseError(e, "deleteOrder");
    }

    const localOrdersStr = localStorage.getItem("local_orders");
    if (localOrdersStr) {
      let localOrders = readLocalJSON<any[]>("local_orders", []);
      localOrders = localOrders.filter(
        (o: any) => String(o._id) !== sId && String(o.id) !== sId,
      );
      localStorage.setItem("local_orders", JSON.stringify(localOrders));
    }
    triggerLocalOrdersChange();
    triggerBroadcast("orders_changed", { action: "delete", orderId });
  },

  subscribeToCustomerOrder: (
    customerName: string,
    callback: (order: Order | null) => void,
  ) => {
    let isCancelled = false;

    const getLatestActiveLocalOrMem = () => {
      const memOrders = Array.from(broadcastOrdersMemoryCache.values())
        .map(normalizeOrder)
        .filter(
          (o) => isOrderMatchingTable(o, customerName) && isOrderActive(o),
        );
      const localOrders = readLocalJSON<any[]>("local_orders", []);
      const localActive = localOrders
        .map(normalizeOrder)
        .filter(
          (o: any) => isOrderMatchingTable(o, customerName) && isOrderActive(o),
        );

      const all = [...memOrders, ...localActive];
      if (all.length === 0) return null;
      all.sort(
        (a, b) =>
          parseOrderTimestamp(b.timestamp) - parseOrderTimestamp(a.timestamp),
      );
      return all[0];
    };

    const fetchAndCallback = async () => {
      try {
        let dbOrder = null;
        if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
          const cols =
            (await getTableColumns("orders")) || KNOWN_COLUMNS["orders"] || [];
          let query = supabase
            .from("orders")
            .select("*")
            .neq("status", "completed")
            .neq("status", "cancelled");

          const validMatchCols = [
            "table_no",
            "customer_name",
            "customerName",
            "tableNo",
          ].filter((c) => cols.includes(c));
          const targetNorm = normalizeTableString(customerName);
          if (validMatchCols.length > 0) {
            const matchValues = Array.from(
              new Set([
                customerName,
                targetNorm,
                `桌号 ${customerName}`,
                `桌号 ${targetNorm}`,
                `${targetNorm}号桌`,
              ]),
            ).filter(Boolean) as string[];
            const conditions: string[] = [];
            validMatchCols.forEach((col) => {
              matchValues.forEach((val) => {
                conditions.push(`${col}.eq.${escOrVal(val)}`);
              });
            });
            if (conditions.length > 0) {
              query = query.or(conditions.join(","));
            }
          }

          if (cols.includes("timestamp")) {
            query = query.order("timestamp", { ascending: false });
          } else if (cols.includes("created_at")) {
            query = query.order("created_at", { ascending: false });
          }
          const { data, error } = await query;
          if (error) handleSupabaseReadError(error, "subscribeToCustomerOrder");
          if (isCancelled) return;

          if (data && data.length > 0) {
            dbOrder = normalizeOrder(data[0]);
          }
        }

        const localMemOrder = getLatestActiveLocalOrMem();

        if (dbOrder && localMemOrder) {
          const dbTime = parseOrderTimestamp(dbOrder.timestamp);
          const localTime = parseOrderTimestamp(localMemOrder.timestamp);
          if (localTime >= dbTime) {
            callback(localMemOrder);
          } else {
            callback(dbOrder);
          }
        } else if (localMemOrder) {
          callback(localMemOrder);
        } else if (dbOrder) {
          callback(dbOrder);
        } else {
          callback(null);
        }
      } catch (e) {
        handleSupabaseReadError(e, "subscribeToCustomerOrder fetchAndCallback");
        const localMemOrder = getLatestActiveLocalOrMem();
        callback(localMemOrder ?? null);
      }
    };

    const listenerObj = { customerName, callback, fetchAndCallback };
    customerOrderListeners.push(listenerObj);

    fetchAndCallback();

    return () => {
      isCancelled = true;
      customerOrderListeners = customerOrderListeners.filter(
        (l) => l !== listenerObj,
      );
    };
  },

  updateOrderStatus: async (orderId: string, status: string) => {
    const sId = String(orderId);
    // 高风险4修复：状态机校验
    const prevAny =
      broadcastOrdersMemoryCache.get(sId) ||
      (() => {
        try {
          const arr = JSON.parse(localStorage.getItem("local_orders") || "[]");
          return arr.find(
            (o: any) => String(o._id) === sId || String(o.id) === sId,
          );
        } catch {
          return null;
        }
      })();
    const from = String(prevAny?.status || "pending");
    const allowed: Record<string, string[]> = {
      pending: ["cooking", "cancelled"],
      cooking: ["served", "cancelled"],
      served: ["completed", "cancelled"],
      completed: [],
      cancelled: [],
    };
    if (
      from !== String(status).toLowerCase() &&
      !(allowed[from.toLowerCase()] || []).includes(
        String(status).toLowerCase(),
      )
    ) {
      const err = new Error(`非法状态流转 ${from} -> ${status}`);
      console.error("[orders] status blocked", err);
      throw err;
    }
    if (broadcastOrdersMemoryCache.has(sId)) {
      const prev = broadcastOrdersMemoryCache.get(sId);
      const updated = normalizeOrder({
        ...prev,
        status,
        timestamp: new Date().toISOString(),
      });
      broadcastOrdersMemoryCache.set(sId, updated);
    }

    try {
      if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
        const cols =
          (await getTableColumns("orders")) || KNOWN_COLUMNS["orders"] || [];
        let queryBuilder = supabase.from("orders").update({
          status,
          timestamp: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
        if (cols.includes("_id")) {
          queryBuilder = queryBuilder.eq("_id", orderId);
        } else {
          queryBuilder = queryBuilder.eq("id", orderId);
        }
        const { error } = await queryBuilder;
        if (error) handleSupabaseError(error, "updateOrderStatus");
      }
    } catch (e) {
      handleSupabaseError(e, "updateOrderStatus");
    }

    const localOrdersStr = localStorage.getItem("local_orders");
    if (localOrdersStr) {
      const localOrders = readLocalJSON<any[]>("local_orders", []);
      const idx = localOrders.findIndex(
        (o: any) => String(o._id) === sId || String(o.id) === sId,
      );
      if (idx !== -1) {
        localOrders[idx] = normalizeOrder({
          ...localOrders[idx],
          status,
          timestamp: new Date().toISOString(),
        });
        localStorage.setItem("local_orders", JSON.stringify(localOrders));
      }
    }
    triggerLocalOrdersChange();
    triggerBroadcast("orders_changed", { action: "upsert", orderId, status });
  },

  updateSettings: async (
    payload: Record<string, unknown>,
    onProgress?: (msg: string) => void,
  ) => {
    try {
      if (onProgress)
        onProgress(
          "正在优化图文并保存到云端... (Optimizing & saving to cloud...)",
        );

      const cleanPayload = JSON.parse(JSON.stringify(payload));

      if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
        // Auto-extract inline base64 images and upload to Supabase Storage
        if (cleanPayload.categories && Array.isArray(cleanPayload.categories)) {
          for (const cat of cleanPayload.categories) {
            if (cat.items && Array.isArray(cat.items)) {
              for (const item of cat.items) {
                if (item.image) {
                  item.image = await ensureNoBase64Image(item.image, "dishes");
                }
              }
            }
          }
        }

        if (cleanPayload.promotions && Array.isArray(cleanPayload.promotions)) {
          for (const promo of cleanPayload.promotions) {
            if (promo.image) {
              promo.image = await ensureNoBase64Image(
                promo.image,
                "promotions",
              );
            }
          }
        }

        if (cleanPayload.bgUrl) {
          cleanPayload.bgUrl = await ensureNoBase64Image(
            cleanPayload.bgUrl,
            "backgrounds",
          );
        }

        if (cleanPayload.logoUrl) {
          cleanPayload.logoUrl = await ensureNoBase64Image(
            cleanPayload.logoUrl,
            "logos",
          );
        }

        const dbPayload = await filterPayloadByTable("settings", cleanPayload);

        const { error } = await supabase.from("settings").upsert({
          id: SETTINGS_DOC_ID,
          ...dbPayload,
        });

        if (error) throw error;
        // 更新 KV 高速缓存（仅在 DB 成功后）
        await kvCache.set("app_settings", cleanPayload, 600);
        triggerBroadcast("settings_changed");

        // 自动将分类与菜品同步至 Supabase 关系表 (categories / menu_items)
        if (cleanPayload.categories && Array.isArray(cleanPayload.categories)) {
          api
            .syncCategoriesAndMenuItemsToSupabase(cleanPayload.categories)
            .catch((err) => {
              console.warn(
                "[Auto-Sync] Failed to sync menu items to relational tables:",
                err,
              );
            });
        }

        if (onProgress) onProgress("");
        settingsListeners.forEach((cb) => cb(cleanPayload));
        return cleanPayload;
      }
    } catch (e) {
      handleSupabaseError(e, "updateSettings");
      // 区分配额/网络错误：若 Supabase 已配置但写入失败，抛给调用方以便提示用户，而非静默当作成功
      const msg = String((e as Error)?.message || e);
      if (
        msg.includes("quota") ||
        msg.includes("exceeded") ||
        msg.includes("503") ||
        msg.includes("429")
      ) {
        setQuotaExceeded(true);
      }
      // 仍做本地备份以防丢失，但需让调用方知道云端失败
      const isSupabaseWriteFailure =
        supabase && isSupabaseConfigured && isSupabaseHealthy;
      if (isSupabaseWriteFailure) {
        // 保存本地备份
        try {
          if (payload.categories)
            localStorage.setItem(
              "menuCategories",
              JSON.stringify(payload.categories),
            );
          if (payload.deletedItemIds !== undefined)
            localStorage.setItem(
              "menuDeletedItemIds",
              JSON.stringify(payload.deletedItemIds),
            );
          await kvCache.set("app_settings", payload, 600);
        } catch {}
        throw e; // 抛出让 UI 弹出“本地已保存，云端失败”提示
      }
    }

    // Local fallback（仅当 Supabase 未配置或未连接时走到这里）
    if (onProgress) onProgress("");
    if (payload.categories)
      localStorage.setItem(
        "menuCategories",
        JSON.stringify(payload.categories),
      );
    if (payload.promotions)
      localStorage.setItem(
        "menuPromotions",
        JSON.stringify(payload.promotions),
      );
    if (payload.bgUrl !== undefined)
      localStorage.setItem("menuBgUrl", String(payload.bgUrl));
    if (payload.restaurantName !== undefined)
      localStorage.setItem(
        "menuRestaurantName",
        String(payload.restaurantName),
      );
    if (payload.welcomeMessage !== undefined)
      localStorage.setItem(
        "menuWelcomeMessage",
        String(payload.welcomeMessage),
      );
    if (payload.logoUrl !== undefined)
      localStorage.setItem("menuLogoUrl", String(payload.logoUrl));
    if (payload.adminPassword !== undefined)
      localStorage.setItem("menuAdminPassword", String(payload.adminPassword));
    if (payload.devicePasswords !== undefined)
      localStorage.setItem(
        "menuDevicePasswords",
        JSON.stringify(payload.devicePasswords),
      );
    if (payload.securityQuestion !== undefined)
      localStorage.setItem(
        "menuSecurityQuestion",
        String(payload.securityQuestion),
      );
    if (payload.securityAnswer !== undefined)
      localStorage.setItem(
        "menuSecurityAnswer",
        String(payload.securityAnswer),
      );
    if (payload.soundEnabled !== undefined)
      localStorage.setItem("menuSoundEnabled", String(payload.soundEnabled));
    if (payload.layoutStyle !== undefined)
      localStorage.setItem("menuLayoutStyle", String(payload.layoutStyle));
    if (payload.receiptSettings !== undefined)
      localStorage.setItem(
        "menuReceiptSettings",
        JSON.stringify(payload.receiptSettings),
      );
    if (payload.deletedItemIds !== undefined)
      localStorage.setItem(
        "menuDeletedItemIds",
        JSON.stringify(payload.deletedItemIds),
      );
    if (payload.theme !== undefined)
      localStorage.setItem("menuThemeMode", String(payload.theme));

    await kvCache.set("app_settings", payload, 600);
    settingsListeners.forEach((cb) => cb(payload));
    triggerBroadcast("settings_changed");
    return payload;
  },

  uploadBlob: async (base64: string, basePath: string) => {
    // 1. 先压缩到 800x800 0.72，作为上传源
    let compressedBase64 = base64;
    try {
      compressedBase64 = await compressBase64Image(base64, 800, 800, 0.72);
      // 若压缩后仍 > 400KB，再二次压缩
      if (compressedBase64.length > 400 * 1024) {
        compressedBase64 = await compressBase64Image(
          compressedBase64,
          600,
          600,
          0.65,
        );
      }
    } catch (e) {
      console.warn("Image compress failed, using original", e);
    }

    // 2. 尝试上传到 Storage，成功则返回 URL
    try {
      const publicUrl = await blobStorage.uploadImage(
        compressedBase64,
        basePath,
      );
      // 只有返回 http/https 才算成功上传，避免把 base64 当 URL 存入 DB
      if (
        publicUrl &&
        (publicUrl.startsWith("http://") || publicUrl.startsWith("https://"))
      ) {
        return publicUrl;
      }
      // 若返回的仍是 base64，说明上传未成功，继续走压缩兜底
      if (publicUrl && publicUrl.startsWith("data:image/")) {
        compressedBase64 = publicUrl;
      }
    } catch (e) {
      console.warn(
        "Blob Storage upload failed, falling back to compressed base64",
        e,
      );
    }

    // 3. 兜底：确保最终存入 DB 的 base64 不超过 500KB，否则丢弃
    if (
      compressedBase64.startsWith("data:image/") &&
      compressedBase64.length > 500 * 1024
    ) {
      try {
        compressedBase64 = await compressBase64Image(
          compressedBase64,
          500,
          500,
          0.6,
        );
      } catch {}
      if (compressedBase64.length > 500 * 1024) {
        console.warn(
          `[uploadBlob] Compressed image still >500KB (${(compressedBase64.length / 1024).toFixed(1)}KB), discarding`,
        );
        return "";
      }
    }
    return compressedBase64;
  },

  getStorageDiagnostics: async () => {
    if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
      try {
        const folders = [
          "dishes",
          "backgrounds",
          "bg",
          "logo",
          "promotions",
          "categories",
        ];
        let totalSizeBytes = 0;
        const allFiles: Array<{
          name: string;
          path: string;
          size: number;
          createdAt: string;
        }> = [];

        // Add root files and discover additional folders
        try {
          const { data: rootItems, error: rootError } = await supabase.storage
            .from("menu-assets")
            .list("");
          if (!rootError && rootItems) {
            for (const item of rootItems) {
              if (item.name === ".emptyFolderPlaceholder") continue;
              const size = item.metadata?.size || (item as any).size || 0;
              if (size > 0) {
                totalSizeBytes += size;
                allFiles.push({
                  name: item.name,
                  path: item.name,
                  size: size,
                  createdAt: item.created_at || "",
                });
              } else if (
                !folders.includes(item.name) &&
                item.name.indexOf(".") === -1
              ) {
                folders.push(item.name);
              }
            }
          }
        } catch (rootErr) {
          console.warn("Failed to list root folder:", rootErr);
        }

        // List files in all folders
        for (const folder of folders) {
          try {
            const { data, error } = await supabase.storage
              .from("menu-assets")
              .list(folder);
            if (error) {
              console.warn(
                `Failed to list folder ${folder} in diagnostics:`,
                error,
              );
              continue;
            }
            if (data) {
              for (const file of data) {
                if (file.name === ".emptyFolderPlaceholder") continue;
                const size = file.metadata?.size || (file as any).size || 0;
                totalSizeBytes += size;
                allFiles.push({
                  name: file.name,
                  path: `${folder}/${file.name}`,
                  size: size,
                  createdAt: file.created_at || "",
                });
              }
            }
          } catch (folderErr) {
            console.warn(`Error scanning folder ${folder}:`, folderErr);
          }
        }

        // Sort allFiles by size descending
        allFiles.sort((a, b) => b.size - a.size);

        return {
          success: true,
          totalUsedBytes: totalSizeBytes,
          bucketLimitBytes: 1024 * 1024 * 1024, // 1 GB free limit
          files: allFiles,
          configured: true,
        };
      } catch (err) {
        console.error("Storage diagnostics failed:", err);
        return {
          success: false,
          error: (err as Error)?.message,
          configured: true,
        };
      }
    }
    return {
      success: false,
      error: "Supabase not configured or unhealthy",
      configured: false,
    };
  },

  deleteStorageFile: async (filePath: string) => {
    if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
      try {
        const { data, error } = await supabase.storage
          .from("menu-assets")
          .remove([filePath]);
        if (error) throw error;
        return { success: true, data };
      } catch (err) {
        console.error("Failed to delete storage file:", err);
        return { success: false, error: (err as Error)?.message };
      }
    }
    return { success: false, error: "Supabase not configured or unhealthy" };
  },

  // Static Table QR
  createTableQr: async (tableNo: string) => {
    try {
      if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
        // Check first
        const { data: existing, error: selectError } = await supabase
          .from("tables")
          .select("*")
          .eq("tableNo", tableNo)
          .maybeSingle();

        if (selectError) throw selectError;
        if (existing) {
          return existing;
        }

        const key = Math.random().toString(36).substring(2, 10);
        const tableData = {
          tableNo,
          key,
          active: true,
          createdAt: new Date().toISOString(),
        };

        const { error: insertError } = await supabase
          .from("tables")
          .insert(tableData);

        if (insertError) throw insertError;
        triggerBroadcast("tables_changed");
        return tableData;
      }
    } catch (e) {
      handleSupabaseError(e, "createTableQr");
    }

    // Local Fallback
    const localTables = readLocalJSON<any[]>("local_tables", []);
    const existingIdx = localTables.findIndex(
      (t: any) => t.tableNo === tableNo,
    );
    const tableData = {
      tableNo,
      key: Math.random().toString(36).substring(2, 10),
      active: true,
      createdAt: new Date().toISOString(),
    };

    if (existingIdx !== -1) {
      return localTables[existingIdx];
    } else {
      localTables.push(tableData);
      localStorage.setItem("local_tables", JSON.stringify(localTables));
      triggerLocalTablesChange();
      triggerBroadcast("tables_changed");
      return tableData;
    }
  },

  getTableQr: async (tableNo: string) => {
    try {
      if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
        const { data, error } = await supabase
          .from("tables")
          .select("*")
          .eq("tableNo", tableNo)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          return data;
        }
      }
    } catch (e) {
      handleSupabaseReadError(e, "getTableQr");
    }

    const localTables = readLocalJSON<any[]>("local_tables", []);
    return localTables.find((t: any) => t.tableNo === tableNo) || null;
  },

  updateTableStatus: async (tableNo: string, active: boolean) => {
    try {
      if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
        const { error } = await supabase
          .from("tables")
          .update({ active })
          .eq("tableNo", tableNo);
        if (error) throw error;
        triggerBroadcast("tables_changed");
      }
    } catch (e) {
      handleSupabaseError(e, "updateTableStatus");
    }

    // Local
    const localTablesStr = localStorage.getItem("local_tables");
    if (localTablesStr) {
      const localTables = readLocalJSON<any[]>("local_tables", []);
      const idx = localTables.findIndex((t: any) => t.tableNo === tableNo);
      if (idx !== -1) {
        localTables[idx] = { ...localTables[idx], active };
        localStorage.setItem("local_tables", JSON.stringify(localTables));
        triggerLocalTablesChange();
        triggerBroadcast("tables_changed");
      }
    }
  },

  deleteTableQr: async (tableNo: string) => {
    try {
      if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
        const { error } = await supabase
          .from("tables")
          .delete()
          .eq("tableNo", tableNo);
        if (error) throw error;
        triggerBroadcast("tables_changed");
      }
    } catch (e) {
      handleSupabaseError(e, "deleteTableQr");
    }

    // Local
    const localTablesStr = localStorage.getItem("local_tables");
    if (localTablesStr) {
      let localTables = readLocalJSON<any[]>("local_tables", []);
      localTables = localTables.filter((t: any) => t.tableNo !== tableNo);
      localStorage.setItem("local_tables", JSON.stringify(localTables));
      triggerLocalTablesChange();
      triggerBroadcast("tables_changed");
    }
  },

  subscribeToTables: (
    callback: (tables: Record<string, unknown>[]) => void,
  ) => {
    tablesListeners.push(callback);

    let lastJson = "";
    const fetchAndTrigger = async () => {
      let remoteTables: Record<string, unknown>[] = [];
      try {
        if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
          const { data, error } = await supabase.from("tables").select("*");
          if (error) throw error;
          if (data) {
            remoteTables = data;
          }
        }
      } catch (e) {
        handleSupabaseReadError(e, "subscribeToTables fetchAndTrigger");
      }

      const localTables = readLocalJSON<any[]>("local_tables", []);

      const merged = [...remoteTables];
      localTables.forEach((lt: any) => {
        if (!merged.some((rt) => rt.tableNo === lt.tableNo)) {
          merged.push(lt);
        }
      });

      const currentJson = JSON.stringify(merged);
      if (currentJson !== lastJson) {
        lastJson = currentJson;
        callback(merged);
        tablesListeners.forEach((cb) => {
          if (cb !== callback) cb(merged);
        });
      }
    };

    // Immediate fetch
    fetchAndTrigger();

    // Ensure unified sync channel
    ensureSyncChannel();

    // Active polling fallback (ONLY polls if Supabase is unhealthy or unconfigured to sync local tabs)
    // Avoids polling the database if Supabase is connected and healthy
    const pollInterval = setInterval(() => {
      if (!isSupabaseConfigured || !isSupabaseHealthy || !isRealtimeConnected) {
        fetchAndTrigger();
      }
    }, 5000);

    // Passive refresh on window focus / tab visible
    let lastFetchTime = 0;
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFetchTime < 30000) return; // 30s throttle
      if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
        lastFetchTime = now;
        fetchAndTrigger();
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      tablesListeners = tablesListeners.filter((l) => l !== callback);
      clearInterval(pollInterval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  },

  // ==========================================
  // 库存物料 & BOM配方 API 接口
  // ==========================================
  getInventoryItems: async (): Promise<InventoryItem[]> => {
    // 尝试从 KV 读取
    const cachedKv = await kvCache.get<any[]>("inventory_items");
    if (cachedKv) return cachedKv;

    try {
      if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
        const { data, error } = await supabase
          .from("inventory_items")
          .select("*")
          .order("id", { ascending: true });
        if (error) throw error;
        if (data && data.length > 0) {
          kvCache.set("inventory_items", data, 300);
          return data;
        }
      }
    } catch (e) {
      handleSupabaseReadError(e, "getInventoryItems");
    }

    const localStr = localStorage.getItem("local_inventory_items");
    if (localStr) {
      return readLocalJSON<InventoryItem[]>("local_inventory_items", []);
    }
    localStorage.setItem(
      "local_inventory_items",
      JSON.stringify(DEFAULT_INVENTORY_ITEMS),
    );
    return DEFAULT_INVENTORY_ITEMS;
  },

  saveInventoryItem: async (
    item: Partial<InventoryItem> & Pick<InventoryItem, "id" | "name">,
  ) => {
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
      handleSupabaseError(e, "saveInventoryItem");
    }

    const localItems: InventoryItem[] = readLocalJSON<InventoryItem[]>(
      "local_inventory_items",
      [...DEFAULT_INVENTORY_ITEMS],
    );
    const idx = localItems.findIndex((i: InventoryItem) => i.id === item.id);
    if (idx !== -1) {
      localItems[idx] = { ...localItems[idx], ...payload } as InventoryItem;
    } else {
      localItems.push(payload as unknown as InventoryItem);
    }
    localStorage.setItem("local_inventory_items", JSON.stringify(localItems));
    kvCache.invalidate("inventory_items");
    triggerLocalInventoryChange();
    triggerBroadcast("inventory_changed");
  },

  deleteInventoryItem: async (id: string) => {
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
      handleSupabaseError(e, "deleteInventoryItem");
    }

    kvCache.invalidate("inventory_items");
    const localStr = localStorage.getItem("local_inventory_items");
    if (localStr) {
      let localItems: InventoryItem[] = readLocalJSON<InventoryItem[]>(
        "local_inventory_items",
        [],
      );
      localItems = localItems.filter((i: InventoryItem) => i.id !== id);
      localStorage.setItem("local_inventory_items", JSON.stringify(localItems));
      triggerLocalInventoryChange();
      triggerBroadcast("inventory_changed");
    }
  },

  getRecipeBoms: async (): Promise<RecipeBom[]> => {
    // 尝试从 KV 缓存中快速读取 BOM 配方
    const cachedBoms = await kvCache.get<any[]>("recipe_boms");
    if (cachedBoms) return cachedBoms;

    try {
      if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
        const { data, error } = await supabase.from("recipe_boms").select("*");
        if (error) throw error;
        if (data && data.length > 0) {
          kvCache.set("recipe_boms", data, 300);
          return data;
        }
      }
    } catch (e) {
      handleSupabaseReadError(e, "getRecipeBoms");
    }

    const localStr = localStorage.getItem("local_recipe_boms");
    if (localStr) {
      return readLocalJSON<RecipeBom[]>("local_recipe_boms", []);
    }
    localStorage.setItem(
      "local_recipe_boms",
      JSON.stringify(DEFAULT_RECIPE_BOMS),
    );
    return DEFAULT_RECIPE_BOMS;
  },

  saveRecipeBom: async (bom: RecipeBom) => {
    const payload = await filterPayloadByTable("recipe_boms", {
      ...bom,
      id: bom.id || "BOM-" + Math.random().toString(36).substring(2, 9),
    });

    try {
      if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
        const { error } = await supabase
          .from("recipe_boms")
          .upsert(payload, { onConflict: "id" });
        if (error) throw error;
        triggerBroadcast("inventory_changed");
      }
    } catch (e) {
      handleSupabaseError(e, "saveRecipeBom");
    }

    kvCache.invalidate("recipe_boms");
    const localBoms: RecipeBom[] = readLocalJSON<RecipeBom[]>(
      "local_recipe_boms",
      [...DEFAULT_RECIPE_BOMS],
    );
    const idx = localBoms.findIndex((b: RecipeBom) => b.id === payload.id);
    if (idx !== -1) {
      localBoms[idx] = { ...localBoms[idx], ...payload } as RecipeBom;
    } else {
      localBoms.push(payload as unknown as RecipeBom);
    }
    localStorage.setItem("local_recipe_boms", JSON.stringify(localBoms));
    triggerLocalInventoryChange();
    triggerBroadcast("inventory_changed");
  },

  deleteRecipeBom: async (id: string) => {
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
      handleSupabaseError(e, "deleteRecipeBom");
    }

    kvCache.invalidate("recipe_boms");
    const localStr = localStorage.getItem("local_recipe_boms");
    if (localStr) {
      let localBoms: RecipeBom[] = readLocalJSON<RecipeBom[]>(
        "local_recipe_boms",
        [],
      );
      localBoms = localBoms.filter((b: RecipeBom) => b.id !== id);
      localStorage.setItem("local_recipe_boms", JSON.stringify(localBoms));
      triggerLocalInventoryChange();
      triggerBroadcast("inventory_changed");
    }
  },

  subscribeToInventory: (callback: () => void) => {
    inventoryListeners.push(callback);
    ensureSyncChannel();
    return () => {
      inventoryListeners = inventoryListeners.filter((l) => l !== callback);
    };
  },

  deductInventoryForOrderItems: async (items: Record<string, unknown>[]) => {
    if (!items || !Array.isArray(items) || items.length === 0) return;

    try {
      const inventory = await api.getInventoryItems();
      const boms = await api.getRecipeBoms();

      if (!inventory.length || !boms.length) return;

      const updatedMap = new Map<string, InventoryItem>();
      inventory.forEach((item) => updatedMap.set(item.id, { ...item }));

      let inventoryChanged = false;

      for (const orderItem of items) {
        const itemName = orderItem.title || orderItem.name;
        const qty = Number(orderItem.quantity || orderItem.count || 1);
        if (!itemName || isNaN(qty) || qty <= 0) continue;

        // Match BOMs by menu item name
        const matchingBoms = boms.filter(
          (b: RecipeBom) =>
            b.menu_item_name &&
            String(b.menu_item_name).trim().toLowerCase() ===
              String(itemName).trim().toLowerCase(),
        );

        for (const bom of matchingBoms) {
          const targetInv = updatedMap.get(bom.inventory_item_id);
          if (targetInv) {
            const deduction = Number(bom.dosage) * qty;
            const currentStock = Number(targetInv.stock || 0);
            const newStock = Math.max(
              0,
              Number((currentStock - deduction).toFixed(2)),
            );
            targetInv.stock = newStock;
            targetInv.updated_at = new Date().toISOString();
            updatedMap.set(bom.inventory_item_id, targetInv);
            inventoryChanged = true;
          }
        }
      }

      if (inventoryChanged) {
        for (const [, invItem] of updatedMap) {
          await api.saveInventoryItem(invItem);
        }
      }
    } catch (err) {
      console.warn("Failed automatic BOM deduction:", err);
    }
  },

  syncCategoriesAndMenuItemsToSupabase: async (
    categories: Record<string, unknown>[],
  ) => {
    if (!categories || !Array.isArray(categories)) return;
    if (supabase && isSupabaseConfigured && isSupabaseHealthy) {
      try {
        // 获取当前的 deletedItemIds 以便在关系表中也清理已删除的默认菜品
        let deletedIds: string[] = [];
        try {
          const { data: settingsRow } = await supabase
            .from("settings")
            .select("deletedItemIds")
            .eq("id", SETTINGS_DOC_ID)
            .maybeSingle();
          if (
            settingsRow?.deletedItemIds &&
            Array.isArray(settingsRow.deletedItemIds)
          )
            deletedIds = settingsRow.deletedItemIds.map(String);
        } catch {}

        const activeCatNames = categories
          .map((c) => c.name || c.title || "")
          .filter(Boolean);

        // Clean up deleted categories and their items in relational DB
        if (activeCatNames.length > 0) {
          const { data: dbCats } = await supabase
            .from("categories")
            .select("id, name");
          if (dbCats && Array.isArray(dbCats)) {
            for (const dbCat of dbCats) {
              if (!activeCatNames.includes(dbCat.name)) {
                await supabase
                  .from("menu_items")
                  .delete()
                  .eq("category_id", dbCat.id);
                await supabase.from("categories").delete().eq("id", dbCat.id);
              }
            }
          }
        }

        for (let i = 0; i < categories.length; i++) {
          const cat = categories[i];
          if (!cat) continue;
          const catName = String(cat.name || cat.title || "未命名分类");

          const { data: existingCat } = await supabase
            .from("categories")
            .select("id")
            .eq("name", catName)
            .maybeSingle();

          let catId = existingCat?.id;
          if (!catId) {
            const { data: insertedCat } = await supabase
              .from("categories")
              .insert({ name: catName, sort_order: i })
              .select("id")
              .single();
            catId = insertedCat?.id;
          } else {
            await supabase
              .from("categories")
              .update({ sort_order: i })
              .eq("id", catId);
          }

          if (catId && cat.items && Array.isArray(cat.items)) {
            const activeItemTitles = cat.items
              .map((it: Record<string, unknown>) => it.title || it.name)
              .filter(Boolean);

            // Clean up dishes from menu_items that were removed from this category
            // 同时清理在 deletedItemIds 中标记为已删除的默认菜品（防止通过改名绕过删除）
            const { data: dbItems } = await supabase
              .from("menu_items")
              .select("id, name")
              .eq("category_id", catId);

            if (dbItems && Array.isArray(dbItems)) {
              for (const dbItem of dbItems) {
                const isDeleted =
                  deletedIds.includes(String(dbItem.name)) ||
                  deletedIds.includes(String(dbItem.id));
                if (!activeItemTitles.includes(dbItem.name) || isDeleted) {
                  await supabase
                    .from("menu_items")
                    .delete()
                    .eq("id", dbItem.id);
                }
              }
            }

            for (let j = 0; j < cat.items.length; j++) {
              const item = cat.items[j];
              const itemTitle = item.title || item.name;
              if (!itemTitle) continue;
              const numericPrice =
                parseFloat(String(item.price || "0").replace(/[^\d.]/g, "")) ||
                0;

              const { data: existingDish } = await supabase
                .from("menu_items")
                .select("id")
                .eq("name", itemTitle)
                .maybeSingle();

              const itemPayload = {
                name: itemTitle,
                category_id: catId,
                price: numericPrice,
                image_url: item.image || "",
                description: item.description || "",
                is_available: !item.isSoldOut,
                sort_order: j,
              };

              if (existingDish?.id) {
                await supabase
                  .from("menu_items")
                  .update(itemPayload)
                  .eq("id", existingDish.id);
              } else {
                await supabase.from("menu_items").insert(itemPayload);
              }
            }
          }
        }
      } catch (e) {
        console.warn(
          "Failed to sync menu items to relational Supabase tables:",
          e,
        );
      }
    }
  },

  getProductionDatabaseStats: async () => {
    if (!supabase || !isSupabaseConfigured || !isSupabaseHealthy) {
      return { connected: false, tables: {} };
    }
    const tableList = [
      "settings",
      "categories",
      "menu_items",
      "inventory_items",
      "recipe_boms",
      "tables",
      "orders",
    ];
    const stats: Record<string, number> = {};
    for (const tableName of tableList) {
      try {
        const { count, error } = await supabase
          .from(tableName)
          .select("*", { count: "exact", head: true });
        stats[tableName] = error ? -1 : (count ?? 0);
      } catch {
        stats[tableName] = -1;
      }
    }
    return { connected: true, tables: stats };
  },

  seedProductionDatabase: async (force: boolean = false) => {
    if (!supabase || !isSupabaseConfigured || !isSupabaseHealthy) {
      return { success: false, logs: ["❌ Supabase 未正确配置或连接故障"] };
    }

    const logs: string[] = [];

    try {
      // 1. settings 表全局数据初始化
      const { data: existingSettings } = await supabase
        .from("settings")
        .select("*")
        .eq("id", SETTINGS_DOC_ID)
        .maybeSingle();
      let categoriesToSync = INITIAL_MENU_CATEGORIES;

      if (
        !existingSettings ||
        !existingSettings.categories ||
        existingSettings.categories.length === 0 ||
        force
      ) {
        const defaultSettingsPayload = {
          id: SETTINGS_DOC_ID,
          categories: INITIAL_MENU_CATEGORIES,
          promotions: existingSettings?.promotions || [],
          bgUrl: existingSettings?.bgUrl || "",
          restaurantName: existingSettings?.restaurantName || "炙·双味居",
          welcomeMessage:
            existingSettings?.welcomeMessage || "Premium Charcoal BBQ",
          logoUrl: existingSettings?.logoUrl || "",
          adminPassword: existingSettings?.adminPassword || "admin123",
          devicePasswords: existingSettings?.devicePasswords || [],
          securityQuestion: existingSettings?.securityQuestion || "",
          securityAnswer: existingSettings?.securityAnswer || "",
          soundEnabled: existingSettings?.soundEnabled ?? true,
          layoutStyle: existingSettings?.layoutStyle || "grid",
          receiptSettings: existingSettings?.receiptSettings || {},
          deletedItemIds: existingSettings?.deletedItemIds || [],
          theme: existingSettings?.theme || "midnight",
        };
        const filteredSettingsPayload = await filterPayloadByTable(
          "settings",
          defaultSettingsPayload,
        );
        await supabase.from("settings").upsert(filteredSettingsPayload);
        logs.push("✅ settings 表全局设置数据已成功初始化");
      } else {
        categoriesToSync = mergeAndOrderCategories(
          existingSettings.categories,
          INITIAL_MENU_CATEGORIES,
          existingSettings.deletedItemIds || [],
        );
        if (
          JSON.stringify(categoriesToSync) !==
          JSON.stringify(existingSettings.categories)
        ) {
          await supabase
            .from("settings")
            .update({ categories: categoriesToSync })
            .eq("id", SETTINGS_DOC_ID);
          logs.push("✅ settings 表已同步更新最新的菜单分类与新菜品排序");
        } else {
          logs.push("ℹ️ settings 表已包含最新设置数据");
        }
      }

      // 2. 同步 categories 和 menu_items 关系表
      try {
        await api.syncCategoriesAndMenuItemsToSupabase(categoriesToSync);
        logs.push(
          `✅ 已成功同步 ${categoriesToSync.length} 个分类及相关菜品至 categories / menu_items 表`,
        );
      } catch (e) {
        logs.push(
          `⚠️ categories / menu_items 同步通知: ${(e as Error)?.message || e}`,
        );
      }

      // 3. inventory_items 原材料库存表初始化
      const { count: invCount } = await supabase
        .from("inventory_items")
        .select("*", { count: "exact", head: true });
      if (
        (invCount === 0 || invCount === null || force) &&
        DEFAULT_INVENTORY_ITEMS.length > 0
      ) {
        for (const item of DEFAULT_INVENTORY_ITEMS) {
          await supabase.from("inventory_items").upsert(
            {
              ...item,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" },
          );
        }
        logs.push(
          `✅ inventory_items 库存表已成功初始化 (${DEFAULT_INVENTORY_ITEMS.length} 种物料)`,
        );
      } else {
        logs.push(`ℹ️ inventory_items 表当前包含 ${invCount ?? 0} 条物料记录`);
      }

      // 4. recipe_boms BOM配方表初始化
      const { count: bomCount } = await supabase
        .from("recipe_boms")
        .select("*", { count: "exact", head: true });
      if (
        (bomCount === 0 || bomCount === null || force) &&
        DEFAULT_RECIPE_BOMS.length > 0
      ) {
        for (const bom of DEFAULT_RECIPE_BOMS) {
          await supabase.from("recipe_boms").upsert(bom, { onConflict: "id" });
        }
        logs.push(
          `✅ recipe_boms 配方表已成功初始化 (${DEFAULT_RECIPE_BOMS.length} 条 BOM 配方)`,
        );
      } else {
        logs.push(`ℹ️ recipe_boms 表当前包含 ${bomCount ?? 0} 条配方记录`);
      }

      // 5. tables 二维码餐桌表初始化
      const { count: tableCount } = await supabase
        .from("tables")
        .select("*", { count: "exact", head: true });
      if (tableCount === 0 || tableCount === null || force) {
        const defaultTables = [
          "A1",
          "A2",
          "A3",
          "A4",
          "A5",
          "A6",
          "B1",
          "B2",
          "B3",
          "B4",
          "C1",
          "C2",
        ];
        for (const tNo of defaultTables) {
          await supabase.from("tables").upsert(
            {
              tableNo: tNo,
              key: Math.random().toString(36).substring(2, 10),
              active: true,
              createdAt: new Date().toISOString(),
            },
            { onConflict: "tableNo" },
          );
        }
        logs.push(
          `✅ tables 餐桌表已成功初始化 (${defaultTables.length} 个基础餐桌)`,
        );
      } else {
        logs.push(`ℹ️ tables 餐桌表当前包含 ${tableCount ?? 0} 条餐桌记录`);
      }

      // 刷新缓存
      kvCache.invalidate("app_settings");
      kvCache.invalidate("inventory_items");
      kvCache.invalidate("recipe_boms");

      triggerBroadcast("settings_changed");
      triggerBroadcast("inventory_changed");
      triggerBroadcast("tables_changed");

      return { success: true, logs };
    } catch (err) {
      logs.push(`❌ 初始化数据发生错误: ${(err as Error)?.message || err}`);
      return { success: false, logs };
    }
  },
  triggerBroadcast: (event: string, payload: Record<string, unknown> = {}) => {
    triggerBroadcast(event, payload);
  },

  // ——— EdgeOne 部署：购物车实时同步 + 管理员通知（替代原 WebSocket cartHub） ———
  broadcastCart: (table: string, cart: Record<string, number>) => {
    triggerBroadcast("cart_changed", { table, cart });
  },
  broadcastCartCleared: (table: string) => {
    triggerBroadcast("cart_cleared", { table });
  },
  notifyAdmin: (payload: Record<string, unknown>) => {
    triggerBroadcast("admin_notification", payload);
  },
  subscribeCart: (
    table: string,
    callback: (cart: Record<string, number>) => void,
  ): (() => void) => {
    const l = { table, callback };
    cartListeners.push(l);
    ensureSyncChannel();
    return () => {
      cartListeners = cartListeners.filter((x) => x !== l);
    };
  },
  subscribeAdminNotifications: (
    callback: (payload: Record<string, unknown>) => void,
  ): (() => void) => {
    adminNotificationListeners.push(callback);
    ensureSyncChannel();
    return () => {
      adminNotificationListeners = adminNotificationListeners.filter(
        (x) => x !== callback,
      );
    };
  },
};

export const DEFAULT_INVENTORY_ITEMS = [
  {
    id: "INV-101",
    name: "特级雪花牛肉",
    category: "肉类与海鲜",
    stock: 50.0,
    unit: "kg",
    safety_stock: 5.0,
    price: 80.0,
    updated_at: new Date().toISOString(),
  },
  {
    id: "INV-102",
    name: "精选清真牛肉馅",
    category: "肉类与海鲜",
    stock: 40.0,
    unit: "kg",
    safety_stock: 4.0,
    price: 40.0,
    updated_at: new Date().toISOString(),
  },
  {
    id: "INV-103",
    name: "农家鲜土鸡",
    category: "肉类与海鲜",
    stock: 30.0,
    unit: "kg",
    safety_stock: 3.0,
    price: 35.0,
    updated_at: new Date().toISOString(),
  },
  {
    id: "INV-104",
    name: "饺子皮面粉",
    category: "粮油面粉",
    stock: 80.0,
    unit: "kg",
    safety_stock: 8.0,
    price: 8.0,
    updated_at: new Date().toISOString(),
  },
  {
    id: "INV-105",
    name: "重庆特级朝天椒",
    category: "调料香料",
    stock: 15.0,
    unit: "kg",
    safety_stock: 2.0,
    price: 25.0,
    updated_at: new Date().toISOString(),
  },
  {
    id: "INV-106",
    name: "香浓高汤原汁",
    category: "汤底底料",
    stock: 60.0,
    unit: "L",
    safety_stock: 10.0,
    price: 12.0,
    updated_at: new Date().toISOString(),
  },
];

export const DEFAULT_RECIPE_BOMS = [
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
  {
    id: "BOM-103",
    menu_item_name: "干饺 (大份)",
    inventory_item_id: "INV-102",
    dosage: 0.25,
    unit: "kg",
  },
  {
    id: "BOM-104",
    menu_item_name: "干饺 (大份)",
    inventory_item_id: "INV-104",
    dosage: 0.15,
    unit: "kg",
  },
  {
    id: "BOM-105",
    menu_item_name: "干饺 (大份)",
    inventory_item_id: "INV-106",
    dosage: 0.5,
    unit: "L",
  },
  {
    id: "BOM-106",
    menu_item_name: "干饺 (小份)",
    inventory_item_id: "INV-102",
    dosage: 0.18,
    unit: "kg",
  },
  {
    id: "BOM-107",
    menu_item_name: "干饺 (小份)",
    inventory_item_id: "INV-104",
    dosage: 0.1,
    unit: "kg",
  },
  {
    id: "BOM-108",
    menu_item_name: "干饺 (小份)",
    inventory_item_id: "INV-106",
    dosage: 0.35,
    unit: "L",
  },
  {
    id: "BOM-109",
    menu_item_name: "煎饺 (大份)",
    inventory_item_id: "INV-102",
    dosage: 0.25,
    unit: "kg",
  },
  {
    id: "BOM-110",
    menu_item_name: "煎饺 (大份)",
    inventory_item_id: "INV-104",
    dosage: 0.15,
    unit: "kg",
  },
  {
    id: "BOM-111",
    menu_item_name: "煎饺 (小份)",
    inventory_item_id: "INV-102",
    dosage: 0.18,
    unit: "kg",
  },
  {
    id: "BOM-112",
    menu_item_name: "煎饺 (小份)",
    inventory_item_id: "INV-104",
    dosage: 0.1,
    unit: "kg",
  },
];
