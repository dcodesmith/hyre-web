import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const isVercel = process.env.VERCEL === "1";

declare module "@remix-run/node" {
  interface Future {
    v3_singleFetch: true;
  }
}

export default defineConfig(async (): Promise<UserConfig> => {
  const presets = [];
  if (isVercel) {
    const { vercelPreset } = await import("@vercel/remix/vite");
    presets.push(vercelPreset());
  }

  return {
    define: {
      // Expose VERCEL env var to client for conditional analytics loading
      "import.meta.env.VITE_VERCEL": JSON.stringify(process.env.VERCEL || ""),
    },
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
        presets,
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
  };
});
