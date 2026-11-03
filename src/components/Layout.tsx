import { Link, NavLink } from 'react-router-dom';
import { useEffect, useRef, type ReactNode } from 'react';
import { useBike } from '../lib/bike';
import { syncWorkout } from '../lib/workout';

// BH 課程併進「建議」頁，底部維持 5 格不擁擠
const NAV = [
  { to: '/', label: '騎乘', icon: 'M5 17a3 3 0 1 0 0-.01M19 17a3 3 0 1 0 0-.01M5 17l4-8h5l5 8M9 9l3 8h2M13 5h3' },
  { to: '/plan', label: '建議', icon: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z' },
  { to: '/history', label: '紀錄', icon: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01' },
  { to: '/stats', label: '圖表', icon: 'M4 19V9m5 10V5m5 14v-7m5 7V8' },
  { to: '/family', label: '家人', icon: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 9a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M17 14a5 5 0 0 1 4 6' },
];

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

  // Layout 一直都在，由這裡把「跟著建議騎」接到這趟騎乘上，不管現在停在哪一頁
  const hadRide = useRef(false);
  const riding = !!bike.ride;
  useEffect(() => {
    syncWorkout(bike.ride, hadRide.current);
    hadRide.current = riding;
  }, [riding]); // eslint-disable-line react-hooks/exhaustive-deps

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
      </nav>
    </div>
  );
}
