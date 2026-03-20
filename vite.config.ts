import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(async (): Promise<UserConfig> => {
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
    plugins: [reactRouter(), tsconfigPaths()],
    test: {
      environment: "node",
      coverage: {
        provider: "v8",
      },
      include: ["app/**/*.{test,spec}.{ts,tsx}"],
    },
  };
});
