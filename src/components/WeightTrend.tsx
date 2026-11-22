import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DAY, kg2, md, signed, ymd } from '../lib/bodyfmt';
import type { Member } from '../lib/store';

const AXIS = { fontSize: 11, fill: '#9ca3af' };

const RANGES: [string, number][] = [['1 個月', 30], ['3 個月', 90], ['1 年', 365], ['全部', Infinity]];

export default function WeightTrend({ m }: { m: Member }) {
  const [range, setRange] = useState(1);
  const all = m.weights ?? [];
  const pts = useMemo(() => {
    const from = all.length ? all[all.length - 1][0] - RANGES[range][1] * DAY : 0;
    return all.filter(([t]) => t >= from).map(([t, v]) => ({ t, v }));
  }, [all, range]);
  if (all.length < 2) return null;
  const idealAll = m.height ? Math.round(22 * (m.height / 100) ** 2 * 100) / 100 : null;
  // 理想體重離資料太遠就不畫，不然會把折線壓扁
  const vs = pts.map((p) => p.v);
  const ideal = idealAll != null && vs.length && idealAll >= Math.min(...vs) - 3 && idealAll <= Math.max(...vs) + 3 ? idealAll : null;
  const change = pts.length >= 2 ? pts[pts.length - 1].v - pts[0].v : null;
  return (
    <section className="card">
      <h2 className="font-semibold">體重趨勢</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {RANGES.map(([n], i) => <button key={n} className={range === i ? 'chip-on' : 'chip'} onClick={() => setRange(i)}>{n}</button>)}
      </div>
      {change != null && <p className="mt-2 text-sm">這段時間 <b className={change > 0 ? 'text-orange-600' : change < 0 ? 'text-emerald-600' : ''}>{signed(change)}</b> 公斤</p>}
      <div className="mt-2">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={pts} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeOpacity={0.15} />
            <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tick={AXIS} tickFormatter={md} />
            <YAxis tick={AXIS} domain={['auto', 'auto']} width={44} />
            <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} labelFormatter={(t) => ymd(t as number)} formatter={(v: number) => [kg2(v) + ' 公斤', '體重']} />
            {ideal && <ReferenceLine y={ideal} stroke="#9ca3af" strokeDasharray="4 4" />}
            <Line type="monotone" dataKey="v" stroke="#0f766e" strokeWidth={2} dot={pts.length < 40} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {ideal && <p className="muted text-xs">虛線是理想體重 {kg2(ideal)} 公斤</p>}
    </section>
  );
}
