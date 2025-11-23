import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { vercelPreset } from "@vercel/remix/vite";

declare module "@remix-run/node" {
  interface Future {
    v3_singleFetch: true;
  }
}

export default defineConfig({
  resolve: {
    alias: {
      ".prisma/client/index-browser": "./node_modules/@prisma/client/index-browser.js",
    },
  },
  server: {
    host: true,
    allowedHosts: ["regular-terrier-helping.ngrok-free.app"],
  },
  plugins: [
    remix({
      presets: [vercelPreset()],
      future: {
        v3_singleFetch: true,
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
      },
    }),
    tsconfigPaths(),
  ],
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
    },
    include: ["app/**/*.{test,spec}.{ts,tsx}"],
  },
});
