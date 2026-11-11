import { cp, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { explorers } from "../public/explorers.js";

const hubRoot = fileURLToPath(new URL("../", import.meta.url));
const projectsRoot = dirname(resolve(hubRoot));
const output = resolve(hubRoot, "dist");

for (const { slug, directory } of explorers) {
  await build({
    root: resolve(projectsRoot, directory),
    base: `/${slug}/`,
    build: {
      target: "esnext",
      outDir: resolve(output, slug),
      emptyOutDir: true,
    },
    plugins: [{
      name: "explorer-switcher",
      transformIndexHtml: {
        order: "post",
        handler: () => [
          { tag: "link", attrs: { rel: "stylesheet", href: "/switcher.css" }, injectTo: "head" },
          { tag: "script", attrs: { type: "module", src: "/switcher.js" }, injectTo: "body" },
        ],
      },
    }],
  });
}

await cp(resolve(hubRoot, "public"), output, { recursive: true });

const firstPath = `/${explorers[0].slug}/`;
await writeFile(resolve(output, "index.html"), `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>탐험가</title>
  <script>location.replace("${firstPath}" + location.search + location.hash)</script>
  <meta http-equiv="refresh" content="0;url=${firstPath}">
</head>
<body><a href="${firstPath}">${explorers[0].label} 열기</a></body>
</html>
`);
