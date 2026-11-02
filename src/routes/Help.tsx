const SECTIONS: { title: string; items: string[] }[] = [
  { title: '開始', items: ['Chrome 選單 →「安裝應用程式」', '「家人」頁新增自己'] },
  { title: '騎乘', items: ['踩幾下讓錶頭亮，按「連線飛輪」', '開始踩自動計時，停 60 秒自動存', '換人前按「結束並儲存」', '心率：握住把手才量得到'] },
  { title: '紀錄', items: ['點月曆看某天，點一筆看詳細', '🏅 = 刷新個人紀錄'] },
  { title: '備份', items: ['紀錄只存在這支手機', '「家人」頁匯出／讀取備份檔'] },
  { title: '看課程', items: ['騎乘中可切去看影片，會繼續記錄', '最保險：用分割畫面'] },
];

export default function Help() {
  return (
    <div className="space-y-3">
      {SECTIONS.map((s) => (
        <section key={s.title} className="card">
          <h2 className="font-semibold">{s.title}</h2>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-gray-700 marker:text-brand dark:text-gray-300">
            {s.items.map((it) => <li key={it}>{it}</li>)}
          </ul>
        </section>
      ))}
      <p className="muted px-1 text-xs">v{__APP_VERSION__}・資料只存在你的手機</p>
    </div>
  );
}
