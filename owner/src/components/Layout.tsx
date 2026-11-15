import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ReceiptText,
  BarChart3,
  UtensilsCrossed,
  Users,
  Settings as SettingsIcon,
  RefreshCw,
  LogOut,
  Wifi,
  WifiOff,
  ShoppingCart,
  Boxes,
  NotebookText,
  BadgeDollarSign,
  Flame,
  PackageX,
  Download,
  ClipboardCheck,
  Sparkles,
  Route,
  LayoutGrid,
  Send,
  Languages,
} from "lucide-react";
import { useTheme, THEMES, type Theme } from "../lib/theme";
import { useOnline } from "../lib/offline";
import { cacheUsedAt, onCacheUse } from "../lib/snapshot";
import { Sheet } from "./Sheet";
import {
  t,
  LANGS,
  getLang,
  setLang,
  onLangChange,
  isRtl,
  localeOf,
} from "../i18n";

export type OwnerTab =
  | "dashboard"
  | "orders"
  | "reports"
  | "dishes"
  | "menu"
  | "procurement"
  | "inventory"
  | "trace"
  | "waste"
  | "recipe"
  | "cost"
  | "consumption"
  | "staff"
  | "dispatch"
  | "stocktake"
  | "requests"
  | "settings"
  | "tasks"
  | "assistant";

export const NAV: { id: OwnerTab; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "经营看板", icon: LayoutDashboard },
  { id: "orders", label: "订单管理", icon: ReceiptText },
  { id: "reports", label: "销售报表", icon: BarChart3 },
  { id: "dishes", label: "菜品管理", icon: UtensilsCrossed },
  { id: "menu", label: "菜单分析", icon: BarChart3 },
  { id: "procurement", label: "采购管理", icon: ShoppingCart },
  { id: "inventory", label: "库存管理", icon: Boxes },
  { id: "trace", label: "全链路溯源", icon: Route },
  { id: "waste", label: "损耗分析", icon: PackageX },
  { id: "recipe", label: "配方 BOM", icon: NotebookText },
  { id: "cost", label: "成本毛利", icon: BadgeDollarSign },
  { id: "consumption", label: "用料消耗", icon: Flame },
  { id: "staff", label: "员工管理", icon: Users },
  { id: "dispatch", label: "任务派发", icon: Send },
  { id: "stocktake", label: "盘点管理", icon: Boxes },
  { id: "requests", label: "采购申报", icon: ClipboardCheck },
  { id: "settings", label: "系统设置", icon: SettingsIcon },
  { id: "tasks", label: "任务中心", icon: ClipboardCheck },
  { id: "assistant", label: "AI 助手", icon: Sparkles },
];

// 侧栏分组：按业务域分组，作为桌面侧栏与「全部功能」的统一入口数据源
// 分组标题（key 用于三语翻译，title 作为中文兜底）
export const NAV_GROUPS: { key: string; title: string; items: OwnerTab[] }[] = [
  { key: "biz", title: "经营", items: ["dashboard", "reports", "assistant"] },
  { key: "ops", title: "订单与任务", items: ["orders", "tasks"] },
  { key: "dishes", title: "菜品", items: ["dishes", "menu", "recipe"] },
  {
    key: "stock",
    title: "采购与库存",
    items: ["procurement", "inventory", "trace", "waste"],
  },
  { key: "cost", title: "成本", items: ["cost", "consumption"] },
  {
    key: "team",
    title: "员工协同",
    items: ["staff", "dispatch", "stocktake", "requests"],
  },
  { key: "sys", title: "系统", items: ["settings"] },
];

// 移动端底部主导航：只放每天最常用的 4 个页面，其余统一进「全部」
export const PRIMARY_NAV: {
  id: OwnerTab;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "dashboard", label: "看板", icon: LayoutDashboard },
  { id: "orders", label: "订单", icon: ReceiptText },
  { id: "inventory", label: "库存", icon: Boxes },
  { id: "cost", label: "成本", icon: BadgeDollarSign },
];

// 页面副标题现在统一走 i18n 词条 sub.<tab>（见 src/i18n/*）

