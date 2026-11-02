import { useState } from 'react';
import { deleteRide, memberName, useDb } from '../lib/store';
import { download, fmtDate, fmtDur } from '../lib/format';
import { tcxName, toTcx } from '../lib/export';

export default function History() {
  const db = useDb();
  const [filter, setFilter] = useState<string>(db.current ?? '__all');
  const active = filter === '__all' || db.members.some((m) => m.id === filter) ? filter : '__all';

  const rides = db.rides.filter((r) => active === '__all' || r.memberId === active).sort((a, b) => b.start - a.start);
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const week = rides.filter((r) => r.start >= monday.getTime());
  const minutes = (arr: typeof rides) => Math.round(arr.reduce((a, r) => a + r.duration, 0) / 60);
  const km = (rides.reduce((a, r) => a + r.distance, 0) / 1000).toFixed(1);

  return (
    <div className="space-y-3">
      <section className="card">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">紀錄</h2>
          <select
            value={active}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-stone-50 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-950"
          >
            <option value="__all">全部家人</option>
            {db.members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-stone-100 py-2 dark:bg-gray-800">
            <div className="text-xs text-gray-500 dark:text-gray-400">本週</div>
            <div className="text-lg font-bold">{week.length} 次・{minutes(week)} 分</div>
          </div>
          <div className="rounded-xl bg-stone-100 py-2 dark:bg-gray-800">
            <div className="text-xs text-gray-500 dark:text-gray-400">累計</div>
            <div className="text-lg font-bold">{rides.length} 次・{minutes(rides)} 分・{km} km</div>
          </div>
        </div>
      </section>

      <section className="card">
        {rides.length === 0 ? (
          <p className="muted">還沒有紀錄。騎超過 60 秒就會自動存在這裡。</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {rides.slice(0, 200).map((r) => {
              const bits = [fmtDur(r.duration), (r.distance / 1000).toFixed(2) + ' km', r.kcal + ' kcal'];
              if (r.avgPower != null) bits.push('平均 ' + r.avgPower + ' W');
              if (r.avgCadence != null) bits.push(r.avgCadence + ' rpm');
              if (r.avgResistance != null) bits.push('阻力 ' + r.avgResistance);
              if (r.avgHr != null) bits.push('心率 ' + r.avgHr);
              return (
                <li key={r.id} className="flex items-center justify-between gap-2 py-3">
                  <div>
                    <div className="font-semibold">
                      {fmtDate(r.start)}
                      {active === '__all' && <span className="font-normal text-gray-500 dark:text-gray-400">・{memberName(r.memberId)}</span>}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{bits.join('・')}</div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button className="btn btn-sm" onClick={() => download(tcxName(r), toTcx(r), 'application/vnd.garmin.tcx+xml')}>
                      TCX
                    </button>
                    <button
                      className="btn-danger btn-sm"
                      onClick={() => confirm('刪除 ' + fmtDate(r.start) + ' 這筆紀錄？') && deleteRide(r.id)}
                    >
                      刪除
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="muted mt-2">TCX 檔可以到 Strava 網站「上傳活動」手動匯入。</p>
      </section>
    </div>
  );
}
