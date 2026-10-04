/* ============ 行业基准参考值（纯本地，零后端） ============
 * 按餐饮业态给出食材成本率 / 损耗率 / 人工占比的行业参考区间，
 * 供看板与损耗页对比参考。数值来自常见行业经验值，非审计数据。
 * 业态选择存本机（统一本地存储层）。
 */

import { localGet, localSet } from "./localdb";
import { logAction } from "./auditLog";

export type BizType = "chinese" | "hotpot" | "bbq" | "fastfood" | "western";

export const BIZ_LABEL: Record<BizType, string> = {
  chinese: "中餐正餐",
  hotpot: "火锅",
  bbq: "烧烤炭烤",
  fastfood: "快餐简餐",
  western: "西餐轻食",
};

export interface Benchmark {
  /** 食材成本率目标区间（%，占营收） */
  foodCost: [number, number];
  /** 食材损耗率上限（%，占营收） */
  wasteMax: number;
  /** 人工成本率参考区间（%，占营收） */
  labor: [number, number];
}

export const BENCHMARKS: Record<BizType, Benchmark> = {
  chinese: { foodCost: [28, 35], wasteMax: 3, labor: [18, 25] },
  hotpot: { foodCost: [35, 42], wasteMax: 4, labor: [15, 22] },
  bbq: { foodCost: [30, 38], wasteMax: 3, labor: [18, 26] },
  fastfood: { foodCost: [25, 32], wasteMax: 2, labor: [20, 28] },
  western: { foodCost: [30, 38], wasteMax: 3, labor: [20, 28] },
};

const KEY = "owner:biz:type";

export const DEFAULT_BIZ: BizType = "chinese";

export function getBizType(): BizType {
  const v = localGet<string>(KEY);
  return v && v in BENCHMARKS ? (v as BizType) : DEFAULT_BIZ;
}

export function setBizType(t: BizType): void {
  localSet(KEY, t);
  logAction("业态切换", BIZ_LABEL[t] || t);
}

export function benchmarks(t: BizType = getBizType()): Benchmark {
  return BENCHMARKS[t] || BENCHMARKS[DEFAULT_BIZ];
}

export type Verdict = "low" | "ok" | "high";

export const VERDICT_LABEL: Record<Verdict, string> = {
  low: "低于参考",
  ok: "正常",
  high: "高于参考",
};

export const VERDICT_COLOR: Record<Verdict, string> = {
  low: "#22c55e",
  ok: "#a1a1aa",
  high: "#f43f5e",
};

/** 百分比落在区间 → ok；低于 → low；高于 → high */
export function rangeVerdict(pct: number, [lo, hi]: [number, number]): Verdict {
  if (!Number.isFinite(pct)) return "ok";
  return pct < lo ? "low" : pct > hi ? "high" : "ok";
}

/** 损耗率：不高于上限 → ok，否则 high（损耗没有「越低越好」问题） */
export function wasteVerdict(pct: number, max: number): Verdict {
  if (!Number.isFinite(pct)) return "ok";
  return pct > max ? "high" : "ok";
}

export function pctText([lo, hi]: [number, number]): string {
  return `${lo}%~${hi}%`;
}
