import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "web",
  base: process.env.GITHUB_ACTIONS ? "/demo-mcp/" : "/",
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true }
});
