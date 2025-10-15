import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
    root: __dirname,
    base: './',
    plugins: [react()],
    build: {
        assetsDir: '.',
        watch: {
            // Avoid rebuild loops from output changes
            exclude: [resolve(__dirname, '../../dist/**')],
        },
        outDir: resolve(__dirname, '../../dist/webviews'),
        emptyOutDir: false,
        sourcemap: mode === 'development',
        minify: mode !== 'development',
        rollupOptions: {
            watch: {
                include: ['**'],
                exclude: [
                    resolve(__dirname, '../../node_modules'),
                    resolve(__dirname, '../../src'),
                    resolve(__dirname, '../../dist'),
                ],
            },
            output: { entryFileNames: '[name].js' },
            input: {
                workflow: resolve(__dirname, 'workflow.html'),
            },
        },
    },
}))
