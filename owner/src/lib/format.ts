export function parseTs(v: unknown): number {
  if (!v) return 0;
  if (typeof v === "number") return v;
  const s = String(v).trim().replace(" ", "T");
  const t = new Date(/Z$|[+-]\d{2}/.test(s) ? s : s + "Z").getTime();
  return isNaN(t) ? 0 : t;
}

export function dayKey(ts: unknown): string {
  const t = parseTs(ts);
  if (!t) return "";
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fmtMoney(n: number): string {
  return Number(n || 0).toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function fmtDateTime(ts: unknown): string {
  const t = parseTs(ts);
  if (!t) return "";
  return new Date(t).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function tableName(o: any): string {
  let t = String(
    o?.customerName || o?.customer_name || o?.table_no || "",
  ).trim();
  t = t.replace(/^桌号[_ ]?/, "").replace(/^table[_ ]?/i, "");
  return t || "未知";
}

export const STATUS_TEXT: Record<string, string> = {
  pending: "待接单",
  cooking: "制作中",
  served: "已上菜",
  completed: "已结账",
  cancelled: "已取消",
};
