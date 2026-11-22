// 小折線圖，不用 recharts，這樣紀錄頁、家人頁不必載入圖表套件。
export default function Spark({ points, height = 56, dots = false }: { points: [number, number][]; height?: number; dots?: boolean }) {
  if (points.length < 2) return null;
  const W = 200;
  const ts = points.map((p) => p[0]);
  const vs = points.map((p) => p[1]);
  const t0 = Math.min(...ts), t1 = Math.max(...ts);
  let v0 = Math.min(...vs), v1 = Math.max(...vs);
  if (v1 - v0 < 1) { const mid = (v0 + v1) / 2; v0 = mid - 0.5; v1 = mid + 0.5; } // 變化很小時不要誇大
  const x = (t: number) => (t1 === t0 ? W / 2 : ((t - t0) / (t1 - t0)) * (W - 8) + 4);
  const y = (v: number) => height - 6 - ((v - v0) / (v1 - v0)) * (height - 12);
  const d = points.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1)).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="w-full text-brand dark:text-brand-light" style={{ height }} aria-hidden>
      <path d={d + ` L ${x(t1).toFixed(1)} ${height} L ${x(t0).toFixed(1)} ${height} Z`} className="fill-current opacity-10" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {dots && points.map((p, i) => <circle key={i} cx={x(p[0])} cy={y(p[1])} r="2.5" className="fill-current" />)}
    </svg>
  );
}
