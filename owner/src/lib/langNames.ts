/* ============ 菜品多语言名称 ============
 * 直接读写菜品对象上的真实字段 enTitle / frTitle / arTitle / maTitle，
 * 与顾客端扫码菜单读取的字段完全一致（保存即同步云端 categories）。
 * 中文名即菜品 title，无需额外维护。
 */

import type { MenuCategory, MenuItem } from "./menu";

export type LangCode = "en" | "fr" | "ar" | "ma";

type LangField = "enTitle" | "frTitle" | "arTitle" | "maTitle";

export const LANGS: { code: LangCode; label: string; field: LangField }[] = [
  { code: "en", label: "English", field: "enTitle" },
  { code: "fr", label: "Français", field: "frTitle" },
  { code: "ar", label: "العربية", field: "arTitle" },
  { code: "ma", label: "الدارجة", field: "maTitle" },
];

export interface DishLangNames {
  en?: string;
  fr?: string;
  ar?: string;
  ma?: string;
}

export function getLangNames(item: MenuItem | undefined): DishLangNames {
  return {
    en: item?.enTitle || "",
    fr: item?.frTitle || "",
    ar: item?.arTitle || "",
    ma: item?.maTitle || "",
  };
}

/** 已填语言数（0-4） */
export function langCompletion(item: MenuItem | undefined): number {
  return LANGS.filter((l) => (item?.[l.field] || "").trim()).length;
}

export function langCoverage(cats: MenuCategory[]): {
  dishes: number;
  complete: number;
} {
  let dishes = 0;
  let complete = 0;
  cats.forEach((c) =>
    (c.items || []).forEach((it) => {
      dishes++;
      if (langCompletion(it) === LANGS.length) complete++;
    }),
  );
  return { dishes, complete };
}

/** 导出 CSV（UTF-8 BOM，Excel 直接打开）：含全部菜品，未录的留空 */
export function langCsv(dishes: MenuItem[]): string {
  const esc = (s: string) => `"${String(s || "").replace(/"/g, '""')}"`;
  const head = ["菜品", "English", "Français", "العربية", "الدارجة"]
    .map(esc)
    .join(",");
  const rows = dishes.map((d) =>
    [
      d.title,
      d.enTitle || "",
      d.frTitle || "",
      d.arTitle || "",
      d.maTitle || "",
    ]
      .map(esc)
      .join(","),
  );
  return "\uFEFF" + [head, ...rows].join("\r\n");
}
