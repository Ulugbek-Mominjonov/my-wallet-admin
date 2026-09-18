import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    // Router plugin react()'dan OLDIN turishi shart (fayl-marshrutlar generatsiyasi).
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Kutubxonalar alohida chunk'larda: ilova kodi o'zgarganda brauzer
        // ularni keshdan oladi (har deploy'da 500 KB qayta yuklanmaydi).
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            { name: 'tanstack', test: /node_modules[\\/]@tanstack[\\/]/ },
            { name: 'ui', test: /node_modules[\\/](@base-ui|@floating-ui|cmdk|sonner)[\\/]/ },
            { name: 'i18n', test: /node_modules[\\/](i18next|react-i18next)[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    // Supabase lokal auth redirect'i shu manzilga sozlangan (supabase/config.toml).
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
