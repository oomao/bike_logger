// 家人與騎乘紀錄，存在這支手機的 localStorage
// key 沿用單頁版的 bikeLogger.v1，舊資料升級後還在
import { useSyncExternalStore } from 'react';

export interface Member { id: string; name: string }

// 取樣點：[第幾秒, 功率, 踏頻, 速度, 心率, 累計距離m, 阻力]
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
  avgHr: number | null;
  avgResistance?: number | null;
  samples: Sample[];
}

export interface Db { members: Member[]; current: string | null; rides: Ride[] }

const STORE_KEY = 'bikeLogger.v1';

function load(): Db {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (d && Array.isArray(d.members) && Array.isArray(d.rides)) return d;
  } catch {
    // 讀不到就用空的
  }
  return { members: [], current: null, rides: [] };
}

let db: Db = load();
const listeners = new Set<() => void>();

function commit(next: Db): boolean {
  db = next;
  listeners.forEach((l) => l());
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
    return true;
  } catch (e) {
    alert('儲存失敗（' + (e as Error).message + '），請先到「家人」頁匯出備份。');
    return false;
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
    members,
    rides: db.rides.filter((r) => r.memberId !== id),
    current: db.current === id ? members[0]?.id ?? null : db.current,
  });
}

export function addRide(r: Ride): boolean {
  return commit({ ...db, rides: [...db.rides, r] });
}

export function deleteRide(id: string) {
  commit({ ...db, rides: db.rides.filter((r) => r.id !== id) });
}

export function importDb(text: string): string {
  const d = JSON.parse(text);
  if (!d || !Array.isArray(d.members) || !Array.isArray(d.rides)) throw new Error('檔案格式不對');
  const members = [...db.members];
  const rides = [...db.rides];
  let addM = 0, addR = 0;
  for (const m of d.members) {
    if (m?.id && !members.some((x) => x.id === m.id)) { members.push({ id: m.id, name: String(m.name).slice(0, 20) }); addM++; }
  }
  for (const r of d.rides) {
    if (r?.id && !rides.some((x) => x.id === r.id)) { rides.push(r); addR++; }
  }
  commit({ members, rides, current: db.current ?? members[0]?.id ?? null });
  return '匯入完成：新增 ' + addM + ' 位家人、' + addR + ' 筆紀錄。';
}
