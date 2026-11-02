import { Link, useSearchParams } from 'react-router-dom';
import { memberName, useDb, type Ride } from '../lib/store';
import { fmtDate, fmtDur } from '../lib/format';
import { kj, newRecords } from '../lib/analytics';
import BackupReminder from '../components/BackupReminder';

// 日期用本地時間的 YYYY-MM-DD，放在網址上（?day=…），從單趟頁返回時還停在同一天
const dayKey = (ms: number) => {
  const d = new Date(ms);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const parseDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const WEEK = ['一', '二', '三', '四', '五', '六', '日'];

function Calendar({ month, selected, minutesByDay, onPick, onMonth }: {
  month: Date; selected: string | null; minutesByDay: Map<string, number>;
  onPick: (key: string) => void; onMonth: (delta: number) => void;
}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7; // 週一開頭
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const today = dayKey(Date.now());
  const maxMin = Math.max(30, ...minutesByDay.values());
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  return (
    <div>
      <div className="flex items-center justify-between">
        <button className="btn btn-sm" onClick={() => onMonth(-1)} aria-label="上個月">‹</button>
        <span className="font-semibold">{month.getFullYear()} 年 {month.getMonth() + 1} 月</span>
        <button className="btn btn-sm" onClick={() => onMonth(1)} aria-label="下個月">›</button>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px] text-gray-400">
        {WEEK.map((w) => <span key={w}>{w}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d == null) return <span key={'x' + i} />;
          const key = dayKey(new Date(month.getFullYear(), month.getMonth(), d).getTime());
          const min = minutesByDay.get(key) ?? 0;
          const future = key > today;
          return (
            <button
              key={key}
              disabled={future}
              onClick={() => onPick(key)}
              className={`relative flex h-9 items-center justify-center rounded-lg text-sm tabular-nums disabled:opacity-30
                ${min ? 'font-semibold text-white' : 'bg-stone-100 dark:bg-gray-800'}
                ${key === selected ? 'ring-2 ring-amber-400 ring-offset-1 dark:ring-offset-gray-900' : ''}
                ${key === today && key !== selected ? 'ring-1 ring-brand dark:ring-brand-light' : ''}`}
              style={min ? { background: `rgba(15,118,110,${0.35 + 0.65 * Math.min(1, min / maxMin)})` } : undefined}
              title={min ? Math.round(min) + ' 分' : undefined}
            >
              {d}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-gray-400">有騎的日子會上色，越深騎越久；外框是今天。</p>
    </div>
  );
}

function RideRow({ r, showWho, all }: { r: Ride; showWho: boolean; all: Ride[] }) {
  const bits = [fmtDur(r.duration), (r.distance / 1000).toFixed(2) + ' km'];
  if (r.avgPower != null) bits.push(r.avgPower + ' W');
  if (r.avgCadence != null) bits.push(r.avgCadence + ' rpm');
  if (r.avgResistance != null) bits.push('阻力 ' + r.avgResistance);
  if (r.avgHr != null) bits.push('♥ ' + r.avgHr);
  return (
    <li>
      <Link to={'/ride/' + r.id} className="flex items-center gap-2 py-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold">
            {fmtDate(r.start)}
            {newRecords(r, all).length > 0 && ' 🏅'}
            {showWho && <span className="font-normal text-gray-500 dark:text-gray-400">・{memberName(r.memberId)}</span>}
          </div>
          <div className="truncate text-xs text-gray-500 dark:text-gray-400">{bits.join('・')}</div>
        </div>
        <span className="text-gray-400">›</span>
      </Link>
    </li>
  );
}

export default function History() {
  const db = useDb();
  const [params, setParams] = useSearchParams();
  const today = dayKey(Date.now());

  const who = params.get('who') ?? db.current ?? '__all';
  const filter = who === '__all' || db.members.some((m) => m.id === who) ? who : '__all';
  const view = params.get('view') === 'all' ? 'all' : 'day';
  const day = params.get('day') ?? today;
  const month = parseDay(params.get('month') ?? day.slice(0, 7) + '-01');

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v == null ? next.delete(k) : next.set(k, v));
    setParams(next, { replace: true });
  };

  const mine = db.rides.filter((r) => filter === '__all' || r.memberId === filter).sort((a, b) => b.start - a.start);
  const minutesByDay = new Map<string, number>();
  for (const r of mine) minutesByDay.set(dayKey(r.start), (minutesByDay.get(dayKey(r.start)) ?? 0) + r.duration / 60);

  const dayRides = mine.filter((r) => dayKey(r.start) === day);
  const shown = view === 'all' ? mine : dayRides;
  const sum = (arr: Ride[]) => ({
    min: Math.round(arr.reduce((a, r) => a + r.duration, 0) / 60),
    kj: arr.reduce((a, r) => a + kj(r), 0),
    km: (arr.reduce((a, r) => a + r.distance, 0) / 1000).toFixed(1),
  });
  const total = sum(shown);
  const dayLabel = day === today ? '今天' : parseDay(day).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short' });

  return (
    <div className="space-y-3">
      <BackupReminder />

      <section className="card space-y-3">
        <div className="flex items-center gap-2">
          <button
            className={view === 'day' && day === today ? 'btn-primary flex-1' : 'btn flex-1'}
            onClick={() => update({ view: null, day: null, month: null })}
          >
            📅 今天的紀錄
          </button>
          <button className={view === 'all' ? 'btn-primary flex-1' : 'btn flex-1'} onClick={() => update({ view: 'all' })}>
            📜 歷史紀錄
          </button>
        </div>
        <select
          value={filter}
          onChange={(e) => update({ who: e.target.value })}
          className="w-full rounded-xl border border-gray-200 bg-stone-50 px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
        >
          <option value="__all">全部家人</option>
          {db.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        {view === 'day' && (
          <Calendar
            month={month}
            selected={day}
            minutesByDay={minutesByDay}
            onPick={(key) => update({ day: key === today ? null : key })}
            onMonth={(delta) => {
              const m = new Date(month.getFullYear(), month.getMonth() + delta, 1);
              update({ month: dayKey(m.getTime()) });
            }}
          />
        )}
      </section>

      <section className="card">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-semibold">{view === 'all' ? '全部歷史紀錄' : dayLabel}</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">{shown.length} 趟</span>
        </div>
        {shown.length > 0 && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            合計 {total.min} 分・{total.kj} kJ・{total.km} km
          </p>
        )}
        {shown.length === 0 ? (
          <p className="muted mt-3">
            {view === 'all' ? '還沒有紀錄。騎超過 60 秒就會自動存在這裡。' : dayLabel + '沒有騎乘紀錄。點月曆上有顏色的日子，或按「歷史紀錄」看全部。'}
          </p>
        ) : (
          <ul className="mt-1 divide-y divide-gray-200 dark:divide-gray-800">
            {shown.slice(0, 300).map((r) => <RideRow key={r.id} r={r} showWho={filter === '__all'} all={db.rides} />)}
          </ul>
        )}
      </section>
    </div>
  );
}
