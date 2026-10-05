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
  LayoutGrid,
  LogOut,
} from "lucide-react";
import { ChartCard, SkeletonRows } from "../components/ui";
import {
  NAV,
  NAV_GROUPS,
  InstallButton,
  type OwnerTab,
} from "../components/Layout";
import { toast } from "../components/Toast";
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
import { fmtDateTime } from "../lib/format";

export default function Settings({
  settings,
  onSaved,
  onGo,
  onLogout,
}: {
  settings: any;
  onSaved: () => void;
  onGo: (t: OwnerTab) => void;
  onLogout: () => void;
}) {
  const [storeName, setStoreName] = useState(
    settings?.restaurantName || STORE_NAME,
  );
  const [savingStore, setSavingStore] = useState(false);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(false);

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

  const saveQuota = () => {
    const v = setDailyQuota(todayQuotaKey(), Number(quotaDraft));
    setQuotaDraft(v === null ? "" : String(v));
    toast.success(v === null ? "已清除今日定额" : `今日定额已设为 ${v} 元`);
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
      {/* 全部功能：所有页面的统一入口（底部导航去掉「更多」后收拢到这里） */}
      <ChartCard
        title="全部功能"
        subtitle="所有页面统一入口 · 首页也有直达"
        action={<LayoutGrid size={18} className="text-orange-500" />}
      >
        <div className="space-y-3">
          {NAV_GROUPS.map((g) => (
            <div key={g.title}>
              <div className="text-[11px] font-semibold tracking-[0.08em] text-zinc-500 mb-1.5">
                {g.title}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {g.items.map((id) => {
                  const item = NAV.find((n) => n.id === id)!;
                  const Icon = item.icon;
                  const on = id === "settings";
                  return (
                    <button
                      key={id}
                      onClick={() => onGo(id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[13px] font-medium transition-colors ${
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <InstallButton />
            <button
              onClick={onLogout}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-red-500/30 text-sm font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/15 transition-colors"
            >
              <LogOut size={15} /> 退出登录
            </button>
          </div>
        </div>
      </ChartCard>

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
        subtitle="本机记录最近的关键操作（上限 500 条）"
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
            仅存本机 · 显示最近 20 条
          </span>
          {logs.length > 0 && (
            <button
              onClick={() => {
                if (confirm("清空操作日志？")) {
                  clearAuditLog();
                  setLogs([]);
                }
              }}
              className="text-xs text-zinc-500 hover:text-red-400"
            >
              清空日志
            </button>
          )}
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
