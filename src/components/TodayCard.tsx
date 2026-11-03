import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ackSafety, toggleRestDay, useDb } from '../lib/store';
import { dayKey, suggest, WEEK_GOAL, type Kind } from '../lib/suggest';

export default function TodayCard() {
  const db = useDb();
  const m = db.members.find((x) => x.id === db.current);
  const s = useMemo(() => (m ? suggest(m, db.rides) : null), [m, db.rides]);
  const [picked, setPicked] = useState<Kind | null>(null);
  if (!m || !s) return null;

  const shown = picked ?? (s.rec === 'rest' ? 'easy' : s.rec);
  const opt = s.options.find((o) => o.kind === shown)!;
  const pct = Math.min(100, Math.round((s.weekMinutes / WEEK_GOAL) * 100));

  return (
    <section className="card">
      <h2 className="font-semibold">今日建議・{m.name}</h2>

      {!m.safetyAck && (
        <div className="mt-2 rounded-xl border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/40">
          建議僅供參考，不是醫療建議。有心臟病、高血壓、胸痛或頭暈病史，或很久沒運動，請先問醫師；騎的時候胸痛、頭暈、喘不過氣就立刻停下來。
          <button className="btn btn-sm mt-2 w-full" onClick={() => ackSafety(m.id)}>知道了</button>
        </div>
      )}

      {s.restToday ? (
        <div className="mt-2">
          <p className="text-lg font-bold">今天是休息日 😌</p>
          <p className="muted">好好休息，明天見。休息日不會中斷連續紀錄。</p>
          <button className="btn btn-sm mt-2" onClick={() => toggleRestDay(m.id, dayKey(Date.now()))}>取消休息日</button>
        </div>
      ) : s.todayMinutes >= 10 ? (
        <p className="mt-2 text-lg font-bold">今天已經騎了 {s.todayMinutes} 分鐘 👍</p>
      ) : (
        <>
          <p className="mt-2 text-lg font-bold">{s.headline}</p>
          <p className="muted">{s.reason}{s.rec === 'rest' && ' 想動的話，輕鬆踩一下就好。'}</p>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {s.options.map((o) => (
              <button
                key={o.kind}
                onClick={() => setPicked(o.kind)}
                className={`relative rounded-xl border px-2 py-2 text-center ${
                  o.kind === shown ? 'border-brand bg-brand/10 dark:border-brand-light' : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                {o.kind === s.rec && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-brand px-1.5 text-[10px] text-white dark:bg-brand-light dark:text-gray-950">推薦</span>
                )}
                <div className="text-sm font-semibold">{o.title}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{o.minutes} 分</div>
              </button>
            ))}
          </div>

          <div className="mt-3 rounded-xl bg-stone-100 px-3 py-2 text-sm dark:bg-gray-800">
            <p><span className="text-gray-500 dark:text-gray-400">感覺：</span>{opt.feel}</p>
            <p><span className="text-gray-500 dark:text-gray-400">怎麼騎：</span>{opt.plan}</p>
            {opt.watts ? (
              <p>
                <span className="text-gray-500 dark:text-gray-400">目標：</span>
                {opt.watts[0]}–{opt.watts[1]} W
                {opt.levels && `・阻力 ${opt.levels[0] === opt.levels[1] ? opt.levels[0] : opt.levels.join('–')} 段・踏頻 80 左右`}
              </p>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">多騎幾趟、每趟持續踩 10 分鐘以上，累積 3 趟後會算出你的瓦數和阻力建議。</p>
            )}
          </div>

          <button className="btn btn-sm mt-2 w-full" onClick={() => toggleRestDay(m.id, dayKey(Date.now()))}>今天休息</button>
        </>
      )}

      <div className="mt-3">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>本週 {s.weekMinutes} / {WEEK_GOAL} 分鐘</span>
          <span>{s.weekMinutes >= WEEK_GOAL ? '達標 🎉' : '國健署建議每週 150 分鐘'}</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div className="h-full rounded-full bg-brand dark:bg-brand-light" style={{ width: pct + '%' }} />
        </div>
      </div>

      {s.ftp && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          估計 FTP {s.ftp} W{s.wkg && `（${s.wkg} W/kg）`}
        </p>
      )}
      {!m.birthYear && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          到 <Link to="/family" className="text-brand underline dark:text-brand-light">家人</Link> 頁填出生年，建議會依年齡調整。
        </p>
      )}
    </section>
  );
}
