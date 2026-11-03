// 「跟著建議騎」：選好的課表，依這趟有在踩的秒數推進（停踩不會偷跑）。
// 存在 localStorage，App 被系統關掉再打開還接得上；隔天自動作廢。
import { useSyncExternalStore } from 'react';
import type { Option, Step } from './suggest';
import { dayKey } from './suggest';

export interface Workout {
  memberId: string;
  title: string;
  steps: Step[];
  day: string;
  offset: number | null; // 開始時這趟已經踩了幾秒；還沒開始騎時是 null
}

const KEY = 'bikeLogger.workout';
const listeners = new Set<() => void>();

function load(): Workout | null {
  try {
    const w = JSON.parse(localStorage.getItem(KEY) || 'null') as Workout | null;
    return w && w.day === dayKey(Date.now()) ? w : null;
  } catch {
    return null;
  }
}

let current = load();

function set(w: Workout | null) {
  current = w;
  try {
    if (w) localStorage.setItem(KEY, JSON.stringify(w));
    else localStorage.removeItem(KEY);
  } catch { /* 存不了就只留在記憶體 */ }
  listeners.forEach((l) => l());
}

export function startWorkout(memberId: string, o: Option, rideActive: number | null) {
  set({ memberId, title: o.title, steps: o.steps, day: dayKey(Date.now()), offset: rideActive });
}

export const stopWorkout = () => set(null);

/** 騎乘開始時把課表接上；換人騎或這趟結束就收掉 */
export function syncWorkout(ride: { memberId: string; active: number } | null, hadRide: boolean) {
  if (!current) return;
  if (ride && current.offset == null && ride.memberId === current.memberId) set({ ...current, offset: ride.active });
  else if (!ride && hadRide && current.offset != null) set(null);
}

export function useWorkout(): Workout | null {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => current);
}

export interface Progress {
  index: number;      // 第幾段；超過最後一段代表完成
  step: Step | null;
  next: Step | null;
  left: number;       // 這段還剩幾秒
  done: number;       // 整份課表完成幾成 0~1
  total: number;      // 總秒數
}

export function progress(w: Workout, active: number): Progress {
  const total = w.steps.reduce((a, s) => a + s.minutes * 60, 0);
  let t = Math.max(0, active - (w.offset ?? active));
  const done = Math.min(1, t / total);
  for (let i = 0; i < w.steps.length; i++) {
    const len = w.steps[i].minutes * 60;
    if (t < len) return { index: i, step: w.steps[i], next: w.steps[i + 1] ?? null, left: len - t, done, total };
    t -= len;
  }
  return { index: w.steps.length, step: null, next: null, left: 0, done: 1, total };
}
