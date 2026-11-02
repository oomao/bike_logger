import { Link } from 'react-router-dom';

const SECTIONS: { title: string; items: React.ReactNode[] }[] = [
  {
    title: '第一次使用',
    items: [
      <>用 Android 手機的 Chrome 打開這個網址，選單裡按「安裝應用程式」或「加到主畫面」，之後就像一般 App 一樣從桌面開啟。</>,
      <>到 <Link to="/family">家人</Link> 頁新增自己的名字。每個人用自己的手機，紀錄各自分開。</>,
      <>第一次連線時 Chrome 會要求「鄰近裝置 / 藍牙」權限，請允許。</>,
    ],
  },
  {
    title: '騎乘',
    items: [
      <>先踩幾下讓錶頭亮起來（自發電，沒踩就沒電），再到 <Link to="/">騎乘</Link> 頁按「連線飛輪」，清單裡選 PHILIPS FIT3104B3。</>,
      <>開始踩就自動計時；停踩超過 60 秒自動結束並存檔。不到 60 秒的不會存。</>,
      <>換人時按「結束並儲存」，手機會放開飛輪的藍牙，下一位的手機才連得上。</>,
      <>心率要雙手握住把手上的感測器才會量到。沒握的時候顯示「—」，紀錄裡只算有量到的時段。</>,
      <>阻力要自己轉旋鈕，App 只能讀不能控制（這台車不支援）。</>,
    ],
  },
  {
    title: '紀錄與圖表',
    items: [
      <><Link to="/history">紀錄</Link>：每一趟的清單，點進去可以看功率、踏頻、阻力、心率的曲線，各阻力段數騎了多久，以及這趟的最佳功率。🏅 代表刷新個人紀錄。</>,
      <><Link to="/stats">圖表</Link>：本週和上週比較、連續幾週有騎、每天騎乘熱度圖、每週騎乘量、近期趨勢、功率曲線、個人最佳和徽章。只跟自己比，不會跟家人排名。</>,
      <>每秒記錄一筆數據。距離和速度是飛輪估算的，卡路里用功率換算，都是參考值。</>,
    ],
  },
  {
    title: '備份',
    items: [
      <>紀錄只存在這支手機裡，換手機、清除 Chrome 資料或解除安裝都會不見。</>,
      <>到 <Link to="/family">家人</Link> 頁匯出，檔名是「名字_bike_logger.json」。可以直接分享到 Google 雲端硬碟或 LINE 保存。</>,
      <>換手機時，在新手機按「讀取備份檔」選這個檔案，紀錄就會合併回來，之後不用再選。</>,
      <>累積 5 筆沒備份，或超過 14 天沒備份，App 會跳出提醒。</>,
    ],
  },
  {
    title: 'BH 課程',
    items: [
      <>底部的「BH 課程」會先確認，再用瀏覽器開啟 BH 飛輪課程頁。</>,
      <>開始騎之後可以切去看課程或 YouTube，App 在背景會繼續收飛輪數據；停踩 60 秒一樣會自動存檔（回到 App 時補做）。</>,
      <>每騎 30 秒、以及切到其他 App 時都會先暫存進度。萬一手機把 App 關掉，下次打開會自動救回那一趟並存檔。</>,
      <>部分手機的省電模式會在背景切斷藍牙，那段時間就收不到數據。最保險的是用「分割畫面」或影片的「子母畫面」，讓這個 App 一直留在畫面上；也可以到手機設定把 Chrome 的電池最佳化關掉。</>,
    ],
  },
];

export default function Help() {
  return (
    <div className="space-y-3">
      {SECTIONS.map((s) => (
        <section key={s.title} className="card">
          <h2 className="font-semibold">{s.title}</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-gray-700 marker:text-brand dark:text-gray-300 [&_a]:text-brand [&_a]:underline dark:[&_a]:text-brand-light">
            {s.items.map((it, i) => <li key={i}>{it}</li>)}
          </ul>
        </section>
      ))}
      <section className="card">
        <h2 className="font-semibold">更新</h2>
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
          有新版本時，底部會出現「新版本已就緒」，按「重新載入」就會更新。騎乘中不會跳出，存檔後才提醒。
        </p>
      </section>
      <p className="muted px-1 text-xs">家庭飛輪紀錄 v{__APP_VERSION__}・資料只存在你的手機，不會上傳到任何伺服器。</p>
    </div>
  );
}
