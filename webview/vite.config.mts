import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
    root: __dirname,
    base: './',
    plugins: [react()],
    build: {
        outDir: resolve(__dirname, '../dist/webviews'),
        emptyOutDir: false,
        sourcemap: mode === 'development',
        minify: mode !== 'development',
        rollupOptions: {
            input: {
                workflow: resolve(__dirname, 'workflow.html'),
            },
        },
    },
}))
