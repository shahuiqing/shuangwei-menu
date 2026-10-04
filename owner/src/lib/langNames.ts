/* ============ 菜品多语言名称（前端 only，不动数据库） ============
 * 为顾客端扫码菜单维护 中/英/法/阿 菜名映射，按菜品 id 存本机
 * （统一本地存储层）。后续同步到云端菜单时以此为准，CSV 导出兜底。
 */

import { localGet, localSet } from "./localdb";

export type LangCode = "zh" | "en" | "fr" | "ar";

export const LANGS: { code: LangCode; label: string }[] = [
  { code: "zh", label: "中文" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "ar", label: "العربية" },
];

export interface DishLangNames {
  zh?: string;
  en?: string;
  fr?: string;
  ar?: string;
}

const KEY = "owner:dish:lang";

export function loadLangNames(): Record<string, DishLangNames> {
  const o = localGet<unknown>(KEY);
  return o && typeof o === "object" && !Array.isArray(o)
    ? (o as Record<string, DishLangNames>)
    : {};
}

export function getLangNames(dishId: string): DishLangNames {
  return loadLangNames()[dishId] || {};
}

/** 写一个语言的名称；清空即删除该语言（全空则整条删除） */
export function saveLangName(
  dishId: string,
  lang: LangCode,
  value: string,
): void {
  const map = loadLangNames();
  const v = value.trim();
  const cur: DishLangNames = { ...(map[dishId] || {}) };
  if (v) cur[lang] = v;
  else delete cur[lang];
  if (Object.keys(cur).length) map[dishId] = cur;
  else delete map[dishId];
  localSet(KEY, map);
}

/** 已填语言数（0-4） */
export function langCompletion(n: DishLangNames): number {
  return LANGS.filter((l) => (n[l.code] || "").trim()).length;
}

export function langCoverage(map = loadLangNames()): {
  dishes: number;
  complete: number;
} {
  const ids = Object.keys(map);
  return {
    dishes: ids.length,
    complete: ids.filter((id) => langCompletion(map[id] || {}) === LANGS.length)
      .length,
  };
}

/** 导出 CSV（UTF-8 BOM，Excel 直接打开）：含全部菜品，未录的留空 */
export function langCsv(
  dishes: { id: string; title: string }[],
  map = loadLangNames(),
): string {
  const esc = (s: string) => `"${String(s || "").replace(/"/g, '""')}"`;
  const head = ["id", "中文", "English", "Français", "العربية"]
    .map(esc)
    .join(",");
  const rows = dishes.map((d) => {
    const n: DishLangNames = map[d.id] || {};
    return [d.id, d.title, n.zh || "", n.en || "", n.fr || "", n.ar || ""]
      .map(esc)
      .join(",");
  });
  return "\uFEFF" + [head, ...rows].join("\r\n");
}
