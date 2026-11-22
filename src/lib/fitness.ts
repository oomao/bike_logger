// 體能和體重放在一起看：W/kg 的變化、一句白話說明。純函式，沒有依賴，scripts/test-fitness.ts 測試

export interface Pt { ftp: number | null; kg: number | null; wkg: number | null }

/** 那個時間點之前最近一筆體重；那時候還沒記過就是 null */
export function weightAt(weights: [number, number][] | undefined, ms: number): number | null {
  let v: number | null = null;
  for (const [t, kg] of weights ?? []) if (t <= ms) v = kg;
  return v;
}

export function point(ftp: number | null, kg: number | null): Pt {
  return { ftp, kg, wkg: ftp && kg ? Math.round((ftp / kg) * 100) / 100 : null };
}

export type WkgTone = 'low' | 'ok' | 'good' | 'great';
const CUTS = { m: [1.5, 2.5, 3.5], f: [1.2, 2.0, 2.8] } as const;
const LABEL: [string, WkgTone][] = [['剛起步', 'low'], ['一般', 'ok'], ['不錯', 'good'], ['很強', 'great']];

/**
 * 大約跟同性別、同年齡的一般人比（粗略）。最大攝氧量大約每年掉 1%，所以 30 歲以上門檻每歲降 1%，最多降到 6 成。
 * 沒有性別就不評。
 */
export function wkgLevel(wkg: number, sex: 'm' | 'f' | undefined, age: number | null): [string, WkgTone] | null {
  if (!sex) return null;
  const f = age != null && age > 30 ? Math.max(0.6, 1 - 0.01 * (age - 30)) : 1;
  const i = CUTS[sex].filter((c) => wkg >= c * f).length;
  return LABEL[i];
}

const r1 = (x: number) => Math.round(x * 10) / 10;

/** 跟 4 週前比，用一句白話說體能、體重、W/kg 發生了什麼事。資料不夠就回 null */
export function insight(now: Pt, past: Pt): string | null {
  if (!now.ftp || !past.ftp || now.kg == null || past.kg == null || now.wkg == null || past.wkg == null) return null;
  const dF = now.ftp - past.ftp;
  const dK = r1(now.kg - past.kg);
  const dR = now.wkg - past.wkg;
  const ftpUp = dF >= past.ftp * 0.03;
  const ftpDown = dF <= -past.ftp * 0.03;
  const move = `W/kg 從 ${past.wkg.toFixed(1)} 到 ${now.wkg.toFixed(1)}`;
  if (dR >= 0.1) {
    if (dK <= -0.5 && ftpUp) return `${move}，體重少了 ${Math.abs(dK)} 公斤，體能也進步了。`;
    if (dK <= -0.5) return `${move}，主要是體重少了 ${Math.abs(dK)} 公斤，體能沒有掉。`;
    return `${move}，體能進步了 ${dF} W。`;
  }
  if (dR <= -0.1) {
    if (dK >= 0.5 && !ftpDown) return `${move}，主要是體重多了 ${dK} 公斤，體能沒有掉。`;
    if (ftpDown) return `${move}，體能比 4 週前低一點，偶爾騎硬一點會回來。`;
    return `${move}。`;
  }
  return `W/kg 跟 4 週前差不多（${now.wkg.toFixed(1)}）。`;
}
