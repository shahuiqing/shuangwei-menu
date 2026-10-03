import { useEffect, useState } from "react";
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
} from "lucide-react";
import { ChartCard, SkeletonRows } from "../components/ui";
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
import { isConfigured, STORE_NAME } from "../lib/supabase";
import { saveSettingsField } from "../lib/data";
import { tableStats, prune, type TableStats } from "../lib/aggregate";

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
