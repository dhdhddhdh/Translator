import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: path.resolve("electron/main/main.ts")
      },
      outDir: "out/main"
    }
  },
  preload: {
    build: {
      lib: {
        entry: path.resolve("electron/preload/index.ts")
      },
      outDir: "out/preload"
    }
  },
  renderer: {
    root: ".",
    resolve: {
      alias: {
        "@renderer": path.resolve("src")
      }
    },
    plugins: [react()],
    build: {
      outDir: "out/renderer",
      rollupOptions: {
        input: {
          index: path.resolve("index.html"),
          overlay: path.resolve("overlay.html"),
          region: path.resolve("region.html"),
          result: path.resolve("result.html"),
          settings: path.resolve("settings.html")
        }
      }
    }
  }
});
