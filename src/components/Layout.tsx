import { Link, NavLink } from 'react-router-dom';
import { useState, type ReactNode } from 'react';
import { useBike } from '../lib/bike';

// BH 免費線上課程，確認後才開到外部瀏覽器
const BH_COURSE_URL = 'https://www.bhlap.com/media.php?fid=102';

const NAV = [
  { to: '/', label: '騎乘', icon: 'M5 17a3 3 0 1 0 0-.01M19 17a3 3 0 1 0 0-.01M5 17l4-8h5l5 8M9 9l3 8h2M13 5h3' },
  { to: '/history', label: '紀錄', icon: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01' },
  { to: '/stats', label: '圖表', icon: 'M4 19V9m5 10V5m5 14v-7m5 7V8' },
  { to: '/family', label: '家人', icon: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 9a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M17 14a5 5 0 0 1 4 6' },
];
const COURSE_ICON = 'M4 6h16v11H4zM10 9.5v4.5l4-2.25zM8 20h8';

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function CourseConfirm({ onClose }: { onClose: () => void }) {
  const bike = useBike();
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl dark:bg-gray-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">前往 BH 線上課程？</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">會在瀏覽器開啟 BH 國際健身課程的飛輪課程頁，用你的 BH 帳號觀看。</p>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {bike.ride
            ? '這趟還在記錄中。建議用手機的「分割畫面」把課程和這個 App 放在一起，記錄最不會中斷。'
            : bike.connected
              ? '飛輪已連線，開始踩就會記錄。建議用「分割畫面」同時顯示課程和這個 App。'
              : '飛輪還沒連線，這次騎乘不會被記錄。想記錄的話先到「騎乘」頁連線。'}
        </p>
        <div className="mt-4 flex gap-2">
          <button className="btn flex-1" onClick={onClose}>取消</button>
          <a href={BH_COURSE_URL} target="_blank" rel="noopener noreferrer" className="btn-primary flex-1" onClick={onClose}>
            前往課程 ↗
          </a>
        </div>
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const bike = useBike();
  const [askCourse, setAskCourse] = useState(false);
  const tab = 'flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <Link to="/" className="text-lg font-bold text-brand dark:text-brand-light">🚴 家庭飛輪紀錄</Link>
          <span
            className={`ml-auto rounded-full border px-3 py-0.5 text-xs ${
              bike.connected ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-gray-300 text-gray-500 dark:border-gray-700'
            }`}
          >
            {bike.connected ? (bike.ride ? '記錄中' : '已連線') : bike.hasDevice ? '已斷線' : '未連線'}
          </span>
          <Link to="/help" aria-label="使用說明" className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-sm font-bold text-gray-500 dark:border-gray-700">
            ?
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-4">{children}</main>

      {/* 底部分頁列：單手好按，安裝成 App 後就像原生的 tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-5 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-gray-800 dark:bg-gray-900">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) => `${tab} ${isActive ? 'text-brand dark:text-brand-light' : 'text-gray-500 dark:text-gray-400'}`}
          >
            <Icon d={n.icon} />
            {n.label}
          </NavLink>
        ))}
        <button type="button" onClick={() => setAskCourse(true)} className={`${tab} text-gray-500 dark:text-gray-400`}>
          <Icon d={COURSE_ICON} />
          BH 課程
        </button>
      </nav>

      {askCourse && <CourseConfirm onClose={() => setAskCourse(false)} />}
    </div>
  );
}
