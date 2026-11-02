// 飛輪連線與騎乘計時。整個 App 共用一個實例，切換分頁也不會斷線。
import { useSyncExternalStore } from 'react';
import {
  describeFtmsFeatures, hex, parseCsc, parseCyclingPower, parseHr, parseIndoorBike, short16, type Reading,
} from './ftms';
import { addRide, clearDraft, getDb, loadDraft, memberName, saveDraft, uid, type Sample } from './store';
import { fmtDur } from './format';

const IDLE_SEC = 60;      // 停踩多久自動結束
const MIN_SAVE_SEC = 60;  // 少於這個秒數不存
const MAX_GAP_SEC = 5;    // 兩包數據間隔超過這麼久（斷訊）就不補算
const DRAFT_EVERY_SEC = 30; // 每騎多久暫存一次進度
const STALE_MS = 3000;   // 超過這麼久沒收到數據就當作停止
const HR_STALE_MS = 5000; // 心率只有手放在感測器上才有

const SVC = { FTMS: 0x1826, CPS: 0x1818, CSC: 0x1816, HRS: 0x180d, DIS: 0x180a, BAT: 0x180f };
// 常見中國/台灣廠商自訂服務，列出來方便診斷
const VENDOR_SVCS = [0xfff0, 0xffe0, 0xff00, 0xffb0, 0xfee7];
const SVC_NAMES: Record<number, string> = {
  0x1826: '健身器材 FTMS', 0x1818: '功率 Cycling Power', 0x1816: '速度/踏頻 CSC',
  0x180d: '心率', 0x180a: '裝置資訊', 0x180f: '電池',
};

type Source = 'ftms' | 'cps' | 'csc';

export interface Diag {
  name: string;
  maker?: string;
  model?: string;
  firmware?: string;
  services: string[];
  ftms?: { data: string; control: string };
  controlPoint?: boolean;
  resRange?: string;
  vendorChars?: string[];
}

interface RideState {
  id: string; memberId: string; start: number; lastMove: number; lastTick: number; active: number;
  work: number; intDist: number; bikeDist: number; bikeKcal: number;
  lastBikeDist: number | null; lastBikeKcal: number | null;
  pSum: number; pN: number; maxP: number; cSum: number; cN: number; sSum: number; sN: number;
  hrSum: number; hrN: number; rSum: number; rN: number; samples: Sample[];
}

export interface BikeSnapshot {
  supported: boolean;
  supportMsg: string;
  connected: boolean;
  hasDevice: boolean;
  status: { msg: string; err: boolean };
  live: { power: number | null; cadence: number | null; speed: number | null; resistance: number | null; hr: number | null };
  ride: { memberId: string; active: number; distance: number; kcal: number; idleLeft: number | null; hrSeconds: number } | null;
  source: Source | null;
  diag: Diag | null;
  raw: string[];
}

// ---------- 內部狀態 ----------
let device: BluetoothDevice | null = null;
let connected = false;
let source: Source | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let wakeLock: WakeLockSentinel | null = null;
let diag: Diag | null = null;
let status = { msg: '請先踩幾下讓錶頭亮起來，再按「連線飛輪」。', err: false };
let ride: RideState | null = null;
const rawLines: string[] = [];
const live: Reading & { at: number; hrAt: number } = { at: 0, hrAt: 0 };

const listeners = new Set<() => void>();
let snapshot: BikeSnapshot = build();

function supportMessage(): string {
  if (!window.isSecureContext) return '這個網址不是 https，瀏覽器不允許使用藍牙。';
  if (!navigator.bluetooth) return '這個瀏覽器不支援 Web Bluetooth，請用 Android 手機上的 Chrome 開啟。';
  return '';
}

const currentHr = () => (live.hr && live.hr > 0 && Date.now() - live.hrAt < HR_STALE_MS ? live.hr : null);
const rideDistance = (r: RideState) => (r.bikeDist > 0 ? r.bikeDist : r.intDist);
const rideKcal = (r: RideState) => (r.work > 0 ? r.work / 1000 : r.bikeKcal); // 功率×時間(kJ) 約等於消耗大卡

