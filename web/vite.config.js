import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte({ preprocess: vitePreprocess({ script: true }) })],
  resolve: {
    alias: { $lib: fileURLToPath(new URL('./pack-opening', import.meta.url)) }
  }
});
