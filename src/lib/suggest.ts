// 「今日建議」：全部用固定規則在手機上算，不連網、不用 AI。
// 規則來源：國健署「動動150」／WHO 每週 150 分鐘、Coggan 功率區間、
// 7 天 vs 28 天運動量比（Apple Training Load、ACWR）、Tanaka 最大心率 208 − 0.7 × 年齡。
import { rideBests, series, weekStart } from './analytics';
import { latestWeight, type Member, type Ride } from './store';

const DAY = 86400000;
export const WEEK_GOAL = 150; // 分鐘，國健署「動動150」

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
type Rec = Kind | 'rest';
const ORDER: Rec[] = ['rest', 'easy', 'steady', 'hard'];

// 騎前自評（學 Wahoo SYSTM）：1 很累、2 普通、3 不錯、4 精神好
export const FEELS = [
  { v: 1, icon: '😫', label: '很累' },
  { v: 2, icon: '😐', label: '普通' },
  { v: 3, icon: '😊', label: '不錯' },
  { v: 4, icon: '💪', label: '精神好' },
];

export interface Step {
  label: string;
  minutes: number;
  watts: [number, number] | null;
  levels: [number, number] | null;
}

export interface Option {
  kind: Kind;
  title: string;
  minutes: number;
  feel: string;      // 用感覺描述強度，沒有瓦數時也看得懂
  plan: string;
  watts: [number, number] | null;   // 主要那段的目標
  levels: [number, number] | null;
  steps: Step[];     // 給「跟著建議騎」用
}

export interface Suggestion {
  rec: Rec;
  headline: string;
  reason: string;
  options: Option[];
  weekMinutes: number;
  todayMinutes: number;
  restToday: boolean;
  feel: number | null;
  elder: boolean;
  ratio: number | null;  // 最近 7 天 ÷ 平常的週量
  last7: number;         // 最近 7 天騎了幾分鐘
  usual: number;         // 近 28 天平均每週幾分鐘
  level: number | null;  // 0 少很多 … 4 多很多
  ftp: number | null;
  wkg: number | null;
  table: Map<number, number>;
}

export const LEVELS = ['比平常少很多', '比平常少', '跟平常差不多', '比平常多', '比平常多很多'];

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

  // 最近 7 天 vs 平常（近 28 天的週平均）；騎不到兩週還沒有「平常」可比（學 Apple Training Load）
  const first = rides.reduce((a, r) => Math.min(a, r.start), Infinity);
  const a7 = sumMin(now - 7 * DAY);
  const c28 = sumMin(now - 28 * DAY) / 4;
  const ratio = now - first >= 14 * DAY && c28 > 0 ? a7 / c28 : null;
  const pct = ratio != null ? Math.round(Math.abs(ratio - 1) * 100) : 0;
  const level = ratio == null ? null : ratio < 0.6 ? 0 : ratio < 0.8 ? 1 : ratio <= 1.3 ? 2 : ratio <= 1.5 ? 3 : 4;

  let rec: Rec;
  let reason: string;
  let mustRest = false; // 連騎或騎太多：精神再好也最多輕鬆騎
  if (rides.length < 3) {
    rec = elder ? 'easy' : 'steady';
    reason = '紀錄還少，先用舒服的強度找感覺。';
  } else if (streak >= (elder ? 2 : 3)) {
    rec = 'rest';
    mustRest = true;
    reason = `已經連續騎 ${streak} 天了，讓腿恢復一下。`;
  } else if (ratio != null && ratio > 1.5) {
    rec = 'rest';
    mustRest = true;
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

  const feel = m.feel?.[0] === dayKey(now) ? m.feel[1] : null;
  const idx = ORDER.indexOf(rec);
  if (feel === 1 && rec !== 'rest') {
    rec = 'rest';
    reason = '你說今天很累，休息或輕鬆踩一下就好。';
  } else if (feel === 2 && idx > 1) {
    rec = ORDER[idx - 1];
    reason += ' 今天感覺普通，降一級。';
  } else if (feel === 4 && idx < 3) {
    rec = mustRest ? 'easy' : ORDER[idx + 1];
    reason += mustRest ? ' 精神不錯的話，輕鬆騎一下就好。' : ' 今天精神好，可以多一點。';
  }

  const ftp = estimateFtp(rides, now);
  const kg = latestWeight(m);
  const table = resistanceTable(rides, now);
  const target = (lo: number, hi: number) => {
    const watts: [number, number] | null = ftp ? [Math.round(ftp * lo), Math.round(ftp * hi)] : null;
    return { watts, levels: watts && levelsFor(table, watts[0], watts[1]) };
  };
  // Coggan 功率區間（佔 FTP 的比例）
  const Z = { rec: [0.4, 0.5], easy: [0.45, 0.55], steady: [0.56, 0.75], tempo: [0.76, 0.9], hard: [0.9, 1.05] } as const;
  const st = (label: string, minutes: number, z: readonly [number, number]): Step => ({ label, minutes, ...target(z[0], z[1]) });
  const reps = (n: number, on: Step, off: Step) => Array.from({ length: n }, () => [on, off]).flat();

  const easyMin = elder || (daysSince != null && daysSince >= 7) ? 15 : 20;
  const mk = (kind: Kind, title: string, feelText: string, plan: string, main: readonly [number, number], steps: Step[]): Option => ({
    kind, title, feel: feelText, plan, steps, minutes: steps.reduce((a, x) => a + x.minutes, 0), ...target(main[0], main[1]),
  });
  const options = [
    mk('easy', '輕鬆騎', '可以輕鬆聊天', `全程輕鬆踩 ${easyMin} 分鐘`, Z.easy, [st('輕鬆踩', easyMin, Z.easy)]),
    mk('steady', '穩定騎', '能說話，但沒辦法唱歌', '暖身 5 分 → 穩定 22 分 → 放鬆 3 分', Z.steady,
      [st('暖身', 5, Z.easy), st('穩定', 22, Z.steady), st('放鬆', 3, Z.rec)]),
    elder
      ? mk('hard', '稍微用力', '說話會有點喘', '暖身 10 分 → 稍微用力 3 分＋輕鬆 3 分，做 3 組 → 緩和 2 分', Z.tempo,
        [st('暖身', 10, Z.easy), ...reps(3, st('稍微用力', 3, Z.tempo), st('輕鬆', 3, Z.easy)), st('緩和', 2, Z.rec)])
      : mk('hard', '挑戰', '只能講幾個字', '暖身 10 分 → 用力 4 分＋輕鬆 3 分，做 4 組 → 緩和 2 分', Z.hard,
        [st('暖身', 10, Z.easy), ...reps(4, st('用力', 4, Z.hard), st('輕鬆', 3, Z.easy)), st('緩和', 2, Z.rec)]),
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
    feel,
    elder,
    ratio,
    last7: Math.round(a7),
    usual: Math.round(c28),
    level,
    ftp,
    wkg: ftp && kg ? Math.round((ftp / kg) * 10) / 10 : null,
    table,
  };
}

