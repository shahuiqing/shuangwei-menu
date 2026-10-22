/* ============ 临期 / 食安预警 ============
 * 依据原料保质期天数（inventory_items.shelf_life_days）与采购批次（FIFO），
 * 计算每项原料「仍在库的最老一批」的到期日与剩余天数，用于临期预警
 * （前置止损，而非事后报损）。旧货不会被后到的新货刷新保质期。
 */
import { num, type InventoryItem } from "./inventory";

export type ExpiryStatus = "expired" | "expiring" | "ok" | "unknown";

export interface ExpiryInfo {
  itemId: string;
  itemName: string;
  /** 决定预警的批次采购日期（仍在库的最老一批；无采购则为 null） */
  purchasedAt: string | null;
  /** 到期日（无保质期或无采购则为 null） */
  expiryDate: string | null;
  /** 剩余天数（负 = 已过期；null = 无法判定） */
  daysLeft: number | null;
  status: ExpiryStatus;
}

const DAY_MS = 86400000;

/** 从采购批次（FIFO）+ 保质期天数算到期日与状态 */
export function computeExpiry(
  items: InventoryItem[],
  purchasesByItem: Map<string, { at: string; qty: number }[]>, // item_id -> 批次（按时间升序）
  now: Date,
  thresholdDays = 3,
): ExpiryInfo[] {
  return items.map((it) => {
    const shelf = Number(it.shelf_life_days);
    const stock = num(it.stock);
    const batches = purchasesByItem.get(it.id) || [];
    if (!(shelf > 0) || batches.length === 0 || stock <= 0) {
      return {
        itemId: it.id,
        itemName: it.name,
        purchasedAt: null,
        expiryDate: null,
        daysLeft: null,
        status: "unknown",
      };
    }
    // FIFO：仍在库的是「最新的若干批」，其中最老一批最早到期，决定预警
    let cum = 0;
    let anchor: { at: string; qty: number } | null = null;
    for (let i = batches.length - 1; i >= 0; i--) {
      const b = batches[i]!;
      cum += num(b.qty);
      if (cum >= stock) {
        anchor = b;
        break;
      }
    }
    if (!anchor) anchor = batches[0]!;
    const p = new Date(anchor.at).getTime();
    const exp = p + shelf * DAY_MS;
    const daysLeft = Math.ceil((exp - now.getTime()) / DAY_MS);
    const status: ExpiryStatus =
      daysLeft < 0 ? "expired" : daysLeft <= thresholdDays ? "expiring" : "ok";
    return {
      itemId: it.id,
      itemName: it.name,
      purchasedAt: anchor.at,
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
