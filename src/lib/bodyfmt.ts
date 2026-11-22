// 體重頁和圖表頁共用的小工具
export const DAY = 24 * 3600 * 1000;
export const kg2 = (v: number) => v.toFixed(2);
export const signed = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(2);
export const ymd = (ms: number) => {
  const d = new Date(ms);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
export const md = (ms: number) => `${new Date(ms).getMonth() + 1}/${new Date(ms).getDate()}`;