/** 移动端下拉刷新：仅在页面顶部、向下拖动超过阈值时触发刷新 */
function usePullToRefresh(onRefresh: () => void, enabled: boolean) {
  const [pull, setPull] = useState(0);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const setPullBoth = (v: number) => {
      pullRef.current = v;
      setPull(v);
    };
    const atTop = () =>
      (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

    const onStart = (e: TouchEvent) => {
      if (busy.current || !atTop()) return;
      startY.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current === null || busy.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || !atTop()) {
        startY.current = null;
        setPullBoth(0);
        return;
      }
      setPullBoth(Math.min(96, dy * 0.45));
    };
    const onEnd = () => {
      if (startY.current === null) return;
      const fired = pullRef.current > 56;
      startY.current = null;
      if (fired) {
        busy.current = true;
        onRefresh();
        setTimeout(() => {
          busy.current = false;
          setPullBoth(0);
        }, 700);
      } else {
        setPullBoth(0);
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      setPullBoth(0);
    };
  }, [enabled, onRefresh]);

  return pull;
}

/* ---------- PWA 安装引导 ---------- */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: string }>;
}

let deferredPrompt: InstallPromptEvent | null = null;
const INSTALLABLE = "owner:installable";

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
    window.dispatchEvent(new Event(INSTALLABLE));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.dispatchEvent(new Event(INSTALLABLE));
  });
}

function useInstallHint() {
  const [can, setCan] = useState<boolean>(() => !!deferredPrompt);
  useEffect(() => {
    const on = () => setCan(!!deferredPrompt);
    window.addEventListener(INSTALLABLE, on);
    return () => window.removeEventListener(INSTALLABLE, on);
  }, []);
  const install = useCallback(async () => {
    const prompt = deferredPrompt;
    if (!prompt) return;
    deferredPrompt = null;
    setCan(false);
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      /* 用户取消或浏览器不支持 */
    }
  }, []);
  return { can, install };
}

export function InstallButton() {
  const { can, install } = useInstallHint();
  if (!can) return null;
  return (
    <button
      onClick={install}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-orange-300 bg-orange-500/10 ring-1 ring-orange-500/25 hover:bg-orange-500/15 transition-colors"
    >
      <Download size={16} />
      {t("shell.install")}
    </button>
  );
}

