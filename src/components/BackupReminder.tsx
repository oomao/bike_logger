import { useState } from 'react';
import { unbackedRides, useDb } from '../lib/store';
import { canShareFiles, saveBackup } from '../lib/backup';

const REMIND_AFTER_RIDES = 5;
const REMIND_AFTER_DAYS = 14;

/** 紀錄只存在手機裡，累積一段時間沒備份就提醒一次 */
export default function BackupReminder() {
  const db = useDb();
  const [hidden, setHidden] = useState(false);
  const pending = unbackedRides(db);
  const days = db.lastBackup ? (Date.now() - db.lastBackup) / 86400000 : Infinity;
  const due = pending >= REMIND_AFTER_RIDES || (pending > 0 && days >= REMIND_AFTER_DAYS && db.rides.length >= 3);
  if (hidden || !due) return null;

  const who = db.members.length === 1 ? db.members[0].id : null;
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/40">
      <p>
        💾 有 <b>{pending}</b> 筆紀錄還沒備份
        {db.lastBackup ? `（上次備份是 ${Math.floor(days)} 天前）` : '（還沒備份過）'}。紀錄只存在這支手機，換手機或清除資料就會不見。
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {canShareFiles() && <button className="btn-primary btn-sm" onClick={() => saveBackup(who, 'share')}>備份到雲端 / LINE</button>}
        <button className={canShareFiles() ? 'btn btn-sm' : 'btn-primary btn-sm'} onClick={() => saveBackup(who, 'download')}>下載備份檔</button>
        <button className="btn btn-sm" onClick={() => setHidden(true)}>稍後</button>
      </div>
    </div>
  );
}
