import { useEffect, useState } from "react";
import { Archive, Save } from "lucide-react";
import { ChartCard } from "../../components/ui";
import { toast } from "../../components/Toast";
import { askConfirm } from "../../components/Confirm";
import {
  snapshotMenu,
  listMenuSnapshots,
  restoreMenuSnapshot,
  deleteMenuSnapshot,
  type MenuSnapshot,
} from "../../lib/menuSnapshot";
import { logAction } from "../../lib/auditLog";
import { fmtDateTime } from "../../lib/format";

/** 菜单快照与快速恢复 */
export default function SnapshotCard() {
  const [snaps, setSnaps] = useState<MenuSnapshot[]>([]);
  const [snapping, setSnapping] = useState(false);
  const [restoring, setRestoring] = useState(false);

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
      !(await askConfirm(
        `恢复菜单到「${s.name}」？\n（${fmtDateTime(s.created_at)} · ${s.item_count} 个菜品）\n当前菜单会被覆盖。`,
      ))
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
    if (!(await askConfirm(`删除快照「${s.name}」？`, { danger: true })))
      return;
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

  return (
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
  );
}
