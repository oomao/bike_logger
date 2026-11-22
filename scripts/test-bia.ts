// 估算公式的對照測試：node --experimental-strip-types scripts/test-bia.ts
import { compose } from '../src/lib/bia.ts';

let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : `\n     got  ${JSON.stringify(got)}\n     want ${JSON.stringify(want)}`));
};

// OKOK 國際版實際畫面（2026-11-22，三位家人，秤都送固定 500 Ω）：[性別, 身高, 年齡, 體重, 預期]
const OKOK: ['m' | 'f', number, number, number, { bmi: number; fatPct: number; bmr: number }][] = [
  ['f', 152, 56, 68.6, { bmi: 29.7, fatPct: 41.2, bmr: 1193 }],
  ['m', 160, 61, 72.05, { bmi: 28.1, fatPct: 27.3, bmr: 1397 }],
  ['f', 154, 19, 52.35, { bmi: 22.1, fatPct: 28.1, bmr: 1174 }],
];
for (const [sex, H, A, W, exp] of OKOK) {
  const c = compose({ sex, height: H, age: A }, W);
  for (const k of ['bmi', 'fatPct', 'bmr'] as const) eq(`OKOK ${sex}${A} ${k}`, c[k], exp[k]);
}
eq('under 10 → no fat', compose({ sex: 'f', height: 120, age: 8 }, 25).fatPct, null);
eq('ideal weight 170cm', compose({ sex: 'm', height: 170, age: 40 }, 67.85).idealKg, 63.58);

console.log(fail ? `\n${fail} 項失敗` : '\n全部通過');
process.exit(fail ? 1 : 0);
