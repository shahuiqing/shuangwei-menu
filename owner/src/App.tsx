import {
  useEffect,
  useRef,
  useState,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { AlertTriangle } from "lucide-react";
import Login from "./views/Login";
import { SkeletonRows } from "./components/ui";

// 路由级代码分割：只预载登录页，其余视图按切换懒加载（首包 -约一半）
const Dashboard = lazy(() => import("./views/Dashboard"));
const Orders = lazy(() => import("./views/Orders"));
const Reports = lazy(() => import("./views/Reports"));
const Dishes = lazy(() => import("./views/Dishes"));
const MenuAnalysis = lazy(() => import("./views/MenuAnalysis"));
const Procurement = lazy(() => import("./views/Procurement"));
const Inventory = lazy(() => import("./views/Inventory"));
const Waste = lazy(() => import("./views/Waste"));
const Recipe = lazy(() => import("./views/Recipe"));
const CostReport = lazy(() => import("./views/CostReport"));
const Consumption = lazy(() => import("./views/Consumption"));
const StaffView = lazy(() => import("./views/Staff"));
const Settings = lazy(() => import("./views/Settings"));
const Tasks = lazy(() => import("./views/Tasks"));
const Assistant = lazy(() => import("./views/Assistant"));
import { Layout, type OwnerTab } from "./components/Layout";
import { ToastHost } from "./components/Toast";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { isAuthed, clearAuthed } from "./lib/auth";
import { isConfigured, STORE_NAME } from "./lib/supabase";
import { fetchSettings } from "./lib/data";
import { initCloudSync } from "./lib/cloudSync";
import {
  fetchRecentOrders,
  onRpcSchemaError,
  getRpcSchemaError,
  type RpcSchemaError,
} from "./lib/aggregate";
import { subscribeOwner, type OrderChange } from "./lib/realtime";
import {
  notifyEnabled,
  orderId,
  orderNotice,
  shouldNotifyOrder,
  showNotify,
} from "./lib/notify";
import { lateNotice, lateOrders, loadLateConfig } from "./lib/lateOrders";

const RECENT_LIMIT = 30;
/** 已通知订单 id 的上限（防无限增长） */
const SEEN_LIMIT = 300;

function rememberIds(seen: Set<string>, ids: string[]) {
  for (const id of ids) if (id) seen.add(id);
  for (const id of seen) {
    if (seen.size <= SEEN_LIMIT) break;
    seen.delete(id);
  }
}

/** 把实时变更合并进近况列表 */
function mergeRecent(prev: any[], c: OrderChange): any[] {
  const idOf = (o: any) => String(o?.id || o?._id || "");
  if (c.eventType === "DELETE") {
    const del = idOf(c.old);
    return prev.filter((o) => idOf(o) !== del);
  }
  const rec = c.new;
  if (!rec) return prev;
  const recId = idOf(rec);
  const next = prev.filter((o) => idOf(o) !== recId);
  next.unshift(rec);
  return next.slice(0, RECENT_LIMIT);
}

export default function App() {
  const [authed, setAuthed] = useState(() => isAuthed());
  const [tab, setTab] = useState<OwnerTab>("dashboard");
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [version, setVersion] = useState(0);
  const [live, setLive] = useState(false);
  const bumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 已通知/已加载过的订单 id（避免刷新补发旧单） */
  const seenOrders = useRef<Set<string>>(new Set());
  /** 已提醒过的超时订单（id:status，每单每状态只提醒一次） */
  const seenLate = useRef<Set<string>>(new Set());
  const storeRef = useRef(STORE_NAME);
  storeRef.current = settings?.restaurantName || STORE_NAME;

  // 免费额度优化：只拉少量近况订单 + 设置；其余统计由各页 RPC 拉取
  const load = useCallback(async () => {
    if (!isConfigured) return;
    setLoading(true);
    const [o, s] = await Promise.all([
      fetchRecentOrders(RECENT_LIMIT),
      fetchSettings(),
    ]);
    setRecentOrders(o);
    rememberIds(seenOrders.current, o.map(orderId));
    setSettings(s);
    setLoading(false);
    setLastUpdated(new Date().toLocaleTimeString("zh-CN"));
  }, []);

  useEffect(() => {
    if (authed) {
      load();
      initCloudSync();
    }
  }, [authed, load]);

  // PWA：断网期间看的是缓存，恢复联网立即重新拉取并通知各页刷新
  useEffect(() => {
    if (!authed || !isConfigured) return;
    const on = () => {
      load();
      setVersion((v) => v + 1);
    };
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, [authed, load, isConfigured]);

  // 漏单提醒：每分钟检查超时订单，去重后弹系统通知（需手动开启通知）
  useEffect(() => {
    if (!authed || !isConfigured) return;
    const check = () => {
      for (const l of lateOrders(recentOrders, loadLateConfig())) {
        const key = `${l.id}:${l.status}`;
        if (seenLate.current.has(key)) continue;
        seenLate.current.add(key);
        if (seenLate.current.size > 200) {
          const oldest = seenLate.current.values().next().value;
          if (oldest) seenLate.current.delete(oldest);
        }
        if (notifyEnabled()) {
          const n = lateNotice(l);
          void showNotify(n.title, n.body, { tag: `late-${key}` });
        }
      }
    };
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, [authed, isConfigured, recentOrders]);

  // 数据库未初始化（聚合函数/列缺失）时常驻提示
  const [schemaErr, setSchemaErr] = useState<RpcSchemaError | null>(() =>
    getRpcSchemaError(),
  );
  useEffect(() => onRpcSchemaError(setSchemaErr), []);

  // 实时订阅：订单/设置变更即时反映，合并 20s 后统一刷新聚合
  useEffect(() => {
    if (!authed || !isConfigured) return;
    const scheduleBump = () => {
      if (bumpTimer.current) clearTimeout(bumpTimer.current);
      bumpTimer.current = setTimeout(() => setVersion((v) => v + 1), 20000);
    };
    const unsub = subscribeOwner({
      onOrder: (c) => {
        setRecentOrders((prev) => mergeRecent(prev, c));
        scheduleBump();
        // 新订单 → 系统通知（仅待接单、仅首次；无论开关与否都记为已处理）
        const rec = c.new as any;
        if (rec && shouldNotifyOrder(rec, seenOrders.current)) {
          rememberIds(seenOrders.current, [orderId(rec)]);
          if (notifyEnabled()) {
            const n = orderNotice(rec, storeRef.current);
            void showNotify(n.title, n.body, { tag: `order-${orderId(rec)}` });
          }
        }
      },
      onSettings: () => {
        fetchSettings().then(setSettings);
        scheduleBump();
      },
      onStatus: (s) => setLive(s === "SUBSCRIBED"),
    });
    return () => {
      if (bumpTimer.current) clearTimeout(bumpTimer.current);
      unsub();
    };
  }, [authed]);

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
        live={live}
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

        {isConfigured && schemaErr && (
          <div className="mb-4 flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="font-semibold text-red-200">
                数据库缺少聚合函数，报表/看板无法取数
              </div>
              <div className="mt-1">
                请在目标 Supabase 项目的 SQL Editor 依次执行：
                <code className="mx-1 px-1.5 py-0.5 rounded bg-black/30">
                  supabase_owner_quota.sql
                </code>
                （及其它需要的脚本）后刷新页面。
              </div>
              <div className="mt-1 text-[11px] text-red-400/80 break-all">
                调用失败：{schemaErr.fn} · {schemaErr.code || "ERR"} ·{" "}
                {schemaErr.message}
              </div>
            </div>
          </div>
        )}

        <div key={tab} className="page-enter">
          <ErrorBoundary>
            <Suspense
              fallback={
                <div className="p-2">
                  <SkeletonRows rows={4} />
                </div>
              }
            >
              {tab === "dashboard" && (
                <Dashboard
                  recentOrders={recentOrders}
                  settings={settings}
                  version={version}
                  onTab={setTab}
                />
              )}
              {tab === "orders" && <Orders version={version} />}
              {tab === "reports" && (
                <Reports settings={settings} version={version} />
              )}
              {tab === "dishes" && <Dishes version={version} />}
              {tab === "menu" && <MenuAnalysis version={version} />}
              {tab === "procurement" && <Procurement version={version} />}
              {tab === "inventory" && <Inventory version={version} />}
              {tab === "waste" && <Waste version={version} />}
              {tab === "recipe" && (
                <Recipe settings={settings} version={version} />
              )}
              {tab === "cost" && <CostReport version={version} />}
              {tab === "consumption" && <Consumption version={version} />}
              {tab === "staff" && <StaffView />}
              {tab === "settings" && (
                <Settings settings={settings} onSaved={load} />
              )}
              {tab === "tasks" && (
                <Tasks recentOrders={recentOrders} version={version} />
              )}
              {tab === "assistant" && (
                <Assistant
                  recentOrders={recentOrders}
                  settings={settings}
                  version={version}
                />
              )}
            </Suspense>
          </ErrorBoundary>
        </div>
      </Layout>
      <ToastHost />
    </>
  );
}
