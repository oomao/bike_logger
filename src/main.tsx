import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles/globals.css';
import { initStore } from './lib/store';

// 先把 IndexedDB 的紀錄讀進來再畫面，避免一打開閃一下「沒有紀錄」
initStore().finally(() => {
  // 用 HashRouter 因為 GitHub Pages 對 BrowserRouter 的 fallback 路由支援不佳
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>
  );
});
