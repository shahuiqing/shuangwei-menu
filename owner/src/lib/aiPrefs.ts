import { localGet, localSet } from "./localdb";

/**
 * AI 助手偏好：老板关注的重点与回答风格。
 * 只存本机，作为提示词附加约束，不影响数据口径。
 */

export type AiFocus = "cost" | "revenue" | "inventory" | "efficiency";
export type AiStyle = "brief" | "detailed";

export interface AiPrefs {
  focus: AiFocus[];
  style: AiStyle;
}

export const FOCUS_LABEL: Record<AiFocus, string> = {
  cost: "成本",
  revenue: "营收",
  inventory: "库存",
  efficiency: "人效",
};

export const STYLE_LABEL: Record<AiStyle, string> = {
  brief: "简洁",
  detailed: "详细",
};

const KEY = "owner:ai:prefs";
const DEFAULT_PREFS: AiPrefs = { focus: [], style: "brief" };

export function loadAiPrefs(): AiPrefs {
  const raw = localGet<unknown>(KEY);
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PREFS };
  const o = raw as Record<string, unknown>;
  const focus = Array.isArray(o.focus)
    ? (o.focus.filter(
        (x): x is AiFocus =>
          x === "cost" ||
          x === "revenue" ||
          x === "inventory" ||
          x === "efficiency",
      ) as AiFocus[])
    : [];
  const style: AiStyle = o.style === "detailed" ? "detailed" : "brief";
  return { focus, style };
}

export function saveAiPrefs(p: AiPrefs): void {
  localSet(KEY, p);
}

/** 偏好 → 提示词片段（空偏好返回空串） */
export function prefsPrompt(p: AiPrefs): string {
  const parts: string[] = [];
  if (p.focus.length > 0) {
    parts.push(
      `老板当前最关注：${p.focus.map((f) => FOCUS_LABEL[f]).join("、")}，建议优先围绕这些方面展开。`,
    );
  }
  parts.push(
    p.style === "detailed"
      ? "回答可以详细一些：给出原因和判断依据，但不超过 400 字。"
      : "回答保持简洁：结论先行，不超过 200 字。",
  );
  return parts.join("\n");
}
