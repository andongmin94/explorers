import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { explorers } from "./public/explorers.js";

const page = (path) => fileURLToPath(new URL(path, import.meta.url));

// Every explorer is its own page under /<slug>/. The switcher in public/ is
// added to each page after Vite has processed it, so it stays a shared file.
const switcher = {
  name: "explorer-switcher",
  transformIndexHtml: {
    order: "post",
    handler: (html, { path }) =>
      path === "/index.html"
        ? []
        : [
            { tag: "link", attrs: { rel: "stylesheet", href: "/switcher.css" }, injectTo: "head" },
            { tag: "script", attrs: { type: "module", src: "/switcher.js" }, injectTo: "body" },
          ],
  },
};

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
    switcher,
    { name: "explorer-slash", configureServer: addTrailingSlash, configurePreviewServer: addTrailingSlash },
  ],
});
