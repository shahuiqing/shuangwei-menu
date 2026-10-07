/* ============ 临期 / 食安预警 ============
 * 依据原料保质期天数（inventory_items.shelf_life_days）与最近一次采购日期，
 * 计算每项原料的到期日与剩余天数，用于临期预警（前置止损，而非事后报损）。
 */
import type { InventoryItem } from "./inventory";

export type ExpiryStatus = "expired" | "expiring" | "ok" | "unknown";

export interface ExpiryInfo {
  itemId: string;
  itemName: string;
  /** 最近采购日期（无采购则为 null） */
  purchasedAt: string | null;
  /** 到期日（无保质期或无采购则为 null） */
  expiryDate: string | null;
  /** 剩余天数（负 = 已过期；null = 无法判定） */
  daysLeft: number | null;
  status: ExpiryStatus;
}

const DAY_MS = 86400000;

/** 从最近采购日期 + 保质期天数算到期日与状态 */
export function computeExpiry(
  items: InventoryItem[],
  latestPurchases: Map<string, string>, // item_id -> purchased_at ISO
  now: Date,
  thresholdDays = 3,
): ExpiryInfo[] {
  return items.map((it) => {
    const shelf = Number(it.shelf_life_days);
    const purchasedAt = latestPurchases.get(it.id) ?? null;
    if (!(shelf > 0) || !purchasedAt) {
      return {
        itemId: it.id,
        itemName: it.name,
        purchasedAt,
        expiryDate: null,
        daysLeft: null,
        status: "unknown",
      };
    }
    const p = new Date(purchasedAt).getTime();
    const exp = p + shelf * DAY_MS;
    const daysLeft = Math.ceil((exp - now.getTime()) / DAY_MS);
    const status: ExpiryStatus =
      daysLeft < 0 ? "expired" : daysLeft <= thresholdDays ? "expiring" : "ok";
    return {
      itemId: it.id,
      itemName: it.name,
      purchasedAt,
      expiryDate: new Date(exp).toISOString(),
      daysLeft,
      status,
    };
  });
}

/** 需要预警的项（已过期或临期） */
export function expiryAlerts(info: ExpiryInfo[]): {
  expired: ExpiryInfo[];
  expiring: ExpiryInfo[];
} {
  return {
    expired: info.filter((i) => i.status === "expired"),
    expiring: info.filter((i) => i.status === "expiring"),
  };
}
