import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { localRaw, localSetRaw } from "./localdb";

export type Theme = "dark" | "light";

const KEY = "shuangwei-owner-theme";

interface ThemeCtxValue {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeCtx = createContext<ThemeCtxValue>({
  theme: "dark",
  toggle: () => {},
  setTheme: () => {},
});

export function readInitialTheme(): Theme {
  const v = localRaw(KEY);
  return v === "light" || v === "dark" ? v : "dark";
}

/** 在 React 挂载前就把主题写到 <html data-theme>，避免首屏闪黑 */
export function applyThemeAttr(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta)
    meta.setAttribute("content", theme === "light" ? "#f1f2f4" : "#08080b");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    applyThemeAttr(theme);
    localSetRaw(KEY, theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(
    () => setThemeState((t) => (t === "dark" ? "light" : "dark")),
    [],
  );

  return (
    <ThemeCtx.Provider value={{ theme, toggle, setTheme }}>
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
}

const DARK_CHART: ChartTheme = {
  grid: "#27272a",
  axis: "#27272a",
  label: "#71717a",
  split: "#52525b",
  tipBg: "#18181b",
  tipBorder: "#3f3f46",
  tipText: "#fafafa",
};

const LIGHT_CHART: ChartTheme = {
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
  return theme === "light" ? LIGHT_CHART : DARK_CHART;
}
