// 建議頁：把各家 App 的好做法整合在一起，每一塊上方註明學誰
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MemberPicker from '../components/MemberPicker';
import CourseConfirm from '../components/CourseConfirm';
import { useBike } from '../lib/bike';
import { ackSafety, setFeel, toggleRestDay, useDb } from '../lib/store';
import { dayKey, FEELS, fitnessHistory, LEVELS, suggest, WEEK_GOAL, weekPlan, type Kind, type Option } from '../lib/suggest';
import { startWorkout, stopWorkout, useWorkout } from '../lib/workout';

const range = (r: [number, number]) => (r[0] === r[1] ? String(r[0]) : r.join('–'));
const target = (o: { watts: [number, number] | null; levels: [number, number] | null }) =>
  o.watts ? `${range(o.watts)} W` + (o.levels ? `・阻力 ${range(o.levels)} 段` : '') : null;

function Ring({ pct }: { pct: number }) {
  const r = 34, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
      <circle cx="40" cy="40" r={r} fill="none" strokeWidth="9" className="stroke-gray-200 dark:stroke-gray-800" />
      <circle cx="40" cy="40" r={r} fill="none" strokeWidth="9" strokeLinecap="round" className="stroke-brand dark:stroke-brand-light"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, pct))} />
    </svg>
  );
}

function OptionDetail({ o, onStart, active }: { o: Option; onStart: () => void; active: boolean }) {
  return (
    <div className="mt-3 rounded-xl bg-stone-100 px-3 py-2 text-sm dark:bg-gray-800">
      <p><span className="text-gray-500 dark:text-gray-400">感覺：</span>{o.feel}</p>
      <p><span className="text-gray-500 dark:text-gray-400">怎麼騎：</span>{o.plan}</p>
      {target(o) ? (
        <p><span className="text-gray-500 dark:text-gray-400">目標：</span>{target(o)}・踏頻 80 左右</p>
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-400">累積 3 趟、每趟持續踩 10 分鐘以上，就會算出你的瓦數和阻力。</p>
      )}
      <button className="btn-primary mt-2 w-full" onClick={onStart} disabled={active}>
        {active ? '這份課表進行中' : `▶ 跟著騎（${o.minutes} 分）`}
      </button>
    </div>
  );
}

