import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://www.cubeyond.net/",
  devToolbar: {
    enabled: false
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
