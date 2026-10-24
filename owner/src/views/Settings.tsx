import { useEffect, useState, type ChangeEvent } from "react";
import {
  Store,
  KeyRound,
  CheckCircle2,
  HardDrive,
  Trash2,
  Eye,
  EyeOff,
  AlertTriangle,
  Bell,
  Gauge,
  Download,
  Upload,
  History,
  Sparkles,
  CalendarPlus,
  Percent,
  Scale,
  Plus,
  Archive,
  Save,
} from "lucide-react";
import { ChartCard, SkeletonRows } from "../components/ui";
import { toast } from "../components/Toast";
import {
  getLlmConfig,
  setLlmConfig,
  testLlmEndpoints,
  newLlmEndpointId,
  isLlmEndpointComplete,
  LLM_MAX_ENDPOINTS,
  type LlmConfig,
  type LlmEndpoint,
  type LlmProbe,
} from "../lib/llm";
import { syncNow, clearCloudAudit } from "../lib/cloudSync";
import {
  fetchBackfill,
  saveBackfill,
  deleteBackfill,
  type BackfillEntry,
} from "../lib/backfill";
import {
  changeOwnerPassword,
  verifyOwnerPassword,
  MIN_PASSWORD_LEN,
} from "../lib/auth";
import {
  notifyEnabled,
  notifyPermission,
  requestNotifyPermission,
  setNotifyEnabled,
  type NotifyPermission,
} from "../lib/notify";
import { useLateConfig } from "../lib/lateOrders";
import { getDailyQuota, setDailyQuota, todayQuotaKey } from "../lib/dailyQuota";
import { businessDayKey } from "../lib/businessDay";
import {
  exportLocalData,
  importLocalData,
  downloadText,
  localDataStats,
  DB_VERSION,
} from "../lib/localdb";
import { isConfigured, STORE_NAME } from "../lib/supabase";
import { saveSettingsField } from "../lib/data";
import { tableStats, prune, type TableStats } from "../lib/aggregate";
import {
  BIZ_LABEL,
  benchmarks,
  getBizType,
  pctText,
  setBizType,
  type BizType,
} from "../lib/industry";
import { loadAuditLog, clearAuditLog, logAction } from "../lib/auditLog";
import { fmtDateTime, fmtMoney } from "../lib/format";
import { getCommissionRate, setCommissionRate } from "../lib/platform";
import {
  snapshotMenu,
  listMenuSnapshots,
  restoreMenuSnapshot,
  deleteMenuSnapshot,
  type MenuSnapshot,
} from "../lib/menuSnapshot";

const SETTINGS_SECTIONS: { id: string; label: string }[] = [
  { id: "set-store", label: "店铺" },
  { id: "set-account", label: "密码" },
  { id: "set-ai", label: "AI" },
  { id: "set-notify", label: "通知" },
  { id: "set-quota", label: "定额" },
  { id: "set-biz", label: "行业" },
  { id: "set-platform", label: "平台" },
  { id: "set-snapshot", label: "快照" },
  { id: "set-backfill", label: "补录" },
  { id: "set-export", label: "备份" },
  { id: "set-logs", label: "日志" },
  { id: "set-usage", label: "用量" },
  { id: "set-formula", label: "口径" },
];

const AI_INPUT_CLS =
  "w-full mt-1 bg-zinc-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500";

