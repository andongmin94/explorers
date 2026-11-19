import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { explorers } from "./shared/explorers.js";

const page = (path) => fileURLToPath(new URL(path, import.meta.url));

// /cpu → /cpu/ so relative script and asset paths resolve inside the explorer.
function addTrailingSlash(server) {
  server.middlewares.use((request, response, next) => {
    const [pathname] = request.url.split("?");
    const entry = explorers.find(({ slug }) => pathname === `/${slug}`);
    if (!entry) return next();
    response.writeHead(302, { Location: `/${entry.slug}/${request.url.slice(pathname.length)}` });
    response.end();
  });
}

// Every explorer is its own page under /<slug>/. Each page imports the shared
// theme and the explorer switcher from shared/ in its main.js.
export default defineConfig({
  appType: "mpa",
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
  build: {
    target: "esnext",
    rolldownOptions: {
      input: {
        home: page("./index.html"),
        ...Object.fromEntries(explorers.map(({ slug }) => [slug, page(`./${slug}/index.html`)])),
        "transaction-deadlock": page("./transaction/deadlock.html"),
      },
    },
  },
  plugins: [
    { name: "explorer-slash", configureServer: addTrailingSlash, configurePreviewServer: addTrailingSlash },
  ],
});
