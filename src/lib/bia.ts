// 用身高、年齡、體重、性別「估」體脂率和基礎代謝。沒有量阻抗，固定用 500 Ω（OKOK 的秤送的就是這個值），
// 所以這些數字只適合看自己的趨勢，不是量出來的。
// 公式來自 openScale 整理的 OKOK 算法，2026-11 用三位家人在 OKOK 國際版的畫面對過（體脂率、基礎代謝完全一致），
// 對照測試在 scripts/test-bia.ts。

export type Sex = 'm' | 'f';
export interface Profile { sex: Sex; height: number; age: number }

export interface Composition {
  bmi: number;
  fatPct: number | null;  // 年齡 10 歲以下算不出來
  bmr: number;            // 大卡
  idealKg: number;        // 理想體重：22 × 身高(m)²（衛福部）
  stdKg: number;          // 標準體重：男 (身高−80)×0.7、女 (身高−70)×0.6
}

export const DEFAULT_Z = 500;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

export function compose(p: Profile, W: number, Z = DEFAULT_Z): Composition {
  const { height: H, age: A } = p;
  const male = p.sex === 'm';
  const bmi = W / (H / 100) ** 2;
  const base = {
    bmi: r1(bmi),
    idealKg: r2(22 * (H / 100) ** 2),
    stdKg: r2(male ? (H - 80) * 0.7 : (H - 70) * 0.6),
  };
  // 基礎代謝（Mifflin-St Jeor），年齡太小算不出體脂時用這個
  const mifflin = Math.round(10 * W + 6.25 * H - 5 * A + (male ? 5 : -161));
  if (A < 10) return { ...base, fatPct: null, bmr: mifflin };

  const fatMass = male
    ? -0.3315 * H + 0.6216 * W + 0.0183 * A + 0.0085 * Z + 22.554
    : -0.3332 * H + 0.7509 * W + 0.0196 * A + 0.0072 * Z + 22.7193;
  const fatPct = clamp((fatMass / W) * 100, 5, 45);
  const fatKg = (W * fatPct) / 100;
  // 基礎代謝：新版 OKOK 的公式沒有公開，用三筆實際資料擬合「去脂體重＋年齡」，三筆都差 0 大卡
  const bmr = Math.round(17.2066 * (W - fatKg) - 0.72177 * A + 539.688);
  return { ...base, fatPct: r1(fatPct), bmr };
}

// ---------- 標準範圍（「偏低 / 標準 / 偏高」色條） ----------
export type Level = 'low' | 'ok' | 'high' | 'veryHigh';
export interface Band { lo: number; hi: number; hi2?: number; unit: string; src: string }

export function bands(p: Profile): Record<'bmi' | 'fatPct', Band> {
  const male = p.sex === 'm';
  const young = p.age < 30;
  return {
    // 衛福部國健署：18.5 ≤ BMI < 24 正常，24～27 過重，≥ 27 肥胖
    bmi: { lo: 18.5, hi: 24, hi2: 27, unit: '', src: '國健署' },
    // 國健署體脂肪率參考：男 30 歲以下 14–20%、以上 17–23%；女 30 歲以下 17–24%、以上 20–27%
    fatPct: male
      ? (young ? { lo: 14, hi: 20, hi2: 30, unit: '%', src: '國健署' } : { lo: 17, hi: 23, hi2: 30, unit: '%', src: '國健署' })
      : (young ? { lo: 17, hi: 24, hi2: 35, unit: '%', src: '國健署' } : { lo: 20, hi: 27, hi2: 35, unit: '%', src: '國健署' }),
  };
}

export function level(v: number, b: Band): Level {
  if (v < b.lo) return 'low';
  if (v < b.hi) return 'ok';
  if (b.hi2 != null && v >= b.hi2) return 'veryHigh';
  return 'high';
}
