// 家人與騎乘紀錄，存在這支手機的 IndexedDB（空間比 localStorage 大很多，放得下每秒取樣）
// 第一次啟動時會把單頁版存在 localStorage 'bikeLogger.v1' 的舊資料搬過來
import { useSyncExternalStore } from 'react';

export interface Member {
  id: string;
  name: string;
  // 以下都選填，給「今日建議」用
  birthYear?: number;
  weights?: [number, number][]; // [記錄時間, 公斤]，保留歷史才不會改了體重就讓舊的 W/kg 跟著變
  restDays?: string[];          // 自己按「今天休息」的日子，YYYY-MM-DD
  safetyAck?: boolean;          // 看過安全提醒了
  feel?: [string, number];      // 今天騎前自評 [YYYY-MM-DD, 1~4]
  bigText?: boolean;            // 大字模式；沒設定時 65 歲以上自動開
  sex?: 'm' | 'f';              // 算體脂、基礎代謝用
  height?: number;              // 公分
  tapes?: [number, Tape][];     // 皮尺量的圍度 [記錄時間, 公分]，同一天只留一筆
}

// 圍度（公分）
export interface Tape { chest?: number; waist?: number; belly?: number; hip?: number }
export const TAPE_ITEMS: [keyof Tape, string][] = [['chest', '胸圍'], ['waist', '腰圍'], ['belly', '腹圍'], ['hip', '臀圍']];

export const latestWeight = (m: Member) => m.weights?.[m.weights.length - 1]?.[1] ?? null;

// 取樣點：[第幾秒, 功率, 踏頻, 速度, 心率, 累計距離m, 阻力]
// 0.3 版起每秒一筆；更早的紀錄是每 5 秒一筆
export type Sample = [number, number | null, number | null, number | null, number | null, number, (number | null)?];

export interface Ride {
  id: string;
  memberId: string;
  start: number;
  end: number;
  duration: number;   // 有在踩的秒數
  distance: number;   // m
  kcal: number;
  avgPower: number | null;
  maxPower: number | null;
  avgCadence: number | null;
  avgSpeed: number | null;
  avgHr: number | null;      // 只算有量到心率的時間
  hrSeconds?: number;        // 有量到心率的秒數
  avgResistance?: number | null;
  bikeKcal?: number | null;  // 錶頭自己算的卡路里（跟功率換算的並列參考）
  device?: string;           // 飛輪型號，例如 FIT3104B3
  samples: Sample[];
}

export interface Db {
  members: Member[];
  current: string | null;
  rides: Ride[];
  lastBackup?: number | null; // 上次匯出備份的時間
}

const LEGACY_KEY = 'bikeLogger.v1';
const IDB_NAME = 'bike-logger';
const IDB_STORE = 'kv';
const IDB_KEY = 'db';

const empty = (): Db => ({ members: [], current: null, rides: [], lastBackup: null });
const valid = (d: unknown): d is Db => !!d && Array.isArray((d as Db).members) && Array.isArray((d as Db).rides);

let db: Db = empty();
let useLocalStorage = false; // IndexedDB 打不開時退回 localStorage
const listeners = new Set<() => void>();

// 整個 App 共用一個資料庫連線，不要每次存檔都開新的
let idbPromise: Promise<IDBDatabase> | null = null;
function openIdb(): Promise<IDBDatabase> {
  idbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((e) => {
    idbPromise = null;
    throw e;
  });
  return idbPromise;
}

