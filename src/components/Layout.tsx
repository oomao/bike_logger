import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useBike } from '../lib/bike';

// BH 免費線上課程，開在外部瀏覽器分頁
const BH_COURSE_URL = 'https://www.bhlap.com/media.php?fid=102';

const NAV = [
  { to: '/', label: '騎乘', icon: 'M5 17a3 3 0 1 0 0-.01M19 17a3 3 0 1 0 0-.01M5 17l4-8h5l5 8M9 9l3 8h2M13 5h3' },
  { to: '/history', label: '紀錄', icon: 'M4 19V9m5 10V5m5 14v-7m5 7V8' },
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

export default function Layout({ children }: { children: ReactNode }) {
  const bike = useBike();
  const tab = 'flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <span className="text-lg font-bold text-brand dark:text-brand-light">🚴 家庭飛輪紀錄</span>
          <span
            className={`rounded-full border px-3 py-0.5 text-xs ${
              bike.connected ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-gray-300 text-gray-500 dark:border-gray-700'
            }`}
          >
            {bike.connected ? '已連線' : bike.hasDevice ? '已斷線' : '未連線'}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-4">{children}</main>

      {/* 底部分頁列：單手好按，安裝成 App 後就像原生的 tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-4 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-gray-800 dark:bg-gray-900"
      >
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
        <a href={BH_COURSE_URL} target="_blank" rel="noopener noreferrer" className={`${tab} text-gray-500 dark:text-gray-400`}>
          <Icon d={COURSE_ICON} />
          BH 課程
        </a>
      </nav>
    </div>
  );
}
