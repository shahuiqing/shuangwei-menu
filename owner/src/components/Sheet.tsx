import { useEffect } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

/**
 * 统一弹窗：移动端底部抽屉 + 桌面居中卡片。
 * 自动锁定背景滚动。
 */
export function Sheet({
  open,
  title,
  subtitle,
  onClose,
  children,
  maxW = "max-w-md",
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  maxW?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-[fadeIn_.15s_ease]"
      onClick={onClose}
    >
      <div
        className={`bg-zinc-900 border border-white/10 rounded-t-[28px] sm:rounded-2xl w-full ${maxW} max-h-[92vh] overflow-y-auto shadow-2xl safe-bottom animate-[slideUp_.22s_cubic-bezier(.2,.8,.2,1)]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden mx-auto mt-2 h-1.5 w-10 rounded-full bg-zinc-700" />
        <div className="sticky top-0 bg-zinc-900/95 backdrop-blur border-b border-white/5 px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-white font-semibold">{title}</h3>
            {subtitle && (
              <p className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-full bg-white/5 text-zinc-400 flex items-center justify-center hover:text-white active:scale-90 transition-transform"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function SheetField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  className = "",
}: {
  label: string;
  value: string | number | undefined;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs text-zinc-400">{label}</span>
      <input
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 bg-zinc-950 border border-white/5 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
      />
    </label>
  );
}
