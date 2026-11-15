/**
 * 轻量三语引擎：中文 / Français / العربية
 * - 模块级当前语言 + 订阅刷新（无需 Provider）
 * - localStorage 记忆
 * - 词条缺失回退中文，再回退 key
 * - 阿拉伯语由调用方在容器上设 dir="rtl"（见 isRtl）
 */

export type Lang = "zh" | "fr" | "ar";

export type Dict = Record<string, string>;

export interface I18nApi {
  /** 取词条，支持 {n} {d} {u} {q} {note} {r} {t} 占位符 */
  t(key: string, vars?: Record<string, string | number>): string;
  getLang(): Lang;
  setLang(l: Lang): void;
  /** 组件订阅语言变化以触发重渲染 */
  onLangChange(fn: () => void): () => void;
  /** 该语言的本地日期/时间格式 */
  localeOf(l?: Lang): string;
  isRtl(l?: Lang): boolean;
  /** 语言切换按钮组 */
  LANGS: { id: Lang; label: string }[];
}

export const LANGS: { id: Lang; label: string }[] = [
  { id: "zh", label: "中文" },
  { id: "fr", label: "Français" },
  { id: "ar", label: "العربية" },
];

export function localeOfLang(l: Lang): string {
  return l === "zh" ? "zh-CN" : l === "fr" ? "fr-FR" : "ar-MA";
}

export function isRtlLang(l: Lang): boolean {
  return l === "ar";
}

export function createI18n(
  storageKey: string,
  dicts: Record<Lang, Dict>,
): I18nApi {
  const detect = (): Lang => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === "zh" || saved === "fr" || saved === "ar") return saved;
    } catch {
      /* ignore */
    }
    return "zh";
  };

  let lang: Lang = detect();
  const listeners = new Set<() => void>();

  const getLang = () => lang;

  const setLang = (l: Lang) => {
    if (l === lang) return;
    lang = l;
    try {
      localStorage.setItem(storageKey, l);
    } catch {
      /* ignore */
    }
    listeners.forEach((f) => f());
  };

  const onLangChange = (fn: () => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  };

  const t = (key: string, vars?: Record<string, string | number>): string => {
    let s = dicts[lang][key] ?? dicts.zh[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return s;
  };

  return {
    t,
    getLang,
    setLang,
    onLangChange,
    localeOf: (l: Lang = lang) => localeOfLang(l),
    isRtl: (l: Lang = lang) => isRtlLang(l),
    LANGS,
  };
}
