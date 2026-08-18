import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), tailwindcss(), reactRouter()],
  optimizeDeps: {
    include: ["class-variance-authority", "clsx", "lucide-react", "radix-ui", "tailwind-merge"],
  },
  resolve: {
    tsconfigPaths: true,
  },
});
