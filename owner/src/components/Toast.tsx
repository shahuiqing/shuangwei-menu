import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info";
interface ToastItem {
  id: number;
  type: ToastType;
  msg: string;
}

let pushFn: ((t: ToastType, m: string) => void) | null = null;

export const toast = {
  success: (m: string) => pushFn?.("success", m),
  error: (m: string) => pushFn?.("error", m),
  info: (m: string) => pushFn?.("info", m),
};

const THEME: Record<
  ToastType,
  { icon: typeof CheckCircle2; box: string; iconBox: string }
> = {
  success: {
    icon: CheckCircle2,
    box: "border-emerald-500/35 text-emerald-50",
    iconBox: "bg-emerald-500 text-white shadow-emerald-600/40",
  },
  error: {
    icon: XCircle,
    box: "border-rose-500/35 text-rose-50",
    iconBox: "bg-rose-500 text-white shadow-rose-600/40",
  },
  info: {
    icon: Info,
    box: "border-sky-500/35 text-sky-50",
    iconBox: "bg-sky-500 text-white shadow-sky-600/40",
  },
};

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    pushFn = (type, msg) => {
      const id = Date.now() + Math.random();
      setItems((p) => [...p.slice(-2), { id, type, msg }]);
      setTimeout(() => setItems((p) => p.filter((x) => x.id !== id)), 3000);
    };
    return () => {
      pushFn = null;
    };
  }, []);

  return (
    <div className="fixed z-[300] inset-x-0 top-0 flex flex-col items-center gap-2 px-4 pointer-events-none lg:items-end lg:right-4 lg:left-auto lg:px-0">
      <div className="h-[var(--sat,0px)] lg:hidden w-full" />
      <div className="flex flex-col gap-2 w-full max-w-sm lg:w-auto">
        {items.map((t) => {
          const th = THEME[t.type];
          const Icon = th.icon;
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-3 pl-2 pr-4 py-2 rounded-2xl bg-zinc-900/92 backdrop-blur-xl border shadow-[0_16px_40px_-16px_rgba(0,0,0,0.85)] ${th.box} animate-[toastIn_.3s_cubic-bezier(.2,.9,.25,1)]`}
            >
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-lg ${th.iconBox}`}
              >
                <Icon size={16} strokeWidth={2.6} />
              </span>
              <span className="text-sm font-medium leading-snug">{t.msg}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
