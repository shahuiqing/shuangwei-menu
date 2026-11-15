import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * 统一确认弹窗（替代原生 confirm）：
 *   if (!(await askConfirm("删除该员工？", { danger: true }))) return;
 * ConfirmHost 需在应用根节点挂载一次。
 */

export interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface Pending extends ConfirmOptions {
  message: string;
  resolve: (v: boolean) => void;
}

let pending: Pending | null = null;
const listeners = new Set<(p: Pending | null) => void>();

export function askConfirm(
  message: string,
  opts: ConfirmOptions = {},
): Promise<boolean> {
  // 已有未决弹窗时，先按取消结束，避免 Promise 悬挂
  if (pending) pending.resolve(false);
  return new Promise<boolean>((resolve) => {
    pending = { message, ...opts, resolve };
    listeners.forEach((f) => f(pending));
  });
}

export function ConfirmHost() {
  const [cur, setCur] = useState<Pending | null>(null);

  useEffect(() => {
    listeners.add(setCur);
    return () => {
      listeners.delete(setCur);
    };
  }, []);

  if (!cur) return null;

  const close = (v: boolean) => {
    const p = cur;
    pending = null;
    setCur(null);
    p.resolve(v);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
      onClick={() => close(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-zinc-900 border border-white/10 rounded-2xl p-5 w-full max-w-sm space-y-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 font-bold text-white">
          <AlertTriangle
            size={18}
            className={cur.danger ? "text-rose-400" : "text-orange-500"}
          />
          {cur.title || (cur.danger ? "确认操作" : "请确认")}
        </div>
        <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
          {cur.message}
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={() => close(false)}
            className="px-4 py-2 text-sm text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-xl"
          >
            {cur.cancelText || "取消"}
          </button>
          <button
            onClick={() => close(true)}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-xl ${
              cur.danger
                ? "bg-rose-600 hover:bg-rose-500"
                : "bg-orange-600 hover:bg-orange-500"
            }`}
          >
            {cur.confirmText || "确认"}
          </button>
        </div>
      </div>
    </div>
  );
}
