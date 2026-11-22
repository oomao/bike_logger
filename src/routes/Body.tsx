// 體重與圍度：手動輸入，BMI、體脂率、基礎代謝是用身高年齡體重性別「估」的參考值
import { Link } from 'react-router-dom';
import BandRow from '../components/BandRow';
import MemberPicker from '../components/MemberPicker';
import Spark from '../components/Spark';
import WeightTrend from '../components/WeightTrend';
import { DAY, kg2, md, signed, ymd } from '../lib/bodyfmt';
import { bands, compose, type Profile } from '../lib/bia';
import { ageOf } from '../lib/suggest';
import { removeTape, removeWeight, TAPE_ITEMS, useDb, type Member, type Tape } from '../lib/store';

// 體重分級：國健署 BMI 18.5 / 24 / 27，四段等寬色條
const WEIGHT_BANDS: [string, string][] = [['偏瘦', 'bg-sky-400'], ['標準', 'bg-emerald-400'], ['微胖', 'bg-amber-400'], ['肥胖', 'bg-red-500']];

function WeightCard({ m }: { m: Member }) {
  const ws = m.weights ?? [];
  const last = ws[ws.length - 1];
  if (!last) return null;
  const prev = ws[ws.length - 2];
  const month = ws.filter(([t]) => t >= last[0] - 30 * DAY);
  const best = month.length >= 2 ? Math.min(...month.map(([, v]) => v)) : null;
  const h2 = m.height ? (m.height / 100) ** 2 : null;
  const cuts = h2 ? [14, 18.5, 24, 27, 32].map((b) => b * h2) : null;
  let band = -1, pos = 0;
  if (cuts) {
    band = last[1] < cuts[1] ? 0 : last[1] < cuts[2] ? 1 : last[1] < cuts[3] ? 2 : 3;
    pos = (band + Math.min(1, Math.max(0, (last[1] - cuts[band]) / (cuts[band + 1] - cuts[band])))) * 25;
  }
  const d = prev ? Math.round((last[1] - prev[1]) * 100) / 100 : null;
  return (
    <section className="card">
      <p className="muted">{ymd(last[0])}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-6xl font-bold tabular-nums leading-none">{kg2(last[1])}<span className="ml-1 text-xl font-normal text-gray-500">公斤</span></p>
        {band >= 0 && <span className={`rounded-full px-3 py-1 text-base font-bold text-white ${WEIGHT_BANDS[band][1]}`}>{WEIGHT_BANDS[band][0]}</span>}
      </div>
      {cuts && (
        <div className="mt-4">
          <div className="relative flex h-2.5 gap-1">
            {WEIGHT_BANDS.map(([n, bg]) => <div key={n} className={`flex-1 rounded-full ${bg} ${n === WEIGHT_BANDS[band][0] ? '' : 'opacity-60'}`} />)}
            <div className="absolute -top-1.5 h-5 w-5 -translate-x-1/2 rounded-full border-4 border-white bg-gray-900 shadow dark:border-gray-900 dark:bg-white" style={{ left: pos + '%' }} />
          </div>
          <div className="relative mt-1 h-4 text-[11px] text-gray-500">
            {[1, 2, 3].map((i) => <span key={i} className="absolute -translate-x-1/2 tabular-nums" style={{ left: i * 25 + '%' }}>{cuts[i].toFixed(2)}</span>)}
          </div>
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <p className={`text-2xl font-bold tabular-nums ${d == null || d === 0 ? '' : d > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>{d == null ? '--' : signed(d)}</p>
          <p className="muted">比上次</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums">{best == null ? '--' : kg2(best)}</p>
          <p className="muted">30 天內最輕</p>
        </div>
      </div>
    </section>
  );
}

function Estimate({ m }: { m: Member }) {
  const last = m.weights?.[m.weights.length - 1];
  const age = ageOf(m);
  if (!last) return null;
  if (!m.sex || !m.height || age == null) {
    return (
      <section className="card">
        <h2 className="font-semibold">參考數值（估算）</h2>
        <p className="muted mt-1">
          到 <Link to="/family" state={{ edit: m.id }} className="text-brand underline dark:text-brand-light">家人</Link> 頁填性別、身高、出生年，就能估 BMI、體脂率、基礎代謝。
        </p>
      </section>
    );
  }
  const p: Profile = { sex: m.sex, height: m.height, age };
  const c = compose(p, last[1]);
  const b = bands(p);
  return (
    <section className="card">
      <h2 className="font-semibold">參考數值（估算）</h2>
      <BandRow label="BMI" value={c.bmi} unit="" band={b.bmi} />
      {c.fatPct != null && <BandRow label="體脂率" value={c.fatPct} unit="%" band={b.fatPct} />}
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        {([['基礎代謝', c.bmr + ' 大卡'], ['標準體重', kg2(c.stdKg) + ' kg'], ['理想體重', kg2(c.idealKg) + ' kg']] as const).map(([k, v]) => (
          <div key={k} className="rounded-xl bg-stone-100 py-2 dark:bg-gray-800">
            <div className="text-xs text-gray-500 dark:text-gray-400">{k}</div>
            <div className="text-sm font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>
      <p className="muted mt-2 text-xs">沒有量阻抗，是用身高、年齡、體重、性別估出來的，只適合看自己的變化，不是醫療數字。</p>
    </section>
  );
}

function TapeCard({ m }: { m: Member }) {
  const ts = m.tapes ?? [];
  if (!ts.length) return null;
  // 每一項各自找最近兩次有量的
  const rows = TAPE_ITEMS.map(([k, n]) => {
    const vals = ts.filter(([, t]) => t[k] != null).map(([time, t]) => [time, t[k]!] as [number, number]);
    const last = vals[vals.length - 1], prev = vals[vals.length - 2];
    return { k, n, vals, last, d: last && prev ? Math.round((last[1] - prev[1]) * 10) / 10 : null };
  }).filter((r) => r.last);
  const waist = rows.find((r) => r.k === 'waist');
  return (
    <section className="card">
      <h2 className="font-semibold">圍度</h2>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {rows.map((r) => (
          <div key={r.k} className="rounded-xl bg-stone-100 px-3 py-2 dark:bg-gray-800">
            <div className="text-xs text-gray-500 dark:text-gray-400">{r.n}</div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold tabular-nums">{r.last[1]}</span>
              <span className="text-xs text-gray-500">cm</span>
              {r.d != null && r.d !== 0 && <span className={`ml-auto text-xs ${r.d > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>{r.d > 0 ? '+' : '−'}{Math.abs(r.d)}</span>}
            </div>
          </div>
        ))}
      </div>
      {waist && waist.vals.length >= 2 && (
        <div className="mt-3">
          <p className="muted text-xs">腰圍變化</p>
          <Spark points={waist.vals} dots />
          <div className="flex justify-between text-[11px] text-gray-500"><span>{md(waist.vals[0][0])}</span><span>{md(waist.vals[waist.vals.length - 1][0])}</span></div>
        </div>
      )}
    </section>
  );
}

