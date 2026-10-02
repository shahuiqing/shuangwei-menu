import { useEffect, useState, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import Login from "./views/Login";
import Dashboard from "./views/Dashboard";
import Orders from "./views/Orders";
import Reports from "./views/Reports";
import MenuAnalysis from "./views/MenuAnalysis";
import Procurement from "./views/Procurement";
import Inventory from "./views/Inventory";
import Recipe from "./views/Recipe";
import CostReport from "./views/CostReport";
import Consumption from "./views/Consumption";
import StaffView from "./views/Staff";
import Settings from "./views/Settings";
import { Layout, type OwnerTab } from "./components/Layout";
import { ToastHost } from "./components/Toast";
import { isAuthed, clearAuthed } from "./lib/auth";
import { isConfigured, STORE_NAME } from "./lib/supabase";
import { fetchSettings } from "./lib/data";
import { fetchRecentOrders } from "./lib/aggregate";

export default function App() {
  const [authed, setAuthed] = useState(() => isAuthed());
  const [tab, setTab] = useState<OwnerTab>("dashboard");
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");

  // 免费额度优化：只拉少量近况订单 + 设置；其余统计由各页 RPC 拉取
  const load = useCallback(async () => {
    if (!isConfigured) return;
    setLoading(true);
    const [o, s] = await Promise.all([fetchRecentOrders(30), fetchSettings()]);
    setRecentOrders(o);
    setSettings(s);
    setLoading(false);
    setLastUpdated(new Date().toLocaleTimeString("zh-CN"));
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  // 5 分钟兜底轮询；页面隐藏时暂停，减少请求与 egress
  useEffect(() => {
    if (!authed || !isConfigured) return;
    const tick = () => {
      if (document.hidden) return;
      load();
    };
    const t = setInterval(tick, 300000);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [authed, load]);

  if (!authed) {
    return (
      <>
        <Login onDone={() => setAuthed(true)} />
        <ToastHost />
      </>
    );
  }

  const storeName = settings?.restaurantName || STORE_NAME;

  return (
    <>
      <Layout
        tab={tab}
        setTab={setTab}
        storeName={storeName}
        loading={loading}
        lastUpdated={lastUpdated}
        onRefresh={load}
        onLogout={() => {
          clearAuthed();
          setAuthed(false);
        }}
        configured={isConfigured}
      >
        {!isConfigured && (
          <div className="mb-4 flex items-start gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>
              未配置 Supabase：请在 `.env` 填写 VITE_SUPABASE_URL 与
              VITE_SUPABASE_ANON_KEY 后重新构建。
            </span>
          </div>
        )}

        {tab === "dashboard" && (
          <Dashboard recentOrders={recentOrders} settings={settings} />
        )}
        {tab === "orders" && <Orders />}
        {tab === "reports" && <Reports settings={settings} />}
        {tab === "menu" && <MenuAnalysis />}
        {tab === "procurement" && <Procurement />}
        {tab === "inventory" && <Inventory />}
        {tab === "recipe" && <Recipe settings={settings} />}
        {tab === "cost" && <CostReport />}
        {tab === "consumption" && <Consumption />}
        {tab === "staff" && <StaffView />}
        {tab === "settings" && <Settings settings={settings} onSaved={load} />}
      </Layout>
      <ToastHost />
    </>
  );
}
