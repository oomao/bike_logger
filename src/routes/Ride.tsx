import { useState } from 'react';
import { Link } from 'react-router-dom';
import { connect, discardRide, finishAndRelease, finishRide, reconnect, disconnect, rideMemberId, useBike } from '../lib/bike';
import { addMember, memberName, selectMember, useDb } from '../lib/store';
import { fmtDur } from '../lib/format';
import BackupReminder from '../components/BackupReminder';
import TodayStrip from '../components/TodayStrip';
import { ageOf, hrMax } from '../lib/suggest';

function Tile({ label, value, unit, big }: { label: string; value: string; unit?: string; big?: boolean }) {
  return (
    <div className="rounded-xl bg-stone-100 px-3 py-2.5 dark:bg-gray-800">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`font-bold tabular-nums leading-tight ${big ? 'text-4xl' : 'text-3xl'}`}>
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">{unit}</span>}
      </div>
    </div>
  );
}

const num = (v: number | null, digits = 0) => (v == null ? '—' : digits ? v.toFixed(digits) : String(Math.round(v)));

// 第一次打開還沒有家人：直接在這裡打名字，不用先切到家人頁
let justAdded: string | null = null;
function QuickAdd() {
  const [name, setName] = useState('');
  const add = () => {
    const id = addMember(name);
    if (id) justAdded = id;
  };
  return (
    <div>
      <p className="muted mb-2">第一次用？先打你的名字。</p>
      <div className="flex gap-2">
        <input className="input" value={name} maxLength={20} placeholder="例如：爸爸" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn-primary" onClick={add} disabled={!name.trim()}>開始</button>
      </div>
    </div>
  );
}

export default function Ride() {
  const bike = useBike();
  const db = useDb();
  const added = justAdded && db.members.length === 1 && db.members[0].id === justAdded && !db.members[0].birthYear ? justAdded : null;
  const { live, ride } = bike;
  const riderId = ride?.memberId ?? db.current;
  const age = ageOf(db.members.find((m) => m.id === riderId));
  const hrHigh = age != null && live.hr != null && live.hr > hrMax(age) * 0.9;

  const pick = (id: string) => {
    const riding = rideMemberId();
    if (riding && riding !== id) {
      if (!confirm(memberName(riding) + ' 正在騎，要先結束並儲存這趟再換人嗎？')) return;
      finishRide(false);
    }
    selectMember(id);
  };

  return (
    <div className="space-y-3">
      {!bike.supported && (
        <div className="rounded-xl border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/40">{bike.supportMsg}</div>
      )}

      {!ride && <BackupReminder />}

      {ride ? (
        // 騎乘中：誰在騎、連線狀態縮成一行，把課表和數字讓到上面
        <section className="card flex items-center gap-2 py-2.5">
          <span className="flex-1 text-sm">
            🚴 <b>{memberName(ride.memberId)}</b>
            <span className="ml-1 text-gray-500 dark:text-gray-400">{bike.connected ? '記錄中' : '已斷線，重新連線會接著記'}</span>
          </span>
          {bike.connected ? (
            <button className="btn btn-sm" onClick={() => disconnect()}>中斷</button>
          ) : (
            <button className="btn-primary btn-sm" onClick={() => reconnect()}>重新連線</button>
          )}
        </section>
      ) : (
        <>
          <section className="card">
            <h2 className="mb-2 font-semibold">誰要騎？</h2>
            {db.members.length ? (
              <div className="flex flex-wrap gap-2">
                {db.members.map((m) => (
                  <button key={m.id} className={m.id === db.current ? 'chip-on' : 'chip'} onClick={() => pick(m.id)}>
                    {m.name}
                  </button>
                ))}
              </div>
            ) : (
              <QuickAdd />
            )}
            {added && (
              <p className="muted mt-2">
                想讓建議更準？到 <Link to="/family" state={{ edit: added }} className="text-brand underline dark:text-brand-light">家人</Link> 頁填出生年、體重（選填）。
              </p>
            )}
          </section>

          <section className="card">
            {bike.connected ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">✓ 已連線，開始踩就會記錄</span>
                <button className="btn btn-sm" onClick={() => disconnect()}>中斷</button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary min-h-[52px] flex-1 text-base" onClick={() => connect(false)}>連線飛輪</button>
                {bike.hasDevice && <button className="btn min-h-[52px]" onClick={() => reconnect()}>重新連線</button>}
              </div>
            )}
            {!(bike.connected && !bike.status.err) && (
              <p className={`mt-2 min-h-[1.25rem] text-sm ${bike.status.err ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {bike.status.msg}
              </p>
            )}
          </section>
        </>
      )}

      <TodayStrip />

      <section className="card">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile big label="功率" value={num(live.power)} unit="W" />
          <Tile big label="踏頻" value={num(live.cadence)} unit="rpm" />
          <Tile label="速度" value={num(live.speed, 1)} unit="km/h" />
          <Tile label="阻力段數" value={num(live.resistance)} />
          <Tile label="本趟時間" value={ride ? fmtDur(ride.active) : '0:00'} />
          <Tile label="距離" value={ride ? (ride.distance / 1000).toFixed(2) : '0.00'} unit="km" />
          <Tile label="卡路里" value={ride ? String(Math.round(ride.kcal)) : '0'} unit="kcal" />
          <Tile label="心率" value={num(live.hr)} unit="bpm" />
        </div>

        {hrHigh && (
          <p className="mt-2 rounded-xl border-l-4 border-red-500 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
            心率 {live.hr}，超過你最大心率的 90%，放慢一點。
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            <span className="text-gray-500 dark:text-gray-400">騎乘者：</span>
            <span className="font-semibold">{ride ? memberName(ride.memberId) : db.current ? memberName(db.current) : '尚未選擇'}</span>
            <span className="ml-1 text-gray-500 dark:text-gray-400">
              {ride ? (ride.idleLeft != null ? `（暫停中，${ride.idleLeft} 秒後自動結束）` : '（記錄中）') : ''}
            </span>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={!ride} onClick={finishAndRelease}>結束並儲存</button>
            <button className="btn-danger" disabled={!ride} onClick={() => confirm('放棄這趟，不儲存？') && discardRide()}>放棄</button>
          </div>
        </div>
        {db.rides.length < 3 && <p className="muted mt-2">
          開始踩就會自動計時，停踩超過 60 秒自動存檔（不到 60 秒不存）。換人前按「結束並儲存」，手機會放開飛輪的藍牙，下一支手機才連得上。
        </p>}
      </section>
    </div>
  );
}
