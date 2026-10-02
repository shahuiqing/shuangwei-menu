import {
  X,
  Copy,
  Check,
  DownloadCloud,
  FileSpreadsheet,
  CheckCircle,
} from "lucide-react";

export function ExportModal({
  isOpen,
  onClose,
  exportedJsonStr,
  copiedSuccess,
  onExportJson,
  onCopyJson,
  onExportCsv,
}: {
  isOpen: boolean;
  onClose: () => void;
  exportedJsonStr: string;
  copiedSuccess: boolean;
  onExportJson: () => void;
  onCopyJson: () => void;
  onExportCsv: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      style={{ zIndex: 9999 }}
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <CheckCircle className="text-green-500" size={24} />
            <h3 className="text-lg font-bold text-white">
              菜单导出成功 (Export Success)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-xs sm:text-sm text-zinc-300 mb-4 leading-relaxed">
          系统已尝试触发文件下载。如果您的浏览器或设备拦截了自动下载，可以直接使用以下按钮再次下载、复制
          JSON 备份，或导出 Excel/CSV 菜品列表。
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
          <button
            onClick={onExportJson}
            className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 active:scale-95 text-white font-medium text-sm py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-orange-600/20"
          >
            <DownloadCloud size={18} />
            <span>再次下载 JSON 备份</span>
          </button>

          <button
            onClick={onCopyJson}
            className={`flex items-center justify-center gap-2 border active:scale-95 font-medium text-sm py-2.5 px-4 rounded-xl transition-all ${
              copiedSuccess
                ? "bg-green-600/20 border-green-500 text-green-400"
                : "bg-zinc-800 border-zinc-700 hover:border-zinc-500 text-zinc-200"
            }`}
          >
            {copiedSuccess ? <Check size={18} /> : <Copy size={18} />}
            <span>
              {copiedSuccess ? "已成功复制 JSON!" : "复制 JSON 到剪贴板"}
            </span>
          </button>

          <button
            onClick={onExportCsv}
            className="col-span-1 sm:col-span-2 flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white font-medium text-sm py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-emerald-700/20"
          >
            <FileSpreadsheet size={18} />
            <span>导出 Excel / CSV 菜品清单表格</span>
          </button>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span>备份数据 JSON 预览 (Data Preview):</span>
            <span>{(exportedJsonStr.length / 1024).toFixed(1)} KB</span>
          </div>
          <textarea
            readOnly
            value={exportedJsonStr}
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-400 font-mono focus:outline-none focus:border-orange-500/50 resize-none overflow-y-auto"
          />
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors"
          >
            关闭 (Close)
          </button>
        </div>
      </div>
    </div>
  );
}