function build(): BikeSnapshot {
  const now = Date.now();
  const fresh = connected && now - live.at < STALE_MS;
  const v = (x: number | undefined) => (!connected ? null : !fresh ? 0 : x ?? null);
  const supportMsg = supportMessage();
  return {
    supported: !supportMsg,
    supportMsg,
    connected,
    hasDevice: !!device,
    status,
    live: {
      power: v(live.power), cadence: v(live.cadence), speed: v(live.speed),
      resistance: connected ? live.resistance ?? null : null,
      hr: connected ? currentHr() : null,
    },
    ride: ride && {
      memberId: ride.memberId,
      active: Math.floor(ride.active),
      hrSeconds: ride.hrN,
      distance: rideDistance(ride),
      kcal: rideKcal(ride),
      idleLeft: now - ride.lastMove >= 3000 ? Math.max(0, IDLE_SEC - Math.floor((now - ride.lastMove) / 1000)) : null,
    },
    source,
    diag,
    raw: rawLines.slice(),
  };
}

function emit() {
  snapshot = build();
  listeners.forEach((l) => l());
}

function setStatus(msg: string, err = false) {
  status = { msg, err };
  emit();
}

function logRaw(label: string, dv: DataView) {
  const t = new Date().toLocaleTimeString('zh-TW', { hour12: false });
  rawLines.unshift(t + '  ' + label + '  ' + hex(dv));
  if (rawLines.length > 40) rawLines.length = 40;
}

// ---------- 連線 ----------
export async function connect(scanAll: boolean) {
  if (supportMessage()) return emit();
  const optionalServices = [...Object.values(SVC), ...VENDOR_SVCS];
  const opts: RequestDeviceOptions = scanAll
    ? { acceptAllDevices: true, optionalServices }
    : { filters: [{ services: [SVC.FTMS] }, { services: [SVC.CPS] }, { services: [SVC.CSC] }], optionalServices };
  try {
    setStatus('請在跳出的清單選擇飛輪（要邊踩邊選，錶頭沒電就搜不到）…');
    const d = await navigator.bluetooth.requestDevice(opts);
    if (device && device !== d) disconnect();
    device = d;
    device.addEventListener('gattserverdisconnected', onDisconnected);
    await setupGatt();
  } catch (e) {
    const err = e as DOMException;
    if (err.name === 'NotFoundError') setStatus(scanAll ? '沒有選擇裝置。' : '沒有選擇裝置。如果清單裡找不到飛輪，到「家人」頁的診斷區試試「列出所有裝置」。');
    else if (err.name === 'SecurityError') setStatus('瀏覽器擋住了藍牙（' + err.message + '）。請直接用 Chrome 開啟。', true);
    else setStatus('連線失敗：' + err.message, true);
  }
}

async function setupGatt() {
  if (!device?.gatt) return;
  setStatus('連線中…');
  const server = await device.gatt.connect();
  connected = true;
  source = null;
  diag = { name: device.name || '（未命名）', services: [] };
  const services = await server.getPrimaryServices().catch(() => [] as BluetoothRemoteGATTService[]);
  // FTMS 優先處理，其次功率、踏頻
  const rank = (s: BluetoothRemoteGATTService) => ({ [SVC.FTMS]: 0, [SVC.CPS]: 1, [SVC.CSC]: 2 } as Record<number, number>)[short16(s.uuid) ?? -1] ?? 9;
  services.sort((a, b) => rank(a) - rank(b));

  for (const s of services) {
    const id = short16(s.uuid);
    const label = id === null ? s.uuid : SVC_NAMES[id] ? SVC_NAMES[id] + ' (0x' + id.toString(16).toUpperCase() + ')' : '0x' + id.toString(16).toUpperCase();
    diag.services.push(label);
    try {
      for (const c of await s.getCharacteristics()) await setupChar(id, c);
    } catch (e) {
      diag.services[diag.services.length - 1] += '（讀取失敗：' + (e as Error).message + '）';
    }
  }

  if (!source) {
    setStatus('已連上「' + diag.name + '」，但找不到標準的騎乘數據服務，請到「家人」頁看診斷資訊。', true);
  } else {
    const label = { ftms: 'FTMS', cps: '功率服務', csc: '踏頻服務' }[source];
    setStatus('已連上「' + diag.name + '」，使用 ' + label + ' 讀取數據。開始踩就會自動計時。');
  }
  requestWakeLock();
}

