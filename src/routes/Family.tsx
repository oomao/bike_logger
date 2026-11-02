import { useEffect, useState } from 'react';
import { addMember, deleteMember, importData, selectMember, unbackedRides, useDb } from '../lib/store';
import { download, fmtDate } from '../lib/format';
import { toCsv } from '../lib/export';
import { backupFileName, canShareFiles, saveBackup } from '../lib/backup';
import { connect, useBike } from '../lib/bike';

export default function Family() {
  const db = useDb();
  const bike = useBike();
  const [name, setName] = useState('');
  const [who, setWho] = useState<string>(db.current ?? '__all');
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {});
  }, []);
  const target = who === '__all' || !db.members.some((m) => m.id === who) ? null : who;
  const share = canShareFiles();

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
      alert(importData(await file.text()));
    } catch (err) {
      alert('匯入失敗：' + (err as Error).message);
    }
    e.target.value = '';
  };

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
        <h2 className="font-semibold">備份與匯入</h2>
        <p className="muted mt-1">
          {db.lastBackup ? '上次備份：' + fmtDate(db.lastBackup) : '還沒備份過'}
          {unbackedRides(db) > 0 && `・${unbackedRides(db)} 筆新紀錄未備份`}
        </p>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">匯出誰</span>
          <select
            value={target ?? '__all'}
            onChange={(e) => setWho(e.target.value)}
            className="flex-1 rounded-xl border border-gray-200 bg-stone-50 px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
          >
            {db.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            <option value="__all">這支手機上的全部家人</option>
          </select>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">檔名：{backupFileName(target)}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {share && <button className="btn-primary" onClick={() => saveBackup(target, 'share')}>分享到雲端硬碟 / LINE</button>}
          <button className={share ? 'btn' : 'btn-primary'} onClick={() => saveBackup(target, 'download')}>下載備份檔</button>
          <button className="btn" onClick={() => download(backupFileName(target, 'csv'), toCsv(target), 'text/csv')}>匯出 CSV（Excel）</button>
        </div>

        <label className="btn mt-3 w-full cursor-pointer">
          📂 讀取備份檔（合併進來）
          <input type="file" accept="application/json,.json" className="hidden" onChange={onImport} />
        </label>
        <p className="muted mt-2 text-xs">
          讀取後紀錄就存在這支手機，之後打開 App 不用再選檔。同名的家人會自動合併，重複的紀錄會略過。
          {persisted === true && ' 這支手機已允許長期保存資料。'}
          {persisted === false && ' 瀏覽器還沒允許長期保存，把 App「安裝到主畫面」後通常就會允許。'}
        </p>
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
