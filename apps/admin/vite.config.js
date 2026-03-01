import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        // Prioritise .ts/.tsx so stale compiled .js files are never picked up
        extensions: ['.mts', '.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5185,
        strictPort: true, // Fail if port is already in use
        host: true, // Listen on all addresses (0.0.0.0)
    },
});
