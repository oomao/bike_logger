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

// 換段提醒的聲音；AudioContext 要在使用者按按鈕時建立，之後才能自己出聲
let audio: AudioContext | null = null;
function unlockAudio() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch { /* 不支援就只震動 */ }
}

/** 換段：震動＋嗶一聲；整份完成嗶三聲。邊看課程邊騎時不用一直盯著倒數 */
export function cueStep(finished: boolean) {
  const n = finished ? 3 : 1;
  try { navigator.vibrate?.(finished ? [200, 100, 200, 100, 200] : [300, 100, 300]); } catch { /* ignore */ }
  if (!audio) return;
  for (let i = 0; i < n; i++) {
    const t = audio.currentTime + i * 0.25;
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }
}

export function startWorkout(memberId: string, o: Option, rideActive: number | null) {
  unlockAudio();
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
