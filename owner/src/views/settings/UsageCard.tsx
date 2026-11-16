import { useEffect, useState } from "react";
import { HardDrive, AlertTriangle, Trash2, CheckCircle2 } from "lucide-react";
import { ChartCard, SkeletonRows } from "../../components/ui";
import { toast } from "../../components/Toast";
import { askConfirm } from "../../components/Confirm";
import { tableStats, prune, type TableStats } from "../../lib/aggregate";
import { isConfigured } from "../../lib/supabase";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-950 rounded-xl p-4">
      <div className="text-zinc-500 text-xs">{label}</div>
      <div className="text-white font-bold text-lg mt-1 tnum">{value}</div>
    </div>
  );
}

/** 数据库用量 + 危险的旧数据清理 */
export default function UsageCard() {
  const [stats, setStats] = useState<TableStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [ordersDays, setOrdersDays] = useState(90);
  const [txnsDays, setTxnsDays] = useState(180);
  const [pruning, setPruning] = useState(false);

  const loadStats = async () => {
    setLoadingStats(true);
    setStats(await tableStats());
    setLoadingStats(false);
  };

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runPrune = async () => {
    if (
      !(await askConfirm(
        `将删除 ${ordersDays} 天前的已结账/已取消订单，以及 ${txnsDays} 天前的库存流水。此操作不可恢复，确定继续？`,
        { danger: true },
      ))
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
  );
}
