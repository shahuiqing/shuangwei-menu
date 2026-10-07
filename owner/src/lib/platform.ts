import { localGet, localSet } from "./localdb";
import { logAction } from "./auditLog";

/* ============ 平台订单口径（前端 only，不动数据库） ============
 * 平台（美团/饿了么）订单有抽成/配送费，营收不能直接当利润。
 * 抽成率存本机，用于「平台净利」口径分离，避免平台单污染堂食账本。
 */

const KEY = "owner:platform:commission";

/** 平台抽成率（0-1，默认 0.2 = 20%） */
export function getCommissionRate(): number {
  const v = localGet<unknown>(KEY);
  if (v === null || v === undefined) return 0.2;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0.2;
}

export function setCommissionRate(rate: number): number {
  const r = Math.min(Math.max(Number(rate) || 0, 0), 1);
  localSet(KEY, r);
  logAction("平台抽成率", `${Math.round(r * 100)}%`);
  return r;
}

/** 平台净营收 = 营收 × (1 − 抽成率) */
export function platformNetRevenue(
  revenue: number,
  commissionRate: number,
): number {
  return revenue * (1 - commissionRate);
}

/** 平台净利 = 营收 × (1 − 抽成) − 配送费 − COGS */
export function platformNetProfit(
  revenue: number,
  cogs: number,
  commissionRate: number,
  deliveryFee = 0,
): number {
  return revenue * (1 - commissionRate) - deliveryFee - cogs;
}
