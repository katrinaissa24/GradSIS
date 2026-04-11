import { defineConfig } from "vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/src/services/supabase.ts")) {
            return "supabase";
          }

          if (!id.includes("node_modules")) return;

          if (id.includes("@supabase/supabase-js")) {
            return "supabase";
          }

          if (
            id.includes("@mui/material") ||
            id.includes("@mui/icons-material") ||
            id.includes("@emotion/react") ||
            id.includes("@emotion/styled") ||
            id.includes("@popperjs/core")
          ) {
            return "mui";
          }

          if (id.includes("recharts")) {
            return "charts";
          }

          if (id.includes("motion")) {
            return "motion";
          }

          if (
            id.includes("react-dnd") ||
            id.includes("dnd-core") ||
            id.includes("@react-dnd") ||
            id.includes("react-dnd-html5-backend") ||
            id.includes("react-dnd-touch-backend") ||
            id.includes("react-dnd-multi-backend")
          ) {
            return "drag-drop";
          }

          if (id.includes("react-router") || id.includes("@remix-run")) {
            return "router";
          }

          if (
            id.includes("@radix-ui") ||
            id.includes("class-variance-authority") ||
            id.includes("clsx") ||
            id.includes("tailwind-merge") ||
            id.includes("lucide-react")
          ) {
            return "ui";
          }

          return "vendor";
        },
      },
    },
  },
  assetsInclude: ["**/*.svg", "**/*.csv"],
});
