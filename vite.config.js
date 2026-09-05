import { defineConfig } from 'vite';

// GitHub Pages 專案站台服務在 /interactive-fan-game/ 子路徑下，
// 本機 dev 用 '/' 即可（base 只影響 build 產物的資源路徑）。
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/interactive-fan-game/' : '/',
});
