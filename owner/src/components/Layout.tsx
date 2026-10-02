import { useState } from "react";
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
  ShoppingCart,
  Boxes,
  NotebookText,
  BadgeDollarSign,
  Flame,
  Plus,
  X,
  ChevronRight,
} from "lucide-react";

export type OwnerTab =
  | "dashboard"
  | "orders"
  | "reports"
  | "dishes"
  | "menu"
  | "procurement"
  | "inventory"
  | "recipe"
  | "cost"
  | "consumption"
  | "staff"
  | "settings";

export const NAV: { id: OwnerTab; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "经营看板", icon: LayoutDashboard },
  { id: "orders", label: "订单管理", icon: ReceiptText },
  { id: "reports", label: "销售报表", icon: BarChart3 },
  { id: "dishes", label: "菜品管理", icon: UtensilsCrossed },
  { id: "menu", label: "菜单分析", icon: BarChart3 },
  { id: "procurement", label: "采购管理", icon: ShoppingCart },
  { id: "inventory", label: "库存管理", icon: Boxes },
  { id: "recipe", label: "配方 BOM", icon: NotebookText },
  { id: "cost", label: "成本毛利", icon: BadgeDollarSign },
  { id: "consumption", label: "用料消耗", icon: Flame },
  { id: "staff", label: "员工管理", icon: Users },
  { id: "settings", label: "系统设置", icon: SettingsIcon },
];

// 移动端底部主导航（4 个高频目的地，中间凸起按钮打开「更多」）
const MOBILE_PRIMARY: OwnerTab[] = [
  "dashboard",
  "orders",
  "cost",
  "consumption",
];

function TabItem({
  id,
  tab,
  go,
}: {
  id: OwnerTab;
  tab: OwnerTab;
  go: (t: OwnerTab) => void;
}) {
  const item = NAV.find((n) => n.id === id)!;
  const Icon = item.icon;
  const on = tab === id;
  return (
    <button
      onClick={() => go(id)}
      className="relative flex-1 flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
    >
      <span
        className={`flex items-center justify-center w-12 h-8 rounded-full transition-all ${
          on ? "bg-orange-500/15 ring-1 ring-orange-500/25" : ""
        }`}
      >
        <Icon
          size={21}
          strokeWidth={on ? 2.4 : 2}
          className={on ? "text-orange-400" : "text-zinc-500"}
        />
      </span>
      <span
        className={`text-[10px] leading-none ${on ? "text-orange-400 font-semibold" : "text-zinc-500 font-medium"}`}
      >
        {item.label}
      </span>
    </button>
  );
}

