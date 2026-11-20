import { defineConfig } from 'vite';
import { handle } from './server';

// localhost:3000 exactly: the origin registered with `pouchi apps origins add`.
export default defineConfig({
  server: { port: 3000, strictPort: true, host: 'localhost' },
  // No VITE_ env goes to the browser; the app key is read by server.ts only.
  envPrefix: 'S14_PUBLIC_',
  plugins: [
    {
      name: 's14-bff',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          void handle(req, res, next);
        });
      },
    },
  ],
});