function Recent({ m }: { m: Member }) {
  const days = new Map<string, { t: number; kg?: number; tape?: Tape }>();
  for (const [t, kg] of m.weights ?? []) days.set(ymd(t), { ...days.get(ymd(t)), t, kg });
  for (const [t, tape] of m.tapes ?? []) days.set(ymd(t), { ...days.get(ymd(t)), t, tape });
  const rows = [...days.entries()].sort((a, b) => b[1].t - a[1].t).slice(0, 14);
  if (!rows.length) return null;
  return (
    <section className="card">
      <h2 className="font-semibold">最近紀錄</h2>
      <ul className="mt-1 divide-y divide-gray-200 dark:divide-gray-800">
        {rows.map(([day, r]) => (
          <li key={day} className="flex items-center gap-2 py-2 text-sm">
            <span className="w-14 tabular-nums text-gray-500">{md(r.t)}</span>
            <span className="min-w-0 flex-1">
              {r.kg != null && <b className="tabular-nums">{kg2(r.kg)} 公斤</b>}
              {r.tape && <span className="ml-2 text-gray-500">{TAPE_ITEMS.filter(([k]) => r.tape![k] != null).map(([k, n]) => `${n.slice(0, 1)} ${r.tape![k]}`).join('・')}</span>}
            </span>
            <button
              className="btn-danger btn-sm"
              onClick={() => {
                if (!confirm(`刪除 ${md(r.t)} 的紀錄？`)) return;
                if (r.kg != null) removeWeight(m.id, r.t);
                if (r.tape) removeTape(m.id, r.t);
              }}
            >
              刪除
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Body() {
  const db = useDb();
  const m = db.members.find((x) => x.id === db.current);
  if (!m) return <p className="card muted">先到「騎乘」頁打上你的名字。</p>;
  return (
    <div className="space-y-3">
      <MemberPicker />
      <Link to="/history" className="card flex items-center gap-2 text-sm">
        <span>⚖️</span>
        <span className="flex-1">要記體重或圍度，到「紀錄」頁點那一天</span>
        <span className="text-gray-400">›</span>
      </Link>
      <WeightCard m={m} />
      <Estimate m={m} />
      <TapeCard m={m} />
      <WeightTrend m={m} />
      <Recent m={m} />
    </div>
  );
}
