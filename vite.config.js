import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    root: '.',
    base: '/',

    server: {
        port: 3000,
        host: true,
        open: true,
        cors: true,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                secure: false
            },
            '/socket.io': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                secure: false,
                ws: true
            }
        },
        hmr: false
    },

    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
        minify: 'terser',
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html')
            },
            output: {
                manualChunks: {
                    speech: ['app.js']
                },
                chunkFileNames: 'assets/[name]-[hash].js',
                entryFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash].[ext]'
            }
        },
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true
            }
        }
    },

    optimizeDeps: {
        include: []
    },

    plugins: [],

    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            '@components': resolve(__dirname, 'src/components'),
            '@utils': resolve(__dirname, 'src/utils')
        }
    },

    css: {
        devSourcemap: true,
        preprocessorOptions: {
            css: {
                charset: false
            }
        }
    },

    define: {
        __VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
        __BUILD_TIME__: JSON.stringify(new Date().toISOString())
    }
});
