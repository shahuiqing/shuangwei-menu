/**
 * 老板端三语入口：中文 / Français / العربية
 * 语言记忆键 boss_lang；阿拉伯语容器需 dir="rtl"（见 isRtl）。
 */
import { createI18n, type Lang } from "./engine";
import { zh } from "./zh";
import { fr } from "./fr";
import { ar } from "./ar";

export type { Lang };

const api = createI18n("boss_lang", { zh, fr, ar });

export const t = api.t;
export const getLang = api.getLang;
export const setLang = api.setLang;
export const onLangChange = api.onLangChange;
export const localeOf = api.localeOf;
export const isRtl = api.isRtl;
export const LANGS = api.LANGS;
