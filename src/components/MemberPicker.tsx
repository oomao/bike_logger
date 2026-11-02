import { selectMember, useDb } from '../lib/store';

/** 頁面上方的家人切換；圖表、紀錄都只看同一個人，跟自己比 */
export default function MemberPicker() {
  const db = useDb();
  if (db.members.length <= 1) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {db.members.map((m) => (
        <button key={m.id} className={m.id === db.current ? 'chip-on' : 'chip'} onClick={() => selectMember(m.id)}>
          {m.name}
        </button>
      ))}
    </div>
  );
}
