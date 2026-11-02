import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import Layout from './components/Layout';
import Ride from './routes/Ride';
import History from './routes/History';
import Family from './routes/Family';

export default function App() {
  // PWA 更新檢查：偵測到新版跳 banner、每小時檢查一次、切回 App 時也檢查
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (registration) swRegistrationRef.current = registration;
    },
  });

  useEffect(() => {
    const intervalId = setInterval(() => {
      swRegistrationRef.current?.update().catch(() => {});
    }, 60 * 60 * 1000);
    const onVisibilityChange = () => {
      if (!document.hidden) swRegistrationRef.current?.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Ride />} />
        <Route path="/history" element={<History />} />
        <Route path="/family" element={<Family />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {needRefresh && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 px-4 pb-3" role="status" aria-live="polite">
          <div className="mx-auto flex max-w-md items-center gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm text-gray-100 shadow-lg">
            <span className="flex-1">新版本已就緒</span>
            <button type="button" onClick={() => setNeedRefresh(false)} className="px-2 py-1 text-xs text-gray-400">
              稍後
            </button>
            <button type="button" onClick={() => updateServiceWorker(true)} className="rounded-lg bg-brand-light px-3 py-1.5 text-xs font-semibold text-gray-950">
              重新載入
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
