import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  // Strip non-essential console output from production bundles.
  // console.error and console.warn are preserved for production debugging.
  esbuild: mode === "production"
    ? { drop: ["debugger"], pure: ["console.log", "console.info", "console.debug", "console.trace"] }
    : undefined,
  resolve: {
    alias: [
      {
        find: /^@\/integrations\/supabase\/client$/,
        replacement: path.resolve(__dirname, "./src/integrations/supabase/clientProxy.ts"),
      },
      {
        find: "@",
        replacement: path.resolve(__dirname, "./src"),
      },
    ],
    // Prevent duplicate React instances during build
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          // UI framework
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tabs",
            "@radix-ui/react-accordion",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-toast",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-switch",
            "@radix-ui/react-label",
            "@radix-ui/react-slot",
            "@radix-ui/react-separator",
            "@radix-ui/react-progress",
            "@radix-ui/react-toggle",
            "@radix-ui/react-toggle-group",
            "@radix-ui/react-avatar",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-menubar",
            "@radix-ui/react-navigation-menu",
            "@radix-ui/react-hover-card",
            "@radix-ui/react-context-menu",
            "@radix-ui/react-slider",
            "@radix-ui/react-aspect-ratio",
          ],
          // Animation library
          "vendor-motion": ["framer-motion"],
          // Charts
          "vendor-charts": ["recharts"],
          // Supabase
          "vendor-supabase": ["@supabase/supabase-js"],
          // Data & utilities
          "vendor-utils": ["date-fns", "zod", "class-variance-authority", "clsx", "tailwind-merge"],
          // Spreadsheet (heavy, only needed for data import/export)
          "vendor-xlsx": ["xlsx"],
          // Rich text editor
          "vendor-tiptap": [
            "@tiptap/react",
            "@tiptap/starter-kit",
            "@tiptap/extension-color",
            "@tiptap/extension-link",
            "@tiptap/extension-text-style",
          ],
          // TanStack
          "vendor-query": ["@tanstack/react-query"],
        },
      },
    },
    // Increase warning limit since we've intentionally chunked
    chunkSizeWarningLimit: 400,
  },
}));
