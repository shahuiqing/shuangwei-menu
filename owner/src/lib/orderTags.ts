/* ============ 订单标记（前端 only，不动数据库） ============
 * 标记订单类型：退菜/赠送/员工餐/试菜 在理论消耗里应被剔除。
 * 存本机 localStorage（按订单 id），后续需跨设备再迁列。
 */

import { localGet, localSet } from "./localdb";

export type OrderTag = "normal" | "refund" | "gift" | "staff" | "trial";

export const ORDER_TAG_LABEL: Record<OrderTag, string> = {
  normal: "正常",
  refund: "退菜",
  gift: "赠送",
  staff: "员工餐",
  trial: "试菜",
};

/** 不参与「理论消耗」的标记 */
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
  return tag;
}
