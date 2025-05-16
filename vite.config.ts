import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import hotReloadExtension from "hot-reload-extension-vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { resolve } from "path";
import tailwindCss from "@tailwindcss/vite";

const srcDir = resolve(__dirname, "src");

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindCss(),
    viteStaticCopy({
      targets: [
        {
          src: resolve(__dirname, "public/manifest.json"),
          dest: "./",
        },
        {
          src: resolve(__dirname, "test_text.json"),
          dest: "./",
        },
        {
          src: resolve(__dirname, "public/icons/*"),
          dest: "./icons",
        },
      ],
    }),
    hotReloadExtension({
      log: true,
      backgroundPath: resolve(srcDir, "background/background.ts"),
    }),
  ],
  resolve: {
    alias: {
      "@": srcDir,
    },
  },
  root: srcDir,
  build: {
    outDir: resolve(__dirname, "dist"),
    sourcemap: true, // Enable source maps for debugging
    rollupOptions: {
      input: {
        // Paths now relative to src
        popup: resolve(srcDir, "popup/index.html"),
        background: resolve(srcDir, "background/background.ts"),
        content: resolve(srcDir, "content/content.ts"),
      },
      output: {
        entryFileNames: "[name]/[name].js",
        chunkFileNames: "assets/[name].[hash].js",
        // Add this to control HTML output paths
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name!.split(".");
          const ext = info[info.length - 1];

          if (ext === "css" || ext === "html") {
            return "[name]/[name].[ext]";
          }

          return "assets/[name].[hash].[ext]";
        },
      },
    },
  },
});
