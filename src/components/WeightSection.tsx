import { Link } from 'react-router-dom';
import QuickWeight from './QuickWeight';
import WeightTrend from './WeightTrend';
import { kg2, md, signed } from '../lib/bodyfmt';
import type { Member } from '../lib/store';

/** 圖表頁最上面：記今天的體重、看最近的變化和趨勢圖；圍度、BMI 估算在完整的「體重」頁 */
export default function WeightSection({ m }: { m: Member }) {
  const ws = m.weights ?? [];
  const last = ws[ws.length - 1], prev = ws[ws.length - 2];
  const d = last && prev ? Math.round((last[1] - prev[1]) * 100) / 100 : null;
  return (
    <>
      <section className="card">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-semibold">體重</h2>
          <Link to="/body" className="text-sm text-brand dark:text-brand-light">圍度、BMI 估算 ›</Link>
        </div>
        {last && (
          <p className="mt-1">
            <span className="text-3xl font-bold tabular-nums">{kg2(last[1])}</span>
            <span className="ml-1 text-sm text-gray-500">公斤・{md(last[0])}</span>
            {d != null && d !== 0 && <span className={`ml-2 text-sm font-semibold ${d > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>{signed(d)}</span>}
          </p>
        )}
        <div className="mt-2"><QuickWeight m={m} /></div>
        {ws.length < 2 && <p className="muted mt-2 text-xs">記兩天以上，這裡就會出現趨勢圖。</p>}
      </section>
      <WeightTrend m={m} />
    </>
  );
}
