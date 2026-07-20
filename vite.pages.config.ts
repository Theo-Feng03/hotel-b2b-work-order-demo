import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: "pages",
  base: "/hotel-b2b-work-order-demo/",
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname) } },
  build: { outDir: "../dist-pages", emptyOutDir: true },
});
