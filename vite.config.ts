import { appendFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";

/** Dev-only sink: the plugin POSTs probe results here; they land in docs/probes.jsonl. */
function probeSink(): Plugin {
  return {
    name: "probe-sink",
    configureServer(server) {
      server.middlewares.use("/__probe", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          appendFileSync("docs/probes.jsonl", body.trim() + "\n");
          res.end("ok");
        });
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [probeSink()],
  build: { outDir: "dist", emptyOutDir: true },
  test: { include: ["src/**/*.test.ts"] },
});
