import { Archive, Loader2, Trash2 } from "lucide-react";

export function ArchiveCleanupCard({
  archiveRetentionDays,
  setArchiveRetentionDays,
  onArchiveCleanup,
  isCleaningArchive,
  archiveCleanMsg,
}: {
  archiveRetentionDays: number;
  setArchiveRetentionDays: (days: number) => void;
  onArchiveCleanup: () => void;
  isCleaningArchive: boolean;
  archiveCleanMsg: string | null;
}) {
  return (
    <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
      <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
        <Archive size={20} className="text-orange-500" /> 历史订单自动归档清理
        (Auto Archive)
      </h3>
      <p className="text-xs text-zinc-400 mb-4">
        自动删除超过设定天数的<strong>已完成订单</strong>，控制 Supabase
        免费层数据库存储用量。可随时手动执行。
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          保留最近
          <select
            value={archiveRetentionDays}
            onChange={(e) => setArchiveRetentionDays(Number(e.target.value))}
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500"
          >
            <option value={7}>7 天</option>
            <option value={14}>14 天</option>
            <option value={30}>30 天</option>
            <option value={90}>90 天</option>
            <option value={180}>180 天</option>
          </select>
          的已完成订单
        </label>
        <button
          onClick={onArchiveCleanup}
          disabled={isCleaningArchive}
          className="flex items-center gap-1.5 text-xs bg-orange-600 hover:bg-orange-500 text-white font-bold px-4 py-2 rounded-lg transition-all shadow-md shadow-orange-600/20 disabled:opacity-50"
        >
          {isCleaningArchive ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              清理中...
            </>
          ) : (
            <>
              <Trash2 size={14} />
              立即清理
            </>
          )}
        </button>
      </div>
      {archiveCleanMsg && (
        <p className="text-xs text-emerald-400 mt-3">{archiveCleanMsg}</p>
      )}
    </div>
  );
}
