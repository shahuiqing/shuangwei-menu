import { useEffect, useState, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import Login from "./views/Login";
import Dashboard from "./views/Dashboard";
import Orders from "./views/Orders";
import Reports from "./views/Reports";
import MenuAnalysis from "./views/MenuAnalysis";
import StaffView from "./views/Staff";
import Settings from "./views/Settings";
import { Layout, type OwnerTab } from "./components/Layout";
import { ToastHost } from "./components/Toast";
import { isAuthed, clearAuthed } from "./lib/auth";
import { isConfigured, STORE_NAME } from "./lib/supabase";
import { fetchOrders, fetchSettings } from "./lib/data";

export default function App() {
  const [authed, setAuthed] = useState(() => isAuthed());
  const [tab, setTab] = useState<OwnerTab>("dashboard");
  const [orders, setOrders] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");

  const load = useCallback(async () => {
    if (!isConfigured) return;
    setLoading(true);
    const [o, s] = await Promise.all([fetchOrders(), fetchSettings()]);
    setOrders(o);
    setSettings(s);
    setLoading(false);
    setLastUpdated(new Date().toLocaleTimeString("zh-CN"));
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  useEffect(() => {
    if (!authed || !isConfigured) return;
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
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
          <Dashboard orders={orders} settings={settings} />
        )}
        {tab === "orders" && <Orders orders={orders} />}
        {tab === "reports" && <Reports orders={orders} settings={settings} />}
        {tab === "menu" && <MenuAnalysis orders={orders} />}
        {tab === "staff" && <StaffView />}
        {tab === "settings" && (
          <Settings
            settings={settings}
            orderCount={orders.length}
            onSaved={load}
          />
        )}
      </Layout>
      <ToastHost />
    </>
  );
}
