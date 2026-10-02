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
  MoreHorizontal,
  X,
} from "lucide-react";

export type OwnerTab =
  | "dashboard"
  | "orders"
  | "reports"
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
  { id: "menu", label: "菜单分析", icon: UtensilsCrossed },
  { id: "procurement", label: "采购管理", icon: ShoppingCart },
  { id: "inventory", label: "库存管理", icon: Boxes },
  { id: "recipe", label: "配方 BOM", icon: NotebookText },
  { id: "cost", label: "成本毛利", icon: BadgeDollarSign },
  { id: "consumption", label: "用料消耗", icon: Flame },
  { id: "staff", label: "员工管理", icon: Users },
  { id: "settings", label: "系统设置", icon: SettingsIcon },
];

const MOBILE_PRIMARY: OwnerTab[] = [
  "dashboard",
  "orders",
  "cost",
  "consumption",
];

export function Layout({
  tab,
  setTab,
  storeName,
  loading,
  lastUpdated,
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
  onRefresh: () => void;
  onLogout: () => void;
  configured: boolean;
  children: ReactNode;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const go = (t: OwnerTab) => {
    setTab(t);
    setMoreOpen(false);
  };

  return (
    <div className="min-h-full flex bg-zinc-950">
      {/* 桌面侧边栏 */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-zinc-800 bg-zinc-950 sticky top-0 h-screen">
        <div className="h-16 flex items-center gap-3 px-5 border-b border-zinc-800">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white font-black shrink-0">
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
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                tab === id
                  ? "bg-orange-600/15 text-orange-400 border border-orange-600/30"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900"
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-zinc-800 space-y-2">
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
        {/* 顶栏 */}
        <header className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
          <div className="h-16 px-4 sm:px-6 flex items-center justify-between gap-3">
            <div className="lg:hidden flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white font-black shrink-0">
                双
              </div>
              <span className="text-white font-bold truncate">{storeName}</span>
            </div>
            <div className="hidden lg:block">
              <div className="text-lg font-bold text-white">
                {NAV.find((n) => n.id === tab)?.label}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-zinc-500">
                <Wifi size={13} className="text-green-500" />
                {lastUpdated ? `更新于 ${lastUpdated}` : "同步中…"}
              </span>
              <button
                onClick={onRefresh}
                title="刷新"
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg"
              >
                <RefreshCw
                  size={18}
                  className={loading ? "animate-spin" : ""}
                />
              </button>
              <button
                onClick={onLogout}
                title="退出"
                className="lg:hidden p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-900 rounded-lg"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 pb-24 lg:pb-6 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* 移动端底部导航 */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 flex">
        {MOBILE_PRIMARY.map((id) => {
          const item = NAV.find((n) => n.id === id)!;
          const Icon = item.icon;
          return (
            <button
              key={id}
              onClick={() => go(id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] ${
                tab === id ? "text-orange-400" : "text-zinc-500"
              }`}
            >
              <Icon size={20} />
              {item.label}
            </button>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] ${
            NAV.some((n) => n.id === tab && !MOBILE_PRIMARY.includes(n.id))
              ? "text-orange-400"
              : "text-zinc-500"
          }`}
        >
          <MoreHorizontal size={20} />
          更多
        </button>
      </nav>

      {/* 移动端更多菜单 */}
      {moreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="w-full bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 px-1">
              <span className="text-white font-semibold">全部功能</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {NAV.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => go(id)}
                  className={`flex flex-col items-center gap-2 py-4 rounded-2xl border ${
                    tab === id
                      ? "bg-orange-600/15 text-orange-400 border-orange-600/30"
                      : "bg-zinc-950 text-zinc-300 border-zinc-800"
                  }`}
                >
                  <Icon size={22} />
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
