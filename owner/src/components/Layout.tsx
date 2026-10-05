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
} from "lucide-react";
import { useTheme, THEMES, type Theme } from "../lib/theme";
import { useOnline } from "../lib/offline";
import { cacheUsedAt, onCacheUse } from "../lib/snapshot";
import { Sheet } from "./Sheet";

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
  { id: "settings", label: "系统设置", icon: SettingsIcon },
  { id: "tasks", label: "任务中心", icon: ClipboardCheck },
  { id: "assistant", label: "AI 助手", icon: Sparkles },
];

// 侧栏分组：按业务域分组，作为设置抽屉「全部功能」的统一入口数据源
export const NAV_GROUPS: { title: string; items: OwnerTab[] }[] = [
  { title: "经营", items: ["dashboard", "reports", "assistant"] },
  { title: "订单与任务", items: ["orders", "tasks"] },
  { title: "菜品", items: ["dishes", "menu", "recipe"] },
  {
    title: "采购与库存",
    items: ["procurement", "inventory", "trace", "waste"],
  },
  { title: "成本", items: ["cost", "consumption"] },
  { title: "系统", items: ["staff", "settings"] },
];

// 页面副标题（移动端大标题下方的一行说明）
const SUBTITLE: Partial<Record<OwnerTab, string>> = {
  dashboard: "今日经营概览 · 实时数据",
  orders: "接单、出餐与历史订单",
  reports: "营收趋势与经营分析",
  dishes: "上架、改价与售卖状态",
  menu: "单品盈利与销量排行",
  procurement: "进货记录与供应商",
  inventory: "原料库存与预警",
  trace: "订单→菜品→原料→采购批次",
  waste: "报损登记与损耗率",
  recipe: "菜品用料与成本基准",
  cost: "配方成本 × 单价的毛利核算",
  consumption: "按订单反推的用料流水",
  staff: "账号与权限",
  settings: "店铺信息与系统参数",
  tasks: "问题→任务→解决闭环",
  assistant: "简报与经营问答",
};

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
      // 阻尼：越拉越轻
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
    e.preventDefault(); // 不让浏览器自动弹安装条，由我们自己控制入口
    deferredPrompt = e as InstallPromptEvent;
    window.dispatchEvent(new Event(INSTALLABLE));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.dispatchEvent(new Event(INSTALLABLE));
  });
}

/** 是否可安装到主屏幕（浏览器判断：HTTPS + manifest + SW 就绪） */
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

