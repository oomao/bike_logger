import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useBike } from '../lib/bike';
import { useDb } from '../lib/store';
import { suggest, WEEK_GOAL } from '../lib/suggest';
import { progress, stopWorkout, useWorkout } from '../lib/workout';
import { fmtDur } from '../lib/format';

const range = (r: [number, number]) => (r[0] === r[1] ? String(r[0]) : r.join('–'));

/** 騎乘頁上的一行：有選課表就顯示進度，沒有就是今日建議的摘要，點了到建議頁 */
export default function TodayStrip() {
  const db = useDb();
  const bike = useBike();
  const workout = useWorkout();
  const riderId = bike.ride?.memberId ?? db.current;
  const m = db.members.find((x) => x.id === riderId);
  const s = useMemo(() => (m && !bike.ride ? suggest(m, db.rides) : null), [m, db.rides, bike.ride == null]); // eslint-disable-line react-hooks/exhaustive-deps

  if (workout && workout.memberId === riderId) {
    if (!bike.ride || workout.offset == null) {
      return (
        <section className="card flex items-center gap-2 text-sm">
          <span className="flex-1">
            📋 已選「{workout.title}」
            {bike.connected ? '，開始踩就會跟著課表走。' : <b className="block">下一步：先踩幾下讓錶頭亮，再按上方「連線飛輪」</b>}
          </span>
          <button className="btn btn-sm" onClick={stopWorkout}>取消</button>
        </section>
      );
    }
    const p = progress(workout, bike.ride.active);
    const st = p.step;
    return (
      <section className="card">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 font-semibold">📋 {workout.title}・第 {Math.min(p.index + 1, workout.steps.length)}/{workout.steps.length} 段</h2>
          <button className="btn btn-sm" onClick={stopWorkout}>{st ? '停止課表' : '關閉'}</button>
        </div>
        {st ? (
          <>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-2xl font-bold">{st.label}</span>
              <span className="text-3xl font-bold tabular-nums">{fmtDur(p.left)}</span>
            </div>
            <p className="text-sm">
              {st.watts ? `目標 ${range(st.watts)} W` + (st.levels ? `・阻力 ${range(st.levels)} 段` : '') : '照感覺踩'}・踏頻 80 左右
            </p>
            {p.next && <p className="muted">下一段：{p.next.label} {p.next.minutes} 分</p>}
          </>
        ) : (
          <p className="mt-2 text-lg font-bold">課表完成 🎉 可以按「結束並儲存」</p>
        )}
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div className="h-full rounded-full bg-brand dark:bg-brand-light" style={{ width: p.done * 100 + '%' }} />
        </div>
      </section>
    );
  }

  if (!m || !s) return null;
  const rec = s.restToday ? '今天休息日' : s.todayMinutes >= 10 ? `今天騎了 ${s.todayMinutes} 分` : s.rec === 'rest' ? '建議休息' : `${s.options.find((o) => o.kind === s.rec)!.title} ${s.options.find((o) => o.kind === s.rec)!.minutes} 分`;
  return (
    <Link to="/plan" className="card flex items-center gap-2 text-sm">
      <span>💡</span>
      <span className="flex-1">今日建議：<b>{rec}</b>・本週 {s.weekMinutes}/{WEEK_GOAL}</span>
      <span className="text-gray-400">›</span>
    </Link>
  );
}
