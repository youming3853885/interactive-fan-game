import { defineConfig } from 'vite';

// Electron 用相對路徑 './'(file 協定)；GitHub Pages 用子路徑；本機 dev 用 '/'。
export default defineConfig({
  base: process.env.ELECTRON ? './' : (process.env.GITHUB_ACTIONS ? '/interactive-fan-game/' : '/'),
});
