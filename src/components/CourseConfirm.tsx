import { useEffect } from 'react';
import { useBike } from '../lib/bike';

// BH 免費線上課程，確認後才開到外部瀏覽器
const BH_COURSE_URL = 'https://www.bhlap.com/media.php?fid=102';

export default function CourseConfirm({ onClose }: { onClose: () => void }) {
  const bike = useBike();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
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
            ? '這趟還在記錄中，切過去後 App 會在背景繼續記錄並自動存檔。想最保險就用「分割畫面」把課程和這個 App 放在一起。'
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
