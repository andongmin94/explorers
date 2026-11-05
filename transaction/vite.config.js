import { fileURLToPath } from "node:url";

export default {
  build: {
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        deadlock: fileURLToPath(new URL("./deadlock.html", import.meta.url)),
      },
    },
  },
};
