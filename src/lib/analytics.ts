// 從每趟的取樣算出圖表與紀錄用的數據。
// 取樣可能是每秒一筆（0.3 起）或每 5 秒一筆（更早），所以一律先展開成「每秒一格」再算。
import type { Ride } from './store';

export const CURVE_DURATIONS = [5, 15, 30, 60, 120, 300, 600, 1200, 1800];
export const BEST_DURATIONS = [60, 300, 600, 1200];
export const durLabel = (s: number) => (s < 60 ? s + ' 秒' : s / 60 + ' 分');

const MAX_POWER = 1500; // 超過視為感測器突波
const DAY = 86400000;

export interface Series {
  power: (number | null)[];
  cadence: (number | null)[];
  resistance: (number | null)[];
  hr: (number | null)[];
  speed: (number | null)[];
}

const cache = new WeakMap<Ride, Series>();

/** 展開成每秒一格；舊的 5 秒取樣會把該值填滿那 5 秒 */
export function series(r: Ride): Series {
  const hit = cache.get(r);
  if (hit) return hit;
  const n = Math.max(r.duration, r.samples[r.samples.length - 1]?.[0] ?? 0);
  const s: Series = { power: Array(n).fill(null), cadence: Array(n).fill(null), resistance: Array(n).fill(null), hr: Array(n).fill(null), speed: Array(n).fill(null) };
  let prev = 0;
  for (const [t, p, c, sp, hr, , res] of r.samples) {
    const from = Math.max(prev, t - 5);
    for (let i = from; i < t && i < n; i++) {
      s.power[i] = p != null && p >= 0 && p <= MAX_POWER ? p : null;
      s.cadence[i] = c;
      s.speed[i] = sp;
      s.resistance[i] = res ?? null;
      s.hr[i] = hr && hr > 0 ? hr : null;
    }
    prev = t;
  }
  cache.set(r, s);
  return s;
}

/** 某段時間長度內的最佳平均功率；資料不足回傳 null */
export function bestPower(r: Ride, dur: number): number | null {
  const p = series(r).power;
  if (p.length < dur) return null;
  let sum = 0, nulls = 0, best = -1;
  for (let i = 0; i < p.length; i++) {
    sum += p[i] ?? 0;
    if (p[i] == null) nulls++;
    if (i >= dur) { sum -= p[i - dur] ?? 0; if (p[i - dur] == null) nulls--; }
    if (i >= dur - 1 && nulls <= dur * 0.1) best = Math.max(best, sum / dur);
  }
  return best >= 0 ? Math.round(best) : null;
}

const bestCache = new WeakMap<Ride, Record<number, number | null>>();
export function rideBests(r: Ride): Record<number, number | null> {
  const hit = bestCache.get(r);
  if (hit) return hit;
  const out: Record<number, number | null> = {};
  for (const d of new Set([...CURVE_DURATIONS, ...BEST_DURATIONS])) out[d] = bestPower(r, d);
  bestCache.set(r, out);
  return out;
}

export interface CurvePoint { dur: number; label: string; all: number | null; recent: number | null; allRide?: Ride }

/** 功率曲線：全期 vs 近 60 天 */
export function powerCurve(rides: Ride[], now = Date.now()): CurvePoint[] {
  return CURVE_DURATIONS.map((dur) => {
    let all: number | null = null, recent: number | null = null, allRide: Ride | undefined;
    for (const r of rides) {
      const b = rideBests(r)[dur];
      if (b == null) continue;
      if (all == null || b > all) { all = b; allRide = r; }
      if (now - r.start <= 60 * DAY && (recent == null || b > recent)) recent = b;
    }
    return { dur, label: durLabel(dur), all, recent, allRide };
  }).filter((p) => p.all != null);
}

/** 這趟有哪些時間長度刷新了個人紀錄（只跟這趟之前的比） */
export function newRecords(ride: Ride, all: Ride[]): number[] {
  const before = all.filter((r) => r.memberId === ride.memberId && r.start < ride.start);
  if (before.length < 2) return []; // 還沒有基準，不亂發獎牌
  const mine = rideBests(ride);
  return BEST_DURATIONS.filter((d) => {
    const b = mine[d];
    if (b == null) return false;
    return before.every((r) => (rideBests(r)[d] ?? -1) < b);
  });
}

// ---------- 週與日 ----------
export function weekStart(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export const kj = (r: Ride) => {
  const p = series(r).power;
  const sum = p.reduce<number>((a, v) => a + (v ?? 0), 0);
  return sum > 0 ? Math.round(sum / 1000) : r.kcal; // 沒功率的舊資料退回卡路里
};

export interface WeekBucket { start: number; label: string; minutes: number; rides: number; kj: number }

export function weeklyVolume(rides: Ride[], weeks = 12, now = Date.now()): WeekBucket[] {
  const cur = weekStart(now);
  const out: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = cur - i * 7 * DAY;
    const d = new Date(start);
    out.push({ start, label: d.getMonth() + 1 + '/' + d.getDate(), minutes: 0, rides: 0, kj: 0 });
  }
  for (const r of rides) {
    const b = out.find((w) => r.start >= w.start && r.start < w.start + 7 * DAY);
    if (!b) continue;
    b.minutes += r.duration / 60;
    b.rides++;
    b.kj += kj(r);
  }
  out.forEach((b) => { b.minutes = Math.round(b.minutes); });
  return out;
}

