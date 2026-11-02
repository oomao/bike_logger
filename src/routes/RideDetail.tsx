import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { deleteRide, memberName, useDb } from '../lib/store';
import { BEST_DURATIONS, durLabel, histogram, hrCoverage, kj, newRecords, rideBests, series } from '../lib/analytics';
import { download, fmtDate, fmtDur } from '../lib/format';
import { tcxName, toTcx } from '../lib/export';

const AXIS = { fontSize: 10, fill: '#9ca3af' };
const TIP = { contentStyle: { borderRadius: 12, fontSize: 12 } };
const MAX_POINTS = 400;

/** 圖表點數太多手機會卡，依時間分段取平均；整段都沒有值就保持空白（心率斷開不補線） */
function downsample(s: ReturnType<typeof series>) {
  const n = s.power.length;
  const step = Math.max(1, Math.ceil(n / MAX_POINTS));
  const avg = (arr: (number | null)[], i: number) => {
    let sum = 0, c = 0;
    for (let j = i; j < Math.min(n, i + step); j++) if (arr[j] != null) { sum += arr[j]!; c++; }
    return c ? Math.round(sum / c) : null;
  };
  const out = [];
  for (let i = 0; i < n; i += step) {
    out.push({ t: i, min: Math.round((i / 60) * 10) / 10, power: avg(s.power, i), cadence: avg(s.cadence, i), resistance: avg(s.resistance, i), hr: avg(s.hr, i), speed: avg(s.speed, i) });
  }
  return out;
}

