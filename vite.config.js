import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    uni(),
  ],
  server: {
    proxy: {
      // 注意：更具体的路径要放在前面，避免 /data 拦截 /dataByType
      '/dataByType': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/data': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/deviceData': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/directData': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/directRender': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/errData': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/errTypeStats': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/multipleDirectData': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // WebSocket 代理
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
})
