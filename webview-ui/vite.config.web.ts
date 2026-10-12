import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Strict Content-Security-Policy injected into the PRODUCTION build only (it
// would break the dev server's HMR, which needs inline scripts and a websocket).
// `connect-src 'none'` is the crux of the privacy promise: the page cannot make
// any network request at all. Inline *styles* are allowed because the UI uses
// React style attributes throughout; no inline scripts are permitted.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'none'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  // NOTE: `frame-ancestors` and `X-Frame-Options` only work as HTTP response
  // headers, not via <meta>, so set them at the hosting layer (see DEPLOY notes).
].join("; ");

function injectCsp(): Plugin {
  return {
    name: "log-lens-inject-csp",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        "</title>",
        `</title>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`
      );
    },
  };
}

// In dev, serve the web entry (web.html) at the root so `npm run dev:web` opens
// the actual web app at http://localhost:<port>/ — not the VS Code webview entry
// (index.html) that lives in the same directory.
function serveWebEntryAtRoot(): Plugin {
  return {
    name: "log-lens-web-root",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === "/" || req.url === "/index.html") {
          req.url = "/web.html";
        }
        next();
      });
    },
  };
}

// Standalone web app / PWA build. Separate from the VS Code webview build
// (vite.config.ts): its own entry (web.html → src/web/main.tsx), its own output
// (build-web/), relative base so it can be hosted under any path, hashed
// filenames for long-term caching, and PWA assets from public-web/.
export default defineConfig({
  base: "./",
  publicDir: "public-web",
  plugins: [react(), tailwindcss(), injectCsp(), serveWebEntryAtRoot()],
  build: {
    outDir: "build-web",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "web.html"),
      onwarn(warning, warn) {
        if (
          warning.code === "MODULE_LEVEL_DIRECTIVE" &&
          warning.message.includes('"use client"')
        ) {
          return;
        }
        warn(warning);
      },
    },
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
  optimizeDeps: {
    include: ["@dagrejs/dagre", "@dagrejs/graphlib"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