function Mini({ data, k, color, unit, step }: { data: ReturnType<typeof downsample>; k: 'power' | 'cadence' | 'resistance' | 'hr' | 'speed'; color: string; unit: string; step?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={110}>
      <LineChart data={data} syncId="ride" margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.15} />
        <XAxis dataKey="min" tick={AXIS} unit="分" minTickGap={30} />
        <YAxis tick={AXIS} domain={['auto', 'auto']} allowDecimals={false} />
        <Tooltip {...TIP} formatter={(v: number) => [v + ' ' + unit]} labelFormatter={(l) => l + ' 分'} />
        <Line type={step ? 'stepAfter' : 'monotone'} dataKey={k} stroke={color} strokeWidth={1.8} dot={false} connectNulls={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function Hist({ data, color, unit }: { data: { label: string; minutes: number }[]; color: string; unit: string }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.15} />
        <XAxis dataKey="label" tick={AXIS} />
        <YAxis tick={AXIS} />
        <Tooltip {...TIP} formatter={(v: number) => [v + ' 分', '時間']} labelFormatter={(l) => l + ' ' + unit} />
        <Bar dataKey="minutes" fill={color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function RideDetail() {
  const { id } = useParams();
  const db = useDb();
  const nav = useNavigate();
  const ride = db.rides.find((r) => r.id === id);
  const s = useMemo(() => (ride ? series(ride) : null), [ride]);
  const data = useMemo(() => (s ? downsample(s) : []), [s]);

  if (!ride || !s) return <p className="card muted">找不到這筆紀錄。<Link to="/history" className="text-brand underline">回紀錄</Link></p>;

  const hr = hrCoverage(ride);
  const bests = rideBests(ride);
  const prs = newRecords(ride, db.rides);
  const has = (arr: (number | null)[]) => arr.some((v) => v != null);
  const oldSamples = ride.samples.length > 1 && ride.samples[1][0] - ride.samples[0][0] >= 5;

  const max = (arr: (number | null)[]) => arr.reduce<number | null>((m, v) => (v != null && (m == null || v > m) ? v : m), null);
  const paused = Math.max(0, Math.round((ride.end - ride.start) / 1000) - ride.duration);
  const maxCad = max(s.cadence), maxSpeed = max(s.speed), maxRes = max(s.resistance);
  const stats: [string, string][] = [
    ['踩踏時間', fmtDur(ride.duration)],
    ['暫停', paused >= 5 ? fmtDur(paused) : '沒有暫停'],
    ['做功', kj(ride) + ' kJ'],
    ['距離（錶頭估算）', (ride.distance / 1000).toFixed(2) + ' km'],
    ['卡路里（功率換算）', '約 ' + ride.kcal + ' kcal'],
    ['卡路里（錶頭）', ride.bikeKcal != null ? ride.bikeKcal + ' kcal' : '—'],
    ['平均 / 最高功率', ride.avgPower != null ? ride.avgPower + ' / ' + ride.maxPower + ' W' : '—'],
    ['平均 / 最高踏頻', ride.avgCadence != null ? ride.avgCadence + ' / ' + (maxCad ?? '—') + ' rpm' : '—'],
    ['平均 / 最高速度', ride.avgSpeed != null ? ride.avgSpeed + ' / ' + (maxSpeed != null ? maxSpeed.toFixed(1) : '—') + ' km/h' : '—'],
    ['平均 / 最高阻力', ride.avgResistance != null ? ride.avgResistance + ' / ' + (maxRes ?? '—') + ' 段' : '—'],
  ];

  return (
    <div className="space-y-3">
      <section className="card">
        {/* 回上一頁，回到紀錄時還停在原本選的那一天 */}
        <button onClick={() => (window.history.length > 1 ? nav(-1) : nav('/history'))} className="text-sm text-brand dark:text-brand-light">‹ 返回</button>
        <h2 className="mt-1 text-lg font-bold">{fmtDate(ride.start)}</h2>
        <p className="muted">
          {memberName(ride.memberId)}・{new Date(ride.start).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })}–
          {new Date(ride.end).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })}
          {ride.device && '・' + ride.device}
        </p>
        {prs.length > 0 && (
          <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/40">
            🏅 刷新個人紀錄：{prs.map((d) => durLabel(d) + ' ' + bests[d] + ' W').join('、')}
          </div>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-2">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-xl bg-stone-100 px-3 py-2 dark:bg-gray-800">
              <dt className="text-xs text-gray-500 dark:text-gray-400">{k}</dt>
              <dd className="font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card space-y-1">
        <h2 className="font-semibold">騎乘過程</h2>
        {oldSamples && <p className="muted text-xs">這趟是舊版紀錄，每 5 秒一筆，曲線比較粗。</p>}
        {has(s.power) && (<><div className="text-xs font-medium text-teal-700 dark:text-teal-400">功率 W</div><Mini data={data} k="power" color="#0f766e" unit="W" /></>)}
        {has(s.cadence) && (<><div className="text-xs font-medium text-sky-600">踏頻 rpm</div><Mini data={data} k="cadence" color="#0284c7" unit="rpm" /></>)}
        {has(s.resistance) && (<><div className="text-xs font-medium text-amber-600">阻力段數</div><Mini data={data} k="resistance" color="#d97706" unit="段" step /></>)}
        {has(s.speed) && (<><div className="text-xs font-medium text-violet-600">速度 km/h（錶頭估算）</div><Mini data={data} k="speed" color="#7c3aed" unit="km/h" /></>)}
      </section>

      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">心率</h2>
          <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
            心率涵蓋 {hr.pct}%（{fmtDur(hr.seconds)}）
          </span>
        </div>
        {hr.seconds === 0 ? (
          <p className="muted mt-2">這趟沒有量到心率。手握住把手上的感測器時才會記錄。</p>
        ) : (
          <>
            <p className="mt-2 text-sm">
              量測時段平均 <b>{hr.avg}</b> bpm{hr.max != null && <>・量測中最高 <b>{hr.max}</b> bpm</>}
            </p>
            <Mini data={data} k="hr" color="#e11d48" unit="bpm" />
            <p className="muted text-xs">只畫有握住感測器的時段，中間空白代表那段沒有量測。</p>
          </>
        )}
      </section>

      <section className="card">
        <h2 className="font-semibold">這趟最佳功率</h2>
        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
          {BEST_DURATIONS.map((d) => (
            <div key={d} className="rounded-xl bg-stone-100 py-2 dark:bg-gray-800">
              <div className="text-[11px] text-gray-500 dark:text-gray-400">{durLabel(d)}</div>
              <div className="font-bold tabular-nums">{bests[d] ?? '—'}{prs.includes(d) && ' 🏅'}</div>
            </div>
          ))}
        </div>
      </section>

      {has(s.resistance) && (
        <section className="card">
          <h2 className="font-semibold">各阻力段數騎了多久</h2>
          <Hist data={histogram(s.resistance, 1, 1)} color="#d97706" unit="段" />
        </section>
      )}
      {has(s.cadence) && (
        <section className="card">
          <h2 className="font-semibold">踏頻分布</h2>
          <Hist data={histogram(s.cadence, 10, 1)} color="#0284c7" unit="rpm" />
        </section>
      )}
      {has(s.power) && (
        <section className="card">
          <h2 className="font-semibold">功率分布</h2>
          <Hist data={histogram(s.power, 20, 1)} color="#0f766e" unit="W" />
        </section>
      )}

      <section className="card flex flex-wrap gap-2">
        <button className="btn" onClick={() => download(tcxName(ride), toTcx(ride), 'application/vnd.garmin.tcx+xml')}>下載 TCX</button>
        <button
          className="btn-danger"
          onClick={() => {
            if (!confirm('刪除這筆紀錄？')) return;
            deleteRide(ride.id);
            nav('/history');
          }}
        >
          刪除這筆
        </button>
      </section>
    </div>
  );
}
