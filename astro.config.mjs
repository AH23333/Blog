import { defineConfig } from "astro/config";

function katexFontFilterPlugin() {
  return {
    name: "katex-font-filter",
    enforce: "post",
    generateBundle(_options, bundle) {
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (
          chunk.type === "asset" &&
          fileName.includes("KaTeX_") &&
          (fileName.endsWith(".ttf") || fileName.endsWith(".woff"))
        ) {
          delete bundle[fileName];
        }
      }
    }
  };
}

export default defineConfig({
  site: "https://www.cubeyond.net/",
  devToolbar: {
    enabled: false
  },
  build: {
    inlineStylesheets: "never"
  },
  vite: {
    plugins: [katexFontFilterPlugin()],
    optimizeDeps: {
      include: ["mermaid"]
    }
  }
});
