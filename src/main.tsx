import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles/globals.css';
import { initStore } from './lib/store';
import { recoverDraft } from './lib/bike';

// 先把 IndexedDB 的紀錄讀進來再畫面，避免一打開閃一下「沒有紀錄」；
// 上次騎到一半被系統關掉的話，順便救回那一趟
initStore().then(recoverDraft).catch(() => {}).finally(() => {
  // 用 HashRouter 因為 GitHub Pages 對 BrowserRouter 的 fallback 路由支援不佳
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>
  );
});
