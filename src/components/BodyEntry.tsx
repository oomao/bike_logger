import { useState } from 'react';
import { kg2, md, ymd } from '../lib/bodyfmt';
import { logTape, logWeight, TAPE_ITEMS, type Member, type Tape } from '../lib/store';

/** 選今天用現在的時間；補登過去的日子用當天中午，免得排序亂掉 */
const stamp = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return day === ymd(Date.now()) ? Date.now() : new Date(y, m - 1, d, 12).getTime();
};
const dayEntry = <T,>(list: [number, T][] | undefined, day: string) => list?.find(([t]) => ymd(t) === day)?.[1];

/** 記某一天的體重和圍度；那天已經有記就帶出來，改了會蓋掉 */
export default function BodyEntry({ m, day, onClose }: { m: Member; day: string; onClose: () => void }) {
  const w0 = dayEntry(m.weights, day);
  const t0 = dayEntry(m.tapes, day);
  const [kg, setKg] = useState(w0 != null ? kg2(w0) : '');
  const [cm, setCm] = useState<Partial<Record<keyof Tape, string>>>(
    Object.fromEntries(TAPE_ITEMS.map(([k]) => [k, t0?.[k] != null ? String(t0[k]) : ''])),
  );
  const last = m.weights?.[m.weights.length - 1]?.[1];

  const save = () => {
    const w = kg.trim() ? Number(kg) : null;
    if (w != null && !(w >= 20 && w <= 250)) return alert('體重請填 20～250 公斤');
    const tape: Tape = {};
    for (const [k, n] of TAPE_ITEMS) {
      const raw = cm[k]?.trim();
      if (!raw) continue;
      const v = Number(raw);
      if (!(v >= 10 && v <= 250)) return alert(`${n}請填 10～250 公分`);
      tape[k] = Math.round(v * 10) / 10;
    }
    if (w == null && !Object.keys(tape).length) return alert('至少填一項');
    const ts = stamp(day);
    if (w != null) logWeight(m.id, Math.round(w * 100) / 100, ts);
    if (Object.keys(tape).length) logTape(m.id, tape, ts);
    onClose();
  };

  return (
    <div className="mt-3 rounded-xl bg-stone-100 p-3 dark:bg-gray-800">
      <label className="block text-sm text-gray-600 dark:text-gray-300">
        體重（公斤）
        <input
          className="input mt-1 w-full text-xl"
          inputMode="decimal"
          autoFocus
          placeholder={last != null ? '上次 ' + kg2(last) : '例如 65.35'}
          value={kg}
          onChange={(e) => setKg(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
      </label>
      <p className="muted mt-3 text-xs">圍度（公分，有量的填就好）</p>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-2">
        {TAPE_ITEMS.map(([k, n]) => (
          <label key={k} className="text-sm text-gray-600 dark:text-gray-300">
            {n}
            <input className="input mt-1 w-full" inputMode="decimal" placeholder="例如 80" value={cm[k] ?? ''} onChange={(e) => setCm({ ...cm, [k]: e.target.value })} />
          </label>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button className="btn btn-sm flex-1" onClick={onClose}>取消</button>
        <button className="btn-primary btn-sm flex-1" onClick={save}>儲存 {md(stamp(day))}</button>
      </div>
    </div>
  );
}
