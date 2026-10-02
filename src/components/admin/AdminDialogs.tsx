// AdminPanel 拆分：通用确认/输入弹窗（无业务逻辑，纯展示）

export interface ConfirmDialogState {
  isOpen: boolean;
  title?: string;
  stepBadge?: string;
  message: string;
  subDetail?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  isAlert?: boolean;
  confirmText?: string;
  cancelText?: string;
  confirmBtnClass?: string;
}

export interface PromptDialogState {
  isOpen: boolean;
  message: string;
  defaultValue: string;
  onConfirm: (value: string) => void;
}

export function ConfirmDialog({
  dialog,
  onClose,
}: {
  dialog: ConfirmDialogState | null;
  onClose: () => void;
}) {
  if (!dialog || !dialog.isOpen) return null;
  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ zIndex: 9999 }}
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden text-left">
        {dialog.stepBadge && (
          <div className="mb-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {dialog.stepBadge}
          </div>
        )}
        <h3 className="text-xl font-bold text-white mb-3 flex items-center justify-between">
          <span>
            {dialog.title ||
              (dialog.isAlert ? "提示 (Alert)" : "确认操作 (Confirm)")}
          </span>
        </h3>
        <p className="text-sm font-medium text-zinc-200 mb-3 whitespace-pre-wrap leading-relaxed">
          {dialog.message}
        </p>
        {dialog.subDetail && (
          <div className="text-xs text-zinc-400 mb-6 bg-zinc-950/80 p-3.5 rounded-xl border border-zinc-800/80 space-y-1.5 whitespace-pre-wrap leading-relaxed font-mono">
            {dialog.subDetail}
          </div>
        )}
        <div className="flex gap-3 justify-end whitespace-nowrap pt-2 border-t border-zinc-800/60">
          {!dialog.isAlert && (
            <button
              onClick={() => {
                if (dialog.onCancel) dialog.onCancel();
                onClose();
              }}
              className="px-4 py-2 text-sm font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors border border-zinc-700/50"
            >
              {dialog.cancelText || "取消 (Cancel)"}
            </button>
          )}
          <button
            onClick={dialog.onConfirm}
            className={
              dialog.confirmBtnClass ||
              `px-4 py-2 text-sm font-semibold text-white rounded-xl transition-colors shadow-lg ${
                dialog.isAlert
                  ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
                  : "bg-red-600 hover:bg-red-700 shadow-red-500/20"
              }`
            }
          >
            {dialog.confirmText || "确认 (Confirm)"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PromptDialog({
  dialog,
  value,
  onChange,
  onClose,
}: {
  dialog: PromptDialogState | null;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
}) {
  if (!dialog || !dialog.isOpen) return null;
  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-left">
        <h3 className="text-xl font-bold text-white mb-4">修改内容 (Edit)</h3>
        <p className="text-sm text-zinc-300 mb-4 whitespace-pre-wrap">
          {dialog.message}
        </p>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              dialog.onConfirm(value);
            } else if (e.key === "Escape") {
              onClose();
            }
          }}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white mb-6 focus:outline-none focus:border-orange-500 transition-colors"
          autoFocus
        />
        <div className="flex gap-3 justify-end whitespace-nowrap">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors border border-transparent"
          >
            取消 (Cancel)
          </button>
          <button
            onClick={() => dialog.onConfirm(value)}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-lg shadow-blue-500/20"
          >
            确认 (Confirm)
          </button>
        </div>
      </div>
    </div>
  );
}
