import { Link } from 'react-router-dom';
import { connect, discardRide, finishAndRelease, finishRide, reconnect, disconnect, rideMemberId, useBike } from '../lib/bike';
import { memberName, selectMember, useDb } from '../lib/store';
import { fmtDur } from '../lib/format';

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

export default function Ride() {
  const bike = useBike();
  const db = useDb();
  const { live, ride } = bike;

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
          <p className="muted">
            還沒有家人，先到 <Link to="/family" className="text-brand underline dark:text-brand-light">家人</Link> 頁新增。
          </p>
        )}
      </section>

      <section className="card">
        <div className="flex flex-wrap gap-2">
          {bike.connected ? (
            <button className="btn" onClick={() => disconnect()}>中斷</button>
          ) : (
            <>
              <button className="btn-primary" onClick={() => connect(false)}>連線飛輪</button>
              {bike.hasDevice && <button className="btn" onClick={() => reconnect()}>重新連線</button>}
            </>
          )}
        </div>
        <p className={`mt-2 min-h-[1.25rem] text-sm ${bike.status.err ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {bike.status.msg}
        </p>
      </section>

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
        <p className="muted mt-2">
          開始踩就會自動計時，停踩超過 60 秒自動存檔（不到 60 秒不存）。換人前按「結束並儲存」，手機會放開飛輪的藍牙，下一支手機才連得上。
        </p>
      </section>
    </div>
  );
}
