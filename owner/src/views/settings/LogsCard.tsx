import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { ChartCard } from "../../components/ui";
import { toast } from "../../components/Toast";
import { askConfirm } from "../../components/Confirm";
import { loadAuditLog, clearAuditLog } from "../../lib/auditLog";
import { syncNow, clearCloudAudit } from "../../lib/cloudSync";
import { dbSubscribe } from "../../lib/localdb";
import { fmtDateTime } from "../../lib/format";

const AUDIT_KEY = "owner:audit:log";

/** 操作日志：任何卡片 logAction 后实时刷新（本机事件订阅） */
export default function LogsCard() {
  const [logs, setLogs] = useState(() => loadAuditLog());
  const [syncing, setSyncing] = useState(false);

  useEffect(
    () =>
      dbSubscribe((c) => {
        if (c.key === AUDIT_KEY) setLogs(loadAuditLog());
      }),
    [],
  );

  const doSync = async () => {
    setSyncing(true);
    const r = await syncNow();
    setSyncing(false);
    setLogs(loadAuditLog());
    if (r.pushed) toast.success("已与云端同步");
    else toast.error("同步失败：请确认已执行 cloudsync SQL");
  };

  return (
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
                <span className="text-orange-400 font-medium">{e.action}</span>
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
              onClick={async () => {
                if (
                  await askConfirm("清空操作日志（本机与云端）？", {
                    danger: true,
                  })
                ) {
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
  );
}
