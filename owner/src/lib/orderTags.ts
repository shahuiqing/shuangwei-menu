/* ============ 订单标记 ============
 * 标记订单类型：退菜/赠送/员工餐/试菜（不计营收；退菜同时不计成本）。
 * 本地先写（离线可用），同时异步落库 orders."orderTag"，多设备一致。
 */

import { localGet, localSet } from "./localdb";
import { logAction } from "./auditLog";
import { supabase } from "./supabase";

export type OrderTag = "normal" | "refund" | "gift" | "staff" | "trial";

export const ORDER_TAG_LABEL: Record<OrderTag, string> = {
  normal: "正常",
  refund: "退菜",
  gift: "赠送",
  staff: "员工餐",
  trial: "试菜",
};

/** 不计营收的标记（退菜同时回冲库存；赠送/员工餐/试菜仅影响营收） */
export const EXCLUDED_TAGS: OrderTag[] = ["refund", "gift", "staff", "trial"];

export const isExcludedTag = (t: OrderTag): boolean =>
  EXCLUDED_TAGS.includes(t);

const KEY = "owner:order:tag";

function readMap(): Record<string, OrderTag> {
  const o = localGet<unknown>(KEY);
  return o && typeof o === "object" && !Array.isArray(o)
    ? (o as Record<string, OrderTag>)
    : {};
}

export function loadOrderTags(): Record<string, OrderTag> {
  return readMap();
}

export function getOrderTag(id: string): OrderTag {
  return readMap()[id] || "normal";
}

export function setOrderTag(id: string, tag: OrderTag): OrderTag {
  const map = readMap();
  if (tag === "normal") delete map[id];
  else map[id] = tag;
  localSet(KEY, map);
  void persistOrderTag(id, tag);
  logAction("订单标记", `${id} → ${ORDER_TAG_LABEL[tag]}`);
  return tag;
}

/** 异步落库；库未升级（无 orderTag 列）时只保留本地标记 */
async function persistOrderTag(id: string, tag: OrderTag): Promise<void> {
  if (!supabase || !id) return;
  const { error } = await supabase
    .from("orders")
    .update({ orderTag: tag === "normal" ? null : tag })
    .eq("id", id);
  if (error) console.warn("[owner] persistOrderTag:", error.message);
}

/** 用数据库里的标记校准本地缓存（跨设备）；老库无该列时不动本地 */
export function hydrateOrderTags(rows: any[]): void {
  const map = readMap();
  let changed = false;
  const pending: Array<{ id: string; tag: OrderTag }> = [];
  for (const o of rows) {
    if (!o || !("orderTag" in o)) continue;
    const id = String(o.id || o._id || "");
    if (!id) continue;
    const raw = o.orderTag;
    if (
      raw === "refund" ||
      raw === "gift" ||
      raw === "staff" ||
      raw === "trial"
    ) {
      if (map[id] !== raw) {
        map[id] = raw;
        changed = true;
      }
    } else if (raw === "normal") {
      if (map[id]) {
        delete map[id];
        changed = true;
      }
    } else if (map[id]) {
      // 数据库还没有标记（SQL 升级前写入的本地标记）：先保留并尝试补写
      pending.push({ id, tag: map[id] });
    }
  }
  if (changed) localSet(KEY, map);
  for (const p of pending) void persistOrderTag(p.id, p.tag);
}
