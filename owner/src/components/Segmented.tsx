import { useLayoutEffect, useRef, useState } from "react";

/**
 * iOS 风格分段控件：内嵌滑块 + 横向滚动，移动端更接近原生 App。
 * 内容溢出时在右缘显示渐变提示（暗/浅主题均适配）。
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  className = "",
}: {
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const pad = size === "sm" ? "px-3 py-1.5 text-[13px]" : "px-3.5 py-2 text-sm";
  const trackRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const check = () => setOverflow(el.scrollWidth > el.clientWidth + 1);
    check();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [options]);

  return (
    <div className={`relative max-w-full shrink-0 ${className}`}>
      <div
        ref={trackRef}
        className="seg-track inline-flex bg-zinc-900/80 rounded-xl p-1 border border-white/[0.06] overflow-x-auto max-w-full"
      >
        {options.map(([id, label]) => {
          const on = value === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`shrink-0 ${pad} ${on ? "seg-on" : ""} rounded-lg font-semibold transition-all ${
                on
                  ? "bg-white/[0.1] text-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.6)] ring-1 ring-white/10"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {overflow && (
        <div className="seg-fade pointer-events-none absolute inset-y-1 right-0 w-7 rounded-r-xl" />
      )}
    </div>
  );
}
