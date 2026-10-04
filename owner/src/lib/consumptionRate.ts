import { num } from "./inventory";

/* ============ 不可盘类消耗率 ============
 * 不可盘的原料没法称重盘点，靠两次采购之间「买了多少、用了多久」估日用量。
 * 输入按时间升序的采购记录（时间戳 + 数量），纯函数。
 */

export interface RatePurchase {
  at: number;
  qty: number;
}

const DAY = 86400000;

/** 长期平均日消耗 = Σ采购量 ÷ 时间跨度（天） */
export function dailyUsageRate(purchases: RatePurchase[]): number {
  const ps = [...(purchases || [])]
    .filter((p) => num(p.qty) > 0 && p.at > 0)
    .sort((a, b) => a.at - b.at);
  if (ps.length < 2) return 0;
  const span = (ps[ps.length - 1].at - ps[0].at) / DAY;
  if (span <= 0) return 0;
  const total = ps.reduce((s, p) => s + num(p.qty), 0);
  return total / span;
}

/** 近 N 天的平均日消耗 */
export function recentRate(purchases: RatePurchase[], windowDays = 30): number {
  const now = Date.now();
  const qty = (purchases || [])
    .filter((p) => p.at > now - windowDays * DAY)
    .reduce((s, p) => s + num(p.qty), 0);
  return qty / windowDays;
}

/** 消耗率偏差 = 近期 ÷ 长期；>1 表示最近用得更快，<1 更慢。无历史返回 0 */
export function rateDeviation(
  purchases: RatePurchase[],
  windowDays = 30,
): number {
  const base = dailyUsageRate(purchases);
  if (base <= 0) return 0;
  return recentRate(purchases, windowDays) / base;
}

/** 消耗率异常标记：偏差超过阈值即提示（默认 ±50%） */
export function isRateAnomaly(
  purchases: RatePurchase[],
  windowDays = 30,
  threshold = 0.5,
): boolean {
  const dev = rateDeviation(purchases, windowDays);
  return dev > 1 + threshold || (dev > 0 && dev < 1 - threshold);
}
