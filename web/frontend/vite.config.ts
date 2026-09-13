import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import path from 'node:path'

/**
 * server 모드(`npm run dev:server`)에서는 `/api` 와 `/ws` 를 실습 서버로 넘긴다.
 * 화면과 서버가 같은 출처가 되므로 브라우저 CORS 제약을 받지 않고,
 * 프론트 개발 서버 포트를 바꿔도 그대로 동작한다. (web/backend 는 건드리지 않는다)
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, 'VITE_')
  const target = env.VITE_API_TARGET || 'http://localhost:8000'

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, './src') },
    },
    server: {
      proxy:
        env.VITE_API_MODE === 'server'
          ? {
              '/api': { target, changeOrigin: true },
              '/ws': { target, ws: true, changeOrigin: true },
            }
          : undefined,
    },
  }
})