function listen(c: BluetoothRemoteGATTCharacteristic, label: string, parse: (dv: DataView) => Reading, src: Source | 'hr') {
  c.addEventListener('characteristicvaluechanged', (e) => {
    const dv = (e.target as BluetoothRemoteGATTCharacteristic).value!;
    if (src !== 'hr') logRaw(label, dv);
    applyData(parse(dv), src);
  });
  return c.startNotifications();
}

async function setupChar(svcId: number | null, c: BluetoothRemoteGATTCharacteristic) {
  const cid = short16(c.uuid);
  const p = c.properties;
  const canNotify = p.notify || p.indicate;
  const claim = (s: Source) => { if (!source) source = s; };

  if (svcId === SVC.FTMS) {
    if (cid === 0x2acc && p.read) diag!.ftms = describeFtmsFeatures(await c.readValue());
    else if (cid === 0x2ad6 && p.read) {
      const dv = await c.readValue();
      diag!.resRange = dv.getInt16(0, true) / 10 + ' ～ ' + dv.getInt16(2, true) / 10;
    } else if (cid === 0x2ad9) diag!.controlPoint = true;
    else if (cid === 0x2ad2 && canNotify) { await listen(c, 'FTMS', parseIndoorBike, 'ftms'); claim('ftms'); }
    return;
  }
  if (svcId === SVC.CPS && cid === 0x2a63 && canNotify) { await listen(c, 'CPS', parseCyclingPower, 'cps'); claim('cps'); return; }
  if (svcId === SVC.CSC && cid === 0x2a5b && canNotify) { await listen(c, 'CSC', parseCsc, 'csc'); claim('csc'); return; }
  if (svcId === SVC.HRS && cid === 0x2a37 && canNotify) { await listen(c, 'HR', parseHr, 'hr'); return; }
  if (svcId === SVC.DIS && p.read && (cid === 0x2a29 || cid === 0x2a24 || cid === 0x2a26)) {
    const text = new TextDecoder().decode(await c.readValue()).replace(/\0/g, '').trim();
    if (cid === 0x2a29) diag!.maker = text;
    else if (cid === 0x2a24) diag!.model = text;
    else diag!.firmware = text;
    return;
  }
  if (svcId === SVC.BAT || svcId === SVC.DIS) return;
  // 私有服務：列出特徵並訂閱，原始封包寫進診斷紀錄
  const props = (['read', 'write', 'writeWithoutResponse', 'notify', 'indicate'] as const).filter((k) => p[k]);
  (diag!.vendorChars ??= []).push(c.uuid + ' [' + props.join(',') + ']');
  if (canNotify) {
    c.addEventListener('characteristicvaluechanged', (e) => logRaw(c.uuid.slice(4, 8), (e.target as BluetoothRemoteGATTCharacteristic).value!));
    await c.startNotifications().catch(() => {});
  }
}

function applyData(r: Reading, src: Source | 'hr') {
  // 有 FTMS 時，其他來源只補心率
  if (src !== 'hr' && source && src !== source) return;
  Object.assign(live, r);
  live.at = Date.now();
  if (r.hr && r.hr > 0) live.hrAt = live.at;
  if (src !== 'hr') accumulate(live.at); // 心率帶的封包不推進騎乘時間
}

