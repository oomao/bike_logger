import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages 部署在 https://oomao.github.io/bike_logger/，build 時 base 要對齊 repo 名
export default defineConfig(({ command }) => {
  const BASE = command === 'build' ? '/bike_logger/' : '/';

  return {
    base: BASE,
    plugins: [
      react(),
      VitePWA({
        // 'prompt' 才會觸發 onNeedRefresh → 顯示「新版本已就緒」banner
        registerType: 'prompt',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: '家庭飛輪紀錄',
          short_name: '飛輪紀錄',
          description: '連線小野馬飛輪，依家人分開記錄每一趟騎乘',
          lang: 'zh-Hant',
          theme_color: '#0f766e',
          background_color: '#f4f6f5',
          display: 'standalone',
          orientation: 'portrait',
          start_url: BASE,
          scope: BASE,
          icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg}'],
          navigateFallback: `${BASE}index.html`,
          cleanupOutdatedCaches: true,
        },
      }),
    ],
  };
});