async function idbGet(): Promise<unknown> {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const req = idb.transaction(IDB_STORE).objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(value: Db): Promise<void> {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 騎到一半的進度，App 被系統關掉時用來救回
const DRAFT_KEY = 'draft';

async function idbRaw(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<unknown> {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const req = fn(idb.transaction(IDB_STORE, mode).objectStore(IDB_STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export const saveDraft = (value: object) => idbRaw('readwrite', (s) => s.put(value, DRAFT_KEY));
export const loadDraft = () => idbRaw('readonly', (s) => s.get(DRAFT_KEY));
export const clearDraft = () => idbRaw('readwrite', (s) => s.delete(DRAFT_KEY));

function loadLegacy(): Db | null {
  try {
    const d = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
    return valid(d) ? d : null;
  } catch {
    return null;
  }
}

/** App 啟動前呼叫一次，把資料讀進記憶體 */
export async function initStore() {
  try {
    const saved = await idbGet();
    if (valid(saved)) {
      db = saved;
    } else {
      db = loadLegacy() ?? empty();
      await idbPut(db);
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch {
    useLocalStorage = true;
    db = loadLegacy() ?? empty();
  }
  // 請瀏覽器把這個 App 的資料標成「不要自動清除」
  navigator.storage?.persist?.().catch(() => {});
}

function commit(next: Db) {
  db = next;
  listeners.forEach((l) => l());
  const fail = (e: unknown) => alert('儲存失敗（' + (e as Error).message + '），請先到「家人」頁匯出備份。');
  if (useLocalStorage) {
    try { localStorage.setItem(LEGACY_KEY, JSON.stringify(db)); } catch (e) { fail(e); }
  } else {
    idbPut(db).catch(fail);
  }
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const getDb = () => db;
export const memberName = (id: string | null) => db.members.find((m) => m.id === id)?.name ?? '（已刪除）';

export function useDb(): Db {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => db,
  );
}

export function addMember(name: string): string | null {
  name = name.trim().slice(0, 20);
  if (!name || db.members.some((m) => m.name === name)) return null;
  const m = { id: uid(), name };
  commit({ ...db, members: [...db.members, m], current: m.id });
  return m.id;
}

export function selectMember(id: string) {
  commit({ ...db, current: id });
}

export function deleteMember(id: string) {
  const members = db.members.filter((m) => m.id !== id);
  commit({
    ...db,
    members,
    rides: db.rides.filter((r) => r.memberId !== id),
    current: db.current === id ? members[0]?.id ?? null : db.current,
  });
}

function updateMember(id: string, patch: Partial<Member>) {
  commit({ ...db, members: db.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
}

/** 出生年、性別、身高；體重和圍度在「體重」頁記，不會因為這裡清空而被刪掉 */
export function setProfile(id: string, p: { birthYear: number | null; sex: 'm' | 'f' | null; height: number | null }) {
  updateMember(id, { birthYear: p.birthYear ?? undefined, sex: p.sex ?? undefined, height: p.height ?? undefined });
}

// ---------- 體重、圍度紀錄 ----------
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

/** 同一天只留一筆，後輸入的蓋掉前面的；依時間排好 */
function putDay<T>(list: [number, T][] | undefined, ts: number, v: T): [number, T][] {
  return [...(list ?? []).filter(([t]) => !sameDay(t, ts)), [ts, v] as [number, T]].sort((a, b) => a[0] - b[0]);
}

/** 兩份依時間的紀錄合併：同一時間點只留一筆 */
function unionLog<T>(a: [number, T][] | undefined, b: [number, T][] | undefined): [number, T][] | undefined {
  const seen = new Set<number>();
  const out = [...(a ?? []), ...(b ?? [])].filter(([t]) => Number.isFinite(t) && !seen.has(t) && !!seen.add(t));
  return out.length ? out.sort((x, y) => x[0] - y[0]) : undefined;
}

export const logWeight = (id: string, kg: number, ts = Date.now()) =>
  updateMember(id, { weights: putDay(db.members.find((m) => m.id === id)?.weights, ts, kg) });
export const removeWeight = (id: string, ts: number) =>
  updateMember(id, { weights: db.members.find((m) => m.id === id)?.weights?.filter(([t]) => t !== ts) });
export const logTape = (id: string, tape: Tape, ts = Date.now()) =>
  updateMember(id, { tapes: putDay(db.members.find((m) => m.id === id)?.tapes, ts, tape) });
export const removeTape = (id: string, ts: number) =>
  updateMember(id, { tapes: db.members.find((m) => m.id === id)?.tapes?.filter(([t]) => t !== ts) });

export function toggleRestDay(id: string, day: string) {
  const days = db.members.find((m) => m.id === id)?.restDays ?? [];
  // 只留最近 60 筆，不讓它無限長大
  updateMember(id, { restDays: days.includes(day) ? days.filter((d) => d !== day) : [...days, day].slice(-60) });
}

export const setBigText = (id: string, v: boolean) => updateMember(id, { bigText: v });
export const ackSafety = (id: string) => updateMember(id, { safetyAck: true });
export const setFeel = (id: string, day: string, v: number) => updateMember(id, { feel: [day, v] });

export function addRide(r: Ride) {
  if (db.rides.some((x) => x.id === r.id)) return; // 救回的暫存可能已經存過
  commit({ ...db, rides: [...db.rides, r] });
}

export function deleteRide(id: string) {
  commit({ ...db, rides: db.rides.filter((r) => r.id !== id) });
}

export function markBackedUp() {
  commit({ ...db, lastBackup: Date.now() });
}

const bodyCount = (d: Db, after = 0) =>
  d.members.reduce((n, m) => n + [...(m.weights ?? []), ...(m.tapes ?? [])].filter(([t]) => t > after).length, 0);

/** 上次備份之後新增的紀錄數（騎乘＋體重＋圍度；補登過去日期的不算） */
export function unbackedRides(d: Db = db): number {
  return d.rides.filter((r) => r.end > (d.lastBackup ?? 0)).length + bodyCount(d, d.lastBackup ?? 0);
}

/** 全部紀錄數，備份提醒用 */
export const recordCount = (d: Db = db) => d.rides.length + bodyCount(d);

// ---------- 匯出 / 匯入 ----------
export interface ExportFile { app: 'bike-logger'; version: 2; exportedAt: number; members: Member[]; rides: Ride[] }

/** memberId 為 null 時匯出全家 */
export function exportData(memberId: string | null): ExportFile {
  return {
    app: 'bike-logger',
    version: 2,
    exportedAt: Date.now(),
    members: memberId ? db.members.filter((m) => m.id === memberId) : db.members,
    rides: memberId ? db.rides.filter((r) => r.memberId === memberId) : db.rides,
  };
}

const asSex = (v: unknown): 'm' | 'f' | undefined => {
  const c = String(v ?? '').toLowerCase()[0];
  return c === 'm' || c === 'f' ? c : undefined;
};
const asHeight = (v: unknown) => (typeof v === 'number' && v >= 80 && v <= 230 ? v : undefined);

/** 舊的獨立體脂計 App（scale-logger）的備份：體重 → 體重紀錄，皮尺 → 圍度（只收胸、腰、腹、臀） */
function importScale(d: { members?: unknown; recs?: unknown; tapes?: unknown }): string {
  if (!Array.isArray(d.members) || !Array.isArray(d.recs)) throw new Error('這不是體脂計紀錄的備份檔');
  const members = [...db.members];
  const idMap = new Map<string, string>();
  let addM = 0;
  for (const m of d.members) {
    if (!m?.id || !m.name) continue;
    const name = String(m.name).slice(0, 20);
    let same = members.find((x) => x.name === name);
    if (!same) {
      same = { id: members.some((x) => x.id === m.id) ? uid() : m.id, name };
      members.push(same);
      addM++;
    }
    idMap.set(m.id, same.id);
    const i = members.indexOf(same);
    members[i] = {
      ...same,
      birthYear: same.birthYear ?? (Number.isInteger(m.birthYear) ? m.birthYear : undefined),
      sex: same.sex ?? asSex(m.sex),
      height: same.height ?? asHeight(m.height),
    };
  }
  // 舊 App 同一天可以量好幾次，這裡每人每天只留最後一筆
  const lastOfDay = <T extends { memberId: string; time: number }>(rows: unknown[]) => {
    const by = new Map<string, T>();
    for (const r of rows as T[]) {
      if (!r || !idMap.has(r.memberId) || !Number.isFinite(r.time)) continue;
      const k = idMap.get(r.memberId) + new Date(r.time).toDateString();
      if (!by.has(k) || by.get(k)!.time < r.time) by.set(k, r);
    }
    return [...by.values()];
  };
  let addW = 0, addT = 0;
  for (const r of lastOfDay<{ memberId: string; time: number; kg: number }>(d.recs)) {
    if (!(r.kg >= 20 && r.kg <= 300)) continue;
    const i = members.findIndex((x) => x.id === idMap.get(r.memberId));
    const before = members[i].weights?.length ?? 0;
    members[i] = { ...members[i], weights: unionLog(members[i].weights, [[r.time, r.kg]]) };
    addW += (members[i].weights?.length ?? 0) - before;
  }
  for (const r of lastOfDay<{ memberId: string; time: number; cm?: Record<string, number> }>(Array.isArray(d.tapes) ? d.tapes : [])) {
    const cm = r.cm ?? {};
    const t: Tape = { chest: cm.chest, waist: cm.waist, belly: cm.lowerAbdomen, hip: cm.hip };
    for (const k of Object.keys(t) as (keyof Tape)[]) if (!(t[k]! >= 10 && t[k]! <= 250)) delete t[k];
    if (!Object.keys(t).length) continue;
    const i = members.findIndex((x) => x.id === idMap.get(r.memberId));
    const before = members[i].tapes?.length ?? 0;
    members[i] = { ...members[i], tapes: unionLog(members[i].tapes, [[r.time, t]]) };
    addT += (members[i].tapes?.length ?? 0) - before;
  }
  commit({ ...db, members, current: db.current ?? members[0]?.id ?? null });
  return `匯入完成：新增 ${addM} 位家人、${addW} 筆體重、${addT} 筆圍度。`;
}

export function importData(text: string): string {
  const d = JSON.parse(text);
  if (d?.app === 'scale-logger') return importScale(d);
  if (!valid(d)) throw new Error('這不是飛輪紀錄的備份檔');
  const members = [...db.members];
  const rides = [...db.rides];
  const idMap = new Map<string, string>();
  let addM = 0, addR = 0, skipR = 0;
  for (const m of d.members) {
    if (!m?.id) continue;
    const same = members.find((x) => x.id === m.id) ?? members.find((x) => x.name === m.name);
    const body = {
      birthYear: Number.isInteger(m.birthYear) ? m.birthYear : undefined,
      sex: asSex(m.sex),
      height: asHeight(m.height),
      weights: Array.isArray(m.weights) ? unionLog(m.weights, []) : undefined,
      tapes: Array.isArray(m.tapes) ? unionLog(m.tapes, []) : undefined,
    };
    if (same) {
      idMap.set(m.id, same.id); // 同名的家人視為同一人，紀錄合併進去
      // 出生年、性別、身高：這支手機沒填才用備份檔的；體重和圍度依時間合併
      const i = members.indexOf(same);
      members[i] = {
        ...same,
        birthYear: same.birthYear ?? body.birthYear,
        sex: same.sex ?? body.sex,
        height: same.height ?? body.height,
        weights: unionLog(same.weights, body.weights),
        tapes: unionLog(same.tapes, body.tapes),
      };
    } else {
      members.push({ id: m.id, name: String(m.name).slice(0, 20), ...body });
      idMap.set(m.id, m.id);
      addM++;
    }
  }
  for (const r of d.rides) {
    if (!r?.id) continue;
    if (rides.some((x) => x.id === r.id)) { skipR++; continue; }
    rides.push({ ...r, memberId: idMap.get(r.memberId) ?? r.memberId });
    addR++;
  }
  commit({ ...db, members, rides, current: db.current ?? members[0]?.id ?? null });
  return `匯入完成：新增 ${addM} 位家人、${addR} 筆紀錄` + (skipR ? `（${skipR} 筆已經有了，略過）` : '') + '。';
}
