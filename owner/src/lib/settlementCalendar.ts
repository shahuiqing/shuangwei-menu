/**
 * 日结日历的纯逻辑：月份边界、周一起始的月历格子、紧凑金额与热力值。
 * 与 UI 解耦，方便单测；营业日口径沿用 businessDayKey。
 */

export interface DayPointLike {
  day: string;
  revenue: number;
  orders: number;
}

export interface CalendarCell {
  /** 营业日键 YYYY-MM-DD */
  key: string;
  day: number;
  revenue: number;
  orders: number;
  /** 当日是否有结算记录 */
  hasData: boolean;
  /** 是否晚于今天（营业日口径） */
  future: boolean;
  today: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 某自然月的起止日（YYYY-MM-DD）与天数 */
export function monthBounds(year: number, monthIndex: number) {
  const days = new Date(year, monthIndex + 1, 0).getDate();
  return {
    from: `${year}-${pad(monthIndex + 1)}-01`,
    to: `${year}-${pad(monthIndex + 1)}-${pad(days)}`,
    days,
  };
}

/**
 * 生成周一起始的月历格子（7 的整数倍）。
 * 前导与尾部空位用 null 补齐，保证手机端 7 列网格稳定对齐。
 */
export function buildMonthCells(
  year: number,
  monthIndex: number,
  points: DayPointLike[],
  todayKey: string,
): (CalendarCell | null)[] {
  const byDay = new Map(points.map((p) => [p.day, p]));
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const lead = (new Date(year, monthIndex, 1).getDay() + 6) % 7; // 周一 = 0
  const cells: (CalendarCell | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) {
    const key = `${year}-${pad(monthIndex + 1)}-${pad(d)}`;
    const p = byDay.get(key);
    const revenue = Number(p?.revenue || 0);
    const orders = Number(p?.orders || 0);
    cells.push({
      key,
      day: d,
      revenue,
      orders,
      hasData: revenue > 0 || orders > 0,
      future: key > todayKey,
      today: key === todayKey,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** 日历格子里的紧凑金额：1.2万 / 12万 / 9999 */
export function fmtCompactMoney(n: number): string {
  const v = Number(n || 0);
  if (!v) return "";
  if (v >= 10000) return `${(v / 10000).toFixed(v >= 100000 ? 0 : 1)}万`;
  return String(Math.round(v));
}

/** 相对当月峰值的营收热力，0（无）~ 1（最高） */
export function revenueHeat(revenue: number, max: number): number {
  if (max <= 0 || revenue <= 0) return 0;
  return Math.min(1, Math.max(0.1, revenue / max));
}

/** 把热力值转成 8 位十六进制颜色（#rrggbbaa），用于随主题变化的底色 */
export function heatColor(brand: string, heat: number): string {
  if (heat <= 0) return "transparent";
  const alpha = Math.round((0.08 + heat * 0.32) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${brand}${alpha}`;
}
