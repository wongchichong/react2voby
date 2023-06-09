//web

import { defineConfig } from 'vite'
import svgr from 'vite-plugin-svgr'


export default defineConfig({
    build: {
        outDir: 'public',
        rollupOptions: {
            external: ['voby', 'test'],
        },
    },
    plugins: [svgr()],
    esbuild: {
        jsx: 'automatic',
    },
})


