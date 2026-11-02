import { useState } from 'react';
import { Link } from 'react-router-dom';
import { memberName, useDb } from '../lib/store';
import { fmtDate, fmtDur } from '../lib/format';
import { newRecords } from '../lib/analytics';
import BackupReminder from '../components/BackupReminder';

export default function History() {
  const db = useDb();
  const [filter, setFilter] = useState<string>(db.current ?? '__all');
  const active = filter === '__all' || db.members.some((m) => m.id === filter) ? filter : '__all';
  const rides = db.rides.filter((r) => active === '__all' || r.memberId === active).sort((a, b) => b.start - a.start);

  return (
    <div className="space-y-3">
      <BackupReminder />
      <section className="card">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">紀錄 <span className="text-sm font-normal text-gray-500">{rides.length} 筆</span></h2>
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

        {rides.length === 0 ? (
          <p className="muted mt-3">還沒有紀錄。騎超過 60 秒就會自動存在這裡。</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-800">
            {rides.slice(0, 300).map((r) => {
              const bits = [fmtDur(r.duration), (r.distance / 1000).toFixed(2) + ' km'];
              if (r.avgPower != null) bits.push(r.avgPower + ' W');
              if (r.avgCadence != null) bits.push(r.avgCadence + ' rpm');
              if (r.avgResistance != null) bits.push('阻力 ' + r.avgResistance);
              if (r.avgHr != null) bits.push('♥ ' + r.avgHr);
              const pr = newRecords(r, db.rides).length > 0;
              return (
                <li key={r.id}>
                  <Link to={'/ride/' + r.id} className="flex items-center gap-2 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">
                        {fmtDate(r.start)}
                        {pr && ' 🏅'}
                        {active === '__all' && <span className="font-normal text-gray-500 dark:text-gray-400">・{memberName(r.memberId)}</span>}
                      </div>
                      <div className="truncate text-xs text-gray-500 dark:text-gray-400">{bits.join('・')}</div>
                    </div>
                    <span className="text-gray-400">›</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