/** 语言切换（中文 / Français / العربية） */
export function LangSwitch({ className = "" }: { className?: string }) {
  const [, force] = useState(0);
  useEffect(() => onLangChange(() => force((v) => v + 1)), []);
  return (
    <div
      dir="ltr"
      className={`flex items-center gap-0.5 rounded-full bg-zinc-900 border border-white/5 px-1 py-0.5 ${className}`}
    >
      <Languages size={12} className="text-zinc-500 mx-1 shrink-0" />
      {LANGS.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => setLang(l.id)}
          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${
            getLang() === l.id
              ? "bg-orange-600 text-white"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

export function Layout({
  tab,
  setTab,
  storeName,
  loading,
  lastUpdated,
  live,
  onRefresh,
  onLogout,
  configured,
  children,
}: {
  tab: OwnerTab;
  setTab: (t: OwnerTab) => void;
  storeName: string;
  loading: boolean;
  lastUpdated: string;
  live?: boolean;
  onRefresh: () => void;
  onLogout: () => void;
  configured: boolean;
  children: ReactNode;
}) {
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [, force] = useState(0);
  useEffect(() => onLangChange(() => force((v) => v + 1)), []);
  const active = NAV.find((n) => n.id === tab);
  const primaryActive = PRIMARY_NAV.some((n) => n.id === tab);
  const go = (t: OwnerTab) => {
    setTab(t);
    setMenuOpen(false);
  };
  const pull = usePullToRefresh(onRefresh, true);
  const pulling = pull > 4;
  const ready = pull > 56;
  const [scrolled, setScrolled] = useState(false);
  const online = useOnline();
  const [cacheAt, setCacheAt] = useState(cacheUsedAt);
  useEffect(() => onCacheUse(setCacheAt), []);

  useEffect(() => {
    const onScroll = () =>
      setScrolled(
        (window.scrollY || document.documentElement.scrollTop || 0) > 6,
      );
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const statusText = !online
    ? t("shell.offline")
    : live
      ? t("shell.live")
      : lastUpdated
        ? t("shell.updated", { t: lastUpdated })
        : t("shell.syncing");

  const statusColor = !online
    ? "bg-amber-400"
    : live
      ? "bg-emerald-400 animate-pulse"
      : configured
        ? "bg-zinc-500"
        : "bg-rose-500";

  return (
    <div
      dir={isRtl() ? "rtl" : "ltr"}
      className="min-h-full bg-zinc-950 lg:flex"
    >
      {/* 桌面侧栏：所有页面常驻可见，移动端由底部导航承载 */}
      <aside className="hidden lg:flex w-56 xl:w-60 shrink-0 flex-col sticky top-0 h-screen border-r border-white/[0.07] bg-zinc-950/80 backdrop-blur">
        <button
          onClick={() => go("dashboard")}
          className="h-16 px-4 flex items-center gap-3 border-b border-white/[0.06] text-left"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-700 flex items-center justify-center text-white font-black shrink-0 shadow-lg shadow-orange-900/30 ring-1 ring-white/10">
            双
          </div>
          <div className="min-w-0">
            <div className="font-serif text-[15px] font-semibold text-white truncate leading-tight">
              {storeName}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">
              {t("shell.bossConsole")}
            </div>
          </div>
        </button>

        <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-4">
          {NAV_GROUPS.map((g) => (
            <div key={g.key}>
              <div className="px-2 mb-1 text-[10px] font-semibold tracking-[0.12em] text-zinc-600">
                {t(`navg.${g.key}`)}
              </div>
              <div className="space-y-0.5">
                {g.items.map((id) => {
                  const item = NAV.find((n) => n.id === id)!;
                  const Icon = item.icon;
                  const on = id === tab;
                  return (
                    <button
                      key={id}
                      data-tab={id}
                      onClick={() => go(id)}
                      aria-current={on ? "page" : undefined}
                      className={`relative w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors ${
                        on
                          ? "bg-orange-500/12 text-orange-300 font-semibold"
                          : "text-zinc-400 hover:text-white hover:bg-white/[0.05]"
                      }`}
                    >
                      {on && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-orange-500" />
                      )}
                      <Icon size={16} className="shrink-0" />
                      <span className="truncate">{t(`nav.${item.id}`)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-white/[0.06] space-y-2">
          <div className="flex items-center gap-2 px-1 text-[11px] text-zinc-500">
            <span
              className={`w-2 h-2 rounded-full ${configured ? "bg-green-500" : "bg-red-500"}`}
            />
            {configured ? t("shell.connected") : t("shell.noDb")}
          </div>
          <InstallButton />
          <LangSwitch className="w-full justify-center" />
          <button
            onClick={() => setMenuOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            <LayoutGrid size={16} />
            {t("shell.themeAll")}
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-zinc-500 hover:text-red-400 hover:bg-red-500/[0.08] transition-colors"
          >
            <LogOut size={16} />
            {t("shell.logout")}
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header
          className={`sticky top-0 z-30 glass-bar border-b border-white/[0.06] transition-shadow duration-300 ${
            scrolled
              ? "shadow-[0_14px_30px_-22px_rgba(0,0,0,0.85)]"
              : "shadow-none"
          }`}
        >
          <div className="safe-top px-3.5 sm:px-5 lg:px-7 flex items-center justify-between gap-3">
            {/* 移动端：店名 + 同步状态，页面标题在内容区 */}
            <button
              onClick={() => go("dashboard")}
              className="lg:hidden flex items-center gap-2.5 min-w-0 text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-700 flex items-center justify-center text-white font-black shrink-0 shadow-md shadow-orange-900/30 ring-1 ring-white/10">
                双
              </div>
              <div className="min-w-0">
                <div className="text-white font-semibold leading-tight truncate text-[15px]">
                  {storeName}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] leading-tight mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
                  <span
                    className={
                      !online
                        ? "text-amber-400"
                        : live
                          ? "text-emerald-400"
                          : "text-zinc-500"
                    }
                  >
                    {statusText}
                  </span>
                </div>
              </div>
            </button>

            {/* 桌面端：当前页面标题 */}
            <div className="hidden lg:block min-w-0">
              <h1 className="font-serif text-xl font-semibold tracking-tight text-white leading-tight truncate">
                {active ? t(`nav.${active.id}`) : ""}
              </h1>
              <p className="text-[13px] text-zinc-500 mt-0.5 leading-snug truncate">
                {t(`sub.${tab}`)}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-zinc-500">
                {online ? (
                  <Wifi
                    size={13}
                    className={live ? "text-emerald-400" : "text-zinc-500"}
                  />
                ) : (
                  <WifiOff size={13} className="text-amber-400" />
                )}
                {statusText}
              </span>
              <button
                onClick={() => setMenuOpen(true)}
                aria-label={t("shell.themeAll")}
                title={t("shell.themeAll")}
                className="hidden lg:flex active:scale-90 transition-transform w-9 h-9 items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 bg-white/5 rounded-lg ring-1 ring-white/10"
              >
                <SettingsIcon size={16} />
              </button>
              <button
                onClick={onRefresh}
                title={t("shell.refresh")}
                aria-label={t("shell.refresh")}
                className="active:scale-90 transition-transform w-9 h-9 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 bg-white/5 rounded-lg ring-1 ring-white/10"
              >
                <RefreshCw
                  size={16}
                  className={loading ? "animate-spin" : ""}
                />
              </button>
            </div>
          </div>

          {!online && (
            <div className="flex items-center gap-2 px-4 lg:px-7 py-1.5 text-[11px] font-medium text-amber-400 bg-amber-500/10 border-t border-amber-500/25">
              <WifiOff size={12} className="shrink-0" />
              {t("shell.disconnected")}
              {cacheAt &&
                `（${t("shell.snapshot", {
                  t: new Date(cacheAt).toLocaleTimeString(localeOf(), {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                })}）`}
              {t("shell.restored")}
            </div>
          )}
        </header>

        <main className="relative flex-1 px-3.5 sm:px-5 lg:px-7 py-4 lg:py-6 max-w-[1440px] w-full mx-auto mobile-safe-bottom lg:pb-8">
          <div
            aria-hidden
            className="lg:hidden fixed inset-x-0 z-30 flex flex-col items-center pointer-events-none transition-opacity"
            style={{
              top: "calc(env(safe-area-inset-top, 0px) + 3.6rem)",
              opacity: pulling ? 1 : 0,
            }}
          >
            <div
              className="w-9 h-9 rounded-full bg-zinc-900/92 backdrop-blur border border-white/10 shadow-lg flex items-center justify-center"
              style={{ transform: `translateY(${Math.min(pull, 64) - 34}px)` }}
            >
              <RefreshCw
                size={17}
                className={ready ? "text-orange-400" : "text-zinc-500"}
                style={{ transform: `rotate(${pull * 4}deg)` }}
              />
            </div>
            <span
              className="text-[11px] text-zinc-500 mt-1"
              style={{ transform: `translateY(${Math.min(pull, 64) - 34}px)` }}
            >
              {ready ? t("shell.release") : t("shell.pull")}
            </span>
          </div>

          <div
            style={{
              transform: pull
                ? `translateY(${Math.min(pull, 72)}px)`
                : undefined,
            }}
          >
            <div className="lg:hidden pb-3.5">
              <h1 className="font-serif text-[22px] font-bold tracking-tight text-white leading-tight">
                {active ? t(`nav.${active.id}`) : ""}
              </h1>
              <p className="text-[12px] text-zinc-500 mt-1 leading-snug">
                {t(`sub.${tab}`) === `sub.${tab}` ? " " : t(`sub.${tab}`)}
              </p>
            </div>
            {children}
          </div>
        </main>
      </div>

      {/* 移动端底部主导航：4 个高频页面 + 全部功能 */}
      <nav
        aria-label={t("shell.mainNav")}
        className="lg:hidden fixed inset-x-0 bottom-0 z-40 glass-bar border-t border-white/[0.08] pb-[var(--sab)]"
      >
        <div className="grid grid-cols-5 h-[60px]">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const on = tab === item.id;
            return (
              <button
                key={item.id}
                data-tab={item.id}
                onClick={() => go(item.id)}
                aria-current={on ? "page" : undefined}
                className={`relative flex flex-col items-center justify-center gap-1 transition-colors ${
                  on ? "text-orange-400" : "text-zinc-500 active:text-zinc-300"
                }`}
              >
                {on && (
                  <span className="absolute top-0 h-0.5 w-8 rounded-full bg-orange-500" />
                )}
                <Icon size={20} strokeWidth={on ? 2.4 : 1.8} />
                <span className="text-[10.5px] leading-none font-medium">
                  {t(`nav.${item.id}`)}
                </span>
              </button>
            );
          })}
          <button
            data-tab="more"
            onClick={() => setMenuOpen(true)}
            aria-label={t("shell.allFeatures")}
            className={`relative flex flex-col items-center justify-center gap-1 transition-colors ${
              !primaryActive || menuOpen
                ? "text-orange-400"
                : "text-zinc-500 active:text-zinc-300"
            }`}
          >
            {(!primaryActive || menuOpen) && (
              <span className="absolute top-0 h-0.5 w-8 rounded-full bg-orange-500" />
            )}
            <LayoutGrid size={20} strokeWidth={!primaryActive ? 2.4 : 1.8} />
            <span className="text-[10.5px] leading-none font-medium">
              {t("shell.more")}
            </span>
          </button>
        </div>
      </nav>

      <Sheet
        open={menuOpen}
        title={t("shell.allFeatures")}
        subtitle={`${storeName} · ${t("shell.menuSubtitle")}`}
        onClose={() => setMenuOpen(false)}
        maxW="max-w-lg"
      >
        <div className="space-y-5">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.08em] text-zinc-500 mb-2">
              {t("shell.theme")}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id as Theme)}
                  className={`flex items-center sm:flex-col gap-2 sm:gap-1.5 px-3 py-2.5 rounded-xl border transition-colors ${
                    theme === t.id
                      ? "border-orange-500/50 bg-orange-500/10"
                      : "border-white/5 bg-zinc-950 hover:border-white/15"
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full ring-1 shrink-0 ${t.id === "light" ? "ring-zinc-300" : "ring-white/25"}`}
                    style={{ background: t.dot }}
                  />
                  <span
                    className={`text-[11px] leading-none ${theme === t.id ? "text-orange-300 font-semibold" : "text-zinc-400"}`}
                  >
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-semibold tracking-[0.08em] text-zinc-500">
                {t("shell.allFeatures")}
              </div>
              <button
                onClick={() => go("dashboard")}
                className="text-[11px] text-zinc-500 hover:text-orange-400"
              >
                {t("shell.backToDash")}
              </button>
            </div>
            <div className="space-y-3">
              {NAV_GROUPS.map((g) => (
                <div key={g.key}>
                  <div className="text-[11px] tracking-[0.06em] text-zinc-600 mb-1.5">
                    {t(`navg.${g.key}`)}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {g.items.map((id) => {
                      const item = NAV.find((n) => n.id === id)!;
                      const Icon = item.icon;
                      const on = id === tab;
                      return (
                        <button
                          key={id}
                          data-tab={id}
                          onClick={() => go(id)}
                          className={`flex items-center gap-2 px-2.5 py-2.5 rounded-xl border text-[13px] font-medium transition-colors ${
                            on
                              ? "bg-orange-500/10 border-orange-500/30 text-orange-300"
                              : "bg-zinc-950 border-white/5 text-zinc-300 hover:border-orange-500/40 hover:text-white"
                          }`}
                        >
                          <Icon size={15} className="shrink-0" />
                          <span className="truncate">
                            {t(`nav.${item.id}`)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span
              className={`w-2 h-2 rounded-full ${configured ? "bg-green-500" : "bg-red-500"}`}
            />
            {configured ? t("shell.connected") : t("shell.noDb")}
          </div>
          <InstallButton />
          <LangSwitch className="justify-center" />
          <button
            onClick={() => {
              setMenuOpen(false);
              onLogout();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-500/30 text-sm font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/15 transition-colors"
          >
            <LogOut size={15} /> {t("shell.logout")}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
