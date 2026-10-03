import { useState } from "react";
import { fmtMoney, parseTs, tableName } from "./format";

/* ============ 漏单 / 超时提醒 ============
 * 订单在「待接单 / 制作中」停留超过阈值即视为漏单风险。
 * 阈值可配（存本机），判定为纯函数；通知由 App 层按 id 去重后弹出。
 */

export interface LateConfig {
  /** 待接单超时阈值（分钟） */
  pendingMin: number;
  /** 制作中超时阈值（分钟） */
  cookingMin: number;
}

export const LATE_KEY = "owner:late:cfg";
export const DEFAULT_LATE: LateConfig = { pendingMin: 10, cookingMin: 20 };
export const MIN_LATE_MIN = 1;
export const MAX_LATE_MIN = 240;

function clampInt(v: unknown, fb: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n <= 0) return fb;
  return Math.min(MAX_LATE_MIN, Math.max(MIN_LATE_MIN, n));
}

export function loadLateConfig(): LateConfig {
  try {
    const raw = localStorage.getItem(LATE_KEY);
    if (!raw) return { ...DEFAULT_LATE };
    const o = JSON.parse(raw);
    return {
      pendingMin: clampInt(o?.pendingMin, DEFAULT_LATE.pendingMin),
      cookingMin: clampInt(o?.cookingMin, DEFAULT_LATE.cookingMin),
    };
  } catch {
    return { ...DEFAULT_LATE };
  }
}

export function saveLateConfig(cfg: Partial<LateConfig>): LateConfig {
  const next: LateConfig = {
    pendingMin: clampInt(cfg.pendingMin, DEFAULT_LATE.pendingMin),
    cookingMin: clampInt(cfg.cookingMin, DEFAULT_LATE.cookingMin),
  };
  try {
    localStorage.setItem(LATE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

/** 设置页/看板通用：读一次配置，update 后同步状态并返回生效值 */
export function useLateConfig(): [
  LateConfig,
  (cfg: Partial<LateConfig>) => LateConfig,
] {
  const [cfg, setCfg] = useState<LateConfig>(loadLateConfig);
  const update = (patch: Partial<LateConfig>) => {
    const next = saveLateConfig({ ...cfg, ...patch });
    setCfg(next);
    return next;
  };
  return [cfg, update];
}

export interface LateOrder {
  id: string;
  /** 桌号 · 订单号 */
  label: string;
  status: "pending" | "cooking";
  kindLabel: "待接单" | "制作中";
  thresholdMin: number;
  elapsedMin: number;
  /** 超出阈值的分钟数 */
  overdueMin: number;
  total: number;
}

/** 找出所有超时订单（按超时程度降序） */
export function lateOrders(
  orders: any[],
  cfg: LateConfig,
  now: number = Date.now(),
): LateOrder[] {
  const out: LateOrder[] = [];
  for (const o of orders || []) {
    const status = String(o?.status || "");
    const threshold =
      status === "pending"
        ? cfg.pendingMin
        : status === "cooking"
          ? cfg.cookingMin
          : 0;
    if (!threshold) continue;
    const id = String(o?.id || o?._id || "").trim();
    if (!id) continue;
    const at = parseTs(o?.created_at ?? o?.createdAt ?? o?.created);
    if (!at || at > now) continue;
    const elapsedMin = Math.floor((now - at) / 60000);
    if (elapsedMin < threshold) continue;
    out.push({
      id,
      label: `${tableName(o)}${o?.orderNumber ? ` · ${o.orderNumber}` : ""}`,
      status: status as "pending" | "cooking",
      kindLabel: status === "pending" ? "待接单" : "制作中",
      thresholdMin: threshold,
      elapsedMin,
      overdueMin: elapsedMin - threshold,
      total: Number(o?.finalTotal ?? o?.total ?? o?.total_amount ?? 0),
    });
  }
  return out.sort((a, b) => b.overdueMin - a.overdueMin);
}

/** 通知/待办文案 */
export function lateNotice(l: LateOrder): { title: string; body: string } {
  return {
    title: `超时提醒 · ${l.label}`,
    body: `${l.kindLabel}已 ${l.elapsedMin} 分钟（阈值 ${l.thresholdMin} 分钟）· ${fmtMoney(l.total)}`,
  };
}
