import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig({
  plugins: [
    react(),
    // Sentry plugin for source map uploads (only in production builds)
    process.env.NODE_ENV === 'production' && process.env.VITE_SENTRY_AUTH_TOKEN && sentryVitePlugin({
      org: process.env.VITE_SENTRY_ORG,
      project: process.env.VITE_SENTRY_PROJECT,
      authToken: process.env.VITE_SENTRY_AUTH_TOKEN,
      sourcemaps: {
        assets: './dist/assets/**',
        ignore: ['node_modules'],
        filesToDeleteAfterUpload: ['./dist/assets/**/*.map'],
      },
      telemetry: false,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    strictPort: true, // Fail if port is already in use
    host: true, // Listen on all addresses (0.0.0.0)
  },
  build: {
    sourcemap: true, // Generate source maps for Sentry
    rollupOptions: {
      output: {
        // Manual code splitting for better caching
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
    // Minification settings
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true, // Remove debugger statements
      },
    },
  },
})
