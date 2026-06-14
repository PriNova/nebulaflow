import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
    root: __dirname,
    base: './',
    plugins: [react()],
    css: {
        postcss: resolve(__dirname, '../workflow/Web'),
    },
    resolve: {
        alias: {
            '@graph': resolve(
                __dirname,
                '../workflow/Web/components/graph'
            ),
            '@sidebar': resolve(
                __dirname,
                '../workflow/Web/components/sidebar'
            ),
            '@modals': resolve(
                __dirname,
                '../workflow/Web/components/modals'
            ),
            '@nodes': resolve(
                __dirname,
                '../workflow/Web/components/nodes'
            ),
            '@shared': resolve(
                __dirname,
                '../workflow/Web/components/shared'
            ),
        },
    },
    build: {
        outDir: resolve(__dirname, '../dist/web'),
        emptyOutDir: true,
        sourcemap: true,
    },
    server: {
        port: 5173,
    },
})
