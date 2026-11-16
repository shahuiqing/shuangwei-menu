import { useEffect, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { ChartCard } from "../../components/ui";
import { toast } from "../../components/Toast";
import { askConfirm } from "../../components/Confirm";
import {
  fetchBackfill,
  saveBackfill,
  deleteBackfill,
  type BackfillEntry,
} from "../../lib/backfill";
import { businessDayKey } from "../../lib/businessDay";
import { logAction } from "../../lib/auditLog";
import { fmtMoney } from "../../lib/format";

/** 历史补录：把没记账的营业日补进报表 */
export default function BackfillCard({ onSaved }: { onSaved: () => void }) {
  const [backfills, setBackfills] = useState<BackfillEntry[]>([]);
  const [bfDay, setBfDay] = useState("");
  const [bfRevenue, setBfRevenue] = useState("");
  const [bfOrders, setBfOrders] = useState("");
  const [bfCogs, setBfCogs] = useState("");
  const [bfNote, setBfNote] = useState("");

  useEffect(() => {
    fetchBackfill().then(setBackfills);
  }, []);

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
    logAction("历史补录", `${bfDay} ${fmtMoney(revenue)}`);
    toast.success("已补录，看板与趋势自动计入");
    setBfDay("");
    setBfRevenue("");
    setBfOrders("");
    setBfCogs("");
    setBfNote("");
    onSaved();
  };

  const deleteBf = async (day: string) => {
    if (!(await askConfirm(`删除 ${day} 的补录？`, { danger: true }))) return;
    const ok = await deleteBackfill(day);
    if (!ok) return toast.error("删除失败：请确认已执行 backfill SQL");
    setBackfills(await fetchBackfill());
    logAction("删除补录", day);
    toast.success("已删除");
    onSaved();
  };

  return (
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
                    <span className="text-zinc-500 ml-2 text-xs">{b.note}</span>
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
  );
}
