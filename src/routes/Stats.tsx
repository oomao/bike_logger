import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import MemberPicker from '../components/MemberPicker';
import { memberName, useDb } from '../lib/store';
import {
  badges, dailyGrid, durLabel, kj, powerCurve, records, trends, weeklyVolume, weekStreak,
} from '../lib/analytics';
import { fmtDur } from '../lib/format';

const AXIS = { fontSize: 11, fill: '#9ca3af' };
const TIP = { contentStyle: { borderRadius: 12, fontSize: 12 }, labelStyle: { fontWeight: 600 } };

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2 className="font-semibold">{title}</h2>
      {hint && <p className="muted mb-2 mt-0.5 text-xs">{hint}</p>}
      <div className={hint ? '' : 'mt-2'}>{children}</div>
    </section>
  );
}

export default function Stats() {
  const db = useDb();
  const [metric, setMetric] = useState<'minutes' | 'kj'>('minutes');
  const rides = useMemo(() => db.rides.filter((r) => r.memberId === db.current).sort((a, b) => a.start - b.start), [db]);

  if (!db.current) return <p className="card muted">先到「家人」頁新增並選擇騎乘者。</p>;

  const now = Date.now();
  const weeks = weeklyVolume(rides, 12, now);
  const thisWeek = weeks[weeks.length - 1], lastWeek = weeks[weeks.length - 2];
  const streak = weekStreak(rides, now);
  const grid = dailyGrid(rides, 12, now);
  const curve = powerCurve(rides, now);
  const rec = records(rides);
  const tr = trends(rides, now);
  const bad = badges(rides);
  const maxDay = Math.max(30, ...grid.flat().map((d) => d.minutes));
  const diff = (a: number, b: number) => (a === b ? '持平' : (a > b ? '+' : '') + Math.round(a - b));

  return (
    <div className="space-y-3">
      <MemberPicker />
      {rides.length === 0 && <p className="card muted">{memberName(db.current)} 還沒有紀錄，騎超過 60 秒就會出現在這裡。</p>}

      <Section title="本週">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ['分鐘', thisWeek.minutes, lastWeek.minutes],
            ['趟數', thisWeek.rides, lastWeek.rides],
            ['做功 kJ', thisWeek.kj, lastWeek.kj],
          ].map(([label, a, b]) => (
            <div key={label as string} className="rounded-xl bg-stone-100 py-2 dark:bg-gray-800">
              <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
              <div className="text-2xl font-bold tabular-nums">{a}</div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400">比上週 {diff(a as number, b as number)}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-sm">🔥 已連續 <b>{streak}</b> 週有騎{streak === 0 ? '，這週騎一趟就開始累積！' : ''}</p>
      </Section>

      <Section title="近 12 週每天騎乘" hint="顏色越深騎越久；以週計算，休息幾天不會中斷連續紀錄">
        <div className="flex gap-1">
          <div className="grid grid-rows-7 gap-1 pr-1 text-[10px] leading-[14px] text-gray-400">
            {['一', '', '三', '', '五', '', '日'].map((d, i) => <span key={i}>{d}</span>)}
          </div>
          {grid.map((week, w) => (
            <div key={w} className="grid flex-1 grid-rows-7 gap-1">
              {week.map((d) => (
                <div
                  key={d.date}
                  title={new Date(d.date).toLocaleDateString('zh-TW') + '：' + Math.round(d.minutes) + ' 分'}
                  className={`h-3.5 rounded-sm ${d.date > now ? 'opacity-0' : d.minutes ? '' : 'bg-gray-200 dark:bg-gray-800'}`}
                  style={d.minutes ? { background: '#0f766e', opacity: 0.25 + 0.75 * Math.min(1, d.minutes / maxDay) } : undefined}
                />
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section title="每週騎乘量">
        <div className="mb-2 flex gap-2">
          <button className={metric === 'minutes' ? 'chip-on' : 'chip'} onClick={() => setMetric('minutes')}>分鐘</button>
          <button className={metric === 'kj' ? 'chip-on' : 'chip'} onClick={() => setMetric('kj')}>做功 kJ</button>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={weeks} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeOpacity={0.15} />
            <XAxis dataKey="label" tick={AXIS} interval={1} />
            <YAxis tick={AXIS} allowDecimals={false} />
            <Tooltip {...TIP} formatter={(v: number) => [v + (metric === 'kj' ? ' kJ' : ' 分'), weekLabel(metric)]} labelFormatter={(l) => l + ' 那週'} />
            <Bar dataKey={metric} fill="#0f766e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Section>

      <Section title="趨勢" hint="近 30 天每趟平均，和之前 31～180 天比較">
        <div className="grid grid-cols-2 gap-2">
          {tr.map((t) => (
            <div key={t.label} className="rounded-xl bg-stone-100 px-3 py-2 dark:bg-gray-800">
              <div className="text-xs text-gray-500 dark:text-gray-400">{t.label}</div>
              {t.recent == null ? (
                <div className="text-xs text-gray-400">需累積更多騎乘</div>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold tabular-nums">{Math.round(t.recent)}</span>
                  <span className="text-xs text-gray-500">{t.unit}</span>
                  {t.dir && (
                    <span className={`ml-auto text-lg ${t.dir === 'up' ? 'text-emerald-600' : t.dir === 'down' ? 'text-amber-600' : 'text-gray-400'}`}>
                      {t.dir === 'up' ? '↑' : t.dir === 'down' ? '↓' : '→'}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="功率曲線" hint="每個時間長度能維持的最佳平均功率。代表你騎過的表現，不是極限；只跟自己比">
        {curve.length < 2 ? (
          <p className="muted">需要至少一趟有功率、超過 1 分鐘的紀錄。</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={curve} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeOpacity={0.15} />
              <XAxis dataKey="label" tick={AXIS} />
              <YAxis tick={AXIS} unit="W" />
              <Tooltip {...TIP} formatter={(v: number, n) => [v + ' W', n === 'all' ? '全期最佳' : '近 60 天']} />
              <Legend formatter={(v) => (v === 'all' ? '全期最佳' : '近 60 天')} wrapperStyle={{ fontSize: 12 }} />
              {/* 近期畫虛線放下層，跟全期重疊時兩條都看得到 */}
              <Line type="monotone" dataKey="recent" stroke="#f59e0b" strokeWidth={3} strokeDasharray="6 4" dot={false} connectNulls={false} />
              <Line type="monotone" dataKey="all" stroke="#0f766e" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Section>

      <Section title="個人最佳">
        <ul className="divide-y divide-gray-200 text-sm dark:divide-gray-800">
          {rec.power.map(({ dur, best }) => (
            <RecordRow key={dur} label={durLabel(dur) + '最佳功率'} value={best ? best.value + ' W' : null} rideId={best?.ride.id} date={best?.ride.start} />
          ))}
          <RecordRow label="最長一趟" value={rec.longest ? fmtDur(rec.longest.value) : null} rideId={rec.longest?.ride.id} date={rec.longest?.ride.start} />
          <RecordRow label="單趟最多做功" value={rec.mostKj ? rec.mostKj.value + ' kJ' : null} rideId={rec.mostKj?.ride.id} date={rec.mostKj?.ride.start} />
          <RecordRow label="單趟最遠（估算）" value={rec.farthest ? (rec.farthest.value / 1000).toFixed(2) + ' km' : null} rideId={rec.farthest?.ride.id} date={rec.farthest?.ride.start} />
          <RecordRow label="最多的一週" value={rec.bestWeek ? rec.bestWeek.minutes + ' 分' : null} date={rec.bestWeek?.start} />
        </ul>
      </Section>

      <Section title="徽章">
        <div className="grid grid-cols-4 gap-2 text-center sm:grid-cols-7">
          {bad.map((b) => (
            <div key={b.label} className={`rounded-xl py-2 ${b.got ? 'bg-teal-50 dark:bg-teal-950' : 'bg-stone-100 opacity-40 grayscale dark:bg-gray-800'}`}>
              <div className="text-xl">{b.icon}</div>
              <div className="text-[11px]">{b.label}</div>
            </div>
          ))}
        </div>
        <p className="muted mt-2 text-xs">累計 {rides.length} 趟・{Math.round(rides.reduce((a, r) => a + r.duration, 0) / 60)} 分・{rides.reduce((a, r) => a + kj(r), 0)} kJ</p>
      </Section>
    </div>
  );
}

const weekLabel = (m: string) => (m === 'kj' ? '做功' : '騎乘');

function RecordRow({ label, value, rideId, date }: { label: string; value: string | null; rideId?: string; date?: number }) {
  const body = (
    <>
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="ml-auto font-semibold tabular-nums">{value ?? '—'}</span>
      {date && <span className="ml-2 text-xs text-gray-400">{new Date(date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}</span>}
    </>
  );
  return (
    <li className="py-2">
      {rideId ? <Link to={'/ride/' + rideId} className="flex items-center">{body}<span className="ml-1 text-gray-400">›</span></Link> : <div className="flex items-center">{body}</div>}
    </li>
  );
}