/** 「安装到主屏幕」按钮（浏览器不可安装时返回 null）；给设置抽屉用 */
export function InstallButton() {
  const { can, install } = useInstallHint();
  if (!can) return null;
  return (
    <button
      onClick={install}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-orange-300 bg-orange-500/10 ring-1 ring-orange-500/25 hover:bg-orange-500/15 transition-colors"
    >
      <Download size={16} />
      安装到主屏幕
    </button>
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
  const active = NAV.find((n) => n.id === tab);
  const go = (t: OwnerTab) => {
    setTab(t);
    setMenuOpen(false);
  };
  const pull = usePullToRefresh(onRefresh, true);
  const pulling = pull > 4;
  const ready = pull > 56;
  const [scrolled, setScrolled] = useState(false);
  const online = useOnline();
  // 断网回落到本地快照时，告知数据时间
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

  return (
    <div className="min-h-full flex flex-col bg-zinc-950">
      <div className="flex-1 min-w-0 flex flex-col">
        {/* 顶部栏：左=Logo(回看板)+页标题；右=设置/刷新（功能入口统一在设置抽屉） */}
        <header
          className={`sticky top-0 z-30 glass-bar border-b border-white/[0.06] transition-shadow duration-300 ${
            scrolled
              ? "shadow-[0_14px_30px_-22px_rgba(0,0,0,0.85)]"
              : "shadow-none"
          }`}
        >
          <div className="safe-top px-4 lg:px-6 flex items-center justify-between gap-3">
            <button
              onClick={() => go("dashboard")}
              title="回到看板"
              className="flex items-center gap-3 min-w-0 text-left group"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-700 flex items-center justify-center text-white font-black shrink-0 shadow-lg shadow-orange-900/40 ring-1 ring-white/10 group-hover:scale-105 transition-transform">
                双
              </div>
              <div className="min-w-0">
                {/* 桌面：当前页标题 */}
                <div className="hidden lg:block text-xl font-semibold tracking-tight text-white leading-tight truncate">
                  {active?.label}
                </div>
                <div className="hidden lg:block text-[13px] text-zinc-500 mt-0.5 leading-snug truncate">
                  {SUBTITLE[tab]}
                </div>
                {/* 移动：店名 + 同步状态 */}
                <div className="lg:hidden text-white font-semibold leading-tight truncate text-[15px]">
                  {storeName}
                </div>
                <div className="lg:hidden flex items-center gap-1.5 text-[11px] leading-tight mt-0.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${!online ? "bg-amber-400" : live ? "bg-emerald-400 animate-pulse" : configured ? "bg-zinc-500" : "bg-rose-500"}`}
                  />
                  <span
                    className={
                      !online
                        ? "text-amber-400"
                        : live
                          ? "text-emerald-400"
                          : "text-zinc-500"
                    }
                  >
                    {!online
                      ? "离线 · 显示缓存"
                      : live
                        ? "实时同步中"
                        : lastUpdated
                          ? `更新于 ${lastUpdated}`
                          : "同步中…"}
                  </span>
                </div>
              </div>
            </button>
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
                {!online
                  ? "离线 · 显示缓存"
                  : live
                    ? "实时同步中"
                    : lastUpdated
                      ? `更新于 ${lastUpdated}`
                      : "同步中…"}
              </span>
              <button
                onClick={() => setMenuOpen(true)}
                aria-label="设置与功能"
                title="设置与功能"
                className="active:scale-90 transition-transform w-9 h-9 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 bg-white/5 rounded-lg ring-1 ring-white/10"
              >
                <SettingsIcon size={16} />
              </button>
              <button
                onClick={onRefresh}
                title="刷新"
                className="active:scale-90 transition-transform w-9 h-9 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 bg-white/5 rounded-lg ring-1 ring-white/10"
              >
                <RefreshCw
                  size={16}
                  className={loading ? "animate-spin" : ""}
                />
              </button>
            </div>
          </div>
          {/* 离线提示条：PWA 断网时页面走缓存，必须显式告知数据非最新 */}
          {!online && (
            <div className="flex items-center gap-2 px-4 lg:px-6 py-1.5 text-[11px] font-medium text-amber-400 bg-amber-500/10 border-t border-amber-500/25">
              <WifiOff size={12} className="shrink-0" />
              网络已断开，当前显示缓存数据
              {cacheAt &&
                `（数据快照 ${new Date(cacheAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}）`}
              ；恢复联网后自动刷新
            </div>
          )}
        </header>

        {/* 内容区：移动端独立滚动 + 底部导航留白；桌面居中 */}
        <main className="relative flex-1 px-4 lg:px-6 py-3 lg:py-6 max-w-[1400px] w-full mx-auto mobile-safe-bottom lg:pb-6">
          {/* 下拉刷新指示（移动端） */}
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
              {ready ? "松开刷新" : "下拉刷新"}
            </span>
          </div>

          <div
            style={{
              transform: pull
                ? `translateY(${Math.min(pull, 72)}px)`
                : undefined,
            }}
          >
            {/* 移动端大标题（App 风格：标题 + 副标题） */}
            <div className="lg:hidden pb-4">
              <h1 className="text-2xl font-bold tracking-tight text-white leading-tight">
                {active?.label}
              </h1>
              <p className="text-[13px] text-zinc-500 mt-1 leading-snug">
                {SUBTITLE[tab] ?? " "}
              </p>
            </div>
            {children}
          </div>
        </main>
      </div>

      {/* 设置抽屉：主题切换 + 全部功能 + 安装/退出（功能入口统一收在这里） */}
      <Sheet
        open={menuOpen}
        title="设置与功能"
        subtitle={`${storeName} · 主题、全部页面与账号`}
        onClose={() => setMenuOpen(false)}
        maxW="max-w-lg"
      >
        <div className="space-y-5">
          {/* 主题切换 */}
          <div>
            <div className="text-[11px] font-semibold tracking-[0.08em] text-zinc-500 mb-2">
              主题
            </div>
            <div className="grid grid-cols-5 gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id as Theme)}
                  className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border transition-colors ${
                    theme === t.id
                      ? "border-orange-500/50 bg-orange-500/10"
                      : "border-white/5 bg-zinc-950 hover:border-white/15"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full ring-1 ${t.id === "light" ? "ring-zinc-300" : "ring-white/25"}`}
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

          {/* 全部功能（数据页由首页数据框直达，这里是统一兜底入口） */}
          <div>
            <div className="text-[11px] font-semibold tracking-[0.08em] text-zinc-500 mb-2">
              全部功能
            </div>
            <div className="space-y-3">
              {NAV_GROUPS.map((g) => (
                <div key={g.title}>
                  <div className="text-[11px] tracking-[0.06em] text-zinc-600 mb-1.5">
                    {g.title}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {g.items.map((id) => {
                      const item = NAV.find((n) => n.id === id)!;
                      const Icon = item.icon;
                      const on = id === tab;
                      return (
                        <button
                          key={id}
                          onClick={() => go(id)}
                          className={`flex items-center gap-2 px-2.5 py-2.5 rounded-xl border text-[13px] font-medium transition-colors ${
                            on
                              ? "bg-orange-500/10 border-orange-500/30 text-orange-300"
                              : "bg-zinc-950 border-white/5 text-zinc-300 hover:border-orange-500/40 hover:text-white"
                          }`}
                        >
                          <Icon size={15} className="shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 状态与账号 */}
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span
              className={`w-2 h-2 rounded-full ${configured ? "bg-green-500" : "bg-red-500"}`}
            />
            {configured ? "已连接数据库" : "未配置数据库"}
          </div>
          <InstallButton />
          <button
            onClick={() => {
              setMenuOpen(false);
              onLogout();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-500/30 text-sm font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/15 transition-colors"
          >
            <LogOut size={15} /> 退出登录
          </button>
        </div>
      </Sheet>
    </div>
  );
}
