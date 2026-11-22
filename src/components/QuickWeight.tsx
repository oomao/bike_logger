import { useEffect, useState } from 'react';
import { kg2, ymd } from '../lib/bodyfmt';
import { logWeight, type Member } from '../lib/store';

/** 一欄體重、一個按鈕：記今天的體重（今天已經記過就帶出來，改了會蓋掉） */
export default function QuickWeight({ m }: { m: Member }) {
  const today = ymd(Date.now());
  const todayKg = m.weights?.find(([t]) => ymd(t) === today)?.[1];
  const [kg, setKg] = useState(todayKg != null ? kg2(todayKg) : '');
  const [saved, setSaved] = useState(todayKg != null);
  useEffect(() => {
    setKg(todayKg != null ? kg2(todayKg) : '');
    setSaved(todayKg != null);
  }, [m.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    const w = Number(kg);
    if (!kg.trim() || !(w >= 20 && w <= 250)) return alert('體重請填 20～250 公斤');
    logWeight(m.id, Math.round(w * 100) / 100);
    setSaved(true);
  };
  const last = m.weights?.[m.weights.length - 1]?.[1];
  return (
    <div className="flex gap-2">
      <input
        className="input text-xl"
        inputMode="decimal"
        placeholder={last != null ? '今天的體重，上次 ' + kg2(last) : '今天的體重，例如 65.35'}
        value={kg}
        onChange={(e) => { setKg(e.target.value); setSaved(false); }}
        onKeyDown={(e) => e.key === 'Enter' && save()}
      />
      <button className="btn-primary flex-none" onClick={save}>{saved ? '✓ 已記錄' : '記錄'}</button>
    </div>
  );
}
