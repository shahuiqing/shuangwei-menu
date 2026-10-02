import { useEffect, useState, useCallback } from "react";
import {
  LayoutDashboard,
  ReceiptText,
  BarChart3,
  Users,
  LogOut,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import Login from "./views/Login";
import Dashboard from "./views/Dashboard";
import Orders from "./views/Orders";
import Reports from "./views/Reports";
import StaffView from "./views/Staff";
import { isAuthed, clearAuthed } from "./lib/auth";
import { isConfigured, STORE_NAME } from "./lib/supabase";
import { fetchOrders, fetchSettings } from "./lib/data";

type Tab = "dashboard" | "orders" | "reports" | "staff";

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "经营看板", icon: LayoutDashboard },
  { id: "orders", label: "订单查询", icon: ReceiptText },
  { id: "reports", label: "销售报表", icon: BarChart3 },
  { id: "staff", label: "员工管理", icon: Users },
];

export default function App() {
  const [authed, setAuthed] = useState(() => isAuthed());
  const [tab, setTab] = useState<Tab>("dashboard");
  const [orders, setOrders] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const [o, s] = await Promise.all([fetchOrders(), fetchSettings()]);
    setOrders(o);
    setSettings(s);
    setLoading(false);
    setLastUpdated(new Date().toLocaleTimeString("zh-CN"));
  }, []);

  useEffect(() => {
    if (authed && isConfigured) load();
  }, [authed, load]);

  useEffect(() => {
    if (!authed || !isConfigured) return;
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [authed, load]);

  if (!authed) return <Login onDone={() => setAuthed(true)} />;

  return (
    <div className="min-h-full flex flex-col bg-zinc-950">
      {/* 顶栏 */}
      <header className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white font-black shrink-0">
              双
            </div>
            <div className="min-w-0">
              <div className="text-white font-bold leading-none truncate">
                {STORE_NAME}
              </div>
              <div className="text-[10px] text-zinc-500">老板管理端</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-500 hidden sm:inline">
              {lastUpdated ? `更新于 ${lastUpdated}` : ""}
            </span>
            <button
              onClick={load}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"
              title="刷新"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => {
                clearAuthed();
                setAuthed(false);
              }}
              className="p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg"
              title="退出登录"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* 标签导航 */}
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                tab === id
                  ? "border-orange-500 text-orange-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        {!isConfigured && (
          <div className="mb-4 flex items-start gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>
              未配置 Supabase：请在 `.env` 填写 VITE_SUPABASE_URL 与
              VITE_SUPABASE_ANON_KEY 后重新构建。
            </span>
          </div>
        )}

        {tab === "dashboard" && <Dashboard orders={orders} />}
        {tab === "orders" && <Orders orders={orders} />}
        {tab === "reports" && <Reports orders={orders} settings={settings} />}
        {tab === "staff" && <StaffView />}
      </main>

      <footer className="text-center text-[11px] text-zinc-600 py-4">
        {STORE_NAME} · 老板管理端 · 独立部署
      </footer>
    </div>
  );
}