function onDisconnected() {
  connected = false;
  if (ride) {
    setStatus('藍牙斷線了（自發電錶頭停踩會斷電），繼續踩會自動重新連線。');
    scheduleReconnect();
  } else {
    setStatus('已斷線。下一位請先踩幾下讓錶頭亮起來，再按「重新連線」。');
  }
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(async () => {
    if (connected || !device || !ride) return;
    try { await setupGatt(); } catch { scheduleReconnect(); }
  }, 4000);
}

export async function reconnect() {
  if (!device) return connect(false);
  try { await setupGatt(); } catch (e) {
    setStatus('重新連線失敗：' + (e as Error).message + '。請確認錶頭有亮，或改按「連線飛輪」重新選擇。', true);
  }
}

export function disconnect() {
  clearTimeout(reconnectTimer);
  if (device?.gatt?.connected) device.gatt.disconnect();
  connected = false;
  emit();
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch {
    // 拿不到就算了，只是螢幕可能會關
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && connected) requestWakeLock();
});

// ---------- 騎乘計時 ----------
function startRide(memberId: string) {
  const now = Date.now();
  ride = {
    id: uid(), memberId, start: now, lastMove: now, lastTick: 0, active: 0, work: 0, intDist: 0, bikeDist: 0, bikeKcal: 0,
    lastBikeDist: null, lastBikeKcal: null, pSum: 0, pN: 0, maxP: 0, cSum: 0, cN: 0, sSum: 0, sN: 0,
    hrSum: 0, hrN: 0, rSum: 0, rN: 0, samples: [],
  };
}

/**
 * 每收到一包飛輪數據就累加一次（約每秒一包）。
 * 不靠 setInterval：App 切到背景時計時器會被瀏覽器放慢，但藍牙通知照樣會進來。
 */
function accumulate(now: number) {
  const moving = (live.cadence ?? 0) > 0 || (live.speed ?? 0) > 0 || (live.power ?? 0) > 0;

  if (moving && !ride) {
    const current = getDb().current;
    if (current) startRide(current);
    else if (!status.err) setStatus('請先在「家人」頁選擇騎乘者，才會開始記錄。', true);
  }
  if (!ride) return;

  const r = ride;
  // 兩包之間的實際間隔；第一包算 1 秒，斷訊太久的空檔不補
  const dt = r.lastTick === 0 ? 1 : Math.min(MAX_GAP_SEC, Math.max(0, (now - r.lastTick) / 1000));
  r.lastTick = now;
  if (!moving) return;

  {
    // 只在有踩的時候累加
    const prevSec = Math.floor(r.active);
    r.active += dt;
    r.lastMove = now;
    if (live.power != null && live.power >= 0) { r.work += live.power * dt; r.pSum += live.power * dt; r.pN += dt; r.maxP = Math.max(r.maxP, live.power); }
    if (live.cadence && live.cadence > 0) { r.cSum += live.cadence * dt; r.cN += dt; }
    if (live.speed != null) { r.intDist += (live.speed / 3.6) * dt; r.sSum += live.speed * dt; r.sN += dt; }
    if (live.resistance != null) { r.rSum += live.resistance * dt; r.rN += dt; }
    const hr = currentHr();
    if (hr) { r.hrSum += hr * dt; r.hrN += dt; }
    if (live.distance != null) {
      const d = live.distance - (r.lastBikeDist ?? live.distance);
      if (d >= 0 && d < 100) r.bikeDist += d; // 錶頭歸零或跳動就不累加
      r.lastBikeDist = live.distance;
    }
    if (live.kcal != null) {
      const k = live.kcal - (r.lastBikeKcal ?? live.kcal);
      if (k >= 0 && k < 20) r.bikeKcal += k;
      r.lastBikeKcal = live.kcal;
    }
    // 每秒一筆取樣，圖表與 TCX 都用它，不浪費任何數據
    if (Math.floor(r.active) > prevSec) {
      r.samples.push([Math.floor(r.active), live.power ?? null, live.cadence ?? null, live.speed ?? null, hr, Math.round(rideDistance(r)), live.resistance ?? null]);
    }
    // 每騎 30 秒暫存一次進度，App 被系統關掉也救得回來
    if (Math.floor(r.active / DRAFT_EVERY_SEC) > Math.floor(prevSec / DRAFT_EVERY_SEC)) persistDraft();
  }
}