/** 連續幾週有騎（本週還沒騎不算斷） */
export function weekStreak(rides: Ride[], now = Date.now()): number {
  const weeks = new Set(rides.map((r) => weekStart(r.start)));
  let w = weekStart(now);
  if (!weeks.has(w)) w -= 7 * DAY;
  let n = 0;
  while (weeks.has(w)) { n++; w -= 7 * DAY; }
  return n;
}

/** 近 12 週每天騎了幾分鐘，給熱度圖用；回傳 [週][星期一..日] */
export function dailyGrid(rides: Ride[], weeks = 12, now = Date.now()): { date: number; minutes: number }[][] {
  const first = weekStart(now) - (weeks - 1) * 7 * DAY;
  const grid = Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => ({ date: first + (w * 7 + d) * DAY, minutes: 0 })));
  for (const r of rides) {
    const idx = Math.floor((new Date(r.start).setHours(0, 0, 0, 0) - first) / DAY + 0.5);
    if (idx < 0 || idx >= weeks * 7) continue;
    grid[Math.floor(idx / 7)][idx % 7].minutes += r.duration / 60;
  }
  return grid;
}

export interface Trend { label: string; unit: string; recent: number | null; base: number | null; dir: 'up' | 'flat' | 'down' | null }

/** 近 30 天 vs 之前 31～180 天的每趟平均 */
export function trends(rides: Ride[], now = Date.now()): Trend[] {
  const recent = rides.filter((r) => now - r.start <= 30 * DAY);
  const base = rides.filter((r) => now - r.start > 30 * DAY && now - r.start <= 180 * DAY);
  const avg = (arr: Ride[], f: (r: Ride) => number | null | undefined) => {
    const v = arr.map(f).filter((x): x is number => x != null);
    return v.length >= 2 ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const mk = (label: string, unit: string, f: (r: Ride) => number | null | undefined): Trend => {
    const a = avg(recent, f), b = avg(base, f);
    let dir: Trend['dir'] = null;
    if (a != null && b != null) dir = a > b * 1.03 ? 'up' : a < b * 0.97 ? 'down' : 'flat';
    return { label, unit, recent: a, base: b, dir };
  };
  return [
    mk('每趟平均功率', 'W', (r) => r.avgPower),
    mk('每趟平均踏頻', 'rpm', (r) => r.avgCadence),
    mk('每趟平均阻力', '段', (r) => r.avgResistance),
    mk('每趟平均速度', 'km/h', (r) => r.avgSpeed),
    mk('每趟時間', '分', (r) => r.duration / 60),
    mk('每趟做功', 'kJ', kj),
  ];
}

// ---------- 單趟分布 ----------
export function histogram(values: (number | null)[], bin: number, min = 0): { label: string; minutes: number }[] {
  const counts = new Map<number, number>();
  for (const v of values) {
    if (v == null || v < min) continue;
    const k = Math.floor(v / bin) * bin;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, n]) => ({ label: bin === 1 ? String(k) : k + '–' + (k + bin - 1), minutes: Math.round((n / 60) * 10) / 10 }));
}

export function hrCoverage(r: Ride) {
  const hr = series(r).hr;
  const measured = hr.filter((v): v is number => v != null);
  const seconds = r.hrSeconds ?? measured.length;
  return {
    seconds,
    pct: r.duration ? Math.round((seconds / r.duration) * 100) : 0,
    avg: measured.length ? Math.round(measured.reduce((a, b) => a + b, 0) / measured.length) : r.avgHr,
    // 只摸了幾秒的最高心率不可靠，量測滿 30 秒才顯示
    max: measured.length >= 30 ? Math.max(...measured) : null,
  };
}

// ---------- 個人紀錄與徽章 ----------
export function records(rides: Ride[]) {
  const by = <T,>(f: (r: Ride) => T | null, better: (a: T, b: T) => boolean) => {
    let best: { value: T; ride: Ride } | null = null;
    for (const r of rides) {
      const v = f(r);
      if (v != null && (!best || better(v, best.value))) best = { value: v, ride: r };
    }
    return best;
  };
  const weeks = new Map<number, number>();
  for (const r of rides) weeks.set(weekStart(r.start), (weeks.get(weekStart(r.start)) ?? 0) + r.duration / 60);
  const bestWeek = [...weeks.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    power: BEST_DURATIONS.map((d) => ({ dur: d, best: by((r) => rideBests(r)[d], (a, b) => a > b) })),
    longest: by((r) => r.duration, (a, b) => a > b),
    mostKj: by((r) => kj(r), (a, b) => a > b),
    farthest: by((r) => r.distance, (a, b) => a > b),
    bestWeek: bestWeek ? { start: bestWeek[0], minutes: Math.round(bestWeek[1]) } : null,
  };
}

export function badges(rides: Ride[]) {
  const count = rides.length;
  const hours = rides.reduce((a, r) => a + r.duration, 0) / 3600;
  const ridesMs = [1, 10, 25, 50, 100, 250, 500];
  const hoursMs = [1, 5, 10, 25, 50, 100];
  return [
    ...ridesMs.map((m) => ({ label: m + ' 趟', got: count >= m, icon: '🚴' })),
    ...hoursMs.map((m) => ({ label: m + ' 小時', got: hours >= m, icon: '⏱️' })),
  ];
}
