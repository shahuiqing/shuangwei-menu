/** 采购价迷你走势（纯 SVG，不引图表库） */
export function Spark({
  points,
  className = "stroke-orange-400",
}: {
  points: number[];
  className?: string;
}) {
  if (points.length < 2) return null;
  const w = 72;
  const h = 22;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (w - 4) + 2;
    const y = h - 3 - ((p - min) / span) * (h - 6);
    return [x, y] as const;
  });
  const last = xy[xy.length - 1];
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden="true">
      <polyline
        points={xy.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      />
      <circle cx={last[0]} cy={last[1]} r={2} className={className} />
    </svg>
  );
}
