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
} from "lucide-react";
import { ChartCard, SkeletonRows } from "../components/ui";
import { toast } from "../components/Toast";
import {
  getLlmConfig,
  setLlmConfig,
  testLlm,
  type LlmConfig,
} from "../lib/llm";
import { syncNow, clearCloudAudit } from "../lib/cloudSync";
import {
  fetchBackfill,
  saveBackfill,
  deleteBackfill,
  type BackfillEntry,
} from "../lib/backfill";
import { setOwnerPasswordLocal, verifyOwnerPassword } from "../lib/auth";
import {
  notifyEnabled,
  notifyPermission,
  requestNotifyPermission,
  setNotifyEnabled,
  type NotifyPermission,
} from "../lib/notify";
import { useLateConfig } from "../lib/lateOrders";
import { getDailyQuota, setDailyQuota, todayQuotaKey } from "../lib/dailyQuota";
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
  const [showKey, setShowKey] = useState(false);
  const [testingLlm, setTestingLlm] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [backfills, setBackfills] = useState<BackfillEntry[]>([]);
  const [bfDay, setBfDay] = useState("");
  const [bfRevenue, setBfRevenue] = useState("");
  const [bfOrders, setBfOrders] = useState("");
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

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const saveBf = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bfDay)) return toast.error("请选择日期");
    const revenue = Number(bfRevenue);
    if (!(revenue >= 0) || bfRevenue.trim() === "")
      return toast.error("请填写营业额");
    const ok = await saveBackfill({
      day: bfDay,
      revenue,
      orders: Math.max(0, Math.floor(Number(bfOrders) || 0)),
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

  const saveLlm = () => {
    const next = setLlmConfig(llm);
    setLlm(next);
    logAction("保存 AI 服务配置", `${next.baseUrl} · ${next.model}`);
    setLogs(loadAuditLog());
    toast.success("AI 配置已保存（仅本机）");
  };

  const checkLlm = async () => {
    setLlmConfig(llm);
    setTestingLlm(true);
    const r = await testLlm();
    setTestingLlm(false);
    r.ok ? toast.success(r.msg) : toast.error(r.msg);
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
    if (!newPw.trim()) return toast.error("新密码不能为空");
    setOwnerPasswordLocal(newPw.trim());
    setCurPw("");
    setNewPw("");
    toast.success(
      "密码已修改（本机降级）；如需云端生效请用 /api/auth/set-owner-password",
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
      <ChartCard
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
        title="AI 服务（可选）"
        subtitle="OpenAI 兼容接口 · 未配置时 AI 助手用规则版"
        action={<Sparkles size={18} className="text-orange-500" />}
      >
        <label className="text-sm text-zinc-400">Base URL（到 /v1 为止）</label>
        <input
          value={llm.baseUrl}
          onChange={(e) => setLlm({ ...llm, baseUrl: e.target.value })}
          placeholder="https://api.deepseek.com/v1"
          className="w-full mt-1.5 bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
        />
        <label className="text-sm text-zinc-400 mt-3 block">API Key</label>
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            value={llm.apiKey}
            onChange={(e) => setLlm({ ...llm, apiKey: e.target.value })}
            placeholder="sk-…"
            className="w-full mt-1.5 bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 pr-11 text-white focus:outline-none focus:border-orange-500"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1"
          >
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <label className="text-sm text-zinc-400 mt-3 block">模型名</label>
        <input
          value={llm.model}
          onChange={(e) => setLlm({ ...llm, model: e.target.value })}
          placeholder="deepseek-chat"
          className="w-full mt-1.5 bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
        />
        <div className="flex gap-2 mt-3">
          <button
            onClick={saveLlm}
            disabled={testingLlm}
            className="flex-1 py-3 rounded-xl btn-brand text-white font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            保存配置
          </button>
          <button
            onClick={checkLlm}
            disabled={testingLlm}
            className="flex-1 py-3 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {testingLlm ? "测试中…" : "测试连接"}
          </button>
        </div>
        <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
          Key 只存本机浏览器，不上传、不随备份导出；请求由浏览器直连该接口。
        </p>
      </ChartCard>

      <ChartCard
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
        title="历史补录"
        subtitle="没记账的营业日补进报表 · 看板与趋势自动计入"
        action={<CalendarPlus size={18} className="text-orange-500" />}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
          只补「当天没记账」的日子，已有订单的天不要补（会重复计入）；成本类报表不含补录。
        </p>
      </ChartCard>

      <ChartCard
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
