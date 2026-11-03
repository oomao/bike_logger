// 「今日建議」：全部用固定規則在手機上算，不連網、不用 AI。
// 規則來源：國健署「動動150」／WHO 每週 150 分鐘、Coggan 功率區間、
// 7 天 vs 28 天運動量比（Apple Training Load、ACWR）、Tanaka 最大心率 208 − 0.7 × 年齡。
import { rideBests, series, weekStart } from './analytics';
import { latestWeight, type Member, type Ride } from './store';

const DAY = 86400000;
export const WEEK_GOAL = 150; // 分鐘

export const dayKey = (ms: number) => {
  const d = new Date(ms);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const midnight = (ms: number) => new Date(ms).setHours(0, 0, 0, 0);

export const ageOf = (m: Member | undefined, now = Date.now()) => (m?.birthYear ? new Date(now).getFullYear() - m.birthYear : null);
export const hrMax = (age: number) => Math.round(208 - 0.7 * age);

/**
 * 估 FTP（騎一小時撐得住的功率）。家人很少全力騎滿 20 分鐘，只看 20 分會低估，
 * 所以跟 5 分鐘最佳的 85% 取大的。要有 3 趟以上持續踩滿 10 分鐘才給，不然寧可不給瓦數。
 */
export function estimateFtp(rides: Ride[], now = Date.now()): number | null {
  const recent = rides.filter((r) => now - r.start <= 90 * DAY);
  if (recent.filter((r) => rideBests(r)[600] != null).length < 3) return null;
  let best = 0;
  for (const r of recent) {
    const b = rideBests(r);
    best = Math.max(best, (b[1200] ?? 0) * 0.95, (b[300] ?? 0) * 0.85);
  }
  return best > 0 ? Math.round(best) : null;
}

/** 踏頻 70～90 時，每個阻力段大概出多少瓦（中位數，至少 20 秒資料才算） */
export function resistanceTable(rides: Ride[], now = Date.now()): Map<number, number> {
  const bins = new Map<number, number[]>();
  for (const r of rides) {
    if (now - r.start > 90 * DAY) continue;
    const s = series(r);
    for (let i = 0; i < s.power.length; i++) {
      const res = s.resistance[i], p = s.power[i], c = s.cadence[i];
      if (res == null || p == null || c == null || c < 70 || c > 90 || p <= 0) continue;
      if (!bins.has(res)) bins.set(res, []);
      bins.get(res)!.push(p);
    }
  }
  const out = new Map<number, number>();
  for (const [k, v] of bins) {
    if (v.length < 20) continue;
    v.sort((a, b) => a - b);
    out.set(k, v[v.length >> 1]);
  }
  return out;
}

/** 落在目標瓦數內的阻力段；都沒有就挑最接近的一段（差太多就不給） */
export function levelsFor(table: Map<number, number>, lo: number, hi: number): [number, number] | null {
  const hits = [...table].filter(([, p]) => p >= lo && p <= hi).map(([k]) => k);
  if (hits.length) return [Math.min(...hits), Math.max(...hits)];
  const mid = (lo + hi) / 2;
  let best: [number, number] | null = null;
  for (const [k, p] of table) if (!best || Math.abs(p - mid) < Math.abs(best[1] - mid)) best = [k, p];
  return best && Math.abs(best[1] - mid) <= mid * 0.25 ? [best[0], best[0]] : null;
}

export type Kind = 'easy' | 'steady' | 'hard';

export interface Option {
  kind: Kind;
  title: string;
  minutes: number;
  feel: string;      // 用感覺描述強度，沒有瓦數時也看得懂
  plan: string;
  watts: [number, number] | null;
  levels: [number, number] | null;
}

export interface Suggestion {
  rec: Kind | 'rest';
  headline: string;
  reason: string;
  options: Option[];
  weekMinutes: number;
  todayMinutes: number;
  restToday: boolean;
  elder: boolean;
  ftp: number | null;
  wkg: number | null;
}

export function suggest(m: Member, all: Ride[], now = Date.now()): Suggestion {
  const rides = all.filter((r) => r.memberId === m.id);
  const today = midnight(now);
  const sumMin = (from: number) => rides.filter((r) => r.start >= from).reduce((a, r) => a + r.duration, 0) / 60;
  const age = ageOf(m, now);
  const elder = age != null && age >= 65;

  const rideDays = new Set(rides.map((r) => dayKey(r.start)));
  let streak = 0; // 到昨天為止連續騎了幾天
  for (let d = today - DAY; rideDays.has(dayKey(d)); d -= DAY) streak++;
  const last = rides.reduce((a, r) => Math.max(a, r.start), 0);
  const daysSince = last ? Math.round((today - midnight(last)) / DAY) : null;

  // 最近 7 天 vs 平常（近 28 天的週平均）；騎不到兩週還沒有「平常」可比
  const first = rides.reduce((a, r) => Math.min(a, r.start), Infinity);
  const a7 = sumMin(now - 7 * DAY);
  const c28 = sumMin(now - 28 * DAY) / 4;
  const ratio = now - first >= 14 * DAY && c28 > 0 ? a7 / c28 : null;
  const pct = ratio != null ? Math.round(Math.abs(ratio - 1) * 100) : 0;

  let rec: Suggestion['rec'];
  let reason: string;
  if (rides.length < 3) {
    rec = elder ? 'easy' : 'steady';
    reason = '紀錄還少，先用舒服的強度找感覺。';
  } else if (streak >= (elder ? 2 : 3)) {
    rec = 'rest';
    reason = `已經連續騎 ${streak} 天了，讓腿恢復一下。`;
  } else if (ratio != null && ratio > 1.5) {
    rec = 'rest';
    reason = `最近 7 天騎了 ${Math.round(a7)} 分鐘，比平常多 ${pct}%。`;
  } else if (ratio != null && ratio > 1.3) {
    rec = 'easy';
    reason = `最近 7 天比平常多騎了 ${pct}%，今天放輕鬆。`;
  } else if (daysSince != null && daysSince >= 7) {
    rec = 'easy';
    reason = `${daysSince} 天沒騎了，沒關係，先輕鬆找回感覺。`;
  } else if (ratio != null && ratio < 0.8 && !rideDays.has(dayKey(today - DAY))) {
    rec = elder ? 'steady' : 'hard';
    reason = `最近騎得比平常少 ${pct}%，腿也休息夠了。`;
  } else {
    rec = 'steady';
    reason = '照平常的節奏就好。';
  }

  const ftp = estimateFtp(rides, now);
  const kg = latestWeight(m);
  const table = ftp ? resistanceTable(rides, now) : new Map<number, number>();
  const mk = (kind: Kind, title: string, minutes: number, feel: string, plan: string, lo: number, hi: number): Option => {
    const watts: [number, number] | null = ftp ? [Math.round(ftp * lo), Math.round(ftp * hi)] : null;
    return { kind, title, minutes, feel, plan, watts, levels: watts && levelsFor(table, watts[0], watts[1]) };
  };
  const easyMin = elder || (daysSince != null && daysSince >= 7) ? 15 : 20;
  const options = [
    mk('easy', '輕鬆騎', easyMin, '可以輕鬆聊天', `全程輕鬆踩 ${easyMin} 分鐘`, 0.45, 0.55),
    mk('steady', '穩定騎', 30, '能說話，但沒辦法唱歌', '前 5 分鐘慢慢加上去，中間維持，最後 3 分鐘放鬆', 0.56, 0.75),
    elder
      ? mk('hard', '稍微用力', 30, '說話會有點喘', '熱身 10 分 → 稍微用力 3 分＋輕鬆 3 分，做 3 組 → 緩和 2 分', 0.76, 0.9)
      : mk('hard', '挑戰', 40, '只能講幾個字', '熱身 10 分 → 用力 4 分＋輕鬆 3 分，做 4 組 → 緩和 5 分', 0.9, 1.05),
  ];

  const headline = {
    rest: '今天建議休息 😌',
    easy: '今天輕鬆騎就好',
    steady: '今天適合穩定騎',
    hard: '今天可以騎硬一點 💪',
  }[rec];

  return {
    rec,
    headline,
    reason,
    options,
    weekMinutes: Math.round(sumMin(weekStart(now))),
    todayMinutes: Math.round(sumMin(today)),
    restToday: m.restDays?.includes(dayKey(now)) ?? false,
    elder,
    ftp,
    wkg: ftp && kg ? Math.round((ftp / kg) * 10) / 10 : null,
  };
}
