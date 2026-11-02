import { useState } from 'react';
import { addMember, deleteMember, getDb, importDb, selectMember, useDb } from '../lib/store';
import { download } from '../lib/format';
import { toCsv } from '../lib/export';
import { connect, useBike } from '../lib/bike';

export default function Family() {
  const db = useDb();
  const bike = useBike();
  const [name, setName] = useState('');

  const add = () => {
    if (!name.trim()) return;
    if (!addMember(name)) return alert('已經有「' + name.trim() + '」了');
    setName('');
  };

  const remove = (id: string, n: string) => {
    const count = db.rides.filter((r) => r.memberId === id).length;
    if (confirm('刪除「' + n + '」和他的 ' + count + ' 筆紀錄？建議先匯出備份。')) deleteMember(id);
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      alert(importDb(await file.text()));
    } catch (err) {
      alert('匯入失敗：' + (err as Error).message);
    }
    e.target.value = '';
  };

  const today = new Date().toISOString().slice(0, 10);
  const d = bike.diag;
  const diagRows: [string, string][] = d
    ? [
        ['裝置名稱', d.name],
        ['廠牌 / 型號', [d.maker, d.model].filter(Boolean).join(' / ') || '—'],
        ['韌體', d.firmware || '—'],
        ['找到的服務', d.services.join('\n') || '—'],
        ['數據來源', bike.source ? { ftms: 'FTMS（標準，最佳）', cps: 'Cycling Power', csc: 'CSC 踏頻' }[bike.source] : '無標準來源'],
        ...(d.ftms ? ([['FTMS 提供數據', d.ftms.data], ['App 可控制阻力', d.ftms.control + (d.controlPoint ? '' : '（沒有控制點）')]] as [string, string][]) : []),
        ...(d.resRange ? ([['阻力範圍', d.resRange]] as [string, string][]) : []),
        ...(d.vendorChars ? ([['私有特徵', d.vendorChars.join('\n')]] as [string, string][]) : []),
      ]
    : [];

  return (
    <div className="space-y-3">
      <section className="card">
        <h2 className="mb-2 font-semibold">家人</h2>
        <ul className="divide-y divide-gray-200 dark:divide-gray-800">
          {db.members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 py-2">
              <button className={m.id === db.current ? 'chip-on' : 'chip'} onClick={() => selectMember(m.id)}>
                {m.name}
              </button>
              <span className="muted ml-auto">{db.rides.filter((r) => r.memberId === m.id).length} 筆</span>
              <button className="btn-danger btn-sm" onClick={() => remove(m.id, m.name)}>刪除</button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <input
            className="input"
            value={name}
            maxLength={20}
            placeholder="新增家人名字"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="btn-primary" onClick={add}>新增</button>
        </div>
        <p className="muted mt-2">每個家人用自己的手機時，各自在自己的手機上新增自己的名字就好。</p>
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">備份</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => download('bike-logger-backup-' + today + '.json', JSON.stringify(getDb()), 'application/json')}>
            匯出備份
          </button>
          <label className="btn cursor-pointer">
            匯入備份
            <input type="file" accept="application/json,.json" className="hidden" onChange={onImport} />
          </label>
          <button className="btn" onClick={() => download('bike-logger-' + today + '.csv', toCsv(), 'text/csv')}>匯出 CSV</button>
        </div>
        <p className="muted mt-2">紀錄只存在這支手機裡，清除瀏覽器資料或解除安裝 App 就會消失，請定期匯出備份。</p>
      </section>

      <section className="card">
        <details>
          <summary className="cursor-pointer font-semibold">診斷資訊</summary>
          <button className="btn mt-3" onClick={() => connect(true)}>列出所有藍牙裝置並連線</button>
          {d ? (
            <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
              {diagRows.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-gray-500 dark:text-gray-400">{k}</dt>
                  <dd className="whitespace-pre-wrap break-all">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="muted mt-3">連線後會顯示飛輪的藍牙服務。</p>
          )}
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-stone-100 p-3 text-[11px] dark:bg-gray-800">
            {bike.raw.join('\n') || '（連線後顯示原始封包）'}
          </pre>
        </details>
      </section>
    </div>
  );
}
