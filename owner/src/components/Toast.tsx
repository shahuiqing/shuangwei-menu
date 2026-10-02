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

const STYLE: Record<ToastType, string> = {
  success: "border-green-500/40 text-green-300",
  error: "border-red-500/40 text-red-300",
  info: "border-zinc-700 text-zinc-200",
};

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    pushFn = (type, msg) => {
      const id = Date.now() + Math.random();
      setItems((p) => [...p, { id, type, msg }]);
      setTimeout(() => setItems((p) => p.filter((x) => x.id !== id)), 3200);
    };
    return () => {
      pushFn = null;
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-[300] space-y-2 pointer-events-none">
      {items.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl bg-zinc-900/95 backdrop-blur border shadow-xl text-sm font-medium animate-[fadeIn_.2s_ease] ${STYLE[t.type]}`}
        >
          {t.type === "success" && <CheckCircle2 size={18} />}
          {t.type === "error" && <XCircle size={18} />}
          {t.type === "info" && <Info size={18} />}
          {t.msg}
        </div>
      ))}
    </div>
  );
}
