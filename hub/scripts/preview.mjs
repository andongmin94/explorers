import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { explorers } from "../public/explorers.js";

const server = await preview({
  root: fileURLToPath(new URL("../", import.meta.url)),
  configFile: false,
  appType: "mpa",
  preview: {
    host: "127.0.0.1",
    port: Number(process.env.PORT ?? 5173),
    strictPort: true,
  },
  plugins: [{
    name: "explorer-home",
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        const [pathname] = request.url.split("?");
        const entry = pathname === "/"
          ? explorers[0]
          : explorers.find(({ slug }) => pathname === `/${slug}`);
        if (!entry) return next();
        const query = request.url.slice(pathname.length);
        response.writeHead(302, { Location: `/${entry.slug}/${query}` });
        response.end();
      });
    },
  }],
});

server.printUrls();
