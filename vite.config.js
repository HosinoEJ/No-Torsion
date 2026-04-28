const { defineConfig, loadEnv } = require('vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const devPort = Number(env.VITE_DEV_PORT) || 5180;
  const previewPort = Number(env.VITE_PREVIEW_PORT) || 4173;

  return {
    define: {
      'process.env.NODE_ENV': JSON.stringify('production')
    },
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: devPort,
      strictPort: true
    },
    preview: {
      host: '0.0.0.0',
      port: previewPort,
      strictPort: true
    },
    build: {
      emptyOutDir: true,
      outDir: 'dist',
      rollupOptions: {
        output: {
          assetFileNames: 'assets/[name]-[hash][extname]',
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js'
        }
      }
    }
  };
});