export default function Plan() {
  const db = useDb();
  const bike = useBike();
  const nav = useNavigate();
  const workout = useWorkout();
  const [picked, setPicked] = useState<Kind | null>(null);
  const [askCourse, setAskCourse] = useState(false);
  const m = db.members.find((x) => x.id === db.current);
  const s = useMemo(() => (m ? suggest(m, db.rides) : null), [m, db.rides]);
  const plan = useMemo(() => (s ? weekPlan(s) : null), [s]);
  const fit = useMemo(() => (m ? fitnessHistory(m, db.rides) : null), [m, db.rides]);

  if (!m || !s || !plan || !fit) {
    return (
      <p className="muted p-4">
        先到 <Link to="/family" className="text-brand underline dark:text-brand-light">家人</Link> 頁新增自己，就會出現建議。
      </p>
    );
  }

  const today = dayKey(Date.now());
  const shown = picked ?? (s.rec === 'rest' ? 'easy' : s.rec);
  const opt = s.options.find((o) => o.kind === shown)!;
  const title = (k: Kind) => s.options.find((o) => o.kind === k)!.title;
  const myWorkout = workout?.memberId === m.id ? workout : null;
  const start = (o: Option) => {
    startWorkout(m.id, o, bike.ride?.memberId === m.id ? bike.ride.active : null);
    nav('/');
  };
  const gain = fit.now && fit.w4 ? fit.now - fit.w4 : 0;

  return (
    <div className="space-y-3">
      {/* BH 課程：原本底部的按鈕併到這裡，放最上面一行就好 */}
      <button
        onClick={() => setAskCourse(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-brand/30 bg-brand/10 px-4 py-2.5 text-left dark:border-brand-light/30 dark:bg-brand-light/10"
      >
        <span className="text-xl" aria-hidden>📺</span>
        <span className="flex-1">
          <span className="block font-semibold">BH 線上飛輪課程</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">跟著課程騎，App 照樣在背景記錄</span>
        </span>
        <span className="text-sm font-semibold text-brand dark:text-brand-light">前往 ↗</span>
      </button>

      <MemberPicker />

      {!m.safetyAck && (
        <div className="rounded-xl border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/40">
          建議僅供參考，不是醫療建議。有心臟病、高血壓、胸痛或頭暈病史，或很久沒運動，請先問醫師；騎的時候胸痛、頭暈、喘不過氣就立刻停下來。
          <button className="btn btn-sm mt-2 w-full" onClick={() => ackSafety(m.id)}>知道了</button>
        </div>
      )}

      {/* 1. 騎前自評（Wahoo SYSTM） */}
      <section className="card">
        <h2 className="font-semibold">{m.name}，今天感覺如何？</h2>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {FEELS.map((f) => (
            <button
              key={f.v}
              onClick={() => setFeel(m.id, today, f.v)}
              className={`rounded-xl border py-2 text-center ${s.feel === f.v ? 'border-brand bg-brand/10 dark:border-brand-light' : 'border-gray-200 dark:border-gray-700'}`}
            >
              <div className="text-2xl">{f.icon}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{f.label}</div>
            </button>
          ))}
        </div>
      </section>

      {/* 2. 今日三選一（TrainerRoad TrainNow）＋ 3. 跟著騎（Garmin / Zwift 課表） */}
      <section className="card">
        <h2 className="font-semibold">今日建議</h2>
        {s.restToday ? (
          <div className="mt-2">
            <p className="text-lg font-bold">今天是休息日 😌</p>
            <p className="muted">好好休息，明天見。休息日不會中斷連續紀錄。</p>
            <button className="btn btn-sm mt-2" onClick={() => toggleRestDay(m.id, today)}>取消休息日</button>
          </div>
        ) : (
          <>
            {s.todayMinutes >= 10 ? (
              <p className="mt-2 text-lg font-bold">今天已經騎了 {s.todayMinutes} 分鐘 👍</p>
            ) : (
              <>
                <p className="mt-2 text-lg font-bold">{s.headline}</p>
                <p className="muted">{s.reason}{s.rec === 'rest' && ' 想動的話，輕鬆踩一下就好。'}</p>
              </>
            )}

            <div className="mt-3 grid grid-cols-3 gap-2">
              {s.options.map((o) => (
                <button
                  key={o.kind}
                  onClick={() => setPicked(o.kind)}
                  className={`relative rounded-xl border px-2 py-2 text-center ${
                    o.kind === shown ? 'border-brand bg-brand/10 dark:border-brand-light' : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {o.kind === s.rec && s.todayMinutes < 10 && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-brand px-1.5 text-[10px] text-white dark:bg-brand-light dark:text-gray-950">推薦</span>
                  )}
                  <div className="text-sm font-semibold">{o.title}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{o.minutes} 分</div>
                </button>
              ))}
            </div>
            <OptionDetail o={opt} onStart={() => start(opt)} active={myWorkout?.title === opt.title} />

            {myWorkout && (
              <p className="mt-2 flex items-center justify-between text-sm">
                <span>進行中：{myWorkout.title}（到「騎乘」頁看進度）</span>
                <button className="btn btn-sm" onClick={stopWorkout}>取消</button>
              </p>
            )}
            {s.todayMinutes < 10 && (
              <button className="btn btn-sm mt-2 w-full" onClick={() => toggleRestDay(m.id, today)}>今天休息</button>
            )}
          </>
        )}
      </section>

      {/* 4. 最近狀態（Apple Training Load） */}
      <section className="card">
        <h2 className="font-semibold">最近狀態</h2>
        {s.level == null ? (
          <p className="muted mt-1">騎滿兩週後，會比較你最近 7 天和平常的運動量。</p>
        ) : (
          <>
            <div className="mt-2 grid grid-cols-5 gap-1">
              {LEVELS.map((l, i) => (
                <div key={l} className={`h-2 rounded-full ${i === s.level ? (i === 2 ? 'bg-brand dark:bg-brand-light' : 'bg-amber-500') : 'bg-gray-200 dark:bg-gray-800'}`} />
              ))}
            </div>
            <p className="mt-2 text-sm font-medium">{LEVELS[s.level]}</p>
            <p className="muted">最近 7 天 {s.last7} 分鐘・平常每週 {s.usual} 分鐘</p>
          </>
        )}
      </section>

      {/* 5. 本週目標（Apple 活動圓環，但可以休息） */}
      <section className="card flex items-center gap-4">
        <Ring pct={s.weekMinutes / WEEK_GOAL} />
        <div>
          <h2 className="font-semibold">本週 {s.weekMinutes} / {WEEK_GOAL} 分鐘</h2>
          <p className="muted">{s.weekMinutes >= WEEK_GOAL ? '達標了 🎉' : `還差 ${WEEK_GOAL - s.weekMinutes} 分鐘`}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">國健署「動動150」：每週 150 分鐘，不必一次騎完</p>
        </div>
      </section>

      {/* 6. 這週怎麼排（Garmin / Peloton 週計畫） */}
      <section className="card">
        <h2 className="font-semibold">這週怎麼排</h2>
        {plan.days.length > 0 && (
          <ul className="mt-2 divide-y divide-gray-200 text-sm dark:divide-gray-800">
            {plan.days.map((d) => (
              <li key={d.date} className="flex justify-between py-1.5">
                <span>{new Date(d.date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short' })}{dayKey(d.date) === today && '（今天）'}</span>
                <span>{title(d.kind)} {d.minutes} 分</span>
              </li>
            ))}
          </ul>
        )}
        <p className="muted mt-1">{plan.note}</p>
      </section>

      {/* 7. 體能（Zwift FTP 自動偵測） */}
      <section className="card">
        <h2 className="font-semibold">你的體能</h2>
        {fit.now ? (
          <>
            {gain > 0 && fit.w4 && gain >= fit.w4 * 0.03 && <p className="mt-1 font-medium">🎉 體能進步了，比 4 週前多 {gain} W</p>}
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              {([['12 週前', fit.w12], ['4 週前', fit.w4], ['現在', fit.now]] as const).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-stone-100 py-2 dark:bg-gray-800">
                  <div className="text-xs text-gray-500 dark:text-gray-400">{k}</div>
                  <div className="font-bold tabular-nums">{v ?? '—'}{v && <span className="text-xs font-normal"> W</span>}</div>
                </div>
              ))}
            </div>
            <p className="muted mt-2">
              估計 FTP（大約能撐一小時的功率）{s.wkg && `・${s.wkg} W/kg`}。偶爾騎硬一點，數字才會往上更新。
            </p>
          </>
        ) : (
          <p className="muted mt-1">累積 3 趟、每趟持續踩 10 分鐘以上，就會估算你的體能。</p>
        )}
      </section>

      {/* 8. 我的阻力對照表（從自己的紀錄算） */}
      <section className="card">
        <h2 className="font-semibold">我的阻力對照表</h2>
        {s.table.size ? (
          <>
            <div className="mt-2 grid grid-cols-4 gap-2 text-center text-sm">
              {[...s.table].sort((a, b) => a[0] - b[0]).map(([lv, w]) => (
                <div key={lv} className="rounded-xl bg-stone-100 py-1.5 dark:bg-gray-800">
                  <div className="text-xs text-gray-500 dark:text-gray-400">{lv} 段</div>
                  <div className="font-semibold tabular-nums">{w} W</div>
                </div>
              ))}
            </div>
            <p className="muted mt-2">踏頻 70～90 時，近 90 天的中位數。</p>
          </>
        ) : (
          <p className="muted mt-1">多騎幾趟、踏頻維持在 70～90，就會整理出每一段阻力大概多少瓦。</p>
        )}
      </section>

      {!m.birthYear && (
        <p className="muted px-1 text-xs">
          到 <Link to="/family" className="text-brand underline dark:text-brand-light">家人</Link> 頁填出生年，建議會依年齡調整。
        </p>
      )}

      {askCourse && <CourseConfirm onClose={() => setAskCourse(false)} />}
    </div>
  );
}
