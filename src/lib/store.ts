// 家人與騎乘紀錄，存在這支手機的 IndexedDB（空間比 localStorage 大很多，放得下每秒取樣）
// 第一次啟動時會把單頁版存在 localStorage 'bikeLogger.v1' 的舊資料搬過來
import { useSyncExternalStore } from 'react';

export interface Member { id: string; name: string }

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

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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

export function addRide(r: Ride) {
  commit({ ...db, rides: [...db.rides, r] });
}

export function deleteRide(id: string) {
  commit({ ...db, rides: db.rides.filter((r) => r.id !== id) });
}

export function markBackedUp() {
  commit({ ...db, lastBackup: Date.now() });
}

/** 上次備份之後新增的紀錄數 */
export function unbackedRides(d: Db = db): number {
  return d.rides.filter((r) => r.end > (d.lastBackup ?? 0)).length;
}

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

export function importData(text: string): string {
  const d = JSON.parse(text);
  if (!valid(d)) throw new Error('這不是飛輪紀錄的備份檔');
  const members = [...db.members];
  const rides = [...db.rides];
  const idMap = new Map<string, string>();
  let addM = 0, addR = 0, skipR = 0;
  for (const m of d.members) {
    if (!m?.id) continue;
    const same = members.find((x) => x.id === m.id) ?? members.find((x) => x.name === m.name);
    if (same) {
      idMap.set(m.id, same.id); // 同名的家人視為同一人，紀錄合併進去
    } else {
      members.push({ id: m.id, name: String(m.name).slice(0, 20) });
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