// 移动端「更多」里的分组
const MOBILE_GROUPS: { title: string; items: OwnerTab[] }[] = [
  { title: "经营", items: ["dishes", "reports", "menu"] },
  { title: "供应与成本", items: ["procurement", "inventory", "recipe"] },
  { title: "管理", items: ["staff", "settings"] },
];

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
  const [moreOpen, setMoreOpen] = useState(false);
  const active = NAV.find((n) => n.id === tab);
  const go = (t: OwnerTab) => {
    setTab(t);
    setMoreOpen(false);
  };

  return (
    <div className="min-h-full flex bg-zinc-950">
      {/* 桌面侧边栏 */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-white/5 bg-zinc-950/60 backdrop-blur-xl sticky top-0 h-screen">
        <div className="h-16 flex items-center gap-3 px-5 border-b border-white/5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-700 flex items-center justify-center text-white font-black shrink-0 shadow-lg shadow-orange-900/40">
            双
          </div>
          <div className="min-w-0">
            <div className="text-white font-bold leading-none truncate">
              {storeName}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">
              老板管理端 v2
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === id
                  ? "bg-gradient-to-r from-orange-500/20 to-orange-600/5 text-orange-300 ring-1 ring-orange-500/25 shadow-[0_6px_18px_-10px_rgba(234,88,12,0.8)]"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab === id && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-orange-400" />
              )}
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-white/5 space-y-2">
          <div className="flex items-center gap-2 px-3 text-[11px] text-zinc-500">
            <span
              className={`w-2 h-2 rounded-full ${configured ? "bg-green-500" : "bg-red-500"}`}
            />
            {configured ? "已连接数据库" : "未配置数据库"}
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-400 hover:text-red-400 hover:bg-zinc-900"
          >
            <LogOut size={18} />
            退出登录
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* 顶部栏：移动端 App 风格（头像+店名+状态+刷新）；桌面端标题 */}
        <header className="sticky top-0 z-30 glass-bar">
          <div className="safe-top px-4 lg:px-6 flex items-center justify-between gap-3">
            <div className="lg:hidden flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-700 flex items-center justify-center text-white font-black shrink-0 shadow-lg shadow-orange-900/40 ring-1 ring-white/10">
                双
              </div>
              <div className="min-w-0">
                <div className="text-white font-semibold leading-tight truncate text-[15px]">
                  {storeName}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] leading-tight mt-0.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${live ? "bg-emerald-400 animate-pulse" : configured ? "bg-zinc-500" : "bg-rose-500"}`}
                  />
                  <span className={live ? "text-emerald-400" : "text-zinc-500"}>
                    {live
                      ? "实时同步中"
                      : lastUpdated
                        ? `更新于 ${lastUpdated}`
                        : "同步中…"}
                  </span>
                </div>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="text-lg font-bold text-white">
                {active?.label}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-zinc-500">
                <Wifi
                  size={13}
                  className={live ? "text-emerald-400" : "text-zinc-500"}
                />
                {live
                  ? "实时同步中"
                  : lastUpdated
                    ? `更新于 ${lastUpdated}`
                    : "同步中…"}
              </span>
              <button
                onClick={onRefresh}
                title="刷新"
                className="active:scale-90 transition-transform w-10 h-10 flex items-center justify-center text-zinc-300 hover:text-white bg-white/5 rounded-full ring-1 ring-white/10"
              >
                <RefreshCw
                  size={17}
                  className={loading ? "animate-spin" : ""}
                />
              </button>
            </div>
          </div>
        </header>

        {/* 内容区：移动端独立滚动 + 底部导航留白；桌面居中 */}
        <main className="flex-1 px-4 lg:px-6 py-3 lg:py-6 max-w-[1400px] w-full mx-auto mobile-safe-bottom lg:pb-6">
          {/* 移动端大标题（App 风格） */}
          <div className="lg:hidden pb-3">
            <h1 className="text-[26px] font-black tracking-tight text-white leading-tight">
              {active?.label}
            </h1>
          </div>
          {children}
        </main>
      </div>

      {/* 移动端底部 Tab 栏（5 个目的地 + 中间凸起「更多」） */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass-bar border-t border-white/[0.06] safe-bottom">
        <div className="flex items-stretch h-[58px]">
          {MOBILE_PRIMARY.slice(0, 2).map((id) => (
            <TabItem key={id} id={id} tab={tab} go={go} />
          ))}

          {/* 中间凸起按钮：打开全部功能 */}
          <div className="relative flex-1 flex items-end justify-center">
            <button
              onClick={() => setMoreOpen(true)}
              aria-label="全部功能"
              className="absolute -top-6 w-14 h-14 rounded-full btn-brand text-white flex items-center justify-center ring-4 ring-zinc-950 active:scale-95 transition-transform"
            >
              <Plus size={26} strokeWidth={2.4} />
            </button>
            <span className="pb-1.5 text-[10px] font-medium text-zinc-500">
              更多
            </span>
          </div>

          {MOBILE_PRIMARY.slice(2).map((id) => (
            <TabItem key={id} id={id} tab={tab} go={go} />
          ))}
        </div>
      </nav>

      {/* 移动端「更多」面板（分组 + 抽屉动画） */}
      {moreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end animate-[fadeIn_.15s_ease]"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="w-full bg-zinc-900 border-t border-white/10 rounded-t-[28px] px-5 pt-3 pb-8 shadow-2xl animate-[slideUp_.22s_cubic-bezier(.2,.8,.2,1)] safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto h-1.5 w-10 rounded-full bg-zinc-700 mb-4" />
            <div className="flex items-center justify-between mb-4">
              <span className="text-white font-bold text-base">全部功能</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 text-zinc-400 flex items-center justify-center active:scale-90 transition-transform"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5">
              {MOBILE_GROUPS.map((g) => (
                <div key={g.title}>
                  <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-2 px-1">
                    {g.title}
                  </div>
                  <div className="rounded-2xl bg-zinc-950/60 border border-white/5 overflow-hidden divide-y divide-white/5">
                    {g.items.map((id) => {
                      const item = NAV.find((n) => n.id === id)!;
                      const Icon = item.icon;
                      const on = tab === id;
                      return (
                        <button
                          key={id}
                          onClick={() => go(id)}
                          className={`w-full flex items-center gap-3.5 px-4 py-3.5 active:bg-white/5 transition-colors ${
                            on ? "text-orange-400" : "text-zinc-200"
                          }`}
                        >
                          <span
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              on
                                ? "bg-orange-500/15 text-orange-400"
                                : "bg-white/5 text-zinc-400"
                            }`}
                          >
                            <Icon size={18} />
                          </span>
                          <span className="text-[15px] font-medium flex-1 text-left">
                            {item.label}
                          </span>
                          <ChevronRight
                            size={18}
                            className={on ? "text-orange-400" : "text-zinc-600"}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setMoreOpen(false);
                onLogout();
              }}
              className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-500/10 text-red-400 font-semibold active:scale-[0.98] transition-transform"
            >
              <LogOut size={18} /> 退出登录
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
