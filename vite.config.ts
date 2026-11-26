import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type PreviewServer, type ViteDevServer } from "vite";
import { explorers } from "./src/lib/explorers.ts";

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// /cpu → /cpu/ so relative script and asset paths resolve inside the explorer
// (Cloudflare does the same with html_handling: "auto-trailing-slash").
function addTrailingSlash(server: ViteDevServer | PreviewServer) {
  server.middlewares.use((request, response, next) => {
    const url = request.url ?? "/";
    const [pathname] = url.split("?");
    const entry = explorers.find(({ slug }) => pathname === `/${slug}`);
    if (!entry) return next();
    response.writeHead(302, { Location: `/${entry.slug}/${url.slice(pathname.length)}` });
    response.end();
  });
}

// Every explorer is its own page under /<slug>/. During the React port both
// kinds of page build side by side: a ported explorer's index.html loads
// src/explorers/<slug>/main.tsx, an old one still loads <slug>/src/main.js.
export default defineConfig({
  base: "/",
  appType: "mpa",
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
  resolve: { tsconfigPaths: true },
  build: {
    target: "esnext",
    rolldownOptions: {
      input: {
        home: page("./index.html"),
        notFound: page("./404.html"),
        ...Object.fromEntries(explorers.map(({ slug }) => [slug, page(`./${slug}/index.html`)])),
        "transaction-deadlock": page("./transaction/deadlock.html"),
      },
      output: {
        // React and UI SDK in shared chunks, cached across the explorer pages.
        codeSplitting: {
          groups: [
            { name: "react", test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: "ui-sdk", test: /[\\/]node_modules[\\/]@ui-sdk[\\/]/ },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "explorer-slash",
      configureServer: addTrailingSlash,
      configurePreviewServer: addTrailingSlash,
    },
  ],
});
