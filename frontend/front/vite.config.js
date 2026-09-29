import { defineConfig, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";

const legacyJsxInJs = {
  name: "legacy-jsx-in-js",
  enforce: "pre",
  async transform(code, id) {
    if (!/[\\/]src[\\/].*\.js$/.test(id)) return null;
    return transformWithEsbuild(code, id, {
      loader: "jsx",
      jsx: "automatic",
    });
  },
};

export default defineConfig({
  base: "./",
  define: {
    global: "globalThis",
  },
  plugins: [legacyJsxInJs, react()],
  esbuild: {
    loader: "jsx",
    include: /src\/.*\.[jt]sx?$/,
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
      loader: {
        ".js": "jsx",
      },
    },
  },
  build: {
    outDir: "build",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/](recharts|d3-)/.test(id)) return "charts";
          if (/[\\/]@fortawesome[\\/]/.test(id)) return "icons";
          if (/[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id)) return "react";
          return "vendor";
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 3000,
    strictPort: true,
  },
});