export interface PlanDay { date: number; kind: Kind; minutes: number }

/** 這週剩下的天數怎麼排才補滿 150 分鐘（學 Garmin / Peloton 週計畫） */
export function weekPlan(s: Suggestion, now = Date.now()): { days: PlanDay[]; note: string } {
  const remaining = WEEK_GOAL - s.weekMinutes;
  if (remaining <= 0) return { days: [], note: '本週已達標 🎉 接下來想騎就輕鬆騎。' };
  const today = midnight(now);
  const sunday = midnight(weekStart(now) + 6.5 * DAY);
  const skipToday = s.restToday || s.todayMinutes >= 10 || s.rec === 'rest';
  const free: number[] = [];
  for (let d = skipToday ? today + DAY : today; midnight(d) <= sunday; d += DAY) free.push(midnight(d));
  if (!free.length) return { days: [], note: `本週還差 ${remaining} 分鐘，下週再加油。` };

  // 用跟今日選項一樣的時長；從隔天騎開始排，次數不夠補滿才加，天數不夠才連著騎
  const pattern: Kind[] = s.elder ? ['steady', 'easy', 'hard', 'easy'] : ['steady', 'hard', 'easy', 'steady'];
  const len = (k: Kind) => s.options.find((o) => o.kind === k)!.minutes;
  const build = (n: number) => Array.from({ length: n }, (_, i): PlanDay => {
    const date = free[n === 1 ? 0 : Math.round((i * (free.length - 1)) / (n - 1))];
    const kind = i === 0 && date === today && s.rec !== 'rest' ? s.rec : pattern[i % pattern.length];
    return { date, kind, minutes: len(kind) };
  });
  // 長輩不連著騎；其他人最多連 2 天
  const maxN = s.elder ? Math.ceil(free.length / 2) : free.length - Math.floor(free.length / 3);
  let days = build(1);
  for (let n = 2; n <= maxN && days.reduce((a, d) => a + d.minutes, 0) < remaining; n++) days = build(n);
  const total = days.reduce((a, d) => a + d.minutes, 0);
  return {
    days,
    note: total >= remaining
      ? `本週還差 ${remaining} 分鐘，照這樣排就會達標。`
      : `本週還差 ${remaining} 分鐘，剩下的天數補不滿也沒關係，騎多少算多少。`,
  };
}

/** 體能變化：現在、4 週前、12 週前的估計 FTP（學 Zwift 自動偵測） */
export function fitnessHistory(m: Member, all: Ride[], now = Date.now()) {
  const rides = all.filter((r) => r.memberId === m.id);
  const at = (ms: number) => estimateFtp(rides.filter((r) => r.start <= ms), ms);
  return { now: at(now), w4: at(now - 28 * DAY), w12: at(now - 84 * DAY) };
}
