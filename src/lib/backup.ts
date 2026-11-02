import { exportData, getDb, markBackedUp, memberName } from './store';
import { download } from './format';

/** 檔名：名字_bike_logger.json；全家備份是 全家_bike_logger.json */
export function backupFileName(memberId: string | null, ext = 'json') {
  // 手機上只有一位家人時，全家備份也用他的名字
  const only = getDb().members.length === 1 ? getDb().members[0].id : null;
  const who = memberId || only ? memberName(memberId ?? only) : '全家';
  return who.replace(/[\\/:*?"<>|]/g, '_') + '_bike_logger.' + ext;
}

/**
 * 匯出備份。手機支援分享時跳出分享選單（可以存到雲端硬碟、傳 LINE），
 * 不支援或使用者取消分享就直接下載到「下載」資料夾。
 */
export async function saveBackup(memberId: string | null, via: 'share' | 'download') {
  const name = backupFileName(memberId);
  const text = JSON.stringify(exportData(memberId));
  if (via === 'share') {
    const file = new File([text], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
        markBackedUp();
        return;
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return;
      }
    }
  }
  download(name, text, 'application/json');
  markBackedUp();
}

export const canShareFiles = () =>
  typeof navigator.canShare === 'function' &&
  navigator.canShare({ files: [new File(['{}'], 'test.json', { type: 'application/json' })] });
