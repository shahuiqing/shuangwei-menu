/**
 * iOS 风格分段控件：内嵌滑块 + 横向滚动，移动端更接近原生 App。
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
  return (
    <div
      className={`inline-flex bg-zinc-900/80 rounded-xl p-1 border border-white/[0.06] overflow-x-auto max-w-full shrink-0 ${className}`}
    >
      {options.map(([id, label]) => {
        const on = value === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`shrink-0 ${pad} rounded-lg font-semibold transition-all ${
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
  );
}