export default function Settings({
  settings,
  onSaved,
}: {
  settings: any;
  onSaved: () => void;
}) {
  const [storeName, setStoreName] = useState(
    settings?.restaurantName || STORE_NAME,
  );
  const [savingStore, setSavingStore] = useState(false);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [llm, setLlm] = useState<LlmConfig>(() => getLlmConfig());
  const [showKey, setShowKey] = useState<Set<string>>(() => new Set());
  const [probes, setProbes] = useState<Record<string, LlmProbe>>({});
  const [testingLlm, setTestingLlm] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [backfills, setBackfills] = useState<BackfillEntry[]>([]);
  const [bfDay, setBfDay] = useState("");
  const [bfRevenue, setBfRevenue] = useState("");
  const [bfOrders, setBfOrders] = useState("");
  const [bfCogs, setBfCogs] = useState("");
  const [bfNote, setBfNote] = useState("");
  useEffect(() => {
    fetchBackfill().then(setBackfills);
  }, []);

  const [stats, setStats] = useState<TableStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [ordersDays, setOrdersDays] = useState(90);
  const [txnsDays, setTxnsDays] = useState(180);
  const [pruning, setPruning] = useState(false);

  const [notifyOn, setNotifyOn] = useState(() => notifyEnabled());
  const [perm, setPerm] = useState<NotifyPermission>(() => notifyPermission());

  const [lateCfg, setLateCfg] = useLateConfig();
  const [pendingDraft, setPendingDraft] = useState(String(lateCfg.pendingMin));
  const [cookingDraft, setCookingDraft] = useState(String(lateCfg.cookingMin));

  const [quotaDraft, setQuotaDraft] = useState(() => {
    const q = getDailyQuota(todayQuotaKey());
    return q === null ? "" : String(q);
  });

  const [biz, setBiz] = useState<BizType>(() => getBizType());

  const [commission, setCommission] = useState(() => getCommissionRate());

  const [logs, setLogs] = useState(() => loadAuditLog());

  const [snaps, setSnaps] = useState<MenuSnapshot[]>([]);
  const [snapping, setSnapping] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // 浏览器原生存储用量（含 IndexedDB 图片），供判断剩余空间
  const [originStorage, setOriginStorage] = useState("");
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const est = await (
          navigator as Navigator & {
            storage?: { estimate?: () => Promise<StorageEstimate> };
          }
        ).storage?.estimate?.();
        if (!alive || !est?.quota) return;
        setOriginStorage(
          `${((est.usage || 0) / 1048576).toFixed(1)} / ${(
            est.quota / 1048576
          ).toFixed(0)} MB`,
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const doSync = async () => {
    setSyncing(true);
    const r = await syncNow();
    setSyncing(false);
    setLogs(loadAuditLog());
    if (r.pushed) toast.success("已与云端同步");
    else toast.error("同步失败：请确认已执行 cloudsync SQL");
  };

  const todayStr = () => businessDayKey(Date.now());

  const saveBf = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bfDay)) return toast.error("请选择日期");
    if (bfDay > todayStr()) return toast.error("不能补录未来营业日");
    const revenue = Number(bfRevenue);
    if (!(revenue >= 0) || bfRevenue.trim() === "")
      return toast.error("请填写营业额");
    const ok = await saveBackfill({
      day: bfDay,
      revenue,
      orders: Math.max(0, Math.floor(Number(bfOrders) || 0)),
      cogs: Math.max(0, Number(bfCogs) || 0),
      note: bfNote.trim(),
    });
    if (!ok) return toast.error("保存失败：请确认已执行 backfill SQL");
    setBackfills(await fetchBackfill());
    logAction("历史补录", `${bfDay} ${fmtMoney(revenue)}`);
    setLogs(loadAuditLog());
    toast.success("已补录，看板与趋势自动计入");
    setBfDay("");
    setBfRevenue("");
    setBfOrders("");
    setBfCogs("");
    setBfNote("");
    onSaved();
  };

  const deleteBf = async (day: string) => {
    if (!confirm(`删除 ${day} 的补录？`)) return;
    const ok = await deleteBackfill(day);
    if (!ok) return toast.error("删除失败：请确认已执行 backfill SQL");
    setBackfills(await fetchBackfill());
    logAction("删除补录", day);
    setLogs(loadAuditLog());
    toast.success("已删除");
    onSaved();
  };

  const patchEndpoint = (id: string, patch: Partial<LlmEndpoint>) => {
    setLlm((prev) => ({
      endpoints: prev.endpoints.map((endpoint) =>
        endpoint.id === id ? { ...endpoint, ...patch } : endpoint,
      ),
    }));
    if ("baseUrl" in patch || "apiKey" in patch || "model" in patch) {
      setProbes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const addEndpoint = () => {
    setLlm((prev) => {
      if (prev.endpoints.length >= LLM_MAX_ENDPOINTS) return prev;
      return {
        endpoints: [
          ...prev.endpoints,
          {
            id: newLlmEndpointId(),
            name: `接口 ${prev.endpoints.length + 1}`,
            baseUrl: "",
            apiKey: "",
            model: "",
            enabled: true,
          },
        ],
      };
    });
  };

  const removeEndpoint = (id: string) => {
    setLlm((prev) => ({
      endpoints: prev.endpoints.filter((endpoint) => endpoint.id !== id),
    }));
    setProbes((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const toggleReveal = (id: string) => {
    setShowKey((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const prepareEndpoints = (): LlmEndpoint[] | null => {
    const partial = llm.endpoints.find((endpoint) => {
      if (!endpoint.enabled) return false;
      const filled = [endpoint.baseUrl, endpoint.apiKey, endpoint.model].filter(
        (value) => value.trim(),
      ).length;
      return filled > 0 && filled < 3;
    });
    if (partial) {
      toast.error(
        `「${partial.name || "未命名接口"}」的 Base URL、API Key、模型需填写完整`,
      );
      return null;
    }
    return llm.endpoints.slice(0, LLM_MAX_ENDPOINTS).map((endpoint, index) => ({
      ...endpoint,
      name: endpoint.name.trim() || `接口 ${index + 1}`,
      baseUrl: endpoint.baseUrl.trim().replace(/\/+$/, ""),
      apiKey: endpoint.apiKey.trim(),
      model: endpoint.model.trim(),
    }));
  };

  const saveLlm = () => {
    const endpoints = prepareEndpoints();
    if (!endpoints) return;
    const next = setLlmConfig({ endpoints });
    setLlm(next);
    setProbes({});
    logAction(
      "保存 AI 调度配置",
      endpoints.length ? `${endpoints.length} 个接口` : "已清空",
    );
    setLogs(loadAuditLog());
    toast.success(
      endpoints.length
        ? `已保存 ${endpoints.length} 个接口（仅本机）`
        : "已清空 AI 配置",
    );
  };

  const checkLlm = async () => {
    const endpoints = prepareEndpoints();
    if (!endpoints) return;
    if (!endpoints.some(isLlmEndpointComplete)) {
      return toast.error("请先填写至少一个完整接口");
    }
    setLlmConfig({ endpoints });
    setLlm(getLlmConfig());
    setTestingLlm(true);
    setProbes({});
    try {
      const report = await testLlmEndpoints();
      setProbes(
        Object.fromEntries(report.results.map((result) => [result.id, result])),
      );
      report.ok ? toast.success(report.msg) : toast.error(report.msg);
    } finally {
      setTestingLlm(false);
    }
  };

  const saveQuota = () => {
    const v = setDailyQuota(todayQuotaKey(), Number(quotaDraft));
    setQuotaDraft(v === null ? "" : String(v));
    toast.success(v === null ? "已清除今日定额" : `今日定额已设为 ${v} 元`);
  };

  const saveCommission = () => {
    const r = setCommissionRate(commission);
    setCommission(r);
    toast.success(`平台抽成率已保存（${Math.round(r * 100)}%）`);
  };

  const loadSnaps = async () => setSnaps(await listMenuSnapshots());

  const doSnapshot = async () => {
    setSnapping(true);
    const id = await snapshotMenu(
      "手动备份 " + new Date().toLocaleString("zh-CN"),
    );
    setSnapping(false);
    if (id) {
      toast.success("已备份菜单到云端（快照）");
      loadSnaps();
      logAction("菜单快照", "手动备份");
    } else {
      toast.error("备份失败：请确认已执行 supabase_owner_all.sql");
    }
  };

  const doRestore = async (s: MenuSnapshot) => {
    if (
      !confirm(
        `恢复菜单到「${s.name}」？\n（${fmtDateTime(s.created_at)} · ${s.item_count} 个菜品）\n当前菜单会被覆盖。`,
      )
    )
      return;
    setRestoring(true);
    // 恢复前先把当前菜单也存一份，可反悔
    await snapshotMenu("恢复前自动备份 " + new Date().toLocaleString("zh-CN"));
    const ok = await restoreMenuSnapshot(s.id);
    setRestoring(false);
    if (ok) {
      toast.success("菜单已恢复，请刷新顾客端菜单");
      logAction("菜单快照", `恢复 ${s.name}`);
      loadSnaps();
    } else {
      toast.error("恢复失败（快照不存在或未执行 SQL）");
    }
  };

  const doDeleteSnap = async (s: MenuSnapshot) => {
    if (!confirm(`删除快照「${s.name}」？`)) return;
    const ok = await deleteMenuSnapshot(s.id);
    if (ok) {
      toast.success("已删除");
      loadSnaps();
    } else toast.error("删除失败");
  };

  useEffect(() => {
    loadSnaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportBackup = () => {
    downloadText(
      `shuangwei-backup-${new Date().toISOString().slice(0, 10)}.json`,
      exportLocalData(),
    );
    logAction("导出本地数据");
    setLogs(loadAuditLog());
    toast.success("已导出本地数据备份");
  };

  const importBackup = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const n = importLocalData(String(reader.result || ""));
        e.target.value = "";
        logAction("导入本地数据", `${n} 项`);
        setLogs(loadAuditLog());
        toast.success(`已导入 ${n} 项本地数据`);
        onSaved();
      } catch {
        toast.error("导入失败：文件格式不对");
      }
    };
    reader.readAsText(f);
  };

  const saveLate = () => {
    const next = setLateCfg({
      pendingMin: Number(pendingDraft),
      cookingMin: Number(cookingDraft),
    });
    setPendingDraft(String(next.pendingMin));
    setCookingDraft(String(next.cookingMin));
    toast.success(
      `漏单阈值已保存（待接单 ${next.pendingMin} 分 / 制作 ${next.cookingMin} 分）`,
    );
  };

  const toggleNotify = async () => {
    if (notifyOn) {
      setNotifyEnabled(false);
      setNotifyOn(false);
      toast.success("已关闭新订单通知");
      return;
    }
    if (perm === "unsupported") return toast.error("当前浏览器不支持系统通知");
    let p: NotifyPermission = perm;
    if (p !== "granted") p = await requestNotifyPermission();
    setPerm(p);
    if (p !== "granted")
      return toast.error(
        p === "denied"
          ? "通知已被拒绝：请在浏览器地址栏的站点设置里改为「允许」"
          : "未授予通知权限",
      );
    setNotifyEnabled(true);
    setNotifyOn(true);
    toast.success("已开启：有新订单时弹系统通知");
  };

  const loadStats = async () => {
    setLoadingStats(true);
    setStats(await tableStats());
    setLoadingStats(false);
  };

  useEffect(() => {
    loadStats();
  }, []);

  const saveStore = async () => {
    if (!storeName.trim()) return toast.error("店铺名称不能为空");
    setSavingStore(true);
    const ok = await saveSettingsField({ restaurantName: storeName.trim() });
    setSavingStore(false);
    if (ok) {
      toast.success("店铺名称已保存");
      onSaved();
    } else {
      toast.error("保存失败（检查数据库权限）");
    }
  };

  const changePw = async () => {
    if (!(await verifyOwnerPassword(curPw))) return toast.error("当前密码错误");
    if (newPw.trim().length < MIN_PASSWORD_LEN)
      return toast.error(`新密码至少 ${MIN_PASSWORD_LEN} 位`);
    const r = await changeOwnerPassword(curPw, newPw.trim());
    if (!r.ok) return toast.error(`新密码至少 ${MIN_PASSWORD_LEN} 位`);
    setCurPw("");
    setNewPw("");
    toast.success(
      r.cloud
        ? "密码已修改（本机 + 云端已同步）"
        : "密码已修改（本机生效；云端未配置或不可达）",
    );
  };

  const runPrune = async () => {
    if (
      !confirm(
        `将删除 ${ordersDays} 天前的已结账/已取消订单，以及 ${txnsDays} 天前的库存流水。此操作不可恢复，确定继续？`,
      )
    )
      return;
    setPruning(true);
    const r = await prune(ordersDays, txnsDays);
    setPruning(false);
    if (!r) return toast.error("清理失败（检查函数权限）");
    toast.success(
      `已清理订单 ${r.removed_orders} 条、流水 ${r.removed_txns} 条`,
    );
    loadStats();
  };

  const usedMB = stats ? stats.total_bytes / 1024 / 1024 : 0;
  const pct = Math.min(100, (usedMB / 500) * 100);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="lg:col-span-2 flex items-center gap-2 overflow-x-auto pb-0.5 -mt-1">
        {SETTINGS_SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() =>
              document
                .getElementById(s.id)
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white hover:border-orange-500/40 transition-colors"
          >
            {s.label}
          </button>
        ))}
      </div>

      <ChartCard
        id="set-store"
        title="店铺信息"
        subtitle="同步到顾客端与云端"
        action={<Store size={18} className="text-orange-500" />}
      >
        <label className="text-sm text-zinc-400">店铺名称</label>
        <input
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          className="w-full mt-1.5 bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
        />
        <button
          onClick={saveStore}
          disabled={savingStore}
          className="mt-3 w-full py-3 rounded-xl btn-brand text-white font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {savingStore ? "保存中…" : "保存店铺名称"}
        </button>
      </ChartCard>

      <ChartCard
        id="set-account"
        title="老板端登录密码"
        subtitle="仅存本机，不依赖数据库"
        action={<KeyRound size={18} className="text-orange-500" />}
      >
        <label className="text-sm text-zinc-400">当前密码</label>
        <div className="relative mb-3">
          <input
            type={showPw ? "text" : "password"}
            value={curPw}
            onChange={(e) => setCurPw(e.target.value)}
            className="w-full mt-1.5 bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 pr-11 text-white focus:outline-none focus:border-orange-500"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1"
          >
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <label className="text-sm text-zinc-400">新密码</label>
        <input
          type={showPw ? "text" : "password"}
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          className="w-full mt-1.5 bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
        />
        <button
          onClick={changePw}
          className="mt-3 w-full py-3 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white font-semibold active:scale-[0.98] transition-transform"
        >
          修改密码
        </button>
      </ChartCard>

      <ChartCard
        id="set-ai"
        title="AI 接口调度（可选）"
        subtitle="多个 OpenAI 兼容接口 · 失败自动切换 · 票据识别需 vision 模型"
        action={<Sparkles size={18} className="text-orange-500" />}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="max-w-md text-[11px] leading-relaxed text-zinc-500">
            优先尝试新接口，之后选择失败少、延迟低的接口；请求失败立即切换下一个，异常接口短暂冷却。
          </p>
          <button
            type="button"
            onClick={addEndpoint}
            disabled={llm.endpoints.length >= LLM_MAX_ENDPOINTS}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={13} />
            添加接口
          </button>
        </div>

        {llm.endpoints.length ? (
          <div className="mt-3 space-y-3">
            {llm.endpoints.map((endpoint, index) => {
              const probe = probes[endpoint.id];
              const statusClass = !endpoint.enabled
                ? "bg-zinc-600"
                : probe
                  ? probe.ok
                    ? "bg-green-400"
                    : "bg-red-400"
                  : "bg-zinc-500";
              return (
                <div
                  key={endpoint.id}
                  className="rounded-xl border border-white/5 bg-zinc-950/70 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${statusClass}`}
                    />
                    <input
                      value={endpoint.name}
                      onChange={(e) =>
                        patchEndpoint(endpoint.id, { name: e.target.value })
                      }
                      maxLength={40}
                      placeholder={`接口 ${index + 1}`}
                      aria-label="接口名称"
                      className="min-w-0 flex-1 !border-0 !bg-transparent text-sm font-semibold text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
                    />
                    <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-zinc-400">
                      <input
                        type="checkbox"
                        checked={endpoint.enabled}
                        onChange={(e) =>
                          patchEndpoint(endpoint.id, {
                            enabled: e.target.checked,
                          })
                        }
                        className="h-3.5 w-3.5 accent-orange-500"
                      />
                      启用
                    </label>
                    <button
                      type="button"
                      onClick={() => removeEndpoint(endpoint.id)}
                      aria-label="移除接口"
                      className="shrink-0 rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <label className="mt-2 block text-[11px] text-zinc-500">
                    Base URL（到 /v1 为止）
                    <input
                      value={endpoint.baseUrl}
                      onChange={(e) =>
                        patchEndpoint(endpoint.id, {
                          baseUrl: e.target.value,
                        })
                      }
                      placeholder="https://api.deepseek.com/v1"
                      className={AI_INPUT_CLS}
                    />
                  </label>

                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="block text-[11px] text-zinc-500">
                      API Key
                      <div className="relative">
                        <input
                          type={showKey.has(endpoint.id) ? "text" : "password"}
                          value={endpoint.apiKey}
                          onChange={(e) =>
                            patchEndpoint(endpoint.id, {
                              apiKey: e.target.value,
                            })
                          }
                          placeholder="sk-…"
                          className={`${AI_INPUT_CLS} pr-10`}
                        />
                        <button
                          type="button"
                          onClick={() => toggleReveal(endpoint.id)}
                          aria-label="显示或隐藏 Key"
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300"
                        >
                          {showKey.has(endpoint.id) ? (
                            <EyeOff size={15} />
                          ) : (
                            <Eye size={15} />
                          )}
                        </button>
                      </div>
                    </label>
                    <label className="block text-[11px] text-zinc-500">
                      模型名
                      <input
                        value={endpoint.model}
                        onChange={(e) =>
                          patchEndpoint(endpoint.id, {
                            model: e.target.value,
                          })
                        }
                        placeholder="deepseek-chat"
                        className={AI_INPUT_CLS}
                      />
                    </label>
                  </div>

                  {probe && (
                    <div
                      className={`mt-2 text-[11px] ${
                        probe.ok ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {probe.msg}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-white/10 bg-zinc-950/60 px-4 py-6 text-center">
            <p className="text-sm text-zinc-300">还没有 AI 接口</p>
            <p className="mt-1 text-[11px] text-zinc-500">
              添加多个接口后，识别和问答会自动选择可用线路。
            </p>
            <button
              type="button"
              onClick={addEndpoint}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-700"
            >
              <Plus size={14} />
              添加第一个接口
            </button>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <button
            onClick={saveLlm}
            disabled={testingLlm}
            className="flex-1 py-2.5 rounded-xl btn-brand text-white text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            保存配置
          </button>
          <button
            onClick={checkLlm}
            disabled={testingLlm || !llm.endpoints.length}
            className="flex-1 py-2.5 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {testingLlm ? "测试中…" : "测试全部"}
          </button>
        </div>
        <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
          Key 只存本机浏览器，不上传、不随备份导出；请求由浏览器直连各接口。
          票据识别需要模型支持图片输入（vision），且接口需允许浏览器跨域访问。
          Gemini 兼容地址为
          https://generativelanguage.googleapis.com/v1beta/openai 。
        </p>
      </ChartCard>

      <ChartCard
        id="set-notify"
        title="消息通知"
        subtitle="系统通知 · 仅在页面或安装的应用打开时生效"
        action={<Bell size={18} className="text-orange-500" />}
      >
        <div className="flex items-center justify-between gap-3 bg-zinc-950 rounded-xl px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm text-zinc-200">新订单提醒</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">
              {perm === "unsupported"
                ? "当前浏览器不支持系统通知"
                : perm === "denied"
                  ? "权限被拒绝"
                  : perm === "default"
                    ? "未授权，点右侧开启"
                    : notifyOn
                      ? "已开启"
                      : "已关闭"}
            </div>
          </div>
          <button
            onClick={toggleNotify}
            className={`shrink-0 px-4 py-2 rounded-lg text-sm font-semibold active:scale-95 transition-transform ${
              notifyOn
                ? "bg-zinc-700 hover:bg-zinc-600 text-white"
                : "btn-brand text-white"
            }`}
          >
            {notifyOn ? "关闭" : "开启"}
          </button>
        </div>

        <div className="mt-4">
          <div className="text-sm text-zinc-200 mb-1.5">漏单提醒阈值</div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-zinc-400">
              待接单超时(分钟)
              <input
                type="number"
                min={1}
                max={240}
                value={pendingDraft}
                onChange={(e) => setPendingDraft(e.target.value)}
                className="block mt-1 w-24 bg-zinc-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-xs text-zinc-400">
              制作中超时(分钟)
              <input
                type="number"
                min={1}
                max={240}
                value={cookingDraft}
                onChange={(e) => setCookingDraft(e.target.value)}
                className="block mt-1 w-24 bg-zinc-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white"
              />
            </label>
            <button
              onClick={saveLate}
              className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold active:scale-95 transition-transform"
            >
              保存阈值
            </button>
          </div>
          <p className="text-[11px] text-zinc-600 mt-1.5">
            超过阈值的订单会在「今日待办」置顶标红、订单页标红，并在开启通知时弹出系统提醒。
          </p>
        </div>

        <p className="text-[11px] text-zinc-600 mt-2">
          零后端：不联网也能用。顾客下单后只要本应用开着（含安装到主屏幕的
          PWA），就会弹出系统通知；关闭页面不会推送。
        </p>
      </ChartCard>

      <ChartCard
        id="set-quota"
        title="每日定额"
        subtitle="今日食材成本上限 · 超出部分计为损耗"
        action={<Gauge size={18} className="text-orange-500" />}
      >
        <label className="text-sm text-zinc-400">
          今日食材成本定额（元，按营业日，凌晨 3 点分界）
        </label>
        <div className="flex items-center gap-2 mt-1.5">
          <input
            type="number"
            min={0}
            value={quotaDraft}
            onChange={(e) => setQuotaDraft(e.target.value)}
            placeholder="未设置"
            className="flex-1 bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
          />
          <button
            onClick={saveQuota}
            className="px-4 py-3 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold active:scale-95 transition-transform"
          >
            保存
          </button>
        </div>
        <p className="text-[11px] text-zinc-600 mt-1.5">
          实际食材成本超过定额的差额，会在盘点/损耗分析中标记为「定额超出」。
        </p>
      </ChartCard>

      <ChartCard
        id="set-biz"
        title="行业基准"
        subtitle="按业态给出的参考区间 · 看板与损耗页据此对比"
        action={<Gauge size={18} className="text-orange-500" />}
      >
        <label className="text-sm text-zinc-400">餐饮业态</label>
        <select
          value={biz}
          onChange={(e) => {
            const v = e.target.value as BizType;
            setBizType(v);
            setBiz(v);
            toast.success(`已切换「${BIZ_LABEL[v]}」基准`);
          }}
          className="mt-1.5 w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
        >
          {(Object.keys(BIZ_LABEL) as BizType[]).map((t) => (
            <option key={t} value={t}>
              {BIZ_LABEL[t]}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="bg-zinc-950 rounded-xl px-2 py-2.5 text-center">
            <div className="text-[11px] text-zinc-500">食材成本率</div>
            <div className="text-sm font-bold text-white mt-0.5">
              {pctText(benchmarks(biz).foodCost)}
            </div>
          </div>
          <div className="bg-zinc-950 rounded-xl px-2 py-2.5 text-center">
            <div className="text-[11px] text-zinc-500">损耗率上限</div>
            <div className="text-sm font-bold text-white mt-0.5">
              ≤{benchmarks(biz).wasteMax}%
            </div>
          </div>
          <div className="bg-zinc-950 rounded-xl px-2 py-2.5 text-center">
            <div className="text-[11px] text-zinc-500">人工占比</div>
            <div className="text-sm font-bold text-white mt-0.5">
              {pctText(benchmarks(biz).labor)}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-zinc-600 mt-2">
          行业经验值，仅供对比参考；存在本机，换设备需重新选择。
        </p>
      </ChartCard>

      <ChartCard
        id="set-platform"
        title="平台订单口径"
        subtitle="美团/饿了么等外部订单有抽成，营收不能直接当利润"
        action={<Percent size={18} className="text-orange-500" />}
      >
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={Math.round(commission * 100)}
            onChange={(e) =>
              setCommission(
                Math.min(100, Math.max(0, Number(e.target.value) || 0)) / 100,
              )
            }
            className="w-24 bg-zinc-950 border border-white/5 rounded-lg px-3 py-2.5 text-sm text-white text-right focus:outline-none focus:border-orange-500"
          />
          <span className="text-sm text-zinc-400">% 平台抽成</span>
          <button
            onClick={saveCommission}
            className="ml-auto px-4 py-2.5 rounded-lg btn-brand text-white text-sm font-semibold"
          >
            保存
          </button>
        </div>
        <p className="text-[11px] text-zinc-600 mt-2 leading-relaxed">
          平台净营收 = 营收 ×（1 −
          抽成率）；导入的「外卖」订单据此估算净利，避免与堂食混算。
        </p>
      </ChartCard>

      <ChartCard
        id="set-backfill"
        title="历史补录"
        subtitle="没记账的营业日补进报表 · 看板与趋势自动计入"
        action={<CalendarPlus size={18} className="text-orange-500" />}
      >
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <input
            type="date"
            value={bfDay}
            max={todayStr()}
            onChange={(e) => setBfDay(e.target.value)}
            className="bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
          />
          <input
            type="number"
            min={0}
            placeholder="营业额"
            value={bfRevenue}
            onChange={(e) => setBfRevenue(e.target.value)}
            className="bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
          />
          <input
            type="number"
            min={0}
            placeholder="订单数"
            value={bfOrders}
            onChange={(e) => setBfOrders(e.target.value)}
            className="bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
          />
          <input
            type="number"
            min={0}
            placeholder="食材成本（选填）"
            value={bfCogs}
            onChange={(e) => setBfCogs(e.target.value)}
            className="bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
          />
          <input
            placeholder="备注（选填）"
            value={bfNote}
            onChange={(e) => setBfNote(e.target.value)}
            className="bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
          />
        </div>
        <button
          onClick={saveBf}
          className="mt-3 w-full py-3 rounded-xl btn-brand text-white font-semibold active:scale-[0.98] transition-transform"
        >
          补录这一天（同日覆盖）
        </button>
        {backfills.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {backfills
              .slice(-6)
              .reverse()
              .map((b) => (
                <div
                  key={b.day}
                  className="flex items-center justify-between bg-zinc-950 rounded-lg px-3 py-2 text-sm"
                >
                  <span className="text-zinc-300">
                    {b.day}
                    <span className="text-orange-400 font-semibold ml-2">
                      {fmtMoney(b.revenue)}
                    </span>
                    <span className="text-zinc-500 ml-2">{b.orders} 单</span>
                    {(b.cogs || 0) > 0 && (
                      <span className="text-red-400/80 ml-2">
                        成本 {fmtMoney(b.cogs || 0)}
                      </span>
                    )}
                    {b.note && (
                      <span className="text-zinc-500 ml-2 text-xs">
                        {b.note}
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => deleteBf(b.day)}
                    className="text-xs text-zinc-500 hover:text-red-400 shrink-0"
                  >
                    删除
                  </button>
                </div>
              ))}
          </div>
        )}
        <p className="text-[11px] text-zinc-600 mt-2 leading-relaxed">
          只补「当天没记账」的日子，已有订单的天不要补（会重复计入）；填写成本后，成本类报表会与营收对齐。
        </p>
      </ChartCard>

      <ChartCard
        id="set-snapshot"
        title="菜单快照与快速恢复"
        subtitle="把当前菜单备份到云端数据库，出问题一键恢复（换设备也不丢）"
        action={<Archive size={18} className="text-emerald-500" />}
      >
        <button
          onClick={doSnapshot}
          disabled={snapping}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          <Save size={16} /> {snapping ? "备份中…" : "立即备份当前菜单"}
        </button>
        <p className="text-[11px] text-zinc-600 mt-2">
          建议每次改完菜单就点一次；最多保留最近 30
          份，恢复前会自动再存一份当前菜单以便反悔。
        </p>

        {snaps.length === 0 ? (
          <p className="text-xs text-zinc-500 mt-3 text-center py-2">
            还没有快照。点上方按钮建立第一份。
          </p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {snaps.slice(0, 12).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 bg-zinc-950 rounded-lg px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="text-zinc-200 truncate">{s.name}</div>
                  <div className="text-[10px] text-zinc-500">
                    {fmtDateTime(s.created_at)} · {s.item_count} 个菜品
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => doRestore(s)}
                    disabled={restoring}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 disabled:opacity-50"
                  >
                    恢复
                  </button>
                  <button
                    onClick={() => doDeleteSnap(s)}
                    className="px-2.5 py-1.5 text-xs rounded-lg text-red-400 bg-red-500/10 hover:bg-red-500/20"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ChartCard>

      <ChartCard
        id="set-export"
        title="数据导出"
        subtitle="备份本机暂存数据（订单标记/任务/定额/换算等）"
        action={<Download size={18} className="text-orange-500" />}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={exportBackup}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl btn-brand text-white text-sm font-semibold active:scale-[0.98] transition-transform"
          >
            <Download size={16} /> 导出本地数据
          </button>
          <label className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold cursor-pointer active:scale-[0.98] transition-transform">
            <Upload size={16} /> 导入备份
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={importBackup}
            />
          </label>
        </div>
        <p className="text-[11px] text-zinc-600 mt-2">
          云端数据在 Supabase
          自动保存；这里只备份「本机暂存」的部分（换机/清缓存后可用导入还原）。
        </p>
        {(() => {
          const s = localDataStats();
          return (
            <p className="text-[11px] text-zinc-500 mt-1">
              本机暂存 {s.count} 项 ·{" "}
              {s.bytes < 1024
                ? `${s.bytes} B`
                : `${(s.bytes / 1024).toFixed(1)} KB`}
              · 数据格式 v{DB_VERSION}
              {originStorage ? ` · 浏览器存储 ${originStorage}` : ""}
            </p>
          );
        })()}
      </ChartCard>

      <ChartCard
        id="set-logs"
        title="操作日志"
        subtitle="关键操作（上限 500 条）· 自动同步云端"
        action={<History size={18} className="text-orange-500" />}
      >
        {logs.length === 0 ? (
          <p className="text-xs text-zinc-500">还没有记录</p>
        ) : (
          <div className="space-y-1.5">
            {logs.slice(0, 20).map((e, i) => (
              <div
                key={`${e.at}-${i}`}
                className="flex items-start justify-between gap-3 bg-zinc-950 rounded-lg px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="text-orange-400 font-medium">
                    {e.action}
                  </span>
                  {e.detail && (
                    <span className="text-zinc-300 ml-2">{e.detail}</span>
                  )}
                </div>
                <span className="text-zinc-500 text-xs shrink-0">
                  {fmtDateTime(e.at)}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-3">
          <span className="text-[11px] text-zinc-600">
            云端同步 · 显示最近 20 条
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={doSync}
              disabled={syncing}
              className="text-xs text-zinc-500 hover:text-orange-400 disabled:opacity-50"
            >
              {syncing ? "同步中…" : "立即同步"}
            </button>
            {logs.length > 0 && (
              <button
                onClick={() => {
                  if (confirm("清空操作日志（本机与云端）？")) {
                    clearAuditLog();
                    void clearCloudAudit();
                    setLogs([]);
                  }
                }}
                className="text-xs text-zinc-500 hover:text-red-400"
              >
                清空日志
              </button>
            )}
          </div>
        </div>
      </ChartCard>

      <ChartCard
        id="set-usage"
        title="数据库用量"
        subtitle="Supabase 免费层 500MB · Egress 5GB/月"
        className="lg:col-span-2"
        action={<HardDrive size={18} className="text-orange-500" />}
      >
        {loadingStats ? (
          <SkeletonRows rows={2} />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="订单" value={String(stats?.orders ?? 0)} />
              <Stat label="库存流水" value={String(stats?.txns ?? 0)} />
              <Stat
                label="原料/配方"
                value={`${stats?.inventory ?? 0}/${stats?.boms ?? 0}`}
              />
              <Stat label="占用空间" value={`${usedMB.toFixed(1)} MB`} />
            </div>

            <div className="mt-4">
              <div className="flex justify-between text-[11px] text-zinc-500 mb-1">
                <span>数据库占用（估算）</span>
                <span>{usedMB.toFixed(1)} / 500 MB</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-green-500"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-300 mb-1">
                <AlertTriangle size={16} className="text-red-400" /> 危险操作
              </div>
              <p className="text-[11px] text-red-400/70 mb-3">
                手动清理旧数据以释放配额，删除后不可恢复。
              </p>
              <div className="flex items-center gap-2 text-sm text-zinc-300 mb-3">
                <Trash2 size={16} className="text-red-400" /> 手动清理
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs text-zinc-400">
                  订单保留(天)
                  <input
                    type="number"
                    value={ordersDays}
                    onChange={(e) => setOrdersDays(Number(e.target.value))}
                    className="block mt-1 w-24 bg-zinc-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-zinc-400">
                  流水保留(天)
                  <input
                    type="number"
                    value={txnsDays}
                    onChange={(e) => setTxnsDays(Number(e.target.value))}
                    className="block mt-1 w-24 bg-zinc-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </label>
                <button
                  onClick={runPrune}
                  disabled={pruning}
                  className="px-4 py-2 rounded-lg bg-red-600/90 hover:bg-red-500 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {pruning ? "清理中…" : "执行清理"}
                </button>
              </div>
              <p className="text-[11px] text-zinc-600 mt-2">
                仅删除「已结账/已取消」的旧订单与旧库存流水；进行中订单不受影响。
              </p>
            </div>

            <div className="flex items-center gap-2 mt-4 text-xs text-zinc-500">
              <CheckCircle2 size={14} className="text-green-500" />
              {isConfigured
                ? "已连接 Supabase；统计走服务端聚合，订单列表服务端分页，减少 egress。"
                : "未配置 Supabase。"}
            </div>
          </>
        )}
      </ChartCard>

      <ChartCard
        id="set-formula"
        title="运行原理 / 计算口径"
        subtitle="每个数字是怎么算出来的 · 便于理解与对账"
        action={<Scale size={18} className="text-orange-500" />}
      >
        <div className="space-y-2.5 text-[13px] text-zinc-300 leading-relaxed">
          <p>
            <b className="text-zinc-100">营收</b>
            ：结账金额（finalTotal 优先，回退 total）。
          </p>
          <p>
            <b className="text-zinc-100">销售成本 COGS</b>
            ：菜品标准配方用量 × 原料单价（标准值，非后厨实际用量）。
          </p>
          <p>
            <b className="text-zinc-100">毛利</b> = 营收 −
            COGS（标准口径，偏乐观）。
          </p>
          <p>
            <b className="text-zinc-100">净利</b> = 营收 − COGS − 损耗 −
            固定成本（固定成本按月金额摊到每日）。
          </p>
          <p>
            <b className="text-zinc-100">固定成本</b>
            ：房租/人工/水电按月录入，按当月自然天数摊到每日。
          </p>
          <p>
            <b className="text-zinc-100">损耗</b>
            ：仅报损登记（显性）；后厨未报的隐性损耗需「成本对账」（真实 COGS −
            标准 COGS）。
          </p>
          <p>
            <b className="text-zinc-100">平台订单</b>
            ：按来源标记，净营收 = 营收 ×（1−抽成率）。
          </p>
          <p>
            <b className="text-zinc-100">临期预警</b>
            ：最近采购日 + 保质期天数 = 到期日，剩余 ≤3 天提示临期。
          </p>
          <p>
            <b className="text-zinc-100">销量预警</b>
            ：近 3 天 vs 前 7 天日均销量降幅 ≥50%。
          </p>
        </div>
      </ChartCard>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-950 rounded-xl p-4">
      <div className="text-zinc-500 text-xs">{label}</div>
      <div className="text-lg font-bold mt-1 text-white">{value}</div>
    </div>
  );
}
