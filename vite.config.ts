

import { defineConfig } from 'vite'
import svgr from 'vite-plugin-svgr'


export default defineConfig({
    build: {
        outDir: 'build',
        rollupOptions: {
            external: ['voby', 'test'],
        },
    },
    plugins: [svgr()],
    esbuild: {
        jsx: 'automatic',
    },
})


