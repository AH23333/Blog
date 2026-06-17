import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"

export default defineConfig({
  // GitHub Pages 项目站点配置
  site: "https://AH23333.github.io",
  base: "/Blog",
  devToolbar: {
    enabled: false,
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