/** 每秒更新畫面、檢查是否停踩太久；在背景被放慢也沒關係，只影響自動結束的時間點 */
function tick() {
  if (ride && Date.now() - ride.lastMove > IDLE_SEC * 1000) finishRide(true);
  emit();
}

// ---------- 進度暫存與救回 ----------
function persistDraft() {
  if (ride) saveDraft(ride).catch(() => {});
}

// 切到其他 App、關閉分頁前都先存一次
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persistDraft();
  else tick(); // 回到前景時立刻檢查是否該自動結束
});
window.addEventListener('pagehide', persistDraft);

/**
 * App 啟動時呼叫：上次騎到一半 App 被關掉的話，把那趟救回來。
 * 停踩超過 60 秒的直接存成紀錄；剛剛還在騎的就接著記。
 */
export async function recoverDraft() {
  const d = (await loadDraft().catch(() => null)) as RideState | null;
  if (!d || !d.id || ride) return;
  if (Date.now() - d.lastMove > IDLE_SEC * 1000) {
    ride = d;
    finishRide(false);
    if (Math.round(d.active) >= MIN_SAVE_SEC) setStatus('上次騎乘 App 被關掉了，已自動救回並儲存（' + fmtDur(Math.round(d.active)) + '）。');
  } else {
    ride = { ...d, lastTick: Date.now() };
    setStatus('已接續剛剛的騎乘，請重新連線飛輪。');
  }
}

export function finishRide(auto = false) {
  if (!ride) return;
  const r = ride;
  ride = null;
  clearTimeout(reconnectTimer);
  clearDraft().catch(() => {});
  const duration = Math.round(r.active);
  if (duration < MIN_SAVE_SEC) {
    setStatus('這趟不到 ' + MIN_SAVE_SEC + ' 秒，沒有存檔。');
    return;
  }
  addRide({
    id: r.id, memberId: r.memberId, start: r.start, end: r.lastMove, duration,
    distance: Math.round(rideDistance(r)), kcal: Math.round(rideKcal(r)),
    avgPower: r.pN ? Math.round(r.pSum / r.pN) : null, maxPower: r.pN ? r.maxP : null,
    avgCadence: r.cN ? Math.round(r.cSum / r.cN) : null,
    avgSpeed: r.sN ? Math.round((r.sSum / r.sN) * 10) / 10 : null,
    avgHr: r.hrN ? Math.round(r.hrSum / r.hrN) : null,
    hrSeconds: Math.round(r.hrN),
    avgResistance: r.rN ? Math.round((r.rSum / r.rN) * 10) / 10 : null,
    bikeKcal: r.lastBikeKcal != null ? Math.round(r.bikeKcal) : null,
    device: diag?.model || diag?.name,
    samples: r.samples,
  });
  setStatus((auto ? '停踩超過 ' + IDLE_SEC + ' 秒，' : '') + '已儲存 ' + memberName(r.memberId) + ' 的紀錄（' + fmtDur(duration) + '）。');
}

/** 結束這趟並放開藍牙，讓下一支手機可以連 */
export function finishAndRelease() {
  finishRide(false);
  disconnect();
  setStatus(status.msg + ' 已放開飛輪，下一位可以連線了。');
}

export function discardRide() {
  ride = null;
  clearTimeout(reconnectTimer);
  clearDraft().catch(() => {});
  setStatus('已放棄這趟。');
}

export const rideMemberId = () => ride?.memberId ?? null;

export function useBike(): BikeSnapshot {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => snapshot,
  );
}

setInterval(tick, 1000);

// 開發時可在 console 模擬飛輪封包：__bike.feed({ power: 80, cadence: 70 })
if (import.meta.env.DEV) {
  (window as unknown as { __bike: object }).__bike = { feed: (r: Reading) => applyData(r, 'ftms'), state: () => ride };
}
