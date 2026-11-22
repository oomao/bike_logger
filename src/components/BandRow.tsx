import { level, type Band, type Level } from '../lib/bia';

const LEVEL: Record<Level, [string, string]> = {
  low: ['偏低', 'text-sky-600 dark:text-sky-400'],
  ok: ['標準', 'text-emerald-600 dark:text-emerald-400'],
  high: ['偏高', 'text-orange-600 dark:text-orange-400'],
  veryHigh: ['過高', 'text-red-600 dark:text-red-400'],
};

/** 有標準範圍的項目：一條「偏低｜標準｜偏高」的橫條，標出現在的位置 */
export default function BandRow({ label, value, unit, band }: { label: string; value: number; unit: string; band: Band }) {
  const lv = level(value, band);
  const top = band.hi2 ? band.hi2 + (band.hi2 - band.lo) * 0.4 : band.hi + (band.hi - band.lo) * 0.8;
  const bottom = Math.max(0, band.lo - (band.hi - band.lo) * 0.8);
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - bottom) / (top - bottom)) * 100));
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between">
        <span>{label}</span>
        <span>
          <b className="text-xl">{value}</b>
          <span className="text-sm text-gray-500">{unit}</span>
          <span className={`ml-2 text-sm font-semibold ${LEVEL[lv][1]}`}>{LEVEL[lv][0]}</span>
        </span>
      </div>
      <div className="relative mt-1 h-3 overflow-hidden rounded-full bg-sky-200 dark:bg-sky-900">
        <div className="absolute inset-y-0 bg-emerald-300 dark:bg-emerald-800" style={{ left: pct(band.lo) + '%', width: pct(band.hi) - pct(band.lo) + '%' }} />
        <div className="absolute inset-y-0 right-0 bg-orange-300 dark:bg-orange-900" style={{ left: pct(band.hi) + '%' }} />
        {band.hi2 && <div className="absolute inset-y-0 right-0 bg-red-300 dark:bg-red-900" style={{ left: pct(band.hi2) + '%' }} />}
        <div className="absolute -top-0.5 h-4 w-1.5 -translate-x-1/2 rounded bg-gray-900 dark:bg-white" style={{ left: pct(value) + '%' }} />
      </div>
      <div className="mt-0.5 text-right text-[11px] text-gray-500 dark:text-gray-400">
        標準 {band.lo}～{band.hi}{band.unit}（{band.src}）
      </div>
    </div>
  );
}
