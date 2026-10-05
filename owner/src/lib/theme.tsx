import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { localRaw, localSetRaw } from "./localdb";

export type Theme =
  "zhangben" | "dark" | "tech" | "emerald" | "violet" | "light";

/** 可选主题（设置抽屉里切换）：色板圆点 + 名称 */
export const THEMES: {
  id: Theme;
  label: string;
  dot: string;
  meta: string;
}[] = [
  { id: "zhangben", label: "东家账本", dot: "#c0392b", meta: "#f5f1e8" },
  { id: "dark", label: "暗夜橙", dot: "#f97316", meta: "#0a0a0c" },
  { id: "tech", label: "科技蓝", dot: "#38bdf8", meta: "#080c12" },
  { id: "emerald", label: "翡翠绿", dot: "#10b981", meta: "#080d0b" },
  { id: "violet", label: "星云紫", dot: "#a78bfa", meta: "#0b0812" },
  { id: "light", label: "素白", dot: "#fafafa", meta: "#f4f4f5" },
];

const KEY = "shuangwei-owner-theme";

interface ThemeCtxValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeCtx = createContext<ThemeCtxValue>({
  theme: "zhangben",
  setTheme: () => {},
});

export function readInitialTheme(): Theme {
  const v = localRaw(KEY);
  return THEMES.some((t) => t.id === v) ? (v as Theme) : "zhangben";
}

/** 在 React 挂载前就把主题写到 <html data-theme>，避免首屏闪黑 */
export function applyThemeAttr(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta)
    meta.setAttribute(
      "content",
      THEMES.find((t) => t.id === theme)?.meta ?? "#0a0a0c",
    );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    applyThemeAttr(theme);
    localSetRaw(KEY, theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);

  return (
    <ThemeCtx.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}

/** 图表配色：随主题切换（recharts 的样式对象引用同一份常量） */
export interface ChartTheme {
  grid: string;
  axis: string;
  label: string;
  split: string;
  tipBg: string;
  tipBorder: string;
  tipText: string;
  /** 主色（随主题：橙/蓝/绿/紫），图表线条与柱体用 */
  brand: string;
  /** 主色半透明（hover 光标等） */
  brandSoft: string;
}

const BRAND: Record<Theme, Pick<ChartTheme, "brand" | "brandSoft">> = {
  zhangben: { brand: "#c0392b", brandSoft: "rgba(192,57,43,0.30)" },
  dark: { brand: "#fb923c", brandSoft: "rgba(251,146,60,0.35)" },
  tech: { brand: "#38bdf8", brandSoft: "rgba(56,189,248,0.35)" },
  emerald: { brand: "#34d399", brandSoft: "rgba(52,211,153,0.35)" },
  violet: { brand: "#a78bfa", brandSoft: "rgba(167,139,250,0.35)" },
  light: { brand: "#ea580c", brandSoft: "rgba(234,88,12,0.3)" },
};

const DARK_CHART: Omit<ChartTheme, "brand" | "brandSoft"> = {
  grid: "#27272a",
  axis: "#27272a",
  label: "#71717a",
  split: "#52525b",
  tipBg: "#18181b",
  tipBorder: "#3f3f46",
  tipText: "#fafafa",
};

const LIGHT_CHART: Omit<ChartTheme, "brand" | "brandSoft"> = {
  grid: "#e7e9ed",
  axis: "#dcdfe4",
  label: "#71717a",
  split: "#c9ccd2",
  tipBg: "#ffffff",
  tipBorder: "#e4e4e7",
  tipText: "#18181b",
};

export function useChartTheme(): ChartTheme {
  const { theme } = useTheme();
  const base =
    theme === "light" || theme === "zhangben" ? LIGHT_CHART : DARK_CHART;
  return { ...base, ...BRAND[theme] };
}
