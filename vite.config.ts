import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig, loadEnv } from 'vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // make DATABASE_URL, SITE_URL, TZ… from .env available to server code in dev
  Object.assign(process.env, { ...loadEnv(mode, process.cwd(), ''), ...process.env })
  return {
    server: { port: 3000 },
    resolve: { tsconfigPaths: true },
    plugins: [tanstackStart({ srcDirectory: 'src' }), viteReact(), nitro()],
  }
})
