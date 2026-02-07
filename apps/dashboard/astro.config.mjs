import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  adapter: vercel(),
  integrations: [react()],
  vite: {
    resolve: {
      alias: {
        '@plugin/types': path.resolve(__dirname, '../../plugins/component-changelog/types.ts'),
        '@plugin/supabase': path.resolve(__dirname, '../../plugins/component-changelog/supabase.ts'),
      },
    },
  },
});
