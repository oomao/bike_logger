// 藍牙健身器材封包解析：FTMS Indoor Bike Data、Cycling Power、CSC、心率
// 小野馬 Pro（FIT3104B3）實測 flags = 0x0BFE，每秒一包

export interface Reading {
  speed?: number;      // km/h
  cadence?: number;    // rpm
  distance?: number;   // m（錶頭累計）
  resistance?: number; // 段數
  power?: number;      // W
  kcal?: number;       // 錶頭累計大卡
  hr?: number;         // bpm，0 代表沒偵測到
}

export const full16 = (n: number) => '0000' + n.toString(16).padStart(4, '0') + '-0000-1000-8000-00805f9b34fb';
export const short16 = (uuid: string): number | null => {
  const m = /^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/.exec(uuid);
  return m ? parseInt(m[1], 16) : null;
};
export const hex = (dv: DataView) =>
  Array.from(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');

// FTMS Indoor Bike Data (0x2AD2)
export function parseIndoorBike(dv: DataView): Reading {
  const r: Reading = {};
  let o = 0;
  try {
    const f = dv.getUint16(o, true); o += 2;
    if (!(f & 0x0001)) { r.speed = dv.getUint16(o, true) / 100; o += 2; } // More Data=0 時才有瞬時速度
    if (f & 0x0002) o += 2;                                                 // 平均速度
    if (f & 0x0004) { r.cadence = dv.getUint16(o, true) / 2; o += 2; }
    if (f & 0x0008) o += 2;                                                 // 平均踏頻
    if (f & 0x0010) { r.distance = dv.getUint16(o, true) | (dv.getUint8(o + 2) << 16); o += 3; }
    if (f & 0x0020) { r.resistance = dv.getInt16(o, true); o += 2; }
    if (f & 0x0040) { r.power = dv.getInt16(o, true); o += 2; }
    if (f & 0x0080) o += 2;                                                 // 平均功率
    if (f & 0x0100) { const t = dv.getUint16(o, true); if (t !== 0xffff) r.kcal = t; o += 5; }
    if (f & 0x0200) { r.hr = dv.getUint8(o); o += 1; }
  } catch {
    // 封包比旗標描述的短，就回傳已解析的部分
  }
  return r;
}

// 曲柄轉數 → 踏頻（CPS / CSC 共用）
const crankState: Record<string, { revs: number; time: number; at: number; cad: number }> = {};
function crankCadence(key: string, revs: number, time: number): number | null {
  const now = Date.now();
  const prev = crankState[key];
  crankState[key] = { revs, time, at: now, cad: prev ? prev.cad : 0 };
  if (!prev) return null;
  const dRevs = (revs - prev.revs) & 0xffff;
  const dt = ((time - prev.time) & 0xffff) / 1024;
  if (dt > 0 && dRevs < 20) {
    crankState[key].cad = Math.round((60 * dRevs) / dt);
    return crankState[key].cad;
  }
  // 沒有新的踩踏事件：超過 3 秒沒變就視為 0
  crankState[key].at = prev.at;
  return now - prev.at > 3000 ? 0 : prev.cad;
}

// Cycling Power Measurement (0x2A63)
export function parseCyclingPower(dv: DataView): Reading {
  const r: Reading = {};
  try {
    const f = dv.getUint16(0, true);
    let o = 2;
    r.power = dv.getInt16(o, true); o += 2;
    if (f & 0x01) o += 1; // pedal power balance
    if (f & 0x04) o += 2; // accumulated torque
    if (f & 0x10) o += 6; // wheel revolution data
    if (f & 0x20) {
      const c = crankCadence('cps', dv.getUint16(o, true), dv.getUint16(o + 2, true));
      if (c !== null) r.cadence = c;
    }
  } catch {
    // 忽略不完整封包
  }
  return r;
}

// CSC Measurement (0x2A5B)
const WHEEL_M = 2.096;
const wheelState: { revs?: number; t?: number } = {};
export function parseCsc(dv: DataView): Reading {
  const r: Reading = {};
  try {
    const f = dv.getUint8(0);
    let o = 1;
    if (f & 0x01) {
      const revs = dv.getUint32(o, true), t = dv.getUint16(o + 4, true);
      o += 6;
      if (wheelState.t !== undefined && wheelState.revs !== undefined) {
        const dt = ((t - wheelState.t) & 0xffff) / 1024;
        const dr = revs - wheelState.revs;
        if (dt > 0 && dr >= 0) r.speed = Math.round(((dr * WHEEL_M) / dt) * 3.6 * 10) / 10;
      }
      wheelState.revs = revs; wheelState.t = t;
    }
    if (f & 0x02) {
      const c = crankCadence('csc', dv.getUint16(o, true), dv.getUint16(o + 2, true));
      if (c !== null) r.cadence = c;
    }
  } catch {
    // 忽略不完整封包
  }
  return r;
}

// Heart Rate Measurement (0x2A37)
export function parseHr(dv: DataView): Reading {
  try {
    const f = dv.getUint8(0);
    return { hr: f & 0x01 ? dv.getUint16(1, true) : dv.getUint8(1) };
  } catch {
    return {};
  }
}

// FTMS Feature (0x2ACC)
export function describeFtmsFeatures(dv: DataView) {
  const f = dv.getUint32(0, true), t = dv.byteLength >= 8 ? dv.getUint32(4, true) : 0;
  const has: string[] = [];
  if (f & (1 << 1)) has.push('踏頻');
  if (f & (1 << 2)) has.push('距離');
  if (f & (1 << 7)) has.push('阻力段數');
  if (f & (1 << 9)) has.push('卡路里');
  if (f & (1 << 10)) has.push('心率');
  if (f & (1 << 14)) has.push('功率');
  const ctrl: string[] = [];
  if (t & (1 << 2)) ctrl.push('設定阻力');
  if (t & (1 << 3)) ctrl.push('設定功率(ERG)');
  if (t & (1 << 13)) ctrl.push('模擬坡度(SIM)');
  return { data: has.join('、') || '（未標示）', control: ctrl.join('、') || '不支援' };
}
